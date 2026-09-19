# 口袋小农场（Farm Pocket）

竖屏 2.5D 休闲农场经营游戏，Android 离线单机。
玩法：买种子 → 播种 → 浇水 → 收获 → 出售/交订单 → 升级解锁作物、土地与动物。

## 结构
- `game/` 游戏本体（HTML5 + Canvas 等距场景），浏览器可直接打开 `game/index.html` 试玩
- `android/` APK 壳工程（WebView 全屏竖屏）
- `.github/workflows/build.yml` GitHub Actions 自动构建 APK（推 main 触发）
- `PLAN.md` 规范大纲与开发指引（多窗口协作前先读）

## 安装
Release 页下载 `farm-pocket-*.apk` → 手机上点开安装（需允许安装未知应用）。

## 本地预览
打开 `game/index.html`。改动 JS/CSS 后执行 `sh bump.sh` 刷新缓存版本号。
