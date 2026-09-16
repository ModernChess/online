// ui-lobby.js - Handles Lobby, Matchmaking, and Server Management
import { db, ref, set, get, update, remove, onValue, push, setupUserPresence, markUserOffline } from './network.js';
import { startGameSession } from './game-engine.js';
import { spawnTeamUnits } from './game-config.js';
import { 
    currentUser, currentServerId, currentMatchId, playerTeam, isLeavingDeliberately,
    setCurrentUser, setCurrentServerId, setCurrentMatchId, setPlayerTeam, setIsLeavingDeliberately,
    logToConsole, showScreen, listenToActivePlayers, listenToGlobalChat, sendGlobalMessage 
} from './ui-auth.js';

const validAccounts = {
    "player1": "123", "player2": "123", "player3": "123", "player4": "123",
    "player5": "123", "player6": "123", "player7": "123", "player8": "123",
    "player9": "123", "player10": "123"
};

export function initLobbyModule() {
    initEventListeners();
    checkCachedSession();
    listenToActivePlayers();
    listenToGlobalChat();

    const clearConsoleBtn = document.getElementById('clearConsole');
    if (clearConsoleBtn) {
        clearConsoleBtn.addEventListener('click', () => {
            const logs = document.getElementById('console-logs');
            if (logs) logs.innerHTML = '';
        });
    }

    window.addEventListener('beforeunload', () => {
        if (currentUser && currentMatchId && !isLeavingDeliberately) {
            const afkField = playerTeam === 'blue' ? 'blueAfk' : 'redAfk';
            try {
                update(ref(db, `matches/${currentMatchId}`), { [afkField]: true });
            } catch (err) {
                console.error("Failed to update AFK status on unload:", err);
            }
        }
    });
}

function checkCachedSession() {
    const savedUser = localStorage.getItem('chess_current_user');
    if (savedUser && validAccounts[savedUser]) {
        setCurrentUser(savedUser);
        logToConsole(`Auto-logged in via cache as: ${savedUser}`);
        setupUserPresence(savedUser);
        showScreen('lobby-screen');
        const welcomeUser = document.getElementById('welcomeUser');
        if (welcomeUser) welcomeUser.innerText = `Logged in as: ${savedUser}`;
        loadServerList();
        checkForActiveMatchOnLogin();
    } else {
        logToConsole("No active session in cache. Showing login screen.");
        showScreen('login-screen');
    }
}

function initEventListeners() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const u = document.getElementById('userInput').value.trim();
            const p = document.getElementById('passInput').value.trim();
            const err = document.getElementById('loginError');

            if (!validAccounts[u] || validAccounts[u] !== p) {
                if (err) err.innerText = "Invalid username or password!";
                logToConsole(`Login failed for username: ${u}`);
                return;
            }
            if (err) err.innerText = "";
            setCurrentUser(u);

            localStorage.setItem('chess_current_user', u);
            setupUserPresence(u);

            showScreen('lobby-screen');
            const welcomeUser = document.getElementById('welcomeUser');
            if (welcomeUser) welcomeUser.innerText = `Logged in as: ${u}`;
            loadServerList();
            checkForActiveMatchOnLogin();
            logToConsole(`User ${u} logged in successfully.`);
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            markUserOffline(currentUser);
            localStorage.removeItem('chess_current_user');
            logToConsole(`User ${currentUser} logged out.`);
            setCurrentUser(null);
            showScreen('login-screen');
        });
    }

    const createServerBtn = document.getElementById('createServerBtn');
    if (createServerBtn) createServerBtn.addEventListener('click', createNewServer);

    const cancelRoomBtn = document.getElementById('cancelRoomBtn');
    if (cancelRoomBtn) {
        cancelRoomBtn.addEventListener('click', () => {
            if (currentServerId) {
                remove(ref(db, `servers/${currentServerId}`));
                setCurrentServerId(null);
            }
            showScreen('lobby-screen');
            logToConsole("Server creation canceled. Returned to lobby.");
        });
    }

    const globalChatSend = document.getElementById('globalChatSend');
    if (globalChatSend) globalChatSend.addEventListener('click', sendGlobalMessage);
    
    const globalChatInput = document.getElementById('globalChatInput');
    if (globalChatInput) {
        globalChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendGlobalMessage();
        });
    }

    const surrenderBtn = document.getElementById('surrenderBtn');
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to surrender and leave the match?")) {
                setIsLeavingDeliberately(true);
                leaveMatchCompletely();
            }
        });
    }

    const adminClearBtn = document.getElementById('adminClearBtn');
    if (adminClearBtn) {
        adminClearBtn.addEventListener('click', () => {
            if (confirm("Admin: Clear all active servers and matches?")) {
                remove(ref(db, 'servers'));
                remove(ref(db, 'matches'));
                logToConsole("Admin cleared all servers and matches.");
            }
        });
    }
}

function checkForActiveMatchOnLogin() {
    const matchesRef = ref(db, 'matches');
    get(matchesRef).then((snapshot) => {
        const matches = snapshot.val() || {};
        for (let mId in matches) {
            const match = matches[mId];
            if (match.status === 'active') {
                if (match.blueUser === currentUser || match.redUser === currentUser) {
                    showRejoinPopup(mId, match);
                    break;
                }
            }
        }
    });
}

function showRejoinPopup(mId, match) {
    const existing = document.getElementById('rejoinPopupModal');
    if (existing) existing.remove();

    const isBlue = match.blueUser === currentUser;
    const opponentName = isBlue ? match.redUser : match.blueUser;

    const modal = document.createElement('div');
    modal.id = 'rejoinPopupModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    modal.innerHTML = `
        <div style="background: #1e1e1e; padding: 25px; border-radius: 8px; text-align: center; max-width: 400px; width: 90%; border: 1px solid #333; color: #fff;">
            <h3 style="margin-top: 0; color: #f1c40f;">Active Match Found!</h3>
            <p style="color: #ccc; font-size: 0.9rem;">You were previously in a match against <strong>${opponentName}</strong>. Would you like to rejoin or reject it?</p>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                <button id="acceptRejoinBtn" class="btn btn-primary" style="background-color: #27ae60; flex: 1;">Rejoin Match</button>
                <button id="rejectRejoinBtn" class="btn btn-secondary" style="background-color: #c0392b; flex: 1;">Reject & Terminate</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('acceptRejoinBtn').onclick = () => {
        modal.remove();
        setCurrentMatchId(mId);
        setPlayerTeam(isBlue ? 'blue' : 'red');

        const afkField = isBlue ? 'blueAfk' : 'redAfk';
        update(ref(db, `matches/${mId}`), { [afkField]: false });

        findServerIdForMatch(mId, () => {
            startGameSession(mId, isBlue ? 'blue' : 'red', currentUser, () => {
                setIsLeavingDeliberately(true);
                leaveMatchCompletely();
            });
        });
    };

    document.getElementById('rejectRejoinBtn').onclick = () => {
        modal.remove();
        update(ref(db, `matches/${mId}`), { status: 'ended', winner: isBlue ? 'red' : 'blue' });
        loadServerList();
        logToConsole("Rejected and terminated active match.");
    };
}

function findServerIdForMatch(mId, callback) {
    const serversRef = ref(db, 'servers');
    get(serversRef).then((snapshot) => {
        const servers = snapshot.val() || {};
        for (let sId in servers) {
            if (servers[sId].matchId === mId) {
                setCurrentServerId(sId);
                break;
            }
        }
        if (callback) callback();
    });
}

function createNewServer() {
    if (!currentUser) return;
    setIsLeavingDeliberately(false);
    const serversRef = ref(db, 'servers');
    const newServerRef = push(serversRef);
    setCurrentServerId(newServerRef.key);

    set(newServerRef, {
        host: currentUser,
        guest: null,
        status: 'waiting',
        createdAt: Date.now()
    });

    logToConsole(`Created server ID: ${currentServerId} by host ${currentUser}`);
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    if (roomCodeDisplay) roomCodeDisplay.innerText = `Server ID: ${currentServerId}`;
    showScreen('wait-screen');

    onValue(newServerRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        if (data.status === 'playing' && data.matchId) {
            setCurrentMatchId(data.matchId);
            setPlayerTeam('blue');
            startGameSession(data.matchId, 'blue', currentUser, () => {
                setIsLeavingDeliberately(true);
                leaveMatchCompletely();
            });
        }
    });
}

function loadServerList() {
    const serversRef = ref(db, 'servers');
    onValue(serversRef, (snapshot) => {
        const data = snapshot.val() || {};
        const listEl = document.getElementById('serverList');
        if (!listEl) return;
        listEl.innerHTML = '';

        let totalServersCount = 0;
        for (let sId in data) {
            const server = data[sId];
            totalServersCount++;
            const item = document.createElement('div');
            item.className = 'server-item';

            if (server.status === 'waiting') {
                item.innerHTML = `
                    <span>Host: <strong>${server.host}</strong> (Waiting for opponent)</span>
                    <button class="btn btn-secondary" onclick="window.joinServer('${sId}')">Join Match</button>
                `;
            } else if (server.status === 'playing') {
                item.innerHTML = `
                    <span>Server [${server.host} vs ${server.guest}]: <strong style="color: #e74c3c;">Match Ongoing</strong></span>
                    <button class="btn btn-secondary" disabled style="opacity: 0.6; cursor: not-allowed;">In Progress</button>
                `;
            }
            listEl.appendChild(item);
        }

        if (totalServersCount === 0) {
            listEl.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; margin-top:20px;">No servers active. Create one!</div>`;
        }
    });
}

window.joinServer = function(sId) {
    if (!currentUser) return;
    setIsLeavingDeliberately(false);
    setCurrentServerId(sId);
    const serverRef = ref(db, `servers/${sId}`);

    get(serverRef).then((snapshot) => {
        const server = snapshot.val();
        if (!server || server.status !== 'waiting') {
            alert("This server is no longer available.");
            return;
        }

        const matchesRef = ref(db, 'matches');
        const newMatchRef = push(matchesRef);
        const mId = newMatchRef.key;
        setCurrentMatchId(mId);

        let initialUnits = [];
        spawnTeamUnits('blue', initialUnits);
        spawnTeamUnits('red', initialUnits);

        set(newMatchRef, {
            blueUser: server.host,
            redUser: currentUser,
            turn: 'blue',
            status: 'active',
            units: initialUnits,
            blueAfk: false,
            redAfk: false
        });

        update(serverRef, {
            guest: currentUser,
            status: 'playing',
            matchId: mId
        });

        setPlayerTeam('red');
        logToConsole(`Joined server ${sId}. Match ID: ${mId}`);
        startGameSession(mId, 'red', currentUser, () => {
            setIsLeavingDeliberately(true);
            leaveMatchCompletely();
        });
    });
};

function leaveMatchCompletely() {
    if (currentMatchId) {
        update(ref(db, `matches/${currentMatchId}`), { status: 'ended', winner: playerTeam === 'blue' ? 'red' : 'blue' });
    }
    if (currentServerId) {
        remove(ref(db, `servers/${currentServerId}`));
    }
    setCurrentMatchId(null);
    setCurrentServerId(null);
    showScreen('lobby-screen');
    loadServerList();
    logToConsole("Left match and terminated completely.");
}
