// ═══════════════════════════════════════════════════════════
//  СИСТЕМА ПОГОДЫ
// ═══════════════════════════════════════════════════════════

const WEATHER_TYPES = {
    CLEAR: 'clear',
    LIGHT_FOG: 'light_fog',
    HEAVY_FOG: 'heavy_fog',
    RAIN: 'rain',
    STORM: 'storm'
};

const WEATHER_CONFIG = {
    clear: {
        name: 'Ясно',
        fogAlpha: 0,
        fogColor: 'rgba(200, 200, 220, 0)',
        rainIntensity: 0,
        lightningChance: 0,
        duration: { min: 180000, max: 300000 }, // 3-5 минут
        probability: 0.50
    },
    light_fog: {
        name: 'Легкий туман',
        fogAlpha: 0.15,
        fogColor: 'rgba(200, 210, 220, 0.15)',
        rainIntensity: 0,
        lightningChance: 0,
        duration: { min: 120000, max: 240000 }, // 2-4 минуты
        probability: 0.25
    },
    heavy_fog: {
        name: 'Густой туман',
        fogAlpha: 0.45,
        fogColor: 'rgba(180, 190, 200, 0.45)',
        rainIntensity: 0,
        lightningChance: 0,
        duration: { min: 90000, max: 180000 }, // 1.5-3 минуты
        probability: 0.10
    },
    rain: {
        name: 'Дождь',
        fogAlpha: 0.08,
        fogColor: 'rgba(160, 170, 190, 0.08)',
        rainIntensity: 150,
        lightningChance: 0,
        duration: { min: 60000, max: 150000 }, // 1-2.5 минуты
        probability: 0.12
    },
    storm: {
        name: 'Гроза',
        fogAlpha: 0.25,
        fogColor: 'rgba(140, 150, 170, 0.25)',
        rainIntensity: 300,
        lightningChance: 0.015, // 1.5% шанс молнии каждый кадр
        duration: { min: 45000, max: 90000 }, // 45сек-1.5мин
        probability: 0.03
    }
};

class WeatherSystem {
    constructor() {
        this.currentWeather = WEATHER_TYPES.CLEAR;
        this.nextWeatherChange = Date.now() + this.getRandomDuration(WEATHER_CONFIG.clear);
        this.transitionProgress = 1; // 0-1, где 1 = полностью установилась погода
        this.transitionDuration = 3000; // 3 секунды на переход
        this.transitionStartTime = 0;

        this.raindrops = [];
        this.lightningFlash = 0; // 0-1, яркость вспышки молнии
        this.lightningFadeSpeed = 0.05;

        this.fogParticles = [];
        this.initFogParticles();
    }

    initFogParticles() {
        // Создаем частицы тумана для эффекта движения
        for (let i = 0; i < 30; i++) {
            this.fogParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: 100 + Math.random() * 200,
                speedX: 0.1 + Math.random() * 0.3,
                speedY: -0.05 + Math.random() * 0.1,
                alpha: 0.02 + Math.random() * 0.04
            });
        }
    }

    getRandomDuration(weatherConfig) {
        const { min, max } = weatherConfig.duration;
        return min + Math.random() * (max - min);
    }

    selectNextWeather() {
        // Выбираем следующую погоду на основе вероятностей
        const rand = Math.random();
        let cumulative = 0;

        for (const [type, config] of Object.entries(WEATHER_CONFIG)) {
            cumulative += config.probability;
            if (rand <= cumulative) {
                return type;
            }
        }

        return WEATHER_TYPES.CLEAR;
    }

    update() {
        const now = Date.now();

        // Проверяем, нужно ли менять погоду
        if (now >= this.nextWeatherChange && this.transitionProgress >= 1) {
            const newWeather = this.selectNextWeather();
            if (newWeather !== this.currentWeather) {
                this.startTransition(newWeather);
            } else {
                // Если выбрали ту же погоду, просто продлеваем
                this.nextWeatherChange = now + this.getRandomDuration(WEATHER_CONFIG[this.currentWeather]);
            }
        }

        // Обновляем прогресс перехода
        if (this.transitionProgress < 1) {
            const elapsed = now - this.transitionStartTime;
            this.transitionProgress = Math.min(1, elapsed / this.transitionDuration);
        }

        // Обновляем капли дождя
        const config = WEATHER_CONFIG[this.currentWeather];
        if (config.rainIntensity > 0) {
            this.updateRain(config.rainIntensity);
        }

        // Обновляем молнии
        if (config.lightningChance > 0 && Math.random() < config.lightningChance) {
            this.triggerLightning();
        }
        if (this.lightningFlash > 0) {
            this.lightningFlash = Math.max(0, this.lightningFlash - this.lightningFadeSpeed);
        }

        // Обновляем частицы тумана
        if (config.fogAlpha > 0) {
            this.updateFogParticles();
        }
    }

    startTransition(newWeather) {
        this.currentWeather = newWeather;
        this.transitionProgress = 0;
        this.transitionStartTime = Date.now();
        this.nextWeatherChange = Date.now() + this.getRandomDuration(WEATHER_CONFIG[newWeather]);

        // Очищаем капли при переходе на ясную погоду
        if (WEATHER_CONFIG[newWeather].rainIntensity === 0) {
            this.raindrops = [];
        }
    }

    updateRain(intensity) {
        // Добавляем новые капли
        const dropsToAdd = Math.floor(intensity * this.transitionProgress / 60);
        for (let i = 0; i < dropsToAdd; i++) {
            this.raindrops.push({
                x: Math.random() * canvas.width,
                y: -10,
                speed: 8 + Math.random() * 4,
                length: 10 + Math.random() * 10
            });
        }

        // Обновляем существующие капли
        for (let i = this.raindrops.length - 1; i >= 0; i--) {
            const drop = this.raindrops[i];
            drop.y += drop.speed;
            drop.x -= 1; // Небольшой наклон

            if (drop.y > canvas.height) {
                this.raindrops.splice(i, 1);
            }
        }
    }

    updateFogParticles() {
        for (const particle of this.fogParticles) {
            particle.x += particle.speedX;
            particle.y += particle.speedY;

            // Wrap around
            if (particle.x > canvas.width + particle.size) particle.x = -particle.size;
            if (particle.x < -particle.size) particle.x = canvas.width + particle.size;
            if (particle.y > canvas.height + particle.size) particle.y = -particle.size;
            if (particle.y < -particle.size) particle.y = canvas.height + particle.size;
        }
    }

    triggerLightning() {
        this.lightningFlash = 0.6 + Math.random() * 0.4; // 0.6-1.0
    }

    render(ctx) {
        const config = WEATHER_CONFIG[this.currentWeather];
        const effectStrength = this.transitionProgress;

        // Рендерим дождь
        if (this.raindrops.length > 0) {
            ctx.strokeStyle = 'rgba(180, 200, 220, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const drop of this.raindrops) {
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x - 2, drop.y + drop.length);
            }
            ctx.stroke();
        }

        // Рендерим частицы тумана (движущиеся облака)
        if (config.fogAlpha > 0) {
            for (const particle of this.fogParticles) {
                const gradient = ctx.createRadialGradient(
                    particle.x, particle.y, 0,
                    particle.x, particle.y, particle.size
                );
                const alpha = particle.alpha * config.fogAlpha * effectStrength;
                gradient.addColorStop(0, `rgba(200, 210, 220, ${alpha})`);
                gradient.addColorStop(1, 'rgba(200, 210, 220, 0)');

                ctx.fillStyle = gradient;
                ctx.fillRect(
                    particle.x - particle.size,
                    particle.y - particle.size,
                    particle.size * 2,
                    particle.size * 2
                );
            }
        }

        // Рендерим общий туман поверх всего
        if (config.fogAlpha > 0) {
            ctx.fillStyle = config.fogColor.replace(
                /[\d.]+\)$/,
                `${config.fogAlpha * effectStrength})`
            );
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Рендерим вспышку молнии
        if (this.lightningFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.lightningFlash * 0.3})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Рисуем саму молнию
            if (this.lightningFlash > 0.5) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${this.lightningFlash})`;
                ctx.lineWidth = 2 + Math.random() * 2;
                ctx.beginPath();

                const startX = Math.random() * canvas.width;
                let x = startX;
                let y = 0;

                ctx.moveTo(x, y);
                while (y < canvas.height) {
                    x += (Math.random() - 0.5) * 40;
                    y += 20 + Math.random() * 30;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }
    }

    getCurrentWeatherName() {
        return WEATHER_CONFIG[this.currentWeather].name;
    }

    getVisibilityModifier() {
        // Возвращает множитель видимости (0-1) для игровой механики
        const config = WEATHER_CONFIG[this.currentWeather];
        return 1 - (config.fogAlpha * this.transitionProgress * 0.5);
    }
}
