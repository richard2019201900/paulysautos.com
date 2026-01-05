// Firebase Configuration for PaulysAutos.com
const firebaseConfig = {
    apiKey: "AIzaSyBplzEAqyKzAVaTYOg5fLohuSZoes274z8",
    authDomain: "paulys-autos-portal.firebaseapp.com",
    projectId: "paulys-autos-portal",
    storageBucket: "paulys-autos-portal.firebasestorage.app",
    messagingSenderId: "189287209218",
    appId: "1:189287209218:web:f820dccf723aaf92e2ca1b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Master Admin Email
const MASTER_ADMIN_EMAIL = 'richard2019201900@gmail.com';

// Tier Configuration
const TIERS = {
    starter: { 
        name: 'Starter', 
        icon: '⭐', 
        maxListings: 3, 
        color: 'gray',
        bgClass: 'tier-starter'
    },
    pro: { 
        name: 'Pro', 
        icon: '💎', 
        maxListings: 10, 
        color: 'blue',
        bgClass: 'tier-pro'
    },
    elite: { 
        name: 'Elite', 
        icon: '👑', 
        maxListings: 25, 
        color: 'purple',
        bgClass: 'tier-elite'
    },
    owner: { 
        name: 'Owner', 
        icon: '🏆', 
        maxListings: Infinity, 
        color: 'gold',
        bgClass: 'tier-owner'
    }
};

// Minimum vehicle price
const MIN_VEHICLE_PRICE = 1000000;

// Premium listing fee (weekly)
const PREMIUM_FEE = 10000;

console.log('[Config] PaulysAutos.com initialized');
