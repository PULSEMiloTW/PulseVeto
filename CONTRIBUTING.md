# Contributing

感謝協助改善 PulseVeto。

## 開發流程

1. Fork Repository 並建立功能分支。
2. 使用 `npm ci` 安裝鎖定版本。
3. 不要加入任何真實金鑰、Token、Cookie、SQLite、Log、上傳或 Cloudflare Credentials。
4. 修改 BP 狀態機時，同時加入單元或整合測試。
5. 執行：

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

6. 建立 Pull Request，說明行為變更、測試結果與 Overlay 視覺影響。

## 程式規則

- SQLite 是唯一真實資料來源；Socket.IO 只負責通知。
- 所有權限與 BP 合法性必須由後端驗證。
- 公開、隊伍與 Overlay DTO 不可包含金鑰、Hash、Cookie、Session 或管理資料。
- 保留既有 Overlay 的解析度、透明背景、動畫與 OBS 行為。
- 中文檔案使用 UTF-8，避免以錯誤的 PowerShell 預設編碼覆寫。

提交貢獻即表示你有權提供該內容，並同意以本專案的 MIT License 發布原創程式碼。
