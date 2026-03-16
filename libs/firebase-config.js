// Firebase Configuration & Initialization
// Works in both Electron (reads from .env via electronAPI) and Web (uses hardcoded values).

const firebaseConfig = {
    apiKey: (window.electronAPI && window.electronAPI.env.FIREBASE_API_KEY) || "AIzaSyCvR7Tr3hPl9U3Gf9t-a8voMhXyedeZac4",
    authDomain: (window.electronAPI && window.electronAPI.env.FIREBASE_AUTH_DOMAIN) || "mufyard.firebaseapp.com",
    projectId: (window.electronAPI && window.electronAPI.env.FIREBASE_PROJECT_ID) || "mufyard",
    storageBucket: (window.electronAPI && window.electronAPI.env.FIREBASE_STORAGE_BUCKET) || "mufyard.firebasestorage.app",
    messagingSenderId: (window.electronAPI && window.electronAPI.env.FIREBASE_MESSAGING_SENDER_ID) || "725862581824",
    appId: (window.electronAPI && window.electronAPI.env.FIREBASE_APP_ID) || "1:725862581824:web:f462e5d4ed2c39664fc1a5",
    measurementId: (window.electronAPI && window.electronAPI.env.FIREBASE_MEASUREMENT_ID) || "G-XED73YT7T7"
};

let app, db, auth, storage;

function initFirebase() {
    if (typeof firebase !== 'undefined') {
        try {
            app = firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            storage = firebase.storage();

            // Offline persistence (works in Electron; gracefully fails in web with multiple tabs)
            db.enablePersistence()
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Firebase: Multiple tabs open, persistence disabled.');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Firebase: Browser does not support persistence.');
                    }
                });

            console.log('Firebase: Successfully connected to "mufyard"');

            // Initialize Sync Manager
            if (typeof SyncManager !== 'undefined') {
                SyncManager.init();
            }
        } catch (e) {
            console.error('Firebase: Initialization failed:', e);
        }
    } else {
        console.error('Firebase: SDK not found. Check internet connection or SDK links.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebase);
} else {
    initFirebase();
}
