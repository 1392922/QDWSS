document.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // 設置畫布大小
    canvas.width = window.innerWidth - 500; // 減去側邊欄寬度
    canvas.height = window.innerHeight - 20;

    // --- 核心物件 ---
    const map = new MapRenderer(canvas, 30); // 30px 的六角格
    
    // "資料庫" (初期使用陣列)
    let allUnits = [];
    let allMissiles = []; // 儲存發射的飛彈

    let selectedUnit = null; // 當前選中的算子
    let isDragging = false;
    let dragStartX, dragStartY;

    // --- 初始化範例單位 ---
    function initializeUnits() {
        // 藍軍 (金門)
        allUnits.push(new Unit(
            'blue_hq_01', '金防部', 'blue', ECHELON.HQ,
            { atk: 1, def: 10, mov: 2, cmd: 10 }, { q: 10, r: 10 }
        ));
        allUnits.push(new Unit(
            'blue_inf_01', '步1營', 'blue', ECHELON.BATTALION,
            { atk: 6, def: 8, mov: 4, cmd: 2 }, { q: 11, r: 10 }
        ));
        
        // 紅軍 (廈門)
        allUnits.push(new Unit(
            'red_hq_01', '73集團軍指揮部', 'red', ECHELON.ARMY_GROUP,
            { atk: 3, def: 8, mov: 3, cmd: 12 }, { q: 5, r: 5 }
        ));
        allUnits.push(new Unit(
            'red_amph_01', '兩棲合成旅1營', 'red', ECHELON.BATTALION,
            { atk: 9, def: 6, mov: 6, cmd: 2 }, { q: 6, r: 5 }
        ));
    }

    // --- 遊戲主循環 (Game Loop) ---
    function gameLoop() {
        // 1. 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. 繪製地圖網格
        map.drawGrid();

        // 3. 繪製地圖特徵 (河流、建築等)
        map.drawFeatures();

        // 4. 繪製所有單位 (算子)
        allUnits.forEach(unit => unit.draw(ctx, map));
        
        // 5. 繪製飛彈動畫
        allMissiles.forEach(missile => missile.draw(ctx, map));
        allMissiles = allMissiles.filter(m => m.animationProgress < 1); // 移除完成的

        // 6. 請求下一幀
        requestAnimationFrame(gameLoop);
    }

    // --- 事件處理 ---

    // 點擊 (選取算子)
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        selectedUnit = null;
        allUnits.forEach(unit => unit.isSelected = false);

        // 從上層開始往下找 (避免重疊)
        for (let i = allUnits.length - 1; i >= 0; i--) {
            if (allUnits[i].isClicked(clickX, clickY)) {
                selectedUnit = allUnits[i];
                selectedUnit.isSelected = true;
                isDragging = true;
                dragStartX = clickX;
                dragStartY = clickY;
                
                // (未來: 顯示編輯面板)
                // showUnitEditor(selectedUnit);
                break;
            }
        }
    });

    // 拖曳 (移動算子)
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !selectedUnit) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // (這裡只是視覺上拖曳，放開滑鼠時才更新六角格座標)
        // 為了即時反饋，我們暫時更新像素位置
        selectedUnit.pixelPos.x += (mouseX - dragStartX);
        selectedUnit.pixelPos.y += (mouseY - dragStartY);
        dragStartX = mouseX;
        dragStartY = mouseY;
    });

    // 放開 (確認算子位置)
    canvas.addEventListener('mouseup', (e) => {
        if (!isDragging || !selectedUnit) return;
        
        isDragging = false;
        
        const rect = canvas.getBoundingClientRect();
        const finalX = e.clientX - rect.left;
        const finalY = e.clientY - rect.top;

        // 轉換回六角格座標
        const newHexPos = map.pixelToHex({ x: finalX, y: finalY });
        
        // TODO: 檢查移動是否合法 (移動力、地形)
        
        selectedUnit.hexPos = newHexPos; // 更新算子的邏GEI輯位置
        // pixelPos 會在下一幀 draw() 時自動更新
    });

    // 工具欄按鈕
    document.getElementById('btn-roll-dice').addEventListener('click', () => {
        const result = rollDice(6);
        alert(`骰子結果: ${result}`);
    });
    
    document.getElementById('btn-launch-missile').addEventListener('click', () => {
        // 範例：從紅軍基地打藍軍 HQ
        const params = { range: 300, accuracy: 0.9, payload: 1000 };
        const missile = new Missile(
            'DF-15 (模擬)', 
            { q: 5, r: 5 }, // 廈門
            { q: 10, r: 10 }, // 金門
            params
        );
        allMissiles.push(missile);
    });

    // --- 啟動遊戲 ---
    initializeUnits();
    gameLoop(); // 開始！

});
