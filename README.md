# 金庸群俠傳 · 網頁版

在瀏覽器中遊玩 1996 年經典 DOS 遊戲《金庸群俠傳》，無需安裝任何程式。登入後可將遊戲進度儲存至雲端，跨裝置繼續遊玩。

---

## 專案結構

```
├── index.html      # 主頁面（模擬器、登入、雲端存檔）
├── JINYONG.jsdos   # 遊戲 bundle（含 DOSBox 設定與遊戲檔案）
└── pack.mjs        # 將 zip 遊戲打包成 .jsdos 的腳本
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
| 重新啟動 | 重新載入頁面（未儲存的進度會遺失） |
| 全螢幕 | 切換全螢幕模式 |
| 儲存進度 | 將目前遊戲狀態上傳至雲端（Firestore） |
| 重置遊戲 | 清除本機存檔並回到初始狀態（雲端存檔不受影響） |
| 登出 | 登出帳號並返回登入畫面 |

遊戲載入後會自動啟動，無需手動輸入指令。js-dos 內建的側邊欄與存檔按鈕已隱藏（`kiosk` 模式），避免與「儲存進度」混淆。

## 存檔說明

存檔分為兩層：

1. **遊戲內存檔**：在遊戲選單中存檔（遊戲本身的存檔機制）
2. **雲端存檔**：按「儲存進度」，將 js-dos 的檔案系統變更（`.changes`）上傳至 Firestore

**建議流程**

1. 在遊戲內先存檔
2. 按「儲存進度」上傳至雲端
3. 換裝置時用同一帳號登入，會自動還原雲端存檔

**注意事項**

- 登入時會自動從雲端還原本機 OPFS 存檔，再啟動模擬器
- `autoSave: true` 會在特定操作（如離開全螢幕）時自動寫入本機，但不會自動上傳雲端
- 「重置遊戲」只清除本機存檔，雲端存檔仍保留
- 登出前請確認已按「儲存進度」，否則未上傳的進度會遺失

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
| 雲端存檔 | Firebase Firestore（`saves/{uid}`） |
| 使用者驗證 | Firebase Auth（Google / Email） |
| 確認對話框 | SweetAlert2 |
| Hosting | 靜態檔案（Vercel、GitHub Pages 等） |

### Firebase 設定

`index.html` 內已內嵌 Firebase 設定。若要改用自有專案，請至 [Firebase Console](https://console.firebase.google.com/) 建立專案，並啟用：

- **Authentication**：Email/Password、Google
- **Firestore**：建立 `saves` collection（首次寫入時自動建立）

將 `firebaseConfig` 替換為你的設定值即可。

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
2. 打開 `index.html`，修改以下位置：

```js
// initDos() 內的 bundle 路徑
url: "./你的遊戲.jsdos",
```

```js
// OPFS 讀寫函式內的檔名（共兩處）
"你的遊戲.jsdos.changes"
```

3. 修改頁面標題：

```html
<title>你的遊戲名稱</title>
...
<h1>你的遊戲名稱</h1>
```

4. 重新啟動 server，完成
