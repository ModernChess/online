// deployment.js - Handles Unit Purchasing, Affordability Checks, and Grid Placement Logic for Infantry, Tank, and Ship
import { db, ref, update } from './network.js';
import { 
    goldList, 
    bbcList, 
    rbcList, 
    redBasesList, 
    blueBasesList, 
    teamNavySpawns 
} from './game-config.js';
import { tileCaptures } from './team-logic.js';
import { getUnitAtCoordinate } from './game-renderer.js';

let pendingUnitType = null;
let isShopOpen = false;
let latestUnitsRef = [];
let teamCoinsRef = { blue: 0, red: 0 };
let currentTeamRef = 'blue';

export function setTeamCoinsRef(coinsObj) {
    teamCoinsRef = coinsObj;
}

export function setCurrentTeamRef(team) {
    currentTeamRef = team;
}

export function getTeamCoins() {
    return teamCoinsRef;
}

// Allows the main game loop to keep deployment units perfectly synced just like the renderer
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
        if (typeof item === 'string' && item.includes(',')) {
            set.add(item.trim());
        }
    });
    return set;
}

const navyCoordList = teamNavySpawns.map(n => n.coordinates);
const baseAndCoreList = [...redBasesList, ...blueBasesList, ...bbcList, ...rbcList];

const deploymentRules = {
    infantry: new Set([...goldList, ...baseAndCoreList]),
    tank: new Set(baseAndCoreList),
    ship: toCoordSet(navyCoordList)
};

// Validates whether a specific coordinate is legally owned/controlled by the target team for Infantry, Tank, or Ship
export function isTileValidForTeam(coordKey, unitType, targetTeam) {
    const typeLower = unitType.toLowerCase();
    const isBlueBase = blueBasesList.includes(coordKey) || bbcList.includes(coordKey);
    const isRedBase = redBasesList.includes(coordKey) || rbcList.includes(coordKey);
    const tileInfo = tileCaptures[coordKey];

    if (typeLower === 'ship') {
        const navySpawn = teamNavySpawns.find(n => n.coordinates === coordKey);
        return navySpawn && navySpawn.team === targetTeam;
    }

    if (typeLower === 'tank') {
        if (targetTeam === 'blue') return isBlueBase;
        if (targetTeam === 'red') return isRedBase;
        return false;
    }

    if (typeLower === 'infantry') {
        if (targetTeam === 'blue' && isBlueBase) return true;
        if (targetTeam === 'red' && isRedBase) return true;
        if (goldList.includes(coordKey)) {
            return tileInfo && tileInfo.capturedBy === targetTeam;
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
                <h3>Buy Units (1 Coin Each)</h3>
                <button class="shop-close-btn" id="shopModalXBtn">&times;</button>
            </div>
            <div class="buy-units-list">
                <div class="buy-unit-item"><span>Infantry (1 Coin)</span><button class="btn" data-type="infantry">Buy</button></div>
                <div class="buy-unit-item"><span>Tank (1 Coin)</span><button class="btn" data-type="tank">Buy</button></div>
                <div class="buy-unit-item"><span>Ship (1 Coin)</span><button class="btn" data-type="ship">Buy</button></div>
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
            const unitType = e.target.getAttribute('data-type');
            const activeTeam = (typeof getPlayerTeam === 'function') ? getPlayerTeam() : currentTeamRef;
            const currentCoins = teamCoinsRef[activeTeam] || 0;

            if (currentCoins < 1) {
                logToConsole(`Purchase Declined: Team ${activeTeam} has ${currentCoins} coins. Units cost 1 coin.`);
                alert(`Insufficient funds! You need at least 1 coin to purchase a unit.`);
                return;
            }

            pendingUnitType = unitType;
            modal.style.display = 'none';
            isShopOpen = false;
            
            const buyBtn = document.getElementById('buyUnitsBtn');
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.classList.remove('btn-frozen');
            }

            logToConsole(`Purchased ${unitType} for 1 coin. Select a valid captured deployment tile.`);
            
            const resolvedUnits = (typeof getCurrentUnits === 'function' && getCurrentUnits().length > 0) 
                ? getCurrentUnits() 
                : (latestUnitsRef.length > 0 ? latestUnitsRef : (window.units || window.gameUnits || []));

            spawnUnitDeployerPopup(unitType, resolvedUnits, logToConsole, activeTeam);
        };
    });
}

export function spawnUnitDeployerPopup(unitType, units, logToConsole, playerTeam) {
    let existing = document.getElementById('unitDeployerPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'unitDeployerPopup';
    // Start minimized by default
    popup.className = 'unit-deployer-popup minimized';

    const allowedTiles = deploymentRules[unitType.toLowerCase()] || new Set();
    const validRowsList = [];
    const targetTeam = playerTeam || currentTeamRef;

    allowedTiles.forEach(coordKey => {
        let [c, r] = coordKey.split(',').map(Number);
        
        if (isTileValidForTeam(coordKey, unitType, targetTeam)) {
            let occupyingUnit = getUnitAtCoordinate(c, r);
            let tileInfo = tileCaptures[coordKey];
            let displayTypeName = tileInfo ? tileInfo.type : (navyCoordList.includes(coordKey) ? 'nav' : 'base');

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
        : `<div class="deployer-tile-row"><span>No controlled tiles available for your team!</span></div>`;

    popup.innerHTML = `
        <div class="unit-deployer-header">
            <span class="unit-deployer-title">Deploying: ${unitType.toUpperCase()} (1 Coin)</span>
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

    // Initial state reflects minimized = true
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
    const allowedTiles = deploymentRules[pendingUnitType.toLowerCase()];

    if (!allowedTiles || !allowedTiles.has(key)) {
        logToConsole(`Failed to deploy: Not able to deploy ${pendingUnitType} at [${clickedCol}, ${clickedRow}]. Must be on designated deployment tiles.`);
        return false;
    }

    if (!isTileValidForTeam(key, pendingUnitType, playerTeam)) {
        logToConsole(`Failed to deploy: Coordinates [${clickedCol}, ${clickedRow}] do not belong to team ${playerTeam}'s controlled bases, captures, or spawns.`);
        return false;
    }

    const occupyingUnit = getUnitAtCoordinate(clickedCol, clickedRow);
    if (occupyingUnit) {
        logToConsole(`Failed to deploy: Coordinates [${clickedCol}, ${clickedRow}] are already occupied by another unit.`);
        return false;
    }

    const coinsRefToUse = teamCoinsObj || teamCoinsRef;
    if ((coinsRefToUse[playerTeam] || 0) < 1) {
        logToConsole(`Deployment failed: Insufficient funds for team ${playerTeam}.`);
        pendingUnitType = null;
        return false;
    }

    coinsRefToUse[playerTeam] -= 1;
    if (typeof updateHudCallback === 'function') {
        updateHudCallback();
    }
    logToConsole(`Deducted 1 coin from ${playerTeam}. Remaining balance: ${coinsRefToUse[playerTeam]}`);

    const activeUnits = (Array.isArray(units) && units.length > 0) ? units : latestUnitsRef;
    const typeLower = pendingUnitType.toLowerCase();

    let unitTypeVal = 'land';
    let unitRange = 2;

    if (typeLower === 'ship') {
        unitTypeVal = 'naval';
        unitRange = 2; 
    } else if (typeLower === 'tank') {
        unitTypeVal = 'land';
        unitRange = 3;
    } else if (typeLower === 'infantry') {
        unitTypeVal = 'land';
        unitRange = 2;
    }

    const newUnit = {
        id: 'test_' + Math.random().toString(36).substring(2, 9),
        name: pendingUnitType.charAt(0).toUpperCase() + pendingUnitType.slice(1),
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
        update(ref(db, `matches/${currentMatchId}`), { 
            units: activeUnits,
            coins: coinsRefToUse 
        });
    }

    pendingUnitType = null;
    return true;
}
