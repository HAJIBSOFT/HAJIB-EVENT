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
// عرض إدارة الفعالية الموسع مع تقسيم الموظفين إلى فرق عمل ومشرفين
// عرض إدارة الفعالية الموسع مع الفرق وزر الواتساب وزر طباعة بيان الفرق وزر الاستبعاد
async function openEventFullManageView(eventId) {
    AdminState.activeEventId = eventId;
    const container = document.getElementById('adminRoot');
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري تحميل بيانات الفعالية وفرق العمل...</p></div>';

    const db = getDb();
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();

    // جلب الفرق الخاصة بهذه الفعالية
    const { data: teams } = await db
        .from('HAJIBEVENT-teams')
        .select(`id, team_name, leader_id, leader:leader_id (id, full_name, phone, avatar_url)`)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

    // جلب الموظفين المعتمدين والمتقدمين
    const { data: apps } = await db
        .from('HAJIBEVENT-applications')
        .select(`id, status, applied_at, team_id, freelancer:freelancer_id (*)`)
        .eq('event_id', eventId);

    // جلب الحضور
    const { data: logs } = await db
        .from('HAJIBEVENT-attendance')
        .select(`id, check_in_time, check_out_time, is_manual, freelancer:freelancer_id (full_name, id_number)`)
        .eq('event_id', eventId)
        .order('check_in_time', { ascending: false });

    const approvedList = (apps || []).filter(a => a.status === 'approved');
    const pendingList = (apps || []).filter(a => a.status === 'pending');
    const unassignedStaff = approvedList.filter(a => !a.team_id);

    container.innerHTML = `
        <div style="margin-bottom:1.5rem;">
            <button class="btn btn-outline" onclick="switchAdminTab('events')">العودة لقائمة الفعاليات</button>
        </div>

        <div class="admin-event-view-header">
            <div>
                <h1 style="font-size:1.6rem; font-weight:700; margin-bottom:0.4rem;">${ev.title}</h1>
                <p style="color:var(--text-muted); font-size:0.9rem;">
                    المدينة: ${ev.city} | النطاق: ${ev.geofence_radius_meters} متر | الأجر اليومي: ${ev.daily_rate} ريال
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

        <!-- قسم فرق العمل الميدانية -->
        <div class="card-box" style="margin-bottom: 2rem;">
            <div class="table-header-box" style="flex-wrap:wrap; gap:1rem;">
                <div>
<h3>فرق العمل الميدانية (${(teams || []).length} فرق و${approvedList.length} موظف)</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem;">تنظيم وتوزيع الكوادر وتعيين مشرف لكل فريق في هذه الفعالية</p>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <!-- زر طباعة بيان الفرق PDF -->
                    <button class="btn btn-outline" style="background:#f8fafc;" onclick="printEventTeamsStructure('${ev.id}')">
                        طباعة بيان الفرق والكوادر PDF
                    </button>
                    <!-- زر إنشاء فريق جديد -->
                    <button class="btn btn-primary" onclick="openCreateTeamModal('${ev.id}')">
                        إنشاء فريق عمل جديد
                    </button>
                </div>
            </div>

            <!-- عرض بطاقات الفرق -->
            ${(!teams || teams.length === 0) ? `
                <div style="text-align:center; padding:2rem; background:#f8fafc; border-radius:var(--radius-sm); border:1px dashed var(--border-subtle);">
                    <p style="color:var(--text-muted); font-size:0.9rem;">لم يتم إنشاء أي فريق بعد. ابدأ بإنشاء الفرق الميدانية وتعيين المشرفين لها.</p>
                </div>
            ` : `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:1.2rem; margin-top:1rem;">
                    ${teams.map(t => {
                        const teamMembers = approvedList.filter(a => a.team_id === t.id);
                        
                        // تجهيز مصفوفة الأعضاء لإرسالها بالواتساب
                        const membersPayload = teamMembers.map(m => ({
                            name: m.freelancer?.full_name || 'بدون اسم',
                            phone: m.freelancer?.phone || 'بدون جوال'
                        }));
                        const membersJsonSafe = encodeURIComponent(JSON.stringify(membersPayload));

                        return `
                            <div style="background:#ffffff; border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1.2rem; box-shadow:var(--shadow-soft);">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                                    <div>
                                        <h4 style="font-size:1.1rem; margin-bottom:0.2rem;">${t.team_name}</h4>
                                        <span class="count-badge">${teamMembers.length} أعضاء</span>
                                    </div>
                                    <div style="display:flex; gap:0.3rem;">
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="openEditTeamModal('${t.id}', '${ev.id}')">تعديل الأعضاء</button>
                                        <button class="btn btn-danger" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="deleteTeam('${t.id}', '${ev.id}')">حذف الفريق</button>
                                    </div>
                                </div>

                                <!-- بطاقة المشرف وزر إرسال قائمة الكادر -->
                                <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:6px; padding:0.7rem 0.8rem; margin-bottom:0.8rem;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                                        <div style="display:flex; align-items:center; gap:0.5rem;">
                                            <img src="${t.leader?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" alt="">
                                            <div>
                                                <span style="font-size:0.72rem; color:#92400e; font-weight:700; display:block;">مشرف الفريق</span>
                                                <strong style="font-size:0.85rem;">${t.leader?.full_name || 'لم يحدد مشرف'}</strong>
                                            </div>
                                        </div>
                                        ${t.leader?.phone ? `
                                            <a href="https://wa.me/966${t.leader.phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.72rem; background:#fff;">واتساب المشرف</a>
                                        ` : ''}
                                    </div>
                                    
                                    <!-- زر إرسال قائمة الموظفين لمشرف التيم عبر الواتساب -->
                                    ${t.leader?.phone ? `
                                        <button class="btn btn-outline btn-full" style="background:#ecfdf5; border-color:#a7f3d0; color:#065f46; font-size:0.78rem; padding:0.35rem 0.5rem;" 
                                                onclick="dispatchTeamWhatsApp('${t.leader.phone}', '${t.leader.full_name}', '${t.team_name}', '${ev.title}', '${membersJsonSafe}')">
                                            إرسال قائمة الكادر للمشرف عبر واتساب
                                        </button>
                                    ` : ''}
                                </div>

                                <!-- قائمة أعضاء الفريق -->
                                <div style="font-size:0.82rem;">
                                    <span style="color:var(--text-muted); display:block; margin-bottom:0.4rem;">أعضاء الفريق:</span>
                                    <div style="max-height:140px; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; padding:0.4rem 0.6rem; background:#f8fafc;">
                                        ${teamMembers.length === 0 ? '<p style="color:var(--text-muted); font-size:0.8rem;">لا يوجد أعضاء في هذا الفريق بعد</p>' : ''}
                                        ${teamMembers.map(m => `
                                            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; border-bottom:1px solid #f1f5f9;">
                                                <span>${m.freelancer?.full_name}</span>
                                                <span style="font-size:0.75rem; color:var(--text-muted);" dir="ltr">${m.freelancer?.phone || ''}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}

            <!-- الكوادر غير المعينة مع زر التعيين وزر الاستبعاد -->
            ${unassignedStaff.length > 0 ? `
                <div style="margin-top:2rem; padding-top:1.2rem; border-top:1px solid var(--border-subtle);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                        <h4 style="font-size:0.95rem; color:#b45309;">كوادر معتمدة بانتظار التوزيع على الفرق (${unassignedStaff.length} موظف)</h4>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>الموظف</th>
                                    <th>رقم الهوية</th>
                                    <th>الجوال</th>
                                    <th>المدينة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${unassignedStaff.map(a => `
                                    <tr>
                                        <td><strong>${a.freelancer?.full_name}</strong></td>
                                        <td>${a.freelancer?.id_number}</td>
                                        <td dir="ltr" style="text-align:right;">${a.freelancer?.phone}</td>
                                        <td>${a.freelancer?.city}</td>
                                        <td>
                                            <div style="display:flex; gap:0.4rem;">
                                                <!-- زر تعيين لفريق -->
                                                <button class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="openAssignSingleStaffModal('${a.id}', '${ev.id}')">
                                                    تعيين لفريق
                                                </button>
                                                <!-- زر الاستبعاد من الفعالية -->
                                                <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="setApplicantStatus('${a.id}', 'rejected', '${ev.id}')">
                                                    استبعاد
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        </div>

       <!-- جدول طلبات التقديم الجديدة مع البحث وفلترة الجنسية ومعاينة الملف -->
        <div class="card-box" style="margin-bottom: 2rem;">
            <div class="table-header-box" style="flex-wrap:wrap; gap:1rem;">
                <div>
                    <h3>طلبات التقديم الجديدة</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem;">فرز ومعاينة المتقدمين واتخاذ قرار القبول أو الرفض</p>
                </div>
                <span class="count-badge" id="pendingCountBadge">${pendingList.length} متقدم جديد</span>
            </div>

            <!-- شريط البحث وفلترة الجنسية -->
            <div style="background:#f8fafc; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1rem; margin-bottom:1.2rem;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; align-items:flex-end;">
                    <div class="form-group" style="grid-column: span 2;">
                        <label style="font-size:0.8rem; font-weight:600;">البحث في المتقدمين</label>
                        <input type="text" id="pendingSearchInput" class="form-control" 
                               placeholder="ابحث بالاسم، رقم الجوال، أو رقم الهوية..." 
                               oninput="filterPendingApplicants('${ev.id}')">
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">فلترة بالجنسية</label>
                        <select id="pendingNatFilter" class="form-control" onchange="filterPendingApplicants('${ev.id}')">
                            <option value="">كافة الجنسيات</option>
                            ${[...new Set(pendingList.map(a => a.freelancer?.nationality).filter(Boolean))].map(n => `<option value="${n}">${n}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <!-- جدول المتقدمين المطور -->
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المرشح</th>
                            <th>الجنسية</th>
                            <th>المدينة</th>
                            <th>الهوية</th>
                            <th>التواصل</th>
                            <th style="text-align:center;">الإجراءات والقرار</th>
                        </tr>
                    </thead>
                    <tbody id="pendingApplicantsTbody">
                        <!-- يتم حقن الصفوف تلقائياً عبر دالة الفلترة -->
                    </tbody>
                </table>
            </div>
        </div>

       <!-- قسم سجل حضور وانصراف الفعالية الميداني المطور -->
        <div class="card-box" id="eventAttendanceSection">
            <div class="table-header-box" style="flex-wrap:wrap; gap:1rem;">
                <div>
                    <h3>سجل حضور وانصراف الفعالية الميداني</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem;">متابعة الجلسات الميدانية، تعديل الأوقات، وطباعة كشوفات المستحقات</p>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <!-- زر طباعة تقرير حضور الفعالية مع التواقيع والمشرفين -->
                    <button class="btn btn-outline" style="background:#f8fafc;" onclick="printEventAttendanceReport('${ev.id}')">
                        طباعة كشف الحضور والتواقيع PDF
                    </button>
                    <!-- زر التحضير اليدوي الطارئ -->
                    <button class="btn btn-primary" onclick="openManualAttendanceModal('${ev.id}')">
                        تحضير يدوي طارئ
                    </button>
                </div>
            </div>

            <!-- فلاتر الفعالية: الموظف ومن تاريخ إلى تاريخ -->
            <div style="background:#f8fafc; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1rem; margin-bottom:1.2rem;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; align-items:flex-end;">
                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">فلترة بالموظف</label>
                        <select id="evAttStaffFilter" class="form-control" onchange="runEventAttendanceFilter('${ev.id}')">
                            <option value="">كافة موظفي الفعالية</option>
                            ${approvedList.map(a => `<option value="${a.freelancer?.id}">${a.freelancer?.full_name} (${a.freelancer?.id_number})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">من تاريخ</label>
                        <input type="date" id="evAttDateFrom" class="form-control" onchange="runEventAttendanceFilter('${ev.id}')">
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.8rem; font-weight:600;">إلى تاريخ</label>
                        <input type="date" id="evAttDateTo" class="form-control" onchange="runEventAttendanceFilter('${ev.id}')">
                    </div>
                </div>
            </div>

            <!-- جدول الحضور والانصراف مع زر القلم وبدون نوع التحضير -->
            <div class="table-container" id="evAttendanceTableContainer">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>رقم الهوية</th>
                            <th>تاريخ العمل</th>
                            <th>وقت الحضور</th>
                            <th>وقت الانصراف</th>
                            <th>عدد الساعات</th>
                            <th style="text-align:center;">إجراء</th>
                        </tr>
                    </thead>
                    <tbody id="evAttendanceTbody">
                        <!-- يتم ملء الصفوف تلقائياً عبر دالة الفلترة -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
	// تشغيل جدول الحضور بالبيانات الحالية
    runEventAttendanceFilter(eventId);
	// حفظ قائمة المتقدمين الحالية وتشغيل الفلترة التلقائية
    currentEventPendingList = pendingList;
    filterPendingApplicants(eventId);
}


async function setApplicantStatus(id, st, eventId) {
    const db = getDb();
    
    // جلب معرف الموظف وبيانات الفعالية لإرسال الإشعار له
    const { data: app } = await db
        .from('HAJIBEVENT-applications')
        .select(`freelancer_id, event:event_id(title)`)
        .eq('id', id)
        .single();

    // تحديث حالة الطلب
    await db.from('HAJIBEVENT-applications').update({ status: st }).eq('id', id);
    showToast(`تم ${st === 'approved' ? 'قبول' : 'رفض'} المرشح بنجاح`, 'info');

    // إرسال إشعار فوري لهاتف الموظف
    if (app && app.freelancer_id) {
        const isAppr = st === 'approved';
        await db.from('HAJIBEVENT-notifications').insert({
            user_id: app.freelancer_id,
            event_id: eventId,
            title: isAppr ? 'تم قبولك في الفعالية' : 'تحديث بخصوص طلب التقديم',
            message: isAppr 
                ? `تهانينا! تم قبولك رسمياً في تنظيم فعالية (${app.event?.title}). يمكنك الآن الاطلاع على التفاصيل وفريقك.`
                : `نعتذر منك، لم يتم قبول طلبك في فعالية (${app.event?.title}). نتمنى لك التوفيق في الفعاليات القادمة.`
        });
    }

    if (AdminState.activeEventId) {
        openEventFullManageView(eventId);
    }
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
// متغير لحفظ بيانات الكوادر محلياً للبحث والفلترة الفورية فائقة السرعة
let allStaffList = [];

// عرض صفحة الكوادر مع خانة البحث والفلاتر المتقدمة
async function renderStaff(container) {
    container.innerHTML = '<div style="text-align:center; padding:3rem;"><p>جاري تحميل سجل الكوادر...</p></div>';
    const db = getDb();
    
    // جلب جميع ملفات الكوادر من قاعدة البيانات
    const { data: staff } = await db
        .from('HAJIBEVENT-profiles')
        .select('*')
        .order('created_at', { ascending: false });

    allStaffList = staff || [];

    // استخراج الجنسيات والمدن المتوفرة ديناميكياً للفلاتر
    const availableNationalities = [...new Set(allStaffList.map(s => s.nationality).filter(Boolean))];
    const availableCities = [...new Set(allStaffList.map(s => s.city).filter(Boolean))];

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
            <div>
                <h2>سجل الكوادر والموظفين الميدانيين</h2>
                <p style="color:var(--text-muted); font-size:0.85rem;">إدارة بيانات الكوادر، البحث، والمعاينة الشاملة</p>
            </div>
            <div>
                <span class="count-badge" id="staffCountBadge">${allStaffList.length} كادر مسجل</span>
            </div>
        </div>

        <!-- صندوق البحث والفلاتر المتقدمة -->
        <div class="card-box" style="padding:1.4rem; margin-bottom:1.5rem;">
            <!-- خانة البحث بالاسم أو الجوال أو الهوية -->
            <div style="margin-bottom:1.2rem;">
                <input type="text" id="staffSearchInput" class="form-control" 
                       placeholder="ابحث باسم الموظف، رقم الجوال، أو رقم الهوية الوطنية..." 
                       oninput="filterStaffTable()">
            </div>

            <!-- الفلاتر المنسدلة -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:1rem;">
                <!-- فلتر الجنسية -->
                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">الجنسية</label>
                    <select id="staffFilterNat" class="form-control" onchange="filterStaffTable()">
                        <option value="">كافة الجنسيات</option>
                        ${availableNationalities.map(n => `<option value="${n}">${n}</option>`).join('')}
                    </select>
                </div>

                <!-- فلتر المدينة -->
                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">المدينة</label>
                    <select id="staffFilterCity" class="form-control" onchange="filterStaffTable()">
                        <option value="">كافة المدن</option>
                        ${availableCities.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>

                <!-- فلتر الجنس -->
                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">الجنس</label>
                    <select id="staffFilterGender" class="form-control" onchange="filterStaffTable()">
                        <option value="">الكل</option>
                        <option value="ذكر">ذكر</option>
                        <option value="أنثى">أنثى</option>
                    </select>
                </div>

                <!-- فلتر حالة الحساب -->
                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">حالة الحساب</label>
                    <select id="staffFilterStatus" class="form-control" onchange="filterStaffTable()">
                        <option value="">كافة الحالات</option>
                        <option value="active">نشط</option>
                        <option value="suspended">معلق</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- جدول الكوادر المتجاوب -->
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>الموظف</th>
                        <th>الجنسية</th>
                        <th>المدينة</th>
                        <th>الجنس</th>
                        <th>الجوال</th>
                        <th>الحالة</th>
                        <th>العمليات والإجراءات</th>
                    </tr>
                </thead>
                <tbody id="staffTableBody">
                    <!-- تُحقن الصفوف هنا عبر دالة الفلترة -->
                </tbody>
            </table>
        </div>
    `;

    // عرض القائمة الأولية
    filterStaffTable();
}

// دالة الفلترة والبحث الفوري في سجل الكوادر
function filterStaffTable() {
    const searchVal = (document.getElementById('staffSearchInput')?.value || '').trim().toLowerCase();
    const natVal = document.getElementById('staffFilterNat')?.value || '';
    const cityVal = document.getElementById('staffFilterCity')?.value || '';
    const genderVal = document.getElementById('staffFilterGender')?.value || '';
    const statusVal = document.getElementById('staffFilterStatus')?.value || '';

    // تصفية المصفوفة بناءً على المدخلات
    const filtered = allStaffList.filter(s => {
        const matchSearch = !searchVal || 
            (s.full_name && s.full_name.toLowerCase().includes(searchVal)) ||
            (s.phone && s.phone.includes(searchVal)) ||
            (s.id_number && s.id_number.includes(searchVal));

        const matchNat = !natVal || s.nationality === natVal;
        const matchCity = !cityVal || s.city === cityVal;
        const matchGender = !genderVal || s.gender === genderVal;
        
        let matchStatus = true;
        if (statusVal === 'active') matchStatus = !s.is_suspended;
        if (statusVal === 'suspended') matchStatus = !!s.is_suspended;

        return matchSearch && matchNat && matchCity && matchGender && matchStatus;
    });

    // تحديث عدد النتائج
    const badge = document.getElementById('staffCountBadge');
    if (badge) badge.innerText = `${filtered.length} كادر مطابق`;

    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">لا توجد كوادر مطابقة لخيارات البحث المحددة</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <!-- صورة الموظف والاسم -->
            <td>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <img src="${s.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" 
                         style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border-subtle); background:#f1f5f9;" alt="">
                    <div>
                        <strong>${s.full_name || 'غير معروف'}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${s.id_number || '-'}</div>
                    </div>
                </div>
            </td>
            <!-- الجنسية -->
            <td><span class="badge" style="background:#f1f5f9; color:var(--text-primary);">${s.nationality || '-'}</span></td>
            <!-- المدينة -->
            <td>${s.city || '-'}</td>
            <!-- الجنس -->
            <td>${s.gender || '-'}</td>
            <!-- الجوال -->
            <td dir="ltr" style="text-align:right;">${s.phone || '-'}</td>
            <!-- الحالة -->
            <td>
                ${s.is_suspended 
                    ? '<span class="badge badge-danger">معلق</span>' 
                    : '<span class="badge badge-success">نشط</span>'}
            </td>
            <!-- أزرار العمليات -->
            <td>
                <div style="display:flex; gap:0.4rem; align-items:center;">
                    <!-- زر معاينة كل معلومات الموظف -->
                    <button class="btn btn-outline" style="padding:0.3rem 0.65rem; font-size:0.78rem;" 
                            onclick="viewStaffFullProfile('${s.id}')">
                        معاينة الملف
                    </button>
                    <!-- تعليق / تفعيل -->
                    <button class="btn btn-outline" style="padding:0.3rem 0.65rem; font-size:0.78rem;" 
                            onclick="toggleStaffSuspension('${s.id}', ${s.is_suspended})">
                        ${s.is_suspended ? 'إلغاء التعليق' : 'تعليق'}
                    </button>
                    <!-- حذف -->
                    <button class="btn btn-danger" style="padding:0.3rem 0.65rem; font-size:0.78rem;" 
                            onclick="deleteStaff('${s.id}')">
                        حذف
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// نافذة منبثقة احترافية لمعاينة كافة تفاصيل الموظف وسيرته الذاتية
// نافذة معاينة البروفايل الشاملة مع خيارات استعادة وتعيين كلمة المرور
function viewStaffFullProfile(staffId) {
    const s = (allStaffList || []).find(item => item.id === staffId);
    if (!s) return showToast('لم يتم العثور على بيانات الموظف', 'error');

    const html = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; padding-bottom:1.2rem; border-bottom:1px solid var(--border-subtle);">
            <div style="display:flex; align-items:center; gap:1.2rem;">
                <img src="${s.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" 
                     style="width:70px; height:70px; border-radius:50%; object-fit:cover; border:2px solid var(--brand-primary); background:#f1f5f9;" alt="">
                <div>
                    <h2 style="font-size:1.3rem; margin-bottom:0.2rem;">${s.full_name}</h2>
                    <span class="badge ${s.is_suspended ? 'badge-danger' : 'badge-success'}">
                        ${s.is_suspended ? 'حساب معلق' : 'حساب نشط'}
                    </span>
                </div>
            </div>
            <div>
                <a href="https://wa.me/966${(s.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
                    مراسلة واتساب
                </a>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.2rem; font-size:0.88rem;">
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">رقم الهوية / الإقامة:</span>
                <strong>${s.id_number || '-'} (${s.id_type || 'هوية وطنية'})</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">البريد الإلكتروني:</span>
                <strong>${s.email || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">رقم الجوال:</span>
                <strong dir="ltr">${s.phone || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">تاريخ الميلاد:</span>
                <strong>${s.dob || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">الجنسية:</span>
                <strong>${s.nationality || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">المدينة / المنطقة:</span>
                <strong>${s.city || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">الجنس:</span>
                <strong>${s.gender || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">فصيلة الدم:</span>
                <strong>${s.blood_type || '-'}</strong>
            </div>
            <div style="grid-column: span 2;">
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">اللغات المتقنة:</span>
                <strong>${s.languages || 'العربية'}</strong>
            </div>
            <div style="grid-column: span 2;">
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">رقم STC BANK:</span>
                <p style="background:#f8fafc; padding:0.8rem; border-radius:6px; border:1px solid var(--border-subtle); line-height:1.6;">
                    ${s.bio || 'لايوجد رقم مسجل'}
                </p>
            </div>
            <div style="grid-column: span 2; padding-top:0.8rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <div><strong>الهوية:</strong></div>
                <div>
                    ${s.cv_url 
                        ? `<a href="${s.cv_url}" target="_blank" class="btn btn-primary" style="padding:0.35rem 0.9rem; font-size:0.8rem;">معاينة الهوية</a>` 
                        : '<span style="color:var(--text-muted); font-size:0.85rem;">لم يتم رفع صورة الهوية</span>'}
                </div>
            </div>

            <!-- قسم إدارة كلمة المرور الجديد للمدير -->
            <div style="grid-column: span 2; margin-top:0.8rem; padding-top:1.2rem; border-top:1px solid var(--border-subtle); background:#f8fafc; padding:1rem; border-radius:var(--radius-sm);">
                <span style="font-weight:700; color:var(--text-primary); font-size:0.88rem; display:block; margin-bottom:0.6rem;">
                    إدارة الدخول وأمان حساب الموظف:
                </span>
                <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
                    <!-- الخيار الأول: إرسال رابط استعادة للإيميل -->
                    <button type="button" class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.8rem; background:#fff;"
                            onclick="adminSendResetEmail('${s.email}')">
                        إرسال رابط الاستعادة للإيميل
                    </button>
                    <!-- الخيار الثاني: تعيين كلمة المرور وإرسالها بالواتساب -->
                    <button type="button" class="btn btn-primary" style="font-size:0.8rem; padding:0.4rem 0.8rem;"
                            onclick="openSetPasswordModal('${s.id}', '${s.full_name}', '${s.email}', '${s.phone}')">
                        تعيين كلمة مرور وإرسالها واتساب
                    </button>
                </div>
            </div>
        </div>
    `;
    openModal(html);
}

// تحديث ربط الدوال بنافذة المتصفح العامة
window.filterStaffTable = filterStaffTable;
window.viewStaffFullProfile = viewStaffFullProfile;

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


// نافذة إنشاء فريق جديد
async function openCreateTeamModal(eventId) {
    const db = getDb();
    
    // جلب الموظفين المعتمدين في هذه الفعالية لاختيار المشرف والأعضاء
    const { data: apps } = await db
        .from('HAJIBEVENT-applications')
        .select(`id, freelancer_id, freelancer:freelancer_id(id, full_name, id_number)`)
        .eq('event_id', eventId)
        .eq('status', 'approved');

    const approvedStaff = (apps || []).map(a => a.freelancer).filter(Boolean);

    if (approvedStaff.length === 0) {
        return showToast('يجب قبول موظفين في الفعالية أولاً لإنشاء الفرق وتعيين المشرفين', 'error');
    }

    const html = `
        <h3>إنشاء فريق عمل ميداني للفعالية</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.2rem;">هذا التوزيع خاص بهذه الفعالية فقط ولن يرتبط بأي فعاليات سابقة أو قادمة</p>
        <form onsubmit="handleSaveTeamSubmit(event, '${eventId}')">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>اسم الفريق (مثال: موظفو البوابة الشرقية، فريق التشريفات...)</label>
                <input type="text" id="newTeamName" class="form-control" required placeholder="اكتب اسم الفريق...">
            </div>

            <div class="form-group" style="margin-bottom:1rem;">
                <label>المشرف (Team Leader)</label>
                <select id="newTeamLeader" class="form-control" required>
                    <option value="">اختر المشرف من الكادر المعتمد...</option>
                    ${approvedStaff.map(s => `<option value="${s.id}">${s.full_name} (${s.id_number})</option>`).join('')}
                </select>
            </div>

            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>تحديد أعضاء الفريق الميدانيين</label>
                <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; padding:0.8rem; background:#f8fafc;">
                    ${approvedStaff.map(s => `
                        <label style="display:flex; align-items:center; gap:0.6rem; padding:0.3rem 0; font-size:0.88rem; cursor:pointer;">
                            <input type="checkbox" name="teamMemberCheckbox" value="${s.id}">
                            <span>${s.full_name} (${s.id_number})</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <button type="submit" class="btn btn-primary btn-full">حفظ واعتماد الفريق</button>
        </form>
    `;
    openModal(html);
}

// حفظ الفريق في قاعدة البيانات وربط الموظفين
async function handleSaveTeamSubmit(e, eventId) {
    e.preventDefault();
    const db = getDb();
    const teamName = document.getElementById('newTeamName').value.trim();
    const leaderId = document.getElementById('newTeamLeader').value;
    
    // جمع معرفات الأعضاء المحددين
    const memberCheckboxes = document.querySelectorAll('input[name="teamMemberCheckbox"]:checked');
    const selectedMemberIds = Array.from(memberCheckboxes).map(cb => cb.value);

    // إضافة المشرف تلقائياً إلى أعضاء الفريق إن لم يكن محدداً
    if (leaderId && !selectedMemberIds.includes(leaderId)) {
        selectedMemberIds.push(leaderId);
    }

    showToast('جاري إنشاء الفريق وتوزيع الموظفين...', 'info');

    // 1. إنشاء الفريق في HAJIBEVENT-teams
    const { data: team, error: teamErr } = await db
        .from('HAJIBEVENT-teams')
        .insert({
            event_id: eventId,
            team_name: teamName,
            leader_id: leaderId
        })
        .select()
        .single();

    if (teamErr) return showToast(teamErr.message, 'error');

    // 2. تحديث جدول التقديمات الخاص بهذه الفعالية فقط لربطهم بالفريق
    if (selectedMemberIds.length > 0) {
        await db
            .from('HAJIBEVENT-applications')
            .update({ team_id: team.id })
            .eq('event_id', eventId)
            .in('freelancer_id', selectedMemberIds);
    }

    closeModal();
    showToast('تم إنشاء الفريق وتعيين المشرف والأعضاء بنجاح', 'success');
    openEventFullManageView(eventId);
	// إشعار الموظف بانضمامه لفريق عمل ميداني
await db.from('HAJIBEVENT-notifications').insert({
    user_id: staffId,
    event_id: eventId,
    title: 'تم تعيينك في فريق عمل',
    message: `تم توزيعك رسمياً ضمن (${teamName}) للفعالية. تفقد بطاقة مشرفك الميداني للتواصل والتنسيق.`
});
}

// حذف الفريق وإرجاع موظفيه إلى قائمة غير المعينين
async function deleteTeam(teamId, eventId) {
    if (!confirm('هل أنت متأكد من حذف هذا الفريق؟ سيعود موظفوه ككوادر معتمدة غير معينة لفريق.')) return;
    const db = getDb();
    
    // إزالة تعيين الموظفين من الفريق
    await db.from('HAJIBEVENT-applications').update({ team_id: null }).eq('team_id', teamId);
    
    // حذف الفريق
    await db.from('HAJIBEVENT-teams').delete().eq('id', teamId);
    
    showToast('تم حذف الفريق بنجاح', 'success');
    openEventFullManageView(eventId);
}

// نافذة تعديل أعضاء الفريق ومشرفه
async function openEditTeamModal(teamId, eventId) {
    const db = getDb();
    
    const { data: team } = await db.from('HAJIBEVENT-teams').select('*').eq('id', teamId).single();
    const { data: apps } = await db
        .from('HAJIBEVENT-applications')
        .select(`freelancer_id, team_id, freelancer:freelancer_id(id, full_name, id_number)`)
        .eq('event_id', eventId)
        .eq('status', 'approved');

    const approvedStaff = (apps || []).map(a => a.freelancer).filter(Boolean);
    const currentMemberIds = (apps || []).filter(a => a.team_id === teamId).map(a => a.freelancer_id);

    const html = `
        <h3>تعديل فريق: ${team.team_name}</h3>
        <form onsubmit="handleUpdateTeamSubmit(event, '${teamId}', '${eventId}')" style="margin-top:1.2rem;">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>اسم الفريق</label>
                <input type="text" id="editTeamName" class="form-control" value="${team.team_name}" required>
            </div>

            <div class="form-group" style="margin-bottom:1rem;">
                <label>المشرف</label>
                <select id="editTeamLeader" class="form-control" required>
                    ${approvedStaff.map(s => `<option value="${s.id}" ${s.id === team.leader_id ? 'selected' : ''}>${s.full_name} (${s.id_number})</option>`).join('')}
                </select>
            </div>

            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>الأعضاء الميدانيون التابعون للفريق</label>
                <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; padding:0.8rem; background:#f8fafc;">
                    ${approvedStaff.map(s => `
                        <label style="display:flex; align-items:center; gap:0.6rem; padding:0.3rem 0; font-size:0.88rem; cursor:pointer;">
                            <input type="checkbox" name="editTeamCheckbox" value="${s.id}" ${currentMemberIds.includes(s.id) ? 'checked' : ''}>
                            <span>${s.full_name} (${s.id_number})</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <button type="submit" class="btn btn-primary btn-full">حفظ التعديلات</button>
        </form>
    `;
    openModal(html);
}

// تحديث الفريق وأعضائه
async function handleUpdateTeamSubmit(e, teamId, eventId) {
    e.preventDefault();
    const db = getDb();
    const teamName = document.getElementById('editTeamName').value.trim();
    const leaderId = document.getElementById('editTeamLeader').value;

    const checkedBoxes = document.querySelectorAll('input[name="editTeamCheckbox"]:checked');
    const newMemberIds = Array.from(checkedBoxes).map(cb => cb.value);
    if (leaderId && !newMemberIds.includes(leaderId)) newMemberIds.push(leaderId);

    // 1. تحديث اسم الفريق والمشرف
    await db.from('HAJIBEVENT-teams').update({ team_name: teamName, leader_id: leaderId }).eq('id', teamId);

    // 2. تصفير الفريق الحالي لهذا الحدث
    await db.from('HAJIBEVENT-applications').update({ team_id: null }).eq('event_id', eventId).eq('team_id', teamId);

    // 3. إعادة تعيين الأعضاء المختارين الجدد
    if (newMemberIds.length > 0) {
        await db.from('HAJIBEVENT-applications').update({ team_id: teamId }).eq('event_id', eventId).in('freelancer_id', newMemberIds);
    }

    closeModal();
    showToast('تم تحديث بيانات الفريق بنجاح', 'success');
    openEventFullManageView(eventId);
}

// نافذة التعيين السريع لموظف فردي إلى فريق
async function openAssignSingleStaffModal(appId, eventId) {
    const db = getDb();
    const { data: teams } = await db.from('HAJIBEVENT-teams').select('id, team_name').eq('event_id', eventId);

    if (!teams || teams.length === 0) {
        return showToast('يجب إنشاء فريق أولاً لتعيين الموظف إليه', 'error');
    }

    const html = `
        <h3>تعيين الموظف لفريق عمل</h3>
        <form onsubmit="handleAssignSingleStaffSubmit(event, '${appId}', '${eventId}')" style="margin-top:1.2rem;">
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>اختر الفريق</label>
                <select id="singleAssignTeamSelect" class="form-control" required>
                    ${teams.map(t => `<option value="${t.id}">${t.team_name}</option>`).join('')}
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-full">تأكيد التعيين</button>
        </form>
    `;
    openModal(html);
}

// تعيين موظف لفريق وإرسال إشعار فوري له
async function handleAssignSingleStaffSubmit(e, appId, eventId) {
    e.preventDefault();
    const db = getDb();
    const teamId = document.getElementById('singleAssignTeamSelect').value;

    // 1. تحديث تعيين الفريق للموظف
    await db.from('HAJIBEVENT-applications').update({ team_id: teamId }).eq('id', appId);

    // 2. جلب اسم الفريق واسم الفعالية والموظف لإرسال الإشعار
    const { data: team } = await db.from('HAJIBEVENT-teams').select('team_name').eq('id', teamId).single();
    const { data: app } = await db.from('HAJIBEVENT-applications').select('freelancer_id, event:event_id(title)').eq('id', appId).single();

    if (app && app.freelancer_id && team) {
        await db.from('HAJIBEVENT-notifications').insert({
            user_id: app.freelancer_id,
            event_id: eventId,
            title: 'تم تعيينك في فريق عمل ميداني',
            message: `تم توزيعك رسمياً ضمن (${team.team_name}) في فعالية (${app.event?.title}). تفقد بطاقة مشرفك للتواصل والتنسيق.`
        });
    }

    closeModal();
    showToast('تم تعيين الموظف للفريق وإرسال إشعار له بنجاح', 'success');
    openEventFullManageView(eventId);
}
// دالة إرسال رسالة واتساب منسقة لمشرف التيم تحتوي على أسماء وأرقام كوادره
function dispatchTeamWhatsApp(leaderPhone, leaderName, teamName, eventTitle, membersJsonEncoded) {
    if (!leaderPhone) return showToast('رقم جوال المشرف غير مسجل', 'error');

    const cleanPhone = leaderPhone.replace(/[^0-9]/g, '');
    let members = [];
    try {
        members = JSON.parse(decodeURIComponent(membersJsonEncoded));
    } catch (e) {
        members = [];
    }

    // صياغة الرسالة الرسمية للواتساب
    let text = `السلام عليكم ورحمة الله وبركاته\n`;
    text += `أخي المشرف: *${leaderName}*\n`;
    text += `إليك بيان كوادر (*${teamName}*) في فعالية (*${eventTitle}*):\n\n`;

    if (members.length === 0) {
        text += `لا يوجد أعضاء مسجلين في الفريق حالياً.\n`;
    } else {
        members.forEach((m, idx) => {
            text += `${idx + 1}. ${m.name} | جوال: ${m.phone}\n`;
        });
    }

    text += `\nنتمنى لكم وللفريق كامل التوفيق في إنجاز المهام الميدانية.\n- إدارة الفعالية`;

    const url = `https://wa.me/966${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// دالة طباعة بيان الفرق والكوادر كملف PDF رسمي منسق ومرتب
async function printEventTeamsStructure(eventId) {
    showToast('جاري تحضير ملف بيان الفرق للطباعة...', 'info');
    const db = getDb();

    // جلب بيانات الفعالية والفرق والموظفين
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();
    const { data: teams } = await db
        .from('HAJIBEVENT-teams')
        .select(`id, team_name, leader:leader_id(full_name, phone)`)
        .eq('event_id', eventId);

    const { data: apps } = await db
        .from('HAJIBEVENT-applications')
        .select(`team_id, freelancer:freelancer_id(full_name, id_number, phone, city)`)
        .eq('event_id', eventId)
        .eq('status', 'approved');

    const approvedList = apps || [];
    const unassignedStaff = approvedList.filter(a => !a.team_id);

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>بيان توزيع الفرق والكوادر الميدانية - ${ev.title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap');
                * { box-sizing: border-box; font-family: 'Readex Pro', sans-serif; }
                body { padding: 30px; color: #0f172a; background: #fff; }
                .doc-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
                h1 { margin: 0 0 5px; font-size: 19px; color: #0f172a; }
                p { margin: 2px 0; font-size: 12px; color: #475569; }
                .team-card { border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 25px; page-break-inside: avoid; }
                .team-card-header { background: #f8fafc; padding: 10px 15px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; }
                table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
                th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; }
                th { background-color: #ffffff; color: #475569; font-weight: 600; }
                .sign-box { border-bottom: 1px dotted #94a3b8; width: 120px; height: 18px; display: inline-block; }
                .footer-signatures { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <div class="doc-header">
                <div>
                    <h1>منصة حاجب لإدارة الفعاليات والكوادر المستقلة</h1>
                    <p>بيان توزيع المجموعات والفرق الميدانية للفعالية: <strong>${ev.title}</strong></p>
                    <p>المدينة: ${ev.city} | تاريخ الفعالية: ${new Date(ev.start_date).toLocaleDateString('ar-SA')}</p>
                </div>
                <div style="text-align: left;">
                    <p>تاريخ استخراج البيان: ${new Date().toLocaleDateString('ar-SA')}</p>
                    <p>إجمالي الكوادر المعتمدة: ${approvedList.length} موظف</p>
                    <p>إجمالي الفرق: ${(teams || []).length} فريق</p>
                </div>
            </div>

            <!-- عرض الفرق كل فريق بجدوله ومشرفه -->
            ${(!teams || teams.length === 0) ? '<p style="text-align:center; padding:20px;">لم يتم إنشاء أي فرق لهذه الفعالية بعد.</p>' : ''}
            ${(teams || []).map(t => {
                const members = approvedList.filter(a => a.team_id === t.id);
                return `
                    <div class="team-card">
                        <div class="team-card-header">
                            <div>
                                <strong style="font-size: 14px; color: #0f172a;">${t.team_name}</strong>
                                <span style="font-size: 12px; color: #475569; margin-right: 15px;">مشرف الفريق: <strong>${t.leader?.full_name || 'غير محدد'}</strong> (${t.leader?.phone || '-'})</span>
                            </div>
                            <span style="font-size: 11px; background: #e2e8f0; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${members.length} أعضاء</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 30px;">م</th>
                                    <th>اسم الموظف</th>
                                    <th>رقم الهوية الوطنية</th>
                                    <th>رقم الجوال</th>
                                    <th>المدينة</th>
                                    <th style="width: 140px; text-align: center;">التوقيع الميداني</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${members.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:12px;">لا يوجد أعضاء معينين في هذا الفريق</td></tr>' : ''}
                                ${members.map((m, idx) => `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td><strong>${m.freelancer?.full_name || '-'}</strong></td>
                                        <td>${m.freelancer?.id_number || '-'}</td>
                                        <td dir="ltr" style="text-align:right;">${m.freelancer?.phone || '-'}</td>
                                        <td>${m.freelancer?.city || '-'}</td>
                                        <td style="text-align:center;"><span class="sign-box"></span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }).join('')}

            <!-- عرض الموظفين غير المعينين في فرق إن وجدوا -->
            ${unassignedStaff.length > 0 ? `
                <div class="team-card" style="border-color: #fed7aa;">
                    <div class="team-card-header" style="background: #fff7ed;">
                        <div>
                            <strong style="font-size: 13px; color: #9a3412;">كوادر احتياطية / غير مخصصة لفريق</strong>
                        </div>
                        <span style="font-size: 11px; background: #ffedd5; color: #9a3412; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${unassignedStaff.length} موظف</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 30px;">م</th>
                                <th>اسم الموظف</th>
                                <th>رقم الهوية</th>
                                <th>رقم الجوال</th>
                                <th>المدينة</th>
                                <th style="width: 140px; text-align: center;">التوقيع الميداني</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${unassignedStaff.map((m, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td><strong>${m.freelancer?.full_name || '-'}</strong></td>
                                    <td>${m.freelancer?.id_number || '-'}</td>
                                    <td dir="ltr" style="text-align:right;">${m.freelancer?.phone || '-'}</td>
                                    <td>${m.freelancer?.city || '-'}</td>
                                    <td style="text-align:center;"><span class="sign-box"></span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            <div class="footer-signatures">
                <div>
                    <p><strong>مدير تشغيل الفعالية:</strong> ____________________</p>
                    <p style="margin-top: 8px;">التوقيع: ____________________</p>
                </div>
                <div>
                    <p><strong>المشرف العام للعمليات:</strong> ____________________</p>
                    <p style="margin-top: 8px;">التوقيع: ____________________</p>
                </div>
                <div style="text-align: center;">
                    <p><strong>الختم الرسمي للمنصة</strong></p>
                    <div style="width: 85px; height: 85px; border: 1px dashed #94a3b8; margin: 5px auto 0; border-radius: 50%;"></div>
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
    }, 450);
}
// متغير لحفظ سجلات الحضور الخاصة بهذه الفعالية للطباعة
let currentEventFilteredLogs = [];

// دالة فلترة جدول الحضور الخاص بالفعالية الحالية
async function runEventAttendanceFilter(eventId) {
    const tbody = document.getElementById('evAttendanceTbody');
    if (!tbody) return;

    const staffId = document.getElementById('evAttStaffFilter')?.value || '';
    const fromDate = document.getElementById('evAttDateFrom')?.value || '';
    const toDate = document.getElementById('evAttDateTo')?.value || '';

    const db = getDb();
    let q = db.from('HAJIBEVENT-attendance').select(`
        id, check_in_time, check_out_time, is_manual, freelancer_id,
        freelancer:freelancer_id (id, full_name, id_number, phone)
    `).eq('event_id', eventId).order('check_in_time', { ascending: false });

    if (staffId) q = q.eq('freelancer_id', staffId);
    if (fromDate) q = q.gte('check_in_time', new Date(fromDate).toISOString());
    if (toDate) q = q.lte('check_in_time', new Date(toDate + 'T23:59:59').toISOString());

    const { data: logs } = await q;
    currentEventFilteredLogs = logs || [];

    if (currentEventFilteredLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">لا توجد سجلات حضور مطابقة للبحث</td></tr>`;
        return;
    }

    tbody.innerHTML = currentEventFilteredLogs.map(l => {
        const dur = calculateWorkDuration(l.check_in_time, l.check_out_time);
        const rowStyle = dur.isCancelled ? 'style="background: #fff1f2; color: #9f1239;"' : '';

        return `
            <tr ${rowStyle}>
                <td><strong>${l.freelancer?.full_name || '-'}</strong></td>
                <td>${l.freelancer?.id_number || '-'}</td>
                <td>${new Date(l.check_in_time).toLocaleDateString('ar-SA')}</td>
                <td>${new Date(l.check_in_time).toLocaleTimeString('ar-SA')}</td>
                <td>${l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString('ar-SA') : 'جلسة قائمة'}</td>
                <td>
                    <strong>${dur.text}</strong>
                    ${dur.isCancelled ? '<span class="badge badge-danger" style="margin-right:5px;">ملغي (أقل من ساعة)</span>' : ''}
                </td>
                <!-- زر القلم للتعديل الميداني -->
                <td style="text-align:center;">
                    <button class="btn btn-outline" style="padding:0.3rem 0.6rem;" title="تعديل أوقات الجلسة" onclick="openEditAttendanceModal('${l.id}', '${eventId}')">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// نافذة زر القلم لتعديل وقت الحضور والانصراف يدوياً
async function openEditAttendanceModal(logId, eventId) {
    const db = getDb();
    const { data: log } = await db.from('HAJIBEVENT-attendance').select(`
        id, check_in_time, check_out_time,
        freelancer:freelancer_id (full_name, id_number)
    `).eq('id', logId).single();

    if (!log) return showToast('تعذر العثور على السجل', 'error');

    // تحويل التواريخ لصيغة تناسب حقل datetime-local
    const inVal = log.check_in_time ? new Date(new Date(log.check_in_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    const outVal = log.check_out_time ? new Date(new Date(log.check_out_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

    const html = `
        <h3>تعديل توقيت جلسة العمل الميدانية</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.2rem;">الموظف: <strong>${log.freelancer?.full_name}</strong> (${log.freelancer?.id_number})</p>
        <form onsubmit="handleUpdateAttendanceRecord(event, '${logId}', '${eventId}')">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>تاريخ ووقت تسجيل الحضور</label>
                <input type="datetime-local" id="editCheckIn" class="form-control" required value="${inVal}">
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>تاريخ ووقت تسجيل الانصراف</label>
                <input type="datetime-local" id="editCheckOut" class="form-control" value="${outVal}">
                <small style="color:var(--text-muted); font-size:0.75rem;">(ملاحظة: يمكنك ضبط الوقت حتى لو امتدت الجلسة لليوم التالي بعد منتصف الليل)</small>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button type="submit" class="btn btn-primary" style="flex:1;">حفظ التعديلات</button>
                <button type="button" class="btn btn-danger" onclick="deleteAttendanceRecord('${logId}', '${eventId}')">حذف السجل</button>
            </div>
        </form>
    `;
    openModal(html);
}

// حفظ التعديلات من زر القلم
async function handleUpdateAttendanceRecord(e, logId, eventId) {
    e.preventDefault();
    const db = getDb();
    const inTime = document.getElementById('editCheckIn').value;
    const outTime = document.getElementById('editCheckOut').value;

    const payload = {
        check_in_time: new Date(inTime).toISOString(),
        check_out_time: outTime ? new Date(outTime).toISOString() : null,
        is_manual: true,
        manual_logged_by: AdminState.user.id
    };

    const { error } = await db.from('HAJIBEVENT-attendance').update(payload).eq('id', logId);
    if (error) {
        showToast(error.message, 'error');
    } else {
        closeModal();
        showToast('تم تحديث أوقات الجلسة بنجاح', 'success');
        runEventAttendanceFilter(eventId);
    }
}

// حذف سجل الحضور إن لزم
async function deleteAttendanceRecord(logId, eventId) {
    if (!confirm('هل أنت متأكد من حذف جلسة الحضور هذه نهائياً؟')) return;
    const db = getDb();
    await db.from('HAJIBEVENT-attendance').delete().eq('id', logId);
    closeModal();
    showToast('تم حذف السجل', 'success');
    runEventAttendanceFilter(eventId);
}

// طباعة كشف الحضور والتواقيع والمشرفين للفعالية مع حساب الجلسات واستثناء أقل من ساعة
// دالة طباعة كشف استحقاقات الفعالية المجمع والموجز (ملخص لكل موظف مجمع حسب فرقه ومشرفيه)
async function printEventAttendanceReport(eventId) {
    const db = getDb();
    showToast('جاري تجميع البيانات وتجهيز مسير المستحقات للطباعة...', 'info');

    // 1. جلب بيانات الفعالية
    const { data: ev } = await db.from('HAJIBEVENT-events').select('*').eq('id', eventId).single();

    // 2. جلب الفرق ومشرفيها التابعين لهذه الفعالية
    const { data: teams } = await db
        .from('HAJIBEVENT-teams')
        .select(`id, team_name, leader:leader_id(full_name, phone)`)
        .eq('event_id', eventId);

    // 3. جلب التقديمات المعتمدة لمعرفة فريق كل موظف
    const { data: apps } = await db
    .from('HAJIBEVENT-applications')
    .select(`team_id, freelancer_id, freelancer:freelancer_id(id, full_name, id_number, phone, bio)`)
        .eq('event_id', eventId)
        .eq('status', 'approved');

    // 4. تصفية سجلات الحضور: استبعاد الجلسات الملغية (أقل من ساعة) والجلسات القائمة
    const validLogs = currentEventFilteredLogs.filter(l => {
        if (!l.check_out_time) return false;
        const dur = calculateWorkDuration(l.check_in_time, l.check_out_time);
        return !dur.isCancelled;
    });

    if (validLogs.length === 0) {
        return showToast('لا توجد جلسات حضور مكتملة ومعتمدة لطباعتها في التقرير', 'error');
    }

    // 5. تجميع الجلسات لكل موظف في سطر واحد (حساب إجمالي الجلسات وإجمالي الساعات بدون تكرار)
    const aggregatedStaff = {};

    validLogs.forEach(log => {
        const fId = log.freelancer_id;
        const diffMs = new Date(log.check_out_time) - new Date(log.check_in_time);
        const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));

        if (!aggregatedStaff[fId]) {
            // ربط الموظف بفريقه ومشرفه
            const userApp = (apps || []).find(a => a.freelancer_id === fId);
            const teamId = userApp ? userApp.team_id : null;

            aggregatedStaff[fId] = {
                freelancer_id: fId,
                full_name: log.freelancer?.full_name || 'غير معروف',
                id_number: log.freelancer?.id_number || '-',
                phone: log.freelancer?.phone || '-',
				 bio: userApp?.freelancer?.bio || '', 
                team_id: teamId,
                sessionCount: 0,
                totalMinutes: 0
            };
        }

        aggregatedStaff[fId].sessionCount += 1;
        aggregatedStaff[fId].totalMinutes += diffMins;
    });

    const staffList = Object.values(aggregatedStaff);

    // 6. تجهيز نافذة الطباعة المنبثقة بتنسيق موجز وأنيق
    const printWin = window.open('', '_blank', 'width=1000,height=800');
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>مسير استحقاقات الكوادر الميدانية - ${ev.title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap');
                * { box-sizing: border-box; font-family: 'Readex Pro', sans-serif; }
                body { padding: 30px; color: #0f172a; background: #fff; }
                .report-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
                h1 { margin: 0 0 4px; font-size: 19px; color: #0f172a; }
                p { margin: 2px 0; font-size: 12px; color: #475569; }
                .team-section { border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 25px; page-break-inside: avoid; }
                .team-section-header { background: #f8fafc; padding: 10px 14px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; }
                th { background-color: #ffffff; color: #475569; font-weight: 700; }
                .sign-box { border-bottom: 1px dotted #475569; width: 130px; height: 18px; display: inline-block; }
                .signatures { margin-top: 45px; display: flex; justify-content: space-between; font-size: 12px; page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div>
                    <h1>منصة حاجب لإدارة الفعاليات والكوادر المستقلة</h1>
                    <p>مسير استحقاق وتوقيع الكوادر الميدانية لفعالية: <strong>${ev.title}</strong></p>
                    <p>المدينة: ${ev.city} | الأجر اليومي المقرر: ${ev.daily_rate} ريال</p>
                </div>
                <div style="text-align: left;">
                    <p>تاريخ استخراج المسير: ${new Date().toLocaleDateString('ar-SA')}</p>
                    <p>إجمالي الموظفين المستحقين: ${staffList.length} موظف</p>
                    <p>حالة الكشف: <strong>معتمد وموجز</strong></p>
                </div>
            </div>

            <!-- عرض الموظفين مجمعين تحت كل فريق مع المشرف بدون تكرار -->
            ${(teams || []).map(t => {
                const teamStaff = staffList.filter(s => s.team_id === t.id);
                if (teamStaff.length === 0) return ''; // تخطي الفرق التي لم يحضر منها أحد في التقرير

                return `
                    <div class="team-section">
                        <div class="team-section-header">
                            <div>
                                <strong style="font-size: 14px; color: #0f172a;">${t.team_name}</strong>
                                <span style="font-size: 12px; color: #475569; margin-right: 15px;">مشرف الفريق: <strong>${t.leader?.full_name || 'غير محدد'}</strong></span>
                            </div>
                            <span style="font-size: 11px; background: #e2e8f0; padding: 2px 8px; border-radius: 10px; font-weight: 600;">${teamStaff.length} موظف</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 30px;">م</th>
                                    <th>اسم الموظف</th>
                                    <th>رقم الهوية الوطنية</th>
                                    <th style="text-align: center;">عدد أيام / جلسات التحضير</th>
									 <th style="text-align: center;">رقم STCBANK</th>
                                    <th style="text-align: center;">إجمالي ساعات العمل</th>
                                    <th style="width: 150px; text-align: center;">توقيع استلام المستحقات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${teamStaff.map((s, idx) => {
                                    const h = Math.floor(s.totalMinutes / 60);
                                    const m = s.totalMinutes % 60;
                                    const hoursFormatted = `${h} س و ${m} د`;

                                    return `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td><strong>${s.full_name}</strong></td>
                                            <td>${s.id_number}</td>
                                            <td style="text-align: center; font-weight: 700; color: #0f172a;">${s.sessionCount} أيام عمل</td>
											<td>${s.bio || 'لا يوجد رقم مسجل'}</td>
                                            <td style="text-align: center;">${hoursFormatted}</td>
                                            <td style="text-align: center;"><span class="sign-box"></span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }).join('')}

            <!-- عرض الموظفين الذين داوموا ولكن لم يتم تعيينهم في فريق -->
            ${(() => {
                const unassigned = staffList.filter(s => !s.team_id);
                if (unassigned.length === 0) return '';

                return `
                    <div class="team-section" style="border-color: #cbd5e1;">
                        <div class="team-section-header" style="background: #f1f5f9;">
                            <div>
                                <strong style="font-size: 13px; color: #334155;">كوادر ميدانية عامة / بدون فريق</strong>
                            </div>
                            <span style="font-size: 11px; background: #e2e8f0; padding: 2px 8px; border-radius: 10px; font-weight: 600;">${unassigned.length} موظف</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 30px;">م</th>
                                    <th>اسم الموظف</th>
                                    <th>رقم الهوية الوطنية</th>
                                    <th style="text-align: center;">عدد أيام / جلسات التحضير</th>
                                    <th style="text-align: center;">إجمالي ساعات العمل</th>
                                    <th style="width: 150px; text-align: center;">توقيع استلام المستحقات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${unassigned.map((s, idx) => {
                                    const h = Math.floor(s.totalMinutes / 60);
                                    const m = s.totalMinutes % 60;
                                    const hoursFormatted = `${h} س و ${m} د`;

                                    return `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td><strong>${s.full_name}</strong></td>
                                            <td>${s.id_number}</td>
                                            <td style="text-align: center; font-weight: 700;">${s.sessionCount} أيام عمل</td>
                                            <td style="text-align: center;">${hoursFormatted}</td>
                                            <td style="text-align: center;"><span class="sign-box"></span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            })()}

            <div class="signatures">
                <div>
                    <p><strong>المشرف العام الميداني:</strong> ____________________</p>
                    <p style="margin-top: 8px;">التوقيع: ____________________</p>
                </div>
                <div>
                    <p><strong>مسؤول المحاسبة والصرف:</strong> ____________________</p>
                    <p style="margin-top: 8px;">التوقيع: ____________________</p>
                </div>
                <div style="text-align: center;">
                    <p><strong>الختم الرسمي للمنصة</strong></p>
                    <div style="width: 85px; height: 85px; border: 1px dashed #94a3b8; margin: 5px auto 0; border-radius: 50%;"></div>
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
    }, 450);
}

// متغير لحفظ المتقدمين الحاليين للبحث الفوري
let currentEventPendingList = [];

// دالة البحث وفلترة المتقدمين الجدد لحظياً
function filterPendingApplicants(eventId) {
    const tbody = document.getElementById('pendingApplicantsTbody');
    if (!tbody) return;

    const searchVal = (document.getElementById('pendingSearchInput')?.value || '').trim().toLowerCase();
    const natVal = document.getElementById('pendingNatFilter')?.value || '';

    const filtered = currentEventPendingList.filter(a => {
        const f = a.freelancer;
        if (!f) return false;

        const matchSearch = !searchVal || 
            (f.full_name && f.full_name.toLowerCase().includes(searchVal)) ||
            (f.phone && f.phone.includes(searchVal)) ||
            (f.id_number && f.id_number.includes(searchVal));

        const matchNat = !natVal || f.nationality === natVal;

        return matchSearch && matchNat;
    });

    // تحديث العداد
    const badge = document.getElementById('pendingCountBadge');
    if (badge) badge.innerText = `${filtered.length} متقدم مطابق`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">لا توجد طلبات تقديم مطابقة للبحث المحدد</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(a => `
        <tr>
            <!-- المرشح مع الصورة الشخصية -->
            <td>
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    <img src="${a.freelancer?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}" 
                         style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1px solid var(--border-subtle); background:#f1f5f9;" alt="">
                    <div>
                        <strong>${a.freelancer?.full_name || 'غير معروف'}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${a.freelancer?.id_number || '-'}</div>
                    </div>
                </div>
            </td>
            <!-- الجنسية -->
            <td><span class="badge" style="background:#f1f5f9; color:var(--text-primary); font-weight:600;">${a.freelancer?.nationality || '-'}</span></td>
            <!-- المدينة -->
            <td>${a.freelancer?.city || '-'}</td>
            <!-- السيرة الذاتية -->
            <td>
                ${a.freelancer?.cv_url 
                    ? `<a href="${a.freelancer.cv_url}" target="_blank" class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;">معاينة الهوية</a>` 
                    : '<span style="color:var(--text-muted); font-size:0.75rem;">لا يوجد</span>'}
            </td>
            <!-- التواصل واتساب -->
            <td>
                <a href="https://wa.me/966${(a.freelancer?.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;">واتساب</a>
            </td>
            <!-- الإجراءات: زر معاينة كل التفاصيل + قبول + رفض -->
            <td>
                <div style="display:flex; gap:0.35rem; justify-content:center; align-items:center;">
                    <!-- زر رؤية كل تفاصيل المتقدم -->
                    <button class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#fff;" 
                            title="رؤية كافة التفاصيل" 
                            onclick="viewApplicantFullDetails('${a.freelancer?.id}')">
                        معاينة الملف
                    </button>
                    <!-- قبول -->
                    <button class="btn btn-primary" style="padding:0.25rem 0.7rem; font-size:0.75rem;" 
                            onclick="setApplicantStatus('${a.id}', 'approved', '${eventId}')">
                        قبول
                    </button>
                    <!-- رفض -->
                    <button class="btn btn-danger" style="padding:0.25rem 0.7rem; font-size:0.75rem;" 
                            onclick="setApplicantStatus('${a.id}', 'rejected', '${eventId}')">
                        رفض
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// نافذة منبثقة لعرض كافة تفاصيل المتقدم الشاملة
async function viewApplicantFullDetails(freelancerId) {
    const db = getDb();
    let s = (allStaffList || []).find(item => item.id === freelancerId);

    // إذا لم تكن محملة في الذاكرة يتم جلبها فوراً من قاعدة البيانات
    if (!s) {
        const { data } = await db.from('HAJIBEVENT-profiles').select('*').eq('id', freelancerId).single();
        s = data;
    }

    if (!s) return showToast('تعذر العثور على بيانات المتقدم', 'error');

    const html = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; padding-bottom:1.2rem; border-bottom:1px solid var(--border-subtle);">
            <div style="display:flex; align-items:center; gap:1.2rem;">
                <img src="${s.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" 
                     style="width:65px; height:65px; border-radius:50%; object-fit:cover; border:2px solid var(--brand-primary); background:#f1f5f9;" alt="">
                <div>
                    <h2 style="font-size:1.25rem; margin-bottom:0.2rem;">${s.full_name}</h2>
                    <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:600;">
                        ${s.nationality || 'غير محدد'}
                    </span>
                </div>
            </div>
            <div>
                <a href="https://wa.me/966${(s.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
                    مراسلة واتساب
                </a>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.2rem; font-size:0.88rem;">
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">رقم الهوية:</span>
                <strong>${s.id_number || '-'} (${s.id_type || 'هوية وطنية'})</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">البريد الإلكتروني:</span>
                <strong>${s.email || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">رقم الجوال:</span>
                <strong dir="ltr">${s.phone || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">تاريخ الميلاد:</span>
                <strong>${s.dob || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">المدينة / المنطقة:</span>
                <strong>${s.city || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">الجنس:</span>
                <strong>${s.gender || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">فصيلة الدم:</span>
                <strong>${s.blood_type || '-'}</strong>
            </div>
            <div>
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">اللغات المتقنة:</span>
                <strong>${s.languages || 'العربية'}</strong>
            </div>
            <div style="grid-column: span 2;">
                <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">رقمSTCBANK</span>
                <p style="background:#f8fafc; padding:0.8rem; border-radius:6px; border:1px solid var(--border-subtle); line-height:1.6;">
                    ${s.bio || 'لا يوجد رقم مسجل'}
                </p>
            </div>
            <div style="grid-column: span 2; margin-top:0.5rem; padding-top:1rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <div><strong>الهوية</strong></div>
                <div>
                    ${s.cv_url 
                        ? `<a href="${s.cv_url}" target="_blank" class="btn btn-primary" style="padding:0.4rem 1rem; font-size:0.82rem;">معاينة الهوية</a>` 
                        : '<span style="color:var(--text-muted); font-size:0.85rem;">لم يتم رفع سيرة ذاتية</span>'}
                </div>
            </div>
        </div>
    `;
    openModal(html);
}

// الخيار الأول: إرسال رابط استعادة كلمة المرور إلى إيميل الموظف مباشرة
async function adminSendResetEmail(email) {
    if (!email) return showToast('البريد الإلكتروني غير متوفر', 'error');
    const db = getDb();
    showToast('جاري إرسال رابط الاستعادة للإيميل...', 'info');

    const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/index.html'
    });

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('تم إرسال رابط استعادة كلمة المرور بنجاح إلى إيميل الموظف', 'success');
    }
}

// الخيار الثاني: فتح نافذة لتعيين كلمة مرور جديدة للموظف
function openSetPasswordModal(staffId, staffName, email, phone) {
    const html = `
        <h3>تعيين كلمة مرور جديدة للموظف</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.2rem;">
            الموظف: <strong>${staffName}</strong> (${email})
        </p>
        <form onsubmit="handleAdminSetPasswordSubmit(event, '${staffId}', '${staffName}', '${email}', '${phone}')">
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label>أدخل كلمة المرور الجديدة (6 خانات كحد أدنى)</label>
                <input type="text" id="adminNewPassInput" class="form-control" required minlength="6" placeholder="مثال: 123456 أو كلمة سر قوية">
            </div>
            <button type="submit" class="btn btn-primary btn-full">
                حفظ وإرسال البيانات للموظف عبر واتساب
            </button>
        </form>
    `;
    openModal(html);
}

// حفظ كلمة المرور الجديدة في Supabase وإرسالها عبر الواتساب فوراً
async function handleAdminSetPasswordSubmit(e, staffId, staffName, email, phone) {
    e.preventDefault();
    const newPass = document.getElementById('adminNewPassInput').value.trim();
    if (newPass.length < 6) return showToast('يجب ألا تقل كلمة المرور عن 6 خانات', 'error');

    const db = getDb();
    showToast('جاري تحديث كلمة المرور في النظام...', 'info');

    // تنفيذ التحديث عبر دالة SQL التي أنشأناها في Supabase
    const { error } = await db.rpc('admin_set_user_password', {
        target_user_id: staffId,
        new_password: newPass
    });

    if (error) {
        return showToast('فشل التحديث: ' + error.message, 'error');
    }

    closeModal();
    showToast('تم تحديث كلمة المرور بنجاح! جاري تحضير رسالة الواتساب...', 'success');

    // تجهيز رسالة الواتساب الرسمية
    if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        let text = `السلام عليكم ورحمة الله وبركاته\n`;
        text += `أهلاً بك أخي/أختي: *${staffName}*\n`;
        text += `تم تعيين كلمة مرور جديدة لحسابك في *منصة حاجب* بنجاح:\n\n`;
        text += `- البريد الإلكتروني: *${email}*\n`;
        text += `- كلمة المرور الجديدة: *${newPass}*\n\n`;
        text += `يمكنك الآن الدخول بها لحسابك ومتابعة فعالياتك الميدانية.\n- إدارة الفعاليات`;

        const waUrl = `https://wa.me/966${cleanPhone}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    } else {
        showToast('تم تحديث كلمة المرور (رقم جوال الموظف غير مسجل للواتساب)', 'info');
    }
}

// تصدير الدوال للنطاق العام
window.adminSendResetEmail = adminSendResetEmail;
window.openSetPasswordModal = openSetPasswordModal;
window.handleAdminSetPasswordSubmit = handleAdminSetPasswordSubmit;

// تصدير الدوال للنطاق العام
window.filterPendingApplicants = filterPendingApplicants;
window.viewApplicantFullDetails = viewApplicantFullDetails;

// تصدير الدوال للنطاق العام
window.runEventAttendanceFilter = runEventAttendanceFilter;
window.openEditAttendanceModal = openEditAttendanceModal;
window.handleUpdateAttendanceRecord = handleUpdateAttendanceRecord;
window.deleteAttendanceRecord = deleteAttendanceRecord;
window.printEventAttendanceReport = printEventAttendanceReport;
// تصدير الدوال الجديدة للنطاق العام
window.dispatchTeamWhatsApp = dispatchTeamWhatsApp;
window.printEventTeamsStructure = printEventTeamsStructure;
// تصدير الدوال للنطاق العام
window.openCreateTeamModal = openCreateTeamModal;
window.handleSaveTeamSubmit = handleSaveTeamSubmit;
window.deleteTeam = deleteTeam;
window.openEditTeamModal = openEditTeamModal;
window.handleUpdateTeamSubmit = handleUpdateTeamSubmit;
window.openAssignSingleStaffModal = openAssignSingleStaffModal;
window.handleAssignSingleStaffSubmit = handleAssignSingleStaffSubmit;


