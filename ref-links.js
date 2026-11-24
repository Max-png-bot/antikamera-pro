/* АнтиКамера PRO — конфиг реферальных ссылок (v15).
   ВЛАДЕЛЕЦ: когда появятся партнёрские коды бирж, просто замените значения
   ссылок ниже на свои реферальные (инструкция: marketing/ref_links_setup.md).
   Файл отдаётся с no-cache — изменения применяются на всех страницах сразу.
   Пока стоят обычные официальные ссылки без кода. */
window.AK_REF = {
  // биржи (партнёрские программы: до 30–50% от комиссии приведённого трейдера)
  bybit:    'https://www.bybit.com',
  okx:      'https://www.okx.com',
  binance:  'https://www.binance.com',
  coinbase: 'https://www.coinbase.com',
  kraken:   'https://www.kraken.com',
  // кошельки
  trust:    'https://trustwallet.com',
  tronlink: 'https://www.tronlink.org',
  tonkeeper:'https://tonkeeper.com',
  // тепловизоры (Amazon Associates / партнёрки производителей, 1–8%)
  infiRay:  'https://www.infiray.com',
  topdon:   'https://www.topdon.com',
  flir:     'https://www.flir.com'
};
// применение: все <a data-ref="bybit"> получают ссылку из конфига
(function () {
  function apply() {
    var map = window.AK_REF || {};
    var els = document.querySelectorAll('a[data-ref]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-ref');
      if (map[k]) els[i].href = map[k];
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
