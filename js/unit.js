// 定義編制 (Echelon)
const ECHELON = {
    HQ: '司令部',
    PLATOON: '班/排',
    COMPANY: '連',
    BATTALION: '營',
    REGIMENT: '團',
    BRIGADE: '旅',
    DIVISION: '師',
    CORPS: '軍',
    ARMY_GROUP: '集團軍',
    THEATER: '戰區'
};

// 北約符號 (簡易版)
const ECHELON_SYMBOLS = {
    PLATOON: '●',
    COMPANY: '|',
    BATTALION: '||',
    REGIMENT: '|||',
    BRIGADE: 'X',
    DIVISION: 'XX',
    CORPS: 'XXX',
    ARMY_GROUP: 'XXXX',
    THEATER: 'XXXXX'
};

class Unit {
    constructor(id, name, team, echelon, stats, hexPos) {
        this.id = id; // 唯一 ID
        this.name = name; // 可編輯名稱 (例如: 金防部 裝甲584旅)
        this.team = team; // 'blue' 或 'red'
        this.echelon = echelon; // 編制 (來自 ECHELON)
        
        //  stats: { atk, def, mov, cmd } (攻擊, 防禦, 移動, 指揮)
        this.stats = stats; 
        
        this.hexPos = hexPos; // { q, r } 六角格座標
        this.pixelPos = { x: 0, y: 0 }; // 在畫布上的像素位置 (由 map.js 更新)

        this.isSelected = false;
        this.width = 40; // 算子寬度
        this.height = 30; // 算子高度
    }

    /**
     * 繪製算子 (使用 Canvas 2D Context)
     * @param {CanvasRenderingContext2D} ctx - 畫布上下文
     * @param {MapRenderer} map - 地圖渲染器 (用於座標轉換)
     */
    draw(ctx, map) {
        // 1. 座標轉換
        this.pixelPos = map.hexToPixel(this.hexPos);
        const x = this.pixelPos.x - this.width / 2;
        const y = this.pixelPos.y - this.height / 2;

        // 2. 繪製外框 (北約矩形)
        ctx.strokeStyle = this.isSelected ? '#FFFF00' : '#000000'; // 選中時黃色高亮
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, this.width, this.height);

        // 3. 填充隊伍顏色
        ctx.fillStyle = (this.team === 'blue') ? 'rgba(0, 123, 255, 0.7)' : 'rgba(220, 53, 69, 0.7)';
        ctx.fillRect(x, y, this.width, this.height);

        // 4. 繪製編制符號 (簡易北約)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const symbol = ECHELON_SYMBOLS[this.echelon] || '?';
        ctx.fillText(symbol, this.pixelPos.x, this.pixelPos.y - 5);

        // 5. 繪製單位類型 (簡易: HQ)
        if (this.echelon === ECHELON.HQ) {
            ctx.fillText('HQ', this.pixelPos.x, this.pixelPos.y + 10);
        }
        
        // (未來擴展: 繪製攻擊/防禦值)
        // ctx.font = '10px Arial';
        // ctx.fillText(`${this.stats.atk}-${this.stats.def}`, this.pixelPos.x, this.pixelPos.y + 12);
    }

    /**
     * 檢查點擊是否在此算子上
     */
    isClicked(clickX, clickY) {
        const x = this.pixelPos.x - this.width / 2;
        const y = this.pixelPos.y - this.height / 2;
        return (clickX > x && clickX < x + this.width &&
                clickY > y && clickY < y + this.height);
    }
}
