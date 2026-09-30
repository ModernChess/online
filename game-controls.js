// game-controls.js - Manages Action Buttons, Turn States, Global Coin HUD, Live Timer, and Sleek Turn Status Banner
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

// Ensures the sleek top HUD bar (Coins, Turn Status, and Live Timer) exists
export function ensureCoinHudBar() {
    if (document.getElementById('coinDisplayBar')) return;
    
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer || !canvasContainer.parentNode) return;

    if (!document.getElementById('customGameUiStyles')) {
        const style = document.createElement('style');
        style.id = 'customGameUiStyles';
        style.innerHTML = `
            .game-top-hud {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 12px;
                width: 100%;
            }
            .hud-main-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            }
            .team-coin-widget {
                padding: 6px 12px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 3px 5px rgba(0,0,0,0.2);
                flex: 1;
                justify-content: center;
            }
            .blue-team-frame {
                background: linear-gradient(135deg, #2980b9, #1abc9c);
                border: 1px solid #5dade2;
                color: #fff;
            }
            .red-team-frame {
                background: linear-gradient(135deg, #c0392b, #e74c3c);
                border: 1px solid #ec7063;
                color: #fff;
            }
            .turn-timer-widget {
                background: rgba(20, 20, 30, 0.95);
                border: 2px solid #f39c12;
                color: #f1c40f;
                padding: 6px 14px;
                border-radius: 6px;
                font-weight: 900;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            }
            .turn-status-banner {
                padding: 10px 16px;
                border-radius: 8px;
                font-weight: bold;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                transition: all 0.3s ease;
            }
            .turn-status-blue {
                background: linear-gradient(135deg, rgba(41, 128, 185, 0.85), rgba(52, 152, 219, 0.95));
                border: 2px solid #85c1e9;
                color: #fff;
            }
            .turn-status-red {
                background: linear-gradient(135deg, rgba(192, 57, 43, 0.85), rgba(231, 76, 60, 0.95));
                border: 2px solid #f1948a;
                color: #fff;
            }
            .coin-icon {
                background: #f1c40f;
                color: #2c3e50;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 900;
                box-shadow: inset 0 2px 3px rgba(0,0,0,0.2);
            }
            .turn-player-highlight {
                font-weight: 900;
                background: rgba(0, 0, 0, 0.25);
                padding: 2px 8px;
                border-radius: 4px;
                letter-spacing: 1px;
            }
        `;
        document.head.appendChild(style);
    }

    const hudContainer = document.createElement('div');
    hudContainer.id = 'coinDisplayBar';
    hudContainer.className = 'game-top-hud';
    hudContainer.innerHTML = `
        <div id="turnStatusBanner" class="turn-status-banner turn-status-blue">
            <span>⚔️ Turn:</span> 
            <span id="turnTeamText">BLUE</span> 
            <span id="turnPlayerText" class="turn-player-highlight">(Player's Turn)</span>
        </div>
        <div class="hud-main-row">
            <div class="team-coin-widget blue-team-frame">
                <span class="coin-icon">C</span> Blue: <span id="blueCoinCount">0</span>
            </div>
            <div class="turn-timer-widget">
                ⏳ <span id="turnTimerClock">30s</span>
            </div>
            <div class="team-coin-widget red-team-frame">
                <span class="coin-icon">C</span> Red: <span id="redCoinCount">0</span>
            </div>
        </div>
    `;
    canvasContainer.parentNode.insertBefore(hudContainer, canvasContainer);
}

export function updateCoinHud(teamCoins) {
    ensureCoinHudBar();
    if (!teamCoins) return;
    
    const blueElem = document.getElementById('blueCoinCount');
    const redElem = document.getElementById('redCoinCount');
    
    if (blueElem) blueElem.innerText = teamCoins.blue ?? 0;
    if (redElem) redElem.innerText = teamCoins.red ?? 0;
}

export const updateGlobalCoinHUD = updateCoinHud;

// Sleek updater for the prominent turn banner
export function updateTurnStatusBanner(currentTurn, playerName = '') {
    ensureCoinHudBar();
    const banner = document.getElementById('turnStatusBanner');
    const teamText = document.getElementById('turnTeamText');
    const playerText = document.getElementById('turnPlayerText');

    if (!banner || !teamText || !playerText) return;

    const lowerTurn = (currentTurn || 'blue').toLowerCase();
    
    if (lowerTurn === 'blue') {
        banner.className = 'turn-status-banner turn-status-blue';
        teamText.innerText = 'BLUE';
    } else {
        banner.className = 'turn-status-banner turn-status-red';
        teamText.innerText = 'RED';
    }

    playerText.innerText = playerName ? `(${playerName}'s Turn)` : `(${lowerTurn.toUpperCase()}'s Turn)`;
}

export function updateTurnTimerDisplay(secondsLeft) {
    ensureCoinHudBar();
    const timerElem = document.getElementById('turnTimerClock');
    if (timerElem) {
        timerElem.innerText = `${Math.max(0, secondsLeft)}s`;
        timerElem.style.color = secondsLeft <= 5 ? '#ff6b6b' : '#f1c40f';
    }
}

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
