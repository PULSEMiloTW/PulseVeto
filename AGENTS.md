# PulseVeto Agent Guide

本文件適用整個 repository，較深層 AGENTS.md 可補充其範圍規則。沿用全域規範的最小完整修改、必要檢查與 Git 交付流程；本文件補充 PulseVeto 限制。明確且較新的使用者要求優先，不自行推定舊規則已被廢棄。

## 1. 專案與原始碼

- 自架 VALORANT 賽事 Ban/Pick、選邊、比分、公開 Result 與 OBS Overlay 系統。
- Node.js 22+、npm 10+、TypeScript native ESM、Express 5、Socket.IO、Prisma 6、SQLite WAL；Vitest 單元測試與序列整合測試。
- public/ 的 HTML/CSS/瀏覽器 JavaScript 直接提供服務，沒有前端 bundler。啟動/build 流程可能在開發與公開分支不同，依本次目標分支的 package.json 及實際入口判斷。
- 使用者文字與文件以繁體中文為主，保留 UTF-8；多語系沿用既有 zh-TW、zh-CN、en-US、ja-JP 與翻譯工具。

直接相關來源：

- package.json：目前啟動、build 與驗證命令依據。
- src/server.ts：主站 Express、Socket.IO 與生命週期；若存在 src/start.ts、src/hq.ts、src/hq-app.ts，分別為主站/HQ 啟動協調及 HQ 入口/應用，不將未發布入口視為所有分支既有功能。
- src/domain/veto.ts：純 BP 規則、Bo1/Bo3/Bo5 步驟與 assertions。
- src/services/、src/routes/：交易、快照、流程與路由；src/lib/、src/config/：授權、安全、資料庫、audit、設定與品牌。
- prisma/schema.prisma、prisma/migrations/：schema 與不可回改的已套用 migration。
- public/、docs/、scripts/：UI/Overlay、文件與操作工具。
- tests/unit/、tests/integration/：測試；整合測試只使用 storage/database/integration.db。
- storage/：執行環境資料，不作為程式修改或提交來源。

不得直接修改 dist/、node_modules/、SQLite sidecar 或地圖 cache 產物。根目錄 server.js、db.json、database.json、data/、config.yml 為 legacy/local artifacts，除非明確要求處理 legacy 行為。

## 2. 任務流程與 Git 交付

1. 修改前執行 `git status --short`，保留所有 staged、unstaged、untracked 工作。
2. 只閱讀直接相關原始碼、package.json、測試及必要文件；使用 rg/rg --files，不預設全 repo 掃描。
3. 完成最小完整修改，不順手重構或排版 compact legacy 檔案。
4. 每次完成程式修改後，執行與本次修改相關的必要檢查，依第 6 節選擇範圍。
5. 檢查通過後，僅將本次任務修改建立 Git commit，使用清楚描述修改內容的訊息，push 到指定 GitHub remote/branch。這是持續授權，除非使用者明確要求本次暫不提交或推送。
6. 未指定目標時，只沿用已確認的 GitHub upstream；無 upstream 或目標不明時詢問，不猜測 main/master。
7. 提交前審查 diff、暫存區、秘密及待推送的完整 commit 範圍，不夾帶既有未授權變更或舊 commits。同檔案的既有變更以 hunks 分離，保留使用者 staged 狀態。
8. 使用明確路徑暫存，不用 `git add .`、`git add -A` 或 `git commit -a`。不得提交 .env、密鑰、憑證、資料庫、uploads、logs、backups、Cloudflare 本機設定、未確認授權字型或生成輸出。
9. 檢查失敗、合併衝突或 push 失敗時回報原因與已完成狀態，不宣稱交付成功；禁止 force push（含 --force-with-lease），不擅自改寫歷史或覆蓋工作。
10. 完成後回報檢查結果、本地/遠端分支名稱、commit ID 與 push 結果，區分原始碼、GitHub 發布與正式部署狀態。

乾淨安裝使用 npm ci；無必要依賴變更時不重建 lockfile。乾淨公開發布另依第 7 節，不把 dirty checkout 直接作為公開發布來源。

## 3. 資料、BP 與安全不變條件

- SQLite 是權威狀態；Socket.IO 只通知或提供 refreshed snapshots，不以 socket memory 決定狀態。
- 授權、BP/選邊合法性及輸入驗證由 server 強制執行，不信任 client、params、cookie、socket payload、URL、檔名、MIME 或遠端圖片。
- 多筆 BP 變更使用 Prisma transaction，保留 VetoSession.version 樂觀並行控制與 conflict responses。
- 純規則留在 domain，持久化/流程留在 services，不在 route/client 重複規則。
- 保留自動 Decider；流程變更驗證 Bo1/Bo3/Bo5 相關影響。
- 禁止 Random Ban。隨機地圖或隨機選邊結果須經雙方確認並持久化後才繼續 BP；自動 Decider 不需隨機確認，除非選邊本身隨機。
- Timeout action 保留負責的隊伍 actor，以 timeoutRandom 表示超時隨機結果；UI 不以 actor === SYSTEM 推定超時。
- Public/team/overlay snapshots 只提供必要欄位，不暴露 keys、hashes、加密 tokens、cookies、sessions 或管理資料；保留避免 resource/token enumeration 的通用錯誤。
- 沿用 Zod、HttpOnly session、CSRF、Host/Origin、expiry/revocation、rate limits、Argon2/crypto 與既有 token helpers，不削弱安全參數或另造 token 格式。
- 安全/管理操作使用既有 audit/logging，不記錄秘密或原始 access/session/public tokens。
- 安全或賽事隨機使用 crypto.randomInt/randomBytes 或既有 helper，不使用 Math.random()。
- .env 不讀入回覆、不提交；.env.example 只含安全空白值或占位文字。

## 4. Prisma、TypeScript 與 API

- Schema 變更同步新增具名 timestamp migration，不修改已套用 migration；優先 additive/backward-compatible 方案。
- 破壞性資料轉換先取得明確授權並驗證目標，不因程式修改就對正式資料執行 migration。
- Schema 變更需 npm run prisma:generate，並在整合測試資料庫驗證。正式程序鎖住 Prisma DLL 導致 EPERM 時回報阻礙，不自行停服。
- 整合測試只重建 integration.db 及其 -wal/-shm，不指向開發或正式資料庫。
- 維持 strict TypeScript、noUncheckedIndexedAccess，不用 broad any、@ts-ignore 或無必要 unsafe assertions。
- NodeNext 相對 TypeScript imports 使用 emitted .js 副檔名。
- 保留狀態碼、response shape、DTO 與 legacy aliases，除非任務明確要求改變契約。
- 優先使用既有依賴；必要的新依賴需具體維護收益並包含 lockfile。

## 5. UI、品牌與 Overlay 界線

- 沿用 dependency-free browser code，插入不可信文字使用安全 DOM API 或明確 escaping，不新增 unsafe innerHTML。
- 所有 Overlay 視覺預設不變；只有明確 Overlay 要求才依指定範圍調整。一般品牌/UI 統一僅作用於非 Overlay 頁面。
- 保留透明 1920x1080 OBS composition、動畫時序、route、reconnect/refresh 與 join_room、init_data、snapshot aliases。
- 明確要求 Overlay 變更時，檢查四個 VCT variants（EN/TC 與 -i）、overlay-current.html 及相關 consumer，只修改受影響範圍。route、解析度、欄位、字型或 motion 改變同步 docs/OVERLAY-INVENTORY.md。
- 非 Overlay UI 沿用目前首頁品牌與多語系，保留 Pick/Ban/Decider、Team A/B 語意色，不添加裝飾性英文副標題，語言控制整合於頁首。
- 倒數只在低於 10 秒時警示；超時訊息不阻塞流程，之後自動更新結果。
- 存取/管理資訊卡依用途分組；敏感原文以第二層 reveal modal 保護，Copy 為 2:1 主要動作，次要圖示可存取，綁定實際隊名。
- 無明確字型授權確認，不新增或還原 public/assets/fonts/ binaries，依該目錄 README。
- HQ 的公開主站入口保留 /hq；授權提示為「請使用下方按鈕申請授權，並接收由官方所回覆之金鑰以進入系統。」一次性金鑰只留在 server/host console，不放入公開回覆或前端。此為功能要求，不代表所有分支已發布。

## 6. 必要檢查矩陣

先執行最窄且足以驗證改動的檢查：

| 修改範圍 | 必要驗證 |
| --- | --- |
| Domain/security/helper | `npm run test:unit -- <relevant-test-file>` |
| Route/auth/Prisma/transaction | `npm run test:integration -- <relevant-test-file>` |
| TypeScript | `npm run typecheck` |
| 啟動入口或 production output | `npm run build` |
| HTML/CSS/JS、互動或 Overlay | 相關語法/測試；實質 rendering/互動改動做代表性 browser、console 與受影響 variants 檢查 |
| Schema/migration | `npm run prisma:generate` 加 integration DB 測試 |
| 文件/AGENTS | 內容、命令/路徑一致性與 `git diff --check`；不跑無關 build/test |

重大或跨模組變更交付前執行 CI-equivalent：

```bash
npm run prisma:generate
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

lint 目前是 TypeScript checking，非 stylistic lint；與 typecheck 相同時不例行重複。整合測試序列執行，不與其他會重建相同 DB 的程序並行。必要檢查失敗或無法執行時回報原因並暫停 commit/push，不為了檢查重啟正式服務。

## 7. 正式環境、文件與公開發布

- 程式修改、commit、push 不等同 build/restart/deploy 授權。未明確要求，不重啟正式服務、Tunnel 或執行正式 migration/restore/scheduled tasks。
- 核准重啟時，先識別正確 port-3100 程序鏈並保留 legacy port 3000，依現有 Windows 工具與要求的可見 console 流程操作。
- 正式上線證據包括 3100、local/public homepage 與 Socket.IO HTTP 200、更新資產及 Cloudflare ingress 驗證；測試或視窗開啟不能單獨代表上線成功。
- 設定、routes、operator actions 或公開行為改變時，更新必要 README、.env.example/docs，不重寫無關文件。Windows/Linux 文件在兩者都有支援時保持一致。
- 保留 storage/**/.gitkeep 與保護執行環境、秘密、字型、Cloudflare 本機設定的 ignore rules。
- 「同意乾淨發布」使用獨立乾淨 worktree，保留原 checkout、dirty 工作、輸出與服務；先查公開排除清單、完整待推送歷史及敏感內容，不推送未審查歷史，不 force push。
- .gitignore 不會清除已追蹤內容或歷史秘密。疑似秘密進入歷史時回報並安排撤銷/輪替；history cleanup 需另外核准。
- 公開說明、白皮書與 Patch Notes 使用可發布繁體中文及 repository 證據，區分已提交、開發/測試中與已部署；保留 Riot Games/VALORANT 非官方認可聲明，不暴露內部路徑或秘密。

## 8. 完成標準

完成最小完整修改、必要驗證與文件/契約同步後，依第 2 節 commit/push。最後說明改動、實際檢查結果、分支、commit ID、push 結果，以及仍未驗證的視覺/正式環境/遷移/外部服務項目。有阻礙就回報原因及保留的工作，不宣稱檢查或發布成功。
