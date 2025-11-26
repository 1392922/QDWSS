// 等待網頁所有內容都載入完成
document.addEventListener('DOMContentLoaded', () => {

    // 取得我們需要互動的物件
    const gameBoard = document.getElementById('game-board');
    const infoPanel = document.getElementById('info-panel');
    
    // 取得所有的 'unit' 算子
    const units = document.querySelectorAll('.unit');

    // 變數：用來追蹤目前被選中的算子
    let selectedUnit = null;

    // 為「每一個」算子加上點擊事件
    units.forEach(unit => {
        
        unit.addEventListener('click', (event) => {
            
            // 停止事件冒泡，避免點到算子時也觸發地圖的點擊
            event.stopPropagation(); 

            // 檢查是否已經有被選中的算子
            if (selectedUnit) {
                // 移除舊算子的 'selected' 樣式
                selectedUnit.classList.remove('selected');
            }

            // 將現在點擊的算子設為「已選中」
            selectedUnit = unit;
            selectedUnit.classList.add('selected'); // 加上選中樣式

            // 更新資訊面板的內容
            const unitId = selectedUnit.id; // 取得算子的 ID
            infoPanel.innerHTML = `
                <h3>單位資訊</h3>
                <p><strong>ID:</strong> ${unitId}</p>
                <p><strong>位置 (Grid):</strong> ${selectedUnit.style.gridColumn} / ${selectedUnit.style.gridRow}</p>
                <button id="move-btn">移動</button>
                <button id="info-btn">編制</button>
            `;
            
            console.log(`你點選了 ${unitId}`);
        });
    });

    // 增加一個「點擊地圖」的事件 (用來取消選取)
    gameBoard.addEventListener('click', () => {
        if (selectedUnit) {
            // 移除選中樣式
            selectedUnit.classList.remove('selected');
            selectedUnit = null; // 清空選中狀態

            // 重設資訊面板
            infoPanel.innerHTML = '<p>點選一個算子以查看資訊。</p>';
            console.log('取消選取');
        }
    });

});
