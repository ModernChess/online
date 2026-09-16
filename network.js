// network.js - Firebase Service & Presence Management
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, update, remove, onValue, push, onDisconnect 
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

// --- PRESENCE SYSTEM (Player Online Tracking) ---
export function setupUserPresence(username) {
    if (!username) return;
    const userStatusRef = ref(db, `players/${username}`);

    // Set user online
    set(userStatusRef, {
        online: true,
        lastSeen: Date.now()
    });

    // When the user disconnects (closes tab / loses connection), mark them offline
    onDisconnect(userStatusRef).set({
        online: false,
        lastSeen: Date.now()
    });
}

export function markUserOffline(username) {
    if (!username) return;
    const userStatusRef = ref(db, `players/${username}`);
    set(userStatusRef, {
        online: false,
        lastSeen: Date.now()
    });
}

// Export database functions for use in game.js
export { ref, set, get, update, remove, onValue, push };