// =====================================================
// firebase-config.js — تهيئة Firebase لموقع Vision+
// هذا الملف كان مفقوداً بالكامل من المشروع، ولهذا السبب:
//   - تسجيل الدخول لا يعمل
//   - صفحة الإدارة لا تعرض أي طلبات
//   - أي تعديل في صفحة الإدارة لا يُحفظ
// لأن كل الدوال (db, loadFromFirebase, saveToFirebase) لم تكن موجودة أصلاً.
// =====================================================

// ⚠️ عدّل فقط القيم التالية من Firebase Console:
// Project settings (⚙️) > General > Your apps > SDK setup and configuration
// (databaseURL موجود مسبقاً وهو رابطك الخاص، لا تغيّره)
const firebaseConfig = {
    apiKey: "PASTE_YOUR_FIREBASE_API_KEY_HERE",
    authDomain: "vision-5d2d8.firebaseapp.com",
    databaseURL: "https://vision-5d2d8-default-rtdb.firebaseio.com/",
    projectId: "vision-5d2d8",
    storageBucket: "vision-5d2d8.firebasestorage.app",
    messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "PASTE_YOUR_APP_ID_HERE"
};

if (firebaseConfig.apiKey === "PASTE_YOUR_FIREBASE_API_KEY_HERE") {
    console.error(
        '❌ Vision+: لم يتم ضبط firebaseConfig بعد. ' +
        'اذهب إلى Firebase Console > إعدادات المشروع > عام > تطبيقاتك، ' +
        'وانسخ apiKey / messagingSenderId / appId إلى ملف firebase-config.js'
    );
}

// تهيئة Firebase (مرة واحدة فقط، حتى لو تكرر تحميل السكربت)
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// قاعدة البيانات (Realtime Database) — تُستخدم في كل صفحات الموقع
const db = firebase.database();

// المصادقة (Firebase Authentication) — تُستخدم فقط في صفحة yourpage.html
// (لا تفشل الصفحات الأخرى إن لم يكن SDK الخاص بالمصادقة محمّلاً فيها)
const vpAuth = (typeof firebase.auth === 'function') ? firebase.auth() : null;

// ===== قراءة بيانات من مسار معيّن في Firebase =====
async function loadFromFirebase(path) {
    try {
        const snapshot = await db.ref(path).once('value');
        return snapshot.val();
    } catch (error) {
        console.error(`❌ Firebase read error at "${path}":`, error);
        throw error;
    }
}

// ===== حفظ/استبدال بيانات في مسار معيّن في Firebase =====
async function saveToFirebase(path, value) {
    try {
        await db.ref(path).set(value);
        return true;
    } catch (error) {
        console.error(`❌ Firebase write error at "${path}":`, error);
        throw error;
    }
}
