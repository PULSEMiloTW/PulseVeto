# Cloudflared Tunnel

資料只保存在本機 SQLite；Tunnel 僅轉發 HTTPS 與 WebSocket 流量，不需路由器 Port Forwarding。

## Windows

1. 從 Cloudflare 官方文件安裝 `cloudflared`，執行 `cloudflared tunnel login`。
2. `cloudflared tunnel create map-veto`，記下 Tunnel ID（不要 Commit credentials JSON）。
3. `cloudflared tunnel route dns map-veto veto.example.com`。
4. 複製 `cloudflared/config.yml.example` 為 `cloudflared/config.yml` 並填入本機值。
5. `.env` 設定 `PUBLIC_BASE_URL=https://veto.example.com` 與 `TRUSTED_HOSTS=veto.example.com,localhost,127.0.0.1`。
6. 啟動網站後執行 `cloudflared tunnel --config cloudflared/config.yml run`。停止時按 Ctrl+C。

## Linux

使用 Cloudflare 官方套件庫安裝後，建立 Tunnel/DNS/config 的步驟相同。可用 `sudo cloudflared service install` 安裝服務；更新設定後 `sudo systemctl restart cloudflared`。

健康檢查：`curl -I https://veto.example.com/`。Cloudflared 會自動重新連線；Socket.IO 使用 WebSocket upgrade，不需額外 ingress 規則。
