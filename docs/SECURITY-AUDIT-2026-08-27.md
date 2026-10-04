# PulseVeto Security Check（2026-08-27）

## 結論

PulseVeto 已具備良好的基礎安全控制，包括伺服器端權限與流程驗證、HttpOnly Session Cookie、CSRF Token、Host／Origin 驗證、登入限流、Argon2id、AES-256-GCM、窄化的公開 DTO、SQLite Transaction、版本衝突控制、上傳檔案型別與大小檢查，以及 Audit Log。

本次檢查未發現已提交的 `.env`、Cloudflare Credential、私鑰或 SQLite 資料庫。正式環境目前設定的 Session 與加密秘密存在、長度合格且不是開發預設值；實際值未被輸出或寫入本報告。

## 本次已修復

### Production 秘密值 fail-fast

先前正式環境若缺少 `SESSION_SECRET` 或 `KEY_ENCRYPTION_SECRET`，會採用公開的開發預設值。現在 production 模式遇到缺值或預設值會拒絕啟動，避免所有部署共用可預測秘密。

### 依賴更新

已更新 Argon2、Prisma Client、Express Rate Limit、檔案型別識別、IP 判斷、Sharp 與開發工具的相容修補版本，並鎖定三個已修復的間接依賴版本。`npm audit` 從 5 high／1 moderate 降為 3 high／0 moderate。

剩餘三筆是同一條 Prisma 6 CLI → `@prisma/config` → `deepmerge-ts` 警示。該路徑用於 generate／migration 等受信任的開發及部署操作，不處理公開 HTTP 輸入。掃描器目前只提供 Prisma 6.12 降版或破壞性處理；本次未強制覆寫 Prisma 內部主版本，以免破壞 schema、generate 或 migration。應在獨立升級工作中測試新的 Prisma 主版本後再處理。

## 待改善風險

### 中：Content Security Policy 尚未啟用

Helmet 已啟用，但 CSP 因現有頁面與 Overlay 使用 inline script／style 而停用。若發生 DOM 注入，缺少 CSP 會放大影響。建議先建立 Report-Only policy、整理實際來源，再逐頁把 inline 程式移到獨立檔案或導入 nonce／hash，最後切換為強制 CSP。Overlay 必須逐一在 OBS Browser Source 驗證。

### 中：遠端圖片 URL 存在 DNS rebinding 時序風險

目前會先解析並拒絕 private／loopback／reserved IP，再以 hostname 發出 HEAD；解析與請求之間仍可能再次解析。建議後續改為固定已驗證 IP 的請求方式、對每次 redirect 重新驗證，或採可信圖片代理／允許清單。不得直接停用現有 SSRF 檢查。

### 中：Proxy 信任與 LAN 暴露需明確化

伺服器目前 `trust proxy = 1` 並監聽所有介面，符合單層反向代理情境；若 3100 同時能被不受信任的 LAN Client 直接存取，Client 可偽造 forwarded IP，削弱按 IP 的 Rate Limit 與 Audit IP。建議預設只綁 loopback，或以明確的 trusted proxy 設定限制來源；需要 LAN 直連時再選擇性開啟。

### 低：前端仍廣泛使用字串模板與 `innerHTML`

目前主要動態欄位有使用 escape helper，未在本次抽查中確認可直接利用的 XSS；但這種模式容易在未來新增欄位時漏掉 escaping。架構調整時應優先改用 `textContent`、`createElement` 或集中且有測試的安全渲染層。

### 低：登出只使用 Origin 防護

登出是低影響操作，且 Cookie 使用 SameSite；但 `/api/auth/logout` 沒有套用現有 CSRF middleware。可為一致性補上 CSRF，並決定缺少 Origin header 的狀態變更請求是否一律拒絕。

## 驗證紀錄

- `npm run prisma:generate`：通過
- `npm run lint`：通過（此專案目前為 TypeScript 檢查）
- `npm run test:unit`：4 files、22 tests 通過
- `npm run test:integration`：1 file、4 tests 通過
- `npm run build`：通過
- production 缺少核心秘密時拒絕啟動：通過
- 本機首頁與公開 Tunnel：HTTP 200
- 瀏覽器首頁品牌、排版與 console：通過，無 warning／error
- Cloudflared Windows binary Authenticode：有效，簽署者為 Cloudflare, Inc.

## 對外發布前檢查清單

1. 設定真正的 Repository URL、Issue Template、Private Vulnerability Reporting 與安全聯絡方式。
2. 確認 `PulseVeto` 名稱、網域、社群帳號與商標可用性；不要暗示與 Riot Games／VALORANT 官方有隸屬、贊助或認可關係。
3. 只發布具明確再散布權利的 Logo、地圖素材與字型；目前字型目錄的忽略規則應保留。
4. 提供首次啟動精靈或部署檢查，要求產生唯一秘密、建立管理員並確認公開網址與 Trusted Hosts。
5. 建立版本號、Changelog、升級／備份／還原流程與資料庫 migration 支援政策。
6. 在正式發布前安排 CSP、proxy boundary、remote image SSRF 與 Prisma 升級四個獨立 hardening 工作。
