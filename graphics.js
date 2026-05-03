// ═══════════════════════════════════════════════════════════════
// УЛУЧШЕННАЯ ГРАФИКА И ПОГОДА
// ═══════════════════════════════════════════════════════════════

// Система погоды
const Weather = {
    current: 'clear', // 'clear', 'rain', 'storm', 'fog', 'snow'
    intensity: 0,
    particles: [],
    fogDensity: 0,
    windX: 0,
    windY: 0,
    puddles: [], // Лужи от дождя
    snowAccumulation: 0, // Накопление снега
    lightningTimer: 0,
    weatherTransition: 0, // Плавный переход между погодами
    nextWeather: null,

    // Инициализация
    init() {
        this.changeWeather('clear');
        // Автоматическая смена погоды каждые 3-5 минут
        setInterval(() => this.randomWeatherChange(), 180000 + Math.random() * 120000);
    },

    // Случайная смена погоды
    randomWeatherChange() {
        const weathers = ['clear', 'rain', 'storm', 'fog', 'snow'];
        const newWeather = weathers[Math.floor(Math.random() * weathers.length)];
        if (newWeather !== this.current) {
            this.changeWeather(newWeather);
        }
    },

    // Смена погоды
    changeWeather(type) {
        this.nextWeather = type;
        this.weatherTransition = 0;

        // Плавный переход
        const transitionInterval = setInterval(() => {
            this.weatherTransition += 0.02;
            if (this.weatherTransition >= 1) {
                this.weatherTransition = 1;
                this.current = type;
                this.particles = [];
                clearInterval(transitionInterval);

                switch(type) {
                    case 'rain':
                        this.intensity = 0.7;
                        this.fogDensity = 0.1;
                        this.windX = -2;
                        this.windY = 8;
                        this.createRainParticles(400);
                        this.createPuddles(30);
                        break;
                    case 'storm':
                        this.intensity = 1.0;
                        this.fogDensity = 0.25;
                        this.windX = -5;
                        this.windY = 12;
                        this.createRainParticles(600);
                        this.createPuddles(50);
                        break;
                    case 'fog':
                        this.intensity = 0.8;
                        this.fogDensity = 0.5;
                        this.windX = 0.3;
                        this.windY = 0;
                        this.createFogParticles(150);
                        break;
                    case 'snow':
                        this.intensity = 0.6;
                        this.fogDensity = 0.2;
                        this.windX = -1.5;
                        this.windY = 2;
                        this.createSnowParticles(300);
                        this.snowAccumulation = 0;
                        break;
                    default: // clear
                        this.intensity = 0;
                        this.fogDensity = 0;
                        this.windX = 0;
                        this.windY = 0;
                        this.puddles = [];
                        this.snowAccumulation = 0;
                }
            }
        }, 50);
    },

    // Создание луж
    createPuddles(count) {
        this.puddles = [];
        for (let i = 0; i < count; i++) {
            this.puddles.push({
                x: Math.random() * (MAP_WIDTH * TILE_SIZE),
                y: Math.random() * (MAP_HEIGHT * TILE_SIZE),
                size: 20 + Math.random() * 40,
                opacity: 0.2 + Math.random() * 0.3,
                ripplePhase: Math.random() * Math.PI * 2
            });
        }
    },

    // Создание частиц дождя
    createRainParticles(count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * (MAP_WIDTH * TILE_SIZE),
                y: Math.random() * (MAP_HEIGHT * TILE_SIZE),
                speed: 8 + Math.random() * 4,
                length: 10 + Math.random() * 10,
                opacity: 0.3 + Math.random() * 0.4
            });
        }
    },

    // Создание частиц снега
    createSnowParticles(count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * (MAP_WIDTH * TILE_SIZE),
                y: Math.random() * (MAP_HEIGHT * TILE_SIZE),
                speed: 1 + Math.random() * 2,
                size: 2 + Math.random() * 3,
                opacity: 0.5 + Math.random() * 0.5,
                drift: Math.random() * 2 - 1
            });
        }
    },

    // Создание частиц тумана
    createFogParticles(count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * (MAP_WIDTH * TILE_SIZE),
                y: Math.random() * (MAP_HEIGHT * TILE_SIZE),
                size: 50 + Math.random() * 100,
                speed: 0.2 + Math.random() * 0.3,
                opacity: 0.1 + Math.random() * 0.2,
                drift: Math.random() * 0.5 - 0.25
            });
        }
    },

    // Обновление погоды
    update(dt) {
        // Обновление частиц
        this.particles.forEach(p => {
            if (this.current === 'rain' || this.current === 'storm') {
                p.x += this.windX;
                p.y += p.speed;

                if (p.y > MAP_HEIGHT * TILE_SIZE) {
                    p.y = -20;
                    p.x = Math.random() * (MAP_WIDTH * TILE_SIZE);
                }
                if (p.x < 0) p.x = MAP_WIDTH * TILE_SIZE;
            } else if (this.current === 'snow') {
                p.x += this.windX + p.drift;
                p.y += p.speed;

                // Накопление снега
                if (p.y > MAP_HEIGHT * TILE_SIZE - 10) {
                    this.snowAccumulation = Math.min(this.snowAccumulation + 0.001, 20);
                    p.y = -10;
                    p.x = Math.random() * (MAP_WIDTH * TILE_SIZE);
                }
            } else if (this.current === 'fog') {
                p.x += p.speed + p.drift;
                p.y += Math.sin(Date.now() / 1000 + p.drift * 10) * 0.2;

                if (p.x > MAP_WIDTH * TILE_SIZE + 200) {
                    p.x = -200;
                    p.y = Math.random() * (MAP_HEIGHT * TILE_SIZE);
                }
            }
        });

        // Обновление луж (рябь)
        this.puddles.forEach(p => {
            p.ripplePhase += 0.05;
        });

        // Таймер молний
        if (this.current === 'storm') {
            this.lightningTimer += dt;
        }
    },

    // Отрисовка погоды
    render(ctx, camera) {
        // Лужи (под всем)
        if (this.puddles.length > 0) {
            this.puddles.forEach(puddle => {
                const screenX = puddle.x - camera.x;
                const screenY = puddle.y - camera.y;

                if (screenX < -100 || screenX > canvas.width + 100 ||
                    screenY < -100 || screenY > canvas.height + 100) return;

                // Основа лужи
                ctx.fillStyle = `rgba(100, 150, 200, ${puddle.opacity})`;
                ctx.beginPath();
                ctx.ellipse(screenX, screenY, puddle.size, puddle.size * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();

                // Рябь
                const ripple = Math.sin(puddle.ripplePhase) * 0.5 + 0.5;
                ctx.strokeStyle = `rgba(150, 180, 220, ${puddle.opacity * ripple * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(screenX, screenY, puddle.size * (1 + ripple * 0.2), puddle.size * 0.6 * (1 + ripple * 0.2), 0, 0, Math.PI * 2);
                ctx.stroke();
            });
        }

        // Накопление снега на земле
        if (this.snowAccumulation > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(this.snowAccumulation / 20, 0.3)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Туман (фоновый слой) - многослойный
        if (this.fogDensity > 0) {
            // Дальний слой
            ctx.fillStyle = `rgba(200, 200, 220, ${this.fogDensity * 0.2})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Средний слой
            ctx.fillStyle = `rgba(210, 210, 230, ${this.fogDensity * 0.15})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Частицы погоды
        this.particles.forEach(p => {
            const screenX = p.x - camera.x;
            const screenY = p.y - camera.y;

            // Отрисовка только видимых частиц
            if (screenX < -100 || screenX > canvas.width + 100 ||
                screenY < -100 || screenY > canvas.height + 100) return;

            if (this.current === 'rain' || this.current === 'storm') {
                // Дождь - более реалистичный
                const gradient = ctx.createLinearGradient(screenX, screenY, screenX + this.windX * 2, screenY + p.length);
                gradient.addColorStop(0, `rgba(174, 194, 224, ${p.opacity})`);
                gradient.addColorStop(1, `rgba(174, 194, 224, ${p.opacity * 0.3})`);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX + this.windX * 2, screenY + p.length);
                ctx.stroke();

                // Брызги при ударе
                if (Math.random() < 0.01) {
                    ctx.fillStyle = `rgba(174, 194, 224, ${p.opacity * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY + p.length, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (this.current === 'snow') {
                // Снег - с вращением
                const rotation = (Date.now() / 1000 + p.drift * 10) % (Math.PI * 2);
                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(rotation);

                // Снежинка
                ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();

                // Детали снежинки
                ctx.strokeStyle = `rgba(240, 240, 255, ${p.opacity * 0.8})`;
                ctx.lineWidth = 0.5;
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI * 2 / 6) * i;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * p.size, Math.sin(angle) * p.size);
                    ctx.stroke();
                }

                ctx.restore();
            } else if (this.current === 'fog') {
                // Туман (частицы) - объёмный
                const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, p.size);
                gradient.addColorStop(0, `rgba(220, 220, 235, ${p.opacity * 0.8})`);
                gradient.addColorStop(0.5, `rgba(220, 220, 235, ${p.opacity * 0.4})`);
                gradient.addColorStop(1, 'rgba(220, 220, 235, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(screenX - p.size, screenY - p.size, p.size * 2, p.size * 2);
            }
        });

        // Молнии при шторме
        if (this.current === 'storm' && this.lightningTimer > 2000 && Math.random() < 0.003) {
            this.drawLightning(ctx, camera);
            this.lightningTimer = 0;
        }
    },

    // Отрисовка молнии
    drawLightning(ctx, camera) {
        const startX = Math.random() * canvas.width;
        const startY = 0;
        const endY = canvas.height;

        // Основная молния
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'white';

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        let x = startX;
        let y = startY;
        const segments = [];

        while (y < endY) {
            const prevX = x;
            const prevY = y;
            x += (Math.random() - 0.5) * 60;
            y += 40 + Math.random() * 60;
            segments.push({ x1: prevX, y1: prevY, x2: x, y2: y });
            ctx.lineTo(x, y);
        }

        ctx.stroke();

        // Ответвления молнии
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.7)';
        segments.forEach((seg, i) => {
            if (Math.random() < 0.3 && i < segments.length - 2) {
                ctx.beginPath();
                ctx.moveTo(seg.x2, seg.y2);
                const branchX = seg.x2 + (Math.random() - 0.5) * 80;
                const branchY = seg.y2 + 60 + Math.random() * 40;
                ctx.lineTo(branchX, branchY);
                ctx.stroke();
            }
        });

        ctx.shadowBlur = 0;

        // Яркая вспышка
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Звук грома (если есть аудио контекст)
        if (typeof AudioContext !== 'undefined' && Math.random() < 0.5) {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.frequency.value = 50;
                oscillator.type = 'sawtooth';

                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);

                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 1);
            } catch(e) {
                // Игнорируем ошибки аудио
            }
        }
    }
};

// Улучшенная отрисовка зданий
const BuildingGraphics = {
    // Отрисовка здания с улучшениями
    drawBuilding(ctx, building, camera) {
        const screenX = building.x - camera.x;
        const screenY = building.y - camera.y;
        const config = BUILDING_CONFIGS[building.type];
        const level = building.level || 1;

        // Тень
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(
            screenX + config.width / 2,
            screenY + config.height + 5,
            config.width / 2,
            8,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        // Основа здания
        this.drawBuildingBase(ctx, building, screenX, screenY, config, level);

        // Детали в зависимости от уровня
        this.drawBuildingDetails(ctx, building, screenX, screenY, config, level);

        // Полоска здоровья
        this.drawHealthBar(ctx, building, screenX, screenY, config);
    },

    // Основа здания
    drawBuildingBase(ctx, building, x, y, config, level) {
        const colors = this.getBuildingColors(building.type, level);

        // Градиент для объёма
        const gradient = ctx.createLinearGradient(x, y, x, y + config.height);
        gradient.addColorStop(0, colors.light);
        gradient.addColorStop(0.5, colors.main);
        gradient.addColorStop(1, colors.dark);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, config.width, config.height);

        // Обводка
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, config.width, config.height);
    },

    // Детали здания
    drawBuildingDetails(ctx, building, x, y, config, level) {
        const w = config.width;
        const h = config.height;

        switch(building.type) {
            case 'townhall':
                this.drawTownHallDetails(ctx, x, y, w, h, level);
                break;
            case 'house':
                this.drawHouseDetails(ctx, x, y, w, h, level);
                break;
            case 'barracks':
                this.drawBarracksDetails(ctx, x, y, w, h, level);
                break;
            case 'storage':
                this.drawStorageDetails(ctx, x, y, w, h, level);
                break;
            case 'farm':
                this.drawFarmDetails(ctx, x, y, w, h, level);
                break;
            case 'archertower':
                this.drawTowerDetails(ctx, x, y, w, h, level);
                break;
            case 'forge':
                this.drawForgeDetails(ctx, x, y, w, h, level);
                break;
            case 'magictower':
                this.drawMagicTowerDetails(ctx, x, y, w, h, level);
                break;
        }
    },

    // Цвета зданий в зависимости от уровня
    getBuildingColors(type, level) {
        const baseColors = {
            townhall: { main: '#8B6914', light: '#C9A84C', dark: '#5C4609', border: '#3D2E06' },
            house: { main: '#8B4513', light: '#A0522D', dark: '#654321', border: '#3E2A1A' },
            barracks: { main: '#696969', light: '#808080', dark: '#4A4A4A', border: '#2F2F2F' },
            storage: { main: '#8B7355', light: '#A0826D', dark: '#6B5A45', border: '#4A3F30' },
            farm: { main: '#6B8E23', light: '#7FA52E', dark: '#556B1F', border: '#3A4A15' },
            archertower: { main: '#708090', light: '#8B9AA8', dark: '#556270', border: '#3A4450' },
            forge: { main: '#B22222', light: '#CD5C5C', dark: '#8B1A1A', border: '#5C1111' },
            magictower: { main: '#4B0082', light: '#6A0DAD', dark: '#350062', border: '#1F0042' }
        };

        const colors = baseColors[type] || baseColors.house;

        // Улучшение цветов с уровнем
        if (level >= 2) {
            return {
                main: this.brightenColor(colors.main, 0.1),
                light: this.brightenColor(colors.light, 0.1),
                dark: colors.dark,
                border: colors.border
            };
        }
        if (level >= 3) {
            return {
                main: this.brightenColor(colors.main, 0.2),
                light: this.brightenColor(colors.light, 0.2),
                dark: this.brightenColor(colors.dark, 0.1),
                border: colors.border
            };
        }

        return colors;
    },

    // Осветление цвета
    brightenColor(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, ((num >> 16) & 0xff) + Math.floor(255 * amount));
        const g = Math.min(255, ((num >> 8) & 0xff) + Math.floor(255 * amount));
        const b = Math.min(255, (num & 0xff) + Math.floor(255 * amount));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    },

    // Детали ратуши
    drawTownHallDetails(ctx, x, y, w, h, level) {
        // Крыша
        const roofColor = level >= 3 ? '#A00000' : level >= 2 ? '#8B0000' : '#6B0000';
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.3);
        ctx.lineTo(x + w / 2, y - 5);
        ctx.lineTo(x + w, y + h * 0.3);
        ctx.closePath();
        ctx.fill();

        // Тень крыши
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x + 5, y + h * 0.3, w - 10, 3);

        // Окна (больше с уровнем)
        ctx.fillStyle = level >= 3 ? '#FFE700' : '#FFD700';
        const windowSize = level * 4;
        const windowCount = level + 1;
        for (let i = 0; i < windowCount; i++) {
            const wx = x + 10 + i * (w - 20) / windowCount;
            ctx.fillRect(wx, y + h * 0.5, windowSize, windowSize);

            // Свечение окон на высоких уровнях
            if (level >= 2) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#FFD700';
                ctx.fillRect(wx, y + h * 0.5, windowSize, windowSize);
                ctx.shadowBlur = 0;
            }

            // Второй ряд окон на уровне 3
            if (level >= 3) {
                ctx.fillRect(wx, y + h * 0.7, windowSize, windowSize);
            }
        }

        // Дверь
        ctx.fillStyle = '#3E2A1A';
        const doorWidth = 16 + level * 2;
        const doorHeight = 24 + level * 3;
        ctx.fillRect(x + w / 2 - doorWidth / 2, y + h - doorHeight, doorWidth, doorHeight);

        // Арка над дверью
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h - doorHeight, doorWidth / 2, Math.PI, 0);
        ctx.stroke();

        // Флаг на уровне 3
        if (level >= 3) {
            ctx.strokeStyle = '#8B6914';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y - 5);
            ctx.lineTo(x + w / 2, y - 30);
            ctx.stroke();

            // Анимированный флаг
            const wave = Math.sin(Date.now() / 200) * 3;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y - 30);
            ctx.lineTo(x + w / 2 + 20 + wave, y - 25);
            ctx.lineTo(x + w / 2 + wave, y - 20);
            ctx.fill();

            // Свечение флага
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FFD700';
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Декоративные колонны на уровне 2+
        if (level >= 2) {
            ctx.fillStyle = '#A0826D';
            ctx.fillRect(x + 8, y + h * 0.4, 6, h * 0.6);
            ctx.fillRect(x + w - 14, y + h * 0.4, 6, h * 0.6);
        }
    },

    // Детали дома
    drawHouseDetails(ctx, x, y, w, h, level) {
        // Крыша (улучшается с уровнем)
        const roofColor = level >= 3 ? '#A0522D' : level >= 2 ? '#8B4513' : '#654321';
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(x - 5, y + h * 0.4);
        ctx.lineTo(x + w / 2, y - 8);
        ctx.lineTo(x + w + 5, y + h * 0.4);
        ctx.closePath();
        ctx.fill();

        // Труба
        ctx.fillStyle = '#5C4033';
        ctx.fillRect(x + w * 0.7, y - 5, 8, 15);

        // Дым из трубы (анимированный)
        if (level >= 2) {
            const smokeOffset = Math.sin(Date.now() / 500) * 3;
            ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
            ctx.beginPath();
            ctx.arc(x + w * 0.7 + 4 + smokeOffset, y - 10, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + w * 0.7 + 6 + smokeOffset * 1.5, y - 16, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Дверь
        ctx.fillStyle = '#3E2A1A';
        const doorW = 14 + level * 2;
        const doorH = 18 + level * 2;
        ctx.fillRect(x + w / 2 - doorW / 2, y + h - doorH, doorW, doorH);

        // Ручка двери
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x + w / 2 + doorW / 3, y + h - doorH / 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Окна (больше с уровнем)
        ctx.fillStyle = '#FFE4B5';
        const windowSize = 12 + level;
        if (level >= 1) {
            ctx.fillRect(x + 10, y + h * 0.5, windowSize, windowSize);
            // Рама окна
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 10, y + h * 0.5, windowSize, windowSize);
        }
        if (level >= 2) {
            ctx.fillRect(x + w - 22, y + h * 0.5, windowSize, windowSize);
            ctx.strokeRect(x + w - 22, y + h * 0.5, windowSize, windowSize);
        }
        if (level >= 3) {
            ctx.fillRect(x + 10, y + h * 0.7, windowSize, windowSize);
            ctx.strokeRect(x + 10, y + h * 0.7, windowSize, windowSize);
            ctx.fillRect(x + w - 22, y + h * 0.7, windowSize, windowSize);
            ctx.strokeRect(x + w - 22, y + h * 0.7, windowSize, windowSize);

            // Цветы в окнах на уровне 3
            ctx.fillStyle = '#FF69B4';
            ctx.fillRect(x + 12, y + h * 0.5 + windowSize - 3, windowSize - 4, 3);
        }

        // Забор на уровне 3
        if (level >= 3) {
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                const fx = x + i * (w / 5);
                ctx.beginPath();
                ctx.moveTo(fx, y + h);
                ctx.lineTo(fx, y + h + 8);
                ctx.stroke();
            }
        }
    },

    // Детали казармы
    drawBarracksDetails(ctx, x, y, w, h, level) {
        // Щит на стене
        ctx.strokeStyle = '#C0C0C0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 15, 0, Math.PI * 2);
        ctx.stroke();

        // Мечи (больше с уровнем)
        ctx.strokeStyle = '#A9A9A9';
        ctx.lineWidth = 3;
        for (let i = 0; i < level; i++) {
            const offsetX = (i - level / 2) * 15;
            ctx.beginPath();
            ctx.moveTo(x + w / 2 + offsetX, y + 10);
            ctx.lineTo(x + w / 2 + offsetX, y + 30);
            ctx.stroke();
        }
    },

    // Детали склада
    drawStorageDetails(ctx, x, y, w, h, level) {
        // Ящики
        ctx.fillStyle = '#654321';
        const boxSize = 12;
        const boxes = level + 2;
        for (let i = 0; i < boxes; i++) {
            const bx = x + 10 + (i % 3) * 20;
            const by = y + h - 30 - Math.floor(i / 3) * 15;
            ctx.fillRect(bx, by, boxSize, boxSize);
            ctx.strokeStyle = '#3E2A1A';
            ctx.strokeRect(bx, by, boxSize, boxSize);
        }
    },

    // Детали фермы
    drawFarmDetails(ctx, x, y, w, h, level) {
        // Грядки
        ctx.fillStyle = '#556B2F';
        const rows = level + 1;
        for (let i = 0; i < rows; i++) {
            ctx.fillRect(x + 10, y + 20 + i * 15, w - 20, 8);
        }

        // Растения
        ctx.fillStyle = '#32CD32';
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < 4; j++) {
                ctx.fillRect(x + 15 + j * 12, y + 18 + i * 15, 4, 8);
            }
        }
    },

    // Детали башни
    drawTowerDetails(ctx, x, y, w, h, level) {
        // Зубцы
        ctx.fillStyle = '#556270';
        const crenels = level + 2;
        const crenelWidth = w / (crenels * 2);
        for (let i = 0; i < crenels; i++) {
            ctx.fillRect(x + i * crenelWidth * 2, y - 8, crenelWidth, 8);
        }

        // Окна-бойницы
        ctx.fillStyle = '#2F2F2F';
        for (let i = 0; i < level; i++) {
            ctx.fillRect(x + w / 2 - 3, y + 20 + i * 20, 6, 12);
        }
    },

    // Детали кузницы
    drawForgeDetails(ctx, x, y, w, h, level) {
        // Наковальня
        ctx.fillStyle = '#696969';
        ctx.fillRect(x + w / 2 - 10, y + h - 25, 20, 10);
        ctx.fillRect(x + w / 2 - 15, y + h - 15, 30, 15);

        // Огонь (ярче и больше с уровнем)
        const fireIntensity = level * 0.3;
        const fireSize = 15 + level * 5;

        // Основной огонь
        ctx.fillStyle = `rgba(255, 100, 0, ${0.6 + fireIntensity})`;
        ctx.beginPath();
        ctx.moveTo(x + 15, y + h - 20);
        ctx.lineTo(x + 15 + fireSize / 2, y + h - 35 - level * 5);
        ctx.lineTo(x + 15 + fireSize, y + h - 20);
        ctx.fill();

        // Внутренний огонь (желтый)
        ctx.fillStyle = `rgba(255, 200, 0, ${0.7 + fireIntensity})`;
        ctx.beginPath();
        ctx.moveTo(x + 18, y + h - 22);
        ctx.lineTo(x + 15 + fireSize / 2, y + h - 30 - level * 3);
        ctx.lineTo(x + 15 + fireSize - 3, y + h - 22);
        ctx.fill();

        // Свечение огня
        if (level >= 2) {
            ctx.shadowBlur = 20 + level * 5;
            ctx.shadowColor = '#FF6600';
            ctx.fillStyle = `rgba(255, 150, 0, ${0.3 + fireIntensity})`;
            ctx.beginPath();
            ctx.arc(x + 15 + fireSize / 2, y + h - 25, fireSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Искры (анимированные)
        if (level >= 2) {
            for (let i = 0; i < level * 2; i++) {
                const sparkX = x + 15 + Math.random() * fireSize;
                const sparkY = y + h - 35 - Math.random() * 20;
                const sparkSize = 1 + Math.random() * 2;
                ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, ${Math.random()})`;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Молот на уровне 3
        if (level >= 3) {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x + w - 25, y + h - 30, 4, 20);
            ctx.fillStyle = '#696969';
            ctx.fillRect(x + w - 30, y + h - 35, 14, 8);
        }
    },

    // Детали магической башни
    drawMagicTowerDetails(ctx, x, y, w, h, level) {
        // Кристалл на вершине (больше и ярче с уровнем)
        const crystalColor = level >= 3 ? '#9370DB' : level >= 2 ? '#8A2BE2' : '#4B0082';
        const crystalSize = 8 + level * 4;

        ctx.fillStyle = crystalColor;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y - 15 - level * 3);
        ctx.lineTo(x + w / 2 - crystalSize, y);
        ctx.lineTo(x + w / 2 + crystalSize, y);
        ctx.closePath();
        ctx.fill();

        // Свечение кристалла (пульсирующее)
        const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
        ctx.shadowBlur = 15 + level * 5;
        ctx.shadowColor = crystalColor;
        ctx.fillStyle = `rgba(147, 112, 219, ${pulse})`;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Магические руны (больше с уровнем)
        ctx.strokeStyle = '#9370DB';
        ctx.lineWidth = 2;
        const runeCount = level + 1;
        for (let i = 0; i < runeCount; i++) {
            const ry = y + 20 + i * (h - 40) / runeCount;
            const runeSize = 8 + Math.sin(Date.now() / 500 + i) * 2;

            // Круглая руна
            ctx.beginPath();
            ctx.arc(x + w / 2, ry, runeSize, 0, Math.PI * 2);
            ctx.stroke();

            // Внутренний символ
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const angle = (Math.PI * 2 / 6) * j;
                const rx = x + w / 2 + Math.cos(angle) * runeSize * 0.5;
                const ry2 = ry + Math.sin(angle) * runeSize * 0.5;
                if (j === 0) ctx.moveTo(rx, ry2);
                else ctx.lineTo(rx, ry2);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Магические частицы вокруг башни
        if (level >= 2) {
            for (let i = 0; i < level * 3; i++) {
                const angle = (Date.now() / 1000 + i) % (Math.PI * 2);
                const radius = 30 + Math.sin(Date.now() / 500 + i) * 10;
                const px = x + w / 2 + Math.cos(angle) * radius;
                const py = y + h / 2 + Math.sin(angle) * radius;

                ctx.fillStyle = `rgba(147, 112, 219, ${0.5 + Math.random() * 0.5})`;
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Магический щит на уровне 3
        if (level >= 3) {
            ctx.strokeStyle = `rgba(147, 112, 219, ${0.3 + pulse * 0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h / 2, w / 2 + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    },

    // Полоска здоровья
    drawHealthBar(ctx, building, x, y, config) {
        const barWidth = config.width;
        const barHeight = 4;
        const healthPercent = building.health / building.maxHealth;

        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y - 10, barWidth, barHeight);

        // Здоровье
        const healthColor = healthPercent > 0.6 ? '#00FF00' : healthPercent > 0.3 ? '#FFFF00' : '#FF0000';
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y - 10, barWidth * healthPercent, barHeight);
    }
};

// Улучшенная отрисовка ресурсов
const ResourceGraphics = {
    // Отрисовка ресурса
    drawResource(ctx, resource, camera) {
        if (resource.depleted) return;

        const screenX = resource.x - camera.x;
        const screenY = resource.y - camera.y;
        const variant = resource.variant || RESOURCE_VARIANTS[resource.type][0];
        const size = (variant.size || 1) * 32;

        // Тень
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + size * 0.4, size * 0.4, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ресурс
        switch(resource.type) {
            case 'wood':
                this.drawTree(ctx, screenX, screenY, size, variant);
                break;
            case 'stone':
                this.drawStone(ctx, screenX, screenY, size, variant);
                break;
            case 'food':
                this.drawFish(ctx, screenX, screenY, size, variant);
                break;
        }

        // Индикатор количества
        if (resource.amount < resource.maxAmount * 0.3) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(screenX, screenY - size * 0.3, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Дерево
    drawTree(ctx, x, y, size, variant) {
        // Ствол
        ctx.fillStyle = variant.secondaryColor;
        ctx.fillRect(x - size * 0.1, y - size * 0.2, size * 0.2, size * 0.4);

        // Крона
        ctx.fillStyle = variant.primaryColor;
        ctx.beginPath();
        ctx.arc(x, y - size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x - size * 0.15, y - size * 0.4, size * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x + size * 0.15, y - size * 0.4, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
    },

    // Камень
    drawStone(ctx, x, y, size, variant) {
        ctx.fillStyle = variant.primaryColor;
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.3);
        ctx.lineTo(x + size * 0.3, y);
        ctx.lineTo(x + size * 0.2, y + size * 0.2);
        ctx.lineTo(x - size * 0.2, y + size * 0.2);
        ctx.lineTo(x - size * 0.3, y);
        ctx.closePath();
        ctx.fill();

        // Трещины
        ctx.strokeStyle = variant.secondaryColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.1, y - size * 0.1);
        ctx.lineTo(x + size * 0.1, y + size * 0.1);
        ctx.stroke();
    },

    // Рыба (водоём)
    drawFish(ctx, x, y, size, variant) {
        // Вода
        ctx.fillStyle = variant.primaryColor;
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.4, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Блики
        ctx.fillStyle = variant.secondaryColor;
        ctx.beginPath();
        ctx.ellipse(x - size * 0.1, y - size * 0.1, size * 0.15, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
    }
};

// Инициализация погоды
if (typeof game !== 'undefined') {
    Weather.init();
}

console.log('[Graphics] Enhanced graphics system loaded');
