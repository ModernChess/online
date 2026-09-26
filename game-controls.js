// game-controls.js - Manages Action Buttons, Turn States, Global Coin HUD with Team-Colored Frames, and Console Logging
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

// Ensures the global coin status indicator widget and custom battle UI styles exist
export function ensureCoinHudBar() {
    if (document.getElementById('coinDisplayBar')) return;
    
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer || !canvasContainer.parentNode) return;

    // Inject custom UI styles matching CSS defaults for battle boxes and team-colored frames
    if (!document.getElementById('customGameUiStyles')) {
        const style = document.createElement('style');
        style.id = 'customGameUiStyles';
        style.innerHTML = `
            .coin-display-bar {
                display: flex;
                justify-content: space-around;
                margin-bottom: 10px;
                gap: 15px;
            }
            .team-coin-widget {
                padding: 8px 16px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            }
            .blue-team-frame {
                background: linear-gradient(135deg, #2980b9, #1abc9c);
                border: 2px solid #5dade2;
                color: #fff;
            }
            .red-team-frame {
                background: linear-gradient(135deg, #c0392b, #e74c3c);
                border: 2px solid #ec7063;
                color: #fff;
            }
            .coin-icon {
                background: #f1c40f;
                color: #2c3e50;
                border-radius: 50%;
                width: 22px;
                height: 22px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 900;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
            }
            .battle-vs-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                padding: 4px;
            }
            .battle-vs-box {
                background: rgba(20, 20, 30, 0.85);
                border: 2px solid #f39c12;
                border-radius: 8px;
                padding: 6px 18px;
                display: flex;
                align-items: center;
                gap: 14px;
                color: #fff;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.4), inset 0 0 10px rgba(243, 156, 18, 0.2);
            }
            .vs-badge {
                background: #e74c3c;
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 900;
                letter-spacing: 1px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .turn-indicator-box {
                padding: 5px 16px;
                border-radius: 6px;
                font-weight: bold;
                color: #fff;
                text-transform: uppercase;
                font-size: 12px;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            }
            .turn-blue-box {
                background: linear-gradient(135deg, #2980b9, #3498db);
                border: 1px solid #85c1e9;
            }
            .turn-red-box {
                background: linear-gradient(135deg, #c0392b, #e74c3c);
                border: 1px solid #f1948a;
            }
        `;
        document.head.appendChild(style);
    }

    const coinBar = document.createElement('div');
    coinBar.id = 'coinDisplayBar';
    coinBar.className = 'coin-display-bar';
    coinBar.innerHTML = `
        <div class="team-coin-widget blue-team-frame">
            <span class="coin-icon">C</span> Blue Coins: <span id="blueCoinCount">0</span>
        </div>
        <div class="team-coin-widget red-team-frame">
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
