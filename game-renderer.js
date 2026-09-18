// game-renderer.js - Handles Canvas Drawing, Map Background Rendering, Unit Visuals, Glide Animations, Tile Highlighting, and Stalemate Badges
import { 
    cols, rows, 
    blueAntiairImg, blueAntiairLoaded, redAntiairImg, redAntiairLoaded, 
    blueArtilleryImg, blueArtilleryLoaded, redArtilleryImg, redArtilleryLoaded, 
    blueEngineerImg, blueEngineerLoaded, redEngineerImg, redEngineerLoaded, 
    blueInfantryImg, blueInfantryLoaded, redInfantryImg, redInfantryLoaded, 
    blueMineImg, blueMineLoaded, redMineImg, redMineLoaded, 
    bluePlaneImg, bluePlaneLoaded, redPlaneImg, redPlaneLoaded, 
    blueShipImg, blueShipLoaded, redShipImg, redShipLoaded, 
    blueTankImg, blueTankLoaded, redTankImg, redTankLoaded, 
    mapImg, mapLoaded, isWaterTerrain 
} from './game-config.js';
import { applyCameraTransform } from './viewport.js';
import { getUnitRange, getShowUnitRange, getEngineerRangeTiles } from './unit-movement.js';
import { getSuperunitsForTeam, getUnitMacroRangeTiles, stalematedUnits } from './combat-mechanics.js';
import { tileCaptures } from './team-logic.js';
import { spawnSmokeTrail, drawSmokeParticles, drawCapturedTileBadges, drawCapturedTileFireAndSmoke, drawDeploymentOverlay } from './renderer-helpers.js';

let superunitBadgeCache = new Map();
let cachedUnitsForDeployment = [];

export function updateRendererUnits(units) {
    if (Array.isArray(units)) {
        cachedUnitsForDeployment = units;
    }
}

export function getUnitAtCoordinate(gx, gy) {
    return cachedUnitsForDeployment.find(u => Number(u.gridX) === Number(gx) && Number(u.gridY) === Number(gy)) || null;
}

export function getRenderCoordinates(gridX, gridY, canvasWidth, localTeam) {
    let cellSize = canvasWidth / cols;
    let renderX = gridX;
    let renderY = gridY;

    if (localTeam === 'red') {
        renderX = cols - 1 - gridX;
        renderY = rows - 1 - gridY;
    }

    return { x: renderX * cellSize, y: renderY * cellSize, cellSize: cellSize };
}

export function drawGameScene(ctx, canvas, units, selectedUnit, localTeam, legalMoves = [], selectionAnimStartTime = null) {
    if (!ctx || !canvas) return;
    
    updateRendererUnits(units);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    applyCameraTransform(ctx);

    let boardWidth = canvas.width;
    let boardHeight = boardWidth * (rows / cols);

    ctx.save();
    if (localTeam === 'red') {
        ctx.translate(boardWidth, boardHeight);
        ctx.rotate(Math.PI);
    }
    if (mapLoaded && mapImg && mapImg.complete) {
        ctx.drawImage(mapImg, 0, 0, boardWidth, boardHeight);
    }
    ctx.restore();

    // Render captured tile team badges using helpers
    drawCapturedTileBadges(ctx, canvas, tileCaptures, getRenderCoordinates, localTeam);

    // Render captured tile fire and smoke visual animation system
    drawCapturedTileFireAndSmoke(ctx, canvas, tileCaptures, getRenderCoordinates, localTeam);

    // Smoke particle animation loop using helpers
    drawSmokeParticles(ctx);

    // Deployment placement highlights using helpers
    drawDeploymentOverlay(ctx, canvas, tileCaptures, units, getRenderCoordinates, localTeam);

    if (selectedUnit && legalMoves && legalMoves.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        legalMoves.forEach(m => {
            let movePos = getRenderCoordinates(m.c, m.r, canvas.width, localTeam);
            let px = movePos.x + 4;
            let py = movePos.y + 4;
            let pSize = movePos.cellSize - 8;

            ctx.fillStyle = '#ff8000';
            ctx.fillRect(px, py, pSize, pSize);

            let centerX = movePos.x + movePos.cellSize / 2;
            let centerY = movePos.y + movePos.cellSize / 2;
            let radius = movePos.cellSize * 0.18;

            ctx.fillStyle = '#e74c3c';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
        ctx.restore();
    }

    let detectedUnitIds = new Set();
    units.forEach(unit => {
        if (getShowUnitRange(unit.id)) {
            let rangeTiles = getUnitMacroRangeTiles(unit);
            rangeTiles.forEach(tile => {
                let found = units.find(u => u.gridX === tile.c && u.gridY === tile.r);
                if (found && found.id !== unit.id) {
                    detectedUnitIds.add(found.id);
                }
            });
        }
    });

    units.forEach(unit => {
        if (getShowUnitRange(unit.id)) {
            ctx.save();
            let rangeVal = getUnitRange(unit);
            
            if (rangeVal > 0) {
                let macroSize = 2;
                let unitMCol = Math.floor(unit.gridX / macroSize);
                let unitMRow = Math.floor(unit.gridY / macroSize);

                let directions = [
                    { dc: 0, dr: -1 }, { dc: 0, dr: 1 },   
                    { dc: -1, dr: 0 }, { dc: 1, dr: 0 },   
                    { dc: -1, dr: -1 }, { dc: 1, dr: -1 }, 
                    { dc: -1, dr: 1 }, { dc: 1, dr: 1 }
                ];

                let targetMacroSquares = new Set();

                directions.forEach(dir => {
                    for (let step = 1; step <= rangeVal; step++) {
                        let targetMCol = unitMCol + (dir.dc * step);
                        let targetMRow = unitMRow + (dir.dr * step);

                        let startGridX = targetMCol * macroSize;
                        let startGridY = targetMRow * macroSize;

                        if (startGridX < 0 || startGridX >= cols || startGridY < 0 || startGridY >= rows) {
                            break;
                        }

                        targetMacroSquares.add(`${targetMCol},${targetMRow}`);
                    }
                });

                targetMacroSquares.forEach(coordStr => {
                    let [targetMCol, targetMRow] = coordStr.split(',').map(Number);

                    let startGridX = targetMCol * macroSize;
                    let startGridY = targetMRow * macroSize;
                    let endGridX = Math.min(cols - 1, startGridX + macroSize - 1);
                    let endGridY = Math.min(rows - 1, startGridY + macroSize - 1);

                    let pos1 = getRenderCoordinates(startGridX, startGridY, canvas.width, localTeam);
                    let pos2 = getRenderCoordinates(endGridX, endGridY, canvas.width, localTeam);

                    let rectX = Math.min(pos1.x, pos2.x) + 2;
                    let rectY = Math.min(pos1.y, pos2.y) + 2;
                    let maxRendererX = Math.max(pos1.x + pos1.cellSize, pos2.x + pos2.cellSize);
                    let maxRendererY = Math.max(pos1.y + pos1.cellSize, pos2.y + pos2.cellSize);
                    let rectWidth = maxRendererX - rectX - 2;
                    let rectHeight = maxRendererY - rectY - 2;

                    ctx.globalAlpha = 0.25;
                    ctx.fillStyle = '#2196F3';
                    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

                    ctx.globalAlpha = 0.8;
                    ctx.strokeStyle = '#2196F3';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
                });

                if (unit.name === 'Engineer') {
                    let engineerTiles = getEngineerRangeTiles(unit);
                    let isOnWater = isWaterTerrain(unit.gridX, unit.gridY);

                    engineerTiles.forEach(tile => {
                        let tilePos = getRenderCoordinates(tile.c, tile.r, canvas.width, localTeam);
                        let centerX = tilePos.x + tilePos.cellSize / 2;
                        let centerY = tilePos.y + tilePos.cellSize / 2;
                        let radius = tilePos.cellSize * 0.18;

                        ctx.save();
                        ctx.globalAlpha = 1.0; 
                        ctx.fillStyle = isOnWater ? '#2980b9' : '#1e8449';
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 2;

                        ctx.beginPath();
                        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();
                    });
                }
            }
            ctx.restore();
        }
    });

    let singleBadgeMap = new Map();
    let currentClusterKeys = new Set();
    let teamSuperunitsMap = new Map();

    ['blue', 'red'].forEach(teamName => {
        let suList = getSuperunitsForTeam(teamName, units);
        teamSuperunitsMap.set(teamName, suList);
        suList.forEach(su => {
            if (su.units && su.units.length > 0) {
                let sortedIds = su.units.map(u => u.id).sort((a, b) => a - b);
                let clusterKey = sortedIds.join(',');
                currentClusterKeys.add(clusterKey);

                let repUnitId = superunitBadgeCache.get(clusterKey);
                let repUnit = su.units.find(u => u.id === repUnitId);

                if (!repUnit) {
                    repUnit = su.units[Math.floor(Math.random() * su.units.length)];
                    superunitBadgeCache.set(clusterKey, repUnit.id);
                }

                if (su.units.length > 1) {
                    singleBadgeMap.set(repUnit.id, su.power);
                }
            }
        });
    });

    for (let key of superunitBadgeCache.keys()) {
        if (!currentClusterKeys.has(key)) {
            superunitBadgeCache.delete(key);
        }
    }

    units.forEach(unit => {
        let targetPos = getRenderCoordinates(unit.gridX, unit.gridY, canvas.width, localTeam);

        if (unit.animX === undefined || unit.animY === undefined) {
            unit.animX = targetPos.x;
            unit.animY = targetPos.y;
        }

        let prevX = unit.animX;
        let prevY = unit.animY;

        unit.animX += (targetPos.x - unit.animX) * 0.05;
        unit.animY += (targetPos.y - unit.animY) * 0.05;

        spawnSmokeTrail(unit, prevX, prevY, targetPos.cellSize);

        let floatOffset = 0;
        let isSelected = selectedUnit && selectedUnit.id === unit.id;
        let isDetected = detectedUnitIds.has(unit.id);

        if (isSelected && selectionAnimStartTime !== null) {
            let elapsed = performance.now() - selectionAnimStartTime;
            let duration = 2000;
            
            if (elapsed < duration) {
                let progress = elapsed / duration;
                floatOffset = -Math.abs(Math.sin(progress * Math.PI * 3.5)) * 12 * Math.max(0, 1 - progress);
            } else {
                floatOffset = 0;
            }
        }

        ctx.save();

        let shadowX = unit.animX + targetPos.cellSize / 2;
        let shadowY = unit.animY + targetPos.cellSize - 4;
        let heightFactor = Math.max(0.4, 1 - (Math.abs(floatOffset) / 10));
        let shadowRadiusX = (targetPos.cellSize * 0.32) * heightFactor;
        let shadowRadiusY = (targetPos.cellSize * 0.12) * heightFactor;

        ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * heightFactor})`;
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();

        let renderDrawY = unit.animY + floatOffset;

        // --- DIRECTIONAL ROTATION & FAST ANIMATION CALCULATION ---
        let fromX = unit.animFromX !== undefined ? unit.animFromX : unit.gridX;
        let fromY = unit.animFromY !== undefined ? unit.animFromY : unit.gridY;
        let dx = unit.gridX - fromX;
        let dy = unit.gridY - fromY;

        let targetAngle = 0; // Default North (Up)
        if (dx === 0 && dy < 0) targetAngle = 0;                      // Up
        else if (dx > 0 && dy < 0) targetAngle = Math.PI / 4;        // Up-Right (45°)
        else if (dx > 0 && dy === 0) targetAngle = Math.PI / 2;      // Right (90°)
        else if (dx > 0 && dy > 0) targetAngle = (3 * Math.PI) / 4;  // Down-Right (135°)
        else if (dx === 0 && dy > 0) targetAngle = Math.PI;          // Down (180°)
        else if (dx < 0 && dy > 0) targetAngle = -(3 * Math.PI) / 4; // Down-Left (-135°)
        else if (dx < 0 && dy === 0) targetAngle = -Math.PI / 2;     // Left (-90°)
        else if (dx < 0 && dy < 0) targetAngle = -Math.PI / 4;       // Up-Left (-45°)

        if (localTeam === 'red') {
            targetAngle += Math.PI;
        }

        if (unit.visualAngle === undefined) {
            unit.visualAngle = targetAngle;
        } else {
            let angleDiff = targetAngle - unit.visualAngle;
            // Shortest path angle wrap handling
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            unit.visualAngle += angleDiff * 0.35; // 0.35 interpolation factor makes it spin very quickly and smoothly
        }

        let unitImg = null;
        let isLoaded = false;
        if (unit.team === 'blue') {
            if (unit.name === 'Anti-Air') { unitImg = blueAntiairImg; isLoaded = blueAntiairLoaded; }
            else if (unit.name === 'Artillery') { unitImg = blueArtilleryImg; isLoaded = blueArtilleryLoaded; }
            else if (unit.name === 'Engineer') { unitImg = blueEngineerImg; isLoaded = blueEngineerLoaded; }
            else if (unit.name === 'Infantry') { unitImg = blueInfantryImg; isLoaded = blueInfantryLoaded; }
            else if (unit.name === 'Mine') { unitImg = blueMineImg; isLoaded = blueMineLoaded; }
            else if (unit.name === 'Plane') { unitImg = bluePlaneImg; isLoaded = bluePlaneLoaded; }
            else if (unit.name === 'Ship') { unitImg = blueShipImg; isLoaded = blueShipLoaded; }
            else if (unit.name === 'Tank') { unitImg = blueTankImg; isLoaded = blueTankLoaded; }
        } else {
            if (unit.name === 'Anti-Air') { unitImg = redAntiairImg; isLoaded = redAntiairLoaded; }
            else if (unit.name === 'Artillery') { unitImg = redArtilleryImg; isLoaded = redArtilleryLoaded; }
            else if (unit.name === 'Engineer') { unitImg = redEngineerImg; isLoaded = redEngineerLoaded; }
            else if (unit.name === 'Infantry') { unitImg = redInfantryImg; isLoaded = redInfantryLoaded; }
            else if (unit.name === 'Mine') { unitImg = redMineImg; isLoaded = redMineLoaded; }
            else if (unit.name === 'Plane') { unitImg = redPlaneImg; isLoaded = redPlaneLoaded; }
            else if (unit.name === 'Ship') { unitImg = redShipImg; isLoaded = redShipLoaded; }
            else if (unit.name === 'Tank') { unitImg = redTankImg; isLoaded = redTankLoaded; }
        }

        let cellCenterX = unit.animX + targetPos.cellSize / 2;
        let cellCenterY = renderDrawY + targetPos.cellSize / 2;
        let drawSize = (targetPos.cellSize - 4) * 2.0; // 100% larger size

        ctx.save();
        ctx.translate(cellCenterX, cellCenterY);
        ctx.rotate(unit.visualAngle);

        if (isLoaded && unitImg && unitImg.complete) {
            // 1. Back Layer: Increased silhouette size multiplier (1.14x) for a slightly bigger black outline boundary
            ctx.save();
            ctx.filter = 'brightness(0)'; // Turns the image completely black
            ctx.globalAlpha = 0.5;        // Semi-transparent
            let outlineSize = drawSize * 1.14; 
            ctx.drawImage(unitImg, -outlineSize / 2, -outlineSize / 2, outlineSize, outlineSize);
            ctx.restore();

            // 2. Front Layer: Draw the original unit sprite cleanly on top
            ctx.drawImage(unitImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        } else {
            ctx.fillStyle = unit.team === 'blue' ? '#2196F3' : '#ff5252';
            ctx.beginPath();
            ctx.arc(0, 0, targetPos.cellSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        if (isSelected) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.strokeRect(unit.animX + 4, renderDrawY + 4, targetPos.cellSize - 8, targetPos.cellSize - 8);
        } else if (isDetected) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2, 2, 2]);
            ctx.strokeRect(unit.animX + 4, renderDrawY + 4, targetPos.cellSize - 8, targetPos.cellSize - 8);
        }

        // --- STALEMATE & SUPERUNIT POWER BADGE RENDERING ---
        let clusterPower = singleBadgeMap.get(unit.id);
        let isStalemated = unit.stalemate || stalematedUnits.has(unit.id);
        let teamSuList = teamSuperunitsMap.get(unit.team) || [];
        let parentSu = teamSuList.find(su => su.units.some(u => u.id === unit.id));
        if (parentSu && parentSu.stalemate) {
            isStalemated = true;
        }

        if (clusterPower !== undefined || isStalemated) {
            let badgeRadius = Math.max(5, targetPos.cellSize * 0.14);
            let badgeX = unit.animX + targetPos.cellSize + badgeRadius * 0.8;
            let badgeY = renderDrawY - badgeRadius * 0.8;

            ctx.fillStyle = isStalemated ? '#7f8c8d' : '#e74c3c';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (isStalemated) {
                ctx.font = `${Math.max(8, Math.floor(badgeRadius * 1.2))}px sans-serif`;
                ctx.fillText('🔒', badgeX, badgeY);
            } else if (clusterPower !== undefined) {
                ctx.font = `bold ${Math.max(8, Math.floor(badgeRadius * 1.1))}px "Times New Roman", serif`;
                ctx.fillText(clusterPower, badgeX, badgeY);
            }
        }

        ctx.restore();
    });

    ctx.restore();
}
