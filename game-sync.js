// game-sync.js - Updated to pass the full match object for tile capture synchronization
import { db, ref, update, onValue, push } from './network.js';
import { showScreen } from './ui-manager.js';

let matchEndTimeout = null;

export function listenToMatchUpdates(currentMatchId, playerTeam, unitsRef, logToConsole, onMatchEnded, onTurnChanged) {
    if (!currentMatchId) return;
    const matchRef = ref(db, `matches/${currentMatchId}`);
    
    onValue(matchRef, (snapshot) => {
        const match = snapshot.val();
        if (!match) return;
        
        if (match.turn && onTurnChanged) {
            // Pass the entire match object as the second argument so tileCaptures can be synced
            onTurnChanged(match.turn, match);
        }
        
        if (match.units) {
            const incomingMap = new Map();
            match.units.forEach(u => incomingMap.set(u.id, u));

            for (let i = unitsRef.length - 1; i >= 0; i--) {
                let localUnit = unitsRef[i];
                if (incomingMap.has(localUnit.id)) {
                    let incoming = incomingMap.get(localUnit.id);
                    localUnit.gridX = incoming.gridX;
                    localUnit.gridY = incoming.gridY;
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
                    lastKnownGridY: newUnit.gridY
                });
            });
        }
        
        let opponentName = playerTeam === 'blue' ? (match.redUser || 'Opponent') : (match.blueUser || 'Opponent');
        let opponentIsAfk = playerTeam === 'blue' ? match.redAfk : match.blueAfk;

        const banner = document.getElementById('statusBanner');
        if (match.status === 'ended') {
            banner.innerText = `Match Ended! Winner: ${match.winner ? match.winner.toUpperCase() : 'Draw'}`;
            logToConsole(`Match ended. Winner: ${match.winner}. Returning to lobby in 4 seconds...`);
            
            if (!matchEndTimeout) {
                matchEndTimeout = setTimeout(() => {
                    if (onMatchEnded) onMatchEnded();
                    showScreen('lobby-screen');
                }, 4000);
            }
        } else {
            const isMyTurn = match.turn === playerTeam;
            let statusText = `VS ${opponentName} | Turn: ${match.turn.toUpperCase()} (${isMyTurn ? 'Your Turn' : `${opponentName}'s Turn`})`;
            if (opponentIsAfk) {
                statusText += ` | [${opponentName} has gone AFK. They can rejoin once they get into the app again!]`;
            }
            banner.innerText = statusText;
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
