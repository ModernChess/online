// unit-movement.js - Handles 8-Directional Raycasting Queen-Style Movement Calculation & Range Overlay UI Control
import { cols, rows, getTerrain, isWaterTerrain } from './game-config.js';
import { getRenderCoordinates } from './game-renderer.js';

const activeRangeUnitIds = new Set();

export function getShowUnitRange(unitId) {
    if (!unitId) return false;
    return activeRangeUnitIds.has(unitId);
}

export function toggleUnitRange(unitId) {
    if (!unitId) return false;
    if (activeRangeUnitIds.has(unitId)) {
        activeRangeUnitIds.delete(unitId);
        return false;
    } else {
        activeRangeUnitIds.add(unitId);
        return true;
    }
}

export function getUnitRange(unit) {
    if (!unit) return 0;
    if (unit.name === 'Infantry' || unit.name === 'Tank' || unit.name === 'Plane') {
        return 0;
    }
    if (unit.name === 'Artillery') {
        return 3;
    }
    if (unit.name === 'Engineer' || unit.name === 'Mine') {
        return 3;
    }
    return 1;
}

export function clearUnitRangeOverlayButton() {
    const existingBtn = document.getElementById('activeUnitRangeBtn');
    if (existingBtn) existingBtn.remove();
}

export function updateUnitRangeOverlayButton(canvas, selectedUnit, localTeam, logCallback) {
    clearUnitRangeOverlayButton();
    if (!selectedUnit) return;

    let rangeVal = getUnitRange(selectedUnit);
    if (rangeVal <= 0) return;

    const container = document.getElementById('canvas-container');
    if (!container) return;

    let renderPos = getRenderCoordinates(selectedUnit.gridX, selectedUnit.gridY, canvas.width, localTeam);
    let scaleX = canvas.clientWidth / canvas.width;
    let scaleY = canvas.clientHeight / canvas.height;

    let btn = document.createElement('button');
    btn.id = 'activeUnitRangeBtn';
    btn.className = 'unit-range-btn';
    btn.innerText = 'R';
    btn.title = 'Toggle Independent Range Footprint';

    const isCurrentlyOn = activeRangeUnitIds.has(selectedUnit.id);
    if (isCurrentlyOn) {
        btn.style.backgroundColor = '#27ae60';
        btn.style.color = '#fff';
    }

    let leftPx = (renderPos.x + renderPos.cellSize) * scaleX;
    let topPx = renderPos.y * scaleY;

    btn.style.left = `${leftPx}px`;
    btn.style.top = `${topPx}px`;

    btn.onclick = (e) => {
        e.stopPropagation();
        const newState = toggleUnitRange(selectedUnit.id);
        
        if (newState) {
            btn.style.backgroundColor = '#27ae60';
            btn.style.color = '#fff';
        } else {
            btn.style.backgroundColor = '';
            btn.style.color = '';
        }

        if (logCallback) {
            logCallback(`Toggled range overlay for unit ${selectedUnit.name} (ID: ${selectedUnit.id}): ${newState ? 'ON' : 'OFF'}`);
        }
    };

    container.appendChild(btn);
}

export function getLegalMoves(unit, units) {
    if (!unit) return [];
    let moves = [];
    let maxRange = unit.range || 3;
    let cx = unit.gridX;
    let cy = unit.gridY;

    let directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },  
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },  
        { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, 
        { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
    ];

    let isNaval = unit.type && unit.type.includes('naval');
    let isLandOrTrap = unit.type && (!unit.type.includes('naval') && !unit.type.includes('air'));

    let bridgedWaterTiles = new Set();
    if (isLandOrTrap) {
        units.forEach(u => {
            if (u.team === unit.team && u.name === 'Engineer' && getShowUnitRange(u.id)) {
                let engTiles = getEngineerRangeTiles(u);
                engTiles.forEach(t => {
                    bridgedWaterTiles.add(`${t.c},${t.r}`);
                });
            }
        });
    }

    directions.forEach(dir => {
        for (let step = 1; step <= maxRange; step++) {
            let nc = cx + (dir.dx * step);
            let nr = cy + (dir.dy * step);

            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) break;

            let terrain = getTerrain(nc, nr);
            let tileIsWater = isWaterTerrain(nc, nr) || terrain === 'light_navy';

            if (isLandOrTrap) {
                let isBridged = bridgedWaterTiles.has(`${nc},${nr}`);
                if (tileIsWater && !isBridged) {
                    break;
                }
            }

            if (isNaval && terrain !== 'light_navy' && terrain !== 'naval') {
                break;
            }

            let occupyingUnit = units.find(u => u.gridX === nc && u.gridY === nr);
            if (!occupyingUnit) {
                moves.push({ c: nc, r: nr });
            }
        }
    });

    return moves;
}

export function getEngineerRangeTiles(unit) {
    if (!unit || unit.name !== 'Engineer') return [];
    
    let tiles = [];
    let rangeVal = getUnitRange(unit); // 1
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

        for (let r = startGridY; r <= endGridY; r++) {
            for (let c = startGridX; c <= endGridX; c++) {
                if (isWaterTerrain(c, r)) {
                    tiles.push({ c, r });
                }
            }
        }
    });

    return tiles;
}
