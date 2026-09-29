/**
 * منصة حاجب لإدارة الفعاليات والكوادر - HAJIB CONTROL
 * كود لوحة الإدارة الشامل والكامل
 */

// إعدادات الاتصال بـ Supabase
const SUPABASE_URL = "https://cbyjokrlnnkihjhixdyz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AwLUhkBI0-7GxUpVkAUK2Q_5jPaVpqe";

function getDb() {
    if (window.HajibDB) return window.HajibDB;
    if (!window.supabase) return null;
    const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    window.HajibDB = window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY);
    return window.HajibDB;
}

// حالة نظام الإدارة
const AdminState = {
    user: null,
    managerData: null,
    currentTab: 'events',
    activeEventId: null
};

const SAUDI_REGIONS = ["الرياض", "مكة المكرمة", "المدينة المنورة", "القصيم", "المنطقة الشرقية", "عسير", "تبوك", "حائل", "الحدود الشمالية", "جازان", "نجران", "الباحة", "الجوف"];

let currentPrintLogs = [];
let currentFilterFrom = '';
let currentFilterTo = '';

// ==========================================
// الدوال المساعدة والتنبيهات
// ==========================================
function extractCoordinates(input) {
    if (!input) return null;
    const match = input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/) || input.match(/[@?&]q?=?(-?\d+\.\d+),(-?\d+\.\d+)/);
    return match ? { lat: parseFloat(match[1]), lng: parseFloat(match[2]) } : null;
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

function toggleSidebar() {
    const s = document.getElementById('adminSidebar');
    if (s) s.classList.toggle('open');
}

// حساب ساعات العمل مع كشف الانصراف السريع (ساعة أو أقل)
function calculateWorkDuration(checkIn, checkOut) {
    if (!checkOut) return { text: 'جلسة قائمة', hours: 0, isCancelled: false, diffMins: 0 };
    
    const diffMs = new Date(checkOut) - new Date(checkIn);
    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    const isCancelled = diffMins <= 60; // 60 دقيقة أو أقل تعتبر حركة ملغية

    return {
        text: `${h} س و ${m} د`,
        diffMins,
        isCancelled
    };
}

// ==========================================
// التهيئة وتسجيل الدخول
// ==========================================
async function initAdmin() {
    const db = getDb();
    if (!db) return;

    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    try {
        const { data: { session } } = await db.auth.getSession();
        if (session && session.user) {
            const { data: mgr } = await db.from('HAJIBEVENT-managers').select('*').eq('id', session.user.id).maybeSingle();
            if (mgr && !mgr.is_suspended) {
                AdminState.user = session.user;
                AdminState.managerData = mgr;
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        renderLayout();
    }
}

function renderLayout() {
    const layout = document.getElementById('adminAppLayout');
    const loginScreen = document.getElementById('adminLoginScreen');

    if (!AdminState.user) {
        if (layout) layout.style.display = 'none';
        if (loginScreen) {
            loginScreen.style.display = 'block';
            renderLogin(loginScreen);
        }
        return;
    }

    if (loginScreen) loginScreen.style.display = 'none';
    if (layout) layout.style.display = 'flex';

    // إظهار زر إضافة مدير فقط للمدير العام
    const btnAddMgr = document.getElementById('btnNavAddManager');
    if (btnAddMgr) {
        btnAddMgr.style.display = AdminState.managerData.access_all_events ? 'flex' : 'none';
    }

    const topInfo = document.getElementById('topbarUserInfo');
    if (topInfo) {
        topInfo.innerHTML = `
            <span style="font-weight:600; font-size:0.9rem;">${AdminState.managerData.full_name}</span>
            <span class="badge ${AdminState.managerData.access_all_events ? 'badge-success' : 'badge-warning'}" style="margin-right:0.6rem;">
                ${AdminState.managerData.access_all_events ? 'مدير عام لكافة الفعاليات' : 'مدير لفعالية محددة'}
            </span>
        `;
    }

    switchAdminTab(AdminState.currentTab);
}

function renderLogin(container) {
    container.innerHTML = `
        <div class="card-box auth-box" style="margin-top: 5rem;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div class="logo-symbol admin" style="margin: 0 auto 0.8rem;">A</div>
                <h2>بوابة إدارة الفعاليات - حاجب</h2>
                <p style="color:var(--text-muted); font-size:0.85rem;">تسجيل الدخول للمسؤولين المعتمدين</p>
            </div>
            <form onsubmit="handleLoginSubmit(event)">
                <div class="form-group" style="margin-bottom:1rem;">
                    <label>البريد الإلكتروني المعتمد</label>
                    <input type="email" id="adEmail" class="form-control" required placeholder="admin@hajib.com">
                </div>
                <div class="form-group" style="margin-bottom:1.5rem;">
                    <label>كلمة المرور</label>
                    <input type="password" id="adPass" class="form-control" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-primary btn-full">دخول لوحة الإدارة</button>
            </form>
        </div>
    `;
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const db = getDb();
    const email = document.getElementById('adEmail').value.trim();
    const password = document.getElementById('adPass').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return showToast(error.message, 'error');

    const { data: mgr } = await db.from('HAJIBEVENT-managers').select('*').eq('id', data.user.id).maybeSingle();
    if (!mgr || mgr.is_suspended) {
        await db.auth.signOut();
        return showToast('هذا الحساب غير معتمد كمدير أو أنه معلق', 'error');
    }

    AdminState.user = data.user;
    AdminState.managerData = mgr;
    renderLayout();
}

async function handleAdminLogout() {
    const db = getDb();
    if (db) await db.auth.signOut();
    AdminState.user = null;
    AdminState.managerData = null;
    renderLayout();
}

function switchAdminTab(tab) {
    AdminState.currentTab = tab;
    AdminState.activeEventId = null;

    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    if (tab === 'events') document.getElementById('btnNavEvents')?.classList.add('active');
    if (tab === 'staff') document.getElementById('btnNavStaff')?.classList.add('active');
    if (tab === 'reports') document.getElementById('btnNavReports')?.classList.add('active');

    const root = document.getElementById('adminRoot');
    switch (tab) {
        case 'events': renderEventsCatalog(root); break;
        case 'staff': renderStaff(root); break;
        case 'reports': renderReports(root); break;
    }
}

// ==========================================
// 1. عرض الفعاليات بنظام البطاقات
// ==========================================
async function renderEventsCatalog(container) {
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري تحميل الفعاليات...</p></div>';
    const db = getDb();

    let q = db.from('HAJIBEVENT-events').select('*').order('start_date', { ascending: false });
    if (!AdminState.managerData.access_all_events) {
        const ids = AdminState.managerData.assigned_event_ids || [];
        q = q.in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data: events } = await q;

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <div>
                <h2 style="font-size:1.4rem;">الفعاليات المتاحة للإدارة</h2>
                <p style="color:var(--text-muted); font-size:0.85rem;">اختر فعالية للتحكم بالكوادر والحضور والموقع</p>
            </div>
            ${AdminState.managerData.access_all_events ? `
                <button class="btn btn-primary" onclick="openEventModal()">
                    إضافة فعالية جديدة
                </button>
            ` : ''}
        </div>

        <div class="events-grid">
    `;

    if (!events || events.length === 0) {
        html += `<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:3rem;">لا توجد فعاليات مسندة إليك حالياً</p>`;
    } else {
        events.forEach(ev => {
            html += `
                <div class="event-card">
                    <div class="event-card-media">
                        <img src="${ev.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500'}" alt="">
                    </div>
                    <div class="event-card-body">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                            <h3 class="event-card-title">${ev.title}</h3>
                            ${ev.is_hidden ? '<span class="badge badge-warning">مخفية</span>' : '<span class="badge badge-success">نشطة</span>'}
                        </div>
                        <p style="color:var(--text-secondary); font-size:0.88rem; margin-bottom:1.5rem;">
                            المدينة: ${ev.city} | الأجر: <strong>${ev.daily_rate} ريال</strong>
                        </p>
                        <button class="btn btn-primary btn-full" onclick="openEventFullManageView('${ev.id}')">
                            إدارة الفعالية
                        </button>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ==========================================
// 2. شاشة الإدارة الموسعة للفعالية
// ==========================================
async function openEventFullManageView(eventId) {
    AdminState.activeEventId = eventId;
    const container = document.getElementById('adminRoot');
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري تحميل بيانات الفعالية...</p></div>';

    const db = getDb();
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();

    const { data: apps } = await db
        .from('HAJIBEVENT-applications')
        .select(`id, status, applied_at, freelancer:freelancer_id (id, full_name, phone, avatar_url, cv_url, city, id_number)`)
        .eq('event_id', eventId);

    const { data: logs } = await db
        .from('HAJIBEVENT-attendance')
        .select(`id, check_in_time, check_out_time, is_manual, freelancer:freelancer_id (full_name, id_number)`)
        .eq('event_id', eventId)
        .order('check_in_time', { ascending: false });

    const approvedList = (apps || []).filter(a => a.status === 'approved');
    const pendingList = (apps || []).filter(a => a.status === 'pending');

    container.innerHTML = `
        <div style="margin-bottom:1.5rem;">
            <button class="btn btn-outline" onclick="switchAdminTab('events')">العودة لقائمة الفعاليات</button>
        </div>

        <div class="admin-event-view-header">
            <div>
                <h1 style="font-size:1.6rem; font-weight:700; margin-bottom:0.4rem;">${ev.title}</h1>
                <p style="color:var(--text-muted); font-size:0.9rem;">
                    المدينة: ${ev.city} | النطاق المسموح: ${ev.geofence_radius_meters} متر | الأجر اليومي: ${ev.daily_rate} ريال
                </p>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-outline" onclick="openEventModal('${ev.id}')">تعديل البيانات والنطاق</button>
                <button class="btn btn-outline" onclick="toggleHideEvent('${ev.id}', ${ev.is_hidden})">
                    ${ev.is_hidden ? 'إظهار الفعالية' : 'إخفاء الفعالية'}
                </button>
                <button class="btn btn-danger" onclick="deleteEvent('${ev.id}')">حذف الفعالية</button>
            </div>
        </div>

        <!-- جدول الموظفين المعتمدين -->
        <div class="card-box" style="margin-bottom: 2rem;">
            <div class="table-header-box">
                <h3>موظفو الفعالية المعتمدون حالياً</h3>
                <span class="count-badge">${approvedList.length} موظف معتمد</span>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>رقم الهوية</th>
                            <th>الجوال</th>
                            <th>المدينة</th>
                            <th>التواصل</th>
                            <th>الإجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${approvedList.length === 0 ? '<tr><td colspan="6" style="text-align:center;">لا يوجد موظفون معتمدون حتى الآن</td></tr>' : ''}
                        ${approvedList.map(a => `
                            <tr>
                                <td>
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <img src="${a.freelancer?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}" style="width:38px; height:38px; border-radius:50%; object-fit:cover;" alt="">
                                        <strong>${a.freelancer?.full_name || 'غير معروف'}</strong>
                                    </div>
                                </td>
                                <td>${a.freelancer?.id_number || '-'}</td>
                                <td>${a.freelancer?.phone || '-'}</td>
                                <td>${a.freelancer?.city || '-'}</td>
                                <td>
                                    <a href="https://wa.me/${(a.freelancer?.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;">واتساب</a>
                                </td>
                                <td>
                                    <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="setApplicantStatus('${a.id}', 'rejected', '${ev.id}')">استبعاد</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- جدول المتقدمين الجدد -->
        <div class="card-box" style="margin-bottom: 2rem;">
            <div class="table-header-box">
                <h3>طلبات التقديم الجديدة</h3>
                <span class="count-badge">${pendingList.length} متقدم جديد</span>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المرشح</th>
                            <th>المدينة</th>
                            <th>السيرة الذاتية</th>
                            <th>التواصل</th>
                            <th>القرار التنظيمي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pendingList.length === 0 ? '<tr><td colspan="5" style="text-align:center;">لا توجد طلبات تقديم جديدة</td></tr>' : ''}
                        ${pendingList.map(a => `
                            <tr>
                                <td>
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <img src="${a.freelancer?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}" style="width:38px; height:38px; border-radius:50%; object-fit:cover;" alt="">
                                        <strong>${a.freelancer?.full_name || 'غير معروف'}</strong>
                                    </div>
                                </td>
                                <td>${a.freelancer?.city || '-'}</td>
                                <td>
                                    ${a.freelancer?.cv_url ? `<a href="${a.freelancer.cv_url}" target="_blank" class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;">استعراض CV</a>` : 'لا يوجد'}
                                </td>
                                <td>
                                    <a href="https://wa.me/${(a.freelancer?.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;">واتساب</a>
                                </td>
                                <td style="display:flex; gap:0.4rem;">
                                    <button class="btn btn-primary" style="padding:0.25rem 0.8rem; font-size:0.78rem;" onclick="setApplicantStatus('${a.id}', 'approved', '${ev.id}')">قبول</button>
                                    <button class="btn btn-danger" style="padding:0.25rem 0.8rem; font-size:0.78rem;" onclick="setApplicantStatus('${a.id}', 'rejected', '${ev.id}')">رفض</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- جدول الحضور والانصراف مع زر التحضير الطارئ -->
        <div class="card-box">
            <div class="table-header-box">
                <h3>سجل حضور وانصراف الفعالية الميداني</h3>
                <button class="btn btn-outline" onclick="openManualAttendanceModal('${ev.id}')">تحضير يدوي طارئ</button>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>رقم الهوية</th>
                            <th>تاريخ العمل</th>
                            <th>وقت الحضور</th>
                            <th>وقت الانصراف</th>
                            <th>نوع التحضير</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(!logs || logs.length === 0) ? '<tr><td colspan="6" style="text-align:center;">لا يوجد سجلات حضور لهذه الفعالية</td></tr>' : ''}
                        ${(logs || []).map(l => `
                            <tr>
                                <td><strong>${l.freelancer?.full_name || '-'}</strong></td>
                                <td>${l.freelancer?.id_number || '-'}</td>
                                <td>${new Date(l.check_in_time).toLocaleDateString('ar-SA')}</td>
                                <td>${new Date(l.check_in_time).toLocaleTimeString('ar-SA')}</td>
                                <td>${l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString('ar-SA') : 'جلسة قائمة'}</td>
                                <td>${l.is_manual ? '<span class="badge badge-warning">يدوي</span>' : '<span class="badge badge-success">ذاتي GPS</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function setApplicantStatus(id, st, eventId) {
    const db = getDb();
    await db.from('HAJIBEVENT-applications').update({ status: st }).eq('id', id);
    showToast('تم تحديث حالة المرشح بنجاح', 'success');
    openEventFullManageView(eventId);
}

async function toggleHideEvent(id, current) {
    const db = getDb();
    await db.from('HAJIBEVENT-events').update({ is_hidden: !current }).eq('id', id);
    showToast('تم تعديل ظهور الفعالية', 'success');
    openEventFullManageView(id);
}

async function deleteEvent(id) {
    if (!confirm('تحذير: هل أنت متأكد من حذف هذه الفعالية بالكامل مع جميع سجلاتها؟')) return;
    const db = getDb();
    await db.from('HAJIBEVENT-events').delete().eq('id', id);
    showToast('تم حذف الفعالية بنجاح', 'success');
    switchAdminTab('events');
}

// ==========================================
// 3. التحضير اليدوي الطارئ
// ==========================================
async function openManualAttendanceModal(eventId) {
    const db = getDb();
    
    // جلب موظفي الفعالية المقبولين فقط
    const { data: apps } = await db
        .from('HAJIBEVENT-applications')
        .select(`freelancer:freelancer_id (id, full_name, id_number)`)
        .eq('event_id', eventId)
        .eq('status', 'approved');

    const approvedStaff = (apps || []).map(a => a.freelancer).filter(Boolean);

    if (approvedStaff.length === 0) {
        return showToast('لا يوجد موظفون مقبولون في هذه الفعالية لتسجيل حضورهم', 'error');
    }

    const html = `
        <h3>تسجيل حضور طارئ يدوي</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.2rem;">مخصص للحالات الميدانية الطارئة عند انقطاع الإنترنت أو نفاذ بطارية الموظف</p>
        <form onsubmit="handleManualAttendanceSubmit(event, '${eventId}')">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>اختر الموظف المعتمد</label>
                <select id="manStaffId" class="form-control" required>
                    ${approvedStaff.map(s => `<option value="${s.id}">${s.full_name} (${s.id_number})</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>وقت وتاريخ الدخول</label>
                <input type="datetime-local" id="manInTime" class="form-control" required value="${new Date().toISOString().slice(0,16)}">
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>وقت وتاريخ الانصراف (اختياري)</label>
                <input type="datetime-local" id="manOutTime" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary btn-full">تأكيد تسجيل الحضور</button>
        </form>
    `;
    openModal(html);
}

async function handleManualAttendanceSubmit(e, eventId) {
    e.preventDefault();
    const db = getDb();
    const staffId = document.getElementById('manStaffId').value;
    const inTime = document.getElementById('manInTime').value;
    const outTime = document.getElementById('manOutTime').value;

    const payload = {
        event_id: eventId,
        freelancer_id: staffId,
        check_in_time: new Date(inTime),
        check_out_time: outTime ? new Date(outTime) : null,
        is_manual: true,
        manual_logged_by: AdminState.user.id
    };

    const { error } = await db.from('HAJIBEVENT-attendance').insert(payload);
    if (error) {
        showToast(error.message, 'error');
    } else {
        closeModal();
        showToast('تم تسجيل الحضور اليدوي بنجاح', 'success');
        openEventFullManageView(eventId);
    }
}

// ==========================================
// 4. إنشاء وتعديل الفعاليات (مع خرائط جوجل)
// ==========================================
async function openEventModal(eventId = null) {
    const db = getDb();
    let ev = null;
    if (eventId) {
        const { data } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();
        ev = data;
    }

    const html = `
        <h3>${ev ? 'تعديل بيانات الفعالية ونطاقها' : 'إضافة فعالية تشغيلية جديدة'}</h3>
        <form onsubmit="handleSaveEvent(event, '${eventId || ''}')" style="margin-top:1.2rem;">
            <div class="form-grid">
                <div class="form-group col-span-2">
                    <label>اسم الفعالية</label>
                    <input type="text" id="mTitle" class="form-control" value="${ev ? ev.title : ''}" required>
                </div>
                <div class="form-group">
                    <label>المدينة</label>
                    <select id="mCity" class="form-control">
                        ${SAUDI_REGIONS.map(c => `<option value="${c}" ${ev && ev.city === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>الأجر اليومي (ريال)</label>
                    <input type="number" id="mRate" class="form-control" value="${ev ? ev.daily_rate : ''}" required>
                </div>
                <div class="form-group">
                    <label>تاريخ البدء</label>
                    <input type="datetime-local" id="mStart" class="form-control" required value="${ev ? new Date(ev.start_date).toISOString().slice(0,16) : ''}">
                </div>
                <div class="form-group">
                    <label>تاريخ النهاية</label>
                    <input type="datetime-local" id="mEnd" class="form-control" required value="${ev ? new Date(ev.end_date).toISOString().slice(0,16) : ''}">
                </div>
                <div class="form-group col-span-2">
                    <label>موقع الفعالية من خرائط جوجل (الصق الرابط أو الإحداثيات مباشرة)</label>
                    <input type="text" id="mGmaps" class="form-control" placeholder="مثال: https://maps.google.com/?q=24.7136,46.6753 أو 24.7136, 46.6753" value="${ev ? `${ev.latitude}, ${ev.longitude}` : ''}" required>
                </div>
                <div class="form-group">
                    <label>نصف قطر النطاق المسموح (متر)</label>
                    <input type="number" id="mRadius" class="form-control" value="${ev ? ev.geofence_radius_meters : 350}" required>
                </div>
                <div class="form-group">
                    <label>رابط الصورة الغلاف</label>
                    <input type="url" id="mImg" class="form-control" value="${ev ? (ev.image_url || '') : ''}">
                </div>
                <div class="form-group col-span-2">
                    <label>الوصف والشروط</label>
                    <textarea id="mDesc" class="form-control" rows="3" required>${ev ? ev.description : ''}</textarea>
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.5rem;">حفظ ونشر الفعالية</button>
        </form>
    `;
    openModal(html);
}

async function handleSaveEvent(e, id) {
    e.preventDefault();
    const coords = extractCoordinates(document.getElementById('mGmaps').value);
    if (!coords) return showToast('رابط الموقع غير صحيح! يرجى لصق إحداثيات صحيحة', 'error');

    const payload = {
        title: document.getElementById('mTitle').value.trim(),
        city: document.getElementById('mCity').value,
        daily_rate: parseFloat(document.getElementById('mRate').value),
        start_date: new Date(document.getElementById('mStart').value),
        end_date: new Date(document.getElementById('mEnd').value),
        latitude: coords.lat,
        longitude: coords.lng,
        geofence_radius_meters: parseInt(document.getElementById('mRadius').value, 10),
        image_url: document.getElementById('mImg').value.trim(),
        description: document.getElementById('mDesc').value.trim()
    };

    const db = getDb();
    if (id) {
        await db.from('HAJIBEVENT-events').update(payload).eq('id', id);
        showToast('تم تحديث بيانات الفعالية', 'success');
        closeModal();
        openEventFullManageView(id);
    } else {
        await db.from('HAJIBEVENT-events').insert(payload);
        showToast('تم إنشاء الفعالية بنجاح', 'success');
        closeModal();
        switchAdminTab('events');
    }
}

// ==========================================
// 5. مركز التقارير وطباعة الـ PDF المعتمدة
// ==========================================
async function renderReports(container) {
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري تهيئة التقارير...</p></div>';
    const db = getDb();
    const { data: events } = await db.from('HAJIBEVENT-events').select('id, title');
    const { data: staff } = await db.from('HAJIBEVENT-profiles').select('id, full_name, id_number');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <div>
                <h2>مركز التقارير التنفيذية وسجلات العمل</h2>
                <p style="color:var(--text-muted); font-size:0.85rem;">استخراج وطباعة تقارير رسمية مفصلة</p>
            </div>
            <button class="btn btn-primary" onclick="printExecutiveReport()">طباعة تقرير PDF معتمد</button>
        </div>

        <div class="card-box" style="padding:1.4rem; margin-bottom:1.8rem;">
            <div class="form-grid">
                <div class="form-group">
                    <label>تحديد الفعالية</label>
                    <select id="repEvent" class="form-control" onchange="runReportFilter()">
                        <option value="">جميع الفعاليات</option>
                        ${(events || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>تحديد الموظف / الفريلانسر</label>
                    <select id="repStaff" class="form-control" onchange="runReportFilter()">
                        <option value="">كافة الكوادر</option>
                        ${(staff || []).map(s => `<option value="${s.id}">${s.full_name} (${s.id_number})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>من تاريخ</label>
                    <input type="date" id="repFrom" class="form-control" onchange="runReportFilter()">
                </div>
                <div class="form-group">
                    <label>إلى تاريخ</label>
                    <input type="date" id="repTo" class="form-control" onchange="runReportFilter()">
                </div>
            </div>
        </div>

        <div id="reportResultArea"></div>
    `;

    runReportFilter();
}

async function runReportFilter() {
    const resArea = document.getElementById('reportResultArea');
    if (!resArea) return;
    resArea.innerHTML = '<div style="text-align:center; padding:2rem;"><p>جاري توليد التقرير...</p></div>';

    const evId = document.getElementById('repEvent').value;
    const stId = document.getElementById('repStaff').value;
    const from = document.getElementById('repFrom').value;
    const to = document.getElementById('repTo').value;

    currentFilterFrom = from;
    currentFilterTo = to;

    const db = getDb();
    let q = db.from('HAJIBEVENT-attendance').select(`
        id, check_in_time, check_out_time, is_manual,
        freelancer:freelancer_id (full_name, id_number, phone),
        event:event_id (title, daily_rate)
    `).order('check_in_time', { ascending: false });

    if (evId) q = q.eq('event_id', evId);
    if (stId) q = q.eq('freelancer_id', stId);
    if (from) q = q.gte('check_in_time', new Date(from).toISOString());
    if (to) q = q.lte('check_in_time', new Date(to + 'T23:59:59').toISOString());

    const { data: logs } = await q;
    currentPrintLogs = logs || [];

    resArea.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الموظف</th>
                        <th>الهوية</th>
                        <th>الفعالية</th>
                        <th>تاريخ العمل</th>
                        <th>الدخول</th>
                        <th>الخروج</th>
                        <th>ساعات العمل</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${currentPrintLogs.length === 0 ? '<tr><td colspan="8" style="text-align:center;">لا توجد سجلات مطابقة</td></tr>' : ''}
                    ${currentPrintLogs.map(l => {
                        const duration = calculateWorkDuration(l.check_in_time, l.check_out_time);
                        const rowStyle = duration.isCancelled ? 'style="background: #fff1f2; color: #9f1239;"' : '';
                        
                        return `
                            <tr ${rowStyle}>
                                <td><strong>${l.freelancer?.full_name || '-'}</strong></td>
                                <td>${l.freelancer?.id_number || '-'}</td>
                                <td>${l.event?.title || '-'}</td>
                                <td>${new Date(l.check_in_time).toLocaleDateString('ar-SA')}</td>
                                <td>${new Date(l.check_in_time).toLocaleTimeString('ar-SA')}</td>
                                <td>${l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString('ar-SA') : 'جلسة قائمة'}</td>
                                <td><strong>${duration.text}</strong></td>
                                <td>
                                    ${duration.isCancelled 
                                        ? '<span class="badge badge-danger">ملغي (أقل من ساعة)</span>' 
                                        : (l.is_manual ? '<span class="badge badge-warning">يدوي</span>' : '<span class="badge badge-success">ذاتي GPS</span>')}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function printExecutiveReport() {
    // استبعاد السجلات الملغية (أقل من ساعة) من التقرير المطبوع نهائياً
    const validLogsToPrint = currentPrintLogs.filter(l => {
        if (!l.check_out_time) return true;
        const dur = calculateWorkDuration(l.check_in_time, l.check_out_time);
        return !dur.isCancelled;
    });

    if (validLogsToPrint.length === 0) {
        return showToast('لا توجد سجلات معتمدة لطباعتها (السجلات الملغية أقل من ساعة مستبعدة)', 'error');
    }

    const printWin = window.open('', '_blank', 'width=1000,height=750');
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير تنفيذي معتمد لحساب المستحقات - حاجب</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap');
                * { box-sizing: border-box; font-family: 'Readex Pro', sans-serif; }
                body { padding: 30px; color: #0f172a; background: #fff; }
                .report-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                h1 { margin: 0 0 4px; font-size: 19px; color: #0f172a; }
                p { margin: 2px 0; font-size: 12px; color: #475569; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11.5px; }
                th, td { border: 1px solid #94a3b8; padding: 7px 8px; text-align: right; }
                th { background-color: #f1f5f9; font-weight: 700; }
                .sign-line { border-bottom: 1px dotted #64748b; height: 18px; width: 100%; display: inline-block; }
                .signatures { margin-top: 45px; display: flex; justify-content: space-between; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div>
                    <h1>منصة حاجب لإدارة الفعاليات والكوادر المستقلة</h1>
                    <p>مسير الحضور الفعلي واستحقاقات الكوادر الميدانية (مستبعد منه الحركات العرضية)</p>
                </div>
                <div style="text-align: left;">
                    <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</p>
                    <p>الفترة: ${currentFilterFrom || 'البداية'} إلى ${currentFilterTo || 'الآن'}</p>
                    <p>عدد السجلات المعتمدة: ${validLogsToPrint.length}</p>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px;">م</th>
                        <th>اسم الموظف</th>
                        <th>رقم الهوية</th>
                        <th>الفعالية</th>
                        <th>تاريخ العمل</th>
                        <th>وقت الدخول</th>
                        <th>وقت الخروج</th>
                        <th>ساعات العمل</th>
                        <th style="width: 140px; text-align: center;">توقيع استلام المستحقات</th>
                    </tr>
                </thead>
                <tbody>
                    ${validLogsToPrint.map((l, i) => {
                        const dur = calculateWorkDuration(l.check_in_time, l.check_out_time);
                        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>${l.freelancer?.full_name || '-'}</strong></td>
                                <td>${l.freelancer?.id_number || '-'}</td>
                                <td>${l.event?.title || '-'}</td>
                                <td>${new Date(l.check_in_time).toLocaleDateString('ar-SA')}</td>
                                <td>${new Date(l.check_in_time).toLocaleTimeString('ar-SA')}</td>
                                <td>${l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString('ar-SA') : 'جلسة قائمة'}</td>
                                <td><strong>${dur.text}</strong></td>
                                <td><span class="sign-line"></span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div class="signatures">
                <div>
                    <p><strong>المشرف الميداني:</strong> ____________________</p>
                    <p style="margin-top: 8px;">التوقيع: ____________________</p>
                </div>
                <div>
                    <p><strong>المحاسب المالي:</strong> ____________________</p>
                    <p style="margin-top: 8px;">التوقيع: ____________________</p>
                </div>
                <div style="text-align: center;">
                    <p><strong>ختم الاعتماد الرسمي</strong></p>
                    <div style="width: 90px; height: 90px; border: 1px dashed #94a3b8; margin: 5px auto 0; border-radius: 50%;"></div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
        printWin.print();
        printWin.close();
    }, 400);
}

// ==========================================
// 6. إدارة الكوادر والموظفين
// ==========================================
async function renderStaff(container) {
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري التحميل...</p></div>';
    const db = getDb();
    const { data: staff } = await db.from('HAJIBEVENT-profiles').select('*').order('created_at', { ascending: false });

    container.innerHTML = `
        <h2 style="margin-bottom:1.5rem;">سجل الكوادر والموظفين الميدانيين</h2>
        <div class="table-container">
            <table class="data-table">
                <thead><tr><th>الموظف</th><th>الجوال</th><th>الهوية</th><th>المدينة</th><th>حالة الحساب</th><th>العمليات</th></tr></thead>
                <tbody>
                    ${(!staff || staff.length === 0) ? '<tr><td colspan="6" style="text-align:center;">لا يوجد كوادر مسجلة</td></tr>' : ''}
                    ${(staff || []).map(s => `
                        <tr>
                            <td><strong>${s.full_name}</strong></td>
                            <td>${s.phone}</td>
                            <td>${s.id_number}</td>
                            <td>${s.city}</td>
                            <td>${s.is_suspended ? '<span class="badge badge-danger">معلق</span>' : '<span class="badge badge-success">نشط</span>'}</td>
                            <td style="display:flex; gap:0.4rem;">
                                <button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="toggleStaffSuspension('${s.id}', ${s.is_suspended})">
                                    ${s.is_suspended ? 'إلغاء التعليق' : 'تعليق'}
                                </button>
                                <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="deleteStaff('${s.id}')">حذف</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function toggleStaffSuspension(id, st) {
    const db = getDb();
    await db.from('HAJIBEVENT-profiles').update({ is_suspended: !st }).eq('id', id);
    showToast('تم تعديل حالة الحساب بنجاح', 'success');
    renderStaff(document.getElementById('adminRoot'));
}

async function deleteStaff(id) {
    if (!confirm('هل أنت متأكد من حذف حساب هذا الموظف نهائياً؟')) return;
    const db = getDb();
    await db.from('HAJIBEVENT-profiles').delete().eq('id', id);
    showToast('تم حذف الحساب', 'success');
    renderStaff(document.getElementById('adminRoot'));
}

// ==========================================
// 7. إضافة مدير جديد وتحديد صلاحياته
// ==========================================
async function openNewManagerModal() {
    const db = getDb();
    const { data: events } = await db.from('HAJIBEVENT-events').select('id, title');

    const html = `
        <h3>إضافة مدير فعالية بصلاحيات محددة</h3>
        <form onsubmit="handleCreateManager(event)" style="margin-top:1.2rem;">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>الاسم الكامل</label>
                <input type="text" id="nMgrName" class="form-control" required>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>البريد الإلكتروني المعتمد</label>
                <input type="email" id="nMgrEmail" class="form-control" required>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>تعيين كلمة المرور</label>
                <input type="password" id="nMgrPass" class="form-control" required minlength="6">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>الصلاحية التشغيلية</label>
                <select id="nMgrScope" class="form-control" onchange="document.getElementById('eventPicker').style.display = this.value === 'specific' ? 'block' : 'none'">
                    <option value="all">مدير عام (كافة الفعاليات)</option>
                    <option value="specific">مدير لفعالية محددة فقط</option>
                </select>
            </div>
            <div id="eventPicker" class="form-group" style="display:none; margin-bottom:1.5rem;">
                <label>اختر الفعالية المصرح له بإدارتها</label>
                <select id="nMgrEvent" class="form-control">
                    ${(events || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-full">إنشاء حساب المدير</button>
        </form>
    `;
    openModal(html);
}

async function handleCreateManager(e) {
    e.preventDefault();
    const db = getDb();
    const name = document.getElementById('nMgrName').value.trim();
    const email = document.getElementById('nMgrEmail').value.trim();
    const password = document.getElementById('nMgrPass').value;
    const scope = document.getElementById('nMgrScope').value;
    const eventId = document.getElementById('nMgrEvent')?.value;

    showToast('جاري إنشاء الحساب...', 'info');
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) return showToast(error.message, 'error');

    await db.from('HAJIBEVENT-managers').insert({
        id: data.user.id,
        full_name: name,
        email: email,
        access_all_events: (scope === 'all'),
        assigned_event_ids: (scope === 'specific' && eventId) ? [eventId] : []
    });

    closeModal();
    showToast('تمت إضافة المدير بنجاح', 'success');
}

// ==========================================
// تصدير كافة الدوال للنطاق العام (Window Scope)
// ==========================================
window.switchAdminTab = switchAdminTab;
window.handleLoginSubmit = handleLoginSubmit;
window.handleAdminLogout = handleAdminLogout;
window.openEventFullManageView = openEventFullManageView;
window.openEventModal = openEventModal;
window.handleSaveEvent = handleSaveEvent;
window.toggleHideEvent = toggleHideEvent;
window.deleteEvent = deleteEvent;
window.setApplicantStatus = setApplicantStatus;
window.runReportFilter = runReportFilter;
window.printExecutiveReport = printExecutiveReport;
window.toggleStaffSuspension = toggleStaffSuspension;
window.deleteStaff = deleteStaff;
window.openNewManagerModal = openNewManagerModal;
window.handleCreateManager = handleCreateManager;
window.openManualAttendanceModal = openManualAttendanceModal;
window.handleManualAttendanceSubmit = handleManualAttendanceSubmit;
window.closeModal = closeModal;
window.handleBackdropClick = handleBackdropClick;
window.toggleSidebar = toggleSidebar;

// بدء تشغيل النظام عند اكتمال المستند
document.addEventListener('DOMContentLoaded', initAdmin);