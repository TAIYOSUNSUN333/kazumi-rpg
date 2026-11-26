const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const numeric = (value, fallback, min, max) =>
  Number.isFinite(value) ? clamp(Math.floor(value), min, max) : fallback;
const saveKey = 'kazumi';
const storage = {
  read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
};
const player = {
  x: 25, y: 104, hp: 100, mp: 30, xp: 0, gold: 0, shards: 0, herbs: 0,
  weapon: 0, armor: 0, party: [], facing: {x: 1, y: 0}
};
let mode = 'title';
let paused = false;
let returning = false;
let joined = false;
const cat = {x: 0, y: 104, form: 0, hp: awakening[0].hp, mp: awakening[0].mp};
const clearedTrials = new Set();
const trialGear = {weapon: null, armor: null};
let trialVitals = null;
const catForm = () => awakening[cat.form];
let done = false;
let currentChapter = -1;
let battle = null;
let checkpoint = 0;
let destination = null;
let clock = 0;
let specialAt = 0;
let attackAt = 0;
let swingUntil = 0;
let invulnerableUntil = 0;
let fieldSafeUntil = 0;
let flashUntil = 0;
let levelUntil = 0;
let burstUntil = 0;
let messageUntil = 0;
const numbers = [];
const level = () => 1 + Math.floor(Math.sqrt(player.xp / 25));
const nextXp = () => level() ** 2 * 25;
const maxHP = () => 100 + (level() - 1) * 13;
const maxMP = () => 30 + (level() - 1) * 4;
const attackPower = () => 10 + (level() - 1) * 3 + equipped('weapon').bonus + (player.party.includes('一郎') ? 2 : 0);
const defense = () => 5 + (level() - 1) * 2 + equipped('armor').bonus + (player.party.includes('クルミ') ? 1 : 0);
function equipped(type) {
  return trials[trialGear[type]]?.reward || equipment[type][player[type]];
}
const activeEnemies = chapter => enemies.slice(chapter * 8, chapter * 8 + 8);
const unlocked = enemy => !enemy.boss || (shrines[enemy.chapter].solved &&
  (enemy.rank === 'mid' || activeEnemies(enemy.chapter)[6].hp === 0));

const prefs = storage.read('kazumi-audio');
audio.setVolume(numeric(prefs?.volume, 45, 0, 100) / 100, prefs?.muted === true);

function save(explicit = false) {
  if (trialVitals) return false;
  const success = storage.write(saveKey, {
    version: 4, x: player.x, y: player.y, hp: player.hp, mp: player.mp,
    xp: player.xp, gold: player.gold, shards: player.shards, herbs: player.herbs,
    weapon: player.weapon, armor: player.armor, party: player.party, checkpoint,
    visited: npcs.map(npc => Boolean(npc.visited)), gems: gems.map(gem => gem.on),
    enemies: enemies.map(enemy => enemy.hp), shrines: shrines.map(shrine => shrine.solved),
    special: Math.max(0, specialAt - clock), joined, returning, done,
    trials: [...clearedTrials], trialGear
  });
  if (explicit) say(success ? 'このブラウザに冒険を保存した。' : 'このブラウザでは保存できません。');
  return success;
}

function load(data) {
  if (!data || typeof data !== 'object') return;
  const current = data.version === 4;
  const modern = current || data.version === 3;
  const oldMap = data.version === 2;
  player.xp = numeric(data.xp, 0, 0, 1000000);
  player.party = npcs.slice(1).map(npc => npc.name).filter(name =>
    Array.isArray(data.party) && data.party.includes(name));
  player.shards = numeric(modern ? data.shards : data.art, 0, 0, 100000);
  player.x = modern || oldMap ? numeric(data.x, 25, 0, limit) : 25;
  player.y = modern || oldMap ? numeric(data.y, 104, 44, 162) : 104;
  player.gold = modern ? numeric(data.gold, 0, 0, 1000000) : Math.floor(player.xp / 3);
  player.herbs = modern ? numeric(data.herbs, 0, 0, 10000) : 0;
  player.weapon = numeric(data.weapon, 0, 0, equipment.weapon.length - 1);
  player.armor = numeric(data.armor, 0, 0, equipment.armor.length - 1);
  player.hp = numeric(data.hp, maxHP(), 1, maxHP());
  player.mp = numeric(data.mp, maxMP(), 0, maxMP());
  checkpoint = modern ? numeric(data.checkpoint, chapterOf(player.x), 0, last) : chapterOf(player.x);
  for (const [i, npc] of npcs.entries()) {
    npc.visited = player.party.includes(npc.name) || Boolean(modern ? data.visited?.[i] : data.usedNpcs?.[i]);
  }
  gems.forEach((gem, i) => { gem.on = data.gems?.[i] !== false; });
  shrines.forEach((shrine, i) => { shrine.solved = data.shrines?.[i] === true; });
  enemies.forEach((enemy, i) => {
    const hp = data.enemies?.[i];
    // Old saves used different HP scales. Preserve kills and the fraction remaining.
    const oldMax = enemy.boss ? (enemy.chapter === last ? 490 : 120 + enemy.chapter * 21) :
      (enemy.chapter === 0 ? 30 + enemy.slot * 7 : 70 + enemy.chapter * 12 + enemy.slot * 5);
    if (oldMap && Number.isFinite(hp)) enemy.hp = clamp(Math.ceil(hp / oldMax * enemy.max), 0, enemy.max);
    if (current) enemy.hp = numeric(hp, enemy.max, 0, enemy.max);
    if (data.version === 3 && Number.isFinite(hp) && enemy.chapter < 10) {
      const previousMax = enemy.slot === 7 ? 88 + enemy.chapter * 18 : 24 + enemy.chapter * 6 + enemy.slot * 2;
      enemy.hp = clamp(Math.ceil(hp / previousMax * enemy.max), 0, enemy.max);
    }
  });
  joined = current && data.joined === true;
  returning = current && joined && data.returning === true;
  done = current && returning && data.done === true;
  specialAt = modern ? numeric(Math.ceil(data.special), 0, 0, 15) : 0;
  if (current) {
    for (const trial of trials) if (data.trials?.includes?.(trial.trial)) clearedTrials.add(trial.trial);
    for (const type of ['weapon', 'armor']) {
      const index = data.trialGear?.[type];
      if (clearedTrials.has(index) && trials[index].armor === Number(type === 'armor')) trialGear[type] = index;
    }
  } else {
    // Preserve earlier clears, but leave the new rescue and finale playable.
    for (let chapter = 0; chapter < 9; chapter++) {
      if (!activeEnemies(chapter)[7].hp) activeEnemies(chapter)[6].hp = 0;
    }
    if (player.x >= span * 10 || data.rescued || data.done || !activeEnemies(9)[7].hp) {
      player.x = camps[9].x;
      player.y = 104;
      checkpoint = 9;
      for (const enemy of enemies.filter(enemy => enemy.chapter >= 9)) enemy.hp = enemy.max;
    }
  }
}

function say(text, duration = 4) {
  $('message').textContent = text;
  messageUntil = clock + duration;
}

const held = new Map();
const keys = new Set();
const keyActions = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  Space: 'attack', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyX: 'special'
};
const controls = [...document.querySelectorAll('[data-hold]')];
const pressed = action => keys.has(action) || [...held.values()].includes(action);
function clearInput() {
  keys.clear();
  held.clear();
  controls.forEach(button => { delete button.dataset.held; });
}

function perform(action) {
  if (paused || (mode !== 'field' && mode !== 'battle') || (battle && battle.age < .4)) return;
  if (action === 'attack') swing();
  if (action === 'dodge') dodge();
  if (action === 'special') special();
}

for (const button of controls) {
  const action = button.dataset.hold;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || paused) return;
    event.preventDefault();
    audio.unlock();
    button.setPointerCapture(event.pointerId);
    held.set(event.pointerId, action);
    button.dataset.held = 'true';
    perform(action);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => {
      held.delete(event.pointerId);
      if (!pressed(action)) delete button.dataset.held;
    });
  }
  button.addEventListener('click', event => {
    if (event.detail !== 0 || paused) return;
    if (['left', 'right', 'up', 'down'].includes(action)) {
      movePlayer(Number(action === 'right') - Number(action === 'left'),
        Number(action === 'down') - Number(action === 'up'), 10);
    } else perform(action);
  });
}
window.addEventListener('keydown', event => {
  if (paused || mode === 'title' || mode === 'home' || event.target.matches('input')) return;
  const action = keyActions[event.code];
  if (!action) return;
  if (event.code === 'Space' && event.target.matches('button')) return;
  event.preventDefault();
  if (!event.repeat) {
    keys.add(action);
    perform(action);
  }
});
window.addEventListener('keyup', event => keys.delete(keyActions[event.code]));
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('pointerdown', () => audio.unlock(), {once: true, capture: true});
document.addEventListener('keydown', () => audio.unlock(), {once: true, capture: true});

function fieldTrack() {
  const chapter = chapterOf(player.x);
  if (Math.abs(player.x - camps[chapter].x) < 45) return chapter === 0 ? 'home' : 'village';
  return [1, 3, 6, 9, 11].includes(chapter) ? 'dungeon' : 'field';
}

function panel(title, lines, buttons) {
  clearInput();
  paused = true;
  $('panel').hidden = false;
  $('panel-title').textContent = title;
  $('panel-body').replaceChildren(...lines.map(line => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
  $('panel-buttons').replaceChildren(...buttons.map(([label, callback, disabled]) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.disabled = Boolean(disabled);
    button.onclick = callback;
    return button;
  }));
  $('panel-buttons').querySelector('button:not(:disabled)')?.focus({preventScroll: true});
}
function resume() {
  paused = false;
  $('panel').hidden = true;
  document.activeElement?.blur();
}
function enterField() {
  mode = 'field';
  cat.x = player.x - 18;
  cat.y = player.y;
  audio.setTrack(fieldTrack());
  $('hud').hidden = $('pause').hidden = $('dpad').hidden = $('actions').hidden = false;
  resume();
}
function arriveHome() {
  done = true;
  mode = 'home';
  save();
  audio.setTrack('home');
  $('pause').hidden = $('dpad').hidden = $('actions').hidden = true;
  say('');
  panel('おかえり、ソソ', [
    '一美はソソを胸に抱き、小さな家の扉を開けた。冷えた部屋に灯をともし、残ったパンをふたつに分ける。',
    '世界を救ったソソは、ひざの上でいつものように丸くなった。一美は耳の後ろを撫でた。「ただいま、ソソ」'
  ], [['旅を振り返る', () => {
    enterField();
    say('ソソは伸びをして、また一美の後をついてきた。');
  }]]);
}

function showTitle() {
  const data = storage.read(saveKey);
  const begin = () => {
    audio.setTrack('home');
    panel('小さな家の朝', [
      '貧しい少女、一美の宝物は、古い剣と愛猫ソソ。ふたりは小さな家で、わずかなパンを分け合って暮らしていた。',
      'ある朝、戸口にソソの足跡と荷車の跡だけが残っていた。一美は剣を手に、ソソを取り戻す旅に出る。'
    ], [['街道へ出る', () => { enterField(); save(); }]]);
  };
  const actions = [['はじめから', () => {
    if (!data || confirm('保存済みの冒険を上書きしますか？')) {
      try { localStorage.removeItem(saveKey); } catch {}
      begin();
    }
  }]];
  if (data) actions.unshift(['冒険を再開', () => {
    load(data);
    if (done) arriveHome(); else enterField();
  }]);
  panel('一美のスター街道', [
    '愛猫ソソをさらわれた一美は、十二の土地を越えてソソを探しに行く。',
    '十字キーで移動。剣で敵を倒すか、接触して戦闘へ。キーボードは矢印キー、Space、Shift、X。'
  ], actions);
}

function settings() {
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.value = Math.round(audio.volume * 100);
  volume.oninput = () => updateAudio(Number(volume.value) / 100, audio.muted);
  const label = document.createElement('label');
  label.append('音量 ', volume);
  $('panel-body').append(label);
}
function updateAudio(volume, muted) {
  audio.setVolume(volume, muted);
  $('mute').textContent = muted ? '音を出す' : '消音';
  $('mute').setAttribute('aria-pressed', String(muted));
  storage.write('kazumi-audio', {volume: Math.round(volume * 100), muted});
}
$('mute').onclick = () => {
  audio.unlock();
  updateAudio(audio.volume, !audio.muted);
};
$('mute').textContent = audio.muted ? '音を出す' : '消音';
$('mute').setAttribute('aria-pressed', String(audio.muted));

function openMenu() {
  if (mode !== 'field' && mode !== 'battle') return;
  const actions = [['戻る', resume]];
  if (battle) actions.push(['逃走', escapeBattle], ['薬草を使う', useHerb, !player.herbs || player.hp === maxHP()]);
  else actions.push(
    ['保存', () => { save(true); resume(); }],
    ['装備', shop],
    ['四天王の試練', openTrials, !joined],
    ['薬草を使う', useHerb, !player.herbs || player.hp === maxHP()],
    [returning && !done ? '自宅へ向かう' : '先へ進む', () => { guide(); resume(); }],
    ['最初から', () => {
      if (confirm('このブラウザの冒険を消して、最初から遊びますか？')) {
        try { localStorage.removeItem(saveKey); } catch {}
        location.reload();
      }
    }]
  );
  panel('メニュー', [
    '武器 ' + equipped('weapon').name + '　防具 ' + equipped('armor').name,
    '薬草 ' + player.herbs + '　星の欠片 ' + player.shards,
    '仲間 ' + ([...player.party, ...(joined ? ['ソソ'] : [])].join('、') || 'なし')
  ], actions);
  settings();
}
$('pause').onclick = openMenu;

function useHerb() {
  player.herbs--;
  player.hp = Math.min(maxHP(), player.hp + 35);
  save();
  resume();
  say('薬草でHPを回復した。');
}

function shop() {
  const offers = [['メニューに戻る', openMenu]];
  for (const type of ['weapon', 'armor']) {
    const item = equipment[type][player[type] + 1];
    if (!item) continue;
    offers.push([item.name + '　' + item.cost + 'G', () => {
      player.gold -= item.cost;
      player[type]++;
      trialGear[type] = null;
      save();
      shop();
    }, player.gold < item.cost]);
  }
  for (const index of clearedTrials) {
    const trial = trials[index];
    const type = trial.armor ? 'armor' : 'weapon';
    offers.push([trial.reward.name + 'を装備', () => { trialGear[type] = index; save(); shop(); }, trialGear[type] === index]);
  }
  for (const type of ['weapon', 'armor']) {
    if (trialGear[type] !== null) offers.push([equipment[type][player[type]].name + 'に戻す', () => {
      trialGear[type] = null; save(); shop();
    }]);
  }
  panel('装備を整える', [
    '所持金 ' + player.gold + 'G',
    equipped('weapon').name + '（攻撃 +' + equipped('weapon').bonus + '）',
    equipped('armor').name + '（防御 +' + equipped('armor').bonus + '）'
  ], offers);
}

function openTrials() {
  panel('四天王の試練', ['本編とは独立した闘技場。勝つと限定装備と称号を獲得する。',
    '称号 ' + ([...clearedTrials].map(index => trials[index].title).join('、') || 'なし')
  ], [['メニューに戻る', openMenu], ...trials.map(trial => [trial.name, () => {
    trialVitals = {hp: player.hp, mp: player.mp, herbs: player.herbs, remaining: Math.max(0, specialAt - clock)};
    player.hp = maxHP();
    player.mp = maxMP();
    specialAt = clock;
    encounter({...trial, hp: trial.max, flash: 0}, false);
    resume();
  }])]);
}

function leaveTrial() {
  player.hp = trialVitals.hp;
  player.mp = trialVitals.mp;
  player.herbs = trialVitals.herbs;
  specialAt = clock + trialVitals.remaining;
  trialVitals = null;
  battle = null;
  resetCat();
  enterField();
  fieldSafeUntil = clock + 2.5;
}

function guide() {
  if (returning && !done) {
    destination = {x: 25, y: 104};
    return;
  }
  const chapter = chapterOf(player.x);
  const shrine = shrines[chapter];
  const candidates = [
    ...gems.filter(gem => gem.on && gem.x > player.x && gem.x < shrine.x),
    ...npcs.filter(npc => !npc.visited && npc.x > player.x && npc.x < shrine.x).map(npc => ({x: npc.x, row: 104})),
    ...activeEnemies(chapter).filter(enemy => enemy.hp && !enemy.optional && !enemy.boss &&
      (shrine.solved || enemy.homeX < shrine.x)).map(enemy => ({x: enemy.x, row: enemy.y}))
  ].filter(point => point.x > player.x + 5).sort((a, b) => a.x - b.x);
  const [, , , , , , mid, boss] = activeEnemies(chapter);
  const pending = mid.hp ? mid : boss;
  const target = candidates[0] || (!shrine.solved ? shrine : pending.hp ? {x: pending.x, row: pending.y} : camps[Math.min(last, chapter + 1)]);
  destination = {x: target.x, y: target.row};
}

function openShrine(shrine, chapter) {
  destination = null;
  const [, , clue, ...solution] = chapterInfo[chapter];
  const symbols = [...new Set([...solution, '鈴', '星', '水'])].sort();
  let sequence = [];
  function show(error = '') {
    panel('石碑の封印', [clue, error || '刻んだ印 ' + (sequence.join(' → ') || 'なし')], [
      ...symbols.map(symbol => [symbol, () => {
        sequence.push(symbol);
        if (sequence.length < solution.length) return show();
        if (!sequence.every((entry, i) => entry === solution[i])) {
          sequence = [];
          return show('石碑は反応しない。印を選び直そう。');
        }
        shrine.solved = true;
        resume();
        burstUntil = clock + .45;
        audio.play('special');
        say(chapters[chapter][1], 7);
        save();
      }]),
      ['あとで解く', () => { player.x = shrine.x - 19; resume(); }]
    ]);
  }
  show();
}

function movePlayer(dx, dy, distance) {
  if (!dx && !dy) return;
  if (battle) {
    if (dx) {
      player.facing = {x: Math.sign(dx), y: 0};
      const next = clamp(battle.heroX + dx * distance, 25, 615);
      const crossing = (battle.heroX - battle.enemyX) * (next - battle.enemyX) <= 0;
      battle.heroX = crossing ? battle.enemyX + Math.sign(battle.heroX - battle.enemyX) * 14 : next;
    }
    return;
  }
  const magnitude = Math.hypot(dx, dy);
  player.facing = {x: dx / magnitude, y: dy / magnitude};
  const chapter = chapterOf(player.x);
  const [, , , , , , mid, boss] = activeEnemies(chapter);
  const gate = mid.hp ? mid : boss;
  const boundary = returning ? limit : !shrines[chapter].solved ? shrines[chapter].x + 19 :
    gate.hp ? gate.homeX + 17 : limit;
  player.x = clamp(player.x + player.facing.x * distance, 0, boundary);
  player.y = clamp(player.y + player.facing.y * distance, 44, 162);
}

function swing() {
  if (clock < attackAt) return;
  attackAt = clock + .37;
  swingUntil = clock + .15;
  audio.play('attack');
  if (battle) {
    const distance = battle.enemyX - battle.heroX;
    if (Math.abs(distance) <= 45 && Math.sign(distance) === player.facing.x) {
      const coordinated = joined && battle.link > clock;
      const damage = coordinated ? attackPower() + Math.ceil(catForm().atk * .85) : attackPower();
      if (coordinated) {
        battle.link = 0;
        audio.play('holy');
        say('連携攻撃・星爪斬！', 1.5);
      }
      hurtEnemy(battle.enemy, damage);
    }
    return;
  }
  const chapter = chapterOf(player.x);
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !unlocked(enemy) || enemy.rank === 'major' && enemy.chapter === last) continue;
    const dx = enemy.x - player.x, dy = enemy.y - player.y;
    const forward = dx * player.facing.x + dy * player.facing.y;
    const lateral = Math.abs(dx * player.facing.y - dy * player.facing.x);
    if (forward >= 0 && forward <= 29 && lateral <= 13) hurtEnemy(enemy, attackPower());
  }
}

let dodgeAt = 0;
function dodge() {
  if (clock < dodgeAt) return;
  dodgeAt = clock + .85;
  invulnerableUntil = clock + .27;
  movePlayer(player.facing.x, player.facing.y, battle ? 41 : 21);
}

function special() {
  if (clock < specialAt || player.mp < 10) return;
  const targets = battle ? [battle.enemy] : activeEnemies(chapterOf(player.x)).filter(enemy =>
    enemy.hp && unlocked(enemy) && !(enemy.rank === 'major' && enemy.chapter === last) && Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 105);
  if (!targets.length) return say('近くに敵がいない。');
  const inBattle = Boolean(battle);
  player.mp -= 10;
  specialAt = clock + 15;
  burstUntil = clock + .55;
  audio.play('special');
  const combo = Boolean(battle && joined && cat.hp > 0);
  const ultimate = combo && cat.form === awakening.length - 1 && cat.mp >= 999;
  if (ultimate) cat.mp -= 999;
  if (combo) {
    battle.catEffect = {until: clock + .9, type: ultimate ? 'creation' : 'holy'};
    audio.play(ultimate ? 'creation' : 'holy');
  }
  say(ultimate ? '協力究極必殺技・天地創生！' : combo ? '協力必殺技・双星の誓い！' : 'ソソを思う！');
  for (const enemy of targets) {
    const power = attackPower() * 5 + 30 + Math.min(player.shards, 36);
    const damage = combo ? power + catForm().atk * (ultimate ? 4 : 2) :
      enemy.boss ? Math.min(Math.ceil(enemy.max * .65), power) : enemy.hp;
    hurtEnemy(enemy, damage);
    if (inBattle) break;
  }
  save();
}

function addNumber(text, x, y, color, field = false) {
  numbers.push({text: String(text), x, y, color, field, expires: clock + .7});
}
function hurtEnemy(enemy, damage) {
  if (enemy.rank === 'major' && enemy.chapter === last) {
    const boundary = Math.ceil(enemy.max * (3 - finalPhase(enemy)) / 3);
    enemy.hp = Math.max(boundary, enemy.hp - damage);
    if (boundary && enemy.hp === boundary && battle) {
      battle.pattern = 0;
      battle.strike = null;
      battle.next = clock + 1.15;
      burstUntil = clock + .55;
      audio.play('encounter');
      say('ヴィットリオが変身した。第' + finalPhase(enemy) + '形態！', 3);
    }
  } else enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.flash = clock + .16;
  if (battle) addNumber(damage, battle.enemyX, 174, '#fff29a');
  else addNumber(damage, enemy.x, enemy.y - 14, '#fff29a', true);
  if (enemy.hp) return;
  if (enemy.trial !== undefined) {
    clearedTrials.add(enemy.trial);
    leaveTrial();
    save();
    audio.play('victory');
    panel('試練に勝利した', [enemy.name + 'を討伐した。', '限定装備 ' + enemy.reward.name, '称号 ' + enemy.title],
      [['街道に戻る', resume]]);
    return;
  }
  const oldLevel = level();
  const xp = (enemy.boss ? 44 : 7) + enemy.chapter * (enemy.boss ? 4 : 2);
  const gold = (enemy.boss ? 32 : 6) + enemy.chapter;
  player.xp += xp;
  player.gold += gold;
  player.herbs++;
  if (battle) {
    battle = null;
    resetCat();
    mode = 'field';
    player.facing = {x: 1, y: 0};
    fieldSafeUntil = clock + .9;
    swingUntil = clock;
    numbers.splice(0);
    audio.setTrack(fieldTrack());
  }
  player.hp = enemy.boss ? maxHP() : Math.min(maxHP(), player.hp + 5);
  player.mp = enemy.boss ? maxMP() : Math.min(maxMP(), player.mp + 4);
  audio.play('victory');
  say(enemy.name + 'を倒した。経験値 +' + xp + '　' + gold + 'G　薬草 ×1');
  if (level() > oldLevel) {
    player.hp = maxHP();
    player.mp = maxMP();
    levelUntil = clock + 2;
    audio.play('level');
  }
  if (enemy.rank === 'major' && enemy.chapter === 9 && !joined) {
    joined = true;
    cat.x = player.x - 18;
    cat.y = player.y;
    panel('第10章クリア・ソソが仲間になった', [
      '「気まぐれで私の膝に乗っただけの猫だと思った」アウレリオは檻の鍵を落とした。「だが、あの力を見て、連れ去ることにした」',
      '世界最強のソソは、一美の足もとでおなかを見せた。けれど空の亀裂を見ると、毛を逆立てて一美の隣に並んだ。',
      'ソソは戦闘中に自分で攻撃し、時間が経つと覚醒する。必殺技で二人の力を合わせよう。'
    ], [['一緒に行こう', resume]]);
  }
  if (enemy.rank === 'major' && enemy.chapter === last) {
    returning = true;
    panel('世界に朝が戻った', [
      'ヴィットリオが倒れ、空の亀裂が閉じた。ソソは大きな光をほどき、いつもの小さな猫に戻った。',
      '「世界を救ったんだね、私たち」返事の代わりに、ソソは一美の靴ひもにじゃれた。'
    ], [['自宅へ向かう', () => { guide(); resume(); }], ['歩いて帰る', resume]]);
  }
  save();
}

function hurtPlayer(power) {
  if (clock < invulnerableUntil) return;
  const damage = Math.max(1, power - defense());
  player.hp = Math.max(0, player.hp - damage);
  flashUntil = clock + .2;
  invulnerableUntil = clock + .22;
  audio.play('hit');
  addNumber(damage, battle.heroX, 190, '#ff9a9a');
  if (!player.hp) panel('一美は倒れた', ['道中の戦果は残る。野営地で休んでから、ソソを探しに行こう。'], [
    ['野営地に戻る', () => {
      if (trialVitals) {
        leaveTrial();
        save();
        return;
      }
      battle = null;
      resetCat();
      player.x = camps[checkpoint].x;
      player.y = 104;
      player.hp = maxHP();
      player.mp = maxMP();
      fieldSafeUntil = clock + 1.5;
      enterField();
      save();
    }]
  ]);
}

function encounter(enemy, ambush) {
  destination = null;
  clearInput();
  resetCat();
  battle = {
    enemy, heroX: 163, enemyX: 447, age: 0, next: 0, strike: null, pattern: 0,
    ambush, damageFlash: 0, catX: 130, catNext: 0, catStrikes: 0, catEffect: null, link: 0, burn: null, slowedUntil: 0
  };
  mode = 'battle';
  player.facing = {x: 1, y: 0};
  swingUntil = clock;
  invulnerableUntil = clock;
  audio.play('encounter');
  audio.setTrack(enemy.boss ? 'boss' : 'battle');
  say(ambush ? '背後から接触された！ 敵の先制攻撃。' : enemy.name + 'と遭遇した。');
}

function escapeBattle() {
  if (trialVitals) {
    leaveTrial();
    save();
    say('試練から離脱した。');
    return;
  }
  const enemy = battle.enemy;
  const left = player.x <= enemy.x;
  player.x = clamp(enemy.x + (left ? -67 : 67), enemy.chapter * span, (enemy.chapter + 1) * span - 1);
  if (enemy.boss) player.x = Math.min(player.x, enemy.homeX - 55);
  player.y = enemy.y < 104 ? 146 : 62;
  battle = null;
  resetCat();
  numbers.splice(0);
  fieldSafeUntil = clock + 2.5;
  enterField();
  save();
  say('戦闘から離脱した。');
}

function resetCat() {
  cat.form = 0;
  cat.hp = catForm().hp;
  cat.mp = catForm().mp;
}

function finalPhase(enemy) {
  if (enemy.hp <= Math.ceil(enemy.max / 3)) return 3;
  return enemy.hp <= Math.ceil(enemy.max * 2 / 3) ? 2 : 1;
}

function updateCat(dt) {
  const next = awakening[cat.form + 1];
  if (next && battle.age + 1e-8 >= next.turn * 5) {
    const previous = catForm();
    cat.hp = Math.round(cat.hp * next.hp / previous.hp);
    cat.mp = Math.round(cat.mp * next.mp / previous.mp);
    cat.form++;
    battle.catEffect = {until: clock + 1.1, type: 'awakening'};
    audio.play('awake' + cat.form);
    say('ソソが第' + (cat.form + 1) + '形態・' + next.name + 'に覚醒！', 3);
    if (cat.form === 5) audio.setTrack('genesis');
  }
  if (battle.burn && clock >= battle.burn.at) {
    const damage = battle.burn.damage;
    battle.burn = null;
    hurtEnemy(battle.enemy, damage);
    if (!battle || paused) return;
  }
  if (!cat.hp) return;
  const form = catForm();
  const distance = battle.enemyX - battle.catX;
  const reach = [25, 45, 64, 78, 110, 150][cat.form];
  if (Math.abs(distance) > reach) {
    battle.catX += Math.sign(distance) * Math.min(Math.abs(distance) - reach, form.speed * dt);
    return;
  }
  if (clock < battle.catNext) return;
  const holy = ++battle.catStrikes % 4 === 0 && cat.mp >= 80;
  if (holy) {
    cat.mp -= 80;
    cat.hp = Math.min(form.hp, cat.hp + Math.ceil(form.hp * .1));
    player.hp = Math.min(maxHP(), player.hp + 12);
    audio.play('holy');
    say('ソソの神聖魔法・星祈。ふたりのHPが回復！', 1.4);
  }
  battle.catEffect = {until: clock + (holy ? .65 : .32), type: holy ? 'holy' : 'strike'};
  battle.catNext = clock + [1.32, 1.2, 1.16, 1.14, 1.06, 1][cat.form];
  battle.link = clock + .95;
  const resistant = battle.enemy.trial !== undefined || battle.enemy.chapter >= 10 && battle.enemy.boss;
  const base = form.atk * (resistant ? .35 : 1);
  let damage = Math.ceil(base * (holy ? 1.5 : 1));
  if (!holy && cat.form === 1) {
    // Wind lands a second, lighter hit.
    hurtEnemy(battle.enemy, Math.ceil(base * .35));
    if (!battle || paused) return;
    damage = Math.ceil(base * .8);
  }
  if (!holy && cat.form === 2) battle.burn = {at: clock + .55, damage: Math.ceil(base * .35)};
  if (!holy && cat.form === 3) battle.slowedUntil = clock + .65;
  if (!holy && cat.form === 4 && battle.strike) damage += Math.ceil(base * .45);
  if (!holy && cat.form === 5) damage += Math.ceil(base * .3);
  hurtEnemy(battle.enemy, damage);
}

function updateBattle(dt) {
  const {enemy} = battle;
  battle.age += dt;
  if (battle.age < .4) return;
  if (battle.ambush) {
    battle.ambush = false;
    hurtPlayer(enemy.power);
    if (paused) return;
  }
  if (joined) updateCat(dt);
  if (!battle || paused) return;
  const strike = battle.strike;
  if (strike) {
    if (clock < strike.at) return;
    const distance = battle.heroX - battle.enemyX;
    if (joined && cat.hp > 0 && clock >= invulnerableUntil &&
        (strike.wave || Math.abs(battle.catX - battle.enemyX) <= strike.range)) {
      const damage = Math.max(240, strike.power * (enemy.trial !== undefined ? 132 : 90) - catForm().def);
      cat.hp = Math.max(0, cat.hp - damage);
      addNumber(damage, battle.catX, 209, '#ff9a9a');
    }
    if (strike.wave || (Math.sign(distance) === strike.direction && Math.abs(distance) <= strike.range + 5)) {
      hurtPlayer(strike.power);
    }
    battle.damageFlash = clock + .17;
    battle.strike = null;
    battle.next = clock + enemy.interval;
    return;
  }
  const distance = battle.heroX - battle.enemyX;
  const direction = Math.sign(distance) || -1;
  const enraged = enemy.boss && enemy.hp <= enemy.max / 2;
  const final = enemy.rank === 'major' && enemy.chapter === last;
  const phase = final ? finalPhase(enemy) : 1;
  const sequence = enemy.pattern || (final ? [['bite', 'slow'], ['rush', 'wave'], ['wave', 'rush', 'wave']][phase - 1] :
    enemy.rank === 'mid' ? ['slow', 'bite'] : bossPatterns[enemy.chapter]);
  const pattern = enemy.boss ? sequence[battle.pattern % sequence.length] : 'bite';
  const move = attackPatterns[pattern];
  const wave = pattern === 'wave' && (phase === 3 || enemy.trial !== undefined);
  const range = enemy.range + move.reach;
  if ((!wave && Math.abs(distance) > range) || clock < battle.next) {
    if (Math.abs(distance) > range - 3) {
      battle.enemyX += direction * Math.min(enemy.speed * dt * (enraged ? 1.35 : 1) * (clock < battle.slowedUntil ? .55 : 1), Math.abs(distance) - 14);
    }
    return;
  }
  const label = wave ? '星砕き・全域' : move.label;
  battle.strike = {
    label, direction, range, wave, at: clock + move.lead,
    power: enemy.power + move.extra + (phase - 1) * 8
  };
  battle.pattern++;
  if (enemy.boss) say(label + 'の構え。回避でかわそう。', 1.5);
}

const closeTo = (x, y, radius) => Math.hypot(player.x - x, player.y - y) < radius;

function updateField(dt) {
  const chapter = chapterOf(player.x);
  if (joined) {
    const dx = player.x - cat.x, dy = player.y - cat.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 20) {
      const step = Math.min(gap - 20, dt * (destination && returning ? 415 : 120));
      cat.x += dx / gap * step;
      cat.y += dy / gap * step;
    }
  }
  if (chapter !== currentChapter) {
    currentChapter = chapter;
    if (!returning && chapter > checkpoint) {
      checkpoint = chapter;
      player.hp = maxHP();
      player.mp = maxMP();
      save();
    }
    say(returning ? 'ソソと並んで、家を目指す。' : chapters[chapter][0], 6);
  }
  audio.setTrack(fieldTrack());
  if (returning && !done && closeTo(25, 104, 14)) return arriveHome();
  for (const npc of npcs) {
    if (npc.visited || !closeTo(npc.x, 104, 13)) continue;
    npc.visited = true;
    if (npc !== npcs[0]) player.party.push(npc.name);
    say(npc.name + ' ' + npc.line + (npc === npcs[0] ? '' : '　仲間に加わった。'));
    save();
  }
  for (const gem of gems) {
    if (!gem.on || !closeTo(gem.x, gem.row, 11)) continue;
    gem.on = false;
    player.shards++;
    player.mp = Math.min(maxMP(), player.mp + 6);
    say('星の欠片を拾った。MPが回復した。');
    save();
  }
  const shrine = shrines[chapter];
  if (!returning && !shrine.solved && closeTo(shrine.x, shrine.row, 10)) return openShrine(shrine, chapter);
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !unlocked(enemy) || (returning && !done)) continue;
    const dx = player.x - enemy.x, dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const leash = enemy.boss ? 16 : enemy.optional ? 33 : 42;
    const chase = clock >= fieldSafeUntil && distance < (enemy.boss ? 36 : 73) &&
      Math.hypot(player.x - enemy.homeX, player.y - enemy.homeY) < leash + 32;
    if (!chase) {
      const roam = enemy.boss ? 5 : 15;
      const aim = enemy.homeX + Math.sin(clock * .9 + enemy.slot) * roam;
      enemy.x += clamp(aim - enemy.x, -dt * 20, dt * 20);
      enemy.y += clamp(enemy.homeY - enemy.y, -dt * 18, dt * 18);
    } else if (distance > 0) {
      const speed = enemy.speed * .53 * dt;
      enemy.x = clamp(enemy.x + dx / distance * speed, enemy.homeX - leash, enemy.homeX + leash);
      enemy.y = clamp(enemy.y + dy / distance * speed, enemy.homeY - leash, enemy.homeY + leash);
    }
    if (clock < fieldSafeUntil || clock < invulnerableUntil || !closeTo(enemy.x, enemy.y, 11)) continue;
    const rear = (enemy.x - player.x) * player.facing.x + (enemy.y - player.y) * player.facing.y < -3;
    encounter(enemy, rear);
    break;
  }
}

function update(dt) {
  if (paused || (mode !== 'field' && mode !== 'battle')) return;
  clock += dt;
  if (messageUntil && clock >= messageUntil) {
    messageUntil = 0;
    $('message').textContent = '';
  }
  while (numbers.length && numbers[0].expires <= clock) numbers.shift();
  if (battle && battle.age < .4) {
    updateBattle(dt);
    return;
  }
  const dx = Number(pressed('right')) - Number(pressed('left'));
  const dy = Number(pressed('down')) - Number(pressed('up'));
  if (dx || (!battle && dy)) {
    destination = null;
    movePlayer(dx, dy, dt * (battle ? 142 : 79));
  } else if (!battle && destination) {
    const x = destination.x - player.x;
    const y = destination.y - player.y;
    const distance = Math.hypot(x, y);
    if (distance < 1) destination = null;
    else movePlayer(x, y, Math.min(distance, dt * (returning ? 390 : 83)));
  }
  if (pressed('attack')) swing();
  if (paused) return;
  if (battle) updateBattle(dt);
  else updateField(dt);
}

function updateUI() {
  const chapter = chapterOf(player.x);
  $('location').textContent = trialVitals ? '四天王の闘技場' : mode === 'home' ? '一美の家' : '第' + (chapter + 1) + '章　' + chapterInfo[chapter][0];
  $('vitals').textContent = 'Lv.' + level() + '　HP ' + player.hp + '/' + maxHP() + '　MP ' + player.mp + '/' + maxMP();
  $('progress').textContent = '経験値 ' + player.xp + '/' + nextXp() + '（あと' + (nextXp() - player.xp) + '）　' + player.gold + 'G　攻' + attackPower() + ' / 防' + defense();
  $('enemy-status').hidden = !battle;
  if (battle) {
    $('enemy-status').textContent = battle.enemy.name + '　HP ' + battle.enemy.hp + '/' + battle.enemy.max +
      (battle.enemy.rank === 'major' && battle.enemy.chapter === last ? '　第' + finalPhase(battle.enemy) + '形態' : '') +
      (battle.strike ? '　⚠ ' + battle.strike.label : '');
  }
  $('awakening').hidden = !battle || !joined;
  if (battle && joined) {
    const next = awakening[cat.form + 1];
    const elapsed = Math.max(0, battle.age);
    const from = catForm().turn * 5;
    $('awake-gauge').max = next ? next.turn * 5 - from : 1;
    $('awake-gauge').value = next ? elapsed - from : 1;
    $('soso-status').textContent = 'ソソ 第' + (cat.form + 1) + '形態・' + catForm().name +
      '　Lv.99 HP ' + cat.hp + '/' + catForm().hp + ' MP ' + cat.mp + '/' + catForm().mp + (next ? '　覚醒まで ' + Math.max(0, Math.ceil(next.turn * 5 - elapsed)) + '秒' : '　覚醒完了');
  }
  const remaining = Math.ceil(specialAt - clock);
  const skill = battle && joined && cat.hp > 0 ? (cat.form === 5 && cat.mp >= 999 ? '天地創生' : '双星の誓い') : 'ソソを思う';
  $('special').textContent = remaining > 0 ? skill + ' ' + remaining + '秒' : skill + ' · MP10';
  $('special').disabled = remaining > 0 || player.mp < 10;
  $('level').textContent = clock < levelUntil ? 'レベルアップ！ Lv.' + level() : '';
  $('fade').dataset.active = String(Boolean(battle && battle.age < .18));
}

showTitle();
