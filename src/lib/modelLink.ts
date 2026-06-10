// 模型連結:資料用簡化格式 `hugging_face:{user}:{repo}`,前端展開成可點的網址 + 標籤。
// 也相容舊的完整 URL。
export interface ParsedModelLink {
  url: string;
  label: string;
}

export function parseModelLink(link: string | null | undefined): ParsedModelLink | null {
  if (!link) return null;
  const hf = link.match(/^hugging_face:([^:]+):(.+)$/);
  if (hf) {
    const [, user, repo] = hf;
    return { url: `https://huggingface.co/${user}/${repo}`, label: `${user}/${repo}` };
  }
  if (/^https?:\/\//.test(link)) {
    return { url: link, label: link.replace(/^https?:\/\//, "").replace(/\/$/, "") };
  }
  return null;
}

/** 從模型連結取出 HuggingFace 作者帳號(repo 擁有者);非 HF 連結回 null。 */
export function parseModelAuthor(link: string | null | undefined): string | null {
  const parsed = parseModelLink(link);
  if (!parsed) return null;
  const m = parsed.url.match(/^https?:\/\/huggingface\.co\/([^/]+)\//);
  return m ? m[1] : null;
}
