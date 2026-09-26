// network.js - Firebase Service & Presence Management (Independent Game Node)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, update, remove, onValue, push, onDisconnect, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCR7AEYbqh3hVytxaB05ra50ZLlpsys9EM",
  authDomain: "mchess12333.firebaseapp.com",
  databaseURL: "https://mchess12333-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mchess12333",
  storageBucket: "mchess12333.firebasestorage.app",
  messagingSenderId: "504208198180",
  appId: "1:504208198180:web:adced13b2cd0c0b6c166b1"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// --- INDEPENDENT GAME PRESENCE SYSTEM ---
export function setupUserPresence(username) {
    if (!username) return;
    const userStatusRef = ref(db, `game_presence/${username}`);
    const currentAvatar = localStorage.getItem('arena_chess_avatar') || '😀';

    set(userStatusRef, {
        online: true,
        avatar: currentAvatar,
        lastSeen: serverTimestamp()
    });

    onDisconnect(userStatusRef).update({
        online: false,
        lastSeen: serverTimestamp()
    });
}

export function markUserOffline(username) {
    if (!username) return;
    const userStatusRef = ref(db, `game_presence/${username}`);
    update(userStatusRef, {
        online: false,
        lastSeen: serverTimestamp()
    });
}

export { ref, set, get, update, remove, onValue, push, onDisconnect, serverTimestamp };
