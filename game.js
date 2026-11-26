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
let swingKind = 'ground';
let bladeChain = 0;
let chainUntil = 0;
let jumpHeight = 0;
let jumpVelocity = 0;
let jumps = 0;
let magicAt = 0;
let glow = null;
let ring = false;
let slashBase = null;
let shotGear = 'star';
let quizOpen = false;
let shrineDefeated = false;
let sealEffect = null;
let invulnerableUntil = 0;
let fieldSafeUntil = 0;
let flashUntil = 0;
let levelUntil = 0;
let burstUntil = 0;
let victoryUntil = 0;
let defeatedFoe = null;
let messageUntil = 0;
const numbers = [];
const level = () => 1 + Math.floor(Math.sqrt(player.xp / 25));
const nextXp = () => level() ** 2 * 25;
const maxHP = () => 100 + (level() - 1) * 13;
const maxMP = () => 30 + (level() - 1) * 4;
const attackPower = () => 10 + (level() - 1) * 3 + equipped('weapon').bonus + (townSeconds < innBuffUntil ? 4 : 0) + (player.party.includes('一郎') ? 2 : 0);
const defense = () => 5 + (level() - 1) * 2 + equipped('armor').bonus + (player.party.includes('クルミ') ? 1 : 0);
function equipped(type) {
  if (type === 'weapon' && slashBase !== null) return equipment.weapon[slashBase];
  return prefectures[regionalGear[type]]?.[type] || trials[trialGear[type]]?.reward || equipment[type][player[type]];
}
const activeEnemies = chapter => enemies.slice(chapter * 8, chapter * 8 + 8);
const unlocked = enemy => !enemy.boss || (shrines[enemy.chapter].solved &&
  (enemy.rank === 'mid' || activeEnemies(enemy.chapter)[6].hp === 0));

const prefs = storage.read('kazumi-audio');
audio.setVolume(numeric(prefs?.volume, 45, 0, 100) / 100, prefs?.muted === true);
audio.setMix(numeric(prefs?.music, 85, 0, 100) / 100, numeric(prefs?.effects, 80, 0, 100) / 100);

function save(explicit = false) {
  if (trialVitals) return false;
  const success = storage.write(saveKey, {
    version: 9, actionEquipment:{slashBase,shotGear}, trailCaches:[...trailCaches], inn:innSnapshot(), tourism: tourismSnapshot(), town: townSnapshot(), x: player.x, y: player.y, hp: player.hp, mp: player.mp,
    xp: player.xp, gold: player.gold, shards: player.shards, herbs: player.herbs,
    weapon: player.weapon, armor: player.armor, party: player.party, companions: [...companions.values()], checkpoint,
    visited: npcs.map(npc => Boolean(npc.visited)), gems: gems.map(gem => gem.on),
    enemies: enemies.map(enemy => enemy.hp), shrines: shrines.map(shrine => shrine.solved),
    riddleProgress: shrines.map(shrine => [shrine.questionId ?? null, shrine.wrong ?? 0]), shrineDefeated,
    special: Math.max(0, specialAt - clock), joined, returning, done,
    trials: [...clearedTrials], trialGear, ring, pots: pots.map(pot => pot.broken)
  });
  if (explicit) say(success ? 'このブラウザに冒険を保存した。' : 'このブラウザでは保存できません。');
  return success;
}

function load(data) {
  if (!data || typeof data !== 'object') return;
  const current = [4, 5, 6, 7, 8, 9].includes(data.version);
  ring = [5, 6, 7, 8, 9].includes(data.version) && data.ring === true;
  pots.forEach((pot, i) => { pot.broken = [5, 6, 7, 8, 9].includes(data.version) && data.pots?.[i] === true; });
  const modern = current || data.version === 3;
  const oldMap = data.version === 2;
  player.xp = numeric(data.xp, 0, 0, 1000000);
  restoreCompanions(data);
  player.shards = numeric(modern ? data.shards : data.art, 0, 0, 100000);
  player.x = modern || oldMap ? numeric(data.x, 25, 0, limit) : 25;
  player.y = modern || oldMap ? numeric(data.y, 104, fieldTop, fieldBottom) : 104;
  if (waterBlocks(player.x, player.y)) player.y = 54;
  if (!data.town?.room && fieldBarrier(player.x,player.y)) player.y = player.y < 104 ? 56 : 146;
  if (Array.isArray(data.trailCaches)) {
    for (const index of data.trailCaches) if (Number.isInteger(index) && index >= 0 && index <= last) trailCaches.add(index);
  }
  player.gold = modern ? numeric(data.gold, 0, 0, bankLimit) : Math.floor(player.xp / 3);
  player.herbs = modern ? numeric(data.herbs, 0, 0, 10000) : 0;
  player.weapon = numeric(data.weapon, 0, 0, equipment.weapon.length - 1);
  player.armor = numeric(data.armor, 0, 0, equipment.armor.length - 1);
  slashBase = Number.isInteger(data.actionEquipment?.slashBase) ?
    clamp(data.actionEquipment.slashBase,0,player.weapon) : null;
  shotGear = ring && data.actionEquipment?.shotGear === 'ring' ? 'ring' : 'star';
  player.hp = numeric(data.hp, maxHP(), 1, maxHP());
  player.mp = numeric(data.mp, maxMP(), 0, maxMP());
  checkpoint = modern ? numeric(data.checkpoint, chapterOf(player.x), 0, last) : chapterOf(player.x);
  for (const [i, npc] of npcs.entries()) {
    npc.visited = player.party.includes(npc.name) || Boolean(modern ? data.visited?.[i] : data.usedNpcs?.[i]);
  }
  gems.forEach((gem, i) => { gem.on = data.gems?.[i] !== false; });
  shrineDefeated = data.shrineDefeated === true;
  shrines.forEach((shrine, i) => {
    shrine.solved = data.shrines?.[i] === true;
    const progress = data.riddleProgress?.[i];
    const question = riddlesById.get(progress?.[0]);
    if (question && question.id.startsWith(shrineTier(i) + '-')) {
      shrine.questionId = question.id;
      shrine.wrong = numeric(progress[1], 0, 0, 999);
    }
  });
  enemies.forEach((enemy, i) => {
    const hp = data.enemies?.[i];
    // Old saves used different HP scales. Preserve kills and the fraction remaining.
    const oldMax = enemy.boss ? (enemy.chapter === originalFinal ? 490 : 120 + enemy.chapter * 21) :
      (enemy.chapter === 0 ? 30 + enemy.slot * 7 : 70 + enemy.chapter * 12 + enemy.slot * 5);
    if (oldMap && Number.isFinite(hp)) enemy.hp = clamp(Math.ceil(hp / oldMax * enemy.max), 0, enemy.max);
    if (current) enemy.hp = numeric(hp, enemy.max, 0, enemy.max);
    if (data.version === 3 && Number.isFinite(hp) && enemy.chapter < 10) {
      const previousMax = enemy.slot === 7 ? 88 + enemy.chapter * 18 : 24 + enemy.chapter * 6 + enemy.slot * 2;
      enemy.hp = clamp(Math.ceil(hp / previousMax * enemy.max), 0, enemy.max);
    }
  });
  joined = current && data.joined === true;
  returning = data.version === 9 && joined && data.returning === true;
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
  loadTowns(data.town);
  loadInn(data.inn);
  loadTourism(data.tourism);
  if (data.version !== 9) {
    for (let chapter = 0; chapter <= Math.min(originalFinal, checkpoint); chapter++) tourismFor(chapter).visited = true;
    if (current && data.done && activeEnemies(originalFinal).at(-1).hp === 0) {
      tourismFor(originalFinal).visited = true;
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
  Space: 'attack', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyX: 'shot', KeyZ: 'jump', KeyC: 'shot', KeyQ: 'guard', KeyV: 'dash', KeyF: 'crouch'
};
const controls = [...document.querySelectorAll('[data-hold]')];
const attackButton = document.querySelector('[data-hold=attack]');
const joystick = {id:null,x:0,y:0};
function resetJoystick() {
  joystick.id = null;
  joystick.x = joystick.y = 0;
  $('stick-knob').style.transform = 'translate(-50%, -50%)';
}
function tiltJoystick(event) {
  const box = $('joystick').getBoundingClientRect();
  const x = (event.clientX - box.left - box.width / 2) / (box.width * .33);
  const y = (event.clientY - box.top - box.height / 2) / (box.height * .33);
  const length = Math.hypot(x,y);
  joystick.x = length < .13 ? 0 : x / Math.max(1,length);
  joystick.y = length < .13 ? 0 : y / Math.max(1,length);
  $('stick-knob').style.transform = 'translate(-50%, -50%) translate(' + joystick.x * box.width * .27 +
    'px, ' + joystick.y * box.height * .27 + 'px)';
}
$('joystick').onpointerdown = event => {
  if (!movementAllowed() || joystick.id !== null || event.button !== 0) return;
  event.preventDefault();
  audio.unlock();
  joystick.id = event.pointerId;
  event.currentTarget.setPointerCapture(event.pointerId);
  tiltJoystick(event);
};
$('joystick').onpointermove = event => {
  if (event.pointerId === joystick.id) tiltJoystick(event);
};
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  $('joystick').addEventListener(type, event => {
    if (event.pointerId === joystick.id) resetJoystick();
  });
}
const pressed = action => keys.has(action) || [...held.values()].includes(action) || action === 'crouch' && touchCrouch;
function clearInput(keepMovement = false) {
  for (const key of keys) {
    if (!keepMovement || !['left','right','up','down'].includes(key)) keys.delete(key);
  }
  held.clear();
  chargeStarted = null;
  bDashUsed = false;
  touchCrouch = false;
  if (!keepMovement) resetJoystick();
  controls.forEach(button => { delete button.dataset.held; });
}

function perform(action) {
  if (!movementAllowed() || interior && !['jump','attack'].includes(action)) return;
  if (action === 'attack') beginCharge();
  if (action === 'dash') beginDash();
  if (action === 'dodge') dodge();
  if (action === 'jump') {
    if (playableInput().y > .57 && jumpHeight <= floorUnderHero() + 4) {
      touchCrouch = true;
    } else if (pressed('attack') && jumpHeight > floorUnderHero() + 4) {
      bDashUsed = true;
      beginDash();
    } else jump();
  }
  if (action === 'shot') useShot();
}

for (const button of controls) {
  const action = button.dataset.hold;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !movementAllowed()) return;
    event.preventDefault();
    audio.unlock();
    button.setPointerCapture(event.pointerId);
    held.set(event.pointerId, action);
    button.dataset.held = 'true';
    perform(action);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => {
      if (!held.delete(event.pointerId)) return;
      if (!pressed(action)) {
        delete button.dataset.held;
        if (action === 'jump') touchCrouch = false;
        if (action === 'attack') {
          if (type === 'pointerup') endCharge();
          else chargeStarted = null;
        }
      }
    });
  }
  button.addEventListener('click', event => {
    if (event.detail !== 0 || !movementAllowed()) return;
    if (action === 'attack') swing();
    else perform(action);
  });
}
window.addEventListener('keydown', event => {
  if (event.code === 'KeyE' && !event.repeat) townInteraction();
  if (!movementAllowed() || event.target.matches('input, select, textarea')) return;
  const action = keyActions[event.code];
  if (!action) return;
  if (event.code === 'Space' && event.target.matches('button')) return;
  event.preventDefault();
  if (!event.repeat) {
    keys.add(action);
    perform(action);
  }
});
window.addEventListener('keyup', event => {
  const action = keyActions[event.code];
  if (keys.delete(action)) {
    if (action === 'attack' && !pressed('attack')) endCharge();
    if (action === 'jump' && !pressed('jump')) touchCrouch = false;
  }
});
window.addEventListener('blur', () => clearInput());
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('pointerdown', () => audio.unlock(), {once: true, capture: true});
document.addEventListener('keydown', () => audio.unlock(), {once: true, capture: true});

function fieldTrack() {
  if (interior) return interior.site.kind === 'inn' ? 'innEntry' :
    interior.site.kind === 'regional' ? 'dungeon' : 'town' + interior.site.chapter;
  const chapter = chapterOf(player.x);
  if (player.x - chapter * span >= 0 && player.x - chapter * span < 355) return 'town' + chapter;
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
  decoratePanel(title);
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
  companionTrail.x = player.x - 24;
  companionTrail.y = player.y;
  cat.x = player.x - 18;
  cat.y = player.y;
  audio.setTrack(fieldTrack());
  $('hud').hidden = $('pause').hidden = $('actions').hidden = false;
  resume();
}
function arriveHome() {
  done = true;
  mode = 'home';
  save();
  audio.setTrack('home');
  $('pause').hidden = $('actions').hidden = true;
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
    if (done) arriveHome();
    else {
      enterField();
      if (innPending) resumeInn();
      if (shrineDefeated) {
        player.hp = 0;
        defeat('一美は倒れた', '石碑の反動で一美は力尽きた。');
      }
    }
  }]);
  panel('一美のスター街道', [
    '愛猫ソソをさらわれた一美は、やがて47都道府県を巡る旅に出る。',
    'スティックか矢印キーで移動。剣を長押しして移動するとダッシュ。下を向いてジャンプボタンを押し続けるとしゃがむ。キーボードはSpaceで剣、Zでジャンプ、Cで魔法、Eで調べる。'
  ], actions);
}

function settings() {
  for (const [title, id] of [['BGM','musicVolume'], ['効果音','effectsVolume']]) {
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '100';
    volume.value = Math.round(audio[id] * 100);
    volume.oninput = () => {
      audio[id] = Number(volume.value) / 100;
      audio.setMix(audio.musicVolume, audio.effectsVolume);
      updateAudio(audio.volume, audio.muted);
    };
    const label = document.createElement('label');
    label.append(title + ' ', volume);
    $('panel-body').append(label);
  }
  const sound = document.createElement('button');
  const reflect = () => {
    sound.textContent = audio.muted ? '音を出す' : '消音';
    sound.setAttribute('aria-pressed',String(audio.muted));
  };
  sound.onclick = () => {
    audio.unlock();
    updateAudio(audio.volume,!audio.muted);
    reflect();
  };
  reflect();
  $('panel-body').append(sound);
  graphicsSettings();
}
function updateAudio(volume, muted) {
  audio.setVolume(volume, muted);
  storage.write('kazumi-audio', {volume:Math.round(volume * 100), muted,
    music:Math.round(audio.musicVolume * 100), effects:Math.round(audio.effectsVolume * 100)});
}
function openMenu() {
  if (innScene || doorTransition || quizOpen || shrineDefeated) return;
  if (battle && (!player.hp || joined && !cat.hp)) return;
  if (mode !== 'field' && mode !== 'battle') return;
  const actions = [['戻る', resume], ['斬撃・魔法の装備', actionEquipment]];

  if (battle) actions.push(['逃走', escapeBattle], ['薬草を使う', useHerb, !player.herbs || player.hp === maxHP()]);
  else if (interior) actions.push(['保存', () => { save(true); resume(); }], ['施設の案内', servicePanel,
    Math.hypot(interior.x - 320, interior.y - 100) > 66]);
  else actions.push(
    ['全国手帳', travelBook],
    ['観光案内', tourPanel, !nearScenicSpot()],
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
    nearTavern() || battle ? '' : '酒場のある街では建物の扉から入れる。',
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
      if (type === 'weapon') slashBase = null;
      trialGear[type] = null;
      regionalGear[type] = null;
      save();
      shop();
    }, player.gold < item.cost]);
  }
  if (!ring) offers.push([starterRing.name + '　' + starterRing.cost + 'G', () => {
    player.gold -= starterRing.cost;
    ring = true;
    save();
    shop();
  }, player.gold < starterRing.cost]);
  for (const index of clearedTrials) {
    const trial = trials[index];
    const type = trial.armor ? 'armor' : 'weapon';
    offers.push([trial.reward.name + 'を装備', () => { trialGear[type] = index; regionalGear[type] = null; if (type === 'weapon') slashBase = null; save(); shop(); }, trialGear[type] === index]);
  }
  for (const type of ['weapon', 'armor']) {
    if (trialGear[type] !== null || regionalGear[type] !== null) offers.push([equipment[type][player[type]].name + 'に戻す', () => {
      trialGear[type] = null; regionalGear[type] = null; if (type === 'weapon') slashBase = null; save(); shop();
    }]);
  }
  panel('装備を整える', [
    '所持金 ' + player.gold + 'G　指輪 ' + (ring ? starterRing.name : 'なし'),
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

function openShrine(shrine, chapter, optional) {
  if (shrine.solved) return;
  destination = null;
  quizOpen = true;
  const question = shrineQuestion(shrine, chapter);
  save();
  function close() {
    quizOpen = false;
    delete $('panel').dataset.quiz;
    resume();
  }

  function show(damage = 0) {
    const wrong = shrine.wrong ?? 0;
    const companion = currentCompanion();
    const helper = companion?.name ?? (joined ? 'ソソ' : null);
    const lines = [question.prompt];
    if (wrong >= 3) lines.push('ヒント　' + question.hint);
    if (helper && (wrong === 3 || (chapter + wrong) % 3 === 0)) {
      lines.push(helper === 'ソソ' ? 'ソソが足もとで鳴いた。' :
        helper + (wrong === 3 ? '「ヒントを手がかりに、四つの答えを見比べよう」' : '「焦らなくていいよ。ゆっくり考えよう」'));
    }
    panel(optional?.title ?? '石碑のなぞなぞ', lines, [
      ...riddleChoices(question).map(choice => [choice, () => {
        if (choice === question.answer) {
          shrine.solved = true;
          shrine.wrong = 0;
          if (!optional) sealEffect = {x: shrine.x, y: shrine.row, until: clock + .9};
          close();
          audio.play('seal');
          if (optional) optional.success();
          else say('正解！ 封印が解除された。' + chapters[chapter][1], 7);
          save();
          return;
        }
        shrine.wrong = Math.min(999, wrong + 1);
        const penalty = Math.max(1, Math.ceil(maxHP() * .1));
        player.hp = Math.max(0, player.hp - penalty);
        audio.play('hit');
        $('quiz-flash').getAnimations().forEach(animation => animation.cancel());
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          $('quiz-flash').animate([{opacity: .65}, {opacity: 0}], {duration: 420});
        }
        if (!player.hp) {
          quizOpen = false;
          delete $('panel').dataset.quiz;
          shrineDefeated = true;
          save();
          defeat('一美は倒れた', '不正解　−' + penalty + ' HP。石碑の反動で一美は力尽きた。');
          return;
        }
        save();
        show(penalty);
      }]),
      ['あとで解く', () => {
        if (!optional) player.x = shrine.x - 19;
        close();
        optional?.later();
        save();
      }]
    ]);
    $('panel').dataset.quiz = 'true';
    if (damage) {
      const feedback = document.createElement('p');
      feedback.className = 'quiz-damage';
      feedback.setAttribute('role', 'status');
      feedback.textContent = '不正解　−' + damage + ' HP';
      $('panel-body').append(feedback);
    }
  }
  show();
}

function movePlayer(dx, dy, distance) {
  if (interior) return moveInRoom(dx, dy, distance);
  if (!dx && !dy) return;
  if (battle) {
    player.facing = directionTo(dx, dy, player.facing);
    const underBoss = battle.body.size >= 4.5 && (pressed('crouch') || dashMotion);
    moveArena('hero', dx, dy, distance, underBoss ? [] : [enemyBlocker()]);
    return;
  }
  const magnitude = Math.hypot(dx, dy);
  player.facing = {x: dx / magnitude, y: dy / magnitude};
  const chapter = chapterOf(player.x);
  const [, , , , , , mid, boss] = activeEnemies(chapter);
  const gate = mid.hp ? mid : boss;
  const boundary = returning ? limit : !shrines[chapter].solved ? shrines[chapter].x + 19 :
    gate.hp ? gate.homeX + 17 : limit;
  const nextX = clamp(player.x + player.facing.x * distance, 0, boundary);
  const nextY = clamp(player.y + player.facing.y * distance, fieldTop, fieldBottom);
  const blockedX = nextX !== player.x && !fieldStepClear(player.x,player.y,nextX,player.y);
  if (!blockedX) player.x = nextX;
  const blockedY = nextY !== player.y && !fieldStepClear(player.x,player.y,player.x,nextY);
  if (!blockedY) player.y = nextY;
  if (wallKickUntil <= clock) {
    const xWall = blockedX && surfacesAt(nextX,player.y).some(surface => surface.height > jumpHeight);
    const yWall = blockedY && surfacesAt(player.x,nextY).some(surface => surface.height > jumpHeight);
    if (xWall || yWall) {
      wallContact = {x:xWall ? -Math.sign(dx) : 0,y:yWall ? -Math.sign(dy) : 0};
      wallGraceUntil = clock + .20;
    } else if (wallGraceUntil <= clock) wallContact = null;
  }
}

function resetJump() {
  jumpHeight = jumpVelocity = jumps = 0;
  resetMovement();
}

function jump() {
  if (pressed('crouch')) return;
  if (wallContact && jumpHeight > 8 && wallKickUntil <= clock && wallGraceUntil > clock && !climbing) {
    wallKickUntil = clock + .17;
    jumpVelocity = 225;
    jumps = 1;
    airDashUsed = false;
  } else {
    if (jumps >= 2) return;
    climbing = false;
    jumps++;
    jumpVelocity = (jumps === 1 ? 209 : 194) + (runBlend > .4 ? 26 : 0);
  }
  groundedOn = null;
  audio.play('jump');
}

function updateJump(dt) {
  if (climbing) return;
  const isAir = jumpHeight > 0 || jumps > 0;
  if (!isAir) return;
  const usable = !interior && !battle ? surfacesAt(player.x,player.y).filter(surface => surface.height <= jumpHeight + .35) : [];
  const floor = usable.reduce((top,surface) => !top || surface.height > top.height ? surface : top,null);
  const base = floor?.height ?? 0;
  const previous = jumpHeight;
  jumpHeight += jumpVelocity * dt;
  jumpVelocity -= (wallContact && wallKickUntil <= clock && !battle && jumpHeight > base + 5 ? 275 : 560) * dt;
  if (wallContact && wallKickUntil <= clock && jumpHeight > base + 5) jumpVelocity = Math.max(-33,jumpVelocity);
  if (jumpVelocity <= 0 && jumpHeight <= base + .001) {
    if (jumps || previous > base + .1) landedUntil = clock + .13;
    groundedOn = floor;
    jumpHeight = base;
    jumpVelocity = jumps = 0;
    airDashUsed = false;
  }
}

function aligned(x, y, reach, width) {
  const dx = x - player.x, dy = y - player.y;
  const forward = dx * player.facing.x + dy * player.facing.y;
  return forward >= 0 && forward <= reach && Math.abs(dx * player.facing.y - dy * player.facing.x) <= width;
}

function breakPot(pot) {
  if (pot.broken) return;
  pot.broken = true;
  player.gold += 2;
  player.herbs++;
  audio.play('pot');
  say('壺から薬草と2Gを見つけた。');
  save();
}

function strikePots(reach, width) {
  for (const pot of pots) {
    if (pot.broken || chapterOf(pot.x) !== chapterOf(player.x) || !aligned(pot.x, pot.y, reach, width)) continue;
    breakPot(pot);
  }
}

function castMagic(fireball = false) {
  if (!ring || player.mp < starterRing.mp || clock < magicAt) return;
  magicAt = clock + .55;
  player.mp -= starterRing.mp;
  const damage = Math.max(1, Math.floor(attackPower() * .35));
  audio.play('magic');
  if (fireball) return launchFireball(damage);
  glow = {until: clock + .28, field: !battle, x: battle ? battle.heroX : player.x,
    y: battle ? battleDepth(battle.heroY) - 27 - jumpHeight : fieldY(player.x,player.y) - 14 - jumpHeight,
    dx: player.facing.x, dy: battle ? player.facing.y * .68 : player.facing.y};
  if (battle) {
    const origin = actorPoint('hero');
    if (aimHitsEnemy(origin, player.facing, starterRing.reach, 19)) {
      battle.heroPressure = clock + 1.4;
      positionalHit(origin, damage, 'magic');
    }
    return;
  }
  const target = activeEnemies(chapterOf(player.x)).filter(enemy => enemy.hp && unlocked(enemy) &&
    !isFinalBoss(enemy) && aligned(enemy.x, enemy.y, starterRing.reach, 16))
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
  if (target) hurtEnemy(target, damage);
  strikePots(starterRing.reach, 12);
}

function swing(charged = false) {
  if (clock < attackAt) return;
  const weapon = equipped('weapon');
  const burden = Math.max(0, (weapon.weight ?? 5) - level() * .55);
  const interval = (weapon.interval ?? .46) + burden * .045;
  const form = bladeForm();
  bladeChain = charged ? 0 : (clock < chainUntil ? bladeChain % 3 : 0) + 1;
  chainUntil = charged ? 0 : clock + .78;
  const finisher = bladeChain === 3;
  const reach = (weapon.reach ?? 55) + (charged ? form.chargeReach : finisher ? 9 : 0);
  if (form.step && !pressed('crouch')) movePlayer(player.facing.x,player.facing.y,form.step * (charged ? 1.4 : 1));
  const airborne = jumpHeight > floorUnderHero() + 4;
  const power = Math.ceil(attackPower() * (airborne ? 1.3 : 1) * (charged ? 2.1 : finisher ? 1.32 : 1));
  attackAt = clock + interval;
  swingUntil = clock + Math.min(.35, interval * .68);
  swingKind = charged ? 'charged' : finisher ? 'combo' : airborne ? 'air' : level() >= 9 ? 'afterimage' : burden >= 2 ? 'heavy' : 'ground';
  audio.play(charged || finisher ? 'special' : airborne ? 'air' : 'attack');
  if (battle) {
    const origin = actorPoint('hero');
    if (aimHitsEnemy(origin, player.facing, reach, form.width)) {
      battle.heroPressure = clock + 1.4;
      const coordinated = joined && battle.link > clock;
      const damage = coordinated ? power + Math.ceil(catForm().atk * .85) : power;
      if (coordinated) {
        battle.link = 0;
        audio.play('holy');
        say('連携攻撃・星爪斬！', 1.5);
      }
      positionalHit(origin, battle.superAwake ? damage + Math.ceil(battle.enemy.max * .025) : damage,
        charged ? 'charge' : airborne ? 'air' : 'blade');
    }
    return;
  }
  const chapter = chapterOf(player.x);
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !unlocked(enemy) || isFinalBoss(enemy)) continue;
    if (aligned(enemy.x, enemy.y, reach, form.width * .75)) hurtEnemy(enemy, power);
    if (paused) break;
  }
  if (!paused) strikePots(reach, 13);
}

let dodgeAt = 0;
function dodge() {
  if (clock < dodgeAt) return;
  beginDash(true);
  if (dashMotion?.emergency) dodgeAt = clock + .85;
}

function special() {
  if (clock < specialAt || player.mp < 10) return;
  const targets = battle ? [battle.enemy] : activeEnemies(chapterOf(player.x)).filter(enemy =>
    enemy.hp && unlocked(enemy) && !isFinalBoss(enemy) && Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 105);
  if (!targets.length) return say('近くに敵がいない。');
  const inBattle = Boolean(battle);
  if (inBattle) startCinema('impact');
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
function hurtEnemy(enemy, damage, position = '') {
  if (isFinalBoss(enemy)) {
    const boundary = Math.ceil(enemy.max * (3 - finalPhase(enemy)) / 3);
    enemy.hp = Math.max(boundary, enemy.hp - damage);
    if (boundary && enemy.hp === boundary && battle) {
      battle.pattern = 0;
      battle.body = combatBody(enemy);
      battle.strike = null;
      battle.next = clock + 1.15;
      burstUntil = clock + .55;
      audio.play('encounter');
      say(enemy.name + 'が変身した。第' + finalPhase(enemy) + '形態！', 3);
    }
  } else enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.flash = clock + .16;
  if (battle) {
    addNumber(position ? position + ' ' + damage : damage, battle.enemyX, battleDepth(battle.enemyY) - 53, '#fff29a');
    battle.enemyHit = clock + .20;
  }
  else addNumber(damage, enemy.x, enemy.y - 14, '#fff29a', true);
  if (enemy.hp) return;
  if (battle) {
    defeatedFoe = {enemy, x:battle.enemyX, y:battleDepth(battle.enemyY), scale:battle.body.size * depthScale(battle.enemyY),
      until:clock + .67, chapter:chapterOf(player.x)};
  }
  monsterDex.add(enemy.name);
  victoryUntil = clock + 1.1;
  if (enemy.hiddenRegion !== undefined) {
    const entry = tourismFor(enemy.hiddenRegion);
    entry.boss = true;
    awardCompanion(40);
    leaveTrial();
    player.gold = Math.min(bankLimit, player.gold + 48 + enemy.hiddenRegion * 4);
    save();
    audio.play('victory');
    panel('隠しボスを討伐', [enemy.name + 'を討伐し、図鑑に登録した。'], [['街道に戻る', resume]]);
    return;
  }
  if (enemy.trial !== undefined) {
    awardCompanion(60);
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
  awardCompanion(xp);
  player.gold += gold;
  player.herbs++;
  if (battle) {
    battle = null;
    flameBolts = [];
    resetCat();
    resetJump();
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
  say(enemy.name + 'を倒した。経験値 +' + xp + '　' + gold + 'G　薬草 ×1' + (joined ? '。ソソが一美にすり寄った。' : ''));
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
  if (enemy.rank === 'major' && enemy.chapter === originalFinal) {
    panel('若草山から続く道', [
      'ヴィットリオが倒れ、空の亀裂が閉じた。だが、まだ遠い土地では地脈が眠ったままだ。',
      '一美とソソは、各地の旅人と出会いながら、残る道を結び直すことにした。'
    ], [['旅を続ける', resume]]);
  }
  if (enemy.rank === 'major' && enemy.chapter === last) {
    returning = true;
    panel('世界に朝が戻った', [
      '首里の石垣を渡る朝風が、各地で出会った声とともに戻った。ソソはいつもの小さな猫に戻った。',
      '「世界を救ったんだね、私たち」返事の代わりに、ソソは一美の靴ひもにじゃれた。'
    ], [['自宅へ向かう', () => { guide(); resume(); }], ['歩いて帰る', resume]]);
  }
  save();
}

function hurtPlayer(power, strike) {
  if (clock < invulnerableUntil) return;
  const guarding = joined && cat.hp > 0 && player.hp <= maxHP() * .3 && arenaDistance(actorPoint('cat'), actorPoint('hero')) < 32;
  const facing = strike && directionTo(strike.x - battle.heroX, strike.y - battle.heroY);
  const blocked = pressed('guard') && (!strike || facing.x * player.facing.x + facing.y * player.facing.y >= -.18);
  const damage = Math.max(1, Math.ceil((power - defense()) * (guarding ? .5 : 1) * (blocked ? .36 : 1)));
  player.hp = Math.max(0, player.hp - damage);
  flashUntil = clock + .2;
  invulnerableUntil = clock + .22;
  audio.play('hit');
  if (strike?.kind === 'stomp' && !blocked) footingUntil = clock + 65;
  if (strike && !blocked) moveArena('hero', -facing.x, -facing.y, battle.body.size > 3 ? 18 : 9, [enemyBlocker()]);
  addNumber(blocked ? '防御 ' + damage : damage, battle.heroX, battleDepth(battle.heroY) - 48, '#ff9a9a');
  if (!player.hp) defeat('一美は倒れた');
}

function defeat(title, detail = '呼びかけても返事はなく、足もとの光が静かに消えた。') {
  audio.setTrack('loss');
  clearInput();
  panel(title, [detail, '野営地から旅を再開できる。'], [
    ['野営地に戻る', () => {
      if (trialVitals) {
        leaveTrial();
        save();
        return;
      }
      battle = null;
      shrineDefeated = false;
      interior = null;
      resetCat();
      player.x = camps[checkpoint].x;
      player.y = 104;
      player.hp = maxHP();
      player.mp = maxMP();
      resetJump();
      uprightAt = clock + .40;
      fieldSafeUntil = clock + 1.5;
      enterField();
      save();
    }]
  ]);
}

function encounter(enemy, ambush) {
  battleCinema = null;
  flameBolts = [];
  destination = null;
  clearInput(true);
  resetCat();
  resetJump();
  glow = null;
  battle = createBattle(enemy, ambush);
  defeatedFoe = null;
  mode = 'battle';
  player.facing = {x: 1, y: 0};
  swingUntil = clock;
  bladeChain = chainUntil = 0;
  invulnerableUntil = clock;
  audio.play('encounter');
  audio.setTrack(enemy.trial !== undefined ? 'emperor' + enemy.trial :
    enemy.rank === 'mid' ? 'midboss' : enemy.boss ? 'boss' : 'battle');
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
  if (next && battle.age - battle.awakeSince + 1e-8 >= next.turn * 5) {
    const previous = catForm();
    cat.hp = Math.round(cat.hp * next.hp / previous.hp);
    cat.mp = Math.round(cat.mp * next.mp / previous.mp);
    cat.form++;
    battle.catEffect = {until: clock + 1.1, type: 'awakening'};
    audio.play('awake' + cat.form);
    say('ソソが第' + (cat.form + 1) + '形態・' + next.name + 'に覚醒！', 3);
    if (cat.form === 5) {
      audio.setTrack('genesis');
      startCinema('awakening');
    }
  }
  if (battle.burn && clock >= battle.burn.at) {
    const damage = battle.burn.damage;
    battle.burn = null;
    hurtEnemy(battle.enemy, damage);
    if (!battle || paused) return;
  }
  if (!cat.hp) return;
  const form = catForm();
  const reach = [25, 38, 42, 46, 110, 150][cat.form] + battle.body.radius;
  if (battle.strike && battle.strike.at - clock < .22 && clock >= battle.catDefenseAt &&
      strikeContains(battle.strike, actorPoint('cat'), arenaCat.radius)) {
    battle.catDefenseAt = clock + 3.6;
    battle.catDodge = clock + .30;
    retreatFromStrike('cat', 36);
    return;
  }
  if (clock < battle.catDodge) return;
  if (player.hp <= maxHP() * .3) {
    const hero = actorPoint('hero'), me = actorPoint('cat');
    const guard = directionTo(battle.enemyX - hero.x, battle.enemyY - hero.y);
    moveArena('cat', hero.x + guard.x * 15 - me.x, hero.y + guard.y * 15 - me.y, form.speed * dt, [enemyBlocker()]);
    if (arenaDistance(actorPoint('cat'), actorPoint('enemy')) > reach) return;
  } else if (!closeOnEnemy('cat', dt, form.speed * .71, reach, true)) return;
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
  if (!holy && cat.form === 1) battle.burn = {at: clock + .55, damage: Math.ceil(base * .35)};
  if (!holy && cat.form === 2) battle.slowedUntil = clock + .65;
  if (!holy && cat.form === 3 && battle.strike) damage += Math.ceil(base * .45);
  if (!holy && cat.form === 4) {
    const drained = Math.ceil(base * .18);
    damage += drained;
    cat.hp = Math.min(form.hp, cat.hp + drained);
  }
  if (!holy && cat.form === 5) damage += Math.ceil(base * .3);
  battle.catPressure = clock + 1.55;
  positionalHit(actorPoint('cat'), damage);
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
  updateCompanion(dt);
  if (!battle || paused) return;
  const strike = battle.strike;
  if (strike) {
    if (clock < strike.at) return;
    hurtCompanion(strike);
    if (joined && cat.hp > 0 && clock >= battle.catDodge &&
        strikeContains(strike, actorPoint('cat'), arenaCat.radius)) {
      const damage = Math.max(240, strike.power * (enemy.trial !== undefined ? 132 : 90) - catForm().def);
      cat.hp = Math.max(0, cat.hp - damage);
      addNumber(damage, battle.catX, battleDepth(battle.catY) - 35, '#ff9a9a');
      if (!cat.hp) return defeat('ソソは倒れた');
      const ratio = cat.hp / catForm().hp;
      if (cat.form < 5) {
        const mpRatio = cat.mp / catForm().mp;
        cat.form = 0;
        cat.hp = Math.max(1, Math.round(ratio * catForm().hp));
        cat.mp = Math.round(mpRatio * catForm().mp);
        battle.awakeSince = battle.age;
        say('ソソの覚醒が中断された。');
      }
      if (ratio <= .1 && !battle.superAwake) {
        battle.superAwake = true;
        burstUntil = clock + .55;
        audio.play('creation');
        say('一美が黄金の光をまとった。超覚醒！');
        if (!enemy.boss) {
          hurtEnemy(enemy, enemy.hp);
          return;
        }
      }
    }
    if (strikeContains(strike, actorPoint('hero'), arenaHero.radius) && (strike.wave || jumpHeight < 18)) {
      hurtPlayer(strike.power, strike);
    }
    if (strike.kind === 'rush') {
      moveArena('enemy', strike.direction.x, strike.direction.y, 22, [heroBlocker()]);
    }
    battle.impact = {...strike, until:clock + .45, strong:battle.body.size >= 2.8};
    if (battle.impact.strong) audio.play('quake');
    battle.damageFlash = clock + .17;
    battle.strike = null;
    battle.next = clock + enemy.interval;
    return;
  }
  advanceEnemy(dt);
}

const closeTo = (x, y, radius) => Math.hypot(player.x - x, player.y - y) < radius;

function updateField(dt) {
  followCompanion(dt);
  noteVisit(chapterOf(player.x));
  updateDoorLatch();
  const chapter = chapterOf(player.x);
  discoverTrailCache(chapter);
  if (joined) {
    const dx = player.x - cat.x, dy = player.y - cat.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 20) {
      const step = Math.min(gap - 20, dt * (destination && returning ? 415 : gait === 'run' ? 174 : 120));
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
  const nearbyNpc = npcs.find(npc => npc.name !== player.party[0] && closeTo(npc.x, 104, 13));
  if (nearbyNpc !== contactNpc) {
    contactNpc = nearbyNpc;
    if (nearbyNpc) {
      nearbyNpc.visited = true;
      if (companionProfiles[nearbyNpc.name]) {
        destination = null;
        recruitment(nearbyNpc);
        return;
      }
      say(nearbyNpc.name + ' ' + nearbyNpc.line);
      save();
    }
  }
  const gem = reachableGem(11);
  if (gem) collectGem(gem);
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
    if (jumpHeight >= 18 || clock < fieldSafeUntil || clock < invulnerableUntil || !closeTo(enemy.x, enemy.y, 11)) continue;
    const rear = (enemy.x - player.x) * player.facing.x + (enemy.y - player.y) * player.facing.y < -3;
    encounter(enemy, rear);
    break;
  }
}

function update(dt) {
  if (paused || (mode !== 'field' && mode !== 'battle')) return;
  clock += dt;
  tickTown(dt);
  if (messageUntil && clock >= messageUntil) {
    messageUntil = 0;
    $('message').textContent = '';
  }
  while (numbers.length && numbers[0].expires <= clock) numbers.shift();
  if (doorTransition) {
    advanceTownDoor();
    return;
  }
  ridePlatform();
  updateJump(dt);
  const input = playableInput();
  if (moveWithInput(dt)) return;
  if (checkZoneContact(input.magnitude > .01 || Boolean(dashMotion))) return;
  if (interior) return;
  if (!paused) updateFireballs(dt);
  if (paused) return;
  if (battle) updateBattle(dt);
  else updateField(dt);
}

function updateUI() {
  const chapter = chapterOf(player.x);
  $('game').dataset.battle = String(Boolean(battle));
  $('pause').hidden = Boolean(innScene) || mode === 'title' || mode === 'home';
  const playing = mode === 'field' || mode === 'battle';
  $('joystick').hidden = !playing;
  $('joystick').setAttribute('aria-disabled',String(!movementAllowed()));
  $('actions').hidden = !playing || Boolean(innScene);
  $('actions').inert = !movementAllowed();
  attackButton.dataset.charge = String(!bDashUsed && chargeStarted !== null && clock - chargeStarted >= .58);
  updatePlaceTitle();
  $('town-clock').hidden = mode !== 'field' || Boolean(battle);
  $('town-clock').textContent = (interior || player.x - chapter * span < 355 ? towns[chapter].name + '　' : '') + townTime();
  $('location').textContent = interior ? townTypes[interior.site.kind][0] : trialVitals ? (battle?.enemy.hiddenRegion !== undefined ? '隠しダンジョン' : '四天王の闘技場') : mode === 'home' ? '一美の家' : '第' + (chapter + 1) + '章　' + chapterInfo[chapter][0];
  $('vitals').textContent = 'Lv.' + level() + '　HP ' + player.hp + '/' + maxHP() + '　MP ' + player.mp + '/' + maxMP() + (clock < footingUntil ? '　足止め' : '');
  $('progress').textContent = '経験値 ' + player.xp + '/' + nextXp() + '（あと' + (nextXp() - player.xp) + '）　' + player.gold + 'G　攻' + attackPower() + ' / 防' + defense();
  $('enemy-status').hidden = !battle;
  if (battle) {
    $('enemy-status').textContent = battle.enemy.name + '　HP ' + battle.enemy.hp + '/' + battle.enemy.max +
      (isFinalBoss(battle.enemy) ? '　第' + finalPhase(battle.enemy) + '形態' : '') +
      (battle.strike ? '　⚠ ' + battle.strike.label : '');
  }
  const member = currentCompanion();
  $('companion-status').hidden = !member;
  if (member) $('companion-status').textContent = member.name + ' Lv.' + companionLevel(member) +
    '　HP ' + member.hp + '/' + companionHP(member) + '　MP ' + member.mp + '/' + companionMP(member);
  $('enemy-hp').hidden = !battle;
  if (battle) {
    $('enemy-hp').max = battle.enemy.max;
    $('enemy-hp').value = battle.enemy.hp;
  }
  $('awakening').hidden = !battle || !joined;
  if (battle && joined) {
    const next = awakening[cat.form + 1];
    const elapsed = Math.max(0, battle.age - battle.awakeSince);
    const from = catForm().turn * 5;
    $('awake-gauge').max = next ? next.turn * 5 - from : 1;
    $('awake-gauge').value = next ? elapsed - from : 1;
    $('soso-status').textContent = 'ソソ 第' + (cat.form + 1) + '形態・' + catForm().name +
      '　Lv.99 HP ' + cat.hp + '/' + catForm().hp + ' MP ' + cat.mp + '/' + catForm().mp + (next ? '　覚醒まで ' + Math.max(0, Math.ceil(next.turn * 5 - elapsed)) + '秒' : '　覚醒完了');
  }
  const shot = $('shot');
  const wait = shotGear === 'ring' ? magicAt - clock : specialAt - clock;
  shot.setAttribute('aria-disabled', String(Boolean(interior || wait > 0 || player.mp < (shotGear === 'ring' ? starterRing.mp : 10))));
  const duration = shotGear === 'ring' ? .55 : 15;
  shot.style.setProperty('--cooldown', clamp(wait / duration, 0, 1) * 100);
  const shootName = shotGear === 'ring' ? '火の玉' : battle && joined && cat.hp > 0 ?
    (cat.form === 5 && cat.mp >= 999 ? '天地創生' : '双星の誓い') : 'ソソを思う';
  attackButton.title = equipped('weapon').name + '・' + bladeForm().name;
  shot.title = shootName + (wait > 0 ? '（あと' + Math.ceil(wait) + '秒）' : '');
  shot.setAttribute('aria-description', shot.title);
  attackButton.setAttribute('aria-description',attackButton.title);
  $('level').textContent = clock < levelUntil ? 'レベルアップ！ Lv.' + level() : '';
  $('fade').dataset.active = String(Boolean(battle && battle.age < .18 || doorTransition && clock >= doorTransition.end - .13));
}

showTitle();
