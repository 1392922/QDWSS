/**
 * 擲骰子
 */
function rollDice(sides = 6) {
    return Math.floor(Math.random() * sides) + 1;
}

/**
 * 飛彈類別 (依您要求，參數可調)
 */
class Missile {
    constructor(name, originHex, targetHex, params) {
        this.name = name; // e.g., "東風-15"
        this.originHex = originHex;
        this.targetHex = targetHex;
        // params: { range, accuracy, payload, speed }
        this.params = params;
        
        // 用於動畫
        this.animationProgress = 0; 
    }

    /**
     * 繪製飛彈軌跡 (簡易動畫)
     */
    draw(ctx, map) {
        if (this.animationProgress >= 1) return;

        this.animationProgress += 0.01; // 動畫速度
        
        const startPixel = map.hexToPixel(this.originHex);
        const endPixel = map.hexToPixel(this.targetHex);

        const currentX = startPixel.x + (endPixel.x - startPixel.x) * this.animationProgress;
        const currentY = startPixel.y + (endPixel.y - startPixel.y) * this.animationProgress;

        // 畫一個點代表飛彈
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 畫軌跡線
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startPixel.x, startPixel.y);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
    }
}

// (未來擴展: 戰鬥結算邏輯)
// function resolveCombat(attacker, defender, terrain) { ... }
