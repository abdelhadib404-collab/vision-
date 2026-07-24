// ===== متغيرات عامة =====
let currentUser = {
    uid: null,
    email: null,
    displayName: null,
    photoURL: null
};
let userData = {};
let selectedCategoryId = null;

// ===== تسجيل الدخول =====
function authWithProvider(provider) {
    const email = prompt('أدخل بريدك الإلكتروني:', 'user@gmail.com');
    if (email && email.includes('@')) {
        const name = prompt('أدخل اسمك:', 'اسم المستخدم');
        
        currentUser.uid = email.replace(/[^a-zA-Z0-9]/g, '_');
        currentUser.email = email;
        currentUser.displayName = name || 'مستخدم';
        currentUser.photoURL = 'img/default-avatar.jpg';
        
        document.getElementById('auth-profile-pic').src = currentUser.photoURL;
        document.getElementById('auth-username').textContent = currentUser.displayName;
        document.getElementById('auth-email').textContent = currentUser.email;
        document.getElementById('auth-user-info').style.display = 'block';
        document.querySelector('.auth-buttons').style.display = 'none';
        
        showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
        
        // التحقق من حالة المستخدم
        checkUserStatus();
    } else {
        showNotification('❌ يرجى إدخال بريد صحيح', 'error');
    }
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
            }
        }
        // مستخدم جديد - اكمل التسجيل
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
function goToStep3() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        showNotification('❌ يرجى إدخال اسم المستخدم', 'error');
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
    userData.categoryId = selectedCategoryId;
    userData.profilePic = fileInput.files[0];
    
    const bannerInput = document.getElementById('bannerPic');
    if (bannerInput.files && bannerInput.files[0]) {
        userData.bannerPic = bannerInput.files[0];
    }
    
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById('step-payment').style.display = 'block';
}

// ===== عرض كود الدفع =====
function showPaymentCode(method) {
    const codes = {
        ccp: 'CCP: 1234 5678 9012 3456',
        redotpay: 'Redotpay ID: RP-98765-4321',
        baridimob: 'Baridimob: +213 555 123 456'
    };
    const container = document.getElementById('payment-code-container');
    document.getElementById('payment-code').textContent = codes[method];
    container.style.display = 'block';
    userData.paymentMethod = method;
}

// ===== تأكيد الدفع =====
async function confirmPayment() {
    const statusDiv = document.getElementById('payment-status');
    statusDiv.innerHTML = `<p style="color: #b0e0e6;">⏳ جاري المعالجة...</p>`;
    
    // تحويل الصورة إلى Base64
    const reader = new FileReader();
    reader.onload = async function(e) {
        const userDataToSave = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            username: userData.username,
            categoryId: userData.categoryId,
            profilePic: e.target.result,
            paymentMethod: userData.paymentMethod,
            status: 'pending',
            createdAt: new Date().toISOString(),
            bio: '',
            portfolioLink: '',
            phone: '',
            views: 0
        };
        
        // رفع البانر إذا وجد
        if (userData.bannerPic) {
            const bannerReader = new FileReader();
            bannerReader.onload = function(e2) {
                userDataToSave.bannerPic = e2.target.result;
                saveUserData(userDataToSave);
            };
            bannerReader.readAsDataURL(userData.bannerPic);
        } else {
            saveUserData(userDataToSave);
        }
    };
    reader.readAsDataURL(userData.profilePic);
}

async function saveUserData(data) {
    try {
        // حفظ في Firebase
        await saveToFirebase(`users/${currentUser.uid}`, data);
        
        document.getElementById('payment-status').innerHTML = `
            <p style="color: #4CAF50;">✅ تم تسجيل طلبك بنجاح!</p>
            <p style="color: #5a6f73; font-weight:400;">⏳ يرجى الانتظار من 1 إلى 40 ساعة لمراجعة طلبك</p>
        `;
        
        setTimeout(() => {
            document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
            document.getElementById('step-waiting').style.display = 'block';
        }, 2000);
        
    } catch (error) {
        console.error('Error saving user:', error);
        document.getElementById('payment-status').innerHTML = `
            <p style="color: #ff6b6b;">❌ حدث خطأ، يرجى المحاولة مرة أخرى</p>
        `;
    }
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
document.addEventListener('DOMContentLoaded', function() {
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