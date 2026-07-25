// =====================================================
// common.js — دوال مشتركة
// =====================================================

// ===== إشعار منبثق =====
function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.toast-notification');
    existing.forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}

// ===== تطبيق الألوان =====
async function applySiteColors() {
    try {
        if (typeof loadFromFirebase !== 'function') return;
        const colors = await loadFromFirebase('site_settings/colors');
        if (!colors) return;

        const map = {
            primary: '--color-primary',
            primaryLight: '--color-primary-light',
            dark: '--color-dark',
            dark2: '--color-dark-2',
            dark3: '--color-dark-3',
            textMuted: '--color-text-muted',
            bgLight: '--color-bg-light'
        };

        Object.keys(map).forEach(key => {
            if (colors[key]) {
                document.documentElement.style.setProperty(map[key], colors[key]);
            }
        });
    } catch (error) {
        console.error('Error applying site colors:', error);
    }
}

// ===== توليد معرّف =====
function slugifyKey(text) {
    return String(text).trim().toLowerCase().replace(/[.#$\[\]\/\s]+/g, '_');
}

document.addEventListener('DOMContentLoaded', applySiteColors);