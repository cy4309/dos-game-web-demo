# 金庸群俠傳 · 網頁版

在瀏覽器中遊玩 1996 年經典 DOS 遊戲《金庸群俠傳》，無需安裝任何程式。

---

## 專案結構

```
├── index.html      # 主頁面，包含模擬器與控制介面
└── JINYONG.jsdos   # 遊戲 bundle（含 DOSBox 設定與遊戲檔案）
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

## 功能說明

| 按鈕        | 說明                                                    |
| ----------- | ------------------------------------------------------- |
| ▶ 啟動遊戲  | 模擬鍵盤輸入 `call play.bat` 啟動遊戲（通常會自動執行） |
| ⛶ 全螢幕    | 切換全螢幕模式                                          |
| 💾 儲存進度 | 將目前遊戲存檔寫入瀏覽器本地（IndexedDB）               |
| ↺ 重置遊戲  | 清除所有本地存檔，回到初始狀態                          |

## 存檔說明

- 進度儲存於**瀏覽器本地**，換裝置或清除瀏覽器資料會遺失
- 先在遊戲內使用遊戲原有的存檔功能，再按「💾 儲存進度」才會持久保存
- 部署後開啟 `autoSave: true`，離開全螢幕時會自動儲存一次

## 操作鍵位

| 按鍵        | 功能                  |
| ----------- | --------------------- |
| 方向鍵      | 移動                  |
| Enter       | 確認                  |
| Esc         | 取消 / 開選單         |
| Alt + Enter | DOSBox 內部切換全螢幕 |

## 技術架構

- **模擬器**：[js-dos v8](https://js-dos.com/)（基於 DOSBox + WebAssembly）
- **Bundle 格式**：`.jsdos`（zip 內含 `.jsdos/dosbox.conf`）
- **存檔機制**：js-dos `props.save()` → 瀏覽器 IndexedDB
- **Hosting**：靜態檔案，可部署至任何靜態 hosting（Vercel、GitHub Pages 等）

## 如何換一款新遊戲（完整流程）

### 第一步：去 archive.org 找遊戲

前往 [archive.org/details/softwarelibrary_msdos_games](https://archive.org/details/softwarelibrary_msdos_games)

搜尋想要的遊戲，進入遊戲頁面後確認以下資訊：

| 欄位             | 說明                                  |
| ---------------- | ------------------------------------- |
| `Emulator`       | 要寫 `dosbox`，才能用 js-dos 跑       |
| `Emulator_start` | 啟動檔名，例如 `play.bat`、`game.exe` |
| `ZIP download`   | 下載這個，就是遊戲本體                |

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

專案根目錄放一個 `pack.mjs`，之後每次換遊戲都用這個：

```js
// pack.mjs
// 用法：node pack.mjs <遊戲.zip> <啟動指令>
// 範例：node pack.mjs JINYONG.zip "call play.bat"

import JSZip from "jszip";
import fs from "fs";
import path from "path";

const [, , inputZip, startCmd] = process.argv;

if (!inputZip || !startCmd) {
  console.error("用法：node pack.mjs <遊戲.zip> <啟動指令>");
  process.exit(1);
}

const data = fs.readFileSync(inputZip);
const original = await JSZip.loadAsync(data);
const newZip = new JSZip();

// 複製所有原始遊戲檔案
for (const [name, entry] of Object.entries(original.files)) {
  if (entry.dir) {
    newZip.folder(name);
  } else {
    newZip.file(name, await entry.async("nodebuffer"));
  }
}

// 注入 .jsdos/dosbox.conf
newZip.file(
  ".jsdos/dosbox.conf",
  `[cpu]
cycles=max

[autoexec]
mount c .
c:
${startCmd}
`,
);

const out = await newZip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});

const outName = path.basename(inputZip, ".zip") + ".jsdos";
fs.writeFileSync(outName, out);
console.log(`✓ 完成：${outName}（${(out.length / 1024 / 1024).toFixed(1)} MB）`);
```

安裝依賴（只需要裝一次）：

```bash
npm install jszip
```

執行打包：

```bash
node pack.mjs 你的遊戲.zip "call play.bat"
# 輸出：你的遊戲.jsdos
```

---

### 第四步：套用到專案

1. 把產出的 `.jsdos` 放進專案資料夾
2. 打開 `index.html`，找到這行改成新檔名：

```js
url: "./你的遊戲.jsdos",
```

3. 順便把頁面標題也改一下：

```html
<title>你的遊戲名稱</title>
...
<h1>你的遊戲名稱</h1>
```

4. 重新啟動 server，完成
