// =====================================================
// firebase-config.js
// =====================================================

// ⚠️ استبدل هذه القيم بمفاتيح مشروعك الفعلية من Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyD528qS0sFVsIIX4wRFZtWQwCkkiV7M-YY",
    authDomain: "vision-aa7a0.firebaseapp.com",
    databaseURL: "https://vision-aa7a0-default-rtdb.firebaseio.com",
    projectId: "vision-aa7a0",
    storageBucket: "vision-aa7a0.firebasestorage.app",
    messagingSenderId: "817634922019",
    appId: "1:817634922019:web:7154cfbe04d029e5d7eb96"
};

// تهيئة Firebase
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const vpAuth = firebase.auth();

// تمكين المزودين
const googleProvider = new firebase.auth.GoogleAuthProvider();
const githubProvider = new firebase.auth.GithubAuthProvider();

// ===== دوال القراءة والكتابة =====
async function loadFromFirebase(path) {
    try {
        const snapshot = await db.ref(path).once('value');
        return snapshot.val();
    } catch (error) {
        console.error('Firebase read error:', error);
        throw error;
    }
}

async function saveToFirebase(path, value) {
    try {
        await db.ref(path).set(value);
        return true;
    } catch (error) {
        console.error('Firebase write error:', error);
        throw error;
    }
}

async function updateToFirebase(path, value) {
    try {
        await db.ref(path).update(value);
        return true;
    } catch (error) {
        console.error('Firebase update error:', error);
        throw error;
    }
}

async function pushToFirebase(path, value) {
    try {
        const ref = db.ref(path).push();
        await ref.set(value);
        return ref.key;
    } catch (error) {
        console.error('Firebase push error:', error);
        throw error;
    }
}

function slugifyKey(text) {
    return String(text).trim().toLowerCase().replace(/[.#$\[\]\/\s]+/g, '_');
}

function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.toast-notification');
    existing.forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}
