// 🔥 رابط Firebase المباشر
const FIREBASE_URL = "https://visionplus-2026-default-rtdb.firebaseio.com/";

// ===== دوال Firebase =====
async function loadFromFirebase(path) {
    try {
        const response = await fetch(`${FIREBASE_URL}${path}.json`);
        return await response.json();
    } catch (error) {
        console.error('Error loading:', error);
        return null;
    }
}

async function saveToFirebase(path, data) {
    try {
        const response = await fetch(`${FIREBASE_URL}${path}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error saving:', error);
        return null;
    }
}

async function deleteFromFirebase(path) {
    try {
        await fetch(`${FIREBASE_URL}${path}.json`, {
            method: 'DELETE'
        });
        return true;
    } catch (error) {
        console.error('Error deleting:', error);
        return false;
    }
}

// ===== إشعارات =====
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.5s ease;
        max-width: 350px;
        background: ${type === 'success' ? '#b0e0e6' : '#ff6b6b'};
        color: ${type === 'success' ? '#1e2b2f' : '#fff'};
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        notification.style.transition = '0.5s';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// ===== تهيئة البيانات الافتراضية =====
async function initializeDefaultData() {
    try {
        // الكاتيغوريس
        const categories = await loadFromFirebase('categories');
        if (!categories) {
            const defaultCategories = {
                writing_script: { id: 'writing_script', name: 'كتابة النصوص', icon: 'fa-pen-to-square', color: '#b0e0e6' },
                web_development: { id: 'web_development', name: 'تطوير الويب', icon: 'fa-code', color: '#4CAF50' },
                translation: { id: 'translation', name: 'الترجمة', icon: 'fa-language', color: '#FF9800' },
                graphic_design: { id: 'graphic_design', name: 'التصميم الجرافيكي', icon: 'fa-paintbrush', color: '#9C27B0' },
                photography: { id: 'photography', name: 'التصوير', icon: 'fa-camera', color: '#2196F3' },
                video_editing: { id: 'video_editing', name: 'مونتاج الفيديو', icon: 'fa-video', color: '#F44336' },
                programming: { id: 'programming', name: 'البرمجة', icon: 'fa-code', color: '#00BCD4' },
                ui_ux_design: { id: 'ui_ux_design', name: 'UI/UX Design', icon: 'fa-paint-brush', color: '#E91E63' }
            };
            await saveToFirebase('categories', defaultCategories);
        }

        // النصوص
        const texts = await loadFromFirebase('site_texts');
        if (!texts) {
            const defaultTexts = {
                hero_title: 'مرحباً بك في VISION+',
                hero_subtitle: 'منصة تجمع بين الموهوبين والعملاء',
                footer_text: 'جميع الحقوق محفوظة © 2026 Vision+',
                waiting_message: '⏳ يرجى الانتظار من 1 إلى 40 ساعة لمراجعة طلبك من قبل الإدارة',
                approved_message: '🎉 تم قبول طلبك! يمكنك الآن البدء في العمل'
            };
            await saveToFirebase('site_texts', defaultTexts);
        }

        console.log('✅ البيانات الافتراضية جاهزة!');
    } catch (error) {
        console.error('Error initializing:', error);
    }
}
initializeDefaultData();