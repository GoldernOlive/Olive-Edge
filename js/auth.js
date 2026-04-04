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
  { href: 'listing-generator.html', label: '✍️ Listing Writer' },
  { href: 'listing-auditor.html',   label: '🔎 Auditor' },
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

// ── Platform Product Links ─────────────────────────
function platformLinks(keyword) {
  var k = encodeURIComponent(keyword);
  var kRaw = keyword.replace(/ /g,'-');
  return [
    { name:'Etsy UK',      color:'#f1641e', url:'https://www.etsy.com/uk/search?q='+k,                          icon:'🛍' },
    { name:'Etsy USA',     color:'#f1641e', url:'https://www.etsy.com/search?q='+k,                             icon:'🛍' },
    { name:'Etsy Germany', color:'#f1641e', url:'https://www.etsy.com/de/search?q='+k,                          icon:'🛍' },
    { name:'Etsy Australia',color:'#f1641e',url:'https://www.etsy.com/au/search?q='+k,                          icon:'🛍' },
    { name:'Printify',     color:'#2a4a7a', url:'https://printify.com/app/products?search='+k,                  icon:'🖨' },
    { name:'Printful',     color:'#3d3d3d', url:'https://www.printful.com/uk/custom/search?q='+k,               icon:'🖨' },
    { name:'Gelato',       color:'#e85d26', url:'https://www.gelato.com/gb/en/catalogue?q='+k,                  icon:'🖨' },
    { name:'Pinterest',    color:'#e60023', url:'https://www.pinterest.co.uk/search/pins/?q='+k,                icon:'📌' },
    { name:'Amazon UK',    color:'#ff9900', url:'https://www.amazon.co.uk/s?k='+k,                              icon:'📦' },
    { name:'Not on the High Street', color:'#4a4a4a', url:'https://www.notonthehighstreet.com/search?search_term='+k, icon:'🎁' },
  ];
}

function platformLinksHTML(keyword) {
  if(!keyword) return '';
  var links = platformLinks(keyword);
  var html = '<div class="card" style="margin-top:16px;border:2px solid var(--olbr)">';
  html += '<div class="lbl" style="color:var(--ol)">🔗 See Real Products On Every Platform</div>';
  html += '<p style="font-size:12px;color:var(--mu);margin-bottom:12px">Click any platform to see what's actually selling for <strong>'+keyword+'</strong> right now</p>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
  links.forEach(function(l) {
    html += '<a href="'+l.url+'" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:var(--w);border:1.5px solid var(--b1);border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--tx);text-decoration:none;font-family:Jost,sans-serif;transition:all .15s" onmouseover="this.style.borderColor=''+l.color+'';this.style.color=''+l.color+''" onmouseout="this.style.borderColor='var(--b1)';this.style.color='var(--tx)'">';
    html += l.icon+' '+l.name+'</a>';
  });
  html += '</div></div>';
  return html;
}

// ── Sales Estimator (Build 2) ──────────────────────
function estimateMonthlySales(listing){
  var favs=listing.num_favorers||0;
  var reviews=listing.reviews_count||listing.num_reviews||0;
  var price=(listing.price&&listing.price.amount||0)/100;

  // Estimate listing age in months from creation timestamp
  var ageMonths=12;
  if(listing.original_creation_timestamp){
    var created=new Date(listing.original_creation_timestamp*1000);
    ageMonths=Math.max(1,(Date.now()-created)/(1000*60*60*24*30));
  } else if(listing.last_modified_timestamp){
    ageMonths=6; // default if no creation date
  }

  // EverBee-style estimation formula
  // Reviews are the strongest signal: ~1 review per 40-60 sales
  var reviewRate=reviews>0?(reviews/ageMonths)*50:0;
  // Favourites secondary: ~1 sale per 8-12 favs per month
  var favRate=(favs/ageMonths)/10;
  // Weighted combination
  var estimate=reviews>0?(reviewRate*0.65+favRate*0.35):favRate;

  // Price adjustment
  if(price>100)estimate*=0.3;
  else if(price>50)estimate*=0.5;
  else if(price>30)estimate*=0.7;
  else if(price>20)estimate*=0.85;
  else if(price<8)estimate*=1.4;

  var monthly=Math.round(Math.max(0,estimate));

  // Revenue estimate
  var revenue=(monthly*price);

  // Category label
  var label,color,badge;
  if(monthly>=100){label='🔥 Best Seller';color='var(--ol)';badge='b-live';}
  else if(monthly>=30){label='📈 Strong';color='var(--gd)';badge='b-gold';}
  else if(monthly>=10){label='📊 Growing';color='var(--bl)';badge='b-blue';}
  else if(monthly>=3){label='🌱 Active';color='var(--mu)';badge='b-grey';}
  else{label='🆕 Early';color='var(--mu2)';badge='b-grey';}

  return{monthly:monthly,revenue:revenue.toFixed(0),label:label,color:color,badge:badge};
}

function salesBadgeHTML(listing){
  var s=estimateMonthlySales(listing);
  return '<div style="margin-top:5px;padding:5px 8px;background:var(--p2);border-radius:6px;font-size:11px">'
    +'<span style="color:'+s.color+';font-weight:700">~'+s.monthly+' sales/mo</span>'
    +' <span style="color:var(--mu)">· Est £'+s.revenue+'/mo</span>'
    +' <span class="badge '+s.badge+'" style="margin-left:4px;font-size:9px">'+s.label+'</span>'
    +'</div>';
}
