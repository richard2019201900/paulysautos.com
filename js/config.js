// ==================== FIREBASE CONFIG ====================
// PaulysAutos.com - Elite Luxury Vehicle Marketplace ($1M+)
// Note: Firebase API keys are safe to expose client-side.
// Security is enforced via Firestore Security Rules, not the API key.

const firebaseConfig = {
    apiKey: "AIzaSyBplzEAqyKzAVaTYOg5fLohuSZoes274z8",
    authDomain: "paulys-autos-portal.firebaseapp.com",
    projectId: "paulys-autos-portal",
    storageBucket: "paulys-autos-portal.firebasestorage.app",
    messagingSenderId: "189287209218",
    appId: "1:189287209218:web:f820dccf723aaf92e2ca1b"
};

// Site Configuration
const SITE_NAME = 'PaulysAutos.com';
const SITE_TYPE = 'vehicles'; // 'properties' or 'vehicles'
const MIN_LISTING_PRICE = 1000000; // $1M minimum for elite marketplace
const MASTER_ADMIN_EMAIL = 'pauly@pma.network'; // Site owner/admin

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

// Set auth persistence to LOCAL (persists across browser sessions)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
    })
    .catch((error) => {
        console.error('[Auth] Persistence error:', error);
    });
