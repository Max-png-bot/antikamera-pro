#!/usr/bin/env node
/* ================================================================
   АнтиКамера PRO — наблюдатель платежей USDT TRC20 (инструмент ПРОДАВЦА).
   Следит за поступлениями USDT на кошелёк через публичный API TronGrid,
   при оплате >= цены выдаёт следующий непроданный код активации из склада
   и помечает его проданным.

   Запуск (рекомендуется на вашем ПК/сервере, лучше с API-ключом TronGrid):
     node tron_watcher.js --wallet TBA... --codes ../sales/codes_batch1.txt
     node tron_watcher.js ... --once     (разовый прогон, удобно для cron)
     node tron_watcher.js --help

   Получить API-ключ (бесплатно): https://tronscan.org → Account → API
   Потом добавьте в переменные окружения TRONGRID_KEY или аргумент --key.
   ================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const WALLET = arg('--wallet', 'TBA8d1eLJhLVKGjQfeDcxvEJTmrq7Nzrc9');
const CODES_FILE = arg('--codes', path.join(__dirname, '..', 'sales', 'codes_batch1.txt'));
const STATE_FILE = arg('--state', path.join(__dirname, '..', 'sales', 'watcher_state.json'));
const PRICE = parseFloat(arg('--price', '9.9'));
const INTERVAL_SEC = parseInt(arg('--interval', '60'), 10);
const API_KEY = process.env.TRONGRID_KEY || arg('--key', '');
const ONCE = argv.includes('--once');
const HELP = argv.includes('--help') || argv.includes('-h');

if (HELP) {
  console.log(`Наблюдатель платежей АнтиКамера PRO (USDT TRC20)

Опции:
  --wallet  ADDR    кошелёк для приёма оплат (по умолчанию ваш)
  --codes   FILE    склад кодов активации (проданные помечаются)
  --state   FILE    файл состояния обработанных транзакций
  --price   N       минимальная сумма оплаты в USDT (по умолчанию 9.9)
  --interval SEC    период опроса API (по умолчанию 60 c)
  --key     KEY     API-ключ TronGrid (или переменная TRONGRID_KEY)
  --once            один прогон и выход (для cron/планировщика)

Файл кодов — строки вида:  AKP-XXXX-XXXX-XXXX | не продан | —`);
  process.exit(0);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) { return { seen: [] }; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function loadCodes() {
  const lines = fs.readFileSync(CODES_FILE, 'utf8').split('\n');
  return lines.map((l, idx) => ({ l: l.trim(), idx })).filter(x => x.l && !x.l.startsWith('#'));
}
function markSold(codeLineIdx, code, txHash, amount) {
  let txt = fs.readFileSync(CODES_FILE, 'utf8');
  const lines = txt.split('\n');
  const old = lines[codeLineIdx];
  if (old.includes('| не продан')) {
    lines[codeLineIdx] = old.replace('| не продан | —', `| продан | tx ${txHash} (${amount} USDT)`);
    txt = lines.join('\n');
    fs.writeFileSync(CODES_FILE, txt);
    return true;
  }
  return false;
}

async function fetchTransfers() {
  const url = `https://api.trongrid.io/v1/accounts/${WALLET}/transactions/trc20?limit=50&only_to=true&contract_type=trc20transfer`;
  const headers = API_KEY ? { 'TRON-PRO-API-KEY': API_KEY } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j.data || []).map(tx => {
    const d = tx;
    const amount = parseInt(d.value || '0', 10) / 1e6;
    const symbol = (d.token_info && d.token_info.symbol) || '';
    return { hash: d.transaction_id, from: d.from, amount, symbol, ts: d.block_timestamp };
  });
}

async function tick(state) {
  const txs = await fetchTransfers();
  let acted = 0;
  for (const tx of txs) {
    if (state.seen.includes(tx.hash)) continue;
    state.seen.push(tx.hash);
    if (state.seen.length > 500) state.seen = state.seen.slice(-500);
    if (tx.symbol !== 'USDT') {
      console.log(`[пропуск] ${tx.hash}: не USDT (${tx.symbol})`);
      continue;
    }
    if (tx.amount < PRICE) {
      console.log(`[пропуск] ${tx.hash}: сумма ${tx.amount} USDT < ${PRICE}`);
      continue;
    }
    // оплата найдена — выдать код
    const codes = loadCodes();
    const free = codes.find(c => c.l.includes('| не продан'));
    if (!free) {
      console.log(`!!! ОПЛАТА ${tx.amount} USDT (${tx.hash}), но коды кончились — пополните склад!`);
      continue;
    }
    const code = free.l.split('|')[0].trim();
    if (markSold(free.idx, code, tx.hash, tx.amount)) {
      acted++;
      console.log('='.repeat(60));
      console.log(`ОПЛАТА ${tx.amount} USDT получена!`);
      console.log(`  tx:      https://tronscan.org/#/transaction/${tx.hash}`);
      console.log(`  от:      ${tx.from}`);
      console.log(`  дата:    ${new Date(tx.ts).toLocaleString('ru-RU')}`);
      console.log(`  ВЫДАТЬ КОД ПОКУПАТЕЛЮ: ${code}`);
      console.log('='.repeat(60));
    }
  }
  saveState(state);
  return acted;
}

(async () => {
  console.log(`Наблюдатель АнтиКамера PRO: кошелёк ${WALLET}`);
  console.log(`Склад кодов: ${CODES_FILE} · цена: ${PRICE} USDT · интервал: ${INTERVAL_SEC} c`);
  const state = loadState();
  if (ONCE) {
    try { await tick(state); } catch (e) { console.error('Ошибка запроса:', e.message); process.exit(1); }
    return;
  }
  console.log('Работаю в цикле. Ctrl+C — остановка.\n');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { await tick(state); } catch (e) { console.error('Ошибка запроса:', e.message); }
    await new Promise(r => setTimeout(r, INTERVAL_SEC * 1000));
  }
})();
