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

async function initApp() {
    const db = getDb();
    if (!db) return;

    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    try {
        const { data: { session } } = await db.auth.getSession();
        if (session && session.user) {
            AppState.user = session.user;
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
       
        <div class="nav-avatar-pill" onclick="routeView('profile')">
            <img src="${av}" class="nav-avatar-img" alt="">
            <span class="nav-avatar-name">${AppState.profile?.full_name || 'حسابي'}</span>
        </div>
        <button class="btn btn-outline" onclick="handleLogout()">خروج</button>
    `;
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
                    <div class="form-group" style="margin-bottom: 1.6rem;">
                        <label>كلمة المرور</label>
                        <input type="password" id="loginPassword" class="form-control" required placeholder="••••••••">
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
                        <div class="form-group">
                            <label>الصورة الشخصية</label>
                            <input type="file" id="regAvatar" class="form-control" accept="image/*">
                        </div>
                        <div class="form-group col-span-2">
                            <label>السيرة الذاتية (CV - PDF أو Word)</label>
                            <input type="file" id="regCv" class="form-control" accept=".pdf,.doc,.docx" required>
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
async function renderEvents(container) {
    container.innerHTML = '<div style="text-align:center; padding:3rem 0;"><p style="color:var(--text-muted)">جاري جلب الفعاليات...</p></div>';
    const db = getDb();
    const { data: events } = await db.from('HAJIBEVENT-events').select('*').eq('is_hidden', false).order('start_date');

    let applications = [];
    if (AppState.user) {
        const { data: apps } = await db.from('HAJIBEVENT-applications').select('event_id, status').eq('freelancer_id', AppState.user.id);
        applications = apps || [];
    }

    const now = new Date();
    const approvedIds = applications.filter(a => a.status === 'approved').map(a => a.event_id);

    // الفعالية النشطة حالياً للمستخدم
    const liveEvent = (events || []).find(e => {
        return approvedIds.includes(e.id) && new Date(e.start_date) <= now && new Date(e.end_date) >= now;
    });

    // باقي الفعاليات المتاحة
    const otherEvents = (events || []).filter(e => !liveEvent || e.id !== liveEvent.id);

    let html = '';

    // بطاقة الفعالية النشطة بالأعلى
    if (liveEvent) {
        html += `
            <div class="hero-live-card">
                <div style="flex: 1;">
                    <div class="live-pill">
                        <span class="live-dot"></span>
                        الفعاليات النشطة
                    </div>
                    <h2 style="font-size: 1.6rem; font-weight: 700; margin-bottom: 0.6rem;">${liveEvent.title}</h2>
                    <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.6; margin-bottom: 1.2rem;">
                        الموقع: ${liveEvent.city} | الأجر اليومي: <strong>${liveEvent.daily_rate} ريال</strong> | تنتهي في: ${new Date(liveEvent.end_date).toLocaleDateString('ar-SA')}
                    </p>
                    <button class="btn btn-primary" onclick="routeView('event_detail', '${liveEvent.id}')">
                        تسجيل الحضور/الانصراف
                    </button>
                </div>
                              <div style="width: 240px; height: 140px; border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-soft);">
                    <img src="${liveEvent.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400'}" style="width:100%; height:100%; object-fit:cover;" alt="">
                </div>
            </div>
            <div class="section-divider">
                <span>الفعاليات المتاحة</span>
            </div>
        `;
    }

    html += `<div class="events-grid">`;
    otherEvents.forEach(e => {
        const userApp = applications.find(a => a.event_id === e.id);
        let badge = '';
        if (userApp) {
            badge = userApp.status === 'approved' ? '<span class="badge badge-success">مقبول</span>' :
                    (userApp.status === 'rejected' ? '<span class="badge badge-danger">مرفوض</span>' : '<span class="badge badge-warning">قيد المراجعة</span>');
        }

        html += `
            <div class="event-card">
                <div class="event-card-media">
                    <img src="${e.image_url || 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=500'}" alt="">
                </div>
                <div class="event-card-body">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                        <h3 class="event-card-title">${e.title}</h3>
                        ${badge}
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.86rem; margin-bottom:1.2rem;">
                        المدينة: ${e.city} | الأجر: ${e.daily_rate} ريال / اليوم
                    </p>
                    <button class="btn btn-outline btn-full" style="margin-top:auto;" onclick="routeView('event_detail', '${e.id}')">
                        استعراض التفاصيل 
                    </button>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}
// دالة عرض تفاصيل الفعالية للفريلانسر المحدثة
async function renderDetail(container, eventId) {
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري التحميل...</p></div>';
    const db = getDb();
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();
    let userApp = null, logs = [];

    if (AppState.user) {
        const { data: a } = await db.from('HAJIBEVENT-applications').select('*').eq('event_id', eventId).eq('freelancer_id', AppState.user.id).maybeSingle();
        userApp = a;
        const { data: l } = await db.from('HAJIBEVENT-attendance').select('*').eq('event_id', eventId).eq('freelancer_id', AppState.user.id).order('check_in_time', { ascending: false });
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
                    <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">الموقع والنطاق:</span>
                    <strong>${ev.city} (${ev.geofence_radius_meters} متر)</strong>
                </div>
                <div>
                    <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">الأجر اليومي:</span>
                    <strong style="color:var(--brand-accent);">${ev.daily_rate} ريال</strong>
                </div>
            </div>

            <p style="line-height:1.7; margin-bottom:1.8rem;">${ev.description}</p>
            
            <div style="border-top:1px solid var(--border-subtle); padding-top:1.5rem;">
                ${renderAction(ev, userApp, isActive)}
            </div>

            <!-- جدول الحضور لا يظهر إلا بعد تسجيل أول حضور فعلي للموظف -->
            ${logs.length > 0 ? `
                <h3 style="margin-top:2.5rem; font-size:1.1rem;">سجل الحضور والانصراف</h3>
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
function renderAction(ev, userApp, isActive) {
    if (!AppState.user) return `<button class="btn btn-primary" onclick="routeView('auth')">يرجى تسجيل الدخول للتقديم</button>`;
    
    if (!userApp) {
        return `
            <div>
                <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.9rem; margin-bottom:1rem;">
                    <input type="checkbox" id="contractAgree"> اوافق على الشروط والاحكام
                </label>
                <button class="btn btn-primary" onclick="applyEvent('${ev.id}')">تأكيد التقديم للفعالية</button>
            </div>
        `;
    }
    
    if (userApp.status === 'pending') return `<span class="badge badge-warning">طلبك قيد المراجعة لدى إدارة الفعالية</span>`;
    if (userApp.status === 'rejected') return `<span class="badge badge-danger">نعتذر، لم يتم قبولك لهذه الفعالية</span>`;

    // التحقق الصارم من توقيت الفعالية
    const now = new Date();
    const startTime = new Date(ev.start_date);
    const endTime = new Date(ev.end_date);

    if (now < startTime) {
        return `
            <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:1rem; border-radius:var(--radius-sm); font-size:0.9rem;">
                لم تبدأ الفعالية بعد. سيتاح تسجيل الحضور الذكي فور حلول موعد البدء في: <strong>${startTime.toLocaleTimeString('ar-SA')}</strong>
            </div>
        `;
    }

    if (now > endTime) {
        return `
            <div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:1rem; border-radius:var(--radius-sm); font-size:0.9rem;">
                انتهت فترة تشغيل الفعالية رسمياً.
            </div>
        `;
    }

    // المستخدم مقبول والفعالية جارية الآن
    if (isActive) {
        return `<button class="btn btn-danger" onclick="clockOut('${ev.id}')">تسجيل الانصراف</button>`;
    } else {
        return `<button class="btn btn-primary" onclick="clockIn('${ev.id}', ${ev.latitude}, ${ev.longitude}, ${ev.geofence_radius_meters})">تسجيل الحضور</button>`;
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

function clockIn(eventId, tLat, tLng, radius) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const dist = calculateDistanceInMeters(pos.coords.latitude, pos.coords.longitude, tLat, tLng);
        if (dist > radius) return showToast(`أنت خارج النطاق بمسافة ${Math.round(dist)} متر!`, 'error');
        const db = getDb();
        await db.from('HAJIBEVENT-attendance').insert({ event_id: eventId, freelancer_id: AppState.user.id, check_in_time: new Date(), check_in_lat: pos.coords.latitude, check_in_lng: pos.coords.longitude });
        showToast('تم تسجيل حضورك بنجاح', 'success');
        routeView('event_detail', eventId);
    }, () => showToast('يرجى تفعيل صلاحية الـ GPS', 'error'), { enableHighAccuracy: true });
}

function clockOut(eventId) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const db = getDb();
        const { data: logs } = await db.from('HAJIBEVENT-attendance').select('id').eq('event_id', eventId).eq('freelancer_id', AppState.user.id).is('check_out_time', null).limit(1);
        if (logs && logs.length > 0) {
            await db.from('HAJIBEVENT-attendance').update({ check_out_time: new Date(), check_out_lat: pos.coords.latitude, check_out_lng: pos.coords.longitude }).eq('id', logs[0].id);
            showToast('تم تسجيل الانصراف بنجاح', 'success');
            routeView('event_detail', eventId);
        }
    }, () => showToast('يرجى تفعيل صلاحية الـ GPS', 'error'));
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
                        <label>تحديث السيرة الذاتية (CV الجديد)</label>
                        <input type="file" id="profCvFile" class="form-control" accept=".pdf,.doc,.docx">
                        ${p.cv_url ? `<div style="margin-top:0.4rem;"><a href="${p.cv_url}" target="_blank" style="font-size:0.82rem; color:var(--brand-primary);">استعراض السيرة الذاتية الحالية</a></div>` : ''}
                    </div>
                    <div class="form-group col-span-2">
                        <label>نبذة</label>
                        <textarea id="profBio" class="form-control" rows="3">${p.bio || ''}</textarea>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.5rem;">حفظ التعديلات</button>
            </form>
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
