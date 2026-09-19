/* save.js — 存档模块（localStorage 读写、迁移、离线结算） */
window.Game = window.Game || {};

Game.save = function () {
  var KEY = Game.config.SAVE_KEY;

  function newState() {
    var plots = [];
    for (var i = 0; i < Game.config.plotMax; i++) {
      plots.push({ s: i < Game.config.plotStart ? 'empty' : 'locked', crop: null, t: 0, watered: false });
    }
    var animals = {};
    Game.config.animals.forEach(function (a) { animals[a.id] = { owned: false, fedAt: 0, ready: false, count: 0 }; });
    return {
      v: Game.config.VERSION,
      gold: Game.config.startGold,
      exp: 0,
      level: 1,
      plots: plots,
      animals: animals,
      inv: { seed_wheat: 2, feed: 2 },
      orders: [],
      tasks: {},
      deco: [],
      settings: { music: true, sfx: true, vibrate: true },
      stats: { harvest: 0, orders: 0, earned: 0 },
      ts: Date.now()
    };
  }

  // 生成订单由 Game.logic.genOrders() 负责（load 后由 main.js 补空）
  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // 迁移：v1 无迁移
  function migrate(s) {
    if (!s || typeof s !== 'object') return null;
    if (s.v !== Game.config.VERSION) {
      // 结构不兼容则重建（保留金币/等级/库存尽力迁移）
      var n = newState();
      if (typeof s.gold === 'number') n.gold = s.gold;
      if (typeof s.level === 'number') n.level = s.level;
      if (s.inv && typeof s.inv === 'object') n.inv = s.inv;
      return n;
    }
    return s;
  }

  // 离线结算：作物成熟 + 动物产出，上限 24h
  function settleOffline(s) {
    var now = Date.now();
    var cap = Game.config.MAX_OFFLINE_HOURS * 3600 * 1000;
    var elapsed = Math.min(now - s.ts, cap);
    if (elapsed < 1000) return;

    s.plots.forEach(function (p) {
      if (p.s === 'growing' && p.watered && p.crop) {
        var c = Game.config.crop(p.crop);
        if (c && now - p.t >= c.grow * 1000) { p.s = 'mature'; p.t = now; }
      }
    });
    Game.config.animals.forEach(function (def) {
      var a = s.animals[def.id];
      if (a && a.owned && a.fedAt > 0 && !a.ready && now - a.fedAt >= def.dur * 1000) {
        a.ready = true;
        a.count = 1;
      }
    });
    s.ts = now;
  }

  return {
    load: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      var s = migrate(raw ? JSON.parse(raw) : null);
      if (!s) s = newState();
      settleOffline(s);
      return s;
    },
    write: function (s) {
      s.ts = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存储满则忽略 */ }
    },
    wipe: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
    },
    newState: newState
  };
}();