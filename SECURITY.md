# Security policy

最新一次專案安全檢查與待改善項目請見 [`docs/SECURITY-AUDIT-2026-08-27.md`](docs/SECURITY-AUDIT-2026-08-27.md)。

## Supported versions

目前只維護 `main` 分支的最新版本。

## 回報漏洞

請不要在公開 Issue 張貼可利用細節、正式網址、金鑰、Cookie、Token、資料庫或個人資料。請透過 Repository Owner 在 GitHub 設定的 Private Vulnerability Reporting 或私人聯絡方式回報。

回報內容建議包含受影響版本、重現步驟、影響範圍與可能的修正方式，但請先遮蔽所有秘密。

## 如果秘密被 Commit

1. 立即撤銷並輪替受影響的 Session、金鑰、Token 與 Cloudflare Credentials。
2. 停止自動同步。
3. 使用適合的 Git 歷史清理工具移除資料。
4. 強制更新遠端歷史前先通知協作者。

僅新增 `.gitignore` 無法從既有 Git 歷史移除秘密。
