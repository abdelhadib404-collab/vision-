// =====================================================
// yourpage-script.js
// =====================================================

// ===== متغيرات عامة =====
let currentUser = {
    uid: null,
    email: null,
    displayName: null,
    photoURL: null,
    provider: null
};
let userData = {};
let selectedCategoryId = null;
let emailConfig = null; // يُحمّل ديناميكياً من Firebase (تعدّله الإدارة دون لمس الكود)
let usernameIsAvailable = false;
let usernameCheckTimer = null;

// ===== تحميل إعدادات EmailJS من Firebase وتهيئته =====
async function initEmailJS() {
    try {
        emailConfig = await loadFromFirebase('email_config');
        if (emailConfig && emailConfig.public_key) {
            emailjs.init(emailConfig.public_key);
        }
    } catch (error) {
        console.error('Error loading email config:', error);
    }
}

// ===== تسجيل الدخول الحقيقي =====
async function authWithProvider(provider) {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('auth-loading').style.display = 'flex';

    const result = await authWithProviderReal(provider);

    // Discord يعيد توجيه المستخدم لصفحة Discord نفسها، فلن يصل نتيجة هنا مباشرة
    if (provider === 'discord') return;

    document.getElementById('auth-loading').style.display = 'none';

    if (!result) {
        document.getElementById('auth-buttons').style.display = 'flex';
        return;
    }

    setLoggedInUser(result);
}

function setLoggedInUser(result) {
    currentUser.uid = result.uid;
    currentUser.email = result.email;
    currentUser.displayName = result.displayName;
    currentUser.photoURL = result.photoURL || 'img/default-avatar.jpg';
    currentUser.provider = result.provider;

    document.getElementById('auth-profile-pic').src = currentUser.photoURL;
    document.getElementById('auth-username').textContent = currentUser.displayName;
    document.getElementById('auth-email').textContent = currentUser.email || 'لا يوجد بريد ظاهر';
    document.getElementById('auth-user-info').style.display = 'block';

    // إخفاء طرق الدخول بعد نجاح تسجيل الدخول
    const emailBox = document.getElementById('email-login-box');
    const divider = document.getElementById('auth-or-divider');
    const authButtons = document.getElementById('auth-buttons');
    if (emailBox) emailBox.style.display = 'none';
    if (divider) divider.style.display = 'none';
    if (authButtons) authButtons.style.display = 'none';

    showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
    checkUserStatus();
}

// ===== تسجيل الدخول المباشر بالبريد الإلكتروني فقط (بديل عند تعذّر Google/GitHub/Discord) =====
function loginWithEmailOnly() {
    const input = document.getElementById('email-login-input');
    const hint = document.getElementById('email-login-hint');
    const email = input.value.trim().toLowerCase();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        hint.textContent = '❌ يرجى إدخال بريد إلكتروني صحيح';
        hint.className = 'field-hint bad';
        return;
    }
    hint.textContent = '';
    hint.className = 'field-hint';

    const namePart = email.split('@')[0];
    const result = {
        uid: `email_${slugifyKey(email)}`,
        email: email,
        displayName: namePart,
        photoURL: 'img/default-avatar.jpg',
        provider: 'email'
    };

    setLoggedInUser(result);
}

// ===== التحقق من حالة المستخدم =====
async function checkUserStatus() {
    try {
        const user = await loadFromFirebase(`users/${currentUser.uid}`);
        if (user) {
            if (user.status === 'approved') {
                document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
                document.getElementById('step-dashboard').style.display = 'block';
                loadDashboard(user);
                return;
            } else if (user.status === 'pending') {
                document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
                document.getElementById('step-waiting').style.display = 'block';
                return;
            } else if (user.status === 'rejected') {
                showNotification('ℹ️ تم رفض طلبك السابق، يمكنك التسجيل من جديد', 'info');
            }
        }
    } catch (error) {
        console.error('Error checking user:', error);
    }
}

// ===== تحميل الكاتيغوريس =====
async function loadCategories() {
    try {
        const categories = await loadFromFirebase('categories');
        const grid = document.getElementById('category-grid');
        grid.innerHTML = '';
        
        if (!categories) {
            grid.innerHTML = '<p style="color:#ff6b6b;">لا توجد تخصصات</p>';
            return;
        }
        
        Object.values(categories).forEach(cat => {
            const label = document.createElement('label');
            label.className = 'service-check';
            label.innerHTML = `
                <input type="radio" name="category" value="${cat.id}" />
                <i class="fas ${cat.icon}"></i> ${cat.name}
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

// ===== التحقق الفوري من توفر اسم المستخدم =====
async function checkUsernameAvailability() {
    const usernameInput = document.getElementById('username');
    const hint = document.getElementById('username-hint');
    const raw = usernameInput.value.trim();

    usernameIsAvailable = false;

    if (!raw) {
        hint.textContent = '';
        hint.className = 'field-hint';
        return;
    }
    if (raw.length < 3) {
        hint.textContent = '❌ اسم المستخدم قصير جداً (3 أحرف على الأقل)';
        hint.className = 'field-hint bad';
        return;
    }

    hint.textContent = '⏳ جارٍ التحقق...';
    hint.className = 'field-hint checking';

    const key = slugifyKey(raw);
    try {
        const existing = await loadFromFirebase(`usernames/${key}`);
        if (existing && existing !== currentUser.uid) {
            hint.textContent = '❌ اسم المستخدم هذا مستخدم بالفعل، اختر اسماً آخر';
            hint.className = 'field-hint bad';
            usernameIsAvailable = false;
        } else {
            hint.textContent = '✅ اسم المستخدم متاح';
            hint.className = 'field-hint ok';
            usernameIsAvailable = true;
        }
    } catch (error) {
        console.error('Error checking username:', error);
        hint.textContent = '';
    }
}

// ===== الانتقال للخطوة 2 =====
function goToStep2() {
    if (!currentUser.uid) {
        showNotification('❌ يرجى تسجيل الدخول أولاً', 'error');
        return;
    }
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById('step-profile').style.display = 'block';
    loadCategories();
}

// ===== الانتقال للخطوة 3 =====
async function goToStep3() {
    const username = document.getElementById('username').value.trim();
    const phone = document.getElementById('real-phone').value.trim();

    if (!username) {
        showNotification('❌ يرجى إدخال اسم المستخدم', 'error');
        return;
    }
    if (username.length < 3) {
        showNotification('❌ اسم المستخدم قصير جداً', 'error');
        return;
    }

    // تأكيد نهائي أن الاسم غير مستخدم (حماية إضافية قبل المتابعة)
    await checkUsernameAvailability();
    if (!usernameIsAvailable) {
        showNotification('❌ اسم المستخدم مستخدم من قبل، يرجى اختيار اسم آخر', 'error');
        return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 8) {
        showNotification('❌ يرجى إدخال رقم هاتفك الحقيقي بشكل صحيح', 'error');
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
    
    userData.username = username;
    userData.usernameKey = slugifyKey(username);
    userData.phone = phone;
    userData.categoryId = selectedCategoryId;
    userData.profilePic = fileInput.files[0];
    
    const bannerInput = document.getElementById('bannerPic');
    if (bannerInput.files && bannerInput.files[0]) {
        userData.bannerPic = bannerInput.files[0];
    }
    
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById('step-payment').style.display = 'block';
}

// ===== عرض كود الدفع (طرق الدفع تُدار من لوحة الإدارة) =====
async function showPaymentCode(method) {
    let codes = null;
    try {
        codes = await loadFromFirebase('payment_methods');
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }

    const fallback = {
        ccp: 'CCP: 1234 5678 9012 3456',
        redotpay: 'Redotpay ID: RP-98765-4321',
        baridimob: 'Baridimob: +213 555 123 456'
    };

    const value = (codes && codes[method] && codes[method].value) || fallback[method] || '';

    const container = document.getElementById('payment-code-container');
    document.getElementById('payment-code').textContent = value;
    container.style.display = 'block';
    userData.paymentMethod = method;
}

// ===== ✅ دالة إرسال الإيميل للمسؤول =====
async function sendEmailToAdmin(userDataToSend) {
    try {
        if (!emailConfig || !emailConfig.service_id || !emailConfig.template_id) {
            console.warn('Email config not set from admin panel, skipping email.');
            return false;
        }

        const templateParams = {
            username: userDataToSend.username || 'غير معروف',
            email: userDataToSend.email || 'لا يوجد بريد',
            phone: userDataToSend.phone || 'غير متوفر',
            category: userDataToSend.categoryId || 'لا يوجد تخصص',
            payment_method: userDataToSend.paymentMethod || 'غير محدد',
            payment_source: userDataToSend.paymentSource || 'غير محدد',
            payment_time: userDataToSend.paymentTime || 'غير محدد',
            payment_note: `تم الإرسال في ${userDataToSend.paymentTime || 'غير محدد'} من: ${userDataToSend.paymentSource || 'غير محدد'}`,
            status: 'قيد الانتظار',
            created_at: new Date().toLocaleString('ar-DZ'),
            profile_link: `${window.location.origin}/profile.html?uid=${userDataToSend.uid}`,
            admin_link: `${window.location.origin}/admin.html`
        };
        
        const response = await emailjs.send(
            emailConfig.service_id,
            emailConfig.template_id,
            templateParams
        );
        console.log('✅ Email sent to admin:', response);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        return false;
    }
}

// ===== تأكيد الدفع =====
async function confirmPayment() {
    const paymentSource = document.getElementById('payment-source').value.trim();
    if (!paymentSource) {
        showNotification('❌ يرجى تحديد المحفظة/الحساب الذي أرسلت منه الدفع', 'error');
        return;
    }
    userData.paymentSource = paymentSource;
    userData.paymentTime = new Date().toLocaleString('ar-DZ');

    const statusDiv = document.getElementById('payment-status');
    statusDiv.innerHTML = `<p style="color: var(--color-primary);">⏳ جاري المعالجة...</p>`;

    // حجز اسم المستخدم بشكل آمن (يمنع تعارض تسجيل متزامن لنفس الاسم)
    const usernameRef = db.ref(`usernames/${userData.usernameKey}`);
    const txResult = await usernameRef.transaction(current => {
        if (current === null) return currentUser.uid;
        return; // إلغاء العملية إن كان محجوزاً بالفعل
    });

    if (!txResult.committed) {
        statusDiv.innerHTML = `<p style="color:#ff6b6b;">❌ اسم المستخدم أصبح مستخدماً للتو، يرجى العودة واختيار اسم آخر</p>`;
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const profilePicData = e.target.result;

        const finishSave = async (bannerPicData) => {
            const userDataToSave = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                provider: currentUser.provider,
                username: userData.username,
                usernameKey: userData.usernameKey,
                phone: userData.phone,
                categoryId: userData.categoryId,
                profilePic: profilePicData,
                bannerPic: bannerPicData || '',
                paymentMethod: userData.paymentMethod,
                paymentSource: userData.paymentSource,
                paymentTime: userData.paymentTime,
                status: 'pending',
                createdAt: new Date().toISOString(),
                bio: '',
                portfolioLink: '',
                views: 0
            };

            // ✅ إرسال إيميل للمسؤول
            await sendEmailToAdmin(userDataToSave);

            // حفظ في Firebase
            await saveToFirebase(`users/${currentUser.uid}`, userDataToSave);

            document.getElementById('payment-status').innerHTML = `
                <p style="color: #4CAF50;">✅ تم تسجيل طلبك بنجاح!</p>
                <p style="color: var(--color-text-muted); font-weight:400;">⏳ يرجى الانتظار من 1 إلى 40 ساعة لمراجعة طلبك</p>
            `;

            setTimeout(() => {
                document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
                document.getElementById('step-waiting').style.display = 'block';
            }, 2000);
        };

        if (userData.bannerPic) {
            const bannerReader = new FileReader();
            bannerReader.onload = (e2) => finishSave(e2.target.result);
            bannerReader.readAsDataURL(userData.bannerPic);
        } else {
            finishSave('');
        }
    };
    reader.readAsDataURL(userData.profilePic);
}

// ===== تحميل لوحة التحكم =====
function loadDashboard(data) {
    document.getElementById('dash-profile-pic').src = data.profilePic || 'img/default-avatar.jpg';
    document.getElementById('dash-username').textContent = data.username || '';
    document.getElementById('dash-email').textContent = data.email || '';
    document.getElementById('edit-bio').value = data.bio || '';
    document.getElementById('edit-portfolio').value = data.portfolioLink || '';
    document.getElementById('edit-phone').value = data.phone || '';
}

// ===== تحديث البورتفوليو =====
async function updatePortfolio() {
    const bio = document.getElementById('edit-bio').value.trim();
    const portfolioLink = document.getElementById('edit-portfolio').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    
    try {
        await saveToFirebase(`users/${currentUser.uid}/bio`, bio);
        await saveToFirebase(`users/${currentUser.uid}/portfolioLink`, portfolioLink);
        await saveToFirebase(`users/${currentUser.uid}/phone`, phone);
        showNotification('✅ تم حفظ التغييرات بنجاح!', 'success');
    } catch (error) {
        showNotification('❌ حدث خطأ في الحفظ', 'error');
    }
}

// ===== رفع الصور =====
// ===== تحميل نص رسالة الانتظار (قابل للتعديل من لوحة الإدارة) =====
async function loadWaitingText() {
    try {
        const texts = await loadFromFirebase('site_texts');
        if (texts && texts.waiting_text) {
            document.getElementById('waiting-text').textContent = texts.waiting_text;
        }
    } catch (error) {
        console.error('Error loading waiting text:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initEmailJS();
    loadWaitingText();

    // إن كنا عائدين من صفحة Discord، أكمل تسجيل الدخول تلقائياً
    handleDiscordRedirectIfNeeded().then(result => {
        if (result) {
            document.querySelector('.auth-buttons').style.display = 'none';
            setLoggedInUser(result);
        }
    });

    // الدخول بالضغط على Enter في حقل البريد الإلكتروني المباشر
    const emailLoginInput = document.getElementById('email-login-input');
    if (emailLoginInput) {
        emailLoginInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') loginWithEmailOnly();
        });
    }

    // التحقق الفوري من اسم المستخدم أثناء الكتابة
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
        uploadBox.addEventListener('click', function() { fileInput.click(); });
        fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImage.src = e.target.result;
                    previewContainer.style.display = 'flex';
                    uploadBox.style.display = 'none';
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
    
    // رفع البانر
    const bannerUploadBox = document.getElementById('bannerUploadBox');
    const bannerInput = document.getElementById('bannerPic');
    const bannerPreview = document.getElementById('bannerPreviewContainer');
    const bannerPreviewImage = document.getElementById('bannerPreviewImage');
    
    if (bannerUploadBox) {
        bannerUploadBox.addEventListener('click', function() { bannerInput.click(); });
        bannerInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    bannerPreviewImage.src = e.target.result;
                    bannerPreview.style.display = 'block';
                    bannerUploadBox.style.display = 'none';
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
    
    // تحديث الصور في لوحة التحكم
    const updateProfileBox = document.getElementById('updateProfileBox');
    const updateProfileInput = document.getElementById('updateProfilePic');
    if (updateProfileBox) {
        updateProfileBox.addEventListener('click', function() { updateProfileInput.click(); });
        updateProfileInput.addEventListener('change', async function(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = async function(e2) {
                    try {
                        await saveToFirebase(`users/${currentUser.uid}/profilePic`, e2.target.result);
                        document.getElementById('dash-profile-pic').src = e2.target.result;
                        showNotification('✅ تم تحديث الصورة الشخصية!', 'success');
                    } catch (error) {
                        showNotification('❌ حدث خطأ', 'error');
                    }
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
    
    const updateBannerBox = document.getElementById('updateBannerBox');
    const updateBannerInput = document.getElementById('updateBannerPic');
    if (updateBannerBox) {
        updateBannerBox.addEventListener('click', function() { updateBannerInput.click(); });
        updateBannerInput.addEventListener('change', async function(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = async function(e2) {
                    try {
                        await saveToFirebase(`users/${currentUser.uid}/bannerPic`, e2.target.result);
                        showNotification('✅ تم تحديث البانر!', 'success');
                    } catch (error) {
                        showNotification('❌ حدث خطأ', 'error');
                    }
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
});
