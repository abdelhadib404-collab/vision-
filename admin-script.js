// =====================================================
// admin-script.js — لوحة تحكم Vision+
// =====================================================

const DEFAULT_ADMIN_PASSWORD = 'admin123';
let allUsers = {};
let allCategories = {};
let emailConfig = null;

// ===== تحميل إعدادات البريد =====
async function loadEmailConfig() {
    try {
        emailConfig = await loadFromFirebase('email_config');
        if (emailConfig?.public_key) {
            emailjs.init(emailConfig.public_key);
        }
    } catch (error) {
        console.error('Error loading email config:', error);
    }
}

// ===== تسجيل دخول الإدارة =====
async function loginAdmin() {
    const input = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('login-error');

    let realPassword = DEFAULT_ADMIN_PASSWORD;
    try {
        const stored = await loadFromFirebase('admin_settings/password');
        if (stored) realPassword = stored;
    } catch (error) {
        console.error('Error loading admin password:', error);
    }

    if (input === realPassword) {
        sessionStorage.setItem('vp_admin_logged_in', 'true');
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        loadAdminData();
        loadEmailConfig();
    } else {
        errorEl.textContent = '❌ كلمة المرور غير صحيحة';
    }
}

// ===== التبديل بين التبويبات =====
function switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`panel-${tab}`).classList.add('active');

    if (tab === 'categories') loadCategoriesAdmin();
    if (tab === 'texts') loadTexts();
    if (tab === 'payments') loadPaymentMethods();
    if (tab === 'email') loadEmailConfigAdmin();
    if (tab === 'discord') loadDiscordConfig();
    if (tab === 'colors') loadColors();
}

// ===== تحميل كل بيانات الإدارة =====
async function loadAdminData() {
    try {
        const users = await loadFromFirebase('users');
        allUsers = users || {};

        const list = Object.values(allUsers);
        const pending = list.filter(u => u.status === 'pending');
        const approved = list.filter(u => u.status === 'approved');

        document.getElementById('stat-total').textContent = list.length;
        document.getElementById('stat-pending').textContent = pending.length;
        document.getElementById('stat-approved').textContent = approved.length;

        renderPendingTable(pending);
        renderApprovedTable(approved);
    } catch (error) {
        console.error('Error loading admin data:', error);
        showNotification('❌ خطأ في تحميل البيانات', 'error');
    }
}

function renderPendingTable(pending) {
    const tbody = document.getElementById('pending-table-body');
    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">لا توجد طلبات قيد الانتظار</td></tr>';
        return;
    }

    tbody.innerHTML = pending.map(u => `
        <tr>
            <td><img class="profile-thumb" src="${u.profilePic || 'img/default-avatar.jpg'}" /></td>
            <td>${escapeHtml(u.username || u.displayName || '—')}</td>
            <td>${escapeHtml(u.email || '—')}</td>
            <td>${escapeHtml(u.phone || '—')}</td>
            <td><span class="category-chip">${escapeHtml(u.categoryId || '—')}</span></td>
            <td class="request-note">
                💳 ${escapeHtml(u.paymentMethod || '—')}<br/>
                🕒 ${escapeHtml(u.paymentTime || '—')}<br/>
                👛 ${escapeHtml(u.paymentSource || '—')}
            </td>
            <td><span class="badge-pending">قيد الانتظار</span></td>
            <td>
                <button class="admin-btn approve" onclick="approveUser('${u.uid}')"><i class="fas fa-check"></i> قبول</button>
                <button class="admin-btn reject" onclick="rejectUser('${u.uid}')"><i class="fas fa-times"></i> رفض</button>
                <button class="admin-btn view" onclick="viewUser('${u.uid}')"><i class="fas fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderApprovedTable(approved) {
    const tbody = document.getElementById('approved-table-body');
    if (approved.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">لا يوجد مستخدمون مفعّلون</td></tr>';
        return;
    }

    tbody.innerHTML = approved.map(u => `
        <tr>
            <td><img class="profile-thumb" src="${u.profilePic || 'img/default-avatar.jpg'}" /></td>
            <td>${escapeHtml(u.username || u.displayName || '—')}</td>
            <td>${escapeHtml(u.email || '—')}</td>
            <td>${escapeHtml(u.phone || '—')}</td>
            <td><span class="category-chip">${escapeHtml(u.categoryId || '—')}</span></td>
            <td><span class="badge-approved">مفعل</span></td>
            <td>
                <button class="admin-btn view" onclick="viewUser('${u.uid}')"><i class="fas fa-eye"></i> عرض</button>
                <button class="admin-btn delete" onclick="deleteUser('${u.uid}')"><i class="fas fa-trash"></i> حذف</button>
            </td>
        </tr>
    `).join('');
}

// ===== قبول / رفض / حذف مستخدم =====
async function approveUser(uid) {
    try {
        await saveToFirebase(`users/${uid}/status`, 'approved');
        showNotification('✅ تم قبول الطلب، أصبح المستخدم ظاهراً في صفحة تخصصه', 'success');
        loadAdminData();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء القبول', 'error');
    }
}

async function rejectUser(uid) {
    if (!confirm('هل أنت متأكد من رفض هذا الطلب؟ سيتم تحرير اسم المستخدم لاستخدامه من جديد.')) return;
    try {
        const user = allUsers[uid];
        await saveToFirebase(`users/${uid}/status`, 'rejected');
        if (user && user.usernameKey) {
            await db.ref(`usernames/${user.usernameKey}`).remove();
        }
        showNotification('✅ تم رفض الطلب', 'success');
        loadAdminData();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الرفض', 'error');
    }
}

async function deleteUser(uid) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) return;
    try {
        const user = allUsers[uid];
        if (user && user.usernameKey) {
            await db.ref(`usernames/${user.usernameKey}`).remove();
        }
        await db.ref(`users/${uid}`).remove();
        showNotification('✅ تم حذف المستخدم', 'success');
        loadAdminData();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الحذف', 'error');
    }
}

function viewUser(uid) {
    window.open(`profile.html?uid=${uid}`, '_blank');
}

// ===== إدارة التخصصات =====
async function loadCategoriesAdmin() {
    try {
        const categories = await loadFromFirebase('categories');
        allCategories = categories || {};
        const container = document.getElementById('categories-list');

        const entries = Object.values(allCategories);
        if (entries.length === 0) {
            container.innerHTML = '<p style="color:#5a6f73;">لا توجد تخصصات بعد</p>';
            return;
        }

        container.innerHTML = entries.map(cat => `
            <div class="payment-method-row">
                <i class="fas ${cat.icon}" style="color:${cat.color || '#b0e0e6'}; font-size:1.4em;"></i>
                <span style="flex:1; font-weight:600; color:#1e2b2f;">${escapeHtml(cat.name)}</span>
                <span class="category-chip">${escapeHtml(cat.id)}</span>
                <button class="admin-btn delete" onclick="deleteCategory('${cat.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function addCategory() {
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value.trim() || 'fa-star';
    const color = document.getElementById('cat-color').value;

    if (!name) {
        showNotification('❌ يرجى إدخال اسم التخصص', 'error');
        return;
    }

    const id = slugifyKey(name);
    try {
        await saveToFirebase(`categories/${id}`, { id, name, icon, color });
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-icon').value = '';
        showNotification('✅ تمت إضافة التخصص', 'success');
        loadCategoriesAdmin();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الإضافة', 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('حذف هذا التخصص؟')) return;
    try {
        await db.ref(`categories/${id}`).remove();
        showNotification('✅ تم حذف التخصص', 'success');
        loadCategoriesAdmin();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الحذف', 'error');
    }
}

// ===== إدارة النصوص =====
async function loadTexts() {
    try {
        const texts = await loadFromFirebase('site_texts');
        if (texts) {
            document.getElementById('edit-hero-title').value = texts.hero_title || '';
            document.getElementById('edit-hero-subtitle').value = texts.hero_subtitle || '';
            document.getElementById('edit-waiting-text').value = texts.waiting_text || '';
            document.getElementById('edit-viral-title').value = texts.viral_title || '';
            document.getElementById('edit-viral-note').value = texts.viral_note || '';
            document.getElementById('edit-footer-text').value = texts.footer_text || '';
        }
    } catch (error) {
        console.error('Error loading texts:', error);
    }
}

async function saveTexts() {
    const texts = {
        hero_title: document.getElementById('edit-hero-title').value.trim(),
        hero_subtitle: document.getElementById('edit-hero-subtitle').value.trim(),
        waiting_text: document.getElementById('edit-waiting-text').value.trim(),
        viral_title: document.getElementById('edit-viral-title').value.trim(),
        viral_note: document.getElementById('edit-viral-note').value.trim(),
        footer_text: document.getElementById('edit-footer-text').value.trim()
    };
    try {
        await saveToFirebase('site_texts', texts);
        showNotification('✅ تم حفظ النصوص', 'success');
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الحفظ', 'error');
    }
}

// ===== إدارة طرق الدفع =====
async function loadPaymentMethods() {
    try {
        const methods = await loadFromFirebase('payment_methods');
        const container = document.getElementById('payment-methods-list');

        if (!methods) {
            container.innerHTML = '<p style="color:#5a6f73;">لا توجد طرق دفع مضافة بعد</p>';
            return;
        }

        container.innerHTML = Object.entries(methods).map(([key, m]) => `
            <div class="payment-method-row">
                <span class="category-chip">${escapeHtml(key)}</span>
                <input type="text" value="${escapeHtml(m.label || key)}" onchange="updatePaymentMethodField('${key}', 'label', this.value)" placeholder="الاسم الظاهر" />
                <input type="text" value="${escapeHtml(m.value || '')}" onchange="updatePaymentMethodField('${key}', 'value', this.value)" placeholder="الرقم/الكود" />
                <button class="admin-btn delete" onclick="deletePaymentMethod('${key}')"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }
}

async function addPaymentMethod() {
    const key = slugifyKey(document.getElementById('new-pm-key').value.trim());
    const label = document.getElementById('new-pm-label').value.trim();
    const value = document.getElementById('new-pm-value').value.trim();

    if (!key || !label || !value) {
        showNotification('❌ يرجى ملء جميع الحقول', 'error');
        return;
    }

    try {
        await saveToFirebase(`payment_methods/${key}`, { label, value });
        document.getElementById('new-pm-key').value = '';
        document.getElementById('new-pm-label').value = '';
        document.getElementById('new-pm-value').value = '';
        showNotification('✅ تمت إضافة طريقة الدفع', 'success');
        loadPaymentMethods();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الإضافة', 'error');
    }
}

async function updatePaymentMethodField(key, field, value) {
    try {
        await saveToFirebase(`payment_methods/${key}/${field}`, value);
        showNotification('✅ تم التحديث', 'success');
    } catch (error) {
        showNotification('❌ حدث خطأ', 'error');
    }
}

async function deletePaymentMethod(key) {
    if (!confirm('حذف طريقة الدفع هذه؟')) return;
    try {
        await db.ref(`payment_methods/${key}`).remove();
        showNotification('✅ تم الحذف', 'success');
        loadPaymentMethods();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الحذف', 'error');
    }
}

// ===== إعدادات EmailJS (مصلحة) =====
async function loadEmailConfigAdmin() {
    try {
        const cfg = await loadFromFirebase('email_config');
        if (cfg) {
            document.getElementById('email-public-key').value = cfg.public_key || '';
            document.getElementById('email-service-id').value = cfg.service_id || '';
            document.getElementById('email-template-id').value = cfg.template_id || '';
        }
    } catch (error) {
        console.error('Error loading email config:', error);
    }
}

async function saveEmailConfig() {
    const cfg = {
        public_key: document.getElementById('email-public-key').value.trim(),
        service_id: document.getElementById('email-service-id').value.trim(),
        template_id: document.getElementById('email-template-id').value.trim()
    };
    try {
        await saveToFirebase('email_config', cfg);
        if (cfg.public_key) {
            emailjs.init(cfg.public_key);
        }
        showNotification('✅ تم حفظ إعدادات البريد', 'success');
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الحفظ', 'error');
    }
}

// ===== إعدادات Discord OAuth =====
async function loadDiscordConfig() {
    try {
        const cfg = await loadFromFirebase('site_settings/discord_oauth');
        if (cfg) {
            document.getElementById('discord-client-id').value = cfg.client_id || '';
            document.getElementById('discord-redirect-uri').value = cfg.redirect_uri || '';
            document.getElementById('discord-function-url').value = cfg.function_url || '';
        }
    } catch (error) {
        console.error('Error loading discord config:', error);
    }
}

async function saveDiscordConfig() {
    const cfg = {
        client_id: document.getElementById('discord-client-id').value.trim(),
        redirect_uri: document.getElementById('discord-redirect-uri').value.trim(),
        function_url: document.getElementById('discord-function-url').value.trim()
    };
    try {
        await saveToFirebase('site_settings/discord_oauth', cfg);
        showNotification('✅ تم حفظ إعدادات Discord', 'success');
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الحفظ', 'error');
    }
}

// ===== إدارة الألوان =====
async function loadColors() {
    try {
        const colors = await loadFromFirebase('site_settings/colors');
        if (colors) {
            if (colors.primary) document.getElementById('color-primary').value = colors.primary;
            if (colors.primaryLight) document.getElementById('color-primaryLight').value = colors.primaryLight;
            if (colors.dark) document.getElementById('color-dark').value = colors.dark;
            if (colors.dark2) document.getElementById('color-dark2').value = colors.dark2;
            if (colors.dark3) document.getElementById('color-dark3').value = colors.dark3;
            if (colors.textMuted) document.getElementById('color-textMuted').value = colors.textMuted;
            if (colors.bgLight) document.getElementById('color-bgLight').value = colors.bgLight;
        }
    } catch (error) {
        console.error('Error loading colors:', error);
    }
}

async function saveColors() {
    const colors = {
        primary: document.getElementById('color-primary').value,
        primaryLight: document.getElementById('color-primaryLight').value,
        dark: document.getElementById('color-dark').value,
        dark2: document.getElementById('color-dark2').value,
        dark3: document.getElementById('color-dark3').value,
        textMuted: document.getElementById('color-textMuted').value,
        bgLight: document.getElementById('color-bgLight').value
    };
    try {
        await saveToFirebase('site_settings/colors', colors);
        showNotification('✅ تم حفظ الألوان وتطبيقها على الموقع', 'success');
        applySiteColors();
    } catch (error) {
        showNotification('❌ حدث خطأ أثناء الحفظ', 'error');
    }
}

async function resetColors() {
    if (!confirm('استعادة الألوان الافتراضية؟')) return;
    try {
        await db.ref('site_settings/colors').remove();
        showNotification('✅ تمت استعادة الألوان الافتراضية', 'success');
        location.reload();
    } catch (error) {
        showNotification('❌ حدث خطأ', 'error');
    }
}

// ===== أداة مساعدة =====
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ===== عند تحميل الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('vp_admin_logged_in') === 'true') {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        loadAdminData();
        loadEmailConfig();
    }

    const pwInput = document.getElementById('admin-password');
    if (pwInput) {
        pwInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') loginAdmin();
        });
    }
});