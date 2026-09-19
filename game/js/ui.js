/* ui.js — 渲染与交互（DOM）。所有数据变更走 Game.logic，之后 ui.render() */
window.Game = window.Game || {};

Game.ui = function () {
  var C = Game.config;
  var S = null;
  var page = 'farm';       // farm | shop | bag | order | task
  var shopTab = 'seed';    // seed | feed | animal | deco
  var toastTimer = null;

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined && text !== null) d.textContent = text;
    return d;
  }
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 1600);
  }
  function sfx(name) {
    if (!S.settings.sfx) return;
    var c = C.sfx[name]; if (!c) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = sfx.ctx || (sfx.ctx = new AC());
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = c.type; o.frequency.setValueAtTime(c.f0, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, c.f1), ctx.currentTime + c.dur);
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + c.dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + c.dur);
    } catch (e) {}
  }
  function buzz(ms) {
    if (!S.settings.vibrate) return;
    try { if (navigator.vibrate) navigator.vibrate(ms || 15); } catch (e) {}
  }
  function act(res, sfxName) {
    Game.save.write(S);
    if (!res.ok) { sfx('error'); buzz(30); } else if (sfxName) { sfx(sfxName); buzz(12); }
    if (res.msg) toast(res.msg, !res.ok);
    render();
    return res.ok;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + 'm' + (s ? s + 's' : '');
  }
  function coin(n) { return '💰' + n; }

  // ---------------- 顶部状态 ----------------
  function renderTop() {
    var top = $('#topbar');
    top.innerHTML = '';
    var l = el('div', 'stat');
    l.appendChild(el('span', 'ico', '💰'));
    l.appendChild(el('span', 'val', String(S.gold)));
    top.appendChild(l);

    var lv = el('div', 'stat lv');
    lv.appendChild(el('span', 'ico', '⭐'));
    lv.appendChild(el('span', 'val', 'Lv.' + S.level));
    var bar = el('div', 'expbar');
    var need = C.expToNext(S.level);
    var fill = el('div', 'expfill');
    fill.style.width = Math.min(100, Math.round(S.exp / need * 100)) + '%';
    bar.appendChild(fill);
    lv.appendChild(bar);
    top.appendChild(lv);

    var setBtn = el('button', 'iconbtn', '⚙️');
    setBtn.onclick = openSettings;
    top.appendChild(setBtn);
  }

  // ---------------- 农场 ----------------
  function plotNode(idx, p) {
    var d = el('div', 'plot ' + p.s);
    if (p.s === 'locked') {
      d.appendChild(el('div', 'pi', '🔒'));
      d.appendChild(el('div', 'lbl', 'Lv.' + C.levelForPlot(idx) + ' 解锁'));
      return d;
    }
    if (p.s === 'empty') {
      d.appendChild(el('div', 'pi soil', '🟫'));
      d.appendChild(el('div', 'lbl', '空地'));
    } else if (p.s === 'growing' && !p.watered) {
      var c = C.crop(p.crop);
      d.appendChild(el('div', 'pi', c.icon));
      d.appendChild(el('div', 'lbl needwater', '💧浇水'));
      d.classList.add('thirsty');
    } else if (p.s === 'growing') {
      var c2 = C.crop(p.crop);
      var left = (c2.grow * 1000 - (Date.now() - p.t)) / 1000;
      d.appendChild(el('div', 'pi small', '🌱'));
      d.appendChild(el('div', 'lbl', fmtTime(left)));
    } else if (p.s === 'mature') {
      var c3 = C.crop(p.crop);
      d.appendChild(el('div', 'pi', c3.icon));
      d.appendChild(el('div', 'lbl ready', '收获!'));
      d.classList.add('ready');
    }
    d.onclick = function () { onPlot(idx); };
    return d;
  }
  function onPlot(idx) {
    var p = Game.logic.refreshPlot(idx);
    if (!p) return;
    if (p.s === 'locked') { toast('需要 ' + C.levelForPlot(idx) + ' 级解锁', true); return; }
    if (p.s === 'empty') { openSeedPicker(idx); return; }
    if (p.s === 'growing' && !p.watered) { if (act(Game.logic.water(idx), 'water')) Game.iso.fx('water', idx); return; }
    if (p.s === 'growing') { var c = C.crop(p.crop); toast(c.name + ' 还需 ' + fmtTime((c.grow * 1000 - (Date.now() - p.t)) / 1000)); return; }
    if (p.s === 'mature') { if (act(Game.logic.harvest(idx), 'harvest')) Game.iso.fx('harvest', idx); return; }
  }
  function renderFarm() {
    var wrap = el('div', 'page farm');
    var n = Game.logic.unlockedPlots();
    wrap.appendChild(el('div', 'sectitle', '农田 ' + n + '/' + C.plotMax + (n < C.plotMax ? '（升级解锁更多）' : '') + ' · 点击地块操作'));
    var cvs = document.createElement('canvas');
    cvs.className = 'scene';
    wrap.appendChild(cvs);
    requestAnimationFrame(function () {
      if (!cvs.parentNode) return;
      Game.iso.mount(cvs, S, { plot: onPlot, animal: onAnimal });
    });
    return wrap;
  }

  // 养殖区交互（Canvas 里点动物）
  function onAnimal(id) {
    var a = C.animal(id), st = Game.logic.animalStatus(id);
    if (!st.owned) {
      if (S.level < a.lv) { toast('需要 ' + a.lv + ' 级解锁', true); return; }
      if (confirm('花 ' + a.buy + ' 金币购买' + a.name + '？')) act(Game.logic.buyAnimal(id), 'coin');
      return;
    }
    if (st.state === 'hungry') { if (act(Game.logic.feedAnimal(id), 'water')) Game.iso.fx('water', 0); return; }
    if (st.state === 'producing') { toast(a.name + ' 产出中，还需 ' + fmtTime(st.left)); return; }
    if (act(Game.logic.collectAnimal(id), 'harvest')) Game.iso.fx('coin', 0);
  }

  function openSeedPicker(idx) {
    var seeds = C.crops.filter(function (c) { return c.lv <= S.level && Game.logic.invOf('seed_' + c.id) > 0; });
    var m = el('div', 'mask');
    var box = el('div', 'modal');
    box.appendChild(el('div', 'mtitle', '选择要播种的种子'));
    if (!seeds.length) {
      box.appendChild(el('div', 'empty', '没有种子，先去商店购买'));
      var b0 = el('button', 'btn primary', '去商店买种子');
      b0.onclick = function () { close(); page = 'shop'; shopTab = 'seed'; render(); };
      box.appendChild(b0);
    } else {
      seeds.forEach(function (c) {
        var row = el('div', 'row');
        row.appendChild(el('span', 'ico', c.icon));
        row.appendChild(el('span', 'nm', c.name));
        row.appendChild(el('span', 'sub', '×' + Game.logic.invOf('seed_' + c.id) + ' · ' + fmtTime(c.grow)));
        row.onclick = function () { close(); act(Game.logic.plant(idx, c.id), 'plant'); };
        box.appendChild(row);
      });
    }
    function close() { m.remove(); }
    var cx = el('button', 'btn', '取消'); cx.onclick = close;
    box.appendChild(cx);
    m.appendChild(box);
    m.onclick = function (e) { if (e.target === m) close(); };
    document.body.appendChild(m);
  }

  // ---------------- 商店 ----------------
  function renderShop() {
    var wrap = el('div', 'page shop');
    var tabs = el('div', 'tabs');
    [['seed', '种子'], ['feed', '饲料'], ['animal', '动物'], ['deco', '装饰']].forEach(function (t) {
      var b = el('button', 'tab' + (shopTab === t[0] ? ' on' : ''), t[1]);
      b.onclick = function () { shopTab = t[0]; render(); };
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    var list = el('div', 'list');
    if (shopTab === 'seed') {
      C.crops.forEach(function (c) {
        var lock = S.level < c.lv;
        var row = el('div', 'item' + (lock ? ' locked' : ''));
        row.appendChild(el('span', 'ico', c.icon));
        var mid = el('div', 'mid');
        mid.appendChild(el('div', 'nm', c.name + '种子'));
        mid.appendChild(el('div', 'sub', '生长 ' + fmtTime(c.grow) + ' · 收 ' + c.yield + ' · 售价 💰' + (c.price * c.yield)));
        row.appendChild(mid);
        row.appendChild(el('div', 'price', '💰' + c.seed));
        if (lock) row.appendChild(el('div', 'lock', 'Lv.' + c.lv));
        else {
          var b1 = el('button', 'btn sm', '买1'), b5 = el('button', 'btn sm', '买5');
          b1.onclick = function (e) { e.stopPropagation(); act(Game.logic.buySeed(c.id, 1), 'coin'); };
          b5.onclick = function (e) { e.stopPropagation(); act(Game.logic.buySeed(c.id, 5), 'coin'); };
          row.appendChild(b1); row.appendChild(b5);
        }
        list.appendChild(row);
      });
    } else if (shopTab === 'feed') {
      var row = el('div', 'item');
      row.appendChild(el('span', 'ico', '🌿'));
      var mid = el('div', 'mid');
      mid.appendChild(el('div', 'nm', '通用饲料'));
      mid.appendChild(el('div', 'sub', '投喂动物，每次消耗 1 份 · 库存 ' + Game.logic.invOf('feed')));
      row.appendChild(mid);
      row.appendChild(el('div', 'price', '💰5'));
      var b1 = el('button', 'btn sm', '买1'), b10 = el('button', 'btn sm', '买10');
      b1.onclick = function () { act(Game.logic.buyFeed(1), 'coin'); };
      b10.onclick = function () { act(Game.logic.buyFeed(10), 'coin'); };
      row.appendChild(b1); row.appendChild(b10);
      list.appendChild(row);
    } else if (shopTab === 'animal') {
      C.animals.forEach(function (a) {
        var st = S.animals[a.id];
        var lock = S.level < a.lv;
        var row = el('div', 'item' + (lock ? ' locked' : ''));
        row.appendChild(el('span', 'ico', a.icon));
        var mid = el('div', 'mid');
        mid.appendChild(el('div', 'nm', a.name));
        mid.appendChild(el('div', 'sub', '饲料 💰' + a.feed + ' → ' + a.productIcon + a.productName + ' 💰' + a.price + '（' + fmtTime(a.dur) + '）'));
        row.appendChild(mid);
        row.appendChild(el('div', 'price', '💰' + a.buy));
        if (st.owned) row.appendChild(el('div', 'lock', '已拥有'));
        else if (lock) row.appendChild(el('div', 'lock', 'Lv.' + a.lv));
        else {
          var b = el('button', 'btn sm primary', '购买');
          b.onclick = function () { act(Game.logic.buyAnimal(a.id), 'coin'); };
          row.appendChild(b);
        }
        list.appendChild(row);
      });
    } else {
      C.decorations.forEach(function (d) {
        var owned = S.deco.indexOf(d.id) >= 0;
        var row = el('div', 'item');
        row.appendChild(el('span', 'ico', d.icon));
        var mid = el('div', 'mid');
        mid.appendChild(el('div', 'nm', d.name));
        mid.appendChild(el('div', 'sub', '装饰农场 + 经验 ' + d.exp));
        row.appendChild(mid);
        row.appendChild(el('div', 'price', '💰' + d.price));
        if (owned) row.appendChild(el('div', 'lock', '已拥有'));
        else {
          var b = el('button', 'btn sm primary', '购买');
          b.onclick = function () { act(Game.logic.buyDeco(d.id), 'coin'); };
          row.appendChild(b);
        }
        list.appendChild(row);
      });
    }
    wrap.appendChild(list);
    return wrap;
  }

  // ---------------- 仓库 ----------------
  function renderBag() {
    var wrap = el('div', 'page bag');
    var items = Object.keys(S.inv).filter(function (k) { return S.inv[k] > 0; });
    if (!items.length) { wrap.appendChild(el('div', 'empty', '仓库空空如也，去收获点什么吧')); return wrap; }
    var list = el('div', 'list');
    items.forEach(function (id) {
      var row = el('div', 'item');
      var meta = null;
      if (id.indexOf('seed_') === 0) { var c = C.crop(id.slice(5)); meta = c ? { name: c.name + '种子', icon: c.icon, sellable: false } : null; }
      else if (id === 'feed') meta = { name: '饲料', icon: '🌿', sellable: false };
      else { var p = C.product(id); meta = p ? { name: p.name, icon: p.icon, sellable: true, price: p.price } : null; }
      if (!meta) return;
      row.appendChild(el('span', 'ico', meta.icon));
      var mid = el('div', 'mid');
      mid.appendChild(el('div', 'nm', meta.name));
      mid.appendChild(el('div', 'sub', meta.sellable ? ('单价 💰' + meta.price) : '不可出售'));
      row.appendChild(mid);
      row.appendChild(el('div', 'count', '×' + S.inv[id]));
      if (meta.sellable) {
        var b1 = el('button', 'btn sm', '卖1'), ba = el('button', 'btn sm primary', '全卖');
        b1.onclick = function () { act(Game.logic.sellItem(id, 1), 'coin'); };
        ba.onclick = function () { act(Game.logic.sellItem(id, S.inv[id]), 'coin'); };
        row.appendChild(b1); row.appendChild(ba);
      }
      list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  // ---------------- 订单 ----------------
  function renderOrder() {
    var wrap = el('div', 'page order');
    S.orders.forEach(function (o) {
      var card = el('div', 'ordercard');
      var head = el('div', 'ohead');
      head.appendChild(el('div', 'otitle', '订单'));
      head.appendChild(el('div', 'oreward', '💰' + o.reward + ' ⭐' + o.exp));
      card.appendChild(head);
      var items = el('div', 'oitems');
      Object.keys(o.items).forEach(function (k) {
        var p = C.product(k);
        var have = Game.logic.invOf(k), need = o.items[k];
        var tag = el('div', 'oitem' + (have >= need ? ' ok' : ''));
        tag.appendChild(el('span', 'ico', p ? p.icon : '❓'));
        tag.appendChild(el('span', 'nm', p ? p.name : k));
        tag.appendChild(el('span', 'need', have + '/' + need));
        items.appendChild(tag);
      });
      card.appendChild(items);
      var btns = el('div', 'obtns');
      var sub = el('button', 'btn primary', '提交订单');
      sub.disabled = !Game.logic.canSubmit(o);
      sub.onclick = function () { act(Game.logic.submitOrder(o.id), 'coin'); };
      var rf = el('button', 'btn', '刷新');
      rf.onclick = function () { act(Game.logic.refreshOrder(o.id)); };
      btns.appendChild(sub); btns.appendChild(rf);
      card.appendChild(btns);
      wrap.appendChild(card);
    });
    return wrap;
  }

  // ---------------- 任务 ----------------
  function renderTask() {
    var wrap = el('div', 'page task');
    C.tasks.forEach(function (t) {
      var st = Game.logic.taskState(t.id);
      var row = el('div', 'taskrow' + (st.status === 'claimed' ? ' claimed' : (st.progress >= t.target ? ' done' : '')));
      var mid = el('div', 'mid');
      mid.appendChild(el('div', 'nm', t.name));
      mid.appendChild(el('div', 'sub', t.desc));
      var bar = el('div', 'pbar');
      var f = el('div', 'pfill');
      f.style.width = Math.min(100, Math.round(st.progress / t.target * 100)) + '%';
      bar.appendChild(f);
      mid.appendChild(bar);
      mid.appendChild(el('div', 'sub', '进度 ' + st.progress + '/' + t.target));
      row.appendChild(mid);
      var rw = el('div', 'reward');
      rw.appendChild(el('div', 'rw', '💰' + (t.reward.gold || 0)));
      if (t.reward.seed && t.reward.seedN) rw.appendChild(el('div', 'rw', '🌱×' + t.reward.seedN));
      rw.appendChild(el('div', 'rw', '⭐' + t.exp));
      row.appendChild(rw);
      if (st.status === 'claimed') row.appendChild(el('div', 'lock', '已领取'));
      else {
        var b = el('button', 'btn sm' + (st.progress >= t.target ? ' primary' : ''), '领取');
        b.disabled = st.progress < t.target;
        b.onclick = function () { act(Game.logic.claimTask(t.id)); };
        row.appendChild(b);
      }
      wrap.appendChild(row);
    });
    return wrap;
  }

  // ---------------- 底部导航 / 设置 ----------------
  function renderNav() {
    var nav = $('#nav');
    nav.innerHTML = '';
    [['farm', '🚜', '农场'], ['bag', '📦', '仓库'], ['order', '📋', '订单'], ['shop', '🏪', '商店'], ['task', '✅', '任务']].forEach(function (t) {
      var b = el('button', 'navbtn' + (page === t[0] ? ' on' : ''));
      b.appendChild(el('div', 'ni', t[1]));
      b.appendChild(el('div', 'nt', t[2]));
      var badge = 0;
      if (t[0] === 'order') S.orders.forEach(function (o) { if (Game.logic.canSubmit(o)) badge++; });
      if (t[0] === 'task') C.tasks.forEach(function (x) { var st = Game.logic.taskState(x.id); if (st.status === 'active' && st.progress >= x.target) badge++; });
      if (t[0] === 'farm') {
        S.plots.forEach(function (p, i) { if (i < Game.logic.unlockedPlots() && (Game.logic.isMature(p) || (p.s === 'growing' && !p.watered))) badge++; });
        C.animals.forEach(function (a) { var st = Game.logic.animalStatus(a.id); if (st.owned && st.state === 'ready') badge++; });
      }
      if (badge > 0) b.appendChild(el('div', 'badge', badge > 99 ? '99+' : String(badge)));
      b.onclick = function () { page = t[0]; render(); };
      nav.appendChild(b);
    });
  }
  function openSettings() {
    var m = el('div', 'mask');
    var box = el('div', 'modal');
    box.appendChild(el('div', 'mtitle', '设置'));
    [['music', '背景音乐'], ['sfx', '音效'], ['vibrate', '震动']].forEach(function (s) {
      var row = el('div', 'row switchrow');
      row.appendChild(el('span', 'nm', s[1]));
      var sw = el('button', 'switch' + (S.settings[s[0]] ? ' on' : ''), S.settings[s[0]] ? '开' : '关');
      sw.onclick = function () { S.settings[s[0]] = !S.settings[s[0]]; Game.save.write(S); openSettings(); m.remove(); };
      row.appendChild(sw);
      box.appendChild(row);
    });
    var hb = el('button', 'btn', '存档位置：本机（离线自动保存）');
    hb.disabled = true;
    box.appendChild(hb);
    var reset = el('button', 'btn danger', '重置存档');
    reset.onclick = function () {
      if (!confirm('确定重置全部进度？此操作不可恢复。')) return;
      Game.save.wipe();
      S = Game.state = Game.save.load();
      Game.logic.init(S);
      m.remove(); render(); toast('已重置存档');
    };
    box.appendChild(reset);
    var cx = el('button', 'btn', '关闭');
    cx.onclick = function () { m.remove(); };
    box.appendChild(cx);
    m.appendChild(box);
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    document.body.appendChild(m);
  }

  function render() {
    if (Game.state && Game.state !== S) S = Game.state;   // 外部替换状态后自动同步
    Game.iso.stop();
    renderTop();
    var main = $('#main');
    main.innerHTML = '';
    if (page === 'farm') main.appendChild(renderFarm());
    else if (page === 'shop') main.appendChild(renderShop());
    else if (page === 'bag') main.appendChild(renderBag());
    else if (page === 'order') main.appendChild(renderOrder());
    else if (page === 'task') main.appendChild(renderTask());
    renderNav();
  }

  // 保留空实现占位（倒计时由 Canvas 自行绘制）
  function tickDisabled() {}

  return {
    boot: function (state) { S = state; render(); setInterval(function () { Game.save.write(S); }, 10000); },
    render: render,
    toast: toast,
    plotTap: onPlot,        // 测试/自动化入口
    animalTap: onAnimal,
    setPage: function (p) { page = p; render(); },
    getPage: function () { return page; }
  };
}();