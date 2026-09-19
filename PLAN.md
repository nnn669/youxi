# 口袋小农场 — 项目规范与开发指引

> 本文件是项目唯一权威文档。**多窗口/多会话协作时先读本文件**，改完代码必须更新「进度检查表」。
> 最后更新：2026-09-20

## 0. 项目信息
- 产品：口袋小农场（Farm Pocket）—— 竖屏 2D 卡通休闲经营游戏，Android 离线单机。
- 形态：HTML5 游戏（DOM+CSS+原生 JS，零图片依赖，emoji 表现）打包进 Android WebView 壳工程，GitHub Actions 构建 APK。
- 仓库：GitHub `nnn669/youxi`（私有），Actions workflow 构建并上传 APK artifact。
- 包名：`com.dpeng999.farmgame`，minSdk 26（Android 8.0+），targetSdk 34。
- 交付物：可安装 APK + 完整源码 + 安装说明。

## 1. 目录结构
```
farm-game/
├── PLAN.md               ← 本文件
├── docs/                 ← 需求/设计文档
├── game/                 ← 游戏本体（WebView assets）
│   ├── index.html        ← 入口
│   ├── css/style.css     ← 全部样式
│   └── js/
│       ├── config.js     ← 数值配置（作物/动物/订单/任务/装饰/等级）
│       ├── save.js       ← 存档（localStorage）
│       ├── game.js       ← 核心逻辑（状态机、经济、订单、任务）
│       ├── ui.js         ← 渲染与交互（DOM）
│       └── main.js       ← 初始化、主循环、事件绑定
├── android/              ← Android 壳工程（gradle）
│   ├── settings.gradle
│   ├── build.gradle
│   ├── gradle.properties
│   └── app/
│       ├── build.gradle
│       ├── src/main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/dpeng999/farmgame/MainActivity.kt
│       │   └── assets/game/   ← 构建时复制 game/ 内容
│       └── src/main/res/      ← 图标、主题
├── .github/workflows/build.yml  ← Actions 构建 APK
└── build_local.sh         ← 本地一键构建（可选调试）
```

## 2. 多窗口协作规则（重要）
1. **文件所有权**：每个窗口同时只改一个文件，改完提交并更新本文件进度表。冲突时以最后提交者为准，但必须跑通浏览器测试。
2. **全局命名空间**：所有代码挂 `window.Game`，禁止裸全局变量。
   - `Game.config` 数值配置 | `Game.state` 运行时状态 | `Game.save` 存档模块 | `Game.logic` 核心逻辑 | `Game.ui` 渲染 | `Game.init` 启动
3. **状态刷新约定**：任何操作后调用 `Game.ui.render()` 全量重绘（简单可靠，不做细粒度 diff）。数据变更必须先走 `Game.logic` 再落盘。
4. **存档 key**：`farm_save_v1`。改动存档结构必须升版本号并写迁移函数。
5. **数值修改位置**：一律改 `config.js`，禁止在逻辑里写死数值。
6. **测试约定**：每次改动后用浏览器打开 `game/index.html` 验证核心流程（种→浇→收→卖），截图存档到 docs/。

## 3. 核心玩法
买种子 → 播种 → 浇水 → 等待 → 成熟 → 收获 → 出售/交订单 → 得金币经验 → 升级解锁新作物/土地/动物。离线按时间差结算生长（上限 24h）。

## 4. 数值配置规范（config.js 为准，此处为设计值）
### 4.1 等级经验
`expToNext(level) = 30 + (level-1)*20`，等级上限 20。初始 6 块地，每 2 级解锁 3 块，最多 24 块。

### 4.2 作物（id/名称/解锁等级/种子价/生长秒/产量/单价）
| id | 名称 | 等级 | 种子 | 秒 | 产量 | 单价 |
|---|---|---|---|---|---|---|
| wheat | 小麦 | 1 | 5 | 30 | 1 | 12 |
| carrot | 胡萝卜 | 2 | 10 | 60 | 1 | 25 |
| corn | 玉米 | 3 | 18 | 90 | 1 | 45 |
| tomato | 番茄 | 4 | 30 | 120 | 1 | 75 |
| strawberry | 草莓 | 6 | 55 | 180 | 2 | 45 |
| pumpkin | 南瓜 | 8 | 90 | 240 | 1 | 220 |

### 4.3 动物（id/名称/等级/购买价/饲料价/产出秒/产物/产物单价）
| id | 名称 | 等级 | 购买 | 饲料 | 秒 | 产物 | 单价 |
|---|---|---|---|---|---|---|---|
| chicken | 鸡 | 2 | 120 | 8 | 60 | 鸡蛋 | 25 |
| cow | 奶牛 | 5 | 500 | 15 | 120 | 牛奶 | 60 |
| sheep | 绵羊 | 7 | 900 | 18 | 150 | 羊毛 | 90 |

### 4.4 订单
同时 3 单，只要求已解锁产品；奖励 = 材料总价 × 1.3 取整 + 经验 5~15。刷新免费，限每单每日 5 次。

### 4.5 新手任务序列
种 1 次小麦 → 收获 5 次 → 买 1 只鸡 → 交 1 单 → 达到 3 级。每步奖励金币/种子，完成领奖。

### 4.6 装饰
围栏(20)、花坛(50)、路灯(80)、风车(200)、稻草人(150)——纯展示 + 少量经验奖励，固定装饰位。

## 5. 存档格式（localStorage `farm_save_v1`）
```json
{
  "v": 1, "gold": 50, "exp": 0,
  "plots": [{"s": "locked|empty|growing|mature", "crop": "wheat", "t": 1690000000000, "watered": true}],
  "animals": {"chicken": {"owned": false, "fedAt": 0, "ready": false, "count": 0}},
  "inv": {"wheat": 0},
  "orders": [{"id": 1, "items": {"wheat": 2}, "reward": 31, "exp": 8, "refresh": 0}],
  "tasks": {"t1": "active|done|claimed"},
  "deco": ["fence"],
  "settings": {"music": true, "sfx": true, "vibrate": true},
  "stats": {"harvest": 0, "orders": 0, "earned": 0},
  "ts": 1690000000000
}
```
- 地块状态：locked/empty/growing/mature；`watered=false` 不生长，浇水后按 `t` 开始计时。
- 动物：`owned` 拥有；`fedAt` 上次投喂时间；`ready` 产物可领；`count` 未领产物数（上限 10）。
- 离线结算：重开时 `growing` 地块按 `now - t` 结算成熟（上限 24h）；动物 `fedAt + dur <= now` 则 `ready=true`。

## 6. 事件与接口
- `Game.logic.buySeed(id,n)` / `plant(plotIdx,crop)` / `water(plotIdx)` / `harvest(plotIdx)` / `sellItem(id,n)` / `submitOrder(orderIdx)` / `feedAnimal(id)` / `collectAnimal(id)` / `claimTask(id)` / `refreshOrders()`
- 所有接口内部：校验 → 改状态 → `Game.save.write()` → 返回 `{ok, msg, data?}`；UI 层统一弹 toast。

## 7. 开发顺序与进度检查表（每完成一项打 x）
- [x] 0. 项目骨架 + 本文件
- [ ] 1. config.js 数值配置
- [ ] 2. save.js 存档模块（读写/迁移/离线结算）
- [ ] 3. game.js 核心逻辑（种植/收获/动物/订单/任务/经济）
- [ ] 4. ui.js 渲染交互（农场/商店/仓库/订单/任务/设置 + 弹窗/toast）
- [ ] 5. style.css + index.html + main.js 组装
- [ ] 6. 浏览器完整流程测试（截图到 docs/）
- [ ] 7. Android 壳工程（gradle + WebView + 全屏竖屏 + 返回键桥）
- [ ] 8. GitHub Actions workflow（构建 APK + 上传 artifact）
- [ ] 9. 推仓库 youxi，Actions 构建成功，下载 APK
- [ ] 10. 真机安装验收（用户手机）

## 8. 构建与交付
- 推 GitHub → Actions（ubuntu-latest + JDK17 + SDK 34）→ `gradle assembleDebug` → 上传 `app-debug.apk`。
- 签名：debug keystore（Actions 内生成或仓库内提交 keystore，首版用 debug 签名即可安装）。
- APK 下载后 cp 到 `/var/minis/mounts/Documents/` 并给可点击链接。
