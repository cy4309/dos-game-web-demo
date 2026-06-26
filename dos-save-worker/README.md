# dos-save-worker

Cloudflare Worker + R2，負責驗證 Firebase ID Token 並讀寫遊戲存檔。

## 前置

1. Cloudflare Dashboard → R2 → 建立 Bucket：`dos-game-saves`
2. `wrangler login`

## 安裝與部署

```bash
cd dos-save-worker
npm install
wrangler deploy
```

部署後記下 URL，例如：`https://dos-save-worker.<帳號>.workers.dev`

將 `index.html` 的 `WORKER_URL` 改成該 URL。

## API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/health` | 健康檢查（不需 token） |
| GET | `/save` | 下載 `saves/{uid}.changes` |
| PUT | `/save` | 上傳二進位存檔 |
| DELETE | `/save` | 刪除雲端存檔 |

所有 `/save` 請求需帶 `Authorization: Bearer <Firebase ID Token>`。

## 測試

```bash
curl https://dos-save-worker.<帳號>.workers.dev/health
# {"ok":true}

curl https://dos-save-worker.<帳號>.workers.dev/save
# 401 Unauthorized
```
