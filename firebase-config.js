// =====================================================
// firebase-config.js — تهيئة Firebase
// =====================================================

// ⚠️ استبدل هذه القيم ببيانات مشروعك من Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyDummyKey123456789",
    authDomain: "vision-5d2d8.firebaseapp.com",
    databaseURL: "https://vision-5d2d8-default-rtdb.firebaseio.com/",
    projectId: "vision-5d2d8",
    storageBucket: "vision-5d2d8.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// تهيئة Firebase (مرة واحدة)
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// قاعدة البيانات
const db = firebase.database();

// المصادقة (Authentication)
const vpAuth = firebase.auth();

// ===== دوال القراءة والكتابة =====
async function loadFromFirebase(path) {
    try {
        const snapshot = await db.ref(path).once('value');
        return snapshot.val();
    } catch (error) {
        console.error(`❌ Firebase read error at "${path}":`, error);
        throw error;
    }
}

async function saveToFirebase(path, value) {
    try {
        await db.ref(path).set(value);
        return true;
    } catch (error) {
        console.error(`❌ Firebase write error at "${path}":`, error);
        throw error;
    }
}

async function updateToFirebase(path, value) {
    try {
        await db.ref(path).update(value);
        return true;
    } catch (error) {
        console.error(`❌ Firebase update error at "${path}":`, error);
        throw error;
    }
}

async function pushToFirebase(path, value) {
    try {
        const ref = db.ref(path).push();
        await ref.set(value);
        return ref.key;
    } catch (error) {
        console.error(`❌ Firebase push error at "${path}":`, error);
        throw error;
    }
}

// ===== أداة مساعدة =====
function slugifyKey(text) {
    return String(text).trim().toLowerCase().replace(/[.#$\[\]\/\s]+/g, '_');
}

// ===== إشعارات =====
function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.toast-notification');
    existing.forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}