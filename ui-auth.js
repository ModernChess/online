// ui-auth.js - Handles Authentication, Chat, and Presence features
import { db, ref, onValue, push } from './network.js';

export let currentUser = null;
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
    if (target) target.classList.add('active');
    logToConsole(`Switched active screen to: ${screenId}`);
}

export function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function listenToActivePlayers() {
    const playersRef = ref(db, 'players');
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
                htmlContent += `
                    <div class="player-card">
                        <span>${username}${isYou}</span>
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

    const chatRef = ref(db, 'globalChat');
    push(chatRef, {
        sender: currentUser,
        text: text,
        timestamp: Date.now()
    });
    input.value = '';
}

export function listenToGlobalChat() {
    const chatRef = ref(db, 'globalChat');
    onValue(chatRef, (snapshot) => {
        const data = snapshot.val() || {};
        const container = document.getElementById('globalChatMessages');
        if (!container) return;
        container.innerHTML = '';

        const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
        const recent = messages.slice(-30);

        recent.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'global-chat-msg';
            div.innerHTML = `<strong>${msg.sender}:</strong> ${escapeHtml(msg.text)}`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}
