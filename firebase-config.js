// =====================================================
// firebase-config.js — تهيئة Firebase لموقع Vision+
// =====================================================

// ⚠️ أدخل بيانات مشروعك من Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyDummyKey123456789",
    authDomain: "vision-5d2d8.firebaseapp.com",
    databaseURL: "https://vision-5d2d8-default-rtdb.firebaseio.com/",
    projectId: "vision-5d2d8",
    storageBucket: "vision-5d2d8.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// تهيئة Firebase
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// قاعدة البيانات
const db = firebase.database();

// المصادقة
const vpAuth = firebase.auth();

// ===== دوال مشتركة للقراءة والكتابة =====
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