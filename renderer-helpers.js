// renderer-helpers.js - Helper modules with local repoBaseUrl and sound11burningcity.mp3 asset configuration
import { 
    cols, rows, 
    colLetterToIndex, goldCoreList, goldList, artList, tList, rbList, bbList, navList, bbcList, rbcList 
} from './game-config.js';
import { getPendingUnitType } from './deployment.js';

let smokeParticles = [];
let tileFlagAnimations = new Map();
let tileFireTimestamps = new Map();
let previousTileCapturesState = {};

// Local constant asset repository base URL with updated burning city audio asset
const repoBaseUrl = 'https://raw.githubusercontent.com/ModernChess/assets-images/main/';
const fireAudio = new Audio(repoBaseUrl + 'sound11burningcity.mp3');
fireAudio.loop = false;

const fireAudioConfig = {
    startTime: 0,          
    endTime: 5.0,            
    maxVolume: 0.2,          
    fadeInDuration: 0,     
    fadeOutDuration: 0.5     
};

function processAudioEffect(audioElement, fireElapsed, config) {
    let audioElapsed = fireElapsed / 1000;
    
    if (audioElapsed >= config.startTime && audioElapsed <= config.endTime) {
        let currentVol = config.maxVolume;
        let fadeInEnd = config.startTime + config.fadeInDuration;
        let fadeOutStart = config.endTime - config.fadeOutDuration;

        if (audioElapsed < fadeInEnd) {
            let progress = (audioElapsed - config.startTime) / config.fadeInDuration;
            currentVol = progress * config.maxVolume;
        } else if (audioElapsed > fadeOutStart) {
            let progress = (config.endTime - audioElapsed) / config.fadeOutDuration;
            currentVol = progress * config.maxVolume;
        }

        audioElement.volume = Math.max(0, Math.min(config.maxVolume, currentVol));
    } else if (audioElapsed > config.endTime) {
        audioElement.pause();
    }
}

function toCoordSet(list) {
    const set = new Set();
    list.forEach(item => {
        let m = item.match(/^([A-Z]+)(\d+)$/);
        if (m) set.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
    });
    return set;
}

export const deploymentRules = {
    infantry: new Set([...toCoordSet(goldCoreList), ...toCoordSet(goldList), ...toCoordSet(rbList), ...toCoordSet(bbList), ...toCoordSet(bbcList), ...toCoordSet(rbcList)]),
    artillery: toCoordSet(artList),
    antiair: toCoordSet(artList),
    engineer: toCoordSet(artList),
    mine: toCoordSet(artList),
    tank: toCoordSet(tList),
    plane: toCoordSet(tList),
    ship: toCoordSet(navList)
};

export const unitColors = {
    infantry: 'rgba(0, 128, 0, 0.35)',     
    ship: 'rgba(128, 0, 128, 0.35)',         
    antiair: 'rgba(0, 255, 255, 0.35)',      
    engineer: 'rgba(0, 0, 0, 0.35)',         
    mine: 'rgba(255, 0, 0, 0.35)',           
    tank: 'rgba(128, 128, 128, 0.35)',       
    plane: 'rgba(0, 0, 255, 0.35)',          
    artillery: 'rgba(255, 165, 0, 0.35)'     
};

export const unitBorderColors = {
    infantry: '#008000',
    ship: '#800080',
    antiair: '#00ffff',
    engineer: '#000000',
    mine: '#ff0000',
    tank: '#808080',
    plane: '#0000ff',
    artillery: '#ffa500'
};

export function spawnSmokeTrail(unit, prevX, prevY, cellSize) {
    let dx = unit.animX - prevX;
    let dy = unit.animY - prevY;
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        smokeParticles.push({
            x: unit.animX + cellSize / 2 + (Math.random() - 0.5) * 10,
            y: unit.animY + cellSize / 2 + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            radius: cellSize * 0.12,
            maxRadius: cellSize * 0.38,
            life: 1.0,
            decay: 0.03 + Math.random() * 0.02
        });
    }
}

export function drawSmokeParticles(ctx) {
    ctx.save();
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        let p = smokeParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.radius += (p.maxRadius - p.radius) * 0.05;
        p.life -= p.decay;
        p.alpha = Math.max(0, p.life * 0.3);

        if (p.life <= 0) {
            smokeParticles.splice(i, 1);
        } else {
            ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

export function drawCapturedTileBadges(ctx, canvas, tileCaptures, getRenderCoordinatesFunc, localTeam) {
    if (!tileCaptures) return;
    ctx.save();
    for (let key in tileCaptures) {
        let tileInfo = tileCaptures[key];
        if (tileInfo && tileInfo.capturedBy) {
            let parts = key.split(',');
            if (parts.length === 2) {
                let gx = parseInt(parts[0], 10);
                let gy = parseInt(parts[1], 10);
                let pos = getRenderCoordinatesFunc(gx, gy, canvas.width, localTeam);

                let badgeColor = tileInfo.capturedBy === 'blue' ? '#2196F3' : '#ff5252';
                let badgeRadius = pos.cellSize * 0.18;
                let badgeX = pos.x + pos.cellSize - badgeRadius - 4;
                let badgeY = pos.y + badgeRadius + 4;

                ctx.fillStyle = badgeColor;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

export function drawCapturedTileFireAndSmoke(ctx, canvas, tileCaptures, getRenderCoordinatesFunc, localTeam) {
    if (!tileCaptures) return;
    let now = performance.now();

    for (let key in tileCaptures) {
        let tileInfo = tileCaptures[key];
        if (tileInfo && tileInfo.capturedBy) {
            if (!previousTileCapturesState[key] || previousTileCapturesState[key].capturedBy !== tileInfo.capturedBy) {
                if (!tileFlagAnimations.has(key) && !tileFireTimestamps.has(key)) {
                    tileFlagAnimations.set(key, now);
                }
            }
        }
    }
    previousTileCapturesState = JSON.parse(JSON.stringify(tileCaptures));

    ctx.save();

    for (let [key, flagStartTime] of tileFlagAnimations.entries()) {
        let tileInfo = tileCaptures[key];
        if (!tileInfo || !tileInfo.capturedBy) {
            tileFlagAnimations.delete(key);
            continue;
        }

        let elapsed = now - flagStartTime;
        let duration = 500;

        if (elapsed < duration) {
            let parts = key.split(',');
            if (parts.length === 2) {
                let gx = parseInt(parts[0], 10);
                let gy = parseInt(parts[1], 10);
                let pos = getRenderCoordinatesFunc(gx, gy, canvas.width, localTeam);
                let cx = pos.x + pos.cellSize / 2;
                let cy = pos.y + pos.cellSize / 2;
                let cellSize = pos.cellSize;

                let progress = elapsed / duration;
                let startDistance = cellSize * 2.5; 
                let dropOffset = (1 - Math.cos(progress * Math.PI * 0.5)) * startDistance;
                let renderY = cy - startDistance + dropOffset;

                ctx.save();
                ctx.fillStyle = tileInfo.capturedBy === 'blue' ? '#2980b9' : '#c0392b';
                ctx.fillRect(cx - 1, renderY, 2, cellSize * 1.4);
                
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.moveTo(cx + 1, renderY);
                ctx.lineTo(cx + 13, renderY + 6);
                ctx.lineTo(cx + 1, renderY + 12);
                ctx.fill();
                ctx.restore();
            }
        } else {
            tileFlagAnimations.delete(key);
            tileFireTimestamps.set(key, now);
            
            fireAudio.currentTime = fireAudioConfig.startTime;
            fireAudio.volume = 0;
            fireAudio.play().catch(err => console.log("Audio autoplay restricted:", err));
        }
    }

    for (let [key, fireStartTime] of tileFireTimestamps.entries()) {
        let tileInfo = tileCaptures[key];
        if (!tileInfo || !tileInfo.capturedBy) {
            tileFireTimestamps.delete(key);
            continue;
        }

        let fireElapsed = now - fireStartTime;
        let fireDuration = 5000;

        processAudioEffect(fireAudio, fireElapsed, fireAudioConfig);

        if (fireElapsed < fireDuration) {
            let parts = key.split(',');
            if (parts.length === 2) {
                let gx = parseInt(parts[0], 10);
                let gy = parseInt(parts[1], 10);
                let pos = getRenderCoordinatesFunc(gx, gy, canvas.width, localTeam);
                let cx = pos.x + pos.cellSize / 2;
                let cy = pos.y + pos.cellSize / 2;
                let cellSize = pos.cellSize;

                let fireAlpha = 0.85;
                if (fireElapsed < 600) {
                    fireAlpha = (fireElapsed / 600) * 0.85;
                } else if (fireDuration - fireElapsed < 1000) {
                    fireAlpha = ((fireDuration - fireElapsed) / 1000) * 0.85;
                }

                ctx.save();
                ctx.globalAlpha = fireAlpha;

                let pulse = Math.sin(now * 0.015) * 3;

                ctx.fillStyle = '#d35400';
                ctx.beginPath();
                ctx.moveTo(cx - cellSize * 0.35, cy + cellSize * 0.3);
                ctx.quadraticCurveTo(cx - cellSize * 0.45, cy - cellSize * 0.1, cx - cellSize * 0.15 + pulse * 0.1, cy - cellSize * 0.5);
                ctx.quadraticCurveTo(cx, cy - cellSize * 0.75 + pulse * 0.2, cx + cellSize * 0.15 - pulse * 0.1, cy - cellSize * 0.5);
                ctx.quadraticCurveTo(cx + cellSize * 0.45, cy - cellSize * 0.1, cx + cellSize * 0.35, cy + cellSize * 0.3);
                ctx.closePath();
                ctx.fill();

                let grad = ctx.createLinearGradient(cx, cy - cellSize * 0.85, cx, cy + cellSize * 0.2);
                grad.addColorStop(0.0, '#fff200'); 
                grad.addColorStop(0.4, '#f1c40f'); 
                grad.addColorStop(0.8, '#e67e22'); 
                grad.addColorStop(1.0, '#d35400'); 

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(cx - cellSize * 0.2, cy + cellSize * 0.2);
                ctx.quadraticCurveTo(cx - cellSize * 0.25, cy - cellSize * 0.2, cx - cellSize * 0.05, cy - cellSize * 0.85 + pulse);
                ctx.quadraticCurveTo(cx, cy - cellSize * 0.95 + pulse, cx + cellSize * 0.05, cy - cellSize * 0.85 + pulse);
                ctx.quadraticCurveTo(cx + cellSize * 0.25, cy - cellSize * 0.2, cx + cellSize * 0.2, cy + cellSize * 0.2);
                ctx.closePath();
                ctx.fill();

                ctx.restore();

                let smokeParticlesCount = 5;
                for (let i = 0; i < smokeParticlesCount; i++) {
                    let particleCycle = (fireElapsed + i * 1000) % fireDuration;
                    let pProgress = particleCycle / fireDuration;
                    
                    let smokeX = cx + Math.sin(pProgress * Math.PI * 3 + i) * 14;
                    let smokeY = cy - (pProgress * cellSize * 5.2); 
                    let baseAlpha = Math.max(0, 1 - pProgress);
                    
                    let overallFade = fireDuration - fireElapsed < 1000 ? (fireDuration - fireElapsed) / 1000 : (fireElapsed < 600 ? fireElapsed / 600 : 1.0);
                    let smokeAlpha = baseAlpha * 0.45 * overallFade;
                    
                    let smokeRadius = cellSize * (0.18 + pProgress * 0.3); 

                    ctx.fillStyle = `rgba(110, 110, 110, ${smokeAlpha})`;
                    ctx.beginPath();
                    ctx.arc(smokeX, smokeY, smokeRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else {
            tileFireTimestamps.delete(key);
            fireAudio.pause();
        }
    }

    ctx.restore();
}

export function drawDeploymentOverlay(ctx, canvas, tileCaptures, units, getRenderCoordinatesFunc, localTeam) {
    let activePendingType = getPendingUnitType();
    if (!activePendingType) return;

    let typeKey = activePendingType.toLowerCase();
    let allowedTiles = deploymentRules[typeKey];
    let fillColor = unitColors[typeKey] || 'rgba(33, 150, 243, 0.35)';
    let strokeColor = unitBorderColors[typeKey] || '#2196F3';

    if (allowedTiles) {
        ctx.save();
        for (let key in tileCaptures) {
            let tileInfo = tileCaptures[key];
            if (tileInfo && tileInfo.capturedBy === localTeam && allowedTiles.has(key)) {
                let parts = key.split(',');
                if (parts.length === 2) {
                    let gx = parseInt(parts[0], 10);
                    let gy = parseInt(parts[1], 10);
                    
                    let isOccupied = units.some(u => u.gridX === gx && u.gridY === gy);
                    if (isOccupied) continue;

                    let pos = getRenderCoordinatesFunc(gx, gy, canvas.width, localTeam);
                    
                    ctx.fillStyle = fillColor;
                    ctx.fillRect(pos.x + 2, pos.y + 2, pos.cellSize - 4, pos.cellSize - 4);

                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.strokeRect(pos.x + 2, pos.y + 2, pos.cellSize - 4, pos.cellSize - 4);
                }
            }
        }
        ctx.restore();
    }
}
