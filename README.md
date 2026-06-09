# LLM PK

本地 / 雲端 LLM 的 BenchLocal 跑分排行榜。每筆投稿(模型 × 量化 × 後端 × 硬體)各自一列,依 BenchLocal 給的分數排名。

## 技術

React 19 · Vite 7 · Tailwind CSS v4 · shadcn/ui (new-york) · sql.js(瀏覽器端 SQLite)· better-sqlite3 + zod(建置期)

## 運作方式

```
data/{pack}/{ver}/{author}-{name}.json
   │  例:data/ToolCall-15/1.0.1/YuYu1015-qwen3.6-35b-gguf-int4.json
   │
   └─(GitHub Action / npm run build:db)──▶  public/data.db
            │  遞迴掃描 + type-check.ts 驗證 + 建索引
            ▼
       前端用 sql.js 載入 data.db,在瀏覽器端搜尋 / 篩選 / 排行
```

投稿路徑用 `data/{BenchPack 名稱}/{版本}/` 分層,檔名以 `{author}-` 開頭(`author` 是 GitHub 帳號,前端用來顯示頭像)。`build-db` 會交叉比對資料夾的 pack/版本與 JSON 內容,不一致時警告。

- **`type-check.ts`**:唯一的 schema 來源(zod)。前端型別、建置腳本、CI 檢查都用它。
- **`scripts/build-db.ts`**:遞迴讀 `data/`,驗證後寫入 `public/data.db`,並建立 `(pack_name, score_total)`、`model_name`、`author` 等索引。
- **`.github/workflows/deploy.yml`**:`data/` 一有變動就重建 DB 並部署到 GitHub Pages。

## 前端

- 中上**搜尋框**(模型 / 系列 / 作者 / 後端);**下拉選單**切換 BenchPack(`{name}-{ver}`)。
- 左側**篩選側欄**(部署、權重、系列、架構、量化格式、後端、硬體廠牌,各帶即時數量),桌面固定不隨內容捲動;依分數 / 最新排序(速度因 device 不同無意義,已移除)。
- 首頁是**概覽卡**:廠牌 logo(由 `model.id`/`model.org` 對應 HuggingFace 頭像,無則彩色字母)為主視覺,模型 `name` 為標題,作者(GitHub 頭像)為副標。
- 點卡片進**詳細頁**:完整規格、分類分數、硬體、執行資訊,以及**每題色塊格 + 錯題清單**。
- RWD:桌面雙欄(固定側欄 + 清單),手機篩選改為可收合。

## 開發

```bash
npm install
npm run build:db   # 由 data/ 產生 public/data.db
npm run dev        # 開發伺服器
npm run check      # 只驗證格式(npx tsx type-check.ts)
npm run build      # 驗證型別 + 建 DB + 打包(輸出 dist/)
```

> `public/data.db` 是產生物,不進版控;clone 後請先 `npm run build:db`。

## score.json 格式

用 `deployment` 判別本地 / 雲端,key 依情況動態出現:

| 情境 | `deployment` | `model.quantization` | `hardware` |
|---|---|---|---|
| 本地自架(開源權重) | `local` | 必填 | 必填(含 `cuda`/`metal` 等動態欄位) |
| 雲端 API(OpenRouter / 閉源) | `cloud` | 省略 | 省略(即「device 留空」的情況) |

```jsonc
{
  "BenchLocal": "0.3.0",                       // BenchLocal 版本
  "author": "YuYu1015",                        // GitHub 帳號(顯示頭像 https://github.com/{author}.png)
  "BenchPack": { "name": "ToolCall-15", "ver": "1.0.1" },  // 測試類型 名稱 / 版本
  "deployment": "local",                        // local | cloud(判別器)
  "model": {
    "name": "Qwen3 27B",                        // 重點展示的乾淨名稱
    "id": "Qwen/Qwen3-27B",                     // 選填:完整識別碼(HF 形式 org/model → 自動帶廠牌 logo)
    "org": "Qwen",                              // 選填:廠牌(留空則由 id 前綴或 family 推得)
    "access": "open",                           // open | closed(開源/閉源權重)
    "family": { "name": "Qwen", "ver": "3.6" }, // 選填
    "type": "MoE",                              // 選填:MoE / Dense
    "size": { "params": "35B", "active": "3B" },// 選填
    "quantization": { "format": "GGUF", "level": "int4", "method": "AutoRound" }, // 僅 local
    "link": "https://huggingface.co/…"          // 選填
  },
  "backend": { "name": "llama.cpp", "ver": "b4321" }, // 本地=引擎;雲端=API 供應商
  "hardware": {                                  // 僅 local;雲端整段省略
    "company": "NVIDIA", "device": "DGX Spark", "chip": "GB10",
    "os": "…", "driver": "595.71.05",
    "cuda": "13.2"                              // 動態 key:NVIDIA 才有;Apple 可放 metal…
  },
  "score": {                                     // 排行依據(BenchLocal 計算)
    "total": 86.7,
    "categories": [ { "id": "tool", "label": "Tool Use", "score": 90 } ]
  },
  "run": { "date": "2026-06-10T08:30:00Z", "mode": "serial", "runsPerTest": 1 },
  "results": {                                   // 每題:status + 花費時間(ms)
    "TC-01": { "status": 1, "time": 16000 }      // 1=pass、(0,1)=partial、0=fail、-1=未執行/錯誤
  }
}
```

`score.json`(repo 根目錄)是一份可參考的完整範例;`data/{pack}/{ver}/` 內為實際投稿。

## 部署到 GitHub Pages

Settings → Pages → Source 選 **GitHub Actions**。推到 `main` 後會自動建 DB 並部署。
`vite.config.ts` 用相對 `base: "./"`,專案網站子路徑(`/llm-pk/`)可直接運作。
