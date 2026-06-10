/**
 * 把 data/{pack}/{ver}/{author}-*.json 整理成 SQLite,輸出到 public/data.db 給前端使用。
 *
 * - 遞迴掃描 data/ 下所有 .json。
 * - 用 type-check.ts 的 schema 驗證每個檔案,不合格者跳過並警告。
 * - 用資料夾推得的 pack/ver 與 JSON 內容交叉比對,不一致時警告。
 * - 在建置期把廠牌(org)/ 模型作者解析成 HuggingFace 頭像 URL 存入 DB(前端零 API 呼叫)。
 * - 建立索引(pack+ver+score、model_name、uploader)加速前端查詢。
 * - 排行依據:BenchLocal 給的分數 score.total。
 *
 * 增量建置:每個檔案的內容雜湊(src_hash)與已解析的頭像(avatar_cache)都存進 DB。
 * 再次執行時只重建「新增 / 變更 / 刪除」的檔案,頭像也只抓快取裡沒有的,大幅省時與省 API。
 * schema 有變時自行刪掉 public/data.db 再跑一次(本腳本不做版本 fallback)。
 *
 * 極致壓縮(資訊量不變):
 * - 每題結果(result)折成一欄 JSON 存在 submission.results,不另開 result 表(省掉上千列與索引)。
 * - 頭像長網址只在 avatar_cache 各存一次,前端用 JOIN 組回。
 * - 不留前端用不到的索引;page_size 512 + VACUUM 壓實;非 WAL → 單一檔案,適合進 git。
 *
 * 用法:npx tsx scripts/build-db.ts
 */
import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSubmission, type Submission } from "../type-check";
import { parseModelAuthor } from "../src/lib/modelLink";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const OUT_DIR = join(ROOT, "public");
const OUT_DB = join(OUT_DIR, "data.db");

// schema 版本(僅記錄用)。結構有變就手動刪 public/data.db 重建,本腳本不做版本 fallback。
const SCHEMA_VERSION = "1";

// family / 關鍵字 → HuggingFace 組織名(供頭像解析)。找不到映射時直接用原字串嘗試。
const HF_ORG_ALIASES: Record<string, string> = {
  qwen: "Qwen",
  gpt: "openai",
  openai: "openai",
  claude: "anthropic",
  anthropic: "anthropic",
  llama: "meta-llama",
  meta: "meta-llama",
  gemini: "google",
  google: "google",
  mistral: "mistralai",
  mixtral: "mistralai",
  mellum: "JetBrains",
  jetbrains: "JetBrains",
  deepseek: "deepseek-ai",
  phi: "microsoft",
  microsoft: "microsoft",
  gemma: "google"
};

// 硬體廠牌 → HuggingFace 組織名(NVIDIA/Apple/AMD… 在 HF 上都有官方帳號)。
const HW_ORG_ALIASES: Record<string, string> = {
  nvidia: "nvidia",
  apple: "apple",
  amd: "amd",
  intel: "intel",
  qualcomm: "qualcomm",
  google: "google",
  arm: "arm"
};

interface ValidEntry {
  relName: string;
  raw: unknown;
  value: Submission;
  hash: string; // 來源檔內容雜湊,供增量比對
}

function scoreStats(results: Submission["results"]): {
  passCount: number;
  halfCount: number;
  totalCount: number;
  totalTime: number;
} {
  let passCount = 0;
  let halfCount = 0;
  let totalCount = 0;
  let totalTime = 0;
  for (const entry of Object.values(results)) {
    const s = entry.status;
    if (s !== null && s < 0) continue; // 未執行/錯誤(-1)不計入
    totalCount += 1; // 正常 / 錯誤 / 半對(null)都算作答
    if (s !== null && s >= 1) passCount += 1; // 只有正常(1)算通過
    if (s === null || (s > 0 && s < 1)) halfCount += 1; // 半對(null 或 0~1 之間)
    totalTime += entry.time;
  }
  return { passCount, halfCount, totalCount, totalTime };
}

// 推得廠牌名稱:明確的 model.org > id 的 org 前綴 > family 別名 > family。
function resolveOrgName(s: Submission): string | null {
  const explicit = s.model.org?.trim();
  if (explicit) return explicit;
  const id = s.model.id?.trim();
  if (id && id.includes("/")) return id.split("/")[0];
  const family = s.model.family?.name?.trim();
  if (family) return HF_ORG_ALIASES[family.toLowerCase()] ?? family;
  return null;
}

// 硬體廠牌 → HF 組織名(供頭像解析)。
function resolveHwOrg(company: string | null | undefined): string | null {
  const c = company?.trim();
  if (!c) return null;
  return HW_ORG_ALIASES[c.toLowerCase()] ?? c;
}

// 查 HuggingFace 頭像 URL(取 /api/{organizations|users}/{name}/overview 的 avatarUrl);失敗回 null。
async function fetchHfAvatar(org: string): Promise<string | null> {
  const tryUrl = async (kind: "organizations" | "users") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`https://huggingface.co/api/${kind}/${encodeURIComponent(org)}/overview`, {
        signal: controller.signal
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { avatarUrl?: string };
      const url = json.avatarUrl;
      if (!url) return null;
      // HF 預設頭像會回相對路徑(/avatars/xxx.svg),補上 host 才能用。
      return url.startsWith("/") ? `https://huggingface.co${url}` : url;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  return (await tryUrl("organizations")) ?? (await tryUrl("users"));
}

function readValidEntries(): { entries: ValidEntry[]; skipped: number } {
  const files = (readdirSync(DATA_DIR, { recursive: true }) as string[])
    .filter((name) => extname(name).toLowerCase() === ".json")
    .map((name) => name.split(sep).join("/"))
    .sort();

  const entries: ValidEntry[] = [];
  let skipped = 0;

  for (const relName of files) {
    let text: string;
    let raw: unknown;
    try {
      text = readFileSync(join(DATA_DIR, relName), "utf8");
      raw = JSON.parse(text);
    } catch (err) {
      console.warn(`跳過 ${relName}:JSON 解析失敗 — ${(err as Error).message}`);
      skipped += 1;
      continue;
    }

    const report = validateSubmission(raw);
    report.warnings.forEach((w) => console.warn(`  ${relName}: ${w}`));
    if (!report.ok || !report.value) {
      console.warn(`跳過 ${relName}:格式不符 — ${report.errors.join("; ")}`);
      skipped += 1;
      continue;
    }

    const segments = relName.split("/");
    if (segments.length >= 3) {
      const [folderPack, folderVer] = segments;
      if (folderPack !== report.value.BenchPack.name) {
        console.warn(`  ${relName}: 資料夾 pack「${folderPack}」與 JSON「${report.value.BenchPack.name}」不一致`);
      }
      if (folderVer !== report.value.BenchPack.ver) {
        console.warn(`  ${relName}: 資料夾版本「${folderVer}」與 JSON「${report.value.BenchPack.ver}」不一致`);
      }
    }

    // 只取雜湊前 5 碼做變更偵測(碰撞機率對這個資料量可忽略)。
    const hash = createHash("sha1").update(text).digest("hex").slice(0, 5);
    entries.push({ relName, raw, value: report.value, hash });
  }

  return { entries, skipped };
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE submission (
      id            INTEGER PRIMARY KEY,
      file          TEXT,
      src_hash      TEXT,
      benchlocal    TEXT,
      results_upload TEXT NOT NULL,
      pack_name     TEXT NOT NULL,
      pack_ver      TEXT,
      model_name    TEXT NOT NULL,
      model_id      TEXT,
      model_org     TEXT,
      model_access  TEXT,
      family_name   TEXT,
      family_ver    TEXT,
      model_type    TEXT,
      model_thinking INTEGER,
      size_params   TEXT,
      size_active   TEXT,
      quant_format  TEXT,
      quant_level   TEXT,
      quant_method  TEXT,
      model_link    TEXT,
      link_author   TEXT,
      backend_name  TEXT,
      backend_ver   TEXT,
      deployment    TEXT,
      hw_company    TEXT,
      hw_device     TEXT,
      hw_chip       TEXT,
      hw_os         TEXT,
      hw_driver     TEXT,
      hw_extra      TEXT,
      score_total   REAL,
      score_cats    TEXT,
      run_date      TEXT,
      run_mode      TEXT,
      runs_per_test INTEGER,
      pass_count    INTEGER,
      half_count    INTEGER,
      total_count   INTEGER,
      total_time    INTEGER,
      results       TEXT
    );

    CREATE TABLE meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE avatar_cache (
      name TEXT PRIMARY KEY,
      url  TEXT
    );

    CREATE UNIQUE INDEX idx_sub_file ON submission(file);
  `);
  db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES('schema_version', ?)").run(SCHEMA_VERSION);
}

// 既有檔 → 增量;不存在 → 建立 schema。schema 有變請自行刪掉 data.db(本腳本不做版本 fallback)。
function openDatabase(): { db: Database.Database; incremental: boolean } {
  if (existsSync(OUT_DB)) {
    return { db: new Database(OUT_DB), incremental: true };
  }
  const db = new Database(OUT_DB);
  createSchema(db);
  return { db, incremental: false };
}

async function main(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    console.error(`找不到 ${DATA_DIR}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const { entries, skipped } = readValidEntries();
  const { db, incremental } = openDatabase();
  console.log(incremental ? "增量模式:沿用既有 data.db" : "全量模式:重新建立 data.db");

  // 既有資料:file → { id, hash };以及頭像快取(只保留有 URL 的)。
  const existingByFile = new Map<string, { id: number; hash: string | null }>();
  for (const r of db.prepare("SELECT id, file, src_hash FROM submission").all() as {
    id: number;
    file: string;
    src_hash: string | null;
  }[]) {
    existingByFile.set(r.file, { id: r.id, hash: r.src_hash });
  }
  const avatarCache = new Map<string, string>();
  for (const r of db.prepare("SELECT name, url FROM avatar_cache").all() as {
    name: string;
    url: string | null;
  }[]) {
    if (r.url) avatarCache.set(r.name, r.url);
  }

  // 分類:未變 / 需處理(新增或變更);以及已從 data/ 移除的檔案。
  const currentFiles = new Set(entries.map((e) => e.relName));
  const toProcess: ValidEntry[] = [];
  let unchanged = 0;
  for (const e of entries) {
    const prev = existingByFile.get(e.relName);
    if (prev && prev.hash === e.hash) {
      unchanged += 1;
    } else {
      toProcess.push(e);
    }
  }
  const toDelete = [...existingByFile.keys()].filter((file) => !currentFiles.has(file));

  // 只為「需處理」的檔案解析所需頭像。avatar_cache 以「前端會持有的字面值」為 key
  //(model_org / hw_company / link_author),前端再用 JOIN 組回 URL,避免每列重複存長網址。
  const metaByEntry = new Map<ValidEntry, { org: string | null; author: string | null }>();
  const need = new Map<string, string>(); // displayKey(cache 的 key)→ fetchName(打 HF API 的名稱)
  for (const e of toProcess) {
    const hw =
      e.value.deployment === "local"
        ? (e.value as Extract<Submission, { deployment: "local" }>).hardware
        : undefined;
    const org = resolveOrgName(e.value);
    const author = parseModelAuthor(e.value.model.link);
    const hwCompany = hw?.company ?? null;
    metaByEntry.set(e, { org, author });
    if (org && !avatarCache.has(org)) need.set(org, org);
    if (hwCompany && !avatarCache.has(hwCompany)) need.set(hwCompany, resolveHwOrg(hwCompany) ?? hwCompany);
    if (author && !avatarCache.has(author)) need.set(author, author);
  }
  if (need.size) {
    console.log(`解析 ${need.size} 個新頭像(其餘走快取)…`);
    for (const [displayKey, fetchName] of need) {
      const url = await fetchHfAvatar(fetchName);
      console.log(`  「${displayKey}」→ ${url ? "頭像 OK" : "無頭像(將用字母圖示)"}`);
      if (url) avatarCache.set(displayKey, url);
    }
  }

  const insertSub = db.prepare(`
    INSERT INTO submission (
      file, src_hash, benchlocal, results_upload, pack_name, pack_ver, model_name, model_id, model_org,
      model_access, family_name, family_ver, model_type, model_thinking, size_params, size_active,
      quant_format, quant_level, quant_method, model_link, link_author,
      backend_name, backend_ver, deployment,
      hw_company, hw_device, hw_chip, hw_os, hw_driver, hw_extra,
      score_total, score_cats, run_date, run_mode, runs_per_test,
      pass_count, half_count, total_count, total_time, results
    ) VALUES (
      @file, @src_hash, @benchlocal, @results_upload, @pack_name, @pack_ver, @model_name, @model_id, @model_org,
      @model_access, @family_name, @family_ver, @model_type, @model_thinking, @size_params, @size_active,
      @quant_format, @quant_level, @quant_method, @model_link, @link_author,
      @backend_name, @backend_ver, @deployment,
      @hw_company, @hw_device, @hw_chip, @hw_os, @hw_driver, @hw_extra,
      @score_total, @score_cats, @run_date, @run_mode, @runs_per_test,
      @pass_count, @half_count, @total_count, @total_time, @results
    )
  `);
  const selIdByFile = db.prepare("SELECT id FROM submission WHERE file = ?");
  const delSub = db.prepare("DELETE FROM submission WHERE id = ?");
  const upsertAvatar = db.prepare("INSERT OR REPLACE INTO avatar_cache(name, url) VALUES(?, ?)");

  const tx = db.transaction(() => {
    // 先刪除:已移除的檔案 + 需重建的變更檔。
    for (const file of new Set([...toDelete, ...toProcess.map((e) => e.relName)])) {
      const row = selIdByFile.get(file) as { id: number } | undefined;
      if (row) delSub.run(row.id);
    }

    // 插入新增/變更的投稿。
    for (const entry of toProcess) {
      const s = entry.value;
      const isLocal = s.deployment === "local";
      const hw = isLocal ? (s as Extract<Submission, { deployment: "local" }>).hardware : undefined;
      const quant = isLocal
        ? (s as Extract<Submission, { deployment: "local" }>).model.quantization
        : undefined;
      const stats = scoreStats(s.results);
      const m = metaByEntry.get(entry)!;

      const hwExtra: Record<string, unknown> = {};
      if (hw) {
        for (const [k, v] of Object.entries(hw)) {
          if (!["company", "device", "chip", "os", "driver"].includes(k)) hwExtra[k] = v;
        }
      }

      insertSub.run({
        file: entry.relName,
        src_hash: entry.hash,
        benchlocal: s.BenchLocal,
        results_upload: s.results_upload,
        pack_name: s.BenchPack.name,
        pack_ver: s.BenchPack.ver,
        model_name: s.model.name,
        model_id: s.model.id ?? null,
        model_org: m.org,
        model_access: s.model.access,
        family_name: s.model.family?.name ?? null,
        family_ver: s.model.family?.ver ?? null,
        model_type: s.model.type ?? null,
        model_thinking: s.model.thinking === undefined ? null : s.model.thinking ? 1 : 0,
        size_params: s.model.size?.params ?? null,
        size_active: s.model.size?.active ?? null,
        quant_format: quant?.format ?? null,
        quant_level: quant?.level ?? null,
        quant_method: quant?.method ?? null,
        model_link: s.model.link ?? null,
        link_author: m.author,
        backend_name: s.backend.name,
        backend_ver: s.backend.ver ?? null,
        deployment: s.deployment,
        hw_company: hw?.company ?? null,
        hw_device: hw?.device ?? null,
        hw_chip: hw?.chip ?? null,
        hw_os: hw?.os ?? null,
        hw_driver: hw?.driver ?? null,
        hw_extra: Object.keys(hwExtra).length ? JSON.stringify(hwExtra) : null,
        score_total: s.score.total,
        score_cats: s.score.categories ? JSON.stringify(s.score.categories) : null,
        run_date: s.run.date,
        run_mode: s.run.mode ?? null,
        runs_per_test: s.run.runsPerTest,
        pass_count: stats.passCount,
        half_count: stats.halfCount,
        total_count: stats.totalCount,
        total_time: stats.totalTime,
        // 每題結果折成 { 題號: [status, time] } 的緊湊 JSON,取代獨立的 result 表。
        results: JSON.stringify(
          Object.fromEntries(Object.entries(s.results).map(([k, e]) => [k, [e.status, e.time]]))
        )
      });
    }

    // 持久化這次新解析到的頭像,供下次建置直接命中。
    for (const displayKey of need.keys()) {
      const url = avatarCache.get(displayKey);
      if (url) upsertAvatar.run(displayKey, url);
    }
  });

  tx();
  // 壓實:非 WAL(單一檔案,適合進 git)+ 小頁面 + VACUUM 回收空間。
  db.pragma("journal_mode = DELETE");
  db.pragma("page_size = 512");
  db.exec("VACUUM;");
  const total = (db.prepare("SELECT COUNT(*) AS c FROM submission").get() as { c: number }).c;
  db.close();

  console.log(
    `\n完成(${incremental ? "增量" : "全量"}):新增/更新 ${toProcess.length}、未變 ${unchanged}、刪除 ${toDelete.length}、略過(格式不符)${skipped} → 共 ${total} 筆 → ${OUT_DB}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
