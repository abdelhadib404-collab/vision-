// =====================================================
// yourpage-script.js
// =====================================================

let currentUser = null;
let userData = null;
let selectedCategoryId = null;
let usernameIsAvailable = false;
let usernameCheckTimer = null;

// ===== تهيئة الصفحة =====
async function initPage() {
    // معالجة إعادة توجيه Discord
    const discordResult = await handleDiscordRedirect();
    if (discordResult) {
        currentUser = discordResult;
        showAuthSuccess();
        return;
    }
    
    const user = getCurrentUser();
    if (user) {
        currentUser = user;
        showAuthSuccess();
        return;
    }
    
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById('step-auth').style.display = 'block';
}

// ===== عرض نجاح تسجيل الدخول =====
function showAuthSuccess() {
    if (!currentUser) return;
    
    document.getElementById('profile-preview-img').src = currentUser.photoURL || 'img/default-avatar.jpg';
    document.getElementById('profile-display-name').textContent = currentUser.displayName || 'مستخدم';
    document.getElementById('profile-email').textContent = currentUser.email || 'لا يوجد بريد';
    
    document.getElementById('step-auth').style.display = 'none';
    document.getElementById('step-profile').style.display = 'block';
    
    updateHeaderUI();
    loadCategories();
    checkUserAndRedirect();
}

// ===== تحديث رأس الصفحة =====
function updateHeaderUI() {
    const user = getCurrentUser();
    if (user) {
        const headerUser = document.getElementById('header-user');
        if (headerUser) {
            headerUser.style.display = 'flex';
            document.getElementById('header-avatar').src = user.photoURL || 'img/default-avatar.jpg';
            document.getElementById('header-username').textContent = user.displayName || 'مستخدم';
        }
    }
}

// ===== التحقق من حالة المستخدم =====
async function checkUserAndRedirect() {
    if (!currentUser) return;
    
    try {
        const user = await loadFromFirebase(`users/${currentUser.uid}`);
        
        if (user) {
            userData = user;
            if (user.status === 'approved') {
                showDashboard(user);
                return;
            } else if (user.status === 'pending') {
                showWaitingScreen();
                return;
            } else if (user.status === 'rejected') {
                showNotification('ℹ️ تم رفض طلبك السابق، يمكنك التسجيل من جديد', 'info');
            }
        }
        
        // إذا لم يكن هناك مستخدم، نبقى في خطوة الملف الشخصي
        document.getElementById('step-profile').style.display = 'block';
        
    } catch (error) {
        console.error('Error checking user:', error);
        document.getElementById('step-profile').style.display = 'block';
    }
}

// ===== تسجيل الدخول بالبريد =====
async function handleEmailLogin() {
    const input = document.getElementById('email-login-input');
    const email = input.value.trim();
    
    if (!email || !email.includes('@')) {
        showNotification('❌ بريد إلكتروني غير صحيح', 'error');
        return;
    }
    
    const result = await loginWithEmailOnly(email);
    if (result) {
        currentUser = result;
        showAuthSuccess();
    }
}

// ===== تسجيل الدخول بمزود =====
async function handleProviderLogin(provider) {
    const result = await authWithProvider(provider);
    if (result) {
        currentUser = result;
        showAuthSuccess();
    }
}

// ===== تحميل التخصصات =====
async function loadCategories() {
    try {
        const categories = await loadFromFirebase('categories');
        const grid = document.getElementById('category-grid');
        grid.innerHTML = '';
        
        if (!categories || Object.keys(categories).length === 0) {
            grid.innerHTML = '<p style="color:#ff6b6b;">لا توجد تخصصات حالياً</p>';
            return;
        }
        
        Object.values(categories).forEach(cat => {
            const label = document.createElement('label');
            label.className = 'service-check';
            label.innerHTML = `
                <input type="radio" name="category" value="${cat.id}" />
                <i class="fas ${cat.icon || 'fa-star'}"></i> ${cat.name}
            `;
            grid.appendChild(label);
        });
        
        document.querySelectorAll('input[name="category"]').forEach(input => {
            input.addEventListener('change', function() {
                selectedCategoryId = this.value;
            });
        });
        
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// ===== التحقق من توفر اسم المستخدم =====
async function checkUsernameAvailability() {
    const usernameInput = document.getElementById('username');
    const hint = document.getElementById('username-hint');
    const raw = usernameInput.value.trim();
    usernameIsAvailable = false;

    if (!raw || raw.length < 3) {
        hint.textContent = raw ? '❌ اسم قصير جداً (3 أحرف على الأقل)' : '';
        hint.className = 'field-hint';
        return;
    }

    hint.textContent = '⏳ جارٍ التحقق...';
    hint.className = 'field-hint checking';

    const key = slugifyKey(raw);
    try {
        const existing = await loadFromFirebase(`usernames/${key}`);
        if (existing && existing !== currentUser.uid) {
            hint.textContent = '❌ هذا الاسم مستخدم بالفعل';
            hint.className = 'field-hint bad';
            usernameIsAvailable = false;
        } else {
            hint.textContent = '✅ اسم متاح';
            hint.className = 'field-hint ok';
            usernameIsAvailable = true;
        }
    } catch (error) {
        console.error('Error checking username:', error);
        hint.textContent = '';
    }
}

// ===== الانتقال للخطوة 3 (الدفع) =====
async function goToStep3() {
    const username = document.getElementById('username').value.trim();
    const phone = document.getElementById('real-phone').value.trim();

    if (!username || username.length < 3) {
        showNotification('❌ يرجى إدخال اسم مستخدم صحيح', 'error');
        return;
    }

    await checkUsernameAvailability();
    if (!usernameIsAvailable) {
        showNotification('❌ اسم المستخدم مستخدم، اختر اسماً آخر', 'error');
        return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 8) {
        showNotification('❌ يرجى إدخال رقم هاتف صحيح', 'error');
        return;
    }

    if (!selectedCategoryId) {
        showNotification('❌ يرجى اختيار تخصص', 'error');
        return;
    }
    
    const fileInput = document.getElementById('profilePic');
    if (!fileInput.files || !fileInput.files[0]) {
        showNotification('❌ يرجى رفع صورة شخصية', 'error');
        return;
    }
    
    // حفظ البيانات المؤقتة
    window._tempUserData = {
        username: username,
        usernameKey: slugifyKey(username),
        phone: phone,
        categoryId: selectedCategoryId,
        profilePic: fileInput.files[0]
    };
    
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById('step-payment').style.display = 'block';
    loadPaymentMethods();
}

// ===== تحميل طرق الدفع =====
async function loadPaymentMethods() {
    try {
        const methods = await loadFromFirebase('payment_methods');
        const container = document.getElementById('payment-methods-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!methods || Object.keys(methods).length === 0) {
            container.innerHTML = '<p style="color:#5a6f73;">لا توجد طرق دفع</p>';
            return;
        }
        
        Object.entries(methods).forEach(([key, m]) => {
            const btn = document.createElement('button');
            btn.className = 'payment-btn';
            btn.innerHTML = `<i class="fas fa-wallet"></i> ${m.label || key}`;
            btn.onclick = () => showPaymentCode(key);
            container.appendChild(btn);
        });
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }
}

// ===== عرض كود الدفع =====
async function showPaymentCode(method) {
    try {
        const methods = await loadFromFirebase('payment_methods');
        const value = methods?.[method]?.value || 'يرجى التواصل مع الإدارة';
        
        document.getElementById('payment-code').textContent = value;
        document.getElementById('payment-code-container').style.display = 'block';
        window._selectedPaymentMethod = method;
    } catch (error) {
        console.error('Error showing payment code:', error);
    }
}

// ===== تأكيد الدفع =====
async function confirmPayment() {
    const paymentSource = document.getElementById('payment-source').value.trim();
    if (!paymentSource) {
        showNotification('❌ يرجى تحديد المحفظة التي أرسلت منها الدفع', 'error');
        return;
    }

    const tempData = window._tempUserData;
    if (!tempData) {
        showNotification('❌ حدث خطأ، يرجى المحاولة من جديد', 'error');
        return;
    }

    const statusDiv = document.getElementById('payment-status');
    statusDiv.innerHTML = '<p style="color: #b0e0e6;">⏳ جاري تسجيل طلبك...</p>';

    // حجز اسم المستخدم
    const usernameRef = db.ref(`usernames/${tempData.usernameKey}`);
    const txResult = await usernameRef.transaction(current => {
        if (current === null) return currentUser.uid;
        return;
    });

    if (!txResult.committed) {
        statusDiv.innerHTML = '<p style="color:#ff6b6b;">❌ اسم المستخدم أصبح مستخدماً، يرجى العودة وتغييره</p>';
        return;
    }

    // قراءة الصورة
    const profilePicData = await readFileAsDataURL(tempData.profilePic);

    const userDataToSave = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        provider: currentUser.provider,
        username: tempData.username,
        usernameKey: tempData.usernameKey,
        phone: tempData.phone,
        categoryId: tempData.categoryId,
        profilePic: profilePicData,
        paymentMethod: window._selectedPaymentMethod || 'غير محدد',
        paymentSource: paymentSource,
        paymentTime: new Date().toLocaleString('ar-DZ'),
        status: 'pending',
        createdAt: new Date().toISOString(),
        bio: '',
        portfolioLink: '',
        views: 0,
        likes: 0,
        works: []
    };

    await saveToFirebase(`users/${currentUser.uid}`, userDataToSave);

    statusDiv.innerHTML = `
        <p style="color: #4CAF50;">✅ تم تسجيل طلبك بنجاح!</p>
        <p style="color: #5a6f73;">⏳ سيتم مراجعة طلبك خلال 1-40 ساعة</p>
    `;

    setTimeout(() => {
        document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
        document.getElementById('step-waiting').style.display = 'block';
        loadWaitingText();
    }, 2000);
}

// ===== قراءة ملف كـ Base64 =====
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== عرض لوحة التحكم =====
function showDashboard(user) {
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById('step-dashboard').style.display = 'block';
    userData = user;
    
    document.getElementById('dash-profile-pic').src = user.profilePic || 'img/default-avatar.jpg';
    document.getElementById('dash-username').textContent = user.username || user.displayName || '';
    document.getElementById('dash-email').textContent = user.email || '';
    document.getElementById('edit-bio').value = user.bio || '';
    document.getElementById('edit-portfolio').value = user.portfolioLink || '';
    
    loadUserWorks();
    loadUserStats();
}

// ===== تحميل الإحصائيات =====
async function loadUserStats() {
    try {
        const user = await loadFromFirebase(`users/${currentUser.uid}`);
        if (user) {
            document.getElementById('stat-views').textContent = user.views || 0;
            document.getElementById('stat-likes').textContent = user.likes || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ===== تحميل الأعمال =====
async function loadUserWorks() {
    try {
        const user = await loadFromFirebase(`users/${currentUser.uid}`);
        const container = document.getElementById('works-container');
        if (!container) return;
        
        if (!user?.works || user.works.length === 0) {
            container.innerHTML = '<p style="color:#5a6f73; font-weight:400;">لا توجد أعمال مضافة بعد</p>';
            return;
        }
        
        container.innerHTML = user.works.map((work, index) => `
            <div class="work-item">
                ${work.image ? `<img src="${work.image}" alt="${work.title}" />` : ''}
                <div class="work-info">
                    <h4>${work.title || 'بدون عنوان'}</h4>
                    <p>${work.description || ''}</p>
                </div>
                <button class="admin-btn delete" onclick="deleteWork(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading works:', error);
    }
}

// ===== إضافة عمل =====
async function addWork() {
    const title = document.getElementById('work-title').value.trim();
    const description = document.getElementById('work-desc').value.trim();
    const fileInput = document.getElementById('work-image');
    
    if (!title) {
        showNotification('❌ يرجى إدخال عنوان للعمل', 'error');
        return;
    }
    
    let imageData = '';
    if (fileInput.files && fileInput.files[0]) {
        imageData = await readFileAsDataURL(fileInput.files[0]);
    }
    
    const newWork = { 
        title, 
        description, 
        image: imageData, 
        createdAt: new Date().toISOString() 
    };
    
    try {
        const user = await loadFromFirebase(`users/${currentUser.uid}`);
        const works = user?.works || [];
        works.push(newWork);
        await saveToFirebase(`users/${currentUser.uid}/works`, works);
        
        document.getElementById('work-title').value = '';
        document.getElementById('work-desc').value = '';
        document.getElementById('work-image').value = '';
        
        showNotification('✅ تم إضافة العمل بنجاح!', 'success');
        loadUserWorks();
        
    } catch (error) {
        showNotification('❌ حدث خطأ في إضافة العمل', 'error');
    }
}

// ===== حذف عمل =====
async function deleteWork(index) {
    if (!confirm('هل أنت متأكد من حذف هذا العمل؟')) return;
    try {
        const user = await loadFromFirebase(`users/${currentUser.uid}`);
        const works = user?.works || [];
        works.splice(index, 1);
        await saveToFirebase(`users/${currentUser.uid}/works`, works);
        showNotification('✅ تم حذف العمل', 'success');
        loadUserWorks();
    } catch (error) {
        showNotification('❌ حدث خطأ', 'error');
    }
}

// ===== تحديث الملف الشخصي =====
async function updatePortfolio() {
    const bio = document.getElementById('edit-bio').value.trim();
    const portfolioLink = document.getElementById('edit-portfolio').value.trim();
    
    try {
        await updateToFirebase(`users/${currentUser.uid}`, {
            bio: bio,
            portfolioLink: portfolioLink
        });
        showNotification('✅ تم حفظ التغييرات بنجاح!', 'success');
    } catch (error) {
        showNotification('❌ حدث خطأ في الحفظ', 'error');
    }
}

// ===== شاشة الانتظار =====
function showWaitingScreen() {
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById('step-waiting').style.display = 'block';
    loadWaitingText();
}

// ===== تحميل نص الانتظار =====
async function loadWaitingText() {
    try {
        const texts = await loadFromFirebase('site_texts');
        if (texts?.waiting_text) {
            document.getElementById('waiting-text').textContent = texts.waiting_text;
        }
    } catch (error) {
        console.error('Error loading waiting text:', error);
    }
}

// ===== تهيئة الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    initPage();
    updateHeaderUI();
    loadWaitingText();

    // أحداث الإدخال
    const emailLoginInput = document.getElementById('email-login-input');
    if (emailLoginInput) {
        emailLoginInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') handleEmailLogin();
        });
    }

    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', function() {
            clearTimeout(usernameCheckTimer);
            usernameCheckTimer = setTimeout(checkUsernameAvailability, 500);
        });
    }

    // رفع الصورة الشخصية
    const uploadBox = document.getElementById('uploadBox');
    const fileInput = document.getElementById('profilePic');
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    
    if (uploadBox) {
        uploadBox.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', function(e) {
            if (e.target.files?.[0]) {
                const reader = new FileReader();
                reader.onload = function(e2) {
                    previewImage.src = e2.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
});

// ===== تصدير الدوال =====
window.handleEmailLogin = handleEmailLogin;
window.handleProviderLogin = handleProviderLogin;
window.goToStep3 = goToStep3;
window.confirmPayment = confirmPayment;
window.updatePortfolio = updatePortfolio;
window.addWork = addWork;
window.deleteWork = deleteWork;
window.logoutUser = logoutUser;