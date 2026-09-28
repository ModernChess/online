// ui-auth.js - Handles Authentication, Chat, and Independent Game Presence
import { db, ref, onValue, push } from './network.js';

export let currentUser = localStorage.getItem('arena_chess_user') || null;
export let currentServerId = null;
export let currentMatchId = null;
export let playerTeam = null;
export let isLeavingDeliberately = false;

export function setCurrentUser(val) { currentUser = val; }
export function setCurrentServerId(val) { currentServerId = val; }
export function setCurrentMatchId(val) { currentMatchId = val; }
export function setPlayerTeam(val) { playerTeam = val; }
export function setIsLeavingDeliberately(val) { isLeavingDeliberately = val; }

export function logToConsole(msg) {
    const logs = document.getElementById('console-logs');
    if (!logs) return;
    const time = new Date().toLocaleTimeString();
    logs.innerHTML += `[${time}] ${msg}<br>`;
    logs.scrollTop = logs.scrollHeight;
}

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        logToConsole(`Switched active screen to: ${screenId}`);
    } else {
        console.error(`Target screen not found: ${screenId}`);
    }
}

export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Active players listener rendering descending class & badges accurately
export function listenToActivePlayers() {
    const playersRef = ref(db, 'game_presence');
    onValue(playersRef, (snapshot) => {
        const data = snapshot.val() || {};
        const container = document.getElementById('playersListContainer');
        if (!container) return;
        container.innerHTML = '';

        let onlineCount = 0;
        let htmlContent = '';

        for (let username in data) {
            const info = data[username];
            if (info && info.online === true) {
                onlineCount++;
                const isYou = username === currentUser ? ' (You)' : '';
                const avatar = info.avatar || '😀';
                const faction = info.faction || 'Order';
                const rank = info.rank || 'Grandmarshall (1st Class 🌟🌟🌟)';
                const factionColor = faction === 'Order' ? '#2ecc71' : '#e74c3c';

                htmlContent += `
                    <div class="player-card">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.2rem;">${avatar}</span>
                            <div>
                                <div><strong>${username}</strong>${isYou}</div>
                                <div style="font-size: 0.75rem; color: ${factionColor}; font-weight: 600;">${faction} • ${rank}</div>
                            </div>
                        </div>
                        <div class="player-badge-online"></div>
                    </div>
                `;
            }
        }

        container.innerHTML = onlineCount === 0 ? `<div style="color:var(--text-muted); font-size:0.75rem; text-align:center;">No players online</div>` : htmlContent;
        const onlineCountText = document.getElementById('onlineCountText');
        if (onlineCountText) onlineCountText.innerText = `Active Players (${onlineCount})`;
    });
}

export function sendGlobalMessage() {
    const input = document.getElementById('globalChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !currentUser) return;

    const chatRef = ref(db, 'arena_globalChat');
    push(chatRef, {
        sender: currentUser,
        avatar: localStorage.getItem('arena_chess_avatar') || '😀',
        faction: localStorage.getItem('arena_chess_faction') || 'Order',
        rank: localStorage.getItem('arena_chess_rank') || 'Grandmarshall (1st Class 🌟🌟🌟)',
        message: text,
        timestamp: Date.now()
    });
    input.value = '';
}

export function listenToGlobalChat() {
    const chatRef = ref(db, 'arena_globalChat');
    onValue(chatRef, (snapshot) => {
        const data = snapshot.val() || {};
        const container = document.getElementById('globalChatMessages');
        if (!container) return;
        container.innerHTML = '';

        const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
        const recent = messages.slice(-30);

        recent.forEach(msg => {
            if (!msg || typeof msg.message !== 'string') return;

            const msgAvatar = msg.avatar || '😀';
            const msgFaction = msg.faction || 'Order';
            const msgRank = msg.rank || 'Grandmarshall (1st Class 🌟🌟🌟)';
            const factionTagColor = msgFaction === 'Order' ? '#2ecc71' : '#e74c3c';

            const div = document.createElement('div');
            div.className = 'global-chat-msg';
            // Global chat now broadcasts full descending class tags clearly
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;">
                    <span>${msgAvatar}</span>
                    <span style="color: ${factionTagColor}; font-size: 0.75rem; font-weight: 700;">[${msgFaction} • ${msgRank}]</span>
                    <span style="color: var(--secondary); font-weight: 600;">${msg.sender || 'Unknown'}:</span>
                </div>
                <div style="padding-left: 20px; word-break: break-word;">${escapeHtml(msg.message)}</div>
            `;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}
