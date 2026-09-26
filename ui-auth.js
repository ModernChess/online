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

// Independent active players listener using 'game_presence'
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
                htmlContent += `
                    <div class="player-card">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.1rem;">${avatar}</span>
                            <span>${username}${isYou}</span>
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
            const div = document.createElement('div');
            div.className = 'global-chat-msg';
            div.innerHTML = `<span style="margin-right: 4px;">${msgAvatar}</span><strong>${msg.sender || 'Unknown'}:</strong> ${escapeHtml(msg.message)}`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}
