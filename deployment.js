// deployment.js - Handles Unit Purchasing, Affordability Checks, and Grid Placement Logic
import { db, ref, update } from './network.js';
import { 
    colLetterToIndex, 
    goldCoreList, 
    goldList, 
    artList, 
    tList, 
    rbList, 
    bbList, 
    navList, 
    bbcList, 
    rbcList 
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
                <div class="buy-unit-item"><span>Mine (1 Coin)</span><button class="btn" data-type="mine">Buy</button></div>
                <div class="buy-unit-item"><span>Plane (1 Coin)</span><button class="btn" data-type="plane">Buy</button></div>
                <div class="buy-unit-item"><span>Engineer (1 Coin)</span><button class="btn" data-type="engineer">Buy</button></div>
                <div class="buy-unit-item"><span>Anti air (1 Coin)</span><button class="btn" data-type="antiair">Buy</button></div>
                <div class="buy-unit-item"><span>Artillery (1 Coin)</span><button class="btn" data-type="artillery">Buy</button></div>
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

            // Affordability check: unit costs 1 coin
            if (currentCoins < 1) {
                logToConsole(`Purchase Declined: Team ${activeTeam} has ${currentCoins} coins. Units cost 1 coin.`);
                alert(`Insufficient funds! You need at least 1 coin to purchase a unit.`);
                return;
            }

            pendingUnitType = unitType;
            modal.style.display = 'none';
            isShopOpen = false;
            
            // Unfreeze main buy button cleanly
            const buyBtn = document.getElementById('buyUnitsBtn');
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.classList.remove('btn-frozen');
            }

            logToConsole(`Purchased ${unitType} for 1 coin. Select a valid captured deployment tile.`);
            
            // Resolve units from callback, synced ref, or window globals
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
    popup.className = 'unit-deployer-popup';

    const allowedTiles = deploymentRules[unitType.toLowerCase()] || new Set();
    const validRowsList = [];
    const targetTeam = playerTeam || currentTeamRef;

    allowedTiles.forEach(coordKey => {
        let [c, r] = coordKey.split(',').map(Number);
        let tileInfo = tileCaptures[coordKey];
        // Fix: Strictly restrict deployment tiles to those captured by the player's team
        if (tileInfo && tileInfo.capturedBy === targetTeam) {
            let occupyingUnit = getUnitAtCoordinate(c, r);
            
            validRowsList.push({ 
                col: c, 
                row: r, 
                typeName: tileInfo.type, 
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
        : `<div class="deployer-tile-row"><span>No captured tiles available for your team!</span></div>`;

    popup.innerHTML = `
        <div class="unit-deployer-header">
            <span class="unit-deployer-title">Deploying: ${unitType.toUpperCase()} (1 Coin)</span>
            <div class="unit-deployer-controls">
                <button class="deployer-ctrl-btn" id="deployerMinimizeBtn">_</button>
                <button class="deployer-ctrl-btn" id="deployerCancelBtn">&times; Cancel</button>
            </div>
        </div>
        <div class="unit-deployer-body" style="max-height: 250px; overflow-y: auto;">
            ${listHtml}
        </div>
    `;
    document.body.appendChild(popup);

    let minimized = false;
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

    const captureInfo = tileCaptures[key];
    if (!captureInfo || captureInfo.capturedBy !== playerTeam) {
        logToConsole(`Failed to deploy: Coordinates [${clickedCol}, ${clickedRow}] are uncaptured or not controlled by team ${playerTeam}.`);
        return false;
    }

    const occupyingUnit = getUnitAtCoordinate(clickedCol, clickedRow);
    if (occupyingUnit) {
        logToConsole(`Failed to deploy: Coordinates [${clickedCol}, ${clickedRow}] are already occupied by another unit.`);
        return false;
    }

    // Double check affordability before confirming deployment
    const coinsRefToUse = teamCoinsObj || teamCoinsRef;
    if ((coinsRefToUse[playerTeam] || 0) < 1) {
        logToConsole(`Deployment failed: Insufficient funds for team ${playerTeam}.`);
        pendingUnitType = null;
        return false;
    }

    // Deduct 1 coin for the purchase
    coinsRefToUse[playerTeam] -= 1;
    if (typeof updateHudCallback === 'function') {
        updateHudCallback();
    }
    logToConsole(`Deducted 1 coin from ${playerTeam}. Remaining balance: ${coinsRefToUse[playerTeam]}`);

    const activeUnits = (Array.isArray(units) && units.length > 0) ? units : latestUnitsRef;
    const typeLower = pendingUnitType.toLowerCase();

    let unitTypeVal = 'land';
    let unitRange = 3;

    if (typeLower === 'ship') {
        unitTypeVal = 'naval';
        unitRange = 2; 
    } else if (typeLower === 'plane') {
        unitTypeVal = 'air';
        unitRange = 4;
    } else if (typeLower === 'tank') {
        unitTypeVal = 'land';
        unitRange = 3;
    } else if (typeLower === 'artillery') {
        unitTypeVal = 'land';
        unitRange = 2;
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
