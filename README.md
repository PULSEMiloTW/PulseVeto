# PulseVeto

一套自行託管的 VALORANT 賽事地圖 Ban／Pick、選邊、比分、公開結果與 OBS Overlay 系統。資料保存在執行主機的 SQLite；Cloudflare Tunnel 只負責將 HTTPS 與 WebSocket 流量轉送至本機。

> 本專案與 Riot Games 或 VALORANT 官方沒有隸屬、贊助或認可關係。VALORANT 及相關商標與素材屬其權利人所有。

## 功能

- Pulse Studio、賽事單位、Team A、Team B 分級權限
- 可撤銷的 HttpOnly Session、CSRF、Origin／Host 驗證與登入 Rate Limit
- 16 位安全金鑰：Lookup Hash、Argon2id、加密副本、到期與撤銷
- 多賽事單位、多賽事、多場 BP
- Bo1／Bo3／Bo5 預設流程與七張地圖池
- Ban、Pick、Pick 後選邊、Decider 與安全 Coin Toss
- 選手首次使用隊伍代碼時的對戰入場動畫、雙方 Ready Check，以及伺服器同步的地圖／攻守倒數
- 可設定 `-1` 無限制；逾時會以安全亂數抽選，逾時隊伍自動視為已確認抽選結果
- SQLite Transaction、版本衝突檢查與 Socket.IO 即時同步
- 單張地圖比分、勝方與下一張地圖同步
- 四種 VCT Overlay、Current Overlay、公開結果頁與動態 Open Graph
- Audit Log、Pino Log、本機備份／還原與地圖快取
- Cloudflared Tunnel，無需路由器 Port Forwarding

## 技術架構

- Node.js、Express、TypeScript
- Prisma ORM、SQLite（WAL）
- Socket.IO、Zod、Pino
- Argon2id、Node.js `crypto`
- 原生 HTML／CSS／JavaScript Overlay 與管理介面

所有執行資料預設位於 `storage/`：

```text
storage/
├─ database/      SQLite
├─ uploads/       賽事與隊伍圖片
├─ cache/         VALORANT 地圖快取
├─ logs/          Application／Audit／Error Log
└─ backups/       SQLite 安全備份
```

## 系統需求

- Node.js 22 或更新版本
- npm 10 或更新版本
- Windows 10／11 或現代 Linux
- 選用：`cloudflared`

## 快速安裝

```bash
git clone YOUR_REPOSITORY_URL
cd PulseVeto
npm ci
```

複製環境設定：

```powershell
Copy-Item .env.example .env
```

Linux：

```bash
cp .env.example .env
```

在 `.env` 設定至少 32 字元的 `SESSION_SECRET` 與 `KEY_ENCRYPTION_SECRET`。不要使用 README 中的範例字串作為正式秘密。

```bash
npm run prisma:generate
npm run prisma:migrate
npm run admin:create
npm run maps:sync
```

開發環境：

```bash
npm run dev
```

正式環境：

```bash
npm run build
npm start
```

預設網址為 `http://localhost:3000`。

## 環境變數

| 變數 | 用途 |
|---|---|
| `DATABASE_URL` | Prisma SQLite 位置 |
| `SESSION_SECRET` | Session／CSRF 安全秘密 |
| `KEY_ENCRYPTION_SECRET` | 可重新顯示金鑰的本機加密主密鑰 |
| `PULSE_ADMIN_PASSWORD_HASH` | 選用的管理員 Argon2id Hash |
| `PULSE_ENTRY_IDENTIFIER` | Pulse Studio 入口識別字 |
| `DISCORD_CLIENT_ID` | Discord Application OAuth2 Client ID |
| `DISCORD_CLIENT_SECRET` | Discord Application Client Secret，只能放在本機 `.env` |
| `DISCORD_REDIRECT_URI` | Discord OAuth2 Callback，正式站為 `https://veto.pulse-studio.live/api/auth/discord/callback` |
| `PULSE_DISCORD_USER_ID` | 可進入 Pulse 最高管理頁的 Discord User ID |
| `PUBLIC_BASE_URL` | Canonical、Open Graph 與公開連結的絕對 Base URL |
| `TRUSTED_HOSTS` | 允許的 Host 清單 |
| `LOG_LEVEL` | Pino Log Level |
| `LOG_RETENTION_DAYS` | Log 保留天數 |
| `BACKUP_RETENTION_COUNT` | 備份保留數量 |
| `PORT` | HTTP 監聽 Port |

完整空白範本請見 [`.env.example`](.env.example)。正式環境不要 Commit `.env`。

Discord Developer Portal 的 OAuth2 Redirect 必須與 `DISCORD_REDIRECT_URI` 完全一致，Scope 只需 `identify`。賽事單位的 Discord User ID 由 Pulse 管理頁建立或修改；`PULSE_DISCORD_USER_ID` 會直接進入 Pulse 最高管理頁。

## BP 規則

### Bo3

1. Team A Ban
2. Team B Ban
3. Team A Pick，Team B 選邊
4. Team B Pick，Team A 選邊
5. Team A Ban
6. Team B Ban
7. 最後地圖為 Decider，Team A 選邊

### Bo5

1. Team A Ban
2. Team B Ban
3. Team A Pick，Team B 選邊
4. Team B Pick，Team A 選邊
5. Team A Pick，Team B 選邊
6. Team B Pick，Team A 選邊
7. 最後地圖為 Decider，Team B 選邊

## OBS Overlay

OBS Browser Source 建議使用 `1920 × 1080`、透明背景。Overlay URL 必須使用管理頁產生的高熵 Public Token，不可改用隊伍金鑰。

```text
/overlay-vct-tc/{overlayToken}
/overlay-vct-tc-i/{overlayToken}
/overlay-vct-en/{overlayToken}
/overlay-vct-en-i/{overlayToken}
/overlay/current/{overlayToken}
/overlay/result/{overlayToken}
```

完整資料請見 [`docs/OVERLAY-INVENTORY.md`](docs/OVERLAY-INVENTORY.md)。

## Cloudflare Tunnel

```text
Internet → Cloudflare HTTPS → cloudflared → localhost → SQLite
```

Cloudflare 不保存本系統的賽事或金鑰資料。設定步驟請見 [`docs/CLOUDFLARED.md`](docs/CLOUDFLARED.md)，範本位於 [`cloudflared/config.yml.example`](cloudflared/config.yml.example)。

## 備份與還原

```bash
npm run backup
```

還原前先停止伺服器：

```bash
npm run restore -- storage/backups/YOUR_BACKUP.db
npm run prisma:migrate
```

請先確認備份完整性，且不要在 SQLite 寫入中直接複製資料庫檔案。

## 測試

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

GitHub Actions 會對 Pull Request 與 Push 執行上述檢查。

## 開源與自動同步

程式碼以 MIT License 發布。發布前請先閱讀 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)，確認字型、Logo、VALORANT 圖像與其他素材的再散布權。

GitHub 首次設定與安全自動同步請見 [`docs/GITHUB-PUBLISHING.md`](docs/GITHUB-PUBLISHING.md)。自動同步腳本只會在測試通過且沒有敏感路徑被 Stage 時 Commit／Push。

## 安全性

- 不要 Commit `.env`、SQLite、上傳、備份、Log、Cloudflare JSON／PEM 或正式 `config.yml`。
- 如果秘密曾經進入 Git 歷史，加入 `.gitignore` 並不能移除它；必須撤銷／輪替秘密並清理 Git 歷史。
- 安全問題請依 [`SECURITY.md`](SECURITY.md) 私下回報，不要建立包含可利用細節的公開 Issue。

## 參與貢獻

請閱讀 [`CONTRIBUTING.md`](CONTRIBUTING.md)。提交 Pull Request 前請確保測試與 Build 通過。

## License

程式碼採 [MIT License](LICENSE)。第三方素材、商標、Logo、地圖圖片與字型不一定包含於 MIT License，請依各自授權使用。


### 賽事自訂 BP 流程與更新日誌

賽事地圖池可選 2–20 張已啟用地圖。新增賽事後會先開啟 BP 流程清單，再進入個別流程設定；視窗沿用 Patch Notes 樣式，依可用寬高調整並捲動。每張地圖對應一個步驟；可新增多個具名流程，每步指定 Team A／B、禁用／選擇，選擇時再指定選邊隊伍。新增流程最後一格預設為自動 Decider，也可改選 Team A／B 手動禁用或選擇；Decider 必須位於最後且指定選邊隊伍。至少須保留一張比賽地圖，比賽地圖數（BoN）依 PICK 與 Decider 總數計算。

在賽事卡片的「BP 流程」可新增、編輯或刪除流程；建立單場 BP 時選用。單場 BP 保存獨立步驟副本，因此流程修改或刪除不影響既有 BP。已有 BP 的地圖池不可變更；已有流程但尚無 BP 時，若要改變地圖數量，須先刪除流程。七張地圖的既有標準 Bo1／Bo3／Bo5 及自動 Decider 保持相容。

建立單場 BP 時可分別設定「地圖選擇秒數」與「攻守選擇秒數」（`-1` 為無限制）。新 BP 會先等待 Team A、Team B 都確認準備，才開始第一個伺服器權威倒數。Pulse 全域管理員可在 `/admin` 的 Server Log 頁切換排版美化或經敏感資訊遮蔽的原始 Log；一般賽事單位無權讀取整台伺服器記錄。

Pulse 管理頁的「版本更新日誌」可逐版本新增及編輯 Markdown 內容，賽事單位只有檢視權限。支援標題、粗體、斜體、清單、引用、安全連結、行內程式碼及程式碼區塊；原始 HTML 會以文字呈現。登入選定賽事單位後顯示一次，重新整理同一登入不重複彈出；只有自動彈窗會顯示「今日內不再顯示」，並依瀏覽器當地日期、目前瀏覽器及賽事單位記錄，不跨裝置同步。左下角的「版本更新日誌 / Patch Notes」卡可隨時手動開啟。

### Windows 一鍵手動啟動／重啟

雙擊根目錄 `start-pulseveto.cmd`。腳本只停止能確認屬於本專案的 Server／Tunnel，依序產生 Prisma client、編譯、備份 SQLite、執行 migration，再於兩個獨立可視視窗啟動 Server 及 Tunnel。Server HTTP 就緒後才開 Tunnel；Tunnel 是否連線成功請查看其日誌視窗。舊版 port 3000 不會被停止。首次使用若無法讀取舊程序命令列，可用系統管理員權限執行 CMD；仍無法確認歸屬時，先手動關閉舊 Server／Tunnel 視窗再執行。腳本不會僅因占用 port 3100 就強制終止未知程序。

只檢查環境、完全不停止或啟動服務：

```cmd
start-pulseveto.cmd -CheckOnly
```

此次功能包含 `20260927000000_event_flows_release_notes` migration。單純更新程式不代表已上線；手動執行啟動 CMD 時才會備份並套用正式資料庫 migration。此方式不會新增排程或開機自動啟動，關閉兩個日誌視窗會停止服務。

Linux 更新仍使用既有流程，在停止專案服務後執行 `npm run prisma:generate`、`npm run build`、`npm run backup`、`npm run prisma:migrate`，再透過原服務管理方式啟動 Server／Tunnel。
