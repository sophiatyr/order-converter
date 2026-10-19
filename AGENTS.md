# CSQ 工作站更新

- 使用者要求每次交付新版都必須新增版號，並將同一版本同步至 NAS `\\192.168.1.6\docker\Cisalfa`，網址 `http://192.168.1.6:8888/`。
- Vite 正式建置會自動遞增 `release.json` 的台北日期版號（例如 `2026.10.19.1`）。同一次交付只建置一次，避免本機及 NAS 使用不同產物。
- 完成適當測試後，執行 `npm run release:nas`：檢查型別、建置、更新本機、製作 NAS 更新包、備份並同步 NAS 網頁，最後核對 HTTP 實際回傳檔案。
- NAS 網路存取若受限制，按環境規定申請升級權限；不要跳過核對後宣稱同步成功。部署失敗或後端需要重建會回傳非零代碼，須繼續處理或明確說明阻礙。
- 若後端程式或相依套件有差異，完整更新檔會放在 NAS `program-updates/<版號>`。必須先透過 NAS 系統管理備份資料庫，再執行 `node scripts/apply-nas-server.mjs` 備份並套用後端，然後在 Container Manager 重建服務。最後再執行 `node scripts/deploy-nas-release.mjs`，確認 `runningServerVerified: true` 及無須重建，才能宣告整體升級完成。此核對不會再增加版號。
- 不可覆蓋 NAS `data/`、`.env`、既有 compose 掛載設定，或以本機作業資料替換正式資料。PO、ERP、參考快照及作業資料的同步需依該次任務另外核對；程式發布不會自動同步這些資料。
- 後端套用工具僅在既有 `compose.yaml` 的 CSQ 服務新增／更新 `image: cisalfa-csq:<版號>`，並備份原檔，其餘設定原樣保留。Container Manager 的「建立」可能沿用已存在映像檔；使用新版獨立標籤，再核對健康端點 `serverDigest`，避免只重新啟動舊程式。
- GitHub 公司資料上傳先前已暫停；程式發布至 NAS 不代表授權上傳公司資料到 GitHub。
