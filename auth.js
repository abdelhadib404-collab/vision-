// =====================================================
// auth.js — تسجيل دخول حقيقي عبر Google / GitHub / Discord
// Google و GitHub: عبر Firebase Authentication (نافذة اختيار الحساب الحقيقية من Google/GitHub)
// Discord: عبر إعادة التوجيه الحقيقية لصفحة Discord نفسها (يعرض حساباتك وتختار)
//          ثم تبادل الكود عبر Cloud Function (functions/index.js) بأمان
// =====================================================

// ⚠️ متطلبات:
// 1) في Firebase Console > Authentication > Sign-in method: فعّل Google و GitHub.
// 2) أضف نطاق موقعك في Authorized domains.
// 3) لتفعيل Discord: أنشئ تطبيق على https://discord.com/developers/applications
//    وضع Client ID + Redirect URI (رابط yourpage.html) من لوحة الإدارة (تبويب "الإعدادات")،
//    وانشر Cloud Function الموجودة في functions/index.js (فيها الـ Client Secret فقط، لا يظهر أبداً في المتصفح).

let discordOAuthConfig = null; // يُحمّل من Firebase عند الحاجة

async function getDiscordOAuthConfig() {
    if (discordOAuthConfig) return discordOAuthConfig;
    discordOAuthConfig = await loadFromFirebase('site_settings/discord_oauth');
    return discordOAuthConfig;
}

// ===== Google =====
async function signInWithGoogleReal() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' }); // يجبر ظهور شاشة اختيار الحساب الحقيقية دائماً
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    return {
        uid: `google_${user.uid}`,
        email: user.email,
        displayName: user.displayName || 'مستخدم Google',
        photoURL: user.photoURL || 'img/default-avatar.jpg',
        provider: 'google'
    };
}

// ===== GitHub =====
async function signInWithGithubReal() {
    const provider = new firebase.auth.GithubAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    return {
        uid: `github_${user.uid}`,
        email: user.email || (result.additionalUserInfo && result.additionalUserInfo.username ? `${result.additionalUserInfo.username}@users.noreply.github.com` : null),
        displayName: user.displayName || (result.additionalUserInfo && result.additionalUserInfo.username) || 'مستخدم GitHub',
        photoURL: user.photoURL || 'img/default-avatar.jpg',
        provider: 'github'
    };
}

// ===== Discord =====
// الخطوة 1: تحويل المستخدم فعلياً لصفحة Discord ليختار حسابه ويوافق
async function signInWithDiscordReal() {
    const cfg = await getDiscordOAuthConfig();
    if (!cfg || !cfg.client_id || !cfg.redirect_uri) {
        showNotification('❌ لم يتم إعداد تسجيل دخول Discord بعد من لوحة الإدارة', 'error');
        return;
    }
    // نحفظ أننا كنا في خطوة تسجيل الدخول حتى نكمل بعد العودة من Discord
    sessionStorage.setItem('vp_pending_provider', 'discord');

    const authUrl = new URL('https://discord.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', cfg.client_id);
    authUrl.searchParams.set('redirect_uri', cfg.redirect_uri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'identify email');
    authUrl.searchParams.set('prompt', 'consent'); // يعرض شاشة اختيار/تأكيد الحساب الحقيقية من Discord

    window.location.href = authUrl.toString();
}

// الخطوة 2: عند العودة من Discord (الرابط سيحتوي على ?code=...) نكمل تسجيل الدخول تلقائياً
async function handleDiscordRedirectIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const pending = sessionStorage.getItem('vp_pending_provider');

    if (!code || pending !== 'discord') return null;

    sessionStorage.removeItem('vp_pending_provider');
    // تنظيف الرابط من كود الـ OAuth
    window.history.replaceState({}, document.title, window.location.pathname);

    const cfg = await getDiscordOAuthConfig();
    if (!cfg || !cfg.function_url) {
        showNotification('❌ إعدادات Discord ناقصة (function_url)', 'error');
        return null;
    }

    try {
        const resp = await fetch(`${cfg.function_url}?code=${encodeURIComponent(code)}`);
        const data = await resp.json();
        if (!data || !data.id) {
            showNotification('❌ فشل تسجيل الدخول عبر Discord', 'error');
            return null;
        }
        return {
            uid: `discord_${data.id}`,
            email: data.email,
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

// ===== دالة موحّدة تُستخدم من الواجهة =====
async function authWithProviderReal(provider) {
    try {
        if (provider === 'google') return await signInWithGoogleReal();
        if (provider === 'github') return await signInWithGithubReal();
        if (provider === 'discord') return await signInWithDiscordReal(); // هذا يعيد التوجيه، لا يُرجع نتيجة مباشرة
    } catch (error) {
        console.error('Auth error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('تم إغلاق نافذة تسجيل الدخول', 'info');
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            showNotification('❌ هذا البريد مسجّل مسبقاً بطريقة دخول مختلفة', 'error');
        } else {
            showNotification('❌ فشل تسجيل الدخول، حاول مجدداً', 'error');
        }
        return null;
    }
}
