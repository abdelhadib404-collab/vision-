// =====================================================
// auth.js — تسجيل دخول حقيقي مع ربط الحسابات
// =====================================================

let discordOAuthConfig = null;

async function getDiscordOAuthConfig() {
    if (discordOAuthConfig) return discordOAuthConfig;
    discordOAuthConfig = await loadFromFirebase('site_settings/discord_oauth');
    return discordOAuthConfig;
}

// ===== تسجيل الدخول بـ Google =====
async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
        const result = await vpAuth.signInWithPopup(provider);
        const user = result.user;
        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'مستخدم Google',
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'google'
        };
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق نافذة تسجيل الدخول', 'info');
        } else {
            showNotification('❌ فشل تسجيل الدخول بـ Google', 'error');
            console.error(error);
        }
        return null;
    }
}

// ===== تسجيل الدخول بـ GitHub =====
async function signInWithGithub() {
    const provider = new firebase.auth.GithubAuthProvider();
    try {
        const result = await vpAuth.signInWithPopup(provider);
        const user = result.user;
        // GitHub قد لا يعطي بريداً إلكترونياً دائماً
        const email = user.email || (result.additionalUserInfo?.username ? 
            `${result.additionalUserInfo.username}@github.user` : null);
        return {
            uid: user.uid,
            email: email,
            displayName: user.displayName || result.additionalUserInfo?.username || 'مستخدم GitHub',
            photoURL: user.photoURL || 'img/default-avatar.jpg',
            provider: 'github'
        };
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق نافذة تسجيل الدخول', 'info');
        } else {
            showNotification('❌ فشل تسجيل الدخول بـ GitHub', 'error');
            console.error(error);
        }
        return null;
    }
}

// ===== تسجيل الدخول بـ Discord (إعادة توجيه) =====
async function signInWithDiscord() {
    const cfg = await getDiscordOAuthConfig();
    if (!cfg || !cfg.client_id || !cfg.redirect_uri) {
        showNotification('❌ لم يتم إعداد Discord بعد من لوحة الإدارة', 'error');
        return null;
    }
    
    sessionStorage.setItem('vp_pending_provider', 'discord');
    sessionStorage.setItem('vp_pending_discord', 'true');
    
    const authUrl = new URL('https://discord.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', cfg.client_id);
    authUrl.searchParams.set('redirect_uri', cfg.redirect_uri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'identify email');
    authUrl.searchParams.set('prompt', 'consent');
    
    window.location.href = authUrl.toString();
    return null;
}

// ===== معالجة العودة من Discord =====
async function handleDiscordRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const pending = sessionStorage.getItem('vp_pending_discord');
    
    if (!code || !pending) return null;
    
    sessionStorage.removeItem('vp_pending_discord');
    window.history.replaceState({}, document.title, window.location.pathname);
    
    const cfg = await getDiscordOAuthConfig();
    if (!cfg || !cfg.function_url) {
        showNotification('❌ إعدادات Discord ناقصة', 'error');
        return null;
    }
    
    try {
        const resp = await fetch(`${cfg.function_url}?code=${encodeURIComponent(code)}`);
        const data = await resp.json();
        if (!data || !data.id) {
            showNotification('❌ فشل تسجيل الدخول عبر Discord', 'error');
            return null;
        }
        
        // Discord لا يعطي بريداً دائماً
        return {
            uid: data.id,
            email: data.email || `${data.username}@discord.user`,
            displayName: data.username || 'مستخدم Discord',
            photoURL: data.avatar || 'img/default-avatar.jpg',
            provider: 'discord'
        };
    } catch (error) {
        console.error('Discord redirect error:', error);
        showNotification('❌ حدث خطأ أثناء الاتصال بـ Discord', 'error');
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