// sound.js - Handles audio configurations, fade timelines, and unit sound triggers using ModernChess assets
const repoBaseUrl = 'https://raw.githubusercontent.com/ModernChess/assets-images/main/';

const unitAudioConfigs = {
    infantrySelect: {
        src: repoBaseUrl + 'sound4-armycharge.mp3',
        start: 2.0,
        end: 3.9,
        fadeDuration: 1.8,
        baseVolume: 0.25,
        maxFadeVol: 0.5
    },
    tankSelect: {
        src: repoBaseUrl + 'sound7tankstart.mp3',
        start: 1.5,
        end: 5.0,
        fadeDuration: 1.5,
        baseVolume: 0.2,
        isFadeIn: true
    },
    infantryMove: {
        src: repoBaseUrl + 'sound 3.mp3',
        start: 3.0,
        end: 6.0,
        fadeDuration: 1.5,
        baseVolume: 1,
        maxFadeVol: 0.5
    },
    tankMove: {
        src: repoBaseUrl + 'sound5tankmove.mp3',
        start: 1,
        end: 3.5,
        fadeDuration: 1.5,
        baseVolume: 0.2,
        maxFadeVol: 0.2
    },
    shipSound: {
        src: repoBaseUrl + 'sound6battleshiphorn.mp3',
        start: 0,
        end: 3.5,
        fadeDuration: 1.5,
        baseVolume: 0.5,
        isFadeIn: false
    },
    planeSelect: {
        src: repoBaseUrl + 'sound12planestarting.mp3',
        start: 0,
        end: 3.5,
        fadeDuration: 1.0,
        baseVolume: 0.8
    },
    planeMove: {
        src: repoBaseUrl + 'sound13planeflying.mp3',
        start: 0,
        end: 3.5,
        fadeDuration: 1.0,
        baseVolume: 0.8
    },
    mineSelect: {
        src: repoBaseUrl + 'sound14mines.mp3',
        start: 0,
        end: 3.5,
        fadeDuration: 1.0,
        baseVolume: 0.5
    },
    antiAirMove: {
        src: repoBaseUrl + 'sound15antiairmoving.mp3',
        start: 0,
        end: 3.5,
        fadeDuration: 1.0,
        baseVolume: 0.7
    },
    engineerSound: {
        src: repoBaseUrl + 'sound16engineerall.mp3',
        start: 0,
        end: 3.5,
        fadeDuration: 1.0,
        baseVolume: 0.7
    },
    antiAirSelect: {
        src: repoBaseUrl + 'sound17antiairselected.mp3',
        start: 0,
        end: 3.5,
        fadeDuration: 1.0,
        baseVolume: 0.5
    }
};

function createUnitAudioPlayer(config) {
    const audio = document.createElement('audio');
    audio.src = config.src;
    audio.preload = 'auto';

    audio.addEventListener('timeupdate', () => {
        let currentTime = audio.currentTime;
        let baseVol = config.baseVolume;

        if (config.isFadeIn) {
            let fadeInBufferTime = config.start + config.fadeDuration;
            if (currentTime >= config.start && currentTime <= fadeInBufferTime) {
                let progress = (currentTime - config.start) / config.fadeDuration;
                audio.volume = Math.max(0, Math.min(baseVol, baseVol * progress));
            } else {
                let fadeOutStartTime = config.end - config.fadeDuration;
                if (currentTime >= fadeOutStartTime && currentTime < config.end) {
                    let fadeProgress = (config.end - currentTime) / config.fadeDuration;
                    audio.volume = Math.max(0, Math.min(baseVol, baseVol * fadeProgress));
                }
            }
        } else {
            let fadeStartTime = config.end - config.fadeDuration;
            if (currentTime >= fadeStartTime && currentTime < config.end) {
                let fadeProgress = (config.end - currentTime) / config.fadeDuration;
                let cap = config.maxFadeVol !== undefined ? config.maxFadeVol : baseVol;
                audio.volume = Math.max(0, Math.min(baseVol, cap * fadeProgress));
            }
        }

        if (currentTime >= config.end) {
            audio.pause();
            audio.currentTime = config.start;
        }
    });

    return function() {
        audio.pause();
        audio.currentTime = config.start;
        audio.volume = config.isFadeIn ? 0 : config.baseVolume;
        audio.play().catch(err => {
            console.warn(`Audio playback prevented or failed for ${config.src}:`, err);
        });
    };
}

const playInfantrySound = createUnitAudioPlayer(unitAudioConfigs.infantrySelect);
const playTankSound = createUnitAudioPlayer(unitAudioConfigs.tankSelect);
const playInfantryMoveSound = createUnitAudioPlayer(unitAudioConfigs.infantryMove);
const playTankMoveSound = createUnitAudioPlayer(unitAudioConfigs.tankMove);
const playShipSound = createUnitAudioPlayer(unitAudioConfigs.shipSound);
const playPlaneSelectSound = createUnitAudioPlayer(unitAudioConfigs.planeSelect);
const playPlaneMoveSound = createUnitAudioPlayer(unitAudioConfigs.planeMove);
const playMineSelectSound = createUnitAudioPlayer(unitAudioConfigs.mineSelect);
const playAntiAirSelectSound = createUnitAudioPlayer(unitAudioConfigs.antiAirSelect);
const playAntiAirMoveSound = createUnitAudioPlayer(unitAudioConfigs.antiAirMove);
const playEngineerSound = createUnitAudioPlayer(unitAudioConfigs.engineerSound);

export function triggerSelectSound(unitName) {
    let lower = (unitName || '').toLowerCase();
    if (lower.includes('infantry')) playInfantrySound();
    else if (lower.includes('tank')) playTankSound();
    else if (lower.includes('plane')) playPlaneSelectSound();
    else if (lower.includes('mine')) playMineSelectSound();
    else if (lower.includes('anti-air')) playAntiAirSelectSound();
    else if (lower.includes('ship')) playShipSound();
    else if (lower.includes('engineer')) playEngineerSound();
}

export function triggerMoveSound(unitName) {
    let lower = (unitName || '').toLowerCase();
    if (lower.includes('infantry')) playInfantryMoveSound();
    else if (lower.includes('tank')) playTankMoveSound();
    else if (lower.includes('plane')) playPlaneMoveSound();
    else if (lower.includes('anti-air')) playAntiAirMoveSound();
    else if (lower.includes('ship')) playShipSound();
    else if (lower.includes('engineer')) playEngineerSound();
}