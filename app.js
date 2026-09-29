/**
 * منصة HAJIB-EVENTS لإدارة الفعاليات والكوادر المستقلة
 * كود برمجي نظيف ومحمي بالكامل - بدون أطر عمل خارجية وبدون إيموجي
 */

// إعدادات الاتصال بـ Supabase (ضع مفاتيحك هنا)
const SUPABASE_URL = "https://cbyjokrlnnkihjhixdyz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AwLUhkBI0-7GxUpVkAUK2Q_5jPaVpqe";

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// حالة التطبيق العامة (Application State)
const AppState = {
    user: null,
    profile: null,
    isManager: false,
    managerData: null,
    currentView: 'events'
};

// البيانات الثابتة
const GCC_NATIONALITIES = ["سعودي", "إماراتي", "كويتي", "عماني", "قطري", "بحريني"];
const SAUDI_REGIONS = ["الرياض", "مكة المكرمة", "المدينة المنورة", "القصيم", "المنطقة الشرقية", "عسير", "تبوك", "حائل", "الحدود الشمالية", "جازان", "نجران", "الباحة", "الجوف"];
const ID_TYPES = ["هوية وطنية", "إقامة نظامية", "جواز سفر خليجي"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ----------------------------------------------------
// الدوال المساعدة (Helpers)
// ----------------------------------------------------
function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function openModal(htmlContent) {
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;
    body.innerHTML = htmlContent;
    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;
    modal.classList.add('hidden');
    body.innerHTML = '';
}

// ----------------------------------------------------
// إدارة الجلسات والمصادقة (Auth & Sessions)
// ----------------------------------------------------
async function initApp() {
    if (!supabase) {
        console.error("Supabase client is not initialized.");
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
            AppState.user = session.user;
            await fetchUserData(session.user.id);
        }
    } catch (err) {
        console.error("Session fetch error:", err);
    } finally {
        updateNavbar();
        routeView(AppState.user ? 'events' : 'auth');
    }
}

async function fetchUserData(userId) {
    try {
        const { data: mgr } = await supabase
            .from('HAJIBEVENT-managers')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (mgr) {
            AppState.isManager = true;
            AppState.managerData = mgr;
        }

        const { data: prof } = await supabase
            .from('HAJIBEVENT-profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        AppState.profile = prof || null;
    } catch (err) {
        console.error("Error fetching user data:", err);
    }
}

function updateNavbar() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

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

// ----------------------------------------------------
// محرك التوجيه (Router)
// ----------------------------------------------------
function routeView(view, payload = null) {
    AppState.currentView = view;
    const root = document.getElementById('appRoot');
    if (!root) return;

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
            root.innerHTML = '<p style="text-align:center; padding:2rem;">الصفحة المطلوبة غير موجودة.</p>';
            break;
    }
}

// ----------------------------------------------------
// واجهات الفريلانسر والمصادقة
// ----------------------------------------------------
function renderAuthView(container) {
    container.innerHTML = `
        <div class="auth-wrapper">
            <div class="auth-tabs">
                <div class="auth-tab active" id="tabLogin" onclick="toggleAuthTab('login')">تسجيل الدخول</div>
                <div class="auth-tab" id="tabRegister" onclick="toggleAuthTab('register')">إنشاء حساب فريلانسر</div>
            </div>

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

    if (!loginForm || !registerForm) return;

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
    const email = document.getElementById('loginEmail').value.trim();
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
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const fullName = document.getElementById('regFullName').value.trim();
    const cvFile = document.getElementById('regCV').files[0];
    const avatarFile = document.getElementById('regAvatar').files[0];

    showToast('جاري إنشاء الحساب ورفع الملفات...', 'info');

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
        showToast(authError.message, 'error');
        return;
    }

    const userId = authData.user.id;
    let cvUrl = '';
    let avatarUrl = '';

    if (cvFile) {
        const ext = cvFile.name.split('.').pop();
        const path = `cvs/${userId}_${Date.now()}.${ext}`;
        const { error: cvErr } = await supabase.storage.from('cvs').upload(path, cvFile);
        if (!cvErr) {
            const { data } = supabase.storage.from('cvs').getPublicUrl(path);
            cvUrl = data.publicUrl;
        }
    }

    if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `avatars/${userId}_${Date.now()}.${ext}`;
        const { error: avErr } = await supabase.storage.from('avatars').upload(path, avatarFile);
        if (!avErr) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(path);
            avatarUrl = data.publicUrl;
        }
    }

    const profilePayload = {
        id: userId,
        full_name: fullName,
        email: email,
        phone: document.getElementById('regPhone').value.trim(),
        dob: document.getElementById('regDob').value,
        id_number: document.getElementById('regIdNumber').value.trim(),
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
    showToast('تم إتمام التسجيل بنجاح في المنصة', 'success');
    routeView('events');
}

function renderAdminLoginView(container) {
    container.innerHTML = `
        <div class="auth-wrapper" style="max-width: 420px;">
            <h2 style="margin-bottom: 0.5rem; text-align: center;">بوابة مديري الفعاليات</h2>
            <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-bottom: 1.5rem;">تسجيل الدخول للمسؤولين المعتمدين فقط</p>
            <form onsubmit="handleAdminLoginSubmit(event)">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>البريد الإلكتروني للإدارة</label>
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
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        showToast(error.message, 'error');
        return;
    }

    const { data: mgr } = await supabase
        .from('HAJIBEVENT-managers')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

    if (!mgr) {
        await supabase.auth.signOut();
        showToast('هذا الحساب ليس لديه صلاحية وصول إدارية.', 'error');
        return;
    }

    AppState.user = data.user;
    AppState.isManager = true;
    AppState.managerData = mgr;
    updateNavbar();
    showToast('تم تسجيل الدخول بصلاحيات الإدارة', 'success');
    routeView('admin_events');
}

// ----------------------------------------------------
// عرض الفعاليات والتقديم
// ----------------------------------------------------
async function renderEventsCatalogView(container) {
    container.innerHTML = '<div class="spinner"></div>';

    const { data: events, error } = await supabase
        .from('HAJIBEVENT-events')
        .select('*')
        .eq('is_hidden', false)
        .order('start_date', { ascending: true });

    if (error) {
        container.innerHTML = '<p style="text-align:center;">تعذر تحميل الفعاليات حالياً.</p>';
        return;
    }

    let applications = [];
    if (AppState.user) {
        const { data: apps } = await supabase
            .from('HAJIBEVENT-applications')
            .select('event_id, status')
            .eq('freelancer_id', AppState.user.id);
        applications = apps || [];
    }

    const now = new Date();
    const approvedApps = applications.filter(a => a.status === 'approved').map(a => a.event_id);
    
    // الفعالية الجارية الآن والمقبول بها المستخدم
    const currentLiveEvent = (events || []).find(e => {
        return approvedApps.includes(e.id) &&
               new Date(e.start_date) <= now &&
               new Date(e.end_date) >= now;
    });

    let html = '';

    if (currentLiveEvent) {
        html += `
            <div class="live-event-banner">
                <div class="live-event-info">
                    <span class="live-badge">الفعالية الجارية الآن</span>
                    <h2>${currentLiveEvent.title}</h2>
                    <div class="live-meta">
                        <span>المدينة: ${currentLiveEvent.city}</span>
                        <span>النهاية: ${new Date(currentLiveEvent.end_date).toLocaleDateString('ar-SA')}</span>
                        <span>الأجر اليومي: ${currentLiveEvent.daily_rate} ريال</span>
                    </div>
                </div>
                <div>
                    <button class="btn btn-success" onclick="routeView('event_detail', '${currentLiveEvent.id}')">
                        التوجه لتسجيل الحضور الذكي
                    </button>
                </div>
            </div>
        `;
    }

    html += `<h2 class="section-title">جميع الفعاليات المتاحة</h2>`;
    html += `<div class="events-grid">`;

    if (!events || events.length === 0) {
        html += `<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted);">لا توجد فعاليات متاحة حالياً.</p>`;
    } else {
        events.forEach(evt => {
            const userApp = applications.find(a => a.event_id === evt.id);
            let badgeHtml = '';
            if (userApp) {
                if (userApp.status === 'approved') badgeHtml = '<span class="badge badge-success">تم القبول</span>';
                else if (userApp.status === 'rejected') badgeHtml = '<span class="badge badge-danger">مرفوض</span>';
                else badgeHtml = '<span class="badge badge-warning">قيد المراجعة</span>';
            }

            html += `
                <div class="event-card">
                    <div class="event-card-img">
                        <img src="${evt.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'}" alt="${evt.title}">
                    </div>
                    <div class="event-card-body">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <h3 class="event-card-title">${evt.title}</h3>
                            ${badgeHtml}
                        </div>
                        <div class="event-card-details">
                            <span>المدينة: ${evt.city}</span>
                            <span>الفترة: ${new Date(evt.start_date).toLocaleDateString('ar-SA')} - ${new Date(evt.end_date).toLocaleDateString('ar-SA')}</span>
                            <span class="rate-badge">${evt.daily_rate} ريال / اليوم</span>
                        </div>
                        <button class="btn btn-outline btn-full" style="margin-top:auto;" onclick="routeView('event_detail', '${evt.id}')">
                            تفاصيل الفعالية والعقد
                        </button>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ----------------------------------------------------
// تفاصيل الفعالية وتسجيل الحضور والانصراف
// ----------------------------------------------------
async function renderEventDetailView(container, eventId) {
    container.innerHTML = '<div class="spinner"></div>';

    const { data: event, error: evtErr } = await supabase
        .from('HAJIBEVENT-events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (evtErr || !event) {
        container.innerHTML = '<p style="text-align:center;">لم يتم العثور على الفعالية المطلوبة.</p>';
        return;
    }

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
            <button class="btn btn-outline" onclick="routeView('events')">العودة لقائمة الفعاليات</button>
        </div>

        <div class="auth-wrapper" style="max-width: 900px;">
            <h2>${event.title}</h2>
            <p style="color:var(--text-secondary); margin: 0.5rem 0 1.5rem;">
                المدينة: ${event.city} | النطاق المسموح به للحضور: ${event.geofence_radius_meters} متر | الأجر اليومي: ${event.daily_rate} ريال
            </p>

            <div style="margin-bottom: 1.5rem;">
                <h4>وصف الفعالية والمهام</h4>
                <p style="margin-top: 0.4rem; line-height: 1.6;">${event.description}</p>
            </div>

            <div style="margin-bottom: 1.5rem; background:#f8fafc; padding:1.2rem; border-radius: var(--radius-md); border:1px solid var(--border);">
                <h4>المسمى التعاقدي وبنود الاتفاقية</h4>
                <p style="margin-top:0.3rem;"><strong>المنصب المطلوب:</strong> ${contract ? contract.required_position : 'عضو فريق التنظيم الميداني'}</p>
                <div style="margin-top: 0.6rem; font-size: 0.85rem; max-height: 120px; overflow-y:auto; border:1px solid var(--border); padding:0.8rem; background:#fff; line-height: 1.6;">
                    ${contract ? contract.contract_terms : 'يلتزم الطرف الثاني بالمعايير المهنية والحضور في الوقت المحدد والمكان المخصص ضمن النطاق الجغرافي المحدد.'}
                </div>
            </div>

            <div id="actionArea" style="border-top: 1px solid var(--border); padding-top: 1.5rem;">
                ${renderActionButtons(event, userApp, isCurrentSessionActive)}
            </div>

            <div style="margin-top: 2rem;">
                <h4>سجل الحضور والانصراف الخاص بك</h4>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>تاريخ الجلسة</th>
                                <th>وقت تسجيل الدخول</th>
                                <th>وقت تسجيل الخروج</th>
                                <th>النوع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${attendanceLogs.length === 0 ? '<tr><td colspan="4" style="text-align:center;">لا يوجد سجل حضور مسجل حتى الآن</td></tr>' : ''}
                            ${attendanceLogs.map(log => `
                                <tr>
                                    <td>${new Date(log.check_in_time).toLocaleDateString('ar-SA')}</td>
                                    <td>${new Date(log.check_in_time).toLocaleTimeString('ar-SA')}</td>
                                    <td>${log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString('ar-SA') : 'جلسة قائمة'}</td>
                                    <td>${log.is_manual ? '<span class="badge badge-info">تسجيل إداري يدوي</span>' : '<span class="badge badge-success">ذاتي عبر النطاق</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderActionButtons(event, userApp, isCurrentSessionActive) {
    if (!AppState.user) {
        return `<button class="btn btn-primary" onclick="routeView('auth')">يرجى تسجيل الدخول للتقديم</button>`;
    }

    if (!userApp) {
        return `
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem;">
                    <input type="checkbox" id="contractAgreeCheck">
                    أوافق على بنود العقد والشروط المذكورة أعلاه والتزم بالمهام
                </label>
                <button class="btn btn-primary" onclick="applyForEvent('${event.id}')">إرسال طلب التقديم</button>
            </div>
        `;
    }

    if (userApp.status === 'pending') {
        return `<span class="badge badge-warning" style="font-size:0.9rem; padding:0.6rem 1rem;">طلبك قيد الدراسة لدى إدارة الفعالية</span>`;
    }

    if (userApp.status === 'rejected') {
        return `<span class="badge badge-danger" style="font-size:0.9rem; padding:0.6rem 1rem;">نعتذر منك، لم يتم قبول طلب التقديم</span>`;
    }

    const now = new Date();
    const isRunning = (now >= new Date(event.start_date) && now <= new Date(event.end_date));

    if (!isRunning) {
        return `<p style="color:var(--text-muted); font-size:0.9rem;">الفعالية خارج فترة التشغيل الحالية.</p>`;
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
    const agree = document.getElementById('contractAgreeCheck');
    if (!agree || !agree.checked) {
        showToast('يجب الموافقة على شروط العقد أولاً', 'error');
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

function triggerCheckIn(eventId, targetLat, targetLng, maxRadius) {
    if (!navigator.geolocation) {
        showToast('المتصفح لا يدعم تحديد الموقع الجغرافي', 'error');
        return;
    }

    showToast('جاري التحقق من النطاق الجغرافي...', 'info');

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const distance = calculateDistanceInMeters(userLat, userLng, targetLat, targetLng);

        if (distance > maxRadius) {
            showToast(`أنت خارج النطاق الجغرافي المسموح! المسافة الحالية: ${Math.round(distance)} متر (الحد الأقصى: ${maxRadius} متر)`, 'error');
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
            showToast('تم تسجيل الحضور بنجاح داخل النطاق', 'success');
            routeView('event_detail', eventId);
        }
    }, () => {
        showToast('يرجى تمكين صلاحية الوصول للموقع في المتصفح', 'error');
    }, { enableHighAccuracy: true });
}

function triggerCheckOut(eventId, targetLat, targetLng, maxRadius) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

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

// ----------------------------------------------------
// حسابي الشخصي (الملف الشخصي)
// ----------------------------------------------------
function renderProfileView(container) {
    if (!AppState.profile) {
        container.innerHTML = '<p style="text-align:center;">جاري تحميل البيانات الشخصية...</p>';
        return;
    }

    const p = AppState.profile;

    container.innerHTML = `
        <div class="auth-wrapper" style="max-width: 750px;">
            <h2 style="margin-bottom: 1.5rem;">ملفي التعريفي والشخصي</h2>
            <form onsubmit="handleProfileUpdate(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label>الاسم الرباعي الكامل (ثابت)</label>
                        <input type="text" class="form-control" value="${p.full_name}" disabled>
                    </div>
                    <div class="form-group">
                        <label>الجنسية (ثابت)</label>
                        <input type="text" class="form-control" value="${p.nationality}" disabled>
                    </div>
                    <div class="form-group col-span-2">
                        <label>رقم الهوية / الإقامة (ثابت)</label>
                        <input type="text" class="form-control" value="${p.id_number}" disabled>
                    </div>

                    <div class="form-group">
                        <label>رقم الجوال</label>
                        <input type="tel" id="profPhone" class="form-control" value="${p.phone}" required>
                    </div>
                    <div class="form-group">
                        <label>المدينة / المنطقة</label>
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
                        <label>نبذة مهنية</label>
                        <textarea id="profBio" class="form-control" rows="3">${p.bio || ''}</textarea>
                    </div>
                    <div class="form-group col-span-2">
                        <label>السيرة الذاتية (CV)</label>
                        <div>
                            ${p.cv_url ? `<a href="${p.cv_url}" target="_blank" class="btn btn-outline" style="font-size:0.85rem;">استعراض وتحميل السيرة الذاتية الحالية</a>` : 'لم يتم تحميل سيرة ذاتية'}
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
        phone: document.getElementById('profPhone').value.trim(),
        city: document.getElementById('profCity').value,
        blood_type: document.getElementById('profBlood').value,
        languages: document.getElementById('profLanguages').value.trim(),
        bio: document.getElementById('profBio').value.trim(),
        updated_at: new Date()
    };

    const { error } = await supabase
        .from('HAJIBEVENT-profiles')
        .update(updatePayload)
        .eq('id', AppState.user.id);

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('تم حفظ البيانات الشخصية بنجاح', 'success');
        AppState.profile = { ...AppState.profile, ...updatePayload };
    }
}

// ----------------------------------------------------
// لوحة الإدارة: الفعاليات
// ----------------------------------------------------
async function renderAdminEventsView(container) {
    container.innerHTML = '<div class="spinner"></div>';

    const { data: events } = await supabase
        .from('HAJIBEVENT-events')
        .select('*')
        .order('start_date', { ascending: false });

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
            <h2>إدارة ومتابعة الفعاليات</h2>
            <button class="btn btn-primary" onclick="openNewEventModal()">إضافة فعالية جديدة</button>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الفعالية</th>
                        <th>المدينة</th>
                        <th>الفترة الزمنية</th>
                        <th>الأجر اليومي</th>
                        <th>الحالة</th>
                        <th>العمليات</th>
                    </tr>
                </thead>
                <tbody>
                    ${(!events || events.length === 0) ? '<tr><td colspan="6" style="text-align:center;">لا توجد فعاليات مسجلة</td></tr>' : ''}
                    ${(events || []).map(ev => `
                        <tr>
                            <td><strong>${ev.title}</strong></td>
                            <td>${ev.city}</td>
                            <td>${new Date(ev.start_date).toLocaleDateString('ar-SA')} إلى ${new Date(ev.end_date).toLocaleDateString('ar-SA')}</td>
                            <td>${ev.daily_rate} ريال</td>
                            <td>${ev.is_hidden ? '<span class="badge badge-warning">مخفية</span>' : '<span class="badge badge-success">نشطة</span>'}</td>
                            <td style="display:flex; gap:0.4rem;">
                                <button class="btn btn-outline" style="padding:0.3rem 0.6rem;" onclick="openManageApplicantsModal('${ev.id}')">الكوادر</button>
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
        <h3>إضافة فعالية جديدة</h3>
        <form onsubmit="handleCreateEventSubmit(event)" style="margin-top:1rem;">
            <div class="form-grid">
                <div class="form-group col-span-2">
                    <label>اسم الفعالية</label>
                    <input type="text" id="evTitle" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>رابط الصورة</label>
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
                    <label>نطاق الحضور المسموح (متر)</label>
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
                    <label>الوصف والمهام</label>
                    <textarea id="evDesc" class="form-control" rows="2" required></textarea>
                </div>
                <div class="form-group col-span-2">
                    <label>صيغة العقد والشروط</label>
                    <textarea id="evContractTerms" class="form-control" rows="2" required></textarea>
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.2rem;">نشر الفعالية</button>
        </form>
    `;
    openModal(modalContent);
}

async function handleCreateEventSubmit(e) {
    e.preventDefault();
    const eventPayload = {
        title: document.getElementById('evTitle').value.trim(),
        image_url: document.getElementById('evImageUrl').value.trim(),
        city: document.getElementById('evCity').value,
        start_date: new Date(document.getElementById('evStart').value),
        end_date: new Date(document.getElementById('evEnd').value),
        daily_rate: parseFloat(document.getElementById('evRate').value),
        geofence_radius_meters: parseInt(document.getElementById('evRadius').value, 10),
        latitude: parseFloat(document.getElementById('evLat').value),
        longitude: parseFloat(document.getElementById('evLng').value),
        description: document.getElementById('evDesc').value.trim()
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

    await supabase.from('HAJIBEVENT-contracts').insert({
        event_id: createdEvent.id,
        required_position: "عضو تشغيل ميداني",
        contract_terms: document.getElementById('evContractTerms').value.trim()
    });

    closeModal();
    showToast('تمت إضافة الفعالية بنجاح', 'success');
    routeView('admin_events');
}

async function toggleHideEvent(eventId, currentHiddenState) {
    await supabase.from('HAJIBEVENT-events').update({ is_hidden: !currentHiddenState }).eq('id', eventId);
    showToast('تم تعديل حالة ظهور الفعالية', 'success');
    routeView('admin_events');
}

async function deleteEvent(eventId) {
    if (!confirm('هل أنت متأكد من حذف هذه الفعالية نهائياً؟')) return;
    await supabase.from('HAJIBEVENT-events').delete().eq('id', eventId);
    showToast('تم حذف الفعالية', 'success');
    routeView('admin_events');
}

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
        <h3>الكوادر المتقدمة للفعالية</h3>
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
                    ${(!apps || apps.length === 0) ? '<tr><td colspan="5" style="text-align:center;">لا يوجد متقدمين بعد</td></tr>' : ''}
                    ${(apps || []).map(a => {
                        const phoneSanitized = (a.freelancer?.phone || '').replace(/[^0-9]/g, '');
                        return `
                            <tr>
                                <td><strong>${a.freelancer ? a.freelancer.full_name : 'غير محدد'}</strong></td>
                                <td>${a.freelancer ? a.freelancer.city : '-'}</td>
                                <td><span class="badge ${a.status === 'approved' ? 'badge-success' : (a.status === 'rejected' ? 'badge-danger' : 'badge-warning')}">${a.status}</span></td>
                                <td style="display:flex; gap:0.3rem;">
                                    <a href="https://wa.me/${phoneSanitized}" target="_blank" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;">واتساب</a>
                                    <a href="tel:${phoneSanitized}" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;">اتصال</a>
                                    ${(a.freelancer && a.freelancer.cv_url) ? `<a href="${a.freelancer.cv_url}" target="_blank" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;">السيرة</a>` : ''}
                                </td>
                                <td>
                                    <button class="btn btn-success" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="setApplicantStatus('${a.id}', 'approved', '${eventId}')">قبول</button>
                                    <button class="btn btn-danger" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="setApplicantStatus('${a.id}', 'rejected', '${eventId}')">رفض</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    openModal(html);
}

async function setApplicantStatus(appId, status, eventId) {
    await supabase.from('HAJIBEVENT-applications').update({ status }).eq('id', appId);
    showToast(`تم تحديث حالة المرشح إلى ${status === 'approved' ? 'مقبول' : 'مرفوض'}`, 'info');
    openManageApplicantsModal(eventId);
}

// ----------------------------------------------------
// لوحة الإدارة: الحضور والنطاق
// ----------------------------------------------------
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
                <label>تحديد الفعالية</label>
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
            <button class="btn btn-outline" onclick="fetchAttendanceReports()">تصفية النتائج</button>
        </div>

        <div id="attendanceReportTable"></div>
    `;

    fetchAttendanceReports();
}

async function fetchAttendanceReports() {
    const tableContainer = document.getElementById('attendanceReportTable');
    if (!tableContainer) return;
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
        tableContainer.innerHTML = '<p style="text-align:center;">تعذر تحميل السجلات.</p>';
        return;
    }

    tableContainer.innerHTML = `
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الموظف</th>
                        <th>الهوية</th>
                        <th>الفعالية</th>
                        <th>وقت الدخول</th>
                        <th>وقت الخروج</th>
                        <th>النوع</th>
                    </tr>
                </thead>
                <tbody>
                    ${(!logs || logs.length === 0) ? '<tr><td colspan="6" style="text-align:center;">لا توجد سجلات مطابقة للبحث</td></tr>' : ''}
                    ${(logs || []).map(l => `
                        <tr>
                            <td><strong>${l.freelancer ? l.freelancer.full_name : 'غير محدد'}</strong></td>
                            <td>${l.freelancer ? l.freelancer.id_number : '-'}</td>
                            <td>${l.event ? l.event.title : '-'}</td>
                            <td>${new Date(l.check_in_time).toLocaleString('ar-SA')}</td>
                            <td>${l.check_out_time ? new Date(l.check_out_time).toLocaleString('ar-SA') : 'جلسة قائمة'}</td>
                            <td>${l.is_manual ? '<span class="badge badge-warning">يدوي</span>' : '<span class="badge badge-success">ذاتي</span>'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function openManualAttendanceModal() {
    const { data: events } = await supabase.from('HAJIBEVENT-events').select('id, title');
    const { data: profiles } = await supabase.from('HAJIBEVENT-profiles').select('id, full_name, id_number');

    const html = `
        <h3>تسجيل حضور يدوي استثنائي</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">مخصص للحالات الميدانية الطارئة عند تعذر الاتصال بالإنترنت</p>
        <form onsubmit="handleManualAttendanceSubmit(event)">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>الفعالية</label>
                <select id="manEventId" class="form-control" required>
                    ${(events || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>الموظف / الفريلانسر</label>
                <select id="manFreelancerId" class="form-control" required>
                    ${(profiles || []).map(p => `<option value="${p.id}">${p.full_name} (${p.id_number})</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>تاريخ ووقت الحضور</label>
                <input type="datetime-local" id="manCheckIn" class="form-control" required>
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>تاريخ ووقت الانصراف (اختياري)</label>
                <input type="datetime-local" id="manCheckOut" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary btn-full">تأكيد الحضور اليدوي</button>
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

// ----------------------------------------------------
// لوحة الإدارة: مديري الفعاليات
// ----------------------------------------------------
async function renderAdminManagersView(container) {
    container.innerHTML = '<div class="spinner"></div>';

    const { data: managers } = await supabase.from('HAJIBEVENT-managers').select('*');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
            <h2>حسابات مديري الفعاليات</h2>
            <button class="btn btn-primary" onclick="openAddManagerModal()">إضافة مدير جديد</button>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>البريد الإلكتروني</th>
                        <th>الصلاحية</th>
                        <th>تاريخ الإضافة</th>
                    </tr>
                </thead>
                <tbody>
                    ${(!managers || managers.length === 0) ? '<tr><td colspan="4" style="text-align:center;">لا يوجد مديرين مسجلين</td></tr>' : ''}
                    ${(managers || []).map(m => `
                        <tr>
                            <td><strong>${m.full_name}</strong></td>
                            <td>${m.email}</td>
                            <td>${m.access_all_events ? '<span class="badge badge-info">كافة الفعاليات (مدير عام)</span>' : '<span class="badge badge-warning">فعاليات محددة</span>'}</td>
                            <td>${new Date(m.created_at).toLocaleDateString('ar-SA')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function openAddManagerModal() {
    const { data: events } = await supabase.from('HAJIBEVENT-events').select('id, title');

    const html = `
        <h3>إضافة حساب مدير جديد</h3>
        <form onsubmit="handleAddManagerSubmit(event)" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>الاسم الكامل</label>
                <input type="text" id="newMgrName" class="form-control" required>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>البريد الإلكتروني الرسمي</label>
                <input type="email" id="newMgrEmail" class="form-control" required>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>كلمة المرور</label>
                <input type="password" id="newMgrPassword" class="form-control" required minlength="6">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>نطاق الصلاحيات</label>
                <select id="newMgrScope" class="form-control" onchange="document.getElementById('eventSelectWrapper').style.display = this.value === 'specific' ? 'block' : 'none'">
                    <option value="all">وصول لجميع الفعاليات (Full Access)</option>
                    <option value="specific">فعاليات محددة فقط</option>
                </select>
            </div>
            <div id="eventSelectWrapper" class="form-group" style="display:none; margin-bottom:1.5rem;">
                <label>اختر الفعالية المصرح له بها</label>
                <select id="newMgrEventId" class="form-control">
                    ${(events || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-full">إنشاء الحساب الإداري</button>
        </form>
    `;
    openModal(html);
}

async function handleAddManagerSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newMgrName').value.trim();
    const email = document.getElementById('newMgrEmail').value.trim();
    const password = document.getElementById('newMgrPassword').value;
    const scope = document.getElementById('newMgrScope').value;
    const eventSelect = document.getElementById('newMgrEventId');
    const selectedEvent = eventSelect ? eventSelect.value : null;

    showToast('جاري إنشاء حساب المدير...', 'info');

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
        showToast(error.message, 'error');
        return;
    }

    const { error: mgrErr } = await supabase.from('HAJIBEVENT-managers').insert({
        id: data.user.id,
        full_name: name,
        email: email,
        access_all_events: (scope === 'all'),
        assigned_event_ids: (scope === 'specific' && selectedEvent) ? [selectedEvent] : []
    });

    if (mgrErr) {
        showToast(mgrErr.message, 'error');
    } else {
        closeModal();
        showToast('تمت إضافة المدير بنجاح', 'success');
        routeView('admin_submanagers');
    }
}

// ----------------------------------------------------
// تصدير الدوال للنطاق العام وتشغيل التطبيق
// ----------------------------------------------------
window.routeView = routeView;
window.toggleAuthTab = toggleAuthTab;
window.handleLoginSubmit = handleLoginSubmit;
window.handleFreelancerRegister = handleFreelancerRegister;
window.handleAdminLoginSubmit = handleAdminLoginSubmit;
window.handleLogout = handleLogout;
window.handleProfileUpdate = handleProfileUpdate;
window.applyForEvent = applyForEvent;
window.triggerCheckIn = triggerCheckIn;
window.triggerCheckOut = triggerCheckOut;
window.openNewEventModal = openNewEventModal;
window.handleCreateEventSubmit = handleCreateEventSubmit;
window.toggleHideEvent = toggleHideEvent;
window.deleteEvent = deleteEvent;
window.openManageApplicantsModal = openManageApplicantsModal;
window.setApplicantStatus = setApplicantStatus;
window.openManualAttendanceModal = openManualAttendanceModal;
window.handleManualAttendanceSubmit = handleManualAttendanceSubmit;
window.fetchAttendanceReports = fetchAttendanceReports;
window.openAddManagerModal = openAddManagerModal;
window.handleAddManagerSubmit = handleAddManagerSubmit;

// تشغيل التطبيق بعد اكتمال تحميل المستند
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});