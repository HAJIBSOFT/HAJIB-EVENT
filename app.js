/**
 * تطبيق HAJIB-EVENTS
 * منصة إدارة الفعاليات والكوادر المستقلة (Vanilla JS + Supabase)
 */

// 1. الإعداد والربط مع Supabase (استبدل بالمفاتيح الخاصة بمشروعك)
const SUPABASE_URL = "https://cbyjokrlnnkihjhixdyz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AwLUhkBI0-7GxUpVkAUK2Q_5jPaVpqe";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
const AppState = {
    user: null,
    profile: null,
    isManager: false,
    managerData: null,
    currentView: 'events'
};

// البيانات المنسدلة المعيارية
const GCC_NATIONALITIES = ["سعودي", "إماراتي", "كويتي", "عماني", "قطري", "بحريني"];
const SAUDI_REGIONS = ["الرياض", "مكة المكرمة", "المدينة المنورة", "القصيم", "المنطقة الشرقية", "عسير", "تبوك", "حائل", "الحدود الشمالية", "جازان", "نجران", "الباحة", "الجوف"];
const ID_TYPES = ["هوية وطنية", "إقامة نظامية", "جواز سفر خليجي"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Helper: حساب المسافة الجغرافية (Haversine Formula) بالمتر
function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // نصف قطر الأرض بالمتر
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Helper: الإشعارات
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Helper: Modal Controllers
function openModal(htmlContent) {
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    body.innerHTML = htmlContent;
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.getElementById('modalBody').innerHTML = '';
}

document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

// ==========================================
// 2. التحقق والمصادقة وجلب الجلسات
// ==========================================
async function initApp() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            AppState.user = session.user;
            await fetchUserData(session.user.id);
        }
    } catch (err) {
        console.error("Session error:", err);
    } finally {
        updateNavbar();
        routeView(AppState.user ? 'events' : 'auth');
    }
}

async function fetchUserData(userId) {
    // التحقق إن كان مديراً
    const { data: mgr } = await supabase
        .from('HAJIBEVENT-managers')
        .select('*')
        .eq('id', userId)
        .single();

    if (mgr) {
        AppState.isManager = true;
        AppState.managerData = mgr;
    }

    // جلب ملف المستخدم الشخصي
    const { data: prof } = await supabase
        .from('HAJIBEVENT-profiles')
        .select('*')
        .eq('id', userId)
        .single();

    AppState.profile = prof || null;
}

function updateNavbar() {
    const nav = document.getElementById('mainNav');
    if (!AppState.user) {
        nav.innerHTML = `
            <button class="nav-btn primary" onclick="routeView('auth')">تسجيل الدخول / الانضمام</button>
            <button class="nav-btn" onclick="routeView('admin_login')">بوابة الإدارة</button>
        `;
        return;
    }

    let links = '';
    if (AppState.isManager) {
        links += `
            <button class="nav-btn" onclick="routeView('admin_events')">إدارة الفعاليات</button>
            <button class="nav-btn" onclick="routeView('admin_attendance')">سجل الحضور والنطاق</button>
            <button class="nav-btn" onclick="routeView('admin_submanagers')">إدارة المديرين</button>
        `;
    } else {
        links += `
            <button class="nav-btn" onclick="routeView('events')">الفعاليات المتاحة</button>
            <button class="nav-btn" onclick="routeView('profile')">حسابي الشخصي</button>
        `;
    }
    links += `<button class="nav-btn btn-outline" onclick="handleLogout()">تسجيل الخروج</button>`;
    nav.innerHTML = links;
}

async function handleLogout() {
    await supabase.auth.signOut();
    AppState.user = null;
    AppState.profile = null;
    AppState.isManager = false;
    AppState.managerData = null;
    updateNavbar();
    routeView('auth');
}

// ==========================================
// 3. محرك التنقل والتوجيه (Router)
// ==========================================
function routeView(view, payload = null) {
    AppState.currentView = view;
    const root = document.getElementById('appRoot');

    switch (view) {
        case 'auth':
            renderAuthView(root);
            break;
        case 'admin_login':
            renderAdminLoginView(root);
            break;
        case 'events':
            renderEventsCatalogView(root);
            break;
        case 'event_detail':
            renderEventDetailView(root, payload);
            break;
        case 'profile':
            renderProfileView(root);
            break;
        case 'admin_events':
            renderAdminEventsView(root);
            break;
        case 'admin_attendance':
            renderAdminAttendanceView(root);
            break;
        case 'admin_submanagers':
            renderAdminManagersView(root);
            break;
        default:
            root.innerHTML = '<p>الصفحة غير موجودة.</p>';
    }
}

// ==========================================
// 4. واجهة التسجيل والدخول للفريلانسر
// ==========================================
function renderAuthView(container) {
    container.innerHTML = `
        <div class="auth-wrapper">
            <div class="auth-tabs">
                <div class="auth-tab active" id="tabLogin" onclick="toggleAuthTab('login')">تسجيل الدخول</div>
                <div class="auth-tab" id="tabRegister" onclick="toggleAuthTab('register')">إنشاء حساب فريلانسر</div>
            </div>

            <!-- Login Form -->
            <form id="loginForm" onsubmit="handleLoginSubmit(event)">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>البريد الإلكتروني</label>
                    <input type="email" id="loginEmail" class="form-control" required placeholder="name@domain.com">
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>كلمة المرور</label>
                    <input type="password" id="loginPassword" class="form-control" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-primary btn-full">دخول المنصة</button>
            </form>

            <!-- Registration Form -->
            <form id="registerForm" style="display:none;" onsubmit="handleFreelancerRegister(event)">
                <div class="form-grid">
                    <div class="form-group col-span-2">
                        <label>الاسم الرباعي الكامل</label>
                        <input type="text" id="regFullName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>البريد الإلكتروني</label>
                        <input type="email" id="regEmail" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>رقم الجوال</label>
                        <input type="tel" id="regPhone" class="form-control" required placeholder="05xxxxxxxx">
                    </div>
                    <div class="form-group">
                        <label>تاريخ الميلاد</label>
                        <input type="date" id="regDob" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>نوع الهوية</label>
                        <select id="regIdType" class="form-control" required>
                            ${ID_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>رقم الهوية / الإقامة</label>
                        <input type="text" id="regIdNumber" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>الجنسية</label>
                        <select id="regNationality" class="form-control" required>
                            ${GCC_NATIONALITIES.map(n => `<option value="${n}">${n}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>الجنس</label>
                        <select id="regGender" class="form-control" required>
                            <option value="ذكر">ذكر</option>
                            <option value="أنثى">أنثى</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>فصيلة الدم</label>
                        <select id="regBloodType" class="form-control" required>
                            ${BLOOD_TYPES.map(b => `<option value="${b}">${b}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>المدينة / المنطقة</label>
                        <select id="regCity" class="form-control" required>
                            ${SAUDI_REGIONS.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>اللغات المتقنة</label>
                        <input type="text" id="regLanguages" class="form-control" placeholder="العربية، الإنجليزية..." required>
                    </div>
                    <div class="form-group col-span-2">
                        <label>نبذة مهنية موجزة</label>
                        <textarea id="regBio" class="form-control" rows="2"></textarea>
                    </div>
                    <div class="form-group">
                        <label>الصورة الشخصية</label>
                        <input type="file" id="regAvatar" class="form-control" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label>السيرة الذاتية (CV - PDF أو Word)</label>
                        <input type="file" id="regCV" class="form-control" accept=".pdf,.doc,.docx" required>
                    </div>
                    <div class="form-group col-span-2">
                        <label>تعيين كلمة المرور</label>
                        <input type="password" id="regPassword" class="form-control" required minlength="6">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full" style="margin-top: 1.5rem;">إكمال التسجيل</button>
            </form>
        </div>
    `;
}

function toggleAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');

    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        showToast(error.message, 'error');
        return;
    }
    AppState.user = data.user;
    await fetchUserData(data.user.id);
    updateNavbar();
    showToast('تم تسجيل الدخول بنجاح', 'success');
    routeView('events');
}

async function handleFreelancerRegister(e) {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const fullName = document.getElementById('regFullName').value;
    const cvFile = document.getElementById('regCV').files[0];
    const avatarFile = document.getElementById('regAvatar').files[0];

    showToast('جاري إنشاء الحساب ورفع الملفات...', 'info');

    // 1. Auth Signup
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });

    if (authError) {
        showToast(authError.message, 'error');
        return;
    }

    const userId = authData.user.id;
    let cvUrl = '';
    let avatarUrl = '';

    // 2. Upload Storage files
    if (cvFile) {
        const ext = cvFile.name.split('.').pop();
        const path = `cvs/${userId}_cv.${ext}`;
        const { error: cvUploadErr } = await supabase.storage.from('cvs').upload(path, cvFile);
        if (!cvUploadErr) {
            const { data } = supabase.storage.from('cvs').getPublicUrl(path);
            cvUrl = data.publicUrl;
        }
    }

    if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `avatars/${userId}_avatar.${ext}`;
        const { error: avUploadErr } = await supabase.storage.from('avatars').upload(path, avatarFile);
        if (!avUploadErr) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(path);
            avatarUrl = data.publicUrl;
        }
    }

    // 3. Create HAJIBEVENT-profiles
    const profilePayload = {
        id: userId,
        full_name: fullName,
        email: email,
        phone: document.getElementById('regPhone').value,
        dob: document.getElementById('regDob').value,
        id_number: document.getElementById('regIdNumber').value,
        id_type: document.getElementById('regIdType').value,
        nationality: document.getElementById('regNationality').value,
        gender: document.getElementById('regGender').value,
        blood_type: document.getElementById('regBloodType').value,
        city: document.getElementById('regCity').value,
        languages: document.getElementById('regLanguages').value,
        bio: document.getElementById('regBio').value,
        avatar_url: avatarUrl,
        cv_url: cvUrl
    };

    const { error: profError } = await supabase
        .from('HAJIBEVENT-profiles')
        .insert(profilePayload);

    if (profError) {
        showToast(profError.message, 'error');
        return;
    }

    AppState.user = authData.user;
    AppState.profile = profilePayload;
    updateNavbar();
    showToast('تم التسجيل بنجاح في منصة حاجب', 'success');
    routeView('events');
}

// بوابة دخول الإدارة
function renderAdminLoginView(container) {
    container.innerHTML = `
        <div class="auth-wrapper" style="max-width: 420px;">
            <h2 style="margin-bottom: 0.5rem; text-align: center;">بوابة مدير الفعالية</h2>
            <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-bottom: 1.5rem;">منطقة مخصصة للتحكم وإدارة الحضور</p>
            <form onsubmit="handleAdminLoginSubmit(event)">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>البريد الإلكتروني المعتمد</label>
                    <input type="email" id="adminEmail" class="form-control" required>
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>كلمة المرور</label>
                    <input type="password" id="adminPassword" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary btn-full">تسجيل الدخول الإداري</button>
            </form>
        </div>
    `;
}

async function handleAdminLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        showToast('فشل الدخول: ' + error.message, 'error');
        return;
    }

    const { data: mgr } = await supabase
        .from('HAJIBEVENT-managers')
        .select('*')
        .eq('id', data.user.id)
        .single();

    if (!mgr) {
        await supabase.auth.signOut();
        showToast('هذا الحساب غير مصرح له كمدير نظام.', 'error');
        return;
    }

    AppState.user = data.user;
    AppState.isManager = true;
    AppState.managerData = mgr;
    updateNavbar();
    showToast('مرحباً بك في لوحة الإدارة', 'success');
    routeView('admin_events');
}

// ==========================================
// 5. عرض الفعاليات (للفريلانسر)
// ==========================================
async function renderEventsCatalogView(container) {
    container.innerHTML = '<div class="spinner"></div>';

    // 1. جلب الفعاليات النشطة والتحقق من الفعالية الجارية الآن
    const { data: events, error } = await supabase
        .from('HAJIBEVENT-events')
        .select('*')
        .eq('is_hidden', false)
        .order('start_date', { ascending: true });

    if (error) {
        container.innerHTML = '<p>تعذر جلب الفعاليات حالياً.</p>';
        return;
    }

    // جلب التقديمات الخاصة بالمستخدم الحالي
    let applications = [];
    if (AppState.user) {
        const { data: apps } = await supabase
            .from('HAJIBEVENT-applications')
            .select('event_id, status')
            .eq('freelancer_id', AppState.user.id);
        applications = apps || [];
    }

    const now = new Date();
    // الفعالية الحالية: إذا كان المستخدم مقبولاً فيها، والتاريخ الحالي يقع بين البداية والنهاية
    const activeApp = applications.find(a => a.status === 'approved');
    let currentLiveEvent = null;

    if (activeApp) {
        currentLiveEvent = events.find(e => {
            return e.id === activeApp.event_id &&
                   new Date(e.start_date) <= now &&
                   new Date(e.end_date) >= now;
        });
    }

    let html = '';

    // البانر العلوي للفعالية الحالية
    if (currentLiveEvent) {
        html += `
            <div class="live-event-banner">
                <div class="live-event-info">
                    <span class="live-badge">الفعالية الجارية الآن</span>
                    <h2>${currentLiveEvent.title}</h2>
                    <div class="live-meta">
                        <span>المدينة: ${currentLiveEvent.city}</span>
                        <span>النهاية: ${new Date(currentLiveEvent.end_date).toLocaleDateString('ar-SA')}</span>
                        <span>الأجر: ${currentLiveEvent.daily_rate} ريال / يوم</span>
                    </div>
                </div>
                <div>
                    <button class="btn btn-success" onclick="routeView('event_detail', '${currentLiveEvent.id}')">
                        التوجه لمركز الحضور الذكي
                    </button>
                </div>
            </div>
        `;
    }

    html += `<h2 class="section-title">جميع الفعاليات المتاحة للتقديم</h2>`;
    html += `<div class="events-grid">`;

    events.forEach(evt => {
        const userApp = applications.find(a => a.event_id === evt.id);
        let statusBadge = '';
        if (userApp) {
            if (userApp.status === 'approved') statusBadge = '<span class="badge badge-success">تم القبول</span>';
            else if (userApp.status === 'rejected') statusBadge = '<span class="badge badge-danger">مرفوض</span>';
            else statusBadge = '<span class="badge badge-warning">قيد المراجعة</span>';
        }

        html += `
            <div class="event-card">
                <div class="event-card-img">
                    <img src="${evt.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'}" alt="${evt.title}">
                </div>
                <div class="event-card-body">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h3 class="event-card-title">${evt.title}</h3>
                        ${statusBadge}
                    </div>
                    <div class="event-card-details">
                        <span>الموقع: ${evt.city}</span>
                        <span>الفترة: ${new Date(evt.start_date).toLocaleDateString('ar-SA')} - ${new Date(evt.end_date).toLocaleDateString('ar-SA')}</span>
                        <span class="rate-badge">${evt.daily_rate} ريال سعودي / يومياً</span>
                    </div>
                    <button class="btn btn-outline btn-full" style="margin-top:auto;" onclick="routeView('event_detail', '${evt.id}')">
                        عرض التفاصيل والشروط
                    </button>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// ==========================================
// 6. تفاصيل الفعالية، العقد وتسجيل الحضور الذكي
// ==========================================
async function renderEventDetailView(container, eventId) {
    container.innerHTML = '<div class="spinner"></div>';

    // جلب بيانات الفعالية والعقد
    const { data: event } = await supabase
        .from('HAJIBEVENT-events')
        .select('*')
        .eq('id', eventId)
        .single();

    const { data: contract } = await supabase
        .from('HAJIBEVENT-contracts')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

    let userApp = null;
    let attendanceLogs = [];

    if (AppState.user) {
        const { data: app } = await supabase
            .from('HAJIBEVENT-applications')
            .select('*')
            .eq('event_id', eventId)
            .eq('freelancer_id', AppState.user.id)
            .maybeSingle();
        userApp = app;

        // جلب سجلات الحضور والانصراف
        const { data: logs } = await supabase
            .from('HAJIBEVENT-attendance')
            .select('*')
            .eq('event_id', eventId)
            .eq('freelancer_id', AppState.user.id)
            .order('check_in_time', { ascending: false });
        attendanceLogs = logs || [];
    }

    const isCurrentSessionActive = attendanceLogs.length > 0 && !attendanceLogs[0].check_out_time;

    container.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <button class="btn btn-outline" onclick="routeView('events')">العودة للفعاليات</button>
        </div>

        <div class="auth-wrapper" style="max-width: 900px;">
            <h2>${event.title}</h2>
            <p style="color:var(--text-secondary); margin: 0.5rem 0 1.5rem;">
                المدينة: ${event.city} | النطاق المسموح: ${event.geofence_radius_meters} متر | الأجر: ${event.daily_rate} ريال
            </p>
            <div style="margin-bottom: 1.5rem;">
                <h4>وصف الفعالية</h4>
                <p style="margin-top: 0.3rem; line-height: 1.6;">${event.description}</p>
            </div>

            <div style="margin-bottom: 1.5rem; background:#f8fafc; padding:1.2rem; border-radius: var(--radius-md);">
                <h4>المسمى التعاقدي والشروط</h4>
                <p><strong>المنصب المطلوب:</strong> ${contract ? contract.required_position : 'عضو فريق تنظيم'}</p>
                <div style="margin-top: 0.5rem; font-size: 0.85rem; max-height: 120px; overflow-y:auto; border:1px solid var(--border); padding:0.8rem; background:#fff;">
                    ${contract ? contract.contract_terms : 'يلتزم الطرف الثاني بالمعايير المهنية والحضور في الوقت المحدد المحدد ضمن نطاق الفعالية الجغرافي والالتزام بالزي الرسمي.'}
                </div>
            </div>

            <!-- منطق التقديم وتوقيع العقد والحضور -->
            <div id="actionArea" style="border-top: 1px solid var(--border); padding-top: 1.5rem;">
                ${renderEventActionSection(event, userApp, isCurrentSessionActive)}
            </div>

            <!-- جدول سجل الحضور والانصراف -->
            <div style="margin-top: 2rem;">
                <h4>سجل الحضور والانصراف للفعالية</h4>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>تاريخ الجلسة</th>
                                <th>وقت تسجيل الحضور</th>
                                <th>وقت تسجيل الخروج</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${attendanceLogs.length === 0 ? '<tr><td colspan="4" style="text-align:center;">لا يوجد سجلات حضور حتى الآن</td></tr>' : ''}
                            ${attendanceLogs.map(log => `
                                <tr>
                                    <td>${new Date(log.check_in_time).toLocaleDateString('ar-SA')}</td>
                                    <td>${new Date(log.check_in_time).toLocaleTimeString('ar-SA')}</td>
                                    <td>${log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString('ar-SA') : 'جلسة قائمة'}</td>
                                    <td>${log.is_manual ? '<span class="badge badge-info">يدوي</span>' : '<span class="badge badge-success">ذاتي جيو-نطاق</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderEventActionSection(event, userApp, isCurrentSessionActive) {
    if (!AppState.user) {
        return `<button class="btn btn-primary" onclick="routeView('auth')">يرجى تسجيل الدخول للتقديم</button>`;
    }

    if (!userApp) {
        return `
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem;">
                    <input type="checkbox" id="contractAgreeCheck">
                    أوافق على بنود العقد والالتزام بالمهام والمواعيد
                </label>
                <button class="btn btn-primary" onclick="applyForEvent('${event.id}')">إرسال طلب التقديم</button>
            </div>
        `;
    }

    if (userApp.status === 'pending') {
        return `<div class="badge badge-warning" style="font-size:0.9rem; padding:0.6rem 1rem;">طلبك قيد الدراسة من قبل إدارة الفعالية</div>`;
    }

    if (userApp.status === 'rejected') {
        return `<div class="badge badge-danger" style="font-size:0.9rem; padding:0.6rem 1rem;">نعتذر منك، لم يتم قبول طلبك لهذه الفعالية</div>`;
    }

    // المستخدم مقبول (approved)
    const now = new Date();
    const isEventRunning = (now >= new Date(event.start_date) && now <= new Date(event.end_date));

    if (!isEventRunning) {
        return `<p style="color:var(--text-muted); font-size:0.9rem;">الفعالية خارج موعد التشغيل الحالي. (تاريخ البدء: ${new Date(event.start_date).toLocaleDateString('ar-SA')})</p>`;
    }

    if (isCurrentSessionActive) {
        return `
            <button class="btn btn-danger" onclick="triggerCheckOut('${event.id}', ${event.latitude}, ${event.longitude}, ${event.geofence_radius_meters})">
                تسجيل الخروج من الفعالية الآن
            </button>
        `;
    } else {
        return `
            <button class="btn btn-success" onclick="triggerCheckIn('${event.id}', ${event.latitude}, ${event.longitude}, ${event.geofence_radius_meters})">
                تسجيل الدخول للفعالية (فحص النطاق الجغرافي)
            </button>
        `;
    }
}

async function applyForEvent(eventId) {
    const agree = document.getElementById('contractAgreeCheck').checked;
    if (!agree) {
        showToast('يجب الموافقة على بنود العقد أولاً', 'error');
        return;
    }

    const { error } = await supabase.from('HAJIBEVENT-applications').insert({
        event_id: eventId,
        freelancer_id: AppState.user.id,
        contract_agreed: true,
        contract_agreed_at: new Date()
    });

    if (error) {
        showToast(error.message, 'error');
        return;
    }

    showToast('تم تقديم طلبك بنجاح', 'success');
    routeView('event_detail', eventId);
}

// تسجيل الحضور الذكي مع فحص Geolocation
function triggerCheckIn(eventId, targetLat, targetLng, maxRadius) {
    if (!navigator.geolocation) {
        showToast('متصفحك لا يدعم تحديد الموقع الجغرافي', 'error');
        return;
    }

    showToast('جاري التحقق من النطاق الجغرافي...', 'info');

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const dist = calculateDistanceInMeters(userLat, userLng, targetLat, targetLng);

        if (dist > maxRadius) {
            showToast(`أنت خارج النطاق الجغرافي المسموح! البعد الحالي: ${Math.round(dist)} متر (الحد الأقصى: ${maxRadius} متر)`, 'error');
            return;
        }

        const { error } = await supabase.from('HAJIBEVENT-attendance').insert({
            event_id: eventId,
            freelancer_id: AppState.user.id,
            check_in_time: new Date(),
            check_in_lat: userLat,
            check_in_lng: userLng
        });

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('تم تسجيل حضورك بنجاح داخل النطاق', 'success');
            routeView('event_detail', eventId);
        }
    }, (err) => {
        showToast('تعذر جلب موقعك: يرجى تفعيل الـ GPS والسماح بالوصول للموقع', 'error');
    }, { enableHighAccuracy: true });
}

// تسجيل الانصراف
function triggerCheckOut(eventId, targetLat, targetLng, maxRadius) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        // جلب أحدث جلسة نشطة
        const { data: openLogs } = await supabase
            .from('HAJIBEVENT-attendance')
            .select('id')
            .eq('event_id', eventId)
            .eq('freelancer_id', AppState.user.id)
            .is('check_out_time', null)
            .order('check_in_time', { ascending: false })
            .limit(1);

        if (!openLogs || openLogs.length === 0) {
            showToast('لا توجد جلسة حضور مفتوحة للتسجيل منها', 'error');
            return;
        }

        const logId = openLogs[0].id;
        const { error } = await supabase
            .from('HAJIBEVENT-attendance')
            .update({
                check_out_time: new Date(),
                check_out_lat: userLat,
                check_out_lng: userLng
            })
            .eq('id', logId);

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('تم تسجيل الانصراف بنجاح', 'success');
            routeView('event_detail', eventId);
        }
    }, () => {
        showToast('يرجى تفعيل صلاحية الموقع لتسجيل الخروج', 'error');
    }, { enableHighAccuracy: true });
}

// ==========================================
// 7. حسابي الشخصي (الفريلانسر)
// ==========================================
async function renderProfileView(container) {
    if (!AppState.profile) {
        container.innerHTML = '<p>جاري تحميل البيانات...</p>';
        return;
    }

    const p = AppState.profile;

    container.innerHTML = `
        <div class="auth-wrapper" style="max-width: 750px;">
            <h2 style="margin-bottom: 1.5rem;">ملفي التعريفي والشخصي</h2>
            <form onsubmit="handleProfileUpdate(event)">
                <div class="form-grid">
                    <!-- حقول ثابتة غير قابلة للتعديل حسب المتطلب -->
                    <div class="form-group">
                        <label>الاسم الرباعي (غير قابل للتعديل)</label>
                        <input type="text" class="form-control" value="${p.full_name}" disabled>
                    </div>
                    <div class="form-group">
                        <label>الجنسية (غير قابلة للتعديل)</label>
                        <input type="text" class="form-control" value="${p.nationality}" disabled>
                    </div>
                    <div class="form-group col-span-2">
                        <label>رقم الهوية / الإقامة (غير قابل للتعديل)</label>
                        <input type="text" class="form-control" value="${p.id_number}" disabled>
                    </div>

                    <!-- الحقول المتاح تعديلها -->
                    <div class="form-group">
                        <label>رقم الجوال</label>
                        <input type="tel" id="profPhone" class="form-control" value="${p.phone}" required>
                    </div>
                    <div class="form-group">
                        <label>المدينة</label>
                        <select id="profCity" class="form-control">
                            ${SAUDI_REGIONS.map(c => `<option value="${c}" ${c === p.city ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>فصيلة الدم</label>
                        <select id="profBlood" class="form-control">
                            ${BLOOD_TYPES.map(b => `<option value="${b}" ${b === p.blood_type ? 'selected' : ''}>${b}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>اللغات المتقنة</label>
                        <input type="text" id="profLanguages" class="form-control" value="${p.languages}">
                    </div>
                    <div class="form-group col-span-2">
                        <label>نبذة شخصية</label>
                        <textarea id="profBio" class="form-control" rows="3">${p.bio || ''}</textarea>
                    </div>
                    <div class="form-group col-span-2">
                        <label>السيرة الذاتية الحالية</label>
                        <div>
                            ${p.cv_url ? `<a href="${p.cv_url}" target="_blank" class="btn btn-outline" style="font-size:0.85rem;">استعراض وتحميل السيرة الذاتية (CV)</a>` : 'لم يتم إرفاق ملف'}
                        </div>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;">حفظ التغييرات</button>
            </form>
        </div>
    `;
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const updatePayload = {
        phone: document.getElementById('profPhone').value,
        city: document.getElementById('profCity').value,
        blood_type: document.getElementById('profBlood').value,
        languages: document.getElementById('profLanguages').value,
        bio: document.getElementById('profBio').value,
        updated_at: new Date()
    };

    const { error } = await supabase
        .from('HAJIBEVENT-profiles')
        .update(updatePayload)
        .eq('id', AppState.user.id);

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('تم تحديث البيانات الشخصية بنجاح', 'success');
        AppState.profile = { ...AppState.profile, ...updatePayload };
    }
}

// ==========================================
// 8. لوحة إدارة الفعاليات (Admin)
// ==========================================
async function renderAdminEventsView(container) {
    container.innerHTML = '<div class="spinner"></div>';

    const { data: events } = await supabase
        .from('HAJIBEVENT-events')
        .select('*')
        .order('start_date', { ascending: false });

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
            <h2>إدارة جميع الفعاليات</h2>
            <button class="btn btn-primary" onclick="openNewEventModal()">إضافة فعالية جديدة</button>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>اسم الفعالية</th>
                        <th>المدينة</th>
                        <th>الفترة</th>
                        <th>الأجر اليومي</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${(events || []).map(ev => `
                        <tr>
                            <td><strong>${ev.title}</strong></td>
                            <td>${ev.city}</td>
                            <td>${new Date(ev.start_date).toLocaleDateString('ar-SA')} إلى ${new Date(ev.end_date).toLocaleDateString('ar-SA')}</td>
                            <td>${ev.daily_rate} ريال</td>
                            <td>${ev.is_hidden ? '<span class="badge badge-warning">مخفية</span>' : '<span class="badge badge-success">نشطة</span>'}</td>
                            <td style="display:flex; gap:0.4rem;">
                                <button class="btn btn-outline" style="padding:0.3rem 0.6rem;" onclick="openManageApplicantsModal('${ev.id}')">الكوادر المتقدمة</button>
                                <button class="btn btn-outline" style="padding:0.3rem 0.6rem;" onclick="toggleHideEvent('${ev.id}', ${ev.is_hidden})">${ev.is_hidden ? 'إظهار' : 'إخفاء'}</button>
                                <button class="btn btn-danger" style="padding:0.3rem 0.6rem;" onclick="deleteEvent('${ev.id}')">حذف</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

function openNewEventModal() {
    const modalContent = `
        <h3>إضافة فعالية تشغيلية جديدة</h3>
        <form onsubmit="handleCreateEventSubmit(event)" style="margin-top:1rem;">
            <div class="form-grid">
                <div class="form-group col-span-2">
                    <label>اسم الفعالية</label>
                    <input type="text" id="evTitle" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>رابط الصورة الغلاف</label>
                    <input type="url" id="evImageUrl" class="form-control" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label>المدينة</label>
                    <select id="evCity" class="form-control" required>
                        ${SAUDI_REGIONS.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>تاريخ ووقت البداية</label>
                    <input type="datetime-local" id="evStart" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>تاريخ ووقت النهاية</label>
                    <input type="datetime-local" id="evEnd" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>الأجر اليومي (ريال)</label>
                    <input type="number" id="evRate" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>نصف قطر النطاق المسموح (متر)</label>
                    <input type="number" id="evRadius" class="form-control" value="300" required>
                </div>
                <div class="form-group">
                    <label>خط العرض (Latitude)</label>
                    <input type="number" step="any" id="evLat" class="form-control" required placeholder="24.7136">
                </div>
                <div class="form-group">
                    <label>خط الطول (Longitude)</label>
                    <input type="number" step="any" id="evLng" class="form-control" required placeholder="46.6753">
                </div>
                <div class="form-group col-span-2">
                    <label>وصف الفعالية والمهام</label>
                    <textarea id="evDesc" class="form-control" rows="2" required></textarea>
                </div>
                <div class="form-group col-span-2">
                    <label>صيغة العقد والشروط الملزمة</label>
                    <textarea id="evContractTerms" class="form-control" rows="2" placeholder="اكتب شروط العقد للمتقدمين..." required></textarea>
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.2rem;">حفظ ونشر الفعالية</button>
        </form>
    `;
    openModal(modalContent);
}

async function handleCreateEventSubmit(e) {
    e.preventDefault();
    const eventPayload = {
        title: document.getElementById('evTitle').value,
        image_url: document.getElementById('evImageUrl').value,
        city: document.getElementById('evCity').value,
        start_date: new Date(document.getElementById('evStart').value),
        end_date: new Date(document.getElementById('evEnd').value),
        daily_rate: parseFloat(document.getElementById('evRate').value),
        geofence_radius_meters: parseInt(document.getElementById('evRadius').value),
        latitude: parseFloat(document.getElementById('evLat').value),
        longitude: parseFloat(document.getElementById('evLng').value),
        description: document.getElementById('evDesc').value
    };

    const { data: createdEvent, error } = await supabase
        .from('HAJIBEVENT-events')
        .insert(eventPayload)
        .select()
        .single();

    if (error) {
        showToast(error.message, 'error');
        return;
    }

    // حفظ العقد التابع للفعالية
    await supabase.from('HAJIBEVENT-contracts').insert({
        event_id: createdEvent.id,
        required_position: "عضو تشغيل ميداني",
        contract_terms: document.getElementById('evContractTerms').value
    });

    closeModal();
    showToast('تم إنشاء الفعالية وإتاحتها بنجاح', 'success');
    routeView('admin_events');
}

async function toggleHideEvent(eventId, currentHiddenState) {
    await supabase.from('HAJIBEVENT-events').update({ is_hidden: !currentHiddenState }).eq('id', eventId);
    showToast('تم تحديث حالة الظهور', 'success');
    routeView('admin_events');
}

async function deleteEvent(eventId) {
    if (!confirm('هل أنت متأكد من حذف الفعالية بالكامل مع جميع سجلاتها؟')) return;
    await supabase.from('HAJIBEVENT-events').delete().eq('id', eventId);
    showToast('تم حذف الفعالية', 'success');
    routeView('admin_events');
}

// إدارة المتقدمين والتواصل معهم
async function openManageApplicantsModal(eventId) {
    const { data: apps } = await supabase
        .from('HAJIBEVENT-applications')
        .select(`
            id, status, applied_at,
            freelancer:freelancer_id (
                id, full_name, phone, email, cv_url, city
            )
        `)
        .eq('event_id', eventId);

    let html = `
        <h3>إدارة الكوادر المتقدمة للفعالية</h3>
        <div class="table-responsive" style="max-height: 400px; overflow-y:auto; margin-top: 1rem;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>المدينة</th>
                        <th>الحالة</th>
                        <th>التواصل والسيرة</th>
                        <th>القرار</th>
                    </tr>
                </thead>
                <tbody>
                    ${(!apps || apps.length === 0) ? '<tr><td colspan="5" style="text-align:center;">لا يوجد متقدمين حتى اللحظة</td></tr>' : ''}
                    ${(apps || []).map(a => `
                        <tr>
                            <td><strong>${a.freelancer.full_name}</strong></td>
                            <td>${a.freelancer.city}</td>
                            <td><span class="badge ${a.status === 'approved' ? 'badge-success' : (a.status === 'rejected' ? 'badge-danger' : 'badge-warning')}">${a.status}</span></td>
                            <td style="display:flex; gap:0.3rem;">
                                <a href="https://wa.me/${a.freelancer.phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;">واتساب</a>
                                <a href="tel:${a.freelancer.phone}" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;">اتصال</a>
                                ${a.freelancer.cv_url ? `<a href="${a.freelancer.cv_url}" target="_blank" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;">السيرة الذاتية</a>` : ''}
                            </td>
                            <td>
                                <button class="btn btn-success" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="setApplicantStatus('${a.id}', 'approved', '${eventId}')">قبول</button>
                                <button class="btn btn-danger" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="setApplicantStatus('${a.id}', 'rejected', '${eventId}')">رفض</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    openModal(html);
}

async function setApplicantStatus(appId, status, eventId) {
    await supabase.from('HAJIBEVENT-applications').update({ status }).eq('id', appId);
    showToast(`تم ${status === 'approved' ? 'قبول' : 'رفض'} المرشح بنجاح`, 'info');
    openManageApplicantsModal(eventId);
}

// ==========================================
// 9. إدارة الحضور والنطاق والتسجيل اليدوي (Admin)
// ==========================================
async function renderAdminAttendanceView(container) {
    container.innerHTML = '<div class="spinner"></div>';

    const { data: events } = await supabase.from('HAJIBEVENT-events').select('id, title');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
            <h2>تقارير وسجلات الحضور الميداني</h2>
            <button class="btn btn-primary" onclick="openManualAttendanceModal()">تسجيل حضور يدوي طارئ</button>
        </div>

        <div style="background:#fff; border:1px solid var(--border); border-radius:var(--radius-md); padding:1rem; margin-bottom: 1.5rem; display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end;">
            <div class="form-group">
                <label>اختر الفعالية</label>
                <select id="filterEvent" class="form-control">
                    <option value="">جميع الفعاليات</option>
                    ${(events || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>من تاريخ</label>
                <input type="date" id="filterFromDate" class="form-control">
            </div>
            <div class="form-group">
                <label>إلى تاريخ</label>
                <input type="date" id="filterToDate" class="form-control">
            </div>
            <button class="btn btn-outline" onclick="fetchAttendanceReports()">تصفية وعرض النتائج</button>
        </div>

        <div id="attendanceReportTable">
            <!-- سيتم تحميل الجدول ديناميكياً -->
        </div>
    `;

    fetchAttendanceReports();
}

async function fetchAttendanceReports() {
    const tableContainer = document.getElementById('attendanceReportTable');
    tableContainer.innerHTML = '<div class="spinner"></div>';

    const eventId = document.getElementById('filterEvent').value;
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;

    let query = supabase
        .from('HAJIBEVENT-attendance')
        .select(`
            id, check_in_time, check_out_time, is_manual,
            freelancer:freelancer_id (full_name, phone, id_number),
            event:event_id (title)
        `)
        .order('check_in_time', { ascending: false });

    if (eventId) query = query.eq('event_id', eventId);
    if (fromDate) query = query.gte('check_in_time', new Date(fromDate).toISOString());
    if (toDate) query = query.lte('check_in_time', new Date(toDate + 'T23:59:59').toISOString());

    const { data: logs, error } = await query;

    if (error) {
        tableContainer.innerHTML = '<p>حدث خطأ أثناء تحميل السجلات.</p>';
        return;
    }

    tableContainer.innerHTML = `
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الموظف</th>
                        <th>رقم الهوية</th>
                        <th>الفعالية</th>
                        <th>وقت الدخول</th>
                        <th>وقت الخروج</th>
                        <th>نوع التحضير</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.length === 0 ? '<tr><td colspan="6" style="text-align:center;">لا توجد سجلات تطابق البحث</td></tr>' : ''}
                    ${logs.map(l => `
                        <tr>
                            <td><strong>${l.freelancer?.full_name || 'غير معروف'}</strong></td>
                            <td>${l.freelancer?.id_number || '-'}</td>
                            <td>${l.event?.title || '-'}</td>
                            <td>${new Date(l.check_in_time).toLocaleString('ar-SA')}</td>
                            <td>${l.check_out_time ? new Date(l.check_out_time).toLocaleString('ar-SA') : 'جلسة قائمة'}</td>
                            <td>${l.is_manual ? '<span class="badge badge-warning">يدوي من الإدارة</span>' : '<span class="badge badge-success">ذاتي جيو-نطاق</span>'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// نافذة التحضير اليدوي في حالات الطوارئ وانقطاع الإنترنت
async function openManualAttendanceModal() {
    const { data: events } = await supabase.from('HAJIBEVENT-events').select('id, title');
    const { data: profiles } = await supabase.from('HAJIBEVENT-profiles').select('id, full_name, id_number');

    const html = `
        <h3>تسجيل حضور يدوي استثنائي</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">مخصص للحالات الطارئة: نفاذ بطارية الموظف أو مشاكل الشبكة الميدانية</p>
        <form onsubmit="handleManualAttendanceSubmit(event)">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>اختر الفعالية</label>
                <select id="manEventId" class="form-control" required>
                    ${(events || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>اختر الموظف / الفريلانسر</label>
                <select id="manFreelancerId" class="form-control" required>
                    ${(profiles || []).map(p => `<option value="${p.id}">${p.full_name} (${p.id_number})</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>وقت الحضور</label>
                <input type="datetime-local" id="manCheckIn" class="form-control" required>
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>وقت الانصراف (اختياري)</label>
                <input type="datetime-local" id="manCheckOut" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary btn-full">تأكيد التسجيل اليدوي</button>
        </form>
    `;
    openModal(html);
}

async function handleManualAttendanceSubmit(e) {
    e.preventDefault();
    const eventId = document.getElementById('manEventId').value;
    const freelancerId = document.getElementById('manFreelancerId').value;
    const checkIn = document.getElementById('manCheckIn').value;
    const checkOut = document.getElementById('manCheckOut').value;

    const payload = {
        event_id: eventId,
        freelancer_id: freelancerId,
        check_in_time: new Date(checkIn),
        check_out_time: checkOut ? new Date(checkOut) : null,
        is_manual: true,
        manual_logged_by: AppState.user.id
    };

    const { error } = await supabase.from('HAJIBEVENT-attendance').insert(payload);
    if (error) {
        showToast(error.message, 'error');
    } else {
        closeModal();
        showToast('تم تسجيل الحضور اليدوي بنجاح', 'success');
        fetchAttendanceReports();
    }
}

// ==========================================
// 10. إدارة المديرين والصلاحيات
// ==========================================
async function renderAdminManagersView(container) {
    container.innerHTML = '<div class="spinner"></div>';

    const { data: managers } = await supabase.from('HAJIBEVENT-managers').select('*');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
            <h2>حسابات مديري الفعاليات والصلاحيات</h2>
            <button class="btn btn-primary" onclick="openAddManagerModal()">إضافة مدير جديد</button>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>البريد الإلكتروني</th>
                        <th>نطاق الصلاحيات<