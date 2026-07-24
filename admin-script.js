const ADMIN_PASSWORD = "admin123";

// ✅ تهيئة EmailJS
emailjs.init('CKWFEy1mLeWLKlkkC'); // 🔴 ضع مفتاحك العام هنا

function loginAdmin() {
    const pass = document.getElementById('admin-password').value;
    if (pass === ADMIN_PASSWORD) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        loadAdminData();
        loadCategories();
        loadTexts();
        showNotification('✅ مرحباً أيها المسؤول!', 'success');
    } else {
        document.getElementById('login-error').textContent = '❌ كلمة مرور خاطئة!';
    }
}

// ===== تحميل بيانات المسؤول =====
async function loadAdminData() {
    try {
        const users = await loadFromFirebase('users');
        console.log('Users loaded:', users);
        
        if (!users) {
            document.getElementById('pending-table-body').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">لا يوجد مستخدمين</td></tr>';
            document.getElementById('approved-table-body').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">لا يوجد مستخدمين</td></tr>';
            return;
        }

        const userList = Object.entries(users).map(([key, val]) => ({ ...val, uid: key }));
        const pending = userList.filter(u => u.status === 'pending');
        const approved = userList.filter(u => u.status === 'approved');

        document.getElementById('stat-total').textContent = userList.length;
        document.getElementById('stat-pending').textContent = pending.length;
        document.getElementById('stat-approved').textContent = approved.length;

        renderPending(pending);
        renderApproved(approved);
    } catch (error) {
        console.error('Error loading admin data:', error);
        showNotification('❌ خطأ في تحميل البيانات', 'error');
    }
}

function renderPending(users) {
    const tbody = document.getElementById('pending-table-body');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">✨ لا يوجد طلبات معلقة</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><img src="${u.profilePic || 'img/default-avatar.jpg'}" class="profile-thumb" /></td>
            <td><strong>${u.username || 'غير معروف'}</strong></td>
            <td>${u.email || 'لا يوجد بريد'}</td>
            <td><span class="category-chip">${u.categoryId || 'N/A'}</span></td>
            <td>${u.paymentMethod || 'N/A'}</td>
            <td><span class="badge-pending">⏳ قيد الانتظار</span></td>
            <td>
                <button class="admin-btn approve" onclick="approveUser('${u.uid}')"><i class="fas fa-check"></i> قبول</button>
                <button class="admin-btn reject" onclick="rejectUser('${u.uid}')"><i class="fas fa-times"></i> رفض</button>
                <button class="admin-btn view" onclick="viewUser('${u.uid}')"><i class="fas fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderApproved(users) {
    const tbody = document.getElementById('approved-table-body');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">لا يوجد مستخدمين مفعلين</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><img src="${u.profilePic || 'img/default-avatar.jpg'}" class="profile-thumb" /></td>
            <td><strong>${u.username || 'غير معروف'}</strong></td>
            <td>${u.email || 'لا يوجد بريد'}</td>
            <td><span class="category-chip">${u.categoryId || 'N/A'}</span></td>
            <td><span class="badge-approved">✅ مفعل</span></td>
            <td>
                <button class="admin-btn view" onclick="viewUser('${u.uid}')"><i class="fas fa-eye"></i></button>
                <button class="admin-btn reject" onclick="rejectUser('${u.uid}')"><i class="fas fa-times"></i></button>
            </td>
        </tr>
    `).join('');
}

// ===== ✅ دالة إرسال إيميل التأكيد للمستخدم (هنا مكان الكود) =====
async function sendApprovalEmail(user) {
    try {
        const templateParams = {
            username: user.username || 'مستخدم',
            email: user.email || '',
            category: user.categoryId || 'لا يوجد',
            approve_date: new Date().toLocaleString('ar-DZ')
        };
        
        await emailjs.send(
            'service_y29ncb9',        // 🔴 ضع SERVICE_ID الخاص بك
            'template_w2nxpda',    // 🔴 ضع TEMPLATE_ID الخاص بك
            templateParams
        );
        console.log('✅ Approval email sent to user');
        return true;
    } catch (error) {
        console.error('❌ Error sending approval email:', error);
        return false;
    }
}

// ===== ✅ دالة إرسال إيميل الرفض للمستخدم (هنا مكان الكود) =====
async function sendRejectionEmail(user, reason) {
    try {
        const templateParams = {
            username: user.username || 'مستخدم',
            email: user.email || '',
            reason: reason || 'لم يتم تحديد سبب'
        };
        
        await emailjs.send(
            'service_visionplus',        // 🔴 ضع SERVICE_ID الخاص بك
            'template_user_rejected',    // 🔴 ضع TEMPLATE_ID الخاص بك
            templateParams
        );
        console.log('✅ Rejection email sent to user');
        return true;
    } catch (error) {
        console.error('❌ Error sending rejection email:', error);
        return false;
    }
}

// ===== إجراءات المسؤول =====
async function approveUser(uid) {
    if (confirm('هل تريد قبول هذا المستخدم؟')) {
        try {
            const user = await loadFromFirebase(`users/${uid}`);
            
            // ✅ إرسال إيميل تأكيد للمستخدم
            if (user && user.email) {
                await sendApprovalEmail(user);
                alert(`📧 تم إرسال إيميل إلى ${user.email} لإعلامه بقبول طلبه`);
            }
            
            await saveToFirebase(`users/${uid}/status`, 'approved');
            await saveToFirebase(`users/${uid}/approvedAt`, new Date().toISOString());
            
            showNotification('✅ تم قبول المستخدم!', 'success');
            loadAdminData();
        } catch (error) {
            showNotification('❌ حدث خطأ', 'error');
        }
    }
}

async function rejectUser(uid) {
    const reason = prompt('سبب الرفض:');
    if (reason !== null) {
        try {
            const user = await loadFromFirebase(`users/${uid}`);
            
            // ✅ إرسال إيميل رفض للمستخدم
            if (user && user.email) {
                await sendRejectionEmail(user, reason);
            }
            
            await saveToFirebase(`users/${uid}/status`, 'rejected');
            await saveToFirebase(`users/${uid}/rejectionReason`, reason || 'لا يوجد سبب');
            showNotification('❌ تم رفض المستخدم', 'error');
            loadAdminData();
        } catch (error) {
            showNotification('❌ حدث خطأ', 'error');
        }
    }
}

function viewUser(uid) {
    alert(`📊 بيانات المستخدم\n\nعرض في Firebase:\n${FIREBASE_URL}users/${uid}.json`);
}

// ===== إدارة التخصصات =====
async function loadCategories() {
    try {
        const categories = await loadFromFirebase('categories');
        const container = document.getElementById('categories-list');
        if (!categories) {
            container.innerHTML = '<p style="color:#5a6f73;">لا توجد تخصصات</p>';
            return;
        }
        container.innerHTML = Object.values(categories).map(cat => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 15px; background:#f4f9fa; border-radius:12px; margin-bottom:8px; border-left:4px solid ${cat.color || '#b0e0e6'};">
                <div>
                    <i class="fas ${cat.icon}" style="color:${cat.color || '#b0e0e6'}; width:30px;"></i>
                    <strong>${cat.name}</strong>
                    <span style="color:#5a6f73; font-weight:400; margin-left:10px;">${cat.id}</span>
                </div>
                <button class="admin-btn delete" onclick="deleteCategory('${cat.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function addCategory() {
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value.trim();
    const color = document.getElementById('cat-color').value;
    
    if (!name || !icon) {
        showNotification('❌ يرجى إدخال الاسم والأيقونة', 'error');
        return;
    }
    
    const id = name.toLowerCase().replace(/\s+/g, '_');
    try {
        await saveToFirebase(`categories/${id}`, { id, name, icon, color });
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-icon').value = '';
        showNotification('✅ تم إضافة التخصص!', 'success');
        loadCategories();
    } catch (error) {
        showNotification('❌ حدث خطأ', 'error');
    }
}

async function deleteCategory(id) {
    if (confirm(`حذف التخصص "${id}"؟`)) {
        try {
            await deleteFromFirebase(`categories/${id}`);
            showNotification('🗑️ تم حذف التخصص', 'error');
            loadCategories();
        } catch (error) {
            showNotification('❌ حدث خطأ', 'error');
        }
    }
}

// ===== إدارة النصوص =====
async function loadTexts() {
    try {
        const texts = await loadFromFirebase('site_texts');
        if (texts) {
            document.getElementById('edit-hero-title').value = texts.hero_title || '';
            document.getElementById('edit-hero-subtitle').value = texts.hero_subtitle || '';
            document.getElementById('edit-waiting-text').value = texts.waiting_message || '';
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
        waiting_message: document.getElementById('edit-waiting-text').value.trim(),
        footer_text: document.getElementById('edit-footer-text').value.trim()
    };
    try {
        await saveToFirebase('site_texts', texts);
        showNotification('✅ تم حفظ النصوص!', 'success');
    } catch (error) {
        showNotification('❌ حدث خطأ', 'error');
    }
}

// ===== تبديل التبويبات =====
function switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.admin-tab[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`panel-${tab}`).classList.add('active');
}

// ===== تحميل الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `@keyframes slideIn { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }`;
    document.head.appendChild(style);
});
