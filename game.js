const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Большая карта — квази-бесконечная (8000x8000 пикселей)
const TILE_SIZE = 32;
const MAP_WIDTH = 150; // Уменьшил с 250 до 150
const MAP_HEIGHT = 150; // Уменьшил с 250 до 150

const PLAYER = 0;
const MOB = 99; // Ночные мобы

const GUARD_RADIUS_TILES = 6;
const DAY_NIGHT_CYCLE_MS = 220000;
const NIGHT_START_PROGRESS = 0.66;
const NIGHT_MOB_SPAWN_INTERVAL_MS = 10000; // Уменьшил с 17000 до 10000 (спавн чаще)
const BASE_MAX_NIGHT_MOBS = 12; // Базовое количество мобов

// Центр карты — спавн игрока
const PLAYER_START_TILE_X = Math.floor(MAP_WIDTH / 2);
const PLAYER_START_TILE_Y = Math.floor(MAP_HEIGHT / 2);

// Конфиги врагов по номеру фракции (их будет 6-10)
const ENEMY_FACTION_NAMES = [
    'Клан Железного Кулака', 'Орден Пепла', 'Лесные Охотники',
    'Каменные Стражи', 'Морские Разбойники', 'Северные Варвары',
    'Пустынные Скитальцы', 'Тёмный Ковен', 'Братство Молота', 'Золотые Клинки'
];

const ENEMY_COLORS = [
    '#FF5722', '#9C27B0', '#F44336', '#FF9800', '#E91E63',
    '#795548', '#607D8B', '#D32F2F', '#7B1FA2', '#FF6F00'
];

const BUILDING_CONFIGS = {
    townhall: { width: 96, height: 96, health: 800, clearance: 36 },
    house: { width: 64, height: 64, health: 350, clearance: 18, cost: { wood: 50 }, buildTime: 5000 },
    storage: { width: 80, height: 80, health: 450, clearance: 24, cost: { wood: 100, stone: 80 }, buildTime: 8000 },
    barracks: { width: 96, height: 96, health: 650, clearance: 28, cost: { wood: 100, stone: 50 }, buildTime: 10000 },
    farm: { width: 88, height: 88, health: 420, clearance: 26, cost: { wood: 80, stone: 30 }, buildTime: 6000 },
    archertower: { width: 72, height: 72, health: 520, clearance: 26, cost: { wood: 180, stone: 120 }, buildTime: 11000 },
    forge: { width: 84, height: 84, health: 550, clearance: 24, cost: { wood: 150, stone: 100 }, buildTime: 12000 },
    magictower: { width: 72, height: 72, health: 520, clearance: 30, cost: { wood: 200, stone: 150 }, buildTime: 15000 },
    beacon: { width: 48, height: 48, health: 250, clearance: 16, cost: { wood: 60, stone: 40 }, buildTime: 7000, visionRadius: 200, nightBonus: true }
};

const ARCHER_TOWER_LEVELS = {
    1: { damage: 16, range: 220, cooldown: 950, healthBonus: 0, upgradeCost: null },
    2: { damage: 24, range: 255, cooldown: 800, healthBonus: 120, upgradeCost: { wood: 180, stone: 140 } },
    3: { damage: 34, range: 290, cooldown: 700, healthBonus: 260, upgradeCost: { wood: 260, stone: 210 } }
};

const STORAGE_LEVELS = {
    1: { capacity: 200, healthBonus: 0, upgradeCost: null },
    2: { capacity: 350, healthBonus: 100, upgradeCost: { wood: 150, stone: 120 } },
    3: { capacity: 550, healthBonus: 200, upgradeCost: { wood: 250, stone: 200 } }
};

const FARM_LEVELS = {
    1: { foodRate: 5, interval: 10000, healthBonus: 0, upgradeCost: null },
    2: { foodRate: 8, interval: 10000, healthBonus: 80, upgradeCost: { wood: 120, stone: 60 } },
    3: { foodRate: 12, interval: 10000, healthBonus: 150, upgradeCost: { wood: 200, stone: 100 } }
};

const RESOURCE_VARIANTS = {
    wood: [
        { key: 'birch', name: 'Береза', amount: 75, gatherAmount: 8, size: 0.9, primaryColor: '#78b159', secondaryColor: '#d9c9a3' },
        { key: 'oak', name: 'Дуб', amount: 110, gatherAmount: 10, size: 1.05, primaryColor: '#3d8b3d', secondaryColor: '#8B5A2B' },
        { key: 'pine', name: 'Сосна', amount: 150, gatherAmount: 12, size: 1.2, primaryColor: '#2f6f3e', secondaryColor: '#6f4b2a' }
    ],
    stone: [
        { key: 'limestone', name: 'Известняк', amount: 80, gatherAmount: 8, size: 0.9, primaryColor: '#9d9d9d', secondaryColor: '#cfcfcf' },
        { key: 'granite', name: 'Гранит', amount: 120, gatherAmount: 10, size: 1.05, primaryColor: '#7a7a82', secondaryColor: '#b3b3bb' },
        { key: 'basalt', name: 'Базальт', amount: 155, gatherAmount: 12, size: 1.18, primaryColor: '#5f6770', secondaryColor: '#949ca4' }
    ],
    food: [
        { key: 'riverfish', name: 'Речная рыба', amount: 95, gatherAmount: 9, size: 0.9, primaryColor: '#73cfe8', secondaryColor: '#d9f5fb' },
        { key: 'lakefish', name: 'Озерная рыба', amount: 130, gatherAmount: 11, size: 1.05, primaryColor: '#4db6d6', secondaryColor: '#c6eef8' }
    ]
};

const WORKER_PROFESSIONS = {
    generalist: 'Рабочий', lumberjack: 'Дровосек', miner: 'Шахтер', fisher: 'Рыбак'
};
const WORKER_RESOURCE_TYPES = {
    generalist: null, lumberjack: 'wood', miner: 'stone', fisher: 'food'
};
const WORKER_TRAINING_OPTIONS = {
    lumberjack: { icon: '🪓', cost: { wood: 45, stone: 10, food: 0 } },
    miner: { icon: '⛏️', cost: { wood: 40, stone: 20, food: 0 } },
    fisher: { icon: '🎣', cost: { wood: 35, stone: 0, food: 15 } }
};
const WORKER_UPGRADE_LEVELS = {
    1: { speedMultiplier: 0.92, yieldBonus: 1, cost: { wood: 70, stone: 40, food: 10 } },
    2: { speedMultiplier: 0.84, yieldBonus: 2, cost: { wood: 120, stone: 80, food: 20 } },
    3: { speedMultiplier: 0.76, yieldBonus: 3, cost: { wood: 190, stone: 130, food: 35 } }
};

const AUTO_RESOURCE_CHAIN_MIN = 1;
const AUTO_RESOURCE_CHAIN_MAX = 3;
const MULTIPLAYER_SNAPSHOT_INTERVAL_MS = 100;
const MULTIPLAYER_ROOM_PREFIX = 'mageim-room-';

// ===================== АРТЕФАКТЫ И ДАНЖИ =====================
const ARTIFACT_TYPES = {
    SPEED: { name: 'Скорость', icon: '⚡', stat: 'speed' },
    STRENGTH: { name: 'Сила', icon: '💪', stat: 'strength' },
    HEALTH: { name: 'Здоровье', icon: '❤️', stat: 'health' }
};

const ARTIFACT_RARITY = {
    COMMON: { name: 'Обычный', bonus: 0.1, color: '#FFD700', chance: 0.7 },
    RARE: { name: 'Редкий', bonus: 0.2, color: '#8A2BE2', chance: 0.3 }
};

const DUNGEON_COUNT = 8; // Уменьшил с 18 до 8 данжей
const DUNGEON_ARTIFACT_CHANCE = 0.65; // 65% шанс найти артефакт в данже

function getBuildingConfig(type) {
    return BUILDING_CONFIGS[type] || { width: 64, height: 64, health: 500, clearance: 20, cost: {}, buildTime: 5000 };
}
function getStructureCenter(s) {
    return { x: s.x + (s.width || 0) / 2, y: s.y + (s.height || 0) / 2 };
}
function getEntityCenter(e) {
    return e.width ? getStructureCenter(e) : { x: e.x, y: e.y };
}
function getBuildingDisplayName(type) {
    const names = {
        townhall:'Ратуша', house:'Дом', storage:'Склад', barracks:'Казарма',
        farm:'Ферма', archertower:'Башня лучников', forge:'Кузница', magictower:'Магическая башня',
        beacon:'Костер'
    };
    return names[type] || 'Здание';
}
function getWorkerProfessionLabel(p) { return WORKER_PROFESSIONS[p] || WORKER_PROFESSIONS.generalist; }
function getWorkerResourceType(p) { return WORKER_RESOURCE_TYPES[p] || null; }
function getWorkerProfessionIcon(p) { return WORKER_TRAINING_OPTIONS[p]?.icon || '👷'; }
function createWorkerUpgradeState() { return { lumberjack: 0, miner: 0, fisher: 0 }; }
function formatResourceCost(cost) {
    return [cost.wood?`${cost.wood}🪵`:null, cost.stone?`${cost.stone}🪨`:null, cost.food?`${cost.food}🍖`:null].filter(Boolean).join(', ');
}
function canAffordCost(player, cost) {
    return (player.wood||0)>=(cost.wood||0) && (player.stone||0)>=(cost.stone||0) && (player.food||0)>=(cost.food||0);
}
function spendCost(player, cost) {
    player.wood -= cost.wood||0; player.stone -= cost.stone||0; player.food -= cost.food||0;
}
function distBetween(ax, ay, bx, by) { return Math.hypot(bx-ax, by-ay); }

// ===================== АРТЕФАКТ =====================
class Artifact {
    constructor(type, rarity) {
        this.type = type;
        this.rarity = rarity;
        this.bonus = rarity.bonus;
    }

    getDescription() {
        const typeInfo = ARTIFACT_TYPES[this.type];
        const bonus = Math.round(this.bonus * 100);
        return `${typeInfo.icon} ${typeInfo.name} +${bonus}% (${this.rarity.name})`;
    }

    apply(unit) {
        const stat = ARTIFACT_TYPES[this.type].stat;
        if (!unit.artifactBonuses) unit.artifactBonuses = {};
        unit.artifactBonuses[stat] = (unit.artifactBonuses[stat] || 0) + this.bonus;
    }
}

// ===================== ДАНЖ =====================
class Dungeon {
    constructor(x, y, game = null) {
        this.x = x;
        this.y = y;
        this.explored = false;
        this.hasArtifact = Math.random() < DUNGEON_ARTIFACT_CHANCE;
        this.size = 96; // Увеличил размер
        this.guardRadius = 200; // Радиус охраны
        this.guards = []; // Защитники данжа
        this.respawnTimer = 0;
        this.respawnDelay = 180000; // 3 минуты на респавн (увеличено с 60 секунд)
        this.captureProgress = 0; // Прогресс захвата (0-100)
        this.captureTime = 15000 + Math.random() * 10000; // 15-25 секунд на захват
        // В кооперативе требуется 2 персонажа, в одиночной игре 2-4 воина
        this.requiredWarriors = (game && game.mpEnabled) ? 2 : (2 + Math.floor(Math.random() * 3));
        this.capturing = false;
    }

    spawnGuards(game) {
        // Очищаем старых защитников
        this.guards.forEach(g => {
            const idx = game.entities.indexOf(g);
            if (idx > -1) game.entities.splice(idx, 1);
        });
        this.guards = [];

        // В кооперативе меньше защитников (1-2), в одиночной игре больше (2-4)
        let guardCount;
        if (game.mpEnabled) {
            guardCount = this.hasArtifact ? 2 : 1;
        } else {
            guardCount = this.hasArtifact ? (3 + Math.floor(Math.random() * 2)) : (2 + Math.floor(Math.random() * 2));
        }

        for (let i = 0; i < guardCount; i++) {
            const angle = (Math.PI * 2 / guardCount) * i;
            const dist = 60 + Math.random() * 40;
            const gx = this.x + Math.cos(angle) * dist;
            const gy = this.y + Math.sin(angle) * dist;

            const guard = new Unit(gx, gy, 'mob', MOB);
            guard.isDungeonGuard = true;
            guard.dungeonX = this.x;
            guard.dungeonY = this.y;
            guard.guardRadius = this.guardRadius;
            guard.homeX = gx;
            guard.homeY = gy;

            // Усиливаем защитников если есть артефакт
            if (this.hasArtifact) {
                guard.health *= 1.5;
                guard.maxHealth *= 1.5;
                guard.damage *= 1.3;
            }

            this.guards.push(guard);
            game.entities.push(guard);
        }
    }

    explore() {
        if (this.explored) return null;
        this.explored = true;

        if (this.hasArtifact) {
            // Определяем редкость
            const rarity = Math.random() < ARTIFACT_RARITY.RARE.chance
                ? ARTIFACT_RARITY.RARE
                : ARTIFACT_RARITY.COMMON;

            // Случайный тип артефакта
            const types = Object.keys(ARTIFACT_TYPES);
            const type = types[Math.floor(Math.random() * types.length)];

            return new Artifact(type, rarity);
        }
        return null;
    }

    update(dt, game) {
        // Если данж исследован, начинаем таймер респавна
        if (this.explored) {
            this.respawnTimer += dt;
            if (this.respawnTimer >= this.respawnDelay) {
                // Респавн данжа
                this.explored = false;
                this.hasArtifact = Math.random() < DUNGEON_ARTIFACT_CHANCE;
                this.respawnTimer = 0;
                this.captureProgress = 0;
                this.captureTime = 15000 + Math.random() * 10000;
                // В кооперативе требуется 2 персонажа, в одиночной игре 2-4 воина
                this.requiredWarriors = game.mpEnabled ? 2 : (2 + Math.floor(Math.random() * 3));
                this.capturing = false;
                this.spawnGuards(game);
            }
        }

        // Проверяем живы ли защитники
        this.guards = this.guards.filter(g => g.health > 0 && game.entities.includes(g));

        // Обработка захвата данжа
        if (!this.explored && this.guards.length === 0) {
            // Подсчитываем воинов/персонажей игрока рядом с данжем
            const nearbyWarriors = game.entities.filter(u => {
                if (u.team !== PLAYER) return false;
                if (!this.contains(u.x, u.y)) return false;

                // В кооперативе считаем персонажей, в одиночной игре - воинов
                if (game.mpEnabled) {
                    return u instanceof PlayerCharacter;
                } else {
                    return u.type !== 'worker';
                }
            });

            if (nearbyWarriors.length >= this.requiredWarriors) {
                // Начинаем/продолжаем захват
                this.capturing = true;
                this.captureProgress += dt;

                if (this.captureProgress >= this.captureTime) {
                    // Захват завершен
                    const artifact = this.explore();
                    if (artifact) {
                        game.artifacts.push(artifact);
                        const playerUnits = game.entities.filter(u => u.team === PLAYER);
                        for (let i = 0; i < playerUnits.length; i++) {
                            artifact.apply(playerUnits[i]);
                        }
                        game.showNotification(`🎉 Данж захвачен! Найден артефакт: ${artifact.getDescription()}`);
                    } else {
                        game.showNotification('✅ Данж захвачен, но артефакт не найден.');
                    }
                    this.capturing = false;
                }
            } else {
                // Недостаточно воинов - сбрасываем прогресс
                if (this.capturing) {
                    this.captureProgress = Math.max(0, this.captureProgress - dt * 2); // Откат в 2 раза быстрее
                    if (this.captureProgress <= 0) {
                        this.capturing = false;
                    }
                }
            }
        }
    }

    render(ctx) {
        // Основа данжа - темный камень
        ctx.fillStyle = this.explored ? '#666' : '#3a1c1a';
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);

        // Внутренняя часть
        ctx.fillStyle = this.explored ? '#888' : '#5a3c3a';
        ctx.fillRect(this.x - this.size/2 + 8, this.y - this.size/2 + 8, this.size - 16, this.size - 16);

        // Башни по углам (только для неисследованных)
        if (!this.explored) {
            ctx.fillStyle = '#2a0c0a';
            const towerSize = 16;
            ctx.fillRect(this.x - this.size/2, this.y - this.size/2, towerSize, towerSize);
            ctx.fillRect(this.x + this.size/2 - towerSize, this.y - this.size/2, towerSize, towerSize);
            ctx.fillRect(this.x - this.size/2, this.y + this.size/2 - towerSize, towerSize, towerSize);
            ctx.fillRect(this.x + this.size/2 - towerSize, this.y + this.size/2 - towerSize, towerSize, towerSize);
        }

        // Иконка
        ctx.fillStyle = '#fff';
        ctx.font = this.explored ? '40px Arial' : '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.explored ? '✓' : '🏰', this.x, this.y);

        // Таймер респавна
        if (this.explored && this.respawnTimer > 0) {
            const timeLeft = Math.ceil((this.respawnDelay - this.respawnTimer) / 1000);
            ctx.fillStyle = '#FFD700';
            ctx.font = '14px Arial';
            ctx.fillText(`${timeLeft}s`, this.x, this.y + 40);
        }

        // Яркая подсветка если есть артефакт
        if (!this.explored && this.hasArtifact) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.strokeRect(this.x - this.size/2 - 4, this.y - this.size/2 - 4, this.size + 8, this.size + 8);

            // Мерцающий эффект
            const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - this.size/2 - 8, this.y - this.size/2 - 8, this.size + 16, this.size + 16);
        }

        // Рамка для всех данжей
        ctx.strokeStyle = this.explored ? '#444' : '#8B4513';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);

        // Показываем зону охраны (полупрозрачный круг)
        if (!this.explored) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.guardRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Показываем прогресс захвата
        if (this.capturing && this.captureProgress > 0) {
            const barWidth = this.size;
            const barHeight = 8;
            const barX = this.x - barWidth / 2;
            const barY = this.y - this.size / 2 - 20;

            // Фон полоски
            ctx.fillStyle = '#000';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Прогресс
            const progress = Math.min(1, this.captureProgress / this.captureTime);
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);

            // Рамка
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            // Текст прогресса
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Захват: ${Math.floor(progress * 100)}%`, this.x, barY - 8);
        }

        // Показываем требования к захвату (если защитники убиты, но захват не начат)
        if (!this.explored && this.guards.length === 0 && !this.capturing) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            const text = `Нужно ${this.requiredWarriors} воинов`;
            ctx.strokeText(text, this.x, this.y + this.size / 2 + 20);
            ctx.fillText(text, this.x, this.y + this.size / 2 + 20);
        }
    }

    contains(x, y) {
        return Math.abs(x - this.x) < this.size/2 && Math.abs(y - this.y) < this.size/2;
    }
}

// ===================== ENVIRONMENT PALETTE =====================
const ENVIRONMENT_PALETTE = {
    tree: {
        trunk: '#2A1F1A',
        bark: '#1F1612',
        leaves: '#1A2C0F',
        leavesLight: '#2A4A18',
        shadow: '#0D0F0A'
    },
    rock: {
        base: '#3A3A3A',
        detail: '#1A1A1A',
        highlight: '#5A5A5A',
        shadow: '#0D0D0D'
    },
    fish: {
        body: '#2A3D3D',
        scale: '#3D5252',
        fin: '#1A2626',
        eye: '#8B0000'
    }
};

// ===================== BRUTAL PARTICLES =====================
class BrutalParticle {
    constructor(x, y, type = 'blood') {
        this.x = x;
        this.y = y;
        this.type = type; // 'blood', 'ash', 'spark', 'dark_magic'
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4 - 2; // Вверх
        this.life = 1.0; // 0-1
        this.decay = 0.01 + Math.random() * 0.02;
        this.size = 2 + Math.random() * 4;
        this.gravity = type === 'blood' ? 0.3 : (type === 'ash' ? -0.1 : 0.1);
    }

    update(dt) {
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.vy += this.gravity;
        this.life -= this.decay;
        return this.life > 0;
    }

    render(ctx, cameraX, cameraY) {
        ctx.globalAlpha = this.life;

        switch(this.type) {
            case 'blood':
                ctx.fillStyle = '#8B0000';
                ctx.shadowColor = '#FF0000';
                ctx.shadowBlur = 4;
                break;
            case 'ash':
                ctx.fillStyle = '#2A2A2A';
                ctx.shadowColor = '#555';
                ctx.shadowBlur = 3;
                break;
            case 'spark':
                ctx.fillStyle = '#FF8C00';
                ctx.shadowColor = '#FFA500';
                ctx.shadowBlur = 8;
                break;
            case 'dark_magic':
                ctx.fillStyle = '#7000A8';
                ctx.shadowColor = '#A800FF';
                ctx.shadowBlur = 10;
                break;
        }

        ctx.beginPath();
        if (this.type === 'spark' || this.type === 'dark_magic') {
            ctx.arc(this.x - cameraX, this.y - cameraY, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(this.x - cameraX - this.size/2, this.y - cameraY - this.size/2, this.size, this.size);
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
}

// ===================== FACTION (враг) =====================
class Faction {
    constructor(id, centerTileX, centerTileY, difficulty) {
        this.id = id; // начиная с 1
        this.teamId = id; // уникальный teamId
        this.name = ENEMY_FACTION_NAMES[(id-1) % ENEMY_FACTION_NAMES.length];
        this.color = ENEMY_COLORS[(id-1) % ENEMY_COLORS.length];
        this.difficulty = difficulty; // 1..10
        this.centerX = centerTileX * TILE_SIZE;
        this.centerY = centerTileY * TILE_SIZE;
        this.alive = true;
        this.aiTimer = Math.random() * 2000; // разброс таймеров
        // Бюджеты сложности - уменьшены для баланса с персонажами (было *180, стало *90)
        this.startBonus = Math.floor(difficulty * 90);
        this.player = {
            wood: 200 + this.startBonus,
            stone: 100 + Math.floor(this.startBonus * 0.7),
            food: 100 + Math.floor(this.startBonus * 0.5),
            population: 0,
            maxPopulation: 8 + difficulty * 2, // Уменьшено с 10 + difficulty * 3
            team: this.teamId,
            townHallLevel: Math.max(1, Math.floor(difficulty / 3)),
            maxStorage: 200 + difficulty * 50,
            workerUpgrades: createWorkerUpgradeState()
        };
        // Агрессия — реже атакуют (увеличен интервал)
        this.aggressionInterval = Math.max(25000, 80000 - difficulty * 4000); // Было 15000 и 60000
        this.aggressionTimer = this.aggressionInterval * (0.5 + Math.random() * 0.8);
        // Состояние агрессии: idle, preparing, attacking, retreating
        this.aggressionState = 'idle';
        this.attackCooldown = 0;
        // Цель атаки (другая фракция или игрок)
        this.currentTarget = null; // teamId

        // Система волн для захвата аванпоста
        this.underSiege = false; // Находится ли под осадой
        this.currentWave = 0; // Текущая волна (0 = не начата)
        this.totalWaves = 3; // Всего волн для захвата
        this.waveTimer = 0; // Таймер до следующей волны
        this.waveInterval = 30000; // 30 секунд между волнами
        this.waveSpawned = false; // Была ли заспавнена текущая волна
    }
}

class MultiplayerSync {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.connection = null;
        this.snapshotTimer = 0;
        this.roomId = null;
        this.pendingCreate = null;
        this.pendingJoin = null;
        this.statusText = 'Одиночная игра';
    }

    assignEntityId(entity) {
        if (!entity) return null;
        if (!entity.id) entity.id = `u${this.game.nextEntityId++}`;
        return entity.id;
    }

    assignBuildingId(building) {
        if (!building) return null;
        if (!building.id) building.id = `b${this.game.nextBuildingId++}`;
        return building.id;
    }

    ensureNetworkIds() {
        this.game.entities.forEach(entity => this.assignEntityId(entity));
        this.game.buildings.forEach(building => this.assignBuildingId(building));
    }

    findResourceIndex(resource) {
        return this.game.resources.indexOf(resource);
    }

    findEntityById(id) {
        return this.game.entities.find(entity => entity.id === id) || null;
    }

    findBuildingById(id) {
        return this.game.buildings.find(building => building.id === id) || null;
    }

    findTargetById(id) {
        return this.findEntityById(id) || this.findBuildingById(id);
    }

    destroyPeer() {
        if (this.connection) {
            try { this.connection.close(); } catch (e) {}
        }
        if (this.socket) {
            try { this.socket.close(); } catch (e) {}
        }
        this.socket = null;
        this.connection = null;
        this.game.connection = null;
        this.roomId = null;
        this.pendingCreate = null;
        this.pendingJoin = null;
    }

    updateStatus(text, isError=false) {
        this.statusText = text;
        this.game.setMultiplayerStatus(text, isError);
    }

    getSocketUrl() {
        if (window.MAGEIM_MULTIPLAYER_WS_URL) return window.MAGEIM_MULTIPLAYER_WS_URL;
        if (!window.location || window.location.protocol === 'file:') {
            throw new Error('Для коопа нужно открыть игру через сервер. Запустите node server.js и откройте http://localhost:8787');
        }
        const isSecure = window.location.protocol === 'https:';
        return `${isSecure ? 'wss' : 'ws'}://${window.location.host}/ws`;
    }

    createRelayConnection(socket) {
        return {
            open: false,
            close: () => {
                try { socket.close(); } catch (e) {}
            },
            send: payload => {
                if (socket.readyState !== WebSocket.OPEN) return false;
                socket.send(JSON.stringify({ type: 'relay', payload }));
                return true;
            }
        };
    }

    clearPendingRequest(type, error=null, value=null) {
        const pending = type === 'create' ? this.pendingCreate : this.pendingJoin;
        if (!pending) return;
        if (type === 'create') this.pendingCreate = null;
        else this.pendingJoin = null;
        if (error) pending.reject(error);
        else pending.resolve(value);
    }

    handleServerEnvelope(message) {
        if (!message || typeof message !== 'object') return;

        switch (message.type) {
            case 'room_created':
                this.roomId = message.roomId;
                this.updateStatus(`Кооп: хост (${message.roomId})`);
                this.clearPendingRequest('create', null, message.roomId);
                break;

            case 'joined_room':
                this.roomId = message.roomId;
                if (this.connection) this.connection.open = true;
                this.updateStatus('Кооп: подключено к хосту');
                this.game.showNotification('Подключение к комнате успешно');
                console.log('[MP] Joined room as guest, waiting for snapshots');
                this.clearPendingRequest('join', null, message.roomId);
                break;

            case 'peer_joined':
                if (this.connection) this.connection.open = true;
                this.updateStatus('Кооп: игрок подключен');
                this.game.showNotification('Друг подключился к комнате');
                console.log('[MP] Peer joined, starting to send snapshots');
                // Создаем персонажа гостя рядом с персонажем хоста
                if (this.game.hostCharacter && !this.game.guestCharacter) {
                    const guestCharacter = new PlayerCharacter(
                        this.game.hostCharacter.x + 50,
                        this.game.hostCharacter.y,
                        'guest'
                    );
                    this.game.entities.push(guestCharacter);
                    this.game.guestCharacter = guestCharacter;
                    this.assignEntityId(guestCharacter);
                    this.game.players[PLAYER].population = 2;
                    console.log('[MP] Host: created guest character at', guestCharacter.x, guestCharacter.y, 'id:', guestCharacter.id, 'playerRole:', guestCharacter.playerRole);
                } else {
                    console.warn('[MP] Host: cannot create guest character. hostCharacter:', this.game.hostCharacter, 'guestCharacter:', this.game.guestCharacter);
                }
                this.ensureNetworkIds();
                console.log('[MP] Host: total entities before snapshot:', this.game.entities.length, 'with playerRole:', this.game.entities.filter(e => e.playerRole).length);
                this.sendSnapshot(true);
                break;

            case 'peer_left':
                if (this.connection) this.connection.open = false;
                this.updateStatus(this.game.mpIsHost ? 'Кооп: гость отключился' : 'Кооп: соединение потеряно', !this.game.mpIsHost);
                this.game.showNotification(this.game.mpIsHost ? 'Гость вышел из комнаты' : 'Связь с сервером потеряна');
                break;

            case 'relay':
                this.handleMessage(message.payload);
                break;

            case 'error': {
                const error = new Error(message.message || 'Ошибка сервера коопа');
                this.updateStatus(`Кооп: ${error.message}`, true);
                if (this.pendingJoin) this.clearPendingRequest('join', error);
                else if (this.pendingCreate) this.clearPendingRequest('create', error);
                else console.error(error);
                break;
            }
        }
    }

    createServerHostedRoom() {
        this.destroyPeer();
        this.snapshotTimer = 0;

        return new Promise((resolve, reject) => {
            this.pendingCreate = { resolve, reject };
            const socket = new WebSocket(this.getSocketUrl());
            this.attachServerSocket(socket, true, () => {
                this.updateStatus('Кооп: создаем комнату...');
                socket.send(JSON.stringify({ type: 'create_room' }));
            }, reject);
        });
    }

    joinServerHostedRoom(roomId) {
        this.destroyPeer();
        this.snapshotTimer = 0;

        return new Promise((resolve, reject) => {
            this.pendingJoin = { resolve, reject };
            const socket = new WebSocket(this.getSocketUrl());
            this.attachServerSocket(socket, false, () => {
                this.updateStatus(`Кооп: подключение к ${roomId}...`);
                socket.send(JSON.stringify({ type: 'join_room', roomId }));
            }, reject);
        });
    }

    attachServerSocket(socket, isHost, onOpen=null, onError=null) {
        this.socket = socket;
        this.connection = this.createRelayConnection(socket);
        this.game.connection = this.connection;
        this.game.mpEnabled = true;
        this.game.mpIsHost = isHost;
        this.game.multiplayerMode = isHost ? 'host' : 'guest';
        this.game.isHost = isHost;

        socket.addEventListener('open', () => {
            if (typeof onOpen === 'function') onOpen();
        });

        socket.addEventListener('message', event => {
            try {
                const message = JSON.parse(event.data);
                this.handleServerEnvelope(message);
            } catch (error) {
                console.error('Socket message parse error:', error);
            }
        });

        socket.addEventListener('close', () => {
            const joinPending = Boolean(this.pendingJoin);
            const createPending = Boolean(this.pendingCreate);
            if (this.connection) this.connection.open = false;
            this.socket = null;
            if (joinPending) this.clearPendingRequest('join', new Error('Соединение с сервером закрыто'));
            if (createPending) this.clearPendingRequest('create', new Error('Соединение с сервером закрыто'));
            if (!joinPending && !createPending) {
                this.updateStatus(this.game.mpIsHost ? 'Кооп: гость отключился' : 'Кооп: соединение потеряно', !this.game.mpIsHost);
                this.game.showNotification(this.game.mpIsHost ? 'Гость вышел из комнаты' : 'Связь с сервером потеряна');
            }
        });

        socket.addEventListener('error', () => {
            const error = new Error('Ошибка канала связи с сервером');
            console.error(error);
            this.updateStatus('Кооп: ошибка канала', true);
            if (typeof onError === 'function') onError(error);
        });
    }

    createHostRoom() {
        if (typeof Peer !== 'function') {
            throw new Error('PeerJS не загрузился');
        }

        this.destroyPeer();
        this.snapshotTimer = 0;

        return new Promise((resolve, reject) => {
            const roomId = `${MULTIPLAYER_ROOM_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
            const peer = new Peer(roomId);
            let settled = false;

            peer.on('open', id => {
                this.peer = peer;
                this.game.mpEnabled = true;
                this.game.mpIsHost = true;
                this.game.multiplayerMode = 'host';
                this.game.isHost = true;
                this.ensureNetworkIds();
                this.updateStatus(`Кооп: хост (${id})`);

                peer.on('connection', connection => {
                    if (this.connection && this.connection.open) {
                        connection.on('open', () => connection.close());
                        this.game.showNotification('Комната уже занята');
                        return;
                    }
                    this.attachConnection(connection, true);
                });

                settled = true;
                resolve(id);
            });

            peer.on('error', error => {
                this.updateStatus('Кооп: ошибка соединения', true);
                if (!settled) {
                    settled = true;
                    reject(error);
                } else {
                    console.error('Peer error:', error);
                }
            });
        });
    }

    joinRoom(roomId) {
        if (typeof Peer !== 'function') {
            throw new Error('PeerJS не загрузился');
        }

        this.destroyPeer();
        this.snapshotTimer = 0;

        return new Promise((resolve, reject) => {
            const peer = new Peer();
            let settled = false;

            peer.on('open', () => {
                this.peer = peer;
                this.game.mpEnabled = true;
                this.game.mpIsHost = false;
                this.game.multiplayerMode = 'guest';
                this.game.isHost = false;
                this.updateStatus(`Кооп: подключение к ${roomId}...`);
                const connection = peer.connect(roomId, { reliable: true, serialization: 'json' });
                this.attachConnection(connection, false, () => {
                    if (!settled) {
                        settled = true;
                        resolve();
                    }
                }, error => {
                    if (!settled) {
                        settled = true;
                        reject(error);
                    }
                });
            });

            peer.on('error', error => {
                this.updateStatus('Кооп: ошибка подключения', true);
                if (!settled) {
                    settled = true;
                    reject(error);
                } else {
                    console.error('Peer error:', error);
                }
            });
        });
    }

    attachConnection(connection, isHost, onOpen=null, onError=null) {
        this.connection = connection;
        this.game.connection = connection;

        connection.on('open', () => {
            this.game.mpEnabled = true;
            this.game.mpIsHost = isHost;
            this.game.multiplayerMode = isHost ? 'host' : 'guest';
            this.game.isHost = isHost;
            this.updateStatus(isHost ? 'Кооп: игрок подключен' : 'Кооп: подключено к хосту');
            this.game.showNotification(isHost ? 'Друг подключился к комнате' : 'Подключение к комнате успешно');
            if (isHost) {
                // Создаем персонажа гостя рядом с персонажем хоста
                if (this.game.hostCharacter && !this.game.guestCharacter) {
                    const guestCharacter = new PlayerCharacter(
                        this.game.hostCharacter.x + 50,
                        this.game.hostCharacter.y,
                        'guest'
                    );
                    this.game.entities.push(guestCharacter);
                    this.game.guestCharacter = guestCharacter;
                    this.assignEntityId(guestCharacter);
                    this.game.players[PLAYER].population = 2;
                    console.log('[MP] Host: created guest character at', guestCharacter.x, guestCharacter.y, 'id:', guestCharacter.id, 'playerRole:', guestCharacter.playerRole);
                } else {
                    console.warn('[MP] Host: cannot create guest character. hostCharacter:', this.game.hostCharacter, 'guestCharacter:', this.game.guestCharacter);
                }
                this.ensureNetworkIds();
                console.log('[MP] Host: total entities before snapshot:', this.game.entities.length, 'with playerRole:', this.game.entities.filter(e => e.playerRole).length);
                this.sendSnapshot(true);
            }
            if (typeof onOpen === 'function') onOpen();
        });

        connection.on('data', data => this.handleMessage(data));
        connection.on('close', () => {
            this.connection = null;
            this.game.connection = null;
            this.updateStatus(this.game.mpIsHost ? 'Кооп: гость отключился' : 'Кооп: соединение потеряно', !this.game.mpIsHost);
            this.game.showNotification(this.game.mpIsHost ? 'Гость вышел из комнаты' : 'Связь с хостом потеряна');
            if (typeof onError === 'function' && !isHost) onError(new Error('Соединение закрыто'));
        });
        connection.on('error', error => {
            console.error('Connection error:', error);
            this.updateStatus('Кооп: ошибка канала', true);
            if (typeof onError === 'function') onError(error);
        });
    }

    sendAction(action) {
        if (!this.connection || !this.connection.open) {
            console.log('[MP] sendAction failed: connection not open');
            return false;
        }
        this.ensureNetworkIds();
        console.log('[MP] Sending action:', action.type);
        this.connection.send({ kind: 'action', action });
        return true;
    }

    tick(dt) {
        if (!this.game.mpEnabled || !this.connection || !this.connection.open) return;
        if (!this.game.mpIsHost) return; // Гость только получает снапшоты
        this.snapshotTimer += dt;
        if (this.snapshotTimer >= MULTIPLAYER_SNAPSHOT_INTERVAL_MS) {
            this.snapshotTimer = 0;
            if (!this._snapshotCount) this._snapshotCount = 0;
            this._snapshotCount++;
            if (this._snapshotCount % 50 === 0) {
                console.log('[MP] Host sent', this._snapshotCount, 'snapshots');
            }
            this.sendSnapshot();
        }
    }

    sendSnapshot(force=false) {
        if (!this.connection || !this.connection.open) return;
        if (!force && !this.game.mpEnabled) return;
        this.ensureNetworkIds();
        const snapshot = this.createSnapshot();
        this.connection.send({ kind: 'snapshot', snapshot });
    }

    createSnapshot() {
        this.game.ensureHouseOccupancyState();
        return {
            version: 1,
            gameTime: this.game.gameTime,
            dayNightTimer: this.game.dayNightTimer,
            isNight: this.game.isNight,
            nightCounter: this.game.nightCounter,
            enemyPowerLevel: this.game.enemyPowerLevel,
            players: JSON.parse(JSON.stringify(this.game.players)),
            factions: this.game.factions.map(faction => ({
                id: faction.id,
                teamId: faction.teamId,
                name: faction.name,
                color: faction.color,
                difficulty: faction.difficulty,
                alive: faction.alive,
                centerX: faction.centerX,
                centerY: faction.centerY,
                aggressionState: faction.aggressionState,
                player: JSON.parse(JSON.stringify(this.game.players[faction.teamId] || faction.player || {}))
            })),
            waterTiles: Array.from(this.game.waterTiles),
            buildings: this.game.buildings.map(building => ({
                id: this.assignBuildingId(building),
                x: building.x,
                y: building.y,
                type: building.type,
                team: building.team,
                health: building.health,
                maxHealth: building.maxHealth,
                level: building.level || 1,
                lastAttackTime: building.lastAttackTime || 0,
                maxOccupants: building.maxOccupants || 0,
                occupantIds: (building.occupants || []).map(unit => unit?.id).filter(Boolean),
                reservedIds: (building.reservedOccupants || [])
                    .map(unit => unit?.id)
                    .filter(id => id && !(building.occupants || []).some(unit => unit?.id === id))
            })),
            entities: this.game.entities.map(entity => ({
                id: this.assignEntityId(entity),
                x: entity.x,
                y: entity.y,
                targetX: entity.targetX,
                targetY: entity.targetY,
                type: entity.type,
                team: entity.team,
                profession: entity.profession,
                playerRole: entity.playerRole || null, // Для PlayerCharacter
                health: entity.health,
                maxHealth: entity.maxHealth,
                level: entity.level || 1,
                experience: entity.experience || 0,
                experienceToNextLevel: entity.experienceToNextLevel || 100,
                damage: entity.damage,
                speed: entity.speed,
                guardMode: entity.guardMode,
                guardX: entity.guardX,
                guardY: entity.guardY,
                guardRadius: entity.guardRadius,
                guardModeSetTime: entity.guardModeSetTime || 0,
                isResting: entity.isResting,
                insideHouse: entity.insideHouse,
                restingHouseId: entity.restingHouse?.id || null,
                carrying: entity.carrying ? { ...entity.carrying } : null,
                starving: Boolean(entity.starving),
                attackCooldown: entity.attackCooldown || 0
            })),
            resources: this.game.resources.map(resource => ({
                x: resource.x,
                y: resource.y,
                type: resource.type,
                amount: resource.amount,
                maxAmount: resource.maxAmount,
                gatherAmount: resource.gatherAmount,
                size: resource.size,
                variantKey: resource.variant?.key || null,
                primaryColor: resource.primaryColor,
                secondaryColor: resource.secondaryColor,
                depleted: resource.depleted
            })),
            dungeons: this.game.dungeons.map(dungeon => ({
                x: dungeon.x,
                y: dungeon.y,
                explored: dungeon.explored,
                hasArtifact: dungeon.hasArtifact,
                respawnTimer: dungeon.respawnTimer,
                captureProgress: dungeon.captureProgress,
                captureTime: dungeon.captureTime,
                requiredWarriors: dungeon.requiredWarriors,
                capturing: dungeon.capturing
            })),
            constructionSites: this.game.constructionSites.map(site => ({
                x: site.x,
                y: site.y,
                buildingType: site.buildingType,
                team: site.team,
                buildProgress: site.buildProgress,
                buildTime: site.buildTime
            })),
            weather: {
                currentWeather: this.game.weatherSystem.currentWeather,
                nextWeatherChange: this.game.weatherSystem.nextWeatherChange,
                transitionProgress: this.game.weatherSystem.transitionProgress,
                transitionStartTime: this.game.weatherSystem.transitionStartTime,
                lightningFlash: this.game.weatherSystem.lightningFlash
            }
        };

        // Логируем entities с playerRole
        const entitiesWithRole = snapshot.entities.filter(e => e.playerRole);
        if (entitiesWithRole.length > 0) {
            console.log('[MP] createSnapshot: entities with playerRole:', entitiesWithRole.map(e => ({ id: e.id, role: e.playerRole, x: e.x, y: e.y })));
        }

        return snapshot;
    }

    applySnapshot(snapshot) {
        if (!snapshot) return;

        // Если гость ждет первого снапшота, отмечаем что он получен
        const isFirstSnapshot = this.game.waitingForInitialSnapshot;
        if (isFirstSnapshot) {
            console.log('[MP] Guest: received initial snapshot, entities:', snapshot.entities?.length, 'buildings:', snapshot.buildings?.length);
            this.game.waitingForInitialSnapshot = false;
        }

        const selectedIds = new Set(this.game.selectedUnits.map(unit => unit?.id).filter(Boolean));
        const activeBuildingId = this.game.activeMenuBuilding?.id || null;
        // Не сохраняем камеру у гостя - он управляет ей сам

        this.game.gameTime = snapshot.gameTime || 0;
        this.game.dayNightTimer = snapshot.dayNightTimer || 0;
        this.game.isNight = Boolean(snapshot.isNight);
        this.game.nightCounter = snapshot.nightCounter || 0;
        this.game.enemyPowerLevel = snapshot.enemyPowerLevel || 1;
        this.game.players = snapshot.players || this.game.players;
        this.game.factions = (snapshot.factions || []).map(faction => ({
            ...faction,
            player: snapshot.players?.[faction.teamId] || faction.player
        }));
        this.game.waterTiles = new Set(snapshot.waterTiles || []);

        this.game.resources = (snapshot.resources || []).map(resourceData => {
            const resource = new Resource(resourceData.x, resourceData.y, resourceData.type, resourceData.amount, resourceData.variantKey);
            resource.amount = resourceData.amount;
            resource.maxAmount = resourceData.maxAmount ?? resource.amount;
            resource.gatherAmount = resourceData.gatherAmount ?? resource.gatherAmount;
            resource.size = resourceData.size ?? resource.size;
            resource.primaryColor = resourceData.primaryColor || resource.primaryColor;
            resource.secondaryColor = resourceData.secondaryColor || resource.secondaryColor;
            resource.depleted = Boolean(resourceData.depleted);
            return resource;
        });

        const buildingById = new Map();
        this.game.buildings = (snapshot.buildings || []).map(buildingData => {
            const building = new Building(buildingData.x, buildingData.y, buildingData.type, buildingData.team);
            building.id = buildingData.id;
            building.health = buildingData.health;
            building.maxHealth = buildingData.maxHealth;
            building.level = buildingData.level || 1;
            building.lastAttackTime = buildingData.lastAttackTime || 0;
            building.maxOccupants = buildingData.maxOccupants || building.maxOccupants;
            building.occupants = [...(buildingData.occupantIds || [])];
            building.reservedOccupants = [...(buildingData.reservedIds || [])];
            buildingById.set(building.id, building);
            return building;
        });

        this.game.entities = (snapshot.entities || []).map(entityData => {
            // Создаем PlayerCharacter если есть playerRole
            let unit;
            if (entityData.playerRole) {
                unit = new PlayerCharacter(entityData.x, entityData.y, entityData.playerRole);
            } else {
                unit = new Unit(entityData.x, entityData.y, entityData.type, entityData.team, entityData.profession);
            }

            unit.id = entityData.id;
            unit.targetX = entityData.targetX ?? entityData.x;
            unit.targetY = entityData.targetY ?? entityData.y;
            unit.health = entityData.health;
            unit.maxHealth = entityData.maxHealth;
            unit.level = entityData.level || 1;
            unit.experience = entityData.experience || 0;
            unit.experienceToNextLevel = entityData.experienceToNextLevel || 100;
            unit.damage = entityData.damage;
            unit.speed = entityData.speed;
            unit.guardMode = Boolean(entityData.guardMode);
            unit.guardX = entityData.guardX ?? entityData.x;
            unit.guardY = entityData.guardY ?? entityData.y;
            unit.guardRadius = entityData.guardRadius || GUARD_RADIUS_TILES * TILE_SIZE;
            unit.guardModeSetTime = entityData.guardModeSetTime || 0;
            unit.isResting = Boolean(entityData.isResting);
            unit.insideHouse = Boolean(entityData.insideHouse);
            unit.carrying = entityData.carrying ? { ...entityData.carrying } : null;
            unit.starving = Boolean(entityData.starving);
            unit.attackCooldown = entityData.attackCooldown || 0;
            unit.restingHouse = entityData.restingHouseId ? buildingById.get(entityData.restingHouseId) || null : null;

            // Сохраняем ссылку на персонажа хоста
            if (entityData.playerRole === 'host') {
                this.game.hostCharacter = unit;
            }

            return unit;
        });

        const unitById = new Map(this.game.entities.map(unit => [unit.id, unit]));
        this.game.buildings.forEach(building => {
            building.occupants = (building.occupants || []).map(id => unitById.get(id)).filter(Boolean);
            building.reservedOccupants = (building.reservedOccupants || []).map(id => unitById.get(id)).filter(Boolean);
        });

        this.game.constructionSites = (snapshot.constructionSites || []).map(siteData =>
            new ConstructionSite(siteData.x, siteData.y, siteData.buildingType, siteData.team, {
                buildProgress: siteData.buildProgress,
                buildTime: siteData.buildTime
            })
        );

        this.game.dungeons = (snapshot.dungeons || []).map(dungeonData => {
            const dungeon = new Dungeon(dungeonData.x, dungeonData.y, this.game);
            dungeon.explored = Boolean(dungeonData.explored);
            dungeon.hasArtifact = Boolean(dungeonData.hasArtifact);
            dungeon.respawnTimer = dungeonData.respawnTimer || 0;
            dungeon.captureProgress = dungeonData.captureProgress || 0;
            dungeon.captureTime = dungeonData.captureTime || dungeon.captureTime;
            dungeon.requiredWarriors = dungeonData.requiredWarriors || dungeon.requiredWarriors;
            dungeon.capturing = Boolean(dungeonData.capturing);
            dungeon.guards = [];
            return dungeon;
        });

        if (snapshot.weather) {
            this.game.weatherSystem.currentWeather = snapshot.weather.currentWeather || this.game.weatherSystem.currentWeather;
            this.game.weatherSystem.nextWeatherChange = snapshot.weather.nextWeatherChange || this.game.weatherSystem.nextWeatherChange;
            this.game.weatherSystem.transitionProgress = snapshot.weather.transitionProgress ?? this.game.weatherSystem.transitionProgress;
            this.game.weatherSystem.transitionStartTime = snapshot.weather.transitionStartTime || this.game.weatherSystem.transitionStartTime;
            this.game.weatherSystem.lightningFlash = snapshot.weather.lightningFlash || 0;
            this.game.weatherSystem.raindrops = [];
        }

        this.game.selectedUnits = this.game.entities.filter(unit => selectedIds.has(unit.id));
        this.game.activeMenuBuilding = activeBuildingId ? this.game.buildings.find(building => building.id === activeBuildingId) || null : null;

        // Обновляем ссылку на персонажа гостя из снапшота
        if (!this.game.mpIsHost) {
            const guestChar = this.game.entities.find(e => e.playerRole === 'guest');
            if (guestChar) {
                this.game.guestCharacter = guestChar;
                console.log('[MP] Guest: found guest character from snapshot, id:', guestChar.id, 'pos:', guestChar.x, guestChar.y);
            } else {
                console.warn('[MP] Guest: guest character NOT found in snapshot. Total entities:', this.game.entities.length);
                console.log('[MP] Guest: entities with playerRole:', this.game.entities.filter(e => e.playerRole).map(e => ({ role: e.playerRole, id: e.id })));
            }
        }

        // При первом снапшоте центрируем камеру на персонаже гостя и выбираем его
        if (isFirstSnapshot && !this.game.mpIsHost) {
            const guestChar = this.game.guestCharacter;
            if (guestChar) {
                // Центрируем камеру на персонаже гостя
                this.game.camera.x = guestChar.x - canvas.width / 2;
                this.game.camera.y = guestChar.y - canvas.height / 2;

                // Ограничиваем камеру границами карты
                this.game.camera.x = Math.max(0, Math.min(this.game.camera.x, MAP_WIDTH * TILE_SIZE - canvas.width));
                this.game.camera.y = Math.max(0, Math.min(this.game.camera.y, MAP_HEIGHT * TILE_SIZE - canvas.height));

                console.log('[MP] Guest: centered camera at', this.game.camera.x, this.game.camera.y);

                // Автоматически выбираем персонажа гостя
                this.game.selectedUnits = [guestChar];
                console.log('[MP] Guest: auto-selected guest character');
            }
        }
        // Не восстанавливаем камеру - гость управляет ей сам

        this.game.ensureHouseOccupancyState();
        this.game.updateFogOfWar();
        this.game.updateUI();
        this.game.updateEnemyList();
        this.game.renderMinimap();
    }

    handleMessage(message) {
        if (!message || typeof message !== 'object') return;
        if (message.kind === 'snapshot' && !this.game.mpIsHost) {
            console.log('[MP] Guest received snapshot');
            this.applySnapshot(message.snapshot);
            return;
        }
        if (message.kind === 'action' && this.game.mpIsHost) {
            this.applyRemoteAction(message.action);
        }
    }

    applyRemoteAction(action) {
        if (!action || !this.game.mpIsHost) return;

        switch (action.type) {
            case 'unitMove': {
                const unit = this.findEntityById(action.unitId);
                if (unit) unit.moveTo(action.x, action.y);
                break;
            }
            case 'unitGather': {
                const unit = this.findEntityById(action.unitId);
                const resource = this.game.resources[action.resourceIndex];
                if (unit && resource && !resource.depleted) {
                    unit.gatherResource(resource, {
                        chainRemaining: this.game.getResourceChainLimit(resource),
                        manualOrder: true
                    });
                }
                break;
            }
            case 'unitAttack': {
                const unit = this.findEntityById(action.unitId);
                const target = this.findTargetById(action.targetId);
                if (unit && target) unit.attackTarget(target, false, true);
                break;
            }
            case 'build':
                this.game.startConstruction(PLAYER, action.buildingType, action.x, action.y, false);
                break;
            case 'relocateBuilding': {
                const building = this.findBuildingById(action.buildingId);
                if (building) this.game.startRelocation(building, action.x, action.y);
                break;
            }
            case 'upgradeTownHall':
                this.game.upgradeTownHall();
                break;
            case 'upgradeBuilding': {
                const building = this.findBuildingById(action.buildingId);
                if (!building) break;
                if (building.type === 'archertower') this.game.upgradeArcherTower(building);
                else if (building.type === 'storage') this.game.upgradeStorage(building);
                else if (building.type === 'farm') this.game.upgradeFarm(building);
                break;
            }
            case 'trainUnit':
                this.game.trainUnit(action.unitType);
                break;
            case 'upgradeWorkerProfession':
                this.game.upgradeWorkerProfession(action.profession);
                break;
            case 'setGuardMode':
                this.game.setGuardModeByIds(action.unitIds || []);
                break;
            case 'clearGuardMode':
                this.game.clearGuardModeByIds(action.unitIds || []);
                break;
        }
    }
}

// ===================== GAME =====================
class Game {
    constructor(skipWorldGeneration = false) {
        this.camera = { x: 0, y: 0 };
        this.cameraFreeMode = false; // Флаг для временного отвода камеры (пробел)
        this.entities = [];
        this.buildings = [];
        this.resources = [];
        this.fogOfWar = [];
        this.selectedUnits = [];
        this.selectionBox = null;
        this.gameOver = false;
        this.gameTime = 0; // Время с начала игры (для синхронизации)
        this.activeMenuBuilding = null;
        this.constructionSites = [];
        this.buildMode = false;
        this.buildingType = null;
        this.foodTimer = 0;
        this.hungerWarningShown = false;
        this.dayNightTimer = DAY_NIGHT_CYCLE_MS * 0.18;
        this.isNight = false;
        this.mobSpawnTimer = 0;
        this.nightCounter = 0; // Счетчик ночей
        this.enemyPowerLevel = 1.0; // Множитель силы врагов
        this.relocationContext = null;
        this.waterTiles = new Set();
        this.dungeons = [];
        this.artifacts = [];

        // Система погоды
        this.weatherSystem = new WeatherSystem();

        // Система частиц
        this.particles = [];

        // Мультиплеер (удалено)
        this.mpEnabled = false;
        this.mpIsHost = true;
        this.multiplayerMode = 'single';
        this.isHost = false;
        this.connection = null;
        this.nextEntityId = 1;
        this.nextBuildingId = 1;
        this.multiplayerSync = new MultiplayerSync(this);
        this.waitingForInitialSnapshot = skipWorldGeneration;

        // Игрок
        this.players = {
            [PLAYER]: {
                wood: 100, stone: 50, food: 50, population: 3, maxPopulation: 5,
                team: PLAYER, townHallLevel: 1, maxStorage: 200,
                workerUpgrades: createWorkerUpgradeState()
            }
        };

        // Фракции врагов
        this.factions = [];
        this.nextTeamId = 1;

        // Туман войны нужен всегда, даже для гостя
        this.initFogOfWar();

        if (!skipWorldGeneration) {
            this.initMap();
            this.initPlayer();
            this.initEnemyFactions();
        } else {
            console.log('[MP] Guest: skipping world generation, waiting for snapshot');
        }

        // Инициализация мультиплеера удалена

        this.mouse = { x:0, y:0, worldX:0, worldY:0, down:false, startX:0, startY:0, rightDown:false };
        this.setupInput();

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });

        this.lastTime = 0;
        this.setMultiplayerStatus('Одиночная игра');
        this.loop(0);
    }

    setMultiplayerStatus(text, isError=false) {
        const status = document.getElementById('multiplayerStatus');
        if (!status) return;
        status.textContent = text;
        status.style.color = isError ? '#ff8a80' : '#C9A84C';
    }

    async startCoopHost() {
        const roomId = await this.multiplayerSync.createServerHostedRoom();

        // Удаляем всех рабочих и создаем персонажа хоста
        this.entities = this.entities.filter(e => e.team !== PLAYER);

        const townhall = this.buildings.find(b => b.team === PLAYER && b.type === 'townhall');
        const sx = townhall ? townhall.x : PLAYER_START_TILE_X * TILE_SIZE;
        const sy = townhall ? townhall.y : PLAYER_START_TILE_Y * TILE_SIZE;

        const hostCharacter = new PlayerCharacter(sx + 100, sy + 100, 'host');
        this.entities.push(hostCharacter);
        this.hostCharacter = hostCharacter;
        this.multiplayerSync.assignEntityId(hostCharacter);

        this.players[PLAYER].population = 1;

        this.showNotification(`Комната создана: ${roomId}`);
        return roomId;
    }

    async joinCoopRoom(roomId) {
        await this.multiplayerSync.joinServerHostedRoom(roomId);
    }

    ensureHouseOccupancyState() {
        this.buildings.forEach(building => {
            if (building.type !== 'house') return;
            building.occupants = (building.occupants || []).filter(unit =>
                unit && typeof unit === 'object' && unit.health > 0 && this.entities.includes(unit) && unit.insideHouse && unit.restingHouse === building
            );
            building.reservedOccupants = (building.reservedOccupants || []).filter(unit =>
                unit && typeof unit === 'object' && unit.health > 0 && this.entities.includes(unit) && unit.isResting && unit.restingHouse === building
            );
        });
    }

    getHouseLoad(house) {
        if (!house) return Number.MAX_SAFE_INTEGER;
        this.ensureHouseOccupancyState();
        const occupantIds = new Set((house.occupants || []).map(unit => unit?.id || unit));
        const reservedOnly = (house.reservedOccupants || []).filter(unit => !occupantIds.has(unit?.id || unit));
        return (house.occupants || []).length + reservedOnly.length;
    }

    reserveHouseSlot(worker, house) {
        if (!worker || !house || house.type !== 'house') return false;
        this.ensureHouseOccupancyState();

        if (worker.restingHouse && worker.restingHouse !== house) {
            worker.releaseHouseSlot();
        }

        house.reservedOccupants = house.reservedOccupants || [];
        if (!house.reservedOccupants.includes(worker)) {
            if (this.getHouseLoad(house) >= house.maxOccupants) return false;
            house.reservedOccupants.push(worker);
        }

        worker.restingHouse = house;
        worker.insideHouse = false;
        return true;
    }

    setGuardModeByIds(unitIds) {
        const fighters = (unitIds || [])
            .map(id => this.multiplayerSync.findEntityById(id))
            .filter(unit => unit && this.isCombatUnit(unit));
        if (fighters.length === 0) return;
        fighters.forEach(unit => {
            unit.guardMode = true;
            unit.guardX = unit.x;
            unit.guardY = unit.y;
            unit.guardRadius = GUARD_RADIUS_TILES * TILE_SIZE;
            unit.guardModeSetTime = Date.now();
            unit.target = null;
            unit.targetX = unit.x;
            unit.targetY = unit.y;
        });
    }

    clearGuardModeByIds(unitIds) {
        const fighters = (unitIds || [])
            .map(id => this.multiplayerSync.findEntityById(id))
            .filter(unit => unit && this.isCombatUnit(unit) && unit.guardMode);
        fighters.forEach(unit => {
            unit.guardMode = false;
            unit.target = null;
        });
    }

    // ===== СОХРАНЕНИЕ И ЗАГРУЗКА =====
    saveGame() {
        try {
            const saveData = {
                version: '2.0',
                timestamp: Date.now(),
                gameTime: this.gameTime,
                dayNightTimer: this.dayNightTimer,
                isNight: this.isNight,
                nightCounter: this.nightCounter,
                enemyPowerLevel: this.enemyPowerLevel,
                camera: { x: this.camera.x, y: this.camera.y },

                // Игрок
                player: this.players[PLAYER],

                // Фракции
                factions: this.factions.map(f => ({
                    id: f.id,
                    teamId: f.teamId,
                    name: f.name,
                    color: f.color,
                    difficulty: f.difficulty,
                    alive: f.alive,
                    centerX: f.centerX,
                    centerY: f.centerY,
                    aggressionState: f.aggressionState,
                    player: this.players[f.teamId]
                })),

                // Здания
                buildings: this.buildings.map(b => ({
                    x: b.x,
                    y: b.y,
                    type: b.type,
                    team: b.team,
                    health: b.health,
                    maxHealth: b.maxHealth,
                    level: b.level,
                    lastAttackTime: b.lastAttackTime,
                    occupants: b.occupants || []
                })),

                // Юниты
                entities: this.entities.map(e => ({
                    x: e.x,
                    y: e.y,
                    type: e.type,
                    team: e.team,
                    profession: e.profession,
                    health: e.health,
                    maxHealth: e.maxHealth,
                    level: e.level,
                    experience: e.experience,
                    experienceToNextLevel: e.experienceToNextLevel,
                    damage: e.damage,
                    speed: e.speed,
                    guardMode: e.guardMode,
                    guardX: e.guardX,
                    guardY: e.guardY,
                    isResting: e.isResting
                })),

                // Ресурсы
                resources: this.resources.map(r => ({
                    x: r.x,
                    y: r.y,
                    type: r.type,
                    amount: r.amount,
                    depleted: r.depleted
                })),

                // Артефакты
                artifacts: this.artifacts.map(a => ({
                    name: a.name,
                    rarity: a.rarity,
                    effect: a.effect
                })),

                // Данжи
                dungeons: this.dungeons.map(d => ({
                    x: d.x,
                    y: d.y,
                    explored: d.explored,
                    hasArtifact: d.hasArtifact,
                    respawnTimer: d.respawnTimer,
                    captureProgress: d.captureProgress,
                    captureTime: d.captureTime,
                    requiredWarriors: d.requiredWarriors,
                    capturing: d.capturing,
                    guardCount: d.guards ? d.guards.length : 0
                })),

                // Стройки
                constructionSites: this.constructionSites.map(s => ({
                    x: s.x,
                    y: s.y,
                    type: s.type,
                    team: s.team,
                    progress: s.progress,
                    totalTime: s.totalTime
                }))
            };

            localStorage.setItem('mageim_save', JSON.stringify(saveData));
            this.showNotification('✅ Игра сохранена');
            return saveData;
        } catch (e) {
            console.error('Ошибка сохранения:', e);
            this.showNotification('❌ Ошибка сохранения');
            return null;
        }
    }

    exportSaveToFile() {
        const saveData = this.saveGame();
        if (!saveData) return;

        try {
            const dataStr = JSON.stringify(saveData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            link.download = `mageim_save_${date}.json`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            this.showNotification('✅ Сохранение скачано');
        } catch (e) {
            console.error('Ошибка экспорта:', e);
            this.showNotification('❌ Ошибка экспорта');
        }
    }

    importSaveFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const saveData = JSON.parse(event.target.result);
                    localStorage.setItem('mageim_save', JSON.stringify(saveData));
                    this.loadGame();
                    this.showNotification('✅ Сохранение импортировано');
                } catch (err) {
                    console.error('Ошибка импорта:', err);
                    this.showNotification('❌ Ошибка импорта файла');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    loadGame() {
        try {
            const saveDataStr = localStorage.getItem('mageim_save');
            if (!saveDataStr) {
                this.showNotification('❌ Нет сохранений');
                return false;
            }

            const saveData = JSON.parse(saveDataStr);

            // Очищаем текущее состояние
            this.entities = [];
            this.buildings = [];
            this.resources = [];
            this.constructionSites = [];
            this.artifacts = [];
            this.dungeons = [];
            this.factions = [];
            this.selectedUnits = [];

            // Восстанавливаем базовые параметры
            this.gameTime = saveData.gameTime || 0;
            this.dayNightTimer = saveData.dayNightTimer || 0;
            this.isNight = saveData.isNight || false;
            this.nightCounter = saveData.nightCounter || 0;
            this.enemyPowerLevel = saveData.enemyPowerLevel || 1.0;
            this.camera = saveData.camera || { x: 0, y: 0 };

            // Восстанавливаем игрока
            this.players[PLAYER] = saveData.player;

            // Восстанавливаем фракции
            saveData.factions.forEach(fData => {
                const faction = new Faction(fData.teamId, 0, 0, fData.difficulty);
                faction.id = fData.id;
                faction.name = fData.name;
                faction.color = fData.color;
                faction.alive = fData.alive;
                faction.centerX = fData.centerX;
                faction.centerY = fData.centerY;
                faction.aggressionState = fData.aggressionState;
                faction.player = fData.player;
                this.factions.push(faction);
                this.players[faction.teamId] = fData.player;
            });

            // Восстанавливаем здания
            saveData.buildings.forEach(bData => {
                const building = new Building(bData.x, bData.y, bData.type, bData.team);
                building.health = bData.health;
                building.maxHealth = bData.maxHealth;
                building.level = bData.level || 1;
                building.lastAttackTime = bData.lastAttackTime || 0;
                building.occupants = bData.occupants || [];
                this.buildings.push(building);
            });

            // Восстанавливаем юнитов
            saveData.entities.forEach(eData => {
                const unit = new Unit(eData.x, eData.y, eData.type, eData.team, eData.profession);
                unit.health = eData.health;
                unit.maxHealth = eData.maxHealth;
                unit.level = eData.level || 1;
                unit.experience = eData.experience || 0;
                unit.experienceToNextLevel = eData.experienceToNextLevel || 100;
                unit.damage = eData.damage;
                unit.speed = eData.speed;
                unit.guardMode = eData.guardMode || false;
                unit.guardX = eData.guardX || eData.x;
                unit.guardY = eData.guardY || eData.y;
                unit.isResting = eData.isResting || false;
                this.entities.push(unit);
            });

            // Восстанавливаем ресурсы
            saveData.resources.forEach(rData => {
                const resource = new Resource(rData.x, rData.y, rData.type);
                resource.amount = rData.amount;
                resource.depleted = rData.depleted || false;
                this.resources.push(resource);
            });

            // Восстанавливаем артефакты
            saveData.artifacts.forEach(aData => {
                const artifact = new Artifact(aData.name, aData.rarity, aData.effect);
                this.artifacts.push(artifact);
            });

            // Восстанавливаем данжи
            saveData.dungeons.forEach(dData => {
                const dungeon = new Dungeon(dData.x, dData.y, this);
                dungeon.explored = dData.explored || false;
                dungeon.hasArtifact = dData.hasArtifact !== undefined ? dData.hasArtifact : dungeon.hasArtifact;
                dungeon.respawnTimer = dData.respawnTimer || 0;
                dungeon.captureProgress = dData.captureProgress || 0;
                dungeon.captureTime = dData.captureTime || dungeon.captureTime;
                dungeon.requiredWarriors = dData.requiredWarriors || dungeon.requiredWarriors;
                dungeon.capturing = dData.capturing || false;
                this.dungeons.push(dungeon);
            });

            // Восстанавливаем стройки
            saveData.constructionSites.forEach(sData => {
                const site = new ConstructionSite(sData.x, sData.y, sData.type, sData.team);
                site.progress = sData.progress;
                site.totalTime = sData.totalTime;
                this.constructionSites.push(site);
            });

            // Обновляем UI
            this.updateUI();
            this.updateEnemyList();

            this.showNotification('✅ Игра загружена');
            return true;
        } catch (e) {
            console.error('Ошибка загрузки:', e);
            this.showNotification('❌ Ошибка загрузки');
            return false;
        }
    }

    // ===== МУЛЬТИПЛЕЕР =====
    setupMultiplayerHandlers() {
        if (this.multiplayerSync) this.multiplayerSync.ensureNetworkIds();
    }

    sendMultiplayerAction(action) {
        console.log('[MP] sendMultiplayerAction called:', action.type, 'mpEnabled:', this.mpEnabled, 'connection open:', this.connection?.open);
        if (this.multiplayerSync && this.connection && this.connection.open) {
            this.multiplayerSync.sendAction(action);
        }
    }

    // ===== MAP =====
    initFogOfWar() {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            this.fogOfWar[y] = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                this.fogOfWar[y][x] = { explored: false, visible: false };
            }
        }
    }

    initMap() {
        this.initWaterFeatures();

        // Улучшенный спавн ресурсов с кластерами
        const playerCX = PLAYER_START_TILE_X * TILE_SIZE;
        const playerCY = PLAYER_START_TILE_Y * TILE_SIZE;

        // Создаем кластеры ресурсов
        const numClusters = 80; // Количество кластеров

        for (let i = 0; i < numClusters; i++) {
            // Выбираем тип ресурса для кластера (50% дерево, 50% камень)
            const clusterType = Math.random() < 0.5 ? 'wood' : 'stone';

            // Находим центр кластера
            let centerX, centerY;
            let attempts = 0;
            do {
                centerX = Math.random() * MAP_WIDTH * TILE_SIZE;
                centerY = Math.random() * MAP_HEIGHT * TILE_SIZE;
                attempts++;
            } while (this.isWaterAtWorld(centerX, centerY) && attempts < 50);

            if (this.isWaterAtWorld(centerX, centerY)) continue;

            // Размер кластера (5-12 ресурсов)
            const clusterSize = Math.floor(5 + Math.random() * 8);
            const clusterRadius = 80 + Math.random() * 60; // Радиус разброса

            for (let j = 0; j < clusterSize; j++) {
                // Случайная позиция в радиусе кластера
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * clusterRadius;
                const x = centerX + Math.cos(angle) * dist;
                const y = centerY + Math.sin(angle) * dist;

                // Проверяем что не в воде и в пределах карты
                if (x >= 0 && x < MAP_WIDTH * TILE_SIZE &&
                    y >= 0 && y < MAP_HEIGHT * TILE_SIZE &&
                    !this.isWaterAtWorld(x, y)) {
                    this.resources.push(new Resource(x, y, clusterType));
                }
            }
        }

        this.spawnFishResources(); // Рыба только в воде
        this.spawnDungeons();
    }

    spawnDungeons() {
        const playerCX = PLAYER_START_TILE_X * TILE_SIZE;
        const playerCY = PLAYER_START_TILE_Y * TILE_SIZE;
        const minDistFromPlayer = 400; // Уменьшил минимальное расстояние от игрока

        for (let i = 0; i < DUNGEON_COUNT; i++) {
            let x, y, attempts = 0;
            do {
                x = (20 + Math.random() * (MAP_WIDTH - 40)) * TILE_SIZE;
                y = (20 + Math.random() * (MAP_HEIGHT - 40)) * TILE_SIZE;
                attempts++;
            } while (
                (this.isWaterAtWorld(x, y) ||
                 distBetween(x, y, playerCX, playerCY) < minDistFromPlayer) &&
                attempts < 50
            );

            if (!this.isWaterAtWorld(x, y)) {
                const dungeon = new Dungeon(x, y, this);
                this.dungeons.push(dungeon);
                dungeon.spawnGuards(this); // Создаем защитников
            }
        }
    }

    addWaterTile(tileX, tileY) {
        if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;
        this.waterTiles.add(`${tileX},${tileY}`);
    }
    addWaterPatch(cx, cy, rx, ry) {
        for (let y = Math.floor(cy-ry); y <= Math.ceil(cy+ry); y++) {
            for (let x = Math.floor(cx-rx); x <= Math.ceil(cx+rx); x++) {
                const dx=(x-cx)/rx, dy=(y-cy)/ry;
                if (dx*dx+dy*dy<=1) this.addWaterTile(x,y);
            }
        }
    }
    initWaterFeatures() {
        // Несколько рек и озёр на большой карте
        // Горизонтальная река ~трети карты
        const r1y = Math.floor(MAP_HEIGHT * 0.3);
        for (let x=0; x<MAP_WIDTH; x++) {
            const ry = r1y + Math.sin(x/8)*5 + Math.cos(x/14)*3;
            this.addWaterPatch(x, ry, 2.4, 2.0);
        }
        // Вертикальная река
        const r2x = Math.floor(MAP_WIDTH * 0.68);
        for (let y=0; y<MAP_HEIGHT; y++) {
            const rx = r2x + Math.sin(y/7)*4 + Math.cos(y/13)*2;
            this.addWaterPatch(rx, y, 2.0, 2.0);
        }
        // Озёра
        this.addWaterPatch(40, 60, 7, 5);
        this.addWaterPatch(80, 120, 6, 5);
        this.addWaterPatch(160, 50, 8, 6);
        this.addWaterPatch(200, 180, 7, 6);
        this.addWaterPatch(120, 200, 5, 5);
        this.addWaterPatch(30, 200, 6, 4);
    }
    isWaterTile(tx, ty) { return this.waterTiles.has(`${tx},${ty}`); }
    isWaterAtWorld(x, y) { return this.isWaterTile(Math.floor(x/TILE_SIZE), Math.floor(y/TILE_SIZE)); }
    spawnFishResources() {
        const keys = Array.from(this.waterTiles);
        for (let i=0; i<200 && keys.length>0; i++) { // Увеличил до 200 для большего количества рыбы
            const key = keys[Math.floor(Math.random()*keys.length)];
            const [tx,ty] = key.split(',').map(Number);
            this.resources.push(new Resource(
                tx*TILE_SIZE+TILE_SIZE/2+(Math.random()-0.5)*10,
                ty*TILE_SIZE+TILE_SIZE/2+(Math.random()-0.5)*10,
                'food'
            ));
        }
    }

    // ===== PLAYER INIT =====
    initPlayer() {
        const sx = PLAYER_START_TILE_X * TILE_SIZE;
        const sy = PLAYER_START_TILE_Y * TILE_SIZE;
        this.buildings.push(new Building(sx, sy, 'townhall', PLAYER));

        // В одиночной игре создаем 3 рабочих как раньше
        // Персонажи будут созданы только при запуске кооператива
        for (let i=0; i<3; i++) {
            this.entities.push(new Unit(sx+i*40+100, sy+100, 'worker', PLAYER, 'generalist'));
        }

        // Персонажи для кооператива (будут созданы при старте кооп-режима)
        this.hostCharacter = null;
        this.guestCharacter = null;

        this.camera.x = sx - canvas.width/2;
        this.camera.y = sy - canvas.height/2;
    }

    // ===== ENEMY FACTIONS =====
    initEnemyFactions() {
        const numFactions = 2; // Уменьшено с 4 до 2 для баланса с персонажами
        const playerCX = PLAYER_START_TILE_X;
        const playerCY = PLAYER_START_TILE_Y;

        // Минимальное расстояние от игрока в тайлах
        const minDist = 60;
        const maxDist = 110;

        for (let i=0; i<numFactions; i++) {
            // Расставляем по кругу с вариацией
            const angle = (Math.PI*2/numFactions)*i + (Math.random()-0.5)*0.4;
            const dist = minDist + Math.random()*(maxDist-minDist);
            let tx = Math.round(playerCX + Math.cos(angle)*dist);
            let ty = Math.round(playerCY + Math.sin(angle)*dist);
            tx = Math.max(10, Math.min(MAP_WIDTH-10, tx));
            ty = Math.max(10, Math.min(MAP_HEIGHT-10, ty));

            // Сложность = дистанция от центра (нормализованная)
            const tileDistFromPlayer = Math.hypot(tx-playerCX, ty-playerCY);
            const difficulty = Math.max(1, Math.min(10, Math.floor(tileDistFromPlayer/10)));

            const faction = new Faction(this.nextTeamId++, tx, ty, difficulty);
            this.factions.push(faction);
            this.players[faction.teamId] = faction.player;

            // Создаём здания и юнитов фракции
            this.spawnFactionBase(faction, tx, ty);
        }
    }

    spawnFactionBase(faction, tx, ty) {
        const sx = tx * TILE_SIZE;
        const sy = ty * TILE_SIZE;
        const team = faction.teamId;
        const diff = faction.difficulty;

        this.buildings.push(new Building(sx, sy, 'townhall', team));
        // Доп здания в зависимости от сложности - меньше зданий для баланса
        if (diff >= 2) this.startConstruction(team, 'farm', sx+140, sy, true);
        if (diff >= 4) this.startConstruction(team, 'barracks', sx+140, sy+140, true);
        if (diff >= 4) this.startConstruction(team, 'house', sx-140, sy, true);
        if (diff >= 6) this.startConstruction(team, 'storage', sx-140, sy-140, true);

        // Уменьшено количество начальных рабочих с 3 до 2
        const profs = ['lumberjack','miner'];
        for (let i=0; i<2; i++) {
            this.entities.push(new Unit(sx+(i%2)*40+100, sy+100, 'worker', team, profs[i]));
        }
        faction.player.population = 2;

        // Уменьшено количество начальных войск (1-3 вместо 2-4)
        const extraSoldiers = Math.min(3, Math.floor(diff * 0.4));
        for (let i=0; i<extraSoldiers; i++) {
            const type = Math.random()<0.5 ? 'swordsman' : 'archer';
            const unit = new Unit(sx+(Math.random()-0.5)*150, sy+(Math.random()-0.5)*150, type, team);
            // Уменьшаем здоровье и урон врагов на 40% (было 30%)
            unit.maxHealth = Math.floor(unit.maxHealth * 0.6);
            unit.health = unit.maxHealth;
            unit.damage = Math.floor(unit.damage * 0.6);
            this.entities.push(unit);
            faction.player.population++;
        }
    }

    // ===== AI ФРАКЦИИ =====

    // Возвращает teamId "главного врага" фракции — тот, кто ближе всего ИЛИ тот кто недавно нападал
    chooseFactionTarget(faction) {
        const fc = faction;
        // Все живые фракции + игрок
        const candidates = [];
        // Игрок
        const playerTH = this.buildings.find(b=>b.team===PLAYER && b.type==='townhall');
        if (playerTH) {
            candidates.push({ team: PLAYER, dist: distBetween(fc.centerX, fc.centerY, playerTH.x+48, playerTH.y+48) });
        }
        // Другие фракции
        for (const other of this.factions) {
            if (other.id===fc.id || !other.alive) continue;
            const th = this.buildings.find(b=>b.team===other.teamId && b.type==='townhall');
            if (!th) continue;
            candidates.push({ team: other.teamId, dist: distBetween(fc.centerX, fc.centerY, th.x+48, th.y+48) });
        }
        if (candidates.length===0) return null;
        // Чаще всего атакуют ближайшего, иногда случайного
        candidates.sort((a,b)=>a.dist-b.dist);
        if (Math.random()<0.75) return candidates[0].team;
        return candidates[Math.floor(Math.random()*candidates.length)].team;
    }

    // Обновление AI фракции
    updateFactionAI(faction, dt) {
        if (!faction.alive) return;
        const team = faction.teamId;
        const player = this.players[team];
        if (!player) return;

        const townHall = this.buildings.find(b=>b.team===team && b.type==='townhall');

        // Если ратуша уничтожена, начинаем систему волн
        if (!townHall) {
            if (!faction.underSiege) {
                faction.underSiege = true;
                faction.currentWave = 0;
                faction.waveTimer = 0;
                faction.waveSpawned = false;
                this.showNotification(`⚔️ Аванпост ${faction.name} под осадой! Отбейте ${faction.totalWaves} волны врагов!`);
            }

            // Обработка волн
            this.updateFactionWaves(faction, dt);
            return;
        }

        faction.centerX = townHall.x + townHall.width/2;
        faction.centerY = townHall.y + townHall.height/2;

        // Экономика
        const workers = this.entities.filter(u=>u.team===team && u.type==='worker');
        const soldiers = this.entities.filter(u=>u.team===team && (u.type==='swordsman'||u.type==='archer'));
        const barracks = this.buildings.find(b=>b.team===team && b.type==='barracks');
        const farms = this.buildings.filter(b=>b.team===team && b.type==='farm');
        const houses = this.buildings.filter(b=>b.team===team && b.type==='house');
        const sites = this.constructionSites.filter(s=>s.team===team);

        const diff = faction.difficulty;
        // Уменьшено желаемое количество юнитов для баланса
        const desiredWorkers = Math.floor((4 + diff * 1) * this.enemyPowerLevel);
        const desiredSoldiers = Math.floor((3 + diff * 2) * this.enemyPowerLevel);

        // Рабочие — собирают ресурсы
        workers.forEach(w => {
            if (!w.task && !w.carrying && !w.target) {
                const res = this.findPreferredResourceForWorker(w);
                if (res) w.gatherResource(res);
            }
        });

        // Строительство (не более 2 одновременных стройплощадок)
        if (sites.length < 2) {
            // Приоритет: фермы для еды!
            const desiredFarms = Math.max(2, Math.floor(player.population / 4)); // 1 ферма на 4 юнита
            if (farms.length < desiredFarms && player.wood >= 80 && player.stone >= 30) {
                this.startConstruction(team, 'farm');
            }
            // Казарма если есть рабочие
            else if (!barracks && workers.length>=3 && player.wood >= 100 && player.stone >= 50) {
                this.startConstruction(team, 'barracks');
            }
            // Дома для населения
            else if (player.population >= player.maxPopulation-3 && houses.length<10 && player.wood >= 50) {
                this.startConstruction(team, 'house');
            }
            // Склад для ресурсов
            else if (this.buildings.filter(b=>b.team===team&&b.type==='storage').length < 2 && player.wood >= 100 && player.stone >= 80) {
                this.startConstruction(team, 'storage');
            }
            // Башни лучников
            else if (diff>=3 && this.buildings.filter(b=>b.team===team&&b.type==='archertower').length<Math.floor(diff/2) && player.wood >= 180 && player.stone >= 120) {
                this.startConstruction(team, 'archertower');
            }
        }

        // Тренировка рабочих
        if (workers.length < desiredWorkers && player.population < player.maxPopulation && player.food > 20) {
            const prof = this.chooseWorkerProfessionToTrain(team);
            const cost = WORKER_TRAINING_OPTIONS[prof]?.cost;
            if (cost && canAffordCost(player, cost)) {
                const sp = getStructureCenter(townHall);
                this.entities.push(new Unit(sp.x+16, sp.y+16, 'worker', team, prof));
                spendCost(player, cost);
                player.population++;
            }
        }

        // Тренировка солдат (только если еды достаточно)
        if (barracks && soldiers.length < desiredSoldiers && player.population < player.maxPopulation && player.food > 30) {
            const sp = getStructureCenter(barracks);
            if (player.wood>=80 && player.stone>=40) {
                const type = Math.random()<0.5 ? 'swordsman' : 'archer';
                this.entities.push(new Unit(sp.x+12, sp.y+12, type, team));
                player.wood -= type==='swordsman' ? 80 : 100;
                player.stone -= type==='swordsman' ? 40 : 30;
                player.population++;
            }
        }

        // КРИТИЧНО: Если еды мало - срочно строим фермы!
        if (player.food < 50 && sites.length < 3) {
            const currentFarms = farms.length;
            const neededFarms = Math.ceil(player.population / 3);
            if (currentFarms < neededFarms && player.wood >= 80 && player.stone >= 30) {
                this.startConstruction(team, 'farm');
            }
        }

        // Логика агрессии
        faction.aggressionTimer -= dt;
        faction.attackCooldown = Math.max(0, faction.attackCooldown - dt);

        if (faction.aggressionState === 'idle') {
            if (faction.aggressionTimer <= 0 && soldiers.length >= Math.max(3, diff)) {
                // Выбираем цель
                faction.currentTarget = this.chooseFactionTarget(faction);
                if (faction.currentTarget !== null) {
                    faction.aggressionState = 'attacking';
                    faction.aggressionTimer = faction.aggressionInterval;
                }
            }
        } else if (faction.aggressionState === 'attacking') {
            // Ищем TownHall цели
            const targetTH = this.buildings.find(b=>b.team===faction.currentTarget && b.type==='townhall');
            if (!targetTH) {
                faction.aggressionState = 'idle';
                faction.currentTarget = null;
                return;
            }

            // Проверяем дистанцию — не атакуем если очень далеко (>5000px) если сложность низкая
            const dist = distBetween(faction.centerX, faction.centerY, targetTH.x+48, targetTH.y+48);
            const maxAttackRange = 2000 + diff * 400;
            if (dist > maxAttackRange) {
                faction.aggressionState = 'idle';
                faction.currentTarget = null;
                return;
            }

            // Отправляем солдат атаковать
            const attackForce = soldiers.filter(s=>distBetween(s.x, s.y, faction.centerX, faction.centerY) < 600);
            if (attackForce.length < Math.max(2, Math.floor(soldiers.length*0.6))) {
                // Собираем войска у базы
                soldiers.forEach(s=>{
                    if (!s.target) {
                        s.targetX = faction.centerX + (Math.random()-0.5)*100;
                        s.targetY = faction.centerY + (Math.random()-0.5)*100;
                    }
                });
            } else {
                attackForce.forEach(s=>{
                    if (!s.target || s.target.health<=0) {
                        const nearby = this.findPriorityEnemyTarget(team, s.x, s.y, 350, true);
                        if (nearby) s.attackTarget(nearby);
                        else {
                            s.targetX = targetTH.x+48+(Math.random()-0.5)*80;
                            s.targetY = targetTH.y+48+(Math.random()-0.5)*80;
                        }
                    }
                });
            }

            // Если солдат мало — отступаем
            if (soldiers.length < 2) {
                faction.aggressionState = 'retreating';
                faction.aggressionTimer = faction.aggressionInterval * 1.5;
            }
        } else if (faction.aggressionState === 'retreating') {
            // Возвращаем войска на базу
            soldiers.forEach(s=>{
                s.target = null;
                s.targetX = faction.centerX + (Math.random()-0.5)*80;
                s.targetY = faction.centerY + (Math.random()-0.5)*80;
            });
            if (faction.aggressionTimer <= 0) {
                faction.aggressionState = 'idle';
                faction.currentTarget = null;
            }
        }

        // Оборона — солдаты рядом с базой атакуют угрозы
        soldiers.forEach(s=>{
            if (!s.target) {
                const threat = this.findPriorityEnemyTarget(team, faction.centerX, faction.centerY, 300+diff*30, true);
                if (threat) s.attackTarget(threat, false);
            }
        });
    }

    // Обработка волн врагов при захвате аванпоста
    updateFactionWaves(faction, dt) {
        faction.waveTimer += dt;

        // Проверяем, все ли враги текущей волны убиты
        const factionUnits = this.entities.filter(u => u.team === faction.teamId);

        if (faction.waveSpawned && factionUnits.length === 0) {
            // Волна отбита
            faction.currentWave++;
            faction.waveSpawned = false;
            faction.waveTimer = 0;

            if (faction.currentWave >= faction.totalWaves) {
                // Все волны отбиты - аванпост захвачен
                faction.alive = false;
                this.showNotification(`🎉 Аванпост ${faction.name} захвачен!`);
                return;
            } else {
                this.showNotification(`✅ Волна ${faction.currentWave}/${faction.totalWaves} отбита! Следующая волна через 30 секунд.`);
            }
        }

        // Спавним новую волну
        if (!faction.waveSpawned && faction.waveTimer >= faction.waveInterval) {
            faction.waveSpawned = true;
            this.spawnFactionWave(faction);
        }
    }

    // Спавн волны врагов
    spawnFactionWave(faction) {
        const waveNumber = faction.currentWave + 1;
        const difficulty = faction.difficulty;

        // Количество врагов зависит от номера волны и сложности
        // В кооперативе меньше врагов
        let enemyCount;
        if (this.mpEnabled) {
            enemyCount = 2 + waveNumber; // 3, 4, 5 врагов
        } else {
            enemyCount = Math.floor((3 + waveNumber * 2) * (1 + difficulty * 0.2)); // Больше в одиночной игре
        }

        this.showNotification(`⚔️ Волна ${waveNumber}/${faction.totalWaves}! Враги: ${enemyCount}`);

        // Спавним врагов вокруг центра фракции
        for (let i = 0; i < enemyCount; i++) {
            const angle = (Math.PI * 2 / enemyCount) * i;
            const dist = 100 + Math.random() * 50;
            const x = faction.centerX + Math.cos(angle) * dist;
            const y = faction.centerY + Math.sin(angle) * dist;

            const type = Math.random() < 0.6 ? 'swordsman' : 'archer';
            const enemy = new Unit(x, y, type, faction.teamId);

            // Усиливаем врагов с каждой волной
            const waveBonus = 1 + (waveNumber - 1) * 0.2;
            enemy.maxHealth = Math.floor(enemy.maxHealth * waveBonus);
            enemy.health = enemy.maxHealth;
            enemy.damage = Math.floor(enemy.damage * waveBonus);

            this.entities.push(enemy);
        }

        faction.player.population = enemyCount;
    }

    // ===== HELPERS =====
    isFactionTeam(team) {
        return team !== PLAYER && team !== MOB;
    }

    getPlayerOrFaction(team) {
        return this.players[team];
    }

    getAllTeams() {
        return [PLAYER, ...this.factions.filter(f=>f.alive).map(f=>f.teamId)];
    }

    isCombatUnit(unit) {
        return unit && unit.type !== 'worker';
    }

    getBuildingCost(type) {
        const c = getBuildingConfig(type);
        return { wood: c.cost?.wood||0, stone: c.cost?.stone||0 };
    }

    getPlacementBounds(cx, cy, type) {
        const c = getBuildingConfig(type);
        return { x:cx-c.width/2, y:cy-c.height/2, width:c.width, height:c.height, clearance:c.clearance };
    }

    getStructureBounds(s) {
        return { x:s.x, y:s.y, width:s.width, height:s.height, clearance:s.clearance||getBuildingConfig(s.type||s.buildingType).clearance };
    }

    rectanglesOverlap(a, b, gap=0) {
        return a.x-gap < b.x+b.width && a.x+a.width+gap > b.x &&
               a.y-gap < b.y+b.height && a.y+a.height+gap > b.y;
    }

    findPriorityEnemyTarget(team, x, y, radius=Infinity, includeTownHall=true) {
        const units = this.entities
            .filter(u=>u.team!==team && u.health>0 && Math.hypot(u.x-x,u.y-y)<=radius)
            .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
        if (units.length>0) return units[0];

        const blds = this.buildings
            .filter(b=>b.team!==team && b.health>0 && !b.isRelocating)
            .filter(b=>{ const c=getStructureCenter(b); return Math.hypot(c.x-x,c.y-y)<=radius; })
            .sort((a,b)=>{
                const ca=getStructureCenter(a), cb=getStructureCenter(b);
                const pa=a.type==='townhall'?1:0, pb=b.type==='townhall'?1:0;
                if(pa!==pb) return pa-pb;
                return Math.hypot(ca.x-x,ca.y-y)-Math.hypot(cb.x-x,cb.y-y);
            });
        if (!blds[0]) return null;
        if (!includeTownHall && blds[0].type==='townhall') return null;
        return blds[0];
    }

    canPlaceBuilding(cx, cy, type, ignoredStructure=null) {
        const bounds = this.getPlacementBounds(cx, cy, type);
        if (bounds.x<0||bounds.y<0||bounds.x+bounds.width>MAP_WIDTH*TILE_SIZE||bounds.y+bounds.height>MAP_HEIGHT*TILE_SIZE)
            return { valid:false, reason:'bounds' };
        for (const s of [...this.buildings, ...this.constructionSites]) {
            if (s===ignoredStructure||s.isRelocating) continue;
            const ob = this.getStructureBounds(s);
            const gap = Math.max(bounds.clearance, ob.clearance);
            if (this.rectanglesOverlap(bounds, ob, gap)) return { valid:false, reason:'blocked' };
        }
        // Проверка данжей
        for (const dungeon of this.dungeons) {
            const dungeonBounds = {
                x: dungeon.x - dungeon.size/2,
                y: dungeon.y - dungeon.size/2,
                width: dungeon.size,
                height: dungeon.size,
                clearance: 50
            };
            const gap = Math.max(bounds.clearance, dungeonBounds.clearance);
            if (this.rectanglesOverlap(bounds, dungeonBounds, gap)) return { valid:false, reason:'dungeon' };
        }
        for (let ty=Math.floor(bounds.y/TILE_SIZE); ty<=Math.floor((bounds.y+bounds.height)/TILE_SIZE); ty++) {
            for (let tx=Math.floor(bounds.x/TILE_SIZE); tx<=Math.floor((bounds.x+bounds.width)/TILE_SIZE); tx++) {
                if (this.isWaterTile(tx,ty)) return { valid:false, reason:'water' };
            }
        }
        const blocked = this.resources.some(r=>!r.depleted&&r.x>=bounds.x-18&&r.x<=bounds.x+bounds.width+18&&r.y>=bounds.y-18&&r.y<=bounds.y+bounds.height+18);
        if (blocked) return { valid:false, reason:'resource' };

        // Проверка тумана войны - можно строить только в полностью видимой зоне
        for (let ty=Math.floor(bounds.y/TILE_SIZE); ty<=Math.floor((bounds.y+bounds.height)/TILE_SIZE); ty++) {
            for (let tx=Math.floor(bounds.x/TILE_SIZE); tx<=Math.floor((bounds.x+bounds.width)/TILE_SIZE); tx++) {
                if (tx>=0 && tx<MAP_WIDTH && ty>=0 && ty<MAP_HEIGHT) {
                    if (!this.fogOfWar[ty][tx].visible) {
                        return { valid:false, reason:'fog' };
                    }
                }
            }
        }

        return { valid:true, bounds };
    }

    findBuildPosition(team, type) {
        const th = this.buildings.find(b=>b.team===team&&b.type==='townhall');
        if (!th) return null;
        const thc = getStructureCenter(th);
        const thr = Math.max(th.width,th.height)/2;
        const cfg = getBuildingConfig(type);
        for (let i=0; i<80; i++) {
            const angle = (Math.PI*2/80)*i+Math.random()*0.35;
            const dist = thr+Math.max(cfg.width,cfg.height)+70+Math.random()*220;
            const p = this.canPlaceBuilding(thc.x+Math.cos(angle)*dist, thc.y+Math.sin(angle)*dist, type);
            if (p.valid) return { centerX:thc.x+Math.cos(angle)*dist, centerY:thc.y+Math.sin(angle)*dist, bounds:p.bounds };
        }
        return null;
    }

    startConstruction(team, type, cx=null, cy=null, instant=false) {
        const player = this.players[team];
        if (!player) return false;
        const cost = this.getBuildingCost(type);
        if (!instant && (player.wood < cost.wood || player.stone < cost.stone)) return false;

        let placement = null;
        if (cx!==null&&cy!==null) placement = this.canPlaceBuilding(cx, cy, type);
        else placement = this.findBuildPosition(team, type);
        if (!placement||placement.valid===false) return false;

        if (this.mpEnabled && !this.mpIsHost && team === PLAYER && !instant) {
            this.sendMultiplayerAction({
                type: 'build',
                team: team,
                buildingType: type,
                x: placement.bounds.x,
                y: placement.bounds.y
            });
            return true;
        }

        if (!instant) { player.wood-=cost.wood; player.stone-=cost.stone; }
        const site = new ConstructionSite(placement.bounds.x, placement.bounds.y, type, team);
        if (instant) site.buildProgress = site.buildTime; // мгновенное строительство при спавне
        this.constructionSites.push(site);
        this.assignWorkersToConstruction(team);

        return true;
    }

    getRelocationCost(building) {
        const bc = this.getBuildingCost(building.type);
        return { wood:Math.max(10,Math.ceil((bc.wood||20)*0.45)), stone:Math.ceil((bc.stone||0)*0.45) };
    }

    beginBuildingRelocation(building) {
        if (!building||building.team!==PLAYER) return;
        if (building.type==='townhall') { this.showNotification('Ратушу переносить нельзя.'); return; }
        this.relocationContext = { building };
        this.buildMode = true; this.buildingType = building.type;
        document.getElementById('buildMenu').style.display='none';
        canvas.style.cursor='crosshair';
        const mc=this.getRelocationCost(building);
        this.showNotification(`Выберите новое место. ${mc.wood}🪵, ${mc.stone}🪨`);
    }

    startRelocation(building, cx, cy) {
        const player = this.players[PLAYER];
        const mc = this.getRelocationCost(building);
        const p = this.canPlaceBuilding(cx, cy, building.type, building);
        if (!p.valid) { this.showNotification(this.getPlacementErrorMessage(p.reason)); return false; }
        if (player.wood<mc.wood||player.stone<mc.stone) { this.showNotification('Не хватает ресурсов.'); return false; }
        if (this.mpEnabled && !this.mpIsHost) {
            this.sendMultiplayerAction({
                type: 'relocateBuilding',
                buildingId: building.id,
                x: cx,
                y: cy
            });
            return true;
        }
        player.wood-=mc.wood; player.stone-=mc.stone;
        building.isRelocating=true;
        const rt=Math.max(3500,Math.floor((getBuildingConfig(building.type).buildTime||5000)*0.75));
        const site=new ConstructionSite(p.bounds.x, p.bounds.y, building.type, PLAYER, { buildTime:rt, relocationSource:building });
        this.constructionSites.push(site);
        this.assignWorkersToConstruction(PLAYER);
        this.activeMenuBuilding=null;
        return true;
    }

    getPlacementErrorMessage(reason) {
        if (reason==='bounds') return 'Здание не помещается в пределах карты.';
        if (reason==='resource') return 'Сначала освободите место от ресурса.';
        if (reason==='water') return 'На воде строить нельзя.';
        if (reason==='dungeon') return 'Слишком близко к данжу.';
        if (reason==='fog') return 'Можно строить только в полностью видимой зоне.';
        return 'Слишком близко к другому зданию или стройке.';
    }

    choosePreferredResourceType(team) {
        const p = this.players[team];
        if (!p) return 'wood';
        if (p.wood<120&&p.wood<=p.stone) return 'wood';
        if (p.stone<80&&p.stone<p.wood) return 'stone';
        return p.wood<=p.stone ? 'wood' : 'stone';
    }

    getPreferredResourceTypeForWorker(worker) {
        const pr = getWorkerResourceType(worker?.profession);
        if (pr) return pr;
        return this.choosePreferredResourceType(worker.team);
    }

    findNearestResource(worker, preferredType=null, allowFallback=true, excludedResource=null) {
        let cands = this.resources.filter(r=>r!==excludedResource&&!r.depleted&&(!preferredType||r.type===preferredType));
        if (cands.length===0&&preferredType&&allowFallback)
            cands = this.resources.filter(r=>r!==excludedResource&&!r.depleted);
        cands.sort((a,b)=>Math.hypot(a.x-worker.x,a.y-worker.y)-Math.hypot(b.x-worker.x,b.y-worker.y));
        return cands[0]||null;
    }

    findPreferredResourceForWorker(worker, exc=null) {
        const pt = this.getPreferredResourceTypeForWorker(worker);
        const af = !getWorkerResourceType(worker?.profession);
        return this.findNearestResource(worker, pt, af, exc);
    }

    getResourceChainLimit(resource) {
        if (!resource||(resource.type!=='wood'&&resource.type!=='stone')) return 0;
        return AUTO_RESOURCE_CHAIN_MIN+Math.floor(Math.random()*(AUTO_RESOURCE_CHAIN_MAX-AUTO_RESOURCE_CHAIN_MIN+1));
    }

    continueWorkerResourceChain(worker, resource, task) {
        if (!worker||!resource||!task) return false;
        if (resource.type!=='wood'&&resource.type!=='stone') return false;
        if ((task.chainRemaining||0)<=0) return false;
        const next=this.findNearestResource(worker, resource.type, false, resource);
        if (!next||!worker.canGatherResource(next)) return false;
        worker.gatherResource(next, { chainRemaining:task.chainRemaining-1, manualOrder:task.manualOrder });
        return true;
    }

    stopWorkerAtTownHall(worker) {
        if (!worker) return;
        worker.task=null; worker.gatherTimer=0;
        this.sendWorkerNearTownHall(worker);
    }

    sendWorkerNearTownHall(worker) {
        console.log('sendWorkerNearTownHall вызван для worker.team=', worker.team);

        // Ищем свободный дом команды
        const houses = this.buildings.filter(b =>
            b.team === worker.team &&
            b.type === 'house'
        );

        console.log('Найдено домов команды', worker.team, ':', houses.length, 'из', this.buildings.filter(b => b.type === 'house').length, 'всего');

        // Очищаем occupants и резервы от невалидных юнитов
        this.ensureHouseOccupancyState();

        // Теперь фильтруем свободные дома
        const freeHouses = houses.filter(h => this.getHouseLoad(h) < h.maxOccupants);

        console.log('sendWorkerNearTownHall: всего домов=', houses.length, 'свободных=', freeHouses.length);

        if (freeHouses.length > 0) {
            // Находим ближайший свободный дом
            const house = freeHouses.sort((a, b) => {
                const ca = getStructureCenter(a);
                const cb = getStructureCenter(b);
                const distA = Math.hypot(worker.x - ca.x, worker.y - ca.y);
                const distB = Math.hypot(worker.x - cb.x, worker.y - cb.y);
                return distA - distB;
            })[0];

            const c = getStructureCenter(house);
            if (!this.reserveHouseSlot(worker, house)) return;
            worker.targetX = c.x;
            worker.targetY = c.y;
            worker.isResting = true;
            worker.insideHouse = false;
            console.log('✅ Отправляем рабочего в дом, load=', this.getHouseLoad(house), '/', house.maxOccupants);
        } else {
            // Если все дома заняты, отправляем к ратуше
            const th = this.buildings.find(b => b.team === worker.team && b.type === 'townhall');
            if (!th) return;
            const c = getStructureCenter(th), a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 40;
            worker.targetX = c.x + Math.cos(a) * d;
            worker.targetY = c.y + Math.sin(a) * d;
            worker.isResting = true;
            worker.releaseHouseSlot();
            worker.restingHouse = null;
            worker.insideHouse = false;
            console.log('⚠️ Все дома заняты, отправляем к ратуше');
        }
    }

    assignWorkerToSite(worker, site) {
        if (!worker||!site) return;
        if (worker.task&&worker.task.type==='gather'&&!worker.carrying&&worker.task.resource&&!worker.task.resource.depleted)
            worker.resumeTask={...worker.task};
        else if (!worker.resumeTask) worker.resumeTask=null;
        worker.leaveHouse(this);
        worker.task={type:'build',site}; worker.target=null; worker.gatherTimer=0;
        const sc=getStructureCenter(site); worker.targetX=sc.x; worker.targetY=sc.y;
        site.builder=worker;
    }

    assignWorkersToConstruction(team) {
        const sites=this.constructionSites.filter(s=>s.team===team);
        if (sites.length===0) return;
        const workers=this.entities.filter(u=>u.team===team&&u.type==='worker'&&!u.carrying&&(!u.task||u.task.type==='gather'));
        sites.forEach(site=>{
            const hasBuilder=site.builder&&site.builder.health>0&&site.builder.task?.type==='build'&&site.builder.task.site===site;
            if (hasBuilder) return;
            const avail=workers.filter(w=>w.task?.type!=='build').sort((a,b)=>{
                const sc=getStructureCenter(site);
                return Math.hypot(a.x-sc.x,a.y-sc.y)-Math.hypot(b.x-sc.x,b.y-sc.y);
            })[0];
            if (!avail) return;
            this.assignWorkerToSite(avail, site);
            workers.splice(workers.indexOf(avail),1);
        });
    }

    resumeWorkerEconomy(worker) {
        if (!worker||worker.health<=0) return;
        const st=worker.resumeTask; worker.resumeTask=null;
        if (st&&st.type==='gather'&&st.resource&&!st.resource.depleted) { worker.gatherResource(st.resource,st); return; }
        const res=this.findPreferredResourceForWorker(worker);
        if (res) { worker.gatherResource(res); return; }
        this.sendWorkerNearTownHall(worker);
    }

    // ===== BUILDING ACTIONS =====
    destroyBuilding(building) {
        const idx=this.buildings.indexOf(building);
        if (idx===-1) return;
        this.buildings.splice(idx,1);
        this.spawnBuildingDrops(building);
        const owner=this.players[building.team];
        if (owner) {
            if (building.type==='house') owner.maxPopulation=Math.max(5,owner.maxPopulation-5);
            else if (building.type==='storage') { owner.maxStorage=Math.max(200,owner.maxStorage-200); owner.wood=Math.min(owner.wood,owner.maxStorage); owner.stone=Math.min(owner.stone,owner.maxStorage); }
        }
        if (this.activeMenuBuilding===building) { this.activeMenuBuilding=null; document.getElementById('buildMenu').style.display='none'; }
    }

    getBuildingDrops(building) {
        const m=Math.max(1,building.level||1);
        const drops={
            house:[{type:'wood',amount:30*m}], farm:[{type:'wood',amount:45*m}],
            storage:[{type:'wood',amount:50*m},{type:'stone',amount:40*m}],
            barracks:[{type:'wood',amount:35*m},{type:'stone',amount:55*m}],
            archertower:[{type:'wood',amount:60*m},{type:'stone',amount:50*m}],
            forge:[{type:'stone',amount:80*m}], magictower:[{type:'stone',amount:90*m}],
            beacon:[{type:'wood',amount:35*m},{type:'stone',amount:25*m}],
            townhall:[{type:'wood',amount:100*m},{type:'stone',amount:100*m}]
        };
        return drops[building.type]||[];
    }

    spawnBuildingDrops(building) {
        const c=getStructureCenter(building);
        this.getBuildingDrops(building).forEach((d,i)=>{
            const a=(Math.PI*2*i)/Math.max(this.getBuildingDrops(building).length,1), off=18+i*10;
            this.resources.push(new Resource(c.x+Math.cos(a)*off, c.y+Math.sin(a)*off, d.type, d.amount));
        });
    }

    placeBuilding(x, y) {
        if (this.relocationContext?.building) { this.startRelocation(this.relocationContext.building,x,y); this.relocationContext=null; return; }
        const p=this.canPlaceBuilding(x,y,this.buildingType);
        if (!p.valid) { this.showNotification(this.getPlacementErrorMessage(p.reason)); return; }
        if (!this.startConstruction(PLAYER,this.buildingType,x,y)) {
            const cost=this.getBuildingCost(this.buildingType);
            if (this.players[PLAYER].wood<cost.wood||this.players[PLAYER].stone<cost.stone)
                this.showNotification('Не хватает ресурсов для строительства.');
        }
    }

    upgradeTownHall() {
        if (this.mpEnabled && !this.mpIsHost) {
            this.sendMultiplayerAction({ type: 'upgradeTownHall' });
            return;
        }
        const player=this.players[PLAYER];
        const th=this.buildings.find(b=>b.team===PLAYER&&b.type==='townhall');
        if (!th) return;
        const costs=[{wood:200,stone:150},{wood:400,stone:300},{wood:600,stone:450},{wood:800,stone:600},{wood:1000,stone:800}];
        const level=player.townHallLevel;
        if (level>=5) { this.showNotification('Ратуша достигла максимального уровня!'); return; }
        const cost=costs[level-1];
        if (player.wood>=cost.wood&&player.stone>=cost.stone) {
            player.wood-=cost.wood; player.stone-=cost.stone;
            player.townHallLevel++; player.maxPopulation+=10;
            th.level=player.townHallLevel; th.maxHealth+=200; th.health=th.maxHealth;
            let unlocked='';
            if (player.townHallLevel===2) unlocked='Разблокировано: Башня лучников, Кузница';
            else if (player.townHallLevel===3) unlocked='Разблокировано: Магическая башня';
            this.showNotification(`Ратуша Ур.${player.townHallLevel}! ${unlocked}`);
            document.getElementById('buildMenu').style.display='none';
        } else {
            this.showNotification(`Нужно ${cost.wood}🪵 ${cost.stone}🪨`);
        }
    }

    upgradeArcherTower(tower) {
        if (!tower||tower.type!=='archertower') return false;
        const player=this.players[tower.team]; if (!player) return false;
        const next=ARCHER_TOWER_LEVELS[tower.level+1]; if (!next) return false;
        if (player.townHallLevel<3&&tower.team===PLAYER) { this.showNotification('Нужна Ратуша Ур.3'); return false; }
        if (player.wood<next.upgradeCost.wood||player.stone<next.upgradeCost.stone) return false;
        player.wood-=next.upgradeCost.wood; player.stone-=next.upgradeCost.stone;
        tower.setLevel(tower.level+1);
        if (tower.team===PLAYER) this.showNotification(`Башня лучников Ур.${tower.level}`);
        return true;
    }

    upgradeSelectedBuilding() {
        if (!this.activeMenuBuilding) return;
        if (this.mpEnabled && !this.mpIsHost) {
            this.sendMultiplayerAction({
                type: 'upgradeBuilding',
                buildingId: this.activeMenuBuilding.id
            });
            return;
        }
        const building = this.activeMenuBuilding;

        if(building.type === 'archertower') {
            this.upgradeArcherTower(building);
        } else if(building.type === 'storage') {
            this.upgradeStorage(building);
        } else if(building.type === 'farm') {
            this.upgradeFarm(building);
        }

        this.showBuildingMenu(building);
    }

    upgradeStorage(storage) {
        if(!storage || storage.type !== 'storage' || storage.team !== PLAYER) return;
        const currentLevel = storage.level || 1;
        const nextLevel = STORAGE_LEVELS[currentLevel + 1];
        if(!nextLevel) return;

        const player = this.players[PLAYER];
        if(!canAffordCost(player, nextLevel.upgradeCost)) {
            this.showNotification('Недостаточно ресурсов');
            return;
        }

        spendCost(player, nextLevel.upgradeCost);
        storage.level = currentLevel + 1;
        storage.maxHealth += nextLevel.healthBonus;
        storage.health += nextLevel.healthBonus;

        // Обновляем лимит хранилища для игрока
        player.maxStorage = this.calculateMaxStorage(PLAYER);

        this.showNotification(`Склад улучшен до Ур.${storage.level}`);
    }

    upgradeFarm(farm) {
        if(!farm || farm.type !== 'farm' || farm.team !== PLAYER) return;
        const currentLevel = farm.level || 1;
        const nextLevel = FARM_LEVELS[currentLevel + 1];
        if(!nextLevel) return;

        const player = this.players[PLAYER];
        if(!canAffordCost(player, nextLevel.upgradeCost)) {
            this.showNotification('Недостаточно ресурсов');
            return;
        }

        spendCost(player, nextLevel.upgradeCost);
        farm.level = currentLevel + 1;
        farm.maxHealth += nextLevel.healthBonus;
        farm.health += nextLevel.healthBonus;

        this.showNotification(`Ферма улучшена до Ур.${farm.level}`);
    }

    calculateMaxStorage(team) {
        const storages = this.buildings.filter(b => b.team === team && b.type === 'storage');
        let total = 200; // Базовая вместимость
        storages.forEach(s => {
            const level = s.level || 1;
            total += STORAGE_LEVELS[level].capacity;
        });
        return total;
    }

    trainUnit(type) {
        // В кооперативе нельзя нанимать юнитов
        if (this.mpEnabled) {
            this.showNotification('В кооперативе нельзя нанимать юнитов');
            document.getElementById('buildMenu').style.display='none';
            return;
        }

        const player=this.players[PLAYER];
        const barracks=this.buildings.find(b=>b.team===PLAYER&&b.type==='barracks');
        if (!barracks) return;
        const sp=getStructureCenter(barracks);
        const opt=WORKER_TRAINING_OPTIONS[type];
        const cost=type==='worker'?{wood:50,stone:0,food:0}:opt?.cost;
        const prof=type==='worker'?'generalist':opt?type:null;
        if (prof) {
            if (player.population<player.maxPopulation&&canAffordCost(player,cost)) {
                spendCost(player,cost); player.population++;
                this.entities.push(new Unit(sp.x+12,sp.y+12,'worker',PLAYER,prof));
            }
        } else if (type==='swordsman') {
            if (player.wood>=80&&player.stone>=40&&player.population<player.maxPopulation) {
                player.wood-=80;player.stone-=40;player.population++;
                this.entities.push(new Unit(sp.x+12,sp.y+12,'swordsman',PLAYER));
            }
        } else if (type==='archer') {
            if (player.wood>=100&&player.stone>=30&&player.population<player.maxPopulation) {
                player.wood-=100;player.stone-=30;player.population++;
                this.entities.push(new Unit(sp.x+12,sp.y+12,'archer',PLAYER));
            }
        }
        document.getElementById('buildMenu').style.display='none';
    }

    getWorkerUpgradeLevel(team, profession) { return this.players[team]?.workerUpgrades?.[profession]||0; }

    upgradeWorkerProfession(profession, team=PLAYER) {
        if (this.mpEnabled && !this.mpIsHost && team === PLAYER) {
            this.sendMultiplayerAction({ type: 'upgradeWorkerProfession', profession });
            return true;
        }
        const player=this.players[team]; if (!player) return false;
        const cur=this.getWorkerUpgradeLevel(team,profession);
        const next=WORKER_UPGRADE_LEVELS[cur+1];
        if (!next) { if(team===PLAYER) this.showNotification('Уже максимум.'); return false; }
        if (!canAffordCost(player,next.cost)) { if(team===PLAYER) this.showNotification('Не хватает ресурсов.'); return false; }
        spendCost(player,next.cost); player.workerUpgrades[profession]=cur+1;
        if(team===PLAYER) { this.showNotification(`${getWorkerProfessionLabel(profession)} Ур.${player.workerUpgrades[profession]}`); if(this.activeMenuBuilding?.type==='townhall') this.showBuildingMenu(this.activeMenuBuilding); }
        return true;
    }

    chooseWorkerProfessionToTrain(team) {
        const counts={generalist:0,lumberjack:0,miner:0,fisher:0};
        this.entities.forEach(u=>{ if(u.team===team&&u.type==='worker') counts[u.profession]=(counts[u.profession]||0)+1; });
        const p=this.players[team];
        if ((counts.fisher||0)<1) return 'fisher';
        if (p&&p.food<35&&(counts.fisher||0)<2) return 'fisher';
        if (p&&p.wood<=p.stone) return (counts.lumberjack||0)<=(counts.miner||0)?'lumberjack':'miner';
        return (counts.miner||0)<=(counts.lumberjack||0)?'miner':'lumberjack';
    }

    getUnitFoodConsumption(unit) {
        if (!unit) return 0;
        return unit.type==='worker' ? 1 : 1.8;
    }

    getVisionRadius(entity) {
        let r=7;
        if (entity.width) {
            if (entity.type==='beacon') r=12; // Костер имеет большой радиус
            else if (entity.type==='townhall') r=10;
            else if (entity.type==='archertower') r=9;
            else r=8;
        }
        else if (entity.type==='archer') r=8;
        else if (entity.type==='mob') r=6;

        // Костер не теряет видимость ночью
        if (entity.type==='beacon') return r;

        return this.isNight ? Math.max(4,r-2) : r;
    }

    getNightBlend() {
        const cp=this.dayNightTimer/DAY_NIGHT_CYCLE_MS;
        if (cp<NIGHT_START_PROGRESS) return 0;
        return Math.sin(Math.PI*(cp-NIGHT_START_PROGRESS)/(1-NIGHT_START_PROGRESS));
    }

    isNearBeacon(entity) {
        // Проверяет, находится ли юнит в радиусе действия костра
        if (!entity || entity.team !== PLAYER) return false;

        const beacons = this.buildings.filter(b => b.type === 'beacon' && b.team === PLAYER && !b.isRelocating);
        const config = getBuildingConfig('beacon');
        const radius = config.visionRadius || 200;

        for (let i = 0; i < beacons.length; i++) {
            const beacon = beacons[i];
            const bc = getStructureCenter(beacon);
            const dist = Math.hypot(entity.x - bc.x, entity.y - bc.y);
            if (dist <= radius) return true;
        }

        return false;
    }

    // ===== SETUP INPUT =====
    setupInput() {
        const buildMenu=document.getElementById('buildMenu');

        document.querySelectorAll('.build-btn').forEach(btn=>{
            btn.addEventListener('click',()=>{
                if(btn.classList.contains('disabled')) return;
                const bt=btn.dataset.building;
                if(bt==='upgrade') this.upgradeTownHall();
                else { this.buildMode=true; this.buildingType=bt; buildMenu.style.display='none'; canvas.style.cursor='crosshair'; }
            });
        });

        canvas.addEventListener('mousedown',e=>{
            if(this.gameOver) return;
            if(e.button===0) {
                const wx=e.clientX+this.camera.x, wy=e.clientY+this.camera.y;
                if(this.buildMode) { this.placeBuilding(wx,wy); this.buildMode=false; this.buildingType=null; canvas.style.cursor='crosshair'; return; }
                this.mouse.down=true; this.mouse.startX=e.clientX; this.mouse.startY=e.clientY;
                const cb=this.buildings.find(b=>b.team===PLAYER&&wx>=b.x&&wx<=b.x+b.width&&wy>=b.y&&wy<=b.y+b.height);
                if(cb) { this.selectedUnits=[]; this.activeMenuBuilding=cb; this.showBuildingMenu(cb); return; }

                // В режиме кооператива автоматически выбираем своего персонажа
                if(this.mpEnabled) {
                    const myCharacter = this.getMyCharacter();
                    if(myCharacter) {
                        this.selectedUnits = [myCharacter];
                        this.activeMenuBuilding = null;
                    }
                } else {
                    // В одиночной игре выбираем персонажа хоста
                    const cu=this.entities.find(u=>u.team===PLAYER&&wx>=u.x-16&&wx<=u.x+16&&wy>=u.y-16&&wy<=u.y+16);
                    if(cu) { if(!e.shiftKey) this.selectedUnits=[]; this.selectedUnits.push(cu); this.activeMenuBuilding=null; }
                    else { this.activeMenuBuilding=null; this.selectionBox={x:wx,y:wy,w:0,h:0}; }
                }
            } else if(e.button===1) { this.mouse.rightDown=true; canvas.style.cursor='grabbing'; }
        });

        canvas.addEventListener('mousemove',e=>{
            const px=this.mouse.x, py=this.mouse.y;
            this.mouse.x=e.clientX; this.mouse.y=e.clientY;
            this.mouse.worldX=e.clientX+this.camera.x; this.mouse.worldY=e.clientY+this.camera.y;
            if(this.mouse.rightDown) {
                this.camera.x-=e.clientX-px; this.camera.y-=e.clientY-py;
                this.camera.x=Math.max(0,Math.min(this.camera.x,MAP_WIDTH*TILE_SIZE-canvas.width));
                this.camera.y=Math.max(0,Math.min(this.camera.y,MAP_HEIGHT*TILE_SIZE-canvas.height));
            } else if(this.mouse.down&&this.selectionBox) {
                this.selectionBox.w=this.mouse.worldX-this.selectionBox.x;
                this.selectionBox.h=this.mouse.worldY-this.selectionBox.y;
            }
        });

        canvas.addEventListener('mouseup',e=>{
            if(this.gameOver) return;
            if(e.button===0) {
                this.mouse.down=false;
                if(this.selectionBox) {
                    // В кооперативе не используем выделение рамкой
                    if(!this.mpEnabled) {
                        const box=this.normalizeBox(this.selectionBox);
                        this.selectedUnits=this.entities.filter(u=>u.team===PLAYER&&u.x>=box.x&&u.x<=box.x+box.w&&u.y>=box.y&&u.y<=box.y+box.h);
                    }
                    this.selectionBox=null;
                }
            } else if(e.button===1) { this.mouse.rightDown=false; canvas.style.cursor='crosshair'; }
            else if(e.button===2) {
                const wx=e.clientX+this.camera.x, wy=e.clientY+this.camera.y;
                const tr=this.resources.find(r=>!r.depleted&&wx>=r.x-16&&wx<=r.x+16&&wy>=r.y-16&&wy<=r.y+16);
                const te=this.entities.find(u=>u.team!==PLAYER&&wx>=u.x-16&&wx<=u.x+16&&wy>=u.y-16&&wy<=u.y+16);
                const tb=this.buildings.find(b=>b.team!==PLAYER&&wx>=b.x&&wx<=b.x+b.width&&wy>=b.y&&wy<=b.y+b.height);
                const hostile=te||tb;

                if(hostile) {
                    this.commandAttackOrder(this.selectedUnits,hostile);
                    // Отправка атаки в мультиплеере
                    if(this.mpEnabled && this.multiplayerSync) {
                        this.selectedUnits.forEach(unit => {
                            this.sendMultiplayerAction({
                                type: 'unitAttack',
                                unitId: unit.id,
                                targetId: hostile.id
                            });
                        });
                    }
                    return;
                }

                let assignedGatherers=0, rejected=0;
                this.selectedUnits.forEach(unit=>{
                    if(tr&&unit.type==='worker') {
                        if(unit.canGatherResource(tr)) {
                            unit.gatherResource(tr,{chainRemaining:this.getResourceChainLimit(tr),manualOrder:true});
                            assignedGatherers++;

                            // Отправка сбора ресурсов в мультиплеере
                            if(this.mpEnabled && this.multiplayerSync) {
                                this.sendMultiplayerAction({
                                    type: 'unitGather',
                                    unitId: unit.id,
                                    resourceIndex: this.multiplayerSync.findResourceIndex(tr)
                                });
                            }
                        }
                        else rejected++;
                        return;
                    }
                    unit.moveTo(wx,wy);

                    // Отправка движения в мультиплеере
                    if(this.mpEnabled && this.multiplayerSync) {
                        this.sendMultiplayerAction({
                            type: 'unitMove',
                            unitId: unit.id,
                            x: wx,
                            y: wy
                        });
                    }
                });
                if(tr&&assignedGatherers===0&&rejected>0) this.showNotification('Этот рабочий не может добывать этот ресурс.');
            }
        });

        canvas.addEventListener('contextmenu',e=>e.preventDefault());

        window.addEventListener('keydown',e=>{
            const speed=20;
            if(e.code==='Space') {
                // Зажатие пробела отключает следование камеры
                this.cameraFreeMode = true;
                e.preventDefault();
            }
            if(e.code==='ArrowLeft'||e.code==='KeyA') this.camera.x-=speed;
            if(e.code==='ArrowRight'||e.code==='KeyD') this.camera.x+=speed;
            if(e.code==='ArrowUp'||e.code==='KeyW') this.camera.y-=speed;
            if(e.code==='ArrowDown'||e.code==='KeyS') this.camera.y+=speed;
            this.camera.x=Math.max(0,Math.min(this.camera.x,MAP_WIDTH*TILE_SIZE-canvas.width));
            this.camera.y=Math.max(0,Math.min(this.camera.y,MAP_HEIGHT*TILE_SIZE-canvas.height));
            if(e.code==='KeyB') {
                const bm=document.getElementById('buildMenu');
                if(bm.style.display==='none'||!bm.style.display) { this.resetBuildMenu(); bm.style.display='block'; this.updateBuildMenu(); }
                else bm.style.display='none';
            }
            if(e.code==='Escape') {
                this.buildMode=false; this.buildingType=null; this.relocationContext=null; this.activeMenuBuilding=null;
                document.getElementById('buildMenu').style.display='none'; canvas.style.cursor='crosshair';
            }
            if(e.code==='KeyG') this.setGuardModeForSelection();
            if(e.code==='KeyV') this.clearGuardModeForSelection();
        });

        window.addEventListener('keyup',e=>{
            if(e.code==='Space') {
                // Отпускание пробела возвращает следование камеры
                this.cameraFreeMode = false;
            }
        });
    }

    getMyCharacter() {
        // Возвращает персонажа текущего игрока
        if (!this.mpEnabled) {
            // В одиночной игре управляем персонажем хоста
            return this.hostCharacter;
        }
        // В мультиплеере: хост управляет hostCharacter, гость - guestCharacter
        const myChar = this.mpIsHost ? this.hostCharacter : this.guestCharacter;
        if (!myChar) {
            console.warn('[MP] getMyCharacter: character not found. mpIsHost:', this.mpIsHost, 'hostCharacter:', this.hostCharacter, 'guestCharacter:', this.guestCharacter);
        }
        return myChar;
    }

    commandAttackOrder(selectedUnits, primaryTarget) {
        if (!primaryTarget) return;
        const combat=selectedUnits.filter(u=>this.isCombatUnit(u));
        const others=selectedUnits.filter(u=>!this.isCombatUnit(u));
        const tc=getEntityCenter(primaryTarget);
        combat.forEach(u=>{ u.guardMode=true; u.guardX=tc.x; u.guardY=tc.y; u.guardRadius=200; u.attackTarget(primaryTarget,true); });
        others.forEach(u=>u.attackTarget(primaryTarget));
    }

    setGuardModeForSelection() {
        const fighters=this.selectedUnits.filter(u=>this.isCombatUnit(u));
        if(fighters.length===0) return;
        if (this.mpEnabled && !this.mpIsHost) {
            this.sendMultiplayerAction({
                type: 'setGuardMode',
                unitIds: fighters.map(unit => unit.id)
            });
            this.showNotification(`Охрана: ${fighters.length} бойцов`);
            return;
        }
        fighters.forEach(u=>{
            u.guardMode=true;
            u.guardX=u.x;
            u.guardY=u.y;
            u.guardRadius=GUARD_RADIUS_TILES*TILE_SIZE;
            u.guardModeSetTime=Date.now(); // Запоминаем время установки
            u.target=null;
            u.targetX=u.x;
            u.targetY=u.y;
        });
        this.showNotification(`Охрана: ${fighters.length} бойцов`);
    }

    clearGuardModeForSelection() {
        const fighters=this.selectedUnits.filter(u=>this.isCombatUnit(u)&&u.guardMode);
        if(fighters.length===0) return;
        if (this.mpEnabled && !this.mpIsHost) {
            this.sendMultiplayerAction({
                type: 'clearGuardMode',
                unitIds: fighters.map(unit => unit.id)
            });
            this.showNotification(`Охрана снята: ${fighters.length} бойцов`);
            return;
        }
        fighters.forEach(u=>{ u.guardMode=false; u.target=null; });
        this.showNotification(`Охрана снята: ${fighters.length} бойцов`);
    }

    selectWorkersByProfession(profession) {
        // Выбираем всех свободных рабочих указанной профессии
        const workers = this.entities.filter(u =>
            u.team === PLAYER &&
            u.type === 'worker' &&
            u.profession === profession &&
            !u.task // Только свободные (не занятые сбором)
        );

        if(workers.length === 0) {
            const professionNames = {
                'generalist': 'обычных рабочих',
                'lumberjack': 'дровосеков',
                'miner': 'каменщиков',
                'fisher': 'рыбаков'
            };
            this.showNotification(`Нет свободных ${professionNames[profession]}`);
            return;
        }

        this.selectedUnits = workers;
        this.activeMenuBuilding = null;

        const professionNames = {
            'generalist': 'обычных рабочих',
            'lumberjack': 'дровосеков',
            'miner': 'каменщиков',
            'fisher': 'рыбаков'
        };
        this.showNotification(`Выбрано ${workers.length} ${professionNames[profession]}`);
    }

    autoGatherNearestResources() {
        // Автоматическая добыча ближайших ресурсов (открывается на 4 уровне ратуши)
        const player = this.players[PLAYER];
        if (player.townHallLevel < 4) {
            this.showNotification('Требуется Ратуша Ур.4');
            return;
        }

        // Получаем всех свободных рабочих игрока
        const workers = this.entities.filter(u =>
            u.team === PLAYER &&
            u.type === 'worker' &&
            !u.task &&
            !u.carrying
        );

        if (workers.length === 0) {
            this.showNotification('Нет свободных рабочих');
            return;
        }

        // Получаем ратушу для определения центра базы
        const townHall = this.buildings.find(b => b.team === PLAYER && b.type === 'townhall');
        if (!townHall) return;

        const baseX = townHall.x + townHall.width / 2;
        const baseY = townHall.y + townHall.height / 2;

        // Группируем ресурсы по типам
        const resourcesByType = {
            wood: [],
            stone: [],
            food: []
        };

        this.resources.forEach(r => {
            if (!r.depleted && resourcesByType[r.type]) {
                const dist = Math.hypot(r.x - baseX, r.y - baseY);
                resourcesByType[r.type].push({ resource: r, dist: dist });
            }
        });

        // Сортируем каждый тип по расстоянию
        Object.keys(resourcesByType).forEach(type => {
            resourcesByType[type].sort((a, b) => a.dist - b.dist);
        });

        // Распределяем рабочих по типам ресурсов
        const resourceTypes = ['wood', 'stone', 'food'];
        let assigned = 0;

        workers.forEach((worker, index) => {
            // Циклически распределяем по типам ресурсов
            const typeIndex = index % resourceTypes.length;
            const resourceType = resourceTypes[typeIndex];
            const availableResources = resourcesByType[resourceType];

            if (availableResources.length > 0) {
                // Берем ближайший ресурс этого типа, который еще не занят
                let targetResource = null;
                for (let i = 0; i < availableResources.length; i++) {
                    const res = availableResources[i].resource;
                    // Проверяем, не идет ли уже кто-то к этому ресурсу
                    const alreadyTargeted = workers.slice(0, index).some(w =>
                        w.task && w.task.resource === res
                    );
                    if (!alreadyTargeted) {
                        targetResource = res;
                        break;
                    }
                }

                if (targetResource) {
                    worker.gatherResource(targetResource, { manualOrder: true });
                    assigned++;
                }
            }
        });

        if (assigned > 0) {
            this.showNotification(`⚡ ${assigned} рабочих отправлены добывать ресурсы`);
        } else {
            this.showNotification('Нет доступных ресурсов поблизости');
        }
    }

    showBuildingMenu(building) {
        const bm=document.getElementById('buildMenu');
        bm.innerHTML=`<div style="margin-bottom:10px;font-weight:bold;">Здание: ${getBuildingDisplayName(building.type)}</div>`;
        if(building.type==='townhall'&&building.team===PLAYER) {
            bm.innerHTML+=`<div class="build-btn" onclick="game.upgradeTownHall()">⬆️ Улучшить ратушу</div>`;
            bm.innerHTML+=this.buildWorkerUpgradeControls(PLAYER);
        }
        if(building.team===PLAYER&&building.type!=='townhall') {
            const mc=this.getRelocationCost(building);
            bm.innerHTML+=`<div class="build-btn" onclick="game.beginBuildingRelocation(game.activeMenuBuilding)">↔️ Перенести (${mc.wood}🪵, ${mc.stone}🪨)</div>`;
        }
        if(building.type==='barracks') {
            bm.innerHTML+=`<div class="build-btn" onclick="game.trainUnit('worker')">👷 Рабочий (50🪵)</div>`;
            bm.innerHTML+=this.buildWorkerTrainingButton('lumberjack');
            bm.innerHTML+=this.buildWorkerTrainingButton('miner');
            bm.innerHTML+=this.buildWorkerTrainingButton('fisher');
            bm.innerHTML+=`<div class="build-btn" onclick="game.trainUnit('swordsman')">⚔️ Мечник (80🪵, 40🪨)</div>`;
            bm.innerHTML+=`<div class="build-btn" onclick="game.trainUnit('archer')">🏹 Лучник (100🪵, 30🪨)</div>`;
        } else if(building.type==='farm') {
            const level = building.level || 1;
            const farmData = FARM_LEVELS[level];
            bm.innerHTML+=`<div style="color:#4CAF50;">Ур.${level} | +${farmData.foodRate} еды каждые ${farmData.interval/1000} сек</div>`;
            if(building.team===PLAYER) {
                const nl=FARM_LEVELS[level+1];
                if(nl) bm.innerHTML+=`<div class="build-btn" onclick="game.upgradeSelectedBuilding()">⬆️ Улучшить (${nl.upgradeCost.wood}🪵, ${nl.upgradeCost.stone}🪨)</div>`;
                else bm.innerHTML+=`<div style="color:#4CAF50;">Максимальный уровень</div>`;
            }
        } else if(building.type==='storage') {
            const level = building.level || 1;
            const storageData = STORAGE_LEVELS[level];
            bm.innerHTML+=`<div style="color:#4CAF50;">Ур.${level} | Вместимость: ${storageData.capacity}</div>`;
            if(building.team===PLAYER) {
                const nl=STORAGE_LEVELS[level+1];
                if(nl) bm.innerHTML+=`<div class="build-btn" onclick="game.upgradeSelectedBuilding()">⬆️ Улучшить (${nl.upgradeCost.wood}🪵, ${nl.upgradeCost.stone}🪨)</div>`;
                else bm.innerHTML+=`<div style="color:#4CAF50;">Максимальный уровень</div>`;
            }
        } else if(building.type==='archertower') {
            bm.innerHTML+=`<div style="margin-bottom:8px;color:#FFD700;">Ур.${building.level} | Урон ${building.damage} | Дальность ${Math.round(building.attackRange/TILE_SIZE)} кл.</div>`;
            if(building.team===PLAYER) {
                const nl=ARCHER_TOWER_LEVELS[building.level+1];
                if(nl) bm.innerHTML+=`<div class="build-btn" onclick="game.upgradeSelectedBuilding()">⬆️ Улучшить (${nl.upgradeCost.wood}🪵, ${nl.upgradeCost.stone}🪨)</div>`;
                else bm.innerHTML+=`<div style="color:#4CAF50;">Максимальный уровень</div>`;
            }
        }
        bm.style.display='block';
    }

    resetBuildMenu() {
        const bm=document.getElementById('buildMenu');
        bm.innerHTML=`
            <div style="margin-bottom:10px;font-weight:bold;">Строительство:</div>
            <div class="build-btn" data-building="house">🏠 Дом (50🪵)</div>
            <div class="build-btn" data-building="storage">📦 Склад (100🪵, 80🪨)</div>
            <div class="build-btn" data-building="barracks">⚔️ Казарма (100🪵, 50🪨)</div>
            <div class="build-btn" data-building="farm">🌾 Ферма (80🪵, 30🪨)</div>
            <div class="build-btn" data-building="archertower" data-requires="2">🏹 Башня (180🪵, 120🪨) [Ур.2]</div>
            <div class="build-btn" data-building="forge" data-requires="2">🔨 Кузница (150🪵, 100🪨) [Ур.2]</div>
            <div class="build-btn" data-building="beacon" data-requires="3">🔥 Костер (60🪵, 40🪨) [Ур.3]</div>
            <div class="build-btn" data-building="magictower" data-requires="3">🔮 Маг.башня (200🪵, 150🪨) [Ур.3]</div>
            <div class="build-btn" data-building="upgrade">⬆️ Улучшить ратушу</div>
        `;
        document.querySelectorAll('.build-btn').forEach(btn=>{
            btn.addEventListener('click',()=>{
                if(btn.classList.contains('disabled')) return;
                const bt=btn.dataset.building;
                const bm=document.getElementById('buildMenu');
                if(bt==='upgrade') this.upgradeTownHall();
                else { this.buildMode=true; this.buildingType=bt; bm.style.display='none'; canvas.style.cursor='crosshair'; }
            });
        });
    }

    buildWorkerTrainingButton(profession) {
        const opt=WORKER_TRAINING_OPTIONS[profession]; if(!opt) return '';
        return `<div class="build-btn" onclick="game.trainUnit('${profession}')">${opt.icon} ${getWorkerProfessionLabel(profession)} (${formatResourceCost(opt.cost)})</div>`;
    }

    buildWorkerUpgradeControls(team) {
        return `<div style="margin-top:10px;margin-bottom:8px;color:#FFD700;">Прокачка рабочих:</div>` +
            ['lumberjack','miner','fisher'].map(p=>{
                const cur=this.getWorkerUpgradeLevel(team,p);
                const next=WORKER_UPGRADE_LEVELS[cur+1];
                if(!next) return `<div style="color:#4CAF50;margin-bottom:6px;">${getWorkerProfessionIcon(p)} ${getWorkerProfessionLabel(p)}: макс</div>`;
                return `<div class="build-btn" onclick="game.upgradeWorkerProfession('${p}')">${getWorkerProfessionIcon(p)} ${getWorkerProfessionLabel(p)} Ур.${cur+1} (${formatResourceCost(next.cost)})</div>`;
            }).join('');
    }

    updateBuildMenu() {
        const player=this.players[PLAYER];
        document.querySelectorAll('.build-btn').forEach(btn=>{
            const type=btn.dataset.building;
            const req=parseInt(btn.dataset.requires)||0;
            let ok=true;
            if(req>0&&player.townHallLevel<req) ok=false;
            else {
                const cc={house:{wood:50},storage:{wood:100,stone:80},barracks:{wood:100,stone:50},farm:{wood:80,stone:30},archertower:{wood:180,stone:120},forge:{wood:150,stone:100},beacon:{wood:60,stone:40},magictower:{wood:200,stone:150}};
                if(type&&cc[type]&&!canAffordCost(player,cc[type])) ok=false;
                if(type==='upgrade'){ const costs=[{wood:200,stone:150},{wood:400,stone:300},{wood:600,stone:450},{wood:800,stone:600},{wood:1000,stone:800}]; if(player.townHallLevel>=5||!canAffordCost(player,costs[player.townHallLevel-1])) ok=false; }
            }
            btn.classList.toggle('disabled',!ok);
        });
    }

    normalizeBox(box) {
        return { x:box.w<0?box.x+box.w:box.x, y:box.h<0?box.y+box.h:box.y, w:Math.abs(box.w), h:Math.abs(box.h) };
    }

    showNotification(msg) {
        const n=document.getElementById('notification');
        n.textContent=msg; n.style.display='block';
        clearTimeout(this._notifTimeout);
        this._notifTimeout=setTimeout(()=>n.style.display='none',3000);
    }

    // ===== UPDATE =====
    update(dt) {
        if(this.gameOver) return;
        if(dt>200) dt=200; // cap delta

        // Камера следит за персонажем (если не зажат пробел)
        if(this.mpEnabled && !this.cameraFreeMode) {
            const myChar = this.getMyCharacter();
            if(myChar) {
                // Плавное следование за персонажем
                const targetX = myChar.x - canvas.width / 2;
                const targetY = myChar.y - canvas.height / 2;
                const smoothing = 0.1;
                this.camera.x += (targetX - this.camera.x) * smoothing;
                this.camera.y += (targetY - this.camera.y) * smoothing;

                // Ограничиваем камеру границами карты
                this.camera.x = Math.max(0, Math.min(this.camera.x, MAP_WIDTH * TILE_SIZE - canvas.width));
                this.camera.y = Math.max(0, Math.min(this.camera.y, MAP_HEIGHT * TILE_SIZE - canvas.height));
            }
        }

        // Мультиплеер синхронизация должна работать для всех
        this.multiplayerSync.tick(dt);

        // Гость тоже обновляет базовые системы
        this.gameTime += dt; // Обновляем время игры

        // Обновляем систему погоды
        this.weatherSystem.update();

        // Обновляем частицы
        for(let i = this.particles.length - 1; i >= 0; i--) {
            if(!this.particles[i].update(dt / 1000)) {
                this.particles.splice(i, 1);
            }
        }

        // Гость обновляет только UI и туман войны, вся логика идет через снапшоты от хоста
        if (this.mpEnabled && !this.mpIsHost) {
            // Обновляем сущности для локального отображения движения
            for(let i=0;i<this.entities.length;i++) {
                this.entities[i].update(dt,this);
            }
            this.updateFogOfWar();
            this.updateUI();
            this.updateEnemyList();
            this.renderMinimap();
            return;
        }

        // Хост: полная логика игры
        this.updateDayNight(dt);
        this.assignWorkersToConstruction(PLAYER);

        // Оптимизация: кешируем живые фракции
        const aliveFactions = [];
        for(let i=0;i<this.factions.length;i++) {
            if(this.factions[i].alive) aliveFactions.push(this.factions[i]);
        }

        for(let i=0;i<aliveFactions.length;i++) {
            this.assignWorkersToConstruction(aliveFactions[i].teamId);
        }

        // Обновляем сущности
        for(let i=0;i<this.entities.length;i++) {
            this.entities[i].update(dt,this);
        }

        this.updateHealing(dt);
        this.updateResources(dt);
        this.updateNightMobs(dt);
        this.updateDungeonExploration();

        // Обновляем данжи
        for(let i=0;i<this.dungeons.length;i++) {
            this.dungeons[i].update(dt,this);
        }

        // Обновляем здания
        for(let i=0;i<this.buildings.length;i++) {
            if(!this.buildings[i].isRelocating) this.buildings[i].update(dt,this);
        }

        this.cleanupDestroyedBuildings();

        // Обновляем стройки
        for(let i=this.constructionSites.length-1;i>=0;i--) {
            const done=this.constructionSites[i].update(dt,this);
            if(done) this.constructionSites.splice(i,1);
        }

        this.updateFogOfWar();
        this.updateFood(dt);
        this.updateUI();

        // AI фракций - убрали дублирование
        for(let i=0;i<aliveFactions.length;i++) {
            const f=aliveFactions[i];
            f.aiTimer+=dt;
            if(f.aiTimer>1200) {
                f.aiTimer=0;
                this.updateFactionAI(f,1200);
            }
        }

        this.checkGameOver();
        this.updateEnemyList();
        this.renderMinimap();
    }

    updateDungeonExploration() {
        // Кешируем юниты игрока один раз
        const playerUnits = [];
        for (let i = 0; i < this.entities.length; i++) {
            if (this.entities[i].team === PLAYER) playerUnits.push(this.entities[i]);
        }

        // Проверяем только неисследованные данжи
        for (let d = 0; d < this.dungeons.length; d++) {
            const dungeon = this.dungeons[d];
            if (dungeon.explored) continue;

            for (let u = 0; u < playerUnits.length; u++) {
                const unit = playerUnits[u];
                const dx = unit.x - dungeon.x;
                const dy = unit.y - dungeon.y;
                const distSq = dx * dx + dy * dy;

                // Автоматическая очистка при приближении
                if (distSq < (dungeon.size * dungeon.size)) {
                    this.clearDungeon(dungeon, PLAYER);
                }

                // Проверка на исследование (внутри данжа)
                if (dungeon.contains(unit.x, unit.y)) {
                    // Проверяем живы ли защитники
                    let aliveCount = 0;
                    for (let g = 0; g < dungeon.guards.length; g++) {
                        if (dungeon.guards[g].health > 0) aliveCount++;
                    }

                    if (aliveCount > 0) {
                        this.showNotification(`⚔️ Сначала победите ${aliveCount} защитников!`);
                        break;
                    }
                    // Захват теперь происходит в методе update() самого данжа
                    break;
                }
            }
        }
    }

    updateDayNight(dt) {
        const wasNight=this.isNight;
        this.dayNightTimer=(this.dayNightTimer+dt)%DAY_NIGHT_CYCLE_MS;
        this.isNight=(this.dayNightTimer/DAY_NIGHT_CYCLE_MS)>=NIGHT_START_PROGRESS;
        if(this.isNight&&!wasNight) {
            this.mobSpawnTimer=NIGHT_MOB_SPAWN_INTERVAL_MS;
            this.nightCounter++;

            // Каждые 3 ночи усиливаем врагов на 15%
            if(this.nightCounter % 3 === 0) {
                this.enemyPowerLevel += 0.15;
                this.boostEnemyFactions();
                this.showNotification(`⚠️ Ночь ${this.nightCounter}! Враги стали сильнее (+15%)!`);
            } else {
                this.showNotification(`Наступила ночь ${this.nightCounter}. Появляются мобы.`);
            }
        }
        else if(!this.isNight&&wasNight) {
            this.clearNightMobs();
            this.showNotification('Наступил день.');
        }
    }

    boostEnemyFactions() {
        // Усиливаем все живые фракции
        for(let i=0;i<this.factions.length;i++) {
            const f=this.factions[i];
            if(!f.alive) continue;

            // Добавляем ресурсы
            f.player.wood += Math.floor(200 * this.enemyPowerLevel);
            f.player.stone += Math.floor(150 * this.enemyPowerLevel);
            f.player.food += Math.floor(100 * this.enemyPowerLevel);
            f.player.maxPopulation += 3;

            // Усиливаем существующие юниты
            for(let j=0;j<this.entities.length;j++) {
                const u=this.entities[j];
                if(u.team===f.teamId) {
                    u.maxHealth *= 1.15;
                    u.health = Math.min(u.health * 1.15, u.maxHealth);
                    if(u.damage) u.damage *= 1.15;
                }
            }

            // Усиливаем здания
            for(let j=0;j<this.buildings.length;j++) {
                const b=this.buildings[j];
                if(b.team===f.teamId) {
                    b.maxHealth *= 1.15;
                    b.health = Math.min(b.health * 1.15, b.maxHealth);
                    if(b.damage) b.damage *= 1.15;
                }
            }
        }
    }

    updateFood(dt) {
        this.foodTimer+=dt;
        if(this.foodTimer<10000) return;
        this.foodTimer=0;

        // Игрок
        this.updateTeamFood(PLAYER);

        // Все фракции
        for(let i=0;i<this.factions.length;i++) {
            if(this.factions[i].alive) {
                this.updateTeamFood(this.factions[i].teamId);
            }
        }
    }

    updateTeamFood(team) {
        const player=this.players[team];
        if(!player) return;

        // Подсчитываем фермы, дома и ратушу
        let farmCount=0, houseCount=0, th=null;
        for(let i=0;i<this.buildings.length;i++) {
            const b=this.buildings[i];
            if(b.team!==team) continue;
            if(b.type==='farm') {
                const level = b.level || 1;
                const farmData = FARM_LEVELS[level];
                player.food += farmData.foodRate;
            }
            else if(b.type==='house') houseCount++;
            else if(b.type==='townhall') th=b;
        }

        // Потребление еды
        let consumption=0;
        for(let i=0;i<this.entities.length;i++) {
            if(this.entities[i].team===team) {
                consumption+=this.getUnitFoodConsumption(this.entities[i]);
            }
        }
        consumption+=Math.floor(houseCount*0.5)+(th?th.level:0);

        player.food-=consumption;
        if(player.food<0) {
            player.food=0;
            if(team===PLAYER&&!this.hungerWarningShown) {
                this.showNotification('⚠️ Не хватает еды!');
                this.hungerWarningShown=true;
            }
            // Голодание
            for(let i=0;i<this.entities.length;i++) {
                if(this.entities[i].team===team) {
                    this.entities[i].starving=true;
                    this.entities[i].health-=5;
                }
            }
        } else {
            if(team===PLAYER) this.hungerWarningShown=false;
            // Убираем голодание
            for(let i=0;i<this.entities.length;i++) {
                if(this.entities[i].team===team) {
                    this.entities[i].starving=false;
                }
            }
        }
    }

    updateHealing(dt) {
        this.entities.forEach(u=>{
            if(u.health<=0||u.health>=u.maxHealth) return;
            u.healTimer=(u.healTimer||0)+dt;
            if(u.healTimer<3500) return;
            const p=this.players[u.team]; if(!p) return;
            const hfc=u.type==='worker'?2:4;
            if(p.food<hfc) return;
            p.food-=hfc; u.health=Math.min(u.maxHealth,u.health+(u.type==='worker'?5:8)); u.healTimer=0;
        });
    }

    updateResources(dt) {
        this.resources.forEach(r=>{
            if(r.type!=='wood'||!r.depleted) return;
            r.regrowTimer=(r.regrowTimer||0)+dt;
            if(r.regrowTimer>=90000) { r.depleted=false; r.amount=r.maxAmount; r.regrowTimer=0; }
        });
    }

    clearNightMobs() { this.entities=this.entities.filter(u=>u.team!==MOB); }

    clearDungeon(dungeon, team) {
        if (!dungeon.explored) {
            // Удаляем всех защитников данжа
            dungeon.guards.forEach(g => {
                const idx = this.entities.indexOf(g);
                if (idx > -1) this.entities.splice(idx, 1);
            });
            dungeon.guards = [];
        }
    }

    spawnNightMob() {
        const ths=this.buildings.filter(b=>b.health>0&&b.type==='townhall'&&(b.team===PLAYER||this.factions.find(f=>f.teamId===b.team)));
        if(ths.length===0) return;
        const th=ths[Math.floor(Math.random()*ths.length)];
        const c=getStructureCenter(th), a=Math.random()*Math.PI*2, d=380+Math.random()*260;
        const sx=Math.max(32,Math.min(c.x+Math.cos(a)*d,MAP_WIDTH*TILE_SIZE-32));
        const sy=Math.max(32,Math.min(c.y+Math.sin(a)*d,MAP_HEIGHT*TILE_SIZE-32));
        const mob=new Unit(sx,sy,'mob',MOB);

        // Усиление мобов с каждой ночью (+8% здоровья и урона за ночь)
        const nightBonus = 1 + (this.nightCounter * 0.08);
        mob.maxHealth = Math.floor(mob.maxHealth * nightBonus);
        mob.health = mob.maxHealth;
        mob.damage = Math.floor(mob.damage * nightBonus);

        mob.nightTargetX=c.x+(Math.random()-0.5)*110;
        mob.nightTargetY=c.y+(Math.random()-0.5)*110;
        mob.targetX=mob.nightTargetX;
        mob.targetY=mob.nightTargetY;
        this.entities.push(mob);
    }

    updateNightMobs(dt) {
        if(!this.isNight) return;
        this.mobSpawnTimer+=dt;

        // Подсчитываем активных мобов
        let activeMobs=0;
        for(let i=0;i<this.entities.length;i++) {
            if(this.entities[i].team===MOB) activeMobs++;
        }

        // Максимум мобов увеличивается с каждой ночью (+2 моба каждую ночь)
        const maxMobs = BASE_MAX_NIGHT_MOBS + (this.nightCounter * 2);

        if(this.mobSpawnTimer>=NIGHT_MOB_SPAWN_INTERVAL_MS&&activeMobs<maxMobs) {
            this.mobSpawnTimer=0;
            this.spawnNightMob();
        }

        // Обновляем поведение мобов
        for(let i=0;i<this.entities.length;i++) {
            const mob=this.entities[i];
            if(mob.team!==MOB||mob.health<=0) continue;

            if(mob.target&&mob.target.health>0) continue;

            const t=this.findPriorityEnemyTarget(MOB,mob.x,mob.y,170,true);
            if(t) mob.attackTarget(t,true);
            else if(mob.nightTargetX!==undefined) mob.moveTo(mob.nightTargetX,mob.nightTargetY);
        }
    }

    updateFogOfWar() {
        // Отладка для гостя
        if (this.mpEnabled && !this.mpIsHost && !this._fogDebugLogged) {
            const playerUnits = this.entities.filter(e => e.team === PLAYER);
            console.log('[MP] Guest updateFogOfWar - total entities:', this.entities.length, 'player units:', playerUnits.length, 'PLAYER constant:', PLAYER);
            if (this.entities.length > 0) {
                console.log('[MP] First entity team:', this.entities[0].team);
            }
            this._fogDebugLogged = true;
        }

        // Сбрасываем видимость
        for(let y=0;y<MAP_HEIGHT;y++) {
            for(let x=0;x<MAP_WIDTH;x++) {
                this.fogOfWar[y][x].visible=false;
            }
        }

        // Обрабатываем юниты
        for(let i=0;i<this.entities.length;i++) {
            const unit=this.entities[i];
            if(unit.team!==PLAYER) continue;

            const vr=this.getVisionRadius(unit);
            const tx=Math.floor(unit.x/TILE_SIZE), ty=Math.floor(unit.y/TILE_SIZE);
            const vrSq=vr*vr;

            for(let dy=-vr;dy<=vr;dy++) {
                const y=ty+dy;
                if(y<0||y>=MAP_HEIGHT) continue;

                for(let dx=-vr;dx<=vr;dx++) {
                    const x=tx+dx;
                    if(x<0||x>=MAP_WIDTH) continue;

                    if(dx*dx+dy*dy<=vrSq) {
                        this.fogOfWar[y][x].explored=true;
                        this.fogOfWar[y][x].visible=true;
                    }
                }
            }
        }

        // Обрабатываем здания
        for(let i=0;i<this.buildings.length;i++) {
            const b=this.buildings[i];
            if(b.team!==PLAYER||b.isRelocating) continue;

            const vr=this.getVisionRadius(b);
            const c=getStructureCenter(b);
            const tx=Math.floor(c.x/TILE_SIZE), ty=Math.floor(c.y/TILE_SIZE);
            const vrSq=vr*vr;

            for(let dy=-vr;dy<=vr;dy++) {
                const y=ty+dy;
                if(y<0||y>=MAP_HEIGHT) continue;

                for(let dx=-vr;dx<=vr;dx++) {
                    const x=tx+dx;
                    if(x<0||x>=MAP_WIDTH) continue;

                    if(dx*dx+dy*dy<=vrSq) {
                        this.fogOfWar[y][x].explored=true;
                        this.fogOfWar[y][x].visible=true;
                    }
                }
            }
        }
    }

    cleanupDestroyedBuildings() {
        const dead=this.buildings.filter(b=>b.health<=0);
        dead.forEach(b=>this.destroyBuilding(b));
    }

    checkGameOver() {
        // В мультиплеере гость не проверяет победу в первые 3 секунды (идёт синхронизация)
        if (this.mpEnabled && !this.mpIsHost && this.gameTime < 3000) {
            return;
        }

        const pth=this.buildings.find(b=>b.team===PLAYER&&b.type==='townhall');
        if(!pth||pth.health<=0) { this.endGame(false); return; }
        const allFactionsDead=this.factions.every(f=>!f.alive);
        if(allFactionsDead) this.endGame(true);
    }

    // Создание брутальных частиц
    spawnParticles(x, y, type, count = 10) {
        for(let i = 0; i < count; i++) {
            this.particles.push(new BrutalParticle(x, y, type));
        }
    }

    endGame(victory) {
        this.gameOver=true;
        const go=document.getElementById('gameOver');
        const gt=document.getElementById('gameOverText');
        gt.textContent=victory?'ПОБЕДА!':'ПОРАЖЕНИЕ';
        gt.style.color=victory?'#4CAF50':'#f44336';
        go.style.display='block';
    }

    updateUI() {
        const player=this.players[PLAYER];
        document.getElementById('wood').textContent=Math.floor(player.wood);
        document.getElementById('stone').textContent=Math.floor(player.stone);
        document.getElementById('food').textContent=Math.floor(player.food);
        document.getElementById('maxWood').textContent=player.maxStorage;
        document.getElementById('maxStone').textContent=player.maxStorage;
        document.getElementById('population').textContent=player.population;
        document.getElementById('maxPopulation').textContent=player.maxPopulation;
        document.getElementById('townHallLevel').textContent=player.townHallLevel;
        document.getElementById('timeOfDay').textContent=this.isNight?'🌙 Ночь':'☀️ День';
        document.getElementById('weatherStatus').textContent=this.weatherSystem.getCurrentWeatherName();

        // Показываем кнопку автодобычи на 4 уровне ратуши
        const autoGatherSection = document.getElementById('autoGatherSection');
        if (autoGatherSection) {
            autoGatherSection.style.display = player.townHallLevel >= 4 ? 'block' : 'none';
        }

        // Обновление списка артефактов
        const artifactList = document.getElementById('artifactList');
        if (this.artifacts.length === 0) {
            artifactList.innerHTML = '<span style="color: #888;">Нет артефактов</span>';
        } else {
            artifactList.innerHTML = this.artifacts.map(art => {
                const color = art.rarity === ARTIFACT_RARITY.RARE ? '#8A2BE2' : '#FFD700';
                return `<div style="color: ${color}; margin: 2px 0;">${art.getDescription()}</div>`;
            }).join('');
        }

        const sel=document.getElementById('selection');
        if(this.selectedUnits.length>0) {
            const u=this.selectedUnits[0];
            let n=u.type==='worker'?'рабочих':u.type==='swordsman'?'мечников':'лучников';
            const pf=u.type==='worker'?` | ${getWorkerProfessionLabel(u.profession)}`:'';
            const gg=this.selectedUnits.filter(s=>s.guardMode).length;
            const gd=gg>0?` | Охрана: ${gg} | G-держать V-снять`:'';

            // Показываем уровень для бойцов
            let levelInfo = '';
            if(u.isCombatant() && u.team === PLAYER) {
                const avgLevel = Math.floor(this.selectedUnits.reduce((sum, unit) => sum + (unit.level || 1), 0) / this.selectedUnits.length);
                levelInfo = ` | Ур.${avgLevel}`;
            }

            sel.innerHTML=`Выбрано: ${this.selectedUnits.length} ${n}${pf}${levelInfo}${gd}`;
        } else sel.innerHTML='';
    }

    updateEnemyList() {
        const el=document.getElementById('enemyEntries');
        el.innerHTML=this.factions.map(f=>{
            const th=this.buildings.find(b=>b.team===f.teamId&&b.type==='townhall');
            const soldiers=this.entities.filter(u=>u.team===f.teamId&&(u.type==='swordsman'||u.type==='archer')).length;
            const hp=th?Math.floor(th.health/th.maxHealth*100):0;
            const alive=f.alive&&th&&th.health>0;
            const stateIcon=f.aggressionState==='attacking'?'⚔️':f.aggressionState==='retreating'?'🏃':'🛡️';
            return `<div class="enemy-entry ${alive?'alive':'dead'}">
                ${stateIcon} ${f.name}<br>
                <span style="color:#aaa;font-size:10px;">Сл.${f.difficulty} | ${soldiers}⚔️ | ${alive?hp+'%HP':'☠️'}</span>
            </div>`;
        }).join('');
    }

    // ===== MINIMAP =====
    renderMinimap() {
        const w=minimapCanvas.width, h=minimapCanvas.height;
        const scaleX=w/MAP_WIDTH, scaleY=h/MAP_HEIGHT;
        minimapCtx.fillStyle='#2d5016';
        minimapCtx.fillRect(0,0,w,h);

        // Вода
        minimapCtx.fillStyle='#2d7fb8';
        this.waterTiles.forEach(key=>{
            const [tx,ty]=key.split(',').map(Number);
            minimapCtx.fillRect(tx*scaleX,ty*scaleY,scaleX+0.5,scaleY+0.5);
        });

        // Туман
        for(let y=0;y<MAP_HEIGHT;y++) for(let x=0;x<MAP_WIDTH;x++) {
            if(!this.fogOfWar[y][x].explored) { minimapCtx.fillStyle='rgba(0,0,0,0.85)'; minimapCtx.fillRect(x*scaleX,y*scaleY,scaleX+0.5,scaleY+0.5); }
            else if(!this.fogOfWar[y][x].visible) { minimapCtx.fillStyle='rgba(0,0,0,0.45)'; minimapCtx.fillRect(x*scaleX,y*scaleY,scaleX+0.5,scaleY+0.5); }
        }

        // Здания
        this.buildings.forEach(b=>{
            const tx=Math.floor(b.x/TILE_SIZE), ty=Math.floor(b.y/TILE_SIZE);
            if(!this.fogOfWar[ty]?.[tx]?.explored&&b.team!==PLAYER) return;
            if(b.team===PLAYER) minimapCtx.fillStyle='#4CAF50';
            else minimapCtx.fillStyle=this.factions.find(f=>f.teamId===b.team)?.color||'#f44336';
            minimapCtx.fillRect(tx*scaleX,ty*scaleY,3,3);
        });

        // Игрок (рамка)
        const vpx=this.camera.x/TILE_SIZE*scaleX, vpy=this.camera.y/TILE_SIZE*scaleY;
        const vpw=canvas.width/TILE_SIZE*scaleX, vph=canvas.height/TILE_SIZE*scaleY;
        minimapCtx.strokeStyle='rgba(255,255,255,0.7)';
        minimapCtx.lineWidth=1;
        minimapCtx.strokeRect(vpx,vpy,vpw,vph);
    }

    // ===== RENDER =====
    render() {
        // Если гость ждет первого снапшота, показываем экран загрузки
        if (this.waitingForInitialSnapshot) {
            ctx.fillStyle = '#1E1F1A';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#C9A84C';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Ожидание данных от хоста...', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Отладка для гостя
        if (this.mpEnabled && !this.mpIsHost && !this._debugLogged) {
            console.log('[MP] Guest render - entities:', this.entities.length, 'buildings:', this.buildings.length, 'resources:', this.resources.length);
            this._debugLogged = true;
        }

        // Брутальная темная земля вместо зеленой травы
        ctx.fillStyle='#1E1F1A'; // Темная, гниющая земля
        ctx.fillRect(0,0,canvas.width,canvas.height);

        // Добавляем текстуру земли (случайные темные пятна)
        const GRASS_DETAILS = ['#282B21', '#171714', '#2E2B21'];
        for(let i=0; i<50; i++) {
            ctx.fillStyle = GRASS_DETAILS[Math.floor(Math.random()*3)];
            const px = Math.random() * canvas.width;
            const py = Math.random() * canvas.height;
            const size = 2 + Math.random() * 4;
            ctx.fillRect(px, py, size, size);
        }

        ctx.save();
        ctx.translate(-this.camera.x,-this.camera.y);

        // Границы видимой области с запасом
        const viewLeft=this.camera.x-100;
        const viewRight=this.camera.x+canvas.width+100;
        const viewTop=this.camera.y-100;
        const viewBottom=this.camera.y+canvas.height+100;

        this.renderWater();

        // Ресурсы - только видимые
        for(let i=0;i<this.resources.length;i++) {
            const r=this.resources[i];
            if(r.x<viewLeft||r.x>viewRight||r.y<viewTop||r.y>viewBottom) continue;
            const tx=Math.floor(r.x/TILE_SIZE), ty=Math.floor(r.y/TILE_SIZE);
            if(tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT&&this.fogOfWar[ty][tx].visible) r.render(ctx, this.camera);
        }

        // Данжи - только видимые
        for(let i=0;i<this.dungeons.length;i++) {
            const d=this.dungeons[i];
            if(d.x<viewLeft||d.x>viewRight||d.y<viewTop||d.y>viewBottom) continue;
            const tx=Math.floor(d.x/TILE_SIZE), ty=Math.floor(d.y/TILE_SIZE);
            if(tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT&&this.fogOfWar[ty][tx].visible) d.render(ctx);
        }

        // Здания - только видимые
        for(let i=0;i<this.buildings.length;i++) {
            const b=this.buildings[i];
            if(b.isRelocating) continue;
            if(b.x<viewLeft||b.x>viewRight||b.y<viewTop||b.y>viewBottom) continue;
            const tx=Math.floor(b.x/TILE_SIZE), ty=Math.floor(b.y/TILE_SIZE);
            if(tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT&&(this.fogOfWar[ty][tx].visible||b.team===PLAYER)) {
                const factionColor=b.team!==PLAYER?this.factions.find(f=>f.teamId===b.team)?.color:undefined;
                b.render(ctx, factionColor, this.camera);
            }
        }

        // Показываем радиус выбранной башни лучников
        if(this.activeMenuBuilding && this.activeMenuBuilding.type === 'archertower') {
            const tower = this.activeMenuBuilding;
            const level = tower.level || 1;
            const range = ARCHER_TOWER_LEVELS[level].range;
            const centerX = tower.x + tower.width / 2 - this.camera.x;
            const centerY = tower.y + tower.height / 2 - this.camera.y;

            ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(centerX, centerY, range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Показываем радиус действия костра
        if(this.activeMenuBuilding && this.activeMenuBuilding.type === 'beacon') {
            const beacon = this.activeMenuBuilding;
            const config = getBuildingConfig('beacon');
            const radius = config.visionRadius || 200;
            const centerX = beacon.x + beacon.width / 2 - this.camera.x;
            const centerY = beacon.y + beacon.height / 2 - this.camera.y;

            ctx.strokeStyle = 'rgba(255, 140, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Добавляем текст с описанием
            ctx.fillStyle = 'rgba(255, 140, 0, 0.8)';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Радиус света', centerX, centerY - radius - 10);
        }

        // Стройки - только видимые
        for(let i=0;i<this.constructionSites.length;i++) {
            const site=this.constructionSites[i];
            if(site.x<viewLeft||site.x>viewRight||site.y<viewTop||site.y>viewBottom) continue;
            const tx=Math.floor(site.x/TILE_SIZE), ty=Math.floor(site.y/TILE_SIZE);
            if(tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT&&(this.fogOfWar[ty][tx].visible||site.team===PLAYER)) site.render(ctx);
        }

        // Юниты - только видимые
        for(let i=0;i<this.entities.length;i++) {
            const e=this.entities[i];
            if(e.x<viewLeft||e.x>viewRight||e.y<viewTop||e.y>viewBottom) continue;
            const tx=Math.floor(e.x/TILE_SIZE), ty=Math.floor(e.y/TILE_SIZE);
            if(tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT&&(this.fogOfWar[ty][tx].visible||e.team===PLAYER)) {
                // Спящие рабочие игрока прячутся в дома (не отрисовываются только если они внутри дома)
                if(e.type==='worker' && e.insideHouse) {
                    if(Math.random() < 0.01) console.log('🔍 Проверка скрытия: team=', e.team, 'PLAYER=', PLAYER, 'insideHouse=', e.insideHouse, 'match=', e.team===PLAYER);
                }
                if(e.team===PLAYER && e.type==='worker' && e.insideHouse) {
                    continue; // Пропускаем отрисовку - юнит внутри дома
                }
                const factionColor=e.team!==PLAYER&&e.team!==MOB?this.factions.find(f=>f.teamId===e.team)?.color:undefined;
                e.render(ctx, this.selectedUnits.includes(e), factionColor);
            }
        }

        // Рендерим частицы
        for(let i=0;i<this.particles.length;i++) {
            this.particles[i].render(ctx, this.camera.x, this.camera.y);
        }

        this.renderDayNightOverlay();

        // Рендерим погоду поверх всего
        this.weatherSystem.render(ctx);

        this.renderFogOfWar();

        if(this.selectionBox) {
            const box=this.normalizeBox(this.selectionBox);
            ctx.strokeStyle='rgba(0,255,0,0.8)'; ctx.lineWidth=2;
            ctx.strokeRect(box.x,box.y,box.w,box.h);
            ctx.fillStyle='rgba(0,255,0,0.1)'; ctx.fillRect(box.x,box.y,box.w,box.h);
        }

        // Предпросмотр здания при строительстве
        if(this.buildMode && this.buildingType) {
            const mx = this.mouse.worldX;
            const my = this.mouse.worldY;
            const config = getBuildingConfig(this.buildingType);
            const bounds = this.getPlacementBounds(mx, my, this.buildingType);
            const canPlace = this.canPlaceBuilding(mx, my, this.buildingType, this.relocationContext?.building);

            // Рисуем полупрозрачный прямоугольник здания
            if(canPlace.valid) {
                ctx.fillStyle = 'rgba(76, 175, 80, 0.4)'; // Зеленый если можно поставить
                ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
            } else {
                ctx.fillStyle = 'rgba(244, 67, 54, 0.4)'; // Красный если нельзя
                ctx.strokeStyle = 'rgba(244, 67, 54, 0.8)';
            }

            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.lineWidth = 3;
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

            // Показываем название здания
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(getBuildingDisplayName(this.buildingType), bounds.x + bounds.width/2, bounds.y - 10);

            // Показываем причину если нельзя поставить
            if(!canPlace.valid) {
                ctx.fillStyle = '#ff5252';
                ctx.font = '14px Arial';
                ctx.fillText(this.getPlacementErrorMessage(canPlace.reason), bounds.x + bounds.width/2, bounds.y + bounds.height + 20);
            }
        }

        ctx.restore();
    }

    renderWater() {
        const sx=Math.max(0,Math.floor(this.camera.x/TILE_SIZE)-1);
        const sy=Math.max(0,Math.floor(this.camera.y/TILE_SIZE)-1);
        const ex=Math.min(MAP_WIDTH,Math.ceil((this.camera.x+canvas.width)/TILE_SIZE)+1);
        const ey=Math.min(MAP_HEIGHT,Math.ceil((this.camera.y+canvas.height)/TILE_SIZE)+1);
        for(let y=sy;y<ey;y++) for(let x=sx;x<ex;x++) {
            if(!this.isWaterTile(x,y)) continue;
            const wx=x*TILE_SIZE, wy=y*TILE_SIZE;
            ctx.fillStyle=(x+y)%2===0?'#2d7fb8':'#246fa3';
            ctx.fillRect(wx,wy,TILE_SIZE,TILE_SIZE);
            ctx.fillStyle='rgba(255,255,255,0.08)';
            ctx.fillRect(wx,wy+TILE_SIZE*0.2,TILE_SIZE,TILE_SIZE*0.18);
        }
    }

    renderFogOfWar() {
        // Брутальная палитра тумана войны
        const FOG_UNEXPLORED = '#050404'; // Абсолютная тьма
        const FOG_EXPLORED = 'rgba(15, 12, 12, 0.6)'; // Пепельная дымка

        const sx=Math.floor(this.camera.x/TILE_SIZE), sy=Math.floor(this.camera.y/TILE_SIZE);
        const ex=Math.ceil((this.camera.x+canvas.width)/TILE_SIZE), ey=Math.ceil((this.camera.y+canvas.height)/TILE_SIZE);

        for(let y=Math.max(0,sy);y<Math.min(MAP_HEIGHT,ey);y++) {
            for(let x=Math.max(0,sx);x<Math.min(MAP_WIDTH,ex);x++) {
                const fog=this.fogOfWar[y][x];
                const drawX = x*TILE_SIZE;
                const drawY = y*TILE_SIZE;

                if(!fog.explored) {
                    // Неизведанная тьма - убираем швы
                    ctx.fillStyle=FOG_UNEXPLORED;
                    ctx.fillRect(drawX-1, drawY-1, TILE_SIZE+2, TILE_SIZE+2);
                } else if(!fog.visible) {
                    // Разведанная, но вне поля зрения - пепельная дымка
                    ctx.fillStyle=FOG_EXPLORED;
                    ctx.fillRect(drawX-1, drawY-1, TILE_SIZE+2, TILE_SIZE+2);
                }
            }
        }
    }

    renderDayNightOverlay() {
        const nb=this.getNightBlend(); if(nb<=0) return;
        ctx.fillStyle=`rgba(12,20,44,${0.18+nb*0.22})`;
        ctx.fillRect(this.camera.x,this.camera.y,canvas.width,canvas.height);
    }

    loop(time) {
        const dt=time-this.lastTime; this.lastTime=time;
        this.update(dt); this.render();
        requestAnimationFrame(t=>this.loop(t));
    }
}

// ===================== UNIT =====================
class Unit {
    constructor(x, y, type, team, profession=null) {
        this.id = null; // Будет установлен при добавлении в игру
        this.x=x; this.y=y; this.type=type; this.team=team;
        this.targetX=x; this.targetY=y;
        this.task=null; this.carrying=null; this.target=null; this.resumeTask=null;
        this.guardMode=false; this.guardX=x; this.guardY=y; this.guardRadius=GUARD_RADIUS_TILES*TILE_SIZE;
        this.guardModeSetTime=0; // Время когда был установлен режим охраны
        this.isResting=false;
        this.restingHouse=null; // Дом, в котором отдыхает юнит
        this.insideHouse=false; // Флаг что юнит физически внутри дома
        this.profession=type==='worker'?(profession||'generalist'):null;

        // Поля для улучшенной рыбалки
        this.fishingTime = 0;
        this.fishingDuration = 0;
        this.fishCaught = 0;
        this.targetFishCount = 0;

        // Система прокачки для бойцов
        this.level = 1;
        this.experience = 0;
        this.experienceToNextLevel = 100;

        const stats={
            worker:{speed:60,health:50,maxHealth:50,damage:5,attackRange:30,attackInterval:1000},
            swordsman:{speed:70,health:120,maxHealth:120,damage:20,attackRange:35,attackInterval:1000},
            archer:{speed:80,health:80,maxHealth:80,damage:15,attackRange:150,attackInterval:1000},
            mob:{speed:50,health:50,maxHealth:50,damage:8,attackRange:24,attackInterval:1600},
        };
        Object.assign(this, stats[type]||{speed:80,health:100,maxHealth:100,damage:15,attackRange:30,attackInterval:1000});
        this.attackCooldown=0; this.gatherTimer=0; this.gatherDuration=2000; this.starving=false; this.healTimer=0;
    }

    isCombatant() { return this.type!=='worker'; }

    // Система прокачки бойцов
    addExperience(amount) {
        if (!this.isCombatant() || this.team !== PLAYER) return;

        this.experience += amount;

        while (this.experience >= this.experienceToNextLevel) {
            this.experience -= this.experienceToNextLevel;
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;

        // Увеличение характеристик при повышении уровня
        const healthIncrease = this.type === 'swordsman' ? 15 : 10;
        const damageIncrease = this.type === 'swordsman' ? 3 : 2;
        const speedIncrease = 2;

        this.maxHealth += healthIncrease;
        this.health = this.maxHealth; // Полное восстановление при повышении уровня
        this.damage += damageIncrease;
        this.speed += speedIncrease;

        // Увеличение опыта для следующего уровня
        this.experienceToNextLevel = Math.floor(this.experienceToNextLevel * 1.5);
    }

    getExperienceForKill(target) {
        // Опыт зависит от типа убитого врага
        if (target.type === 'mob') return 25;
        if (target.type === 'worker') return 10;
        if (target.type === 'swordsman') return 50;
        if (target.type === 'archer') return 45;
        return 20;
    }

    canGatherResource(resource) {
        if(this.type!=='worker'||!resource) return false;
        const pr=getWorkerResourceType(this.profession);
        return !pr||pr===resource.type;
    }

    setProfessionForResource(resource) {
        if(this.type!=='worker'||!resource) return;
        // Обычные рабочие (generalist) НЕ МОГУТ получить профессию
        // Они остаются универсальными навсегда
        if(this.profession==='generalist') return;
        // Только рабочие БЕЗ профессии могут получить специализацию
        if(this.profession&&this.profession!=='generalist') return;
        if(resource.type==='stone') this.profession='miner';
        else if(resource.type==='wood') this.profession='lumberjack';
        else if(resource.type==='food') this.profession='fisher';
        else this.profession='generalist';
    }

    getGatherDurationForResource(resource, game=null) {
        if(!resource) return this.gatherDuration;
        let gd=this.gatherDuration;
        if(this.profession==='miner'&&resource.type==='stone') gd=1400;
        if(this.profession==='lumberjack'&&resource.type==='wood') gd=1450;
        if(this.profession==='fisher'&&resource.type==='food') gd=1350;
        if(!game) return gd;
        const ul=game.getWorkerUpgradeLevel(this.team,this.profession);
        const upg=WORKER_UPGRADE_LEVELS[ul];
        return upg ? Math.max(650,Math.round(gd*upg.speedMultiplier)) : gd;
    }

    getGatherYield(resource, game=null) {
        if(!resource) return 0;
        const ul=game?game.getWorkerUpgradeLevel(this.team,this.profession):0;
        const yb=WORKER_UPGRADE_LEVELS[ul]?.yieldBonus||0;
        return Math.max(1,resource.gatherAmount+yb);
    }

    getCarrySpeedMultiplier() {
        if(this.type!=='worker'||!this.carrying) return 1;
        if(this.profession==='miner'&&this.carrying.type==='stone') return 1.22;
        if(this.profession==='lumberjack'&&this.carrying.type==='wood') return 1.18;
        if(this.profession==='fisher'&&this.carrying.type==='food') return 1.2;
        return 1;
    }

    releaseHouseSlot() {
        if (!this.restingHouse) return;
        if (this.restingHouse.occupants) {
            const occupantIndex = this.restingHouse.occupants.indexOf(this);
            if (occupantIndex > -1) this.restingHouse.occupants.splice(occupantIndex, 1);
        }
        if (this.restingHouse.reservedOccupants) {
            const reserveIndex = this.restingHouse.reservedOccupants.indexOf(this);
            if (reserveIndex > -1) this.restingHouse.reservedOccupants.splice(reserveIndex, 1);
        }
    }

    leaveHouse(game) {
        this.releaseHouseSlot();
        this.restingHouse = null;
        this.isResting = false;
        this.insideHouse = false;
    }

    moveTo(x,y) { this.leaveHouse(); this.targetX=x; this.targetY=y; this.task=null; this.target=null; this.resumeTask=null; this.guardMode=false; this.gatherTimer=0; }

    gatherResource(resource, options={}) {
        if(!this.canGatherResource(resource)) return false;
        this.leaveHouse();
        this.setProfessionForResource(resource);
        this.task={type:'gather',resource,chainRemaining:options.chainRemaining||0,manualOrder:Boolean(options.manualOrder)};
        this.target=null; this.resumeTask=null; this.guardMode=false; this.gatherTimer=0;
        return true;
    }

    attackTarget(target, preserveGuard=false, preserveTask=false) {
        this.leaveHouse();
        if(preserveTask&&this.task?.type==='gather'&&this.task.resource&&!this.task.resource.depleted) this.resumeTask={...this.task};
        else if(!preserveTask) this.resumeTask=null;
        this.target=target; this.task=null;
        if(!preserveGuard) this.guardMode=false;
        this.gatherTimer=0;
    }

    update(dt, game) {
        if(this.health<=0) {
            const idx=game.entities.indexOf(this);
            if(idx>-1) {
                game.entities.splice(idx,1);
                if(game.players[this.team]) game.players[this.team].population=Math.max(0,game.players[this.team].population-1);

                // Синхронизация смерти в мультиплеере
                if(game.mpEnabled && game.mpIsHost && this.team === PLAYER && typeof mpSendAction === 'function') {
                    mpSendAction({ type: 'unitDied', unitId: this.id });
                }
            }
            return;
        }

        // Применение бонусов артефактов
        const speedBonus = this.artifactBonuses?.speed || 0;
        const strengthBonus = this.artifactBonuses?.strength || 0;
        const healthBonus = this.artifactBonuses?.health || 0;

        // Скорость при голоде
        const baseSpeed={worker:60,swordsman:70,archer:80,mob:56}[this.type]||80;
        this.speed=this.starving?baseSpeed*0.67:baseSpeed;
        // Применяем бонус скорости от артефактов
        this.speed *= (1 + speedBonus);
        if(this.type==='worker'&&this.carrying) this.speed*=this.getCarrySpeedMultiplier();

        // Применяем бонус здоровья (только к максимальному здоровью)
        const baseMaxHealth={worker:50,swordsman:120,archer:80,mob:72}[this.type]||100;
        this.maxHealth = baseMaxHealth * (1 + healthBonus);

        // Применяем бонус силы к урону
        const baseDamage={worker:5,swordsman:20,archer:15,mob:11}[this.type]||15;
        this.damage = baseDamage * (1 + strengthBonus);

        this.attackCooldown=Math.max(0,this.attackCooldown-dt);

        // Логика защитников данжей
        if(this.isDungeonGuard) {
            const distFromDungeon = Math.hypot(this.x - this.dungeonX, this.y - this.dungeonY);

            // Если есть цель, проверяем не вышла ли она из зоны
            if(this.target) {
                const tc = getEntityCenter(this.target);
                const targetDistFromDungeon = Math.hypot(tc.x - this.dungeonX, tc.y - this.dungeonY);

                // Если цель вышла из зоны охраны - прекращаем погоню
                if(targetDistFromDungeon > this.guardRadius) {
                    this.target = null;
                    this.targetX = this.homeX;
                    this.targetY = this.homeY;
                }
            }

            // Если нет цели, ищем врагов в зоне данжа
            if(!this.target) {
                const enemies = game.entities.filter(e => {
                    if(e.team === this.team || e.team === MOB) return false;
                    const dist = Math.hypot(e.x - this.dungeonX, e.y - this.dungeonY);
                    return dist <= this.guardRadius;
                });

                if(enemies.length > 0) {
                    // Атакуем ближайшего врага
                    enemies.sort((a,b) => {
                        const da = Math.hypot(a.x - this.x, a.y - this.y);
                        const db = Math.hypot(b.x - this.x, b.y - this.y);
                        return da - db;
                    });
                    this.target = enemies[0];
                } else {
                    // Возвращаемся домой если далеко
                    const distFromHome = Math.hypot(this.x - this.homeX, this.y - this.homeY);
                    if(distFromHome > 20) {
                        this.targetX = this.homeX;
                        this.targetY = this.homeY;
                    }
                }
            }
        }

        if(this.target) {
            if(this.target.health<=0||(this.target.depleted!==undefined&&this.target.depleted)) this.target=null;
            else if(this.guardMode) {
                const tc=getEntityCenter(this.target);
                if(Math.hypot(tc.x-this.guardX,tc.y-this.guardY)>this.guardRadius*1.7) this.target=null;
            }
        }

        if(!this.target&&this.type==='worker'&&!this.task&&this.resumeTask) game.resumeWorkerEconomy(this);

        if(this.target) {
            const tc=getEntityCenter(this.target);
            const dist=Math.hypot(tc.x-this.x,tc.y-this.y);
            if(dist>this.attackRange) { this.targetX=tc.x; this.targetY=tc.y; }
            else {
                if(this.attackCooldown===0) {
                    this.target.health-=this.damage;
                    this.attackCooldown=this.attackInterval;

                    // Если цель убита, получаем опыт
                    if(this.target.health <= 0 && this.isCombatant() && this.team === PLAYER) {
                        const expGained = this.getExperienceForKill(this.target);
                        this.addExperience(expGained);
                    }

                    // Создаем частицы крови при ударе
                    if(game && game.spawnParticles) {
                        const particleType = this.target.type === 'mob' ? 'dark_magic' : 'blood';
                        game.spawnParticles(tc.x, tc.y, particleType, 8);
                    }
                }
                return;
            }
        }

        if(this.guardMode&&this.isCombatant()&&this.team!==MOB) {
            const gt=game.findPriorityEnemyTarget(this.team,this.guardX,this.guardY,this.guardRadius,true);
            if(!this.target&&gt) { this.attackTarget(gt,true); return; }
            if(!this.target) {
                const d=Math.hypot(this.guardX-this.x,this.guardY-this.y);
                if(d>10) { this.targetX=this.guardX; this.targetY=this.guardY; }
            }
        }

        if(this.task?.type==='gather') {
            const resource=this.task.resource, activeTask=this.task;
            if(resource.depleted&&!this.carrying) {
                if(!game.continueWorkerResourceChain(this,resource,activeTask)) game.stopWorkerAtTownHall(this);
                return;
            }

            // Улучшенная механика рыбалки
            if(this.profession === 'fisher' && resource.type === 'food' && game.isWaterAtWorld(resource.x, resource.y)) {
                if(this.carrying) {
                    // Несем рыбу на склад
                    const player=game.players[this.team];
                    const storage=game.buildings.find(b=>b.team===this.team&&b.type==='storage');
                    const th=game.buildings.find(b=>b.team===this.team&&b.type==='townhall');
                    const tgt=storage||th;
                    if(tgt) {
                        const dc=getStructureCenter(tgt);
                        const d=Math.hypot(dc.x-this.x,dc.y-this.y);
                        if(d<50) {
                            // Сдаем всю рыбу
                            const foodPerFish = Math.floor(2 + Math.random() * 2); // 2-3 еды за рыбу
                            const totalFood = this.fishCaught * foodPerFish;
                            player.food += totalFood;

                            // Сбрасываем состояние
                            this.carrying = null;
                            this.fishCaught = 0;
                            this.targetFishCount = 0;
                            this.fishingTime = 0;
                            this.fishingDuration = 0;
                            this.gatherTimer = 0;

                            // Возвращаемся к ресурсу
                            if(resource.depleted) {
                                if(!game.continueWorkerResourceChain(this,resource,activeTask)) game.stopWorkerAtTownHall(this);
                            } else {
                                this.task={...activeTask,resource};
                            }
                        } else {
                            this.targetX=dc.x; this.targetY=dc.y;
                        }
                    }
                } else {
                    // Рыбачим
                    const d=Math.hypot(resource.x-this.x,resource.y-this.y);
                    if(d<30) {
                        // Инициализируем рыбалку если нужно
                        if(this.targetFishCount === 0) {
                            this.targetFishCount = Math.floor(2 + Math.random() * 4); // 2-5 рыб
                            this.fishingDuration = Math.floor(2000 + Math.random() * 3000); // 2-5 секунд на рыбу
                        }

                        // Ловим рыбу
                        if(this.fishCaught < this.targetFishCount) {
                            this.fishingTime += dt;
                            if(this.fishingTime >= this.fishingDuration) {
                                // Поймали рыбу!
                                this.fishCaught++;
                                this.fishingTime = 0;

                                // Уменьшаем ресурс
                                const ga = Math.min(this.getGatherYield(resource,game), resource.amount);
                                resource.amount -= ga;
                                if(resource.amount <= 0) {
                                    resource.amount = 0;
                                    resource.depleted = true;

                                    // Синхронизация истощения ресурса
                                    if(game.mpEnabled && game.mpIsHost && typeof mpSendAction === 'function') {
                                        const idx = game.resources.indexOf(resource);
                                        if(idx >= 0) {
                                            mpSendAction({ type: 'resourceDepleted', index: idx, amount: 0 });
                                        }
                                    }
                                }

                                // Новое случайное время на следующую рыбу
                                if(this.fishCaught < this.targetFishCount) {
                                    this.fishingDuration = Math.floor(2000 + Math.random() * 3000);
                                }
                            }
                        } else {
                            // Собрали достаточно рыбы, идем на склад
                            this.carrying = { type: 'food', amount: this.fishCaught };
                        }
                        return;
                    } else {
                        this.targetX=resource.x;
                        this.targetY=resource.y;
                        this.fishingTime = 0;
                        this.fishCaught = 0;
                        this.targetFishCount = 0;
                    }
                }
            } else {
                // Обычная механика сбора для других профессий
                if(this.carrying) {
                    const player=game.players[this.team];
                    const storage=game.buildings.find(b=>b.team===this.team&&b.type==='storage');
                    const th=game.buildings.find(b=>b.team===this.team&&b.type==='townhall');
                    const tgt=storage||th;
                    if(tgt) {
                        const dc=getStructureCenter(tgt);
                        const d=Math.hypot(dc.x-this.x,dc.y-this.y);
                        if(d<50) {
                            const rt=this.carrying.type, ra=this.carrying.amount;
                            const cur=player[rt]||0;
                            const max=rt==='food'?Infinity:player.maxStorage;
                            if(cur+ra<=max) {
                                player[rt]+=ra; this.carrying=null; this.gatherTimer=0;
                                if(resource.depleted) { if(!game.continueWorkerResourceChain(this,resource,activeTask)) game.stopWorkerAtTownHall(this); }
                                else this.task={...activeTask,resource};
                            } else {
                                player[rt]=max; this.carrying=null; game.stopWorkerAtTownHall(this);
                                if(this.team===PLAYER) game.showNotification('⚠️ Склад переполнен!');
                            }
                        } else { this.targetX=dc.x; this.targetY=dc.y; }
                    }
                } else {
                    const d=Math.hypot(resource.x-this.x,resource.y-this.y);
                    if(d<30) {
                        this.gatherTimer+=dt;
                        if(this.gatherTimer>=this.getGatherDurationForResource(resource,game)) {
                            const ga=Math.min(this.getGatherYield(resource,game),resource.amount);
                            resource.amount-=ga;
                            if(resource.amount<=0) {
                                resource.amount=0;
                                resource.depleted=true;

                                // Синхронизация истощения ресурса
                                if(game.mpEnabled && game.mpIsHost && typeof mpSendAction === 'function') {
                                    const idx = game.resources.indexOf(resource);
                                    if(idx >= 0) {
                                        mpSendAction({ type: 'resourceDepleted', index: idx, amount: 0 });
                                    }
                                }
                            }
                            this.carrying={type:resource.type,amount:ga}; this.gatherTimer=0;
                        }
                        return;
                    } else { this.targetX=resource.x; this.targetY=resource.y; this.gatherTimer=0; }
                }
            }
        }

        if(this.task?.type==='build') {
            const site=this.task.site, sc=getStructureCenter(site);
            const d=Math.hypot(sc.x-this.x,sc.y-this.y);
            if(d>50) { this.targetX=sc.x; this.targetY=sc.y; } else return;
        }

        // Движение
        const dx=this.targetX-this.x, dy=this.targetY-this.y;
        const dist=Math.sqrt(dx*dx+dy*dy);

        // Проверка входа в дом (независимо от движения)
        if (this.type === 'worker' && this.isResting) {
            if (this.restingHouse && !this.insideHouse) {
                const house = this.restingHouse;
                const hc = getStructureCenter(house);
                const distToHouse = Math.hypot(this.x - hc.x, this.y - hc.y);

                // Увеличенный радиус входа - юнит может войти издалека
                const enterRadius = house.width * 2; // 128 пикселей вместо 64

                if(Math.random() < 0.1) {
                    console.log('Идем к дому: distToHouse=', distToHouse.toFixed(1), 'порог=', enterRadius);
                }

                // Если юнит достаточно близко к дому
                if (distToHouse < enterRadius && house.health > 0 && game.getHouseLoad(house) < house.maxOccupants) {
                    house.reservedOccupants = house.reservedOccupants || [];
                    if (!house.reservedOccupants.includes(this)) house.reservedOccupants.push(this);
                    if (!house.occupants.includes(this)) house.occupants.push(this);
                    this.x = hc.x;
                    this.y = hc.y;
                    this.targetX = hc.x;
                    this.targetY = hc.y;
                    this.insideHouse = true;
                    console.log('✅ Юнит вошел в дом! insideHouse=', this.insideHouse, 'occupants=', house.occupants.length, '/', house.maxOccupants, 'distToHouse=', distToHouse.toFixed(1));
                    return;
                }
            } else if (this.insideHouse) {
                return;
            }
        }

        if(dist>5) {
            const nx=this.x+(dx/dist)*this.speed*(dt/1000);
            const ny=this.y+(dy/dist)*this.speed*(dt/1000);
            let canMove=true;
            game.entities.forEach(other=>{
                if(other!==this&&Math.hypot(nx-other.x,ny-other.y)<24) {
                    canMove=false;
                    const pa=Math.atan2(other.y-this.y,other.x-this.x);
                    const pd=(24-Math.hypot(nx-other.x,ny-other.y))/2;
                    other.x+=Math.cos(pa)*pd*0.5; other.y+=Math.sin(pa)*pd*0.5;
                }
            });
            if(canMove) { this.x=nx; this.y=ny; }
            else {
                const aa=Math.atan2(dy,dx)+(Math.random()-0.5)*Math.PI/2;
                this.x+=Math.cos(aa)*this.speed*(dt/1000)*0.5; this.y+=Math.sin(aa)*this.speed*(dt/1000)*0.5;
            }
        } else {
            // Юнит достиг цели
            this.isResting=true;
        }
    }

    render(ctx, selected, factionColor) {
        const isPlayer=this.team===PLAYER;
        const baseColor=isPlayer?null:factionColor;

        // Брутальная тень под юнитом
        ctx.fillStyle='rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y+10, 10, 4, 0, 0, Math.PI*2);
        ctx.fill();

        if(this.type==='worker') {
            this.renderBrutalWorker(ctx, isPlayer, baseColor);
        } else if(this.type==='swordsman') {
            this.renderBrutalSwordsman(ctx, isPlayer, baseColor);
        } else if(this.type==='archer') {
            this.renderBrutalArcher(ctx, isPlayer, baseColor);
        } else if(this.type==='mob') {
            this.renderBrutalMob(ctx);
        }

        if(selected) {
            ctx.strokeStyle='#C9A84C';
            ctx.lineWidth=2;
            ctx.beginPath();
            ctx.arc(this.x,this.y,18,0,Math.PI*2);
            ctx.stroke();
        }

        // Круг охраны
        if(this.guardMode&&this.isCombatant()&&this.team!==MOB) {
            const timeSinceSet = Date.now() - this.guardModeSetTime;
            if(timeSinceSet < 3000) {
                const opacity = Math.max(0.1, 0.35 * (1 - timeSinceSet / 3000));
                ctx.strokeStyle=`rgba(201,168,76,${opacity})`;
                ctx.lineWidth=2;
                ctx.beginPath();
                ctx.arc(this.guardX,this.guardY,this.guardRadius,0,Math.PI*2);
                ctx.stroke();
            }
        }

        // Брутальный хелсбар
        ctx.fillStyle='#000';
        ctx.fillRect(this.x-15,this.y-20,30,4);
        const healthColor = isPlayer ? '#6E8B3D' : this.team===MOB ? '#8B0000' : (factionColor||'#8B0000');
        ctx.fillStyle=healthColor;
        ctx.fillRect(this.x-15,this.y-20,30*(this.health/this.maxHealth),4);

        // Индикатор уровня для бойцов игрока
        if(this.isCombatant() && this.team === PLAYER && this.level > 1) {
            ctx.fillStyle='#FFD700';
            ctx.strokeStyle='#000';
            ctx.lineWidth=2;
            ctx.font='bold 10px Arial';
            ctx.textAlign='center';
            ctx.strokeText(`Ур.${this.level}`, this.x, this.y-24);
            ctx.fillText(`Ур.${this.level}`, this.x, this.y-24);
        }

        // Индикаторы
        if(this.carrying) {
            const carryColor = this.carrying.type==='wood'?'#3D2A1F':this.carrying.type==='food'?'#2A3D3D':'#2B2B2B';
            ctx.fillStyle=carryColor;
            ctx.fillRect(this.x-5,this.y-25,10,10);
            ctx.strokeStyle='#000';
            ctx.lineWidth=1;
            ctx.strokeRect(this.x-5,this.y-25,10,10);
        }
        if(this.isResting&&isPlayer&&this.type==='worker') {
            ctx.fillStyle='#4A5C2B';
            ctx.font='18px Arial';
            ctx.textAlign='center';
            ctx.fillText('💤',this.x,this.y-30);
        }
        if(this.starving&&isPlayer) {
            ctx.fillStyle='#8B0000';
            ctx.font='14px Arial';
            ctx.fillText('🍖',this.x-8,this.y-28);
        }

        // Индикация рыбалки
        if(this.type==='worker' && this.profession === 'fisher' && this.targetFishCount > 0 && !this.carrying) {
            ctx.fillStyle='rgba(200,185,140,0.9)';
            ctx.font='10px Arial';
            ctx.textAlign='center';
            ctx.fillText(`🐟 ${this.fishCaught}/${this.targetFishCount}`, this.x, this.y - 28);

            if(this.fishCaught < this.targetFishCount && this.fishingDuration > 0) {
                const progress = Math.min(1, this.fishingTime / this.fishingDuration);
                ctx.fillStyle='rgba(42,74,24,0.5)';
                ctx.fillRect(this.x - 15, this.y - 38, 30 * progress, 4);
                ctx.strokeStyle='#4A8C2A';
                ctx.lineWidth = 1;
                ctx.strokeRect(this.x - 15, this.y - 38, 30, 4);
            }
        } else if(this.type==='worker' && this.gatherTimer>0&&this.task&&!this.carrying) {
            const prog=this.gatherTimer/this.getGatherDurationForResource(this.task.resource,typeof game!=='undefined'?game:null);
            ctx.strokeStyle='#8B6914';
            ctx.lineWidth=3;
            ctx.beginPath();
            ctx.arc(this.x,this.y,16,-Math.PI/2,-Math.PI/2+(Math.PI*2*prog));
            ctx.stroke();
        }
    }

    renderBrutalWorker(ctx, isPlayer, baseColor) {
        const palette = { body: '#3A2E2A', gear: '#1F1A18', skin: '#8C7A70', weapon: '#4A4A4A' };

        // Тело (темная одежда)
        ctx.fillStyle = this.starving ? '#2A1E1A' : palette.body;
        ctx.fillRect(this.x-6, this.y-4, 12, 14);

        // Голова
        ctx.fillStyle = palette.skin;
        ctx.fillRect(this.x-5, this.y-10, 10, 8);

        // Глаза (темные точки)
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x-3, this.y-7, 2, 2);
        ctx.fillRect(this.x+1, this.y-7, 2, 2);

        // Руки
        ctx.fillStyle = palette.gear;
        ctx.fillRect(this.x-8, this.y-2, 3, 8);
        ctx.fillRect(this.x+5, this.y-2, 3, 8);

        // Инструмент в руке
        ctx.fillStyle = palette.weapon;
        if(this.profession === 'lumberjack') {
            // Топор
            ctx.fillRect(this.x+6, this.y+4, 2, 8);
            ctx.fillRect(this.x+4, this.y+3, 6, 3);
        } else if(this.profession === 'miner') {
            // Кирка
            ctx.fillRect(this.x+6, this.y+4, 2, 8);
            ctx.fillRect(this.x+3, this.y+4, 7, 2);
        } else if(this.profession === 'fisher') {
            // Удочка
            ctx.strokeStyle = palette.weapon;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x+7, this.y+5);
            ctx.lineTo(this.x+12, this.y-2);
            ctx.stroke();
        }

        // Цветовая метка команды (пояс)
        if(!isPlayer && baseColor) {
            ctx.fillStyle = baseColor;
            ctx.fillRect(this.x-6, this.y+2, 12, 2);
        }
    }

    renderBrutalSwordsman(ctx, isPlayer, baseColor) {
        const palette = { body: '#1A1C1E', gear: '#0D0E10', weapon: '#859196', accent: '#8B0000' };

        // Тяжелая броня (тело)
        ctx.fillStyle = this.starving ? '#0D0E10' : palette.body;
        ctx.fillRect(this.x-7, this.y-5, 14, 16);

        // Шлем
        ctx.fillStyle = palette.gear;
        ctx.fillRect(this.x-6, this.y-12, 12, 9);

        // Глаза (красное свечение)
        ctx.fillStyle = palette.accent;
        ctx.fillRect(this.x-4, this.y-8, 2, 3);
        ctx.fillRect(this.x+2, this.y-8, 2, 3);

        // Наплечники
        ctx.fillStyle = palette.gear;
        ctx.fillRect(this.x-10, this.y-4, 4, 6);
        ctx.fillRect(this.x+6, this.y-4, 4, 6);

        // Меч
        ctx.fillStyle = palette.weapon;
        ctx.fillRect(this.x+8, this.y-2, 2, 12);
        ctx.fillRect(this.x+6, this.y-3, 6, 2); // Гарда

        // Щит (левая рука)
        ctx.fillStyle = palette.gear;
        ctx.fillRect(this.x-11, this.y+2, 4, 8);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(this.x-10, this.y+4, 2, 4); // Красный крест на щите

        // Цветовая метка команды
        if(!isPlayer && baseColor) {
            ctx.fillStyle = baseColor;
            ctx.fillRect(this.x-7, this.y+8, 14, 2);
        }
    }

    renderBrutalArcher(ctx, isPlayer, baseColor) {
        const palette = { body: '#232A24', gear: '#141A15', weapon: '#3D3126', accent: '#4B5E3C' };

        // Легкая броня охотника
        ctx.fillStyle = this.starving ? '#1A1F1B' : palette.body;
        ctx.fillRect(this.x-6, this.y-4, 12, 14);

        // Капюшон
        ctx.fillStyle = palette.gear;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y-12);
        ctx.lineTo(this.x-7, this.y-3);
        ctx.lineTo(this.x+7, this.y-3);
        ctx.closePath();
        ctx.fill();

        // Лицо в тени
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x-4, this.y-8, 8, 6);

        // Глаза (зеленоватое свечение)
        ctx.fillStyle = palette.accent;
        ctx.fillRect(this.x-3, this.y-6, 2, 2);
        ctx.fillRect(this.x+1, this.y-6, 2, 2);

        // Лук
        ctx.strokeStyle = palette.weapon;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x-8, this.y+2, 8, -Math.PI*0.3, Math.PI*0.3);
        ctx.stroke();

        // Тетива
        ctx.strokeStyle = palette.gear;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x-8, this.y-4);
        ctx.lineTo(this.x-8, this.y+8);
        ctx.stroke();

        // Колчан
        ctx.fillStyle = palette.weapon;
        ctx.fillRect(this.x+4, this.y-2, 4, 10);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(this.x+5, this.y-3, 2, 3); // Стрелы торчат

        // Цветовая метка команды
        if(!isPlayer && baseColor) {
            ctx.fillStyle = baseColor;
            ctx.fillRect(this.x-6, this.y+7, 12, 2);
        }
    }

    renderBrutalMob(ctx) {
        const palette = { body: '#1A0D0D', skin: '#3D1F1F', eyes: '#FF2A2A', bone: '#8C8C8C' };

        // Тело (гниющая плоть)
        ctx.fillStyle = palette.body;
        ctx.fillRect(this.x-7, this.y-5, 14, 16);

        // Голова (череп)
        ctx.fillStyle = palette.skin;
        ctx.fillRect(this.x-6, this.y-12, 12, 9);

        // Глаза (красное свечение)
        ctx.fillStyle = palette.eyes;
        ctx.shadowColor = palette.eyes;
        ctx.shadowBlur = 8;
        ctx.fillRect(this.x-4, this.y-9, 3, 4);
        ctx.fillRect(this.x+1, this.y-9, 3, 4);
        ctx.shadowBlur = 0;

        // Кости/шипы на плечах
        ctx.fillStyle = palette.bone;
        ctx.beginPath();
        ctx.moveTo(this.x-9, this.y-4);
        ctx.lineTo(this.x-11, this.y-8);
        ctx.lineTo(this.x-7, this.y-5);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(this.x+9, this.y-4);
        ctx.lineTo(this.x+11, this.y-8);
        ctx.lineTo(this.x+7, this.y-5);
        ctx.fill();

        // Когти
        ctx.fillStyle = palette.bone;
        ctx.fillRect(this.x-10, this.y+6, 3, 5);
        ctx.fillRect(this.x+7, this.y+6, 3, 5);
    }
}

// ===================== PLAYER CHARACTER =====================
class PlayerCharacter extends Unit {
    constructor(x, y, playerRole) {
        super(x, y, 'worker', PLAYER, 'generalist');
        this.playerRole = playerRole; // 'host' или 'guest'

        // Базовые характеристики персонажа
        this.health = 100;
        this.maxHealth = 100;
        this.damage = 15;
        this.speed = 80;
        this.attackRange = 50;
        this.attackInterval = 800;

        // Экипировка
        this.equipment = {
            weapon: { level: 1 },
            armor: { level: 1 }
        };

        // Персонаж не имеет профессии (универсальный)
        this.profession = null;
    }

    upgradeWeapon(game) {
        const nextLevel = this.equipment.weapon.level + 1;
        const costs = {
            2: { wood: 50, stone: 30 },
            3: { wood: 100, stone: 60 },
            4: { wood: 150, stone: 100 }
        };
        const damages = { 1: 15, 2: 20, 3: 30, 4: 45 };

        if (nextLevel > 4) {
            game.showNotification('Оружие максимального уровня');
            return false;
        }

        const cost = costs[nextLevel];
        const player = game.players[PLAYER];

        if (player.wood < cost.wood || player.stone < cost.stone) {
            game.showNotification(`Не хватает ресурсов: ${cost.wood}🪵 ${cost.stone}🪨`);
            return false;
        }

        player.wood -= cost.wood;
        player.stone -= cost.stone;
        this.equipment.weapon.level = nextLevel;
        this.damage = damages[nextLevel];

        game.showNotification(`⚔️ Оружие улучшено до уровня ${nextLevel}!`);
        return true;
    }

    upgradeArmor(game) {
        const nextLevel = this.equipment.armor.level + 1;
        const costs = {
            2: { wood: 40, stone: 50 },
            3: { wood: 80, stone: 100 },
            4: { wood: 120, stone: 150 }
        };
        const maxHealths = { 1: 100, 2: 130, 3: 170, 4: 220 };

        if (nextLevel > 4) {
            game.showNotification('Броня максимального уровня');
            return false;
        }

        const cost = costs[nextLevel];
        const player = game.players[PLAYER];

        if (player.wood < cost.wood || player.stone < cost.stone) {
            game.showNotification(`Не хватает ресурсов: ${cost.wood}🪵 ${cost.stone}🪨`);
            return false;
        }

        player.wood -= cost.wood;
        player.stone -= cost.stone;
        this.equipment.armor.level = nextLevel;
        const oldMaxHealth = this.maxHealth;
        this.maxHealth = maxHealths[nextLevel];
        this.health = Math.min(this.health + (this.maxHealth - oldMaxHealth), this.maxHealth);

        game.showNotification(`🛡️ Броня улучшена до уровня ${nextLevel}!`);
        return true;
    }

    canGatherResource(resource) {
        // Персонаж может собирать любые ресурсы
        return resource && !resource.depleted;
    }
}

// ===================== BUILDING =====================
class Building {
    constructor(x, y, type, team) {
        this.id = null; // Будет установлен при добавлении в игру
        const c=getBuildingConfig(type);
        this.x=x; this.y=y; this.type=type; this.team=team;
        this.width=c.width; this.height=c.height; this.clearance=c.clearance;
        this.health=c.health; this.maxHealth=c.health; this.level=1;
        this.damage=0; this.attackRange=0; this.attackInterval=0; this.attackCooldown=0; this.target=null;
        this.occupants=[]; // Юниты внутри дома (максимум 3)
        this.reservedOccupants=[]; // Юниты, которым уже зарезервировали слот для отдыха
        this.maxOccupants=3;
        if(this.type==='archertower') this.setLevel(1);
        if(this.type==='storage') this.setLevel(1);
        if(this.type==='farm') this.setLevel(1);
    }

    setLevel(level) {
        this.level=level;
        if(this.type==='archertower') {
            const ts=ARCHER_TOWER_LEVELS[level]; if(!ts) return;
            const c=getBuildingConfig(this.type);
            const ratio=this.maxHealth>0?this.health/this.maxHealth:1;
            this.maxHealth=c.health+ts.healthBonus;
            this.health=Math.max(this.health,Math.min(this.maxHealth,this.maxHealth*ratio));
            this.damage=ts.damage; this.attackRange=ts.range; this.attackInterval=ts.cooldown;
        } else if(this.type==='storage') {
            const ts=STORAGE_LEVELS[level]; if(!ts) return;
            const c=getBuildingConfig(this.type);
            const ratio=this.maxHealth>0?this.health/this.maxHealth:1;
            this.maxHealth=c.health+ts.healthBonus;
            this.health=Math.max(this.health,Math.min(this.maxHealth,this.maxHealth*ratio));
        } else if(this.type==='farm') {
            const ts=FARM_LEVELS[level]; if(!ts) return;
            const c=getBuildingConfig(this.type);
            const ratio=this.maxHealth>0?this.health/this.maxHealth:1;
            this.maxHealth=c.health+ts.healthBonus;
            this.health=Math.max(this.health,Math.min(this.maxHealth,this.maxHealth*ratio));
        }
    }

    update(dt, game) {
        if(this.type!=='archertower') return;
        this.attackCooldown=Math.max(0,this.attackCooldown-dt);
        if(this.target&&this.target.health<=0) this.target=null;
        const c=getStructureCenter(this);
        const cur=this.target||game.findPriorityEnemyTarget(this.team,c.x,c.y,this.attackRange,true);
        if(!cur) return;
        const tc=getEntityCenter(cur);
        if(Math.hypot(tc.x-c.x,tc.y-c.y)>this.attackRange) { this.target=null; return; }
        this.target=cur;
        if(this.attackCooldown===0) {
            this.target.health-=this.damage;
            this.attackCooldown=this.attackInterval;
            // Создаем частицы при попадании стрелы
            if(game && game.spawnParticles) {
                const particleType = this.target.type === 'mob' ? 'dark_magic' : 'blood';
                game.spawnParticles(tc.x, tc.y, particleType, 6);
            }
        }
    }

    render(ctx, factionColor, camera) {
        const isPlayer=this.team===PLAYER;
        const level = this.level || 1;

        // Улучшенная пиксельная графика
        if(this.type==='townhall') {
            this.renderTownHall(ctx, isPlayer, level);
        } else if(this.type==='house') {
            this.renderHouse(ctx, isPlayer, level);
        } else if(this.type==='storage') {
            this.renderStorage(ctx, isPlayer, level);
        } else if(this.type==='barracks') {
            this.renderBarracks(ctx, isPlayer, level);
        } else if(this.type==='farm') {
            this.renderFarm(ctx, isPlayer, level);
        } else if(this.type==='archertower') {
            this.renderArcherTower(ctx, isPlayer, level);
        } else if(this.type==='forge') {
            this.renderForge(ctx, isPlayer, level);
        } else if(this.type==='magictower') {
            this.renderMagicTower(ctx, isPlayer, level);
        } else if(this.type==='beacon') {
            this.renderBeacon(ctx, isPlayer, level);
        } else {
            // Fallback для неизвестных типов
            const icons={townhall:'⌂',barracks:'⚔️',farm:'🌾',house:'🏠',storage:'📦',forge:'🔨',magictower:'🔮',archertower:'🏹',beacon:'🔥'};
            const icon=icons[this.type]||'⌂';
            ctx.fillStyle=isPlayer?'#8B4513':(factionColor?factionColor+'88':'#5c3317');
            ctx.fillRect(this.x,this.y,this.width,this.height);
            ctx.fillStyle='#fff'; ctx.font='20px Arial'; ctx.textAlign='center';
            ctx.fillText(icon,this.x+this.width/2,this.y+this.height/2+7);
        }

        // Полоска здоровья
        if(this.health < this.maxHealth) {
            ctx.fillStyle='#000'; ctx.fillRect(this.x,this.y-10,this.width,6);
            ctx.fillStyle=isPlayer?'#4CAF50':(factionColor||'#f44336');
            ctx.fillRect(this.x,this.y-10,this.width*(this.health/this.maxHealth),6);
        }

        // Уровень
        if((this.type==='townhall'||this.type==='archertower')&&level>1) {
            ctx.fillStyle='#FFD700'; ctx.font='bold 12px Arial'; ctx.textAlign='center';
            ctx.fillText('Lv'+level,this.x+this.width/2,this.y+this.height-8);
        }

        // Вместимость дома
        if(this.type==='house' && this.occupants.length > 0) {
            ctx.fillStyle='#FFFFFF';
            ctx.font='bold 14px Arial';
            ctx.textAlign='center';
            ctx.strokeStyle='#000000';
            ctx.lineWidth=3;
            const text=`${this.occupants.length}/${this.maxOccupants}`;
            ctx.strokeText(text, this.x+this.width/2, this.y-15);
            ctx.fillText(text, this.x+this.width/2, this.y-15);
        }
    }

    renderTownHall(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;
        // Викингский стиль - темное дерево и камень
        const colors = level===3 ? {wood:'#5C4033',logs:'#3E2723',roof:'#1A1A1A',stone:'#696969',metal:'#C0C0C0'} :
                      level===2 ? {wood:'#6B4423',logs:'#4A2F1F',roof:'#2C2416',stone:'#5A5A5A',metal:'#A9A9A9'} :
                      {wood:'#8B4513',logs:'#5C3317',roof:'#3D2817',stone:'#4A4A4A',metal:'#808080'};

        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x+4,y+h-2,w,6);

        // Каменный фундамент
        ctx.fillStyle=colors.stone; ctx.fillRect(x,y+h*0.7,w,h*0.3);
        // Текстура камня
        for(let i=0;i<w;i+=16) for(let j=0;j<h*0.3;j+=16) {
            ctx.fillStyle=Math.random()>0.5?colors.stone:'#3A3A3A';
            ctx.fillRect(x+i,y+h*0.7+j,14,14);
        }

        // Деревянные стены (бревна)
        ctx.fillStyle=colors.wood; ctx.fillRect(x,y+h*0.3,w,h*0.4);
        // Горизонтальные бревна
        for(let i=0;i<5;i++) {
            ctx.fillStyle=colors.logs; ctx.fillRect(x,y+h*0.3+i*h*0.08,w,h*0.06);
            ctx.fillStyle=colors.wood; ctx.fillRect(x+2,y+h*0.3+i*h*0.08+1,w-4,h*0.04);
        }

        // Крыша (соломенная/деревянная)
        ctx.fillStyle=colors.roof;
        ctx.beginPath(); ctx.moveTo(x+w/2,y+h*0.05); ctx.lineTo(x+w+8,y+h*0.32); ctx.lineTo(x-8,y+h*0.32); ctx.closePath(); ctx.fill();
        // Текстура крыши
        for(let i=0;i<8;i++) {
            ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(x+w/2,y+h*0.05); ctx.lineTo(x+i*12,y+h*0.32); ctx.stroke();
        }

        // Окна с деревянными рамами
        ctx.fillStyle='#1A1A1A';
        for(let i=0;i<3;i++) {
            ctx.fillRect(x+14+i*24,y+h*0.45,12,12);
            ctx.strokeStyle=colors.logs; ctx.lineWidth=2;
            ctx.strokeRect(x+14+i*24,y+h*0.45,12,12);
        }

        // Массивная дверь
        ctx.fillStyle=colors.logs; ctx.fillRect(x+w/2-12,y+h*0.72,24,h*0.28);
        // Металлические полосы на двери
        ctx.fillStyle=colors.metal;
        ctx.fillRect(x+w/2-12,y+h*0.75,24,2);
        ctx.fillRect(x+w/2-12,y+h*0.85,24,2);
        ctx.fillRect(x+w/2-12,y+h*0.95,24,2);

        // Щит над входом для уровня 2+
        if(level>=2) {
            ctx.fillStyle=colors.metal;
            ctx.beginPath(); ctx.arc(x+w/2,y+h*0.65,10,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle=colors.logs; ctx.lineWidth=2; ctx.stroke();
        }

        // Рога викинга для уровня 3
        if(level>=3) {
            ctx.strokeStyle=colors.metal; ctx.lineWidth=3;
            ctx.beginPath(); ctx.arc(x+w/2-15,y+h*0.15,8,0,Math.PI); ctx.stroke();
            ctx.beginPath(); ctx.arc(x+w/2+15,y+h*0.15,8,0,Math.PI); ctx.stroke();
        }
    }

    renderHouse(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;

        // Брутальная палитра
        const colors = level===3 ?
            {stone:'#2A2A2A',dark:'#1A1A1A',roof:'#0D0D0D',window:'#8B0000',glow:'#CC2929'} :
            level===2 ?
            {stone:'#3A3A3A',dark:'#2A2A2A',roof:'#1A1A1A',window:'#3A423A',glow:null} :
            {stone:'#4A4A4A',dark:'#3A3A3A',roof:'#2A2A2A',window:'#1A1713',glow:null};

        // Тень
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillRect(x+4,y+h-2,w,8);

        // Темная укрепленная каменная хижина
        ctx.fillStyle=colors.stone;
        ctx.fillRect(x,y+h*0.35,w,h*0.65);

        // Каменная кладка (грубая текстура)
        for(let i=0;i<w;i+=14) {
            for(let j=0;j<h*0.65;j+=14) {
                ctx.fillStyle=Math.random()>0.5?colors.stone:colors.dark;
                ctx.fillRect(x+i,y+h*0.35+j,12,12);
            }
        }

        // Трещины в стенах
        ctx.strokeStyle='#000';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(x+w*0.2,y+h*0.4);
        ctx.lineTo(x+w*0.25,y+h*0.7);
        ctx.stroke();

        // Острая крыша
        ctx.fillStyle=colors.roof;
        ctx.beginPath();
        ctx.moveTo(x+w/2,y+h*0.12);
        ctx.lineTo(x+w+6,y+h*0.37);
        ctx.lineTo(x-6,y+h*0.37);
        ctx.closePath();
        ctx.fill();

        // Светящиеся окна
        ctx.fillStyle=colors.window;
        ctx.fillRect(x+10,y+h*0.5,12,12);
        ctx.fillRect(x+w-22,y+h*0.5,12,12);

        // Свечение из окон на 3 уровне
        if(level>=3 && colors.glow) {
            ctx.shadowColor=colors.glow;
            ctx.shadowBlur=15;
            ctx.fillStyle=colors.glow;
            ctx.fillRect(x+10,y+h*0.5,12,12);
            ctx.fillRect(x+w-22,y+h*0.5,12,12);
            ctx.shadowBlur=0;
        }

        // Железные рамы окон
        ctx.strokeStyle=colors.dark;
        ctx.lineWidth=2;
        ctx.strokeRect(x+10,y+h*0.5,12,12);
        ctx.strokeRect(x+w-22,y+h*0.5,12,12);

        // Крест в окнах
        ctx.beginPath();
        ctx.moveTo(x+16,y+h*0.5);
        ctx.lineTo(x+16,y+h*0.5+12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x+10,y+h*0.56);
        ctx.lineTo(x+22,y+h*0.56);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x+w-16,y+h*0.5);
        ctx.lineTo(x+w-16,y+h*0.5+12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x+w-22,y+h*0.56);
        ctx.lineTo(x+w-10,y+h*0.56);
        ctx.stroke();

        // Массивная дверь
        ctx.fillStyle='#0A0A0A';
        ctx.fillRect(x+w/2-10,y+h*0.68,20,h*0.32);

        // Железные полосы на двери
        ctx.fillStyle='#3A3A3A';
        ctx.fillRect(x+w/2-10,y+h*0.72,20,3);
        ctx.fillRect(x+w/2-10,y+h*0.88,20,3);

        // Дымоход для уровня 2+
        if(level>=2) {
            ctx.fillStyle=colors.stone;
            ctx.fillRect(x+w*0.75,y+h*0.15,10,20);
            ctx.fillStyle=colors.dark;
            ctx.fillRect(x+w*0.76,y+h*0.16,8,18);
        }
    }

    renderStorage(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;

        // Брутальная палитра
        const colors = level===3 ?
            {metal:'#2A2A2A',iron:'#1A1A1A',chain:'#4A4A4A',bolt:'#5A5A5A'} :
            level===2 ?
            {metal:'#3A3A3A',iron:'#2A2A2A',chain:'#5A5A5A',bolt:'#6A6A6A'} :
            {metal:'#4A4A4A',iron:'#3A3A3A',chain:'#6A6A6A',bolt:'#7A7A7A'};

        // Тень
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillRect(x+4,y+h-2,w,8);

        // Массивное железное хранилище (угловатое)
        ctx.fillStyle=colors.metal;
        ctx.fillRect(x,y+h*0.2,w,h*0.8);

        // Железные пластины (вертикальные)
        ctx.fillStyle=colors.iron;
        for(let i=0;i<w;i+=16) {
            ctx.fillRect(x+i,y+h*0.2,14,h*0.8);
        }

        // Горизонтальные железные полосы (усиление)
        ctx.fillStyle=colors.bolt;
        for(let i=0;i<6+level;i++) {
            ctx.fillRect(x,y+h*0.25+i*h*0.12,w,4);
        }

        // Вертикальные усиления по краям
        ctx.fillRect(x+4,y+h*0.2,6,h*0.8);
        ctx.fillRect(x+w-10,y+h*0.2,6,h*0.8);

        // Плоская крыша с шипами
        ctx.fillStyle=colors.iron;
        ctx.fillRect(x-4,y+h*0.18,w+8,h*0.06);

        // Шипы на крыше для уровня 2+
        if(level>=2) {
            ctx.fillStyle=colors.bolt;
            for(let i=0;i<5;i++) {
                ctx.beginPath();
                ctx.moveTo(x+w*0.15+i*w*0.18,y+h*0.18);
                ctx.lineTo(x+w*0.17+i*w*0.18,y+h*0.1);
                ctx.lineTo(x+w*0.19+i*w*0.18,y+h*0.18);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Массивные двери
        ctx.fillStyle='#0A0A0A';
        ctx.fillRect(x+w*0.25,y+h*0.45,w*0.5,h*0.55);

        // Железные полосы на дверях
        ctx.fillStyle=colors.chain;
        ctx.fillRect(x+w*0.27,y+h*0.5,w*0.46,4);
        ctx.fillRect(x+w*0.27,y+h*0.65,w*0.46,4);
        ctx.fillRect(x+w*0.27,y+h*0.8,w*0.46,4);

        // Вертикальные полосы
        ctx.fillRect(x+w*0.3,y+h*0.45,4,h*0.55);
        ctx.fillRect(x+w*0.66,y+h*0.45,4,h*0.55);

        // Тяжелые цепи для уровня 3
        if(level>=3) {
            ctx.strokeStyle=colors.chain;
            ctx.lineWidth=3;
            for(let i=0;i<4;i++) {
                ctx.beginPath();
                ctx.moveTo(x+w*0.2+i*w*0.2,y+h*0.2);
                ctx.lineTo(x+w*0.2+i*w*0.2,y+h*0.35);
                ctx.stroke();
                // Звенья цепи
                ctx.fillRect(x+w*0.19+i*w*0.2,y+h*0.22,4,6);
                ctx.fillRect(x+w*0.19+i*w*0.2,y+h*0.3,4,6);
            }
        }

        // Замок
        ctx.fillStyle=colors.bolt;
        ctx.fillRect(x+w/2-8,y+h*0.7,16,14);
        ctx.fillStyle='#000';
        ctx.fillRect(x+w/2-3,y+h*0.73,6,8);
    }

    renderBarracks(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;
        const colors = level===3 ? {wood:'#5C4033',logs:'#3E2723',roof:'#1A1A1A',metal:'#C0C0C0',red:'#8B0000'} :
                      level===2 ? {wood:'#6B4423',logs:'#4A2F1F',roof:'#2C2416',metal:'#A9A9A9',red:'#A52A2A'} :
                      {wood:'#8B4513',logs:'#5C3317',roof:'#3D2817',metal:'#808080',red:'#CD5C5C'};

        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x+4,y+h-2,w,6);

        // Каменный фундамент
        ctx.fillStyle='#4A4A4A'; ctx.fillRect(x,y+h*0.65,w,h*0.35);

        // Деревянные стены с бревнами
        ctx.fillStyle=colors.wood; ctx.fillRect(x,y+h*0.3,w,h*0.35);
        for(let i=0;i<5;i++) {
            ctx.fillStyle=colors.logs; ctx.fillRect(x,y+h*0.3+i*h*0.07,w,h*0.05);
        }

        // Крыша
        ctx.fillStyle=colors.roof;
        ctx.beginPath(); ctx.moveTo(x+w/2,y+h*0.08); ctx.lineTo(x+w+6,y+h*0.32); ctx.lineTo(x-6,y+h*0.32); ctx.closePath(); ctx.fill();

        // Щиты викингов на стенах
        const shieldSize = 10 + level * 2;
        // Левый щит
        ctx.fillStyle=colors.red;
        ctx.beginPath(); ctx.arc(x+16,y+h*0.5,shieldSize,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=colors.metal; ctx.lineWidth=2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+16-shieldSize*0.7,y+h*0.5); ctx.lineTo(x+16+shieldSize*0.7,y+h*0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+16,y+h*0.5-shieldSize*0.7); ctx.lineTo(x+16,y+h*0.5+shieldSize*0.7); ctx.stroke();

        // Правый щит
        ctx.fillStyle=colors.red;
        ctx.beginPath(); ctx.arc(x+w-16,y+h*0.5,shieldSize,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=colors.metal; ctx.lineWidth=2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+w-16-shieldSize*0.7,y+h*0.5); ctx.lineTo(x+w-16+shieldSize*0.7,y+h*0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+w-16,y+h*0.5-shieldSize*0.7); ctx.lineTo(x+w-16,y+h*0.5+shieldSize*0.7); ctx.stroke();

        // Дверь с металлом
        ctx.fillStyle=colors.logs; ctx.fillRect(x+w/2-14,y+h*0.68,28,h*0.32);
        ctx.fillStyle=colors.metal;
        ctx.fillRect(x+w/2-14,y+h*0.72,28,2);
        ctx.fillRect(x+w/2-14,y+h*0.88,28,2);

        // Скрещенные мечи для уровня 2+
        if(level>=2) {
            ctx.strokeStyle=colors.metal; ctx.lineWidth=3;
            // Левый меч
            ctx.beginPath(); ctx.moveTo(x+w/2-20,y+h*0.42); ctx.lineTo(x+w/2-20,y+h*0.62); ctx.stroke();
            ctx.fillRect(x+w/2-24,y+h*0.4,8,6);
            // Правый меч
            ctx.beginPath(); ctx.moveTo(x+w/2+20,y+h*0.42); ctx.lineTo(x+w/2+20,y+h*0.62); ctx.stroke();
            ctx.fillRect(x+w/2+16,y+h*0.4,8,6);
        }

        // Боевой топор для уровня 3
        if(level>=3) {
            ctx.strokeStyle=colors.logs; ctx.lineWidth=4;
            ctx.beginPath(); ctx.moveTo(x+w/2,y+h*0.15); ctx.lineTo(x+w/2,y+h*0.25); ctx.stroke();
            ctx.fillStyle=colors.metal;
            ctx.beginPath(); ctx.moveTo(x+w/2-8,y+h*0.15); ctx.lineTo(x+w/2+8,y+h*0.15); ctx.lineTo(x+w/2+6,y+h*0.2); ctx.lineTo(x+w/2-6,y+h*0.2); ctx.closePath(); ctx.fill();
        }
    }

    renderFarm(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;

        // Брутальная палитра для фермы
        const colors = level===3 ?
            {stone:'#2A2A2A',wood:'#1F1612',roof:'#0D0B0B',crop:'#8B0000',glow:'#FF0000'} :
            level===2 ?
            {stone:'#3A3A3A',wood:'#2A1F1A',roof:'#1A1612',crop:'#4A5C2B',glow:null} :
            {stone:'#4A4A4A',wood:'#3A2E2A',roof:'#2B251C',crop:'#2A4A18',glow:null};

        // Тень
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillRect(x+4,y+h-2,w,8);

        // Каменный амбар (угловатый)
        ctx.fillStyle=colors.stone;
        ctx.fillRect(x,y+h*0.3,w,h*0.7);

        // Трещины в камне
        ctx.strokeStyle='#000';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(x+w*0.3,y+h*0.35);
        ctx.lineTo(x+w*0.35,y+h*0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x+w*0.7,y+h*0.4);
        ctx.lineTo(x+w*0.65,y+h*0.7);
        ctx.stroke();

        // Деревянные доски (вертикальные)
        ctx.fillStyle=colors.wood;
        for(let i=0;i<w;i+=10) {
            ctx.fillRect(x+i,y+h*0.35,8,h*0.65);
        }

        // Острая крыша
        ctx.fillStyle=colors.roof;
        ctx.beginPath();
        ctx.moveTo(x+w/2,y+h*0.1);
        ctx.lineTo(x+w+4,y+h*0.32);
        ctx.lineTo(x-4,y+h*0.32);
        ctx.closePath();
        ctx.fill();

        // Поля с урожаем
        if(level === 3) {
            // Кровавая жатва - острые темные стебли
            ctx.fillStyle=colors.crop;
            for(let i=0;i<10;i++) {
                const px = x+6+i*8;
                const py = y+h*0.88;
                // Острые стебли
                ctx.beginPath();
                ctx.moveTo(px,py+12);
                ctx.lineTo(px+2,py);
                ctx.lineTo(px+4,py+12);
                ctx.closePath();
                ctx.fill();
            }

            // Кровавое свечение
            if(colors.glow) {
                ctx.shadowColor=colors.glow;
                ctx.shadowBlur=15;
                ctx.fillStyle='rgba(139,0,0,0.3)';
                ctx.fillRect(x+4,y+h*0.85,w-8,h*0.15);
                ctx.shadowBlur=0;
            }

            // Черепа
            ctx.fillStyle='#8C8C8C';
            ctx.fillRect(x+w*0.2-3,y+h*0.9,6,5);
            ctx.fillRect(x+w*0.8-3,y+h*0.9,6,5);
            ctx.fillStyle='#000';
            ctx.fillRect(x+w*0.2-2,y+h*0.91,2,2);
            ctx.fillRect(x+w*0.2+1,y+h*0.91,2,2);
            ctx.fillRect(x+w*0.8-2,y+h*0.91,2,2);
            ctx.fillRect(x+w*0.8+1,y+h*0.91,2,2);
        } else {
            // Обычные острые стебли
            ctx.fillStyle=colors.crop;
            for(let i=0;i<8;i++) {
                ctx.fillRect(x+8+i*10,y+h*0.88,3,12);
                ctx.fillRect(x+10+i*10,y+h*0.86,2,10);
            }
        }

        // Массивная дверь
        ctx.fillStyle='#0A0A0A';
        ctx.fillRect(x+w/2-12,y+h*0.65,24,h*0.35);

        // Железные полосы на двери
        ctx.fillStyle='#4A4A4A';
        ctx.fillRect(x+w/2-12,y+h*0.7,24,3);
        ctx.fillRect(x+w/2-12,y+h*0.85,24,3);
    }

    renderArcherTower(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;

        // Брутальная палитра
        const colors = level===3 ?
            {stone:'#2A2A2A',dark:'#0D0D0D',metal:'#5A5A5A',glow:'#FF4040'} :
            level===2 ?
            {stone:'#3A3A3A',dark:'#1A1A1A',metal:'#4A4A4A',glow:null} :
            {stone:'#4A4A4A',dark:'#2A2A2A',metal:'#3A3A3A',glow:null};

        // Тень
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillRect(x+4,y+h-2,w,8);

        // Высокая игольчатая башня (сужается резко)
        ctx.fillStyle=colors.stone;
        ctx.beginPath();
        ctx.moveTo(x+w*0.15,y+h);
        ctx.lineTo(x+w*0.35,y+h*0.15);
        ctx.lineTo(x+w*0.65,y+h*0.15);
        ctx.lineTo(x+w*0.85,y+h);
        ctx.closePath();
        ctx.fill();

        // Текстура камня (грубая)
        for(let i=0;i<w*0.5;i+=12) {
            for(let j=0;j<h*0.85;j+=12) {
                ctx.fillStyle=Math.random()>0.5?colors.stone:colors.dark;
                ctx.fillRect(x+w*0.2+i,y+h*0.15+j,10,10);
            }
        }

        // Острые зубцы наверху
        ctx.fillStyle=colors.dark;
        for(let i=0;i<5;i++) {
            ctx.beginPath();
            ctx.moveTo(x+w*0.35+i*(w*0.08),y+h*0.15);
            ctx.lineTo(x+w*0.37+i*(w*0.08),y+h*0.05);
            ctx.lineTo(x+w*0.39+i*(w*0.08),y+h*0.15);
            ctx.closePath();
            ctx.fill();
        }

        // Узкие бойницы (стрелковые щели)
        ctx.fillStyle='#000';
        for(let i=0;i<4+level;i++) {
            ctx.fillRect(x+w/2-2,y+h*0.3+i*h*0.12,4,h*0.08);
        }

        // Свечение из бойниц на 3 уровне
        if(level>=3 && colors.glow) {
            ctx.shadowColor=colors.glow;
            ctx.shadowBlur=12;
            ctx.fillStyle=colors.glow;
            for(let i=0;i<4;i++) {
                ctx.fillRect(x+w/2-2,y+h*0.3+i*h*0.12,4,h*0.08);
            }
            ctx.shadowBlur=0;
        }

        // Железные шипы у основания
        if(level>=2) {
            ctx.fillStyle=colors.metal;
            // Левые шипы
            ctx.beginPath();
            ctx.moveTo(x+w*0.15,y+h);
            ctx.lineTo(x+w*0.05,y+h*0.85);
            ctx.lineTo(x+w*0.2,y+h*0.95);
            ctx.closePath();
            ctx.fill();

            // Правые шипы
            ctx.beginPath();
            ctx.moveTo(x+w*0.85,y+h);
            ctx.lineTo(x+w*0.95,y+h*0.85);
            ctx.lineTo(x+w*0.8,y+h*0.95);
            ctx.closePath();
            ctx.fill();
        }

        // Острая крыша с шипом
        if(level>=3) {
            ctx.fillStyle=colors.metal;
            ctx.beginPath();
            ctx.moveTo(x+w/2,y+h*0.02);
            ctx.lineTo(x+w*0.4,y+h*0.15);
            ctx.lineTo(x+w*0.6,y+h*0.15);
            ctx.closePath();
            ctx.fill();
        }
    }

    renderForge(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;
        const colors = level===3 ? {wood:'#5C4033',stone:'#696969',fire:'#FF8C00',metal:'#C0C0C0',glow:'#FFD700'} :
                      level===2 ? {wood:'#6B4423',stone:'#5A5A5A',fire:'#FF6347',metal:'#A9A9A9',glow:'#FFA500'} :
                      {wood:'#8B4513',stone:'#4A4A4A',fire:'#FF4500',metal:'#808080',glow:'#FF6347'};

        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x+4,y+h-2,w,6);

        // Каменная основа
        ctx.fillStyle=colors.stone; ctx.fillRect(x,y+h*0.25,w,h*0.75);
        for(let i=0;i<w;i+=14) for(let j=0;j<h*0.75;j+=14) {
            ctx.fillStyle=Math.random()>0.5?colors.stone:'#3A3A3A';
            ctx.fillRect(x+i,y+h*0.25+j,12,12);
        }

        // Деревянная крыша
        ctx.fillStyle=colors.wood; ctx.fillRect(x-4,y+h*0.2,w+8,h*0.08);

        // Печь/горн
        ctx.fillStyle='#2A2A2A'; ctx.fillRect(x+10,y+h*0.45,28,32);
        ctx.fillStyle=colors.stone; ctx.fillRect(x+12,y+h*0.47,24,28);

        // Огонь в печи
        ctx.fillStyle=colors.fire; ctx.fillRect(x+16,y+h*0.52,16,12);
        ctx.fillStyle=colors.glow; ctx.fillRect(x+18,y+h*0.54,12,8);
        // Свечение огня
        if(level>=2) {
            ctx.shadowColor=colors.fire; ctx.shadowBlur=15;
            ctx.fillStyle=colors.glow;
            ctx.fillRect(x+18,y+h*0.54,12,8);
            ctx.shadowBlur=0;
        }

        // Наковальня
        ctx.fillStyle=colors.metal;
        ctx.fillRect(x+w*0.5,y+h*0.6,w*0.38,h*0.14);
        ctx.fillRect(x+w*0.6,y+h*0.74,w*0.18,h*0.1);
        // Блеск металла
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.fillRect(x+w*0.52,y+h*0.62,w*0.15,h*0.04);

        // Молот
        ctx.fillStyle=colors.wood; ctx.fillRect(x+w*0.72,y+h*0.48,5,28);
        ctx.fillStyle=colors.metal; ctx.fillRect(x+w*0.7,y+h*0.48,9,12);

        // Мечи на стене для уровня 2+
        if(level>=2) {
            ctx.strokeStyle=colors.metal; ctx.lineWidth=3;
            ctx.beginPath(); ctx.moveTo(x+w*0.85,y+h*0.35); ctx.lineTo(x+w*0.85,y+h*0.55); ctx.stroke();
            ctx.fillStyle=colors.metal; ctx.fillRect(x+w*0.82,y+h*0.33,6,8);
        }

        // Искры для уровня 3
        if(level>=3) {
            ctx.fillStyle=colors.glow;
            for(let i=0;i<5;i++) {
                const px = x+w*0.6+Math.random()*20;
                const py = y+h*0.65+Math.random()*10;
                ctx.fillRect(px,py,2,2);
            }
        }
    }

    renderMagicTower(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;
        const colors = level===3 ? {stone:'#483D8B',dark:'#2F2F4F',wood:'#5C4033',rune:'#DA70D6',glow:'#EE82EE'} :
                      level===2 ? {stone:'#6A5ACD',dark:'#4B4B6F',wood:'#6B4423',rune:'#BA55D3',glow:'#DA70D6'} :
                      {stone:'#7B68EE',dark:'#6A6A8F',wood:'#8B4513',rune:'#9370DB',glow:'#BA55D3'};

        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x+4,y+h-2,w,6);

        // Каменная башня (сужается)
        ctx.fillStyle=colors.stone;
        ctx.beginPath(); ctx.moveTo(x+w*0.22,y+h); ctx.lineTo(x+w*0.32,y+h*0.2); ctx.lineTo(x+w*0.68,y+h*0.2); ctx.lineTo(x+w*0.78,y+h); ctx.closePath(); ctx.fill();

        // Текстура темного камня
        for(let i=0;i<w*0.5;i+=12) for(let j=0;j<h*0.8;j+=12) {
            ctx.fillStyle=Math.random()>0.5?colors.stone:colors.dark;
            ctx.fillRect(x+w*0.25+i,y+h*0.2+j,10,10);
        }

        // Деревянный конус крыши
        ctx.fillStyle=colors.wood;
        ctx.beginPath(); ctx.moveTo(x+w/2,y+h*0.02); ctx.lineTo(x+w*0.7,y+h*0.22); ctx.lineTo(x+w*0.3,y+h*0.22); ctx.closePath(); ctx.fill();

        // Кристалл/руна на вершине
        ctx.fillStyle=colors.rune;
        ctx.beginPath(); ctx.moveTo(x+w/2,y+h*0.05); ctx.lineTo(x+w/2-7,y+h*0.13); ctx.lineTo(x+w/2+7,y+h*0.13); ctx.closePath(); ctx.fill();

        // Магические руны на стенах
        if(level>=1) {
            ctx.fillStyle=colors.rune;
            // Руна 1 (Альгиз - защита)
            ctx.fillRect(x+w/2-2,y+h*0.45,4,16);
            ctx.fillRect(x+w/2-8,y+h*0.48,6,3);
            ctx.fillRect(x+w/2+2,y+h*0.48,6,3);
        }

        if(level>=2) {
            // Руна 2 (Тейваз - победа)
            ctx.fillRect(x+w/2-2,y+h*0.65,4,14);
            ctx.beginPath(); ctx.moveTo(x+w/2,y+h*0.65); ctx.lineTo(x+w/2-6,y+h*0.7); ctx.lineTo(x+w/2+6,y+h*0.7); ctx.closePath(); ctx.fill();
        }

        if(level>=3) {
            // Руна 3 (Ансуз - мудрость)
            ctx.fillRect(x+w/2-2,y+h*0.8,4,12);
            ctx.fillRect(x+w/2,y+h*0.83,8,3);
            ctx.fillRect(x+w/2,y+h*0.88,8,3);
        }

        // Магическое свечение для уровня 3
        if(level>=3) {
            // Левитирующие обсидиановые кристаллы
            const time = Date.now() / 1000;
            const bounce1 = Math.sin(time * 2) * 4;
            const bounce2 = Math.sin(time * 2 + Math.PI * 0.66) * 4;
            const bounce3 = Math.sin(time * 2 + Math.PI * 1.33) * 4;

            // Кристалл 1 (левый)
            ctx.fillStyle=colors.rune;
            ctx.shadowColor=colors.glow;
            ctx.shadowBlur=20;
            ctx.beginPath();
            ctx.moveTo(x+w*0.2, y+h*0.25 + bounce1);
            ctx.lineTo(x+w*0.25, y+h*0.35 + bounce1);
            ctx.lineTo(x+w*0.2, y+h*0.45 + bounce1);
            ctx.lineTo(x+w*0.15, y+h*0.35 + bounce1);
            ctx.fill();

            // Кристалл 2 (правый)
            ctx.beginPath();
            ctx.moveTo(x+w*0.8, y+h*0.3 + bounce2);
            ctx.lineTo(x+w*0.85, y+h*0.4 + bounce2);
            ctx.lineTo(x+w*0.8, y+h*0.5 + bounce2);
            ctx.lineTo(x+w*0.75, y+h*0.4 + bounce2);
            ctx.fill();

            // Кристалл 3 (центральный верхний)
            ctx.beginPath();
            ctx.moveTo(x+w*0.5, y+h*0.15 + bounce3);
            ctx.lineTo(x+w*0.55, y+h*0.22 + bounce3);
            ctx.lineTo(x+w*0.5, y+h*0.29 + bounce3);
            ctx.lineTo(x+w*0.45, y+h*0.22 + bounce3);
            ctx.fill();

            ctx.shadowBlur=0;

            // Магическое свечение от главного кристалла
            ctx.shadowColor=colors.glow;
            ctx.shadowBlur=25;
            ctx.fillStyle=colors.glow;
            ctx.beginPath();
            ctx.arc(x+w/2,y+h*0.09,10,0,Math.PI*2);
            ctx.fill();
            ctx.shadowBlur=0;

            // Магические частицы вокруг башни
            for(let i=0;i<6;i++) {
                const angle = (Date.now()/1000 + i) % (Math.PI*2);
                const px = x+w/2 + Math.cos(angle)*20;
                const py = y+h*0.5 + Math.sin(angle)*15;
                ctx.fillStyle=colors.rune;
                ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2); ctx.fill();
            }
        }

        // Окна с магическим свечением
        ctx.fillStyle=colors.dark;
        ctx.fillRect(x+w/2-5,y+h*0.35,10,8);
        if(level>=2) {
            ctx.shadowColor=colors.rune; ctx.shadowBlur=8;
            ctx.fillStyle=colors.rune;
            ctx.fillRect(x+w/2-4,y+h*0.36,8,6);
            ctx.shadowBlur=0;
        }
    }

    renderBeacon(ctx, isPlayer, level) {
        const x=this.x, y=this.y, w=this.width, h=this.height;

        // Анимация пламени
        const time = Date.now() / 100;
        const flicker1 = Math.sin(time * 0.5) * 2;
        const flicker2 = Math.sin(time * 0.7 + 1) * 3;
        const flicker3 = Math.sin(time * 0.9 + 2) * 2.5;

        // Тень
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillRect(x+4,y+h-2,w,8);

        // Каменное основание
        ctx.fillStyle='#4A4A4A';
        ctx.fillRect(x+w*0.2,y+h*0.6,w*0.6,h*0.4);

        // Текстура камня
        for(let i=0;i<w*0.6;i+=10) {
            for(let j=0;j<h*0.4;j+=10) {
                ctx.fillStyle=Math.random()>0.5?'#4A4A4A':'#3A3A3A';
                ctx.fillRect(x+w*0.2+i,y+h*0.6+j,8,8);
            }
        }

        // Деревянные поленья
        ctx.fillStyle='#5C3317';
        ctx.fillRect(x+w*0.25,y+h*0.45,w*0.5,h*0.15);
        ctx.fillRect(x+w*0.3,y+h*0.35,w*0.4,h*0.1);

        // Текстура дерева
        ctx.strokeStyle='#3E2723';
        ctx.lineWidth=2;
        for(let i=0;i<3;i++) {
            ctx.beginPath();
            ctx.moveTo(x+w*0.3+i*10,y+h*0.45);
            ctx.lineTo(x+w*0.3+i*10,y+h*0.6);
            ctx.stroke();
        }

        // Пламя (три языка)
        const flameColors = ['#FF4500', '#FF6347', '#FFA500', '#FFD700'];

        // Большой центральный язык пламени
        ctx.fillStyle=flameColors[0];
        ctx.shadowColor='#FF4500';
        ctx.shadowBlur=15;
        ctx.beginPath();
        ctx.moveTo(x+w/2,y+h*0.15 + flicker1);
        ctx.lineTo(x+w/2-8,y+h*0.45);
        ctx.lineTo(x+w/2+8,y+h*0.45);
        ctx.closePath();
        ctx.fill();

        // Левый язык пламени
        ctx.fillStyle=flameColors[1];
        ctx.beginPath();
        ctx.moveTo(x+w*0.35,y+h*0.25 + flicker2);
        ctx.lineTo(x+w*0.3,y+h*0.45);
        ctx.lineTo(x+w*0.4,y+h*0.45);
        ctx.closePath();
        ctx.fill();

        // Правый язык пламени
        ctx.fillStyle=flameColors[1];
        ctx.beginPath();
        ctx.moveTo(x+w*0.65,y+h*0.25 + flicker3);
        ctx.lineTo(x+w*0.6,y+h*0.45);
        ctx.lineTo(x+w*0.7,y+h*0.45);
        ctx.closePath();
        ctx.fill();

        // Яркое ядро пламени
        ctx.fillStyle=flameColors[3];
        ctx.shadowBlur=20;
        ctx.beginPath();
        ctx.ellipse(x+w/2,y+h*0.4,6,8,0,0,Math.PI*2);
        ctx.fill();

        // Искры
        for(let i=0;i<5;i++) {
            const sparkX = x+w/2 + (Math.random()-0.5)*15;
            const sparkY = y+h*0.2 + Math.random()*10 - (time*0.5 + i*10) % 20;
            ctx.fillStyle=flameColors[Math.floor(Math.random()*4)];
            ctx.beginPath();
            ctx.arc(sparkX,sparkY,1.5,0,Math.PI*2);
            ctx.fill();
        }

        ctx.shadowBlur=0;
    }
}

// ===================== RESOURCE =====================
class Resource {
    constructor(x, y, type, amount=null, variantKey=null) {
        this.x=x; this.y=y; this.type=type;
        const variants=RESOURCE_VARIANTS[type]||[];
        const rv=variants.find(v=>v.key===variantKey)||variants[Math.floor(Math.random()*Math.max(variants.length,1))]||{};
        this.variant=rv; this.variantName=rv.name||type;
        this.amount=amount??rv.amount??100; this.maxAmount=this.amount;
        this.gatherAmount=rv.gatherAmount||10; this.size=rv.size||1;
        this.primaryColor=rv.primaryColor||(type==='wood'?'#228B22':'#808080');
        this.secondaryColor=rv.secondaryColor||(type==='wood'?'#8B4513':'#A9A9A9');
        this.depleted=false; this.regrowTimer=0;
    }

    render(ctx, camera) {
        if(this.depleted) return;

        const x = this.x;
        const y = this.y;
        const size = 12 * this.size;

        // Брутальная тень
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.8, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        if(this.type === 'wood') {
            this.renderBrutalTree(ctx, x, y, size);
        } else if(this.type === 'food') {
            this.renderBrutalFish(ctx, x, y, size);
        } else {
            this.renderBrutalRock(ctx, x, y, size);
        }

        // Индикатор количества
        if(this.amount < this.maxAmount && !this.depleted) {
            ctx.fillStyle = '#8B6914';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.amount, x, y + size + 8);
        }
    }

    renderBrutalTree(ctx, x, y, size) {
        // Увеличиваем размер дерева
        size = size * 1.5;

        // Ствол (темное дерево, угловатый)
        ctx.fillStyle = ENVIRONMENT_PALETTE.tree.trunk;
        ctx.fillRect(x - size * 0.2, y - size * 0.3, size * 0.4, size * 1.1);

        // Кора (текстура, трещины)
        ctx.fillStyle = ENVIRONMENT_PALETTE.tree.bark;
        ctx.fillRect(x - size * 0.2, y, size * 0.4, size * 0.15);
        ctx.fillRect(x - size * 0.2, y + size * 0.4, size * 0.4, size * 0.15);

        // Вертикальные трещины
        ctx.fillRect(x - size * 0.05, y - size * 0.2, size * 0.1, size * 0.8);

        // Крона (темная листва, угловатая)
        ctx.fillStyle = ENVIRONMENT_PALETTE.tree.leaves;
        // Нижний ярус
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.8);
        ctx.lineTo(x - size * 0.7, y - size * 0.3);
        ctx.lineTo(x + size * 0.7, y - size * 0.3);
        ctx.closePath();
        ctx.fill();

        // Средний ярус
        ctx.beginPath();
        ctx.moveTo(x, y - size * 1.1);
        ctx.lineTo(x - size * 0.5, y - size * 0.6);
        ctx.lineTo(x + size * 0.5, y - size * 0.6);
        ctx.closePath();
        ctx.fill();

        // Верхний ярус
        ctx.fillStyle = ENVIRONMENT_PALETTE.tree.leavesLight;
        ctx.beginPath();
        ctx.moveTo(x, y - size * 1.3);
        ctx.lineTo(x - size * 0.3, y - size * 0.9);
        ctx.lineTo(x + size * 0.3, y - size * 0.9);
        ctx.closePath();
        ctx.fill();
    }

    renderBrutalRock(ctx, x, y, size) {
        // Основание камня (угловатое)
        ctx.fillStyle = ENVIRONMENT_PALETTE.rock.base;
        ctx.beginPath();
        ctx.moveTo(x - size, y + size * 0.3);
        ctx.lineTo(x - size * 0.2, y - size * 0.8);
        ctx.lineTo(x + size * 0.8, y + size * 0.4);
        ctx.lineTo(x, y + size * 0.6);
        ctx.closePath();
        ctx.fill();

        // Грани и трещины
        ctx.strokeStyle = ENVIRONMENT_PALETTE.rock.detail;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2, y - size * 0.8);
        ctx.lineTo(x, y + size * 0.2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + size * 0.3, y);
        ctx.lineTo(x + size * 0.8, y + size * 0.4);
        ctx.stroke();

        // Блик на острой грани
        ctx.fillStyle = ENVIRONMENT_PALETTE.rock.highlight;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2, y - size * 0.8);
        ctx.lineTo(x - size * 0.5, y - size * 0.2);
        ctx.lineTo(x - size * 0.1, y + size * 0.1);
        ctx.fill();
    }

    renderBrutalFish(ctx, x, y, size) {
        // Тело рыбы (темное)
        ctx.fillStyle = ENVIRONMENT_PALETTE.fish.body;
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.7, size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Чешуя (текстура)
        ctx.fillStyle = ENVIRONMENT_PALETTE.fish.scale;
        for(let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(x - size * 0.3 + i * size * 0.3, y, size * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }

        // Хвост
        ctx.fillStyle = ENVIRONMENT_PALETTE.fish.fin;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.7, y);
        ctx.lineTo(x - size * 1.2, y - size * 0.3);
        ctx.lineTo(x - size * 1.2, y + size * 0.3);
        ctx.closePath();
        ctx.fill();

        // Плавники
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.4);
        ctx.lineTo(x - size * 0.2, y - size * 0.7);
        ctx.lineTo(x + size * 0.1, y - size * 0.4);
        ctx.fill();

        // Глаз (красный)
        ctx.fillStyle = ENVIRONMENT_PALETTE.fish.eye;
        ctx.beginPath();
        ctx.arc(x + size * 0.4, y - size * 0.1, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ===================== CONSTRUCTION SITE =====================
class ConstructionSite {
    constructor(x, y, buildingType, team, options={}) {
        const c=getBuildingConfig(buildingType);
        this.x=x; this.y=y; this.buildingType=buildingType; this.team=team;
        this.width=c.width; this.height=c.height; this.clearance=c.clearance;
        this.buildProgress=options.buildProgress||0;
        this.buildTime=options.buildTime||c.buildTime||5000;
        this.builder=null; this.relocationSource=options.relocationSource||null;
    }

    update(dt, game) {
        const hasBuilder=this.builder&&this.builder.health>0&&this.builder.task?.type==='build'&&this.builder.task.site===this;
        if(hasBuilder) {
            const sc=getStructureCenter(this);
            const dist=Math.hypot(this.builder.x-sc.x,this.builder.y-sc.y);
            if(dist<50) this.buildProgress+=dt;
        }
        // AI фракций тоже строят (без рабочего тоже медленно)
        if(!hasBuilder && game.isFactionTeam(this.team)) this.buildProgress+=dt*0.25;

        if(this.buildProgress>=this.buildTime) {
            if(this.relocationSource) {
                this.relocationSource.x=this.x; this.relocationSource.y=this.y; this.relocationSource.isRelocating=false;
            } else {
                const b=new Building(this.x,this.y,this.buildingType,this.team);
                game.buildings.push(b);
                if(this.buildingType==='house') game.players[this.team].maxPopulation+=5;
                else if(this.buildingType==='storage') {
                    // Пересчитываем лимит хранилища с учетом всех складов
                    game.players[this.team].maxStorage = game.calculateMaxStorage(this.team);
                }

                // Синхронизация в мультиплеере
                if(game.mpEnabled && game.mpIsHost && this.team === PLAYER && typeof mpSendAction === 'function') {
                    if(typeof mpAssignBuildingId === 'function') mpAssignBuildingId(b);
                    mpSendAction({
                        type: 'buildComplete',
                        buildingId: b.id,
                        x: b.x,
                        y: b.y,
                        type: this.buildingType,
                        team: this.team,
                        buildId: this.buildId
                    });
                }
            }
            if(this.builder) { this.builder.task=null; game.resumeWorkerEconomy(this.builder); }
            return true;
        }
        return false;
    }

    render(ctx) {
        const prog=Math.min(1,this.buildProgress/this.buildTime);
        ctx.strokeStyle=this.team===PLAYER?'#FFD700':'#FF8C00'; ctx.lineWidth=3;
        ctx.setLineDash([5,5]); ctx.strokeRect(this.x,this.y,this.width,this.height); ctx.setLineDash([]);
        ctx.fillStyle='rgba(139,69,19,0.3)'; ctx.fillRect(this.x,this.y,this.width,this.height);
        ctx.fillStyle='rgba(76,175,80,0.5)'; ctx.fillRect(this.x,this.y+this.height-(this.height*prog),this.width,this.height*prog);
        ctx.fillStyle='#000'; ctx.fillRect(this.x,this.y-10,this.width,6);
        ctx.fillStyle='#FFD700'; ctx.fillRect(this.x,this.y-10,this.width*prog,6);
        ctx.fillStyle='#fff'; ctx.font='12px Arial'; ctx.textAlign='center';
        ctx.fillText('🔨',this.x+this.width/2,this.y+this.height/2+5);
        ctx.fillText(Math.floor(prog*100)+'%',this.x+this.width/2,this.y+this.height/2+20);
    }
}

let game;

function mpSendAction(action) {
    if (game?.multiplayerSync) return game.multiplayerSync.sendAction(action);
    return false;
}

function mpAssignBuildingId(building) {
    if (game?.multiplayerSync) return game.multiplayerSync.assignBuildingId(building);
    return null;
}

// Функция для запуска игры (вызывается из меню)
function initGame(skipWorldGeneration = false) {
    if (!game) {
        game = new Game(skipWorldGeneration);
        window.game = game;
    }
    window.game = game;
    return game;
}

// Не запускаем игру автоматически - ждем нажатия кнопки в меню
window.addEventListener('load', () => {
    // Игра будет создана только после нажатия "Начать игру"
});
