import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

import type { PackInfo, ResultEntry, SubmissionRow } from "./types";

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
  results_upload: string;
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
  model_thinking: number | null;
  size_params: string | null;
  size_active: string | null;
  quant_format: string | null;
  quant_level: string | null;
  quant_method: string | null;
  link_author: string | null;
  link_author_avatar: string | null;
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
  scores: string | null;
  pass_count: number;
  half_count: number;
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

// 逗號分隔數字字串 → 陣列(空字串視為 null)。scores / results 用此緊湊編碼取代 JSON。
function parseNums(s: string | null): (number | null)[] {
  if (!s) return [];
  return s.split(",").map((x) => (x === "" ? null : Number(x)));
}

// 還原建置期壓掉共同前綴的頭像 URL(u/ = HF CDN 上傳、a/ = HF 預設頭像)。
function expandAvatar(s: string | null): string | null {
  if (!s) return null;
  if (s.startsWith("u/")) return `https://cdn-avatars.huggingface.co/v1/production/uploads/${s.slice(2)}`;
  if (s.startsWith("a/")) return `https://huggingface.co/avatars/${s.slice(2)}`;
  return s;
}

interface CatDef {
  id: string;
  label: string | null;
  weight: number | null;
}

/** 某 pack 的類別定義(id/label/weight),依顯示順序。 */
function getCategories(db: Database, packName: string, packVer: string): CatDef[] {
  return queryAll<{ cat_id: string; label: string | null; weight: number | null }>(
    db,
    `SELECT cat_id, label, weight FROM category WHERE pack_name = $p AND pack_ver = $v ORDER BY ord`,
    { $p: packName, $v: packVer }
  ).map((r) => ({ id: r.cat_id, label: r.label, weight: r.weight }));
}

/** 某 pack 的題目清單,依順序。 */
function getScenarios(db: Database, packName: string, packVer: string): string[] {
  return queryAll<{ scenario_id: string }>(
    db,
    `SELECT scenario_id FROM scenario WHERE pack_name = $p AND pack_ver = $v ORDER BY ord`,
    { $p: packName, $v: packVer }
  ).map((r) => r.scenario_id);
}

function mapRow(r: RawRow, cats: CatDef[]): SubmissionRow {
  const scores = parseNums(r.scores);
  return {
    id: r.id,
    uploader: r.results_upload,
    benchlocal: r.benchlocal,
    packName: r.pack_name,
    packVer: r.pack_ver,
    modelName: r.model_name,
    modelId: r.model_id,
    modelOrg: r.model_org,
    orgAvatar: expandAvatar(r.org_avatar),
    modelLink: r.model_link,
    linkAuthor: r.link_author,
    linkAuthorAvatar: expandAvatar(r.link_author_avatar),
    access: r.model_access,
    deployment: r.deployment,
    familyName: r.family_name,
    familyVer: r.family_ver,
    modelType: r.model_type,
    thinking: r.model_thinking == null ? null : Boolean(r.model_thinking),
    sizeParams: r.size_params,
    sizeActive: r.size_active,
    quantFormat: r.quant_format,
    quantLevel: r.quant_level,
    quantMethod: r.quant_method,
    backendName: r.backend_name,
    backendVer: r.backend_ver,
    hwCompany: r.hw_company,
    hwAvatar: expandAvatar(r.hw_avatar),
    hwDevice: r.hw_device,
    hwChip: r.hw_chip,
    hwOs: r.hw_os,
    hwDriver: r.hw_driver,
    hwExtra: parseJson<Record<string, string | number | boolean>>(r.hw_extra, {}),
    scoreTotal: r.score_total,
    scoreCats: cats.map((c, i) => ({
      id: c.id,
      label: c.label ?? undefined,
      score: scores[i] ?? 0,
      weight: c.weight ?? undefined
    })),
    passCount: r.pass_count,
    halfCount: r.half_count,
    totalCount: r.total_count,
    totalTime: r.total_time,
    runDate: r.run_date,
    runMode: r.run_mode,
    runsPerTest: r.runs_per_test,
    priceInput: null,
    priceCacheInput: null,
    priceOutput: null
  };
}

/** 某個 pack(名稱+版本)的所有投稿(已依分數排序);搜尋 / 篩選 / 分頁在前端用 in-memory 處理。 */
export function getSubmissionsByPack(db: Database, packName: string, packVer: string): SubmissionRow[] {
  const rows = queryAll<RawRow>(
    db,
    `SELECT s.*,
       ao.url AS org_avatar,
       ah.url AS hw_avatar,
       al.url AS link_author_avatar
       FROM submission s
       LEFT JOIN avatar_cache ao ON ao.name = s.model_org
       LEFT JOIN avatar_cache ah ON ah.name = s.hw_company
       LEFT JOIN avatar_cache al ON al.name = s.link_author
      WHERE s.pack_name = $pack AND s.pack_ver = $ver
      ORDER BY s.score_total DESC, s.total_time ASC`,
    { $pack: packName, $ver: packVer }
  );
  const cats = getCategories(db, packName, packVer);
  return rows.map((r) => mapRow(r, cats));
}

/** 單一投稿(詳細頁用)。 */
export function getSubmissionById(db: Database, id: number): SubmissionRow | null {
  const rows = queryAll<RawRow>(
    db,
    `SELECT s.*,
       ao.url AS org_avatar,
       ah.url AS hw_avatar,
       al.url AS link_author_avatar
       FROM submission s
       LEFT JOIN avatar_cache ao ON ao.name = s.model_org
       LEFT JOIN avatar_cache ah ON ah.name = s.hw_company
       LEFT JOIN avatar_cache al ON al.name = s.link_author
      WHERE s.id = $id`,
    { $id: id }
  );
  if (!rows.length) return null;
  const cats = getCategories(db, rows[0].pack_name, rows[0].pack_ver);
  return mapRow(rows[0], cats);
}

/** 單一投稿的每題結果。results 是對齊 scenario 表的 [status,time] 陣列,題號從 scenario 表還原。 */
export function getResults(db: Database, submissionId: number): ResultEntry[] {
  const rows = queryAll<{ results: string | null; pack_name: string; pack_ver: string }>(
    db,
    `SELECT results, pack_name, pack_ver FROM submission WHERE id = $id`,
    { $id: submissionId }
  );
  if (!rows.length || !rows[0].results) return [];
  const flat = parseNums(rows[0].results); // status,time,status,time…
  const scenarios = getScenarios(db, rows[0].pack_name, rows[0].pack_ver);
  const out: ResultEntry[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push({
      scenarioId: scenarios[i / 2] ?? String(i / 2 + 1),
      status: flat[i],
      time: flat[i + 1] ?? 0
    });
  }
  return out;
}
