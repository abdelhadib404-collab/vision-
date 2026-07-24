// ===== متغيرات عامة =====
let allUsers = {};
let categories = {};

// ===== تحميل البيانات =====
function loadAllData() {
    db.ref('users').on('value', (snapshot) => {
        allUsers = snapshot.val() || {};
        updateStats();
        renderPending();
        renderApproved();
        renderRejected();
        renderViral();
    });
    
    db.ref('categories').on('value', (snapshot) => {
        categories = snapshot.val() || {};
        renderCategories();
    });
}

// ===== تحديث الإحصائيات =====
function updateStats() {
    const users = Object.values(allUsers);
    const total = users.length;
    const pending = users.filter(u => u.status === 'pending').length;
    const approved = users.filter(u => u.status === 'approved').length;
    const rejected = users.filter(u => u.status === 'rejected').length;
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
    document.getElementById('stat-rejected').textContent = rejected;
}

// ===== عرض المعلقين =====
function renderPending() {
    const tbody = document.getElementById('pending-table-body');
    const users = Object.values(allUsers).filter(u => u.status === 'pending');
    
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">No pending requests</td></tr>`;
        return;
    }
    
    tbody.innerHTML = users.map((user, index) => `
        <tr>
            <td><img src="${user.profilePic || 'img/default-avatar.jpg'}" class="profile-thumb" /></td>
            <td><strong>${user.username || 'Unknown'}</strong></td>
            <td>${user.email || 'No email'}</td>
            <td><span class="category-chip">${user.categoryId || 'N/A'}</span></td>
            <td>${user.paymentMethod || 'N/A'}</td>
            <td style="font-weight:400; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${user.paymentNote || ''}">
                ${user.paymentNote || '-'}
            </td>
            <td><span class="badge badge-pending">Pending</span></td>
            <td>
                <button class="admin-btn approve" onclick="approveUser('${user.uid}')">
                    <i class="fas fa-check"></i>
                </button>
                <button class="admin-btn reject" onclick="rejectUser('${user.uid}')">
                    <i class="fas fa-times"></i>
                </button>
                <button class="admin-btn view" onclick="viewUser('${user.uid}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ===== عرض المقبولين =====
function renderApproved() {
    const tbody = document.getElementById('approved-table-body');
    const users = Object.values(allUsers).filter(u => u.status === 'approved');
    
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;">No approved users yet</td></tr>`;
        return;
    }
    
    tbody.innerHTML = users.map((user) => `
        <tr>
            <td><img src="${user.profilePic || 'img/default-avatar.jpg'}" class="profile-thumb" /></td>
            <td><strong>${user.username || 'Unknown'}</strong></td>
            <td>${user.email || 'No email'}</td>
            <td><span class="category-chip">${user.categoryId || 'N/A'}</span></td>
            <td style="font-weight:400; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${user.bio ? user.bio.substring(0, 30) + '...' : '-'}
            </td>
            <td><span class="badge badge-approved">Approved</span></td>
            <td>
                <button class="admin-btn view" onclick="viewUser('${user.uid}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="admin-btn reject" onclick="rejectUser('${user.uid}')">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ===== عرض المرفوضين =====
function renderRejected() {
    const tbody = document.getElementById('rejected-table-body');
    const users = Object.values(allUsers).filter(u => u.status === 'rejected');
    
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px;">No rejected users</td></tr>`;
        return;
    }
    
    tbody.innerHTML = users.map((user) => `
        <tr>
            <td><img src="${user.profilePic || 'img/default-avatar.jpg'}" class="profile-thumb" /></td>
            <td><strong>${user.username || 'Unknown'}</strong></td>
            <td>${user.email || 'No email'}</td>
            <td style="font-weight:400;">${user.rejectionReason || 'No reason provided'}</td>
            <td><span class="badge badge-rejected">Rejected</span></td>
            <td>
                <button class="admin-btn restore" onclick="restoreUser('${user.uid}')">
                    <i class="fas fa-undo"></i> Restore
                </button>
                <button class="admin-btn delete" onclick="deleteUserPermanently('${user.uid}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ===== عرض الكاتيغوريس =====
function renderCategories() {
    const container = document.getElementById('categories-list');
    if (!categories || Object.keys(categories).length === 0) {
        container.innerHTML = '<p style="color:#5a6f73;">No categories yet</p>';
        return;
    }
    
    container.innerHTML = Object.values(categories).map(cat => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 15px; background:#f4f9fa; border-radius:12px; margin-bottom:8px; border-left:4px solid ${cat.color || '#b0e0e6'};">
            <div>
                <i class="fas ${cat.icon}" style="color:${cat.color || '#b0e0e6'}; width:30px;"></i>
                <strong>${cat.name}</strong>
                <span style="color:#5a6f73; font-weight:400; margin-left:10px;">${cat.id}</span>
            </div>
            <button class="admin-btn delete" onclick="deleteCategory('${cat.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// ===== عرض Viral =====
function renderViral() {
    const container = document.getElementById('viral-list');
    const users = Object.values(allUsers).filter(u => u.status === 'approved' && u.viralRank);
    
    // ترتيب حسب الترتيب
    users.sort((a, b) => (a.viralRank || 999) - (b.viralRank || 999));
    
    if (users.length === 0) {
        container.innerHTML = '<p style="color:#5a6f73;">No users in viral yet. Approve users to add them.</p>';
        return;
    }
    
    container.innerHTML = users.map((user, index) => `
        <div class="viral-item" draggable="true" data-uid="${user.uid}" style="cursor:grab;">
            <span class="rank">#${index + 1}</span>
            <img src="${user.profilePic || 'img/default-avatar.jpg'}" />
            <div class="info">
                ${user.username}
                <small>${user.categoryId}</small>
            </div>
            <div>
                <span class="badge badge-approved">⭐ ${user.viralRank || index + 1}</span>
                <button class="admin-btn reject" onclick="removeFromViral('${user.uid}')" style="margin-left:10px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ===== دوال الإجراءات =====

// قبول المستخدم
async function approveUser(uid) {
    if (confirm('Approve this user?')) {
        await db.ref(`users/${uid}`).update({
            status: 'approved',
            approvedAt: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('✅ User approved!', 'success');
    }
}

// رفض المستخدم مع سبب
async function rejectUser(uid) {
    const reason = prompt('Reason for rejection:');
    if (reason !== null) {
        await db.ref(`users/${uid}`).update({
            status: 'rejected',
            rejectionReason: reason || 'No reason provided',
            rejectedAt: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('❌ User rejected', 'error');
    }
}

// استعادة مستخدم
async function restoreUser(uid) {
    if (confirm('Restore this user?')) {
        await db.ref(`users/${uid}`).update({
            status: 'pending',
            rejectionReason: null
        });
        showNotification('🔄 User restored to pending', 'success');
    }
}

// حذف مستخدم نهائياً
async function deleteUserPermanently(uid) {
    if (confirm('⚠️ Delete this user permanently? This cannot be undone!')) {
        await db.ref(`users/${uid}`).remove();
        showNotification('🗑️ User deleted permanently', 'error');
    }
}

// عرض بيانات المستخدم
function viewUser(uid) {
    const user = allUsers[uid];
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    alert(`📊 User Details\n
    Username: ${user.username || 'N/A'}\n
    Email: ${user.email || 'N/A'}\n
    Category: ${user.categoryId || 'N/A'}\n
    Status: ${user.status || 'N/A'}\n
    Bio: ${user.bio || 'Not provided'}\n
    Portfolio: ${user.portfolioLink || 'Not provided'}\n
    Phone: ${user.phone || 'Not provided'}\n
    Payment Method: ${user.paymentMethod || 'N/A'}\n
    Payment Note: ${user.paymentNote || 'N/A'}\n
    Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
}

// إضافة كاتيغوري
async function addCategory() {
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value.trim();
    const color = document.getElementById('cat-color').value;
    
    if (!name || !icon) {
        showNotification('❌ Please enter name and icon', 'error');
        return;
    }
    
    const id = name.toLowerCase().replace(/\s+/g, '_');
    
    await db.ref(`categories/${id}`).set({
        id: id,
        name: name,
        icon: icon,
        color: color
    });
    
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-icon').value = '';
    showNotification('✅ Category added!', 'success');
}

// حذف كاتيغوري
async function deleteCategory(id) {
    if (confirm(`Delete category "${id}"?`)) {
        await db.ref(`categories/${id}`).remove();
        showNotification('🗑️ Category deleted', 'error');
    }
}

// إزالة من Viral
async function removeFromViral(uid) {
    if (confirm('Remove this user from viral?')) {
        await db.ref(`users/${uid}`).update({
            viralRank: null
        });
        showNotification('⭐ Removed from viral', 'error');
    }
}

// ===== تبديل التبويبات =====
function switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    
    document.querySelector(`.admin-tab[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`panel-${tab}`).classList.add('active');
}

// ===== تهيئة الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
});

// ===== إشعارات =====
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        notification.style.transition = '0.5s';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}