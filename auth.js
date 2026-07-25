// =====================================================
// auth.js - الإصدار المصلح بالكامل
// =====================================================

let currentAuthUser = null;

// ===== الحصول على المستخدم الحالي =====
function getCurrentUser() {
    if (currentAuthUser) return currentAuthUser;
    try {
        const stored = sessionStorage.getItem('vp_user');
        if (stored) {
            currentAuthUser = JSON.parse(stored);
            return currentAuthUser;
        }
    } catch (error) {
        console.error('Error getting current user:', error);
    }
    return null;
}

// ===== حفظ المستخدم =====
function setCurrentUser(user) {
    currentAuthUser = user;
    if (user) {
        sessionStorage.setItem('vp_user', JSON.stringify(user));
        console.log('✅ User saved:', user.email);
    } else {
        sessionStorage.removeItem('vp_user');
        console.log('👤 User logged out');
    }
    return user;
}

// ===== ✅ تسجيل الدخول بـ Google (مصلح) =====
async function signInWithGoogle() {
    try {
        showNotification('⏳ جاري تسجيل الدخول بـ Google...', 'info');
        
        if (typeof firebase === 'undefined') {
            showNotification('❌ Firebase not loaded', 'error');
            return null;
        }
        
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const result = await vpAuth.signInWithPopup(provider);
        
        if (!result || !result.user) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }
        
        const user = result.user;
        console.log('✅ Google user:', user.uid, user.email);
        
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'google'
        };
        
        setCurrentUser(userData);
        showNotification('✅ مرحباً ' + userData.displayName + '!', 'success');
        
        // تحديث الصفحة بعد 1 ثانية
        setTimeout(() => {
            window.location.href = 'yourpage.html';
        }, 1000);
        
        return userData;
        
    } catch (error) {
        console.error('❌ Google error:', error);
        
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق النافذة', 'info');
        } else if (error.code === 'auth/unauthorized-domain') {
            showNotification('❌ أضف localhost في Firebase Console', 'error');
        } else if (error.code === 'auth/api-key-not-valid') {
            showNotification('❌ مفتاح API غير صحيح', 'error');
        } else {
            showNotification('❌ خطأ: ' + error.message, 'error');
        }
        return null;
    }
}

// ===== ✅ تسجيل الدخول بـ GitHub =====
async function signInWithGithub() {
    try {
        showNotification('⏳ جاري تسجيل الدخول بـ GitHub...', 'info');
        
        const provider = new firebase.auth.GithubAuthProvider();
        const result = await vpAuth.signInWithPopup(provider);
        
        if (!result || !result.user) {
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
        
        setCurrentUser(userData);
        showNotification('✅ مرحباً ' + userData.displayName + '!', 'success');
        
        setTimeout(() => {
            window.location.href = 'yourpage.html';
        }, 1000);
        
        return userData;
        
    } catch (error) {
        console.error('❌ GitHub error:', error);
        showNotification('❌ خطأ: ' + error.message, 'error');
        return null;
    }
}

// ===== ✅ تسجيل الدخول بالبريد (مصلح) =====
async function loginWithEmailOnly(email) {
    if (!email || !email.includes('@')) {
        showNotification('❌ بريد إلكتروني غير صحيح', 'error');
        return null;
    }
    
    try {
        showNotification('⏳ جاري تسجيل الدخول...', 'info');
        
        // البحث عن المستخدم في قاعدة البيانات
        const users = await loadFromFirebase('users');
        let foundUser = null;
        let foundUid = null;
        
        if (users) {
            for (const [uid, u] of Object.entries(users)) {
                if (u.email && u.email.toLowerCase() === email.toLowerCase()) {
                    foundUser = u;
                    foundUid = uid;
                    break;
                }
            }
        }
        
        let userData;
        
        if (foundUser && foundUid) {
            // مستخدم موجود
            userData = {
                uid: foundUid,
                email: foundUser.email,
                displayName: foundUser.username || foundUser.displayName || email.split('@')[0],
                photoURL: foundUser.profilePic || 'img/default-avatar.jpg',
                provider: 'email'
            };
            showNotification('✅ مرحباً بعودتك ' + userData.displayName + '!', 'success');
        } else {
            // مستخدم جديد
            const uid = `email_${slugifyKey(email)}_${Date.now()}`;
            userData = {
                uid: uid,
                email: email,
                displayName: email.split('@')[0],
                photoURL: 'img/default-avatar.jpg',
                provider: 'email'
            };
            showNotification('✅ تم تسجيل الدخول!', 'success');
        }
        
        setCurrentUser(userData);
        
        setTimeout(() => {
            window.location.href = 'yourpage.html';
        }, 1000);
        
        return userData;
        
    } catch (error) {
        console.error('❌ Email login error:', error);
        showNotification('❌ خطأ: ' + error.message, 'error');
        return null;
    }
}

// ===== تسجيل الدخول بـ Discord =====
async function signInWithDiscord() {
    try {
        const cfg = await loadFromFirebase('site_settings/discord_oauth');
        if (!cfg || !cfg.client_id || !cfg.redirect_uri) {
            showNotification('❌ Discord غير مهيأ', 'error');
            return null;
        }
        
        sessionStorage.setItem('vp_pending_discord', 'true');
        sessionStorage.setItem('vp_discord_redirect', window.location.href);
        
        const authUrl = new URL('https://discord.com/oauth2/authorize');
        authUrl.searchParams.set('client_id', cfg.client_id);
        authUrl.searchParams.set('redirect_uri', cfg.redirect_uri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'identify email');
        authUrl.searchParams.set('prompt', 'consent');
        
        window.location.href = authUrl.toString();
        return null;
        
    } catch (error) {
        console.error('Discord error:', error);
        showNotification('❌ خطأ في Discord', 'error');
        return null;
    }
}

async function handleDiscordRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const pending = sessionStorage.getItem('vp_pending_discord');
    
    if (!code || !pending) return null;
    
    sessionStorage.removeItem('vp_pending_discord');
    window.history.replaceState({}, document.title, window.location.pathname);
    
    try {
        const cfg = await loadFromFirebase('site_settings/discord_oauth');
        if (!cfg || !cfg.function_url) {
            showNotification('❌ Discord غير مهيأ', 'error');
            return null;
        }
        
        const resp = await fetch(`${cfg.function_url}?code=${encodeURIComponent(code)}`);
        const data = await resp.json();
        
        if (!data || !data.id) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }
        
        const userData = {
            uid: data.id,
            email: data.email || `${data.username}@discord.user`,
            displayName: data.username || 'مستخدم Discord',
            photoURL: data.avatar || 'img/default-avatar.jpg',
            provider: 'discord'
        };
        
        setCurrentUser(userData);
        showNotification('✅ مرحباً ' + userData.displayName + '!', 'success');
        
        setTimeout(() => {
            window.location.href = 'yourpage.html';
        }, 1000);
        
        return userData;
        
    } catch (error) {
        console.error('Discord redirect error:', error);
        showNotification('❌ حدث خطأ', 'error');
        return null;
    }
}

// ===== تسجيل الخروج =====
async function logoutUser() {
    try {
        if (vpAuth) {
            await vpAuth.signOut();
        }
    } catch (error) {
        console.error('Sign out error:', error);
    }
    setCurrentUser(null);
    showNotification('👋 تم تسجيل الخروج', 'info');
    setTimeout(() => window.location.reload(), 500);
}

// ===== مراقبة حالة المصادقة =====
if (typeof vpAuth !== 'undefined') {
    vpAuth.onAuthStateChanged((firebaseUser) => {
        console.log('🔥 Auth state:', firebaseUser ? 'Logged in' : 'Logged out');
    });
}

// ===== تصدير الدوال =====
window.getCurrentUser = getCurrentUser;
window.signInWithGoogle = signInWithGoogle;
window.signInWithGithub = signInWithGithub;
window.signInWithDiscord = signInWithDiscord;
window.handleDiscordRedirect = handleDiscordRedirect;
window.loginWithEmailOnly = loginWithEmailOnly;
window.logoutUser = logoutUser;

console.log('✅ auth.js loaded');