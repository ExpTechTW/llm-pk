/**
 * 把 data/{pack}/{ver}/{author}-*.json 整理成 SQLite,輸出到 public/data.db 給前端使用。
 *
 * - 遞迴掃描 data/ 下所有 .json。
 * - 用 type-check.ts 的 schema 驗證每個檔案,不合格者跳過並警告。
 * - 用資料夾推得的 pack/ver 與 JSON 內容交叉比對,不一致時警告。
 * - 在建置期把廠牌(org)解析成 HuggingFace 頭像 URL 存入 DB(前端零 API 呼叫)。
 * - 建立索引(pack+ver+score、model_name、author)加速前端查詢。
 * - 排行依據:BenchLocal 給的分數 score.total。
 *
 * 用法:npx tsx scripts/build-db.ts
 */
import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSubmission, type Submission } from "../type-check";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const OUT_DIR = join(ROOT, "public");
const OUT_DB = join(OUT_DIR, "data.db");

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
}

function scoreStats(results: Submission["results"]): {
  passCount: number;
  totalCount: number;
  totalTime: number;
} {
  let passCount = 0;
  let totalCount = 0;
  let totalTime = 0;
  for (const entry of Object.values(results)) {
    if (entry.status < 0) continue; // 未執行/錯誤不計入
    totalCount += 1;
    if (entry.status >= 1) passCount += 1;
    totalTime += entry.time;
  }
  return { passCount, totalCount, totalTime };
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

// 查 HuggingFace 組織頭像 URL;失敗 / 找不到回 null。
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
      return json.avatarUrl ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  return (await tryUrl("organizations")) ?? (await tryUrl("users"));
}

async function resolveAvatars(orgs: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (const org of orgs) {
    const url = await fetchHfAvatar(org);
    map.set(org, url);
    console.log(`  org「${org}」→ ${url ? "頭像 OK" : "無頭像(將用字母圖示)"}`);
  }
  return map;
}

function readValidEntries(): { entries: ValidEntry[]; skipped: number } {
  const files = (readdirSync(DATA_DIR, { recursive: true }) as string[])
    .filter((name) => extname(name).toLowerCase() === ".json")
    .map((name) => name.split(sep).join("/"))
    .sort();

  const entries: ValidEntry[] = [];
  let skipped = 0;

  for (const relName of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(DATA_DIR, relName), "utf8"));
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

    entries.push({ relName, raw, value: report.value });
  }

  return { entries, skipped };
}

async function main(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    console.error(`找不到 ${DATA_DIR}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(OUT_DB)) rmSync(OUT_DB);

  const { entries, skipped } = readValidEntries();

  // 先解析所有不同 org(模型廠牌 + 硬體廠牌)的頭像(transaction 內不能 await)。
  const orgByEntry = new Map<ValidEntry, string | null>();
  const hwOrgByEntry = new Map<ValidEntry, string | null>();
  const distinctOrgs = new Set<string>();
  for (const entry of entries) {
    const org = resolveOrgName(entry.value);
    orgByEntry.set(entry, org);
    if (org) distinctOrgs.add(org);

    const hw =
      entry.value.deployment === "local"
        ? (entry.value as Extract<Submission, { deployment: "local" }>).hardware
        : undefined;
    const hwOrg = resolveHwOrg(hw?.company);
    hwOrgByEntry.set(entry, hwOrg);
    if (hwOrg) distinctOrgs.add(hwOrg);
  }
  const avatarByOrg = await resolveAvatars([...distinctOrgs]);

  const db = new Database(OUT_DB);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE submission (
      id            INTEGER PRIMARY KEY,
      file          TEXT,
      benchlocal    TEXT,
      author        TEXT NOT NULL,
      pack_name     TEXT NOT NULL,
      pack_ver      TEXT,
      model_name    TEXT NOT NULL,
      model_id      TEXT,
      model_org     TEXT,
      org_avatar    TEXT,
      model_access  TEXT,
      family_name   TEXT,
      family_ver    TEXT,
      model_type    TEXT,
      size_params   TEXT,
      size_active   TEXT,
      quant_format  TEXT,
      quant_level   TEXT,
      quant_method  TEXT,
      model_link    TEXT,
      backend_name  TEXT,
      backend_ver   TEXT,
      deployment    TEXT,
      hw_company    TEXT,
      hw_avatar     TEXT,
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
      total_count   INTEGER,
      total_time    INTEGER,
      raw           TEXT
    );

    CREATE TABLE result (
      submission_id INTEGER NOT NULL,
      scenario_id   TEXT NOT NULL,
      status        REAL,
      time          INTEGER
    );

    CREATE INDEX idx_sub_pack       ON submission(pack_name, pack_ver);
    CREATE INDEX idx_sub_pack_score ON submission(pack_name, pack_ver, score_total DESC);
    CREATE INDEX idx_sub_model      ON submission(model_name);
    CREATE INDEX idx_sub_author     ON submission(author);
    CREATE INDEX idx_result_sub     ON result(submission_id);
  `);

  const insertSub = db.prepare(`
    INSERT INTO submission (
      file, benchlocal, author, pack_name, pack_ver, model_name, model_id, model_org, org_avatar,
      model_access, family_name, family_ver, model_type, size_params, size_active,
      quant_format, quant_level, quant_method, model_link,
      backend_name, backend_ver, deployment,
      hw_company, hw_avatar, hw_device, hw_chip, hw_os, hw_driver, hw_extra,
      score_total, score_cats, run_date, run_mode, runs_per_test,
      pass_count, total_count, total_time, raw
    ) VALUES (
      @file, @benchlocal, @author, @pack_name, @pack_ver, @model_name, @model_id, @model_org, @org_avatar,
      @model_access, @family_name, @family_ver, @model_type, @size_params, @size_active,
      @quant_format, @quant_level, @quant_method, @model_link,
      @backend_name, @backend_ver, @deployment,
      @hw_company, @hw_avatar, @hw_device, @hw_chip, @hw_os, @hw_driver, @hw_extra,
      @score_total, @score_cats, @run_date, @run_mode, @runs_per_test,
      @pass_count, @total_count, @total_time, @raw
    )
  `);
  const insertResult = db.prepare(
    `INSERT INTO result (submission_id, scenario_id, status, time) VALUES (?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const entry of entries) {
      const s = entry.value;
      const isLocal = s.deployment === "local";
      const hw = isLocal ? (s as Extract<Submission, { deployment: "local" }>).hardware : undefined;
      const quant = isLocal
        ? (s as Extract<Submission, { deployment: "local" }>).model.quantization
        : undefined;
      const stats = scoreStats(s.results);
      const org = orgByEntry.get(entry) ?? null;

      const hwExtra: Record<string, unknown> = {};
      if (hw) {
        for (const [k, v] of Object.entries(hw)) {
          if (!["company", "device", "chip", "os", "driver"].includes(k)) hwExtra[k] = v;
        }
      }

      const info = insertSub.run({
        file: entry.relName,
        benchlocal: s.BenchLocal,
        author: s.author,
        pack_name: s.BenchPack.name,
        pack_ver: s.BenchPack.ver,
        model_name: s.model.name,
        model_id: s.model.id ?? null,
        model_org: org,
        org_avatar: org ? (avatarByOrg.get(org) ?? null) : null,
        model_access: s.model.access,
        family_name: s.model.family?.name ?? null,
        family_ver: s.model.family?.ver ?? null,
        model_type: s.model.type ?? null,
        size_params: s.model.size?.params ?? null,
        size_active: s.model.size?.active ?? null,
        quant_format: quant?.format ?? null,
        quant_level: quant?.level ?? null,
        quant_method: quant?.method ?? null,
        model_link: s.model.link ?? null,
        backend_name: s.backend.name,
        backend_ver: s.backend.ver ?? null,
        deployment: s.deployment,
        hw_company: hw?.company ?? null,
        hw_avatar: (() => {
          const hwOrg = hwOrgByEntry.get(entry);
          return hwOrg ? (avatarByOrg.get(hwOrg) ?? null) : null;
        })(),
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
        total_count: stats.totalCount,
        total_time: stats.totalTime,
        raw: JSON.stringify(entry.raw)
      });

      const subId = Number(info.lastInsertRowid);
      for (const [scenarioId, e] of Object.entries(s.results)) {
        insertResult.run(subId, scenarioId, e.status, e.time);
      }
    }
  });

  tx();
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  db.close();

  console.log(`\n完成:寫入 ${entries.length} 筆投稿,跳過 ${skipped} 筆 → ${OUT_DB}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
