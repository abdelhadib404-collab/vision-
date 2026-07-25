// =====================================================
// auth.js - الإصدار النهائي المبسط
// =====================================================

// ===== الحصول على المستخدم الحالي =====
function getCurrentUser() {
    try {
        const stored = sessionStorage.getItem('vp_user');
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
}

// ===== تسجيل الدخول بـ Google =====
async function signInWithGoogle() {
    try {
        showNotification('⏳ جاري الاتصال بـ Google...', 'info');
        
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await vpAuth.signInWithPopup(provider);
        
        if (!result.user) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }
        
        const user = result.user;
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'google'
        };
        
        sessionStorage.setItem('vp_user', JSON.stringify(userData));
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        
        // تحديث الصفحة
        setTimeout(() => window.location.reload(), 500);
        return userData;
        
    } catch (error) {
        console.error('Google error:', error);
        
        if (error.code === 'auth/api-key-not-valid') {
            showNotification('❌ مفتاح API غير صحيح! تحقق من firebase-config.js', 'error');
        } else if (error.code === 'auth/unauthorized-domain') {
            showNotification('❌ أضف localhost في Firebase Console', 'error');
        } else if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق النافذة', 'info');
        } else {
            showNotification('❌ خطأ: ' + error.message, 'error');
        }
        return null;
    }
}

// ===== تسجيل الدخول بـ GitHub =====
async function signInWithGithub() {
    try {
        showNotification('⏳ جاري الاتصال بـ GitHub...', 'info');
        
        const provider = new firebase.auth.GithubAuthProvider();
        const result = await vpAuth.signInWithPopup(provider);
        
        if (!result.user) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }
        
        const user = result.user;
        const email = user.email || `${result.additionalUserInfo?.username || 'user'}@github.user`;
        
        const userData = {
            uid: user.uid,
            email: email,
            displayName: user.displayName || result.additionalUserInfo?.username || email.split('@')[0],
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'github'
        };
        
        sessionStorage.setItem('vp_user', JSON.stringify(userData));
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        setTimeout(() => window.location.reload(), 500);
        return userData;
        
    } catch (error) {
        console.error('GitHub error:', error);
        showNotification('❌ خطأ: ' + error.message, 'error');
        return null;
    }
}

// ===== تسجيل الدخول بالبريد =====
async function loginWithEmailOnly(email) {
    if (!email || !email.includes('@')) {
        showNotification('❌ بريد إلكتروني غير صحيح', 'error');
        return null;
    }
    
    try {
        const users = await loadFromFirebase('users');
        let found = null;
        
        if (users) {
            for (const [uid, u] of Object.entries(users)) {
                if (u.email && u.email.toLowerCase() === email.toLowerCase()) {
                    found = { ...u, uid };
                    break;
                }
            }
        }
        
        const userData = {
            uid: found?.uid || `email_${slugifyKey(email)}_${Date.now()}`,
            email: email,
            displayName: found?.username || found?.displayName || email.split('@')[0],
            photoURL: found?.profilePic || 'img/default-avatar.jpg',
            provider: 'email'
        };
        
        sessionStorage.setItem('vp_user', JSON.stringify(userData));
        showNotification('✅ تم تسجيل الدخول!', 'success');
        setTimeout(() => window.location.reload(), 500);
        return userData;
        
    } catch (error) {
        showNotification('❌ خطأ: ' + error.message, 'error');
        return null;
    }
}

// ===== تسجيل الخروج =====
function logoutUser() {
    sessionStorage.removeItem('vp_user');
    if (vpAuth) vpAuth.signOut().catch(() => {});
    showNotification('👋 تم تسجيل الخروج', 'info');
    setTimeout(() => window.location.reload(), 500);
}

// ===== الدوال العامة =====
window.getCurrentUser = getCurrentUser;
window.signInWithGoogle = signInWithGoogle;
window.signInWithGithub = signInWithGithub;
window.loginWithEmailOnly = loginWithEmailOnly;
window.logoutUser = logoutUser;

console.log('✅ auth.js loaded');