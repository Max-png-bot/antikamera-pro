
let banners = [], logs = [], beeps = [];
function banner(t) { if (t) banners.push(String(t).slice(0, 40)); }
function addLog(ts, t) { logs.push(String(t).slice(0, 42)); }
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
  stillAck: false, stillChk: 0, rtMs: 0, prvTs: 0, restWarned: false };
const tracker = new Map();
let SCENE = { s: 0, glint: 'none', phase: false, gw: 3, gh: 4, gpk: 240, hi: 0.1, gy: 50 };
function tex(x, y) {
  let v = 12 + ((x * 7 + y * 13) % 7);
  if (x > 40 && x < 120 && y > 60 && y < 100) v = 55 + ((x + y) % 5);
  return v;
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
  if (SCENE.glint === 'chrome') present = Math.abs(SCENE.s - 60) < 20;  /* сектор */
  if (SCENE.glint === 'glosswall') present = true;
  if (SCENE.phase && present && SCENE.glint !== 'none' && SCENE.glint !== 'led') {
    const sz = SCENE.glint === 'glosswall' ? 12 : (SCENE.gw || 3);
    for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
      const i = (SCENE.gy * 192 + Math.round(gx) + dx + dy * 192) * 4;
      d[i] = d[i+1] = d[i+2] = SCENE.gpk;
    }
  }
  if (SCENE.glint === 'led') {  /* LED на стене: движется со сценой */
    const lx = 150 - SCENE.s;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = (90 * 192 + Math.round(lx) + dx + dy * 192) * 4; d[i] = d[i+1] = d[i+2] = 250;
    }
  }
  return d;
}
let lastCrop = [0, 0];
const pctx = { drawImage() {}, getImageData() { return { data: makeFrame(), width: 192, height: 144 }; } };
const video = { readyState: 2, videoWidth: 1280, videoHeight: 720 };
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
      const present = type === 'chrome' ? Math.abs(SCENE.s - 60) < 20 : true;
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
      if (S.gmag >= 1.5) t.mframes++;
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
    if (!t.gpk || t.gpk < 1.2) return false;  /* телефон не двигался — красное подтверждение не выдаётся */
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
    if (syncOK(t) && shapeOK(t) && t.gpk >= 1.2 && t.mframes >= 5 &&
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
    S.prof = null; S.pd = 0; S.covLo = S.covHi = undefined;
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
  function scanStep(blobs, phaseOn, img) {
    if (!S.scanOn || S.demo || !S.running) return;
    if (S.sok) S.travel += Math.hypot(S.sdx, S.sdy);
    /* v23: карта стены строится ТОЛЬКО по ON-фазам от АБСОЛЮТНОЙ позиции
       центроида (единая база) — без интегрирования дельт (нет дрейфа и
       «размазывания» при колебаниях) и без межфазных скачков освещения.
       Тёмная фаза отдельно: светящаяся точка РЯДОМ с ячейкой в кадре = LED. */
    if (phaseOn) {
      /* v23: карта только по ON-фазам; координаты стены = позиция блика + сдвиг
         контента (профильная корреляция). Сдвиг = «на сколько камера ушла от
         опорного кадра» — rx-диапазон ячейки = сектор позиций телефона. */
      if (!S.prof) { S.prof = colProfiles(img); S.pd = 0; }
      const pr = colProfiles(img);
      const dx = profShift(pr.cw, S.prof.cw, 90);
      const dy = profShift(pr.rw, S.prof.rw, 70);
      if (dx !== null && dy !== null) {
        const moving = S.gmag >= 0.8 || Math.abs(dx - S.pd) >= 0.8;  /* блики считаем только при реальном движении */
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
        S.pd = dx;
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
    if (!S.scanClean && covr >= 100 && performance.now() - S.scanT0 > 9000 && !scanHasRed()) {
      S.scanClean = true;
      banner('Участок чист: стабильных бликующих точек не найдено.');
      addLog(now2(), 'Анализ стены: стабильных точек не найдено — участок чист.', 0);
    }
  }
  function scanHasRed() { for (const c of scanCells.values()) if (c.kind === 'red') return true; return false; }
  function evaluateScan() {
    /* v23: универсальный отбор (любая стена). Скрытая камера — ЕДИНСТВЕННЫЙ
       объект, который (1) неподвижен на стене, (2) бликует в такт вспышке
       КАЖДУЮ фазу, (3) виден со ВСЕХ позиций прохода (широкий сектор dr),
       (4) мала и (5) с насыщенным ядром либо длительно стабильна. Всё
       прочее исключается из выборки: глянец «плывёт» (мал span ячейки),
       металл/стекло бликует в узком секторе (мал dr), LED светит в тёмной
       фазе, шум не мигает в такт. */
    if (S.travel < 40) return;
    let glossCells = 0;
    for (const c of scanCells.values()) {
      if (c.kind === 'red') continue;
      const tot = c.g + c.o, span = c.t1 - c.t0;
      const dr = (c.rx1 - c.rx0 || 0) + (c.ry1 - c.ry0 || 0);
      if (c.g >= 3 && c.g <= 9 && span <= 12) { glossCells++; c.kind = 'gloss'; continue; }  /* блик прошёл ячейку насквозь */
      if (c.g < 6) continue;
      if (c.o >= 3 && c.o >= 0.25 * tot) {
        if (c.kind !== 'led') { c.kind = 'led';
          addLog(now2(), 'Анализ стены: точка светится и без вспышки — LED-индикатор или горячий пиксель, не камера.', 0); }
        continue;
      }
      const hard = c.hi >= 0.4 || (c.pk || 0) >= 250 || c.g >= 16;
      if (c.g >= 10 && c.w <= 9 && span >= 18 && dr >= 75 && hard) {
        c.kind = 'red';
        vibrate(); beep(1560);
        banner('ИИ-анализ стены: точка с признаками скрытой камеры — неподвижна, мигает в такт вспышке, видна со всех позиций прохода. Проверьте её вручную!');
        addLog(now2(), 'ИИ-анализ стены: признаки скрытой камеры — стабильная точка + широкий сектор + мигание в такт.', 0);
      } else if (hard && dr < 75 && c.hi >= 0.3 && c.kind !== 'chrome') {
        c.kind = 'chrome';  /* блик только из узкого сектора — предмет, не камера */
        addLog(now2(), 'ИИ-анализ стены: блик виден только из узкого сектора — предмет (металл/стекло/глянец), исключён из выборки.', 0);
      } else if (c.g >= 8 && c.kind !== 'soft' && c.kind !== 'chrome') {
        c.kind = 'soft';
        addLog(now2(), 'Анализ стены: стабильный мягкий блик — глянец точки (шуруп/лак), вряд ли камера.', 0);
      }
    }
    if (glossCells >= 6 && !S.glossTold) {
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
    if (!S.demo && !S.scanOn && S.running && tracker.size > 0 && S.gmag < 1.2) {
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
    } else { S.stillMs = 0; if (S.gmag >= 1.2) { S.stillAck = false; S.stillChk = 0; } }
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
          b.hisat = nb >= 8 ? nc / nb : 0;
        } catch (e) { b.hisat = 0; }
      }
    }
    updateTracker(blobs, phaseOn, performance.now());
    scanStep(blobs, phaseOn, img);
    drawOverlay(performance.now());
  }

  
/* v23-харнесс: перекрываем banner/addLog/beep ПОСЛЕ чанка (в чанке есть свой banner) */
banner = function (t) { if (t) banners.push(String(t).slice(0, 50)); };
addLog = function (ts, t, lvl) { logs.push(String(t).slice(0, 160)); };
beep = function (f) { beeps.push(f); };

let TS = 1000;
function runFrames(n, o) {
  Object.assign(SCENE, { s: o.s0 || 0, glint: o.glint, phase: false,
    gw: o.gw || 3, gh: o.gh || 4, gpk: o.gpk || 240, hi: o.hi === undefined ? 0.1 : o.hi, gy: o.gy || 50 });
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
  S.scanOn = !!scan; S.mode = 'blink';
  if (scan) resetScan();
}
let fail = 0;
function check(name, cond, extra) { console.log(cond ? 'OK ' : 'FAIL', name, extra || ''); if (!cond) fail++; }

/* A: ЛИНЗА, проход вдоль стены (progressive 1.2 + осц 0.8) → карта red + бип */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, move: 1.2, osc: 0.8, s0: -60 });
let kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('A линза-проход: карта red', kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('A линза-проход: бип 1560 (только карта)', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps));

/* B: ХРОМ (сектор |s-60|<20), проход → НЕ red, kind chrome, НЕТ бипа */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'chrome', gpk: 255, hi: 0.7, gw: 4, gh: 4, move: 1.2, osc: 0.8, s0: -60 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('B хром-сектор: НЕ red', !kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('B хром-сектор: бипов НЕТ', beeps.length === 0, 'beeps=' + JSON.stringify(beeps));

/* C: ГЛЯНЦЕВАЯ СТЕНА (широкий мягкий плывущий блик) → gloss log, НЕ red */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'glosswall', gpk: 244, hi: 0.15, gw: 12, gh: 12, move: 1.2, osc: 0.8, s0: -60 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
const glossLog = logs.some(l => l.indexOf('глянцевая поверхность') >= 0);
check('C глянцевая стена: НЕ red', !kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('C глянцевая стена: gloss-лог', glossLog, 'logs=' + JSON.stringify(logs.slice(0, 3)));

/* D: LED → led, бипов нет */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'led', move: 1.2, osc: 0.8, s0: -60 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('D LED: kind led, бипов нет', kinds.includes('led') && beeps.length === 0, 'kinds=' + JSON.stringify(kinds));

/* E: ЧИСТО (нет бликов, охват есть) → баннер */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'none', move: 1.2, osc: 0.8, s0: -60 });
check('E чисто: баннер чисто', banners.some(b => b.indexOf('чист') >= 0), 'banners=' + JSON.stringify(banners));

/* F1: ЛИНЗА, качание с охватом ~38px (узкий сектор) → chrome, НЕ red, тишина */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(140, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, osc: 2.5 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('F1 линза-узкий-сектор: chrome, НЕ red, тишина', kinds.includes('chrome') && !kinds.includes('red') && beeps.length === 0, 'kinds=' + JSON.stringify(kinds.slice(0, 4)));

/* F2: ЛИНЗА, качание с охватом ~90px (широкий сектор) → red + бип */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(160, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, osc: 6 });
kinds = [...scanCells.values()].filter(c => c.kind).map(c => c.kind);
check('F2 линза-широкий-сектор: карта red', kinds.includes('red'), 'kinds=' + JSON.stringify(kinds.slice(0, 4)));
check('F2 линза-широкий-сектор: бип 1560', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* G: регресс — НЕ-скан режим: линза + осц → мгновенный бип 1560 (alertFound обычный) */
reset4(false);
runFrames(80, { glint: 'lens', gpk: 255, hi: 0.6, gw: 4, gh: 4, osc: 2.5 });
check('G не-скан: мгновенный бип 1560', beeps.includes(1560), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));

/* H: регресс v22 — НЕ-скан: статичная тусклая линза → still-ack 880 + подсказка */
reset4(false);
runFrames(80, { glint: 'lens', gpk: 245, hi: 0.05, gw: 3, gh: 3 });
check('H не-скан статика: still-ack 880', beeps.includes(880), 'beeps=' + JSON.stringify(beeps.slice(0, 3)));
check('H не-скан статика: подсказка «сдвиньте»', logs.some(l => l.indexOf('двиньте') >= 0 || l.indexOf('двиг') >= 0), 'logs=' + JSON.stringify(logs.slice(0, 3)));

/* I: регресс v23 — В скане: статичная линза → тишина (вердикт даёт только карта) */
reset4(true);
S.scanT0 = performance.now() - 10000;
runFrames(80, { glint: 'lens', gpk: 245, hi: 0.05, gw: 3, gh: 3 });
check('I в скане статика: полная тишина', beeps.length === 0, 'beeps=' + JSON.stringify(beeps));

console.log(fail === 0 ? '\nВСЕ СЦЕНАРИИ ПРОЙДЕНЫ' : '\nПРОВАЛОВ: ' + fail);
