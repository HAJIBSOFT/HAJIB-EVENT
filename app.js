/**
 * منصة حاجب - بوابة الفريلانسر
 */
const SUPABASE_URL = "https://cbyjokrlnnkihjhixdyz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AwLUhkBI0-7GxUpVkAUK2Q_5jPaVpqe";

function getDb() {
    if (window.HajibDB) return window.HajibDB;
    if (!window.supabase) return null;
    const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    window.HajibDB = window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY);
    return window.HajibDB;
}

const AppState = { user: null, profile: null, currentView: 'events' };
const GCC_NATIONALITIES = ["سعودي", "إماراتي", "كويتي", "عماني", "قطري", "بحريني"];
const SAUDI_REGIONS = ["الرياض", "مكة المكرمة", "المدينة المنورة", "القصيم", "المنطقة الشرقية", "عسير", "تبوك", "حائل", "الحدود الشمالية", "جازان", "نجران", "الباحة", "الجوف"];
const ID_TYPES = ["هوية وطنية", "إقامة نظامية", "جواز سفر خليجي"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180, dLam = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * (Math.sin(dLam / 2) ** 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function openModal(html) {
    const o = document.getElementById('modalOverlay'), b = document.getElementById('modalBody');
    if (o && b) { b.innerHTML = html; o.classList.remove('hidden'); }
}
function closeModal() {
    const o = document.getElementById('modalOverlay');
    if (o) o.classList.add('hidden');
}
function handleBackdropClick(e) {
    if (e.target.id === 'modalOverlay') closeModal();
}

// تشغيل التطبيق مع فحص روابط استعادة كلمة المرور
async function initApp() {
    const db = getDb();
    if (!db) return;

    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    // فحص هل المستخدم قادم من رابط استعادة الإيميل (#type=recovery)
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
        renderResetPasswordScreen(document.getElementById('appRoot'));
        return;
    }

    try {
        const { data: { session } } = await db.auth.getSession();
        if (session && session.user) {
            AppState.user = session.user;
requestNotificationPermission();
setupRealtimeNotifications(session.user.id);
            const { data: prof } = await db.from('HAJIBEVENT-profiles').select('*').eq('id', session.user.id).maybeSingle();
            if (prof && prof.is_suspended) {
                await db.auth.signOut();
                AppState.user = null;
                showToast('هذا الحساب معلق حالياً من قبل الإدارة', 'error');
            } else {
                AppState.profile = prof;
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        updateNavbar();
        routeView(AppState.user ? 'events' : 'auth');
    }

}

function updateNavbar() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    if (!AppState.user) {
        nav.innerHTML = `
           
        `;
        return;
    }

    const av = AppState.profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
    nav.innerHTML = `
       
	    <button type="button" class="nav-bell-btn" id="btnNavBell" onclick="openNotificationsCenter()" title="مركز الإشعارات">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
            </svg>
            <span class="bell-badge" id="bellUnreadBadge" style="display: none;">0</span>
        </button>
	   
        <div class="nav-avatar-pill" onclick="routeView('profile')">
            <img src="${av}" class="nav-avatar-img" alt="">
            <span class="nav-avatar-name"></span>
        </div>
       
    `;
	 // جلب عدد الإشعارات غير المقروءة فوراً
    checkUnreadNotificationsCount();
}

async function handleLogout() {
    const db = getDb();
    if (db) await db.auth.signOut();
    AppState.user = null;
    AppState.profile = null;
    updateNavbar();
    routeView('auth');
}

function routeView(view, payload = null) {
    AppState.currentView = view;
    const root = document.getElementById('appRoot');
    if (!root) return;
    switch (view) {
        case 'auth': renderAuth(root); break;
        case 'events': renderEvents(root); break;
        case 'event_detail': renderDetail(root, payload); break;
        case 'profile': renderProfile(root); break;
    }
}

// واجهة الدخول مع روابط التبديل
function renderAuth(container, defaultMode = 'login') {
    container.innerHTML = `
        <div class="card-box auth-box">
            <h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 0.4rem; text-align: center;">
                ${defaultMode === 'login' ? 'مرحباً بك مجدداً' : 'انضم لكادر احترافي في حاجب ايفنت'}
            </h2>
            <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-bottom: 1.8rem;">
                ${defaultMode === 'login' ? 'سجل دخولك لمتابعة فعالياتك وحضورك ' : 'هل انت جاهز للانضمام الينا '}
            </p>

            ${defaultMode === 'login' ? `
                <form onsubmit="handleLoginSubmit(event)">
                    <div class="form-group" style="margin-bottom: 1.1rem;">
                        <label>البريد الإلكتروني</label>
                        <input type="email" id="loginEmail" class="form-control" required placeholder="name@domain.com">
                    </div>
                    <div class="form-group" style="margin-bottom: 0.8rem;">
    <label>كلمة المرور</label>
    <input type="password" id="loginPassword" class="form-control" required placeholder="••••••••">
</div>

<!-- رابط نسيت كلمة المرور -->
<div style="text-align: left; margin-bottom: 1.5rem;">
    <a href="javascript:void(0)" onclick="handleForgotPassword()" style="font-size: 0.82rem; color: var(--brand-primary); text-decoration: underline;">
        نسيت كلمة المرور؟
    </a>
</div>

<button type="submit" class="btn btn-primary btn-full">تسجيل الدخول</button>
                </form>
                <div class="auth-switch-footer">
                    لا يوجد لديك حساب؟
                    <button type="button" class="auth-switch-btn" onclick="renderAuth(document.getElementById('appRoot'), 'reg')">قم بتسجيل حساب جديد</button>
                </div>
            ` : `
                <form onsubmit="handleRegSubmit(event)">
                    <div class="form-grid">
                        <div class="form-group col-span-2">
                            <label>الاسم الكامل</label>
                            <input type="text" id="regName" class="form-control" required>
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
                            <select id="regIdType" class="form-control">
                                ${ID_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>رقم الهوية</label>
                            <input type="text" id="regIdNum" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>الجنسية</label>
                            <select id="regNat" class="form-control">
                                ${GCC_NATIONALITIES.map(n => `<option value="${n}">${n}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>فصيلة الدم</label>
                            <select id="regBlood" class="form-control">
                                ${BLOOD_TYPES.map(b => `<option value="${b}">${b}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>المدينة</label>
                            <select id="regCity" class="form-control">
                                ${SAUDI_REGIONS.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
						<div class="form-group col-span-2">
                        <label>رقم STC BANK</label>
						<input type="tel" id="regBio" class="form-control" required placeholder="سيتم تحويل المستحقات على هذا الرقم">
                    </div>
                        <div class="form-group">
                            <label>الصورة الشخصية</label>
                            <input type="file" id="regAvatar" class="form-control" accept="image/*" required>
                        </div>
                        <div class="form-group">
                            <label>صورة الهوية</label>
                            <input type="file" id="regCv" class="form-control" accept="image/*" required>
                        </div>
                        <div class="form-group col-span-2">
                            <label>تعيين كلمة المرور</label>
                            <input type="password" id="regPass" class="form-control" required minlength="6">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full" style="margin-top: 1.5rem;">إكمال إنشاء الحساب</button>
                </form>
                <div class="auth-switch-footer">
                    لديك حساب بالفعل؟
                    <button type="button" class="auth-switch-btn" onclick="renderAuth(document.getElementById('appRoot'), 'login')">تسجيل الدخول</button>
                </div>
            `}
        </div>
    `;
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const db = getDb();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return showToast(error.message, 'error');

    const { data: prof } = await db.from('HAJIBEVENT-profiles').select('*').eq('id', data.user.id).maybeSingle();
    if (prof && prof.is_suspended) {
        await db.auth.signOut();
        return showToast('الحساب معلق من قبل الإدارة', 'error');
    }

    AppState.user = data.user;
    AppState.profile = prof;
    updateNavbar();
    showToast('مرحباً بك مجدداً', 'success');
    routeView('events');
}

async function handleRegSubmit(e) {
    e.preventDefault();
    const db = getDb();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    const name = document.getElementById('regName').value.trim();
    const avFile = document.getElementById('regAvatar').files[0];
    const cvFile = document.getElementById('regCv').files[0];

    showToast('جاري إنشاء حسابك...', 'info');
    const { data: auth, error } = await db.auth.signUp({ email, password });
    if (error) return showToast(error.message, 'error');

    let avUrl = '', cvUrl = '';
    if (avFile) {
        const path = `avatars/${auth.user.id}_${Date.now()}`;
        await db.storage.from('avatars').upload(path, avFile);
        const { data } = db.storage.from('avatars').getPublicUrl(path);
        avUrl = data.publicUrl;
    }
    if (cvFile) {
        const path = `cvs/${auth.user.id}_${Date.now()}`;
        await db.storage.from('cvs').upload(path, cvFile);
        const { data } = db.storage.from('cvs').getPublicUrl(path);
        cvUrl = data.publicUrl;
    }

    const payload = {
        id: auth.user.id, full_name: name, email,
        phone: document.getElementById('regPhone').value.trim(),
        dob: document.getElementById('regDob').value,
        id_number: document.getElementById('regIdNum').value.trim(),
        id_type: document.getElementById('regIdType').value,
        nationality: document.getElementById('regNat').value,
        gender: 'ذكر', blood_type: document.getElementById('regBlood').value,
        city: document.getElementById('regCity').value, languages: 'العربية',
		 bio: document.getElementById('regBio').value,
        avatar_url: avUrl, cv_url: cvUrl
    };

    await db.from('HAJIBEVENT-profiles').insert(payload);
    AppState.user = auth.user;
    AppState.profile = payload;
    updateNavbar();
    showToast('تم التسجيل بنجاح', 'success');
    routeView('events');
}

// عرض الفعاليات مع إبراز الفعالية النشطة حالياً بالأعلى وفصلها
// عرض الفعاليات مع زر الحضور والانصراف الفعلي في البطاقة النشطة
// عرض الفعاليات مع إغلاق المنتهية وإظهار زر الشهادة لمن عمل بها
async function renderEvents(container) {
    container.innerHTML = '<div style="text-align:center; padding:3rem 0;"><p style="color:var(--text-muted)">جاري جلب الفعاليات...</p></div>';
    const db = getDb();
    const { data: events } = await db.from('HAJIBEVENT-events').select('*').eq('is_hidden', false).order('start_date');

    let applications = [];
    let attendedEventIds = [];

    if (AppState.user) {
        // جلب تقديمات الموظف
        const { data: apps } = await db.from('HAJIBEVENT-applications').select('event_id, status').eq('freelancer_id', AppState.user.id);
        applications = apps || [];

        // جلب معرفات الفعاليات التي حضر فيها الموظف فعلياً
        const { data: attLogs } = await db.from('HAJIBEVENT-attendance').select('event_id').eq('freelancer_id', AppState.user.id);
        attendedEventIds = [...new Set((attLogs || []).map(l => l.event_id))];
    }

    const now = new Date();
    const approvedIds = applications.filter(a => a.status === 'approved').map(a => a.event_id);

    // الفعالية النشطة حالياً
    const liveEvent = (events || []).find(e => {
        return approvedIds.includes(e.id) && new Date(e.start_date) <= now && new Date(e.end_date) >= now;
    });

    let isLiveCheckedIn = false;
    if (liveEvent && AppState.user) {
        const { data: activeSession } = await db
            .from('HAJIBEVENT-attendance')
            .select('id')
            .eq('event_id', liveEvent.id)
            .eq('freelancer_id', AppState.user.id)
            .is('check_out_time', null)
            .limit(1);
        isLiveCheckedIn = (activeSession && activeSession.length > 0);
    }

    const otherEvents = (events || []).filter(e => !liveEvent || e.id !== liveEvent.id);
    let html = '';

    // بطاقة الفعالية النشطة بالأعلى
    if (liveEvent) {
        html += `
            <div class="hero-live-card">
                <div style="flex: 1;">
                  
                    <h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 0.4rem;">${liveEvent.title}</h2>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">
                        الموقع: ${liveEvent.city} | الأجر اليومي: <strong>${liveEvent.daily_rate} ريال</strong> | تنتهي في: ${new Date(liveEvent.end_date).toLocaleDateString('ar-SA')}
                    </p>
                    
                    <div style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap;">
                        ${isLiveCheckedIn ? `
                           <button class="btn btn-danger" onclick="clockOut('${liveEvent.id}')">
                               تسجيل الانصراف
                            </button>
                        ` : `
                            <button class="btn btn-primary" onclick="clockIn('${liveEvent.id}', ${liveEvent.latitude}, ${liveEvent.longitude}, ${liveEvent.geofence_radius_meters})">
                               تسجيل الحضور
                            </button>
                        `}

                       
                    </div>
                </div>

               <div style="width: 240px; height: 140px; border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-soft); cursor: pointer;" 
     onclick="routeView('event_detail', '${liveEvent.id}')">
    <img src="${liveEvent.image_url || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhg2EYK-psEVdB2s-_IdyuVMejpQancsMIGMgbBg1gokaOqnaTPf17fa-3M-z4NwUQWFF-xUdJk7mUTVImEIX3CS6HfcqCgOJu_CJMYzHvyb1NZiSS13oh0ZgREkPcpCvREyMCUXc0Tl_96d4oaCOP1bNewNAYId2OBUkRB-whj0VSkvgfcp2-Zs-Ca7vUF/s1408/Gemini_Generated_Image_3f8rg13f8rg13f8r.jfif'}" style="width:100%; height:100%; object-fit:cover;" alt="">
</div> 
            </div>

            <div class="section-divider">
                <span>بقية الفعاليات</span>
            </div>
        `;
    }

    html += `<div class="events-grid">`;
    otherEvents.forEach(e => {
        const userApp = applications.find(a => a.event_id === e.id);
        const isEnded = new Date(e.end_date) < now;
        const isApprovedWorker = userApp && userApp.status === 'approved' && attendedEventIds.includes(e.id);

        let badge = '';
        if (isEnded) {
            badge = '<span class="badge" style="background:#f1f5f9; color:#64748b;">فعالية منتهية</span>';
        } else if (userApp) {
            badge = userApp.status === 'approved' ? '<span class="badge badge-success">مقبول</span>' :
                    (userApp.status === 'rejected' ? '<span class="badge badge-danger">مرفوض</span>' : '<span class="badge badge-warning">قيد المراجعة</span>');
        }

        html += `
            <div class="event-card" style="${isEnded ? 'opacity:0.9; background:#fafafa;' : ''}">
                <div class="event-card-media">
                    <img src="${e.image_url || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhg2EYK-psEVdB2s-_IdyuVMejpQancsMIGMgbBg1gokaOqnaTPf17fa-3M-z4NwUQWFF-xUdJk7mUTVImEIX3CS6HfcqCgOJu_CJMYzHvyb1NZiSS13oh0ZgREkPcpCvREyMCUXc0Tl_96d4oaCOP1bNewNAYId2OBUkRB-whj0VSkvgfcp2-Zs-Ca7vUF/s1408/Gemini_Generated_Image_3f8rg13f8rg13f8r.jfif'}" alt="">
                </div>
                <div class="event-card-body">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                        <h3 class="event-card-title">${e.title}</h3>
                        ${badge}
                    </div>
                    
                    <div style="font-size:0.84rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.35rem; margin-bottom:1.2rem; line-height:1.5;">
                        <div>المدينة: <strong>${e.city}</strong> | الأجر: <strong style="color:var(--brand-accent);">${e.daily_rate} ريال / اليوم</strong></div>
                        <div style="color:var(--text-muted); font-size:0.8rem;">
                            الفترة: <strong>${new Date(e.start_date).toLocaleDateString('ar-SA')}</strong> إلى <strong>${new Date(e.end_date).toLocaleDateString('ar-SA')}</strong>
                        </div>
                    </div>

                    <!-- أزرار الإجراء حسب حالة الفعالية والموظف -->
                    <div style="margin-top:auto;">
                        ${isEnded ? `
                            ${isApprovedWorker ? `
                                <!-- زر عرض الشهادة لمن عمل بالفعالية المنتهية -->
                                <button class="btn btn-full" style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; font-weight:700;" onclick="openCertificateModal('${e.id}')">
                                    عرض شهادة الشكر والتقدير
                                </button>
                            ` : `
                              
                            `}
                        ` : `
                            <button class="btn btn-outline btn-full" onclick="routeView('event_detail', '${e.id}')">
                                استعراض التفاصيل والعقد
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}
// دالة عرض تفاصيل الفعالية للفريلانسر المحدثة
// دالة عرض تفاصيل الفعالية مع بطاقة المشرف والفريق للموظف المقبول
async function renderDetail(container, eventId) {
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري التحميل...</p></div>';
    const db = getDb();
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();
    
    let userApp = null;
    let logs = [];
    let userTeam = null;

    if (AppState.user) {
        // 1. جلب تقديم الموظف في هذه الفعالية مع معرف الفريق التابع له
        const { data: a } = await db
            .from('HAJIBEVENT-applications')
            .select('*')
            .eq('event_id', eventId)
            .eq('freelancer_id', AppState.user.id)
            .maybeSingle();
        userApp = a;

        // 2. إذا كان مقبولاً وتم تعيينه لفريق، نجلب بيانات الفريق والمشرف
        if (userApp && userApp.status === 'approved' && userApp.team_id) {
            const { data: teamData } = await db
                .from('HAJIBEVENT-teams')
                .select(`id, team_name, leader:leader_id (full_name, phone, avatar_url)`)
                .eq('id', userApp.team_id)
                .maybeSingle();
            userTeam = teamData;
        }

        // 3. جلب سجلات الحضور والانصراف
        const { data: l } = await db
            .from('HAJIBEVENT-attendance')
            .select('*')
            .eq('event_id', eventId)
            .eq('freelancer_id', AppState.user.id)
            .order('check_in_time', { ascending: false });
        logs = l || [];
    }

    const isActive = logs.length > 0 && !logs[0].check_out_time;

    // تنسيق مواعيد البداية والنهاية بالساعة والتاريخ
    const startDateFormatted = new Date(ev.start_date).toLocaleString('ar-SA', { dateStyle: 'full', timeStyle: 'short' });
    const endDateFormatted = new Date(ev.end_date).toLocaleString('ar-SA', { dateStyle: 'full', timeStyle: 'short' });

    container.innerHTML = `
        <button class="btn btn-outline" style="margin-bottom:1.5rem;" onclick="routeView('events')">العودة لقائمة الفعاليات</button>
        <div class="card-box" style="max-width:900px; margin: 0 auto;">
            <h2>${ev.title}</h2>
            
            <!-- صندوق توقيت بداية ونهاية الفعالية بدقة -->
            <div style="background:#f8fafc; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1rem; margin:1rem 0 1.5rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; font-size:0.88rem;">
                <div>
                    <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">تاريخ ووقت البداية:</span>
                    <strong style="color:var(--brand-primary);">${startDateFormatted}</strong>
                </div>
                <div>
                    <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">تاريخ ووقت النهاية:</span>
                    <strong style="color:var(--brand-danger);">${endDateFormatted}</strong>
                </div>
				
				
               <div>
    <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">موقع الفعالية:</span>
    <div style="display:flex; align-items:center; gap:0.6rem;">
        <strong>${ev.city}</strong>
        ${ev.latitude && ev.longitude ? `
            <!-- زر ملاحة دائري ذكي لفتح خرائط جوجل مباشرة -->
            <a href="https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}" 
               target="_blank" 
               title="بدء الملاحة والتوجه إلى موقع الفعالية عبر خرائط Google"
               style="width:30px; height:30px; border-radius:50%; background:#eff6ff; border:1px solid #bfdbfe; color:#2563eb; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; transition:all 0.2s;"
               onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="transform: rotate(45deg);">
                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                </svg>
            </a>
        ` : ''}
    </div>
    </div>
				
				
                <div>
                    <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">الأجر اليومي:</span>
                    <strong style="color:var(--brand-accent);">${ev.daily_rate} ريال</strong>
                </div>
            </div>

            <!-- بطاقة المشرف وفريق العمل (تظهر فقط إذا كان مقبولاً وتم تعيينه لفريق) -->
            ${userTeam ? `
                <div style="background:#ffffff; border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem 1.3rem; margin:1.5rem 0; box-shadow:var(--shadow-soft); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div style="display:flex; align-items:center; gap:0.9rem;">
                        <img src="${userTeam.leader?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" 
                             style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid #fef3c7; background:#f8fafc;" alt="">
                        <div>
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.2rem;">
                                
                                <span style="font-size:0.75rem; color:var(--text-muted);">مشرفك الميداني المباشر</span>
                            </div>
                            <h4 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin:0;">
                                ${userTeam.leader?.full_name || 'لم يحدد مشرف بعد'}
                            </h4>
							  <h4 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin:0;">
                                 ${userTeam.team_name}
                            </h4>
                        </div>
                    </div>

                    <!-- أزرار دائرية برموز نقية للاتصال والواتساب -->
                    ${userTeam.leader?.phone ? `
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <!-- زر اتصال هاتفي دائري -->
                            <a href="tel:${userTeam.leader.phone.replace(/[^0-9]/g, '')}" 
                               title="اتصال هاتفي بالمشرف"
                               style="width:42px; height:42px; border-radius:50%; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; display:flex; align-items:center; justify-content:center; text-decoration:none; transition:all 0.2s;"
                               onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                                </svg>
                            </a>
                            
                            <!-- زر واتساب دائري -->
                            <a href="https://wa.me/966${userTeam.leader.phone.replace(/[^0-9]/g, '')}" target="_blank"
                               title="مراسلة المشرف عبر واتساب"
                               style="width:42px; height:42px; border-radius:50%; background:#ecfdf5; border:1px solid #a7f3d0; color:#059669; display:flex; align-items:center; justify-content:center; text-decoration:none; transition:all 0.2s;"
                               onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background='#ecfdf5'">
                                <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor">
                                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.49 0-2.95-.4-4.23-1.16l-.3-.18-3.14.82.84-3.06-.2-.31a8.03 8.03 0 0 1-1.23-4.35c0-4.46 3.63-8.09 8.09-8.09 2.16 0 4.19.84 5.72 2.37 1.53 1.53 2.37 3.56 2.37 5.72 0 4.46-3.63 8.09-8.09 8.09z"/>
                                </svg>
                            </a>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <p style="line-height:1.7; margin-bottom:1.8rem;">${ev.description}</p>
            
            <div style="border-top:1px solid var(--border-subtle); padding-top:1.5rem;">
                ${renderAction(ev, userApp, isActive)}
            </div>

            <!-- جدول الحضور لا يظهر إلا بعد تسجيل أول حضور فعلي للموظف -->
            ${logs.length > 0 ? `
                <h3 style="margin-top:2.5rem; font-size:1.1rem;">سجل الحضور والانصراف الميداني الخاص بك</h3>
                <div class="table-container" style="margin-top:1rem;">
                    <table class="data-table">
                        <thead><tr><th>التاريخ</th><th>تسجيل الحضور</th><th>تسجيل الانصراف</th><th>طريقة التحضير</th></tr></thead>
                        <tbody>
                            ${logs.map(l => `
                                <tr>
                                    <td>${new Date(l.check_in_time).toLocaleDateString('ar-SA')}</td>
                                    <td>${new Date(l.check_in_time).toLocaleTimeString('ar-SA')}</td>
                                    <td>${l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString('ar-SA') : 'جلسة مستمرة'}</td>
                                    <td>${l.is_manual ? '<span class="badge badge-warning">الادارة</span>' : '<span class="badge badge-success">GPS</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        </div>
    `;
}

// فحص موعد الفعالية بدقة قبل السماح بالتحضير
// فحص حالة الفعالية وأزرار التقديم والشهادة
function renderAction(ev, userApp, isActive) {
    if (!AppState.user) return `<button class="btn btn-primary" onclick="routeView('auth')">يرجى تسجيل الدخول للتقديم</button>`;
    
    const now = new Date();
    const startTime = new Date(ev.start_date);
    const endTime = new Date(ev.end_date);
    const isEnded = now > endTime;

    // إذا كانت الفعالية منتهية
    if (isEnded) {
        if (userApp && userApp.status === 'approved') {
            return `
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:1.2rem; border-radius:var(--radius-sm); text-align:center;">
                    <h4 style="color:#166534; margin-bottom:0.4rem;">شكراً لمشاركتك المتميزة في إنجاح الفعالية</h4>
                    <p style="color:#15803d; font-size:0.85rem; margin-bottom:1rem;">انتهت الفعالية بنجاح، وتم اعتماد وإصدار شهادة الشكر والتقدير لمشاركتك التنظيمية الميدانية.</p>
                    <button class="btn btn-primary" onclick="openCertificateModal('${ev.id}')">
                        عرض وطباعة شهادة الشكر والتقدير
                    </button>
                </div>
            `;
        } else {
            return `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; color:#64748b; padding:1rem; border-radius:var(--radius-sm); text-align:center; font-size:0.9rem;">
                    انتهت فترة تشغيل هذه الفعالية رسمياً، ولا يمكن التقديم عليها حالياً.
                </div>
            `;
        }
    }

    if (!userApp) {
        return `
            <div>
                <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.9rem; margin-bottom:1rem;">
                    <input type="checkbox" id="contractAgree"> أوافق على شروط التعاقد والمهام التنظيمية
                </label>
                <button class="btn btn-primary" onclick="applyEvent('${ev.id}')">تأكيد التقديم للفعالية</button>
            </div>
        `;
    }
    
    if (userApp.status === 'pending') return `<span class="badge badge-warning">طلبك قيد المراجعة لدى إدارة الفعالية</span>`;
    if (userApp.status === 'rejected') return `<span class="badge badge-danger">نعتذر، لم يتم قبولك لهذه الفعالية</span>`;

    if (now < startTime) {
        return `
            <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:1rem; border-radius:var(--radius-sm); font-size:0.9rem;">
                لم تبدأ الفعالية بعد. سيتاح تسجيل الحضور الذكي فور حلول موعد البدء في: <strong>${startTime.toLocaleTimeString('ar-SA')}</strong>
            </div>
        `;
    }

    // الفعالية جارية الآن
    if (isActive) {
        return `<button class="btn btn-danger" onclick="clockOut('${ev.id}')">تسجيل الانصراف والخروج الآن</button>`;
    } else {
        return `<button class="btn btn-primary" onclick="clockIn('${ev.id}', ${ev.latitude}, ${ev.longitude}, ${ev.geofence_radius_meters})">تسجيل الحضور الذكي الميداني (GPS)</button>`;
    }
}

function renderAction(ev, userApp, isActive) {
    if (!AppState.user) return `<button class="btn btn-primary" onclick="routeView('auth')">يرجى تسجيل الدخول للتقديم</button>`;
    if (!userApp) {
        return `
            <div>
                <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.9rem; margin-bottom:1rem;">
                    <input type="checkbox" id="contractAgree"> أوافق على شروط التعاقد والمهام التنظيمية
                </label>
                <button class="btn btn-primary" onclick="applyEvent('${ev.id}')">تأكيد التقديم للفعالية</button>
            </div>
        `;
    }
    if (userApp.status === 'pending') return `<span class="badge badge-warning">طلبك قيد المراجعة</span>`;
    if (userApp.status === 'rejected') return `<span class="badge badge-danger">نعتذر، لم يتم قبولك</span>`;

    if (isActive) {
        return `<button class="btn btn-danger" onclick="clockOut('${ev.id}')">تسجيل الانصراف</button>`;
    } else {
        return `<button class="btn btn-primary" onclick="clockIn('${ev.id}', ${ev.latitude}, ${ev.longitude}, ${ev.geofence_radius_meters})">تسجيل الحضور</button>`;
    }
}

async function applyEvent(id) {
    const a = document.getElementById('contractAgree');
    if (!a || !a.checked) return showToast('يجب الموافقة على الشروط أولاً', 'error');
    const db = getDb();
    await db.from('HAJIBEVENT-applications').insert({ event_id: id, freelancer_id: AppState.user.id, contract_agreed: true });
    showToast('تم تقديم طلبك بنجاح', 'success');
    routeView('event_detail', id);
}

// دالة تسجيل الدخول مع تحديث مكان الزر تلقائياً
function clockIn(eventId, tLat, tLng, radius) {
    if (!navigator.geolocation) {
        return showToast('المتصفح لا يدعم تحديد الموقع الجغرافي', 'error');
    }

    showToast('جاري التحقق من النطاق الجغرافي GPS...', 'info');

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, tLat, tLng);
        if (dist > radius) {
            return showToast(`أنت خارج نطاق الفعالية بمسافة ${Math.round(dist)} متر!`, 'error');
        }

        const db = getDb();
        const { error } = await db.from('HAJIBEVENT-attendance').insert({
            event_id: eventId,
            freelancer_id: AppState.user.id,
            check_in_time: new Date(),
            check_in_lat: pos.coords.latitude,
            check_in_lng: pos.coords.longitude
        });

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('تم تسجيل الحضور بنجاح', 'success');
            // تحديث الواجهة الحالية ليتغير الزر فوراً
            routeView(AppState.currentView, eventId);
        }
    }, () => showToast('يرجى تفعيل صلاحية الـ GPS في الهاتف لتسجيل الحضور', 'error'), { enableHighAccuracy: true });
}

// دالة تسجيل الخروج مع تحديث مكان الزر تلقائياً
function clockOut(eventId) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const db = getDb();
        const { data: logs } = await db
            .from('HAJIBEVENT-attendance')
            .select('id')
            .eq('event_id', eventId)
            .eq('freelancer_id', AppState.user.id)
            .is('check_out_time', null)
            .limit(1);

        if (logs && logs.length > 0) {
            await db.from('HAJIBEVENT-attendance').update({
                check_out_time: new Date(),
                check_out_lat: pos.coords.latitude,
                check_out_lng: pos.coords.longitude
            }).eq('id', logs[0].id);

            showToast('تم تسجيل الانصراف والخروج بنجاح', 'success');
            // تحديث الواجهة الحالية ليعود الزر أزرق مجدداً
            routeView(AppState.currentView, eventId);
        }
    }, () => showToast('يرجى تفعيل صلاحية الـ GPS لتسجيل الانصراف', 'error'));
}

// تعديل بيانات الفريلانسر مع إمكانية تعديل الـ CV وبقاء الاسم والهوية والجنسية مقفلة
function renderProfile(container) {
    const p = AppState.profile;
    container.innerHTML = `
        <div class="card-box" style="max-width: 760px; margin: 0 auto;">
            <div style="display:flex; align-items:center; gap:1.2rem; margin-bottom:2rem; padding-bottom:1.5rem; border-bottom:1px solid var(--border-subtle);">
                <img src="${p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:2px solid var(--brand-primary);" alt="">
                <div>
                    <h2 style="font-size:1.3rem;">${p.full_name}</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">${p.email}</p>
                </div>
            </div>

            <form onsubmit="handleProfileUpdate(event)">
                <div class="form-grid">
                    <!-- حقول غير قابلة للتعديل حسب الطلب -->
                    <div class="form-group">
                        <label>الاسم الكامل (غير قابل للتعديل)</label>
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

                    <!-- الحقول المتاح تعديلها بالكامل -->
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
                        <input type="text" id="profLanguages" class="form-control" value="${p.languages || ''}">
                    </div>
                    <div class="form-group col-span-2">
                        <label>تحديث الصورة الشخصية</label>
                        <input type="file" id="profAvatarFile" class="form-control" accept="image/*">
                    </div>
                    <div class="form-group col-span-2">
                        <label>تحديث صورة الهوية</label>
                        <input type="file" id="profCvFile" class="form-control" accept=".pdf,.doc,.docx">
                        ${p.cv_url ? `<div style="margin-top:0.4rem;"><a href="${p.cv_url}" target="_blank" style="font-size:0.82rem; color:var(--brand-primary);">معاينة صورة الهوية الحالية</a></div>` : ''}
                    </div>
                    <div class="form-group col-span-2">
                        <label>رقم STCBANK</label>
						<input type="tel" id="profBio" class="form-control" value="${p.bio || ''}" required>
                    </div>
                </div>
               <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.5rem;">حفظ التعديلات</button>

<!-- زر تغيير كلمة المرور الجديد -->
<button type="button" class="btn btn-outline btn-full" style="margin-top: 0.8rem;" onclick="openChangePasswordModal()">
    تغيير كلمة المرور
</button>
							
            </form>
			<label>.</label>
			 <button class="btn btn-primary btn-full" onclick="handleLogout()">تسجيل خروج</button>
        </div>
    `;
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const db = getDb();
    const phone = document.getElementById('profPhone').value.trim();
    const city = document.getElementById('profCity').value;
    const blood = document.getElementById('profBlood').value;
    const languages = document.getElementById('profLanguages').value.trim();
    const bio = document.getElementById('profBio').value.trim();
    const avFile = document.getElementById('profAvatarFile').files[0];
    const cvFile = document.getElementById('profCvFile').files[0];

    showToast('جاري تحديث البيانات...', 'info');

    let avUrl = AppState.profile.avatar_url;
    let cvUrl = AppState.profile.cv_url;

    if (avFile) {
        const path = `avatars/${AppState.user.id}_${Date.now()}`;
        await db.storage.from('avatars').upload(path, avFile);
        const { data } = db.storage.from('avatars').getPublicUrl(path);
        avUrl = data.publicUrl;
    }
    if (cvFile) {
        const path = `cvs/${AppState.user.id}_${Date.now()}`;
        await db.storage.from('cvs').upload(path, cvFile);
        const { data } = db.storage.from('cvs').getPublicUrl(path);
        cvUrl = data.publicUrl;
    }

    const payload = { phone, city, blood_type: blood, languages, bio, avatar_url: avUrl, cv_url: cvUrl, updated_at: new Date() };
    await db.from('HAJIBEVENT-profiles').update(payload).eq('id', AppState.user.id);
    AppState.profile = { ...AppState.profile, ...payload };
    updateNavbar();
    showToast('تم حفظ التعديلات بنجاح', 'success');
    renderProfile(document.getElementById('appRoot'));
}
// 1. طلب إرسال رابط الاستعادة إلى إيميل المستخدم
async function handleForgotPassword() {
    const email = prompt('أدخل بريدك الإلكتروني المسجل لإرسال رابط إعادة تعيين كلمة المرور:');
    if (!email || !email.trim()) return;

    const db = getDb();
    showToast('جاري إرسال الرابط إلى بريدك...', 'info');

    const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.href // يعيد المستخدم لنفس الصفحة بعد النقر على الرابط في الإيميل
    });

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني بنجاح', 'success');
    }
}

// 2. مراقبة عودة المستخدم من رابط الإيميل لطلب كلمة المرور الجديدة
function setupPasswordRecoveryListener() {
    const db = getDb();
    if (!db) return;

    db.auth.onAuthStateChange(async (event, session) => {
        // عند نقر المستخدم على الرابط في الإيميل، يتعرف عليه النظام كحدث PASSWORD_RECOVERY
        if (event === 'PASSWORD_RECOVERY') {
            const newPassword = prompt('أهلاً بك! يرجى إدخال كلمة المرور الجديدة (6 خانات كحد أدنى):');
            if (newPassword && newPassword.length >= 6) {
                const { error } = await db.auth.updateUser({ password: newPassword });
                if (error) {
                    showToast(error.message, 'error');
                } else {
                    showToast('تم تعيين كلمة المرور الجديدة بنجاح! يمكنك الآن تسجيل الدخول بها', 'success');
                    routeView('auth');
                }
            } else {
                showToast('كلمة المرور غير صالحة أو تم إلغاء العملية', 'error');
            }
        }
    });
}


// نافذة منبثقة لتغيير كلمة المرور بأمان
function openChangePasswordModal() {
    const html = `
        <h3>تغيير كلمة المرور</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.2rem;">أدخل كلمة المرور الجديدة الخاصة بحسابك (6 خانات كحد أدنى)</p>
        <form onsubmit="handleChangePasswordSubmit(event)">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>كلمة المرور الجديدة</label>
                <input type="password" id="newPassInput" class="form-control" required minlength="6" placeholder="••••••••">
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>تأكيد كلمة المرور الجديدة</label>
                <input type="password" id="confirmPassInput" class="form-control" required minlength="6" placeholder="••••••••">
            </div>
            <button type="submit" class="btn btn-primary btn-full">تأكيد وحفظ كلمة المرور</button>
        </form>
    `;
    openModal(html);
}

// تنفيذ تحديث كلمة المرور في Supabase Auth
async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const newPass = document.getElementById('newPassInput').value;
    const confirmPass = document.getElementById('confirmPassInput').value;

    if (newPass !== confirmPass) {
        return showToast('كلمتا المرور غير متطابقتين! يرجى التأكد', 'error');
    }

    if (newPass.length < 6) {
        return showToast('يجب ألا تقل كلمة المرور عن 6 خانات', 'error');
    }

    const db = getDb();
    showToast('جاري تحديث كلمة المرور...', 'info');

    const { error } = await db.auth.updateUser({ password: newPass });
    if (error) {
        showToast(error.message, 'error');
    } else {
        closeModal();
        showToast('تم تغيير كلمة المرور بنجاح تام', 'success');
    }
}

// شاشة مخصصة تظهر فوراً عند النقر على الرابط في البريد الإلكتروني
function renderResetPasswordScreen(container) {
    container.innerHTML = `
        <div class="card-box auth-box" style="margin-top: 3rem;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div class="logo-symbol" style="margin: 0 auto 0.8rem;">H</div>
                <h2>استعادة وتعيين كلمة المرور</h2>
                <p style="color: var(--text-muted); font-size: 0.85rem;">أدخل كلمة المرور الجديدة لحسابك لتسجيل الدخول فوراً</p>
            </div>
            <form onsubmit="handleEmailResetSubmit(event)">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>كلمة المرور الجديدة</label>
                    <input type="password" id="emailNewPass" class="form-control" required minlength="6" placeholder="••••••••">
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>تأكيد كلمة المرور الجديدة</label>
                    <input type="password" id="emailConfirmPass" class="form-control" required minlength="6" placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-primary btn-full">حفظ كلمة المرور والدخول للمنصة</button>
            </form>
        </div>
    `;
}

// تنفيذ حفظ كلمة المرور الجديدة بعد فتح رابط الإيميل
async function handleEmailResetSubmit(e) {
    e.preventDefault();
    const newPass = document.getElementById('emailNewPass').value;
    const confirmPass = document.getElementById('emailConfirmPass').value;

    if (newPass !== confirmPass) {
        return showToast('كلمتا المرور غير متطابقتين', 'error');
    }
    if (newPass.length < 6) {
        return showToast('يجب ألا تقل كلمة المرور عن 6 خانات', 'error');
    }

    const db = getDb();
    showToast('جاري تحديث كلمة المرور...', 'info');

    const { error } = await db.auth.updateUser({ password: newPass });
    if (error) {
        showToast(error.message, 'error');
    } else {
        // تنظيف الـ Hash من الرابط ليعود الرابط نظيفاً
        window.history.replaceState(null, null, window.location.pathname);
        showToast('تم تعيين كلمة المرور بنجاح! جاري تحويلك لحسابك...', 'success');
        
        // جلب الجلسة والدخول مباشرة
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            AppState.user = session.user;
            const { data: prof } = await db.from('HAJIBEVENT-profiles').select('*').eq('id', session.user.id).maybeSingle();
            AppState.profile = prof;
            updateNavbar();
            routeView('events');
        } else {
            routeView('auth');
        }
    }
}
// ==========================================
// نظام استقبال وإطلاق إشعارات النظام (PWA Push)
// ==========================================

// 1. طلب إذن الإشعارات من هاتف المستخدم
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

// 2. الاستماع الفوري واللحظي لأي إشعار جديد يخص هذا الموظف
function setupRealtimeNotifications(userId) {
    const db = getDb();
    if (!db) return;

    db.channel(`user-notifications-${userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'HAJIBEVENT-notifications',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const notif = payload.new;
            // إظهار إشعار النظام على شاشة الهاتف
            triggerSystemNotification(notif.title, notif.message);
            // إظهار تنبيه داخلي سريع
            showToast(`${notif.title}: ${notif.message}`, 'info');
        })
        .subscribe();
}

// 3. إطلاق إشعار النظام المعتمد
function triggerSystemNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(title, {
                    body: message,
                    icon: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=192',
                    badge: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=192',
                    vibrate: [200, 100, 200],
                    dir: 'rtl',
                    lang: 'ar'
                });
            });
        } else {
            new Notification(title, { body: message });
        }
    }
}



// ==========================================
// مركز الإشعارات الذكي (داخل التطبيق + إشعارات النظام)
// ==========================================

// 1. فحص وتحديث عدد الإشعارات غير المقروءة على الجرس
async function checkUnreadNotificationsCount() {
    if (!AppState.user) return;
    const db = getDb();
    if (!db) return;

    const { count } = await db
        .from('HAJIBEVENT-notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', AppState.user.id)
        .eq('is_read', false);

    const badge = document.getElementById('bellUnreadBadge');
    if (badge) {
        if (count && count > 0) {
            badge.innerText = count > 9 ? '+9' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// 2. فتح نافذة مركز الإشعارات عند الضغط على الجرس
async function openNotificationsCenter() {
    if (!AppState.user) return;
    const db = getDb();

    // جلب سجل إشعارات المستخدم
    const { data: notifications } = await db
        .from('HAJIBEVENT-notifications')
        .select('*')
        .eq('user_id', AppState.user.id)
        .order('created_at', { ascending: false });

    // فحص هل إشعارات المتصفح/الهاتف مفعلة أم لا
    const isPushEnabled = ('Notification' in window && Notification.permission === 'granted');

    const html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; padding-bottom:0.8rem; border-bottom:1px solid var(--border-subtle);">
            <h3 style="margin:0; font-size:1.2rem;">الاشعارات</h3>
            <span style="font-size:0.8rem; color:var(--text-muted);">${(notifications || []).length} إشعار مسجل</span>
        </div>

        <!-- بطاقة تنبيه لتفعيل إشعارات الهاتف تظهر إذا لم تكن مفعلة -->
        ${!isPushEnabled ? `
            <div class="notif-permission-banner" id="bannerPushPrompt">
                <div>
                    <strong style="color:#1e40af; font-size:0.9rem; display:block; margin-bottom:0.2rem;">الإشعارات غير مفعلة</strong>
                    <p style="color:#3b82f6; font-size:0.78rem; margin:0;">فعل الاشعارات لتصلك التنبيهات على شاشة جهازك</p>
                </div>
                <button class="btn btn-primary" style="padding:0.4rem 0.9rem; font-size:0.8rem;" onclick="enablePushNotificationsFromCenter()">
                   تفعيل الاشعارات
                </button>
            </div>
        ` : ''}

        <!-- قائمة الإشعارات المسجلة داخل التطبيق -->
        <div style="max-height: 420px; overflow-y: auto;">
            ${(!notifications || notifications.length === 0) ? `
                <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
                    <p style="font-size:0.9rem;">لا توجد إشعارات مسجلة لديك حتى الآن</p>
                </div>
            ` : `
                ${notifications.map(n => `
                    <div class="notif-item ${!n.is_read ? 'unread' : ''}">
                        <div class="notif-header">
                            <strong style="font-size:0.92rem; color:var(--text-primary);">${n.title}</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(n.created_at).toLocaleDateString('ar-SA')} - ${new Date(n.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5; margin:0;">
                            ${n.message}
                        </p>
                    </div>
                `).join('')}
            `}
        </div>
    `;

    openModal(html);

    // تمييز كافة الإشعارات كمقروءة وتصفير الشارة الحمراء
    await db
        .from('HAJIBEVENT-notifications')
        .update({ is_read: true })
        .eq('user_id', AppState.user.id)
        .eq('is_read', false);

    const badge = document.getElementById('bellUnreadBadge');
    if (badge) badge.style.display = 'none';
}

// 3. دالة تفعيل إشعارات الهاتف عند نقر الزر داخل القائمة
async function enablePushNotificationsFromCenter() {
    if (!('Notification' in window)) {
        return showToast('متصفحك لا يدعم إشعارات النظام', 'error');
    }

    // طلب الإذن الحقيقي من المتصفح (مسموح به الآن لأنه جاء بنقرة زر مباشرة)
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
        showToast('تم تفعيل الاشعارات', 'success');
        const banner = document.getElementById('bannerPushPrompt');
        if (banner) banner.style.display = 'none';

        // إطلاق إشعار تجريبي فوري لتأكيد التفعيل
        triggerSystemNotification('HAJIB EVENT', 'تم تفعيل إشعارات النظام بنجاح على هاتفك');
    } else {
        showToast('يمكنك تفعيل الاشعارات من اعدادات المتصفح', 'error');
    }
}

// تحديث الاستماع اللحظي ليشمل تحديث عداد الجرس فوراً
function setupRealtimeNotifications(userId) {
    const db = getDb();
    if (!db) return;

    db.channel(`user-notifications-${userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'HAJIBEVENT-notifications',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const notif = payload.new;
            // إظهار إشعار النظام المعتمد
            triggerSystemNotification(notif.title, notif.message);
            // إظهار تنبيه داخلي سريع
            showToast(`${notif.title}: ${notif.message}`, 'info');
            // تحديث الشارة الحمراء على الجرس فوراً
            checkUnreadNotificationsCount();
        })
        .subscribe();
}



// نافذة عرض شهادة التقدير للمنظم
// نافذة الشهادة الفخمة مع خيارات الطباعة المباشرة للآيفون والـ BLOB
 async function openCertificateModal(eventId) {
    const db = getDb();
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();
    const p = AppState.profile;

    const html = `
        <div style="text-align:center; margin-bottom:1.2rem;">
            <h3>نحن فخورون بك</h3>
            <p style="color:var(--text-muted); font-size:0.85rem;">انت اساس نجاح المشروع</p>
        </div>

        <!-- معاينة الشهادة بالخلفية الملكية والزخارف -->
        

        <!-- أزرار الإجراء المتوافقة تماماً مع الآيفون -->
        <div style="margin-top:1.5rem; display:grid; gap:0.8rem;">
            <!-- زر الطباعة وحفظ PDF المباشر للآيفون -->
            <button class="btn btn-primary" onclick="openCertificateAsBlob('${eventId}')">
                حفظ كـ PDF / طباعة
            </button>
            
        </div>
    `;
    openModal(html);
}

// 1. توليد كود HTML الكامل للشهادة بدقة عالية مع الخلفية الملكية
 function generateCertificateHTML(ev, p) {
    return `
        <!DOCTYPE html>
     <html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>شهادة شكر وتقدير - ${p.full_name}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        
        * {
            box-sizing: border-box;
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 0;
        }

        @page {
            size: A4 landscape;
            margin: 0;
        }

        body {
            background-color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }

        .cert-card {
            width: 100%;
            max-width: 1100px;
            height: 750px;
            background: #ffffff;
            position: relative;
            padding: 40px 60px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            border: 2px solid #e2e8f0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        /* الزخارف الذهبية والكحلية الأنيقة على الجوانب */
        .cert-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 160px;
            height: 160px;
            background: linear-gradient(135deg, #0f172a 50%, #c59b27 50%);
            clip-path: polygon(0 0, 100% 0, 100% 100%);
            opacity: 0.9;
        }

        .cert-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 160px;
            height: 160px;
            background: linear-gradient(135deg, #c59b27 50%, #0f172a 50%);
            clip-path: polygon(0 100%, 0 0, 100% 100%);
            opacity: 0.9;
        }

        /* الإطار الداخلي الذهبي */
        .inner-border {
            position: absolute;
            inset: 15px;
            border: 1px solid #c59b27;
            border-radius: 8px;
            pointer-events: none;
        }

        /* الهيدر: الشعار والمعلومات */
        .cert-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
            z-index: 2;
            padding-bottom: 15px;
        }

        .logo-box {
            width: 180px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: end;
        }

        .logo-placeholder {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .header-info {
            text-align: left;
            font-size: 13px;
            color: #475569;
            font-weight: 600;
            line-height: 1.5;
        }

        /* العناوين والمحتوى الرئيسي */
        .cert-body {
            text-align: center;
            position: relative;
            z-index: 2;
            margin-top: 10px;
        }

        .cert-title {
            font-size: 34px;
            color: #0f172a;
            font-weight: 900;
            letter-spacing: 1px;
            margin-bottom: 2px;
        }

        .cert-subtitle {
            font-size: 13px;
            color: #c59b27;
            font-weight: 700;
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-bottom: 25px;
        }

        .cert-intro {
            font-size: 17px;
            color: #334155;
            margin-bottom: 12px;
        }

        .recipient-name {
            font-size: 30px;
            color: #0f172a;
            font-weight: 800;
            display: inline-block;
            padding: 2px 35px;
            border-bottom: 2px solid #c59b27;
            margin-bottom: 8px;
        }

        .id-number {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 20px;
        }

        .cert-description {
            font-size: 16px;
            color: #334155;
            line-height: 1.8;
            max-width: 850px;
            margin: 0 auto;
        }

        .event-name {
            color: #0f172a;
            font-weight: 800;
            font-size: 19px;
        }

        /* الفوتر: الختم والتوقيع والتاريخ */
        .cert-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            position: relative;
            z-index: 2;
            padding: 0 20px;
            margin-bottom: 10px;
        }

        .footer-block {
            flex: 1;
            text-align: center;
        }

        .footer-block.right { text-align: right; }
        .footer-block.left { text-align: left; }

        .signature-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 5px;
        }

        .signature-sub {
            font-size: 12px;
            color: #64748b;
        }

        /* مكان رفع التوقيع الإلكتروني */
        .signature-image-container {
            height: 55px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            margin-bottom: 5px;
        }

        .signature-img {
            max-height: 100%;
            max-width: 150px;
            object-fit: contain;
        }

        /* الختم الرسمى */
        .official-stamp {
            width: 85px;
            height: 85px;
            border: 2px dashed #c59b27;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #c59b27;
            font-weight: 700;
            font-size: 11px;
            margin: 0 auto;
            background: rgba(197, 155, 39, 0.03);
        }

        .date-box {
            font-size: 13px;
            color: #334155;
        }
    </style>
</head>
<body>

    <div class="cert-card">
        <div class="inner-border"></div>

        <!-- الهيدر (الشعار والمعلومات الرسمية) -->
        <div class="cert-header">
            <div class="logo-box">
                <!-- يمكنك استبدال src برابط شعار منصة حاجب -->
                <img src="" alt="شعار المنصة" class="logo-placeholder" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display:none; font-weight:800; color:#0f172a; font-size:18px;">HAJIB EVENT</div>
            </div>
			
            <div class="header-info">
			<div class="logo-box">
                <!-- يمكنك استبدال src برابط شعار منصة حاجب -->
                <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgH8GXW0t32QkIecRQevXWeH_koj6TFuJlMwq5Lf1UKP4VFszLiXox4DdjyyLzIj6CZQKtg6q7rmHRvU8mLT6pRY9IhtQOsz4LF587PQyOfll44NRnusVqjXZVRxdlgdcj9FpD52y0lsbfrpzTlfM_teOWJ2O1kG37vAt_8n4uTN65wUx8KDt1ge6w0HuOo/s768/HAJIB%20EVENT.png" alt="شعار المنصة" class="logo-placeholder" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display:none; font-weight:800; color:#0f172a; font-size:18px;">الشعار</div>
            </div>
               
            </div>
        </div>

        <!-- متن الشهادة -->
        <div class="cert-body">
            <h1 class="cert-title">شهادة شكر وتقدير</h1>
            <div class="cert-subtitle">Certificate of Appreciation</div>

            <p class="cert-intro">تتقدم ادرة منصة حاجب ايفنت بجزيل الشكر وعظيم التقدير للزميل:</p>
            
            <div class="recipient-name">${p.full_name}</div>
            <div class="id-number">رقم الهوية الوطنية / الإقامة: <strong>${p.id_number}</strong></div>

            <p class="cert-description">
                نظير مشاركته الفعالة وتفانيه الملموس في تشغيل وتنظيم فعاليات:<br>
                <span class="event-name">${ev.title}</span><br>
                المنعقدة في مدينة <strong>${ev.city}</strong> خلال الفترة من 
                <strong>${new Date(ev.start_date).toLocaleDateString('ar-SA')}</strong> إلى 
                <strong>${new Date(ev.end_date).toLocaleDateString('ar-SA')}</strong>.
            </p>
        </div>

        <!-- الفوتر والتوقيع الإلكتروني -->
        <div class="cert-footer">
            <!-- قسم التوقيع الإلكتروني -->
            <div class="footer-block right">
                <div class="signature-title">المشرف العام الميداني</div>
                 <strong>${new Date().toLocaleDateString('ar-SA')}</strong>
                
                <!-- مكان رفع وصورة التوقيع الإلكتروني -->
                <div class="signature-image-container">
                    <!-- استبدل src برابط صورة التوقيع الإلكتروني الرقمي PNG (شفاف) -->
                    <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiAmhjU5oVeb9Ibml4PNgM4tm2M9GGBSdyt3nA-5dvAfaZ1OzKO0Qw5MTuph6ng27SswkqXlrSY0rVqbpHxa3ZPLq1_9c7aortrdZOnrgJBVA_Xv9BYk4OldcWlvFTz9KZX28XDyRypE7mCH5GsT4WzacxEwRdwYljFEUhBaQOCV-Y1meUG2c8kDAAaAaxW/s242/SIGNT5.png" alt="التوقيع الإلكتروني" class="signature-img" onerror="this.style.opacity='0.2';">
                </div>
            </div>

            <!-- الختم الرسمي -->
         

            <!-- تاريخ الاعتماد -->
           
        </div>
    </div>

</body>
</html>
    `;
}

// 2. حل الآيفون الأول: الطباعة المباشرة داخل نفس الصفحة (تتجاوز حظر الـ Popups تماماً)
async function printCertificateDirectly(eventId) {
    const db = getDb();
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();
    const p = AppState.profile;

    const printContainer = document.getElementById('certificatePrintContainer');
    if (!printContainer) return;

    // حقن كود الشهادة في الصفحة الحالية
    printContainer.innerHTML = generateCertificateHTML(ev, p);
    
    // تفعيل وضع طباعة الشهادة للآيفون
    document.body.classList.add('ios-cert-printing');

    setTimeout(() => {
        window.print();
        // إعادة الصفحة لوضعها الطبيعي بعد انتهاء نافذة الطباعة
        setTimeout(() => {
            document.body.classList.remove('ios-cert-printing');
            printContainer.innerHTML = '';
        }, 1000);
    }, 300);
}

// 3. حل الآيفون الثاني: فتح الشهادة كرابط BLOB مستقل في ذاكرة الهاتف
async function openCertificateAsBlob(eventId) {
    const db = getDb();
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();
    const p = AppState.profile;

    const certHtml = generateCertificateHTML(ev, p);
    
    // إنشاء ملف Blob محلي في ذاكرة الآيفون
    const blob = new Blob([certHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    // توجيه المتصفح بأمان دون حظر
    const newTab = window.open(blobUrl, '_blank');
    if (!newTab) {
        // إذا حظر المتصفح الفتح في صفحة جديدة، يتم الفتح داخل نفس التبويب
        window.location.href = blobUrl;
    }
}

// تصدير الدوال الجديدة للنطاق العام
window.openCertificateModal = openCertificateModal;
window.printCertificateDirectly = printCertificateDirectly;
window.openCertificateAsBlob = openCertificateAsBlob;


// تصدير الدوال الجديدة للنطاق العام
window.openNotificationsCenter = openNotificationsCenter;
window.enablePushNotificationsFromCenter = enablePushNotificationsFromCenter;
window.checkUnreadNotificationsCount = checkUnreadNotificationsCount;

// تصدير الدوال للنطاق العام
window.renderResetPasswordScreen = renderResetPasswordScreen;
window.handleEmailResetSubmit = handleEmailResetSubmit;


// تصدير الدوال للنطاق العام
window.openChangePasswordModal = openChangePasswordModal;
window.handleChangePasswordSubmit = handleChangePasswordSubmit;

// تأكد من تصدير الدالة للنطاق العام
window.handleForgotPassword = handleForgotPassword;
window.routeView = routeView;
window.renderAuth = renderAuth;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegSubmit = handleRegSubmit;
window.handleLogout = handleLogout;
window.applyEvent = applyEvent;
window.clockIn = clockIn;
window.clockOut = clockOut;
window.handleProfileUpdate = handleProfileUpdate;
window.closeModal = closeModal;
window.handleBackdropClick = handleBackdropClick;

document.addEventListener('DOMContentLoaded', initApp);
