// game-renderer.js - Handles Canvas Drawing, Map Background Rendering, Unit Visuals, Glide Animations, Tile Highlighting, and Perspective Flipping
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
    mapImg, mapLoaded, isWaterTerrain,
    colLetterToIndex, goldCoreList, goldList, artList, tList, rbList, bbList, navList, bbcList, rbcList 
} from './game-config.js';
import { applyCameraTransform } from './viewport.js';
import { getUnitRange, getShowUnitRange, getEngineerRangeTiles } from './unit-movement.js';
import { getSuperunitsForTeam, getUnitMacroRangeTiles } from './combat-mechanics.js';
import { tileCaptures } from './team-logic.js';
import { getPendingUnitType } from './deployment.js';

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

function toCoordSet(list) {
    const set = new Set();
    list.forEach(item => {
        let m = item.match(/^([A-Z]+)(\d+)$/);
        if (m) set.add(`${colLetterToIndex(m[1])},${parseInt(m[2], 10) - 18}`);
    });
    return set;
}

const deploymentRules = {
    infantry: new Set([...toCoordSet(goldCoreList), ...toCoordSet(goldList), ...toCoordSet(rbList), ...toCoordSet(bbList), ...toCoordSet(bbcList), ...toCoordSet(rbcList)]),
    artillery: toCoordSet(artList),
    antiair: toCoordSet(artList),
    engineer: toCoordSet(artList),
    mine: toCoordSet(artList),
    tank: toCoordSet(tList),
    plane: toCoordSet(tList),
    ship: toCoordSet(navList)
};

const unitColors = {
    infantry: 'rgba(0, 128, 0, 0.35)',     // Green
    ship: 'rgba(128, 0, 128, 0.35)',         // Purple
    antiair: 'rgba(0, 255, 255, 0.35)',      // Cyan
    engineer: 'rgba(0, 0, 0, 0.35)',         // Black
    mine: 'rgba(255, 0, 0, 0.35)',           // Red
    tank: 'rgba(128, 128, 128, 0.35)',       // Grey
    plane: 'rgba(0, 0, 255, 0.35)',          // Blue
    artillery: 'rgba(255, 165, 0, 0.35)'     // Orange
};

const unitBorderColors = {
    infantry: '#008000',
    ship: '#800080',
    antiair: '#00ffff',
    engineer: '#000000',
    mine: '#ff0000',
    tank: '#808080',
    plane: '#0000ff',
    artillery: '#ffa500'
};

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
    
    // Keep deployment sync cache fresh right at frame start
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

    // Render captured tile team badges
    if (tileCaptures) {
        ctx.save();
        for (let key in tileCaptures) {
            let tileInfo = tileCaptures[key];
            if (tileInfo && tileInfo.capturedBy) {
                let parts = key.split(',');
                if (parts.length === 2) {
                    let gx = parseInt(parts[0], 10);
                    let gy = parseInt(parts[1], 10);
                    let pos = getRenderCoordinates(gx, gy, canvas.width, localTeam);

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

    // 4. Render Semi-Transparent Fills and Dashed Outlines for Valid Deployment Tiles when pendingUnitType is active
    let activePendingType = getPendingUnitType();
    if (activePendingType) {
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
                        
                        // Check if any unit already occupies these coordinates, and skip if true
                        let isOccupied = units.some(u => u.gridX === gx && u.gridY === gy);
                        if (isOccupied) continue;

                        let pos = getRenderCoordinates(gx, gy, canvas.width, localTeam);
                        
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

    ['blue', 'red'].forEach(teamName => {
        let suList = getSuperunitsForTeam(teamName, units);
        suList.forEach(su => {
            if (su.units && su.units.length > 1) {
                let sortedIds = su.units.map(u => u.id).sort((a, b) => a - b);
                let clusterKey = sortedIds.join(',');
                currentClusterKeys.add(clusterKey);

                let repUnitId = superunitBadgeCache.get(clusterKey);
                let repUnit = su.units.find(u => u.id === repUnitId);

                if (!repUnit) {
                    repUnit = su.units[Math.floor(Math.random() * su.units.length)];
                    superunitBadgeCache.set(clusterKey, repUnit.id);
                }

                singleBadgeMap.set(repUnit.id, su.power);
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
        } else {
            unit.animX += (targetPos.x - unit.animX) * 0.07;
            unit.animY += (targetPos.y - unit.animY) * 0.07;
        }

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

        if (isLoaded && unitImg && unitImg.complete) {
            ctx.drawImage(unitImg, unit.animX + 2, renderDrawY + 2, targetPos.cellSize - 4, targetPos.cellSize - 4);
        } else {
            ctx.fillStyle = unit.team === 'blue' ? '#2196F3' : '#ff5252';
            ctx.beginPath();
            ctx.arc(unit.animX + targetPos.cellSize / 2, renderDrawY + targetPos.cellSize / 2, targetPos.cellSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

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

        let clusterPower = singleBadgeMap.get(unit.id);
        if (clusterPower !== undefined) {
            let badgeRadius = Math.max(5, targetPos.cellSize * 0.14);
            let badgeX = unit.animX + targetPos.cellSize + badgeRadius * 0.8;
            let badgeY = renderDrawY - badgeRadius * 0.8;

            ctx.fillStyle = '#e74c3c';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(8, Math.floor(badgeRadius * 1.1))}px "Times New Roman", serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(clusterPower, badgeX, badgeY);
        }

        ctx.restore();
    });

    ctx.restore();
}
