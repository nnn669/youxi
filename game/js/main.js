/* main.js — 启动、离线结算、Android 返回键桥接 */
(function () {
  function boot() {
    var S = Game.save.load();
    Game.state = S;
    Game.logic.init(S);   // init 内部会补订单
    Game.save.write(S);
    Game.ui.boot(S);
  }

  // Android 返回键：优先关闭弹窗 → 回农场页 → 交给原生退出
  window.AndroidBack = function () {
    var mask = document.querySelector('.mask');
    if (mask) { mask.remove(); return true; }
    if (Game.ui.getPage() !== 'farm') { Game.ui.setPage('farm'); return true; }
    return false; // 原生层处理双击退出
  };

  // 切回前台重新结算离线
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Game.state) {
      var fresh = Game.save.load();
      Game.state.plots = fresh.plots;
      Game.config.animals.forEach(function (a) {
        var src = fresh.animals[a.id], dst = Game.state.animals[a.id];
        if (src && dst) { dst.ready = src.ready || dst.ready; if (dst.ready) dst.count = Math.max(dst.count, 1); }
      });
      Game.ui.render();
    } else if (Game.state) {
      Game.save.write(Game.state);
    }
  });

  window.addEventListener('error', function (e) {
    var t = document.getElementById('toast');
    if (t) { t.textContent = '出错了：' + (e.message || '未知'); t.className = 'toast show err'; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();