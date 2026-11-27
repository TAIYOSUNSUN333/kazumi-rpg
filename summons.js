const summonContracts = [
  {id:'phoenix', name:'暁炎の不死鳥', chapter:4, element:'炎', art:3, color:'#ff8b55', cost:12, power:1.55},
  {id:'wolf', name:'霜月の白狼', chapter:8, element:'氷', art:0, color:'#a6dfff', cost:12, power:1.35},
  {id:'kirin', name:'千雷の麒麟', chapter:17, element:'雷', art:2, color:'#e8cc75', cost:14, power:1.68},
  {id:'serpent', name:'潮鏡の海竜', chapter:20, element:'水', art:1, color:'#7bc8d7', cost:11, power:1.2},
  {id:'giant', name:'地脈の巨人', chapter:34, element:'土', art:4, color:'#b8a789', cost:14, power:1.5},
  {id:'shade', name:'夜凪の魔獣', chapter:42, element:'闇', art:5, color:'#c797e7', cost:16, power:1.75},
  {id:'dragon', name:'明け星の神竜', chapter:46, element:'光', art:3, color:'#ffe6a3', cost:19, power:2.18}
];
const learnedSummons = () => summonContracts.filter(spirit => tourBook[spirit.chapter]?.boss);
function summonDex() {
  panel('召喚獣図鑑',summonContracts.map(spirit => spirit.name + ' ・' + spirit.element + '　' +
    (tourBook[spirit.chapter]?.boss ? '契約済み　MP ' + spirit.cost :
      '第' + (spirit.chapter+1) + '章の隠しダンジョンの守護者を討伐すると契約可能。')),
  [['メニューに戻る',openMenu]]);
}

function summonMenu() {
  if (!isActionBattle()) return;
  const learned = learnedSummons();
  panel('召喚魔法',[battle.summon ? '召喚獣が参戦中。' : '召喚枠は1体。契約した召喚獣が一時的に加勢します。'],[
    ...learned.map(spirit => [spirit.name + '　MP ' + spirit.cost,() => {
      if (battle.summon || player.mp < spirit.cost) return;
      player.mp -= spirit.cost;
      battle.summon = {spirit,start:clock,until:clock+9.3,next:clock+.72};
      resume();
      showSummoning();
    },Boolean(battle.summon) || player.mp < spirit.cost]),
    ['戻る',openMenu]
  ]);
}

function showSummoning() {
  audio.play('summon');
  startCinema('awakening');
}

function spiritPower(spirit) {
  return Math.ceil((attackPower() * 1.05 + 9 + (joined ? catForm().atk*.20 : 0)) * spirit.power);
}

function updateSummon() {
  const summon = battle.summon;
  if (!summon) return;
  if (clock >= summon.until) {
    battle.summon = null;
    return;
  }
  if (clock < summon.next) return;
  summon.next = clock + 1.62;
  const {spirit} = summon;
  if (spirit.id === 'wolf' || spirit.id === 'kirin') battle.slowedUntil = clock+1.02;
  if (spirit.id === 'giant') invulnerableUntil = Math.max(invulnerableUntil,clock+.35);
  const damage = spiritPower(spirit);
  if (spirit.id === 'phoenix') battle.burn = {at:clock+.56,damage:Math.ceil(damage*.36)};
  if (spirit.id === 'serpent') player.mp = Math.min(maxMP(),player.mp+2);
  if (spirit.id === 'shade') player.hp = Math.min(maxHP(),player.hp + Math.ceil(maxHP()*.055));
  summon.flash = clock+.39;
  audio.play(spirit.id === 'giant' ? 'quake' : 'magic');
  hurtActionEnemy(Math.min(damage,Math.ceil(battle.enemy.max*(battle.enemy.boss ? .14 : 1))),spirit.element);
}

function drawSummon(spirit,x,y,scale,flash = false) {
  const image = picture('enemy-'+spirit.art);
  if (!image) return;
  lightAt(ctx,x,y-32,66*scale,spirit.color+'85');
  const bob = reducedMotion.matches ? 0 : Math.sin(clock*7)*4;
  ctx.save();
  ctx.globalAlpha = .83;
  if (artQuality !== 'low') ctx.filter = 'drop-shadow(0 0 8px ' + spirit.color + ')';
  ctx.drawImage(image,x-36*scale,y-63*scale+bob,72*scale,68*scale);
  ctx.restore();
  if (flash) {
    ctx.strokeStyle = spirit.color;
    ctx.lineWidth = 2;
    ctx.beginPath();ctx.ellipse(x,y-22,37*scale,23*scale,0,0,6.283);ctx.stroke();
  }
  label(spirit.name,x,y+13,spirit.color,12);
}
