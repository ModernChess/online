// game-sync.js - Safe synchronization preventing reload exploits while honoring server turn changes
import { db, ref, update, onValue, push } from './network.js';
import { showScreen } from './ui-manager.js';
import { triggerMoveSound } from './sound.js';

let matchEndTimeout = null;
let lastProcessedActionTime = 0;
let lastServerTurn = null;
let isInitialSync = true; // Tracks the first snapshot after connecting/reloading

export function listenToMatchUpdates(currentMatchId, playerTeam, unitsRef, logToConsole, onMatchEnded, onTurnChanged, tileCapturesRef = null) {
    if (!currentMatchId) return;
    const matchRef = ref(db, `matches/${currentMatchId}`);
    
    onValue(matchRef, (snapshot) => {
        const match = snapshot.val();
        if (!match) return;
        
        const isMyTurn = match.turn === playerTeam;
        
        // Only trigger a true turn change if it's NOT the initial connection/reload sync
        const serverTurnChanged = !isInitialSync && match.turn && match.turn !== lastServerTurn;
        
        if (match.turn) {
            lastServerTurn = match.turn;
        }

        if (match.turn && onTurnChanged) {
            onTurnChanged(match.turn, match);
        }
        
        if (match.lastAction && match.lastAction.timestamp > lastProcessedActionTime) {
            lastProcessedActionTime = match.lastAction.timestamp;
            if (match.lastAction.team !== playerTeam) {
                if (match.lastAction.type === 'MOVE') {
                    triggerMoveSound(match.lastAction.unitName);
                }
            }
        }
        
        // Synchronize tile captures and handle remote updates securely
        if (match.tileCaptures && tileCapturesRef) {
            Object.keys(match.tileCaptures).forEach(key => {
                let remoteTile = match.tileCaptures[key];
                if (tileCapturesRef[key]) {
                    let oldOwner = tileCapturesRef[key].capturedBy;
                    let newOwner = (remoteTile && remoteTile.capturedBy != null) ? remoteTile.capturedBy : null;
                    
                    // Update ownership value locally so renderer detects the shift and handles animations cleanly
                    tileCapturesRef[key].capturedBy = newOwner;
                } else if (remoteTile) {
                    tileCapturesRef[key] = {
                        type: remoteTile.type || 'unknown',
                        capturedBy: (remoteTile.capturedBy != null) ? remoteTile.capturedBy : null
                    };
                }
            });
        }

        if (match.units) {
            const incomingMap = new Map();
            match.units.forEach(u => incomingMap.set(u.id, u));

            for (let i = unitsRef.length - 1; i >= 0; i--) {
                let localUnit = unitsRef[i];
                if (incomingMap.has(localUnit.id)) {
                    let incoming = incomingMap.get(localUnit.id);
                    
                    if (localUnit.gridX !== incoming.gridX || localUnit.gridY !== incoming.gridY) {
                        localUnit.animFromX = localUnit.gridX;
                        localUnit.animFromY = localUnit.gridY;
                        localUnit.animStartTime = performance.now();
                    }
                    
                    localUnit.gridX = incoming.gridX;
                    localUnit.gridY = incoming.gridY;
                    localUnit.lastKnownGridX = incoming.gridX;
                    localUnit.lastKnownGridY = incoming.gridY;
                    
                    if (isInitialSync) {
                        localUnit.hasMovedThisTurn = !!incoming.hasMovedThisTurn;
                    } else if (serverTurnChanged && isMyTurn && localUnit.team === playerTeam) {
                        localUnit.hasMovedThisTurn = false;
                    } else {
                        localUnit.hasMovedThisTurn = !!incoming.hasMovedThisTurn;
                    }
                    
                    incomingMap.delete(localUnit.id);
                } else {
                    unitsRef.splice(i, 1);
                }
            }

            incomingMap.forEach(newUnit => {
                unitsRef.push({
                    ...newUnit,
                    animFromX: newUnit.gridX,
                    animFromY: newUnit.gridY,
                    animStartTime: 0,
                    lastKnownGridX: newUnit.gridX,
                    lastKnownGridY: newUnit.gridY,
                    hasMovedThisTurn: isInitialSync ? !!newUnit.hasMovedThisTurn : ((serverTurnChanged && isMyTurn && newUnit.team === playerTeam) ? false : !!newUnit.hasMovedThisTurn)
                });
            });
        }
        
        // Initial sync handshake is complete after processing the first snapshot
        isInitialSync = false;
        
        let myUserName = playerTeam === 'blue' ? (match.blueUser || 'Blue Player') : (match.redUser || 'Red Player');
        let opponentName = playerTeam === 'blue' ? (match.redUser || 'Opponent') : (match.blueUser || 'Opponent');
        let opponentIsAfk = playerTeam === 'blue' ? match.redAfk : match.redAfk;

        const banner = document.getElementById('statusBanner');
        if (match.status === 'ended') {
            banner.innerHTML = `<div style="background: #2c3e50; color: #f1c40f; padding: 10px; border-radius: 8px; font-weight: bold; text-align: center;">Match Ended! Winner: ${match.winner ? match.winner.toUpperCase() : 'Draw'}</div>`;
            logToConsole(`Match ended. Winner: ${match.winner}. Returning to lobby in 4 seconds...`);
            
            if (!matchEndTimeout) {
                matchEndTimeout = setTimeout(() => {
                    if (onMatchEnded) onMatchEnded();
                    showScreen('lobby-screen');
                }, 4000);
            }
        } else {
            let turnColorClass = match.turn === 'blue' ? 'turn-blue-box' : 'turn-red-box';
            let turnDisplayText = `${match.turn.toUpperCase()} (${isMyTurn ? 'Your Turn' : `${opponentName}'s Turn`})`;
            
            let bannerHTML = `
                <div class="battle-vs-container">
                    <div class="battle-vs-box">
                        <span>${myUserName}</span>
                        <span class="vs-badge">VS</span>
                        <span>${opponentName}</span>
                    </div>
                    <div class="turn-indicator-box ${turnColorClass}">
                        Turn: ${turnDisplayText}
                    </div>
                </div>
            `;
            if (opponentIsAfk) {
                bannerHTML += `<div style="color: #e74c3c; font-weight: bold; margin-top: 4px; font-size: 11px;">[${opponentName} has gone AFK. They can rejoin once they get into the app again!]</div>`;
            }
            banner.innerHTML = bannerHTML;
        }
    });
}

export function listenToMatchChat(currentMatchId, currentUser) {
    if (!currentMatchId) return;
    const chatRef = ref(db, `matches/${currentMatchId}/chat`);
    
    const sendBtn = document.getElementById('chatSend');
    const inputEl = document.getElementById('chatInput');
    
    if (sendBtn && inputEl) {
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

        newSendBtn.addEventListener('click', () => {
            const text = inputEl.value.trim();
            if (!text) return;
            push(chatRef, { sender: currentUser, text: text, timestamp: Date.now() });
            inputEl.value = '';
        });
    }

    onValue(chatRef, (snapshot) => {
        const data = snapshot.val() || {};
        const container = document.getElementById('chatMessages');
        if (!container) return;
        container.innerHTML = '';
        Object.values(data).forEach(msg => {
            const div = document.createElement('div');
            div.className = 'chat-msg';
            div.innerHTML = `<strong>${msg.sender}:</strong> ${escapeHtml(msg.text)}`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
