/* game.js — 核心逻辑：种植/养殖/订单/任务/经济。本文件不触碰 DOM。 */
window.Game = window.Game || {};

Game.logic = function () {
  var C = Game.config;
  var S = null; // = Game.state

  function ok(msg) { return { ok: true, msg: msg || '' }; }
  function err(msg) { return { ok: false, msg: msg }; }

  // ---------- 基础 ----------
  function level() { return S.level; }
  function expNeed() { return C.expToNext(S.level); }
  function addGold(n) { S.gold = Math.max(0, S.gold + n); }
  function addExp(n) {
    S.exp += n;
    var up = 0;
    while (S.level < C.maxLevel && S.exp >= C.expToNext(S.level)) {
      S.exp -= C.expToNext(S.level);
      S.level++;
      up++;
    }
    if (S.level >= C.maxLevel) S.exp = Math.min(S.exp, C.expToNext(C.maxLevel) - 1);
    if (up > 0) { unlockPlots(); syncLevelTasks(); }
    return up;
  }
  function unlockedPlots() {
    return Math.min(C.plotMax, C.plotStart + Math.floor((S.level - 1) / C.plotUnlockPerLevels) * C.plotUnlockCount);
  }
  function unlockPlots() {
    var n = unlockedPlots();
    for (var i = 0; i < n; i++) if (S.plots[i].s === 'locked') S.plots[i].s = 'empty';
  }
  function invOf(id) { return S.inv[id] || 0; }
  function addItem(id, n) { S.inv[id] = invOf(id) + n; if (S.inv[id] <= 0) delete S.inv[id]; }

  // ---------- 任务 ----------
  function taskState(id) { if (!S.tasks[id]) S.tasks[id] = { status: 'active', progress: 0 }; return S.tasks[id]; }
  function syncLevelTasks() {
    C.tasks.forEach(function (t) {
      if (t.type === 'level') { var st = taskState(t.id); st.progress = Math.max(st.progress, S.level); }
    });
  }
  function taskProgress(type, n, value) {
    C.tasks.forEach(function (t) {
      if (t.type !== type) return;
      var st = taskState(t.id);
      if (st.status !== 'active') return;
      st.progress = (value !== undefined) ? Math.max(st.progress, value) : st.progress + (n || 1);
      if (st.progress >= t.target) st.progress = t.target;
    });
  }
  function claimTask(id) {
    var t = C.tasks.find(function (x) { return x.id === id; });
    if (!t) return err('任务不存在');
    var st = taskState(id);
    if (st.status !== 'active') return err('该任务已领取');
    if (st.progress < t.target) return err('任务尚未完成');
    st.status = 'claimed';
    if (t.reward.gold) addGold(t.reward.gold);
    if (t.reward.seed) addItem('seed_' + t.reward.seed, t.reward.seedN || 1);
    addExp(t.exp || 0);
    return ok('任务奖励已领取');
  }

  // ---------- 商店 ----------
  function buySeed(cropId, n) {
    var c = C.crop(cropId);
    if (!c) return err('作物不存在');
    if (S.level < c.lv) return err('需要 ' + c.lv + ' 级解锁');
    n = Math.max(1, n | 0);
    var cost = c.seed * n;
    if (S.gold < cost) return err('金币不足');
    addGold(-cost);
    addItem('seed_' + c.id, n);
    return ok('购买 ' + c.name + '种子 ×' + n);
  }
  function buyFeed(n) {
    n = Math.max(1, n | 0);
    var cost = 5 * n; // 饲料统一单价 5
    if (S.gold < cost) return err('金币不足');
    addGold(-cost);
    addItem('feed', n);
    return ok('购买饲料 ×' + n);
  }
  function buyDeco(id) {
    var d = C.deco(id);
    if (!d) return err('装饰不存在');
    if (S.deco.indexOf(id) >= 0) return err('已拥有');
    if (S.gold < d.price) return err('金币不足');
    addGold(-d.price);
    S.deco.push(id);
    addExp(d.exp || 0);
    return ok('已购买 ' + d.name);
  }
  function buyAnimal(id) {
    var a = C.animal(id);
    if (!a) return err('动物不存在');
    if (S.level < a.lv) return err('需要 ' + a.lv + ' 级解锁');
    var st = S.animals[id];
    if (st.owned) return err('已拥有');
    if (S.gold < a.buy) return err('金币不足');
    addGold(-a.buy);
    st.owned = true; st.fedAt = 0; st.ready = false; st.count = 0;
    if (id === 'chicken') taskProgress('buy_chicken', 1);
    return ok('已购买 ' + a.name);
  }

  // ---------- 农田 ----------
  function plant(idx, cropId) {
    var p = S.plots[idx];
    if (!p) return err('地块不存在');
    if (p.s === 'locked') return err('该地块尚未解锁');
    if (p.s !== 'empty') return err('该地块已占用');
    var c = C.crop(cropId);
    if (!c) return err('作物不存在');
    if (S.level < c.lv) return err('需要 ' + c.lv + ' 级解锁');
    if (invOf('seed_' + c.id) < 1) return err('没有' + c.name + '种子');
    addItem('seed_' + c.id, -1);
    p.s = 'growing'; p.crop = c.id; p.watered = false; p.t = Date.now();
    if (c.id === 'wheat') taskProgress('plant_wheat', 1);
    return ok('已播种' + c.name + '（浇水后生长）');
  }
  function water(idx) {
    var p = S.plots[idx];
    if (!p || p.s !== 'growing') return err('无需浇水');
    if (p.watered) return err('已浇过水');
    p.watered = true;
    p.t = Date.now();
    return ok('浇水完成，开始生长');
  }
  function isMature(p) {
    if (p.s !== 'growing' || !p.watered || !p.crop) return false;
    var c = C.crop(p.crop);
    return c && Date.now() - p.t >= c.grow * 1000;
  }
  function refreshPlot(idx) {
    var p = S.plots[idx];
    if (p && p.s === 'growing' && isMature(p)) p.s = 'mature';
    return p;
  }
  function harvest(idx) {
    var p = refreshPlot(idx);
    if (!p || p.s !== 'mature') return err('尚未成熟');
    var c = C.crop(p.crop);
    var n = c.yield || 1;
    addItem(c.id, n);
    addExp((c.exp || 1) * n);
    S.stats.harvest++;
    taskProgress('harvest', 1);
    p.s = 'empty'; p.crop = null; p.watered = false; p.t = 0;
    return ok('收获 ' + c.name + ' ×' + n);
  }
  function sellItem(id, n) {
    var pr = C.product(id);
    if (!pr) return err('物品不可出售');
    n = Math.max(1, n | 0);
    if (invOf(id) < n) return err('库存不足');
    addItem(id, -n);
    var gain = Math.round(pr.price * n * C.sellRatio);
    addGold(gain);
    S.stats.earned += gain;
    return ok('出售 ' + pr.name + ' ×' + n + '，+' + gain + ' 金币');
  }

  // ---------- 养殖 ----------
  function animalStatus(id) {
    var a = C.animal(id), st = S.animals[id];
    if (!st || !st.owned) return { owned: false };
    if (st.ready) return { owned: true, state: 'ready', st: st };
    if (st.fedAt > 0) {
      var left = Math.ceil((a.dur * 1000 - (Date.now() - st.fedAt)) / 1000);
      if (left <= 0) { st.ready = true; if (st.count < 1) st.count = 1; return { owned: true, state: 'ready', st: st }; }
      return { owned: true, state: 'producing', left: left, st: st };
    }
    return { owned: true, state: 'hungry', st: st };
  }
  function feedAnimal(id) {
    var a = C.animal(id), st = S.animals[id];
    if (!st || !st.owned) return err('尚未购买');
    if (st.ready) return err('产物待领取');
    if (st.fedAt > 0 && Date.now() - st.fedAt < a.dur * 1000) return err('正在产出中');
    if (invOf('feed') < 1) return err('没有饲料');
    addItem('feed', -1);
    st.fedAt = Date.now(); st.ready = false;
    return ok('已投喂' + a.name);
  }
  function collectAnimal(id) {
    var a = C.animal(id), st = S.animals[id];
    if (!st || !st.owned) return err('尚未购买');
    animalStatus(id);
    if (!st.ready || st.count < 1) return err('暂无可领取产物');
    var n = Math.min(st.count, C.animalMaxStore);
    addItem(a.product, n);
    addExp((a.exp || 1) * n);
    st.count = 0; st.ready = false; st.fedAt = 0;
    return ok('领取 ' + a.productName + ' ×' + n);
  }

  // ---------- 订单 ----------
  function orderPool() {
    var pool = [];
    C.crops.forEach(function (c) { if (c.lv <= S.level) pool.push({ id: c.id, price: c.price, isProduct: false }); });
    C.animals.forEach(function (a) { if (a.lv <= S.level && S.animals[a.id].owned) pool.push({ id: a.product, price: a.price, isProduct: true }); });
    return pool;
  }
  function makeOrder(ignored) {
    var used = {};
    var pool = orderPool();
    if (!pool.length) return null;
    var items = {}, total = 0;
    var want = 1 + Math.floor(Math.random() * 3);
    var guard = 0;
    while (Object.keys(items).length < want && guard++ < 30) {
      var pick = pool[Math.floor(Math.random() * pool.length)];
      if (used[pick.id]) continue;
      var maxN = pick.isProduct ? 2 : 3;
      items[pick.id] = 1 + Math.floor(Math.random() * maxN);
      total += pick.price * items[pick.id];
      used[pick.id] = true;
    }
    if (!Object.keys(items).length) return null;
    return {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      items: items,
      reward: Math.round(total * C.orderBonus),
      exp: C.orderExpMin + Math.floor(Math.random() * (C.orderExpMax - C.orderExpMin + 1)),
      refresh: { n: 0, day: dayKey() }
    };
  }
  function genOrders() {
    var out = [];
    for (var i = 0; i < C.orderSlots; i++) { var o = makeOrder(); if (o) out.push(o); }
    return out;
  }
  function canSubmit(o) {
    return Object.keys(o.items).every(function (id) { return invOf(id) >= o.items[id]; });
  }
  function submitOrder(id) {
    var idx = -1;
    S.orders.forEach(function (o, i) { if (o.id === id) idx = i; });
    if (idx < 0) return err('订单不存在');
    var o = S.orders[idx];
    if (!canSubmit(o)) return err('材料不足');
    Object.keys(o.items).forEach(function (k) { addItem(k, -o.items[k]); });
    addGold(o.reward);
    S.stats.earned += o.reward;
    S.stats.orders++;
    addExp(o.exp);
    taskProgress('order', 1);
    var fresh = makeOrder();
    S.orders[idx] = fresh || o;
    return ok('订单完成，+' + o.reward + ' 金币');
  }
  function dayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function refreshOrder(id) {
    var idx = -1;
    S.orders.forEach(function (o, i) { if (o.id === id) idx = i; });
    if (idx < 0) return err('订单不存在');
    var o = S.orders[idx];
    if (o.refresh.day !== dayKey()) o.refresh = { n: 0, day: dayKey() };
    if (o.refresh.n >= C.orderRefreshMax) return err('今日刷新次数已用完');
    o.refresh.n++;
    var n = makeOrder();
    if (!n) return err('暂无可生成订单');
    S.orders[idx] = n;
    return ok('订单已刷新');
  }

  return {
    init: function (state) {
      S = state; unlockPlots(); syncLevelTasks();
      if (!S.orders || !S.orders.length) S.orders = genOrders();
    },
    level: level, expNeed: expNeed, addGold: addGold, addExp: addExp,
    unlockedPlots: unlockedPlots, invOf: invOf, addItem: addItem,
    isMature: isMature, refreshPlot: refreshPlot, animalStatus: animalStatus,
    canSubmit: canSubmit, taskState: taskState, taskProgress: taskProgress,
    buySeed: buySeed, buyFeed: buyFeed, buyDeco: buyDeco, buyAnimal: buyAnimal,
    plant: plant, water: water, harvest: harvest, sellItem: sellItem,
    feedAnimal: feedAnimal, collectAnimal: collectAnimal,
    genOrders: genOrders, submitOrder: submitOrder, refreshOrder: refreshOrder,
    claimTask: claimTask
  };
}();