global.window = {
  __WOODCUTTER_TRIM_ENABLED__: false,
  SettingsManager: null
};
global.self = global;

require('./js/packer.js');

const GP = global.GuillotinePacker || window.GuillotinePacker;

const items = [
  { id:'a1', width:820, height:750, qty:1, rotatable:true },
  { id:'a2', width:545, height:450, qty:1, rotatable:true },
  { id:'a3', width:205, height:450, qty:1, rotatable:true },
  { id:'a4', width:750, height:50,  qty:3, rotatable:true },
  { id:'a5', width:1270, height:50, qty:2, rotatable:true }
];

const packer = new GP(2440, 1220, 4.2);
const result = packer.pack(items, 'auto');

console.log('bins:', result.bins.length);
console.log('unplaced:', result.unplaced.length);
result.bins[0].placed.forEach(p =>
  console.log(p.id, p.width+'×'+p.height, 'x:'+Math.round(p.x), 'y:'+Math.round(p.y))
);

const allUnder800 = result.bins[0].placed.every(p => p.y < 800);
console.log('통과:', allUnder800 && result.unplaced.length===0 && result.bins.length===1 ? '✅' : '❌');
