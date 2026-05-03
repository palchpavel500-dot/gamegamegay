// ═══════════════════════════════════════════════════════════════════════════
//  ULTRA ENHANCED GRAPHICS v3.0
//  Полностью переработанные текстуры: трава, юниты, здания, ресурсы, данжи
// ═══════════════════════════════════════════════════════════════════════════

// ─── УТИЛИТЫ ──────────────────────────────────────────────────────────────

// Детерминированный псевдо-random на основе позиции (без перерисовки мерцания)
function seededRand(x, y, s = 0) {
    let n = Math.sin(x * 127.1 + y * 311.7 + s * 74.3) * 43758.5453;
    return n - Math.floor(n);
}

// Плавное интерполирование (smoothstep)
function smoothstep(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return a + (b - a) * (t * t * (3 - 2 * t));
}

// ─── ГЛОБАЛЬНЫЙ КЭШИРОВАННЫЙ ХОЛСТ ДЛЯ ТАЙЛОВЫХ ТЕКСТУР ──────────────────
const _tileCache = new Map();

function getCachedTile(key, size, drawFn) {
    if (!_tileCache.has(key)) {
        const off = document.createElement('canvas');
        off.width = size; off.height = size;
        drawFn(off.getContext('2d'), size);
        _tileCache.set(key, off);
    }
    return _tileCache.get(key);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ПЕРЕОПРЕДЕЛЕНИЕ РЕНДЕРА ТАЙЛОВ ЗЕМЛИ И ВОДЫ
//  Патчим Game.prototype.render и renderWater
// ═══════════════════════════════════════════════════════════════════════════

(function patchGameRender() {
    // Ждём инициализации game
    const _origLoop = window.Game ? Game.prototype.loop : null;
    if (!_origLoop) {
        setTimeout(patchGameRender, 200);
        return;
    }

    // Патч renderWater
    Game.prototype.renderWater = function() {
        const sx = Math.max(0, Math.floor(this.camera.x / TILE_SIZE) - 1);
        const sy = Math.max(0, Math.floor(this.camera.y / TILE_SIZE) - 1);
        const ex = Math.min(MAP_WIDTH, Math.ceil((this.camera.x + canvas.width) / TILE_SIZE) + 1);
        const ey = Math.min(MAP_HEIGHT, Math.ceil((this.camera.y + canvas.height) / TILE_SIZE) + 1);
        const t = Date.now() / 1000;

        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                if (!this.isWaterTile(x, y)) continue;
                const wx = x * TILE_SIZE, wy = y * TILE_SIZE;
                EnhancedTerrain.drawWaterTile(ctx, wx, wy, x, y, t);
            }
        }
    };

    // Патч рендера земли (первые строки render())
    const _origRender = Game.prototype.render;
    Game.prototype.render = function() {
        EnhancedTerrain.drawGroundLayer(ctx, this.camera, this.fogOfWar);

        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);

        const viewLeft = this.camera.x - 100;
        const viewRight = this.camera.x + canvas.width + 100;
        const viewTop = this.camera.y - 100;
        const viewBottom = this.camera.y + canvas.height + 100;

        this.renderWater();

        // Ресурсы
        for (let i = 0; i < this.resources.length; i++) {
            const r = this.resources[i];
            if (r.x < viewLeft || r.x > viewRight || r.y < viewTop || r.y > viewBottom) continue;
            const tx = Math.floor(r.x / TILE_SIZE), ty = Math.floor(r.y / TILE_SIZE);
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT && this.fogOfWar[ty][tx].visible)
                r.render(ctx, this.camera);
        }

        // Данжи
        for (let i = 0; i < this.dungeons.length; i++) {
            const d = this.dungeons[i];
            if (d.x < viewLeft || d.x > viewRight || d.y < viewTop || d.y > viewBottom) continue;
            const tx = Math.floor(d.x / TILE_SIZE), ty = Math.floor(d.y / TILE_SIZE);
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT && this.fogOfWar[ty][tx].visible)
                EnhancedDungeon.render(ctx, d);
        }

        // Здания
        for (let i = 0; i < this.buildings.length; i++) {
            const b = this.buildings[i];
            if (b.isRelocating) continue;
            if (b.x < viewLeft || b.x > viewRight || b.y < viewTop || b.y > viewBottom) continue;
            const tx = Math.floor(b.x / TILE_SIZE), ty = Math.floor(b.y / TILE_SIZE);
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT && (this.fogOfWar[ty][tx].visible || b.team === PLAYER)) {
                const factionColor = b.team !== PLAYER ? this.factions.find(f => f.teamId === b.team)?.color : undefined;
                b.render(ctx, factionColor, this.camera);
            }
        }

        // Радиус башни
        if (this.activeMenuBuilding && this.activeMenuBuilding.type === 'archertower') {
            const tower = this.activeMenuBuilding;
            const level = tower.level || 1;
            const range = ARCHER_TOWER_LEVELS[level].range;
            const centerX = tower.x + tower.width / 2;
            const centerY = tower.y + tower.height / 2;
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(centerX, centerY, range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Стройки
        for (let i = 0; i < this.constructionSites.length; i++) {
            const site = this.constructionSites[i];
            if (site.x < viewLeft || site.x > viewRight || site.y < viewTop || site.y > viewBottom) continue;
            const tx = Math.floor(site.x / TILE_SIZE), ty = Math.floor(site.y / TILE_SIZE);
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT && (this.fogOfWar[ty][tx].visible || site.team === PLAYER))
                site.render(ctx);
        }

        // Юниты
        for (let i = 0; i < this.entities.length; i++) {
            const e = this.entities[i];
            if (e.x < viewLeft || e.x > viewRight || e.y < viewTop || e.y > viewBottom) continue;
            const tx = Math.floor(e.x / TILE_SIZE), ty = Math.floor(e.y / TILE_SIZE);
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT && (this.fogOfWar[ty][tx].visible || e.team === PLAYER)) {
                const factionColor = e.team !== PLAYER && e.team !== MOB ? this.factions.find(f => f.teamId === e.team)?.color : undefined;
                e.render(ctx, this.selectedUnits.includes(e), factionColor);
            }
        }

        // Частицы
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].render(ctx, this.camera.x, this.camera.y);
        }

        this.renderDayNightOverlay();
        this.weatherSystem.render(ctx);
        this.renderFogOfWar();

        if (this.selectionBox) {
            const box = this.normalizeBox(this.selectionBox);
            ctx.strokeStyle = 'rgba(0,255,0,0.8)'; ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.w, box.h);
            ctx.fillStyle = 'rgba(0,255,0,0.1)'; ctx.fillRect(box.x, box.y, box.w, box.h);
        }

        if (this.buildMode && this.buildingType) {
            const mx = this.mouse.worldX, my = this.mouse.worldY;
            const bounds = this.getPlacementBounds(mx, my, this.buildingType);
            const canPlace = this.canPlaceBuilding(mx, my, this.buildingType, this.relocationContext?.building);
            ctx.fillStyle = canPlace.valid ? 'rgba(76,175,80,0.4)' : 'rgba(244,67,54,0.4)';
            ctx.strokeStyle = canPlace.valid ? 'rgba(76,175,80,0.8)' : 'rgba(244,67,54,0.8)';
            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.lineWidth = 3;
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.fillStyle = '#fff'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
            ctx.fillText(getBuildingDisplayName(this.buildingType), bounds.x + bounds.width / 2, bounds.y - 10);
            if (!canPlace.valid) {
                ctx.fillStyle = '#ff5252'; ctx.font = '14px Arial';
                ctx.fillText(this.getPlacementErrorMessage(canPlace.reason), bounds.x + bounds.width / 2, bounds.y + bounds.height + 20);
            }
        }

        ctx.restore();
    };

    console.log('[EnhancedGraphics v3] Game render patched.');
})();

// ═══════════════════════════════════════════════════════════════════════════
//  TERRAIN
// ═══════════════════════════════════════════════════════════════════════════

const EnhancedTerrain = {
    // Земля: многослойная процедурная текстура
    drawGroundLayer(ctx, camera, fogOfWar) {
        const TILE = TILE_SIZE;
        const sx = Math.max(0, Math.floor(camera.x / TILE) - 1);
        const sy = Math.max(0, Math.floor(camera.y / TILE) - 1);
        const ex = Math.min(MAP_WIDTH, Math.ceil((camera.x + canvas.width) / TILE) + 2);
        const ey = Math.min(MAP_HEIGHT, Math.ceil((camera.y + canvas.height) / TILE) + 2);

        for (let ty = sy; ty < ey; ty++) {
            for (let tx = sx; tx < ex; tx++) {
                const wx = tx * TILE - camera.x;
                const wy = ty * TILE - camera.y;

                const fog = fogOfWar[ty]?.[tx];
                const isWater = typeof game !== 'undefined' && game.isWaterTile && game.isWaterTile(tx, ty);
                if (isWater) continue;

                // Базовый цвет земли с шумом
                const n1 = seededRand(tx, ty, 0);
                const n2 = seededRand(tx, ty, 1);
                const n3 = seededRand(tx, ty, 2);

                let r = Math.floor(28 + n1 * 10);
                let g = Math.floor(32 + n2 * 10);
                let b = Math.floor(20 + n3 * 8);

                // Редкие тёмно-зелёные пятна (мох, трава)
                if (n1 > 0.75 && n2 > 0.6) { r -= 4; g += 8; b -= 2; }
                // Тёмные проплешины (грязь)
                if (n1 < 0.12 && n3 < 0.3) { r -= 6; g -= 6; b -= 4; }

                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(wx, wy, TILE + 1, TILE + 1);

                // Детали внутри тайла: камешки, травинки (только если тайл виден)
                if (fog && fog.visible) {
                    this._drawTileDetails(ctx, wx, wy, TILE, tx, ty, n1, n2, n3);
                }
            }
        }
    },

    _drawTileDetails(ctx, wx, wy, TILE, tx, ty, n1, n2, n3) {
        // Мелкий камешек
        if (n1 > 0.85) {
            const px = wx + n2 * (TILE - 6), py = wy + n3 * (TILE - 6);
            ctx.fillStyle = `rgba(60,55,48,${0.5 + n2 * 0.3})`;
            ctx.fillRect(px, py, 3, 2);
        }
        // Маленький камешек 2
        if (n2 > 0.88) {
            const px = wx + seededRand(tx, ty, 3) * (TILE - 4);
            const py = wy + seededRand(tx, ty, 4) * (TILE - 4);
            ctx.fillStyle = `rgba(50,48,42,0.4)`;
            ctx.fillRect(px, py, 2, 2);
        }
        // Травинка
        if (n3 > 0.82 && n1 < 0.7) {
            const px = wx + seededRand(tx, ty, 5) * (TILE - 3);
            const py = wy + seededRand(tx, ty, 6) * (TILE - 5);
            ctx.fillStyle = `rgba(42,56,22,0.6)`;
            ctx.fillRect(px, py, 1, 4);
            ctx.fillRect(px + 2, py + 1, 1, 3);
        }
        // Трещина
        if (n1 < 0.05 && n2 > 0.5) {
            ctx.strokeStyle = `rgba(15,12,8,0.25)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(wx + n3 * TILE, wy + seededRand(tx, ty, 7) * TILE);
            ctx.lineTo(wx + seededRand(tx, ty, 8) * TILE, wy + seededRand(tx, ty, 9) * TILE);
            ctx.stroke();
        }
    },

    // Вода с анимированными бликами
    drawWaterTile(ctx, wx, wy, tx, ty, t) {
        const TILE = TILE_SIZE;

        // Базовый цвет воды
        const depth = seededRand(tx, ty, 10);
        const r = Math.floor(28 + depth * 15);
        const g = Math.floor(85 + depth * 25);
        const b = Math.floor(140 + depth * 30);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(wx, wy, TILE, TILE);

        // Анимированные рябь-полосы
        const wave1 = Math.sin(t * 1.1 + tx * 0.4 + ty * 0.3) * 0.5 + 0.5;
        const wave2 = Math.sin(t * 0.7 + tx * 0.3 - ty * 0.4 + 1.5) * 0.5 + 0.5;

        ctx.fillStyle = `rgba(255,255,255,${0.04 + wave1 * 0.06})`;
        ctx.fillRect(wx, wy + wave1 * (TILE * 0.5), TILE, TILE * 0.15);

        ctx.fillStyle = `rgba(255,255,255,${0.03 + wave2 * 0.04})`;
        ctx.fillRect(wx, wy + TILE * 0.35 + wave2 * (TILE * 0.3), TILE, TILE * 0.1);

        // Пена у краёв
        const edgeAlpha = seededRand(tx, ty, 11) * 0.15;
        if (edgeAlpha > 0.05) {
            ctx.fillStyle = `rgba(200,230,255,${edgeAlpha})`;
            ctx.fillRect(wx, wy, TILE, 3);
            ctx.fillRect(wx, wy + TILE - 3, TILE, 3);
        }

        // Блик солнца (медленно движется)
        const shineX = ((Math.sin(t * 0.2 + tx * 0.1) * 0.5 + 0.5)) * TILE;
        const shineY = ((Math.cos(t * 0.15 + ty * 0.1) * 0.5 + 0.5)) * TILE;
        ctx.fillStyle = `rgba(255,255,255,${0.06 + wave1 * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(wx + shineX, wy + shineY, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  УЛУЧШЕННЫЙ ДАНЖ
// ═══════════════════════════════════════════════════════════════════════════

const EnhancedDungeon = {
    render(ctx, dungeon) {
        const x = dungeon.x, y = dungeon.y, s = dungeon.size;
        const hx = x - s / 2, hy = y - s / 2;
        const t = Date.now() / 1000;

        if (dungeon.explored) {
            // Исследованный — серые разрушенные руины
            ctx.fillStyle = '#3A3633';
            ctx.fillRect(hx, hy, s, s);
            ctx.fillStyle = '#4A4542';
            ctx.fillRect(hx + 4, hy + 4, s - 8, s - 8);

            // Трещины
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx + s * 0.2, hy + s * 0.1);
            ctx.lineTo(hx + s * 0.4, hy + s * 0.6);
            ctx.lineTo(hx + s * 0.3, hy + s * 0.9);
            ctx.stroke();

            ctx.fillStyle = '#888';
            ctx.font = '28px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', x, y);

            if (dungeon.respawnTimer > 0) {
                const timeLeft = Math.ceil((dungeon.respawnDelay - dungeon.respawnTimer) / 1000);
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 13px monospace';
                ctx.fillText(`${timeLeft}s`, x, y + 38);
            }
            return;
        }

        // ── Неисследованный данж ──

        // Тень под строением
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(x + 4, y + s / 2 - 2, s * 0.55, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Основной камень (тёмный каменный периметр)
        ctx.fillStyle = '#1E1915';
        ctx.fillRect(hx, hy, s, s);

        // Каменная кладка (процедурная)
        const brickW = 16, brickH = 10;
        for (let row = 0; row < Math.ceil(s / brickH); row++) {
            for (let col = 0; col < Math.ceil(s / brickW); col++) {
                const offset = row % 2 === 0 ? 0 : brickW / 2;
                const bx = hx + col * brickW - offset;
                const by = hy + row * brickH;
                if (bx + brickW < hx || bx > hx + s || by > hy + s) continue;
                const bn = seededRand(col + row * 100, row, 20);
                const shade = Math.floor(35 + bn * 20);
                ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
                ctx.fillRect(bx + 1, by + 1, brickW - 2, brickH - 2);
            }
        }

        // Внутренний двор (темная бездна)
        const inner = s * 0.35;
        ctx.fillStyle = '#0A0807';
        ctx.fillRect(x - inner, y - inner, inner * 2, inner * 2);
        // Блик у врат
        ctx.fillStyle = 'rgba(30,20,15,0.8)';
        ctx.fillRect(x - inner + 2, y - inner + 2, inner * 2 - 4, 4);

        // Угловые башни
        const towerSize = 18;
        const corners = [
            [hx, hy], [hx + s - towerSize, hy],
            [hx, hy + s - towerSize], [hx + s - towerSize, hy + s - towerSize]
        ];
        for (const [cx, cy] of corners) {
            ctx.fillStyle = '#16120F';
            ctx.fillRect(cx, cy, towerSize, towerSize);
            ctx.fillStyle = '#2A2520';
            ctx.fillRect(cx + 2, cy + 2, towerSize - 4, towerSize - 4);
            // Зубцы на башнях
            ctx.fillStyle = '#16120F';
            for (let zi = 0; zi < 3; zi++) {
                ctx.fillRect(cx + 2 + zi * 5, cy - 4, 4, 5);
            }
            // Амбразура
            ctx.fillStyle = '#050403';
            ctx.fillRect(cx + 6, cy + 5, 4, 8);
        }

        // Ворота (центральный вход)
        ctx.fillStyle = '#050403';
        ctx.beginPath();
        ctx.moveTo(x - 12, hy + s);
        ctx.lineTo(x - 12, hy + s * 0.55);
        ctx.quadraticCurveTo(x, hy + s * 0.45, x + 12, hy + s * 0.55);
        ctx.lineTo(x + 12, hy + s);
        ctx.fill();

        // Цепи у ворот
        ctx.strokeStyle = '#3A3530';
        ctx.lineWidth = 2;
        for (let ci = 0; ci < 3; ci++) {
            ctx.beginPath();
            ctx.moveTo(x - 10 + ci * 9, hy + s * 0.58);
            ctx.lineTo(x - 8 + ci * 9, hy + s * 0.78);
            ctx.stroke();
        }

        // Флаг на башне (развевается)
        const flagWave = Math.sin(t * 2.5) * 3;
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.moveTo(hx + 4, hy - 2);
        ctx.lineTo(hx + 4, hy - 18);
        ctx.stroke();
        ctx.fillStyle = '#CC1100';
        ctx.beginPath();
        ctx.moveTo(hx + 5, hy - 18);
        ctx.lineTo(hx + 18 + flagWave, hy - 14 + flagWave * 0.5);
        ctx.lineTo(hx + 5, hy - 10);
        ctx.fill();

        // Скелеты / черепа у входа (декор)
        ctx.fillStyle = '#7A7268';
        ctx.beginPath();
        ctx.arc(x - 18, hy + s - 8, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#050403';
        ctx.fillRect(x - 20, hy + s - 8, 2, 2);
        ctx.fillRect(x - 16, hy + s - 8, 2, 2);

        // Артефактное золотое свечение
        if (dungeon.hasArtifact) {
            const pulse = Math.sin(t * 2.2) * 0.4 + 0.6;
            ctx.strokeStyle = `rgba(255, 200, 40, ${pulse * 0.7})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(hx - 4, hy - 4, s + 8, s + 8);
            ctx.strokeStyle = `rgba(255, 230, 100, ${pulse * 0.3})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(hx - 8, hy - 8, s + 16, s + 16);

            // Малые золотые искры по углам
            for (let si = 0; si < 4; si++) {
                const sa = (t * 1.5 + si * Math.PI / 2) % (Math.PI * 2);
                const sr = s * 0.55 + Math.sin(t * 3 + si) * 4;
                ctx.fillStyle = `rgba(255,210,50,${0.4 + pulse * 0.4})`;
                ctx.beginPath();
                ctx.arc(x + Math.cos(sa) * sr, y + Math.sin(sa) * sr, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Зона охраны
        ctx.strokeStyle = 'rgba(200, 40, 40, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, dungeon.guardRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Название — мрачный шрифт
        ctx.fillStyle = 'rgba(200,180,140,0.8)';
        ctx.font = 'bold 11px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('РУИНЫ', x, hy - 12);
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ПАТЧ РЕСУРСОВ — деревья, камни, рыба
// ═══════════════════════════════════════════════════════════════════════════

(function patchResources() {
    if (typeof Resource === 'undefined') { setTimeout(patchResources, 300); return; }

    Resource.prototype.render = function(ctx) {
        if (this.depleted) return;
        const x = this.x, y = this.y;
        const size = 14 * (this.size || 1);

        if (this.type === 'wood') {
            EnhancedResources.drawTree(ctx, x, y, size, this.variant, this);
        } else if (this.type === 'stone') {
            EnhancedResources.drawRock(ctx, x, y, size, this.variant, this);
        } else if (this.type === 'food') {
            EnhancedResources.drawFish(ctx, x, y, size, this.variant, this);
        }

        if (this.amount < this.maxAmount && !this.depleted) {
            const pct = this.amount / this.maxAmount;
            const bw = 28, bh = 4;
            ctx.fillStyle = '#111';
            ctx.fillRect(x - bw / 2, y + size + 4, bw, bh);
            ctx.fillStyle = pct > 0.5 ? '#4A7C20' : pct > 0.25 ? '#8B6000' : '#7A1010';
            ctx.fillRect(x - bw / 2, y + size + 4, bw * pct, bh);
        }
    };

    console.log('[EnhancedGraphics v3] Resources patched.');
})();

const EnhancedResources = {
    drawTree(ctx, x, y, size, variant, res) {
        const t = Date.now() / 1000;
        const sway = Math.sin(t * 1.3 + x * 0.01) * 1.5;
        const pct = res ? res.amount / res.maxAmount : 1;
        const isOak = variant?.key === 'oak';
        const isPine = variant?.key === 'pine';

        // Корни / земля
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.9, size * 0.55, size * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ствол
        const trunkH = size * (isPine ? 1.4 : 1.1);
        const trunkW = size * (isOak ? 0.28 : 0.22);
        ctx.fillStyle = '#2A1C12';
        ctx.fillRect(x - trunkW / 2, y - trunkH * 0.2, trunkW, trunkH);

        // Кора — полосы
        ctx.fillStyle = '#1C1208';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(x - trunkW / 2, y - trunkH * 0.2 + i * trunkH * 0.3, trunkW, trunkH * 0.08);
        }
        // Яркое ребро
        ctx.fillStyle = 'rgba(80,50,25,0.4)';
        ctx.fillRect(x + trunkW * 0.1, y - trunkH * 0.2, trunkW * 0.2, trunkH);

        // Крона (многоярусная)
        const leafBase = pct > 0.3 ? '#1A3010' : '#3A2808';
        const leafMid = pct > 0.3 ? '#253D14' : '#4A3210';
        const leafTop = pct > 0.3 ? '#2E4C1A' : '#5A3C14';

        if (isPine) {
            // Ёлка — конические ярусы
            for (let tier = 0; tier < 4; tier++) {
                const tw = size * (0.8 - tier * 0.15);
                const ty2 = y - trunkH * 0.1 - tier * size * 0.35 + sway * (tier * 0.3);
                ctx.fillStyle = tier % 2 === 0 ? leafBase : leafMid;
                ctx.beginPath();
                ctx.moveTo(x + sway * tier * 0.2, ty2 - size * 0.4);
                ctx.lineTo(x - tw + sway * tier * 0.1, ty2 + size * 0.15);
                ctx.lineTo(x + tw + sway * tier * 0.1, ty2 + size * 0.15);
                ctx.closePath();
                ctx.fill();
            }
        } else if (isOak) {
            // Дуб — широкая пышная крона
            const cx = x + sway * 0.4, cy = y - trunkH * 0.1;
            ctx.fillStyle = leafBase;
            ctx.beginPath();
            ctx.ellipse(cx, cy, size * 0.95, size * 0.75, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = leafMid;
            ctx.beginPath();
            ctx.ellipse(cx - size * 0.3 + sway * 0.5, cy - size * 0.2, size * 0.6, size * 0.55, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + size * 0.3 + sway * 0.3, cy - size * 0.15, size * 0.55, size * 0.5, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = leafTop;
            ctx.beginPath();
            ctx.ellipse(cx + sway * 0.2, cy - size * 0.45, size * 0.45, size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Берёза — стройная крона
            const cx = x + sway * 0.5, cy = y - trunkH * 0.1;
            ctx.fillStyle = leafBase;
            ctx.beginPath();
            ctx.moveTo(cx, cy - size * 0.85);
            ctx.lineTo(cx - size * 0.55, cy - size * 0.25);
            ctx.lineTo(cx - size * 0.75, cy + size * 0.1);
            ctx.lineTo(cx + size * 0.75, cy + size * 0.1);
            ctx.lineTo(cx + size * 0.55, cy - size * 0.25);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = leafMid;
            ctx.beginPath();
            ctx.moveTo(cx, cy - size * 1.05);
            ctx.lineTo(cx - size * 0.35, cy - size * 0.45);
            ctx.lineTo(cx + size * 0.35, cy - size * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = leafTop;
            ctx.beginPath();
            ctx.moveTo(cx, cy - size * 1.2);
            ctx.lineTo(cx - size * 0.18, cy - size * 0.85);
            ctx.lineTo(cx + size * 0.18, cy - size * 0.85);
            ctx.closePath();
            ctx.fill();
        }

        // Блики на листве
        ctx.fillStyle = 'rgba(120,160,60,0.12)';
        ctx.beginPath();
        ctx.ellipse(x - size * 0.2 + sway * 0.2, y - trunkH * 0.3, size * 0.25, size * 0.15, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // Стружки при рубке (если повреждено)
        if (pct < 0.7 && pct > 0) {
            ctx.fillStyle = '#5C3A18';
            ctx.fillRect(x + size * 0.1, y + size * 0.2, 4, 2);
            ctx.fillRect(x - size * 0.2, y + size * 0.35, 3, 2);
            // Рубка — диагональная зарубка
            ctx.strokeStyle = '#1A0E08';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - trunkW / 2, y + size * 0.3);
            ctx.lineTo(x + trunkW / 2, y + size * 0.45);
            ctx.stroke();
        }
    },

    drawRock(ctx, x, y, size, variant, res) {
        const pct = res ? res.amount / res.maxAmount : 1;
        const isGranite = variant?.key === 'granite';
        const isBasalt = variant?.key === 'basalt';

        const mainColor = isBasalt ? '#484850' : isGranite ? '#5A585C' : '#686460';
        const darkColor = isBasalt ? '#282830' : isGranite ? '#3A383E' : '#484440';
        const lightColor = isBasalt ? '#686878' : isGranite ? '#807880' : '#908880';

        // Тень
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(x + 3, y + size * 0.85, size * 0.75, size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Основной валун (угловатый)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.7, y + size * 0.6);
        ctx.lineTo(x - size * 0.85, y - size * 0.1);
        ctx.lineTo(x - size * 0.3, y - size * 0.85);
        ctx.lineTo(x + size * 0.45, y - size * 0.75);
        ctx.lineTo(x + size * 0.9, y + size * 0.1);
        ctx.lineTo(x + size * 0.65, y + size * 0.6);
        ctx.closePath();
        ctx.fill();

        // Грани (тёмная боковая)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(x + size * 0.45, y - size * 0.75);
        ctx.lineTo(x + size * 0.9, y + size * 0.1);
        ctx.lineTo(x + size * 0.65, y + size * 0.6);
        ctx.lineTo(x + size * 0.1, y + size * 0.55);
        ctx.lineTo(x + size * 0.2, y - size * 0.3);
        ctx.closePath();
        ctx.fill();

        // Светлая грань (верхняя)
        ctx.fillStyle = lightColor;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.85, y - size * 0.1);
        ctx.lineTo(x - size * 0.3, y - size * 0.85);
        ctx.lineTo(x + size * 0.45, y - size * 0.75);
        ctx.lineTo(x + size * 0.2, y - size * 0.3);
        ctx.lineTo(x - size * 0.35, y - size * 0.15);
        ctx.closePath();
        ctx.fill();

        // Кристаллы гранита
        if (isGranite) {
            ctx.fillStyle = '#A090A0';
            for (let i = 0; i < 4; i++) {
                const rx = x - size * 0.3 + seededRand(i, 0, 30) * size * 0.6;
                const ry = y - size * 0.6 + seededRand(i, 1, 30) * size * 0.4;
                ctx.fillRect(rx, ry, 2, 3);
            }
        }

        // Базальт — прожилки
        if (isBasalt) {
            ctx.strokeStyle = 'rgba(20,20,28,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.4, y - size * 0.5);
            ctx.lineTo(x + size * 0.2, y + size * 0.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y - size * 0.7);
            ctx.lineTo(x + size * 0.3, y);
            ctx.stroke();
        }

        // Трещины при повреждении
        if (pct < 0.6) {
            ctx.strokeStyle = `rgba(20,15,10,${0.6 + (1 - pct) * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.1, y - size * 0.5);
            ctx.lineTo(x + size * 0.3, y + size * 0.1);
            ctx.lineTo(x + size * 0.1, y + size * 0.4);
            ctx.stroke();
        }
        if (pct < 0.3) {
            ctx.strokeStyle = 'rgba(20,15,10,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.5, y);
            ctx.lineTo(x + size * 0.2, y + size * 0.3);
            ctx.stroke();
            // Откол
            ctx.fillStyle = darkColor;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.85, y - size * 0.1);
            ctx.lineTo(x - size * 0.7, y + size * 0.1);
            ctx.lineTo(x - size * 0.55, y - size * 0.05);
            ctx.closePath();
            ctx.fill();
        }
    },

    drawFish(ctx, x, y, size, variant, res) {
        const t = Date.now() / 1000;
        const isLake = variant?.key === 'lakefish';
        const bobY = Math.sin(t * 1.8 + x * 0.05) * 2;

        // Водоём с кружками ряби
        const poolColor = isLake ? '#1A5C8A' : '#1A6875';
        ctx.fillStyle = poolColor;
        ctx.beginPath();
        ctx.ellipse(x, y + bobY, size * 1.1, size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // Анимированная рябь
        const ripple1 = ((t * 0.5 + x * 0.1) % 1);
        const ripple2 = ((t * 0.5 + 0.5 + x * 0.1) % 1);
        ctx.strokeStyle = `rgba(100,180,220,${(1 - ripple1) * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y + bobY, size * 0.4 + ripple1 * size * 0.7, size * 0.25 + ripple1 * size * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(100,180,220,${(1 - ripple2) * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(x, y + bobY, size * 0.4 + ripple2 * size * 0.7, size * 0.25 + ripple2 * size * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Блик на воде
        ctx.fillStyle = 'rgba(200,240,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(x - size * 0.2, y - size * 0.1 + bobY, size * 0.3, size * 0.12, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Рыбы в воде (2-3 силуэта)
        const fishColor = isLake ? '#2A8AB8' : '#2A9090';
        const fishCount = isLake ? 3 : 2;
        for (let fi = 0; fi < fishCount; fi++) {
            const fa = t * (0.8 + fi * 0.3) + fi * Math.PI * 0.7;
            const fx = x + Math.cos(fa) * size * 0.4;
            const fy = y + Math.sin(fa * 0.7) * size * 0.2 + bobY;
            const fdir = Math.cos(fa) > 0 ? 1 : -1;

            ctx.fillStyle = fishColor;
            ctx.beginPath();
            ctx.ellipse(fx, fy, size * 0.22, size * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            // Хвост
            ctx.beginPath();
            ctx.moveTo(fx - fdir * size * 0.2, fy);
            ctx.lineTo(fx - fdir * size * 0.35, fy - size * 0.12);
            ctx.lineTo(fx - fdir * size * 0.35, fy + size * 0.12);
            ctx.closePath();
            ctx.fill();
            // Глаз
            ctx.fillStyle = '#FF2A2A';
            ctx.beginPath();
            ctx.arc(fx + fdir * size * 0.13, fy - size * 0.02, size * 0.04, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ПАТЧ ЮНИТОВ — воркер, мечник, лучник, моб
// ═══════════════════════════════════════════════════════════════════════════

(function patchUnits() {
    if (typeof Unit === 'undefined') { setTimeout(patchUnits, 300); return; }

    Unit.prototype.renderBrutalWorker = function(ctx, isPlayer, baseColor) {
        EnhancedUnits.drawWorker(ctx, this.x, this.y, isPlayer, baseColor, this);
    };
    Unit.prototype.renderBrutalSwordsman = function(ctx, isPlayer, baseColor) {
        EnhancedUnits.drawSwordsman(ctx, this.x, this.y, isPlayer, baseColor, this);
    };
    Unit.prototype.renderBrutalArcher = function(ctx, isPlayer, baseColor) {
        EnhancedUnits.drawArcher(ctx, this.x, this.y, isPlayer, baseColor, this);
    };
    Unit.prototype.renderBrutalMob = function(ctx) {
        EnhancedUnits.drawMob(ctx, this.x, this.y, this);
    };

    console.log('[EnhancedGraphics v3] Units patched.');
})();

const EnhancedUnits = {
    // ── ТЕНЬ ──────────────────────────────────────────────────────────────
    _shadow(ctx, x, y, w) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(x, y + 14, w * 0.45, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // ── РАБОЧИЙ ───────────────────────────────────────────────────────────
    drawWorker(ctx, x, y, isPlayer, baseColor, unit) {
        this._shadow(ctx, x, y, 14);
        const t = Date.now() / 1000;
        const bob = Math.sin(t * 5 + x * 0.1) * (unit.targetX !== x ? 1 : 0);

        const p = isPlayer
            ? { body: '#1C3A60', shirt: '#2A5090', skin: '#C4956A', hair: '#1A0E08', tool: '#8AA0B0', accent: '#3A7AC8', belt: '#2A1E10' }
            : { body: '#3A2218', shirt: '#4E3022', skin: '#C4956A', hair: '#1A0E08', tool: '#7A6A5A', accent: baseColor || '#CC5A10', belt: '#1A1208' };

        const by = y + bob;

        // Ноги
        ctx.fillStyle = p.body;
        ctx.fillRect(x - 4, by + 6, 4, 9);
        ctx.fillRect(x, by + 6, 4, 9);
        // Ботинки
        ctx.fillStyle = '#1A1008';
        ctx.fillRect(x - 4, by + 13, 5, 3);
        ctx.fillRect(x, by + 13, 5, 3);

        // Тело (туловище)
        ctx.fillStyle = p.shirt;
        ctx.fillRect(x - 6, by - 5, 12, 12);

        // Ремень
        ctx.fillStyle = p.belt;
        ctx.fillRect(x - 6, by + 3, 12, 2);

        // Нашивка фракции на плече
        ctx.fillStyle = p.accent;
        ctx.fillRect(x - 6, by - 5, 12, 3);

        // Руки
        ctx.fillStyle = p.skin;
        ctx.fillRect(x - 9, by - 3, 4, 8);
        ctx.fillRect(x + 5, by - 3, 4, 8);

        // Голова
        ctx.fillStyle = p.skin;
        ctx.fillRect(x - 5, by - 13, 10, 9);
        // Волосы / шапка
        ctx.fillStyle = p.hair;
        ctx.fillRect(x - 5, by - 13, 10, 3);
        if (isPlayer) {
            ctx.fillStyle = '#1A3565';
            ctx.fillRect(x - 6, by - 14, 12, 3); // Кепка
            ctx.fillRect(x - 7, by - 12, 2, 2);
            ctx.fillRect(x + 5, by - 12, 2, 2);
        }
        // Глаза
        ctx.fillStyle = '#1A1210';
        ctx.fillRect(x - 3, by - 9, 2, 2);
        ctx.fillRect(x + 1, by - 9, 2, 2);
        // Блик на глазах
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x - 2, by - 9, 1, 1);
        ctx.fillRect(x + 2, by - 9, 1, 1);

        // Инструмент
        ctx.fillStyle = p.tool;
        if (unit.profession === 'lumberjack') {
            // Топор
            ctx.fillStyle = '#8B5A2B'; ctx.fillRect(x + 7, by + 2, 2, 9);
            ctx.fillStyle = p.tool; ctx.fillRect(x + 5, by + 1, 5, 4);
            ctx.fillRect(x + 7, by, 2, 5);
        } else if (unit.profession === 'miner') {
            // Кирка
            ctx.fillStyle = '#8B5A2B'; ctx.fillRect(x + 7, by + 2, 2, 9);
            ctx.fillStyle = p.tool;
            ctx.fillRect(x + 3, by + 3, 8, 2);
            ctx.fillRect(x + 3, by + 1, 3, 3);
        } else if (unit.profession === 'fisher') {
            // Удочка
            ctx.strokeStyle = '#8B5A2B'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x + 7, by + 5); ctx.lineTo(x + 14, by - 5); ctx.stroke();
            ctx.strokeStyle = 'rgba(180,200,220,0.7)'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(x + 14, by - 5); ctx.lineTo(x + 16, by + 3); ctx.stroke();
        } else {
            // Молоток
            ctx.fillStyle = '#8B5A2B'; ctx.fillRect(x + 7, by + 2, 2, 9);
            ctx.fillStyle = '#808080'; ctx.fillRect(x + 5, by + 1, 5, 4);
        }

        // Груз на спине
        if (unit.carrying) {
            ctx.fillStyle = '#8B6030';
            ctx.fillRect(x - 7, by - 8, 4, 12);
            ctx.fillStyle = '#6B4820';
            ctx.fillRect(x - 7, by - 8, 4, 3);
        }
    },

    // ── МЕЧНИК ────────────────────────────────────────────────────────────
    drawSwordsman(ctx, x, y, isPlayer, baseColor, unit) {
        this._shadow(ctx, x, y, 16);
        const t = Date.now() / 1000;
        const bob = Math.sin(t * 5 + x * 0.1) * (unit.targetX !== x ? 1.2 : 0);
        const inCombat = unit.target && unit.target.health > 0;
        const attackSwing = inCombat ? Math.sin(t * 8) * 4 : 0;

        const p = isPlayer
            ? { plate: '#1A2A3E', dark: '#0D1625', edge: '#2A4A70', accent: '#2A60A0', eyes: '#4A90D0', shield: '#1C3460', blade: '#B8C8D8', gold: '#B09040' }
            : { plate: '#2E1515', dark: '#160808', edge: '#4A1818', accent: baseColor || '#C84010', eyes: '#D03010', shield: '#3A1010', blade: '#8A9090', gold: '#7A6030' };

        const by = y + bob;

        // Ноги в латах
        ctx.fillStyle = p.dark;
        ctx.fillRect(x - 5, by + 5, 5, 10);
        ctx.fillRect(x, by + 5, 5, 10);
        ctx.fillStyle = p.plate;
        ctx.fillRect(x - 5, by + 5, 4, 5);
        ctx.fillRect(x, by + 5, 4, 5);
        // Сапоги
        ctx.fillStyle = '#0A0808';
        ctx.fillRect(x - 5, by + 13, 6, 4);
        ctx.fillRect(x, by + 13, 6, 4);

        // Тело (кираса)
        ctx.fillStyle = p.plate;
        ctx.fillRect(x - 7, by - 6, 14, 12);
        // Ребра кирасы
        ctx.fillStyle = p.edge;
        ctx.fillRect(x - 7, by - 6, 2, 12); // Левый бок
        ctx.fillRect(x + 5, by - 6, 2, 12); // Правый бок
        ctx.fillRect(x - 7, by - 6, 14, 2); // Горжет
        // Центральный киль
        ctx.fillStyle = p.gold;
        ctx.fillRect(x - 1, by - 4, 2, 8);

        // Наплечники
        ctx.fillStyle = p.dark;
        ctx.fillRect(x - 10, by - 5, 5, 6);
        ctx.fillRect(x + 5, by - 5, 5, 6);
        ctx.fillStyle = p.edge;
        ctx.fillRect(x - 10, by - 5, 5, 2);
        ctx.fillRect(x + 5, by - 5, 5, 2);

        // Шлем
        ctx.fillStyle = p.plate;
        ctx.fillRect(x - 6, by - 14, 12, 10);
        // Забрало (тёмное)
        ctx.fillStyle = p.dark;
        ctx.fillRect(x - 5, by - 12, 10, 6);
        // Глаза (светятся)
        ctx.fillStyle = p.eyes;
        ctx.shadowColor = p.eyes;
        ctx.shadowBlur = 6;
        ctx.fillRect(x - 4, by - 10, 3, 3);
        ctx.fillRect(x + 1, by - 10, 3, 3);
        ctx.shadowBlur = 0;
        // Гребень шлема
        ctx.fillStyle = p.accent;
        ctx.fillRect(x - 1, by - 17, 2, 5);

        // Меч (с замахом при атаке)
        const swordX = x + 9 + attackSwing;
        ctx.fillStyle = p.blade;
        ctx.fillRect(swordX - 1, by - 6, 2, 16);
        // Гарда
        ctx.fillStyle = p.gold;
        ctx.fillRect(swordX - 4, by - 4, 8, 2);
        // Рукоять
        ctx.fillStyle = '#3A2A1A';
        ctx.fillRect(swordX - 1, by + 10, 2, 5);
        // Блик на клинке
        ctx.fillStyle = 'rgba(220,240,255,0.5)';
        ctx.fillRect(swordX, by - 6, 1, 14);

        // Щит
        ctx.fillStyle = p.shield;
        ctx.beginPath();
        ctx.moveTo(x - 13, by - 6);
        ctx.lineTo(x - 9, by - 10);
        ctx.lineTo(x - 7, by - 3);
        ctx.lineTo(x - 9, by + 7);
        ctx.lineTo(x - 13, by + 4);
        ctx.closePath();
        ctx.fill();
        // Герб на щите
        ctx.fillStyle = p.accent;
        ctx.fillRect(x - 11, by - 3, 3, 6);
        ctx.fillRect(x - 12, by - 1, 5, 2);

        // Метка команды (перо на шлеме у врагов)
        if (!isPlayer && baseColor) {
            ctx.fillStyle = baseColor;
            ctx.fillRect(x - 1, by - 19, 2, 5);
        }
    },

    // ── ЛУЧНИК ────────────────────────────────────────────────────────────
    drawArcher(ctx, x, y, isPlayer, baseColor, unit) {
        this._shadow(ctx, x, y, 14);
        const t = Date.now() / 1000;
        const bob = Math.sin(t * 5 + x * 0.1) * (unit.targetX !== x ? 1 : 0);
        const aiming = unit.target && unit.target.health > 0;

        const p = isPlayer
            ? { leather: '#1E3040', dark: '#111C24', skin: '#C4956A', bow: '#5A3A20', string: '#A09080', quiver: '#2A3A28', arrow: '#7A5A30', eyes: '#4A90D0', hood: '#162030' }
            : { leather: '#2A2A1A', dark: '#141410', skin: '#C4956A', bow: '#4A3018', string: '#807060', quiver: '#1A2018', arrow: '#5A4020', eyes: '#D05010', hood: '#181810' };

        const by = y + bob;

        // Ноги
        ctx.fillStyle = p.dark;
        ctx.fillRect(x - 4, by + 5, 4, 10);
        ctx.fillRect(x, by + 5, 4, 10);
        ctx.fillStyle = '#1A1008';
        ctx.fillRect(x - 4, by + 13, 5, 3);
        ctx.fillRect(x, by + 13, 5, 3);

        // Тело (кожаный доспех)
        ctx.fillStyle = p.leather;
        ctx.fillRect(x - 6, by - 5, 12, 11);
        // Пластины
        ctx.fillStyle = p.dark;
        ctx.fillRect(x - 6, by - 5, 2, 11);
        ctx.fillRect(x + 4, by - 5, 2, 11);
        // Полоска фракции
        ctx.fillStyle = isPlayer ? '#2A5080' : (baseColor || '#A04010');
        ctx.fillRect(x - 6, by - 5, 12, 2);

        // Руки
        ctx.fillStyle = p.skin;
        ctx.fillRect(x - 8, by - 3, 3, 7);
        ctx.fillRect(x + 5, by - 3, 3, 7);
        // Перчатки
        ctx.fillStyle = p.dark;
        ctx.fillRect(x - 8, by + 2, 3, 3);
        ctx.fillRect(x + 5, by + 2, 3, 3);

        // Капюшон
        ctx.fillStyle = p.hood;
        ctx.beginPath();
        ctx.moveTo(x, by - 16);
        ctx.lineTo(x - 7, by - 4);
        ctx.lineTo(x + 7, by - 4);
        ctx.closePath();
        ctx.fill();
        // Лицо в тени капюшона
        ctx.fillStyle = p.skin;
        ctx.fillRect(x - 4, by - 12, 8, 7);
        ctx.fillStyle = p.hood;
        ctx.fillRect(x - 4, by - 12, 8, 2);
        // Глаза
        ctx.fillStyle = p.eyes;
        ctx.shadowColor = p.eyes;
        ctx.shadowBlur = 4;
        ctx.fillRect(x - 3, by - 9, 2, 2);
        ctx.fillRect(x + 1, by - 9, 2, 2);
        ctx.shadowBlur = 0;

        // Лук
        const bowX = aiming ? x - 10 : x - 9;
        ctx.strokeStyle = p.bow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bowX, by, 10, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.stroke();
        // Рукоять лука
        ctx.fillStyle = p.bow;
        ctx.fillRect(bowX - 2, by - 2, 3, 4);
        // Тетива
        ctx.strokeStyle = p.string;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bowX, by - 10);
        if (aiming) {
            ctx.lineTo(bowX + 5, by); // Натянута
        }
        ctx.lineTo(bowX, by + 10);
        ctx.stroke();
        // Стрела
        if (aiming) {
            ctx.fillStyle = p.arrow;
            ctx.fillRect(bowX + 1, by - 1, 10, 2);
            ctx.fillStyle = '#B0B0B0';
            ctx.beginPath();
            ctx.moveTo(bowX + 11, by);
            ctx.lineTo(bowX + 8, by - 3);
            ctx.lineTo(bowX + 8, by + 3);
            ctx.fill();
        }

        // Колчан со стрелами
        ctx.fillStyle = p.quiver;
        ctx.fillRect(x + 5, by - 4, 5, 12);
        ctx.fillStyle = p.arrow;
        for (let ai = 0; ai < 3; ai++) {
            ctx.fillRect(x + 6 + ai, by - 8, 1, 6);
        }

        if (!isPlayer && baseColor) {
            ctx.fillStyle = baseColor;
            ctx.fillRect(x - 6, by + 4, 12, 2);
        }
    },

    // ── МОБ ───────────────────────────────────────────────────────────────
    drawMob(ctx, x, y, unit) {
        this._shadow(ctx, x, y, 16);
        const t = Date.now() / 1000;
        const lurch = Math.sin(t * 3 + x * 0.1) * 2;
        const by = y + lurch;

        // Гниющие ноги
        ctx.fillStyle = '#1A0C0C';
        ctx.fillRect(x - 5, by + 5, 4, 11);
        ctx.fillRect(x + 1, by + 5, 4, 11);
        // Кости ног
        ctx.fillStyle = '#6A6055';
        ctx.fillRect(x - 4, by + 8, 2, 4);
        ctx.fillRect(x + 2, by + 9, 2, 3);
        // Когти
        ctx.fillStyle = '#4A3828';
        ctx.fillRect(x - 5, by + 14, 3, 3);
        ctx.fillRect(x - 4, by + 16, 2, 2);
        ctx.fillRect(x + 2, by + 14, 3, 3);

        // Тело (гниющая плоть)
        ctx.fillStyle = '#1C0E0E';
        ctx.fillRect(x - 7, by - 6, 14, 12);
        // Гнилые пятна
        ctx.fillStyle = '#2E1510';
        ctx.fillRect(x - 3, by - 2, 5, 5);
        ctx.fillRect(x + 2, by - 6, 3, 4);
        ctx.fillStyle = '#0A0808';
        ctx.fillRect(x - 6, by, 4, 4);

        // Кости / шипы на плечах
        ctx.fillStyle = '#7A7060';
        ctx.beginPath();
        ctx.moveTo(x - 9, by - 5);
        ctx.lineTo(x - 12, by - 12);
        ctx.lineTo(x - 7, by - 6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 9, by - 5);
        ctx.lineTo(x + 12, by - 12);
        ctx.lineTo(x + 7, by - 6);
        ctx.fill();
        // Маленький шип
        ctx.beginPath();
        ctx.moveTo(x - 7, by - 7);
        ctx.lineTo(x - 9, by - 13);
        ctx.lineTo(x - 5, by - 8);
        ctx.fill();

        // Череп
        ctx.fillStyle = '#2E1A1A';
        ctx.fillRect(x - 6, by - 14, 12, 10);
        // Кость черепа (светлее спереди)
        ctx.fillStyle = '#3A2222';
        ctx.fillRect(x - 5, by - 13, 10, 8);
        // Глазницы (красное сияние)
        ctx.fillStyle = '#CC0000';
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(x - 4, by - 11, 3, 4);
        ctx.fillRect(x + 1, by - 11, 3, 4);
        ctx.shadowBlur = 0;
        // Белки в зрачках
        ctx.fillStyle = 'rgba(255,50,50,0.3)';
        ctx.fillRect(x - 3, by - 10, 1, 2);
        ctx.fillRect(x + 2, by - 10, 1, 2);
        // Оскал (нижняя челюсть)
        ctx.fillStyle = '#6A5A50';
        ctx.fillRect(x - 4, by - 5, 8, 3);
        ctx.fillStyle = '#0A0808';
        for (let ti = 0; ti < 3; ti++) {
            ctx.fillRect(x - 3 + ti * 3, by - 5, 2, 3);
        }

        // Руки с когтями
        ctx.fillStyle = '#1C0E0E';
        ctx.fillRect(x - 10, by - 3, 4, 9);
        ctx.fillRect(x + 6, by - 3, 4, 9);
        ctx.fillStyle = '#4A3828';
        // Когти рук
        for (let ci = 0; ci < 3; ci++) {
            ctx.fillRect(x - 10 + ci, by + 6, 1, 4);
            ctx.fillRect(x + 7 + ci, by + 6, 1, 4);
        }

        // Дымок тьмы
        const smokeA = Math.sin(t * 2.5 + x * 0.05) * 0.15 + 0.1;
        ctx.fillStyle = `rgba(60,0,60,${smokeA})`;
        ctx.beginPath();
        ctx.arc(x, by - 15, 10, 0, Math.PI * 2);
        ctx.fill();
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ПАТЧ ЗДАНИЙ — улучшенные здания с текстурами
// ═══════════════════════════════════════════════════════════════════════════

(function patchBuildings() {
    if (typeof Building === 'undefined') { setTimeout(patchBuildings, 300); return; }

    Building.prototype.render = function(ctx, factionColor) {
        const isPlayer = this.team === PLAYER;
        const level = this.level || 1;
        const fc = factionColor || null;

        EnhancedBuildings.drawShadow(ctx, this.x, this.y, this.width, this.height);

        switch (this.type) {
            case 'townhall':    EnhancedBuildings.townhall(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            case 'house':       EnhancedBuildings.house(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            case 'storage':     EnhancedBuildings.storage(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            case 'barracks':    EnhancedBuildings.barracks(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            case 'farm':        EnhancedBuildings.farm(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            case 'archertower': EnhancedBuildings.archertower(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            case 'forge':       EnhancedBuildings.forge(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            case 'magictower':  EnhancedBuildings.magictower(ctx, this.x, this.y, this.width, this.height, level, isPlayer, fc); break;
            default:
                ctx.fillStyle = isPlayer ? '#2A3A2A' : '#3A2A2A';
                ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        // Полоска HP
        if (this.health < this.maxHealth) {
            const bw = this.width * 0.9;
            const bx = this.x + (this.width - bw) / 2;
            const bh = 5;
            const by2 = this.y - 10;
            const pct = this.health / this.maxHealth;
            ctx.fillStyle = '#050505';
            ctx.fillRect(bx - 1, by2 - 1, bw + 2, bh + 2);
            ctx.fillStyle = pct > 0.5 ? '#3D7020' : pct > 0.25 ? '#7A5010' : '#7A1010';
            ctx.fillRect(bx, by2, bw * pct, bh);
            // Белая засечка в середине
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(bx + bw * 0.5 - 0.5, by2, 1, bh);
        }
    };

    console.log('[EnhancedGraphics v3] Buildings patched.');
})();

const EnhancedBuildings = {
    _t() { return Date.now() / 1000; },

    drawShadow(ctx, x, y, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2 + 4, y + h - 4, w * 0.55, h * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // Каменная кладка (переиспользуемый примитив)
    _stonework(ctx, x, y, w, h, baseColor, mortar) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, w, h);
        const bH = 8, bW = 14;
        for (let row = 0; row <= Math.ceil(h / bH); row++) {
            const off = row % 2 === 0 ? 0 : bW / 2;
            for (let col = -1; col <= Math.ceil(w / bW) + 1; col++) {
                const bx = x + col * bW - off;
                const by = y + row * bH;
                if (bx + bW < x || bx > x + w || by + bH < y || by > y + h) continue;
                const n = seededRand(col + row * 71, row + col * 37, 40);
                const shade = Math.floor(n * 14) - 7;
                const [r, g, b] = this._hexToRgb(baseColor);
                ctx.fillStyle = `rgb(${r + shade},${g + shade},${b + shade - 2})`;
                ctx.fillRect(
                    Math.max(x, bx + 1), Math.max(y, by + 1),
                    Math.min(bW - 2, x + w - bx - 1), Math.min(bH - 2, y + h - by - 1)
                );
            }
        }
        // Стыки
        ctx.fillStyle = mortar;
        for (let row = 1; row < Math.ceil(h / bH); row++) {
            ctx.fillRect(x, y + row * bH, w, 1);
        }
    },

    _hexToRgb(hex) {
        const n = parseInt(hex.replace('#', ''), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },

    // Деревянные доски (горизонтальные)
    _planks(ctx, x, y, w, h, wood, dark) {
        ctx.fillStyle = wood;
        ctx.fillRect(x, y, w, h);
        const plankH = 6;
        for (let row = 0; row < Math.ceil(h / plankH); row++) {
            const py = y + row * plankH;
            const n = seededRand(row, 0, 50);
            const shade = n > 0.7 ? 8 : n < 0.2 ? -8 : 0;
            const [r, g, b] = this._hexToRgb(wood);
            ctx.fillStyle = `rgb(${r + shade},${g + shade * 0.8},${b + shade * 0.6})`;
            ctx.fillRect(x, py, w, Math.min(plankH - 1, y + h - py));
        }
        ctx.fillStyle = dark;
        for (let row = 1; row < Math.ceil(h / plankH); row++) {
            ctx.fillRect(x, y + row * plankH - 1, w, 1);
        }
    },

    // ── РАТУША ────────────────────────────────────────────────────────────
    townhall(ctx, x, y, w, h, level, isPlayer, fc) {
        const t = this._t();
        const colors = [
            { stone: '#3A3530', mortar: '#1A1712', roof: '#252218', accent: '#5A4A30', door: '#0E0C0A', glow: null },
            { stone: '#2E2A26', mortar: '#141210', roof: '#1A1815', accent: '#483A28', door: '#0C0A08', glow: null },
            { stone: '#1E1C18', mortar: '#0E0C0A', roof: '#100E0C', accent: '#3A2A1A', door: '#080605', glow: '#FF3A1A' }
        ][level - 1] || {};

        // Основание (широкое)
        this._stonework(ctx, x + 2, y + h * 0.35, w - 4, h * 0.65, colors.stone, colors.mortar);

        // Главная башня (центр)
        this._stonework(ctx, x + w * 0.2, y + h * 0.1, w * 0.6, h * 0.28, colors.stone, colors.mortar);

        // Кровля — остроконечная
        ctx.fillStyle = colors.roof;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.02);
        ctx.lineTo(x + w * 0.85, y + h * 0.12);
        ctx.lineTo(x + w * 0.15, y + h * 0.12);
        ctx.closePath();
        ctx.fill();
        // Зубцы на кровле
        ctx.fillStyle = colors.stone;
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(x + w * 0.18 + i * (w * 0.14), y + h * 0.1, w * 0.08, h * 0.05);
        }

        // Крыша главного здания
        ctx.fillStyle = colors.roof;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.1, y + h * 0.35);
        ctx.lineTo(x + w * 0.9, y + h * 0.35);
        ctx.lineTo(x + w, y + h * 0.42);
        ctx.lineTo(x, y + h * 0.42);
        ctx.closePath();
        ctx.fill();

        // Шипы на 2-3 уровне
        if (level >= 2) {
            ctx.fillStyle = level === 3 ? '#5A0A0A' : '#303028';
            for (let i = 0; i < 4; i++) {
                const sx = x + w * 0.15 + i * w * 0.23;
                ctx.beginPath();
                ctx.moveTo(sx, y + h * 0.35);
                ctx.lineTo(sx + w * 0.06, y + h * (level === 3 ? 0.2 : 0.27));
                ctx.lineTo(sx + w * 0.12, y + h * 0.35);
                ctx.fill();
            }
        }

        // Окна (бойницы)
        ctx.fillStyle = level === 3 ? colors.glow : '#0A0807';
        if (level === 3) { ctx.shadowColor = colors.glow; ctx.shadowBlur = 12; }
        for (let i = 0; i < 3; i++) {
            const wx2 = x + w * 0.15 + i * w * 0.28;
            ctx.fillRect(wx2, y + h * 0.5, w * 0.1, h * 0.18);
            // Крестовина
            ctx.fillStyle = colors.mortar;
            ctx.fillRect(wx2, y + h * 0.58, w * 0.1, 1);
            ctx.fillStyle = level === 3 ? colors.glow : '#0A0807';
        }
        ctx.shadowBlur = 0;

        // Ворота
        ctx.fillStyle = colors.door;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.36, y + h);
        ctx.lineTo(x + w * 0.36, y + h * 0.7);
        ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.6, x + w * 0.64, y + h * 0.7);
        ctx.lineTo(x + w * 0.64, y + h);
        ctx.fill();
        // Засов
        ctx.strokeStyle = '#3A3020';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.38, y + h * 0.82);
        ctx.lineTo(x + w * 0.62, y + h * 0.82);
        ctx.stroke();

        // Герб над воротами
        ctx.fillStyle = isPlayer ? '#2A4A80' : (fc || '#7A1515');
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.61, w * 0.07, 0, Math.PI * 2);
        ctx.fill();

        // Флаг
        const fw = Math.sin(t * 2.2 + x * 0.01) * 3;
        ctx.strokeStyle = '#2A2018'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.02);
        ctx.lineTo(x + w * 0.5, y - h * 0.15);
        ctx.stroke();
        ctx.fillStyle = isPlayer ? '#1A4A90' : (fc || '#8A1010');
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y - h * 0.15);
        ctx.lineTo(x + w * 0.5 + 18 + fw, y - h * 0.08 + fw * 0.3);
        ctx.lineTo(x + w * 0.5, y - h * 0.01);
        ctx.fill();

        if (level === 3) {
            const pulse = Math.sin(t * 2) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255,60,20,${pulse * 0.5})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        }
    },

    // ── ДОМ ───────────────────────────────────────────────────────────────
    house(ctx, x, y, w, h, level, isPlayer, fc) {
        const colors = [
            { wall: '#3A3028', wood: '#4A3820', roof: '#2A2218', window: '#0E0C08', trim: null },
            { wall: '#2E2620', wood: '#3C2E18', roof: '#281E14', window: '#3A2008', trim: '#5A4028' },
            { wall: '#1E1C18', wood: '#2A2010', roof: '#14100C', window: '#8B1A1A', trim: '#C03020' }
        ][level - 1];

        // Стены
        this._stonework(ctx, x + 4, y + h * 0.4, w - 8, h * 0.6, colors.wall, '#141210');
        // Деревянный цоколь
        this._planks(ctx, x + 4, y + h * 0.6, w - 8, h * 0.1, colors.wood, '#1A0E08');
        // Фронтон
        this._planks(ctx, x + 8, y + h * 0.2, w - 16, h * 0.22, colors.wood, '#1A0E08');

        // Крыша
        ctx.fillStyle = colors.roof;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.08);
        ctx.lineTo(x + w + 2, y + h * 0.42);
        ctx.lineTo(x - 2, y + h * 0.42);
        ctx.closePath();
        ctx.fill();
        // Черепица (горизонтальные полосы)
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let ri = 1; ri < 5; ri++) {
            const ty2 = y + h * 0.08 + ri * h * 0.07;
            const rw = ri * (w / 5) * 1.1;
            ctx.fillRect(x + w / 2 - rw / 2, ty2, rw, 2);
        }
        // Конёк
        ctx.fillStyle = '#1A1410';
        ctx.fillRect(x + w * 0.45, y + h * 0.06, w * 0.1, h * 0.06);

        // Декоративная окантовка крыши (ур 2+)
        if (level >= 2 && colors.trim) {
            ctx.fillStyle = colors.trim;
            ctx.fillRect(x - 2, y + h * 0.405, w + 4, 4);
            ctx.fillRect(x + 2, y + h * 0.4, 6, 8);
            ctx.fillRect(x + w - 8, y + h * 0.4, 6, 8);
        }

        // Окна
        if (level === 3) { ctx.shadowColor = colors.window; ctx.shadowBlur = 10; }
        ctx.fillStyle = level === 2 ? '#4A2C10' : colors.window;
        ctx.fillRect(x + w * 0.15, y + h * 0.48, w * 0.22, h * 0.2);
        ctx.fillRect(x + w * 0.63, y + h * 0.48, w * 0.22, h * 0.2);
        if (level === 3) {
            // Двойное свечение окна
            ctx.fillStyle = '#FF3820';
            ctx.fillRect(x + w * 0.17, y + h * 0.5, w * 0.18, h * 0.16);
            ctx.fillRect(x + w * 0.65, y + h * 0.5, w * 0.18, h * 0.16);
        }
        ctx.shadowBlur = 0;
        // Переплёт
        ctx.fillStyle = '#2A2018';
        ctx.fillRect(x + w * 0.26, y + h * 0.48, 2, h * 0.2);
        ctx.fillRect(x + w * 0.15, y + h * 0.56, w * 0.22, 2);
        ctx.fillRect(x + w * 0.74, y + h * 0.48, 2, h * 0.2);
        ctx.fillRect(x + w * 0.63, y + h * 0.56, w * 0.22, 2);

        // Ящики с цветами под окнами (ур 2+)
        if (level >= 2) {
            ctx.fillStyle = '#3A1C08';
            ctx.fillRect(x + w * 0.13, y + h * 0.67, w * 0.26, 5);
            ctx.fillRect(x + w * 0.61, y + h * 0.67, w * 0.26, 5);
            // Цветы
            const flowerColors = level === 2 ? ['#E03030', '#FF6040', '#E04080'] : ['#FF2020', '#FF0000', '#CC0000'];
            for (let fi = 0; fi < 4; fi++) {
                ctx.fillStyle = '#2A4010';
                ctx.fillRect(x + w * 0.16 + fi * w * 0.06, y + h * 0.59, 2, 9);
                ctx.fillRect(x + w * 0.64 + fi * w * 0.06, y + h * 0.59, 2, 9);
                ctx.fillStyle = flowerColors[fi % 3];
                ctx.beginPath();
                ctx.arc(x + w * 0.17 + fi * w * 0.06, y + h * 0.585, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + w * 0.65 + fi * w * 0.06, y + h * 0.585, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Дверь
        ctx.fillStyle = '#0C0A08';
        ctx.fillRect(x + w * 0.4, y + h * 0.72, w * 0.2, h * 0.28);
        ctx.fillStyle = '#3A2A18';
        ctx.fillRect(x + w * 0.56, y + h * 0.82, 3, 4); // Ручка

        // Подкова над дверью (ур 2+)
        if (level >= 2) {
            ctx.strokeStyle = '#6A5028';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(x + w * 0.5, y + h * 0.73, w * 0.09, Math.PI, 0);
            ctx.stroke();
        }

        // Труба
        if (level >= 2) {
            ctx.fillStyle = '#1C1814';
            ctx.fillRect(x + w * 0.65, y + h * 0.06, w * 0.1, h * 0.2);
            // Дым
            const dt = this._t();
            for (let si = 0; si < 3; si++) {
                const sa = (dt * 0.4 + si * 0.5) % 1;
                ctx.fillStyle = `rgba(80,70,60,${(1 - sa) * 0.35})`;
                ctx.beginPath();
                ctx.arc(x + w * 0.7, y + h * 0.06 - sa * 25, 4 + sa * 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Красное зловещее свечение здания ур3
        if (level >= 3) {
            const dt = this._t();
            const pulse = Math.sin(dt * 1.5) * 0.15 + 0.15;
            ctx.fillStyle = `rgba(180,20,10,${pulse})`;
            ctx.fillRect(x, y, w, h);
        }
    },

    // ── СКЛАД ─────────────────────────────────────────────────────────────
    storage(ctx, x, y, w, h, level, isPlayer, fc) {
        const colors = [
            { stone: '#3C3C3A', wood: '#2A2820', roof: '#242422', metal: '#3A3A38', door: '#0E0E0C' },
            { stone: '#2E2E2C', wood: '#222018', roof: '#1A1A18', metal: '#2C2C2A', door: '#0A0A08' },
            { stone: '#1E1E1C', wood: '#181614', roof: '#121210', metal: '#1C1C1A', door: '#060606', glow: '#A05810' }
        ][level - 1];

        // Стены — смесь камня и металла
        this._stonework(ctx, x, y + h * 0.28, w, h * 0.72, colors.stone, '#181816');

        // Металлические полосы укрепления
        ctx.fillStyle = colors.metal;
        ctx.fillRect(x, y + h * 0.38, w, 4);
        ctx.fillRect(x, y + h * 0.58, w, 4);
        ctx.fillRect(x, y + h * 0.78, w, 4);
        ctx.fillRect(x + w * 0.2, y + h * 0.28, 5, h * 0.72);
        ctx.fillRect(x + w * 0.78, y + h * 0.28, 5, h * 0.72);
        // Заклёпки
        ctx.fillStyle = '#0A0A0A';
        for (let ri = 0; ri < 5; ri++) {
            ctx.beginPath();
            ctx.arc(x + 8 + ri * 12, y + h * 0.38 + 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 8 + ri * 12, y + h * 0.58 + 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Крыша с коньком
        this._planks(ctx, x - 3, y + h * 0.25, w + 6, h * 0.07, colors.wood, '#0E0C08');
        ctx.fillStyle = colors.roof;
        ctx.fillRect(x - 3, y + h * 0.15, w + 6, h * 0.12);
        // Крышка (двускатная)
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.05);
        ctx.lineTo(x + w + 6, y + h * 0.17);
        ctx.lineTo(x - 6, y + h * 0.17);
        ctx.closePath();
        ctx.fill();

        // Ворота склада
        ctx.fillStyle = colors.door;
        ctx.fillRect(x + w * 0.25, y + h * 0.42, w * 0.5, h * 0.58);
        ctx.fillStyle = colors.metal;
        ctx.fillRect(x + w * 0.25, y + h * 0.42, w * 0.5, 4);
        ctx.fillRect(x + w * 0.5 - 2, y + h * 0.42, 4, h * 0.58);
        // Петли и засов
        ctx.fillStyle = '#303030';
        ctx.fillRect(x + w * 0.28, y + h * 0.5, 5, 3);
        ctx.fillRect(x + w * 0.28, y + h * 0.7, 5, 3);
        ctx.fillRect(x + w * 0.67, y + h * 0.5, 5, 3);
        ctx.fillRect(x + w * 0.67, y + h * 0.7, 5, 3);

        if (level === 3 && colors.glow) {
            ctx.fillStyle = colors.glow;
            ctx.shadowColor = colors.glow; ctx.shadowBlur = 14;
            ctx.fillRect(x + w * 0.2, y + h * 0.38 + 1, w * 0.6, 2);
            ctx.fillRect(x + w * 0.2, y + h * 0.58 + 1, w * 0.6, 2);
            ctx.shadowBlur = 0;
            // Цепи по углам
            ctx.strokeStyle = '#6A5828';
            ctx.lineWidth = 2;
            for (const cx3 of [x + w * 0.12, x + w * 0.88]) {
                ctx.beginPath();
                for (let cl = 0; cl < 5; cl++) {
                    const cy3a = y + h * 0.3 + cl * h * 0.12;
                    ctx.moveTo(cx3 - 3, cy3a);
                    ctx.lineTo(cx3 + 3, cy3a + h * 0.06);
                }
                ctx.stroke();
            }
        }
    },

    // ── КАЗАРМА ───────────────────────────────────────────────────────────
    barracks(ctx, x, y, w, h, level, isPlayer, fc) {
        const t = this._t();
        const colors = [
            { stone: '#382E2A', wood: '#2C2018', roof: '#201814', shield: '#4A3828', door: '#0C0A08', glow: null },
            { stone: '#2C2422', wood: '#231A12', roof: '#181210', shield: '#5C1A1A', door: '#0A0806', glow: null },
            { stone: '#1A1412', wood: '#160E0A', roof: '#0E0A08', shield: '#7A1010', door: '#080604', glow: '#CC1A1A' }
        ][level - 1];

        // Плоская крыша (арена)
        this._stonework(ctx, x, y + h * 0.28, w, h * 0.72, colors.stone, '#141010');
        this._planks(ctx, x - 2, y + h * 0.24, w + 4, h * 0.06, colors.wood, '#0E0808');

        // Мерлоны (зубцы на крыше)
        ctx.fillStyle = colors.stone;
        for (let i = 0; i < 7; i++) {
            ctx.fillRect(x + i * (w / 6) - 2, y + h * 0.18, w / 10, h * 0.08);
        }

        // Боковые башни
        for (const side of [-1, 1]) {
            const tx = side === -1 ? x : x + w - w * 0.2;
            this._stonework(ctx, tx, y + h * 0.12, w * 0.2, h * 0.88, '#2A2018', '#10100C');
            ctx.fillStyle = colors.stone;
            for (let mi = 0; mi < 2; mi++) {
                ctx.fillRect(tx + mi * (w * 0.09), y + h * 0.08, w * 0.07, h * 0.06);
            }
        }

        // Щиты на стенах
        for (const side of [-1, 1]) {
            const sx = x + w * 0.5 + side * w * 0.28;
            const sy2 = y + h * 0.48;
            ctx.fillStyle = colors.shield;
            if (level === 3) { ctx.shadowColor = colors.glow; ctx.shadowBlur = 8; }
            ctx.beginPath();
            ctx.moveTo(sx, sy2 - 14);
            ctx.lineTo(sx + 11, sy2 - 5);
            ctx.lineTo(sx + 11, sy2 + 7);
            ctx.lineTo(sx, sy2 + 16);
            ctx.lineTo(sx - 11, sy2 + 7);
            ctx.lineTo(sx - 11, sy2 - 5);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            // Символ на щите
            ctx.fillStyle = isPlayer ? '#1A3060' : (fc || '#5A0808');
            ctx.fillRect(sx - 2, sy2 - 8, 4, 14);
            ctx.fillRect(sx - 6, sy2 - 2, 12, 3);
        }

        // Ворота с решёткой
        ctx.fillStyle = '#050403';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.35, y + h);
        ctx.lineTo(x + w * 0.35, y + h * 0.6);
        ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.5, x + w * 0.65, y + h * 0.6);
        ctx.lineTo(x + w * 0.65, y + h);
        ctx.fill();
        // Прутья
        ctx.strokeStyle = '#3A2A18';
        ctx.lineWidth = 2;
        for (let bi = 0; bi < 4; bi++) {
            ctx.beginPath();
            ctx.moveTo(x + w * 0.38 + bi * w * 0.08, y + h * 0.64);
            ctx.lineTo(x + w * 0.38 + bi * w * 0.08, y + h);
            ctx.stroke();
        }
        // Горизонтальные прутья
        ctx.beginPath();
        ctx.moveTo(x + w * 0.37, y + h * 0.75);
        ctx.lineTo(x + w * 0.63, y + h * 0.75);
        ctx.stroke();

        // Факелы на уровне 2+
        if (level >= 2) {
            for (const tx3 of [x + w * 0.16, x + w * 0.84]) {
                const fi = Math.sin(t * 8 + tx3) * 0.3 + 0.7;
                ctx.fillStyle = '#2A1808'; ctx.fillRect(tx3 - 2, y + h * 0.45, 4, 12);
                ctx.fillStyle = `rgba(220,80,10,${fi * 0.9})`;
                ctx.shadowColor = '#FF8000'; ctx.shadowBlur = 12 * fi;
                ctx.beginPath();
                ctx.moveTo(tx3, y + h * 0.38);
                ctx.lineTo(tx3 - 4, y + h * 0.46);
                ctx.lineTo(tx3 + 4, y + h * 0.46);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = `rgba(255, 160, 20, ${fi * 0.7})`;
                ctx.beginPath();
                ctx.moveTo(tx3, y + h * 0.4);
                ctx.lineTo(tx3 - 2, y + h * 0.45);
                ctx.lineTo(tx3 + 2, y + h * 0.45);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Флаг
        const fw = Math.sin(t * 2 + x * 0.01) * 3;
        ctx.fillStyle = '#1A1010';
        ctx.fillRect(x + w * 0.47, y + h * 0.08, 3, h * 0.2);
        ctx.fillStyle = isPlayer ? '#1A4A90' : (fc || '#8A0808');
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.08);
        ctx.lineTo(x + w * 0.5 + 16 + fw, y + h * 0.14 + fw * 0.3);
        ctx.lineTo(x + w * 0.5, y + h * 0.2);
        ctx.fill();
    },

    // ── ФЕРМА ─────────────────────────────────────────────────────────────
    farm(ctx, x, y, w, h, level, isPlayer, fc) {
        const t = this._t();

        // ── Цветовые схемы по уровням ─────────────────────────────────────
        // Уровень 1: Простая ферма — пшеничные поля, деревянный амбар
        // Уровень 2: Развитая ферма — подсолнухи, каменный амбар с мельницей
        // Уровень 3: Магическая ферма — светящиеся магические растения, золотая крыша
        const colors = [
            {
                soil:     '#3A2C1A', soilDark: '#241808', soilLight: '#4A3824',
                wood:     '#5A3C1C', woodDark:  '#3A2410', roofMain: '#6B3A18', roofDark: '#3A2010',
                cropStem: '#3A5018', cropHead:  '#8B7020', cropLight: '#C4A830',
                fence:    '#4A3418', well:      '#2E2218', door: '#1A1008',
                glow: null
            },
            {
                soil:     '#2E2414', soilDark: '#1C1408', soilLight: '#402E1C',
                wood:     '#483014', woodDark:  '#2C1C08', roofMain: '#553010', roofDark: '#301A08',
                cropStem: '#285040', cropHead:  '#E8B820', cropLight: '#FFD840',
                fence:    '#3A2810', well:      '#282018', door: '#140C06',
                glow: null
            },
            {
                soil:     '#1E1810', soilDark: '#100C06', soilLight: '#2C2018',
                wood:     '#341E0A', woodDark:  '#1C1004', roofMain: '#7A5A10', roofDark: '#4A3408',
                cropStem: '#1A4838', cropHead:  '#A0E840', cropLight: '#C8FF60',
                fence:    '#281A08', well:      '#1A1408', door: '#0C0804',
                glow: '#70E840'
            }
        ][level - 1];

        // ═══════════════════════════════════════════════════════
        // ЗЕМЛЯ / ПОЛЕ
        // ═══════════════════════════════════════════════════════

        // Основной грунт поля (нижние 55%)
        const fieldTop = y + h * 0.44;
        const fieldH = h * 0.56;

        // Базовый слой земли
        ctx.fillStyle = colors.soil;
        ctx.fillRect(x, fieldTop, w, fieldH);

        // Текстура земли — горизонтальные полосы вспаханного поля
        const rowCount = 6;
        for (let ri = 0; ri < rowCount; ri++) {
            const ry = fieldTop + (ri / rowCount) * fieldH;
            const rh = fieldH / rowCount;
            const isOdd = ri % 2 === 0;
            ctx.fillStyle = isOdd ? colors.soilDark : colors.soilLight;
            ctx.fillRect(x + 2, ry, w - 4, rh - 1);
        }

        // Борозды (вертикальные линии)
        ctx.fillStyle = colors.soilDark;
        const furrowCount = level === 1 ? 5 : level === 2 ? 7 : 9;
        for (let fi = 0; fi < furrowCount; fi++) {
            const fx = x + (fi + 0.5) * (w / furrowCount);
            ctx.fillRect(fx - 1, fieldTop, 2, fieldH);
        }

        // ═══════════════════════════════════════════════════════
        // ПОСЕВЫ (анимированные, разные для каждого уровня)
        // ═══════════════════════════════════════════════════════

        const cropCols = level === 1 ? 4 : level === 2 ? 6 : 7;
        const cropRows = level === 1 ? 2 : level === 2 ? 3 : 3;

        if (level === 3 && colors.glow) {
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = 10;
        }

        for (let ci = 0; ci < cropCols; ci++) {
            for (let ri = 0; ri < cropRows; ri++) {
                const cx2 = x + (ci + 0.5) * (w / cropCols);
                const cy2 = fieldTop + (ri + 0.5) * (fieldH / (cropRows + 0.5));
                const sway = Math.sin(t * 1.8 + ci * 1.3 + ri * 0.9) * (level === 3 ? 2.5 : 1.8);
                const grow = Math.sin(t * 0.5 + ci * 0.4) * 0.1 + 0.9; // пульс роста

                if (level === 1) {
                    // ── Пшеница: стебель + колос ──────────────────────────
                    const stemH = 14 * grow;
                    // Стебель
                    ctx.fillStyle = colors.cropStem;
                    ctx.fillRect(cx2 + sway * 0.3 - 1, cy2 - stemH, 2, stemH);
                    // Листик
                    ctx.fillStyle = colors.cropStem;
                    ctx.fillRect(cx2 + sway * 0.2 - 4, cy2 - stemH * 0.5, 4, 2);
                    // Колос (прямоугольный)
                    ctx.fillStyle = colors.cropHead;
                    ctx.fillRect(cx2 + sway - 2, cy2 - stemH - 7, 4, 8);
                    // Усы колоса
                    ctx.fillStyle = colors.cropLight;
                    ctx.fillRect(cx2 + sway - 1, cy2 - stemH - 8, 1, 3);
                    ctx.fillRect(cx2 + sway + 1, cy2 - stemH - 9, 1, 3);

                } else if (level === 2) {
                    // ── Подсолнухи: стебель + большой цветок ──────────────
                    const stemH = 18 * grow;
                    // Стебель толстый
                    ctx.fillStyle = colors.cropStem;
                    ctx.fillRect(cx2 + sway * 0.3 - 1, cy2 - stemH, 3, stemH);
                    // Листья по бокам
                    ctx.fillStyle = '#306038';
                    ctx.beginPath();
                    ctx.ellipse(cx2 + sway * 0.5 - 5, cy2 - stemH * 0.45, 5, 3, -0.4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(cx2 + sway * 0.5 + 5, cy2 - stemH * 0.65, 5, 3, 0.4, 0, Math.PI * 2);
                    ctx.fill();
                    // Лепестки (8 штук)
                    const petalCount = 8;
                    for (let pi2 = 0; pi2 < petalCount; pi2++) {
                        const pa = (Math.PI * 2 / petalCount) * pi2 + t * 0.2;
                        const px2 = cx2 + sway + Math.cos(pa) * 7;
                        const py2 = cy2 - stemH + Math.sin(pa) * 7;
                        ctx.fillStyle = colors.cropHead;
                        ctx.beginPath();
                        ctx.ellipse(px2, py2, 3, 2, pa, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Центр цветка
                    ctx.fillStyle = '#5A3010';
                    ctx.beginPath();
                    ctx.arc(cx2 + sway, cy2 - stemH, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#7A4818';
                    ctx.beginPath();
                    ctx.arc(cx2 + sway, cy2 - stemH, 2, 0, Math.PI * 2);
                    ctx.fill();

                } else {
                    // ── Магические светящиеся растения (ур 3) ─────────────
                    const stemH = 20 * grow;
                    const pulse = Math.sin(t * 2.5 + ci * 0.8 + ri * 1.2) * 0.3 + 0.7;
                    // Стебель светящийся
                    ctx.fillStyle = colors.cropStem;
                    ctx.fillRect(cx2 + sway * 0.3 - 1, cy2 - stemH, 3, stemH);
                    // Свечение стебля
                    ctx.fillStyle = `rgba(80, 220, 80, ${pulse * 0.15})`;
                    ctx.fillRect(cx2 + sway * 0.3 - 3, cy2 - stemH, 7, stemH);
                    // Листья-кристаллы
                    ctx.fillStyle = colors.cropStem;
                    for (let li = 0; li < 3; li++) {
                        const lp = (li + 1) * 0.28;
                        const ls = 1 + li * 0.5;
                        ctx.beginPath();
                        ctx.moveTo(cx2 + sway * lp, cy2 - stemH * lp);
                        ctx.lineTo(cx2 + sway * lp - 7 * ls, cy2 - stemH * lp - 3);
                        ctx.lineTo(cx2 + sway * lp - 5 * ls, cy2 - stemH * lp + 4);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.moveTo(cx2 + sway * lp, cy2 - stemH * lp);
                        ctx.lineTo(cx2 + sway * lp + 7 * ls, cy2 - stemH * lp - 3);
                        ctx.lineTo(cx2 + sway * lp + 5 * ls, cy2 - stemH * lp + 4);
                        ctx.fill();
                    }
                    // Магический цветок (звезда)
                    const starR = 5 + pulse * 2;
                    ctx.fillStyle = colors.cropLight;
                    ctx.shadowColor = colors.glow; ctx.shadowBlur = 12 * pulse;
                    for (let si2 = 0; si2 < 5; si2++) {
                        const sa = (Math.PI * 2 / 5) * si2 - Math.PI / 2 + t * 0.5;
                        const sx2b = cx2 + sway + Math.cos(sa) * starR;
                        const sy2b = cy2 - stemH + Math.sin(sa) * starR;
                        ctx.beginPath();
                        ctx.ellipse(sx2b, sy2b, 2.5, 1.5, sa, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                    // Ядро цветка
                    ctx.fillStyle = '#FFFFFF';
                    ctx.shadowColor = colors.glow; ctx.shadowBlur = 8 * pulse;
                    ctx.beginPath();
                    ctx.arc(cx2 + sway, cy2 - stemH, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    // Летящие частицы
                    if (Math.random() < 0.03) {
                        // handled separately via sparkles below
                    }
                }
            }
        }
        ctx.shadowBlur = 0;

        // Магические частицы на уровне 3 — светлячки над полем
        if (level === 3) {
            for (let pi2 = 0; pi2 < 6; pi2++) {
                const pa = t * 0.7 + pi2 * 1.05;
                const px2 = x + w * 0.1 + (pi2 / 6) * w * 0.8 + Math.sin(pa * 1.3) * 8;
                const py2 = fieldTop - 5 + Math.sin(pa) * 10;
                const pp = Math.sin(t * 3 + pi2 * 0.8) * 0.5 + 0.5;
                ctx.fillStyle = `rgba(160, 255, 100, ${pp * 0.7})`;
                ctx.shadowColor = colors.glow; ctx.shadowBlur = 8 * pp;
                ctx.beginPath();
                ctx.arc(px2, py2, 1.5 + pp, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // ═══════════════════════════════════════════════════════
        // ИЗГОРОДЬ вокруг поля
        // ═══════════════════════════════════════════════════════
        ctx.fillStyle = colors.fence;
        // Верхняя планка забора
        ctx.fillRect(x, fieldTop - 3, w, 3);
        // Столбы
        const postCount = level === 1 ? 5 : level === 2 ? 7 : 9;
        for (let pi2 = 0; pi2 <= postCount; pi2++) {
            const px2 = x + pi2 * (w / postCount);
            ctx.fillRect(px2 - 2, fieldTop - 8, 4, 12);
        }

        // ═══════════════════════════════════════════════════════
        // АМБАР (верхняя часть здания)
        // ═══════════════════════════════════════════════════════

        const barnLeft   = x + w * 0.05;
        const barnRight  = x + w * (level === 2 ? 0.72 : level === 3 ? 0.65 : 0.85);
        const barnW      = barnRight - barnLeft;
        const barnTop    = y + h * 0.18;
        const barnBottom = fieldTop;
        const barnH      = barnBottom - barnTop;

        if (level === 1) {
            // ── Ур.1: Простой деревянный амбар ────────────────────────────
            this._planks(ctx, barnLeft, barnTop + barnH * 0.1, barnW, barnH * 0.9, colors.wood, colors.woodDark);
            // Крыша
            ctx.fillStyle = colors.roofMain;
            ctx.beginPath();
            ctx.moveTo(barnLeft + barnW * 0.5, barnTop);
            ctx.lineTo(barnRight + 4, barnTop + barnH * 0.12);
            ctx.lineTo(barnLeft - 4, barnTop + barnH * 0.12);
            ctx.closePath();
            ctx.fill();
            // Конёк
            ctx.fillStyle = colors.roofDark;
            ctx.fillRect(barnLeft + barnW * 0.45, barnTop - 2, barnW * 0.1, barnH * 0.07);
            // Дверь амбара (двустворчатая)
            ctx.fillStyle = colors.door;
            ctx.fillRect(barnLeft + barnW * 0.32, barnTop + barnH * 0.42, barnW * 0.17, barnH * 0.58);
            ctx.fillRect(barnLeft + barnW * 0.51, barnTop + barnH * 0.42, barnW * 0.17, barnH * 0.58);
            // Крест на двери
            ctx.fillStyle = '#2A1A08';
            ctx.fillRect(barnLeft + barnW * 0.32, barnTop + barnH * 0.7, barnW * 0.36, 3);
            ctx.fillRect(barnLeft + barnW * 0.497, barnTop + barnH * 0.42, 3, barnH * 0.58);
            // Навес над дверью
            ctx.fillStyle = colors.roofDark;
            ctx.fillRect(barnLeft + barnW * 0.28, barnTop + barnH * 0.38, barnW * 0.44, 5);
            // Маленькое окошко чердака (круглое)
            ctx.fillStyle = colors.door;
            ctx.beginPath();
            ctx.arc(barnLeft + barnW * 0.5, barnTop + barnH * 0.2, barnW * 0.07, 0, Math.PI * 2);
            ctx.fill();
            // Переплёт окошка
            ctx.strokeStyle = colors.wood; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(barnLeft + barnW * 0.5 - barnW * 0.07, barnTop + barnH * 0.2);
            ctx.lineTo(barnLeft + barnW * 0.5 + barnW * 0.07, barnTop + barnH * 0.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(barnLeft + barnW * 0.5, barnTop + barnH * 0.2 - barnW * 0.07);
            ctx.lineTo(barnLeft + barnW * 0.5, barnTop + barnH * 0.2 + barnW * 0.07);
            ctx.stroke();

        } else if (level === 2) {
            // ── Ур.2: Каменный амбар + деревянные элементы ─────────────────
            this._stonework(ctx, barnLeft, barnTop + barnH * 0.25, barnW, barnH * 0.75, '#3A3028', '#1A1810');
            this._planks(ctx, barnLeft, barnTop + barnH * 0.1, barnW, barnH * 0.17, colors.wood, colors.woodDark);
            // Крыша с двойным скатом
            ctx.fillStyle = colors.roofMain;
            ctx.beginPath();
            ctx.moveTo(barnLeft + barnW * 0.5, barnTop - 2);
            ctx.lineTo(barnRight + 6, barnTop + barnH * 0.13);
            ctx.lineTo(barnLeft - 6, barnTop + barnH * 0.13);
            ctx.closePath();
            ctx.fill();
            // Слой черепицы
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            for (let ri = 1; ri < 4; ri++) {
                const ty2 = barnTop - 2 + ri * barnH * 0.032;
                const rw = ri * barnW * 0.5 * 1.1;
                ctx.fillRect(barnLeft + barnW * 0.5 - rw / 2, ty2, rw, 2);
            }
            // Дверь с аркой
            ctx.fillStyle = colors.door;
            ctx.beginPath();
            ctx.moveTo(barnLeft + barnW * 0.32, barnBottom);
            ctx.lineTo(barnLeft + barnW * 0.32, barnTop + barnH * 0.52);
            ctx.quadraticCurveTo(barnLeft + barnW * 0.5, barnTop + barnH * 0.4, barnLeft + barnW * 0.68, barnTop + barnH * 0.52);
            ctx.lineTo(barnLeft + barnW * 0.68, barnBottom);
            ctx.fill();
            // Дверные петли
            ctx.fillStyle = '#484840';
            ctx.fillRect(barnLeft + barnW * 0.33, barnTop + barnH * 0.55, 5, 4);
            ctx.fillRect(barnLeft + barnW * 0.33, barnTop + barnH * 0.72, 5, 4);
            ctx.fillRect(barnLeft + barnW * 0.65, barnTop + barnH * 0.55, 5, 4);
            ctx.fillRect(barnLeft + barnW * 0.65, barnTop + barnH * 0.72, 5, 4);
            // Окна по бокам
            ctx.fillStyle = '#1A1808';
            ctx.fillRect(barnLeft + barnW * 0.08, barnTop + barnH * 0.38, barnW * 0.16, barnH * 0.2);
            ctx.fillRect(barnLeft + barnW * 0.76, barnTop + barnH * 0.38, barnW * 0.16, barnH * 0.2);
            // Переплёт окон
            ctx.fillStyle = '#3A2A18'; ctx.lineWidth = 2;
            ctx.fillRect(barnLeft + barnW * 0.08, barnTop + barnH * 0.47, barnW * 0.16, 2);
            ctx.fillRect(barnLeft + barnW * 0.15, barnTop + barnH * 0.38, 2, barnH * 0.2);
            ctx.fillRect(barnLeft + barnW * 0.76, barnTop + barnH * 0.47, barnW * 0.16, 2);
            ctx.fillRect(barnLeft + barnW * 0.83, barnTop + barnH * 0.38, 2, barnH * 0.2);

            // ── МЕЛЬНИЦА (справа от амбара, уровень 2+) ────────────────────
            const mX = x + w * 0.74;
            const mW = w * 0.24;
            const mH = h * 0.42;
            const mTop = y + h * 0.02;
            // Башня мельницы
            this._stonework(ctx, mX, mTop + mH * 0.35, mW, mH * 0.65, '#352E24', '#181410');
            // Конусная крыша мельницы
            ctx.fillStyle = '#2A2018';
            ctx.beginPath();
            ctx.moveTo(mX + mW * 0.5, mTop);
            ctx.lineTo(mX + mW + 3, mTop + mH * 0.38);
            ctx.lineTo(mX - 3, mTop + mH * 0.38);
            ctx.closePath();
            ctx.fill();
            // Лопасти мельницы (вращающиеся!)
            const windAngle = t * 0.6;
            const bladeCount = 4;
            const bladeLen = mW * 0.85;
            const bladeW = 5;
            const hubX = mX + mW * 0.5;
            const hubY = mTop + mH * 0.42;
            ctx.save();
            ctx.translate(hubX, hubY);
            for (let bi = 0; bi < bladeCount; bi++) {
                const ba = windAngle + bi * (Math.PI / 2);
                ctx.save();
                ctx.rotate(ba);
                // Стержень лопасти
                ctx.fillStyle = '#5A3A18';
                ctx.fillRect(-1, -bladeLen, 3, bladeLen);
                // Парус лопасти
                ctx.fillStyle = '#D4C090';
                ctx.fillRect(-bladeW, -bladeLen * 0.92, bladeW * 2, bladeLen * 0.85);
                // Полосы паруса
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                for (let s = 0; s < 3; s++) {
                    ctx.fillRect(-bladeW + 1, -bladeLen * 0.92 + s * bladeLen * 0.28, bladeW * 2 - 2, 2);
                }
                ctx.restore();
            }
            // Ступица
            ctx.fillStyle = '#3A2A18';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6A4A28';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // Маленькое окошко мельницы
            ctx.fillStyle = '#1A1808';
            ctx.fillRect(mX + mW * 0.32, mTop + mH * 0.52, mW * 0.36, mH * 0.18);

        } else {
            // ── Ур.3: Великолепный магический амбар с золотой крышей ────────
            this._stonework(ctx, barnLeft, barnTop + barnH * 0.18, barnW, barnH * 0.82, '#282020', '#120E0C');
            // Каменный цоколь тёмный
            ctx.fillStyle = '#1A1410';
            ctx.fillRect(barnLeft - 2, barnTop + barnH * 0.78, barnW + 4, barnH * 0.22);

            // Золотая крыша с орнаментом
            const goldGrad = ctx.createLinearGradient(barnLeft, barnTop, barnLeft + barnW, barnTop + barnH * 0.22);
            goldGrad.addColorStop(0, '#8B6A18');
            goldGrad.addColorStop(0.5, '#C49A28');
            goldGrad.addColorStop(1, '#8B6A18');
            ctx.fillStyle = goldGrad;
            ctx.beginPath();
            ctx.moveTo(barnLeft + barnW * 0.5, barnTop - 4);
            ctx.lineTo(barnRight + 8, barnTop + barnH * 0.16);
            ctx.lineTo(barnLeft - 8, barnTop + barnH * 0.16);
            ctx.closePath();
            ctx.fill();
            // Конёк с золотым свечением
            ctx.fillStyle = '#FFD840';
            ctx.shadowColor = colors.glow; ctx.shadowBlur = 14;
            ctx.fillRect(barnLeft + barnW * 0.44, barnTop - 6, barnW * 0.12, 8);
            ctx.shadowBlur = 0;

            // Черепица золотая (полосы)
            for (let ri = 1; ri < 4; ri++) {
                const ty2 = barnTop - 4 + ri * barnH * 0.035;
                const rw = ri * barnW * 0.5 * 1.15;
                ctx.fillStyle = `rgba(80, 60, 0, 0.35)`;
                ctx.fillRect(barnLeft + barnW * 0.5 - rw / 2, ty2, rw, 2.5);
            }

            // Арочная дверь с магическим свечением
            ctx.fillStyle = '#0C0A06';
            ctx.beginPath();
            ctx.moveTo(barnLeft + barnW * 0.3, barnBottom);
            ctx.lineTo(barnLeft + barnW * 0.3, barnTop + barnH * 0.48);
            ctx.quadraticCurveTo(barnLeft + barnW * 0.5, barnTop + barnH * 0.32, barnLeft + barnW * 0.7, barnTop + barnH * 0.48);
            ctx.lineTo(barnLeft + barnW * 0.7, barnBottom);
            ctx.fill();

            // Магические руны над дверью
            const runeCount2 = 3;
            const runePulse = Math.sin(t * 2) * 0.4 + 0.6;
            ctx.fillStyle = `rgba(160, 240, 80, ${runePulse * 0.8})`;
            ctx.shadowColor = colors.glow; ctx.shadowBlur = 10 * runePulse;
            for (let ri = 0; ri < runeCount2; ri++) {
                const rx2 = barnLeft + barnW * 0.35 + ri * barnW * 0.15;
                const ry2 = barnTop + barnH * 0.28;
                ctx.fillRect(rx2 - 2, ry2 - 5, 4, 10);
                ctx.fillRect(rx2 - 4, ry2 - 2, 8, 2);
            }
            ctx.shadowBlur = 0;

            // Окна с магическим светом
            for (const side of [0.08, 0.77]) {
                ctx.fillStyle = colors.glow;
                ctx.shadowColor = colors.glow;
                ctx.shadowBlur = 14 * runePulse;
                ctx.fillRect(barnLeft + barnW * side, barnTop + barnH * 0.35, barnW * 0.15, barnH * 0.22);
                ctx.shadowBlur = 0;
                // Переплёт
                ctx.fillStyle = '#2A1E0A';
                ctx.fillRect(barnLeft + barnW * side, barnTop + barnH * 0.45, barnW * 0.15, 2);
                ctx.fillRect(barnLeft + barnW * (side + 0.07), barnTop + barnH * 0.35, 2, barnH * 0.22);
            }

            // Золотые угловые украшения
            const cornerColor = '#C49A28';
            ctx.fillStyle = cornerColor;
            ctx.shadowColor = '#FFD840'; ctx.shadowBlur = 8;
            for (const cx3 of [barnLeft + 3, barnRight - 9]) {
                ctx.fillRect(cx3, barnTop + barnH * 0.15, 6, barnH * 0.65);
                ctx.fillRect(cx3 - 3, barnTop + barnH * 0.15, 12, 4);
                ctx.fillRect(cx3 - 3, barnTop + barnH * 0.79, 12, 4);
            }
            ctx.shadowBlur = 0;

            // ── БОЛЬШАЯ МЕЛЬНИЦА с магическими лопастями (ур.3) ─────────────
            const mX3 = x + w * 0.67;
            const mW3 = w * 0.31;
            const mH3 = h * 0.48;
            const mTop3 = y;
            this._stonework(ctx, mX3, mTop3 + mH3 * 0.3, mW3, mH3 * 0.7, '#201810', '#100C08');

            // Магическая золотая крыша мельницы
            const goldGrad2 = ctx.createLinearGradient(mX3, mTop3, mX3 + mW3, mTop3 + mH3 * 0.35);
            goldGrad2.addColorStop(0, '#6A5010');
            goldGrad2.addColorStop(0.5, '#B08820');
            goldGrad2.addColorStop(1, '#6A5010');
            ctx.fillStyle = goldGrad2;
            ctx.beginPath();
            ctx.moveTo(mX3 + mW3 * 0.5, mTop3);
            ctx.lineTo(mX3 + mW3 + 4, mTop3 + mH3 * 0.33);
            ctx.lineTo(mX3 - 4, mTop3 + mH3 * 0.33);
            ctx.closePath();
            ctx.fill();

            // Магические лопасти мельницы (вращаются)
            const windAngle3 = t * 0.9;
            const hubX3 = mX3 + mW3 * 0.5;
            const hubY3 = mTop3 + mH3 * 0.45;
            const bladeLen3 = mW3 * 0.95;
            ctx.save();
            ctx.translate(hubX3, hubY3);
            for (let bi = 0; bi < 4; bi++) {
                const ba = windAngle3 + bi * (Math.PI / 2);
                ctx.save();
                ctx.rotate(ba);
                // Стержень
                ctx.fillStyle = '#3A2A10';
                ctx.fillRect(-2, -bladeLen3, 4, bladeLen3);
                // Парус с магическим узором
                const magicGrad = ctx.createLinearGradient(0, -bladeLen3, 0, 0);
                magicGrad.addColorStop(0, `rgba(100, 200, 60, 0.85)`);
                magicGrad.addColorStop(0.5, `rgba(200, 230, 80, 0.9)`);
                magicGrad.addColorStop(1, `rgba(100, 200, 60, 0.6)`);
                ctx.fillStyle = magicGrad;
                ctx.fillRect(-6, -bladeLen3 * 0.93, 12, bladeLen3 * 0.88);
                // Магический узор паруса
                ctx.fillStyle = `rgba(255, 255, 180, 0.4)`;
                ctx.fillRect(-3, -bladeLen3 * 0.9, 6, 2);
                ctx.fillRect(-3, -bladeLen3 * 0.6, 6, 2);
                ctx.fillRect(-3, -bladeLen3 * 0.3, 6, 2);
                ctx.restore();
            }
            // Светящаяся ступица
            ctx.fillStyle = '#C49A28';
            ctx.shadowColor = '#FFD840'; ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            // Магическое кольцо вокруг ступицы
            const hubPulse = Math.sin(t * 3) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(160, 255, 80, ${hubPulse * 0.6})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = colors.glow; ctx.shadowBlur = 8 * hubPulse;
            ctx.beginPath();
            ctx.arc(hubX3, hubY3, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Окно мельницы
            ctx.fillStyle = colors.glow;
            ctx.shadowColor = colors.glow; ctx.shadowBlur = 10;
            ctx.fillRect(mX3 + mW3 * 0.3, mTop3 + mH3 * 0.55, mW3 * 0.4, mH3 * 0.15);
            ctx.shadowBlur = 0;

            // Золотые украшения мельницы
            ctx.fillStyle = '#C49A28';
            ctx.shadowColor = '#FFD840'; ctx.shadowBlur = 6;
            ctx.fillRect(mX3 + 1, mTop3 + mH3 * 0.3, 4, mH3 * 0.4);
            ctx.fillRect(mX3 + mW3 - 5, mTop3 + mH3 * 0.3, 4, mH3 * 0.4);
            ctx.shadowBlur = 0;
        }

        // ═══════════════════════════════════════════════════════
        // КОЛОДЕЦ (у всех уровней, справа, но красивее с прогрессией)
        // ═══════════════════════════════════════════════════════

        if (level === 1) {
            // Простой деревянный колодец
            const wX = x + w * 0.88;
            const wY = y + h * 0.28;
            const wS = w * 0.12;
            ctx.fillStyle = colors.wood;
            ctx.fillRect(wX - wS, wY, wS * 2, wS * 1.2);
            ctx.fillStyle = colors.door;
            ctx.beginPath();
            ctx.arc(wX, wY + wS * 0.6, wS * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = colors.woodDark;
            ctx.fillRect(wX - 2, wY - wS * 0.5, 3, wS * 0.5);
            ctx.fillRect(wX - wS, wY - wS * 0.1, wS * 2, 4);
        }

        // Флаговый шест с флажком фракции (ур 2+)
        if (level >= 2) {
            const fpX = x + w * 0.5;
            const fpY = y + h * 0.02;
            ctx.fillStyle = '#2A1A08';
            ctx.fillRect(fpX - 1, fpY, 3, h * 0.16);
            const fw2 = Math.sin(t * 2 + x * 0.01) * 3;
            ctx.fillStyle = isPlayer ? '#1A6A30' : (fc || '#6A3010');
            ctx.beginPath();
            ctx.moveTo(fpX + 2, fpY);
            ctx.lineTo(fpX + 16 + fw2, fpY + h * 0.04 + fw2 * 0.3);
            ctx.lineTo(fpX + 2, fpY + h * 0.08);
            ctx.fill();
        }
    },

    // ── БАШНЯ ЛУЧНИКОВ ────────────────────────────────────────────────────
    archertower(ctx, x, y, w, h, level, isPlayer, fc) {
        const t = this._t();
        const colors = [
            { stone: '#3A3830', mortar: '#1A1815', arrow: '#1A1610', metal: '#2A2820', glow: null },
            { stone: '#2A2825', mortar: '#141210', arrow: '#181410', metal: '#222018', glow: null },
            { stone: '#1A1815', mortar: '#0C0A08', arrow: '#CC3010', metal: '#181610', glow: '#FF4428' }
        ][level - 1];

        // Основание (широкое трапеция)
        this._stonework(ctx, x + w * 0.08, y + h * 0.7, w * 0.84, h * 0.3, colors.stone, colors.mortar);

        // Ствол башни
        this._stonework(ctx, x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.54, colors.stone, colors.mortar);

        // Верхняя платформа с мерлонами
        ctx.fillStyle = colors.stone;
        ctx.fillRect(x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.08);
        for (let mi = 0; mi < 4; mi++) {
            ctx.fillRect(x + w * 0.14 + mi * w * 0.18, y + h * 0.04, w * 0.1, h * 0.1);
        }

        // Шипы у основания (2-3 ур)
        if (level >= 2) {
            ctx.fillStyle = colors.metal;
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(x + w * 0.5 + side * w * 0.08 * 2.5, y + h * 0.7);
                ctx.lineTo(x + w * 0.5 + side * w * 0.08 * 3.2, y + h * 0.55);
                ctx.lineTo(x + w * 0.5 + side * w * 0.08 * 2, y + h * 0.68);
                ctx.fill();
            }
        }

        // Амбразуры
        if (level === 3) { ctx.shadowColor = colors.glow; ctx.shadowBlur = 12; }
        ctx.fillStyle = colors.arrow;
        ctx.fillRect(x + w * 0.43, y + h * 0.35, w * 0.14, h * 0.18);
        ctx.fillRect(x + w * 0.43, y + h * 0.55, w * 0.14, h * 0.15);
        // Форма бойницы
        ctx.fillStyle = level === 3 ? colors.glow : '#0A0808';
        ctx.fillRect(x + w * 0.46, y + h * 0.3, w * 0.08, h * 0.26);
        ctx.fillRect(x + w * 0.43, y + h * 0.4, w * 0.14, h * 0.08);
        ctx.shadowBlur = 0;

        // Флаг с ветром
        const fw = Math.sin(t * 2.3 + x * 0.01) * 2.5;
        ctx.fillStyle = '#1A1410'; ctx.fillRect(x + w * 0.48, y + h * 0.02, 3, h * 0.12);
        ctx.fillStyle = isPlayer ? '#1A4A90' : (fc || '#7A0808');
        ctx.beginPath();
        ctx.moveTo(x + w * 0.51, y + h * 0.02);
        ctx.lineTo(x + w * 0.51 + 12 + fw, y + h * 0.06 + fw * 0.3);
        ctx.lineTo(x + w * 0.51, y + h * 0.1);
        ctx.fill();

        if (level === 3) {
            const pulse = Math.sin(t * 2.5) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255,80,20,${pulse * 0.12})`;
            ctx.fillRect(x, y, w, h);
        }
    },

    // ── КУЗНИЦА ───────────────────────────────────────────────────────────
    forge(ctx, x, y, w, h, level, isPlayer, fc) {
        const t = this._t();
        const fireIntens = Math.sin(t * 4) * 0.3 + 0.7;
        const colors = [
            { stone: '#383630', wood: '#3A2A18', fire: '#CC4A10', glow: '#FF6A20', metal: '#686460' },
            { stone: '#2C2A24', wood: '#2C2010', fire: '#E04010', glow: '#FF5010', metal: '#807870' },
            { stone: '#1E1C18', wood: '#1E1408', fire: '#FF3000', glow: '#FF6A00', metal: '#A09880' }
        ][level - 1];

        // Основа
        this._stonework(ctx, x, y + h * 0.22, w, h * 0.78, colors.stone, '#181614');
        // Деревянная кровля
        this._planks(ctx, x - 4, y + h * 0.18, w + 8, h * 0.07, colors.wood, '#0E0A08');
        ctx.fillStyle = '#141008';
        ctx.fillRect(x - 4, y + h * 0.1, w + 8, h * 0.1);

        // Горн (печь)
        ctx.fillStyle = '#0E0C0A';
        ctx.fillRect(x + w * 0.08, y + h * 0.42, w * 0.38, h * 0.4);
        // Огонь в горне
        ctx.fillStyle = colors.fire;
        ctx.shadowColor = colors.glow; ctx.shadowBlur = 15 * fireIntens;
        ctx.fillRect(x + w * 0.1, y + h * 0.48, w * 0.34, h * 0.2 * fireIntens);
        ctx.fillStyle = colors.glow;
        ctx.fillRect(x + w * 0.14, y + h * 0.5, w * 0.26, h * 0.14 * fireIntens);
        ctx.shadowBlur = 0;
        // Искры
        for (let si = 0; si < 4 + level * 2; si++) {
            const sa = (t * 1.5 + si * 0.4) % 1;
            const sx2 = x + w * 0.16 + seededRand(si, 0, 60) * w * 0.28;
            ctx.fillStyle = `rgba(255,${160 + Math.random() * 80},0,${(1 - sa) * 0.8})`;
            ctx.beginPath();
            ctx.arc(sx2, y + h * 0.48 - sa * 25, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Наковальня
        ctx.fillStyle = colors.metal;
        ctx.fillRect(x + w * 0.56, y + h * 0.58, w * 0.35, h * 0.12);
        ctx.fillRect(x + w * 0.62, y + h * 0.7, w * 0.24, h * 0.08);
        // Блик на наковальне
        ctx.fillStyle = 'rgba(220,220,220,0.3)';
        ctx.fillRect(x + w * 0.58, y + h * 0.59, w * 0.12, h * 0.04);

        // Молоток
        ctx.fillStyle = colors.wood;
        ctx.fillRect(x + w * 0.72, y + h * 0.4, 4, w * 0.3);
        ctx.fillStyle = colors.metal;
        ctx.fillRect(x + w * 0.69, y + h * 0.38, 10, h * 0.1);

        // Мечи/инструменты на стене (ур 2+)
        if (level >= 2) {
            ctx.strokeStyle = colors.metal; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(x + w * 0.88, y + h * 0.3); ctx.lineTo(x + w * 0.88, y + h * 0.55); ctx.stroke();
            ctx.fillStyle = colors.metal; ctx.fillRect(x + w * 0.84, y + h * 0.27, 8, 6);
            ctx.beginPath(); ctx.moveTo(x + w * 0.93, y + h * 0.32); ctx.lineTo(x + w * 0.93, y + h * 0.52); ctx.stroke();
        }

        // Труба (дым)
        ctx.fillStyle = '#1A1210';
        ctx.fillRect(x + w * 0.25, y + h * 0.08, w * 0.12, h * 0.15);
        for (let si = 0; si < 4; si++) {
            const sp = (t * 0.35 + si * 0.25) % 1;
            ctx.fillStyle = `rgba(60,50,40,${(1 - sp) * 0.4})`;
            ctx.beginPath();
            ctx.arc(x + w * 0.31 + Math.sin(sp * 4) * 5, y + h * 0.08 - sp * 30, 5 + sp * 10, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // ── МАГИЧЕСКАЯ БАШНЯ ──────────────────────────────────────────────────
    magictower(ctx, x, y, w, h, level, isPlayer, fc) {
        const t = this._t();
        const pulse = Math.sin(t * 2) * 0.4 + 0.6;
        const orbit = t * 0.8;

        const colors = [
            { stone: '#2A263A', dark: '#181424', wood: '#2E2218', crystal: '#5A3890', glow: '#7A58D0' },
            { stone: '#22203A', dark: '#14122E', wood: '#261A14', crystal: '#7A2080', glow: '#B040C0' },
            { stone: '#160E2A', dark: '#0C081E', wood: '#1A0E08', crystal: '#A01040', glow: '#FF1A60' }
        ][level - 1];

        // Башня (конусная)
        this._stonework(ctx, x + w * 0.2, y + h * 0.65, w * 0.6, h * 0.35, colors.stone, colors.dark);
        this._stonework(ctx, x + w * 0.25, y + h * 0.4, w * 0.5, h * 0.27, colors.stone, colors.dark);
        this._stonework(ctx, x + w * 0.3, y + h * 0.2, w * 0.4, h * 0.22, colors.stone, colors.dark);

        // Деревянный конус
        ctx.fillStyle = colors.wood;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.02);
        ctx.lineTo(x + w * 0.72, y + h * 0.22);
        ctx.lineTo(x + w * 0.28, y + h * 0.22);
        ctx.closePath();
        ctx.fill();

        // Кристалл на вершине
        const crystalSize = 8 + level * 3;
        ctx.fillStyle = colors.crystal;
        ctx.shadowColor = colors.glow; ctx.shadowBlur = 15 * pulse;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.01 - crystalSize);
        ctx.lineTo(x + w * 0.5 - crystalSize * 0.7, y + h * 0.01 + crystalSize * 0.5);
        ctx.lineTo(x + w * 0.5, y + h * 0.01 + crystalSize * 0.8);
        ctx.lineTo(x + w * 0.5 + crystalSize * 0.7, y + h * 0.01 + crystalSize * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Руны (уровень 1+)
        ctx.strokeStyle = colors.glow;
        ctx.lineWidth = 1.5;
        const runeCount = level + 1;
        for (let ri = 0; ri < runeCount; ri++) {
            const runeY = y + h * 0.48 + ri * h * 0.12;
            const runeR = 6 + Math.sin(t * 1.2 + ri) * 1.5;
            ctx.shadowColor = colors.glow; ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(x + w * 0.5, runeY, runeR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            for (let si = 0; si < 6; si++) {
                const a = (Math.PI * 2 / 6) * si;
                const rx2 = x + w * 0.5 + Math.cos(a) * runeR * 0.5;
                const ry2 = runeY + Math.sin(a) * runeR * 0.5;
                if (si === 0) ctx.moveTo(rx2, ry2);
                else ctx.lineTo(rx2, ry2);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Окна с магическим свечением
        ctx.fillStyle = colors.dark;
        ctx.fillRect(x + w * 0.43, y + h * 0.32, w * 0.14, h * 0.1);
        ctx.fillStyle = colors.glow;
        ctx.shadowColor = colors.glow; ctx.shadowBlur = 8 * pulse;
        ctx.fillRect(x + w * 0.45, y + h * 0.33, w * 0.1, h * 0.08);
        ctx.shadowBlur = 0;

        // Левитирующие кристаллы (ур 2+)
        if (level >= 2) {
            for (let ki = 0; ki < level + 1; ki++) {
                const ka = orbit + ki * (Math.PI * 2 / (level + 1));
                const kr = 22 + Math.sin(t * 2 + ki) * 4;
                const kx = x + w * 0.5 + Math.cos(ka) * kr;
                const ky = y + h * 0.4 + Math.sin(ka) * kr * 0.55;
                ctx.fillStyle = colors.crystal;
                ctx.shadowColor = colors.glow; ctx.shadowBlur = 10 * pulse;
                ctx.beginPath();
                ctx.moveTo(kx, ky - 6);
                ctx.lineTo(kx + 4, ky);
                ctx.lineTo(kx, ky + 7);
                ctx.lineTo(kx - 4, ky);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Магические частицы (ур 3)
        if (level >= 3) {
            for (let pi = 0; pi < 8; pi++) {
                const pa = (t * 2 + pi * Math.PI / 4) % (Math.PI * 2);
                const pr = 30 + Math.sin(t * 3 + pi) * 8;
                const px2 = x + w * 0.5 + Math.cos(pa) * pr;
                const py2 = y + h * 0.5 + Math.sin(pa) * pr * 0.7;
                ctx.fillStyle = `rgba(${level === 3 ? '255,50,100' : '180,100,255'},${0.4 + pulse * 0.4})`;
                ctx.beginPath();
                ctx.arc(px2, py2, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ПАТЧ СТРОИТЕЛЬНОЙ ПЛОЩАДКИ
// ═══════════════════════════════════════════════════════════════════════════

(function patchConstruction() {
    if (typeof ConstructionSite === 'undefined') { setTimeout(patchConstruction, 300); return; }

    ConstructionSite.prototype.render = function(ctx) {
        const prog = Math.min(1, this.buildProgress / this.buildTime);
        const isPlayer = this.team === PLAYER;

        // Каркас из брёвен
        ctx.strokeStyle = isPlayer ? 'rgba(180,140,60,0.7)' : 'rgba(180,80,30,0.7)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.setLineDash([]);

        // Заполнение прогресса снизу
        ctx.fillStyle = 'rgba(40,30,20,0.5)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = isPlayer ? 'rgba(80,130,60,0.45)' : 'rgba(130,80,30,0.45)';
        ctx.fillRect(this.x, this.y + this.height * (1 - prog), this.width, this.height * prog);

        // Леса (вертикальные столбы)
        ctx.fillStyle = '#4A3018';
        ctx.fillRect(this.x + 4, this.y, 5, this.height);
        ctx.fillRect(this.x + this.width - 9, this.y, 5, this.height);
        // Горизонтальные перекладины
        ctx.fillStyle = '#3A2210';
        for (let ri = 0; ri < 3; ri++) {
            ctx.fillRect(this.x, this.y + this.height * 0.25 * (ri + 1), this.width, 4);
        }

        // HP bar
        const bw = this.width * 0.85;
        const bx2 = this.x + (this.width - bw) / 2;
        ctx.fillStyle = '#050505';
        ctx.fillRect(bx2 - 1, this.y - 10, bw + 2, 7);
        ctx.fillStyle = isPlayer ? '#3A8A20' : '#8A4010';
        ctx.fillRect(bx2, this.y - 9, bw * prog, 5);

        // Иконка
        ctx.font = '14px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(220,200,140,0.8)';
        ctx.fillText('🔨', this.x + this.width / 2, this.y + this.height / 2 - 4);
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${Math.floor(prog * 100)}%`, this.x + this.width / 2, this.y + this.height / 2 + 10);
    };

    console.log('[EnhancedGraphics v3] ConstructionSite patched.');
})();

console.log('[EnhancedGraphics v3] ✅ All texture patches queued. Loading...');