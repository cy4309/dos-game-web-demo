# 金庸群俠傳 · 網頁版

在瀏覽器中遊玩 1996 年經典 DOS 遊戲《金庸群俠傳》，無需安裝任何程式。登入後可將遊戲進度儲存至雲端，跨裝置繼續遊玩。

---

## 專案結構

```
├── index.html              # 主頁面（模擬器、登入、雲端存檔 UI）
├── JINYONG.jsdos           # 遊戲 bundle（含 DOSBox 設定與遊戲檔案）
├── pack.mjs                # 將 zip 遊戲打包成 .jsdos 的腳本
└── dos-save-worker/        # Cloudflare Worker（R2 存檔 API）
    ├── src/index.js
    └── wrangler.toml
```

## 本地開發

瀏覽器安全限制不允許直接開啟 `index.html`，需要透過 HTTP server 執行。

**Node.js**

```bash
npx serve .
```

然後開啟 `http://localhost:3000`

**Python**

```bash
python3 -m http.server 8080
```

然後開啟 `http://localhost:8080`

## 部署到 Vercel

**方式一：拖曳部署（不需要 Git）**

1. 前往 [vercel.com](https://vercel.com) 登入
2. 點「Add New → Project」
3. 將整個專案資料夾拖進部署區域
4. 按下 Deploy

**方式二：透過 GitHub（推薦）**

```bash
git init
git add .
git commit -m "init"
git remote add origin <你的 GitHub repo URL>
git push -u origin main
```

在 Vercel 連結該 repo 後，每次 `git push` 會自動重新部署。

## 登入方式

| 方式 | 說明 |
| ---- | ---- |
| Google 帳號登入 | 主要登入方式，一鍵登入 |
| 信箱註冊登入 | 點擊後展開表單，可登入或註冊新帳號 |

信箱與密碼規則：

- 電子郵件需為有效格式
- 密碼至少 6 個字元、不可超過 128 個字元、不可含空白

## 功能說明

| 按鈕 | 說明 |
| ---- | ---- |
| 重新啟動 | 重新載入頁面（未上傳雲端的進度可能遺失） |
| 全螢幕 | 切換全螢幕模式 |
| 儲存進度 | 將目前遊戲狀態上傳至雲端（Cloudflare R2） |
| 重置遊戲 | 清除本機與雲端存檔，回到初始狀態 |
| 登出 | 登出帳號、清除本機存檔，返回登入畫面 |

遊戲載入後會自動啟動，無需手動輸入指令。js-dos 內建的側邊欄與存檔按鈕已隱藏（`kiosk` 模式），避免與「儲存進度」混淆。

## 存檔邏輯

### 架構概覽

存檔分三層，各自用途不同：

| 層級 | 儲存位置 | 用途 |
| ---- | -------- | ---- |
| 遊戲內存檔 | 模擬器虛擬硬碟 | 遊戲選單的存檔槽（劇情進度的來源） |
| 本機存檔 | 瀏覽器 OPFS（`JINYONG.jsdos.changes`） | js-dos 在本機暫存檔案系統變更 |
| 雲端存檔 | Cloudflare R2（`saves/{uid}.changes`） | 跨裝置、登出後仍可還原的正式存檔 |

Firebase 只用於**登入驗證**（Google / 信箱），不直接存放遊戲檔案。上傳／下載透過 Cloudflare Worker 驗證 Firebase ID Token 後讀寫 R2。

```
┌─────────────┐   PUT/GET/DELETE    ┌──────────────────┐   R2    ┌─────────────────────┐
│  index.html │ ◄────────────────► │ dos-save-worker  │ ◄─────► │ saves/{uid}.changes │
│  (js-dos)   │  Bearer JWT token   │  (驗證 Firebase)  │         └─────────────────────┘
└──────┬──────┘                     └──────────────────┘
       │ OPFS（本機）
       ▼
 JINYONG.jsdos.changes
```

### 上傳流程（按「儲存進度」）

1. 呼叫 `dosProps.save()`，將模擬器狀態寫入本機
2. 呼叫 `gameCI.persist(true)`，匯出最新的檔案系統變更（`.changes` 二進位）
3. 帶 Firebase ID Token 發送 `PUT /save` 至 Worker
4. Worker 驗證 token 後，寫入 R2：`saves/{Firebase uid}.changes`
5. 成功後顯示 toast（含檔案大小）；上傳期間會顯示「存檔中，請勿關閉頁面」

**前提：** 必須先在**遊戲選單內存檔**，否則可能提示「尚無遊戲進度可儲存」。

### 還原流程（登入時自動執行）

1. 登入後啟動模擬器前，先 `GET /save` 向 R2 查詢雲端存檔
2. **有雲端存檔（200）**
   - 清除本機 OPFS，避免舊的本機進度蓋過雲端
   - 透過 js-dos 的 `fsChanges.pull` 注入雲端 `.changes`
   - 提示「**已還原雲端存檔**」
3. **無雲端存檔（404）**
   - 從遊戲 bundle 全新開始；若本機 OPFS 仍有資料則沿用
   - 提示「**遊戲載入完成**」

還原的是**虛擬硬碟上的存檔檔案**，遊戲啟動後若不在劇情中，需到遊戲選單**讀取相同存檔槽**。

### 登出與重置

| 操作 | 本機 OPFS | 雲端 R2 |
| ---- | --------- | ------- |
| 登出 | 清除 | 保留 |
| 重置遊戲 | 清除 | 刪除（`DELETE /save`） |

登出後再登入，只會還原**上次成功上傳**的雲端進度。

### 常見情境

| 情境 | 結果 |
| ---- | ---- |
| 第一次登入、從未按過「儲存進度」 | 從頭開始；`GET /save` 回 404 屬正常 |
| 玩了但沒在遊戲內存檔、也沒按「儲存進度」 | 登出後進度消失；同次登入內重新整理可能靠本機 `autoSave` 接續，但不保證完整 |
| 遊戲內存檔 → 按「儲存進度」→ 登出 → 再登入 | 還原雲端進度；到遊戲選單讀取相同存檔槽 |
| 按「儲存進度」但沒先在遊戲內存檔 | 多半失敗；就算上傳成功也可能不完整 |
| 換瀏覽器／無痕視窗，同一帳號登入 | 從 R2 還原（需曾成功上傳過） |

### 建議流程

```
遊戲選單內存檔 → 按「儲存進度」→ 看到成功提示 → 再登出
```

### Worker API 摘要

| 方法 | 路徑 | 說明 |
| ---- | ---- | ---- |
| GET | `/health` | 健康檢查（不需 token） |
| GET | `/save` | 下載 `saves/{uid}.changes` |
| PUT | `/save` | 上傳二進位存檔 |
| DELETE | `/save` | 刪除雲端存檔 |

所有 `/save` 請求需帶 `Authorization: Bearer <Firebase ID Token>`。

Worker 部署方式見 [`dos-save-worker/README.md`](dos-save-worker/README.md)。

## 操作鍵位

| 按鍵 | 功能 |
| ---- | ---- |
| 方向鍵 | 移動 |
| Enter | 確認 |
| Esc | 取消 / 開選單 |
| Alt + Enter | DOSBox 內部切換全螢幕 |

## 技術架構

| 項目 | 技術 |
| ---- | ---- |
| 模擬器 | [js-dos v8](https://js-dos.com/)（DOSBox + WebAssembly） |
| Bundle 格式 | `.jsdos`（zip 內含 `.jsdos/dosbox.conf`） |
| 本機存檔 | OPFS（`JINYONG.jsdos.changes`） |
| 雲端存檔 | Cloudflare R2 + Worker |
| 使用者驗證 | Firebase Auth（Google / Email） |
| 確認對話框 | SweetAlert2 |
| Hosting | 靜態檔案（Vercel、Cloudflare Pages 等） |

### Firebase 設定

`index.html` 內已內嵌 Firebase 設定。若要改用自有專案，請至 [Firebase Console](https://console.firebase.google.com/) 建立專案，並啟用：

- **Authentication**：Email/Password、Google
- **Authorized domains**：加入你的部署網域（如 `xxx.vercel.app`）

將 `firebaseConfig` 替換為你的設定值。Worker 的 `wrangler.toml` 中 `FIREBASE_PROJECT_ID` 需與 Firebase 專案 ID 一致。

### Cloudflare Worker 設定

1. R2 建立 Bucket：`dos-game-saves`
2. 部署 Worker（見 [`dos-save-worker/README.md`](dos-save-worker/README.md)）
3. 將 `index.html` 的 `WORKER_URL` 改為部署後的 Worker URL
4. 重新部署前端

## 如何換一款新遊戲（完整流程）

### 第一步：去 archive.org 找遊戲

前往 [archive.org/details/softwarelibrary_msdos_games](https://archive.org/details/softwarelibrary_msdos_games)

搜尋想要的遊戲，進入遊戲頁面後確認以下資訊：

| 欄位 | 說明 |
| ---- | ---- |
| `Emulator` | 要寫 `dosbox`，才能用 js-dos 跑 |
| `Emulator_start` | 啟動檔名，例如 `play.bat`、`game.exe` |
| `ZIP download` | 下載這個，就是遊戲本體 |

> 範例頁面：`https://archive.org/details/heros_of_jin_yong`
> 下載連結格式：`https://archive.org/download/<identifier>/<檔名>.zip`

---

### 第二步：確認啟動指令

下載 zip 後解壓，找到啟動檔（通常是 `.bat` 或 `.exe`）：

- 有 `play.bat` → 啟動指令用 `call play.bat`
- 只有 `game.exe` → 啟動指令用 `game.exe`
- 不確定 → 看 archive.org 頁面的 `Emulator_start` 欄位

---

### 第三步：用腳本打包成 `.jsdos`

專案根目錄已有 `pack.mjs`：

```bash
# 安裝依賴（只需要裝一次）
npm install jszip

# 執行打包
node pack.mjs 你的遊戲.zip "call play.bat"
# 輸出：你的遊戲.jsdos
```

`pack.mjs` 會在 zip 內注入 `.jsdos/dosbox.conf`，設定 `cycles=max` 並在開機時自動執行啟動指令。

---

### 第四步：套用到專案

1. 把產出的 `.jsdos` 放進專案資料夾
2. 打開 `index.html`，修改 `BUNDLE_KEY` 常數：

```js
const BUNDLE_KEY = "你的遊戲.jsdos";
```

`initDos()` 的 `url` 與 OPFS 檔名會自動沿用此常數。

3. 修改頁面標題：

```html
<title>你的遊戲名稱</title>
...
<h1>你的遊戲名稱</h1>
```

4. 重新啟動 server，完成
