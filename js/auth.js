// ═══════════════════════════════════════
// OLIVE EDGE — Shared Auth & Nav
// ═══════════════════════════════════════

const SUPABASE_URL = "https://oktpizrevqehfrkcqphq.supabase.co";
const SUPABASE_KEY = "sb_publishable_r4lLwwInTT76wXjP-Cha4Q_T1yALqyt";

// ── Session ──────────────────────────
function getSession() {
  try {
    return {
      token: localStorage.getItem('oe_token') || '',
      email: localStorage.getItem('oe_email') || '',
      userId: localStorage.getItem('oe_uid') || ''
    };
  } catch(e) { return {token:'',email:'',userId:''}; }
}

function setSession(token, email, userId) {
  try {
    localStorage.setItem('oe_token', token);
    localStorage.setItem('oe_email', email);
    localStorage.setItem('oe_uid', userId);
  } catch(e) {}
}

function clearSession() {
  try {
    localStorage.removeItem('oe_token');
    localStorage.removeItem('oe_email');
    localStorage.removeItem('oe_uid');
  } catch(e) {}
}

function requireAuth() {
  const s = getSession();
  if (!s.token) {
    window.location.href = 'index.html';
    return false;
  }
  return s;
}

// ── Navigation ──────────────────────
const NAV_ITEMS = [
  { href: 'dashboard.html',     label: '🏠 Dashboard' },
  { href: 'opportunities.html', label: '🔥 Opportunities' },
  { href: 'scanner.html',       label: '🔍 Scanner' },
  { href: 'trends.html',        label: '🎨 Trends' },
  { href: 'suppliers.html',     label: '💰 Suppliers' },
  { href: 'workspace.html',     label: '📋 Workspace' },
];

function renderNav(activePage) {
  const s = getSession();
  const links = NAV_ITEMS.map(item => {
    const active = activePage === item.href ? 'active' : '';
    return `<a href="${item.href}" class="nav-link ${active}">${item.label}</a>`;
  }).join('');

  return `
    <nav class="nav">
      <div class="nav-inner">
        <a href="dashboard.html" class="nav-logo" style="text-decoration:none">
          <span class="sub">Golden Olive</span>
          <span class="main">Olive <span>Edge</span></span>
        </a>
        <div class="nav-links">${links}</div>
        <div class="nav-user">
          <span class="nav-email">${s.email}</span>
          <button class="btn-ghost btn-sm" onclick="doLogout()">Log Out</button>
        </div>
      </div>
    </nav>
  `;
}

function doLogout() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Supabase Auth ──────────────────
async function supabaseSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || 'Sign up failed');
  return data;
}

async function supabaseLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || 'Login failed');
  return data;
}

// ── Supabase DB ────────────────────
async function dbInsert(table, row) {
  const s = getSession();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${s.token}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Insert failed'); }
  return res.json();
}

async function dbSelect(table, filters) {
  const s = getSession();
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  if (filters) url += '&' + filters;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${s.token}`
    }
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Select failed'); }
  return res.json();
}

async function dbUpdate(table, id, row) {
  const s = getSession();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${s.token}`
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Update failed'); }
  return res.json();
}

async function dbDelete(table, id) {
  const s = getSession();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${s.token}`
    }
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Delete failed'); }
}

// ── Helpers ────────────────────────
function fmt(n) { return n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n||0); }
function fmtPrice(p) { return '£' + (p/100).toFixed(2); }
function scoreColor(s) { return s>=7?'score-high':s>=5?'score-mid':'score-low'; }
function demandColor(d) { return d==='High'?'var(--ol)':d==='Medium'?'var(--gd)':'var(--rd)'; }
function compColor(c) { return c==='Low'?'var(--gn)':c==='Medium'?'var(--gd)':c==='High'?'var(--or)':'var(--rd)'; }

function copyText(text, btn) {
  if (navigator.clipboard) { navigator.clipboard.writeText(text); }
  else { const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t); }
  if (btn) { const orig=btn.textContent; btn.textContent='✓ Copied!'; setTimeout(()=>btn.textContent=orig, 2000); }
}

function csvExport(rows, name) {
  if (!rows.length) return;
  const h = Object.keys(rows[0]);
  const csv = [h.join(','), ...rows.map(r => h.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = name; a.click();
}

function pbar(pct, color, h=5) {
  return `<div class="pbar" style="height:${h}px"><div class="pbf" style="width:${Math.min(100,pct||0)}%;background:${color||'var(--gd)'};height:${h}px"></div></div>`;
}

function sbox(label, value, color) {
  return `<div class="sbox"><div class="lbl">${label}</div><div class="mono" style="font-size:16px;color:${color||'var(--tx)'};font-weight:600">${value||'—'}</div></div>`;
}

function loading(msg) {
  return `<div class="loading-row"><div class="spin"></div><span>${msg}</span></div>`;
}

function errBox(msg) {
  return `<div class="card-red"><strong>Error:</strong> ${msg}</div>`;
}
