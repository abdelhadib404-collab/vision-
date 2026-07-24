// ===== تحميل الكاتيغوريس في الصفحة الرئيسية =====
async function loadServices() {
    const container = document.getElementById('services-content');
    try {
        const snapshot = await db.ref('categories').once('value');
        const categories = snapshot.val();
        
        if (!categories) {
            container.innerHTML = '<p style="color:#5a6f73; text-align:center; width:100%;">No services available</p>';
            return;
        }
        
        let html = '';
        Object.values(categories).forEach(cat => {
            html += `
                <div class="card" onclick="showCategory('${cat.id}')" style="cursor:pointer;">
                    <div class="icon" style="color:${cat.color || '#b0e0e6'};">
                        <i class="fas ${cat.icon}"></i>
                    </div>
                    <div class="info">
                        <h2>${cat.name}</h2>
                        <p>View freelancers</p>
                        <a href="#" onclick="event.stopPropagation(); showCategory('${cat.id}')">VIEW</a>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

// ===== عرض الفريلانسرز حسب الكاتيغوري =====
async function showCategory(categoryId) {
    try {
        const snapshot = await db.ref('users').once('value');
        const users = snapshot.val() || {};
        
        const freelancers = Object.values(users).filter(u => 
            u.status === 'approved' && u.categoryId === categoryId
        );
        
        const container = document.getElementById('viral-content');
        if (freelancers.length === 0) {
            container.innerHTML = `
                <div style="width:100%; text-align:center; padding:40px; color:#5a6f73;">
                    <p>No freelancers in this category yet</p>
                    <p style="font-weight:400;">Be the first! <a href="yourpage.html" style="color:#b0e0e6;">Join now</a></p>
                </div>
            `;
            return;
        }
        
        let html = '';
        freelancers.forEach(freelancer => {
            html += `
                <div class="viral-card" onclick="viewFreelancer('${freelancer.uid}')">
                    <div class="viral-img">
                        <img src="${freelancer.profilePic || 'img/default-avatar.jpg'}" alt="${freelancer.username}" />
                    </div>
                    <div class="viral-info">
                        <p class="category">⭐ ${freelancer.username}</p>
                        <strong class="v-title">
                            <span>${freelancer.categoryId}</span>
                            <a href="#" class="viralbtn" onclick="event.stopPropagation(); viewFreelancer('${freelancer.uid}')">VIEW</a>
                        </strong>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
        // تغيير عنوان القسم
        const title = document.querySelector('.viral .title');
        const category = Object.values(categories || {}).find(c => c.id === categoryId);
        title.innerHTML = `VIRAL <span style="font-size:0.5em; color:#5a6f73;">${category ? category.name : categoryId}</span>`;
        
        // تمرير للقسم
        document.getElementById('viral').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error showing category:', error);
    }
}

// ===== عرض ملف الفريلانسر =====
function viewFreelancer(uid) {
    window.location.href = `profile.html?uid=${uid}`;
}

// ===== تحميل الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    loadServices();
    
    // تحميل الفريلانسرز الافتراضيين
    setTimeout(() => {
        const viralContainer = document.getElementById('viral-content');
        viralContainer.innerHTML = `
            <div style="width:100%; text-align:center; padding:20px; color:#5a6f73;">
                <p style="font-weight:400;">👆 Click on a category above to see freelancers</p>
            </div>
        `;
    }, 1000);
});