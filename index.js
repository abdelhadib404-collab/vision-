// =====================================================
// functions/index.js
// Cloud Function واحدة فقط: تبادل كود Discord OAuth بمعلومات المستخدم
// (السرّ الخاص بـ Discord "Client Secret" يبقى هنا فقط ولا يظهر في المتصفح إطلاقاً)
//
// طريقة النشر:
//   1) firebase functions:config:set discord.client_id="ضع_الـ CLIENT_ID" discord.client_secret="ضع_الـ CLIENT_SECRET" discord.redirect_uri="https://your-domain.com/yourpage.html"
//   2) cd functions && npm install
//   3) firebase deploy --only functions
// =====================================================

const functions = require('firebase-functions');
const fetch = require('node-fetch');
const cors = require('cors')({ origin: true });

exports.discordAuth = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const code = req.method === 'GET' ? req.query.code : req.body.code;
            if (!code) {
                return res.status(400).json({ error: 'missing_code' });
            }

            const cfg = functions.config().discord || {};
            const clientId = cfg.client_id;
            const clientSecret = cfg.client_secret;
            const redirectUri = cfg.redirect_uri;

            if (!clientId || !clientSecret || !redirectUri) {
                return res.status(500).json({ error: 'discord_not_configured' });
            }

            // 1) استبدال الكود بتوكن دخول
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri
                })
            });
            const tokenData = await tokenResponse.json();
            if (!tokenData.access_token) {
                return res.status(400).json({ error: 'token_exchange_failed', details: tokenData });
            }

            // 2) جلب معلومات المستخدم من Discord
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const user = await userResponse.json();

            const avatarUrl = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${(parseInt(user.discriminator || '0', 10) || 0) % 5}.png`;

            return res.status(200).json({
                id: user.id,
                username: user.username,
                email: user.email || null,
                avatar: avatarUrl
            });
        } catch (error) {
            console.error('Discord auth error:', error);
            return res.status(500).json({ error: 'server_error' });
        }
    });
});
