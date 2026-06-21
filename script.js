/* ══════════════════════════════════════════════════════════
   PRIMA — script.js  v3.0
   Vanilla JavaScript — No frameworks
   ══════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════
   1. GOOGLE APPS SCRIPT INTEGRATION
   ══════════════════════════════════════════════════════════ */

const CONFIG = {
  GAS_URL: localStorage.getItem('prima-gas-url') || 'https://script.google.com/macros/s/AKfycbwimtr1MTD8ZyS-nnfOW_JoUNf3gqn0jHqNudv5sS_WH5SCMkXIXWdFc6HFCssas6sAXw/exec',
};

/* POST data ke server — langsung pakai no-cors untuk menghindari CORS preflight error.
   GAS selalu memproses request meskipun browser tidak bisa membaca response-nya. */
async function gasPost(sheet, row) {
  const url = CONFIG.GAS_URL;
  if (!url) { console.warn('GAS_URL not configured'); return { status: 'mock' }; }
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet, row }),
    });
    return { status: 'ok' };
  } catch (err) {
    console.warn('gasPost error:', err.message);
    return { status: 'error', message: err.message };
  }
}

/* Update kolom Status di sheet LaporanKerusakan berdasarkan Nomor WR.
   Menggunakan GET dengan query params agar tidak ada CORS preflight.
   Code.gs doGet sudah menangani ?action=updateStatus. */
async function updateLaporanStatus(nomorWR, newStatus) {
  const url = CONFIG.GAS_URL;
  if (!url || !nomorWR) return;
  try {
    const getUrl = `${url}?sheet=LaporanKerusakan&action=updateStatus`
      + `&nomorWR=${encodeURIComponent(nomorWR)}`
      + `&newStatus=${encodeURIComponent(newStatus)}`;
    const res  = await fetch(getUrl, { method: 'GET', redirect: 'follow' });
    const data = await res.json().catch(() => null);
    if (data && (data.status === 'ok' || data.status === 'not_found')) {
      console.log('✓ updateLaporanStatus:', data.message || newStatus);
    } else {
      console.warn('updateLaporanStatus: respons tidak terduga:', data);
    }
  } catch (e) {
    console.warn('updateLaporanStatus gagal:', e.message);
  }
}

/* GET data dari server — sama persis dengan cara loadJadwalPMForTech yang terbukti bekerja */
async function gasGet(sheet, timeoutMs = 15000) {
  const url = CONFIG.GAS_URL;
  if (!url) return null;
  try {
    const res = await fetch(`${url}?sheet=${encodeURIComponent(sheet)}`, {
      method: 'GET', redirect: 'follow'
    });
    if (res.ok) {
      const text = await res.text();
      const json = JSON.parse(text);
      if (json && json.status === 'ok') return json;
    }
  } catch (e) {
    console.warn('gasGet error:', sheet, e.message);
  }
  return null;
}

/* ══════════════════════════════════════════════════════════
   1b. DATA SYNC — Ambil & cache data dari server
   ══════════════════════════════════════════════════════════ */

/* Cache lokal agar tidak fetch berulang */
const SHEET_CACHE = {
  LaporanKerusakan: null,
  BreakdownMaintenance: null,
  PreventiveMaintenance: null,
  lastFetch: {}
};

const CACHE_TTL_MS = 30000; // 30 detik

/* Set untuk menyimpan ID laporan yang sudah ditangani teknisi di sesi ini
   — mencegah card muncul lagi saat loadLaporanKerusakanForTech() dipanggil ulang */
const dismissedLaporanIds = new Set();

async function fetchSheetData(sheetName, forceRefresh = false) {
  const now = Date.now();
  const lastFetch = SHEET_CACHE.lastFetch[sheetName] || 0;
  if (!forceRefresh && SHEET_CACHE[sheetName] && (now - lastFetch) < CACHE_TTL_MS) {
    return SHEET_CACHE[sheetName];
  }
  const result = await gasGet(sheetName);
  if (result && result.status === 'ok') {
    SHEET_CACHE[sheetName] = result.data || [];
    SHEET_CACHE.lastFetch[sheetName] = now;
    return SHEET_CACHE[sheetName];
  }
  return SHEET_CACHE[sheetName] || [];
}

/* ── Nama mesin dari ID ── */
function machineNameFromId(id) {
  const m = MACHINES.find(m => m.id === id);
  return m ? m.name : id;
}

/* ══════════════════════════════════════════════════════════
   2. MOCK DUMMY DATA
   ══════════════════════════════════════════════════════════ */

const MACHINES = [
  { id: 'MCH-001', name: 'Ilapak 1',                      location: 'Line Ilapak',   status: 'Running', health: 88, lastPM: '2025-05-10' },
  { id: 'MCH-002', name: 'Ilapak 2',                      location: 'Line Ilapak',   status: 'Running', health: 76, lastPM: '2025-04-28' },
  { id: 'MCH-003', name: 'Ilapak 3',                      location: 'Line Ilapak',   status: 'Running', health: 82, lastPM: '2025-05-03' },
  { id: 'MCH-004', name: 'Ilapak 4',                      location: 'Line Ilapak',   status: 'Running', health: 79, lastPM: '2025-05-12' },
  { id: 'MCH-005', name: 'Ilapak 5',                      location: 'Line Ilapak',   status: 'Running', health: 91, lastPM: '2025-05-05' },
  { id: 'MCH-006', name: 'Ilapak 6',                      location: 'Line Ilapak',   status: 'Down',    health: 22, lastPM: '2025-03-10' },
  { id: 'MCH-007', name: 'Ilapak 7',                      location: 'Line Ilapak',   status: 'Running', health: 85, lastPM: '2025-04-20' },
  { id: 'MCH-008', name: 'Ilapak 8',                      location: 'Line Ilapak',   status: 'PM',      health: 57, lastPM: '2025-05-18' },
  { id: 'MCH-009', name: 'Ilapak 9',                      location: 'Line Ilapak',   status: 'Running', health: 73, lastPM: '2025-05-01' },
  { id: 'MCH-010', name: 'Ilapak 10',                     location: 'Line Ilapak',   status: 'Running', health: 68, lastPM: '2025-04-25' },
  { id: 'MCH-011', name: 'Ilapak 11',                     location: 'Line Ilapak',   status: 'Running', health: 80, lastPM: '2025-05-08' },
  { id: 'MCH-012', name: 'Ilapak 12',                     location: 'Line Ilapak',   status: 'Down',    health: 18, lastPM: '2025-02-15' },
  { id: 'MCH-013', name: 'SIG 5',                         location: 'Line SIG',      status: 'Running', health: 90, lastPM: '2025-05-14' },
  { id: 'MCH-014', name: 'SIG 6',                         location: 'Line SIG',      status: 'PM',      health: 62, lastPM: '2025-05-19' },
  { id: 'MCH-015', name: 'Unifill A',                     location: 'Line Unifill',  status: 'Running', health: 87, lastPM: '2025-05-11' },
  { id: 'MCH-016', name: 'Unifill B',                     location: 'Line Unifill',  status: 'Running', health: 83, lastPM: '2025-05-07' },
  { id: 'MCH-017', name: 'Chimei 1 (Sig 6)',              location: 'Area Chimei',   status: 'Running', health: 75, lastPM: '2025-04-30' },
  { id: 'MCH-018', name: 'Chimei 3A (Ilapak 1)',          location: 'Area Chimei',   status: 'Running', health: 71, lastPM: '2025-04-22' },
  { id: 'MCH-019', name: 'Chimei 4B (Ilapak 3, 4)',       location: 'Area Chimei',   status: 'Running', health: 78, lastPM: '2025-05-02' },
  { id: 'MCH-020', name: 'Chimei 5 (Ilapak 5)',           location: 'Area Chimei',   status: 'Down',    health: 14, lastPM: '2025-01-20' },
  { id: 'MCH-021', name: 'Chimei 5B (Unifill B)',         location: 'Area Chimei',   status: 'Running', health: 84, lastPM: '2025-05-09' },
  { id: 'MCH-022', name: 'Chimei 8A (Ilapak 8)',          location: 'Area Chimei',   status: 'Running', health: 69, lastPM: '2025-04-18' },
  { id: 'MCH-023', name: 'Chimei 9A (Ilapak 11)',         location: 'Area Chimei',   status: 'PM',      health: 55, lastPM: '2025-05-20' },
  { id: 'MCH-024', name: 'Chimei 10 (Ilapak 2, 12)',      location: 'Area Chimei',   status: 'Running', health: 77, lastPM: '2025-05-04' },
  { id: 'MCH-025', name: 'Chimei 11 (Ilapak 9, 10)',      location: 'Area Chimei',   status: 'Running', health: 81, lastPM: '2025-05-06' },
  { id: 'MCH-026', name: 'Chimei 12 (Ilapak 6, 7)',       location: 'Area Chimei',   status: 'Running', health: 86, lastPM: '2025-05-13' },
  { id: 'MCH-027', name: 'Jinsung 1',                     location: 'Line Jinsung',  status: 'Running', health: 93, lastPM: '2025-05-16' },
  { id: 'MCH-028', name: 'Jinsung 2',                     location: 'Line Jinsung',  status: 'Running', health: 89, lastPM: '2025-05-15' },
  { id: 'MCH-029', name: 'Jinsung 3',                     location: 'Line Jinsung',  status: 'Running', health: 74, lastPM: '2025-04-27' },
  { id: 'MCH-030', name: 'Jinsung 4',                     location: 'Line Jinsung',  status: 'Down',    health: 11, lastPM: '2025-01-10' },
  { id: 'MCH-031', name: 'Jinsung 5',                     location: 'Line Jinsung',  status: 'Running', health: 82, lastPM: '2025-05-03' },
  { id: 'MCH-032', name: 'Jihcheng',                      location: 'Area Mixing',   status: 'Running', health: 88, lastPM: '2025-05-10' },
  { id: 'MCH-033', name: 'Cosmec',                        location: 'Area Mixing',   status: 'PM',      health: 60, lastPM: '2025-05-21' },
  { id: 'MCH-034', name: 'FBD Glatt',                     location: 'Area FBD',      status: 'Running', health: 95, lastPM: '2025-05-17' },
  { id: 'MCH-035', name: 'FBD 2',                         location: 'Area FBD',      status: 'Running', health: 87, lastPM: '2025-05-12' },
  { id: 'MCH-036', name: 'FBD 3',                         location: 'Area FBD',      status: 'Running', health: 79, lastPM: '2025-05-05' },
  { id: 'MCH-037', name: 'FBD 4',                         location: 'Area FBD',      status: 'Down',    health: 25, lastPM: '2025-03-01' },
  { id: 'MCH-038', name: 'FBD 6',                         location: 'Area FBD',      status: 'Running', health: 83, lastPM: '2025-05-08' },
  { id: 'MCH-039', name: 'Temach',                        location: 'Area Mixing',   status: 'Running', health: 70, lastPM: '2025-04-15' },
  { id: 'MCH-040', name: 'Super Mixer',                   location: 'Area Mixing',   status: 'Running', health: 77, lastPM: '2025-05-02' },
  { id: 'MCH-041', name: 'Super Mixer 1',                 location: 'Area Mixing',   status: 'Running', health: 81, lastPM: '2025-05-06' },
  { id: 'MCH-042', name: 'Silverson',                     location: 'Area Mixing',   status: 'PM',      health: 58, lastPM: '2025-05-22' },
  { id: 'MCH-043', name: 'Tetra 1',                       location: 'Area Tetra',    status: 'Running', health: 92, lastPM: '2025-05-14' },
  { id: 'MCH-044', name: 'Tetra 2',                       location: 'Area Tetra',    status: 'Running', health: 88, lastPM: '2025-05-11' },
  { id: 'MCH-045', name: 'Tetra 3',                       location: 'Area Tetra',    status: 'Running', health: 85, lastPM: '2025-05-09' },
  { id: 'MCH-046', name: 'Storage Tank 1',                location: 'Area Storage',  status: 'Running', health: 96, lastPM: '2025-05-17' },
  { id: 'MCH-047', name: 'Storage Tank 2',                location: 'Area Storage',  status: 'Running', health: 94, lastPM: '2025-05-16' },
  { id: 'MCH-048', name: 'Storage Tank 3',                location: 'Area Storage',  status: 'Running', health: 91, lastPM: '2025-05-14' },
  { id: 'MCH-049', name: 'Storage Tank 4',                location: 'Area Storage',  status: 'Running', health: 89, lastPM: '2025-05-13' },
  { id: 'MCH-050', name: 'Storage Tank 5',                location: 'Area Storage',  status: 'Running', health: 87, lastPM: '2025-05-12' },
  { id: 'MCH-051', name: 'Storage Tank 6',                location: 'Area Storage',  status: 'Running', health: 85, lastPM: '2025-05-10' },
  { id: 'MCH-052', name: 'Storage Tank 7',                location: 'Area Storage',  status: 'Running', health: 83, lastPM: '2025-05-09' },
  { id: 'MCH-053', name: 'Storage Tank 8',                location: 'Area Storage',  status: 'Running', health: 80, lastPM: '2025-05-08' },
  { id: 'MCH-054', name: 'Storage Tank 9',                location: 'Area Storage',  status: 'Running', health: 78, lastPM: '2025-05-07' },
  { id: 'MCH-055', name: 'Storage Tank 10',               location: 'Area Storage',  status: 'PM',      health: 64, lastPM: '2025-05-20' },
  { id: 'MCH-056', name: 'Storage Tank 11',               location: 'Area Storage',  status: 'Running', health: 76, lastPM: '2025-05-06' },
  { id: 'MCH-057', name: 'Storage Tank 12',               location: 'Area Storage',  status: 'Running', health: 74, lastPM: '2025-05-05' },
];

const SPAREPARTDATA = [];

const HISTORY_DATA = [];

const PM_SCHEDULES = [];

const ALERTS_DATA = [];

/* ══════════════════════════════════════════════════════════
   3. THEME MANAGEMENT
   ══════════════════════════════════════════════════════════ */

function getTheme() {
  return localStorage.getItem('prima-theme') || 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('prima-theme', theme);
  document.querySelectorAll('#theme-icon-sun, #theme-icon-moon').forEach(el => {
    el.classList.toggle('hidden',
      el.id === (theme === 'dark' ? 'theme-icon-moon' : 'theme-icon-sun')
    );
  });
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  // Smooth transition: add class, set theme, remove class after transition
  document.body.classList.add('theme-transitioning');
  setTheme(next);
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 380);
  // Redraw charts to match new theme
  requestAnimationFrame(() => {
    drawBreakdownChart();
    drawDashboardPieCharts();
  });
}

document.getElementById('login-theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('sup-theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('tech-theme-toggle').addEventListener('click', toggleTheme);
const _prodThemeToggle = document.getElementById('prod-theme-toggle');
if (_prodThemeToggle) _prodThemeToggle.addEventListener('click', toggleTheme);

setTheme(getTheme());

/* ══════════════════════════════════════════════════════════
   4. AUTH / LOGIN  — PIN-based, role auto-detected
   ══════════════════════════════════════════════════════════ */

/* User database: username → { pin, role, displayName, initials } */
const USERS = {
  supervisor:  { pin: '1234', role: 'supervisor',  displayName: 'Supervisor',  initials: 'SV' },
  technician:  { pin: '5678', role: 'technician',  displayName: 'Technician',  initials: 'TC' },
  production:  { pin: '0000', role: 'production',  displayName: 'Production',  initials: 'PR' },
};

/* PIN visibility toggle */
document.getElementById('toggle-pin').addEventListener('click', () => {
  const input = document.getElementById('login-pin');
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  // Swap eye icon
  const svg = document.getElementById('eye-icon');
  svg.innerHTML = isText
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
});

/* Allow only numbers in PIN field */
document.getElementById('login-pin').addEventListener('input', function() {
  this.value = this.value.replace(/\D/g, '');
});

/* Login */
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('login-pin').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});
document.getElementById('login-username').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-pin').focus();
});

function handleLogin() {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const pin      = document.getElementById('login-pin').value;
  const errorEl  = document.getElementById('login-error');
  const btnText  = document.querySelector('#login-btn .btn-text');
  const btnLoader = document.querySelector('#login-btn .btn-loader');

  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  errorEl.classList.add('hidden');

  setTimeout(() => {
    const user = USERS[username];
    if (user && user.pin === pin) {
      // Role determined automatically from the user record
      if (user.role === 'supervisor') {
        // Update supervisor display name
        const nameEls = document.querySelectorAll('#sup-name-sidebar, #sup-name-welcome');
        nameEls.forEach(el => { if (el) el.textContent = user.displayName; });
        const avatarEl = document.getElementById('sup-avatar');
        if (avatarEl) avatarEl.textContent = user.initials;
        const roleEl = document.getElementById('sup-role-sidebar');
        if (roleEl) roleEl.textContent = 'Supervisor';
        showPage('page-supervisor');
      } else if (user.role === 'technician') {
        const techNameEl = document.getElementById('tech-name-display');
        if (techNameEl) techNameEl.textContent = user.displayName;
        const techHeaderNameEl = document.getElementById('tech-header-name');
        if (techHeaderNameEl) techHeaderNameEl.textContent = user.displayName;
        const techAvatarEl = document.getElementById('tech-avatar');
        if (techAvatarEl) techAvatarEl.textContent = user.initials;
        showPage('page-technician');
      } else if (user.role === 'production') {
        const prodHeaderNameEl = document.getElementById('prod-header-name');
        if (prodHeaderNameEl) prodHeaderNameEl.textContent = user.displayName;
        const prodAvatarEl = document.getElementById('prod-avatar');
        if (prodAvatarEl) prodAvatarEl.textContent = user.initials;
        showPage('page-production');
        setTimeout(() => initProduction(), 50);
      }
      showToast('Selamat datang kembali, ' + user.displayName + '! 👋', 'success');
    } else {
      errorEl.classList.remove('hidden');
      document.getElementById('login-pin').value = '';
      document.getElementById('login-pin').focus();
    }
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }, 300);
}

/* Logout */
document.getElementById('sup-logout').addEventListener('click', () => {
  showPage('page-login');
  document.getElementById('login-username').value = '';
  document.getElementById('login-pin').value = '';
  showToast('Berhasil keluar dari sistem', 'info');
});
document.getElementById('tech-logout').addEventListener('click', () => {
  showPage('page-login');
  document.getElementById('login-username').value = '';
  document.getElementById('login-pin').value = '';
  showToast('Berhasil keluar dari sistem', 'info');
});
const _prodLogout = document.getElementById('prod-logout');
if (_prodLogout) _prodLogout.addEventListener('click', () => {
  showPage('page-login');
  document.getElementById('login-username').value = '';
  document.getElementById('login-pin').value = '';
  showToast('Berhasil keluar dari sistem', 'info');
});

/* ══════════════════════════════════════════════════════════
   5. PAGE ROUTING
   ══════════════════════════════════════════════════════════ */

function showPage(pageId) {
  const target = document.getElementById(pageId);
  if (!target) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  // Scroll internal content containers, not window
  const mainContent = target.querySelector('.main-content');
  const techContent = target.querySelector('.tech-content');
  if (mainContent) mainContent.scrollTop = 0;
  if (techContent) techContent.scrollTop = 0;
  if (pageId === 'page-supervisor') initSupervisor();
  if (pageId === 'page-technician') initTechnician();
  if (pageId === 'page-production') initProduction();
}

/* ══════════════════════════════════════════════════════════
   6. SUPERVISOR INIT
   ══════════════════════════════════════════════════════════ */

let supervisorInitialized = false;

function initSupervisor() {
  if (supervisorInitialized) return;
  supervisorInitialized = true;

  initTopbarDate();
  initSidebarNav();
  initDashboard();
  initMachineHistory();
  initPMSchedule();
  initSparepartMgmt();
  initRiwayatLainnya();

  // Pastikan dashboard langsung aktif saat pertama masuk
  // Use a small delay so the layout is rendered before drawing the chart
  requestAnimationFrame(() => {
    activateSupervisorView('dashboard');
    // Delay chart draw slightly to ensure container has proper dimensions
    setTimeout(() => {
      drawBreakdownChart();
      // Load data untuk dashboard supervisor
      loadBreakdownDataForSupervisor();
    }, 80);
  });
}

/* ── Shared clock: one rAF loop drives supervisor, technician & requestor clocks ── */
let _clockSup = null, _clockTech = null, _clockProd = null;
let _lastSecond = -1;

function _clockTick() {
  const now = new Date();
  const sec = now.getSeconds();
  if (sec !== _lastSecond) {
    _lastSecond = sec;
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const html = `<span class="dt-date">${dateStr}</span><span class="dt-time">${timeStr}</span>`;
    if (_clockSup)  _clockSup.innerHTML  = html;
    if (_clockTech) _clockTech.innerHTML = html;
    if (_clockProd) _clockProd.innerHTML = html;
  }
  requestAnimationFrame(_clockTick);
}

function initTopbarDate() {
  _clockSup = document.getElementById('topbar-date');
  if (!_clockSup) return;
  // Kick off the shared loop only once
  if (!_clockTech) requestAnimationFrame(_clockTick);
}

function initTechDateTime() {
  _clockTech = document.getElementById('tech-header-date');
  if (!_clockTech) return;
  if (!_clockSup) requestAnimationFrame(_clockTick);
}

function initSidebarNav() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger');
  const closeBtn  = document.getElementById('sidebar-close');

  hamburger.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.remove('closing');
    overlay.classList.add('open');
  });

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.classList.remove('open', 'closing');
    }, 380);
  }

  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      activateSupervisorView(item.dataset.view);
      closeSidebar();
    });
  });

  // Accordion — Riwayat Lainnya
  const accordionBtn  = document.getElementById('nav-accordion-riwayat-btn');
  const accordionBody = document.getElementById('nav-accordion-riwayat-body');
  if (accordionBtn && accordionBody) {
    accordionBtn.addEventListener('click', () => {
      const isOpen = accordionBody.classList.contains('open');
      accordionBody.classList.toggle('open', !isOpen);
      accordionBtn.classList.toggle('open', !isOpen);
    });
  }
}

function activateSupervisorView(view) {
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.view === view);
  });

  const currentView = document.querySelector('.view.active');
  const targetView  = document.getElementById('view-' + view);

  if (!targetView || currentView === targetView) return;

  // Fade out current, then fade in target
  if (currentView) {
    currentView.classList.remove('active');
  }
  // Kecil delay agar transisi fade-out mulai dulu
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      targetView.classList.add('active');
      // Redraw chart after dashboard view is shown (fixes blank chart on first load)
      if (view === 'dashboard') {
        requestAnimationFrame(() => {
          drawBreakdownChart();
        });
      }
    });
  });

  const titles = {
    'dashboard':           'Dashboard',
    'machine-history':     'Riwayat Mesin',
    'pm-schedule':         'Jadwal PM',
    'sparepart-mgmt':      'Sparepart Management',
    'riwayat-requestor':   'Riwayat Requestor',
    'riwayat-pm':          'Riwayat Input Preventive Maintenance',
    'riwayat-bd':          'Riwayat Input Breakdown Maintenance',
  };
  document.getElementById('view-title').textContent = titles[view] || view;

  // Refresh data riwayat setiap kali tab Riwayat Mesin dibuka
  if (view === 'machine-history') {
    loadBreakdownDataForSupervisor();
  }

  // Refresh Tabel Jadwal setiap kali tab Jadwal PM dibuka + restart interval
  if (view === 'pm-schedule') {
    loadJadwalPMFromGAS();
    if (_jadwalPMInterval) clearInterval(_jadwalPMInterval);
    _jadwalPMInterval = setInterval(() => {
      loadJadwalPMFromGAS();
    }, 30000);
  } else {
    // Hentikan polling saat meninggalkan tab Jadwal PM
    if (_jadwalPMInterval) {
      clearInterval(_jadwalPMInterval);
      _jadwalPMInterval = null;
    }
  }

  // Refresh data sparepart setiap kali tab Sparepart dibuka
  if (view === 'sparepart-mgmt') {
    loadSparepartFromSheet();
  }

  // Refresh riwayat lainnya
  if (view === 'riwayat-requestor') loadRiwayatRequestor(true);
  if (view === 'riwayat-pm')        loadRiwayatPM(true);
  if (view === 'riwayat-bd')        loadRiwayatBD(true);
}

/* ══════════════════════════════════════════════════════════
   7. DASHBOARD
   ══════════════════════════════════════════════════════════ */

function initDashboard() {
  initDashboardMachineFilter();
  initBreakdownFilters();
  drawBreakdownChart();
  // Inisialisasi tooltip hover chart setelah canvas ada di DOM
  requestAnimationFrame(() => initChartTooltip());
  // Gambar pie chart awal (data mungkin kosong, tapi canvas siap)
  requestAnimationFrame(() => drawDashboardPieCharts());
}

/* ── State global filter dashboard ── */
const DASH_FILTER = {
  machineId: '',
  month: '',   // '' = semua, '1'-'12' = bulan
  year: '',    // '' = semua, '2024' dsb
};

function initDashboardMachineFilter() {
  const machineOptions = [
    { value: '', label: 'Semua Mesin' },
    ...MACHINES.map(m => ({ value: m.id, label: m.name }))
  ];
  initSearchableSelect('dash-machine-wrap', machineOptions, 'Semua Mesin', '');

  document.getElementById('dash-machine-select').addEventListener('change', function() {
    DASH_FILTER.machineId = this.value;
    applyDashboardFilters();
  });

  // Filter Bulan
  const monthSel = document.getElementById('dash-filter-month');
  if (monthSel) {
    monthSel.addEventListener('change', function() {
      DASH_FILTER.month = this.value;
      applyDashboardFilters();
    });
  }

  // Filter Tahun — debounce 600ms
  const yearInput = document.getElementById('dash-filter-year');
  if (yearInput) {
    yearInput.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '');
      clearTimeout(yearInput._debounce);
      yearInput._debounce = setTimeout(() => {
        DASH_FILTER.year = this.value.length === 4 ? this.value : '';
        applyDashboardFilters();
      }, 600);
    });
  }

  applyDashboardFilters();
}

/* Terapkan semua filter dashboard dan refresh semua 9 card */
function applyDashboardFilters() {
  updateDashboardByMachine(DASH_FILTER.machineId);
  // MTBF/MTTR & Pie chart diperbarui lewat updateMtbfMttrFiltered dan drawDashboardPieCharts
  updateMtbfMttrFiltered();
  drawDashboardPieCharts();
}

/* Filter array BD data berdasarkan DASH_FILTER.month dan DASH_FILTER.year */
function filterBDByMonthYear(data) {
  if (!DASH_FILTER.month && !DASH_FILTER.year) return data;
  return data.filter(row => {
    const ts = parseTimestamp(row['Timestamp']);
    if (!ts) return false;
    if (DASH_FILTER.month && String(ts.getMonth() + 1) !== DASH_FILTER.month) return false;
    if (DASH_FILTER.year  && String(ts.getFullYear()) !== DASH_FILTER.year)   return false;
    return true;
  });
}

/* Filter sparepart berdasarkan tanggal (lastReplace atau nextReplace) */
function filterSpByMonthYear(data) {
  if (!DASH_FILTER.month && !DASH_FILTER.year) return data;
  return data.filter(sp => {
    const dateStr = sp.lastReplace || sp.nextReplace || '';
    if (!dateStr || dateStr === 'OVERDUE') return true; // tetap tampilkan jika tidak ada tanggal
    const d = new Date(dateStr);
    if (isNaN(d)) return true;
    if (DASH_FILTER.month && String(d.getMonth() + 1) !== DASH_FILTER.month) return false;
    if (DASH_FILTER.year  && String(d.getFullYear()) !== DASH_FILTER.year)   return false;
    return true;
  });
}

/* Update MTBF/MTTR dengan filter bulan/tahun */
function updateMtbfMttrFiltered() {
  const filtered = filterBDByMonthYear(_pieBDData);
  updateMtbfMttr(filtered);
}

function updateDashboardByMachine(machineId) {
  // Gunakan sparepartStore (data live) jika sudah ada, fallback ke SPAREPARTDATA
  const sourceData = sparepartStore.length > 0 ? sparepartStore : SPAREPARTDATA;

  // Filter sparepart data by machine
  let filteredSpareParts;
  if (machineId) {
    const m = MACHINES.find(m => m.id === machineId);
    const filterName = m ? m.name : machineId;
    // sparepartStore uses machineName, SPAREPARTDATA uses machine ID
    filteredSpareParts = sourceData.filter(s =>
      s.machineName === filterName || s.machine === machineId
    );
  } else {
    filteredSpareParts = sourceData;
  }

  // Terapkan filter bulan/tahun pada sparepart (berdasarkan tanggal penggantian)
  filteredSpareParts = filterSpByMonthYear(filteredSpareParts);

  // Sparepart Aktif: all spareParts in scope
  const sparepartAktif = filteredSpareParts.length;

  // Sparepart Overtime: status 'critical'
  const sparepartOvertime = filteredSpareParts.filter(s => s.status === 'critical').length;

  // Sparepart Akan Overtime: status 'warning'
  const sparepartAkanOvertime = filteredSpareParts.filter(s => s.status === 'warning').length;

  // Update KPI cards with animation
  animateCount(document.querySelectorAll('.kpi-value[data-count]')[0], sparepartAktif);
  animateCount(document.querySelectorAll('.kpi-value[data-count]')[1], sparepartOvertime);
  animateCount(document.querySelectorAll('.kpi-value[data-count]')[2], sparepartAkanOvertime);

  // Update badge in lifetime card
  const badge = document.getElementById('sp-lifetime-machine-badge');
  if (badge) {
    if (machineId) {
      const m = MACHINES.find(m => m.id === machineId);
      badge.textContent = m ? m.name : machineId;
    } else {
      badge.textContent = 'Semua Mesin';
    }
  }

  // Render lifetime sparepart grid
  const mappedForDash = filteredSpareParts.map(s => ({
    name:        s.name,
    machine:     s.machine,
    machineName: s.machineName || machineNameFromId(s.machine) || '',
    life:        s.life,
    status:      s.status,
    nextReplace: s.nextReplace,
    lastReplace: s.lastReplace  || '',
    sisaHari:    s.sisaHari     ?? null,
    daysOverdue: s.daysOverdue  ?? 0,
    lifetimeDays:s.lifetimeDays ?? null,
  }));
  renderSparepartLifetime(mappedForDash);

  // Gambar ulang pie chart langsung — data _pieBDData sudah ada di memory
  drawDashboardPieCharts();
}

function renderSparepartLifetime(data) {
  const grid = document.getElementById('sparepart-lifetime-grid');
  if (!grid) return;

  if (!data.length) {
    grid.innerHTML = '<div class="sp-lt-empty">Tidak ada data sparepart untuk mesin ini.</div>';
    return;
  }

  const statusLabel = { good: 'Baik', warning: 'Perlu Perhatian', critical: 'Kritis' };

  // Sort: critical first, then warning, then good
  const sorted = [...data].sort((a, b) => {
    const order = { critical: 0, warning: 1, good: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  grid.innerHTML = sorted.map(s => {
    const isOverdue = s.nextReplace === 'OVERDUE' || s.daysOverdue > 0;

    /* ── Info pill: mesin (jika ada), lalu sisa hari / overdue ── */
    const machineDisplay = s.machineName && s.machineName !== '—'
      ? s.machineName
      : (s.machine && s.machine !== '—' ? machineNameFromId(s.machine) : '');

    /* Baris mesin */
    const machineTag = machineDisplay
      ? `<span class="sp-lt-machine-tag">${machineDisplay}</span>`
      : '';

    /* Baris sisa hari / overdue / terakhir diganti */
    let infoTag = '';
    if (isOverdue) {
      const over = s.daysOverdue > 0 ? `${s.daysOverdue} hari` : '';
      infoTag = `<span class="sp-lt-info-tag sp-lt-info-overdue">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;flex-shrink:0"><path d="M8 2l.001 6M8 11v.5"/><circle cx="8" cy="8" r="6.5"/></svg>
        Terlambat${over ? ' ' + over : ''}
      </span>`;
    } else if (s.sisaHari != null) {
      if (s.sisaHari === 0) {
        infoTag = `<span class="sp-lt-info-tag sp-lt-info-warn">Ganti hari ini</span>`;
      } else if (s.sisaHari <= 7) {
        infoTag = `<span class="sp-lt-info-tag sp-lt-info-warn">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;flex-shrink:0"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5"/><circle cx="8" cy="11" r=".5" fill="currentColor"/></svg>
          Sisa ${s.sisaHari} hari
        </span>`;
      } else {
        infoTag = `<span class="sp-lt-info-tag sp-lt-info-good">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;flex-shrink:0"><path d="M3 8.5l3 3 7-7"/></svg>
          Sisa ${s.sisaHari} hari
        </span>`;
      }
    } else if (s.lastReplace) {
      infoTag = `<span class="sp-lt-info-tag sp-lt-info-neutral">Terakhir: ${s.lastReplace}</span>`;
    }

    return `
    <div class="sp-lt-item status-${s.status}">
      <div class="sp-lt-header">
        <div>
          <div class="sp-lt-name">${s.name.replace(/\s*\(MCH-\d+\)/, '').replace(/\s*\(AC-\d+\)/, '')}</div>
          <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">
            ${machineTag}
            ${infoTag}
          </div>
        </div>
        <span class="sp-lt-pct ${s.status}">${s.life}%</span>
      </div>
      <div class="sp-lt-bar-wrap">
        <div class="sp-lt-bar-fill ${s.status}" style="width:${s.life}%"></div>
      </div>
      <div class="sp-lt-footer">
        <div class="sp-lt-next ${isOverdue ? 'overdue' : ''}">
          Penggantian: <span>${isOverdue ? '⚠ OVERDUE' : s.nextReplace}</span>
        </div>
        <span class="sp-lt-status-chip ${s.status}">${statusLabel[s.status] || s.status}</span>
      </div>
    </div>`;
  }).join('');
}

function animateCount(el, target) {
  if (!el) return;
  el.dataset.count = target;
  const duration = 500;
  let start = null;
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function step(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    el.textContent = Math.round(easeOut(progress) * target);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderHealthTable(data) {
  const tbody = document.getElementById('health-tbody');
  tbody.innerHTML = data.map(m => {
    const healthClass  = m.health >= 70 ? 'good' : m.health >= 40 ? 'fair' : 'critical';
    const statusClass  = { Running: 'sb-running', Down: 'sb-down', PM: 'sb-pm' }[m.status];
    const statusLabel  = { Running: 'Berjalan', Down: 'Mati', PM: 'Perawatan' }[m.status] || m.status;
    return `<tr>
      <td>${m.name}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td style="color:var(--text-2);font-size:.8rem">${m.lastPM}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="health-bar"><div class="health-fill ${healthClass}" style="width:${m.health}%"></div></div>
          <span style="font-size:.78rem;color:var(--text-2)">${m.health}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function initHealthSearch() {
  document.getElementById('health-search').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    renderHealthTable(MACHINES.filter(m =>
      m.name.toLowerCase().includes(q)
    ));
  });
}

function renderAlerts() {
  document.getElementById('alerts-list').innerHTML = ALERTS_DATA.map(a => `
    <div class="alert-item">
      <div class="alert-item-header">
        <span class="alert-item-title">
          <span class="alert-dot" style="background:${a.color}"></span>
          ${a.title}
        </span>
        <span class="alert-time">${a.time}</span>
      </div>
      <div class="alert-desc">${a.desc}</div>
    </div>
  `).join('');
}

function renderSparepartGrid() {
  document.getElementById('sparepart-grid').innerHTML = SPAREPARTDATA.map(s => `
    <div class="sp-item">
      <div class="sp-top">
        <span class="sp-name">${s.name}</span>
        <span class="sp-pct" style="color:${s.status==='critical'?'var(--danger)':s.status==='warning'?'var(--warning)':'var(--success)'}">${s.life}%</span>
      </div>
      <div class="sp-bar"><div class="sp-fill ${s.status}" style="width:${s.life}%"></div></div>
      <div class="sp-meta">Berikutnya: ${s.nextReplace}</div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════
   8. CHARTS (Pure Canvas)
   ══════════════════════════════════════════════════════════ */

function getCSSColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/* Data chart — semua nol; diisi dari data live GAS via buildLiveChartData */
const BREAKDOWN_YEARLY = {
  2023: { bd: Array(12).fill(0), pm: Array(12).fill(0) },
  2024: { bd: Array(12).fill(0), pm: Array(12).fill(0) },
  2025: { bd: Array(12).fill(0), pm: Array(12).fill(0) },
  2026: { bd: Array(12).fill(0), pm: Array(12).fill(0) },
};

/* Per-month mock: per day */
const MONTH_NAMES_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MONTH_SHORT    = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

function getMonthlyData(year, month) {
  // Jumlah hari dalam bulan tersebut
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const base = BREAKDOWN_YEARLY[year] || BREAKDOWN_YEARLY[2025];
  const totalBD = base.bd[month];
  const totalPM = base.pm[month];

  // Seed deterministik agar data konsisten
  const seed = (totalBD * 31 + month * 7 + year) % 97;

  // Distribusikan events ke hari-hari secara pseudo-random tapi deterministik
  const bd = Array(daysInMonth).fill(0);
  const pm = Array(daysInMonth).fill(0);

  // Tempatkan BD events
  let placed = 0;
  for (let i = 0; i < daysInMonth && placed < totalBD; i++) {
    const rng = ((seed * 1664525 + i * 22695477 + 1013904223) >>> 0) % 100;
    if (rng < Math.ceil((totalBD - placed) / (daysInMonth - i) * 100)) {
      bd[i] = 1;
      placed++;
    }
  }

  // Tempatkan PM events — cenderung menghindari hari yang sudah ada BD
  placed = 0;
  for (let i = 0; i < daysInMonth && placed < totalPM; i++) {
    const rng = ((seed * 6364136223 + i * 1442695040 + 12345) >>> 0) % 100;
    const threshold = Math.ceil((totalPM - placed) / (daysInMonth - i) * 80);
    if (rng < threshold) {
      pm[i] += 1;
      placed++;
    }
  }
  // Isi sisa PM jika belum terpenuhi
  for (let i = 0; placed < totalPM && i < daysInMonth; i++) {
    if (pm[i] === 0 && bd[i] === 0) { pm[i] = 1; placed++; }
  }

  return { bd, pm, daysInMonth };
}

/* State for current filter */
let _bdFilterMonth = '';   // '' = all months
let _bdFilterYear  = 2025;
let _bdChartMode   = 'bd_pm'; // 'bd_pm' | 'mtbf' | 'mttr'

/* Cache data live untuk chart breakdown/PM — diisi dari loadBreakdownDataForSupervisor */
let _liveChartData = null; // { byMonth: { [year]: { [month0]: { bd, pm } } } } | null

/* ── State hover tooltip chart-breakdown ── */
let _chartPoints     = []; // [{ x, y, label, bd, pm, single }] — dikosongkan+diisi setiap drawBreakdownChart
let _chartPadding    = { L:36, R:20, T:20, B:32 };
let _chartDims       = { W:0, H:200 };
let _chartHoverIdx   = -1; // indeks titik yang sedang di-hover
let _chartHoverInited = false;

function initChartTooltip() {
  if (_chartHoverInited) return;
  _chartHoverInited = true;

  const canvas = document.getElementById('chart-breakdown');
  if (!canvas) return;

  // Buat elemen tooltip sekali saja
  let tip = document.getElementById('chart-bd-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chart-bd-tooltip';
    tip.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'display:none',
      'background:var(--bg-3,#1e2235)',
      'color:var(--text-1,#e8eaff)',
      'border:1px solid var(--border-1,rgba(255,255,255,.1))',
      'border-radius:8px',
      'padding:8px 12px',
      'font:500 12px/1.5 "DM Sans",sans-serif',
      'box-shadow:0 4px 16px rgba(0,0,0,.25)',
      'z-index:200',
      'min-width:110px',
      'transition:opacity .12s ease',
    ].join(';');
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(tip);
  }

  canvas.addEventListener('mousemove', e => {
    if (!_chartPoints.length) { tip.style.display = 'none'; return; }

    const rect = canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1));

    // Cari titik terdekat secara horizontal
    let closest = -1, minDist = Infinity;
    _chartPoints.forEach((pt, i) => {
      const d = Math.abs(pt.x - mx);
      if (d < minDist) { minDist = d; closest = i; }
    });

    const snapPx = _chartPoints.length > 20 ? 12 : 24;
    if (closest === -1 || minDist > snapPx) {
      tip.style.display = 'none';
      _chartHoverIdx = -1;
      return;
    }

    if (_chartHoverIdx === closest) return; // tidak berubah
    _chartHoverIdx = closest;

    const pt = _chartPoints[closest];
    const isDark = getTheme() === 'dark';
    tip.style.background   = isDark ? 'rgba(30,34,53,.96)' : 'rgba(255,255,255,.97)';
    tip.style.color        = isDark ? '#e8eaff' : '#1a1d2e';
    tip.style.borderColor  = isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.09)';

    let html = `<div style="font-weight:700;font-size:13px;margin-bottom:5px;color:${isDark?'#e8eaff':'#1a1d2e'}">${pt.label}</div>`;
    if (pt.single != null) {
      // MTBF/MTTR — satu seri
      html += `<div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:${pt.singleColor};display:inline-block;flex-shrink:0"></span>
        <span style="color:var(--text-2,#8b94ae);font-size:11px">${pt.singleLabel}:</span>
        <span style="font-weight:600">${pt.single % 1 === 0 ? pt.single : pt.single.toFixed(2)}</span>
      </div>`;
    } else {
      // BD + PM
      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="width:8px;height:8px;border-radius:50%;background:#FF6B6B;display:inline-block;flex-shrink:0"></span>
        <span style="color:var(--text-2,#8b94ae);font-size:11px">Breakdown:</span>
        <span style="font-weight:600">${pt.bd}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:#6C63FF;display:inline-block;flex-shrink:0"></span>
        <span style="color:var(--text-2,#8b94ae);font-size:11px">PM:</span>
        <span style="font-weight:600">${pt.pm}</span>
      </div>`;
    }
    tip.innerHTML = html;
    tip.style.display = 'block';

    // Posisi tooltip relatif terhadap parent (canvas wrapper)
    const parentRect = canvas.parentElement.getBoundingClientRect();
    const tipW = tip.offsetWidth  || 140;
    const tipH = tip.offsetHeight || 68;
    const ptScreenX = rect.left + (pt.x / (canvas.width / rect.width)) - parentRect.left;
    const ptScreenY = rect.top  + ((pt.y * (window.devicePixelRatio||1)) / (canvas.height / rect.height)) - parentRect.top;

    let tx = ptScreenX - tipW / 2;
    let ty = ptScreenY - tipH - 10;
    // Clamp dalam batas parent
    tx = Math.max(4, Math.min(tx, parentRect.width - tipW - 4));
    if (ty < 4) ty = ptScreenY + 14;
    tip.style.left = tx + 'px';
    tip.style.top  = ty + 'px';
  });

  canvas.addEventListener('mouseleave', () => {
    tip.style.display = 'none';
    _chartHoverIdx = -1;
  });
}

function initBreakdownFilters() {
  const selMonth   = document.getElementById('bd-filter-month');
  const inputYear  = document.getElementById('bd-filter-year');
  const yearStatus = document.getElementById('bd-year-status');
  const selMode    = document.getElementById('bd-chart-mode');
  if (!selMonth || !inputYear) return;

  // Seed with current year
  const currentYear = new Date().getFullYear();
  _bdFilterYear = currentYear;
  inputYear.value = String(currentYear);

  // Only allow digits while typing
  inputYear.addEventListener('keypress', e => {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  });

  // Live feedback + apply on valid 4-digit year
  inputYear.addEventListener('input', () => {
    const raw = inputYear.value.replace(/\D/g, '');
    inputYear.value = raw; // strip any stray non-digits

    inputYear.classList.remove('bd-year-valid', 'bd-year-invalid');
    if (yearStatus) yearStatus.className = 'bd-year-input-status';

    if (raw.length !== 4) return; // wait for full year

    const yr = parseInt(raw);
    if (yr >= 2000 && yr <= 2100) {
      inputYear.classList.add('bd-year-valid');
      if (yearStatus) yearStatus.classList.add('ok');
      _bdFilterYear = yr;
      drawBreakdownChart();
    } else {
      inputYear.classList.add('bd-year-invalid');
      if (yearStatus) yearStatus.classList.add('err');
    }
  });

  // Also apply on Enter / blur if value looks reasonable
  function tryApply() {
    const yr = parseInt(inputYear.value);
    if (!isNaN(yr) && yr >= 2000 && yr <= 2100 && yr !== _bdFilterYear) {
      _bdFilterYear = yr;
      inputYear.classList.remove('bd-year-invalid');
      inputYear.classList.add('bd-year-valid');
      if (yearStatus) { yearStatus.className = 'bd-year-input-status ok'; }
      drawBreakdownChart();
    }
  }
  inputYear.addEventListener('blur',  tryApply);
  inputYear.addEventListener('keydown', e => { if (e.key === 'Enter') { inputYear.blur(); } });

  selMonth.addEventListener('change', () => {
    _bdFilterMonth = selMonth.value;
    drawBreakdownChart();
  });

  // Mode dropdown: Breakdown & PM / MTBF / MTTR
  if (selMode) {
    selMode.addEventListener('change', () => {
      _bdChartMode = selMode.value;
      updateChartModeUI();
      drawBreakdownChart();
    });
  }
  updateChartModeUI();
}

/* Update judul chart, legend, dan visibilitas filter bulan sesuai mode */
function updateChartModeUI() {
  const titleEl  = document.getElementById('bd-chart-title');
  const legendEl = document.getElementById('bd-chart-legend');
  const selMonth = document.getElementById('bd-filter-month');

  const titles = {
    bd_pm: 'Breakdown Bulanan',
    mtbf:  'MTBF Bulanan (jam)',
    mttr:  'MTTR Bulanan (jam)',
  };
  if (titleEl) titleEl.textContent = titles[_bdChartMode] || 'Breakdown Bulanan';

  // Legend hanya relevan untuk mode bd_pm
  if (legendEl) legendEl.style.display = _bdChartMode === 'bd_pm' ? '' : 'none';

  // Filter bulan tidak relevan untuk MTBF/MTTR (selalu tampilkan per bulan)
  if (selMonth) selMonth.style.display = _bdChartMode === 'bd_pm' ? '' : 'none';
}

function drawBreakdownChart() {
  const canvas = document.getElementById('chart-breakdown');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  const W      = parent.clientWidth - 44;
  const H      = 200;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const isDark  = getTheme() === 'dark';
  const textClr = isDark ? 'rgba(139,148,158,.9)'  : 'rgba(100,116,139,.9)';
  const gridClr = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';

  /* ── Decide what data to render ── */
  let labels, bdData, pmData;
  const isMonthView = _bdFilterMonth !== '' && _bdChartMode === 'bd_pm';

  // ── MTBF / MTTR mode ──
  if (_bdChartMode === 'mtbf' || _bdChartMode === 'mttr') {
    labels = MONTH_SHORT;
    const isMtbf = _bdChartMode === 'mtbf';
    if (_liveChartData) {
      const yearMap = _liveChartData.byMonth[_bdFilterYear] || {};
      bdData = Array.from({ length: 12 }, (_, i) => {
        const mo = yearMap[i];
        if (!mo) return 0;
        return isMtbf ? (mo.mtbf ?? 0) : (mo.mttr ?? 0);
      });
    } else {
      bdData = Array(12).fill(0);
    }
    pmData = null; // hanya satu seri

    const maxVal  = Math.max(...bdData, 1);
    const maxAxis = Math.ceil(maxVal / 5) * 5 || 10;

    const padL = 44, padR = 20, padT = 20, padB = 32;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n      = labels.length;

    ctx.clearRect(0, 0, W, H);

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.strokeStyle = gridClr;
      ctx.lineWidth = 1;
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = textClr;
      ctx.font = '10px DM Sans, sans-serif';
      ctx.textAlign = 'right';
      const val = maxAxis - (maxAxis / gridLines) * i;
      ctx.fillText(val % 1 === 0 ? val : val.toFixed(1), padL - 5, y + 3);
    }
    for (let i = 0; i < n; i++) {
      const x = padL + (i / (n - 1)) * chartW;
      ctx.fillStyle = textClr;
      ctx.font = '10px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x, H - padB + 14);
      ctx.beginPath(); ctx.strokeStyle = gridClr; ctx.lineWidth = 1;
      ctx.moveTo(x, padT + chartH); ctx.lineTo(x, padT + chartH + 4); ctx.stroke();
    }

    function ptX(i) { return padL + (i / (n - 1)) * chartW; }
    function ptY(v) { return padT + chartH - (v / maxAxis) * chartH; }
    const lineColor = isMtbf ? '#6C63FF' : '#FF9F43';
    const fillColor = isMtbf
      ? (isDark ? 'rgba(108,99,255,0.12)' : 'rgba(108,99,255,0.09)')
      : (isDark ? 'rgba(255,159,67,0.14)' : 'rgba(255,159,67,0.10)');

    ctx.beginPath();
    ctx.moveTo(ptX(0), padT + chartH);
    ctx.lineTo(ptX(0), ptY(bdData[0]));
    for (let i = 1; i < n; i++) {
      const x0 = ptX(i-1), y0 = ptY(bdData[i-1]);
      const x1 = ptX(i),   y1 = ptY(bdData[i]);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.lineTo(ptX(n-1), padT + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(ptX(0), ptY(bdData[0]));
    for (let i = 1; i < n; i++) {
      const x0 = ptX(i-1), y0 = ptY(bdData[i-1]);
      const x1 = ptX(i),   y1 = ptY(bdData[i]);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const x = ptX(i), y = ptY(bdData[i]);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#181B26' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Simpan titik untuk hover tooltip
    _chartPoints = Array.from({ length: n }, (_, i) => ({
      x:           ptX(i),
      y:           ptY(bdData[i]),
      label:       labels[i],
      single:      bdData[i],
      singleColor: lineColor,
      singleLabel: isMtbf ? 'MTBF (jam)' : 'MTTR (jam)',
    }));
    _chartPadding = { L: padL, R: padR, T: padT, B: padB };
    _chartDims    = { W, H };

    return;
  }

  // ── BD_PM mode (default) ──

  if (_liveChartData) {
    // ── Gunakan data live ──
    const yearMap = _liveChartData.byMonth[_bdFilterYear] || {};
    if (isMonthView) {
      const monthIdx = parseInt(_bdFilterMonth);
      const daysInMonth = new Date(_bdFilterYear, monthIdx + 1, 0).getDate();
      const dayData = (yearMap[monthIdx] && yearMap[monthIdx].days) || {
        bd: Array(daysInMonth).fill(0),
        pm: Array(daysInMonth).fill(0),
      };
      labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      bdData = dayData.bd.slice(0, daysInMonth);
      pmData = dayData.pm.slice(0, daysInMonth);
    } else {
      labels = MONTH_SHORT;
      bdData = Array.from({ length: 12 }, (_, i) => (yearMap[i] ? yearMap[i].bd : 0));
      pmData = Array.from({ length: 12 }, (_, i) => (yearMap[i] ? yearMap[i].pm : 0));
    }
  } else if (isMonthView) {
    // ── Fallback ke mock per-hari ──
    const monthIdx = parseInt(_bdFilterMonth);
    const { bd, pm, daysInMonth } = getMonthlyData(_bdFilterYear, monthIdx);
    labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    bdData = bd;
    pmData = pm;
  } else {
    // ── Fallback ke mock tahunan ──
    const yearData = BREAKDOWN_YEARLY[_bdFilterYear] || BREAKDOWN_YEARLY[2025];
    labels = MONTH_SHORT;
    bdData = yearData.bd;
    pmData = yearData.pm;
  }

  const maxVal  = Math.max(...bdData, ...pmData, 1);
  const maxAxis = Math.ceil(maxVal / 2) * 2;

  const padL = 36, padR = 20, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n      = labels.length;

  ctx.clearRect(0, 0, W, H);

  /* ── Grid lines ── */
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.strokeStyle = gridClr;
    ctx.lineWidth = 1;
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillStyle = textClr;
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxAxis - (maxAxis / gridLines) * i), padL - 5, y + 3);
  }

  /* ── X-axis labels ── */
  // Pada tampilan per-hari (28-31 titik), hanya tampilkan label setiap 5 hari
  // agar tidak saling tumpang tindih
  const labelStep = isMonthView ? 5 : 1; // tampilkan setiap 5 hari pada daily view
  for (let i = 0; i < n; i++) {
    const x = padL + (i / (n - 1)) * chartW;

    /* Hanya tampilkan label pada kelipatan labelStep, atau pada hari pertama/terakhir */
    const showLabel = !isMonthView || (i + 1) % labelStep === 0 || i === 0 || i === n - 1;
    if (showLabel) {
      ctx.fillStyle = textClr;
      ctx.font = isMonthView ? '9px DM Sans, sans-serif' : '10px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x, H - padB + 14);
    }

    /* Subtle vertical tick — tampilkan semua, tapi lebih terang pada label day */
    ctx.beginPath();
    ctx.strokeStyle = showLabel && isMonthView
      ? (isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)')
      : gridClr;
    ctx.lineWidth = 1;
    ctx.moveTo(x, padT + chartH);
    ctx.lineTo(x, padT + chartH + (showLabel ? 5 : 3));
    ctx.stroke();
  }

  /* ── Helper: point coords ── */
  function ptX(i) { return padL + (i / (n - 1)) * chartW; }
  function ptY(v) { return padT + chartH - (v / maxAxis) * chartH; }

  /* ── Draw one line series ── */
  function drawLine(data, strokeColor, fillColor) {
    /* Area fill */
    ctx.beginPath();
    ctx.moveTo(ptX(0), padT + chartH);
    ctx.lineTo(ptX(0), ptY(data[0]));
    for (let i = 1; i < n; i++) {
      const x0 = ptX(i - 1), y0 = ptY(data[i - 1]);
      const x1 = ptX(i),     y1 = ptY(data[i]);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.lineTo(ptX(n - 1), padT + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    /* Line stroke */
    ctx.beginPath();
    ctx.moveTo(ptX(0), ptY(data[0]));
    for (let i = 1; i < n; i++) {
      const x0 = ptX(i - 1), y0 = ptY(data[i - 1]);
      const x1 = ptX(i),     y1 = ptY(data[i]);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isMonthView ? 1.8 : 2.2;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;
    ctx.stroke();

    /* Dot markers — lebih kecil pada daily view agar tidak menuh-menuhi grafik */
    const dotR  = isMonthView ? 2.5 : 3.5;
    const dotLW = isMonthView ? 1.5 : 2;
    for (let i = 0; i < n; i++) {
      const v = data[i];
      // Pada daily view: hanya gambar dot jika nilainya > 0, agar grafik lebih bersih
      if (isMonthView && v === 0) continue;
      const x = ptX(i), y = ptY(v);
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#181B26' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = dotLW;
      ctx.stroke();
    }
  }

  /* PM line (behind) */
  drawLine(
    pmData,
    '#6C63FF',
    isDark ? 'rgba(108,99,255,0.10)' : 'rgba(108,99,255,0.08)'
  );

  /* Breakdown line (front) */
  drawLine(
    bdData,
    '#FF6B6B',
    isDark ? 'rgba(255,107,107,0.12)' : 'rgba(255,107,107,0.09)'
  );

  // ── Simpan titik untuk hover tooltip ──
  _chartPoints = Array.from({ length: n }, (_, i) => {
    let label = labels[i];
    if (isMonthView) {
      // Tampilkan "Tgl DD Bulan YYYY" di tooltip daily view
      const monthIdx = parseInt(_bdFilterMonth);
      label = `${labels[i]} ${MONTH_NAMES_ID[monthIdx].substring(0,3)} ${_bdFilterYear}`;
    }
    return {
      x:  ptX(i),
      y:  ptY(bdData[i]),  // pakai titik BD sebagai anchor Y tooltip (lebih sering ada data)
      label,
      bd: bdData[i],
      pm: pmData[i],
    };
  });
  _chartPadding = { L: padL, R: padR, T: padT, B: padB };
  _chartDims    = { W, H };

}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStatusDonut() {
  const canvas = document.getElementById('chart-status');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = 160, H = 160;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const cx = W / 2, cy = H / 2, r = 64, inner = 42;
  const segments = [
    { val: 17, color: '#6BCB77' },
    { val: 4,  color: '#FFD93D' },
    { val: 3,  color: '#FF6B6B' },
  ];
  const total = segments.reduce((s, x) => s + x.val, 0);
  let angle = -Math.PI / 2;

  segments.forEach(seg => {
    const sweep = (seg.val / total) * 2 * Math.PI;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep); ctx.closePath();
    ctx.fillStyle = seg.color; ctx.globalAlpha = 0.9; ctx.fill();
    angle += sweep;
  });

  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
  ctx.fillStyle = getTheme() === 'dark' ? '#181B26' : '#ffffff';
  ctx.fill();

  ctx.fillStyle = getTheme() === 'dark' ? '#E8EAFF' : '#1A1D2E';
  ctx.font = 'bold 22px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.font = '11px DM Sans, sans-serif';
  ctx.fillStyle = getTheme() === 'dark' ? '#8B8FA8' : '#5C5F7A';
  ctx.fillText('Mesin', cx, cy + 12);
}

/* ══════════════════════════════════════════════════════════
   8b. DASHBOARD PIE CHARTS (Canvas)
   ══════════════════════════════════════════════════════════ */

/* Store raw BD data untuk pie chart — diisi oleh loadBreakdownDataForSupervisor */
let _pieBDData = [];

/* Palet warna pie chart */
const PIE_PALETTE = [
  '#4361EE', '#FF6B6B', '#6BCB77', '#FFD93D', '#C77DFF',
  '#FF9F43', '#4ECDC4', '#A8DADC', '#F4A261', '#E76F51',
];

/**
 * Gambar pie chart donut pada <canvas> dengan id `canvasId`.
 * segments = [{ label, value, color }]
 */
function drawPieChart(canvasId, segments, totalLabel) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const SIZE = 140;
  canvas.width  = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width  = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  ctx.scale(dpr, dpr);

  const cx = SIZE / 2, cy = SIZE / 2;
  const r  = SIZE / 2 - 6;   // outer radius
  const ri = r * 0.72;        // inner radius (donut hole) — ring lebih tipis
  const total = segments.reduce((s, x) => s + x.value, 0);
  const isDark = getTheme() === 'dark';

  ctx.clearRect(0, 0, SIZE, SIZE);

  if (!total) {
    // kosong — gambar lingkaran abu
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
    ctx.lineWidth = r - ri;
    ctx.stroke();
    // label "—"
    ctx.fillStyle = isDark ? '#8B8FA8' : '#5C5F7A';
    ctx.font = 'bold 18px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('—', cx, cy);
    return;
  }

  let angle = -Math.PI / 2;
  const GAP = total > 1 ? 0.018 : 0;

  segments.forEach((seg) => {
    if (!seg.value) return;
    const sweep = (seg.value / total) * (Math.PI * 2) - GAP;
    const a0 = angle + GAP / 2;
    const a1 = a0 + sweep;

    // Gambar irisan donut: outer arc maju → inner arc mundur
    ctx.beginPath();
    ctx.arc(cx, cy, r,  a0, a1, false);
    ctx.arc(cx, cy, ri, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.globalAlpha = 0.93;
    ctx.fill();
    ctx.globalAlpha = 1;
    angle += sweep + GAP;
  });

  // Label total di tengah
  ctx.fillStyle = isDark ? '#E8EAFF' : '#1A1D2E';
  ctx.font = `bold ${total >= 100 ? 16 : 20}px Plus Jakarta Sans, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 5);
  ctx.font = '9px DM Sans, sans-serif';
  ctx.fillStyle = isDark ? '#8B8FA8' : '#5C5F7A';
  ctx.fillText(totalLabel || 'total', cx, cy + 9);
}

/**
 * Render legenda di sebelah kanan pie chart.
 */
function renderPieLegend(legendId, segments, total) {
  const el = document.getElementById(legendId);
  if (!el) return;
  if (!total) {
    el.innerHTML = '<div class="dash-pie-empty">Belum ada data</div>';
    return;
  }
  el.innerHTML = segments
    .filter(s => s.value > 0)
    .map(s => {
      const pct = Math.round((s.value / total) * 100);
      return `<div class="dash-pie-legend-item">
        <span class="dash-pie-legend-dot" style="background:${s.color}"></span>
        <span class="dash-pie-legend-label" title="${s.label}">${s.label}</span>
        <span class="dash-pie-legend-val">${s.value} <span style="font-weight:400;font-size:.68rem;color:var(--text-3)">(${pct}%)</span></span>
      </div>`;
    }).join('');
}

/**
 * Hitung frekuensi kata-kata kunci tindakan perbaikan dari deskripsiTindakan BD.
 * Format tipikal: "[Pergantian Sparepart] nama | [Perbaikan] keterangan | ..."
 * Ambil tipe tindakan dalam kurung siku, atau fallback ke empat kategori fixed.
 */
function countTindakan(bdRows) {
  const CATEGORIES = [
    'Pergantian Sparepart',
    'Perbaikan',
    'Pengecekan',
    'Kalibrasi',
  ];
  const counts = {};
  CATEGORIES.forEach(c => { counts[c] = 0; });

  bdRows.forEach(row => {
    const desc = row['Deskripsi Tindakan'] || '';
    // Ekstrak semua [Tipe] dari format "[Tipe] teks | [Tipe] teks"
    const matches = desc.match(/\[([^\]]+)\]/g);
    if (matches && matches.length) {
      matches.forEach(m => {
        const key = m.replace(/[\[\]]/g, '').trim();
        if (CATEGORIES.includes(key)) {
          counts[key]++;
        }
      });
    }
  });
  return counts;
}

/**
 * Hitung distribusi jenis kerusakan dari data LaporanKerusakan atau BreakdownMaintenance.
 */
function countJenisKerusakan(bdRows) {
  const counts = {};
  bdRows.forEach(row => {
    const jk = (row['Jenis Kerusakan'] || '').trim();
    if (!jk) return;
    counts[jk] = (counts[jk] || 0) + 1;
  });
  return counts;
}

/**
 * Main function — gambar ketiga pie chart.
 * Dipanggil setiap kali data sparepart atau BD berubah.
 */
function drawDashboardPieCharts() {
  // ── Terapkan filter bulan/tahun dan mesin ke BD data ──
  let activeBDData = _pieBDData;
  if (DASH_FILTER.month || DASH_FILTER.year) {
    activeBDData = filterBDByMonthYear(activeBDData);
  }
  // Filter berdasarkan mesin jika dipilih
  if (DASH_FILTER.machineId) {
    const m = MACHINES.find(m => m.id === DASH_FILTER.machineId);
    const machineName = m ? m.name : DASH_FILTER.machineId;
    activeBDData = activeBDData.filter(row =>
      (row['Nama Mesin'] || '').trim() === machineName
    );
  }

  // ── Pie 1: Status Sparepart ──
  let spData = sparepartStore.length > 0 ? sparepartStore : [];
  // Terapkan filter mesin pada sparepart untuk pie chart
  if (DASH_FILTER.machineId) {
    const m = MACHINES.find(m => m.id === DASH_FILTER.machineId);
    const filterName = m ? m.name : DASH_FILTER.machineId;
    spData = spData.filter(s => s.machineName === filterName || s.machine === DASH_FILTER.machineId);
  }
  spData = filterSpByMonthYear(spData);
  const spAktif    = spData.filter(s => s.status === 'good').length;
  const spWarning  = spData.filter(s => s.status === 'warning').length;
  const spCritical = spData.filter(s => s.status === 'critical').length;
  const spTotal    = spData.length;

  const spSegs = [
    { label: 'Aktif (Baik)',        value: spAktif,    color: '#6BCB77' },
    { label: 'Akan Overtime',       value: spWarning,  color: '#FFD93D' },
    { label: 'Overtime (Kritis)',   value: spCritical, color: '#FF6B6B' },
  ];
  drawPieChart('pie-sparepart', spSegs, 'sparepart');
  renderPieLegend('pie-sparepart-legend', spSegs, spTotal);

  // ── Pie 2: Jenis Kerusakan (dari BD live data) ──
  const jkCounts = countJenisKerusakan(activeBDData);
  const jkEntries = Object.entries(jkCounts).sort((a, b) => b[1] - a[1]);
  // Tampilkan max 8 kategori, sisanya jadi "Lainnya"
  const MAX_JK = 8;
  let jkSegs = [];
  let jkOther = 0;
  jkEntries.forEach(([label, value], i) => {
    if (i < MAX_JK) {
      jkSegs.push({ label, value, color: PIE_PALETTE[i % PIE_PALETTE.length] });
    } else {
      jkOther += value;
    }
  });
  if (jkOther > 0) jkSegs.push({ label: 'Lainnya', value: jkOther, color: '#8B8FA8' });
  const jkTotal = jkSegs.reduce((s, x) => s + x.value, 0);
  drawPieChart('pie-failure', jkSegs, 'laporan');
  renderPieLegend('pie-failure-legend', jkSegs, jkTotal);

  // ── Pie 3: Tindakan Perbaikan ──
  const tindakanColors = {
    'Pergantian Sparepart': '#4361EE',
    'Perbaikan':            '#6BCB77',
    'Pengecekan':           '#FFD93D',
    'Kalibrasi':            '#C77DFF',
  };
  const tindakanCounts = countTindakan(activeBDData);
  const tindakanSegs = Object.entries(tindakanCounts).map(([label, value]) => ({
    label,
    value,
    color: tindakanColors[label] || '#8B8FA8',
  }));
  const tindakanTotal = tindakanSegs.reduce((s, x) => s + x.value, 0);
  drawPieChart('pie-action', tindakanSegs, 'tindakan');
  renderPieLegend('pie-action-legend', tindakanSegs, tindakanTotal);

  // ── Pie 4: Breakdown per Mesin (hanya saat "Semua Mesin") ──
  const bdMachineCard = document.getElementById('pie-bd-machine-card');
  const pieRow        = document.querySelector('.dash-pie-row');
  const activeMachine = document.getElementById('dash-machine-select')?.value || '';

  if (bdMachineCard && pieRow) {
    if (activeMachine === '') {
      const machineCounts = {};
      activeBDData.forEach(row => {
        const nama = (row['Nama Mesin'] || '').trim();
        if (!nama) return;
        machineCounts[nama] = (machineCounts[nama] || 0) + 1;
      });
      const bdMachineEntries = Object.entries(machineCounts).sort((a, b) => b[1] - a[1]);
      const MAX_BD = 8;
      let bdMachineSegs = [];
      let bdMachineOther = 0;
      bdMachineEntries.forEach(([label, value], i) => {
        if (i < MAX_BD) {
          bdMachineSegs.push({ label, value, color: PIE_PALETTE[i % PIE_PALETTE.length] });
        } else {
          bdMachineOther += value;
        }
      });
      if (bdMachineOther > 0) bdMachineSegs.push({ label: 'Lainnya', value: bdMachineOther, color: '#8B8FA8' });
      const bdMachineTotal = bdMachineSegs.reduce((s, x) => s + x.value, 0);

      bdMachineCard.classList.remove('hidden');
      pieRow.classList.add('dash-pie-row--4col');
      drawPieChart('pie-bd-machine', bdMachineSegs, 'breakdown');
      renderPieLegend('pie-bd-machine-legend', bdMachineSegs, bdMachineTotal);
    } else {
      bdMachineCard.classList.add('hidden');
      pieRow.classList.remove('dash-pie-row--4col');
    }
  }
}

window.addEventListener('resize', () => {
  requestAnimationFrame(() => {
    drawBreakdownChart();
    drawDashboardPieCharts();
  });
});

/* ══════════════════════════════════════════════════════════
   9. MACHINE HISTORY VIEW
   ══════════════════════════════════════════════════════════ */

/* Menyimpan data history yang sudah di-load dari server (bukan dummy) */
let _liveHistoryData = [];

function initMachineHistory() {
  initSearchableSelect('hist-machine-wrap',
    [{ value: '', label: 'Semua Mesin' }, ...MACHINES.map(m => ({ value: m.id, label: m.name }))],
    'Semua Mesin'
  );

  // Tampilkan loading state dulu
  const container = document.getElementById('history-timeline');
  container.innerHTML = '<p style="color:var(--text-2);padding:32px;text-align:center">Memuat data riwayat…</p>';

  const searchInput = document.getElementById('hist-search-input');
  const clearBtn    = document.getElementById('hist-search-clear');
  const resetBtn    = document.getElementById('hist-reset-btn');
  const countBadge  = document.getElementById('hist-result-count');

  /* ── Tampilkan / sembunyikan tombol ×  ── */
  searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? 'block' : 'none';
  });

  /* ── Tombol × kosongkan search ── */
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchInput.focus();
  });

  /* ── Enter di search langsung trigger filter ── */
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyHistFilter();
  });

  /* ── Tombol Cari ── */
  document.getElementById('hist-filter-btn').addEventListener('click', applyHistFilter);

  /* ── Tombol Reset ── */
  resetBtn.addEventListener('click', () => {
    document.getElementById('hist-machine-select').value = '';
    const display = document.getElementById('hist-machine-display');
    if (display) { display.textContent = 'Semua Mesin'; display.classList.add('ss-placeholder'); }
    document.getElementById('hist-date-from').value  = '';
    document.getElementById('hist-date-to').value    = '';
    document.getElementById('hist-type-filter').value = '';
    searchInput.value = '';
    clearBtn.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
    renderTimeline(_liveHistoryData);
  });

  function applyHistFilter() {
    const mf     = document.getElementById('hist-machine-select').value;
    const from   = document.getElementById('hist-date-from').value;
    const to     = document.getElementById('hist-date-to').value;
    const type   = document.getElementById('hist-type-filter').value;
    const query  = (searchInput ? searchInput.value.trim().toLowerCase() : '');

    let data = [..._liveHistoryData];

    if (mf)   data = data.filter(d => d.machine === mf);
    if (type) data = data.filter(d => d.type === type);
    if (from) data = data.filter(d => d._rawDate && d._rawDate >= new Date(from));
    if (to) {
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      data = data.filter(d => d._rawDate && d._rawDate <= toEnd);
    }

    /* ── Full-text search di semua field teks ── */
    if (query) {
      data = data.filter(d => {
        const fields = [
          d.machine, d.date, d.desc,
          d.technician, d.nomorWR, d.keterangan,
          d.downtime, d.status,
          d.jenisKerusakan, d.deskripsiTindakan,
          d.waktuMulai, d.waktuSelesai,
          (d.prosedurList || []).join(' '),
        ];
        return fields.some(f => f && String(f).toLowerCase().includes(query));
      });
    }

    /* ── Tampilkan jumlah hasil ── */
    if (countBadge) {
      countBadge.textContent = data.length + ' hasil';
      countBadge.style.display = 'inline-flex';
    }

    renderTimeline(data);
  }
}

function renderTimeline(data) {
  const container = document.getElementById('history-timeline');
  if (!data.length) {
    container.innerHTML = `
      <div style="color:var(--text-2);padding:40px 24px;text-align:center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--text-3);margin-bottom:12px"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p style="margin:0;font-size:.88rem">Belum ada data riwayat.<br>
        ${!CONFIG.GAS_URL ? '<span style="font-size:.78rem;color:var(--text-3)">Konfigurasi GAS URL untuk menampilkan data nyata.</span>' : '<span style="font-size:.78rem;color:var(--text-3)">Data akan muncul setelah teknisi menginput laporan.</span>'}</p>
      </div>`;
    return;
  }
  const icons = {
    breakdown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    pm:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    sparepart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  };
  const machineLabel = d => d.machine || '—';

  const statusBadge = status => {
    if (!status) return '';
    const cls = status.toLowerCase() === 'selesai' ? 'badge-green' : 'badge-yellow';
    return `<span class="badge ${cls}" style="font-size:.72rem;padding:2px 8px">${status}</span>`;
  };

  const renderDetail = d => {
    if (d.type === 'breakdown' && d.deskripsiTindakan) {
      const bdItems = String(d.deskripsiTindakan).split('|').map(s => s.trim()).filter(Boolean);
      const bdItemsHtml = bdItems.map((item, i) =>
        `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border-1)">
           <span style="font-size:.75rem;font-weight:700;color:var(--danger);min-width:18px;flex-shrink:0;padding-top:1px">${i + 1}.</span>
           <span style="font-size:.84rem;color:var(--text-1);line-height:1.55">${item}</span>
         </div>`
      ).join('');
      return `<div style="margin-top:8px;padding:10px 12px;background:var(--bg-2);border-radius:8px;border-left:3px solid var(--danger)">
        <div style="font-size:.72rem;font-weight:600;color:var(--text-2);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Deskripsi Tindakan</div>
        ${bdItemsHtml}
      </div>`;
    }
    if (d.type === 'pm' && d.prosedurList && d.prosedurList.length) {
      const items = d.prosedurList.map((p, i) =>
        `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border-1)">
           <span style="font-size:.75rem;font-weight:700;color:var(--accent);min-width:18px;flex-shrink:0;padding-top:1px">${i + 1}.</span>
           <span style="font-size:.84rem;color:var(--text-1);line-height:1.55">${p}</span>
         </div>`
      ).join('');
      return `<div style="margin-top:8px;padding:10px 12px;background:var(--bg-2);border-radius:8px;border-left:3px solid var(--success, #22c55e)">
        <div style="font-size:.72rem;font-weight:600;color:var(--text-2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Hasil Prosedur (${d.prosedurList.length})</div>
        ${items}
      </div>`;
    }
    return '';
  };

  container.innerHTML = data.map(d => `
    <div class="tl-entry">
      <div class="tl-dot ${d.type}">${icons[d.type] || icons.breakdown}</div>
      <div class="tl-body">
        <div class="tl-header">
          <span class="tl-machine">${machineLabel(d)}</span>
          <span class="tl-time">${d.date}</span>
        </div>
        <p class="tl-desc">${d.desc || '—'}</p>
        ${renderDetail(d)}
        <div class="tl-meta" style="margin-top:8px">
          ${d.technician   ? `<span class="tl-tag">👷 ${d.technician}</span>` : ''}
          ${d.nomorWR      ? `<span class="tl-tag">📋 WR: ${d.nomorWR}</span>` : ''}
          ${d.keterangan   ? `<span class="tl-tag">🏷 ${d.keterangan}</span>` : ''}
          ${d.downtime     ? `<span class="tl-tag">⏱ Downtime: ${d.downtime}</span>` : ''}
          ${d.waktuMulai   ? `<span class="tl-tag">🕐 Mulai: ${d.waktuMulai}</span>` : ''}
          ${d.waktuSelesai ? `<span class="tl-tag">🕑 Selesai: ${d.waktuSelesai}</span>` : ''}
          ${d.status       ? statusBadge(d.status) : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════
   10. PM SCHEDULE VIEW
   ══════════════════════════════════════════════════════════ */

let pmSchedules = [...PM_SCHEDULES];
let calYear, calMonth;
let _jadwalPMInterval = null;  // interval auto-refresh Tabel Jadwal

function initPMSchedule() {
  renderPMTable();
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();

  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  document.getElementById('add-pm-btn').addEventListener('click', openPMModal);

  // Tombol refresh manual Tabel Jadwal
  document.getElementById('refresh-jadwal-btn').addEventListener('click', async () => {
    const icon = document.getElementById('refresh-jadwal-icon');
    icon.style.transition = 'transform .6s ease';
    icon.style.transform  = 'rotate(360deg)';
    setTimeout(() => { icon.style.transition = 'none'; icon.style.transform = 'rotate(0deg)'; }, 650);
    await loadJadwalPMFromGAS();
  });
  document.getElementById('pm-modal-close').addEventListener('click', closePMModal);
  document.getElementById('pm-modal-cancel').addEventListener('click', closePMModal);
  document.getElementById('pm-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('pm-modal-overlay')) closePMModal();
  });
  document.getElementById('pm-modal-save').addEventListener('click', savePMSchedule);

  initSearchableSelect('modal-machine-wrap', MACHINES.map(m => ({ value: m.id, label: m.name })), '-- Pilih Mesin --');

  // When machine or type changes, refresh prosedur options
  document.getElementById('modal-machine').addEventListener('change', refreshModalProsedurOptions);
  document.getElementById('modal-type').addEventListener('change', refreshModalProsedurOptions);

  // Init Prosedur PM
  initProsedurPM();

  // Load jadwal dari GAS
  loadJadwalPMFromGAS();

  // Auto-refresh Tabel Jadwal setiap 30 detik
  if (_jadwalPMInterval) clearInterval(_jadwalPMInterval);
  _jadwalPMInterval = setInterval(() => {
    loadJadwalPMFromGAS();
  }, 30000);
}

/* ═══════════════════════════════════════════════════════════
   PROSEDUR PM  — Create · View · Edit · Update
   Arsitektur: server-first. Semua data selalu dibaca
   langsung dari server, tanpa caching lokal.
   ═══════════════════════════════════════════════════════════ */
let _prosedurItems   = [];   // buffer isian form baru
let _prosedurGroups  = [];   // data yang sedang ditampilkan (dari GAS)
let _editItems       = [];   // buffer edit di modal
let _editMode        = false;
let _currentGroupIdx = -1;

function initProsedurPM() {
  initSearchableSelect(
    'prosedur-machine-wrap',
    MACHINES.map(m => ({ value: m.id, label: m.name })),
    '-- Pilih Mesin --'
  );
  document.getElementById('prosedur-add-btn').addEventListener('click', addProsedurItem);
  document.getElementById('prosedur-save-btn').addEventListener('click', saveProsedurPM);
  document.getElementById('prosedur-refresh-btn').addEventListener('click', () => loadProsedurFromGAS(true));

  document.getElementById('prosedur-detail-close').addEventListener('click', closeProsedurDetail);
  document.getElementById('prosedur-detail-cancel').addEventListener('click', closeProsedurDetail);
  document.getElementById('prosedur-detail-save').addEventListener('click', saveEditedProsedur);

  // Load dari GAS saat init
  loadProsedurFromGAS(false);
}

/* ─────────────────────────────────────────────
   FORM: tambah prosedur baru
───────────────────────────────────────────── */
function addProsedurItem() {
  _prosedurItems.push('');
  renderProsedurList();
  const inputs = document.querySelectorAll('#prosedur-list-container .prosedur-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function renderProsedurList() {
  const container = document.getElementById('prosedur-list-container');
  const badge     = document.getElementById('prosedur-count-badge');
  badge.textContent = _prosedurItems.length + ' prosedur';

  if (_prosedurItems.length === 0) {
    container.innerHTML = `
      <div class="prosedur-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;color:var(--text-3)"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <p>Belum ada prosedur. Klik <strong>"Tambah Prosedur"</strong> untuk mulai menambahkan.</p>
      </div>`;
    return;
  }

  // Sinkronkan nilai textarea sebelum re-render
  container.querySelectorAll('.prosedur-input').forEach((inp, i) => {
    if (_prosedurItems[i] !== undefined) _prosedurItems[i] = inp.value;
  });

  container.innerHTML = _prosedurItems.map((val, i) => `
    <div class="prosedur-item" id="prosedur-item-${i}">
      <div class="prosedur-num">${i + 1}</div>
      <textarea class="prosedur-input" placeholder="Tuliskan prosedur ke-${i + 1}…" rows="1" data-idx="${i}"
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';_prosedurItems[${i}]=this.value;"
      >${val}</textarea>
      <button class="prosedur-delete-btn" onclick="deleteProsedurItem(${i})" title="Hapus">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');

  container.querySelectorAll('.prosedur-input').forEach(ta => {
    ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
  });
}

window.deleteProsedurItem = function(idx) {
  // Sinkronkan dulu sebelum splice
  document.querySelectorAll('#prosedur-list-container .prosedur-input').forEach((inp, i) => {
    if (_prosedurItems[i] !== undefined) _prosedurItems[i] = inp.value;
  });
  _prosedurItems.splice(idx, 1);
  renderProsedurList();
};

/* ─────────────────────────────────────────────
   SIMPAN PROSEDUR BARU
   Langkah:
   1. Validasi
   2. Update _prosedurGroups lokal SEGERA → UI update
   3. Kirim ke GAS di background (fire-and-remember)
───────────────────────────────────────────── */
async function saveProsedurPM() {
  // Sinkronkan nilai textarea terkini
  document.querySelectorAll('#prosedur-list-container .prosedur-input').forEach((inp, i) => {
    if (_prosedurItems[i] !== undefined) _prosedurItems[i] = inp.value.trim();
  });

  const machine = document.getElementById('prosedur-machine-input').value;
  const tipe    = document.getElementById('prosedur-tipe-input').value;
  const judul   = document.getElementById('prosedur-judul-input').value.trim();
  const items   = _prosedurItems.map(v => v.trim()).filter(v => v !== '');

  if (!machine) { showToast('Pilih mesin terlebih dahulu', 'error'); return; }
  if (!tipe)    { showToast('Pilih tipe perawatan terlebih dahulu', 'error'); return; }
  if (!judul)   { showToast('Isi judul prosedur PM terlebih dahulu', 'error'); return; }
  if (items.length === 0) { showToast('Tambahkan minimal 1 prosedur', 'error'); return; }

  const machineName = MACHINES.find(m => m.id === machine)?.name || machine;
  const timestamp   = new Date().toISOString();
  const saveBtn     = document.getElementById('prosedur-save-btn');
  saveBtn.disabled  = true;
  saveBtn.innerHTML = `<span class="btn-loader"></span> Menyimpan…`;

  try {
    // Hapus baris lama (jika ada) lalu tulis ulang
    await gasPostRaw({ sheet: 'ProsedurPM', action: 'deleteProsedur', machineName, tipe, judul });
    // Setiap baris: [Timestamp, Nama Mesin, Tipe Perawatan, Judul Prosedur PM, Prosedur PM, Urutan PM]
    for (let i = 0; i < items.length; i++) {
      await gasPost('ProsedurPM', [timestamp, machineName, tipe, judul, items[i], i + 1]);
    }
    console.log(`✓ ProsedurPM saved: ${tipe} — ${machineName} (${items.length} items)`);
    showToast(`${items.length} prosedur "${tipe} — ${machineName}" berhasil disimpan ✓`, 'success');

    // Reset form
    _prosedurItems = [];
    renderProsedurList();
    document.getElementById('prosedur-machine-input').value = '';
    document.getElementById('prosedur-machine-display').textContent = '-- Pilih Mesin --';
    document.getElementById('prosedur-machine-display').classList.add('ss-placeholder');
    document.getElementById('prosedur-tipe-input').value = '';
    document.getElementById('prosedur-judul-input').value = '';

    // Reload daftar tersimpan
    await loadProsedurFromGAS(false);
  } catch (err) {
    showToast('Gagal menyimpan: ' + err.message, 'error');
  } finally {
    saveBtn.disabled  = false;
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan Prosedur`;
  }
}

/* ─────────────────────────────────────────────
   LOAD DARI GAS — baca langsung dari server,
   tidak menggunakan cache atau data lokal.
───────────────────────────────────────────── */
async function loadProsedurFromGAS(showLoading) {
  const listEl = document.getElementById('prosedur-saved-list');
  if (!listEl) return;

  if (showLoading) {
    listEl.innerHTML = `
      <div class="prosedur-saved-loading">
        <span class="btn-loader" style="width:20px;height:20px;border-width:2px"></span>
        <span>Memuat data…</span>
      </div>`;
  }

  // Gunakan shared helper agar _prosedurGroups selalu ter-update konsisten
  await _fetchProsedurFromGAS();
  renderProsedurGroups();

  // Refresh modal prosedur options if modal is open
  if (document.getElementById('modal-prosedur-wrap')) {
    refreshModalProsedurOptions && refreshModalProsedurOptions();
  }
}

/* ─────────────────────────────────────────────
   RENDER KARTU DAFTAR TERSIMPAN
───────────────────────────────────────────── */
function renderProsedurGroups() {
  const listEl = document.getElementById('prosedur-saved-list');
  if (!listEl) return;

  if (_prosedurGroups.length === 0) {
    listEl.innerHTML = `
      <div class="prosedur-saved-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;color:var(--text-3)"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <span>Belum ada prosedur tersimpan</span>
        ${!CONFIG.GAS_URL ? '<span style="font-size:.75rem;color:var(--text-3);margin-top:4px">Konfigurasi GAS URL untuk menampilkan data</span>' : ''}
      </div>`;
    return;
  }

  listEl.innerHTML = _prosedurGroups.map((g, idx) => {
    const badgeClass = g.tipe.includes('3') ? 'prosedur-badge-3bln' : 'prosedur-badge-6bln';
    const dateStr    = g.timestamp
      ? new Date(g.timestamp).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
      : '';
    return `
      <div class="prosedur-group-card" onclick="openProsedurDetail(${idx})">
        <div class="prosedur-group-header">
          <div class="prosedur-group-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <div class="prosedur-group-info">
            <div class="prosedur-group-name">${g.judul || (g.tipe + ' — ' + g.machineName)}</div>
            <div class="prosedur-group-meta">
              <span class="prosedur-group-badge ${badgeClass}">${g.tipe}</span>
              <span class="prosedur-group-count">${g.machineName}</span>
              <span class="prosedur-group-count">· ${g.items.length} prosedur</span>
              ${dateStr ? `<span class="prosedur-group-count">· ${dateStr}</span>` : ''}
            </div>
          </div>
          <div class="prosedur-group-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   MODAL DETAIL & EDIT
───────────────────────────────────────────── */
window.openProsedurDetail = function(idx) {
  const group = _prosedurGroups[idx];
  if (!group) return;
  _editItems       = group.items.map(it => ({ ...it }));
  _editMode        = false;
  _currentGroupIdx = idx;

  document.getElementById('prosedur-detail-title').textContent = group.judul || `${group.tipe} — ${group.machineName}`;
  renderDetailModal(group);
  showPage('page-prosedur-detail');
};

function renderDetailModal(group) {
  const body      = document.getElementById('prosedur-detail-body');
  const saveBtn   = document.getElementById('prosedur-detail-save');
  const cancelBtn = document.getElementById('prosedur-detail-cancel');

  if (_editMode) {
    saveBtn.classList.remove('hidden');
    cancelBtn.textContent = 'Batal';
  } else {
    saveBtn.classList.add('hidden');
    cancelBtn.textContent = 'Tutup';
  }

  const badgeClass = group.tipe.includes('3') ? 'prosedur-badge-3bln' : 'prosedur-badge-6bln';
  const dateStr    = group.timestamp
    ? new Date(group.timestamp).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })
    : '';

  const modeBar = `
    <div class="prosedur-mode-bar">
      <button class="prosedur-mode-btn ${!_editMode ? 'active' : ''}" onclick="_setDetailMode(false)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Lihat
      </button>
      <button class="prosedur-mode-btn ${_editMode ? 'active' : ''}" onclick="_setDetailMode(true)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit Prosedur
      </button>
    </div>`;

  const infoBar = `
    <div class="prosedur-detail-info-bar">
      ${group.judul ? `<div style="font-size:.9rem;font-weight:600;color:var(--text-1);margin-bottom:6px">${group.judul}</div>` : ''}
      ${dateStr ? `<span class="prosedur-detail-info-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${dateStr}</span>` : ''}
      <span class="prosedur-detail-info-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>${group.machineName}</span>
      <span class="prosedur-detail-info-item ${badgeClass}" style="border:none">${group.tipe}</span>
    </div>`;

  let listHTML = '';
  if (_editMode) {
    listHTML = `
      <div id="prosedur-edit-list">
        ${_editItems.map((it, i) => `
          <div class="prosedur-item" id="pedit-item-${i}">
            <div class="prosedur-num">${i + 1}</div>
            <textarea class="prosedur-input" placeholder="Prosedur ke-${i + 1}…" rows="1" data-idx="${i}"
              oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';_editItems[${i}].prosedur=this.value;"
            >${it.prosedur}</textarea>
            <button class="prosedur-delete-btn" onclick="deleteEditItem(${i})" title="Hapus">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>`).join('')}
      </div>
      <div class="prosedur-detail-add-row">
        <button class="btn btn-ghost prosedur-add-btn" onclick="addEditItem()" type="button" style="font-size:.82rem;padding:6px 14px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Tambah Prosedur
        </button>
      </div>`;
  } else {
    listHTML = `
      <div class="prosedur-detail-list">
        ${group.items.length === 0
          ? '<div class="prosedur-saved-empty" style="padding:20px"><span>Tidak ada prosedur</span></div>'
          : group.items.map(it => `
            <div class="prosedur-detail-item-view">
              <div class="prosedur-num" style="flex-shrink:0">${it.no}</div>
              <div style="flex:1;font-size:.88rem;color:var(--text-1);line-height:1.55;padding-top:3px">${it.prosedur}</div>
            </div>`).join('')}
      </div>`;
  }

  body.innerHTML = `<div class="prosedur-detail-inner">${modeBar + infoBar + listHTML}</div>`;

  if (_editMode) {
    body.querySelectorAll('.prosedur-input').forEach(ta => {
      ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
    });
  }
}

window._setDetailMode = function(editMode) {
  _editMode = editMode;
  if (editMode) {
    // Reset buffer ke data grup saat ini
    _editItems = _prosedurGroups[_currentGroupIdx].items.map(it => ({ ...it }));
  }
  renderDetailModal(_prosedurGroups[_currentGroupIdx]);
};

window.addEditItem = function() {
  // Sinkronkan dulu
  document.querySelectorAll('#prosedur-edit-list .prosedur-input').forEach((inp, i) => {
    if (_editItems[i]) _editItems[i].prosedur = inp.value;
  });
  _editItems.push({ no: _editItems.length + 1, prosedur: '' });
  renderDetailModal(_prosedurGroups[_currentGroupIdx]);
  const inputs = document.querySelectorAll('#prosedur-edit-list .prosedur-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
};

window.deleteEditItem = function(idx) {
  // Sinkronkan sebelum hapus
  document.querySelectorAll('#prosedur-edit-list .prosedur-input').forEach((inp, i) => {
    if (_editItems[i]) _editItems[i].prosedur = inp.value;
  });
  _editItems.splice(idx, 1);
  _editItems.forEach((it, i) => { it.no = i + 1; });
  renderDetailModal(_prosedurGroups[_currentGroupIdx]);
};

/* ─────────────────────────────────────────────
   SIMPAN HASIL EDIT
   Langkah:
   1. Validasi
   2. Update lokal SEGERA → UI update + modal tutup
   3. Sync ke GAS background: hapus semua lama → insert ulang
───────────────────────────────────────────── */
async function saveEditedProsedur() {
  // Sinkronkan nilai textarea terkini
  document.querySelectorAll('#prosedur-edit-list .prosedur-input').forEach((inp, i) => {
    if (_editItems[i]) _editItems[i].prosedur = inp.value.trim();
  });

  const validItems = _editItems.filter(it => it.prosedur.trim() !== '');
  if (validItems.length === 0) { showToast('Minimal 1 prosedur harus diisi', 'error'); return; }

  const group   = _prosedurGroups[_currentGroupIdx];
  const saveBtn = document.getElementById('prosedur-detail-save');
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="btn-loader"></span> Menyimpan…`;

  try {
    // Hapus semua baris lama lalu tulis ulang
    await gasPostRaw({ sheet: 'ProsedurPM', action: 'deleteProsedur',
      machineName: group.machineName, tipe: group.tipe, judul: group.judul });

    const timestamp = new Date().toISOString();
    for (let i = 0; i < validItems.length; i++) {
      await gasPost('ProsedurPM', [timestamp, group.machineName, group.tipe, group.judul, validItems[i].prosedur, i + 1]);
    }

    showToast(`Prosedur "${group.tipe} — ${group.machineName}" berhasil diperbarui ✓`, 'success');

    // Tutup modal lalu reload daftar
    _editMode = false;
    closeProsedurDetail();
    await loadProsedurFromGAS(false);
  } catch (err) {
    showToast('Gagal memperbarui: ' + err.message, 'error');
  } finally {
    saveBtn.disabled  = false;
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan Perubahan`;
  }
}

/* ─────────────────────────────────────────────
   HELPER: gasPost dengan raw payload (untuk action)
───────────────────────────────────────────── */
async function gasPostRaw(payload) {
  const url = CONFIG.GAS_URL;
  if (!url) return { status: 'mock' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json().catch(() => ({ status: 'ok' }));
  } catch {
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return { status: 'ok' };
    } catch (e) { return { status: 'error', message: e.message }; }
  }
}

function closeProsedurDetail() {
  _editMode        = false;
  _currentGroupIdx = -1;
  showPage('page-supervisor');
  // Restore pm-schedule view
  requestAnimationFrame(() => activateSupervisorView('pm-schedule'));
}

/* Format tanggal jadwal PM: semua format → "04 Jun 2026" */
function formatScheduleDate(raw) {
  if (!raw) return '—';
  const normalized = normalizeDateToYYYYMMDD(raw);
  if (!normalized) return String(raw);
  const d = toLocalMidnight(normalized);
  if (!d || isNaN(d)) return normalized;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderPMTable() {
  const machineName = id => MACHINES.find(m => m.id === id)?.name || id;
  // Tampilkan jadwal dengan status "Menunggu" (Pending), "Selesai" (Done), atau "Terlambat" (Overdue)
  const visible = pmSchedules.filter(s => s.status === 'Pending' || s.status === 'Done' || s.status === 'Overdue');
  const tbody = document.getElementById('pm-tbody');
  if (visible.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:1.5rem;font-size:.88rem">Belum ada data jadwal</td></tr>`;
    return;
  }
  tbody.innerHTML = visible.map(s => {
    const badgeClass = s.status === 'Done' ? 'badge-green' : s.status === 'Overdue' ? 'badge-red' : 'badge-yellow';
    const badgeLabel = s.status === 'Done' ? 'Selesai' : s.status === 'Overdue' ? 'Terlambat' : 'Menunggu';
    return `
    <tr>
      <td>${machineName(s.machine)}</td>
      <td>${s.type}</td>
      <td style="font-size:.82rem">${formatScheduleDate(s.date)}</td>
      <td>${s.prosedur ? `<span class="badge badge-blue" title="${s.prosedur}">${s.prosedur.length > 30 ? s.prosedur.substring(0,28)+'…' : s.prosedur}</span>` : '<span style="color:var(--text-3);font-size:.82rem">—</span>'}</td>
      <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
    </tr>`;
  }).join('');
}

function renderCalendar() {
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  document.getElementById('cal-month-label').textContent = `${monthNames[calMonth]} ${calYear}`;
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d => {
    grid.insertAdjacentHTML('beforeend', `<div class="cal-header-cell">${d}</div>`);
  });

  const firstDay  = new Date(calYear, calMonth, 1).getDay();
  const daysTotal = new Date(calYear, calMonth + 1, 0).getDate();
  const today     = new Date();

  // Build map: day → array of events
  const pmDatesMap = pmSchedules.reduce((acc, s) => {
    const d = toLocalMidnight(normalizeDateToYYYYMMDD(s.date));
    if (d && d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const day = d.getDate();
      if (!acc[day]) acc[day] = [];
      acc[day].push(s);
    }
    return acc;
  }, {});

  for (let i = 0; i < firstDay; i++) {
    grid.insertAdjacentHTML('beforeend', '<div class="cal-cell other-month"></div>');
  }
  for (let day = 1; day <= daysTotal; day++) {
    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const events  = pmDatesMap[day] || [];
    const hasEvents = events.length > 0;
    const hasOverdue = events.some(e => e.status === 'Overdue');
    const hasDone    = events.every(e => e.status === 'Done') && events.length > 0;

    let cellClass = 'cal-cell';
    if (isToday) cellClass += ' today';
    if (hasEvents && !isToday) {
      if (hasOverdue) cellClass += ' overdue';
      else if (hasDone) cellClass += ' has-event done';
      else cellClass += ' has-event';
    }

    // Build event chips (max 3 shown)
    let chipsHTML = '';
    if (hasEvents) {
      const shown = events.slice(0, 3);
      chipsHTML = `<div class="cal-event-chips">` + shown.map(ev => {
        const mName = MACHINES.find(m => m.id === ev.machine)?.name || ev.machine;
        const chipClass = ev.status === 'Done' ? 'cal-chip-done' : ev.status === 'Overdue' ? 'cal-chip-overdue' : 'cal-chip-pending';
        return `<div class="cal-chip ${chipClass}" title="${mName} — ${ev.type}">${mName.length > 10 ? mName.substring(0,9)+'…' : mName}</div>`;
      }).join('') + (events.length > 3 ? `<div class="cal-chip cal-chip-more">+${events.length - 3}</div>` : '') + `</div>`;
    }

    grid.insertAdjacentHTML('beforeend',
      `<div class="${cellClass}"><span class="cal-day-num">${day}</span>${chipsHTML}</div>`
    );
  }
}

function openPMModal() {
  const overlay = document.getElementById('pm-modal-overlay');
  overlay.classList.remove('hidden', 'hiding');
  // Gunakan tanggal lokal (bukan UTC) untuk default value
  document.getElementById('modal-date').value = new Date().toLocaleDateString('en-CA');
  // Reset prosedur dropdown
  document.getElementById('modal-prosedur').value = '';
  document.getElementById('modal-prosedur-display').textContent = '-- Pilih Paket Prosedur --';
  document.getElementById('modal-prosedur-display').classList.add('ss-placeholder');
  document.getElementById('modal-prosedur-preview').classList.add('hidden');
  document.getElementById('modal-prosedur-preview').innerHTML = '';
  // Pre-populate prosedur options based on current machine/type
  refreshModalProsedurOptions();
}
function closePMModal() {
  const overlay = document.getElementById('pm-modal-overlay');
  overlay.classList.add('hiding');
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('hiding');
  }, 280);
}

/* Refresh prosedur options in modal based on selected machine + type */
function refreshModalProsedurOptions() {
  const machine = document.getElementById('modal-machine').value;
  const type    = document.getElementById('modal-type').value;
  const machineName = machine ? (MACHINES.find(m => m.id === machine)?.name || machine) : null;

  // Filter _prosedurGroups for matching machine+type
  let options = [];
  if (_prosedurGroups.length > 0) {
    options = _prosedurGroups.filter(g => {
      const machMatch = !machineName || g.machineName === machineName;
      const typeMatch = !type || g.tipe === type;
      return machMatch && typeMatch;
    }).map(g => ({
      value: g.machineName + '||' + g.tipe,
      label: g.judul || (g.tipe + ' — ' + g.machineName)
    }));
  }

  // Rebuild prosedur searchable select
  initSearchableSelect(
    'modal-prosedur-wrap',
    options,
    '-- Pilih Paket Prosedur --'
  );

  // Reset preview
  document.getElementById('modal-prosedur-preview').classList.add('hidden');
  document.getElementById('modal-prosedur-preview').innerHTML = '';
  document.getElementById('modal-prosedur').value = '';
  document.getElementById('modal-prosedur-display').classList.add('ss-placeholder');

  // Listen for prosedur selection to show preview
  const hiddenInput = document.getElementById('modal-prosedur');
  const observer = new MutationObserver(() => updateProsedurPreview());
  observer.observe(hiddenInput, { attributes: true, attributeFilter: ['value'] });
  hiddenInput.addEventListener('change', updateProsedurPreview);
}

function updateProsedurPreview() {
  const val = document.getElementById('modal-prosedur').value;
  const previewEl = document.getElementById('modal-prosedur-preview');
  if (!val) { previewEl.classList.add('hidden'); previewEl.innerHTML = ''; return; }

  const group = _prosedurGroups.find(g => (g.machineName + '||' + g.tipe) === val);
  if (!group || !group.items.length) { previewEl.classList.add('hidden'); return; }

  previewEl.classList.remove('hidden');
  previewEl.innerHTML = `
    <div class="modal-prosedur-preview-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      ${group.items.length} prosedur
    </div>
    <ol class="modal-prosedur-ol">
      ${group.items.map(it => `<li>${it.prosedur}</li>`).join('')}
    </ol>`;
}

async function savePMSchedule() {
  const machine   = document.getElementById('modal-machine').value;
  const type      = document.getElementById('modal-type').value;
  const date      = document.getElementById('modal-date').value;
  const prosedurVal = document.getElementById('modal-prosedur').value;
  const prosedurLabel = prosedurVal
    ? (document.getElementById('modal-prosedur-display').textContent || prosedurVal)
    : '';

  if (!machine || !type || !date) {
    showToast('Mohon isi semua field yang diperlukan', 'error');
    return;
  }

  const machineName = MACHINES.find(m => m.id === machine)?.name || machine;
  const timestamp   = new Date().toISOString();

  // Determine status based on date — gunakan toLocalMidnight agar tidak ada timezone issue
  const today = toLocalMidnight(new Date());
  const jadwalDate = toLocalMidnight(date);
  // Simpan dengan status Bahasa Indonesia agar konsisten di sheet
  const status = (jadwalDate && jadwalDate < today) ? 'Overdue' : 'Menunggu';

  const newEntry = { machine, type, date, prosedur: prosedurLabel, status: (jadwalDate && jadwalDate < today) ? 'Overdue' : 'Pending' };
  pmSchedules.push(newEntry);
  renderPMTable(); renderCalendar(); closePMModal();
  showToast('Jadwal PM berhasil ditambahkan', 'success');

  // Save to GAS JadwalPM sheet — kirim tanggal sebagai plain string "yyyy-MM-dd"
  try {
    await gasPost('JadwalPM', [timestamp, machineName, type, date, prosedurLabel, status]);
  } catch(e) {
    console.warn('Gagal simpan JadwalPM ke GAS:', e);
  }
}

/* Load Jadwal PM dari server */
async function loadJadwalPMFromGAS() {
  try {
    if (!CONFIG.GAS_URL) return;
    const res = await fetch(`${CONFIG.GAS_URL}?sheet=JadwalPM`, { method: 'GET', redirect: 'follow' });
    if (!res.ok) return;
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { return; }
    if (!parsed || parsed.status !== 'ok' || !parsed.data) return;

    const today = toLocalMidnight(new Date());

    const rows = parsed.data.map(row => {
      // Normalize dateStr — handle semua format:
      // ISO "2026-06-06T17:00:00.000Z" → "2026-06-06" (WIB-safe: +7 dari UTC)
      // ISO "2026-06-06T00:00:00+07:00" → "2026-06-06"
      // "06/06/2026" (dd/MM/yyyy) → "2026-06-06"
      // "2026-06-06" → tetap
      let dateStr = row['Tanggal Jadwal'] || '';
      dateStr = normalizeDateToYYYYMMDD(dateStr);

      const jadwalDate = dateStr ? toLocalMidnight(dateStr) : null;
      let status = String(row['Status'] || 'Pending').trim();
      // Petakan semua varian status dari sheet ke status internal UI
      if (status.toLowerCase() === 'finish' || status.toLowerCase() === 'selesai') status = 'Done';
      else if (status.toLowerCase() === 'pending' || status.toLowerCase() === 'menunggu') status = 'Pending';
      if (jadwalDate && jadwalDate < today && status === 'Pending') status = 'Overdue';

      // Find machine id from name
      const machineName = row['Nama Mesin'] || '';
      const mObj = MACHINES.find(m => m.name === machineName);
      return {
        machine:   mObj ? mObj.id : machineName,
        type:      row['Tipe Perawatan'] || '',
        date:      dateStr,
        prosedur:  row['Prosedur PM'] || '',
        status
      };
    }).filter(r => r.date);

    pmSchedules = rows;
    renderPMTable();
    renderCalendar();
  } catch (err) {
    console.warn('loadJadwalPMFromGAS error:', err);
  }
}

/* ══════════════════════════════════════════════════════════
   11. SPAREPART MANAGEMENT (SUPERVISOR)
   — Menggunakan data real dari server
   ══════════════════════════════════════════════════════════ */

/* Live store — diisi dari server saat halaman dibuka */
let sparepartStore = [];
let _spFilterMachine = '';
let _spSearchQuery   = '';
let _spSortOrder     = 'status';
let _spCountdownInterval = null;

function initSparepartMgmt() {
  const machineOptions = [
    { value: '', label: 'Semua Mesin' },
    ...MACHINES.map(m => ({ value: m.id, label: m.name }))
  ];

  // Machine select for the form
  initSearchableSelect('sp-machine-wrap', MACHINES.map(m => ({ value: m.id, label: m.name })), '-- Pilih Mesin --');

  // Machine filter for the list
  initSearchableSelect('sp-filter-machine-wrap', machineOptions, 'Semua Mesin', '');
  document.getElementById('sp-filter-machine-input').addEventListener('change', function() {
    _spFilterMachine = this.value;
    renderSparepartMgmtGrid();
  });

  // Search input
  const searchInput = document.getElementById('sp-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      _spSearchQuery = this.value.trim().toLowerCase();
      renderSparepartMgmtGrid();
    });
  }

  // Sort select
  const sortSelect = document.getElementById('sp-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      _spSortOrder = this.value;
      renderSparepartMgmtGrid();
    });
  }

  // Set default date for last replace to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sp-last-replace-input').value = today;

  // Add button
  document.getElementById('sp-add-btn').addEventListener('click', addSparepart);

  // Load data
  loadSparepartFromSheet();
}

/* ── Normalisasi tanggal ke format "yyyy-MM-dd" (lokal WIB-safe) ───────────
   Menerima semua format yang mungkin datang dari GAS / input:
   - ISO UTC  "2026-06-05T17:00:00.000Z"  → dikonversi +7 jam → "2026-06-06" (WIB)
   - ISO lokal "2026-06-06T00:00:00+07:00" → "2026-06-06"
   - Plain "yyyy-MM-dd"  → langsung dikembalikan
   - "dd/MM/yyyy"        → dikonversi ke "yyyy-MM-dd"
   - Date object         → toLocaleDateString('en-CA')
   Mengembalikan string "yyyy-MM-dd" atau "" jika tidak valid.
   ────────────────────────────────────────────────────────────────────────── */
function normalizeDateToYYYYMMDD(input) {
  if (!input) return '';
  // Date object
  if (input instanceof Date) {
    return isNaN(input) ? '' : input.toLocaleDateString('en-CA');
  }
  let s = String(input).trim();
  if (!s) return '';

  // ISO UTC: "2026-06-05T17:00:00.000Z" atau "2026-06-05T17:00:00Z"
  // Konversi ke WIB (+7) sebelum ambil tanggal
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (isNaN(d)) return s.split('T')[0]; // fallback: ambil bagian tanggal saja
    // Gunakan timezone WIB untuk mendapat tanggal yang benar
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  }

  // dd/MM/yyyy → yyyy-MM-dd
  const dmyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

  // Sudah yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return s; // kembalikan apa adanya jika format tidak dikenali
}

/* ── Normalisasi ke tengah malam LOKAL (00:00:00.000) ──────────────────────
   new Date("2026-06-04") diparsing sebagai UTC midnight, bukan lokal midnight.
   Di WIB (+07) itu jadi 07:00 pagi — selisihnya bisa "1 hari" padahal baru jam 8.
   Solusi: paksa kedua tanggal ke local-midnight agar daysDiff murni hari kalender.
   ────────────────────────────────────────────────────────────────────────── */
function toLocalMidnight(dateInput) {
  // Terima string "yyyy-MM-dd", Date, atau ISO string
  let s;
  if (dateInput instanceof Date) {
    s = dateInput.toLocaleDateString('en-CA'); // "yyyy-MM-dd" lokal
  } else {
    s = normalizeDateToYYYYMMDD(dateInput);
  }
  if (!s) return null;

  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  // Buat Date di timezone lokal, jam 00:00:00
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function calcSparepartStatus(lastReplace, lifetimeDays) {
  const lastMidnight = toLocalMidnight(lastReplace);
  if (!lastMidnight || isNaN(lastMidnight)) {
    // Data tanggal tidak valid — kembalikan nilai aman
    return { life: 100, status: 'good', nextReplace: '—', isOverdue: false, daysPassed: 0, sisaHari: lifetimeDays, daysOverdue: 0 };
  }

  // Now juga dinormalisasi ke local midnight agar perbandingan murni hari kalender
  const nowMidnight  = toLocalMidnight(new Date());
  const daysPassed   = Math.round((nowMidnight - lastMidnight) / (1000 * 60 * 60 * 24));

  // Hari ke depan penggantian berikutnya
  const nextDate = new Date(lastMidnight);
  nextDate.setDate(nextDate.getDate() + lifetimeDays);

  // Overdue = hari ini MELEWATI (strictly greater) tanggal penggantian berikutnya.
  // Hari yang sama dengan tanggal nextDate → masih hari-H, belum overdue.
  // daysPassed === lifetimeDays berarti kita TEPAT di hari penggantian → belum overdue.
  // daysPassed > lifetimeDays → baru overdue.
  const isOverdue   = daysPassed > lifetimeDays;
  const daysOverdue = isOverdue ? daysPassed - lifetimeDays : 0;
  const sisaHari    = isOverdue ? 0 : lifetimeDays - daysPassed;

  // Persentase sisa life: 100% saat baru diganti, 0% tepat di hari jadwal penggantian
  // Tidak pernah negatif.
  const life = Math.min(100, Math.max(0,
    Math.round(((lifetimeDays - daysPassed) / lifetimeDays) * 100)
  ));

  // Status: critical = overdue, warning = sisa ≤30%, good = sisanya
  let status;
  if (isOverdue)      status = 'critical';
  else if (life <= 30) status = 'warning';
  else                 status = 'good';

  const nextReplace = isOverdue
    ? 'OVERDUE'
    : nextDate.toLocaleDateString('en-CA'); // "yyyy-MM-dd" lokal, bebas timezone

  return { life, status, nextReplace, isOverdue, daysPassed, sisaHari, daysOverdue };
}

/* ── Load data dari server ── */
async function loadSparepartFromSheet(forceRefresh = false) {
  const grid    = document.getElementById('sp-mgmt-grid');
  const countEl = document.getElementById('sp-mgmt-count');

  if (grid && sparepartStore.length === 0) {
    grid.innerHTML = `
      <div class="sp-mgmt-loading">
        <span class="btn-loader" style="display:inline-block;margin-right:8px"></span>
        Memuat data sparepart…
      </div>`;
    if (countEl) countEl.innerHTML = 'Memuat data…';
  }

  if (!CONFIG.GAS_URL) {
    if (grid) grid.innerHTML = `
      <div class="sp-mgmt-empty">
        <p>GAS URL belum dikonfigurasi. Data tidak dapat dimuat.</p>
      </div>`;
    if (countEl) countEl.innerHTML = '';
    return;
  }

  try {
    const url  = CONFIG.GAS_URL + '?sheet=Sparepart';
    const res  = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const json = JSON.parse(text);

    if (json && json.status === 'ok' && Array.isArray(json.data)) {
      // Map data ke format internal
      sparepartStore = json.data.map(row => {
        const lifetimeDays = parseInt(row['Lifetime (hari)']) || 1;

        // ── Normalisasi tanggal dari berbagai format GAS ke "yyyy-MM-dd" ──
        let rawDate = row['Tanggal Penggantian Terakhir'];
        let lastReplace;

        if (rawDate instanceof Date) {
          // GAS mengirim Date object → ambil bagian tanggal lokal
          lastReplace = rawDate.toLocaleDateString('en-CA');
        } else if (typeof rawDate === 'number') {
          // Google Sheets date serial number (hari sejak 30 Des 1899)
          const epoch = new Date(1899, 11, 30, 0, 0, 0, 0);
          epoch.setDate(epoch.getDate() + rawDate);
          lastReplace = epoch.toLocaleDateString('en-CA');
        } else if (typeof rawDate === 'string' && rawDate) {
          // ISO datetime: "2026-06-02T17:00:00.000Z" → ambil tanggal UTC
          if (/^\d{4}-\d{2}-\d{2}T/.test(rawDate)) {
            lastReplace = rawDate.split('T')[0];
          // dd/MM/yyyy (format id-ID dari GAS)
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
            const [d, m, y] = rawDate.split('/');
            lastReplace = `${y}-${m}-${d}`;
          // Sudah yyyy-MM-dd
          } else {
            lastReplace = rawDate;
          }
        } else {
          lastReplace = '';
        }

        const { life, status, nextReplace, isOverdue, sisaHari, daysOverdue } = calcSparepartStatus(lastReplace, lifetimeDays);
        return {
          id:           row['Nama Sparepart'] + '_' + (row['Nama Mesin'] || ''),
          name:         row['Nama Sparepart'] || '',
          machine:      '',
          machineName:  row['Nama Mesin']     || '',
          lifetimeDays,
          lastReplace,
          life,
          status,
          nextReplace,
          isOverdue,
          sisaHari,
          daysOverdue,
        };
      });

      renderSparepartMgmtGrid();
      // Juga update dashboard lifetime grid dengan data terbaru
      updateDashboardSpFromSheet();
      // Jika teknisi sedang di view Kondisi Sparepart, update tampilannya juga
      const techSpView = document.getElementById('tech-sparepart');
      if (techSpView && techSpView.classList.contains('active')) {
        _techSpAllData = sparepartStore;
        renderTechSparepartList();
      }
    } else {
      throw new Error('Format data tidak valid');
    }
  } catch (err) {
    console.warn('Gagal memuat data sparepart:', err);
    if (grid) grid.innerHTML = `
      <div class="sp-mgmt-empty">
        <p>Gagal memuat data. Periksa koneksi dan URL GAS.</p>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="loadSparepartFromSheet(true)">Coba Lagi</button>
      </div>`;
    if (countEl) countEl.innerHTML = '';
  }
}

/* Update KPI + lifetime grid di Dashboard menggunakan data dari server */
function updateDashboardSpFromSheet() {
  if (!sparepartStore.length) return;

  const machineFilter = DASH_FILTER.machineId || (document.getElementById('dash-machine-select')?.value || '');
  let filtered;
  if (machineFilter) {
    // Cari nama mesin dari ID yang dipilih di filter
    const m = MACHINES.find(m => m.id === machineFilter);
    const filterName = m ? m.name : machineFilter;
    filtered = sparepartStore.filter(s => s.machineName === filterName);
  } else {
    filtered = [...sparepartStore];
  }

  // Terapkan filter bulan/tahun
  filtered = filterSpByMonthYear(filtered);

  const aktif    = filtered.length;
  const overtime = filtered.filter(s => s.status === 'critical').length;
  const warning  = filtered.filter(s => s.status === 'warning').length;

  animateCount(document.querySelectorAll('.kpi-value[data-count]')[0], aktif);
  animateCount(document.querySelectorAll('.kpi-value[data-count]')[1], overtime);
  animateCount(document.querySelectorAll('.kpi-value[data-count]')[2], warning);

  // Render lifetime grid di Dashboard dengan data terbaru
  const mappedForDash = filtered.map(s => ({
    name:        s.name,
    machine:     s.machine,
    life:        s.life,
    status:      s.status,
    nextReplace: s.nextReplace,
  }));
  renderSparepartLifetime(mappedForDash);

  // Redraw pie chart sparepart dengan data terbaru
  requestAnimationFrame(() => drawDashboardPieCharts());
}

/* ── Tambah sparepart baru & simpan ke server ── */
async function addSparepart() {
  const name        = document.getElementById('sp-name-input').value.trim();
  const machine     = document.getElementById('sp-machine-input').value;
  const lifetime    = parseInt(document.getElementById('sp-lifetime-input').value);
  const lastReplace = document.getElementById('sp-last-replace-input').value;

  if (!name || !machine || !lifetime || !lastReplace) {
    showToast('Mohon lengkapi semua field yang diperlukan', 'error');
    return;
  }
  if (lifetime < 1) {
    showToast('Lifetime harus lebih dari 0 hari', 'error');
    return;
  }

  const btn = document.getElementById('sp-add-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-loader"></span> Menyimpan…';

  const { life, status, nextReplace, isOverdue, sisaHari } = calcSparepartStatus(lastReplace, lifetime);
  const machineName = machineNameFromId(machine);

  // Hitung persentase sisa life untuk disimpan
  const sisaLifePct = life;

  /* Row yang dikirim ke GAS (sesuai header sheet Sparepart):
     [Nama Sparepart, Nama Mesin,
      Lifetime (hari), Tanggal Penggantian Terakhir,
      Tanggal Penggantian Berikutnya, Status, Sisa Life (%)]
     Catatan: Timestamp Dibuat di-generate otomatis oleh GAS */
  const row = [
    name,
    machineName,
    lifetime,
    lastReplace,
    nextReplace === 'OVERDUE' ? '' : nextReplace,
    status === 'critical' ? 'Kritis' : status === 'warning' ? 'Perlu Perhatian' : 'Baik',
    sisaLifePct,
  ];

  const result = await gasPost('Sparepart', row);
  const isConnected = CONFIG.GAS_URL && result.status === 'ok';

  // Optimistic update lokal sambil menunggu reload dari sheet
  const newId = name + '_' + machineName;
  sparepartStore.unshift({
    id: newId, name, machine: '', machineName, lifetimeDays: lifetime,
    lastReplace, life, status, nextReplace, isOverdue, sisaHari,
  });

  // Reset form
  document.getElementById('sp-name-input').value = '';
  document.getElementById('sp-machine-input').value = '';
  const disp = document.getElementById('sp-machine-display');
  disp.textContent = '-- Pilih Mesin --';
  disp.classList.add('ss-placeholder');
  document.getElementById('sp-lifetime-input').value = '';
  document.getElementById('sp-last-replace-input').value = new Date().toISOString().split('T')[0];

  btn.disabled = false;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M12 5v14M5 12h14"/></svg> Tambah Sparepart`;

  renderSparepartMgmtGrid();
  updateDashboardSpFromSheet();

  if (isConnected) {
    showToast(`Sparepart "${name}" berhasil disimpan ✓`, 'success');
    // Reload setelah 2 detik agar ID resmi dari GAS termuat
    setTimeout(() => loadSparepartFromSheet(true), 2000);
  } else {
    showToast(`Sparepart "${name}" ditambahkan (mode lokal). ✓`, 'success');
  }
}

/* ── Hapus sparepart dari server dan lokal ── */
async function deleteSparepart(id) {
  const idx = sparepartStore.findIndex(s => s.id === id);
  if (idx === -1) return;
  const sp = sparepartStore[idx];
  const name = sp.name;

  // Konfirmasi sebelum hapus
  if (!confirm(`Hapus sparepart "${name}"?\n\nData ini akan dihapus secara permanen dan tidak dapat dikembalikan.`)) {
    return;
  }

  // Hapus dari tampilan lokal segera (optimistic)
  sparepartStore.splice(idx, 1);
  renderSparepartMgmtGrid();
  updateDashboardSpFromSheet();

  // Kirim perintah DELETE ke Google Apps Script
  if (CONFIG.GAS_URL) {
    showToast(`Menghapus "${name}"…`, 'info');
    try {
      const res = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet: 'Sparepart', action: 'delete', id }),
      });
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'ok')) {
        showToast(`Sparepart "${name}" berhasil dihapus ✓`, 'success');
      } else if (data && data.status === 'not_found') {
        showToast(`Sparepart "${name}" dihapus dari tampilan (tidak ditemukan di database)`, 'info');
      } else {
        // Coba fallback no-cors (GAS kadang tidak kirim CORS header yang benar)
        await fetch(CONFIG.GAS_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheet: 'Sparepart', action: 'delete', id }),
        });
        showToast(`Sparepart "${name}" berhasil dihapus ✓`, 'success');
      }
    } catch {
      // Fallback no-cors langsung
      try {
        await fetch(CONFIG.GAS_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheet: 'Sparepart', action: 'delete', id }),
        });
        showToast(`Sparepart "${name}" dihapus ✓`, 'success');
      } catch {
        showToast(`Sparepart "${name}" dihapus dari tampilan (koneksi bermasalah)`, 'info');
      }
    }
  } else {
    showToast(`Sparepart "${name}" dihapus dari tampilan (GAS URL belum dikonfigurasi)`, 'info');
  }
}

window.deleteSparepart = deleteSparepart;
window.refreshSparepart = function() { loadSparepartFromSheet(true); };

function renderSparepartMgmtGrid() {
  const grid      = document.getElementById('sp-mgmt-grid');
  const countEl   = document.getElementById('sp-mgmt-count');
  if (!grid) return;

  const getMachineName = s => s.machineName || s.machine || '—';
  const statusLabel = { good: 'Baik', warning: 'Perlu Perhatian', critical: 'Kritis' };

  let data = _spFilterMachine
    ? sparepartStore.filter(s => {
        const m = MACHINES.find(m => m.id === _spFilterMachine);
        const filterName = m ? m.name : _spFilterMachine;
        return s.machineName === filterName;
      })
    : [...sparepartStore];

  // Apply search filter
  if (_spSearchQuery) {
    data = data.filter(s =>
      (s.name || '').toLowerCase().includes(_spSearchQuery) ||
      (s.machineName || '').toLowerCase().includes(_spSearchQuery)
    );
  }

  // Recalculate live countdown for all items
  data = data.map(s => {
    const calc = calcSparepartStatus(s.lastReplace, s.lifetimeDays);
    return { ...s, ...calc };
  });

  // Sort based on _spSortOrder
  const statusOrder = { critical: 0, warning: 1, good: 2 };
  if (_spSortOrder === 'status') {
    data.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  } else if (_spSortOrder === 'name') {
    data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (_spSortOrder === 'life_asc') {
    data.sort((a, b) => (a.life ?? 100) - (b.life ?? 100));
  } else if (_spSortOrder === 'life_desc') {
    data.sort((a, b) => (b.life ?? 100) - (a.life ?? 100));
  }

  if (countEl) {
    const total    = data.length;
    const critical = data.filter(s => s.status === 'critical').length;
    const warning  = data.filter(s => s.status === 'warning').length;
    const source   = CONFIG.GAS_URL ? '● Live' : '● Mode Lokal';
    countEl.innerHTML = `
      <span class="sp-count-total">${total} Sparepart</span>
      ${critical ? `<span class="sp-count-chip critical">${critical} Kritis</span>` : ''}
      ${warning  ? `<span class="sp-count-chip warning">${warning} Perlu Perhatian</span>` : ''}
      <span class="sp-count-source">${source}</span>
      <button class="btn btn-ghost btn-sm sp-refresh-btn" onclick="refreshSparepart()" title="Refresh data">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Refresh
      </button>
    `;
  }

  if (!data.length) {
    const emptyMsg = _spSearchQuery || _spFilterMachine
      ? '<div class="sp-mgmt-empty">Tidak ada sparepart yang cocok dengan pencarian / filter.</div>'
      : (CONFIG.GAS_URL
        ? '<div class="sp-mgmt-empty">Belum ada data sparepart. Tambahkan sparepart pertama Anda menggunakan form di atas.</div>'
        : '<div class="sp-mgmt-empty">Tidak ada sparepart ditemukan untuk mesin yang dipilih.</div>');
    grid.innerHTML = emptyMsg;
    return;
  }

  grid.innerHTML = data.map(s => {
    const mName   = getMachineName(s);
    const cdClass = s.isOverdue ? 'sp-countdown-overdue' : (s.status === 'warning' ? 'sp-countdown-warning' : 'sp-countdown-ok');
    // daysOverdue: berapa hari melewati jadwal (dari calcSparepartStatus)
    // sisaHari: berapa hari tersisa sebelum jadwal (0 di hari-H dan overdue)
    const overdueCount = s.daysOverdue || 0;
    const cdText  = s.isOverdue
      ? `⚠ OVERDUE${overdueCount > 0 ? ' — ' + overdueCount + ' hari terlambat' : ''}`
      : s.sisaHari === 0
        ? '⏰ Jadwal penggantian hari ini'
        : `${s.sisaHari} hari tersisa`;

    return `
    <div class="sp-mgmt-item status-${s.status}">
      <div class="sp-mgmt-item-header">
        <div class="sp-mgmt-item-info">
          <span class="sp-mgmt-item-name">${s.name}</span>
          <span class="sp-lt-machine-tag">${mName}</span>
        </div>
        <div class="sp-mgmt-item-right">
          <span class="sp-lt-pct ${s.status}">${s.life}%</span>
          <button class="sp-mgmt-delete-btn" onclick="deleteSparepart('${s.id}')" title="Hapus dari tampilan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>
      <div class="sp-lt-bar-wrap">
        <div class="sp-lt-bar-fill ${s.status}" style="width:${s.life}%"></div>
      </div>

      <!-- Countdown Lifetime -->
      <div class="sp-countdown-row ${cdClass}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span class="sp-countdown-text">${cdText}</span>
      </div>

      <div class="sp-mgmt-item-meta">
        <div class="sp-mgmt-meta-row">
          <span class="sp-mgmt-meta-label">Lifetime</span>
          <span class="sp-mgmt-meta-val">${s.lifetimeDays} hari</span>
        </div>
        <div class="sp-mgmt-meta-row">
          <span class="sp-mgmt-meta-label">Penggantian terakhir</span>
          <span class="sp-mgmt-meta-val">${formatDateYMD(s.lastReplace)}</span>
        </div>
        <div class="sp-mgmt-meta-row">
          <span class="sp-mgmt-meta-label">Penggantian berikutnya</span>
          <span class="sp-mgmt-meta-val ${s.isOverdue ? 'sp-overdue-text' : ''}">${s.isOverdue ? '⚠ OVERDUE' : formatDateYMD(s.nextReplace)}</span>
        </div>
      </div>
      <div class="sp-lt-footer" style="margin-top:8px">
        <span></span>
        <span class="sp-lt-status-chip ${s.status}">${statusLabel[s.status] || s.status}</span>
      </div>
    </div>
  `}).join('');
}

/* ══════════════════════════════════════════════════════════
   12. SETTINGS
   ══════════════════════════════════════════════════════════ */

function initSettings() {
  const saved = localStorage.getItem('prima-gas-url');
  if (saved) {
    CONFIG.GAS_URL = saved;
    const urlEl = document.getElementById('gas-url');
    if (urlEl) urlEl.value = saved;
  }

  const urlEl = document.getElementById('gas-url');
  if (urlEl) {
    urlEl.addEventListener('change', function() {
      CONFIG.GAS_URL = this.value.trim();
      localStorage.setItem('prima-gas-url', CONFIG.GAS_URL);
      showToast('URL Google Apps Script disimpan ✓', 'success');
    });
  }

  const testBtn = document.getElementById('test-connection-btn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('connection-status');
      if (!statusEl) return;
      statusEl.classList.remove('hidden', 'ok', 'fail');
      statusEl.textContent = 'Menguji koneksi…';
      const url = CONFIG.GAS_URL;
      if (!url) { statusEl.classList.add('fail'); statusEl.textContent = '✗ Belum ada URL yang dikonfigurasi'; return; }
      try {
        const res = await fetch(url + '?test=ping');
        const data = await res.json();
        if (data && data.status === 'ok') {
          statusEl.classList.add('ok'); statusEl.textContent = '✓ Koneksi berhasil — PRIMA GAS terhubung';
        } else {
          statusEl.classList.add('ok'); statusEl.textContent = '✓ URL dapat dijangkau';
        }
      } catch {
        // Try no-cors fallback
        try {
          await fetch(url + '?test=ping', { mode: 'no-cors' });
          statusEl.classList.add('ok'); statusEl.textContent = '✓ URL dapat dijangkau (mode no-cors)';
        } catch {
          statusEl.classList.add('fail'); statusEl.textContent = '✗ Koneksi gagal — periksa URL dan deployment';
        }
      }
    });
  }
}

/* ══════════════════════════════════════════════════════════
   12b. PRODUCTION INIT (Form Kerusakan + Laporan Mandiri)
   ══════════════════════════════════════════════════════════ */

let productionInitialized = false;

function initProduction() {
  if (productionInitialized) return;
  productionInitialized = true;

  // Init datetime clock for production header
  _clockProd = document.getElementById('prod-header-date');
  if (_clockProd && !_clockSup && !_clockTech) requestAnimationFrame(_clockTick);

  // Nav menu switching
  document.querySelectorAll('#page-production .prod-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      document.querySelectorAll('#page-production .prod-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#page-production .prod-view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      const viewEl = document.getElementById('prod-view-' + target);
      if (viewEl) viewEl.classList.add('active');
    });
  });

  // ── Init Form Laporan Kerusakan ──
  initSearchableSelect('prod-req-machine-wrap', MACHINES.map(m => ({ value: m.id, label: m.name })), '-- Pilih Mesin --');
  const FAILURE_TYPES = [
    'Sistem Pneumatik dan Seal',
    'Sistem Pemotongan (Pisau)',
    'Sistem Sealing (Vertical, Horizontal, Neck Seal)',
    'Sistem Film/Foil/OPP Handling',
    'Sistem Conveyor dan Jalur Produk',
    'Sistem Pengisian (Filling & Dosing)',
    'Sistem Elektrikal dan Instrumentasi',
    'Sistem Inkjet dan Coding',
    'Sistem Pompa dan Motor',
  ];
  initSearchableSelect('prod-req-failure-type-wrap', FAILURE_TYPES.map(t => ({ value: t, label: t })), '-- Pilih Jenis Kerusakan --');
  const sinceEl = document.getElementById('prod-req-since');
  if (sinceEl) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    sinceEl.value = now.toISOString().slice(0, 16);
  }
  document.getElementById('prod-req-submit-btn').addEventListener('click', submitProductionKerusakan);

  // ── Init Form Laporan Perbaikan Mandiri ──
  const BD_FAILURES = [
    { value: 'Sistem Pneumatik dan Seal',                        label: 'Sistem Pneumatik dan Seal' },
    { value: 'Sistem Pemotongan (Pisau)',                        label: 'Sistem Pemotongan (Pisau)' },
    { value: 'Sistem Sealing (Vertical, Horizontal, Neck Seal)', label: 'Sistem Sealing (Vertical, Horizontal, Neck Seal)' },
    { value: 'Sistem Film/Foil/OPP Handling',                   label: 'Sistem Film/Foil/OPP Handling' },
    { value: 'Sistem Conveyor dan Jalur Produk',                 label: 'Sistem Conveyor dan Jalur Produk' },
    { value: 'Sistem Pengisian (Filling & Dosing)',              label: 'Sistem Pengisian (Filling & Dosing)' },
    { value: 'Sistem Elektrikal dan Instrumentasi',              label: 'Sistem Elektrikal dan Instrumentasi' },
    { value: 'Sistem Inkjet dan Coding',                         label: 'Sistem Inkjet dan Coding' },
    { value: 'Sistem Pompa dan Motor',                           label: 'Sistem Pompa dan Motor' },
  ];
  initSearchableSelect('prod-bd-machine-wrap', MACHINES.map(m => ({ value: m.id, label: m.name })), '-- Pilih Mesin --');
  initSearchableSelect('prod-bd-failure-wrap', BD_FAILURES, '-- Pilih Jenis Kerusakan --');
  const downtimeEl = document.getElementById('prod-bd-downtime');
  if (downtimeEl && !downtimeEl.value) downtimeEl.value = nowDatetimeLocal();

  // Banner mandiri
  const banner = document.getElementById('prod-bd-laporan-asal-banner');
  if (banner) {
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--accent)">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
      <strong>Laporan Mandiri</strong> — Perbaikan ditemukan sendiri oleh operator
    `;
    banner.classList.remove('hidden');
    banner.classList.add('banner-mandiri');
  }

  // Tambah Deskripsi button
  const addDescBtn = document.getElementById('prod-bd-add-desc-btn');
  if (addDescBtn && !addDescBtn._prodInitialized) {
    addDescBtn._prodInitialized = true;
    addDescBtn.addEventListener('click', () => {
      const list = document.getElementById('prod-bd-desc-list');
      const idx  = list.children.length;
      const row  = document.createElement('div');
      row.className = 'bd-desc-row form-group';
      row.dataset.idx = idx;
      row.innerHTML = `
        <div class="bd-desc-inner">
          <div class="bd-desc-select-wrap">
            <label class="bd-desc-field-label">Tipe <span class="required">*</span></label>
            <select class="form-input bd-desc-type" data-idx="${idx}">
              <option value="">--- PILIH TIPE ---</option>
              <option value="Pergantian Sparepart">Pergantian Sparepart</option>
              <option value="Perbaikan">Perbaikan</option>
              <option value="Pengecekan">Pengecekan</option>
              <option value="Kalibrasi">Kalibrasi</option>
            </select>
          </div>
          <div class="bd-desc-text-wrap">
            <label class="bd-desc-field-label">Deskripsi <span class="required">*</span></label>
            <div class="bd-desc-text-input-row">
              <textarea class="form-input form-textarea bd-desc-text" data-idx="${idx}" placeholder="Deskripsi…" rows="1"></textarea>
              <button class="pm-mandiri-voice-btn bd-desc-voice-btn" type="button" title="Input Suara"
                      onclick="toggleBDDescVoice(this)">
                <svg class="voice-icon-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px">
                  <rect x="9" y="2" width="6" height="11" rx="3"/>
                  <path d="M5 10a7 7 0 0 0 14 0"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
                <span class="voice-ripple"></span>
              </button>
            </div>
          </div>
          <button class="bd-desc-remove" type="button" title="Hapus" onclick="removeBDDescRow(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
      list.appendChild(row);
      const typeSelect = row.querySelector('.bd-desc-type');
      typeSelect.addEventListener('change', () => toggleSparepartDropdown(row, typeSelect.value));
      requestAnimationFrame(() => row.classList.add('bd-desc-visible'));
    });
  }

  const submitMandiriBtn = document.getElementById('prod-bd-submit-btn');
  if (submitMandiriBtn && !submitMandiriBtn._prodInitialized) {
    submitMandiriBtn._prodInitialized = true;
    submitMandiriBtn.addEventListener('click', submitProductionMandiri);
  }
}

async function submitProductionKerusakan() {
  const workRequest = document.getElementById('prod-req-work-request').value.trim();
  const keterangan  = document.getElementById('prod-req-keterangan').value;
  const machineId   = document.getElementById('prod-req-machine').value;
  const failureType = document.getElementById('prod-req-failure-type').value;
  const description = document.getElementById('prod-req-description').value.trim();
  const reporter    = document.getElementById('prod-req-reporter-name').value.trim();
  const since       = document.getElementById('prod-req-since').value;

  // ── Validasi dengan highlight field kosong ──
  let hasError = false;
  function markField(id, isEmpty) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isEmpty) { el.classList.add('input-error'); hasError = true; }
    else el.classList.remove('input-error');
  }
  function markSS(wrapId, isEmpty) {
    const el = document.getElementById(wrapId);
    if (!el) return;
    if (isEmpty) { el.classList.add('ss-error'); hasError = true; }
    else el.classList.remove('ss-error');
  }

  markField('prod-req-work-request', !workRequest);
  markField('prod-req-keterangan', !keterangan);
  markSS('prod-req-machine-wrap', !machineId);
  markSS('prod-req-failure-type-wrap', !failureType);
  markField('prod-req-description', !description);
  markField('prod-req-reporter-name', !reporter);

  if (hasError) {
    showToast('Mohon lengkapi semua field yang wajib diisi', 'error');
    const firstErr = document.querySelector('#page-production .input-error, #page-production .ss-error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.getElementById('prod-req-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-loader"></span> Mengirim laporan…';

  const machineName = machineNameFromId(machineId);

  /* Row sesuai SHEET_HEADERS.LaporanKerusakan di Code.gs:
     [Timestamp, Nomor WR, Nama Mesin, Jenis Kerusakan, Deskripsi, Sejak Kapan, Nama Pelapor, Keterangan, Status] */
  const nowTs = new Date();
  const tsFormatted = nowTs.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const row = [
    tsFormatted,
    workRequest,
    machineName,
    failureType,
    description,
    since,
    reporter,
    keterangan,   // Batch / Non Batch  (kolom 8 — sekarang sebelum Status)
    'Menunggu',   // Status awal = Menunggu ditangani teknisi (kolom 9)
  ];

  const result = await gasPost('LaporanKerusakan', row);
  const isConnected = CONFIG.GAS_URL && result.status === 'ok';

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Kirim Laporan Kerusakan`;
    if (isConnected) {
      showToast('Laporan berhasil dikirim! Tim teknisi akan segera menindaklanjuti. ✓', 'success');
    } else {
      showToast('Laporan dicatat (mode lokal). Konfigurasikan GAS URL untuk sinkronisasi.', 'info');
    }
    resetProductionKerusakanForm();
  }, 1000);
}

function resetProductionKerusakanForm() {
  const reqWR = document.getElementById('prod-req-work-request');
  if (reqWR) reqWR.value = '';
  const reqKeterangan = document.getElementById('prod-req-keterangan');
  if (reqKeterangan) reqKeterangan.value = '';
  const reqMachine = document.getElementById('prod-req-machine');
  if (reqMachine) reqMachine.value = '';
  const reqMachineDisplay = document.getElementById('prod-req-machine-display');
  if (reqMachineDisplay) { reqMachineDisplay.textContent = '-- Pilih Mesin --'; reqMachineDisplay.classList.add('ss-placeholder'); }
  const reqFailure = document.getElementById('prod-req-failure-type');
  if (reqFailure) reqFailure.value = '';
  const reqFailureDisplay = document.getElementById('prod-req-failure-type-display');
  if (reqFailureDisplay) { reqFailureDisplay.textContent = '-- Pilih Jenis Kerusakan --'; reqFailureDisplay.classList.add('ss-placeholder'); }
  const reqDesc = document.getElementById('prod-req-description');
  if (reqDesc) reqDesc.value = '';
  const reqReporter = document.getElementById('prod-req-reporter-name');
  if (reqReporter) reqReporter.value = '';
  const sinceEl = document.getElementById('prod-req-since');
  if (sinceEl) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    sinceEl.value = now.toISOString().slice(0, 16);
  }
}



let techInitialized = false;

function initTechnician() {
  if (techInitialized) return;
  techInitialized = true;

  initTechDateTime();
  initTechNav();
  populateMachineSelects();
  initPMForm();
  initBDForm();
  initTechHistory();
  initTechSparepart();
  // Preload data LaporanKerusakan di background saat halaman teknisi pertama dibuka,
  // sehingga saat button "Breakdown Maintenance" diklik, data sudah siap di cache.
  loadLaporanKerusakanBackground();
}

function initTechNav() {
  document.querySelectorAll('.tech-card').forEach(card => {
    card.addEventListener('click', () => {
      const targetView = 'tech-' + card.dataset.techview;
      showTechView(targetView);
      // Setiap kali teknisi membuka Breakdown Maintenance, tampilkan cache langsung
      // lalu refresh data di background (tanpa menunggu loading)
      if (targetView === 'tech-bd-input') {
        // Tampilkan data dari cache seketika (tanpa reset cache)
        loadLaporanKerusakanForTech();
        // Refresh sparepart di background agar dropdown selalu segar
        loadSparepartFromSheet(true);
        // Sembunyikan form BD sampai user klik "Perbaiki" atau "Laporan Mandiri"
        resetBDForm();
      }
      // Setiap kali teknisi membuka Preventive Maintenance, muat ulang jadwal terbaru
      if (targetView === 'tech-pm-input') {
        loadJadwalPMForTech(true);
        resetPMForm(); // sembunyikan form sampai jadwal/mandiri dipilih
      }
      // Setiap kali teknisi membuka Riwayat Mesin, muat ulang data riwayat terbaru
      // (sama seperti alur Riwayat Mesin di Supervisor)
      if (targetView === 'tech-machine-hist') {
        const histContainer = document.getElementById('tech-timeline');
        if (histContainer) {
          histContainer.innerHTML = '<p style="color:var(--text-2);text-align:center;padding:32px">Memuat data riwayat…</p>';
        }
        loadBreakdownDataForSupervisor().then(() => renderTechTimeline(_liveHistoryData));
      }
      // Setiap kali teknisi membuka Kondisi Sparepart, selalu ambil data terbaru dari sheet
      if (targetView === 'tech-sparepart') {
        SHEET_CACHE.lastFetch['Sparepart'] = 0;
        initTechSparepart();
      }
    });
  });
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showTechView(btn.dataset.back);
    });
  });
}

function showTechView(id) {
  const current = document.querySelector('.tech-view.active');
  const target  = document.getElementById(id);
  if (!target || current === target) return;

  const isBack = id === 'tech-home';

  // Scroll content to top right away (feels instant, avoids jump after animation)
  const techContent = document.querySelector('.tech-content');
  if (techContent) techContent.scrollTop = 0;

  if (current) {
    // Take outgoing view out of normal flow and animate it out — this stops
    // it from stacking on top of / pushing the incoming view (the cause of
    // the laggy "double view" effect).
    current.classList.remove('active', 'slide-back');
    current.classList.add('exiting', isBack ? 'slide-exit-right' : 'slide-exit-left');
    current.addEventListener('animationend', function onEnd() {
      current.classList.remove('exiting', 'slide-exit-left', 'slide-exit-right');
      current.removeEventListener('animationend', onEnd);
    }, { once: true });
  }

  // Show target immediately — crossfades with the outgoing view above
  target.classList.remove('slide-back', 'exiting', 'slide-exit-left', 'slide-exit-right');
  if (isBack) target.classList.add('slide-back');
  target.classList.add('active');
}

function populateMachineSelects() {
  initSearchableSelect('pm-machine-wrap', MACHINES.map(m => ({ value: m.id, label: m.name })), '-- Pilih Mesin --');
  initSearchableSelect('bd-machine-wrap', MACHINES.map(m => ({ value: m.id, label: m.name })), '-- Pilih Mesin --');

  // Ketika mesin BD berubah, refresh semua baris "Pergantian Sparepart" yang sudah ada
  const bdMachineHidden = document.getElementById('bd-machine');
  if (bdMachineHidden) {
    bdMachineHidden.addEventListener('change', () => {
      document.querySelectorAll('.bd-desc-row').forEach(row => {
        const typeSelect = row.querySelector('.bd-desc-type');
        if (typeSelect && typeSelect.value === 'Pergantian Sparepart') {
          toggleSparepartDropdown(row, 'Pergantian Sparepart');
        }
      });
    });
  }
}

/* ══════════════════════════════════════════════════════════
   13. PM FORM (TECHNICIAN) — v2: Jadwal + Mandiri
   ══════════════════════════════════════════════════════════ */

/* Track dismissed PM jadwal in this session */
const dismissedJadwalIds = new Set();

/* Set default datetime-local to "now" rounded to the minute */
function nowDatetimeLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function initPMForm() {
  // Set default start/end times
  const startEl = document.getElementById('pm-start-time');
  const endEl   = document.getElementById('pm-end-time');
  if (startEl) startEl.value = nowDatetimeLocal();
  if (endEl)   endEl.value   = nowDatetimeLocal();

  document.getElementById('pm-submit-btn').addEventListener('click', submitPM);

  // Refresh jadwal button
  const refreshBtn = document.getElementById('refresh-jadwal-pm-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadJadwalPMForTech(true);
    });
  }

  // Load jadwal PM
  loadJadwalPMForTech();
}

/* ── Load jadwal PM untuk teknisi ── */
async function loadJadwalPMForTech(forceRefresh = false) {
  const container = document.getElementById('tech-pm-jadwal-list');
  if (!container) return;

  const hasCards = container.querySelectorAll('.laporan-card').length > 0;
  if (!hasCards) {
    container.innerHTML = `<div class="laporan-loading"><span class="btn-loader" style="display:inline-block;margin-right:8px"></span>Memuat jadwal PM…</div>`;
  }

  if (!CONFIG.GAS_URL) {
    container.innerHTML = `<div class="laporan-empty"><p>GAS URL belum dikonfigurasi.</p></div>`;
    return;
  }

  let data = [];
  try {
    const url = CONFIG.GAS_URL + '?sheet=JadwalPM';
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (res.ok) {
      const text = await res.text();
      const json = JSON.parse(text);
      if (json && json.status === 'ok' && Array.isArray(json.data)) {
        data = json.data;
      }
    }
  } catch (e) {
    console.warn('loadJadwalPMForTech fetch failed:', e);
  }

  renderJadwalPMForTech(data, container);
}

/* ── Render daftar jadwal PM ── */
function renderJadwalPMForTech(data, container) {
  const today = toLocalMidnight(new Date());

  // Filter: hanya tampilkan Pending / Overdue (belum selesai)
  // Status 'selesai' atau 'finish' → sudah dikerjakan, tidak ditampilkan
  const pending = (data || []).filter(row => {
    const status = (row['Status'] || '').trim().toLowerCase();
    const id = buildJadwalId(row);
    const isDone = status === 'selesai' || status === 'finish' || status === 'done';
    return !isDone && !dismissedJadwalIds.has(id);
  });

  let html = '';

  if (pending.length) {
    html += `<div class="laporan-section-title">
      <span class="laporan-badge-count" style="background:var(--accent)">${pending.length}</span> Jadwal Masuk — Perlu Dikerjakan
    </div>`;
    html += pending.map(row => renderJadwalPMCard(row)).join('');
  } else {
    html = `<div class="laporan-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--text-3)">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p>Tidak ada jadwal PM yang perlu dikerjakan.</p>
      <p style="font-size:.8rem;color:var(--text-3);margin-top:4px">Semua jadwal sudah selesai atau belum ada jadwal.</p>
    </div>`;
  }

  container.innerHTML = html;
}

/* ── Build a unique id for a jadwal row ── */
function buildJadwalId(row) {
  // Gunakan normalizeDateToYYYYMMDD agar id konsisten regardless format dari GAS
  const tgl = normalizeDateToYYYYMMDD(row['Tanggal Jadwal'] || '');
  return (row['Nama Mesin'] || '') + '||' + (row['Tipe Perawatan'] || '') + '||' + tgl;
}

/* ── Render single Jadwal PM card ── */
function renderJadwalPMCard(row) {
  const machineName = row['Nama Mesin'] || '—';
  const tipe        = row['Tipe Perawatan'] || '—';
  const tanggal     = row['Tanggal Jadwal'] || '—';
  const prosedurPkg = row['Prosedur PM'] || '';
  const status      = row['Status'] || 'Pending';
  const id          = buildJadwalId(row);

  const today = new Date(); today.setHours(0,0,0,0);
  // Normalisasi tanggal menggunakan helper terpusat (handle semua format GAS)
  const tanggalNorm = tanggal !== '—' ? normalizeDateToYYYYMMDD(tanggal) : '';
  const jadwalDate  = tanggalNorm ? toLocalMidnight(tanggalNorm) : null;
  const isOverdue   = jadwalDate && jadwalDate < today;

  const statusClass = isOverdue ? 'badge-red' : 'badge-yellow';
  const statusLabel = isOverdue ? 'Lewat Jadwal' : 'Dijadwalkan';

  // Format tanggal untuk tampilan
  let dateLabel = tanggal;
  if (jadwalDate && !isNaN(jadwalDate)) {
    dateLabel = jadwalDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Encode for onclick
  const safeId          = id.replace(/'/g, "\\'");
  const safeMachineName = machineName.replace(/'/g, "\\'");
  const safeTipe        = tipe.replace(/'/g, "\\'");
  const safePkg         = prosedurPkg.replace(/'/g, "\\'");

  return `
    <div class="laporan-card glass pm-jadwal-card" data-jadwal-id="${id}">
      <div class="laporan-card-header">
        <div class="laporan-card-meta">
          <span class="laporan-wr-badge" style="background:rgba(var(--accent-rgb),.15);color:var(--accent)">${tipe}</span>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
        <span class="laporan-ts">${dateLabel}</span>
      </div>
      <div class="laporan-card-body">
        <div class="laporan-machine">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
          <strong>${machineName}</strong>
        </div>
        ${prosedurPkg ? `<div class="laporan-failure-tag" style="color:var(--accent)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>
          Paket: ${prosedurPkg}
        </div>` : ''}
      </div>
      <div class="laporan-card-footer">
        <button class="btn btn-primary btn-sm" onclick="prefillPMFromJadwal('${safeId}','${safeMachineName}','${safeTipe}','${safePkg}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Kerjakan
        </button>
      </div>
    </div>`;
}

/* ── Prefill PM form from jadwal ── */
window.prefillPMFromJadwal = async function(jadwalId, machineName, tipe, prosedurPkg) {
  // Store jadwal asal id
  const jadwalAsalEl = document.getElementById('pm-jadwal-asal-id');
  if (jadwalAsalEl) jadwalAsalEl.value = jadwalId;

  // Show banner
  const banner = document.getElementById('pm-jadwal-asal-banner');
  if (banner) {
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--accent)"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      Mengerjakan Jadwal: <strong>${tipe} — ${machineName}</strong>
    `;
    banner.classList.remove('hidden');
    banner.classList.remove('banner-mandiri');
  }

  // Pre-fill and lock machine
  const machineInput   = document.getElementById('pm-machine');
  const machineDisplay = document.getElementById('pm-machine-display');
  const machineWrap    = document.getElementById('pm-machine-wrap');
  const machineObj     = MACHINES.find(m => m.name === machineName);
  if (machineInput)   machineInput.value   = machineObj ? machineObj.id : '';
  if (machineDisplay) {
    machineDisplay.textContent = machineName;
    machineDisplay.classList.remove('ss-placeholder');
  }
  if (machineWrap) machineWrap.classList.add('ss-locked');

  // Set default times
  const startEl = document.getElementById('pm-start-time');
  const endEl   = document.getElementById('pm-end-time');
  if (startEl && !startEl.value) startEl.value = nowDatetimeLocal();
  if (endEl   && !endEl.value)   endEl.value   = nowDatetimeLocal();

  // Load prosedur dari paket yang dipilih supervisor (await agar loading selesai sebelum scroll)
  await loadProsedurForPMForm(machineName, tipe, prosedurPkg);

  // Scroll ke form
  const formEl = document.getElementById('pm-form-wrapper');
  if (formEl) {
    formEl.classList.remove('hidden');
    setTimeout(() => formEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  showToast(`Form diisi dari jadwal ${tipe} — ${machineName}. Lengkapi dan kirim.`, 'info');
};

/* ── Helper: fetch & parse ProsedurPM dari GAS, isi _prosedurGroups ── */
async function _fetchProsedurFromGAS() {
  if (!CONFIG.GAS_URL) return;
  try {
    const res = await fetch(`${CONFIG.GAS_URL}?sheet=ProsedurPM`, { method: 'GET', redirect: 'follow' });
    if (!res.ok) return;
    const text   = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { return; }
    if (!parsed || parsed.status !== 'ok' || !Array.isArray(parsed.data)) return;

    const map = new Map();
    parsed.data.forEach(row => {
      const ts    = row['Timestamp']          || '';
      const mach  = (row['Nama Mesin']         || '').trim();
      const tip   = (row['Tipe Perawatan']     || '').trim();
      const judul = (row['Judul Prosedur PM']  || '').trim();
      const pros  = (row['Prosedur PM']        || '').trim();
      const urut  = parseInt(row['Urutan PM']) || 0;
      if (!mach || !tip || !judul) return;
      const key = judul + '||' + tip + '||' + mach;
      if (!map.has(key)) map.set(key, { key, machineName: mach, tipe: tip, timestamp: ts, judul, items: [] });
      if (pros) {
        map.get(key).items.push({ no: urut, prosedur: pros });
      }
    });
    map.forEach(g => g.items.sort((a, b) => a.no - b.no));
    _prosedurGroups = [...map.values()];
    console.log(`✓ ProsedurPM loaded: ${_prosedurGroups.length} paket`, _prosedurGroups.map(g => g.tipe + ' — ' + g.machineName));
  } catch (e) {
    console.warn('_fetchProsedurFromGAS failed:', e);
  }
}

/* ── Load prosedur dari _prosedurGroups berdasarkan paket ──
   Selalu fetch ulang dari GAS agar data dijamin segar.
   Pencocokan dilakukan dengan 4 strategi bertingkat.         ── */
async function loadProsedurForPMForm(machineName, tipe, prosedurPkgLabel) {
  const rowsContainer = document.getElementById('pm-prosedur-rows');
  const hintEl        = document.getElementById('pm-prosedur-hint');
  if (!rowsContainer) return;

  // Tampilkan loading sementara fetch
  if (hintEl) hintEl.classList.add('hidden');
  rowsContainer.innerHTML = `
    <div class="laporan-loading" style="padding:14px 0">
      <span class="btn-loader" style="display:inline-block;margin-right:8px"></span>
      Memuat prosedur…
    </div>`;

  // Selalu fetch ulang dari GAS untuk data segar
  await _fetchProsedurFromGAS();

  const normStr = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normMachine = normStr(machineName);
  const normTipe    = normStr(tipe);

  // Urai prosedurPkgLabel: format bisa "tipe — machineName" atau "machineName||tipe"
  let pkgMachine = '', pkgTipe = '';
  if (prosedurPkgLabel && prosedurPkgLabel.includes('||')) {
    [pkgMachine, pkgTipe] = prosedurPkgLabel.split('||').map(s => s.trim());
  } else if (prosedurPkgLabel && prosedurPkgLabel.includes(' — ')) {
    const parts = prosedurPkgLabel.split(' — ');
    pkgTipe    = parts[0].trim();
    pkgMachine = parts.slice(1).join(' — ').trim(); // handle nama mesin yang mengandung " — "
  }

  let group = null;

  // 1. Exact match: machineName + tipe (kasus normal)
  group = (_prosedurGroups || []).find(g =>
    g.machineName === machineName && g.tipe === tipe
  );

  // 2. Normalized match: trim + lowercase + collapse spaces
  if (!group) {
    group = (_prosedurGroups || []).find(g =>
      normStr(g.machineName) === normMachine && normStr(g.tipe) === normTipe
    );
  }

  // 3. Cocokkan via prosedurPkgLabel yang diurai
  if (!group && pkgMachine && pkgTipe) {
    group = (_prosedurGroups || []).find(g =>
      normStr(g.machineName) === normStr(pkgMachine) &&
      normStr(g.tipe)        === normStr(pkgTipe)
    );
  }

  // 4. Fallback: cocokkan label penuh "tipe — machineName"
  if (!group && prosedurPkgLabel) {
    group = (_prosedurGroups || []).find(g =>
      normStr(g.tipe + ' — ' + g.machineName) === normStr(prosedurPkgLabel)
    );
  }

  if (!group || !group.items || group.items.length === 0) {
    console.warn('loadProsedurForPMForm: tidak ditemukan group untuk', { machineName, tipe, prosedurPkgLabel });
    console.warn('Tersedia:', (_prosedurGroups || []).map(g => `"${g.tipe} — ${g.machineName}"`));
    if (hintEl) hintEl.classList.remove('hidden');
    rowsContainer.innerHTML = `
      <div class="pm-prosedur-empty-msg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;color:var(--text-3)"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Tidak ada prosedur tersimpan untuk paket ini.</span>
      </div>`;
    return;
  }

  // Sembunyikan hint default
  if (hintEl) hintEl.classList.add('hidden');

  // Render prosedur dropdown rows
  renderPMProsedurRows(group.items);
}

/* ── Render prosedur rows: masing-masing baris = nomor + label prosedur + dropdown status ── */
function renderPMProsedurRows(items) {
  const container = document.getElementById('pm-prosedur-rows');
  if (!container) return;

  // Track which statuses have been used to prevent duplicates
  // Each row has its own status select; we just need to track "done" states
  container.innerHTML = items.map((item, idx) => `
    <div class="pm-prosedur-row" data-idx="${idx}" data-prosedur="${(item.prosedur || '').replace(/"/g, '&quot;')}">
      <div class="pm-prosedur-row-num">${item.no || idx + 1}</div>
      <div class="pm-prosedur-row-content">
        <div class="pm-prosedur-row-label">${item.prosedur}</div>
        <select class="form-input pm-prosedur-status" data-idx="${idx}">
          <option value="">-- Pilih Status --</option>
          <option value="Selesai">Selesai</option>
          <option value="Tidak Dilakukan">Tidak Dilakukan</option>
        </select>
      </div>
    </div>
  `).join('');
}

/* ── Open PM form in mandiri mode ── */
window.openPMMandiri = function() {
  resetPMForm();

  // Show mandiri banner
  const banner = document.getElementById('pm-jadwal-asal-banner');
  if (banner) {
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--accent)">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
      <strong>Perawatan Mandiri</strong> — Dilakukan sendiri oleh teknisi
    `;
    banner.classList.remove('hidden');
    banner.classList.add('banner-mandiri');
  }

  // Mode mandiri: tampilkan builder prosedur bebas
  const hintEl  = document.getElementById('pm-prosedur-hint');
  const rowsEl  = document.getElementById('pm-prosedur-rows');
  const secLabel = document.querySelector('#pm-prosedur-section > label.form-label');
  if (hintEl) hintEl.classList.add('hidden');
  if (secLabel) {
    secLabel.innerHTML = 'Prosedur PM <span class="required">*</span>';
  }
  if (rowsEl) {
    rowsEl.innerHTML = `
      <div id="pm-mandiri-prosedur-list"></div>
      <button class="btn btn-ghost btn-add-prosedur-mandiri" id="pm-add-prosedur-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Tambah Prosedur
      </button>`;
    document.getElementById('pm-add-prosedur-btn').addEventListener('click', addMandiriProsedurRow);
    // Mulai dengan 1 baris kosong
    _mandiriProsedurCount = 0;
    addMandiriProsedurRow();
  }

  // Set default times
  const startEl = document.getElementById('pm-start-time');
  const endEl   = document.getElementById('pm-end-time');
  if (startEl) startEl.value = nowDatetimeLocal();
  if (endEl)   endEl.value   = nowDatetimeLocal();

  // Scroll ke form
  const formEl = document.getElementById('pm-form-wrapper');
  if (formEl) {
    formEl.classList.remove('hidden');
    setTimeout(() => formEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  showToast('Mode Perawatan Mandiri — isi form dan kirim laporan.', 'info');
};

let _mandiriProsedurCount = 0;

/* ── Voice Input (Speech Recognition) untuk Prosedur Mandiri ── */
/* ══════════════════════════════════════════════════════════
   Voice Input — Generic (dipakai PM Mandiri & BD Deskripsi)
   ══════════════════════════════════════════════════════════ */
let _activeVoiceBtn    = null;   // button yang sedang aktif listening
let _activeRecognition = null;   // instance SpeechRecognition yang berjalan

function _stopVoiceInput() {
  if (_activeRecognition) {
    try { _activeRecognition.stop(); } catch(e) {}
    _activeRecognition = null;
  }
  if (_activeVoiceBtn) {
    _activeVoiceBtn.classList.remove('voice-btn--active');
    _activeVoiceBtn.title = 'Input Suara';
    _activeVoiceBtn = null;
  }
}

/**
 * Toggle voice input pada sebuah button.
 * @param {HTMLElement} btn       - Tombol voice yang diklik
 * @param {HTMLElement} inp       - input/textarea target
 * @param {string}      placeholder - Placeholder default saat tidak ada interim
 */
function _toggleVoiceInput(btn, inp, placeholder) {
  if (_activeVoiceBtn === btn) { _stopVoiceInput(); return; }
  _stopVoiceInput();

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Browser tidak mendukung input suara. Gunakan Chrome / Edge.', 'error');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang            = 'id-ID';
  recognition.continuous      = true;
  recognition.interimResults  = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = function(event) {
    let interim = '', finalChunk = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalChunk += t + ' ';
      else interim += t;
    }
    if (finalChunk) {
      const current  = inp.value;
      const appended = finalChunk.trim();
      // Huruf pertama kapital jika input masih kosong
      const toAppend = !current.trim()
        ? appended.charAt(0).toUpperCase() + appended.slice(1)
        : appended;
      inp.value = (current ? current.trimEnd() + ' ' : '') + toAppend;
      inp.classList.remove('input-error');
    }
    inp.placeholder = interim || placeholder;
  };

  recognition.onerror = function(event) {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast('Akses mikrofon ditolak. Izinkan akses mikrofon di browser.', 'error');
    } else if (event.error !== 'aborted') {
      showToast('Gagal menangkap suara: ' + event.error, 'error');
    }
    _stopVoiceInput();
  };

  recognition.onend = function() {
    if (_activeRecognition === recognition && _activeVoiceBtn === btn) {
      try { recognition.start(); } catch(e) { _stopVoiceInput(); }
    }
  };

  recognition.start();
  _activeRecognition = recognition;
  _activeVoiceBtn    = btn;
  btn.classList.add('voice-btn--active');
  btn.title = 'Klik untuk berhenti';
}

/* ── Wrapper: PM Mandiri ── */
window.toggleMandiriVoice = function(btn) {
  const row = btn.closest('.pm-mandiri-row');
  const inp = row ? row.querySelector('.pm-mandiri-input') : null;
  if (!inp) return;
  const num = row.querySelector('.pm-prosedur-row-num')?.textContent || '?';
  _toggleVoiceInput(btn, inp, `Deskripsi prosedur ke-${num}…`);
};

/* ── Wrapper: BD Deskripsi ── */
window.toggleBDDescVoice = function(btn) {
  const wrap = btn.closest('.bd-desc-text-wrap');
  const inp  = wrap ? wrap.querySelector('.bd-desc-text') : null;
  if (!inp) return;
  _toggleVoiceInput(btn, inp, 'Deskripsi…');
};

function addMandiriProsedurRow() {
  _mandiriProsedurCount++;
  const num = _mandiriProsedurCount;
  const list = document.getElementById('pm-mandiri-prosedur-list');
  if (!list) return;

  const item = document.createElement('div');
  item.className = 'pm-mandiri-row';
  item.dataset.num = num;
  item.innerHTML = `
    <div class="pm-prosedur-row-num">${num}</div>
    <div class="pm-mandiri-row-body">
      <input type="text" class="form-input pm-mandiri-input"
             placeholder="Deskripsi prosedur ke-${num}…" autocomplete="off" />
      <button class="pm-mandiri-voice-btn" type="button" title="Input Suara"
              onclick="toggleMandiriVoice(this)">
        <svg class="voice-icon-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px">
          <rect x="9" y="2" width="6" height="11" rx="3"/>
          <path d="M5 10a7 7 0 0 0 14 0"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="9" y1="22" x2="15" y2="22"/>
        </svg>
        <span class="voice-ripple"></span>
      </button>
    </div>
    <button class="pm-mandiri-delete" type="button" title="Hapus" onclick="deleteMandiriRow(this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>`;
  list.appendChild(item);

  // Focus input baru
  const inp = item.querySelector('.pm-mandiri-input');
  if (inp) setTimeout(() => inp.focus(), 50);
}

window.deleteMandiriRow = function(btn) {
  const row = btn.closest('.pm-mandiri-row');
  if (!row) return;
  const list = document.getElementById('pm-mandiri-prosedur-list');
  if (!list) return;
  // Jika baris yang dihapus sedang aktif voice, hentikan dulu
  if (_activeVoiceBtn && row.contains(_activeVoiceBtn)) {
    _stopVoiceInput();
  }
  row.remove();
  // Renumber semua baris yang tersisa
  [...list.querySelectorAll('.pm-mandiri-row')].forEach((r, i) => {
    r.querySelector('.pm-prosedur-row-num').textContent = i + 1;
    r.querySelector('.pm-mandiri-input').placeholder = `Deskripsi prosedur ke-${i + 1}…`;
  });
};

/* ── Submit PM ── */
async function submitPM() {
  const machineId  = document.getElementById('pm-machine').value;
  const startTime  = document.getElementById('pm-start-time').value;
  const endTime    = document.getElementById('pm-end-time').value;
  const techName   = document.getElementById('pm-tech-name').value.trim();
  const jadwalId   = document.getElementById('pm-jadwal-asal-id')?.value || '';

  // ── Validasi dengan highlight field yang kosong ──
  let hasError = false;

  function markField(id, isEmpty) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isEmpty) { el.classList.add('input-error'); hasError = true; }
    else el.classList.remove('input-error');
  }
  function markSS(wrapId, isEmpty) {
    const el = document.getElementById(wrapId);
    if (!el) return;
    if (isEmpty) { el.classList.add('ss-error'); hasError = true; }
    else el.classList.remove('ss-error');
  }

  markSS('pm-machine-wrap', !machineId);
  markField('pm-start-time', !startTime);
  markField('pm-end-time', !endTime);
  markField('pm-tech-name', !techName);

  // Deteksi mode mandiri dari ada-tidaknya pm-mandiri-prosedur-list
  const isMandiri = !!document.getElementById('pm-mandiri-prosedur-list');
  let prosedurResults = [];

  if (isMandiri) {
    // Kumpulkan baris mandiri
    const mandiriRows = [...document.querySelectorAll('.pm-mandiri-row')];
    const mandiriList = document.getElementById('pm-mandiri-prosedur-list');

    // Wajib minimal 1 baris terisi
    const filled = mandiriRows.filter(r => r.querySelector('.pm-mandiri-input')?.value.trim());
    if (mandiriRows.length === 0 || filled.length === 0) {
      if (mandiriList) mandiriList.classList.add('ss-error');
      hasError = true;
    } else {
      if (mandiriList) mandiriList.classList.remove('ss-error');
      // Setiap baris yang ada harus terisi
      mandiriRows.forEach(r => {
        const inp = r.querySelector('.pm-mandiri-input');
        if (!inp) return;
        if (!inp.value.trim()) { inp.classList.add('input-error'); hasError = true; }
        else inp.classList.remove('input-error');
      });
    }
    prosedurResults = mandiriRows
      .filter(r => r.querySelector('.pm-mandiri-input')?.value.trim())
      .map((r, i) => `[${i + 1}] ${r.querySelector('.pm-mandiri-input').value.trim()}: Selesai`);

  } else {
    // Mode jadwal — prosedur sudah di-prefill, boleh tidak ada
    const prosedurRows = [...document.querySelectorAll('.pm-prosedur-row')];
    prosedurResults = prosedurRows.map(row => {
      const label  = row.dataset.prosedur || '';
      const status = row.querySelector('.pm-prosedur-status')?.value || '';
      return `[${row.dataset.idx ? parseInt(row.dataset.idx) + 1 : ''}] ${label}: ${status || '—'}`;
    });

    // Semua status prosedur wajib dipilih
    prosedurRows.forEach(row => {
      const sel = row.querySelector('.pm-prosedur-status');
      if (sel && !sel.value) { sel.classList.add('input-error'); hasError = true; }
      else if (sel) sel.classList.remove('input-error');
    });
  }

  if (hasError) {
    showToast('Mohon lengkapi semua field yang wajib diisi', 'error');
    // Scroll ke field pertama yang error
    const firstErr = document.querySelector('.input-error, .ss-error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.getElementById('pm-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-loader"></span> Mengirim…';

  const machineName = machineNameFromId(machineId);

  // ── LANGSUNG hapus card dari tampilan saat submit ──
  if (jadwalId) {
    dismissedJadwalIds.add(jadwalId);
    const cardEl = document.querySelector(`.pm-jadwal-card[data-jadwal-id="${jadwalId}"]`);
    if (cardEl) {
      cardEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease, max-height 0.3s ease';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'translateX(40px)';
      cardEl.style.overflow = 'hidden';
      setTimeout(() => {
        cardEl.style.maxHeight = cardEl.scrollHeight + 'px';
        requestAnimationFrame(() => { cardEl.style.maxHeight = '0'; cardEl.style.margin = '0'; cardEl.style.padding = '0'; });
        setTimeout(() => {
          cardEl.remove();
          const container = document.getElementById('tech-pm-jadwal-list');
          const remaining = container ? container.querySelectorAll('.pm-jadwal-card').length : 0;
          if (remaining === 0 && container) {
            container.innerHTML = `<div class="laporan-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--text-3)"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p>Semua jadwal sudah selesai dikerjakan.</p></div>`;
          }
        }, 300);
      }, 250);
    }
    // Update status di JadwalPM → Finish
    if (CONFIG.GAS_URL) {
      // Jalankan tanpa await agar tidak memblokir UI, tapi pastikan error dicatat
      updateJadwalPMStatus(jadwalId, 'Finish').then(result => {
        console.log('updateJadwalPMStatus result:', result);
      }).catch(e => console.warn('updateJadwalPMStatus failed:', e));
    }
    // Also update local pmSchedules cache (supervisor UI pakai 'Done', sheet pakai 'Selesai')
    pmSchedules.forEach(s => {
      const sDateNorm = normalizeDateToYYYYMMDD(s.date || '');
      const idFromMachId   = buildJadwalId({ 'Nama Mesin': s.machine,                      'Tipe Perawatan': s.type, 'Tanggal Jadwal': sDateNorm });
      const idFromMachName = buildJadwalId({ 'Nama Mesin': machineNameFromId(s.machine),   'Tipe Perawatan': s.type, 'Tanggal Jadwal': sDateNorm });
      if (idFromMachId === jadwalId || idFromMachName === jadwalId) {
        s.status = 'Done';
      }
    });
    // Refresh tabel jadwal supervisor agar status berubah menjadi "Selesai"
    renderPMTable();
    renderCalendar();
  }

  /* Row format for PreventiveMaintenance sheet:
     [Timestamp, Nama Mesin, Waktu Mulai, Waktu Selesai, Prosedur Hasil, Nama Teknisi, Status] */
  const nowTs = new Date();
  const tsFormatted = nowTs.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  const row = [
    tsFormatted,
    machineName,
    startTime,
    endTime,
    prosedurResults.join(' | ') || '—',
    techName,
    'Selesai'
  ];

  const result = await gasPost('PreventiveMaintenance', row);
  const isConnected = CONFIG.GAS_URL && result.status === 'ok';

  SHEET_CACHE.lastFetch['PreventiveMaintenance'] = 0;

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Kirim Laporan Preventive Maintenance`;
    if (isConnected) {
      showToast('Laporan PM berhasil disimpan! ✓', 'success');
    } else {
      showToast('Laporan PM dicatat (mode lokal). ✓', 'success');
    }
    showTechView('tech-home');
    resetPMForm();
  }, 1000);
}

/* ── Update JadwalPM status to Selesai ── */
async function updateJadwalPMStatus(jadwalId, newStatus) {
  const url = CONFIG.GAS_URL;
  if (!url || !jadwalId) return;
  const parts = jadwalId.split('||');
  const machineName = parts[0] || '';
  const tipe        = parts[1] || '';
  // Normalisasi tanggal menggunakan helper terpusat
  const tanggal = normalizeDateToYYYYMMDD(parts[2] || '');

  // Selalu kirim 'Selesai' (bukan 'Finish') agar konsisten dengan sheet header bahasa Indonesia
  const statusToSend = 'Selesai';

  const payload = JSON.stringify({
    sheet: 'JadwalPM',
    action: 'updateJadwalStatus',
    machineName,
    tipe,
    tanggal,
    newStatus: statusToSend,
  });
  console.log('updateJadwalPMStatus payload:', { machineName, tipe, tanggal, newStatus: statusToSend });
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    const data = await res.json().catch(() => null);
    console.log('updateJadwalPMStatus GAS response:', data);
    return data;
  } catch (err) {
    console.warn('updateJadwalPMStatus fetch error:', err);
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: payload });
      console.log('updateJadwalPMStatus sent via no-cors fallback');
    } catch (e2) {
      console.warn('updateJadwalPMStatus no-cors failed:', e2);
    }
  }
}

function resetPMForm() {
  const pmMachineInput = document.getElementById('pm-machine');
  if (pmMachineInput) pmMachineInput.value = '';
  const pmMachineDisplay = document.getElementById('pm-machine-display');
  if (pmMachineDisplay) { pmMachineDisplay.textContent = '-- Pilih Mesin --'; pmMachineDisplay.classList.add('ss-placeholder'); }
  // Buka kunci mesin
  const pmMachineWrap = document.getElementById('pm-machine-wrap');
  if (pmMachineWrap) pmMachineWrap.classList.remove('ss-locked');
  // Reset times
  const startEl = document.getElementById('pm-start-time');
  const endEl   = document.getElementById('pm-end-time');
  if (startEl) startEl.value = nowDatetimeLocal();
  if (endEl)   endEl.value   = nowDatetimeLocal();
  // Reset prosedur rows
  const rowsEl = document.getElementById('pm-prosedur-rows');
  if (rowsEl) rowsEl.innerHTML = '';
  const hintEl = document.getElementById('pm-prosedur-hint');
  if (hintEl) hintEl.classList.remove('hidden');
  // Reset technician name
  const techEl = document.getElementById('pm-tech-name');
  if (techEl) techEl.value = '';
  // Hide banner
  const jadwalAsalEl = document.getElementById('pm-jadwal-asal-id');
  if (jadwalAsalEl) jadwalAsalEl.value = '';
  const banner = document.getElementById('pm-jadwal-asal-banner');
  if (banner) { banner.classList.add('hidden'); banner.classList.remove('banner-mandiri'); banner.innerHTML = ''; }
  // Sembunyikan form kembali
  const formWrapper = document.getElementById('pm-form-wrapper');
  if (formWrapper) formWrapper.classList.add('hidden');
}

/* ══════════════════════════════════════════════════════════
   14. BREAKDOWN FORM (TECHNICIAN)
   ══════════════════════════════════════════════════════════ */

function initBDForm() {
  initBDFailureSelect();

  // Set default "Selesai Diperbaiki" to now (editable by user)
  const downtimeEl = document.getElementById('bd-downtime');
  if (downtimeEl) downtimeEl.value = nowDatetimeLocal();

  // Refresh laporan button
  const refreshBtn = document.getElementById('refresh-laporan-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      SHEET_CACHE.lastFetch['LaporanKerusakan'] = 0; // Force refresh
      loadLaporanKerusakanForTech();
    });
  }

  // "Tambah Deskripsi" button — adds a new dropdown + textarea/sparepart row each click
  const addDescBtn = document.getElementById('bd-add-desc-btn');
  if (addDescBtn) {
    addDescBtn.addEventListener('click', () => {
      const list = document.getElementById('bd-desc-list');
      const idx  = list.children.length;
      const row  = document.createElement('div');
      row.className = 'bd-desc-row form-group';
      row.dataset.idx = idx;
      row.innerHTML = `
        <div class="bd-desc-inner">
          <div class="bd-desc-select-wrap">
            <label class="bd-desc-field-label">Tipe <span class="required">*</span></label>
            <select class="form-input bd-desc-type" data-idx="${idx}">
              <option value="">--- PILIH TIPE ---</option>
              <option value="Pergantian Sparepart">Pergantian Sparepart</option>
              <option value="Perbaikan">Perbaikan</option>
              <option value="Pengecekan">Pengecekan</option>
              <option value="Kalibrasi">Kalibrasi/Setting</option>
            </select>
          </div>
          <div class="bd-desc-text-wrap">
            <label class="bd-desc-field-label">Deskripsi <span class="required">*</span></label>
            <div class="bd-desc-text-input-row">
              <textarea class="form-input form-textarea bd-desc-text" data-idx="${idx}" placeholder="Deskripsi…" rows="1"></textarea>
              <button class="pm-mandiri-voice-btn bd-desc-voice-btn" type="button" title="Input Suara"
                      onclick="toggleBDDescVoice(this)">
                <svg class="voice-icon-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px">
                  <rect x="9" y="2" width="6" height="11" rx="3"/>
                  <path d="M5 10a7 7 0 0 0 14 0"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
                <span class="voice-ripple"></span>
              </button>
            </div>
          </div>
          <button class="bd-desc-remove" type="button" title="Hapus" onclick="removeBDDescRow(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
      list.appendChild(row);

      // Attach change listener for dynamic sparepart dropdown
      const typeSelect = row.querySelector('.bd-desc-type');
      typeSelect.addEventListener('change', () => toggleSparepartDropdown(row, typeSelect.value));

      // Animate in
      requestAnimationFrame(() => row.classList.add('bd-desc-visible'));
    });
  }

  document.getElementById('bd-submit-btn').addEventListener('click', submitBD);
}

window.removeBDDescRow = function(btn) {
  const row = btn.closest('.bd-desc-row');
  if (row) row.remove();
};

/* Toggle tampilan kolom deskripsi:
   - Jika "Pergantian Sparepart" → tampilkan dropdown sparepart berdasarkan mesin yang dipilih
   - Lainnya → tampilkan textarea biasa */
function toggleSparepartDropdown(row, selectedType) {
  const textWrap = row.querySelector('.bd-desc-text-wrap');
  if (!textWrap) return;

  if (selectedType === 'Pergantian Sparepart') {
    const selectedMachine = document.getElementById('bd-machine').value;
    const selectedMachineName = selectedMachine ? machineNameFromId(selectedMachine) : '';

    // Gunakan data dari sparepartStore
    if (!sparepartStore.length) {
      const hintText = 'Memuat data sparepart…';
      textWrap.innerHTML = `
        <div class="bd-sp-dropdown-wrap">
          <div class="bd-sp-searchable-wrap">
            <input type="text" class="form-input bd-sp-search-input" placeholder="Memuat sparepart…" autocomplete="off" disabled />
            <input type="hidden" class="bd-desc-text bd-sp-selected-value" value="" />
          </div>
          <span class="bd-sp-hint">${hintText}</span>
        </div>
      `;
      loadSparepartFromSheet().then(() => {
        const typeSelect = row.querySelector('.bd-desc-type');
        if (typeSelect && typeSelect.value === 'Pergantian Sparepart') {
          toggleSparepartDropdown(row, 'Pergantian Sparepart');
        }
      });
      return;
    }

    const filtered = selectedMachineName
      ? sparepartStore.filter(s => s.machineName === selectedMachineName)
      : sparepartStore;

    const hintText = selectedMachineName
      ? `${filtered.length} sparepart terdaftar pada ${selectedMachineName}`
      : 'Pilih mesin terlebih dahulu untuk memfilter sparepart';

    const options = filtered.length > 0
      ? filtered.map(s => `<option value="${s.name}">${s.name}</option>`).join('')
      : `<option value="" disabled>Tidak ada sparepart terdaftar untuk mesin ini</option>`;

    textWrap.innerHTML = `
      <div class="bd-sp-dropdown-wrap">
        <div class="bd-sp-searchable-wrap">
          <input type="text" class="form-input bd-sp-search-input" placeholder="Cari sparepart…" autocomplete="off" />
          <div class="bd-sp-options-list hidden">
            <div class="bd-sp-options-inner">
              <div class="bd-sp-option bd-sp-option-placeholder" data-value="">-- Pilih Sparepart --</div>
              ${filtered.length > 0
                ? filtered.map(s => `<div class="bd-sp-option" data-value="${s.name}">${s.name}</div>`).join('')
                : `<div class="bd-sp-option bd-sp-option-disabled">Tidak ada sparepart terdaftar untuk mesin ini</div>`}
            </div>
          </div>
          <input type="hidden" class="bd-desc-text bd-sp-selected-value" value="" />
        </div>
        <span class="bd-sp-hint">${hintText}</span>
      </div>
    `;

    // Wire up the searchable sparepart select
    const searchInput  = textWrap.querySelector('.bd-sp-search-input');
    const optionsList  = textWrap.querySelector('.bd-sp-options-list');
    const optionsInner = textWrap.querySelector('.bd-sp-options-inner');
    const allOptions   = () => [...optionsInner.querySelectorAll('.bd-sp-option:not(.bd-sp-option-placeholder):not(.bd-sp-option-disabled)')];
    const hiddenInput  = textWrap.querySelector('.bd-sp-selected-value');

    function showOptions() { optionsList.classList.remove('hidden'); }
    function hideOptions() { optionsList.classList.add('hidden'); }

    searchInput.addEventListener('focus', () => {
      filterOptions('');
      showOptions();
    });

    searchInput.addEventListener('input', () => {
      filterOptions(searchInput.value);
      showOptions();
    });

    function filterOptions(query) {
      const q = query.toLowerCase();
      allOptions().forEach(opt => {
        const match = opt.dataset.value.toLowerCase().includes(q) || opt.textContent.toLowerCase().includes(q);
        opt.style.display = match ? '' : 'none';
      });
    }

    optionsInner.addEventListener('mousedown', e => {
      const opt = e.target.closest('.bd-sp-option');
      if (!opt || opt.classList.contains('bd-sp-option-disabled')) return;
      if (opt.classList.contains('bd-sp-option-placeholder')) {
        searchInput.value = '';
        hiddenInput.value = '';
        searchInput.placeholder = 'Cari sparepart…';
      } else {
        searchInput.value = opt.dataset.value;
        hiddenInput.value = opt.dataset.value;
      }
      hideOptions();
    });

    document.addEventListener('click', function outsideClick(e) {
      if (!textWrap.contains(e.target)) {
        hideOptions();
        document.removeEventListener('click', outsideClick);
      }
    });
  } else {
    // Kembalikan ke textarea biasa
    const idx = row.dataset.idx;
    textWrap.innerHTML = `<div class="bd-desc-text-input-row"><textarea class="form-input form-textarea bd-desc-text" data-idx="${idx}" placeholder="Deskripsi…" rows="1"></textarea><button class="pm-mandiri-voice-btn bd-desc-voice-btn" type="button" title="Input Suara" onclick="toggleBDDescVoice(this)"><svg class="voice-icon-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg><span class="voice-ripple"></span></button></div>`;
  }
}

async function submitBD() {
  const machine     = document.getElementById('bd-machine').value;
  const failure     = document.getElementById('bd-failure').value;
  const selesaiVal  = document.getElementById('bd-downtime').value; // datetime-local "Selesai Diperbaiki"
  const techName    = document.getElementById('bd-tech-name').value.trim();

  // Hitung durasi downtime (jam) dari selisih "Sejak Kapan" (laporan requestor) → "Selesai Diperbaiki"
  let downtime = '';
  if (selesaiVal) {
    const selesaiDate = new Date(selesaiVal);
    // Coba ambil waktu "Sejak Kapan" dari data laporan yang di-prefill
    const laporanId = document.getElementById('bd-laporan-asal-id')?.value || '';
    let sejakDate = null;
    if (laporanId && SHEET_CACHE.LaporanKerusakan) {
      const laporan = SHEET_CACHE.LaporanKerusakan.find(l => (l['Nomor WR'] || '') === laporanId);
      if (laporan) {
        const sejakRaw = laporan['Sejak Kapan'] || laporan['sejak'] || laporan['Sejak'] || '';
        if (sejakRaw) sejakDate = parseTimestamp(sejakRaw);
      }
    }
    if (sejakDate && !isNaN(sejakDate) && !isNaN(selesaiDate)) {
      const diffMs = selesaiDate - sejakDate;
      if (diffMs > 0) {
        downtime = +(diffMs / 3600000).toFixed(2); // jam, 2 desimal
      }
    }
    // Jika tidak ada data sejak, simpan waktu selesai sebagai string (fallback)
    if (downtime === '') {
      downtime = selesaiVal;
    }
  }

  // Collect dynamic description rows
  const descRows = [...document.querySelectorAll('.bd-desc-row')].map(row => {
    const type = row.querySelector('.bd-desc-type').value;
    const text = row.querySelector('.bd-desc-text').value.trim();
    return { type, text };
  });

  // ── Validasi dengan highlight field kosong ──
  let hasError = false;
  function markSS(wrapId, isEmpty) {
    const el = document.getElementById(wrapId);
    if (!el) return;
    if (isEmpty) { el.classList.add('ss-error'); hasError = true; }
    else el.classList.remove('ss-error');
  }
  function markField(id, isEmpty) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isEmpty) { el.classList.add('input-error'); hasError = true; }
    else el.classList.remove('input-error');
  }

  markSS('bd-machine-wrap', !machine);
  markSS('bd-failure-wrap', !failure);
  markField('bd-downtime', !selesaiVal);
  markField('bd-tech-name', !techName);

  if (hasError) {
    showToast('Mohon isi semua field yang wajib diisi', 'error');
    const firstErr = document.querySelector('#tech-bd-input .input-error, #tech-bd-input .ss-error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.getElementById('bd-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-loader"></span> Mengirim…';

  const machineName = machineNameFromId(machine);
  const descSummary = descRows.map(r => `[${r.type}] ${r.text}`).filter(s => s.length > 4).join(' | ');
  const laporanAsalId = document.getElementById('bd-laporan-asal-id')?.value || '';
  // laporanAsalId sudah berisi Nomor WR langsung (diisi oleh prefillBDFromLaporan),
  // tidak perlu lookup ke cache yang bisa null.
  const nomorWR = laporanAsalId.trim();

  // ── LANGSUNG hapus card dari tampilan saat tombol submit ditekan ──
  if (laporanAsalId) {
    dismissedLaporanIds.add(laporanAsalId);
    const cardEl = document.querySelector(`.laporan-card[data-laporan-id="${laporanAsalId}"]`);
    if (cardEl) {
      cardEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease, max-height 0.3s ease';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'translateX(40px)';
      cardEl.style.overflow = 'hidden';
      setTimeout(() => {
        cardEl.style.maxHeight = cardEl.scrollHeight + 'px';
        requestAnimationFrame(() => { cardEl.style.maxHeight = '0'; cardEl.style.margin = '0'; cardEl.style.padding = '0'; });
        setTimeout(() => {
          cardEl.remove();
          const container = document.getElementById('tech-bd-laporan-list');
          const remaining = container ? container.querySelectorAll('.laporan-card').length : 0;
          const badgeEl   = container ? container.querySelector('.laporan-badge-count') : null;
          if (badgeEl) badgeEl.textContent = remaining;
          if (remaining === 0 && container) {
            const mandiriHtml = renderLaporanMandiriSection();
            container.innerHTML = `<div class="laporan-empty"><p>Tidak ada laporan kerusakan masuk.</p></div>${mandiriHtml}`;
          }
        }, 300);
      }, 250);
    }
    // Update cache lokal supaya reload tidak memunculkan card lagi
    if (SHEET_CACHE.LaporanKerusakan) {
      const laporan = SHEET_CACHE.LaporanKerusakan.find(l => (l['Nomor WR'] || '') === laporanAsalId);
      if (laporan) {
        laporan['Keterangan'] = 'Selesai'; // kolom Keterangan yang berubah, bukan Status
        laporan['Status'] = 'Selesai';     // sync Status lokal juga agar filter UI konsisten
      }
    }
  }

  /* Row: [Timestamp, Nomor WR, Nama Mesin, Jenis Kerusakan, Durasi Downtime,
           Deskripsi Tindakan, Sparepart Diganti, Nama Teknisi, Status, Keterangan] */
  const nowTs = new Date();
  const tsFormatted = nowTs.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  // Ambil "Keterangan" (Batch / Non Batch) dari laporan requestor terkait, jika ada
  let keterangan = '';
  if (nomorWR && SHEET_CACHE.LaporanKerusakan) {
    const laporan = SHEET_CACHE.LaporanKerusakan.find(l => (l['Nomor WR'] || '') === nomorWR);
    if (laporan) keterangan = laporan['Keterangan'] || '';
  }
  // Kumpulkan nama sparepart yang diganti (untuk kolom Sparepart Diganti)
  const sparepartDigantiList = descRows
    .filter(r => r.type === 'Pergantian Sparepart' && r.text)
    .map(r => r.text)
    .join(', ');
  const row = [
    tsFormatted,
    nomorWR,
    machineName,
    failure,
    downtime,
    descSummary,
    sparepartDigantiList,  // kolom Sparepart Diganti
    techName,
    'Selesai',
    keterangan
  ];
  const result = await gasPost('BreakdownMaintenance', row);
  const isConnected = CONFIG.GAS_URL && result.status === 'ok';

  // ── UPDATE STATUS LAPORAN KERUSAKAN → "Selesai" ──
  // Dipanggil setiap kali teknisi merespons laporan (nomorWR tidak kosong)
  // Berjalan terlepas dari apakah gasPost berhasil dibaca atau tidak,
  // karena GAS tetap menerima request no-cors meski browser tidak bisa baca response-nya
  if (nomorWR && CONFIG.GAS_URL) {
    await updateLaporanStatus(nomorWR, 'Selesai');
  }

  // ── CATAT PERGANTIAN SPAREPART ke database ──
  // Ambil semua baris deskripsi dengan tipe "Pergantian Sparepart"
  const sparepartRows = descRows.filter(r => r.type === 'Pergantian Sparepart' && r.text);
  if (sparepartRows.length > 0 && CONFIG.GAS_URL) {
    const todayStr = new Date().toISOString().split('T')[0]; // yyyy-MM-dd
    for (const spRow of sparepartRows) {
      const spName = spRow.text;
      // Cari data sparepart yang ada di sparepartStore untuk ambil lifetime-nya
      const existing = sparepartStore.find(
        s => s.name === spName && s.machineName === machineName
      );
      const lifetimeDays = existing ? existing.lifetimeDays : 365;

      // Hitung tanggal penggantian berikutnya
      const nextDate = new Date(todayStr);
      nextDate.setDate(nextDate.getDate() + lifetimeDays);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      // Kirim ke sheet Sparepart — action "updateOrInsert"
      // Gunakan action baru "updateSparepartReplace" yang akan kita tambahkan di GAS
      await gasPostRaw({
        sheet: 'Sparepart',
        action: 'updateSparepartReplace',
        sparepartName: spName,
        machineName: machineName,
        lifetimeDays: lifetimeDays,
        newLastReplace: todayStr,
        newNextReplace: nextDateStr,
        nomorWR: nomorWR || '-',
      });

      // Update sparepartStore lokal agar tampilan langsung sinkron
      if (existing) {
        const { life, status, nextReplace, isOverdue, sisaHari } = calcSparepartStatus(todayStr, lifetimeDays);
        existing.lastReplace = todayStr;
        existing.nextReplace = nextReplace;
        existing.life = life;
        existing.status = status;
        existing.isOverdue = isOverdue;
        existing.sisaHari = sisaHari;
      }
    }
    // Invalidate cache sparepart agar supervisor juga dapat data terbaru
    SHEET_CACHE.lastFetch['Sparepart'] = 0;

    // Setelah semua updateSparepartReplace selesai, reload dari sheet
    // agar tampilan "Daftar Sparepart" (supervisor) dan "Kondisi Sparepart" (teknisi)
    // langsung menampilkan lifetime yang sudah diperbarui.
    loadSparepartFromSheet(true).then(() => {
      // Update juga tampilan teknisi jika sedang di view sparepart
      const techSpView = document.getElementById('tech-sparepart');
      if (techSpView && techSpView.classList.contains('active')) {
        _techSpAllData = sparepartStore;
        renderTechSparepartList();
      }
    });
  }

  SHEET_CACHE.lastFetch['LaporanKerusakan'] = 0;
  SHEET_CACHE.LaporanKerusakan = null; // clear cache agar refresh benar-benar dari server

  // Invalidate dashboard cache agar supervisor dapat data baru
  SHEET_CACHE.lastFetch['BreakdownMaintenance'] = 0;

  // Refresh daftar laporan di background setelah jeda singkat
  // agar GAS sempat mengupdate status sebelum data di-fetch ulang
  setTimeout(() => loadLaporanKerusakanForTech(), 2500);

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Kirim Laporan Breakdown Maintenance`;
    if (isConnected) {
      showToast('Laporan breakdown berhasil disimpan! ✓', 'success');
    } else {
      showToast('Laporan breakdown dicatat (mode lokal). ✓', 'success');
    }
    showTechView('tech-home');
    resetBDForm();
  }, 1000);
}

function resetBDForm() {
  ['bd-machine','bd-failure','bd-tech-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('input-error'); }
  });
  // Reset "Selesai Diperbaiki" ke waktu sekarang (bukan dikosongkan)
  const downtimeEl = document.getElementById('bd-downtime');
  if (downtimeEl) { downtimeEl.value = nowDatetimeLocal(); downtimeEl.classList.remove('input-error'); }
  const bdMachineDisplay = document.getElementById('bd-machine-display');
  if (bdMachineDisplay) { bdMachineDisplay.textContent = '-- Pilih Mesin --'; bdMachineDisplay.classList.add('ss-placeholder'); }
  const bdFailureDisplay = document.getElementById('bd-failure-display');
  if (bdFailureDisplay) { bdFailureDisplay.textContent = '-- Pilih Jenis Kerusakan --'; bdFailureDisplay.classList.add('ss-placeholder'); }
  // Buka kunci field mesin
  const bdMachineWrap = document.getElementById('bd-machine-wrap');
  if (bdMachineWrap) { bdMachineWrap.classList.remove('ss-locked', 'ss-error'); }
  // Buka kunci field jenis kerusakan
  const bdFailureWrap = document.getElementById('bd-failure-wrap');
  if (bdFailureWrap) { bdFailureWrap.classList.remove('ss-locked', 'ss-error'); }
  // Clear laporan asal
  const laporanAsalEl = document.getElementById('bd-laporan-asal-id');
  if (laporanAsalEl) laporanAsalEl.value = '';
  const laporanAsalBanner = document.getElementById('bd-laporan-asal-banner');
  if (laporanAsalBanner) { laporanAsalBanner.classList.add('hidden'); laporanAsalBanner.classList.remove('banner-mandiri'); laporanAsalBanner.innerHTML = ''; }
  // Clear all dynamic description rows
  const list = document.getElementById('bd-desc-list');
  if (list) list.innerHTML = '';
  // Sembunyikan form wrapper kembali
  const formWrapper = document.getElementById('bd-form-wrapper');
  if (formWrapper) formWrapper.classList.add('hidden');
}

/* ══════════════════════════════════════════════════════════
   14b. DAFTAR LAPORAN KERUSAKAN (TEKNISI)
   — Ambil dari server, tampil di halaman BD
   ══════════════════════════════════════════════════════════ */

/*
 * HEADER SHEET LaporanKerusakan (dari Code.gs SHEET_HEADERS):
 * [0] Timestamp
 * [1] Nomor WR
 * [2] Nama Mesin
 * [3] Jenis Kerusakan
 * [4] Deskripsi
 * [5] Sejak Kapan
 * [6] Nama Pelapor
 * [7] Keterangan
 * [8] Status
 *
 * GAS doGet mengembalikan tiap baris sebagai object { header: value },
 * sehingga kita bisa langsung akses d['Status'], d['Keterangan'], dst.
 *
 * MASALAH UMUM: Jika header di sheet fisik Google Sheets berbeda urutan
 * dari Code.gs (misalnya karena sheet dibuat manual atau import lama),
 * maka d['Status'] bisa kosong/salah. Solusinya: normalisasi di bawah.
 */

/**
 * Normalisasi satu objek baris LaporanKerusakan.
 * Menangani dua kasus:
 * 1. Header sudah benar (Keterangan kol-8, Status kol-9) → tidak berubah.
 * 2. Header terbalik lama (Status kol-8, Keterangan kol-9) → swap otomatis.
 * 3. Status kosong sama sekali → default 'Menunggu'.
 */
function normalizeLaporanRow(d) {
  // Nilai status yang valid (lowercase)
  const STATUS_WORDS = ['menunggu', 'selesai', 'proses', 'diproses', 'pending',
    'open', 'done', 'finish', 'finished', 'completed', 'closed', 'resolved'];

  // Pastikan semua kolom string adalah string (Google Sheets bisa kirim number / Date)
  const normalized = {
    ...d,
    'Nomor WR':        String(d['Nomor WR'] || '').trim(),
    'Nama Mesin':      String(d['Nama Mesin'] || ''),
    'Jenis Kerusakan': String(d['Jenis Kerusakan'] || ''),
    'Deskripsi':       String(d['Deskripsi'] || ''),
    'Nama Pelapor':    String(d['Nama Pelapor'] || ''),
    'Keterangan':      String(d['Keterangan'] || '').trim(),
    'Status':          String(d['Status'] || '').trim(),
  };

  const rawStatus = normalized['Status'];
  const rawKet    = normalized['Keterangan'];
  const rawStatusLow = rawStatus.toLowerCase();
  const rawKetLow    = rawKet.toLowerCase();

  const statusLooksValid = STATUS_WORDS.some(w => rawStatusLow === w || rawStatusLow.startsWith(w));
  const ketLooksLikeStatus = STATUS_WORDS.some(w => rawKetLow === w || rawKetLow.startsWith(w));

  // Jika Status kosong atau bukan kata status, tapi Keterangan berisi kata status → kolom tertukar
  if ((!rawStatus || !statusLooksValid) && ketLooksLikeStatus) {
    return { ...normalized, 'Status': rawKet, 'Keterangan': rawStatus };
  }

  // Jika Status benar-benar kosong dan Keterangan juga tidak membantu → default Menunggu
  if (!rawStatus) {
    return { ...normalized, 'Status': 'Menunggu' };
  }

  return normalized;
}

async function loadLaporanKerusakanBackground() {
  // Fetch diam-diam di background — tidak menampilkan loading, tidak render ke UI
  // Dipanggil saat initTechnician() agar data sudah tersimpan di cache
  // sebelum user menekan tombol Breakdown Maintenance.
  if (!CONFIG.GAS_URL) return;
  try {
    const url = CONFIG.GAS_URL + '?sheet=LaporanKerusakan';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (res.ok) {
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (_) { /* ignore */ }
      if (json && json.status === 'ok' && Array.isArray(json.data)) {
        SHEET_CACHE.LaporanKerusakan = json.data.map(normalizeLaporanRow);
        SHEET_CACHE.lastFetch['LaporanKerusakan'] = Date.now();
        console.log('✓ [BG] LaporanKerusakan preloaded:', SHEET_CACHE.LaporanKerusakan.length, 'baris');
      }
    }
  } catch (e) {
    console.warn('[BG] LaporanKerusakan preload gagal —', e.message);
  }
}

async function loadLaporanKerusakanForTech() {
  const container = document.getElementById('tech-bd-laporan-list');
  if (!container) return;

  // ── Jika ada cache, render seketika tanpa loading ──
  if (SHEET_CACHE.LaporanKerusakan) {
    renderLaporanKerusakanTable(SHEET_CACHE.LaporanKerusakan, container);
  } else {
    // Belum ada cache sama sekali — tampilkan loading + card Perbaikan Mandiri
    container.innerHTML = `
      <div class="laporan-loading"><span class="btn-loader" style="display:inline-block;margin-right:8px"></span>Memuat Laporan Masuk...</div>
      ${renderLaporanMandiriSection()}`;
  }

  if (!CONFIG.GAS_URL) {
    container.innerHTML = `<div class="laporan-empty"><p>GAS URL belum dikonfigurasi.</p></div>${renderLaporanMandiriSection()}`;
    return;
  }

  // ── Fetch terbaru dengan timeout 15 detik ──
  let data = SHEET_CACHE.LaporanKerusakan || [];
  let fetchError = false;
  try {
    const url = CONFIG.GAS_URL + '?sheet=LaporanKerusakan';
    // AbortController untuk timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (res.ok) {
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (parseErr) {
        console.warn('loadLaporanKerusakanForTech: JSON parse error —', parseErr.message);
        fetchError = true;
      }
      if (json && json.status === 'ok' && Array.isArray(json.data)) {
        data = json.data.map(normalizeLaporanRow);
        SHEET_CACHE.LaporanKerusakan = data;
        SHEET_CACHE.lastFetch['LaporanKerusakan'] = Date.now();
        console.log('✓ LaporanKerusakan loaded:', data.length, 'baris',
          '| Status unik:', [...new Set(data.map(d => d['Status'] || '(kosong)'))].join(', '));
      } else {
        console.warn('loadLaporanKerusakanForTech: response tidak ok —', json);
        fetchError = true;
      }
    } else {
      console.warn('loadLaporanKerusakanForTech: HTTP error', res.status);
      fetchError = true;
    }
  } catch (e) {
    console.warn('loadLaporanKerusakanForTech: fetch gagal —', e.message);
    fetchError = true;
  }

  // Jika fetch gagal dan tidak ada data sama sekali, tampilkan error + mandiri
  if (fetchError && !data.length) {
    container.innerHTML = `
      <div class="laporan-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--text-3)">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>Gagal memuat laporan kerusakan.</p>
        <p style="font-size:.8rem;color:var(--text-3);margin-top:4px">Periksa koneksi atau konfigurasi GAS URL.</p>
        <button class="btn btn-ghost btn-sm" onclick="SHEET_CACHE.lastFetch['LaporanKerusakan']=0;loadLaporanKerusakanForTech()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Coba Lagi
        </button>
      </div>
      ${renderLaporanMandiriSection()}`;
    return;
  }

  // Re-render dengan data terbaru (menggantikan cache atau loading)
  renderLaporanKerusakanTable(data, container);
}

function renderLaporanKerusakanTable(data, container) {
  if (!data || !data.length) {
    container.innerHTML = `
      <div class="laporan-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--text-3)">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>Tidak ada laporan kerusakan masuk.</p>
        ${!CONFIG.GAS_URL ? `<p style="font-size:.8rem;color:var(--text-3)">Tips: Konfigurasi GAS URL agar data tersinkron.</p><button class="btn btn-ghost btn-sm" onclick="showGasSetupHint()">Cara Konfigurasi →</button>` : ''}
      </div>
      ${renderLaporanMandiriSection()}`;
    return;
  }

  // Hanya tampilkan card dengan Status persis "Menunggu".
  // Status lain (Selesai, Proses, dll.) TIDAK PERNAH ditampilkan.
  const pending = data.filter(d => {
    const status = String(d['Status'] || '').trim().toLowerCase();
    const wr      = String(d['Nomor WR'] || d['Nomor Work Request'] || '').trim();
    const isMenunggu = status === 'menunggu';
    return isMenunggu && !dismissedLaporanIds.has(wr);
  });

  console.log('renderLaporanKerusakanTable: total', data.length,
    '| pending', pending.length,
    '| Status unik:', [...new Set(data.map(d => `"${d['Status'] || ''}"`))].join(', '));

  let html = '';
  if (pending.length) {
    html += `<div class="laporan-section-title">
      <span class="laporan-badge-count danger">${pending.length}</span> Laporan Masuk — Perlu Tindakan
    </div>`;
    html += pending.map(d => renderLaporanCard(d, true)).join('');
  } else {
    html = `<div class="laporan-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--text-3)">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p>Tidak ada laporan kerusakan yang perlu ditangani.</p>
      <p style="font-size:.8rem;color:var(--text-3);margin-top:4px">Semua laporan sudah berstatus Selesai.</p>
    </div>`;
  }

  html += renderLaporanMandiriSection();
  container.innerHTML = html;
}

function renderLaporanMandiriSection() {
  return `
    <div class="laporan-mandiri-section">
      <div class="laporan-section-title laporan-mandiri-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--accent)">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
        </svg>
        Perbaikan Mandiri Teknisi
      </div>
      <div class="laporan-mandiri-desc">Gunakan ini untuk mencatat perbaikan mesin yang Anda temukan sendiri tanpa laporan dari requestor.</div>
      <button class="btn btn-primary laporan-mandiri-btn" id="btn-laporan-mandiri" onclick="openLaporanMandiri()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Laporan Mandiri
      </button>
    </div>`;
}

/* ── Parse timestamp — support format lokal id-ID maupun ISO ── */
function parseTimestamp(tsRaw) {
  if (!tsRaw) return null;
  if (tsRaw instanceof Date) return isNaN(tsRaw) ? null : tsRaw;
  const s = String(tsRaw).trim();
  if (!s || s === '—') return null;

  let d = new Date(s);
  if (!isNaN(d)) return d;

  // Format id-ID: "03/06/2026, 09.55.59"
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2})[.:](\d{2})(?:[.:](\d{2}))?/);
  if (m) {
    d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
    return isNaN(d) ? null : d;
  }
  return null;
}

function renderLaporanCard(d, showButton) {
  const nomorWR     = String(d['Nomor WR'] || d['Nomor Work Request'] || '—');
  const id          = nomorWR;
  const machineName = String(d['Nama Mesin'] || '—');
  const failure     = String(d['Jenis Kerusakan'] || '—');
  const desc        = String(d['Deskripsi'] || '');
  const reporter    = String(d['Nama Pelapor'] || '—');
  const status      = String(d['Status'] || 'Menunggu');
  const tsRaw       = d['Timestamp'];
  let tsDate = '—', tsTime = '';
  if (tsRaw) {
    const dt = parseTimestamp(tsRaw);
    if (dt) {
      tsDate = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      tsTime = dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  }
  const statusClass = status.toLowerCase() === 'selesai' ? 'badge-green' : 'badge-red';

  return `
    <div class="laporan-card glass" data-laporan-id="${id}">
      <div class="laporan-card-header">
        <div class="laporan-card-meta">
          <span class="laporan-wr-badge">${nomorWR}</span>
          <span class="badge ${statusClass}">${status}</span>
        </div>
        <span class="laporan-ts">${tsDate}${tsTime ? ' \u00b7 ' + tsTime : ''}</span>
      </div>
      <div class="laporan-card-body">
        <div class="laporan-machine">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
          <strong>${machineName}</strong>
        </div>
        <div class="laporan-failure-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--danger)"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          ${failure}
        </div>
        ${desc ? `<p class="laporan-desc">${desc}</p>` : ''}
        <div class="laporan-reporter">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Dilaporkan oleh: ${reporter}
        </div>
      </div>
      ${showButton ? `
      <div class="laporan-card-footer">
        <button class="btn btn-danger btn-sm" onclick="prefillBDFromLaporan('${id}','${machineName.replace(/'/g, "\\'")}','${failure.replace(/'/g, "\\'")}','${nomorWR.replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          Perbaiki
        </button>
      </div>` : ''}
    </div>`;
}

/* Isi form BD dari laporan yang dipilih teknisi */
window.prefillBDFromLaporan = function(laporanId, machineName, failure, nomorWR) {
  const laporanAsalEl = document.getElementById('bd-laporan-asal-id');
  if (laporanAsalEl) laporanAsalEl.value = laporanId;

  const displayWR = (nomorWR && nomorWR.trim()) ? nomorWR.trim() : laporanId;

  const banner = document.getElementById('bd-laporan-asal-banner');
  if (banner) {
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--orange)"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      Merespons Laporan: <strong>${displayWR}</strong>
    `;
    banner.classList.remove('hidden');
  }

  const bdMachineInput   = document.getElementById('bd-machine');
  const bdMachineDisplay = document.getElementById('bd-machine-display');
  const bdMachineWrap    = document.getElementById('bd-machine-wrap');
  const machineObj = MACHINES.find(m => m.name === machineName);
  if (bdMachineInput)   bdMachineInput.value = machineObj ? machineObj.id : '';
  if (bdMachineDisplay) {
    bdMachineDisplay.textContent = machineName;
    bdMachineDisplay.classList.remove('ss-placeholder');
  }
  if (bdMachineWrap) bdMachineWrap.classList.add('ss-locked');

  const bdFailureInput   = document.getElementById('bd-failure');
  const bdFailureDisplay = document.getElementById('bd-failure-display');
  const bdFailureWrap    = document.getElementById('bd-failure-wrap');
  if (bdFailureInput && failure) {
    bdFailureInput.value = failure;
    if (bdFailureDisplay) {
      bdFailureDisplay.textContent = failure;
      bdFailureDisplay.classList.remove('ss-placeholder');
    }
  }
  if (bdFailureWrap) {
    bdFailureWrap.classList.add('ss-locked');
  }

  const formWrapper = document.getElementById('bd-form-wrapper');
  if (formWrapper) formWrapper.classList.remove('hidden');

  const downtimeEl = document.getElementById('bd-downtime');
  if (downtimeEl) downtimeEl.value = nowDatetimeLocal();

  if (formWrapper) {
    setTimeout(() => formWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  showToast('Form diisi dari laporan ' + displayWR + ' — lengkapi dan kirim.', 'info');
};

window.showGasSetupHint = function() {
  showToast('Masukkan URL Google Apps Script di halaman Settings, atau langsung di variabel CONFIG.GAS_URL', 'info');
};

/* Buka form BD dalam mode Laporan Mandiri */
window.openLaporanMandiri = function() {
  resetBDForm();

  const banner = document.getElementById('bd-laporan-asal-banner');
  if (banner) {
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--accent)">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
      <strong>Laporan Mandiri</strong> — Perbaikan ditemukan sendiri oleh teknisi
    `;
    banner.classList.remove('hidden');
    banner.classList.add('banner-mandiri');
  }

  const formWrapper = document.getElementById('bd-form-wrapper');
  if (formWrapper) formWrapper.classList.remove('hidden');

  const downtimeEl = document.getElementById('bd-downtime');
  if (downtimeEl) downtimeEl.value = nowDatetimeLocal();

  if (formWrapper) {
    setTimeout(() => formWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  showToast('Mode Laporan Mandiri — isi form dan kirim laporan.', 'info');
};

/* ══════════════════════════════════════════════════════════
   14c. SUPERVISOR DASHBOARD — Load data dari server
   ══════════════════════════════════════════════════════════ */

async function loadBreakdownDataForSupervisor() {
  const container = document.getElementById('history-timeline');

  if (!CONFIG.GAS_URL) {
    _liveHistoryData = [];
    renderTimeline([]);
    return;
  }

  // Tampilkan loading
  if (container) {
    container.innerHTML = '<p style="color:var(--text-2);padding:32px;text-align:center">Memuat data riwayat…</p>';
  }

  // Fetch langsung (sama persis dengan cara loadLaporanKerusakanForTech yang sudah terbukti)
  async function fetchSheet(sheetName) {
    try {
      const url = CONFIG.GAS_URL + '?sheet=' + encodeURIComponent(sheetName);
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (!res.ok) return [];
      const text = await res.text();
      const json = JSON.parse(text);
      if (json && json.status === 'ok' && Array.isArray(json.data)) return json.data;
      return [];
    } catch (e) {
      console.warn('fetchSheet failed for', sheetName, e);
      return [];
    }
  }

  const [bdData, pmData, lkData] = await Promise.all([
    fetchSheet('BreakdownMaintenance'),
    fetchSheet('PreventiveMaintenance'),
    fetchSheet('LaporanKerusakan'),
  ]);

  const entries = [];

  // ── Breakdown entries ──
  bdData.forEach(row => {
    const ts = parseTimestamp(row['Timestamp']);
    entries.push({
      _rawDate:          ts,
      date:              ts ? ts.toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : (row['Timestamp'] || '—'),
      machine:           row['Nama Mesin'] || '—',
      type:              'breakdown',
      technician:        row['Nama Teknisi'] || '—',
      jenisKerusakan:    row['Jenis Kerusakan'] || '',
      deskripsiTindakan: row['Deskripsi Tindakan'] || '',
      desc:              row['Jenis Kerusakan'] || '—',
      downtime:          row['Durasi Downtime (jam)'] ? row['Durasi Downtime (jam)'] + ' jam' : '',
      nomorWR:           row['Nomor WR'] || '',
      status:            row['Status'] || '',
      keterangan:        row['Keterangan'] || '',
    });
  });

  // ── Preventive Maintenance entries ──
  pmData.forEach(row => {
    const ts = parseTimestamp(row['Timestamp']);
    const waktuMulai    = row['Waktu Mulai']    || '';
    const waktuSelesai  = row['Waktu Selesai']  || '';
    const hasilProsedur = row['Hasil Prosedur'] || '';

    // Format ISO datetime → "06 Jun 2026, 19:01" (WIB)
    const formatWaktu = val => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d)) return val; // sudah berupa teks biasa, kembalikan apa adanya
      return d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      });
    };
    const waktuMulaiFmt   = formatWaktu(waktuMulai);
    const waktuSelestaiFmt = formatWaktu(waktuSelesai);
    // Pecah hasil prosedur menjadi array (dipisah ' | ')
    const prosedurList  = hasilProsedur
      ? hasilProsedur.split(' | ').map(s => s.trim().replace(/^\[\d+\]\s*/, '')).filter(Boolean)
      : [];
    entries.push({
      _rawDate:      ts,
      date:          ts ? ts.toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : (row['Timestamp'] || '—'),
      machine:       row['Nama Mesin'] || '—',
      type:          'pm',
      technician:    row['Nama Teknisi'] || '—',
      desc:          'Preventive Maintenance',
      waktuMulai:    waktuMulaiFmt,
      waktuSelesai:  waktuSelestaiFmt,
      prosedurList,
      status:        row['Status'] || '',
    });
  });

  // Urutkan: terbaru di atas
  entries.sort((a, b) => {
    if (!a._rawDate && !b._rawDate) return 0;
    if (!a._rawDate) return 1;
    if (!b._rawDate) return -1;
    return b._rawDate - a._rawDate;
  });

  _liveHistoryData = entries;
  renderTimeline(_liveHistoryData);

  // Update badge notifikasi
  if (lkData.length) {
    updateBreakdownKPI(bdData, lkData);
  }

  // ── Bangun data live untuk chart Breakdown Bulanan ──
  buildLiveChartData(bdData, pmData);

  // ── Hitung MTBF & MTTR dari data live (dengan filter bulan/tahun) ──
  _pieBDData = bdData;
  updateMtbfMttrFiltered();

  // ── Simpan raw BD data untuk pie chart & redraw ──
  requestAnimationFrame(() => drawDashboardPieCharts());
}

function updateBreakdownKPI(bdData, lkData) {
  // Hitung laporan yang masih pending
  const pending = lkData.filter(d => (d['Status'] || '').toLowerCase() !== 'selesai').length;
  // Badge notifikasi
  const badge = document.querySelector('.notif-badge');
  if (badge && pending > 0) {
    badge.textContent = pending;
    badge.style.display = 'flex';
  } else if (badge) {
    badge.style.display = 'none';
  }
}

/* ── Bangun struktur { byMonth: { year: { month0: { bd, pm, days: {bd,pm} } } } } dari raw sheet data ── */
function buildLiveChartData(bdRaw, pmRaw) {
  const byMonth = {};

  // Struktur per bulan: { bd, pm, days, downtimeTotal, downtimeCount, timestamps[] }
  function ensureMonth(yr, mo) {
    if (!byMonth[yr]) byMonth[yr] = {};
    if (!byMonth[yr][mo]) {
      const daysInMonth = new Date(yr, mo + 1, 0).getDate();
      byMonth[yr][mo] = {
        bd: 0, pm: 0,
        days: { bd: Array(daysInMonth).fill(0), pm: Array(daysInMonth).fill(0) },
        downtimeTotal: 0, downtimeCount: 0,
        timestamps: [],
      };
    }
  }

  bdRaw.forEach(row => {
    const ts = parseTimestamp(row['Timestamp']);
    if (!ts) return;
    const yr = ts.getFullYear();
    const mo = ts.getMonth();
    const day = ts.getDate();
    ensureMonth(yr, mo);
    byMonth[yr][mo].bd++;
    const dayIdx = Math.min(day - 1, byMonth[yr][mo].days.bd.length - 1);
    byMonth[yr][mo].days.bd[dayIdx]++;
    byMonth[yr][mo].timestamps.push(ts.getTime());
    const dur = parseFloat(row['Durasi Downtime (jam)']);
    if (!isNaN(dur) && dur > 0) {
      byMonth[yr][mo].downtimeTotal += dur;
      byMonth[yr][mo].downtimeCount++;
    }
  });

  pmRaw.forEach(row => {
    const ts = parseTimestamp(row['Timestamp']);
    if (!ts) return;
    const yr = ts.getFullYear();
    const mo = ts.getMonth();
    const day = ts.getDate();
    ensureMonth(yr, mo);
    byMonth[yr][mo].pm++;
    const dayIdx = Math.min(day - 1, byMonth[yr][mo].days.pm.length - 1);
    byMonth[yr][mo].days.pm[dayIdx]++;
  });

  // Hitung MTBF & MTTR per bulan
  Object.values(byMonth).forEach(yearObj => {
    Object.values(yearObj).forEach(mo => {
      // MTTR = rata-rata downtime per event (hanya event dengan durasi tercatat)
      mo.mttr = mo.downtimeCount > 0 ? +(mo.downtimeTotal / mo.downtimeCount).toFixed(2) : 0;
      // MTBF = (span waktu dalam bulan - total downtime) / jumlah breakdown
      if (mo.bd >= 2 && mo.timestamps.length >= 2) {
        const sorted = [...mo.timestamps].sort((a, b) => a - b);
        const spanHours = (sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60);
        const operating = Math.max(0, spanHours - mo.downtimeTotal);
        mo.mtbf = +(operating / mo.bd).toFixed(2);
      } else if (mo.bd === 1 && mo.downtimeTotal > 0) {
        // Hanya 1 event: MTBF tidak dapat dihitung dari interval, set 0
        mo.mtbf = 0;
      } else {
        mo.mtbf = 0;
      }
    });
  });

  _liveChartData = { byMonth };

  // Sinkronkan filter tahun ke tahun terbaru yang ada datanya (atau tahun sekarang)
  const allYears = Object.keys(byMonth).map(Number);
  if (allYears.length > 0) {
    const currentYear = new Date().getFullYear();
    if (!allYears.includes(_bdFilterYear)) {
      _bdFilterYear = allYears.includes(currentYear) ? currentYear : Math.max(...allYears);
      const yearInput = document.getElementById('bd-filter-year');
      if (yearInput) yearInput.value = String(_bdFilterYear);
    }
  }

  // Redraw chart dengan data live
  requestAnimationFrame(() => drawBreakdownChart());
}

/* ── Hitung MTBF dan MTTR dari data BreakdownMaintenance ── */
function updateMtbfMttr(bdRaw) {
  const mtbfEl = document.getElementById('kpi-mtbf');
  const mttrEl = document.getElementById('kpi-mttr');
  if (!mtbfEl && !mttrEl) return;

  if (!bdRaw || bdRaw.length === 0) {
    if (mtbfEl) mtbfEl.innerHTML = '—';
    if (mttrEl) mttrEl.innerHTML = '—';
    return;
  }

  // MTTR: rata-rata durasi downtime per event (jam)
  let totalDowntime = 0, countWithDowntime = 0;
  bdRaw.forEach(row => {
    const durasi = parseFloat(row['Durasi Downtime (jam)']);
    if (!isNaN(durasi) && durasi > 0) {
      totalDowntime += durasi;
      countWithDowntime++;
    }
  });
  const mttr = countWithDowntime > 0 ? (totalDowntime / countWithDowntime) : null;

  // MTBF: estimasi dari rentang waktu total / jumlah breakdown
  // Ambil tanggal pertama & terakhir dalam data
  const timestamps = bdRaw
    .map(row => parseTimestamp(row['Timestamp']))
    .filter(Boolean)
    .map(d => d.getTime())
    .sort((a, b) => a - b);

  let mtbf = null;
  if (timestamps.length >= 2) {
    const spanHours = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60);
    // MTBF = total waktu operasi / jumlah breakdown
    // Waktu operasi ≈ total span - total downtime
    const operatingHours = Math.max(0, spanHours - totalDowntime);
    mtbf = operatingHours / timestamps.length;
  }

  // Format angka: tampilkan 1 desimal jika < 10, 0 desimal jika >= 10
  function fmtHours(h) {
    if (h === null) return '—';
    if (h < 10) return h.toFixed(1);
    return Math.round(h).toString();
  }

  if (mtbfEl) mtbfEl.innerHTML = fmtHours(mtbf);
  if (mttrEl) mttrEl.innerHTML = fmtHours(mttr);
}

/* ══════════════════════════════════════════════════════════
   15. TECH MACHINE HISTORY
   ══════════════════════════════════════════════════════════ */

function initTechHistory() {
  // Populate machine select in tech filter bar
  const techMachineSel = document.getElementById('tech-hist-machine-select');
  if (techMachineSel) {
    MACHINES.forEach(m => {
      techMachineSel.insertAdjacentHTML('beforeend', `<option value="${m.id}">${m.name}</option>`);
    });
  }

  // Tampilkan loading state, lalu muat data riwayat (sama seperti alur Riwayat Mesin Supervisor)
  const container = document.getElementById('tech-timeline');
  if (container) {
    container.innerHTML = '<p style="color:var(--text-2);text-align:center;padding:32px">Memuat data riwayat…</p>';
  }
  loadBreakdownDataForSupervisor().then(() => renderTechTimeline(_liveHistoryData));

  // Filter button — gunakan _liveHistoryData (data real dari server)
  const techFilterBtn = document.getElementById('tech-hist-filter-btn');
  if (techFilterBtn) {
    techFilterBtn.addEventListener('click', () => {
      const mf   = document.getElementById('tech-hist-machine-select').value;
      const from = document.getElementById('tech-hist-date-from').value;
      const to   = document.getElementById('tech-hist-date-to').value;
      const type = document.getElementById('tech-hist-type-filter').value;

      let data = [..._liveHistoryData];
      if (mf)   data = data.filter(d => d.machine === mf);
      if (type) data = data.filter(d => d.type === type);
      if (from) data = data.filter(d => d._rawDate && d._rawDate >= new Date(from));
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        data = data.filter(d => d._rawDate && d._rawDate <= toEnd);
      }
      renderTechTimeline(data);
    });
  }
}

function renderTechTimeline(data) {
  const container = document.getElementById('tech-timeline');
  const machineName = id => MACHINES.find(m => m.id === id)?.name || id;
  const icons = {
    breakdown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>`,
    pm:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    sparepart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  };

  if (!data.length) {
    container.innerHTML = '<p style="color:var(--text-2);text-align:center;padding:32px">Tidak ada riwayat ditemukan</p>';
    return;
  }

  container.innerHTML = data.map(d => `
    <div class="tl-entry">
      <div class="tl-dot ${d.type}">${icons[d.type]}</div>
      <div class="tl-body">
        <div class="tl-header">
          <span class="tl-machine">${machineName(d.machine)}</span>
          <span class="tl-time" style="font-size:.72rem">${d.date}</span>
        </div>
        <p class="tl-desc">${d.desc}</p>
        <div class="tl-meta">
          ${d.technician ? `<span class="tl-tag">👷 ${d.technician}</span>` : ''}
          ${d.keterangan ? `<span class="tl-tag">🏷 ${d.keterangan}</span>` : ''}
          ${d.downtime   ? `<span class="tl-tag">⏱ ${d.downtime}</span>` : ''}
          ${d.severity   ? `<span class="tl-tag" style="color:var(--danger)">⚠ ${d.severity}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════
   16. TECH SPAREPART
   ══════════════════════════════════════════════════════════ */

/* ── State untuk filter/search Kondisi Sparepart (Teknisi) ── */
let _techSpAllData  = [];
let _techSpSearch   = '';
let _techSpMachine  = '';
let _techSpSort     = 'status';

async function initTechSparepart() {
  const container = document.getElementById('tech-sparepart-list');
  if (!container) return;

  // Reset filter state on fresh load
  _techSpSearch  = '';
  _techSpMachine = '';
  _techSpSort    = 'status';
  _techSpAllData = [];

  // Tampilkan toolbar (search, filter, refresh) + loading seketika,
  // sebelum data sparepart selesai di-fetch.
  renderTechSparepartList(true);

  let data = [];

  if (CONFIG.GAS_URL) {
    // Selalu fetch data terbaru agar lifetime terupdate setelah pergantian
    try {
      const url  = CONFIG.GAS_URL + '?sheet=Sparepart';
      const res  = await fetch(url, { method: 'GET', redirect: 'follow' });
      const text = await res.text();
      const json = JSON.parse(text);
      if (json && json.status === 'ok' && Array.isArray(json.data)) {
        data = json.data.map(row => {
          const lifetimeDays = parseInt(row['Lifetime (hari)']) || 1;
          let lastReplace = row['Tanggal Penggantian Terakhir'];
          if (typeof lastReplace === 'number') {
            const epoch = new Date(1899, 11, 30);
            epoch.setDate(epoch.getDate() + lastReplace);
            lastReplace = epoch.toISOString().split('T')[0];
          } else if (typeof lastReplace === 'string') {
            if (/^\d{4}-\d{2}-\d{2}T/.test(lastReplace)) {
              lastReplace = lastReplace.split('T')[0];
            } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(lastReplace)) {
              const [d, m, y] = lastReplace.split('/');
              lastReplace = `${y}-${m}-${d}`;
            }
          }
          const calc = calcSparepartStatus(lastReplace, lifetimeDays);
          return {
            id:          (row['Nama Sparepart'] || '') + '_' + (row['Nama Mesin'] || ''),
            name:        row['Nama Sparepart'] || '',
            machine:     '',
            machineName: row['Nama Mesin'] || '',
            lifetimeDays,
            lastReplace,
            ...calc,
          };
        });
        // Sinkronkan sparepartStore global agar tampilan supervisor & dropdown BD juga segar
        sparepartStore = data;
        updateDashboardSpFromSheet();
        renderSparepartMgmtGrid();
      }
    } catch (e) {
      console.warn('Tech sparepart fetch failed:', e);
      // Gunakan sparepartStore sebagai fallback jika fetch gagal
      data = sparepartStore;
    }
  } else {
    // Tidak ada koneksi: gunakan sparepartStore yang ada
    data = sparepartStore;
  }

  if (!data.length) {
    // Fallback ke SPAREPARTDATA jika tidak ada koneksi dan store kosong
    data = SPAREPARTDATA.map(s => ({
      name: s.name.replace(/\s*\(MCH-\d+\)/, '').replace(/\s*\(AC-\d+\)/, '').trim(),
      machine: s.machine, life: s.life, status: s.status, nextReplace: s.nextReplace,
      sisaHari: Math.round(s.life * 3.65),
    }));
  }

  // Reset filter state on fresh load (sudah di-reset di awal sebelum fetch)
  _techSpAllData = data;

  renderTechSparepartList();
}
function renderTechSparepartList(loading = false) {
  const container = document.getElementById('tech-sparepart-list');
  if (!container) return;

  // Build unique machine names for filter dropdown
  const machineNames = [...new Set(_techSpAllData.map(s => s.machineName || '').filter(Boolean))].sort();

  // Toolbar HTML — always re-render controls, preserve state values
  const toolbarHtml = `
    <div class="tech-sp-toolbar" id="tech-sp-toolbar">
      <div class="tech-sp-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--text-3);flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="tech-sp-search-input" id="tech-sp-search" type="text" placeholder="Cari nama sparepart…" autocomplete="off" value="${_techSpSearch.replace(/"/g,'&quot;')}" />
      </div>
      <select class="tech-sp-machine-select" id="tech-sp-machine">
        <option value="">Semua Mesin</option>
        ${machineNames.map(m => `<option value="${m}"${m === _techSpMachine ? ' selected' : ''}>${m}</option>`).join('')}
      </select>
      <select class="tech-sp-sort-select" id="tech-sp-sort">
        <option value="status"${_techSpSort==='status'?' selected':''}>Kritis → Aktif</option>
        <option value="name"${_techSpSort==='name'?' selected':''}>Nama A–Z</option>
        <option value="life_asc"${_techSpSort==='life_asc'?' selected':''}>Sisa Life ↑</option>
        <option value="life_desc"${_techSpSort==='life_desc'?' selected':''}>Sisa Life ↓</option>
      </select>
      <button class="btn btn-ghost btn-sm tech-sp-refresh-btn" onclick="initTechSparepart()" title="Refresh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Refresh
      </button>
    </div>
  `;

  if (loading) {
    container.innerHTML = toolbarHtml + `<div class="sp-tech-loading"><span class="btn-loader" style="display:inline-block;margin-right:8px"></span>Memuat data kondisi sparepart…</div>`;
    wireUpTechSpToolbar(container);
    return;
  }

  // Apply filters
  let data = [..._techSpAllData];

  if (_techSpSearch) {
    const q = _techSpSearch.toLowerCase();
    data = data.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.machineName || '').toLowerCase().includes(q)
    );
  }
  if (_techSpMachine) {
    data = data.filter(s => (s.machineName || '') === _techSpMachine);
  }

  // Recalculate live status
  data = data.map(s => {
    const calc = calcSparepartStatus(s.lastReplace, s.lifetimeDays);
    return { ...s, ...calc };
  });

  // Sort
  const statusOrder = { critical: 0, warning: 1, good: 2 };
  if (_techSpSort === 'status') {
    data.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  } else if (_techSpSort === 'name') {
    data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (_techSpSort === 'life_asc') {
    data.sort((a, b) => (a.life ?? 100) - (b.life ?? 100));
  } else if (_techSpSort === 'life_desc') {
    data.sort((a, b) => (b.life ?? 100) - (a.life ?? 100));
  }

  const countHtml = `<div class="tech-sp-header">
    <span class="tech-sp-count">${data.length} dari ${_techSpAllData.length} sparepart</span>
  </div>`;

  if (!data.length) {
    const msg = (_techSpSearch || _techSpMachine)
      ? 'Tidak ada sparepart yang cocok dengan pencarian / filter.'
      : 'Tidak ada data sparepart.';
    container.innerHTML = toolbarHtml + countHtml + `<div class="sp-tech-item" style="text-align:center;color:var(--text-2)">${msg}</div>`;
  } else {
    const machineName = s => s.machineName || MACHINES.find(m => m.id === s.machine)?.name || s.machine;

    const itemsHtml = data.map(s => {
      const cdText = s.isOverdue
        ? `⚠ OVERDUE${s.daysOverdue > 0 ? ' — ' + s.daysOverdue + ' hari terlambat' : ''}`
        : s.sisaHari === 0
          ? '⏰ Jadwal penggantian hari ini'
          : `${s.sisaHari || 0} hari tersisa`;
      const lastReplaceStr = s.lastReplace ? formatDateYMD(s.lastReplace) : '—';
      const nextReplaceStr = s.isOverdue ? '⚠ OVERDUE' : (s.nextReplace ? formatDateYMD(s.nextReplace) : '—');
      const cdClass = s.isOverdue ? 'sp-countdown-overdue' : (s.status === 'warning' ? 'sp-countdown-warning' : 'sp-countdown-ok');
      return `
      <div class="sp-tech-item">
        <div class="sp-tech-top">
          <span class="sp-tech-name">${s.name}</span>
          <span class="sp-tech-status sps-${s.status}">${s.status==='good'?'Baik':s.status==='warning'?'Perhatian':'Kritis'}</span>
        </div>
        <div style="font-size:.75rem;color:var(--text-3);margin-bottom:6px">${machineName(s)}</div>
        <div class="sp-progress-bar">
          <div class="sp-progress-fill ${s.status}" style="width:${s.life}%"></div>
        </div>
        <div class="sp-countdown-row ${cdClass}" style="margin-top:6px;margin-bottom:4px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style="font-size:.78rem">${cdText}</span>
        </div>
        <div class="sp-tech-meta">
          <span>${s.life}% sisa usia pakai</span>
          <span class="${s.isOverdue ? 'sp-overdue-text' : ''}">${nextReplaceStr}</span>
        </div>
        <div class="sp-tech-meta" style="margin-top:3px;font-size:.72rem;color:var(--text-3)">
          <span>Terakhir diganti: ${lastReplaceStr}</span>
          <span>Lifetime: ${s.lifetimeDays || '—'} hari</span>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = toolbarHtml + countHtml + itemsHtml;
  }

  // Wire up toolbar controls after render
  wireUpTechSpToolbar(container);
}

function wireUpTechSpToolbar(container) {
  const searchEl  = container.querySelector('#tech-sp-search');
  const machineEl = container.querySelector('#tech-sp-machine');
  const sortEl    = container.querySelector('#tech-sp-sort');

  if (searchEl) {
    searchEl.addEventListener('input', e => {
      _techSpSearch = e.target.value.trim().toLowerCase();
      renderTechSparepartList();
    });
    // Keep focus if user was typing
    if (_techSpSearch) { searchEl.focus(); const len = searchEl.value.length; searchEl.setSelectionRange(len, len); }
  }
  if (machineEl) {
    machineEl.addEventListener('change', e => {
      _techSpMachine = e.target.value;
      renderTechSparepartList();
    });
  }
  if (sortEl) {
    sortEl.addEventListener('change', e => {
      _techSpSort = e.target.value;
      renderTechSparepartList();
    });
  }
}

/* ══════════════════════════════════════════════════════════
   SEARCHABLE SELECT — replaces native <select> elements
   ══════════════════════════════════════════════════════════ */

function initSearchableSelect(wrapId, options, placeholder, defaultValue) {
  const wrap     = document.getElementById(wrapId);
  if (!wrap) return;

  // Derive child element IDs from the wrap ID prefix
  const prefix   = wrapId.replace('-wrap', '');
  const display  = document.getElementById(prefix + '-display');
  const dropdown = document.getElementById(prefix + '-dropdown');
  const listEl   = document.getElementById(prefix + '-list');
  const hidden   = document.getElementById(prefix.replace('-machine-wrap','').replace('-wrap',''));

  // Fallback: scan children
  const allHidden  = wrap.querySelectorAll('input[type="hidden"]');
  const hiddenInput = allHidden[0];
  const searchInput = wrap.querySelector('.ss-search');

  function renderList(filter) {
    const q = (filter || '').toLowerCase();
    const filtered = options.filter(o => o.label.toLowerCase().includes(q));
    listEl.innerHTML = filtered.map(o =>
      `<div class="ss-option${hiddenInput.value === o.value ? ' selected' : ''}" data-value="${o.value}" data-label="${o.label}">${o.label}</div>`
    ).join('') || `<div class="ss-option ss-no-result">Tidak ditemukan</div>`;
  }

  function openDropdown() {
    document.querySelectorAll('.ss-dropdown').forEach(d => {
      if (d !== dropdown) d.classList.add('hidden');
    });
    dropdown.classList.remove('hidden');
    searchInput.value = '';
    renderList('');
    searchInput.focus();
  }

  function closeDropdown() {
    dropdown.classList.add('hidden');
    searchInput.value = '';
  }

  function selectOption(value, label) {
    hiddenInput.value = value;
    display.textContent = label || placeholder;
    display.classList.toggle('ss-placeholder', !value);
    closeDropdown();
    // Dispatch change event so form handlers can listen
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  display.addEventListener('click', e => {
    e.stopPropagation();
    if (dropdown.classList.contains('hidden')) openDropdown();
    else closeDropdown();
  });

  searchInput.addEventListener('input', () => renderList(searchInput.value));
  searchInput.addEventListener('click', e => e.stopPropagation());

  listEl.addEventListener('click', e => {
    const opt = e.target.closest('.ss-option');
    if (!opt || opt.classList.contains('ss-no-result')) return;
    selectOption(opt.dataset.value, opt.dataset.label);
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) closeDropdown();
  });

  // Set default if provided
  if (defaultValue !== undefined) {
    const def = options.find(o => o.value === defaultValue);
    if (def) selectOption(def.value, def.label);
    else { display.textContent = placeholder; display.classList.add('ss-placeholder'); }
  } else {
    display.textContent = placeholder;
    display.classList.add('ss-placeholder');
  }

  renderList('');
}

/* Also init BD failure options when BD form is initialized */
function initBDFailureSelect() {
  const BD_FAILURES = [
    { value: 'Sistem Pneumatik dan Seal',                        label: 'Sistem Pneumatik dan Seal' },
    { value: 'Sistem Pemotongan (Pisau)',                        label: 'Sistem Pemotongan (Pisau)' },
    { value: 'Sistem Sealing (Vertical, Horizontal, Neck Seal)', label: 'Sistem Sealing (Vertical, Horizontal, Neck Seal)' },
    { value: 'Sistem Film/Foil/OPP Handling',                   label: 'Sistem Film/Foil/OPP Handling' },
    { value: 'Sistem Conveyor dan Jalur Produk',                 label: 'Sistem Conveyor dan Jalur Produk' },
    { value: 'Sistem Pengisian (Filling & Dosing)',              label: 'Sistem Pengisian (Filling & Dosing)' },
    { value: 'Sistem Elektrikal dan Instrumentasi',              label: 'Sistem Elektrikal dan Instrumentasi' },
    { value: 'Sistem Inkjet dan Coding',                         label: 'Sistem Inkjet dan Coding' },
    { value: 'Sistem Pompa dan Motor',                           label: 'Sistem Pompa dan Motor' },
  ];
  initSearchableSelect('bd-failure-wrap', BD_FAILURES, '-- Pilih Jenis Kerusakan --');
}

/* ══════════════════════════════════════════════════════════
   PRODUCTION — Laporan Perbaikan Mandiri (submit)
   ══════════════════════════════════════════════════════════ */

async function submitProductionMandiri() {
  const machine    = document.getElementById('prod-bd-machine').value;
  const failure    = document.getElementById('prod-bd-failure').value;
  const selesaiVal = document.getElementById('prod-bd-downtime').value;
  const techName   = document.getElementById('prod-bd-tech-name').value.trim();

  const descRows = [...document.querySelectorAll('#prod-bd-desc-list .bd-desc-row')].map(row => {
    const type = row.querySelector('.bd-desc-type').value;
    const text = row.querySelector('.bd-desc-text')?.value.trim() || '';
    return { type, text };
  });

  // Validasi
  let hasError = false;
  function markSS(wrapId, isEmpty) {
    const el = document.getElementById(wrapId);
    if (!el) return;
    if (isEmpty) { el.classList.add('ss-error'); hasError = true; }
    else el.classList.remove('ss-error');
  }
  function markField(id, isEmpty) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isEmpty) { el.classList.add('input-error'); hasError = true; }
    else el.classList.remove('input-error');
  }

  markSS('prod-bd-machine-wrap', !machine);
  markSS('prod-bd-failure-wrap', !failure);
  markField('prod-bd-downtime', !selesaiVal);
  markField('prod-bd-tech-name', !techName);

  const filledDescs = descRows.filter(r => r.type && r.text);
  if (descRows.length === 0 || filledDescs.length === 0) {
    showToast('Mohon tambahkan minimal satu deskripsi tindakan', 'error');
    hasError = true;
  }

  if (hasError) {
    showToast('Mohon isi semua field yang wajib diisi', 'error');
    return;
  }

  const btn = document.getElementById('prod-bd-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-loader"></span> Mengirim…';

  const machineName          = machineNameFromId(machine);
  const descSummary          = descRows.map(r => `[${r.type}] ${r.text}`).filter(s => s.length > 4).join(' | ');
  const sparepartDigantiList = descRows
    .filter(r => r.type === 'Pergantian Sparepart' && r.text)
    .map(r => r.text)
    .join(', ');

  // Timestamp sama persis dengan submitBD teknisi
  const nowTs = new Date();
  const tsFormatted = nowTs.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  // Row: [Timestamp, Nomor WR, Nama Mesin, Jenis Kerusakan, Durasi Downtime,
  //       Deskripsi Tindakan, Sparepart Diganti, Nama Teknisi, Status, Keterangan]
  const row = [
    tsFormatted,
    '',                    // Nomor WR — kosong (mandiri)
    machineName,
    failure,
    selesaiVal,
    descSummary,
    sparepartDigantiList,
    techName,
    'Selesai',
    ''
  ];

  await gasPost('BreakdownMaintenance', row);

  // Catat pergantian sparepart
  const sparepartRows = descRows.filter(r => r.type === 'Pergantian Sparepart' && r.text);
  if (sparepartRows.length > 0 && CONFIG.GAS_URL) {
    const todayStr = new Date().toISOString().split('T')[0];
    for (const spRow of sparepartRows) {
      const spName       = spRow.text;
      const existing     = sparepartStore.find(s => s.name === spName && s.machineName === machineName);
      const lifetimeDays = existing ? existing.lifetimeDays : 365;
      const nextDate     = new Date(todayStr);
      nextDate.setDate(nextDate.getDate() + lifetimeDays);
      await gasPostRaw({
        sheet: 'Sparepart',
        action: 'updateSparepartReplace',
        sparepartName: spName,
        machineName,
        lifetimeDays,
        newLastReplace: todayStr,
        newNextReplace: nextDate.toISOString().split('T')[0],
        nomorWR: '-',
      });
      if (existing) {
        const { life, status, nextReplace, isOverdue, sisaHari } = calcSparepartStatus(todayStr, lifetimeDays);
        existing.lastReplace = todayStr;
        existing.nextReplace = nextReplace;
        existing.life = life; existing.status = status;
        existing.isOverdue = isOverdue; existing.sisaHari = sisaHari;
      }
    }
    SHEET_CACHE.lastFetch['Sparepart'] = 0;
  }

  // Reset form
  btn.disabled = false;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Kirim Laporan Breakdown Maintenance`;

  showToast('Laporan Mandiri berhasil dikirim!', 'success');

  document.getElementById('prod-bd-machine').value = '';
  document.getElementById('prod-bd-machine-display').textContent = '-- Pilih Mesin --';
  document.getElementById('prod-bd-machine-display').classList.add('ss-placeholder');
  document.getElementById('prod-bd-failure').value = '';
  document.getElementById('prod-bd-failure-display').textContent = '-- Pilih Jenis Kerusakan --';
  document.getElementById('prod-bd-failure-display').classList.add('ss-placeholder');
  document.getElementById('prod-bd-downtime').value = nowDatetimeLocal();
  document.getElementById('prod-bd-tech-name').value = '';
  document.getElementById('prod-bd-desc-list').innerHTML = '';
}

/* ══════════════════════════════════════════════════════════
   17. UTILITIES
   ══════════════════════════════════════════════════════════ */

/* Format tanggal apapun menjadi yyyy-MM-dd, strip bagian waktu jika ada */
function formatDateYMD(raw) {
  if (!raw) return '—';
  const s = String(raw);
  // ISO datetime: "2026-06-02T17:00:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];
  // Sudah yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd/MM/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}
function showToast(message, type = 'info') {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icons[type]}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function previewPhoto(input, previewId) {
  const preview = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ══════════════════════════════════════════════════════════
   18. INIT ON LOAD
   ══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   19. RIWAYAT LAINNYA — Requestor, PM, Breakdown
   ══════════════════════════════════════════════════════════ */

/* ── Helper: populate year dropdowns ── */
function populateYearSelect(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const current = new Date().getFullYear();
  el.innerHTML = '<option value="">Semua Tahun</option>';
  for (let y = current; y >= current - 5; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    el.appendChild(opt);
  }
}

/* ── Helper: filter rows by month/year using a date string field ── */
function filterByMonthYear(rows, month, year, dateField) {
  return rows.filter(row => {
    const raw = row[dateField] || '';
    if (!raw) return true; // no date → don't hide
    const d = new Date(raw);
    if (isNaN(d)) return true;
    const rowMonth = d.getMonth() + 1;
    const rowYear  = d.getFullYear();
    if (month && rowMonth !== parseInt(month)) return false;
    if (year  && rowYear  !== parseInt(year))  return false;
    return true;
  });
}

/* ── Helper: format date for table cell ── */
function fmtTableDate(raw) {
  if (!raw) return '<span style="color:var(--text-muted)">—</span>';
  const d = new Date(raw);
  if (isNaN(d)) return `<span class="riwayat-date-cell">${raw}</span>`;
  const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `<span class="riwayat-date-cell"><span class="rdt-date">${dateStr}</span><span class="rdt-time">${timeStr}</span></span>`;
}

/* ── Helper: status text (teks biasa, tanpa badge/warna) ── */
function riwayatBadge(status) {
  if (!status) return '—';
  return String(status);
}

/* ── Helper: ubah string gabungan (dipisah '|') menjadi list bernomor ke bawah
     "1. xxx<br>2. yyy<br>3. zzz" — dipakai untuk kolom Hasil Prosedur & Tindakan Perbaikan ── */
function toNumberedList(str, lineBreak = '<br>') {
  if (!str || str === '—') return '—';
  const items = String(str).split('|').map(s => s.trim()).filter(Boolean);
  if (!items.length) return '—';
  return items.map((item, i) => `${i + 1}. ${item}`).join(lineBreak);
}

/* ── Cache ── */
let _riwayatReqData = null;
let _riwayatPMData  = null;
let _riwayatBDData  = null;
// Baris yang sedang ditampilkan (setelah filter) — dipakai oleh tombol "Unduh PDF" per baris
let _riwayatReqRowsCurrent = [];
let _riwayatPMRowsCurrent  = [];
let _riwayatBDRowsCurrent  = [];
// Map Nomor WR -> Deskripsi awal kerusakan (dari sheet LaporanKerusakan),
// dipakai untuk mengisi kolom "Deskripsi Kerusakan" di tabel Riwayat Input BD
// (BreakdownMaintenance sendiri tidak punya kolom ini, hanya "Deskripsi Tindakan")
let _riwayatBDLaporanMap = {};

/* ════ INIT ════ */
function initRiwayatLainnya() {
  populateYearSelect('riwayat-req-year');
  populateYearSelect('riwayat-pm-year');
  populateYearSelect('riwayat-bd-year');

  // ── Requestor ──
  document.getElementById('riwayat-req-filter-btn').addEventListener('click', () => renderRiwayatRequestor());
  document.getElementById('riwayat-req-reset-btn').addEventListener('click', () => {
    document.getElementById('riwayat-req-month').value = '';
    document.getElementById('riwayat-req-year').value  = '';
    renderRiwayatRequestor();
  });
  document.getElementById('riwayat-req-refresh-btn').addEventListener('click', () => loadRiwayatRequestor(true));

  // ── PM ──
  document.getElementById('riwayat-pm-filter-btn').addEventListener('click', () => renderRiwayatPM());
  document.getElementById('riwayat-pm-reset-btn').addEventListener('click', () => {
    document.getElementById('riwayat-pm-month').value = '';
    document.getElementById('riwayat-pm-year').value  = '';
    renderRiwayatPM();
  });
  document.getElementById('riwayat-pm-refresh-btn').addEventListener('click', () => loadRiwayatPM(true));

  // ── BD ──
  document.getElementById('riwayat-bd-filter-btn').addEventListener('click', () => renderRiwayatBD());
  document.getElementById('riwayat-bd-reset-btn').addEventListener('click', () => {
    document.getElementById('riwayat-bd-month').value = '';
    document.getElementById('riwayat-bd-year').value  = '';
    renderRiwayatBD();
  });
  document.getElementById('riwayat-bd-refresh-btn').addEventListener('click', () => loadRiwayatBD(true));
}

/* ════ LOAD from GAS — hanya dari sheet, tanpa data dummy ════ */

async function loadRiwayatRequestor(force = false) {
  if (!force && _riwayatReqData !== null) { renderRiwayatRequestor(); return; }
  showRiwayatLoading('riwayat-req-tbody', 11, 'var(--accent)');
  const result = await fetchSheetData('LaporanKerusakan', force);
  _riwayatReqData = (result && Array.isArray(result)) ? result : [];
  renderRiwayatRequestor();
}

async function loadRiwayatPM(force = false) {
  if (!force && _riwayatPMData !== null) { renderRiwayatPM(); return; }
  showRiwayatLoading('riwayat-pm-tbody', 9, 'var(--success)');
  const result = await fetchSheetData('PreventiveMaintenance', force);
  _riwayatPMData = (result && Array.isArray(result)) ? result : [];
  renderRiwayatPM();
}

async function loadRiwayatBD(force = false) {
  if (!force && _riwayatBDData !== null) { renderRiwayatBD(); return; }
  showRiwayatLoading('riwayat-bd-tbody', 12, 'var(--danger)');
  const result = await fetchSheetData('BreakdownMaintenance', force);
  _riwayatBDData = (result && Array.isArray(result)) ? result : [];

  // Ambil deskripsi kerusakan awal dari sheet LaporanKerusakan, cocokkan via Nomor WR
  const laporanData = await fetchSheetData('LaporanKerusakan');
  _riwayatBDLaporanMap = {};
  (laporanData || []).forEach(l => {
    const wr = String(l['Nomor WR'] || l.nomorWR || '').trim();
    if (wr) _riwayatBDLaporanMap[wr] = l['Deskripsi'] || l.deskripsi || '';
  });

  renderRiwayatBD();
}

function showRiwayatLoading(tbodyId, cols, color) {
  const el = document.getElementById(tbodyId);
  if (!el) return;
  el.innerHTML = `<tr><td colspan="${cols}" class="riwayat-empty-cell">
    <div class="riwayat-loading-state">
      <span class="btn-loader" style="width:18px;height:18px;border-width:2px;border-color:var(--border-md);border-top-color:${color}"></span>
      <span>Memuat data…</span>
    </div>
  </td></tr>`;
}

function noDataRow(cols) {
  return `<tr><td colspan="${cols}" class="riwayat-empty-cell">
    <div class="riwayat-no-data">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      <span>Belum ada data pada sheet ini</span>
    </div>
  </td></tr>`;
}

function noFilterRow(cols) {
  return `<tr><td colspan="${cols}" class="riwayat-empty-cell">
    <div class="riwayat-no-data">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>Tidak ada data yang cocok dengan filter ini</span>
    </div>
  </td></tr>`;
}

/* ════ RENDER FUNCTIONS ════ */

function renderRiwayatRequestor() {
  const tbody = document.getElementById('riwayat-req-tbody');
  const count = document.getElementById('riwayat-req-count');
  if (!tbody || !_riwayatReqData) return;

  if (!_riwayatReqData.length) { tbody.innerHTML = noDataRow(11); if (count) count.textContent = '0 data'; return; }

  const month = document.getElementById('riwayat-req-month').value;
  const year  = document.getElementById('riwayat-req-year').value;

  const dateField = _riwayatReqData[0] && _riwayatReqData[0].timestamp ? 'timestamp' : 'Timestamp';
  let rows = filterByMonthYear(_riwayatReqData, month, year, dateField);

  if (count) count.textContent = rows.length + ' data';

  if (!rows.length) { tbody.innerHTML = noFilterRow(11); return; }

  _riwayatReqRowsCurrent = rows;

  tbody.innerHTML = rows.map((r, i) => {
    const ts   = r.timestamp   || r.Timestamp   || r['Tanggal/Waktu'] || '';
    const wr   = r.nomorWR     || r.NomorWR      || r['Nomor WR']     || '—';
    const mesin= r.mesin       || r.Mesin        || r['Nama Mesin']   || '—';
    const jk   = r.jenisKerusakan || r['Jenis Kerusakan'] || '—';
    const desc = r.deskripsi   || r.Deskripsi    || '—';
    const sejak= r.sejak       || r.Sejak        || r['Sejak Kapan']  || '';
    const nama = r.namaPelapor || r['Nama Pelapor'] || r.NamaPelapor || '—';
    const ket  = r.keterangan  || r.Keterangan   || '—';
    const stat = r.status      || r.Status       || 'Pending';
    return `<tr>
      <td class="riwayat-no-cell">${i + 1}</td>
      <td>${fmtTableDate(ts)}</td>
      <td class="riwayat-wr-cell">${wr}</td>
      <td class="riwayat-machine-cell">${mesin}</td>
      <td>${jk}</td>
      <td class="riwayat-desc-cell">${desc}</td>
      <td>${fmtTableDate(sejak)}</td>
      <td style="white-space:nowrap">${nama}</td>
      <td style="white-space:nowrap">${ket}</td>
      <td>${riwayatBadge(stat)}</td>
      <td class="riwayat-pdf-cell">
        <button class="btn btn-ghost btn-sm riwayat-row-pdf-btn" onclick="downloadPdfRiwayatReqRow(${i})" title="Unduh PDF laporan ini">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderRiwayatPM() {
  const tbody = document.getElementById('riwayat-pm-tbody');
  const count = document.getElementById('riwayat-pm-count');
  if (!tbody || !_riwayatPMData) return;

  if (!_riwayatPMData.length) { tbody.innerHTML = noDataRow(9); if (count) count.textContent = '0 data'; return; }

  const month = document.getElementById('riwayat-pm-month').value;
  const year  = document.getElementById('riwayat-pm-year').value;

  const dateField = _riwayatPMData[0] && _riwayatPMData[0].timestamp ? 'timestamp' : 'Timestamp';
  let rows = filterByMonthYear(_riwayatPMData, month, year, dateField);

  if (count) count.textContent = rows.length + ' data';

  if (!rows.length) { tbody.innerHTML = noFilterRow(9); return; }

  _riwayatPMRowsCurrent = rows;

  tbody.innerHTML = rows.map((r, i) => {
    const ts     = r.timestamp     || r.Timestamp      || '';
    const mesin  = r.mesin         || r.Mesin          || r['Nama Mesin']    || '—';
    const mulai  = r.waktuMulai    || r['Waktu Mulai']  || r.waktuSelesai    || '—';
    const selesai= r.waktuSelesai  || r['Waktu Selesai']|| '—';
    const hasil  = r.hasilProsedur || r['Hasil Prosedur'] || r.HasilProsedur || r.hasilCek || r['Hasil Cek'] || '—';
    const tek    = r.namaTeknisi   || r['Nama Teknisi']  || r.teknisi || r.Teknisi || '—';
    const stat   = r.status        || r.Status          || 'Pending';
    return `<tr>
      <td class="riwayat-no-cell">${i + 1}</td>
      <td>${fmtTableDate(ts)}</td>
      <td class="riwayat-machine-cell">${mesin}</td>
      <td>${fmtTableDate(mulai)}</td>
      <td>${fmtTableDate(selesai)}</td>
      <td class="riwayat-desc-cell">${toNumberedList(hasil)}</td>
      <td style="white-space:nowrap">${tek}</td>
      <td>${riwayatBadge(stat)}</td>
      <td class="riwayat-pdf-cell">
        <button class="btn btn-ghost btn-sm riwayat-row-pdf-btn" onclick="downloadPdfRiwayatPMRow(${i})" title="Unduh PDF input ini">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderRiwayatBD() {
  const tbody = document.getElementById('riwayat-bd-tbody');
  const count = document.getElementById('riwayat-bd-count');
  if (!tbody || !_riwayatBDData) return;

  if (!_riwayatBDData.length) { tbody.innerHTML = noDataRow(12); if (count) count.textContent = '0 data'; return; }

  const month = document.getElementById('riwayat-bd-month').value;
  const year  = document.getElementById('riwayat-bd-year').value;

  const dateField = _riwayatBDData[0] && _riwayatBDData[0].timestamp ? 'timestamp' : 'Timestamp';
  let rows = filterByMonthYear(_riwayatBDData, month, year, dateField);

  if (count) count.textContent = rows.length + ' data';

  if (!rows.length) { tbody.innerHTML = noFilterRow(12); return; }

  _riwayatBDRowsCurrent = rows;

  tbody.innerHTML = rows.map((r, i) => {
    const ts   = r.timestamp          || r.Timestamp          || '';
    const wr   = r.nomorWR            || r.NomorWR            || r['Nomor WR']              || '—';
    const mesin= r.mesin              || r.Mesin              || r['Nama Mesin']            || '—';
    const jk   = r.jenisKerusakan     || r['Jenis Kerusakan']                               || '—';
    const desc = _riwayatBDLaporanMap[String(wr).trim()] || r['Deskripsi Kerusakan'] || r.deskripsiKerusakan || '—';
    const act  = r['Deskripsi Tindakan'] || r.deskripsiTindakan || r['Tindakan Perbaikan'] || r.tindakanPerbaikan || '—';
    const sp   = r['Sparepart Diganti']  || r.sparepartDiganti                              || '—';
    const tek  = r.namaTeknisi        || r['Nama Teknisi']    || r.teknisi || r.Teknisi     || '—';
    const dur  = r.durasiDowntime     || r['Durasi Downtime (jam)'] || r.durasiBD || r['Durasi BD'] || r.durasi || '—';
    const stat = r.statusAkhir        || r.status             || r.Status                   || 'Pending';
    const durStr = (dur && dur !== '—') ? dur + ' jam' : '—';
    return `<tr>
      <td class="riwayat-no-cell">${i + 1}</td>
      <td>${fmtTableDate(ts)}</td>
      <td class="riwayat-wr-cell">${wr}</td>
      <td class="riwayat-machine-cell">${mesin}</td>
      <td>${jk}</td>
      <td class="riwayat-desc-cell">${desc}</td>
      <td class="riwayat-action-cell">${toNumberedList(act)}</td>
      <td style="font-size:.8rem;color:var(--text-2)">${sp}</td>
      <td style="white-space:nowrap">${tek}</td>
      <td style="text-align:center">${durStr}</td>
      <td>${riwayatBadge(stat)}</td>
      <td class="riwayat-pdf-cell">
        <button class="btn btn-ghost btn-sm riwayat-row-pdf-btn" onclick="downloadPdfRiwayatBDRow(${i})" title="Unduh PDF input ini">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   20. UNDUH PDF — jsPDF + autotable
   ══════════════════════════════════════════════════════════ */

/* ── Helper: header PDF standar PRIMA ── */
function _pdfHeader(doc, judul, filterLabel) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 30, 46);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PRIMA — Performance Recording and Inspection for Machine Assets', pageW / 2, 11, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(judul, pageW / 2, 19, { align: 'center' });
  doc.setTextColor(40, 40, 60);
  doc.setFontSize(8);
  const now = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text('Dicetak: ' + now, 14, 34);
  if (filterLabel) {
    doc.setFont('helvetica', 'bold');
    doc.text('Filter: ' + filterLabel, 14, 40);
    doc.setFont('helvetica', 'normal');
  }
  return filterLabel ? 45 : 38;
}

/* ── Helper: nama bulan Indonesia ── */
function _namaBulan(m) {
  return ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][parseInt(m) - 1] || '';
}

/* ── Helper: strip HTML tags ── */
function _stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/* ── Helper: baca teks dari cell td ── */
function _cellText(td) {
  return _stripHtml(td ? td.innerHTML : '').trim().replace(/\s+/g, ' ');
}

/* ── Helper: buat label filter bulan/tahun ── */
function _filterLabel(monthVal, yearVal) {
  const parts = [];
  if (monthVal) parts.push(_namaBulan(monthVal));
  if (yearVal)  parts.push(yearVal);
  return parts.length ? parts.join(' ') : 'Semua Data';
}

/* ── Helper: PDF satu record (Field/Detail) — dipakai tombol "Unduh PDF" per baris ── */
function _downloadPdfRecord(title, fieldsObj, filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const startY = _pdfHeader(doc, title, '');
  const body = Object.entries(fieldsObj).map(([k, v]) => [k, (v === undefined || v === null || v === '') ? '—' : String(v)]);

  doc.autoTable({
    startY,
    head: [['Field', 'Detail']],
    body,
    styles: { fontSize: 9, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 255] },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename);
  showToast('PDF berhasil diunduh', 'success');
}

/* ════ Per-baris PDF: Riwayat Requestor ════ */
window.downloadPdfRiwayatReqRow = function(idx) {
  const r = _riwayatReqRowsCurrent[idx];
  if (!r) { showToast('Data tidak ditemukan', 'error'); return; }

  const ts    = r.timestamp    || r.Timestamp    || r['Tanggal/Waktu'] || '';
  const wr    = r.nomorWR      || r.NomorWR      || r['Nomor WR']      || '—';
  const mesin = r.mesin        || r.Mesin        || r['Nama Mesin']    || '—';
  const jk    = r.jenisKerusakan || r['Jenis Kerusakan']               || '—';
  const desc  = r.deskripsi    || r.Deskripsi                          || '—';
  const sejak = r.sejak        || r.Sejak        || r['Sejak Kapan']   || '—';
  const nama  = r.namaPelapor  || r['Nama Pelapor'] || r.NamaPelapor  || '—';
  const ket   = r.keterangan   || r.Keterangan                         || '—';
  const stat  = r.status       || r.Status       || 'Pending';

  const fmt = v => { if (!v || v === '—') return '—'; const d = new Date(v); return isNaN(d) ? v : d.toLocaleString('id-ID', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}); };

  _downloadPdfRecord(
    'Laporan Kerusakan — Requestor',
    {
      'No. WR'          : wr,
      'Tgl / Waktu'     : fmt(ts),
      'Mesin'           : mesin,
      'Jenis Kerusakan' : jk,
      'Deskripsi'       : desc,
      'Sejak Kapan'     : fmt(sejak),
      'Nama Pelapor'    : nama,
      'Keterangan'      : ket,
      'Status'          : stat,
    },
    `LaporanKerusakan_${wr}_PRIMA.pdf`
  );
};

/* ════ Per-baris PDF: Riwayat Input PM ════ */
window.downloadPdfRiwayatPMRow = function(idx) {
  const r = _riwayatPMRowsCurrent[idx];
  if (!r) { showToast('Data tidak ditemukan', 'error'); return; }

  const ts      = r.timestamp     || r.Timestamp     || '';
  const mesin   = r.mesin         || r.Mesin         || r['Nama Mesin']    || '—';
  const mulai   = r.waktuMulai    || r['Waktu Mulai']                       || '—';
  const selesai = r.waktuSelesai  || r['Waktu Selesai']                     || '—';
  const hasil   = r.hasilProsedur || r['Hasil Prosedur'] || r.hasilCek || r['Hasil Cek'] || '—';
  const tek     = r.namaTeknisi   || r['Nama Teknisi'] || r.teknisi || r.Teknisi         || '—';
  const stat    = r.status        || r.Status         || 'Pending';

  const fmt = v => { if (!v || v === '—') return '—'; const d = new Date(v); return isNaN(d) ? v : d.toLocaleString('id-ID', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}); };

  _downloadPdfRecord(
    'Input Preventive Maintenance',
    {
      'Tgl / Waktu'     : fmt(ts),
      'Mesin'           : mesin,
      'Waktu Mulai'     : fmt(mulai),
      'Waktu Selesai'   : fmt(selesai),
      'Hasil Prosedur'  : hasil,
      'Nama Teknisi'    : tek,
      'Status'          : stat,
    },
    `InputPM_${mesin.replace(/\s+/g,'_')}_${fmt(ts).replace(/[/:, ]+/g,'-')}_PRIMA.pdf`
  );
};

/* ════ Per-baris PDF: Riwayat Input Breakdown ════ */
window.downloadPdfRiwayatBDRow = function(idx) {
  const r = _riwayatBDRowsCurrent[idx];
  if (!r) { showToast('Data tidak ditemukan', 'error'); return; }

  const ts   = r.timestamp          || r.Timestamp          || '';
  const wr   = r.nomorWR            || r.NomorWR            || r['Nomor WR']            || '—';
  const mesin= r.mesin              || r.Mesin              || r['Nama Mesin']          || '—';
  const jk   = r.jenisKerusakan     || r['Jenis Kerusakan']                             || '—';
  const desc = _riwayatBDLaporanMap[String(wr).trim()] || r['Deskripsi Kerusakan'] || r.deskripsiKerusakan || '—';
  const act  = r['Deskripsi Tindakan'] || r.deskripsiTindakan || r['Tindakan Perbaikan'] || r.tindakanPerbaikan || '—';
  const sp   = r['Sparepart Diganti']  || r.sparepartDiganti                            || '—';
  const tek  = r.namaTeknisi        || r['Nama Teknisi']    || r.teknisi || r.Teknisi   || '—';
  const dur  = r.durasiDowntime     || r['Durasi Downtime (jam)'] || r.durasiBD || r['Durasi BD'] || r.durasi || '—';
  const stat = r.statusAkhir        || r.status             || r.Status                 || 'Pending';

  const fmt = v => { if (!v || v === '—') return '—'; const d = new Date(v); return isNaN(d) ? v : d.toLocaleString('id-ID', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
  const durStr = (dur && dur !== '—') ? dur + ' jam' : '—';

  _downloadPdfRecord(
    'Input Breakdown Maintenance',
    {
      'No. WR'               : wr,
      'Tgl / Waktu'          : fmt(ts),
      'Mesin'                : mesin,
      'Jenis Kerusakan'      : jk,
      'Deskripsi Kerusakan'  : desc,
      'Tindakan Perbaikan'   : act,
      'Sparepart Diganti'    : sp,
      'Teknisi'              : tek,
      'Durasi BD (jam)'      : durStr,
      'Status Akhir'         : stat,
    },
    `InputBD_${wr}_PRIMA.pdf`
  );
};


/* ════ 1. Tabel Jadwal PM ════ */
function downloadPdfJadwal() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const rows = [];
  const tbody = document.getElementById('pm-tbody');
  if (tbody) {
    tbody.querySelectorAll('tr').forEach((tr, i) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 5) {
        rows.push([
          i + 1,
          _cellText(tds[0]), // Mesin
          _cellText(tds[1]), // Tipe
          _cellText(tds[2]), // Tanggal Jadwal
          _cellText(tds[3]), // Prosedur PM
          _cellText(tds[4]), // Status
        ]);
      }
    });
  }

  const startY = _pdfHeader(doc, 'Tabel Jadwal Preventive Maintenance', 'Semua Jadwal Aktif');
  doc.autoTable({
    startY,
    head: [['No.', 'Mesin', 'Tipe', 'Tanggal Jadwal', 'Prosedur PM', 'Status']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 255] },
    columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 28 } },
    margin: { left: 14, right: 14 },
  });

  const total = rows.length;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Total: ${total} jadwal`, 14, doc.lastAutoTable.finalY + 6);
  doc.save('Jadwal_PM_PRIMA.pdf');
  showToast('PDF Tabel Jadwal berhasil diunduh', 'success');
}

/* ════ 2. Daftar Sparepart ════ */
function downloadPdfSparepart() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const filterMachineInput = document.getElementById('sp-filter-machine-input');
  const filterMachineDisplay = document.getElementById('sp-filter-machine-display');
  const filterMachineName = filterMachineDisplay ? filterMachineDisplay.textContent.trim() : 'Semua Mesin';
  const filterMachineVal = filterMachineInput ? filterMachineInput.value : '';

  // Ambil data dari sparepartStore yang sudah difilter
  let data = [...sparepartStore];
  if (filterMachineVal) {
    data = data.filter(s => s.machine === filterMachineVal || s.machineName === filterMachineName);
  }

  const rows = data.map((s, i) => {
    const machineName = s.machineName || MACHINES.find(m => m.id === s.machine)?.name || s.machine || '—';
    const statusLabel = s.status === 'good' ? 'Baik' : s.status === 'warning' ? 'Perhatian' : 'Kritis';
    const isOverdue = s.isOverdue;
    const nextReplaceStr = isOverdue ? 'OVERDUE' : (s.nextReplace ? s.nextReplace : '—');
    const lastReplaceStr = s.lastReplace || '—';
    return [
      i + 1,
      s.name || '—',
      machineName,
      (s.lifetimeDays || '—') + ' hari',
      lastReplaceStr,
      nextReplaceStr,
      s.life + '%',
      statusLabel,
    ];
  });

  const startY = _pdfHeader(doc, 'Daftar Sparepart', filterMachineName);
  doc.autoTable({
    startY,
    head: [['No.', 'Nama Sparepart', 'Mesin', 'Lifetime', 'Terakhir Diganti', 'Jadwal Berikutnya', 'Sisa Usia', 'Status']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 255] },
    columnStyles: { 0: { cellWidth: 10 } },
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = data.cell.text[0];
        if (val === 'Kritis') data.cell.styles.textColor = [220, 53, 69];
        else if (val === 'Perhatian') data.cell.styles.textColor = [255, 160, 0];
        else data.cell.styles.textColor = [40, 167, 69];
      }
    }
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Total: ${rows.length} sparepart`, 14, doc.lastAutoTable.finalY + 6);
  doc.save('Daftar_Sparepart_PRIMA.pdf');
  showToast('PDF Daftar Sparepart berhasil diunduh', 'success');
}

/* ════ 3. Riwayat Mesin ════ */
function downloadPdfMachineHistory() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const machineDisplay = document.getElementById('hist-machine-display');
  const machineName = machineDisplay ? machineDisplay.textContent.trim() : 'Semua Mesin';
  const dateFrom   = document.getElementById('hist-date-from').value;
  const dateTo     = document.getElementById('hist-date-to').value;
  const typeFilter = document.getElementById('hist-type-filter').value;
  const searchInput = document.getElementById('hist-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Terapkan filter yang sama dengan tampilan timeline
  let data = [...(_liveHistoryData || [])];
  const machineVal = document.getElementById('hist-machine-select').value;
  if (machineVal) data = data.filter(d => d.machine === machineVal || machineNameFromId(d.machine) === machineName);
  if (typeFilter) data = data.filter(d => d.type === typeFilter);
  if (dateFrom)   data = data.filter(d => d._rawDate && d._rawDate >= new Date(dateFrom));
  if (dateTo) {
    const toEnd = new Date(dateTo); toEnd.setHours(23, 59, 59, 999);
    data = data.filter(d => d._rawDate && d._rawDate <= toEnd);
  }
  if (query) {
    data = data.filter(d => {
      const fields = [d.machine, d.date, d.desc, d.technician, d.nomorWR, d.keterangan,
        d.downtime, d.status, d.jenisKerusakan, d.deskripsiTindakan,
        d.waktuMulai, d.waktuSelesai, (d.prosedurList || []).join(' ')];
      return fields.some(f => f && String(f).toLowerCase().includes(query));
    });
  }

  const filterParts = [];
  if (machineName && machineName !== 'Semua Mesin') filterParts.push(machineName);
  if (typeFilter) filterParts.push(typeFilter === 'breakdown' ? 'Breakdown' : typeFilter === 'pm' ? 'Preventif' : 'Sparepart');
  if (query) filterParts.push('Cari: "' + query + '"');
  if (dateFrom) filterParts.push('Dari: ' + dateFrom);
  if (dateTo)   filterParts.push('Sampai: ' + dateTo);
  const filterLabel = filterParts.length ? filterParts.join(' | ') : 'Semua Data';

  const rows = data.map((d, i) => {
    const isPM        = d.type === 'pm';
    const typeLabel   = isPM ? 'Preventif' : 'Breakdown';
    const mName       = machineNameFromId(d.machine) || d.machine || '—';

    const waktuMulai   = d.waktuMulai   || '—';
    const waktuSelesai = d.waktuSelesai || '—';
    const downtime     = d.downtime     || '—';

    let detailSpesifik;
    if (isPM) {
      detailSpesifik = (d.prosedurList && d.prosedurList.length)
        ? d.prosedurList.join(' | ')
        : 'Preventive Maintenance';
    } else {
      detailSpesifik = d.jenisKerusakan || d.desc || '—';
    }

    const deskripsi = isPM
      ? ((d.prosedurList && d.prosedurList.length) ? d.prosedurList.join('\n') : '—')
      : (d.deskripsiTindakan || '—');

    return [
      i + 1,
      d.date        || '—',
      mName,
      waktuMulai,
      waktuSelesai,
      downtime,
      typeLabel,
      detailSpesifik.substring(0, 80),
      deskripsi.substring(0, 100),
    ];
  });

  const startY = _pdfHeader(doc, 'Riwayat Mesin', filterLabel);
  doc.autoTable({
    startY,
    head: [['No.', 'Tanggal', 'Mesin', 'Waktu Mulai', 'Waktu Selesai', 'Downtime', 'Tipe', 'Detail Spesifik', 'Deskripsi']],
    body: rows,
    styles: { fontSize: 6.5, cellPadding: 1.8 },
    headStyles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 255] },
    columnStyles: {
      0: { cellWidth: 8  },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 50 },
      8: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Total: ${rows.length} riwayat`, 14, doc.lastAutoTable.finalY + 6);
  doc.save('Riwayat_Mesin_PRIMA.pdf');
  showToast('PDF Riwayat Mesin berhasil diunduh', 'success');
}

/* ════ 4. Riwayat Requestor ════ */
function downloadPdfRiwayatRequestor() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const month = document.getElementById('riwayat-req-month').value;
  const year  = document.getElementById('riwayat-req-year').value;
  const filterLabel = _filterLabel(month, year);

  const dateField = _riwayatReqData && _riwayatReqData[0] && _riwayatReqData[0].timestamp ? 'timestamp' : 'Timestamp';
  let rows = filterByMonthYear(_riwayatReqData || [], month, year, dateField);

  const tableRows = rows.map((r, i) => {
    const ts   = r.timestamp   || r.Timestamp   || r['Tanggal/Waktu'] || '';
    const wr   = r.nomorWR     || r.NomorWR      || r['Nomor WR']     || '—';
    const mesin= r.mesin       || r.Mesin        || '—';
    const jk   = r.jenisKerusakan || r['Jenis Kerusakan'] || '—';
    const desc = r.deskripsi   || r.Deskripsi    || '—';
    const sejak= r.sejak       || r.Sejak        || '';
    const nama = r.namaPelapor || r['Nama Pelapor'] || r.NamaPelapor || '—';
    const stat = r.status      || r.Status       || 'Pending';
    const tsStr = ts ? (() => { const d = new Date(ts); return isNaN(d) ? ts : d.toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); })() : '—';
    const sejkStr = sejak ? (() => { const d = new Date(sejak); return isNaN(d) ? sejak : d.toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); })() : '—';
    return [i + 1, tsStr, wr, mesin, jk, desc.substring(0, 60), sejkStr, nama, stat];
  });

  const startY = _pdfHeader(doc, 'Riwayat Requestor — Laporan Kerusakan', filterLabel);
  doc.autoTable({
    startY,
    head: [['No.', 'Tgl/Waktu', 'No. WR', 'Mesin', 'Jenis Kerusakan', 'Deskripsi', 'Sejak Kapan', 'Pelapor', 'Status']],
    body: tableRows,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 255] },
    columnStyles: { 0: { cellWidth: 10 }, 5: { cellWidth: 50 } },
    margin: { left: 14, right: 14 },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Total: ${tableRows.length} laporan`, 14, doc.lastAutoTable.finalY + 6);
  doc.save(`Riwayat_Requestor_${filterLabel.replace(/ /g,'_')}_PRIMA.pdf`);
  showToast('PDF Riwayat Requestor berhasil diunduh', 'success');
}

/* ════ 5. Riwayat Input Preventive Maintenance ════ */
function downloadPdfRiwayatPM() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const month = document.getElementById('riwayat-pm-month').value;
  const year  = document.getElementById('riwayat-pm-year').value;
  const filterLabel = _filterLabel(month, year);

  const dateField = _riwayatPMData && _riwayatPMData[0] && _riwayatPMData[0].timestamp ? 'timestamp' : 'Timestamp';
  let rows = filterByMonthYear(_riwayatPMData || [], month, year, dateField);

  const tableRows = rows.map((r, i) => {
    const ts   = r.timestamp   || r.Timestamp    || '';
    const wo   = r.nomorWO     || r.NomorWO      || r['Nomor WO']    || '—';
    const mesin= r.mesin       || r.Mesin        || '—';
    const tipe = r.tipePM      || r['Tipe PM']   || r.TipePM         || '—';
    const pros = r.prosedurPM  || r['Prosedur PM']|| r.ProsedurPM    || '—';
    const tek  = r.teknisi     || r.Teknisi      || '—';
    const dur  = r.durasi      || r.Durasi       || '—';
    const hasil= r.hasilCek    || r['Hasil Cek'] || r.HasilCek       || '—';
    const cat  = r.catatan     || r.Catatan      || '—';
    const stat = r.status      || r.Status       || 'Pending';
    const tsStr = ts ? (() => { const d = new Date(ts); return isNaN(d) ? ts : d.toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); })() : '—';
    return [i + 1, tsStr, wo, mesin, tipe, pros.substring(0, 40), tek, dur + ' jam', hasil.substring(0, 30), cat.substring(0, 40), stat];
  });

  const startY = _pdfHeader(doc, 'Riwayat Input Preventive Maintenance', filterLabel);
  doc.autoTable({
    startY,
    head: [['No.', 'Tgl/Waktu', 'No. WO', 'Mesin', 'Tipe PM', 'Prosedur PM', 'Teknisi', 'Durasi', 'Hasil Cek', 'Catatan', 'Status']],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 1.8 },
    headStyles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 255] },
    columnStyles: { 0: { cellWidth: 10 } },
    margin: { left: 10, right: 10 },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Total: ${tableRows.length} input PM`, 14, doc.lastAutoTable.finalY + 6);
  doc.save(`Riwayat_PM_${filterLabel.replace(/ /g,'_')}_PRIMA.pdf`);
  showToast('PDF Riwayat Input PM berhasil diunduh', 'success');
}

/* ════ 6. Riwayat Input Breakdown Maintenance ════ */
function downloadPdfRiwayatBD() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const month = document.getElementById('riwayat-bd-month').value;
  const year  = document.getElementById('riwayat-bd-year').value;
  const filterLabel = _filterLabel(month, year);

  const dateField = _riwayatBDData && _riwayatBDData[0] && _riwayatBDData[0].timestamp ? 'timestamp' : 'Timestamp';
  let rows = filterByMonthYear(_riwayatBDData || [], month, year, dateField);

  const tableRows = rows.map((r, i) => {
    const ts   = r.timestamp         || r.Timestamp         || '';
    const wr   = r.nomorWR           || r.NomorWR           || r['Nomor WR']     || '—';
    const mesin= r.mesin             || r.Mesin             || '—';
    const jk   = r.jenisKerusakan    || r['Jenis Kerusakan']|| '—';
    const desc = _riwayatBDLaporanMap[String(wr).trim()] || r['Deskripsi Kerusakan'] || r.deskripsiKerusakan || '—';
    const act  = r['Deskripsi Tindakan'] || r.deskripsiTindakan || r['Tindakan Perbaikan'] || r.tindakanPerbaikan || '—';
    const sp   = r['Sparepart Diganti']  || r.sparepartDiganti  || '—';
    const tek  = r.teknisi           || r.Teknisi           || '—';
    const dur  = r.durasiBD          || r['Durasi BD']      || r.durasi          || '—';
    const stat = r.statusAkhir       || r.status            || r.Status          || 'Pending';
    const tsStr = ts ? (() => { const d = new Date(ts); return isNaN(d) ? ts : d.toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); })() : '—';
    return [i + 1, tsStr, wr, mesin, jk, desc.substring(0, 50), act.substring(0, 40), sp.substring(0, 30), tek, dur + ' jam', stat];
  });

  const startY = _pdfHeader(doc, 'Riwayat Input Breakdown Maintenance', filterLabel);
  doc.autoTable({
    startY,
    head: [['No.', 'Tgl/Waktu', 'No. WR', 'Mesin', 'Jenis Kerusakan', 'Deskripsi', 'Tindakan', 'Sparepart', 'Teknisi', 'Durasi BD', 'Status']],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 1.8 },
    headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 247, 247] },
    columnStyles: { 0: { cellWidth: 10 } },
    margin: { left: 10, right: 10 },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Total: ${tableRows.length} input Breakdown`, 14, doc.lastAutoTable.finalY + 6);
  doc.save(`Riwayat_BD_${filterLabel.replace(/ /g,'_')}_PRIMA.pdf`);
  showToast('PDF Riwayat Input BD berhasil diunduh', 'success');
}

/* ════ Wire up semua tombol PDF ════ */
function initPdfButtons() {
  const btnJadwal  = document.getElementById('pdf-jadwal-btn');
  const btnSp      = document.getElementById('pdf-sparepart-btn');
  const btnHist    = document.getElementById('pdf-machine-history-btn');
  const btnReq     = document.getElementById('pdf-riwayat-req-btn');
  const btnPM      = document.getElementById('pdf-riwayat-pm-btn');
  const btnBD      = document.getElementById('pdf-riwayat-bd-btn');
  if (btnJadwal) btnJadwal.addEventListener('click', downloadPdfJadwal);
  if (btnSp)     btnSp.addEventListener('click', downloadPdfSparepart);
  if (btnHist)   btnHist.addEventListener('click', downloadPdfMachineHistory);
  if (btnReq)    btnReq.addEventListener('click', downloadPdfRiwayatRequestor);
  if (btnPM)     btnPM.addEventListener('click', downloadPdfRiwayatPM);
  if (btnBD)     btnBD.addEventListener('click', downloadPdfRiwayatBD);
}


/* ══════════════════════════════════════════════════════════
   ZOOM CONTROLS — Supervisor
   ══════════════════════════════════════════════════════════ */

const ZOOM_STEPS  = [70, 80, 90, 100, 110, 125, 150];
const ZOOM_KEY    = 'prima-sup-zoom';
let _zoomIdx = ZOOM_STEPS.indexOf(parseInt(localStorage.getItem(ZOOM_KEY)) || 100);
if (_zoomIdx === -1) _zoomIdx = ZOOM_STEPS.indexOf(100);

function applyZoom(idx) {
  _zoomIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx));
  const pct = ZOOM_STEPS[_zoomIdx];

  // Zoom hanya pada area konten — sidebar & topbar tidak terpengaruh
  const mainContent = document.querySelector('#page-supervisor .main-content');
  if (mainContent) {
    mainContent.style.zoom = pct / 100;
  }

  const levelEl = document.getElementById('sup-zoom-level');
  if (levelEl) levelEl.textContent = pct + '%';

  const btnOut = document.getElementById('sup-zoom-out');
  const btnIn  = document.getElementById('sup-zoom-in');
  if (btnOut) btnOut.disabled = _zoomIdx === 0;
  if (btnIn)  btnIn.disabled  = _zoomIdx === ZOOM_STEPS.length - 1;

  localStorage.setItem(ZOOM_KEY, pct);

  // Redraw canvas charts agar tidak blur setelah zoom
  requestAnimationFrame(() => {
    drawBreakdownChart();
    drawDashboardPieCharts();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  showPage('page-login');
  initPdfButtons();

  // Init zoom
  applyZoom(_zoomIdx);
  document.getElementById('sup-zoom-in') ?.addEventListener('click', () => applyZoom(_zoomIdx + 1));
  document.getElementById('sup-zoom-out')?.addEventListener('click', () => applyZoom(_zoomIdx - 1));
});
