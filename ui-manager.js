// ui-manager.js - Facade module maintaining original file name and exports for game-engine and game-sync
import { initLobbyModule } from './ui-lobby.js';

export { 
    currentUser, currentServerId, currentMatchId, playerTeam, isLeavingDeliberately,
    showScreen, logToConsole 
} from './ui-auth.js';

window.addEventListener('DOMContentLoaded', () => {
    initLobbyModule();
});
