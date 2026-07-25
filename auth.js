// =====================================================
// auth.js — تسجيل دخول حقيقي مع تذكر الجلسة
// =====================================================

let discordOAuthConfig = null;
let currentAuthUser = null;

// ===== تحميل إعدادات Discord =====
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

// ===== تسجيل الدخول بـ Google (معالج الأخطاء) =====
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const result = await vpAuth.signInWithPopup(provider);
        const user = result.user;
        
        if (!user) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }

        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'مستخدم Google',
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'google'
        };

        // حفظ الجلسة
        sessionStorage.setItem('vp_user', JSON.stringify(userData));
        currentAuthUser = userData;
        
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('Google auth error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق نافذة تسجيل الدخول', 'info');
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            showNotification('❌ هذا البريد مسجل بطريقة دخول مختلفة', 'error');
        } else {
            showNotification('❌ فشل تسجيل الدخول بـ Google', 'error');
        }
        return null;
    }
}

// ===== تسجيل الدخول بـ GitHub =====
async function signInWithGithub() {
    try {
        const provider = new firebase.auth.GithubAuthProvider();
        const result = await vpAuth.signInWithPopup(provider);
        const user = result.user;
        
        if (!user) {
            showNotification('❌ فشل تسجيل الدخول', 'error');
            return null;
        }

        const email = user.email || 
            (result.additionalUserInfo?.username ? `${result.additionalUserInfo.username}@github.user` : null);

        const userData = {
            uid: user.uid,
            email: email,
            displayName: user.displayName || result.additionalUserInfo?.username || 'مستخدم GitHub',
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'github'
        };

        sessionStorage.setItem('vp_user', JSON.stringify(userData));
        currentAuthUser = userData;
        
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('GitHub auth error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق نافذة تسجيل الدخول', 'info');
        } else {
            showNotification('❌ فشل تسجيل الدخول بـ GitHub', 'error');
        }
        return null;
    }
}

// ===== تسجيل الدخول بـ Discord (إعادة توجيه) =====
async function signInWithDiscord() {
    try {
        const cfg = await getDiscordOAuthConfig();
        if (!cfg || !cfg.client_id || !cfg.redirect_uri) {
            showNotification('❌ لم يتم إعداد Discord بعد من لوحة الإدارة', 'error');
            return null;
        }
        
        sessionStorage.setItem('vp_pending_discord', 'true');
        
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

// ===== معالجة العودة من Discord =====
async function handleDiscordRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const pending = sessionStorage.getItem('vp_pending_discord');
    
    if (!code || !pending) return null;
    
    sessionStorage.removeItem('vp_pending_discord');
    window.history.replaceState({}, document.title, window.location.pathname);
    
    try {
        const cfg = await getDiscordOAuthConfig();
        if (!cfg || !cfg.function_url) {
            showNotification('❌ إعدادات Discord ناقصة', 'error');
            return null;
        }
        
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
            provider: 'discord'
        };
        
        sessionStorage.setItem('vp_user', JSON.stringify(userData));
        currentAuthUser = userData;
        
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('Discord redirect error:', error);
        showNotification('❌ حدث خطأ أثناء الاتصال بـ Discord', 'error');
        return null;
    }
}

// ===== تسجيل الدخول بالبريد فقط =====
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
        // البحث عن مستخدم بهذا البريد
        const users = await loadFromFirebase('users');
        let existingUser = null;
        
        if (users) {
            existingUser = Object.values(users).find(u => 
                u.email && u.email.toLowerCase() === email.toLowerCase()
            );
        }
        
        if (existingUser) {
            const userData = {
                uid: existingUser.uid,
                email: existingUser.email,
                displayName: existingUser.displayName || email.split('@')[0],
                photoURL: existingUser.profilePic || 'img/default-avatar.jpg',
                provider: 'email'
            };
            sessionStorage.setItem('vp_user', JSON.stringify(userData));
            currentAuthUser = userData;
            showNotification('✅ مرحباً بعودتك!', 'success');
            return userData;
        }
        
        // مستخدم جديد
        const namePart = email.split('@')[0];
        const userData = {
            uid: `email_${slugifyKey(email)}`,
            email: email,
            displayName: namePart,
            photoURL: 'img/default-avatar.jpg',
            provider: 'email'
        };
        sessionStorage.setItem('vp_user', JSON.stringify(userData));
        currentAuthUser = userData;
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        return userData;
        
    } catch (error) {
        console.error('Email login error:', error);
        showNotification('❌ حدث خطأ أثناء تسجيل الدخول', 'error');
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

// ===== تسجيل الخروج =====
function logoutUser() {
    sessionStorage.removeItem('vp_user');
    currentAuthUser = null;
    
    // تسجيل الخروج من Firebase Auth أيضاً
    if (vpAuth) {
        vpAuth.signOut().catch(console.error);
    }
    
    showNotification('👋 تم تسجيل الخروج', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 500);
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