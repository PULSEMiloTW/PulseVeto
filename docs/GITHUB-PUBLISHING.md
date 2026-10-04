# GitHub 開源發布與自動同步

## 重要原理

GitHub Actions 只能處理已 Push 到 GitHub 的內容，無法主動讀取你的本機資料夾。因此「不手動更新 GitHub」需要本機排程執行安全的 Commit／Push。

本專案的同步流程為：

```text
本機修改
→ 開源發布前檢查
→ Type Check
→ Unit Test
→ 只 Stage 核准的原始碼路徑
→ Commit
→ Pull --rebase
→ Push
→ GitHub Actions 再次驗證
```

## 1. 發布前準備

安裝 Git for Windows 與 GitHub CLI，或使用 Git Credential Manager 完成 GitHub 登入。不要把 Personal Access Token 寫入 `.env`、Script 或 Remote URL。

先執行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/open-source-preflight.ps1
```

如果檢查指出字型被 Git 追蹤，請先確認每個字型的再散布授權。沒有授權時需從 Git Index 與歷史移除；僅加入 `.gitignore` 不足以移除已存在的 Commit。

## 2. 建立 GitHub Repository

在 GitHub 建立一個空的 Public Repository，不要預先加入 README、License 或 `.gitignore`，以避免首次 Push 衝突。

本機設定：

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git branch -M main
git push -u origin main
```

若 `origin` 已存在：

```powershell
git remote set-url origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
```

## 3. 手動驗證一次安全同步

```powershell
powershell -ExecutionPolicy Bypass -File scripts/github-auto-sync.ps1
```

確認 GitHub README、License、Actions 與檔案清單都正確，且 Repository 不包含 `.env`、Database、Upload、Log、Backup、Cloudflare Credentials 或未授權字型。

## 4. 啟用 Windows 自動同步

每 10 分鐘檢查一次：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-github-auto-sync-task.ps1 -IntervalMinutes 10
```

檢查排程：

```powershell
Get-ScheduledTask -TaskName PulseVeto-GitHub-Sync
```

停止自動同步：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/remove-github-auto-sync-task.ps1
```

## 衝突與測試失敗

測試失敗、Remote 未設定、驗證失敗或 `git pull --rebase` 發生衝突時，腳本會停止，不會強制覆蓋 GitHub。修正問題後，下次排程會再次執行。

## 建議的 GitHub 設定

- 啟用 Private Vulnerability Reporting。
- 啟用 Secret Scanning 與 Push Protection。
- 對 `main` 啟用 Branch Protection，要求 CI 通過。
- 禁止 Force Push 與刪除 `main`。
- 使用 GitHub Environments／Secrets 保存 CI 所需秘密，不要寫進 Repository。

## Linux

可透過 `cron` 或 systemd timer 定期執行等效的 Git 同步腳本，但不要把 Token 寫入 crontab。建議使用 SSH Key 或 Git Credential Helper，並限制該憑證只能存取此 Repository。
