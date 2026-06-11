// 把 DOM 卡片轉成 PNG 並複製到剪貼簿 / 分享連結。
//
// 重點(綜合各家做法):
// - 用 html-to-image 的 toBlob 把節點轉成 PNG;pixelRatio 2 確保 Retina 清晰。
// - skipFonts:true → 不嵌入跨網域(Google Fonts)字型,避免 CORS 失敗,改用系統字。
// - 卡片自帶配色、用單字字母圖示(不抓外部頭像),避免圖片 CORS 污染 canvas。
// - 複製圖片必須在使用者手勢內、且為安全內容(HTTPS / localhost)。Safari 要求把
//   Promise<Blob> 直接塞進 ClipboardItem(不可先 await),故採用 promise 形式。
// - 不支援 clipboard.write 圖片(如舊版 Firefox)時,退回下載 PNG。

export const SHARE_CARD_BG = "#13150e";

/** 卡片節點 → PNG Blob。 */
export async function nodeToPngBlob(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    pixelRatio: 2,
    cacheBust: true,
    skipFonts: true,
    backgroundColor: SHARE_CARD_BG
  });
  if (!blob) throw new Error("圖片產生失敗");
  return blob;
}

function canWriteImage(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type CopyResult = "copied" | "downloaded";

/**
 * 把卡片複製成 PNG。優先寫入剪貼簿(Safari 安全的 promise 形式),
 * 不支援或失敗時退回下載檔案。回傳實際採用的方式。
 */
export async function copyCardImage(node: HTMLElement, filename: string): Promise<CopyResult> {
  if (canWriteImage()) {
    try {
      // 把 Promise<Blob> 直接交給 ClipboardItem,write 仍在手勢內同步呼叫(Safari 相容)。
      await navigator.clipboard.write([new ClipboardItem({ "image/png": nodeToPngBlob(node) })]);
      return "copied";
    } catch {
      /* 落到下載 */
    }
  }
  downloadBlob(await nodeToPngBlob(node), filename);
  return "downloaded";
}

/**
 * 把(可能跨網域的)圖片網址抓成 data URL,供卡片在擷取前就內嵌。
 * 先轉好 data URL,html-to-image 端就不需要再跨網域抓圖,避免 CORS 擷取失敗。
 * 失敗(CORS / 404)回 null,卡片改用字母圖示。
 */
export async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** 複製文字(連結)到剪貼簿;無 API 時退回 execCommand。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到 fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
