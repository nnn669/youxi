/* iso.js — 2.5D 等距农场场景（Canvas 2D）。只负责画与点选，不含玩法逻辑。 */
window.Game = window.Game || {};

Game.iso = function () {
  var C = Game.config;
  var S = null, cv = null, ctx = null;
  var W = 0, H = 0, dpr = 1;
  var COLS = 6, ROWS = 4;
  var tw = 88, th = 44;              // 菱形砖宽/高
  var ox = 0, oy = 0;                // 地图原点
  var grassTop = 0, paddockH = 120;
  var critters = [], fx = [], clouds = [];
  var raf = null, running = false, mounted = false;
  var hooks = { plot: null, animal: null };
  var lastTap = 0;

  // ---------- 尺寸 ----------
  function fit() {
    if (!cv || !cv.parentNode) return;
    var r = cv.parentNode.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = Math.floor(r.width); H = Math.floor(r.height);
    dpr = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    tw = Math.min((W - 14) / 5, 92); th = tw / 2;
    ox = W / 2 - 0.5 * tw;
    oy = H * 0.20 + th * 0.5;
    grassTop = oy + (COLS + ROWS - 2) * th / 2 + th * 1.25;
    paddockH = Math.min(150, Math.max(80, H - grassTop - 20));

    // 云
    if (!clouds.length) {
      for (var i = 0; i < 3; i++) clouds.push({ x: Math.random() * W, y: H * 0.03 + i * H * 0.05, s: 0.7 + Math.random() * 0.5, v: 0.12 + Math.random() * 0.18 });
    }
    // 动物位置兜底
    critters.forEach(function (c) { c.x = Math.max(20, Math.min(W - 20, c.x)); c.y = Math.max(grassTop + 12, Math.min(grassTop + paddockH, c.y)); });
  }

  // ---------- 坐标 ----------
  function sx(x, y) { return (x - y) * tw / 2 + ox; }
  function sy(x, y) { return (x + y) * th / 2 + oy; }

  // ---------- 地块绘制 ----------
  function tilePath(cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
  }
  function emoji(txt, x, y, size) {
    ctx.save();
    ctx.font = size + 'px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTile(idx) {
    var p = S.plots[idx];
    var x = idx % COLS, y = Math.floor(idx / COLS);
    var cx = sx(x, y), cy = sy(x, y);
    var locked = p.s === 'locked';
    var depth = th * 0.42;

    // 侧壁
    var side1 = locked ? '#b9b4a6' : '#8a5b3c';
    var side2 = locked ? '#a09b8e' : '#74492f';
    ctx.fillStyle = side1;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, cy);
    ctx.lineTo(cx, cy + th / 2);
    ctx.lineTo(cx, cy + th / 2 + depth);
    ctx.lineTo(cx - tw / 2, cy + depth);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = side2;
    ctx.beginPath();
    ctx.moveTo(cx + tw / 2, cy);
    ctx.lineTo(cx, cy + th / 2);
    ctx.lineTo(cx, cy + th / 2 + depth);
    ctx.lineTo(cx + tw / 2, cy + depth);
    ctx.closePath(); ctx.fill();

    // 顶面
    ctx.save();
    tilePath(cx, cy, tw, th);
    var g = ctx.createLinearGradient(cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2);
    if (locked) { g.addColorStop(0, '#d5d0c2'); g.addColorStop(1, '#c2bcae'); }
    else if (p.watered) { g.addColorStop(0, '#8d5f40'); g.addColorStop(1, '#6f4a31'); }
    else { g.addColorStop(0, '#c08b60'); g.addColorStop(1, '#a5714a'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = locked ? '#a8a294' : '#7d4f33';
    ctx.lineWidth = 2; ctx.stroke();
    // 土纹
    if (!locked) {
      ctx.strokeStyle = 'rgba(90,55,30,.28)'; ctx.lineWidth = 1;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - tw / 4, cy + i * th * 0.18);
        ctx.lineTo(cx + tw / 4, cy + i * th * 0.18);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (locked) {
      emoji('🔒', cx, cy - 4, Math.max(13, tw * 0.24));
      ctx.save();
      ctx.font = 'bold ' + Math.max(9, tw * 0.14) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = '#5c574c';
      ctx.fillText('Lv.' + C.levelForPlot(idx), cx, cy + th * 0.34);
      ctx.restore();
      return;
    }

    if (p.s === 'empty') {
      ctx.save();
      ctx.globalAlpha = 0.5;
      emoji('🌱', cx, cy - th * 0.05, Math.max(10, tw * 0.16));
      ctx.restore();
      return;
    }

    var c = C.crop(p.crop);
    if (!c) return;
    var now = Date.now();
    var prog = p.watered ? Math.min(1, (now - p.t) / (c.grow * 1000)) : 0;
    var bob = Math.sin(now / 420 + idx) * 1.6;

    if (!p.watered) {
      // 未浇水：土坑 + 水壶提示
      emoji('💧', cx, cy - th * 0.5 + bob, Math.max(12, tw * 0.2));
      ctx.save();
      ctx.font = 'bold ' + Math.max(9, tw * 0.13) + 'px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.textAlign = 'center';
      ctx.fillText('需浇水', cx, cy + th * 0.30);
      ctx.restore();
      return;
    }

    // 作物随进度长大
    var size = tw * (0.16 + 0.18 * prog) * (prog >= 1 ? 1.12 : 1);
    var art = prog >= 1 ? c.icon : (prog < 0.35 ? '🌱' : (prog < 0.75 ? '🌿' : c.icon));
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy + th * 0.12, tw * 0.16, th * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    emoji(art, cx, cy - th * 0.16 + (prog >= 1 ? bob : 0), size);

    if (prog >= 1) {
      // 成熟光晕
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(now / 300);
      ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 2.5;
      tilePath(cx, cy, tw - 3, th - 3); ctx.stroke();
      ctx.restore();
      emoji('✨', cx + tw * 0.30, cy - th * 0.40 + bob, Math.max(10, tw * 0.15));
    } else {
      // 进度条
      var bw = tw * 0.62, bh = 5, bx = cx - bw / 2, by = cy - th * 0.52;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      roundRect(bx, by, bw, bh, 3); ctx.fill();
      ctx.fillStyle = '#7fd77f';
      roundRect(bx, by, bw * prog, bh, 3); ctx.fill();
      ctx.restore();
    }
  }

  // ---------- 动物 ----------
  function initCritters() {
    critters = C.animals.map(function (a, i) {
      return { id: a.id, x: W * (0.25 + 0.25 * i), y: grassTop + 26 + i * 8, vx: (Math.random() - .5) * 0.25, vy: (Math.random() - .5) * 0.12, t: Math.random() * 100, flip: false, ttl: 90 + Math.random() * 120 };
    });
  }
  function updateCritters() {
    critters.forEach(function (c) {
      c.t++;
      if (c.ttl-- < 0) { c.ttl = 90 + Math.random() * 180; c.vx = (Math.random() - .5) * 0.5; c.vy = (Math.random() - .5) * 0.22; }
      c.x += c.vx; c.y += c.vy;
      if (c.x < 26 || c.x > W - 26) { c.vx *= -1; c.x = Math.max(26, Math.min(W - 26, c.x)); }
      var yMax = grassTop + paddockH;
      if (c.y < grassTop + 10 || c.y > yMax) { c.vy *= -1; c.y = Math.max(grassTop + 10, Math.min(yMax, c.y)); }
      if (Math.abs(c.vx) > 0.03) c.flip = c.vx < 0;
    });
  }
  function drawCritter(c) {
    var a = C.animal(c.id), st = Game.logic.animalStatus(c.id);
    var bob = Math.sin(c.t / 16) * 1.8;
    ctx.save();
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 12, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    if (!st.owned) ctx.globalAlpha = 0.42;
    if (c.flip) { ctx.translate(c.x, c.y + bob); ctx.scale(-1, 1); emoji(a.icon, 0, 0, 30); }
    else emoji(a.icon, c.x, c.y + bob, 30);
    ctx.restore();

    var size = 13;
    if (!st.owned) {
      if (S.level >= a.lv) { emoji('💰', c.x, c.y - 24 + bob, size); }
      else {
        ctx.save();
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#5c574c';
        ctx.fillText('Lv.' + a.lv, c.x, c.y - 22 + bob);
        ctx.restore();
      }
    } else if (st.state === 'hungry') emoji('❗', c.x, c.y - 24 + bob, size);
    else if (st.state === 'ready') emoji(a.productIcon, c.x, c.y - 25 + bob, size + 2);
    else {
      // 产出倒计时
      var left = st.left;
      ctx.save();
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      var txt = left < 60 ? left + 's' : Math.ceil(left / 60) + 'm';
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      roundRect(c.x - 16, c.y - 34 + bob, 32, 14, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, c.x, c.y - 27 + bob);
      ctx.restore();
    }
  }

  // ---------- 特效 ----------
  function pushFx(o) { fx.push(o); }
  function updateFx() {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i];
      f.life--; f.x += f.vx || 0; f.y += f.vy || 0; if (f.vy !== undefined) f.vy += 0.06;
      if (f.life <= 0) fx.splice(i, 1);
    }
  }
  function drawFx() {
    fx.forEach(function (f) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max));
      if (f.text) {
        ctx.font = 'bold ' + f.size + 'px "Apple Color Emoji",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = f.color || '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3;
        ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
      } else {
        emoji(f.icon, f.x, f.y, f.size);
      }
      ctx.restore();
    });
  }
  function burst(kind, idx) {
    var x = idx % COLS, y = Math.floor(idx / COLS);
    var cx = sx(x, y), cy = sy(x, y) - th * 0.4;
    if (kind === 'water') {
      for (var i = 0; i < 6; i++) pushFx({ icon: '💧', x: cx + (Math.random() - .5) * tw * 0.5, y: cy, vx: (Math.random() - .5) * 1.4, vy: -1 - Math.random(), life: 26, max: 26, size: 13 });
    } else if (kind === 'harvest') {
      for (var j = 0; j < 5; j++) pushFx({ icon: '✨', x: cx + (Math.random() - .5) * tw * 0.5, y: cy, vx: (Math.random() - .5) * 1.2, vy: -1.2 - Math.random(), life: 30, max: 30, size: 14 });
    } else if (kind === 'coin') {
      pushFx({ text: '+金币', x: cx, y: cy, vy: -1.1, life: 45, max: 45, size: 14, color: '#ffe27a' });
    }
  }

  // ---------- 主循环 ----------
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#9fd8ff');
    g.addColorStop(0.45, '#cfeeff');
    g.addColorStop(0.62, '#e9f7e2');
    g.addColorStop(1, '#8fd694');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 远山
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#8bc98a';
    ctx.beginPath();
    ctx.moveTo(0, oy - th);
    for (var i = 0; i <= 6; i++) {
      var px = W * i / 6;
      ctx.lineTo(px, oy - th - (i % 2 ? 26 : 46) - (i % 3) * 6);
    }
    ctx.lineTo(W, oy); ctx.lineTo(0, oy); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawClouds(dt) {
    ctx.save();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#fff';
    clouds.forEach(function (c) {
      c.x += c.v * dt * 0.06;
      if (c.x > W + 60) c.x = -60;
      var s = c.s;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 30 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 22 * s, c.y + 4 * s, 22 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 20 * s, c.y + 5 * s, 18 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  function drawGrass() {
    ctx.save();
    // 牧场条带（动物活动区）
    ctx.fillStyle = '#9adf94';
    ctx.beginPath();
    ctx.ellipse(W / 2, grassTop + paddockH * 0.55, W * 0.62, paddockH * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 4; ctx.setLineDash([9, 7]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#7cc77f';
    ctx.beginPath();
    ctx.moveTo(0, grassTop + 10);
    ctx.quadraticCurveTo(W / 2, grassTop - 16, W, grassTop + 10);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    for (var i = 0; i < 14; i++) {
      var gx = (i * 97) % W, gy = grassTop + 24 + ((i * 53) % Math.max(20, H - grassTop - 30));
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 3, gy - 7); ctx.stroke();
    }
    ctx.restore();
    // 装饰物（固定位置）
    var k = Math.max(12, tw * 0.24);
    emoji('🌳', W * 0.06, grassTop - 6, k);
    emoji('🌲', W * 0.94, grassTop + 2, k);
    emoji('🪨', W * 0.13, grassTop + paddockH * 0.5, k * 0.7);
    emoji('🌻', W * 0.87, grassTop + paddockH * 0.8, k * 0.8);
    emoji('🏡', W * 0.5, Math.min(H - 34, grassTop + paddockH + 46), k * 1.15);
  }

  var last = 0;
  function loop(ts) {
    if (!running) return;
    var dt = Math.min(48, ts - last || 16); last = ts;
    updateCritters(); updateFx();
    drawSky(); drawClouds(dt); drawGrass();
    // 深度排序绘制地块
    var order = [];
    for (var i = 0; i < S.plots.length; i++) order.push(i);
    order.sort(function (a, b) { return (a % COLS + Math.floor(a / COLS)) - (b % COLS + Math.floor(b / COLS)); });
    order.forEach(drawTile);
    // 同一深度层再画动物
    critters.slice().sort(function (a, b) { return a.y - b.y; }).forEach(drawCritter);
    drawFx();
    raf = requestAnimationFrame(loop);
  }

  // ---------- 交互 ----------
  function hitTest(px, py) {
    // 先测动物（含未购买，可点购买）
    for (var i = critters.length - 1; i >= 0; i--) {
      var c = critters[i];
      if (Math.abs(px - c.x) < 22 && Math.abs(py - (c.y - 4)) < 26) return { kind: 'animal', id: c.id };
    }
    var ix = (px - ox) / (tw / 2), iy = (py - oy) / (th / 2);
    var x = Math.round((ix + iy) / 2), y = Math.round((iy - ix) / 2);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    var cx = sx(x, y), cy = sy(x, y);
    if (Math.abs(px - cx) / (tw / 2) + Math.abs(py - cy) / (th / 2) > 1) return null;
    return { kind: 'plot', idx: y * COLS + x };
  }

  function onTap(e) {
    if (!running) return;
    var r = cv.getBoundingClientRect();
    var px = (e.clientX || 0) - r.left, py = (e.clientY || 0) - r.top;
    var hit = hitTest(px, py);
    if (!hit) return;
    var now = Date.now();
    if (now - lastTap < 260) return; // 防连点/去重
    lastTap = now;
    if (hit.kind === 'plot' && hooks.plot) hooks.plot(hit.idx);
    else if (hit.kind === 'animal' && hooks.animal) hooks.animal(hit.id);
  }

  return {
    mount: function (el, state, cb) {
      cv = el; S = state; hooks.plot = cb.plot; hooks.animal = cb.animal;
      ctx = cv.getContext('2d');
      fit(); initCritters();
      if (window.PointerEvent) cv.addEventListener('pointerdown', onTap);
      else {
        cv.addEventListener('click', onTap);
        cv.addEventListener('touchend', function (e) {
          var t = e.changedTouches && e.changedTouches[0];
          if (t) onTap({ clientX: t.clientX, clientY: t.clientY });
        }, { passive: true });
      }
      if (window.ResizeObserver) { if (this._ro) this._ro.disconnect(); this._ro = new ResizeObserver(function () { fit(); }); this._ro.observe(cv.parentNode); }
      running = true; last = 0; raf = requestAnimationFrame(loop);
      mounted = true;
    },
    stop: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = null; },
    resume: function (state) { S = state; if (!mounted) return; fit(); running = true; last = 0; raf = requestAnimationFrame(loop); },
    isRunning: function () { return running; },
    fx: burst,
    redrawOnce: function () { if (!running) { drawSky(); drawGrass(); var o = []; for (var i = 0; i < S.plots.length; i++) o.push(i); o.sort(function (a, b) { return (a % COLS + Math.floor(a / COLS)) - (b % COLS + Math.floor(b / COLS)); }); o.forEach(drawTile); critters.forEach(drawCritter); } }
  };
}();
