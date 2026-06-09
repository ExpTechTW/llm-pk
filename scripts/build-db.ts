/**
 * 把 data/{pack}/{ver}/{author}-*.json 整理成 SQLite,輸出到 public/data.db 給前端使用。
 *
 * - 遞迴掃描 data/ 下所有 .json。
 * - 用 type-check.ts 的 schema 驗證每個檔案,不合格者跳過並警告。
 * - 用資料夾推得的 pack/ver 與 JSON 內容交叉比對,不一致時警告。
 * - 建立索引(pack + score、model_name、author)加速前端查詢。
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

function main(): void {
  if (!existsSync(DATA_DIR)) {
    console.error(`找不到 ${DATA_DIR}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(OUT_DB)) rmSync(OUT_DB);

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
    CREATE INDEX idx_sub_pack_score ON submission(pack_name, score_total DESC);
    CREATE INDEX idx_sub_model      ON submission(model_name);
    CREATE INDEX idx_sub_author     ON submission(author);
    CREATE INDEX idx_result_sub     ON result(submission_id);
  `);

  const insertSub = db.prepare(`
    INSERT INTO submission (
      file, benchlocal, author, pack_name, pack_ver, model_name, model_access,
      family_name, family_ver, model_type, size_params, size_active,
      quant_format, quant_level, quant_method, model_link,
      backend_name, backend_ver, deployment,
      hw_company, hw_device, hw_chip, hw_os, hw_driver, hw_extra,
      score_total, score_cats, run_date, run_mode, runs_per_test,
      pass_count, total_count, total_time, raw
    ) VALUES (
      @file, @benchlocal, @author, @pack_name, @pack_ver, @model_name, @model_access,
      @family_name, @family_ver, @model_type, @size_params, @size_active,
      @quant_format, @quant_level, @quant_method, @model_link,
      @backend_name, @backend_ver, @deployment,
      @hw_company, @hw_device, @hw_chip, @hw_os, @hw_driver, @hw_extra,
      @score_total, @score_cats, @run_date, @run_mode, @runs_per_test,
      @pass_count, @total_count, @total_time, @raw
    )
  `);
  const insertResult = db.prepare(
    `INSERT INTO result (submission_id, scenario_id, status, time) VALUES (?, ?, ?, ?)`
  );

  // 遞迴掃描 data/ 下所有 .json,relName 形如 "ToolCall-15/1.0.1/YuYu1015-xxx.json"
  const files = (readdirSync(DATA_DIR, { recursive: true }) as string[])
    .filter((name) => extname(name).toLowerCase() === ".json")
    .map((name) => name.split(sep).join("/"))
    .sort();

  let inserted = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    for (const relName of files) {
      const full = join(DATA_DIR, relName);
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(full, "utf8"));
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

      // 用資料夾路徑 data/{pack}/{ver}/file 與 JSON 內容交叉比對
      const segments = relName.split("/");
      if (segments.length >= 3) {
        const [folderPack, folderVer] = segments;
        if (folderPack !== report.value.BenchPack.name) {
          console.warn(
            `  ${relName}: 資料夾 pack「${folderPack}」與 JSON 的 BenchPack.name「${report.value.BenchPack.name}」不一致`
          );
        }
        if (folderVer !== report.value.BenchPack.ver) {
          console.warn(
            `  ${relName}: 資料夾版本「${folderVer}」與 JSON 的 BenchPack.ver「${report.value.BenchPack.ver}」不一致`
          );
        }
      }

      const s = report.value;
      const isLocal = s.deployment === "local";
      const hw = isLocal ? (s as Extract<Submission, { deployment: "local" }>).hardware : undefined;
      const quant = isLocal
        ? (s as Extract<Submission, { deployment: "local" }>).model.quantization
        : undefined;
      const stats = scoreStats(s.results);

      // 把 hardware 的固定欄位以外的動態 key(cuda / metal…)收進 hw_extra
      const hwExtra: Record<string, unknown> = {};
      if (hw) {
        for (const [k, v] of Object.entries(hw)) {
          if (!["company", "device", "chip", "os", "driver"].includes(k)) hwExtra[k] = v;
        }
      }

      const info = insertSub.run({
        file: relName,
        benchlocal: s.BenchLocal,
        author: s.author,
        pack_name: s.BenchPack.name,
        pack_ver: s.BenchPack.ver,
        model_name: s.model.name,
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
        raw: JSON.stringify(raw)
      });

      const subId = Number(info.lastInsertRowid);
      for (const [scenarioId, entry] of Object.entries(s.results)) {
        insertResult.run(subId, scenarioId, entry.status, entry.time);
      }
      inserted += 1;
    }
  });

  tx();
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  db.close();

  console.log(`\n完成:寫入 ${inserted} 筆投稿,跳過 ${skipped} 筆 → ${OUT_DB}`);
}

main();
