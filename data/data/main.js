/*
 * 金門之再次823 - 兵棋推演 主程式
 * by Gemini (as Senior Full-Stack Engineer + Wargame Designer)
 * * 核心架構：
 * 1. GameEngine: 主遊戲類，管理遊戲狀態、迴圈、UI 互動。
 * 2. HexGrid: 處理六角格座標轉換、路徑、範圍的輔助類。
 * 3. Renderer: 處理 Canvas 繪製（地圖、高亮）。
 * 4. UIManager: 處理 DOM 元素（單位、面板、選單）的更新。
 * 5. AIController: 處理紅軍 AI 邏輯。
 */

// --- 1. 輔助工具 & 六角格邏輯 (HexGrid) ---

/**
 * 簡易的優先隊列 (Priority Queue) 用於 A* 尋路
 */
class PriorityQueue {
    constructor() {
        this.elements = [];
    }
    enqueue(element, priority) {
        this.elements.push({ element, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }
    dequeue() {
        return this.elements.shift()?.element;
    }
    isEmpty() {
        return this.elements.length === 0;
    }
}

/**
 * HexGrid 類 (使用 Axial Coordinates)
 * 處理所有六角格數學運算
 */
class HexGrid {
    constructor(hexSize) {
        this.hexSize = hexSize;
        this.width = hexSize * 2;
        this.height = Math.sqrt(3) * hexSize;
        this.origin = { x: this.width / 2, y: this.height / 2 };
    }

    /**
     * Axial 座標 (q, r) 轉 Pixel 座標 (x, y)
     * @param {number} q
     * @param {number} r
     * @returns {{x: number, y: number}}
     */
    axialToPixel(q, r) {
        const x = this.hexSize * (3 / 2 * q);
        const y = this.hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
        return { x: x + this.origin.x, y: y + this.origin.y };
    }

    /**
     * Pixel 座標 (x, y) 轉 Axial 座標 (q, r)
     * @param {number} x
     * @param {number} y
     * @returns {{q: number, r: number}}
     */
    pixelToAxial(x, y) {
        const adjX = x - this.origin.x;
        const adjY = y - this.origin.y;
        const q = (2 / 3 * adjX) / this.hexSize;
        const r = (-1 / 3 * adjX + Math.sqrt(3) / 3 * adjY) / this.hexSize;
        return this.axialRound({ q, r });
    }

    /**
     * 處理浮點數座標，四捨五入到最近的整數六角格
     */
    axialRound(frac) {
        const q = Math.round(frac.q);
        const r = Math.round(frac.r);
        const s = Math.round(-frac.q - frac.r);
        const q_diff = Math.abs(q - frac.q);
        const r_diff = Math.abs(r - frac.r);
        const s_diff = Math.abs(s - (-frac.q - frac.r));

        if (q_diff > r_diff && q_diff > s_diff) {
            return { q: -r - s, r };
        } else if (r_diff > s_diff) {
            return { q, r: -q - s };
        } else {
            return { q, r };
        }
    }

    /**
     * 計算兩個六角格的距離
     * @param {{q: number, r: number}} a
     * @param {{q: number, r: number}} b
     * @returns {number}
     */
    hexDistance(a, b) {
        const dq = Math.abs(a.q - b.q);
        const dr = Math.abs(a.r - b.r);
        const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
        return (dq + dr + ds) / 2;
    }

    /**
     * 獲取一個六角格的所有鄰居
     * @param {{q: number, r: number}} hex
     * @returns {Array<{q: number, r: number}>}
     */
    hexNeighbors(hex) {
        const directions = [
            { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
            { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 }
        ];
        return directions.map(dir => ({ q: hex.q + dir.q, r: hex.r + dir.r }));
    }

    /**
     * 獲取六角格的角點（用於繪製）
     * @param {{x: number, y: number}} center
     * @returns {Array<{x: number, y: number}>}
     */
    getHexCorners(center) {
        const corners = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 180 * (60 * i - 30);
            corners.push({
                x: center.x + this.hexSize * Math.cos(angle),
                y: center.y + this.hexSize * Math.sin(angle)
            });
        }
        return corners;
    }
}

// --- 2. 遊戲主引擎 (GameEngine) ---

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mapContainer = document.getElementById('map-container');
        this.unitLayer = document.getElementById('unit-layer');
        this.badgeTemplate = document.getElementById('unit-badge-template').innerHTML;

        this.gameState = {
            map: null,
            units: [],
            turn: 1,
            currentPlayer: 'blue',
            selectedUnit: null,
            contextMenuUnit: null,
            view: {
                scale: 1,
                x: 0,
                y: 0
            }
        };

        this.hexGrid = null;
        this.ui = new UIManager(this);
        this.ai = new AIController(this);
        
        this.isPanning = false;
        this.isDraggingUnit = false;
        this.draggedUnit = null;
        this.dragStart = { x: 0, y: 0 };
        
        this.reachableHexes = new Map();
        this.attackableHexes = new Map();
    }

    /**
     * 遊戲初始化
     */
    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        try {
            await this.loadGameData(); // 載入預設資料
            this.setupEventListeners();
            this.ui.log('遊戲開始。藍軍回合。', 'system');
            this.render();
        } catch (error) {
            console.error('遊戲初始化失敗:', error);
            this.ui.log(`錯誤: ${error.message}`, 'red');
        }
    }

    /**
     * 載入地圖與單位 (fetch JSON)
     * 為了本地 file:// 運行，我們改用 fetch。
     * 警告：這在 `file://` 協議下可能因 CORS 失敗。
     * 解決方案：使用本地伺服器 (如 `python -m http.server`) 或改用下面 `loadGameFromInput` 的 `FileReader`。
     */
    async loadGameData(mapUrl = 'data/map.json', unitsUrl = 'data/units.json') {
        try {
            const [mapResponse, unitsResponse] = await Promise.all([
                fetch(mapUrl),
                fetch(unitsUrl)
            ]);
            if (!mapResponse.ok) throw new Error(`無法載入 map.json: ${mapResponse.statusText}`);
            if (!unitsResponse.ok) throw new Error(`無法載入 units.json: ${unitsResponse.statusText}`);
            
            const mapData = await mapResponse.json();
            const unitsData = await unitsResponse.json();
            
            this.hexGrid = new HexGrid(mapData.hexSize || 40);
            
            // 將 hexes 陣列轉換為 Map (Object) 以便快速查找
            const hexMap = new Map();
            for (const hex of mapData.hexes) {
                hexMap.set(`${hex.q},${hex.r}`, {
                    ...hex,
                    terrainType: mapData.terrainTypes[hex.terrain]
                });
            }
            mapData.hexes = hexMap;
            this.gameState.map = mapData;

            // 確保單位有 maxHp
            this.gameState.units = unitsData.map(u => ({
                ...u,
                stats: {
                    ...u.stats,
                    maxHp: u.stats.maxHp || u.stats.hp
                }
            }));
            
            this.gameState.turn = 1;
            this.gameState.currentPlayer = 'blue';
            this.gameState.selectedUnit = null;
            this.resetView();
            
        } catch (error) {
            console.error('載入資料失敗:', error);
            this.ui.log('載入預設資料失敗！請確保 data/map.json 與 data/units.json 存在，或使用本地伺服器運行。', 'red');
            // 載入備用資料 (如果 fetch 失敗)
            this.loadFallbackData();
        }
        
        this.ui.renderAllUnits();
        this.ui.updateTurnIndicator();
        this.render();
    }
    
    /**
     * 備用資料（當 fetch 失敗時）
     */
    loadFallbackData() {
        console.warn("正在載入備用資料...");
        this.hexGrid = new HexGrid(40);
        this.gameState.map = {"width":10,"height":10,"hexSize":40,"terrainTypes":{"plain":{"name":"平原","color":"#5a8a34","cost":1,"defBonus":0},"hill":{"name":"丘陵","color":"#8b6c42","cost":2,"defBonus":1},"water":{"name":"水域","color":"#3a5da0","cost":99,"defBonus":0}},"hexes":new Map(), "spawnPoints": {"red":[{"q":1,"r":1}],"blue":[{"q":8,"r":8}]}};
        for(let q=0; q<10; q++) {
            for(let r=0; r<10; r++) {
                this.gameState.map.hexes.set(`${q},${r}`, {"q":q,"r":r,"terrain":"plain","terrainType":this.gameState.map.terrainTypes.plain});
            }
        }
        this.gameState.units = [
          {"id":"blue_squad_1","name":"藍軍 步兵班 A","faction":"blue","level":"squad","q":8,"r":8,"stats":{"atk":5,"def":3,"mov":4,"sight":3,"hp":10,"maxHp":10,"logistics":100,"morale":80},"status":{"moved":false,"acted":false}},
          {"id":"red_platoon_1","name":"紅軍 偵察排 R1","faction":"red","level":"platoon","q":1,"r":1,"stats":{"atk":8,"def":4,"mov":5,"sight":5,"hp":20,"maxHp":20,"logistics":100,"morale":80},"status":{"moved":false,"acted":false}}
        ];
    }

    /**
     * 重新開始遊戲
     */
    restartGame() {
        if (confirm('確定要重新開始遊戲嗎？所有未儲存的進度將會遺失。')) {
            this.ui.log('遊戲已重新開始。', 'system');
            this.loadGameData(); // 重新載入
        }
    }

    /**
     * 設置所有事件監聽
     */
    setupEventListeners() {
        // --- 視圖控制 (Pan & Zoom) ---
        this.mapContainer.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = this.mapContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const zoomIntensity = 0.1;
            const oldScale = this.gameState.view.scale;
            const newScale = e.deltaY < 0 
                ? oldScale * (1 + zoomIntensity)
                : oldScale / (1 + zoomIntensity);
            
            // 限制縮放範圍
            this.gameState.view.scale = Math.max(0.2, Math.min(newScale, 3.0));

            // 以滑鼠為中心縮放
            this.gameState.view.x = mouseX - (mouseX - this.gameState.view.x) * (newScale / oldScale);
            this.gameState.view.y = mouseY - (mouseY - this.gameState.view.y) * (newScale / oldScale);

            this.updateViewTransform();
            this.render();
        });

        this.mapContainer.addEventListener('pointerdown', e => {
            // 中鍵或 (非單位上的) 左鍵點擊 = Panning
            if (e.button === 1 || (e.button === 0 && e.target === this.mapContainer)) {
                this.isPanning = true;
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
                this.mapContainer.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('pointermove', e => {
            if (this.isPanning) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                this.gameState.view.x += dx;
                this.gameState.view.y += dy;
                this.dragStart = { x: e.clientX, y: e.clientY };
                this.updateViewTransform();
                this.render();
            }
        });

        window.addEventListener('pointerup', e => {
            if (this.isPanning) {
                this.isPanning = false;
                this.mapContainer.style.cursor = 'grab';
            }
        });

        // --- 單位互動 (Click, Drag, ContextMenu) ---
        this.unitLayer.addEventListener('pointerdown', e => this.onUnitPointerDown(e));
        window.addEventListener('pointermove', e => this.onUnitPointerMove(e));
        window.addEventListener('pointerup', e => this.onUnitPointerUp(e));
        
        // 點擊空白處取消選取
        this.mapContainer.addEventListener('click', e => {
            if (e.target === this.mapContainer || e.target === this.canvas) {
                this.selectUnit(null);
                this.ui.hideContextMenu();
            }
        });

        // 右鍵選單
        this.mapContainer.addEventListener('contextmenu', e => this.onMapContextMenu(e));
        
        // --- UI 按鈕 ---
        document.getElementById('btn-end-turn').addEventListener('click', () => this.endTurn());
        document.getElementById('btn-save-game').addEventListener('click', () => this.saveGame());
        document.getElementById('btn-restart-game').addEventListener('click', () => this.restartGame());
        document.getElementById('load-game-input').addEventListener('change', e => this.loadGameFromInput(e));
    }

    // --- 單位互動處理 ---

    onUnitPointerDown(e) {
        const unitElement = e.target.closest('.unit');
        if (!unitElement) return;

        const unitId = unitElement.dataset.unitId;
        const unit = this.getUnitById(unitId);
        if (!unit) return;

        e.stopPropagation(); // 防止觸發地圖 Panning

        if (e.button === 0) { // 左鍵
            this.selectUnit(unit);

            // 檢查是否可拖曳
            if (unit.faction === this.gameState.currentPlayer && !unit.status.moved) {
                this.isDraggingUnit = true;
                this.draggedUnit = unit;
                unitElement.classList.add('dragging');

                // 計算可移動範圍
                this.calculateReachableHexes(unit);
                this.render(); // 重繪高亮
            }
        }
    }

    onUnitPointerMove(e) {
        if (!this.isDraggingUnit) return;

        const { x, y } = this.getMouseWorldPos(e);
        const unitElement = this.ui.getUnitElement(this.draggedUnit.id);
        
        // 讓單位跟隨滑鼠
        unitElement.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        
        // 顯示路徑 (簡易版：高亮目標格)
        const {q, r} = this.getHexAtPixel(e.clientX, e.clientY);
        const hexKey = `${q},${r}`;
        
        // (未來可在此處繪製 A* 路徑)
        
        // 繪製高亮 (在 render 迴圈中處理)
        const targetHex = this.gameState.map.hexes.get(hexKey);
        if (targetHex && this.reachableHexes.has(hexKey)) {
             // 可以在此處高亮路徑，暫時先在 render() 中高亮所有範圍
        }
    }

    onUnitPointerUp(e) {
        if (!this.isDraggingUnit || !this.draggedUnit) {
            this.isDraggingUnit = false;
            this.draggedUnit = null;
            return;
        }

        const unit = this.draggedUnit;
        const unitElement = this.ui.getUnitElement(unit.id);
        unitElement.classList.remove('dragging');

        const { q, r } = this.getHexAtPixel(e.clientX, e.clientY);
        const hexKey = `${q},${r}`;

        // 檢查是否為合法移動
        if (this.reachableHexes.has(hexKey) && !this.getUnitAt(q, r)) {
            this.moveUnit(unit, { q, r });
            unit.status.moved = true;
            this.selectUnit(unit); // 保持選取
            this.ui.updateUnitElement(unit); // 更新透明度
        } else {
            // 非法移動，彈回原位
            this.ui.updateUnitElement(unit);
        }

        this.isDraggingUnit = false;
        this.draggedUnit = null;
        this.reachableHexes.clear();
        this.render();
    }

    onMapContextMenu(e) {
        e.preventDefault();
        const { q, r } = this.getHexAtPixel(e.clientX, e.clientY);
        const targetHex = this.getHexAt(q, r);
        if (!targetHex) return;

        const targetUnit = this.getUnitAt(q, r);
        const selectedUnit = this.gameState.selectedUnit;
        
        let contextUnit = null;

        if (targetUnit) {
            // 右鍵點擊在單位上
            contextUnit = targetUnit;
        } else if (selectedUnit) {
            // 右鍵點擊在空格上 (但有選中單位)
            contextUnit = selectedUnit;
        }

        if (!contextUnit) return;

        this.gameState.contextMenuUnit = contextUnit;
        this.ui.showContextMenu(e.clientX, e.clientY, contextUnit, targetUnit);
    }
    
    // --- 遊戲邏輯 ---

    /**
     * 選取單位
     */
    selectUnit(unit) {
        // 取消舊的選取
        if (this.gameState.selectedUnit) {
            this.ui.getUnitElement(this.gameState.selectedUnit.id)?.classList.remove('selected');
        }
        
        this.gameState.selectedUnit = unit;
        this.reachableHexes.clear();
        this.attackableHexes.clear();

        if (unit) {
            this.ui.getUnitElement(unit.id)?.classList.add('selected');
            this.ui.updateInfoPanel(unit);

            // 計算移動與攻擊範圍 (如果輪到他且未行動)
            if (unit.faction === this.gameState.currentPlayer) {
                if (!unit.status.moved) {
                    this.calculateReachableHexes(unit);
                }
                if (!unit.status.acted) {
                    this.calculateAttackableHexes(unit);
                }
            }
        } else {
            this.ui.updateInfoPanel(null); // 清空資訊版
        }
        
        this.render(); // 重繪高亮
    }
    
    /**
     * 移動單位
     */
    moveUnit(unit, newCoords) {
        const oldCoords = { q: unit.q, r: unit.r };
        unit.q = newCoords.q;
        unit.r = newCoords.r;
        
        this.ui.updateUnitElement(unit);
        this.ui.log(`${unit.name} (${unit.faction}) 從 [${oldCoords.q},${oldCoords.r}] 移動至 [${newCoords.q},${newCoords.r}]`, unit.faction);
    }

    /**
     * 結束回合
     */
    endTurn() {
        if (this.isDraggingUnit) return; // 拖曳時不結束
        
        const currentPlayer = this.gameState.currentPlayer;
        
        // 重設當前玩家單位的狀態
        this.gameState.units
            .filter(u => u.faction === currentPlayer)
            .forEach(u => {
                u.status.moved = false;
                u.status.acted = false;
                this.ui.updateUnitElement(u); // 移除透明
            });
            
        this.selectUnit(null); // 取消選取

        if (currentPlayer === 'blue') {
            // 輪到紅軍 (AI)
            this.gameState.currentPlayer = 'red';
            this.ui.log('紅軍回合開始。', 'red');
            this.ui.updateTurnIndicator();
            
            // 執行 AI
            setTimeout(() => {
                this.ai.runAI();
                // AI 執行完畢後會自動呼叫 endTurn()
            }, 500); // 延遲 500ms 讓玩家有反應時間
            
        } else {
            // 輪到藍軍 (玩家)
            this.gameState.currentPlayer = 'blue';
            this.gameState.turn++;
            this.ui.log(`第 ${this.gameState.turn} 回合開始。藍軍回合開始。`, 'blue');
            this.ui.updateTurnIndicator();
        }
    }
    
    /**
     * 戰鬥計算 (核心公式)
     */
    calculateCombat(attacker, defender) {
        const terrain = this.getHexAt(defender.q, defender.r);
        const terrainDefBonus = terrain?.terrainType?.defBonus || 0;
        
        const atkStats = attacker.stats;
        const defStats = defender.stats;

        // 1. 命中率 (範例公式)
        // clamp(0.2 + 0.05*(attacker.sight - defender.sight) + 0.03*(attacker.morale - defender.morale), 0.05, 0.95)
        let hitChance = 0.2 + 0.05 * (atkStats.sight - defStats.sight) + 0.03 * (atkStats.morale - defStats.morale);
        hitChance = Math.max(0.05, Math.min(hitChance, 0.95)); // Clamp

        // 2. 基礎傷害 (範例公式)
        // 假設 atk_factor = 1, def_factor = 1 (可調整)
        const atk_factor = 1.0;
        const def_factor = 1.0;
        let baseDamage = (atkStats.atk * atk_factor) - (defStats.def * def_factor + terrainDefBonus);
        
        // 3. 確保傷害至少為 1 (如果命中的話)
        baseDamage = Math.max(1, baseDamage);

        // 4. 隨機係數 (0.85 ~ 1.15)
        const randomFactor = 0.85 + Math.random() * 0.30;
        const expectedDamage = Math.round(baseDamage * randomFactor);

        return {
            hitChance: hitChance,
            expectedDamage: expectedDamage,
            defenderTerrainBonus: terrainDefBonus
        };
    }
    
    /**
     * 執行戰鬥
     */
    resolveCombat(attacker, defender) {
        if (attacker.status.acted) {
            this.ui.log(`${attacker.name} 已經行動過，無法攻擊。`, 'system');
            return;
        }
        
        // 檢查距離 (簡易：相鄰)
        if (this.hexGrid.hexDistance(attacker, defender) > 1) {
            this.ui.log(`目標太遠，無法攻擊。`, 'system');
            return;
        }

        const combatResult = this.calculateCombat(attacker, defender);
        
        this.ui.log(`${attacker.name} 攻擊 ${defender.name}!`, 'combat');
        
        // 執行命中判定
        if (Math.random() <= combatResult.hitChance) {
            const damage = combatResult.expectedDamage;
            defender.stats.hp -= damage;
            
            this.ui.log(`命中！造成 ${damage} 點傷害。 (地形加成: ${combatResult.defenderTerrainBonus})`, 'combat');
            
            if (defender.stats.hp <= 0) {
                defender.stats.hp = 0;
                this.ui.log(`${defender.name} 已被摧毀！`, 'combat');
                this.removeUnit(defender);
            } else {
                // 更新防守方徽章
                this.ui.updateUnitBadge(defender);
            }
        } else {
            this.ui.log(`攻擊未命中！`, 'combat');
        }
        
        // 消耗攻擊方行動
        attacker.status.acted = true;
        attacker.status.moved = true; // 攻擊後通常不能再移動
        this.ui.updateUnitElement(attacker);
        
        // 如果選中的是攻擊者，刷新面板
        if (this.gameState.selectedUnit?.id === attacker.id) {
            this.selectUnit(attacker); // 重新選取以刷新高亮
        }
    }
    
    /**
     * 移除單位
     */
    removeUnit(unit) {
        // 從 DOM 移除
        this.ui.getUnitElement(unit.id)?.remove();
        // 從 gameState 移除
        this.gameState.units = this.gameState.units.filter(u => u.id !== unit.id);
        
        if (this.gameState.selectedUnit?.id === unit.id) {
            this.selectUnit(null);
        }
    }
    
    /**
     * 編輯單位屬性
     */
    editUnitStat(unitId, stat, value) {
        const unit = this.getUnitById(unitId);
        if (!unit) return;
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        if (stat in unit.stats) {
            unit.stats[stat] = numValue;
            // 特殊處理 maxHp
            if (stat === 'maxHp') {
                unit.stats.hp = Math.min(unit.stats.hp, numValue);
            }
            if (stat === 'hp') {
                unit.stats.hp = Math.min(numValue, unit.stats.maxHp);
            }
            
            this.ui.log(`[系統] ${unit.name} 的 ${stat} 屬性已更新為 ${numValue}`, 'system');
            
            // 重新繪製徽章
            this.ui.updateUnitBadge(unit);
            
            // 如果是選中單位，刷新面板
            if (this.gameState.selectedUnit?.id === unitId) {
                this.ui.updateInfoPanel(unit);
            }
        }
    }

    // --- 尋路 & 範圍計算 ---
    
    /**
     * 計算可移動範圍 (BFS)
     */
    calculateReachableHexes(unit) {
        this.reachableHexes.clear();
        const startHex = { q: unit.q, r: unit.r };
        const movementPoints = unit.stats.mov;
        
        const frontier = [startHex]; // 待檢查
        const costSoFar = new Map(); // 儲存到該格的成本
        
        const startKey = `${startHex.q},${startHex.r}`;
        costSoFar.set(startKey, 0);
        this.reachableHexes.set(startKey, 0); // 起點
        
        let head = 0;
        while(head < frontier.length) {
            const current = frontier[head++];
            const currentKey = `${current.q},${current.r}`;
            const currentCost = costSoFar.get(currentKey);

            const neighbors = this.hexGrid.hexNeighbors(current);
            
            for (const next of neighbors) {
                const hexData = this.getHexAt(next.q, next.r);
                if (!hexData) continue; // 地圖邊界外
                
                // 檢查地形
                const terrainCost = hexData.terrainType?.cost || 99;
                const newCost = currentCost + terrainCost;
                
                const nextKey = `${next.q},${next.r}`;
                
                // 檢查移動力
                if (newCost <= movementPoints) {
                    // 檢查是否有單位 (不能穿過敵方，不能停在友方)
                    const unitAtNext = this.getUnitAt(next.q, next.r);
                    
                    if (unitAtNext && unitAtNext.faction !== unit.faction) {
                        continue; // 不能穿過敵方
                    }
                    
                    if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                        costSoFar.set(nextKey, newCost);
                        frontier.push(next);
                        
                        // 只能停在空格
                        if (!unitAtNext) {
                            this.reachableHexes.set(nextKey, newCost);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * 計算可攻擊範圍 (簡易：相鄰格)
     */
    calculateAttackableHexes(unit) {
        this.attackableHexes.clear();
        
        // 1. 計算所有可移動到的格子 (包含友軍格)
        const potentialMoveHexes = new Set();
        this.calculateReachableHexes(unit); // 這會更新 this.reachableHexes (只含空格)
        
        // 我們需要一個包含所有「可站立」位置的列表，包括自己
        const moveKeys = new Set(this.reachableHexes.keys());
        moveKeys.add(`${unit.q},${unit.r}`); // 加上原位

        // 2. 遍歷所有可移動格，找出它們的鄰居
        for (const hexKey of moveKeys) {
            const [q, r] = hexKey.split(',').map(Number);
            const neighbors = this.hexGrid.hexNeighbors({ q, r });
            
            for (const neighbor of neighbors) {
                const targetUnit = this.getUnitAt(neighbor.q, neighbor.r);
                
                // 3. 如果鄰居是敵方單位，加入攻擊列表
                if (targetUnit && targetUnit.faction !== unit.faction) {
                    this.attackableHexes.set(`${neighbor.q},${neighbor.r}`, targetUnit);
                }
            }
        }
    }


    // --- 儲存 & 載入 ---
    
    /**
     * 儲存戰局 (匯出 JSON)
     */
    saveGame() {
        // 準備要儲存的狀態
        const stateToSave = {
            turn: this.gameState.turn,
            currentPlayer: this.gameState.currentPlayer,
            units: this.gameState.units,
            // map 通常不用存，除非地圖會動態改變
        };
        
        const dataStr = JSON.stringify(stateToSave, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `kinmen823_save_T${this.gameState.turn}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.ui.log('遊戲狀態已儲存。', 'system');
    }

    /**
     * 從 <input> 載入戰局
     */
    loadGameFromInput(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const state = JSON.parse(e.target.result);
                if (!state.units || !state.turn) {
                    throw new Error('無效的存檔格式。');
                }
                
                // 載入狀態
                this.gameState.turn = state.turn;
                this.gameState.currentPlayer = state.currentPlayer;
                this.gameState.units = state.units;
                
                // 確保 map 仍然存在 (存檔通常不包含地圖)
                if (!this.gameState.map) {
                    this.loadGameData(); // 如果 map 不在，重新載入
                } else {
                    // 刷新
                    this.ui.renderAllUnits();
                    this.ui.updateTurnIndicator();
                    this.selectUnit(null);
                    this.render();
                }
                
                this.ui.log(`已成功載入存檔。回合 ${state.turn}, ${state.currentPlayer} 行動。`, 'system');
                
            } catch (err) {
                console.error('載入失敗:', err);
                this.ui.log(`載入存檔失敗: ${err.message}`, 'red');
            } finally {
                // 清空 input 以便下次能選同一個檔案
                event.target.value = null;
            }
        };
        reader.readAsText(file);
    }

    // --- 渲染 (Canvas) ---

    /**
     * 主渲染迴圈
     */
    render() {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 應用 Pan & Zoom
        this.ctx.translate(this.gameState.view.x, this.gameState.view.y);
        this.ctx.scale(this.gameState.view.scale, this.gameState.view.scale);
        
        this.drawMap();
        this.drawHighlights();
        
        this.ctx.restore();
    }

    /**
     * 繪製地圖
     */
    drawMap() {
        if (!this.gameState.map) return;
        
        this.gameState.map.hexes.forEach(hex => {
            const center = this.hexGrid.axialToPixel(hex.q, hex.r);
            const corners = this.hexGrid.getHexCorners(center);
            
            // 繪製六角形
            this.ctx.beginPath();
            this.ctx.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < 6; i++) {
                this.ctx.lineTo(corners[i].x, corners[i].y);
            }
            this.ctx.closePath();
            
            // 填色 (地形)
            this.ctx.fillStyle = hex.terrainType?.color || '#333';
            this.ctx.fill();
            
            // 描邊
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            // 繪製座標 (Debug 用)
            // this.ctx.fillStyle = '#fff';
            // this.ctx.fillText(`${hex.q},${hex.r}`, center.x - 10, center.y + 5);
        });
    }

    /**
     * 繪製高亮
     */
    drawHighlights() {
        // 繪製可移動範圍
        if (this.reachableHexes.size > 0) {
            this.ctx.fillStyle = 'rgba(0, 170, 255, 0.3)'; // 藍色
            this.reachableHexes.forEach((cost, key) => {
                const [q, r] = key.split(',').map(Number);
                const center = this.hexGrid.axialToPixel(q, r);
                const corners = this.hexGrid.getHexCorners(center);
                
                this.ctx.beginPath();
                this.ctx.moveTo(corners[0].x, corners[0].y);
                for (let i = 1; i < 6; i++) {
                    this.ctx.lineTo(corners[i].x, corners[i].y);
                }
                this.ctx.closePath();
                this.ctx.fill();
            });
        }
        
        // 繪製可攻擊範圍
        if (this.attackableHexes.size > 0) {
            this.ctx.strokeStyle = 'rgba(255, 68, 68, 0.8)'; // 紅色
            this.ctx.lineWidth = 3;
            this.attackableHexes.forEach((target, key) => {
                const [q, r] = key.split(',').map(Number);
                const center = this.hexGrid.axialToPixel(q, r);
                const corners = this.hexGrid.getHexCorners(center);
                
                this.ctx.beginPath();
                this.ctx.moveTo(corners[0].x, corners[0].y);
                for (let i = 1; i < 6; i++) {
                    this.ctx.lineTo(corners[i].x, corners[i].y);
                }
                this.ctx.closePath();
                this.ctx.stroke();
            });
        }
    }

    // --- 視圖 & 座標輔助 ---

    resizeCanvas() {
        this.canvas.width = this.mapContainer.clientWidth;
        this.canvas.height = this.mapContainer.clientHeight;
        this.render();
    }
    
    resetView() {
        const mapWidth = (this.gameState.map.width * this.hexGrid.width * 0.75);
        const mapHeight = (this.gameState.map.height * this.hexGrid.height);
        
        const scaleX = this.canvas.width / mapWidth;
        const scaleY = this.canvas.height / mapHeight;
        
        this.gameState.view.scale = Math.min(scaleX, scaleY, 1); // 縮放至剛好
        
        // 居中
        this.gameState.view.x = (this.canvas.width - (mapWidth * this.gameState.view.scale)) / 2;
        this.gameState.view.y = (this.canvas.height - (mapHeight * this.gameState.view.scale)) / 2;
        
        this.updateViewTransform();
    }

    updateViewTransform() {
        const { x, y, scale } = this.gameState.view;
        this.unitLayer.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        this.canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; // 同步 Canvas
    }

    /**
     * 獲取滑鼠在世界座標中的位置 (已應用 Pan/Zoom)
     */
    getMouseWorldPos(e) {
        const rect = this.mapContainer.getBoundingClientRect();
        const { x, y, scale } = this.gameState.view;
        const mouseX = (e.clientX - rect.left - x) / scale;
        const mouseY = (e.clientY - rect.top - y) / scale;
        return { x: mouseX, y: mouseY };
    }
    
    /**
     * 獲取滑鼠點擊的六角格
     */
    getHexAtPixel(clientX, clientY) {
        const { x, y } = this.getMouseWorldPos({clientX, clientY});
        return this.hexGrid.pixelToAxial(x, y);
    }
    
    // --- 數據輔助 ---
    
    getHexAt(q, r) {
        return this.gameState.map.hexes.get(`${q},${r}`);
    }
    
    getUnitAt(q, r) {
        return this.gameState.units.find(u => u.q === q && u.r === r);
    }
    
    getUnitById(id) {
        return this.gameState.units.find(u => u.id === id);
    }
    
    getUnitsByFaction(faction) {
        return this.gameState.units.filter(u => u.faction === faction);
    }
}

// --- 3. UI 管理器 (UIManager) ---

class UIManager {
    constructor(game) {
        this.game = game;
        this.logPanel = document.getElementById('action-log');
        this.infoPanelContent = document.getElementById('unit-info-content');
        this.combatPreviewContent = document.getElementById('combat-preview-content');
        this.contextMenu = document.getElementById('context-menu');
    }
    
    /**
     * 單位編制層級對應表
     */
    getLevelAbbreviation(level) {
        const map = {
            "squad": "SQD",
            "platoon": "PLT",
            "company": "CO",
            "battalion": "BN",
            "brigade": "BDE",
            "division": "DIV",
            "corps": "CORPS",
            "army": "ARMY",
            "theater": "THTR"
        };
        return map[level] || "UNK";
    }
    
    /**
     * 創建一個單位的徽章 SVG
     */
    createUnitBadge(unit) {
        const svgString = this.game.badgeTemplate;
        const levelText = this.getLevelAbbreviation(unit.level);
        const hpText = `HP: ${unit.stats.hp}/${unit.stats.maxHp}`;
        
        // 使用字串替換來動態生成 SVG
        // 為了效能，我們不用 DOMParser，而是直接替換
        let finalSvg = svgString
            .replace('LVL', levelText)
            .replace('HP: 10/10', hpText);

        return finalSvg;
    }

    /**
     * 創建一個單位的 DOM 元素
     */
    createUnitElement(unit) {
        const unitElement = document.createElement('div');
        unitElement.id = `unit-${unit.id}`;
        unitElement.dataset.unitId = unit.id;
        unitElement.className = `unit faction-${unit.faction}`;
        
        unitElement.innerHTML = this.createUnitBadge(unit);
        
        this.game.unitLayer.appendChild(unitElement);
        this.updateUnitElement(unit); // 設置初始位置
    }

    /**
     * 更新單位的 DOM 元素 (位置, 狀態)
     */
    updateUnitElement(unit) {
        const element = this.getUnitElement(unit.id);
        if (!element) return;
        
        // 更新位置
        const { x, y } = this.game.hexGrid.axialToPixel(unit.q, unit.r);
        element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        
        // 更新狀態 (透明度)
        const isExhausted = unit.status.moved && unit.status.acted;
        if (isExhausted || (unit.faction === this.game.gameState.currentPlayer && (unit.status.moved || unit.status.acted))) {
            element.classList.add('moved-or-acted');
        } else {
            element.classList.remove('moved-or-acted');
        }
    }
    
    /**
     * 僅更新單位的徽章 (例如 HP 變化)
     */
    updateUnitBadge(unit) {
        const element = this.getUnitElement(unit.id);
        if (!element) return;
        
        // (簡易更新法：重繪)
        element.innerHTML = this.createUnitBadge(unit);
    }
    
    /**
     * 渲染所有單位 (例如載入時)
     */
    renderAllUnits() {
        this.game.unitLayer.innerHTML = ''; // 清空
        this.game.gameState.units.forEach(unit => {
            this.createUnitElement(unit);
        });
    }
    
    getUnitElement(unitId) {
        return document.getElementById(`unit-${unitId}`);
    }

    /**
     * 更新資訊面板
     */
    updateInfoPanel(unit) {
        if (!unit) {
            this.infoPanelContent.innerHTML = '<p>請點選一個單位以查看詳細資訊。</p>';
            this.combatPreviewContent.innerHTML = '';
            return;
        }

        this.infoPanelContent.innerHTML = `
            <h4 class="unit-name ${unit.faction}">${unit.name}</h4>
            <p>編制: ${this.getLevelAbbreviation(unit.level)} (${unit.level})</p>
            <p>陣營: ${unit.faction}</p>
            <p>座標: [${unit.q}, ${unit.r}]</p>
            <div class="stats-grid">
                ${this.createStatInput('hp', 'HP', unit.stats.hp)}
                ${this.createStatInput('maxHp', 'Max HP', unit.stats.maxHp)}
                ${this.createStatInput('atk', '攻擊', unit.stats.atk)}
                ${this.createStatInput('def', '防禦', unit.stats.def)}
                ${this.createStatInput('mov', '移動', unit.stats.mov)}
                ${this.createStatInput('sight', '視距', unit.stats.sight)}
                ${this.createStatInput('morale', '士氣', unit.stats.morale)}
                ${this.createStatInput('logistics', '後勤', unit.stats.logistics)}
            </div>
        `;
        
        // 綁定編輯事件
        this.infoPanelContent.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.game.editUnitStat(unit.id, e.target.dataset.stat, e.target.value);
            });
            // 讓 input 點擊不觸發地圖
            input.addEventListener('pointerdown', e => e.stopPropagation());
        });
        
        // 更新戰鬥預覽
        this.updateCombatPreview(unit);
    }
    
    createStatInput(key, label, value) {
        return `
            <div class="stat-item">
                <label for="stat-${key}">${label}</label>
                <input type="number" id="stat-${key}" data-stat="${key}" value="${value}">
            </div>
        `;
    }
    
    /**
     * 更新戰鬥預覽
     */
    updateCombatPreview(attacker) {
        if (!attacker || attacker.status.acted) {
            this.combatPreviewContent.innerHTML = '';
            return;
        }
        
        const targets = this.game.attackableHexes;
        if (targets.size === 0) {
            this.combatPreviewContent.innerHTML = '<p>無可攻擊目標。</p>';
            return;
        }
        
        let previewHtml = '';
        targets.forEach(defender => {
            const result = this.game.calculateCombat(attacker, defender);
            previewHtml += `
                <p>vs ${defender.name}:</p>
                <ul>
                    <li>命中率: ${Math.round(result.hitChance * 100)}%</li>
                    <li>預期傷害: ${result.expectedDamage}</li>
                    <li>(敵方地形加成: ${result.defenderTerrainBonus})</li>
                </ul>
            `;
        });
        this.combatPreviewContent.innerHTML = previewHtml;
    }

    /**
     * 紀錄行動
     */
    log(message, type = 'system') {
        const p = document.createElement('p');
        p.textContent = message;
        p.className = `log-${type}`;
        this.logPanel.appendChild(p);
        // 滾動到底部
        this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }
    
    /**
     * 更新回合指示器
     */
    updateTurnIndicator() {
        document.getElementById('turn-count').textContent = this.game.gameState.turn;
        const playerSpan = document.getElementById('current-player');
        playerSpan.textContent = this.game.gameState.currentPlayer === 'blue' ? 'Blue' : 'Red';
        playerSpan.className = this.game.gameState.currentPlayer;
    }
    
    /**
     * 顯示右鍵選單
     */
    showContextMenu(x, y, contextUnit, targetUnit) {
        const menu = this.contextMenu;
        
        const isMyTurn = contextUnit.faction === this.game.gameState.currentPlayer;
        const canMove = isMyTurn && !contextUnit.status.moved;
        const canAct = isMyTurn && !contextUnit.status.acted;
        
        const isTargetingEnemy = targetUnit && targetUnit.faction !== contextUnit.faction;
        const isInRange = isTargetingEnemy && this.game.hexGrid.hexDistance(contextUnit, targetUnit) <= 1; // 簡易近戰
        
        // 設置菜單項目狀態
        this.toggleMenuItem('menu-move', canMove);
        this.toggleMenuItem('menu-attack', canAct && isInRange);
        this.toggleMenuItem('menu-wait', canMove || canAct);
        
        menu.style.display = 'block';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        
        // 移除舊監聽
        menu.replaceWith(menu.cloneNode(true));
        this.contextMenu = document.getElementById('context-menu');
        
        // 綁定新監聽
        this.contextMenu.querySelector('#menu-attack').addEventListener('click', () => {
            if (canAct && isInRange) {
                this.game.resolveCombat(contextUnit, targetUnit);
            }
            this.hideContextMenu();
        });
        
        this.contextMenu.querySelector('#menu-wait').addEventListener('click', () => {
            if (isMyTurn) {
                contextUnit.status.moved = true;
                contextUnit.status.acted = true;
                this.updateUnitElement(contextUnit);
                this.log(`${contextUnit.name} 選擇待命。`, contextUnit.faction);
            }
            this.hideContextMenu();
        });

        this.contextMenu.querySelector('#menu-edit').addEventListener('click', () => {
            this.game.selectUnit(contextUnit); // 選中以便編輯
            this.hideContextMenu();
        });

        this.contextMenu.querySelector('#menu-delete').addEventListener('click', () => {
            if (confirm(`確定要刪除 ${contextUnit.name} 嗎？`)) {
                this.game.removeUnit(contextUnit);
            }
            this.hideContextMenu();
        });

        // 'menu-move' 由拖曳處理，此處僅為顯示
    }
    
    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.game.gameState.contextMenuUnit = null;
    }
    
    toggleMenuItem(id, enabled) {
        const item = this.contextMenu.querySelector(`#${id}`);
        if (enabled) {
            item.classList.remove('disabled');
        } else {
            item.classList.add('disabled');
        }
    }
}

// --- 4. AI 控制器 (AIController) ---

class AIController {
    constructor(game) {
        this.game = game;
    }

    /**
     * 執行 AI 回合
     */
    async runAI() {
        const aiUnits = this.game.getUnitsByFaction('red');
        const playerUnits = this.game.getUnitsByFaction('blue');
        
        // 為了非同步的感覺，我們逐個處理 AI 單位
        for (const unit of aiUnits) {
            // 延遲
            await new Promise(resolve => setTimeout(resolve, 200)); 
            
            if (unit.status.acted) continue; // 已行動

            // 1. 查找最佳行動
            const action = this.findBestAction(unit, playerUnits);

            // 2. 執行行動
            if (action) {
                this.executeAction(action);
            } else {
                // 沒事做，待命
                unit.status.moved = true;
                unit.status.acted = true;
                this.game.ui.updateUnitElement(unit);
            }
        }
        
        // AI 回合結束
        this.game.ui.log('紅軍回合結束。', 'red');
        this.game.endTurn(); // 切換回藍軍
    }
    
    /**
     * 為單個 AI 單位尋找最佳行動
     */
    findBestAction(unit, targets) {
        if (targets.length === 0) return null;

        let bestAttack = null;
        let bestMove = null;
        
        // --- 策略 1: 攻擊 (如果可能) ---
        // 查找相鄰的敵人
        const neighbors = this.game.hexGrid.hexNeighbors(unit);
        let attackableTargets = [];
        for (const n of neighbors) {
            const target = this.game.getUnitAt(n.q, n.r);
            if (target && targets.includes(target)) {
                attackableTargets.push(target);
            }
        }

        if (attackableTargets.length > 0) {
            // 優先攻擊 HP 最低的
            attackableTargets.sort((a, b) => a.stats.hp - b.stats.hp);
            const target = attackableTargets[0];
            const combatSim = this.game.calculateCombat(unit, target);
            
            // 只有在預期傷害 > 0 時才攻擊
            if (combatSim.expectedDamage > 0) {
                bestAttack = { action: 'ATTACK', unit, target };
            }
        }

        // 如果找到攻擊目標，就執行攻擊 (不移動)
        if (bestAttack) {
            // 10% 機率做非最優行為 (待命)
            if (Math.random() < 0.1) {
                return { action: 'WAIT', unit };
            }
            return bestAttack;
        }

        // --- 策略 2: 移動並攻擊 ---
        // (簡易版 AI 暫不實作複雜的 "移動後攻擊" 決策)
        
        // --- 策略 3: 朝最近的敵人移動 ---
        if (unit.status.moved) return null; // 如果已移動 (例如在策略2中)，則跳過

        // 找到最近的敵人
        let nearestTarget = null;
        let minDistance = Infinity;
        
        for (const target of targets) {
            const d = this.game.hexGrid.hexDistance(unit, target);
            if (d < minDistance) {
                minDistance = d;
                nearestTarget = target;
            }
        }
        
        if (!nearestTarget) return null; // 沒有敵人了

        // 尋找朝向目標的路徑 (簡易版：只找最佳的下一步)
        let bestNextHex = null;
        let bestHexDistance = minDistance;
        
        // 計算可移動範圍
        this.game.calculateReachableHexes(unit);
        
        if (this.game.reachableHexes.size > 0) {
            // 遍歷所有可移動格，找出最接近目標的
            this.game.reachableHexes.forEach((cost, key) => {
                const [q, r] = key.split(',').map(Number);
                const d = this.game.hexGrid.hexDistance({q, r}, nearestTarget);
                
                // 優先找可以攻擊的格子
                if (d === 1) { 
                    bestNextHex = { q, r };
                    bestHexDistance = d;
                    return; // 找到可攻擊位，停止搜索
                }
                
                if (d < bestHexDistance) {
                    bestHexDistance = d;
                    bestNextHex = { q, r };
                }
            });
        }
        
        // 清理 AI 的計算
        this.game.reachableHexes.clear();

        if (bestNextHex) {
            // 10% 機率不移動
            if (Math.random() < 0.1) {
                return { action: 'WAIT', unit };
            }
            return { action: 'MOVE', unit, targetCoords: bestNextHex };
        }

        // 沒事做
        return { action: 'WAIT', unit };
    }
    
    /**
     * 執行 AI 行動
     */
    executeAction(action) {
        const { unit } = action;
        
        switch (action.action) {
            case 'ATTACK':
                this.game.ui.log(`[AI] ${unit.name} 攻擊 ${action.target.name}!`, 'red');
                this.game.resolveCombat(unit, action.target);
                break;
                
            case 'MOVE':
                this.game.moveUnit(unit, action.targetCoords);
                unit.status.moved = true;
                // 檢查移動後是否能攻擊
                const postMoveAction = this.findBestAction(unit, this.game.getUnitsByFaction('blue'));
                if (postMoveAction && postMoveAction.action === 'ATTACK') {
                    // 延遲一下再攻擊
                    setTimeout(() => {
                        this.game.ui.log(`[AI] ${unit.name} 移動後發動攻擊!`, 'red');
                        this.executeAction(postMoveAction);
                    }, 250);
                } else {
                    // 移動完沒事做，標記已行動
                    unit.status.acted = true;
                }
                break;
                
            case 'WAIT':
                this.game.ui.log(`[AI] ${unit.name} 選擇待命。`, 'red');
                unit.status.moved = true;
                unit.status.acted = true;
                break;
        }
        
        this.game.ui.updateUnitElement(unit);
    }
}


// --- 5. 遊戲啟動 ---

document.addEventListener('DOMContentLoaded', () => {
    const game = new GameEngine();
    game.init();
    
    // 將 game 實例暴露到 window 以便調試
    window.Wargame = game; 
});
