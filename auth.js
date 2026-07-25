// =====================================================
// auth.js — تسجيل دخول (مُصلح بالكامل)
// =====================================================

let currentAuthUser = null;
let authStateListeners = [];

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
    } else {
        sessionStorage.removeItem('vp_user');
    }
    notifyAuthListeners(user);
}

// ===== مستمعو حالة المصادقة =====
function onAuthStateChange(callback) {
    authStateListeners.push(callback);
    const user = getCurrentUser();
    if (user) callback(user);
}

function notifyAuthListeners(user) {
    authStateListeners.forEach(cb => cb(user));
}

// ===== ✅ تسجيل الدخول بـ Google (مُصلح) =====
async function signInWithGoogle() {
    try {
        showNotification('⏳ جاري تسجيل الدخول بـ Google...', 'info');
        
        // التأكد من تهيئة Firebase
        if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
            showNotification('❌ Firebase not initialized', 'error');
            return null;
        }
        
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ 
            prompt: 'select_account'
        });
        
        const result = await vpAuth.signInWithPopup(provider);
        
        if (!result || !result.user) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }
        
        const user = result.user;
        console.log('✅ Google user:', user);
        
        if (!user.email) {
            showNotification('❌ البريد الإلكتروني غير متوفر', 'error');
            return null;
        }

        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'google',
            emailVerified: user.emailVerified || false
        };

        setCurrentUser(userData);
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('❌ Google auth error:', error);
        
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق نافذة تسجيل الدخول', 'info');
        } else if (error.code === 'auth/unauthorized-domain') {
            showNotification('❌ أضف localhost في Firebase Console > Authentication > Settings > Authorized domains', 'error');
        } else if (error.code === 'auth/api-key-not-valid') {
            showNotification('❌ مفتاح API غير صحيح. تأكد من firebase-config.js', 'error');
        } else if (error.code === 'auth/user-cancelled') {
            showNotification('تم إلغاء تسجيل الدخول', 'info');
        } else if (error.code === 'auth/network-request-failed') {
            showNotification('❌ مشكلة في الإنترنت. تحقق من اتصالك', 'error');
        } else {
            showNotification('❌ فشل تسجيل الدخول: ' + error.message, 'error');
        }
        return null;
    }
}

// ===== ✅ تسجيل الدخول بـ GitHub =====
async function signInWithGithub() {
    try {
        showNotification('⏳ جاري تسجيل الدخول بـ GitHub...', 'info');
        
        const provider = new firebase.auth.GithubAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const result = await vpAuth.signInWithPopup(provider);
        
        if (!result || !result.user) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }
        
        const user = result.user;
        console.log('✅ GitHub user:', user);

        const email = user.email || 
            (result.additionalUserInfo?.username ? `${result.additionalUserInfo.username}@github.user` : null);

        if (!email) {
            showNotification('❌ البريد الإلكتروني غير متوفر من GitHub', 'error');
            return null;
        }

        const userData = {
            uid: user.uid,
            email: email,
            displayName: user.displayName || result.additionalUserInfo?.username || email.split('@')[0],
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'github',
            emailVerified: user.emailVerified || false
        };

        setCurrentUser(userData);
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('❌ GitHub auth error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق نافذة تسجيل الدخول', 'info');
        } else {
            showNotification('❌ فشل تسجيل الدخول بـ GitHub: ' + error.message, 'error');
        }
        return null;
    }
}

// ===== تسجيل الدخول بـ Discord =====
let discordOAuthConfig = null;

async function getDiscordOAuthConfig() {
    if (discordOAuthConfig) return discordOAuthConfig;
    try {
        discordOAuthConfig = await loadFromFirebase('site_settings/discord_oauth');
    } catch (error) {
        console.error('Error loading discord config:', error);
        discordOAuthConfig = null;
    }
    return discordOAuthConfig;
}

async function signInWithDiscord() {
    try {
        const cfg = await getDiscordOAuthConfig();
        if (!cfg || !cfg.client_id || !cfg.redirect_uri) {
            showNotification('❌ لم يتم إعداد Discord بعد', 'error');
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
        console.error('Discord auth error:', error);
        showNotification('❌ فشل تسجيل الدخول بـ Discord', 'error');
        return null;
    }
}

async function handleDiscordRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const pending = sessionStorage.getItem('vp_pending_discord');
    const redirectUrl = sessionStorage.getItem('vp_discord_redirect');
    
    if (!code || !pending) return null;
    
    sessionStorage.removeItem('vp_pending_discord');
    sessionStorage.removeItem('vp_discord_redirect');
    
    window.history.replaceState({}, document.title, redirectUrl || window.location.pathname);
    
    try {
        const cfg = await getDiscordOAuthConfig();
        if (!cfg || !cfg.function_url) {
            showNotification('❌ إعدادات Discord ناقصة', 'error');
            return null;
        }
        
        showNotification('⏳ جاري تسجيل الدخول عبر Discord...', 'info');
        
        const resp = await fetch(`${cfg.function_url}?code=${encodeURIComponent(code)}`);
        const data = await resp.json();
        
        if (!data || !data.id) {
            showNotification('❌ فشل تسجيل الدخول عبر Discord', 'error');
            return null;
        }
        
        const userData = {
            uid: data.id,
            email: data.email || `${data.username}@discord.user`,
            displayName: data.username || 'مستخدم Discord',
            photoURL: data.avatar || 'img/default-avatar.jpg',
            provider: 'discord',
            emailVerified: false
        };
        
        setCurrentUser(userData);
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('Discord redirect error:', error);
        showNotification('❌ حدث خطأ في تسجيل الدخول عبر Discord', 'error');
        return null;
    }
}

// ===== ✅ تسجيل الدخول بالبريد فقط =====
async function loginWithEmailOnly(email) {
    if (!email) {
        showNotification('❌ يرجى إدخال بريد إلكتروني', 'error');
        return null;
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showNotification('❌ بريد إلكتروني غير صحيح', 'error');
        return null;
    }
    
    try {
        const users = await loadFromFirebase('users');
        let existingUser = null;
        let existingUid = null;
        
        if (users) {
            const entries = Object.entries(users);
            for (const [uid, u] of entries) {
                if (u.email && u.email.toLowerCase() === email.toLowerCase()) {
                    existingUser = u;
                    existingUid = uid;
                    break;
                }
            }
        }
        
        if (existingUser && existingUid) {
            const userData = {
                uid: existingUid,
                email: existingUser.email,
                displayName: existingUser.displayName || existingUser.username || email.split('@')[0],
                photoURL: existingUser.profilePic || 'img/default-avatar.jpg',
                provider: 'email',
                emailVerified: true
            };
            setCurrentUser(userData);
            showNotification('✅ مرحباً بعودتك!', 'success');
            return userData;
        }
        
        const namePart = email.split('@')[0];
        const uid = `email_${slugifyKey(email)}_${Date.now()}`;
        const userData = {
            uid: uid,
            email: email,
            displayName: namePart,
            photoURL: 'img/default-avatar.jpg',
            provider: 'email',
            emailVerified: true
        };
        setCurrentUser(userData);
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('Email login error:', error);
        showNotification('❌ حدث خطأ: ' + error.message, 'error');
        return null;
    }
}

// ===== الدالة الموحدة =====
async function authWithProvider(provider) {
    if (provider === 'google') return await signInWithGoogle();
    if (provider === 'github') return await signInWithGithub();
    if (provider === 'discord') return await signInWithDiscord();
    return null;
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

// ===== التحقق من حالة المستخدم =====
async function checkUserStatus(uid) {
    try {
        const user = await loadFromFirebase(`users/${uid}`);
        return user || null;
    } catch (error) {
        console.error('Error checking user status:', error);
        return null;
    }
}

// ===== ✅ مراقبة حالة المصادقة =====
if (typeof vpAuth !== 'undefined' && vpAuth) {
    vpAuth.onAuthStateChanged(async (firebaseUser) => {
        console.log('🔥 Auth state changed:', firebaseUser?.uid || 'No user');
        
        if (firebaseUser) {
            const userData = getCurrentUser();
            if (!userData || userData.uid !== firebaseUser.uid) {
                const user = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستخدم',
                    photoURL: firebaseUser.photoURL || 'img/default-avatar.jpg',
                    provider: firebaseUser.providerData?.[0]?.providerId || 'unknown',
                    emailVerified: firebaseUser.emailVerified
                };
                setCurrentUser(user);
            }
        }
    });
}

// ===== تصدير الدوال =====
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.signInWithGoogle = signInWithGoogle;
window.signInWithGithub = signInWithGithub;
window.signInWithDiscord = signInWithDiscord;
window.handleDiscordRedirect = handleDiscordRedirect;
window.loginWithEmailOnly = loginWithEmailOnly;
window.authWithProvider = authWithProvider;
window.logoutUser = logoutUser;
window.checkUserStatus = checkUserStatus;
window.onAuthStateChange = onAuthStateChange;

console.log('✅ auth.js loaded successfully');