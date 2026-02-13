// Firebase Configuration & Initialization
// Managed by Antigravity - Linked to the 'mufyard' project.

const firebaseConfig = {
    apiKey: typeof process !== 'undefined' && process.env.FIREBASE_API_KEY || "",
    authDomain: typeof process !== 'undefined' && process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: typeof process !== 'undefined' && process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: typeof process !== 'undefined' && process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: typeof process !== 'undefined' && process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: typeof process !== 'undefined' && process.env.FIREBASE_APP_ID || "",
    measurementId: typeof process !== 'undefined' && process.env.FIREBASE_MEASUREMENT_ID || ""
};

let app, db, auth, storage;

function initFirebase() {
    if (typeof firebase !== 'undefined') {
        try {
            // Initialize Firebase
            app = firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            storage = firebase.storage();

            // Enable Offline Persistence for a better Desktop experience
            db.enablePersistence()
                .catch((err) => {
                    if (err.code == 'failed-precondition') {
                        console.warn('Firebase Sync: Multiple tabs open, persistence disabled.');
                    } else if (err.code == 'unimplemented') {
                        console.warn('Firebase Sync: Browser does not support persistence.');
                    }
                });

            console.log('Firebase: Successfully connected to "mufyard"');
        } catch (e) {
            console.error('Firebase: Initialization failed:', e);
        }
    } else {
        console.error('Firebase: SDK not found. Check internet connection or SDK links.');
    }
}

// Ensure initialization after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebase);
} else {
    initFirebase();
}
