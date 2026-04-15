global.window = {
  __WOODCUTTER_TRIM_ENABLED__: false,
  SettingsManager: null
};
global.self = global;
require('./js/packer.js');
const GP = global.GuillotinePacker || window.GuillotinePacker;

// 테스트 1: 기본 5종 부품
const items1 = [
  { id:'a1', width:820, height:750, qty:1, rotatable:true },
  { id:'a2', width:545, height:450, qty:1, rotatable:true },
  { id:'a3', width:205, height:450, qty:1, rotatable:true },
  { id:'a4', width:750, height:50,  qty:3, rotatable:true },
  { id:'a5', width:1270, height:50, qty:2, rotatable:true }
];

const packer1 = new GP(2440, 1220, 4.2);
const result1 = packer1.pack(items1, 'auto');
const pass1 = result1.bins.length === 1 &&
              result1.unplaced.length === 0 &&
              result1.bins[0].placed.every(p => p.y < 800);
console.log('TC1 (5종부품):', pass1 ? '✅통과' : '❌실패',
  'bins:', result1.bins.length, 'unplaced:', result1.unplaced.length);

// 테스트 2: 단일 부품 500×1100
const items2 = [
  { id:'b1', width:500, height:1100, qty:1, rotatable:true }
];

const packer2 = new GP(2440, 1220, 4.2);
const result2 = packer2.pack(items2, 'auto');
const placed2 = result2.bins[0]?.placed[0];
// 가로(길이)방향 배치: width가 긴 쪽(1100)이어야 함
const pass2 = result2.bins.length === 1 &&
              result2.unplaced.length === 0 &&
              placed2 && placed2.width >= placed2.height;
console.log('TC2 (단일부품):', pass2 ? '✅통과' : '❌실패',
  'bins:', result2.bins.length,
  placed2 ? `배치: ${placed2.width}×${placed2.height} x:${Math.round(placed2.x)} y:${Math.round(placed2.y)}` : 'unplaced');

console.log('최종:', pass1 && pass2 ? '✅전체통과' : '❌실패');
