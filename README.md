# LLM PK

本地 / 雲端 LLM 的 BenchLocal 跑分排行榜。每筆投稿(模型 × 量化 × 後端 × 硬體)各自一列,依 BenchLocal 給的分數排名,並提供左右並排對比。

## 技術

React 19 · React Router · Vite 7 · Tailwind CSS v4 · shadcn/ui (new-york) · sql.js(瀏覽器端 SQLite)· better-sqlite3 + zod(建置期)

## 運作方式

```
data/{pack}/{ver}/{open|closed}/{name}.json
   │  例:data/ToolCall-15/1.0.1/open/local-qwen3.6-35b-a3b.json
   │      data/ToolCall-15/1.0.1/closed/openrouter-claude-opus-4.8.json
   │
   └─(npm run build:db)──▶  public/data.db(壓縮過的單一檔,已進版控)
            │  遞迴掃描 + type-check.ts 驗證 + 增量寫入
            ▼
       前端用 sql.js 載入 data.db,在瀏覽器端搜尋 / 篩選 / 排行 / 對比
```

- 路徑分層 `data/{BenchPack}/{版本}/{open|closed}/`:`open` = 本地(檔名 `local-*`)、`closed` = 雲端(`openrouter-*`)。完整路徑可由 pack / 版本 / 部署還原,所以 DB 只存檔名。`build-db` 會交叉比對資料夾與 JSON 內容,不一致時警告。
- **`type-check.ts`**:唯一的 schema 來源(zod),前端型別、建置腳本、CI 檢查都用它。
- **`scripts/build-db.ts`**:**增量建置**——以內容雜湊只重建「新增 / 變更 / 刪除」的檔案,頭像也只抓快取裡沒有的。產出極致壓縮的單一檔 `public/data.db`:
  - 分類分數 / 逐題結果折成逗號字串;類別、題目清單每個 pack 只存一次(`category` / `scenario` 表),submission 只存對齊的數字。
  - 頭像長網址去重存進 `avatar_cache`,前端用 JOIN 組回。
  - 非 WAL 單一檔 + `page_size 512` + `VACUUM`,適合進 git。
  - schema 有變請手動刪 `public/data.db` 再跑一次(腳本不做版本 fallback)。
- **`.github/workflows/deploy.yml`**:推到 `main`(`data/`、`src/`… 變動)時重建 DB 並部署到 GitHub Pages。

## 前端

- **排行榜 `/leaderboard`**:搜尋(模型 / 系列 / 作者 / 後端)、切換 BenchPack;左側**篩選側欄**——部署、權重、思考模式、系列、架構、量化格式 / 等級(facet,各帶即時數量),參數量 / 啟用量 / 價格(範圍拉桿);依分數 / 最新排序(同分時:開源 > 閉源 → 小啟用 → 小參數 → 本地 > 雲端)。卡片以廠牌 logo + 大標模型名(思考模型帶燈泡)+ 徽章 + 分數呈現。
- **對比頁 `/compare`**:左右各選一個模型(需先選系列再選模型,可比不同系列);身分卡 + 雷達圖 + 左右 color bar + 逐題對比(題目說明取自 exam 題庫)。選擇全寫進 URL,可「複製連結」分享;點身分卡進詳細頁,返回鍵會回到對比。
- **詳細頁 `/s/{pack}/{ver}/{file}`**(穩定鍵,重建 DB 不變):完整規格、分類分數、硬體 / 供應商、執行資訊,以及逐題說明卡(點開看題目與評分標準);凸顯模型作者(HuggingFace 頭像)、弱化成績上傳者。
- **多語言**:中 / 英 / 日,右上切換;字串按語系拆成獨立 chunk 動態載入([src/lib/locales/](src/lib/locales/)),題庫也分 `{ver}.{lang}.json`。
- 廠牌 / 作者 logo 在建置期解析成 HuggingFace 頭像存進 DB(前端零 API 呼叫),無頭像時退回彩色字母。
- RWD:桌面側欄固定 + 清單;手機篩選可收合。

## 題庫(public/exam)

題目與評分標準放在 `public/exam/{pack}/{ver}.{lang}.json`(分語言;載入時 `{lang}` → `en` → 無語言後綴依序 fallback,前端直接抓取):

```jsonc
{
  "pack": "ToolCall-15",
  "ver": "1.0.1",
  "scenarios": {
    "TC-01": {
      "title": "單一工具呼叫",
      "category": "basic",
      "prompt": "題目內容…",
      "criteria": ["評分標準 1", "評分標準 2"]
    }
  }
}
```

> 內附的 `ToolCall-15/1.0.1.json` 為示範題庫,請以 BenchLocal 匯出的實際題目與評分標準取代。

## 開發

```bash
npm install
npm run build:db   # 由 data/ 增量產生 public/data.db
npm run dev        # 開發伺服器
npm run check      # 只驗證 data/ 格式(npx tsx type-check.ts)
npm run build      # 建 DB + 驗型別 + 打包(輸出 dist/)
```

> `public/data.db` 已進版控(壓縮後的單一檔)。改了 `data/` 後跑 `npm run build:db` 增量更新即可。

## score.json 格式

用 `deployment` 判別本地 / 雲端,key 依情況動態出現:

| 情境 | `deployment` | `model.quantization` | `hardware` |
|---|---|---|---|
| 本地自架(開源權重) | `local` | 必填 | 必填(含 `cuda`/`metal` 等動態欄位) |
| 雲端 API(OpenRouter / 閉源) | `cloud` | 省略 | 省略(即「device 留空」的情況) |

```jsonc
{
  "BenchLocal": "0.3.0",                       // BenchLocal 版本
  "results_upload": "whes1015",                 // 上傳跑分結果者的 GitHub 帳號(顯示頭像)
  "BenchPack": { "name": "ToolCall-15", "ver": "1.0.1" },  // 測試類型 名稱 / 版本
  "deployment": "local",                        // local | cloud(部署判別器)
  "model": {
    "name": "Qwen3.6 35B A3B",                  // 重點展示的乾淨名稱
    "id": "Qwen/Qwen3.6-35B-A3B",               // 選填:完整識別碼(HF 形式 org/model)
    "org": "Qwen",                              // 選填:廠牌(留空則由 id 前綴或 family 推得)
    "access": "open",                           // open | closed(開源/閉源「權重」,與 deployment 無關)
    "family": { "name": "Qwen", "ver": "3.6" }, // 選填
    "type": "MoE",                              // 選填:MoE / Dense
    "thinking": true,                           // 選填:是否具備思考 / 推理模式
    "size": { "params": "35B", "active": "3B" },// 選填:總參數 / 啟用參數
    "quantization": { "format": "GGUF", "level": "Q4_K_M", "method": "AutoRound" }, // 僅 local
    "link": "hugging_face:Qwen:Qwen3.6-35B-A3B", // 選填:hugging_face:{user}:{repo}(也接受完整 HF 網址,建置時正規化)
    "args": { "temp": 0.6, "top_p": 0.95 }      // 選填:取樣 / 推測解碼參數(自由結構)
  },
  "backend": { "name": "llama.cpp", "ver": "b4321" }, // 本地=引擎;雲端=API 供應商
  "hardware": {                                  // 僅 local;雲端整段省略
    "company": "NVIDIA", "device": "DGX Spark", "chip": "GB10",
    "os": "…", "driver": "595.71.05",
    "cuda": "13.2"                              // 動態 key:NVIDIA 才有;Apple 可放 metal…
  },
  "score": {                                     // 排行依據(BenchLocal 計算)
    "total": 86.7,
    "categories": [ { "id": "A", "label": "Tool Selection", "score": 90, "weight": 20 } ]
  },
  "run": { "date": "2026-06-10T08:30:00Z", "mode": "parallel_by_test_case", "runsPerTest": 1 },
  "results": {                                   // 每題:status + 花費時間(ms)
    "TC-01": { "status": 1, "time": 16000 }      // 1=正常、0=錯誤、null=半對、-1=未執行
  }
}
```

`score.json`(repo 根目錄)是一份可參考的完整範例;`data/{pack}/{ver}/{open|closed}/` 內為實際投稿。

## 部署到 GitHub Pages

Settings → Pages → Source 選 **GitHub Actions**。推到 `main` 後會自動建 DB 並部署。
`vite.config.ts` 用相對 `base: "./"`,專案網站子路徑(`/llm-pk/`)可直接運作。
