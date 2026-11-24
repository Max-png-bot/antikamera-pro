#!/usr/bin/env node
/* ================================================================
   АнтиКамера PRO — АВТОНОМНЫЙ СЕРВЕР ПРОДАЖ (уровень 3 автоматизации).
   Без участия продавца: покупатель платит USDT TRC20 на кошелёк,
   вставляет хэш транзакции → сервер проверяет платёж в блокчейне TRON
   (TronGrid API) и мгновенно выдаёт код активации PRO.

   Возможности:
     GET  /                    — PWA-приложение (index.html)
     GET  /landing/            — продающая страница
     GET  /api/verify?hash=    — проверка оплаты + выдача кода (публично)
     POST /api/feedback        — приём отзывов из приложения
     GET  /api/stats?key=      — статистика (только с ключом админа)
     GET  /api/feedback/list?key= — все отзывы (только с ключом админа)
     GET  /admin?key=          — панель продавца: продажи, выручка,
                                 остаток кодов, отзывы, приоритеты улучшений

   Запуск:  PORT=8083 ADMIN_KEY=секрет node autosale/server.js
   Экономия квот: укажите TRONGRID_KEY (бесплатный, tronscan.org → API).
   Состояние — JSON-файлы в sales/ (переживают перезапуск).

   Зависимости: НЕТ (чистый Node.js ≥ 18, встроенный fetch).
   ================================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------- конфигурация ---------- */
const ROOT = path.join(__dirname, '..');        // папка antikamera-pro
const DIR = process.env.AUTOSALE_DIR || path.join(ROOT, 'sales');
const PORT = +(process.env.PORT || 8083);
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(9).toString('base64url');
const WALLET = process.env.WALLET || 'TBA8d1eLJhLVKGjQfeDcxvEJTmrq7Nzrc9';
const PRICE = +(process.env.PRICE || 9.9);
const PROMO_PRICE = 6.9;   // стартовая цена для первых покупателей
const PROMO_FIRST = 10;    // сколько продаж по промо-цене
function minAcceptedAmount() {
  return loadJson(F.sales, []).length < PROMO_FIRST ? PROMO_PRICE : PRICE;
}
const TRONGRID_KEY = process.env.TRONGRID_KEY || '';
const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // контракт USDT в TRON

const F = {
  stock: path.join(DIR, 'codes_batch1.txt'),
  sales: path.join(DIR, 'sales_log.json'),
  redeemed: path.join(DIR, 'redemptions.json'),
  feedback: path.join(DIR, 'feedback.json'),
  alerts: path.join(DIR, 'alerts.json'),
  visits: path.join(DIR, 'visits.json'),
};
fs.mkdirSync(DIR, { recursive: true });

/* ---------- коды активации (единый алгоритм с приложениями) ---------- */
const LALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function checkCode(raw) {
  const c = String(raw).toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (!c.startsWith('AKP') || c.length !== 15) return false;
  let s = 0;
  for (let i = 3; i < 15; i++) {
    const idx = LALPH.indexOf(c[i]);
    if (idx < 0) return false;
    s = (s * 33 + idx) % 97;
  }
  return s === 42;
}
function mintCode(rng) {
  for (;;) {
    let c = 'AKP';
    for (let i = 0; i < 12; i++) c += LALPH[rng(32)];
    if (checkCode(c)) return formatCode(c);
  }
}
function formatCode(c) {
  c = String(c).toUpperCase().replace(/[^A-Z2-9]/g, '');
  return `${c.slice(0, 3)}-${c.slice(3, 7)}-${c.slice(7, 11)}-${c.slice(11, 15)}`;
}

/* ---------- хранилище (JSON-файлы) ---------- */
function loadJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return def; }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
}

/* ---------- склад кодов ---------- */
function takeCodeFromStock(txHash, amount) {
  let lines = [];
  try { lines = fs.readFileSync(F.stock, 'utf8').split('\n'); } catch (_) {}
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('| не продан')) {
      const code = lines[i].split('|')[0].trim();
      lines[i] = lines[i].replace('| не продан | —', `| продан | tx ${txHash} (${amount} USDT)`);
      fs.writeFileSync(F.stock, lines.join('\n'));
      return { code, source: 'stock' };
    }
  }
  // склад пуст → чеканим новый код (необратимо действительный, оплата получена)
  const code = mintCode(n => crypto.randomInt(n));
  fs.appendFileSync(F.stock, `${code} | продан | tx ${txHash} (${amount} USDT, автогенерация)\n`);
  return { code, source: 'minted' };
}

/* ---------- проверка платежа в блокчейне ---------- */
async function fetchTransfers(fetchImpl, maxPages = 3) {
  const fetchFn = fetchImpl || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : null);
  if (!fetchFn) throw new Error('no fetch');
  const out = [];
  let fingerprint = '';
  for (let page = 0; page < maxPages; page++) {
    const url =
      `https://api.trongrid.io/v1/accounts/${WALLET}/transactions/trc20` +
      `?limit=200&only_to=true&contract_type=trc20transfer` +
      (fingerprint ? `&fingerprint=${fingerprint}` : '');
    const headers = TRONGRID_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_KEY } : {};
    const res = await fetchFn(url, { headers });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.apiBusy = res.status === 429 || res.status >= 500;
      throw err;
    }
    const j = await res.json();
    out.push(...(j.data || []));
    fingerprint = (j.meta && j.meta.fingerprint) || '';
    if (!fingerprint) break;
  }
  return out;
}

/**
 * Проверяет транзакцию и (если всё сошлось) выдаёт код.
 * Возвращает {ok:true, code} или {ok:false, reason}.
 * Причины: bad_hash, not_found, below_price, wrong_recipient,
 *           wrong_token, already_used, api_busy.
 */
async function verifyPayment(hash, fetchImpl) {
  if (!/^[0-9a-f]{64}$/i.test(String(hash || ''))) return { ok: false, reason: 'bad_hash' };
  const h = String(hash).toLowerCase();
  const redeemed = loadJson(F.redeemed, []);
  if (redeemed.some(r => r.hash === h)) return { ok: false, reason: 'already_used' };

  let txs;
  try {
    txs = await fetchTransfers(fetchImpl);
  } catch (e) {
    return { ok: false, reason: e.apiBusy ? 'api_busy' : 'api_error' };
  }
  const tx = txs.find(t => String(t.transaction_id || '').toLowerCase() === h);
  if (!tx) return { ok: false, reason: 'not_found' };
  if (String(tx.to || '') !== WALLET) return { ok: false, reason: 'wrong_recipient' };
  const symbol = (tx.token_info && tx.token_info.symbol) || '';
  const tokenAddr = String((tx.token_info && tx.token_info.address) || '');
  if (symbol !== 'USDT' && tokenAddr !== USDT_TRC20) return { ok: false, reason: 'wrong_token' };
  const amount = parseInt(tx.value || '0', 10) / 1e6;
  const need = minAcceptedAmount();
  if (!(amount >= need - 0.001)) return { ok: false, reason: 'below_price', amount };

  // AML-скрининг отправителя ДО выдачи кода (v4)
  const scr = await screenAddress(tx.from, fetchImpl);
  if (scr.action === 'reject') {
    recordAmlHold(h, tx.from, amount, scr);
    alertSales(`AML: платёж ${amount} USDT ОТКЛОНЁН (${scr.level}: ${scr.detail}). Отправитель ${tx.from}. Код НЕ выдан — вернуть средства вручную; отпустить код: /api/aml/release?hash=${h}`);
    return { ok: false, reason: 'aml_risk' };
  }
  if (scr.action === 'hold') {
    recordAmlHold(h, tx.from, amount, scr);
    alertSales(`AML: платёж ${amount} USDT на ручной проверке (${scr.level}: ${scr.detail}). Отправитель ${tx.from}. Решение: /api/aml/release?hash=${h}`);
    return { ok: false, reason: 'aml_review' };
  }

  // оплата подтверждена — выдать код и записать
  const { code, source } = takeCodeFromStock(h, amount);
  redeemed.push({ hash: h, code, amount, from: tx.from || '', ts: Date.now() });
  saveJson(F.redeemed, redeemed.slice(-2000));
  const sales = loadJson(F.sales, []);
  sales.push({ ts: Date.now(), hash: h, from: tx.from || '', amount, code, source });
  saveJson(F.sales, sales.slice(-2000));
  alertSales(`ПРОДАЖА! ${amount} USDT (tx ${h.slice(0, 10)}…) — код ${code} выдан автоматически. Продаж за всё время: ${sales.length}, выручка: ${sales.reduce((s, x) => s + (+x.amount || 0), 0).toFixed(1)} USDT`);
  return { ok: true, code, amount };
}

/* ---------- отзывы ---------- */
const STOP = new Set(['который','чтобы','приложение','приложения','программа',
  'только','потому','когда','телефон','телефона','телефоне','очень','нужно',
  'также','будто','всего','этого','этой','если','было','быть','моей','мого',
  'есть','ещё','еще','какие','какой','мне','меня','него','него','них','мной']);
function feedbackStats() {
  const fb = loadJson(F.feedback, []);
  const n = fb.length;
  const avg = n ? fb.reduce((s, x) => s + (+x.rating || 0), 0) / n : 0;
  const bad = fb.filter(x => +x.rating <= 3);
  const freq = {};
  for (const x of bad) {
    const words = String(x.text || '').toLowerCase().split(/[^а-яёa-z]+/);
    for (const w of words) {
      if (w.length < 5 || STOP.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  const topIssues = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([word, count]) => ({ word, count }));
  return { count: n, avg: +avg.toFixed(2), topIssues };
}

/* ---------- статика ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
};
function serveStatic(req, res, pathname) {
  let rel = pathname;
  if (rel === '/') rel = '/index.html';
  if (rel === '/landing' || rel === '/landing/') rel = '/landing/index.html';
  if (rel === '/en' || rel === '/en/') rel = '/en/index.html';
  if (rel === '/zh' || rel === '/zh/') rel = '/zh/index.html';
  if (rel === '/ja' || rel === '/ja/') rel = '/ja/index.html';
  if (rel === '/ko' || rel === '/ko/') rel = '/ko/index.html';
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    if (path.extname(full).toLowerCase() === '.html') trackVisit(rel);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': rel === '/sw.js' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

/* ---------- лимит запросов /api/verify ---------- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 30;
}

/* ---------- серверная валидация кода (защита от самоделок) ---------- */
function codeWasSold(code) {
  const c = String(code || '').toUpperCase();
  if (!checkCode(c)) return false;
  if (loadJson(F.redeemed, []).some(r => String(r.code).toUpperCase() === c)) return true;
  if (loadJson(F.sales, []).some(s => String(s.code).toUpperCase() === c)) return true;
  try {
    return fs.readFileSync(F.stock, 'utf8').split('\n')
      .some(l => l.toUpperCase().startsWith(c) && l.includes('| продан'));
  } catch (_) { return false; }
}

/* ---------- круглосуточный мониторинг: алерты и дайджесты ---------- */
/* Куда бить тревогу (любой из каналов, переменными окружения):
   ALERT_TELEGRAM_TOKEN + ALERT_TELEGRAM_CHAT_ID — бот в Telegram;
   ALERT_WEBHOOK_URL — любой вебхук (Slack/Discord/свой). Пусто → копятся
   в alerts.json и видны в панели /admin. */
async function notify(text) {
  try {
    const token = process.env.ALERT_TELEGRAM_TOKEN;
    const chat = process.env.ALERT_TELEGRAM_CHAT_ID;
    if (token && chat) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text }),
      });
    }
    const hook = process.env.ALERT_WEBHOOK_URL;
    if (hook) {
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ts: Date.now() }),
      });
    }
  } catch (_) { /* каналы оповещения не должны ронять продажи */ }
}

function alertSales(text) {
  const list = loadJson(F.alerts, []);
  list.push({ ts: Date.now(), text });
  saveJson(F.alerts, list.slice(-500));
  notify('🔔 АнтиКамера PRO: ' + text);
}

/* ---------- счётчик визитов страниц ---------- */
function trackVisit(rel) {
  try {
    const page = rel === '/index.html' ? 'app'
      : rel.startsWith('/blog') ? 'blog'
      : rel.startsWith('/en') ? 'en'
      : rel.startsWith('/zh') ? 'zh'
      : rel.startsWith('/ja') ? 'ja'
      : rel.startsWith('/ko') ? 'ko' : 'ru';
    const day = new Date().toISOString().slice(0, 10);
    const v = loadJson(F.visits, {});
    v[day] = v[day] || {};
    v[day][page] = (v[day][page] || 0) + 1;
    saveJson(F.visits, v);
  } catch (_) {}
}
function visits24() {
  const v = loadJson(F.visits, {});
  const out = { app: 0, ru: 0, en: 0, zh: 0, ja: 0, ko: 0, blog: 0 };
  const now = Date.now();
  for (let i = 0; i < 2; i++) {
    const d = new Date(now - i * 86400e3).toISOString().slice(0, 10);
    const day = v[d] || {};
    for (const k of Object.keys(out)) out[k] += day[k] || 0;
  }
  return out;
}

/* ---------- статистика Reddit-поста (для дайджеста) ---------- */
async function redditStatsText() {
  let url = (loadJson(path.join(DIR, 'reddit_post.json'), {}) || {}).url
    || (loadJson(path.join(__dirname, 'reddit_post.json'), {}) || {}).url
    || process.env.REDDIT_POST_URL;
  if (!url) return '';
  try {
    const r = await fetch(url.replace(/\/$/, '') + '.json',
      { headers: { 'User-Agent': 'antikamera-monitor/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const post = (j[0] && j[0].data && j[0].data.children
      && j[0].data.children[0] && j[0].data.children[0].data) || {};
    return `Reddit-пост: ${post.score ?? '?'} апвоутов · ${post.num_comments ?? '?'} комментариев\n`;
  } catch (e) {
    return 'Reddit-пост: статистика недоступна\n';
  }
}

/* ---------- ночное наблюдение за Reddit-постом (каждые 30 мин) ----------
   Новые комментарии → мгновенное сообщение владельцу в Telegram
   (первые 200 символов, автор), чтобы утром можно было ответить. */
async function redditWatchTick() {
  const stateF = path.join(DIR, 'reddit_state.json');
  const st = loadJson(stateF, {});
  const conf = loadJson(path.join(__dirname, 'reddit_post.json'), {}) || {};
  const url = conf.url || process.env.REDDIT_POST_URL;
  if (!url) return;
  try {
    const r = await fetch(url.replace(/\/$/, '') + '.json',
      { headers: { 'User-Agent': 'antikamera-monitor/1.0' } });
    if (!r.ok) return;
    const j = await r.json();
    const post = (j[0] && j[0].data && j[0].data.children
      && j[0].data.children[0] && j[0].data.children[0].data) || {};
    const seen = new Set(st.seenIds || []);
    const fresh = [];
    const walk = (cs) => {
      for (const c of cs || []) {
        const d = c && c.data;
        if (!d) continue;
        if (d.author && d.author !== 'stablefi' && d.body && d.id && !seen.has(d.id)) {
          fresh.push({ id: d.id, author: d.author, body: String(d.body) });
        }
        if (d.replies && d.replies.data && d.replies.data.children) walk(d.replies.data.children);
      }
    };
    walk((j[1] && j[1].data && j[1].data.children) || []);
    for (const f of fresh) seen.add(f.id);
    // старые значения — ДО обновления
    const prevRemoved = st.removed;
    const prevScore = st.score;
    // новые значения
    const removed = !!(post.banned_by || (post.removed_by_category && post.removed_by_category !== 'moderator_ignored' && post.removed_by_category !== 'author'));
    st.seenIds = [...seen].slice(-300);
    st.num_comments = post.num_comments;
    st.score = post.score;
    st.removed = removed;
    st.ts = Date.now();
    saveJson(stateF, st);   // сохраняем ПОСЛЕ всех изменений
    if (prevRemoved !== undefined && prevRemoved !== removed) {
      notify(removed
        ? '🔔 АнтиКамера PRO: ⚠️ Reddit-пост снова скрыт/удалён — план в marketing/reddit_recovery.md'
        : '🔔 АнтиКамера PRO: ✅ Reddit-пост ВИДЕН в ленте (фильтр снят) — трафик пошёл!');
    }
    if (prevScore !== undefined && post.score > prevScore) {
      notify('🔔 АнтиКамера PRO: 🔺 Reddit-пост: ' + post.score + ' апвоутов (+' + (post.score - prevScore) + ')');
    }
    if (fresh.length) {
      let txt = `💬 Reddit-пост: ${fresh.length} новых комментариев (апвоутов: ${post.score})\n`;
      for (const f of fresh.slice(0, 8)) {
        txt += `\n— u/${f.author}: ${f.body.slice(0, 200)}${f.body.length > 200 ? '…' : ''}\n`;
      }
      if (txt.length > 3500) txt = txt.slice(0, 3500) + '\n…';
      notify('🔔 АнтиКамера PRO: ' + txt);
    }
  } catch (_) { /* наблюдение не должно ронять сервер */ }
}

/* ---------- ежедневный дайджест владельцу (09:00 UTC) ---------- */
async function dailyDigestText() {
  const reddit = await redditStatsText();
  const vis = visits24();
  const sales = loadJson(F.sales, []);
  const dayAgo = Date.now() - 24 * 3600e3;
  const last24 = sales.filter(s => s.ts >= dayAgo);
  const total = sales.reduce((s, x) => s + (+x.amount || 0), 0);
  const fb = feedbackStats();
  let stock = 0;
  try {
    stock = fs.readFileSync(F.stock, 'utf8').split('\n').filter(l => l.includes('| не продан')).length;
  } catch (_) {}
  const holds = loadJson(AML.holds, []).filter(h => !h.released);
  const issues = (fb.topIssues || []).map(i => i.word).join(', ');
  return [
    '📊 АнтиКамера PRO — ежедневный итог',
    `Продаж за 24 ч: ${last24.length} на ${last24.reduce((s, x) => s + (+x.amount || 0), 0).toFixed(1)} USDT · всего: ${sales.length} на ${total.toFixed(1)} USDT`,
    `Отзывы: ${fb.count} (средняя ${fb.avg || '—'})${issues ? ' · топ проблем: ' + issues : ''}`,
    `AML-холды в ожидании: ${holds.length} · кодов на складе: ${stock}`,
    `Визиты (за 48 ч): приложение ${vis.app} · RU ${vis.ru} · EN ${vis.en} · ZH ${vis.zh} · JA ${vis.ja} · KO ${vis.ko} · блог ${vis.blog}`,
    `Цена: ${loadJson(F.sales, []).length < PROMO_FIRST ? PROMO_PRICE + ' USDT промо (осталось ' + (PROMO_FIRST - loadJson(F.sales, []).length) + ')' : PRICE + ' USDT'}`,
    `Сервер жив: uptime ${Math.round(process.uptime() / 60)} мин · antikamera-pro.onrender.com`,
    reddit,
  ].join('\n');
}
function scheduleDigest() {
  if (!(process.env.ALERT_TELEGRAM_TOKEN && process.env.ALERT_TELEGRAM_CHAT_ID)) return;
  const next = new Date();
  next.setUTCHours(9, 0, 0, 0);
  if (next.getTime() < Date.now()) next.setUTCDate(next.getUTCDate() + 1);
  setTimeout(async () => { await notify(await dailyDigestText()); scheduleDigest(); },
    next.getTime() - Date.now()).unref();
  console.log('Дайджест владельцу запланирован на ' + next.toISOString());
}

/* ---------- AML-скрининг входящих платежей (v4) ----------
   Прежде чем выдать код за оплату, проверяем АДРЕС ОТПРАВИТЕЛЯ:
   1) локальный запрет-лист (сид OFAC + ручные добавления);
   2) PublicAML Intelligence (реальное время): санкции OFAC/EU/иные,
      хакерские адреса, даркнет, воры, миксеры, заморозки Tether/Circle.
   Политика: LOW → выдать код; MEDIUM → hold на ручное решение владельца;
   HIGH/CRITICAL/санкции/заморозка → ОТКАЗ (код не выдаётся, владелец
   уведомляется для ручного возврата средств). API недоступен → код выдаётся
   (fail-open), если AML_STRICT=1 — тогда hold. */
const AML = {
  seed: path.join(__dirname, 'aml_blocklist.seed.txt'),
  blocklist: path.join(DIR, 'aml_blocklist.txt'),
  cache: path.join(DIR, 'aml_cache.json'),
  holds: path.join(DIR, 'aml_rejects.json'),
};
const AML_BAD_CATS = new Set(['sanction', 'hacker', 'ransomware', 'darknet',
  'theft', 'stolen', 'launder', 'laundering', 'fraud', 'scam', 'phishing',
  'terror', 'terrorist', 'mixer', 'gambling', 'csam']);

function loadBlocklist() {
  // base58 РЕГИСТРО-ЗАВИСИМ: валидируем запись как записана, сравнение — без учёта
  const out = new Set();
  for (const f of [AML.seed, AML.blocklist]) {
    try {
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        const a = line.split('|')[0].trim();
        if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) out.add(a.toUpperCase());
      }
    } catch (_) {}
  }
  return out;
}

async function screenAddress(addr, fetchImpl) {
  const A = String(addr || '');
  if (loadBlocklist().has(A.toUpperCase())) {
    return { level: 'BLOCKLIST', action: 'reject', reason: 'aml_risk',
      detail: 'адрес в запрет-листе (OFAC/владелец)' };
  }
  const cache = loadJson(AML.cache, {});
  const hit = cache[A.toUpperCase()];
  if (hit && Date.now() - hit.ts < 24 * 3600e3) return hit.result;
  const fetchFn = fetchImpl || globalThis.fetch;
  let result;
  try {
    const res = await fetchFn('https://intelapi.publicaml.org/v2/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: [{ wallet_address: A, chain: 'tron' }], top_n: 1 }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const ent = (j.entities || []).find(e => String(e.wallet_address || '').toUpperCase() === A.toUpperCase());
    if (!ent || !ent.risk || !ent.risk.scored) {
      result = { level: 'NO_DATA', action: process.env.AML_STRICT === '1' ? 'hold' : 'issue',
        reason: 'no_data', detail: 'кошелёк без истории — не оценён (новый)' };
    } else {
      const r = ent.risk;
      const level = String(r.level || '').toUpperCase();
      const score = +r.score || 0;
      const br = r.breakdown || {};
      const cats = new Set();
      if (br.direct_attribution && br.direct_attribution.category) cats.add(String(br.direct_attribution.category).toLowerCase());
      if (br.outbound_direct && br.outbound_direct.category) cats.add(String(br.outbound_direct.category).toLowerCase());
      const frozen = br.frozen_direct && (br.frozen_direct.issuers || []).length > 0;
      if (frozen) cats.add('заморожен эмитентом USDT/USDC');
      const directBad = [frozen, ...[...cats]].some(c => c === true || AML_BAD_CATS.has(String(c)));
      const label = ent.label ? String(ent.label).slice(0, 80) : '';
      if (directBad || level === 'CRITICAL' || level === 'HIGH') {
        result = { level: level || 'HIGH', action: 'reject', reason: 'aml_risk',
          detail: `score ${score}; категории: ${[...cats].join(', ') || 'уровень ' + level}; label: ${label}` };
      } else if (level === 'MEDIUM' || score >= 30) {
        result = { level: 'MEDIUM', action: 'hold', reason: 'aml_review',
          detail: `score ${score}; label: ${label}` };
      } else {
        result = { level: level || 'LOW', action: 'issue', reason: 'clean', detail: `score ${score}` };
      }
    }
  } catch (e) {
    result = { level: 'ERR', action: process.env.AML_STRICT === '1' ? 'hold' : 'issue',
      reason: 'api_unavailable', detail: String(e.message || e).slice(0, 120) };
  }
  const c2 = loadJson(AML.cache, {});
  c2[A.toUpperCase()] = { ts: Date.now(), result };
  saveJson(AML.cache, c2);
  return result;
}

function recordAmlHold(h, from, amount, verdict) {
  const holds = loadJson(AML.holds, []);
  if (holds.some(x => x.hash === h)) return;
  holds.push({ ts: Date.now(), hash: h, from, amount, verdict, released: false });
  saveJson(AML.holds, holds.slice(-500));
}

function releaseAmlHold(hash) {
  const holds = loadJson(AML.holds, []);
  const h = holds.find(x => x.hash === hash && !x.released);
  if (!h) return null;
  h.released = true;
  saveJson(AML.holds, holds);
  const { code, source } = takeCodeFromStock(h.hash, h.amount);
  const sales = loadJson(F.sales, []);
  sales.push({ ts: Date.now(), hash: h.hash, from: h.from, amount: h.amount,
    code, source, amlManualRelease: true });
  saveJson(F.sales, sales.slice(-2000));
  return { code, amount: h.amount };
}

/* ---------- панель админа ---------- */
const ADMIN_HTML = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>АнтиКамера PRO — панель продавца</title><style>
body{background:#0b0f14;color:#e8eef5;font:15px/1.5 system-ui,sans-serif;margin:0;padding:20px}
.w{max-width:720px;margin:0 auto}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
.c{background:#131a23;border:1px solid #26313f;border-radius:12px;padding:12px;text-align:center}
.c b{display:block;font-size:24px;color:#ff9440}.c span{font-size:11px;color:#93a3b5}
h2{font-size:17px;margin:22px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}
td,th{padding:7px 8px;border-bottom:1px solid #26313f;text-align:left}
.f{background:#131a23;border-radius:10px;padding:9px 12px;margin-top:8px;font-size:13.5px}
.f .r{color:#ff9440}.f .d{color:#93a3b5;font-size:11.5px}
.err{color:#ff8080;padding:20px}
</style></head><body><div class="w"><h1>АнтиКамера PRO — панель продавца</h1>
<div id="app">Загрузка…</div></div>
<script>
const KEY = new URLSearchParams(location.search).get('key') || '';
async function go() {
  try {
    const st = await (await fetch('/api/stats?key=' + encodeURIComponent(KEY))).json();
    const fb = await (await fetch('/api/feedback/list?key=' + encodeURIComponent(KEY))).json();
    if (st.error) { document.getElementById('app').innerHTML =
      '<div class="err">Неверный ключ администратора.</div>'; return; }
    const fmt = t => new Date(t).toLocaleString('ru-RU');
    const rows = (st.sales || []).slice().reverse().slice(0, 30).map(s =>
      '<tr><td>' + fmt(s.ts) + '</td><td>' + s.amount + ' USDT</td><td><code style="font-size:11px">' +
      s.hash.slice(0, 10) + '…</code></td><td>' + s.code + '</td></tr>').join('');
    const fbs = (fb.list || []).slice().reverse().slice(0, 40).map(x =>
      '<div class="f"><span class="r">' + '★'.repeat(+x.rating || 0) +
      '</span> ' + (x.text ? String(x.text).replace(/[<>&]/g, c =>
      ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) : '(без текста)') +
      (x.contact ? ' — <b>' + String(x.contact).replace(/[<>&]/g, '') + '</b>' : '') +
      '<div class="d">' + fmt(x.ts) + '</div></div>').join('');
    const issues = (st.feedback && st.feedback.topIssues || []).map(i =>
      '<b>' + i.word + '</b> ×' + i.count).join(' · ') || '—';
    document.getElementById('app').innerHTML =
      '<div class="g"><div class="c"><b>' + (st.revenue || 0).toFixed(1) +
      '</b><span>USDT выручка</span></div><div class="c"><b>' + (st.salesCount || 0) +
      '</b><span>продаж</span></div><div class="c"><b>' + (st.codesLeft | 0) +
      '</b><span>кодов на складе</span></div><div class="c"><b>' +
      (st.feedback ? st.feedback.avg : '—') + '</b><span>средняя оценка</span></div></div>' +
      '<h2>Приоритеты улучшений (из негативных отзывов)</h2><div class="f">' + issues +
      '</div><h2>Последние продажи</h2><table><tr><th>Дата</th><th>Сумма</th><th>tx</th><th>Код</th></tr>' +
      (rows || '<tr><td colspan=4>пока нет продаж</td></tr>') + '</table>' +
      '<h2>Отзывы (' + (st.feedback ? st.feedback.count : 0) + ')</h2>' +
      (fbs || '<div class="f">пока пусто</div>');
  } catch (e) {
    document.getElementById('app').innerHTML = '<div class="err">Ошибка загрузки: ' + e.message + '</div>';
  }
}
go();
</script></body></html>`;

/* ---------- HTTP-сервер ---------- */
function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

function start() {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const ip = req.socket.remoteAddress || '?';

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    /* API */
    if (u.pathname === '/api/verify') {
      if (rateLimited(ip)) return json(res, 429, { ok: false, reason: 'rate_limited' });
      const r = await verifyPayment(u.searchParams.get('hash') || '');
      return json(res, r.ok ? 200 : 200, r);
    }

    if (u.pathname === '/api/feedback' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) return json(res, 413, { ok: false });
      }
      try {
        const d = JSON.parse(body);
        const fb = loadJson(F.feedback, []);
        fb.push({
          ts: Date.now(),
          rating: Math.min(5, Math.max(0, +d.rating || 0)),
          text: String(d.text || '').slice(0, 1000),
          contact: String(d.contact || '').slice(0, 100),
        });
        saveJson(F.feedback, fb.slice(-2000));
        if (+d.rating <= 3) {
          alertSales(`НЕГАТИВНЫЙ ОТЗЫВ (${d.rating}★): «${String(d.text || '').slice(0, 200)}» ${d.contact ? '· контакт: ' + d.contact : ''} — приоритет к улучшению!`);
        }
        return json(res, 200, { ok: true });
      } catch (_) {
        return json(res, 400, { ok: false });
      }
    }

    if (u.pathname === '/api/feedback/list') {
      if (u.searchParams.get('key') !== ADMIN_KEY) return json(res, 403, { error: 'bad key' });
      return json(res, 200, { list: loadJson(F.feedback, []) });
    }

    if (u.pathname === '/api/check') {
      if (rateLimited(ip)) return json(res, 429, { ok: false });
      const c = (u.searchParams.get('code') || '').toUpperCase();
      return json(res, 200, { valid: codeWasSold(c), code: c });
    }

    /* AML-админ (ключ обязателен): проверка адреса, hold-лист, возврат решения, пополнение блок-листа */
    if (u.pathname === '/api/digest') {
      if (u.searchParams.get('key') !== ADMIN_KEY) return json(res, 403, { error: 'bad key' });
      const text = await dailyDigestText();
      await notify(text);
      return json(res, 200, { sent: true, text });
    }
    if (u.pathname === '/api/aml/check') {
      if (u.searchParams.get('key') !== ADMIN_KEY) return json(res, 403, { error: 'bad key' });
      const addr = (u.searchParams.get('address') || '').trim();
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return json(res, 400, { error: 'bad address' });
      const verdict = await screenAddress(addr);
      return json(res, 200, { address: addr, verdict });
    }
    if (u.pathname === '/api/aml/holds') {
      if (u.searchParams.get('key') !== ADMIN_KEY) return json(res, 403, { error: 'bad key' });
      return json(res, 200, { list: loadJson(AML.holds, []) });
    }
    if (u.pathname === '/api/aml/release') {
      if (u.searchParams.get('key') !== ADMIN_KEY) return json(res, 403, { error: 'bad key' });
      const h = (u.searchParams.get('hash') || '').toLowerCase();
      const r = releaseAmlHold(h);
      if (!r) return json(res, 404, { error: 'hold not found or already released' });
      alertSales(`AML: владелец подтвердил платёж ${h.slice(0, 10)}… вручную — код ${r.code} выдан`);
      return json(res, 200, r);
    }
    if (u.pathname === '/api/aml/block') {
      if (u.searchParams.get('key') !== ADMIN_KEY) return json(res, 403, { error: 'bad key' });
      const addr = (u.searchParams.get('address') || '').trim();
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return json(res, 400, { error: 'bad address' });
      fs.appendFileSync(AML.blocklist, `${addr} | вручную владельцем | ${new Date().toISOString().slice(0, 10)}\n`);
      return json(res, 200, { ok: true, blocked: addr });
    }

    /* публичная сводка отзывов — для лендинга (контакты не разглашаются) */
    if (u.pathname === '/api/public/summary') {
      const fb = loadJson(F.feedback, []);
      const good = fb.filter(x => +x.rating >= 4 && (x.text || '').trim());
      const strip = s => String(s).replace(/[<>]/g, '').slice(0, 140);
      const sales = loadJson(F.sales, []);
      return json(res, 200, {
        price: PRICE,
        promoPrice: PROMO_PRICE,
        promoLeft: Math.max(0, PROMO_FIRST - sales.length),
        visits: visits24(),
        count: fb.length,
        avg: fb.length ? +(fb.reduce((s, x) => s + (+x.rating || 0), 0) / fb.length).toFixed(1) : 0,
        quotes: good.slice(-3).reverse().map(x => ({ rating: +x.rating, text: strip(x.text) })),
      });
    }

    /* живость для внешних аптайм-мониторов */
    if (u.pathname === '/healthz') {
      return json(res, 200, {
        ok: true,
        uptime: Math.round(process.uptime()),
        sales: loadJson(F.sales, []).length,
        telegramAlerts: !!(process.env.ALERT_TELEGRAM_TOKEN && process.env.ALERT_TELEGRAM_CHAT_ID),
      });
    }

    if (u.pathname === '/api/stats') {
      if (u.searchParams.get('key') !== ADMIN_KEY) return json(res, 403, { error: 'bad key' });
      const sales = loadJson(F.sales, []);
      let stock = 0;
      try {
        stock = fs.readFileSync(F.stock, 'utf8').split('\n')
          .filter(l => l.includes('| не продан')).length;
      } catch (_) {}
      return json(res, 200, {
        salesCount: sales.length,
        revenue: sales.reduce((s, x) => s + (+x.amount || 0), 0),
        codesLeft: stock,
        sales: sales.slice(-50),
        feedback: feedbackStats(),
        alerts: loadJson(F.alerts, []).slice(-10),
        aml: {
          holds: loadJson(AML.holds, []).filter(x => !x.released).length,
          rejected: loadJson(AML.holds, []).length,
          blocklist: loadBlocklist().size,
        },
        wallet: WALLET,
        price: PRICE,
      });
    }

    if (u.pathname === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(ADMIN_HTML);
    }

    /* статика */
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res, u.pathname);
    }
    res.writeHead(405);
    res.end();
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log('=== АнтиКамера PRO: автономный сервер продаж ===');
    console.log('Приложение:  http://localhost:' + PORT + '/');
    console.log('Лендинг:     http://localhost:' + PORT + '/landing/');
    console.log('Панель:      http://localhost:' + PORT + '/admin?key=' + ADMIN_KEY);
    console.log('Кошелёк USDT TRC20: ' + WALLET + ' · цена: ' + PRICE + ' USDT');
    console.log('Состояние: ' + DIR);
    scheduleDigest();
    setTimeout(redditWatchTick, 2 * 60 * 1000);
    setInterval(() => { redditWatchTick(); }, 30 * 60 * 1000).unref();
        console.log('Алерты: Telegram(' + (process.env.ALERT_TELEGRAM_TOKEN ? 'вкл' : 'выкл') +
      ') webhook(' + (process.env.ALERT_WEBHOOK_URL ? 'вкл' : 'выкл') + ') → /admin');
    // анти-усыпление (KEEP_AWAKE=1 + PUBLIC_URL): сам пингует свой публичный
    // адрес каждые 10 минут — бесплатный инстанс Render не засыпает
    if (process.env.KEEP_AWAKE === '1' && process.env.PUBLIC_URL) {
      const self = process.env.PUBLIC_URL.replace(/\/$/, '');
      setInterval(() => {
        fetch(self + '/healthz').catch(() => {});
      }, 10 * 60 * 1000).unref();
      console.log('Анти-усыпление: вкл (' + self + ')');
    }
  });
  return server;
}

if (require.main === module) start();
module.exports = { verifyPayment, mintCode, checkCode, feedbackStats, takeCodeFromStock, codeWasSold, screenAddress, recordAmlHold, releaseAmlHold, dailyDigestText, redditWatchTick, F, AML, ADMIN_KEY };
