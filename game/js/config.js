/* config.js — 全部数值配置（禁止在逻辑里写死数值） */
window.Game = window.Game || {};

Game.config = {
  SAVE_KEY: 'farm_save_v1',
  VERSION: 1,
  MAX_OFFLINE_HOURS: 24,

  // 经济
  startGold: 50,
  sellRatio: 1.0,          // 直接出售按单价
  orderBonus: 1.3,         // 订单奖励 = 材料总价 * 1.3
  maxLevel: 20,
  expToNext: function (level) { return 30 + (level - 1) * 20; },

  // 土地
  plotStart: 6,
  plotMax: 24,
  plotUnlockPerLevels: 2,  // 每 2 级解锁 3 块
  plotUnlockCount: 3,
  waterTime: 0,            // 播种后需浇水，浇水即刻开始生长

  // 作物
  crops: [
    { id: 'wheat',      name: '小麦',   icon: '🌾', lv: 1, seed: 5,  grow: 30,  yield: 1, price: 12,  exp: 1 },
    { id: 'carrot',     name: '胡萝卜', icon: '🥕', lv: 2, seed: 10, grow: 60,  yield: 1, price: 25,  exp: 2 },
    { id: 'corn',       name: '玉米',   icon: '🌽', lv: 3, seed: 18, grow: 90,  yield: 1, price: 45,  exp: 3 },
    { id: 'tomato',     name: '番茄',   icon: '🍅', lv: 4, seed: 30, grow: 120, yield: 1, price: 75,  exp: 4 },
    { id: 'strawberry', name: '草莓',   icon: '🍓', lv: 6, seed: 55, grow: 180, yield: 2, price: 45,  exp: 5 },
    { id: 'pumpkin',    name: '南瓜',   icon: '🎃', lv: 8, seed: 90, grow: 240, yield: 1, price: 220, exp: 8 }
  ],

  // 动物
  animals: [
    { id: 'chicken', name: '母鸡', icon: '🐔', lv: 2, buy: 120, feed: 8,  dur: 60,  product: 'egg',   productName: '鸡蛋', productIcon: '🥚', price: 25, exp: 2 },
    { id: 'cow',     name: '奶牛', icon: '🐄', lv: 5, buy: 500, feed: 15, dur: 120, product: 'milk',  productName: '牛奶', productIcon: '🥛', price: 60, exp: 4 },
    { id: 'sheep',   name: '绵羊', icon: '🐑', lv: 7, buy: 900, feed: 18, dur: 150, product: 'wool',  productName: '羊毛', productIcon: '🧶', price: 90, exp: 6 }
  ],
  animalMaxStore: 10,      // 未领取产物上限

  // 订单
  orderSlots: 3,
  orderRefreshMax: 5,      // 每单每日免费刷新次数
  orderExpMin: 5,
  orderExpMax: 15,

  // 装饰（固定装饰位，纯展示）
  decorations: [
    { id: 'fence',    name: '木围栏', icon: '🪵', price: 20,  exp: 1 },
    { id: 'flowerbed',name: '花坛',   icon: '🌷', price: 50,  exp: 2 },
    { id: 'lamp',     name: '路灯',   icon: '💡', price: 80,  exp: 3 },
    { id: 'scarecrow',name: '稻草人', icon: '🎏', price: 150, exp: 4 },
    { id: 'windmill', name: '风车',   icon: '🎡', price: 200, exp: 6 }
  ],

  // 新手任务
  tasks: [
    { id: 't1', name: '播种小麦',   desc: '在空地上种下 1 颗小麦种子', target: 1, type: 'plant_wheat',  reward: { gold: 20, seed: 'wheat', seedN: 2 }, exp: 5 },
    { id: 't2', name: '初次收获',   desc: '累计收获 5 次作物',          target: 5, type: 'harvest',      reward: { gold: 50 }, exp: 10 },
    { id: 't3', name: '养只母鸡',   desc: '购买 1 只母鸡',              target: 1, type: 'buy_chicken',  reward: { gold: 80 }, exp: 15 },
    { id: 't4', name: '完成订单',   desc: '提交 1 个订单',              target: 1, type: 'order',        reward: { gold: 100 }, exp: 20 },
    { id: 't5', name: '农场三级',   desc: '农场等级达到 3 级',          target: 3, type: 'level',        reward: { gold: 150 }, exp: 25 }
  ],

  // 音效（WebAudio 合成，无音频文件）
  sfx: {
    plant:  { type: 'sine',     f0: 420, f1: 620, dur: 0.12 },
    water:  { type: 'sine',     f0: 700, f1: 320, dur: 0.18 },
    harvest:{ type: 'triangle', f0: 520, f1: 880, dur: 0.16 },
    coin:   { type: 'square',   f0: 880, f1: 1320, dur: 0.10 },
    error:  { type: 'sawtooth', f0: 220, f1: 120, dur: 0.16 }
  },

  // 查询辅助
  crop: function (id) { return this.crops.find(function (c) { return c.id === id; }) || null; },
  animal: function (id) { return this.animals.find(function (a) { return a.id === id; }) || null; },
  deco: function (id) { return this.decorations.find(function (d) { return d.id === id; }) || null; },
  // 某地块解锁所需等级
  levelForPlot: function (idx) {
    if (idx < this.plotStart) return 1;
    return 1 + 2 * Math.ceil((idx - this.plotStart + 1) / this.plotUnlockCount);
  },
  // 全部可出售产物（作物 + 动物产物）
  product: function (id) {
    var c = this.crop(id);
    if (c) return { id: c.id, name: c.name, icon: c.icon, price: c.price };
    var a = this.animals.find(function (x) { return x.product === id; });
    if (a) return { id: a.product, name: a.productName, icon: a.productIcon, price: a.price };
    return null;
  }
};
