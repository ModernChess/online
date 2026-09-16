// game-controls.js - Manages Action Buttons, Turn States, Global Coin HUD, and Console Logging
import { db, ref, update } from './network.js';
import { clearUnitRangeOverlayButton } from './unit-movement.js';

export function createConsoleLogger() {
    return function logToConsole(msg) {
        const logs = document.getElementById('console-logs');
        if (!logs) return;
        const time = new Date().toLocaleTimeString();
        logs.innerHTML += `[${time}] ${msg}<br>`;
        logs.scrollTop = logs.scrollHeight;
    };
}

export function updateTurnButtonState(currentTurn, playerTeam) {
    const changeTurnBtn = document.getElementById('changeTurnBtn');
    if (changeTurnBtn) {
        const isMyTurn = (currentTurn === playerTeam);
        changeTurnBtn.disabled = !isMyTurn;
        changeTurnBtn.style.opacity = isMyTurn ? '1' : '0.5';
        changeTurnBtn.style.cursor = isMyTurn ? 'pointer' : 'not-allowed';
    }
}

// Ensures the global coin status indicator widget exists at the top of the game board / shop area
export function ensureCoinHudBar() {
    if (document.getElementById('coinDisplayBar')) return;
    
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer || !canvasContainer.parentNode) return;

    const coinBar = document.createElement('div');
    coinBar.id = 'coinDisplayBar';
    coinBar.className = 'coin-display-bar';
    coinBar.innerHTML = `
        <div class="team-coin-widget blue-team-coins">
            <span class="coin-icon">C</span> Blue Coins: <span id="blueCoinCount">0</span>
        </div>
        <div class="team-coin-widget red-team-coins">
            <span class="coin-icon">C</span> Red Coins: <span id="redCoinCount">0</span>
        </div>
    `;
    canvasContainer.parentNode.insertBefore(coinBar, canvasContainer);
}

// Updates live coin balances for both teams from Firebase synchronization
export function updateCoinHud(teamCoins) {
    ensureCoinHudBar();
    if (!teamCoins) return;
    
    const blueElem = document.getElementById('blueCoinCount');
    const redElem = document.getElementById('redCoinCount');
    
    if (blueElem) blueElem.innerText = teamCoins.blue ?? 0;
    if (redElem) redElem.innerText = teamCoins.red ?? 0;
}

// Export alias to match game-engine.js import expectation
export const updateGlobalCoinHUD = updateCoinHud;

export function ensureGameActionButtons(matchIdRef, teamRef, turnRef, movedUnitsThisTurn, animRef, onLeaveCallback, logToConsole, updateTurnStateCallback) {
    ensureCoinHudBar();

    const surrenderBtn = document.getElementById('surrenderBtn');
    if (surrenderBtn) {
        if (!document.getElementById('afkBtn')) {
            const afkBtn = document.createElement('button');
            afkBtn.id = 'afkBtn';
            afkBtn.className = 'btn btn-secondary';
            afkBtn.style.backgroundColor = '#f39c12';
            afkBtn.style.color = '#fff';
            afkBtn.style.marginLeft = '10px';
            afkBtn.innerText = 'Go AFK';
            afkBtn.onclick = () => {
                if (matchIdRef.current) {
                    const afkField = teamRef.current === 'blue' ? 'blueAfk' : 'redAfk';
                    update(ref(db, `matches/${matchIdRef.current}`), { [afkField]: true });
                }
                if (animRef.current) cancelAnimationFrame(animRef.current);
                matchIdRef.current = null;
                clearUnitRangeOverlayButton();
                if (onLeaveCallback) onLeaveCallback();
                logToConsole("Marked as AFK and returned to lobby.");
            };
            surrenderBtn.parentNode.insertBefore(afkBtn, surrenderBtn.nextSibling);
        }

        if (!document.getElementById('changeTurnBtn')) {
            const changeTurnBtn = document.createElement('button');
            changeTurnBtn.id = 'changeTurnBtn';
            changeTurnBtn.className = 'btn btn-secondary';
            changeTurnBtn.style.backgroundColor = '#9b59b6';
            changeTurnBtn.style.color = '#fff';
            changeTurnBtn.style.marginLeft = '10px';
            changeTurnBtn.innerText = 'Change Turn';
            changeTurnBtn.onclick = () => {
                if (turnRef.current !== teamRef.current) {
                    logToConsole("Action blocked: Not your turn!");
                    return;
                }
                logToConsole("Manual turn change triggered via Change Turn button.");
                movedUnitsThisTurn.clear();
                let nextTurn = teamRef.current === 'blue' ? 'red' : 'blue';
                turnRef.current = nextTurn;
                updateTurnStateCallback();

                if (matchIdRef.current) {
                    update(ref(db, `matches/${matchIdRef.current}`), { turn: nextTurn });
                }
            };
            surrenderBtn.parentNode.insertBefore(changeTurnBtn, document.getElementById('afkBtn').nextSibling);
        }

        if (!document.getElementById('buyUnitsBtn')) {
            const buyUnitsBtn = document.createElement('button');
            buyUnitsBtn.id = 'buyUnitsBtn';
            buyUnitsBtn.className = 'btn btn-secondary';
            buyUnitsBtn.style.backgroundColor = '#e67e22';
            buyUnitsBtn.style.color = '#fff';
            buyUnitsBtn.style.marginLeft = '10px';
            buyUnitsBtn.innerText = 'Buy Units';
            
            buyUnitsBtn.onclick = () => {
                const modal = document.getElementById('buyUnitsModal');
                if (modal) {
                    buyUnitsBtn.disabled = true;
                    buyUnitsBtn.classList.add('btn-frozen');
                    modal.style.display = 'flex';
                }
            };
            surrenderBtn.parentNode.insertBefore(buyUnitsBtn, document.getElementById('changeTurnBtn').nextSibling);
        }
    }
}
