// deployment.js - Handles Unit Purchasing, Affordability Checks, and Grid Placement Logic for All Units
import { db, ref, update } from './network.js';
import { 
    goldList, 
    bbcList, 
    rbcList, 
    redBasesList, 
    blueBasesList, 
    teamNavySpawns,
    artList,
    navList 
} from './game-config.js';
import { tileCaptures, parseCoord } from './team-logic.js';
import { getUnitAtCoordinate } from './game-renderer.js';

let pendingUnitType = null;
let isShopOpen = false;
let latestUnitsRef = [];
let teamCoinsRef = { blue: 0, red: 0 };
let currentTeamRef = 'blue';

// Price configuration mapping based on user requirements
const unitPrices = {
    infantry: 1,
    tank: 2,
    ship: 2,
    engineer: 2,
    antiair: 1,
    plane: 3,
    artillery: 2
};

export function setTeamCoinsRef(coinsObj) {
    teamCoinsRef = coinsObj;
}

export function setCurrentTeamRef(team) {
    currentTeamRef = team;
}

export function getTeamCoins() {
    return teamCoinsRef;
}

export function setDeploymentUnits(units) {
    if (Array.isArray(units)) {
        latestUnitsRef = units;
    }
}

export function getIsShopOpen() {
    return isShopOpen;
}

function toCoordSet(list) {
    const set = new Set();
    list.forEach(item => {
        const parsed = parseCoord(item);
        if (parsed) {
            set.add(parsed);
        } else if (typeof item === 'string' && item.includes(',')) {
            set.add(item.trim());
        }
    });
    return set;
}

const baseAndCoreList = [...redBasesList, ...blueBasesList, ...bbcList, ...rbcList].map(i => parseCoord(i)).filter(Boolean);

const deploymentRules = {
    infantry: new Set([...goldList.map(i => parseCoord(i)).filter(Boolean), ...baseAndCoreList]),
    tank: new Set(baseAndCoreList),
    ship: toCoordSet(navList),
    plane: new Set(baseAndCoreList),
    engineer: new Set(baseAndCoreList),
    artillery: toCoordSet(artList),
    antiair: toCoordSet(artList) // Anti-air deploys on artillery squares
};

// Helper to normalize unit type strings consistently (removes spaces and hyphens)
function normalizeType(unitType) {
    return (unitType || '').toLowerCase().replace(/[\s-]/g, '');
}

// Validates whether a specific coordinate is legally owned/controlled by the target team
export function isTileValidForTeam(coordKey, unitType, targetTeam) {
    const typeLower = normalizeType(unitType);
    const cleanCoordKey = parseCoord(coordKey) || (coordKey || '').trim();
    
    const isBlueBase = blueBasesList.some(b => parseCoord(b) === cleanCoordKey) || bbcList.some(b => parseCoord(b) === cleanCoordKey);
    const isRedBase = redBasesList.some(b => parseCoord(b) === cleanCoordKey) || rbcList.some(b => parseCoord(b) === cleanCoordKey);
    
    // Check various possible key formats in tileCaptures
    const tileInfo = tileCaptures[cleanCoordKey] || tileCaptures[coordKey];
    
    // Helper to check if a tile info object belongs to the target team
    const isOwnedByTeam = (info) => {
        if (!info) return false;
        const owner = info.capturedBy || info.team || info.owner;
        return owner && owner.toLowerCase() === targetTeam.toLowerCase();
    };

    if (typeLower === 'ship') {
        // Must be in navList AND explicitly captured/owned by the team via tileCaptures
        const isInNavList = navList.some(k => parseCoord(k) === cleanCoordKey || k.trim() === coordKey);
        if (isInNavList) {
            return isOwnedByTeam(tileInfo);
        }
        return false;
    }

    if (typeLower === 'tank' || typeLower === 'plane' || typeLower === 'engineer') {
        if (targetTeam === 'blue' && isBlueBase) return true;
        if (targetTeam === 'red' && isRedBase) return true;
        if (tileInfo && (tileInfo.type === 'tank' || tileInfo.type === 'tank_spawn')) {
            return isOwnedByTeam(tileInfo);
        }
        return false;
    }

    if (typeLower === 'artillery' || typeLower === 'antiair') {
        // Must be in artList AND explicitly captured by the team
        const isInArtList = artList.some(k => parseCoord(k) === cleanCoordKey || k.trim() === coordKey);
        if (isInArtList) {
            return isOwnedByTeam(tileInfo);
        }
        return false;
    }

    if (typeLower === 'infantry') {
        if (targetTeam === 'blue' && isBlueBase) return true;
        if (targetTeam === 'red' && isRedBase) return true;
        
        // Must be in goldList AND explicitly captured by the team
        const isInGoldList = goldList.some(k => parseCoord(k) === cleanCoordKey || k.trim() === coordKey);
        if (isInGoldList) {
            return isOwnedByTeam(tileInfo);
        }
        return false;
    }

    return false;
}

export function getPendingUnitType() {
    return pendingUnitType;
}

export function setPendingUnitType(type) {
    pendingUnitType = type;
}

export function ensureBuyUnitsModal(logToConsole, getCurrentUnits, getPlayerTeam, matchIdRef, updateHudCallback) {
    if (document.getElementById('buyUnitsModal')) return;

    const modal = document.createElement('div');
    modal.id = 'buyUnitsModal';
    modal.className = 'buy-units-modal-overlay';
    modal.innerHTML = `
        <div class="buy-units-modal-content">
            <div class="shop-header-row">
                <h3>Buy Units</h3>
                <button class="shop-close-btn" id="shopModalXBtn">&times;</button>
            </div>
            <div class="buy-units-list">
                <div class="buy-unit-item"><span>Infantry (${unitPrices.infantry} Coin)</span><button class="btn" data-type="infantry">Buy</button></div>
                <div class="buy-unit-item"><span>Tank (${unitPrices.tank} Coins)</span><button class="btn" data-type="tank">Buy</button></div>
                <div class="buy-unit-item"><span>Ship (${unitPrices.ship} Coins)</span><button class="btn" data-type="ship">Buy</button></div>
                <div class="buy-unit-item"><span>Plane (${unitPrices.plane} Coins)</span><button class="btn" data-type="plane">Buy</button></div>
                <div class="buy-unit-item"><span>Artillery (${unitPrices.artillery} Coins)</span><button class="btn" data-type="artillery">Buy</button></div>
                <div class="buy-unit-item"><span>Engineer (${unitPrices.engineer} Coins)</span><button class="btn" data-type="engineer">Buy</button></div>
                <div class="buy-unit-item"><span>Anti-Air (${unitPrices.antiair} Coin)</span><button class="btn" data-type="antiair">Buy</button></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeShop = () => {
        modal.style.display = 'none';
        isShopOpen = false;
        const buyBtn = document.getElementById('buyUnitsBtn');
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.classList.remove('btn-frozen');
        }
    };

    modal.querySelector('#shopModalXBtn').onclick = closeShop;

    modal.querySelectorAll('.buy-units-list button').forEach(button => {
        button.onclick = (e) => {
            const rawType = e.target.getAttribute('data-type');
            const typeLower = normalizeType(rawType);
            const activeTeam = (typeof getPlayerTeam === 'function') ? getPlayerTeam() : currentTeamRef;
            const currentCoins = teamCoinsRef[activeTeam] || 0;
            const cost = unitPrices[typeLower] || 1;

            if (currentCoins < cost) {
                logToConsole(`Purchase Declined: Team ${activeTeam} has ${currentCoins} coins. Unit costs ${cost} coins.`);
                alert(`Insufficient funds! You need at least ${cost} coins.`);
                return;
            }

            pendingUnitType = rawType;
            modal.style.display = 'none';
            isShopOpen = false;
            
            const buyBtn = document.getElementById('buyUnitsBtn');
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.classList.remove('btn-frozen');
            }

            logToConsole(`Purchased ${rawType} for ${cost} coin(s). Select a valid captured deployment tile.`);
            
            const resolvedUnits = (typeof getCurrentUnits === 'function' && getCurrentUnits().length > 0) 
                ? getCurrentUnits() 
                : (latestUnitsRef.length > 0 ? latestUnitsRef : (window.units || window.gameUnits || []));

            spawnUnitDeployerPopup(rawType, resolvedUnits, logToConsole, activeTeam);
        };
    });
}

export function spawnUnitDeployerPopup(unitType, units, logToConsole, playerTeam) {
    let existing = document.getElementById('unitDeployerPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'unitDeployerPopup';
    popup.className = 'unit-deployer-popup minimized';

    const typeLower = normalizeType(unitType);
    const allowedTiles = deploymentRules[typeLower] || new Set();
    const validRowsList = [];
    const targetTeam = playerTeam || currentTeamRef;
    const cost = unitPrices[typeLower] || 1;

    allowedTiles.forEach(coordKey => {
        let [c, r] = coordKey.split(',').map(Number);
        
        if (isTileValidForTeam(coordKey, unitType, targetTeam)) {
            let occupyingUnit = getUnitAtCoordinate(c, r);
            let tileInfo = tileCaptures[coordKey];
            let displayTypeName = tileInfo ? tileInfo.type : (navList.some(n => parseCoord(n) === coordKey) ? 'port' : (artList.some(a => parseCoord(a) === coordKey) ? 'artillery' : 'base'));

            validRowsList.push({ 
                col: c, 
                row: r, 
                typeName: displayTypeName, 
                occupantName: occupyingUnit ? (occupyingUnit.name || occupyingUnit.type || 'Unit') : null 
            });
        }
    });

    let listHtml = validRowsList.length > 0 
        ? validRowsList.map(t => {
            let occupantWarning = t.occupantName 
                ? `<br><span style="color: #ff5252; font-size: 11px; font-weight: bold;">Another unit (${t.occupantName}) is currently on this</span>` 
                : '';
            return `<div class="deployer-tile-row"><span>${t.typeName.toUpperCase()}</span> <b>[Col: ${t.col}, Row: ${t.row}]</b>${occupantWarning}</div>`;
        }).join('')
        : `<div class="deployer-tile-row"><span>No controlled/captured tiles available for your team!</span></div>`;

    popup.innerHTML = `
        <div class="unit-deployer-header">
            <span class="unit-deployer-title">Deploying: ${unitType.toUpperCase()} (${cost} Coin${cost > 1 ? 's' : ''})</span>
            <div class="unit-deployer-controls">
                <button class="deployer-ctrl-btn" id="deployerMinimizeBtn">+</button>
                <button class="deployer-ctrl-btn" id="deployerCancelBtn">&times; Cancel</button>
            </div>
        </div>
        <div class="unit-deployer-body" style="max-height: 250px; overflow-y: auto;">
            ${listHtml}
        </div>
    `;
    document.body.appendChild(popup);

    let minimized = true;
    popup.querySelector('#deployerMinimizeBtn').onclick = () => {
        minimized = !minimized;
        popup.classList.toggle('minimized', minimized);
        popup.querySelector('#deployerMinimizeBtn').innerText = minimized ? '+' : '_';
    };

    popup.querySelector('#deployerCancelBtn').onclick = () => {
        pendingUnitType = null;
        popup.remove();
        logToConsole("Deployment cancelled. Re-opening shop.");
        
        const modal = document.getElementById('buyUnitsModal');
        if (modal) {
            modal.style.display = 'flex';
            isShopOpen = true;
            const buyBtn = document.getElementById('buyUnitsBtn');
            if (buyBtn) {
                buyBtn.disabled = true;
                buyBtn.classList.add('btn-frozen');
            }
        }
    };
}

export function cleanupUnitDeployerPopup() {
    let popup = document.getElementById('unitDeployerPopup');
    if (popup) popup.remove();
}

export function handleUnitDeployment(clickedCol, clickedRow, playerTeam, units, currentMatchId, logToConsole, teamCoinsObj, updateHudCallback) {
    if (!pendingUnitType) return false;

    const key = `${clickedCol},${clickedRow}`;

    if (!isTileValidForTeam(key, pendingUnitType, playerTeam)) {
        logToConsole(`Failed to deploy: Coordinates [${clickedCol}, ${clickedRow}] do not belong to team ${playerTeam}'s controlled or captured deployment tiles.`);
        return false;
    }

    const occupyingUnit = getUnitAtCoordinate(clickedCol, clickedRow);
    if (occupyingUnit) {
        logToConsole(`Failed to deploy: Coordinates [${clickedCol}, ${clickedRow}] are already occupied by another unit.`);
        return false;
    }

    const typeLower = normalizeType(pendingUnitType);
    const cost = unitPrices[typeLower] || 1;
    const coinsRefToUse = teamCoinsObj || teamCoinsRef;

    if ((coinsRefToUse[playerTeam] || 0) < cost) {
        logToConsole(`Deployment failed: Insufficient funds for team ${playerTeam}. Requires ${cost} coins.`);
        pendingUnitType = null;
        return false;
    }

    coinsRefToUse[playerTeam] -= cost;
    if (typeof updateHudCallback === 'function') {
        updateHudCallback();
    }
    logToConsole(`Deducted ${cost} coin(s) from ${playerTeam}. Remaining balance: ${coinsRefToUse[playerTeam]}`);

    const activeUnits = (Array.isArray(units) && units.length > 0) ? units : latestUnitsRef;

    let unitTypeVal = 'land';
    let unitRange = 2;

    if (typeLower === 'ship') {
        unitTypeVal = 'naval';
        unitRange = 2; 
    } else if (typeLower === 'tank' || typeLower === 'artillery') {
        unitTypeVal = 'land';
        unitRange = 3;
    } else if (typeLower === 'engineer') {
        unitTypeVal = 'air';
        unitRange = 3;
    } else if (typeLower === 'plane') {
        unitTypeVal = 'air';
        unitRange = 4;
    } else if (typeLower === 'antiair') {
        unitTypeVal = 'land';
        unitRange = 2;
    } else if (typeLower === 'infantry') {
        unitTypeVal = 'land';
        unitRange = 2;
    }

    let formattedName = pendingUnitType;
    if (typeLower === 'antiair') formattedName = 'Anti-Air';
    else formattedName = pendingUnitType.charAt(0).toUpperCase() + pendingUnitType.slice(1);

    const newUnit = {
        id: 'test_' + Math.random().toString(36).substring(2, 9),
        name: formattedName,
        type: unitTypeVal,
        range: unitRange,
        team: playerTeam,
        gridX: clickedCol,
        gridY: clickedRow,
        animFromX: clickedCol,
        animFromY: clickedRow,
        animStartTime: performance.now(),
        lastKnownGridX: clickedCol,
        lastKnownGridY: clickedRow,
        hp: 100
    };

    activeUnits.push(newUnit);
    logToConsole(`Placed new unit ${newUnit.name} at coordinates [${clickedCol}, ${clickedRow}]`);

    if (currentMatchId) {
        update(ref(db, `matches_plus/${currentMatchId}`), { 
            units: activeUnits,
            coins: coinsRefToUse 
        });
    }

    pendingUnitType = null;
    return true;
}
