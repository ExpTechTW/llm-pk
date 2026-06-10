/**
 * llm-pk score.json 格式檢查器 / Schema 來源
 * ------------------------------------------------------------------
 * 這個檔案是整個專案唯一的 schema 來源:前端型別、build-db 匯入、CI 檢查都從這裡來。
 *
 * 設計重點(回應需求):
 *  - 用 `deployment` 當判別器:local(本地自架) / cloud(OpenRouter 等雲端 API)。
 *  - 雲端方案沒有本地硬體 → 整段 `hardware` 省略,這就是「device 留空」的情況。
 *  - 支援閉源模型:`model.access = "closed"`,且不需要 quantization / hardware。
 *  - key 可依情況「動態出現」:hardware 用 catchall 接受 cuda / metal 等廠牌專屬欄位。
 *  - 排行依據是 BenchLocal 自己算的分數 `score.total`(非自訂指標)。
 *
 * CLI 用法:
 *   npx tsx type-check.ts                 # 檢查 ./data/json 內所有 *.json
 *   npx tsx type-check.ts path/to.json    # 檢查單一檔案
 *   npx tsx type-check.ts data/json       # 檢查整個資料夾
 */
import { z } from "zod";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

/* ----------------------------- 共用片段 ----------------------------- */

const resultEntry = z.object({
  // 每題狀態:1=正常、0=錯誤、null=半對、-1=未執行/錯誤
  status: z.number().nullable(),
  // 每題花費時間(毫秒)
  time: z.number().nonnegative()
});

const scoreSchema = z.object({
  total: z.number(), // BenchLocal 計算的總分(排行依據)
  categories: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        score: z.number(),
        weight: z.number().optional()
      })
    )
    .optional()
});

const quantizationSchema = z.object({
  format: z.string().min(1, "quantization.format 不可為空(如 GGUF / AWQ / GPTQ / Safetensors)"),
  level: z.string().min(1, "quantization.level 不可為空(如 int4 / Q4_K_M / fp16)"),
  method: z.string() // AutoRound / GPTQ / AWQ / BitsAndBytes…(可空字串)
});

// hardware 用 catchall:固定欄位之外,允許 cuda / metal / rocm 等廠牌專屬的動態 key。
const hardwareSchema = z
  .object({
    company: z.string().min(1, "hardware.company 不可為空(如 NVIDIA / Apple / AMD)"),
    device: z.string().min(1, "本地方案需填 hardware.device(雲端方案請改用 deployment: cloud 並省略 hardware)"),
    chip: z.string().optional(),
    os: z.string().optional(),
    driver: z.string().optional()
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

const modelCommon = {
  name: z.string().min(1, "model.name 不可為空"), // 重點展示的乾淨名稱(如 Qwen3 27B)
  id: z.string().optional(), // 完整識別碼,建議用 HuggingFace 形式 org/model(如 Qwen/Qwen3-27B)
  org: z.string().optional(), // 廠牌 / 組織(顯示 logo 用);留空時由 id 前綴或 family 推得
  access: z.enum(["open", "closed"]), // 開源 / 閉源權重
  family: z.object({ name: z.string(), ver: z.string() }).partial().optional(),
  type: z.string().optional(), // MoE / Dense
  thinking: z.boolean().optional(), // 是否具備 thinking / reasoning 模式
  size: z.object({ params: z.string(), active: z.string().optional() }).optional(),
  link: z.string().optional(),
  // 取樣 / 推測解碼參數(自由結構:temp / top_p / top_k / min_p / penalties / spec…)
  args: z.record(z.string(), z.unknown()).optional()
};

const base = {
  BenchLocal: z.string(),
  results_upload: z.string().min(1, "results_upload 不可為空(GitHub 使用者名稱,上傳跑分結果者)"),
  BenchPack: z.object({ name: z.string().min(1, "BenchPack.name 不可為空"), ver: z.string() }),
  backend: z.object({ name: z.string(), ver: z.string().optional() }),
  score: scoreSchema,
  run: z.object({
    date: z.string(),
    mode: z.string().optional(),
    runsPerTest: z.number().int().positive()
  }),
  results: z.record(z.string(), resultEntry)
};

/* --------------------------- 判別式 union --------------------------- */

const localSubmission = z.object({
  ...base,
  deployment: z.literal("local"),
  model: z.object({ ...modelCommon, quantization: quantizationSchema }),
  hardware: hardwareSchema
});

const cloudSubmission = z.object({
  ...base,
  deployment: z.literal("cloud"),
  // 雲端:不需要量化資訊,也沒有本地硬體
  model: z.object(modelCommon)
});

export const SubmissionSchema = z.discriminatedUnion("deployment", [localSubmission, cloudSubmission]);

export type Submission = z.infer<typeof SubmissionSchema>;
export type ScoreResult = z.infer<typeof resultEntry>;

/* ------------------------------ 驗證 API ------------------------------ */

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  value?: Submission;
}

/** 軟性檢查:不擋下提交,但提醒可能漏填或不一致的地方。 */
function lint(raw: unknown): string[] {
  const warnings: string[] = [];
  if (typeof raw !== "object" || raw === null) return warnings;
  const data = raw as Record<string, any>;

  const hw = data.hardware as Record<string, unknown> | undefined;
  if (data.deployment === "local" && hw) {
    const company = String(hw.company ?? "").toLowerCase();
    if (company.includes("nvidia") && hw.cuda == null) {
      warnings.push("hardware.company 是 NVIDIA,建議補上動態欄位 hardware.cuda(如 \"13.2\")");
    }
    if (company.includes("apple") && hw.metal == null && hw.os == null) {
      warnings.push("Apple 裝置建議補上 hardware.os 或 hardware.metal 版本");
    }
  }

  if (data.deployment === "cloud" && hw) {
    warnings.push("deployment 為 cloud 卻含 hardware,雲端方案通常沒有本地硬體,請確認(將被忽略)");
  }

  if (data.model?.access === "closed" && data.deployment === "local") {
    warnings.push("閉源模型(access: closed)卻標記為 local 部署,請確認");
  }

  if (data.results && Object.keys(data.results).length === 0) {
    warnings.push("results 為空,沒有任何題目結果");
  }

  // 雲端 API(如 OpenRouter)沒有可重現的版本號,留空屬正常,不提醒。
  const backendName = String(data.backend?.name ?? "").toLowerCase();
  const skipVerHint = data.deployment === "cloud" || backendName === "openrouter";
  if (!skipVerHint && data.backend && (data.backend.ver == null || data.backend.ver === "")) {
    warnings.push("backend.ver 留空,建議補上推理引擎/API 版本以利重現");
  }

  return warnings;
}

export function validateSubmission(raw: unknown): ValidationReport {
  const parsed = SubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    });
    return { ok: false, errors, warnings: lint(raw) };
  }
  return { ok: true, errors: [], warnings: lint(raw), value: parsed.data };
}

/* -------------------------------- CLI -------------------------------- */

function collectJsonFiles(target: string): string[] {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    return (readdirSync(target, { recursive: true }) as string[])
      .filter((name) => extname(name).toLowerCase() === ".json")
      .map((name) => join(target, name))
      .sort();
  }
  return [target];
}

function runCli(): void {
  const arg = process.argv[2] ?? "data";
  let files: string[];
  try {
    files = collectJsonFiles(arg);
  } catch {
    console.error(`✗ 找不到路徑:${arg}`);
    process.exit(1);
    return;
  }

  if (files.length === 0) {
    console.log(`（${arg} 內沒有 .json 檔案）`);
    return;
  }

  let hasError = false;
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      hasError = true;
      console.error(`✗ ${file}\n    JSON 解析失敗:${(err as Error).message}`);
      continue;
    }
    const report = validateSubmission(raw);
    if (report.ok) {
      console.log(`✓ ${file}`);
    } else {
      hasError = true;
      console.error(`✗ ${file}`);
      report.errors.forEach((e) => console.error(`    [錯誤] ${e}`));
    }
    report.warnings.forEach((w) => console.warn(`    [提醒] ${w}`));
  }

  console.log(`\n檢查 ${files.length} 個檔案,${hasError ? "有錯誤" : "全部通過"}。`);
  process.exit(hasError ? 1 : 0);
}

// 僅在被直接執行時跑 CLI(被 import 時不執行)
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runCli();
}
