# Overlay Inventory

| Overlay | Route | Source | Resolution | Fonts | Motion | Data |
|---|---|---|---|---|---|---|
| VCT English Original | `/overlay-vct-en/:overlayToken` | `public/overlay-vct-en.html` | 1920×1080 transparent | Replica, Foundry Gridnik, LINE Seed TW Rg, Tungsten | global wipe, map reveal, neon veto flicker, pick wipe | SQLite snapshot + Socket.IO |
| VCT English Instant | `/overlay-vct-en-i/:overlayToken` | `public/overlay-vct-en-i.html` | 1920×1080 transparent | same | same, instant timing variant | SQLite snapshot + Socket.IO |
| VCT 繁中 Original | `/overlay-vct-tc/:overlayToken` | `public/overlay-vct-tc.html` | 1920×1080 transparent | Replica, Foundry Gridnik, LINE Seed TW, Tungsten | global wipe, map reveal, neon veto flicker, pick wipe | SQLite snapshot + Socket.IO |
| VCT 繁中 Instant | `/overlay-vct-tc-i/:overlayToken` | `public/overlay-vct-tc-i.html` | 1920×1080 transparent | same | same, instant timing variant | SQLite snapshot + Socket.IO |
| VCT 简中 Original | `/overlay-vct-cn/:overlayToken` | `public/overlay-vct-tc.html`（依路由切換简中文字串） | 1920×1080 transparent | same | same as 繁中 Original | SQLite snapshot + Socket.IO |
| VCT 简中 Instant | `/overlay-vct-cn-i/:overlayToken` | `public/overlay-vct-tc-i.html`（依路由切換简中文字串） | 1920×1080 transparent | same | same as 繁中 Instant | SQLite snapshot + Socket.IO |

所有既有 HTML/CSS、卡片尺寸、顏色、透明背景及動畫原檔均保留。伺服器以相容 DTO 提供舊欄位，額外提供 `sideSelector`、`sideSelection`、`isDecider`、`mapNameZhCn`。六個 VCT 路由的頁面標題會依隊名、語言與動畫模式動態更新。OBS Browser Source 設為 1920×1080，URL 只使用獨立 Overlay Public Token。

語意 OBS 路由：

- 完整 BP：`/overlay/full/{token}`
- 地圖池：`/overlay/map-pool/{token}`
- 當前操作：`/overlay/current/{token}`
- 最終結果：`/overlay/result/{token}`

上述路由會依 BP 的 Overlay Theme 沿用 VCT English／繁中與 Original／Instant 樣式；當前操作是新增畫面，使用相同字型、主題色、切角卡片與透明背景。


## 2026-09-27：賽事自訂流程

四個 VCT HTML 變體（及共用繁中 HTML 的簡中路由）依伺服器 `maps` 的步驟順序顯示實際 BAN／PICK；自訂流程不插入 Decider。保留既有透明 1920×1080、路由與動畫模式。七張以內維持原版面；8–20 張透過 `overlay-flow-layout.js` 改為每列七格、最多三列，總高度不超過 840px、底部留 60px。

Overlay DTO 新增 `currentActor`、`currentAction`、`pendingSideSelector`。`maps[].sideSelector` 在尚未選邊時可顯示流程指定隊伍。`overlay-current.html` 顯示當前步驟操作隊伍與動作，而非上一筆動作；Result 與隊伍頁繼續使用單場 BP 的步驟及結果順序，不依固定七張推算。
