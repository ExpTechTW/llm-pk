import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

import type { PackInfo, ResultEntry, ScoreCategory, SubmissionRow } from "./types";

let dbPromise: Promise<Database> | null = null;

/** 載入 sql.js(WASM)並讀入 public/data.db,只做一次。 */
export function loadDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl });
      const res = await fetch(`${import.meta.env.BASE_URL}data.db`, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(`無法載入資料庫(data.db):${res.status} ${res.statusText}`);
      }
      const buffer = await res.arrayBuffer();
      return new SQL.Database(new Uint8Array(buffer));
    })();
  }
  return dbPromise;
}

function queryAll<T>(db: Database, sql: string, params?: Record<string, unknown>): T[] {
  const stmt = db.prepare(sql);
  try {
    if (params) stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

/** 所有測試類型(BenchPack)的 名稱+版本 組合,依投稿數由多到少排序。 */
export function getPacks(db: Database): PackInfo[] {
  return queryAll<PackInfo>(
    db,
    `SELECT pack_name AS name, pack_ver AS ver, COUNT(*) AS count
       FROM submission
      GROUP BY pack_name, pack_ver
      ORDER BY count DESC, name ASC, ver DESC`
  );
}

interface RawRow {
  id: number;
  author: string;
  benchlocal: string;
  pack_name: string;
  pack_ver: string;
  model_name: string;
  model_id: string | null;
  model_org: string | null;
  org_avatar: string | null;
  model_link: string | null;
  model_access: string;
  deployment: string;
  family_name: string | null;
  family_ver: string | null;
  model_type: string | null;
  size_params: string | null;
  size_active: string | null;
  quant_format: string | null;
  quant_level: string | null;
  quant_method: string | null;
  backend_name: string;
  backend_ver: string | null;
  hw_company: string | null;
  hw_avatar: string | null;
  hw_device: string | null;
  hw_chip: string | null;
  hw_os: string | null;
  hw_driver: string | null;
  hw_extra: string | null;
  score_total: number;
  score_cats: string | null;
  pass_count: number;
  total_count: number;
  total_time: number;
  run_date: string;
  run_mode: string | null;
  runs_per_test: number;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapRow(r: RawRow): SubmissionRow {
  return {
    id: r.id,
    author: r.author,
    benchlocal: r.benchlocal,
    packName: r.pack_name,
    packVer: r.pack_ver,
    modelName: r.model_name,
    modelId: r.model_id,
    modelOrg: r.model_org,
    orgAvatar: r.org_avatar,
    modelLink: r.model_link,
    access: r.model_access,
    deployment: r.deployment,
    familyName: r.family_name,
    familyVer: r.family_ver,
    modelType: r.model_type,
    sizeParams: r.size_params,
    sizeActive: r.size_active,
    quantFormat: r.quant_format,
    quantLevel: r.quant_level,
    quantMethod: r.quant_method,
    backendName: r.backend_name,
    backendVer: r.backend_ver,
    hwCompany: r.hw_company,
    hwAvatar: r.hw_avatar,
    hwDevice: r.hw_device,
    hwChip: r.hw_chip,
    hwOs: r.hw_os,
    hwDriver: r.hw_driver,
    hwExtra: parseJson<Record<string, string | number | boolean>>(r.hw_extra, {}),
    scoreTotal: r.score_total,
    scoreCats: parseJson<ScoreCategory[]>(r.score_cats, []),
    passCount: r.pass_count,
    totalCount: r.total_count,
    totalTime: r.total_time,
    runDate: r.run_date,
    runMode: r.run_mode,
    runsPerTest: r.runs_per_test
  };
}

/** 某個 pack(名稱+版本)的所有投稿(已依分數排序);搜尋 / 篩選 / 分頁在前端用 in-memory 處理。 */
export function getSubmissionsByPack(db: Database, packName: string, packVer: string): SubmissionRow[] {
  const rows = queryAll<RawRow>(
    db,
    `SELECT * FROM submission
      WHERE pack_name = $pack AND pack_ver = $ver
      ORDER BY score_total DESC, total_time ASC`,
    { $pack: packName, $ver: packVer }
  );
  return rows.map(mapRow);
}

/** 單一投稿(詳細頁用)。 */
export function getSubmissionById(db: Database, id: number): SubmissionRow | null {
  const rows = queryAll<RawRow>(db, `SELECT * FROM submission WHERE id = $id`, { $id: id });
  return rows.length ? mapRow(rows[0]) : null;
}

/** 單一投稿的每題結果,依題號排序。 */
export function getResults(db: Database, submissionId: number): ResultEntry[] {
  return queryAll<{ scenario_id: string; status: number; time: number }>(
    db,
    `SELECT scenario_id, status, time FROM result WHERE submission_id = $id ORDER BY scenario_id ASC`,
    { $id: submissionId }
  ).map((r) => ({ scenarioId: r.scenario_id, status: r.status, time: r.time }));
}
