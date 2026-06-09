import {
  Baichuan,
  ChatGLM,
  Claude,
  Cohere,
  DeepSeek,
  Doubao,
  Gemini,
  Gemma,
  Google,
  Grok,
  Hunyuan,
  InternLM,
  type IconType,
  Kimi,
  LmStudio,
  Meta,
  Microsoft,
  Mistral,
  Moonshot,
  Nvidia,
  Ollama,
  OpenAI,
  Qwen,
  Yi,
  Zhipu
} from "@lobehub/icons";

// Lobe 品牌元件:本體即單色圖示,部分品牌另有 .Color 彩色變體。
type BrandComp = IconType & { Color?: IconType };

// 廠牌名稱(正規化後)→ Lobe 品牌元件。找不到時 OrgLogo 會退回 HF 頭像 / 字母。
const BRANDS: Record<string, BrandComp> = {
  claude: Claude,
  anthropic: Claude,
  openai: OpenAI,
  gpt: OpenAI,
  gemini: Gemini,
  google: Google,
  gemma: Gemma,
  qwen: Qwen,
  alibaba: Qwen,
  meta: Meta,
  metallama: Meta,
  llama: Meta,
  mistral: Mistral,
  mistralai: Mistral,
  deepseek: DeepSeek,
  microsoft: Microsoft,
  phi: Microsoft,
  nvidia: Nvidia,
  cohere: Cohere,
  grok: Grok,
  xai: Grok,
  yi: Yi,
  "01ai": Yi,
  zhipu: Zhipu,
  zhipuai: Zhipu,
  glm: ChatGLM,
  chatglm: ChatGLM,
  thudm: ChatGLM,
  moonshot: Moonshot,
  moonshotai: Moonshot,
  kimi: Kimi,
  doubao: Doubao,
  hunyuan: Hunyuan,
  tencent: Hunyuan,
  baichuan: Baichuan,
  internlm: InternLM,
  ollama: Ollama,
  lmstudio: LmStudio
};

/**
 * 依廠牌名稱取得官方「彩色」圖示元件;沒有彩色變體或不認得的廠牌回傳 null,
 * 交由 OrgLogo 退回 HF 頭像 / 字母(確保白底圖示一定看得見)。
 */
export function brandIcon(org: string): IconType | null {
  const key = org.toLowerCase().replace(/[^a-z0-9]/g, "");
  return BRANDS[key]?.Color ?? null;
}
