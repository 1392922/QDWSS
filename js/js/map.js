class MapRenderer {
    constructor(canvas, hexSize = 30) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hexSize = hexSize; // 六角格邊長 (像素)
        this.hexHeight = Math.sqrt(3) * hexSize;
        this.hexWidth = 2 * hexSize;

        this.mapFeatures = []; // 儲存河流、道路、建築物
        
        // 模擬地圖範圍 (未來應載入真實金門/廈門地圖)
        // 這裡僅為範例，假設一個 50x50 的格子
        this.gridWidth = 50; 
        this.gridHeight = 50;

        // 地圖平移與縮放 (用於拖曳地圖)
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoom = 1.0;
    }

    /**
     * 將六角格座標 (axial coordinates: q, r) 轉換為像素座標 (x, y)
     */
    hexToPixel({ q, r }) {
        const x = this.hexSize * (3/2 * q) * this.zoom + this.offsetX;
        const y = this.hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r) * this.zoom + this.offsetY;
        return { x, y };
    }

    /**
     * 將像素座標 (x, y) 轉換回最近的六角格座標
     */
    pixelToHex({ x, y }) {
        // 反向計算 (略去平移和縮放的複雜數學)
        // 這是實現拖曳算子所必需的
        // ... (這部分數學較複雜, 暫時簡化)
        // 簡易版: 遍歷所有格子中心點，找最近的
        // (效能較差，但易於理解)
        let closestHex = { q: 0, r: 0 };
        let minDis = Infinity;

        for (let r = 0; r < this.gridHeight; r++) {
            for (let q = 0; q < this.gridWidth; q++) {
                const center = this.hexToPixel({ q, r });
                const dx = x - center.x;
                const dy = y - center.y;
                const dis = dx*dx + dy*dy;
                if (dis < minDis) {
                    minDis = dis;
                    closestHex = { q, r };
                }
            }
        }
        return closestHex;
    }

    /**
     * 繪製單個六角格
     */
    drawHex(q, r, strokeStyle = '#000', fillStyle = 'transparent') {
        const center = this.hexToPixel({ q, r });
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30;
            const angle_rad = Math.PI / 180 * angle_deg;
            const x_i = center.x + this.hexSize * Math.cos(angle_rad) * this.zoom;
            const y_i = center.y + this.hexSize * Math.sin(angle_rad) * this.zoom;
            if (i === 0) {
                this.ctx.moveTo(x_i, y_i);
            } else {
                this.ctx.lineTo(x_i, y_i);
            }
        }
        this.ctx.closePath();
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        if (fillStyle !== 'transparent') {
            this.ctx.fillStyle = fillStyle;
            this.ctx.fill();
        }
    }

    /**
     * 繪製整個地圖網格
     */
    drawGrid() {
        // (未來：只繪製可視範圍內的格子以優化效能)
        for (let r = 0; r < this.gridHeight; r++) {
            for (let q = 0; q < this.gridWidth; q++) {
                // (未來：根據地形資料決定 fillStyle)
                // if (isWater(q,r)) fillStyle = '#69b';
                // if (isCity(q,r)) fillStyle = '#888';
                this.drawHex(q, r, 'rgba(0,0,0,0.2)');
            }
        }
    }

    /**
     * 繪製地圖特徵 (河流、道路、建築)
     */
    drawFeatures() {
        this.mapFeatures.forEach(feature => {
            // ... 根據 feature.type 繪製線條 (河流) 或多邊形 (建築)
        });
    }

    /**
     * 新增地圖特徵 (例如用戶生成的河流)
     */
    addFeature(feature) {
        this.mapFeatures.push(feature);
    }
}

// 地圖特徵類別 (您要求可拖曳生成)
class MapFeature {
    constructor(type, points, color) {
        this.type = type; // 'river', 'road', 'building', 'supply_line', 'contour'
        this.points = points; // 點的陣列 [{x, y}] 或 [{q, r}]
        this.color = color;
    }
    
    draw(ctx, map) {
        // ... 繪製邏輯 ...
    }
}
