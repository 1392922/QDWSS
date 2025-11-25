# 兵棋推演：金門之再次823

這是一個基於 HTML/CSS/JavaScript 的靜態網頁兵棋推演引擎，專為 GitHub Pages 設計。
它使用 Canvas 繪製地圖，使用 HTML/SVG 繪製單位，實現了高性能渲染和豐富的互動性。

## 專案特色

* **純靜態部署**：無需後端，可直接部署在 GitHub Pages。
* **六角格 (Hex) 地圖**：使用 Canvas 渲染高效能的六角格地圖，支援平移 (Pan) 與縮放 (Zoom)。
* **動態單位徽章**：使用 SVG 模板動態生成單位徽章，顯示編制層級 (班、連、師等) 與 HP。
* **豐富互動**：
    * 拖曳 (Drag & Drop) 移動單位。
    * 拖曳時高亮顯示合法移動範圍。
    * 點選顯示單位資訊，並可即時編輯屬性。
    * 右鍵選單 (Context Menu) 進行攻擊、待命等操作。
* **回合制系統**：支援藍軍 (玩家) 與紅軍 (AI) 的回合制流程。
* **簡易 AI**：AI 會自動朝最近的敵人移動並發動攻擊。
* **戰鬥系統**：內建可配置的戰鬥計算公式 (命中率、傷害、地形加成)。
* **戰局存檔/載入**：可將當前戰局匯出為 JSON 檔案，並隨時匯入載入。

## 如何在本機啟動

由於瀏覽器的安全限制 (CORS)，直接從 `file://` 協議開啟 `index.html` 可能會導致 `data/map.json` 和 `data/units.json` 檔案載入失敗。

**推薦方法 (使用本地伺服器)：**

1.  確保您安裝了 Python 3。
2.  在專案根目錄下打開終端機。
3.  執行以下命令：

    ```bash
    # (Python 3)
    python -m http.server 8000
    ```

    或者 (如果您使用 Node.js):
    ```bash
    # (需先安裝: npm install -g serve)
    serve .
    ```
4.  打開瀏覽器，訪問 `http://localhost:8000`。

**備用方法 (直接開啟)：**

本專案已實作備用機制，若 `fetch` JSON 失敗，會載入一組預設的備用資料。存檔與載入功能使用 `<input type="file">`，因此在 `file://` 下也能運作。

1.  直接在檔案總管中雙擊 `index.html`。

## 如何部署到 GitHub Pages

1.  **建立 GitHub 倉庫**：
    在 GitHub 上建立一個新的公開 (Public) 倉庫 (例如：`kinmen-823`)。

2.  **推送程式碼**：
    將本地的所有檔案 (`index.html`, `style.css`, `main.js`, `data/`, `README.md`, `LICENSE`) 推送到您的 GitHub 倉庫。

    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
    git push -u origin main
    ```

3.  **啟用 GitHub Pages**：
    * 在您的 GitHub 倉庫頁面，點擊 "Settings" (設定)。
    * 在左側選單中，點擊 "Pages"。
    * 在 "Build and deployment" 下的 "Source" 選擇 "Deploy from a branch"。
    * 在 "Branch" 區塊，選擇 `main` 分支，資料夾選擇 `/(root)`。
    * 點擊 "Save"。

4.  **等待部署**：
    稍待幾分鐘後，您的網站將部署在 `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`。

## 使用者操作說明

* **平移 (Pan)**：按住滑鼠中鍵 (或按住左鍵點擊地圖空白處) 並拖曳。
* **縮放 (Zoom)**：滾動滑鼠滾輪。
* **選取單位**：左鍵點擊單位。
* **移動單位**：(限我方回合、未移動單位)
    * 點住我方單位並拖曳。
    * 地圖將高亮顯示藍色合法移動範圍。
    * 拖曳到合法空格上並放開滑鼠即可移動。
* **攻擊單位**：(限我方回合、未行動單位)
    * 右鍵點擊相鄰的敵方單位。
    * 在選單中選擇 "攻擊"。
    * 或者：選中我方單位，地圖將高亮紅色可攻擊範圍，右鍵點擊紅框內敵人。
* **編輯屬性**：選取單位後，在右側 "單位資訊" 面板中直接修改數值。
* **存檔/載入**：使用上方控制列的 "儲存戰局" / "載入戰局" 按鈕。

## 測試 / 驗收條件清單

1.  [X] **地圖互動**：能在本機開啟 `index.html` 並看到 hex 地圖，支援放大/縮小/平移。
2.  [X] **單位移動**：能拖曳藍軍單位到合法的藍色格位並更新位置。
3.  [X] **徽章顯示**：單位徽章會依 `units.json` 的 `level` 顯示 (如 "DIV", "BN", "SQD")，且 HP 會正確顯示。
4.  [X] **屬性編輯**：在右側面板修改 HP，單位徽章上的 HP 文字會即時更新。
5.  [X] **戰鬥計算**：右鍵攻擊敵人會觸發戰鬥，並在下方 log 顯示傷害值。
6.  [X] **AI 回合**：點擊 "結束回合"，紅軍 (AI) 會自動移動（朝藍軍）或攻擊。
7.  [X] **存檔載入**：可以匯出當前場景為 JSON 並重新載入復原。
