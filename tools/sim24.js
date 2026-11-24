
let banners = [], logs = [], beeps = [];
function banner(t) { if (t) banners.push(String(t).slice(0, 60)); }
function addLog(ts, t) { logs.push(String(t).slice(0, 160)); }
function now2() { return '12:00:00'; }
function beep(f) { beeps.push(f); }
function vibrate() {}
function setStats() {}
function trText(t) { return null; }
const $ = (id) => ({ textContent: '', style: {} });
const stage = { getBoundingClientRect: () => ({ width: 570, height: 470 }) };
const overlay = { width: 570, height: 470 };
const dpr = 1;
const window = { devicePixelRatio: 2, addEventListener() {} };
const octx = new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 30 }) : () => {}), set: () => true });
const requestAnimationFrame = () => {};
const PROC_W = 192, PROC_H = 144;
const S = { running: true, demo: false, mode: 'blink', torch: false, torchOK: true,
  graceUntil: 0, threshold: 233, showCand: true, lastProc: 0, nextId: 1,
  gmag: 0, stillMs: 0, lastStillTs: 0, pcf: 0, pcfL: 0, gxs: 0, gys: 0,
  scanOn: false, travel: 0, dispX: 0, dispY: 0, scanT0: 0, scanClean: false,
  pcurArr: [], netMo: 0, pd: 0, pdy: 0,
  stillAck: false, stillChk: 0, rtMs: 0, prvTs: 0, restWarned: false };
const tracker = new Map();
let SCENE = { s: 0, glint: 'none', phase: false, gw: 3, gh: 4, gpk: 240, hi: 0.1, gy: 50, natOnly: false, sector: 20 };
const TEX = new Uint8Array(192 * 144);
(function () {
  let seed = 1234567;
  for (let i = 0; i < 192 * 144; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    TEX[i] = 12 + (seed % 8);
  }
  for (let y = 60; y < 100; y++) for (let x = 40; x < 120; x++) TEX[y * 192 + x] = 55 + ((x + y) % 5);
})();
function tex(x, y) {
  x = ((Math.round(x) % 192) + 192) % 192;
  y = ((Math.round(y) % 144) + 144) % 144;
  return TEX[y * 192 + x];
}
function makeFrame() {
  const d = new Uint8ClampedArray(192 * 144 * 4);
  for (let y = 0; y < 144; y++) for (let x = 0; x < 192; x++) {
    const i = (y * 192 + x) * 4;
    const v = tex(x + Math.round(SCENE.s), y);
    d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  const wallFixed = SCENE.glint === 'lens' || SCENE.glint === 'chrome';
  const gx = 99 - (wallFixed ? SCENE.s : 0);
  let present = true;
  if (SCENE.glint === 'chrome') present = Math.abs(SCENE.s - 60) < (SCENE.sector || 20);
  if (SCENE.glint === 'glosswall') present = true;
  const val = (SCENE.natOnly && (SCENE.glint === 'lens' || SCENE.glint === 'chrome')) ? 90 : (SCENE.gpk || 240);
  if (SCENE.phase && present && SCENE.glint !== 'none' && SCENE.glint !== 'led') {
    const sz = SCENE.glint === 'glosswall' ? 12 : (SCENE.gw || 3);
    for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
      const i = (SCENE.gy * 192 + Math.round(gx) + dx + dy * 192) * 4;
      d[i] = d[i+1] = d[i+2] = val;
    }
  }
  if (SCENE.glint === 'led') {
    const lx = 150 - SCENE.s;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = (90 * 192 + Math.round(lx) + dx + dy * 192) * 4; d[i] = d[i+1] = d[i+2] = 250;
    }
  }
  return d;
}
/* нативный кадр 1280×720: нули + микро-ядро (линза на дистанции) */
function makeNative(W, H) {
  const d = new Uint8ClampedArray(W * H * 4);
  const put = (nx, ny, sz, v) => {
    for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
      const x = Math.round(nx) + dx, y = Math.round(ny) + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = (y * W + x) * 4; d[i] = d[i+1] = d[i+2] = v;
    }
  };
  const wallFixed = SCENE.glint === 'lens' || SCENE.glint === 'chrome';
  if (SCENE.phase && SCENE.glint !== 'none' && SCENE.glint !== 'led') {
    let present = true;
    if (SCENE.glint === 'chrome') present = Math.abs(SCENE.s - 60) < (SCENE.sector || 20);
    if (SCENE.glint === 'glosswall') present = false;  /* глянец не микро-ядро */
    if (present) {
      const gx = (99 - (wallFixed ? SCENE.s : 0)) * W / 192;
      const gy = SCENE.gy * H / 144;
      put(gx, gy, 3, 255);
    }
  }
  if (SCENE.glint === 'led') put(150 * W / 192, 90 * H / 144, 2, 255);
  return d;
}
let lastCrop = [0, 0];
const pctx = { drawImage() {}, getImageData() { return { data: makeFrame(), width: 192, height: 144 }; } };
const video = { readyState: 2, videoWidth: 1280, videoHeight: 720 };
const nctxStub = { drawImage() {}, getImageData(x, y, W, H) { return { data: makeNative(W, H), width: W, height: H }; } };
const document = { createElement: () => ({ width: 0, height: 0, getContext: () => nctxStub, style: {} }) };
const hctx = {
  drawImage(src, rx, ry) { lastCrop = [rx, ry]; },
  getImageData() {
    const d = new Uint8ClampedArray(48 * 48 * 4);
    const type = SCENE.glint, on = SCENE.phase;
    const gx = (99 - ((type === 'lens' || type === 'chrome') ? SCENE.s : 0)) * 1280 / 192 - lastCrop[0];
    const gy = SCENE.gy * 720 / 144 - lastCrop[1];
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const i = (y * 48 + x) * 4;
      let v = tex(Math.round((lastCrop[0] + x) * 192 / 1280 + SCENE.s), Math.round((lastCrop[1] + y) * 144 / 720));
      const r = Math.hypot(x - gx, y - gy);
      const present = type === 'chrome' ? Math.abs(SCENE.s - 60) < (SCENE.sector || 20) : true;
      if (on && present && (type === 'lens' || type === 'chrome' || type === 'glosswall')) {
        const R = type === 'glosswall' ? 16 : 4;
        if (r < R) v = (r < R * Math.sqrt(SCENE.hi)) ? 255 : 244;
      }
      d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
    }
    return { data: d, width: 48, height: 48 };
  }
};
const dctx = { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, arc() {}, fill() {} };
const demoCanvas = {};
const mask = new Uint8Array(PROC_W * PROC_H);
  const visited = new Uint8Array(PROC_W * PROC_H);
  const stack = new Int32Array(PROC_W * PROC_H);
  function detectBlobs(img) {
    const d = img.data, W = PROC_W, H = PROC_H, th = S.threshold;
    mask.fill(0);
    for (let i = 0, p = 0; i < W * H; i++, p += 4) {
      if (d[p] >= th || d[p + 1] >= th || d[p + 2] >= th) mask[i] = 1;
    }
    visited.fill(0);
    const blobs = [], giants = [], maxA = W * H * 0.02;
    for (let i = 0; i < W * H; i++) {
      if (!mask[i] || visited[i]) continue;
      let sp = 0; stack[sp++] = i; visited[i] = 1;
      let minX = W, maxX = 0, minY = H, maxY = 0, area = 0, sx = 0, sy = 0, sb = 0, pk = 0;
      while (sp > 0) {
        const j = stack[--sp], x = j % W, y = (j / W) | 0;
        const br = Math.max(d[j * 4], d[j * 4 + 1], d[j * 4 + 2]);
        area++; sx += x; sy += y; sb += br; if (br > pk) pk = br;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x > 0 && mask[j - 1] && !visited[j - 1]) { visited[j - 1] = 1; stack[sp++] = j - 1; }
        if (x < W - 1 && mask[j + 1] && !visited[j + 1]) { visited[j + 1] = 1; stack[sp++] = j + 1; }
        if (y > 0 && mask[j - W] && !visited[j - W]) { visited[j - W] = 1; stack[sp++] = j - W; }
        if (y < H - 1 && mask[j + W] && !visited[j + W]) { visited[j + W] = 1; stack[sp++] = j + W; }
      }
      if (area > maxA) { giants.push({ minX, maxX, minY, maxY }); continue; }  /* v19: пересвет при близком сканировании */
      if (area < 2 || pk < (area >= 3 ? 236 : 242)) continue;  /* v19: 3+px — pk≥236 (просветные покрытия линз тусклее), 1–2px — ≥242 (шум матрицы) */
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const fill = area / (bw * bh), asp = bw / bh;
      if (fill < 0.45 || asp < 0.3 || asp > 3.4) continue;
      blobs.push({ cx: sx / area, cy: sy / area, w: bw, h: bh, mean: sb / area / 3, area, pk });
    }
    /* v19: гигантский блоб (вспышка залила кадр при близком сканировании) —
       внутри ищем насыщенные ядра (≥248) как псевдо-блобы: так находится блик
       линзы, растворённый в пересвете. Большой зеркальный блик (>35% кадра) —
       пропускаем целиком. */
    visited.fill(0);  /* основной цикл уже замаркировал гигантов — сброс для прохода по ядрам */
    for (const g of giants) {
      if ((g.maxX - g.minX + 1) * (g.maxY - g.minY + 1) > W * H * 0.35) continue;
      for (let y = g.minY; y <= g.maxY; y++) for (let x = g.minX; x <= g.maxX; x++) {
        const i0 = y * W + x;
        if (!mask[i0] || visited[i0]) continue;
        if (Math.max(d[i0 * 4], d[i0 * 4 + 1], d[i0 * 4 + 2]) < 248) continue;
        let sp = 0; stack[sp++] = i0; visited[i0] = 1;
        let minX2 = W, maxX2 = 0, minY2 = H, maxY2 = 0, area2 = 0, sx2 = 0, sy2 = 0;
        while (sp > 0) {
          const j = stack[--sp], x2 = j % W, y2 = (j / W) | 0;
          area2++; sx2 += x2; sy2 += y2;
          if (x2 < minX2) minX2 = x2; if (x2 > maxX2) maxX2 = x2;
          if (y2 < minY2) minY2 = y2; if (y2 > maxY2) maxY2 = y2;
          const nbs = [x2 > 0 ? j - 1 : -1, x2 < W - 1 ? j + 1 : -1, y2 > 0 ? j - W : -1, y2 < H - 1 ? j + W : -1];
          for (let k = 0; k < 4; k++) { const j2 = nbs[k];
            if (j2 >= 0 && mask[j2] && !visited[j2] &&
                Math.max(d[j2 * 4], d[j2 * 4 + 1], d[j2 * 4 + 2]) >= 248) { visited[j2] = 1; stack[sp++] = j2; } }
        }
        const bw2 = maxX2 - minX2 + 1, bh2 = maxY2 - minY2 + 1;
        if (area2 < 2 || area2 > 40 || bw2 > 6 || bh2 > 6) continue;
        blobs.push({ cx: sx2 / area2, cy: sy2 / area2, w: bw2, h: bh2, mean: 250, area: area2, pk: 255 });
      }
    }
    return blobs;
  }
  function updateTracker(blobs, phaseOn, now) {
    const R = 11, used = new Set();
    const pairs = [];
    for (const b of blobs) {
      let bestId = null, bd = 1e9;
      for (const [id, t] of tracker) {
        const dd = (t.pcx - b.cx) ** 2 + (t.pcy - b.cy) ** 2;  /* по сырой позиции: EMA отстаёт */
        if (dd < bd) { bd = dd; bestId = id; }
      }
      if (bestId !== null && bd <= R * R) pairs.push([bestId, b]);
      else {
        const id = S.nextId++;
        tracker.set(id, { cx: b.cx, cy: b.cy, pcx: b.cx, pcy: b.cy, w: b.w, h: b.h, mean: b.mean, pk: b.pk || 0,
          pmin: S.pcur, pmax: S.pcur,
          on: phaseOn ? 1 : 0, off: phaseOn ? 0 : 1, hits: 1, miss: 0, last: now, alerted: false,
          rel: 0, frames: 0, mframes: 0, gpk: 0, hisat: b.hisat || 0, bmiss: 0, gloss: false });
        used.add(id);
      }
    }
    /* ИИ-фильтр поверхностей (v16): глобальное движение — из центроида сцены
       (см. loop). Медиана треков НЕ используется: если все треки — сама люстра,
       она «обнулит» собственный параллакс. Блик линзы (ретрорефлектор) держится
       на месте относительно сцены; блик глянца/лака/хрусталя «плывёт». */
    const gx = S.sok ? S.sdx : 0, gy = S.sok ? S.sdy : 0;
    for (const [id, b] of pairs) {
      const t = tracker.get(id); used.add(id);
      if (t.miss === 0) t.rel += Math.hypot((b.cx - t.pcx) - gx, (b.cy - t.pcy) - gy);  /* miss>0: за паузу движение неизвестно */
      t.pcx = b.cx; t.pcy = b.cy;
      t.frames++;
      if (S.gmag >= 1.5 || (S.netMo || 0) >= 8) t.mframes++;  /* v24: кадры с движением — и по netMo (дистанция) */
      if (phaseOn && S.pcur !== undefined) {
        if (t.pmin === undefined || S.pcur < t.pmin) t.pmin = S.pcur;
        if (t.pmax === undefined || S.pcur > t.pmax) t.pmax = S.pcur;
      }
      t.gpk = Math.max(t.gpk, S.gmag);
      if ((b.hisat || 0) > t.hisat) t.hisat = b.hisat;  /* v17: максимум резкости ядра за жизнь трека */
      t.cx = t.cx * .7 + b.cx * .3; t.cy = t.cy * .7 + b.cy * .3;
      t.w = t.w * .7 + b.w * .3; t.h = t.h * .7 + b.h * .3;
      t.mean = t.mean * .7 + b.mean * .3; t.pk = Math.max(t.pk * .95, b.pk || 0);
      t.last = now; t.miss = 0;
      if (phaseOn) t.on++; else t.off++;
      t.hits++;
    }
    for (const [id, t] of tracker) {
      if (!used.has(id)) {
        t.miss++;
        if (phaseOn) t.bmiss = (t.bmiss || 0) + 1;  /* v23: пропуск ON-фазы — блик не линзовый (узкий сектор) */
        if (t.miss > 26 || now - t.last > 3200) tracker.delete(id);
      }
      if (t.alerted && t.miss > 12) t.alerted = false;
    }
  }
  function syncOK(t) {
    /* v23: линза бликует в КАЖДУЮ ON-фазу, пока видна. Предмет, бликующий
       только в узком секторе (хром/стекло), мигает «очками» — пропуски
       ON-фаз (bmiss) накапливаются. Допуск для реальных линз с мерцанием
       детекции на границе чувствительности. */
    return S.mode === 'blink'
      ? (t.on >= 6 && t.off <= 1 && t.on + t.off >= 7 && (t.bmiss || 0) <= Math.max(3, t.on * 0.5))
      : (t.hits >= 14 && t.miss < 3);
  }
  function shapeOK(t) { return t.w <= 26 && t.h <= 26; }
  function coreOK(t) {
    /* v17/v20: доля насыщенного ядра (≥250) среди ярших пикселей блоба в
       нативном разрешении. Линза ≥ 0.4; блеск краски/лака размыт (~0.1–0.3).
       Размер ≤ 8×8: большие насыщенные блики — зеркала/стёкла/лампы.
       Путь для вращения телефона; параллакс — отдельный путь (см. classify). */
    return (t.hisat || 0) >= 0.4 && t.w <= 8 && t.h <= 8;
  }
  function motionOK(t) {
    /* ИИ-фильтр v17: при СДВИГЕ телефона блик линзы смещается вместе со сценой
       (rel ≈ 0), блеск краски остаётся у точки отражения фонарика (rel ≈
       движению сцены) — порог жёсткий. Вращение параллакса не создаёт — тогда
       блеск отсеивает coreOK. Телефон неподвижен — проверить нечем (подсказка
       попросит именно сдвинуть, не поворачивать). Демо — без параллакса. */
    if (S.demo) return true;
    if (((t.pmax || 0) - (t.pmin || 0)) < 8) return false;  /* v24: нет смещения ≥8px (4° FOV) — подтверждения нет */
    if (!t.mframes || t.mframes < 5) return false;
    return (t.rel / t.mframes) <= 0.45 + 0.35 * t.gpk;
  }
  function classify(t) {
    /* v22: красное ТРЕБУЕТ движения телефона (gpk≥1.2, mframes≥5) И один из
       сигналов: (а) строгий параллакс motionOK — «прилип» к сцене (подтверждает
       и тусклые линзы), ИЛИ (б) насыщенное малое ядро ≤8×8 ПРИ слабом дрейфе
       rel/mf ≤ порог+0.35 (вращение — параллакс неопределён). Уроки:
       v17 (ядро обязательно) — тусклая линза не находилась; v20 (ядро вместо
       параллакса) — хром/стекло/глянец «камеры» без движения. Насыщенный блик,
       который явно плывёт (rel/mf > порог+0.35), — НЕ камера, что бы ни показывало
       ядро. Без движения красного нет — только подсказка-«похоже» (см. loop). */
    const parThr = 0.45 + 0.35 * t.gpk;
    if (syncOK(t) && shapeOK(t) && ((t.pmax || 0) - (t.pmin || 0)) >= 8 && t.mframes >= 5 &&
        (motionOK(t) || (coreOK(t) && (t.rel / t.mframes) <= parThr + 0.35))) return 2;
    if (S.mode === 'blink') { if (t.hits >= 5) return 1; }
    else if (t.hits >= 4) return 1;
    return 0;
  }
  /* ---- v18: АНАЛИЗ СТЕНЫ ----
     Скрытая камера — маленькая НЕПОДВИЖНАЯ точка: линза-ретрорефлектор
     бликует в одном и том же месте стены, откуда бы ни светил телефон.
     Блеск краски при этом «плывёт» по поверхности. Копим карту ячеек
     в координатах СТЕНЫ (позиция блика минус накопленное смещение сцены):
     ячейка, накопившая >= 8 бликов при >= 18px пути телефона = стабильная
     точка. Насыщенное ядро + мигание только со вспышкой = «возможна
     камера» (красный). Светится и без вспышки = LED/индикатор. */
  const scanCells = new Map();
  function resetScan() {
    scanCells.clear(); S.travel = 0;
    S.pd = S.pdy = 0; S.covLo = S.covHi = undefined;
    S.pOn = S.pOff = null; S.pox = S.poy = 0; S.pcur = S.pcurY = undefined;
    S.pcurArr = []; S.netMo = 0; S.pmiss = 0;
    S.scanT0 = performance.now(); S.scanClean = false; S.glossTold = false;
  }
  /* v23: столбцовые/строчные профили тёмных полутонов — датчик положения стены.
     1D-корреляция с опорным кадром скана иммунна к выходу контента из FOV
     (у центроида это давало дрейф ±25px при взмахе «волной»). */
  function colProfiles(img) {
    const d = img.data, cw = new Uint16Array(PROC_W), rw = new Uint16Array(PROC_H);
    let tot = 0;
    for (let i = 0, q = 0; i < PROC_W * PROC_H; i++, q += 4) {
      const v = d[q];
      if (v >= 20 && v < 110) { cw[i % PROC_W]++; rw[(i / PROC_W) | 0]++; tot++; }
    }
    if (tot < 40) {  /* тёмных мало (светлая стена) — запасной диапазон */
      cw.fill(0); rw.fill(0); tot = 0;
      for (let i = 0, q = 0; i < PROC_W * PROC_H; i++, q += 4) {
        const v = d[q];
        if (v >= 110 && v < 200) { cw[i % PROC_W]++; rw[(i / PROC_W) | 0]++; tot++; }
      }
    }
    return { cw: cw, rw: rw, tot: tot };
  }
  function profShift(cur, ref, lim) {  /* сдвиг контента = позиция телефона; null = нет текстуры/сдвиг > lim */
    const n = ref.length; let best = 1e9, bd = 0, sum = 0, cnt = 0;
    for (let dd = -lim; dd <= lim; dd++) {
      let e = 0, c = 0;
      for (let x = 0; x < n; x++) { const xr = x + dd; if (xr >= 0 && xr < n) { e += Math.abs(cur[x] - ref[xr]); c++; } }
      if (!c) continue;
      e /= c; sum += e; cnt++;
      if (e < best) { best = e; bd = dd; }
    }
    if (!cnt) return null;
    return best < 0.8 * (sum / cnt) ? bd : null;
  }
  /* v24: позиция телефона из профильной корреляции — на каждом кадре (не только
     в скане). Накопленное смещение за окно (netMo) — гейт «телефон двигался»,
     инвариантный к дистанции: px/кадр центроида на 2–3 м < 1 из-за масштаба,
     и линза не подтверждалась вовсе (жалоба №8: «камеру не находит»). */
  function posUpdate(img, phaseOn) {
    const pr = colProfiles(img);
    if (pr.tot < 60) return null;
    let ref = phaseOn ? S.pOn : S.pOff;
    if (!ref) { if (phaseOn) S.pOn = pr; else S.pOff = pr; return { dx: 0, dy: 0 }; }
    const dx = profShift(pr.cw, ref.cw, 90), dy = profShift(pr.rw, ref.rw, 70);
    if (dx === null || dy === null) {
      S.pmiss = (S.pmiss || 0) + 1;
      if (S.pmiss > 10) {  /* ушли далеко от опорного кадра — перебазировка с переносом origin */
        if (phaseOn) S.pOn = pr; else S.pOff = pr;
        S.pox = S.pcur || 0; S.poy = S.pcurY || 0; S.pmiss = 0;
      }
      return null;
    }
    S.pmiss = 0;
    S.pcur = S.pox + dx; S.pcurY = S.poy + dy;
    if (phaseOn) {
      S.pcurArr.push(S.pcur);
      if (S.pcurArr.length > 24) S.pcurArr.shift();
      let mn = 1e9, mx = -1e9;
      for (const v of S.pcurArr) { if (v < mn) mn = v; if (v > mx) mx = v; }
      S.netMo = mx - mn;
    }
    return { dx: dx, dy: dy };
  }

  /* v24: нативные микро-ядра. Фото-исследование (реальные фото скрытых камер):
     линза на комнатной дистанции = 2–8 НАТИВНЫХ px (0.1–0.5% кадра) — даунскейл
     1280→192 усредняет её с тёмным barrel'ом до <порога, и блоб не находился
     ВООБЩЕ. Сканируем полный нативный кадр: насыщенные (≥250) компактные
     кластеры 2..64 px, ≤12px в поперечнике → псевдо-блобы в PROC-координатах.
     Горячие пиксели (1 px) отсекаются площадью; постоянные LED — фильтром фаз. */
  let ncv = null, nctx = null;
  function nativeCores(srcv, blobs) {
    const W = srcv.videoWidth || srcv.width, H = srcv.videoHeight || srcv.height;
    if (!W || !H || W > 2200) return;
    if (!ncv) { ncv = document.createElement('canvas'); nctx = ncv.getContext('2d', { willReadFrequently: true }); }
    if (ncv.width !== W || ncv.height !== H) { ncv.width = W; ncv.height = H; }
    try {
      nctx.drawImage(srcv, 0, 0, W, H);
      const d = nctx.getImageData(0, 0, W, H).data;
      const pts = [];
      for (let q = 0, i = 0; i < W * H; i++, q += 4) {
        if (d[q] >= 250 || d[q + 1] >= 250 || d[q + 2] >= 250) pts.push(i);
      }
      if (pts.length > W * H * 0.25) return;  /* пересвет кадра — PROC-гиганты уже работают */
      const set = new Set(pts), seen = new Set();
      for (const i of pts) {
        if (seen.has(i)) continue;
        const st = [i]; seen.add(i);
        let minX = W, maxX = 0, minY = H, maxY = 0, area = 0, pk = 0;
        while (st.length) {
          const j = st.pop(), x = j % W, y = (j / W) | 0;
          area++;
          const v = Math.max(d[j * 4], d[j * 4 + 1], d[j * 4 + 2]);
          if (v > pk) pk = v;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          for (const nb of [j + 1, j - 1, j + W, j - W]) if (set.has(nb) && !seen.has(nb)) { seen.add(nb); st.push(nb); }
        }
        const bw = maxX - minX + 1, bh = maxY - minY + 1;
        if (area < 2 || area > 64 || bw > 12 || bh > 12) continue;
        if (area / (bw * bh) < 0.3) continue;
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const pcx = cx * PROC_W / W, pcy = cy * PROC_H / H;
        let dup = false;
        for (const b of blobs) if (Math.abs(b.cx - pcx) <= 2 && Math.abs(b.cy - pcy) <= 2) { dup = true; break; }
        if (dup) continue;
        blobs.push({ cx: pcx, cy: pcy, w: Math.max(1, bw * PROC_W / W), h: Math.max(1, bh * PROC_H / H),
          mean: 240, area: area, pk: Math.max(pk, 250), nat: true });
      }
    } catch (e) { /* демо/ограничение браузера — тихо пропускаем */ }
  }

  function scanStep(blobs, phaseOn, img) {
    if (!S.scanOn || S.demo || !S.running) return;
    /* v23: карта стены строится ТОЛЬКО по ON-фазам от АБСОЛЮТНОЙ позиции
       центроида (единая база) — без интегрирования дельт (нет дрейфа и
       «размазывания» при колебаниях) и без межфазных скачков освещения.
       Тёмная фаза отдельно: светящаяся точка РЯДОМ с ячейкой в кадре = LED. */
    if (phaseOn) {
      /* v23: карта только по ON-фазам; координаты стены = позиция блика + сдвиг
         контента (профильная корреляция). Сдвиг = «на сколько камера ушла от
         опорного кадра» — rx-диапазон ячейки = сектор позиций телефона. */
      /* v24: сдвиг и путь — из posUpdate (корреляция профилей, вызывается в
         loop на каждом кадре). travel — коррелированный px-путь: центроидный
         gmag на 2–3 м занижал путь в разы, и span/travel-гейты не проходили. */
      if (S.pos) {
        const dx = S.pos.dx, dy = S.pos.dy;
        S.travel += Math.abs(dx - (S.pd || 0)) + Math.abs(dy - (S.pdy || 0));
        S.pd = dx; S.pdy = dy;
        const moving = (S.netMo || 0) >= 8;  /* v24: движение инвариантно дистанции (окно netMo) */
        S.covLo = Math.min(S.covLo === undefined ? dx : S.covLo, dx);
        S.covHi = Math.max(S.covHi === undefined ? dx : S.covHi, dx);
        for (const b of blobs) {
          const sx = b.cx + dx, sy = b.cy + dy;
          const key = Math.round(sx / 6) + ',' + Math.round(sy / 6);
          let c = scanCells.get(key);
          if (!c) { c = { g: 0, o: 0, hi: 0, w: 0, lx: b.cx, ly: b.cy, t0: S.travel, t1: S.travel, kind: '' };
            scanCells.set(key, c); }
          if (moving) c.g++;
          if ((b.hisat || 0) > c.hi) c.hi = b.hisat;
          if (b.w > c.w) c.w = b.w;
          if (b.pk > (c.pk || 0)) c.pk = b.pk;
          c.rx0 = Math.min(c.rx0 === undefined ? dx : c.rx0, dx);  /* v23: сектор позиций телефона, откуда блик виден */
          c.rx1 = Math.max(c.rx1 === undefined ? dx : c.rx1, dx);
          c.ry0 = Math.min(c.ry0 === undefined ? dy : c.ry0, dy);
          c.ry1 = Math.max(c.ry1 === undefined ? dy : c.ry1, dy);
          c.lx = b.cx; c.ly = b.cy; c.t1 = S.travel;
        }
      }
    } else {
      /* тёмная фаза: точка, светящаяся БЕЗ вспышки рядом с ячейкой карты — LED/индикатор */
      for (const b of blobs) {
        for (const c of scanCells.values()) {
          if (Math.abs(c.lx - b.cx) <= 15 && Math.abs(c.ly - b.cy) <= 15) { c.o++; break; }
        }
      }
    }
    if (S.pcf % 15 === 0) evaluateScan();
    const covr = (S.covHi || 0) - (S.covLo || 0);
    if (!S.scanClean && covr >= 60 && performance.now() - S.scanT0 > 9000 && !scanHasRed()) {
      S.scanClean = true;
      banner('Участок чист: стабильных бликующих точек не найдено.');
      addLog(now2(), 'Анализ стены: стабильных точек не найдено — участок чист.', 0);
    }
  }
  function scanHasRed() { for (const c of scanCells.values()) if (c.kind === 'red') return true; return false; }
  function evaluateScan() {
    /* v24: регионы-следы. Физический след одного блика по стене пересекает
       НЕСКОЛЬКО 6px-ячеек (на инструктированной скорости 5–10 см/с в ячейке
       успевает лишь одна ON-фаза) — оцениваем 8-связный регион следа:
       sticky = макс. g ячейки («сидел» в 6px всю фазу — мигание в такт на
       одном месте стены), dr = сектор позиций телефона, откуда след виден
       (линза-ретрорефлектор — весь проход; металл/стекло — узкий сектор),
       w/hi/pk — размер и насыщенность ядра. Дистанционно-инвариантно:
       пороги относительные (dr к охвату прохода), путь — коррелированный. */
    if (S.travel < 15) return;
    const covr = (S.covHi || 0) - (S.covLo || 0);
    const drThr = Math.max(12, 0.65 * Math.min(covr, 150));
    const marked = new Set();
    let glossRegions = 0;
    const setKind = (reg, kind) => { for (const k of reg.cells) scanCells.get(k).kind = kind; };
    for (const [key, c0] of scanCells) {
      if (marked.has(key) || c0.g < 2) continue;
      const reg = { g: 0, o: 0, w: 0, hi: 0, pk: 0, t0: c0.t0, t1: c0.t1, sticky: 0,
        rx0: 1e9, rx1: -1e9, ry0: 1e9, ry1: -1e9, cells: [], k0: c0.kind };
      const st = [key];
      marked.add(key);
      while (st.length) {
        const k = st.pop();
        const c = scanCells.get(k);
        reg.g += c.g; reg.o += c.o;
        if (c.g > reg.sticky) reg.sticky = c.g;
        if (c.w > reg.w) reg.w = c.w;
        if ((c.hi || 0) > reg.hi) reg.hi = c.hi;
        if ((c.pk || 0) > reg.pk) reg.pk = c.pk;
        reg.t0 = Math.min(reg.t0, c.t0); reg.t1 = Math.max(reg.t1, c.t1);
        if (c.rx0 !== undefined) { reg.rx0 = Math.min(reg.rx0, c.rx0); reg.rx1 = Math.max(reg.rx1, c.rx1); }
        if (c.ry0 !== undefined) { reg.ry0 = Math.min(reg.ry0, c.ry0); reg.ry1 = Math.max(reg.ry1, c.ry1); }
        reg.cells.push(k);
        const ij = k.split(','), ci = +ij[0], cj = +ij[1];
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const nk = (ci + di) + ',' + (cj + dj);
          const nc = scanCells.get(nk);
          if (nc && !marked.has(nk) && nc.g >= 2) { marked.add(nk); st.push(nk); }
        }
      }
      if (reg.rx1 < reg.rx0) { reg.rx0 = reg.rx1 = 0; }
      if (reg.ry1 < reg.ry0) { reg.ry0 = reg.ry1 = 0; }
      if (reg.cells.some(k => scanCells.get(k).kind === 'red')) continue;  /* v24: вердикт не откатывается */
      const span = reg.t1 - reg.t0;
      const dr = (reg.rx1 - reg.rx0) + (reg.ry1 - reg.ry0);
      const tot = reg.g + reg.o;
      const hard = reg.hi >= 0.4 || reg.pk >= 250 || reg.sticky >= 12;
      if (reg.o >= 3 && reg.o >= 0.25 * tot) {
        if (reg.k0 !== 'led') { setKind(reg, 'led');
          addLog(now2(), 'Анализ стены: точка светится и без вспышки — LED-индикатор или горячий пиксель, не камера.', 0); }
        else setKind(reg, 'led');
        continue;
      }
      if (reg.w >= 10 || (reg.sticky <= 5 && reg.g >= 3)) {  /* блик «плывёт»/широкий след — глянец поверхности */
        if (reg.w >= 10) glossRegions++;
        setKind(reg, 'gloss'); continue;
      }
      if (reg.sticky >= 6 && reg.w <= 9 && span >= 18 && dr >= drThr && covr >= 30 && hard) {
        setKind(reg, 'red');
        if (reg.k0 !== 'red') {  /* v24: сигнал один раз, не при каждом пересчёте карты */
          vibrate(); beep(1560);
          banner('ИИ-анализ стены: точка с признаками скрытой камеры — неподвижна, мигает в такт вспышке, видна со всех позиций прохода. Проверьте её вручную!');
          addLog(now2(), 'ИИ-анализ стены: признаки скрытой камеры — стабильная точка + широкий сектор + мигание в такт.', 0);
        }
      } else if (hard && dr < drThr && reg.hi >= 0.3 && reg.k0 !== 'chrome') {
        setKind(reg, 'chrome');  /* блик только из узкого сектора — предмет, не камера */
        addLog(now2(), 'ИИ-анализ стены: блик виден только из узкого сектора — предмет (металл/стекло/глянец), исключён из выборки.', 0);
      } else if (reg.k0 !== 'chrome') {
        if (reg.g >= 8) { setKind(reg, 'soft');
          addLog(now2(), 'Анализ стены: стабильный мягкий блик — глянец точки (шуруп/лак), вряд ли камера.', 0); }
      } else setKind(reg, reg.k0);
    }
    if (glossRegions >= 1 && !S.glossTold) {
      S.glossTold = true;
      addLog(now2(), 'ИИ-анализ стены: глянцевая поверхность — блик «плывёт» по стене, исключена из выборки.', 0);
    }
  }

  /* ---- /PURE ALGO ---- */

  /* ---- демо-сцена ---- */
  const demo = { specks: [] };
  (function () {
    let seed = 1234567;
    const rnd = () => (seed = (1103515245 * seed + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 10; i++) demo.specks.push({ x: rnd() * 320, y: rnd() * 240, r: 1 + rnd() * 2, a: .25 + rnd() * .5 });
    demo.lens = { x: 228, y: 96 };
    demo.led = { x: 60, y: 170 };
  })();
  function drawDemo(now) {
    const c = dctx, w = 320, h = 240;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0d12'); g.addColorStop(1, '#05070a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.03)';
    for (let i = 0; i < 40; i++) c.fillRect((i * 61 + (now / 90) % 61) % w, (i * 37) % h, 1, 1);
    for (const s of demo.specks) {
      c.fillStyle = 'rgba(210,225,235,' + (s.a * (S.torch ? 1 : .35)) + ')';
      c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill();
    }
    if (S.torch || S.mode === 'cont') {
      const rg = c.createRadialGradient(demo.lens.x, demo.lens.y, 0, demo.lens.x, demo.lens.y, 16);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(.18, 'rgba(255,255,255,.95)');
      rg.addColorStop(.5, 'rgba(255,240,210,.25)');
      rg.addColorStop(1, 'rgba(255,240,210,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(demo.lens.x, demo.lens.y, 16, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,1)';  /* v17: насыщенное ядро, как у реального блика линзы */
      c.beginPath(); c.arc(demo.lens.x, demo.lens.y, 4, 0, 7); c.fill();
    }
    const pulse = .7 + .3 * Math.sin(now / 260);
    c.fillStyle = 'rgba(255,60,60,' + pulse + ')';
    c.beginPath(); c.arc(demo.led.x, demo.led.y, 3, 0, 7); c.fill();
    c.fillStyle = 'rgba(120,140,155,.5)';
    c.fillRect(0, 214, w, 26); c.fillRect(0, 0, w, 14);
    c.fillStyle = 'rgba(150,170,185,.35)';
    c.fillRect(120, 40, 80, 70); c.fillRect(250, 130, 55, 60);
    return demoCanvas;
  }

  /* ---- наложение ---- */
  function resizeOverlay() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (overlay.width !== Math.round(r.width * dpr)) {
      overlay.width = Math.round(r.width * dpr); overlay.height = Math.round(r.height * dpr);
    }
  }
  function procToScreen(x, y) {
    const src = S.demo ? demoCanvas : video;
    const vw = src.videoWidth || src.width || 320, vh = src.videoHeight || src.height || 240;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const s = Math.max(sw / vw, sh / vh);
    const dw = vw * s, dh = vh * s, ox = (sw - dw) / 2, oy = (sh - dh) / 2;
    return [ox + (x / PROC_W) * dw, oy + (y / PROC_H) * dh, dw / PROC_W];
  }
  function scanLabel(x, y, txt, bg) {  /* v18: подпись находки анализа стены */
    const L = (typeof trText === 'function' && trText(txt)) || txt;
    octx.font = '700 12px system-ui';
    const tw = octx.measureText(L).width + 10;
    octx.fillStyle = bg; octx.fillRect(x - tw / 2, y - 13, tw, 17);
    octx.fillStyle = '#fff'; octx.fillText(L, x - tw / 2 + 5, y);
  }
  function drawOverlay(now) {
    resizeOverlay();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);
    let nB = 0, nC = 0, nF = 0;
    for (const t of tracker.values()) {
      const cls = classify(t);
      if (cls === 1 && syncOK(t) && !motionOK(t) && t.gpk >= 1.2 && !t.gloss && t.frames > 5 && Date.now() - (S.glossLogTs || 0) > 5000) {
        t.gloss = true; S.glossLogTs = Date.now();
        addLog(now2(), 'ИИ-фильтр поверхностей: блик не держится на месте при сдвиге — блеск краски/глянец/хрусталь, не подтверждён.', 0);
      }
      if (cls === 2) nF++; else if (cls === 1) nC++;
      if (cls === 0 && !S.showCand) continue;
      if (cls === 1 && !S.showCand) continue;
      nB++;
      const [sx, sy, k] = procToScreen(t.cx, t.cy);
      const w = Math.max(26, t.w * k), h = Math.max(26, t.h * k);
      const col = cls === 2 ? 'rgba(255,77,77,' : cls === 1 ? 'rgba(255,176,32,' : 'rgba(140,160,180,';
      octx.strokeStyle = col + (cls === 2 ? (now % 700 < 350 ? '.95)' : '.4)') : '.85)');
      octx.lineWidth = cls === 2 ? 3 : 2;
      octx.setLineDash(cls === 0 ? [4, 4] : []);
      octx.strokeRect(sx - w / 2 - 4, sy - h / 2 - 4, w + 8, h + 8);
      octx.setLineDash([]);
      const label = cls === 2 ? 'КАМЕРА?' : cls === 1 ? 'блик' : '?';
      octx.font = '700 12px system-ui';
      const tw = octx.measureText(label).width + 10;
      octx.fillStyle = cls === 2 ? 'rgba(170,20,20,.85)' : 'rgba(20,28,40,.85)';
      octx.fillRect(sx - tw / 2, sy - h / 2 - 26, tw, 17);
      octx.fillStyle = '#fff';
      octx.fillText(label, sx - tw / 2 + 5, sy - h / 2 - 14);
      if (cls === 2 && !t.alerted) alertFound(t);
    }
    if (S.scanOn && S.running && !S.demo) {  /* v18: визуал анализа стены */
      const pw = overlay.width - 16;
      octx.fillStyle = 'rgba(255,255,255,.18)'; octx.fillRect(8, 6, pw, 4);
      octx.fillStyle = 'rgba(90,200,120,.95)'; octx.fillRect(8, 6, pw * Math.min(1, S.travel / 120), 4);
      for (const c of scanCells.values()) {
        if (c.g < 4 || c.kind === 'gloss') continue;
        const [sx, sy, k] = procToScreen(c.lx, c.ly);
        const rr = Math.max(20, c.w * k) / 2 + 8;
        if (c.kind === 'red') {
          octx.strokeStyle = 'rgba(255,77,77,' + (now % 700 < 350 ? '.95' : '.5') + ')';
          octx.lineWidth = 3;
          octx.beginPath(); octx.arc(sx, sy, rr, 0, 7); octx.stroke();
          scanLabel(sx, sy - rr - 10, 'ВОЗМОЖНАЯ КАМЕРА', 'rgba(170,20,20,.9)');
        } else if (c.kind === 'chrome') {
          octx.strokeStyle = 'rgba(150,160,175,.65)'; octx.lineWidth = 1.5;
          octx.beginPath(); octx.arc(sx, sy, rr, 0, 7); octx.stroke();
        } else if (c.kind === 'led') {
          octx.strokeStyle = 'rgba(255,176,32,.9)'; octx.lineWidth = 2;
          octx.beginPath(); octx.arc(sx, sy, rr, 0, 7); octx.stroke();
          scanLabel(sx, sy - rr - 10, 'LED?', 'rgba(190,110,10,.9)');
        } else if (c.t1 - c.t0 >= 8) {
          octx.fillStyle = 'rgba(255,176,32,.5)';
          octx.fillRect(sx - 2, sy - 2, 4, 4);
        }
      }
    }
    setStats(nB, nC, nF, S.running ? (nF ? 'alert' : 'run') : '',
      S.running ? (nF ? 'НАХОДКА!' : S.demo ? 'демо · блик' : 'сканирование') : 'ожидание');
    $('gTorchind').textContent = (S.mode === 'blink' && S.running) ? (S.torch ? '⚡ ВСПЫШКА ВКЛ' : '· выкл') : '';
  }
  function alertFound(t) {
    t.alerted = true;
    if (S.scanOn) {  /* v23: в анализе стены звук/вибрацию даёт ТОЛЬКО вердикт карты
                        (глянец/хром в узком секторе дисквалифицируются картой) */
      addLog(now2(), 'Анализ стены: мгновенный кандидат (в такт + параллакс) — проверяется картой стены, ждите вердикта.', 1);
      return;
    }
    vibrate(); beep(1560);
    addLog(now2(), 'БЛИК: устойчивый отблеск в такт вспышке — проверьте область! (яркость ~' + Math.round(t.mean) + ')', 2);
    $('crossTip').style.display = '';
  }

  /* ---- вспышка ---- */
  async function setTorch(on) {
    if (S.demo) { S.torch = on; return; }
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: on }] }); S.torch = on; }
    catch (e) { S.torchOK = false; banner('Не удалось управлять вспышкой: ' + e.message); }
  }
  function startBlink() {
    stopBlink();
    S.torch = true; setTorch(true);
    S.blinkTimer = setInterval(async () => {
      await setTorch(!S.torch);
      S.graceUntil = performance.now() + 260;
    }, 850);
  }
  function stopBlink() { if (S.blinkTimer) { clearInterval(S.blinkTimer); S.blinkTimer = null; } }
  function banner(text) {
    const b = $('gBanner');
    if (!text) { b.className = 'banner'; return; }
    b.textContent = text; b.className = 'banner show';
  }

  /* ---- цикл ---- */
  function loop(ts) {
    if (!S.running) return;
    requestAnimationFrame(loop);
    /* v21: бережный режим — после 5 минут непрерывной вспышки (жалоба конкурентов: перегрев/батарея) */
    S.rtMs = (S.rtMs || 0) + (ts - (S.prvTs || ts)); S.prvTs = ts;
    if (S.rtMs > 300000 && !S.restWarned) {
      S.restWarned = true;
      banner('Долгое сканирование: вспышка и камера расходуют батарею и греют телефон. Сделайте короткую паузу — результаты никуда не денутся.');
      addLog(now2(), 'БЛИК: сессия 5 минут — советую перерыв, чтобы не перегревать телефон.', 0);
    }
    if (ts - S.lastProc < 90) return;
    S.lastProc = ts;
    if (S.mode === 'blink' && ts < S.graceUntil) return;
    if (!S.demo && !S.scanOn && S.running && tracker.size > 0 && (S.netMo || 0) < 8) {
      S.stillMs += ts - (S.lastStillTs || ts);
      if (S.stillMs > 3000 && !S.stillAck) banner('Телефон неподвижен? Сдвиньте его вбок на 10–20 см, не поворачивая, — ИИ-фильтр отличит блик линзы от блеска краски и глянца.');
      /* v19: пользователь держит телефон на подозрительном предмете (естественно!).
         Если кандидат линзо-подобен (мигает ТОЛЬКО в такт вспышке + насыщенное или
         сверхмалое ядро) — сказать об этом явно и попросить сдвинуть для вердикта,
         вместо молчаливого «неподтверждённого блика». */
      if (S.stillMs > 3500 && !S.stillAck && S.stillMs - (S.stillChk || 0) >= 1000) {
        S.stillChk = S.stillMs;
        let best = null;  /* v22: и сильный sync-кандидат (тусклая линза: on≥8, off=0, малый) */
        for (const t of tracker.values()) {
          if (syncOK(t) && shapeOK(t) &&
              (coreOK(t) || (t.w <= 2 && t.h <= 2 && t.pk >= 250) || (t.on >= 8 && t.off === 0 && t.w <= 8))) {
            if (!best || t.on > best.on) best = t;
          }
        }
        if (best) {
          S.stillAck = true; beep(880); vibrate();
          banner('Похоже на камеру: маленький блик мигает в такт вспышке. Сдвиньте телефон на 10–20 см — если точка «прилипнет» к стене, это камера.');
          addLog(now2(), 'ИИ: при неподвижном телефоне блик мигает в такт вспышке — возможно камера; сдвиньте телефон для проверки параллаксом.', 0);
        }
      }
    } else { S.stillMs = 0; if ((S.netMo || 0) >= 8) { S.stillAck = false; S.stillChk = 0; } }
    S.lastStillTs = ts;
    const src = S.demo ? drawDemo(ts) : (video.readyState >= 2 ? video : null);
    if (!src) return;
    pctx.drawImage(src, 0, 0, PROC_W, PROC_H);
    const img = pctx.getImageData(0, 0, PROC_W, PROC_H);
    S.pcf = (S.pcf || 0) + 1;  /* номер обработанного кадра (защита от пропусков) */
    const phaseOn = (S.mode === 'cont') || S.torch;
    { /* ИИ-фильтр v17: движение камеры = дрейф центроида СРЕДНЕ-ТЁМНЫХ пикселей
         (20–99). Пятно фонарика при трансляции почти НЕПОДВИЖНО в кадре, а в v16
         мерились средне-яркие (120–199) — на светлой стене их доминировало пятно,
         движение занижалось, и блеск краски проходил как «линза». Тёмные полутоны =
         сцена вне пятна. Запасной диапазон 120–199 — если тёмных мало. Дельта —
         только внутри одной фазы фонарика и без пропуска кадров; сглаживание
         гасит шум матрицы. */
      const dd = img.data; let cbx = 0, cby = 0, cn = 0, lo = 20, hi = 100;
      for (let pass = 0; pass < 2; pass++) {
        cbx = 0; cby = 0; cn = 0;
        for (let i = 0, q = 0; i < PROC_W * PROC_H; i++, q += 4) {
          const v = dd[q];
          if (v >= lo && v < hi) { cbx += i % PROC_W; cby += (i / PROC_W) | 0; cn++; }
        }
        if (cn >= 40) break;
        lo = 120; hi = 200;
      }
      S.sdx = 0; S.sdy = 0; S.sok = false;
      if (cn >= 40) {
        const nx = cbx / cn, ny = cby / cn;
        if (S.pcbx !== undefined && S.pcPhase === phaseOn && S.pcf - (S.pcfL || 0) === 1) {
          S.gxs = (S.gxs || 0) * .6 + (nx - S.pcbx) * .4;
          S.gys = (S.gys || 0) * .6 + (ny - S.pcby) * .4;
          S.sdx = S.gxs; S.sdy = S.gys;
          S.gmag = S.gmag * .8 + Math.hypot(S.sdx, S.sdy) * .2;
          S.sok = true;
        }
        S.pcbx = nx; S.pcby = ny; S.pcPhase = phaseOn; S.pcfL = S.pcf;
      } else S.gmag *= .8;  /* текстура сцены не видна — оценка движения затухает */
    }
    const blobs = detectBlobs(img);
    nativeCores(src, blobs);          /* v24: микро-ядра в нативном разрешении */
    S.pos = posUpdate(img, phaseOn);  /* v24: коррелированная позиция телефона (каждый кадр) */
    { /* v17: резкость ядра в нативном разрешении. Блик линзы — изображение самого
         фонарика, ядро насыщено почти целиком; блеск краски/лака размыт. Считаем
         долю пикселей ≥250 среди ярких (≥порога) в окне 48×48 исходных пикселей
         вокруг центра блоба. На 192×144 ядро убивается даунскейлом — только так. */
      const srcW = src.videoWidth || src.width, srcH = src.videoHeight || src.height;
      if (srcW && srcH) for (const b of blobs) {
        const rx = Math.max(0, Math.min(srcW - 48, Math.round(b.cx * srcW / PROC_W - 24)));
        const ry = Math.max(0, Math.min(srcH - 48, Math.round(b.cy * srcH / PROC_H - 24)));
        try {
          hctx.drawImage(src, rx, ry, 48, 48, 0, 0, 48, 48);
          const hd = hctx.getImageData(0, 0, 48, 48).data;
          let nb = 0, nc = 0;
          for (let q = 0; q < hd.length; q += 4) {
            const v = Math.max(hd[q], hd[q + 1], hd[q + 2]);
            if (v >= S.threshold) nb++; if (v >= 250) nc++;
          }
          b.hisat = nb >= 8 ? nc / nb : (nb >= 2 ? Math.min(1, nc / 6) : 0);  /* v24: малые ядра (дальняя линза 2–8 px) */
        } catch (e) { b.hisat = 0; }
      }
    }
    updateTracker(blobs, phaseOn, performance.now());
    scanStep(blobs, phaseOn, img);
    drawOverlay(performance.now());
  }

  
/* v24-харнесс: перекрываем banner/addLog/beep ПОСЛЕ чанка (в чанке есть свой banner) */
banner = function (t) { if (t) banners.push(String(t).slice(0, 60)); };
addLog = function (ts, t, lvl) { logs.push(String(t).slice(0, 160)); };
beep = function (f) { beeps.push(f); };

let TS = 1000;
function runFrames(n, o) {
  Object.assign(SCENE, { s: o.s0 || 0, glint: o.glint, phase: false,
    gw: o.gw || 3, gh: o.gh || 4, gpk: o.gpk || 240, hi: o.hi === undefined ? 0.1 : o.hi,
    gy: o.gy || 50, natOnly: !!o.natOnly, sector: o.sector || 20 });
  for (let f = 0; f < n; f++) {
    SCENE.phase = ((f / 7) | 0) % 2 === 0;
    S.torch = SCENE.phase;
    let mv = o.move || 0;
    if (o.osc) mv += ((((f / 15) | 0) % 2) ? -o.osc : o.osc);
    SCENE.s += mv;
    TS += 100;
    loop(TS);
  }
}
function reset4(scan) {
  S.running = true; S.gmag = 0; S.stillMs = 0; S.stillAck = false; S.stillChk = 0;
  S.lastStillTs = 0; tracker.clear(); banners = []; logs = []; beeps = [];
  S.scanOn = !!scan; S.mode = 'blink'; S.pos = null;
  S.pOn = S.pOff = null; S.pox = S.poy = 0; S.pcur = S.pcurY = undefined;
  S.pcurArr = []; S.netMo = 0; S.pmiss = 0; S.pd = S.pdy = 0; S.travel = 0;
  if (scan) resetScan();
}
let fail = 0;
function check(name, cond, extra) { console.log(cond ? 'OK ' : 'FAIL', name, extra || ''); if (!cond) fail++; }

/* ═══ РЕГРЕССЫ v23 ═══ */
/* A: ЛИНЗА PROC-видимая, проход (move 1.2 + осц 0.8) → red + бип */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, move: 1.2, osc: 0.8, s0: -60 });
let kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('A линза-проход: карта red', kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('A линза-проход: бип 1560', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* B: ХРОМ (сектор 40px), длинный проход → НЕ red, НЕТ бипа */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'chrome', gpk: 255, hi: 0.7, gw: 4, gh: 4, move: 1.2, osc: 0.8, s0: -60 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('B хром-сектор: НЕ red', !kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('B хром-сектор: бипов НЕТ', beeps.length === 0, 'beeps=' + JSON.stringify(beeps));

/* C: ГЛЯНЦЕВАЯ СТЕНА → НЕ red, gloss-лог стены */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'glosswall', gpk: 244, hi: 0.15, gw: 12, gh: 12, move: 1.2, osc: 0.8, s0: -60 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('C глянцевая стена: НЕ red', !kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('C глянцевая стена: gloss-лог', logs.some(l => l.indexOf('глянцевая поверхность') >= 0), 'logs=' + JSON.stringify(logs.slice(0, 3)));

/* D: LED → led, бипов нет */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'led', move: 1.2, osc: 0.8, s0: -60 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('D LED: kind led, бипов нет', kinds.includes('led') && beeps.length === 0, 'kinds=' + JSON.stringify(kinds.slice(0, 4)));

/* E: ЧИСТО → баннер */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'none', move: 1.2, osc: 0.8, s0: -60 });
check('E чисто: баннер чисто', banners.some(b => b.indexOf('чист') >= 0), 'banners=' + JSON.stringify(banners));

/* F1: ХРОМ, узкий сектор 16px, проход 168px → chrome, тишина */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'chrome', gpk: 255, hi: 0.7, gw: 4, gh: 4, move: 1.2, osc: 0.8, s0: -20 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('F1 хром-узкий-сектор: НЕ red, тишина', !kinds.includes('red') && beeps.length === 0, 'kinds=' + JSON.stringify(kinds.slice(0, 4)));

/* F2: ЛИНЗА, широкий взмах (~90px) → red + бип */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(160, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, osc: 6 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('F2 линза-широкий-сектор: карта red', kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('F2 линза-широкий-сектор: бип 1560', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* G: НЕ-скан: линза + осц → мгновенный 1560 (параллакс-гейт net≥8) */
reset4(false);
runFrames(80, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, osc: 2.5 });
check('G не-скан: мгновенный бип 1560', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* H: НЕ-скан: статичная тусклая линза → still-ack 880 + подсказка */
reset4(false);
runFrames(80, { glint: 'lens', gpk: 245, hi: 0.05, gw: 3, gh: 3 });
check('H не-скан статика: still-ack 880', beeps.includes(880), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));
check('H не-скан статика: подсказка «сдвиньте»', logs.some(l => l.indexOf('двиньте') >= 0), 'logs=' + JSON.stringify(logs.slice(0, 3)));

/* I: В скане: статичная линза → тишина */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(80, { glint: 'lens', gpk: 245, hi: 0.05, gw: 3, gh: 3 });
check('I в скане статика: полная тишина', beeps.length === 0, 'beeps=' + JSON.stringify(beeps));

/* ═══ НОВОЕ v24: ДИСТАНЦИЯ (нативная линза, PROC-невидима) ═══ */
/* L: СКАН, линза@дистанции (нативное ядро 3×3, PROC=90), медленный проход 0.45 → red + бип */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(160, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, move: 0.45, s0: -20, natOnly: true });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('L линза@дистанции: карта red', kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)) + ' covr=' + (((S.covHi||0)-(S.covLo||0))).toFixed(0) + ' travel=' + S.travel.toFixed(0));
check('L линза@дистанции: бип 1560', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* M: НЕ-скан (blink), линза@дистанции + движение → 1560 (раньше gpk<1.2 навсегда) */
reset4(false);
runFrames(100, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, move: 0.45, s0: -20, natOnly: true });
check('M blink линза@дистанции: бип 1560', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* N: НЕ-скан (blink), линза@дистанции СТАТИКА → still-ack 880 */
reset4(false);
runFrames(80, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, natOnly: true });
check('N blink статика@дистанции: 880', beeps.includes(880), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* O: СКАН, ХРОМ@дистанции (нативное ядро, сектор 24px), проход 60px → chrome, тишина */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'chrome', gpk: 255, hi: 0.7, gw: 4, gh: 4, move: 0.45, s0: 30, natOnly: true, sector: 10 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('O хром@дистанции: НЕ red, тишина', !kinds.includes('red') && beeps.length === 0, 'kinds=' + JSON.stringify(kinds.slice(0, 4)));

console.log(fail === 0 ? '\nВСЕ СЦЕНАРИИ ПРОЙДЕНЫ' : '\nПРОВАЛОВ: ' + fail);
