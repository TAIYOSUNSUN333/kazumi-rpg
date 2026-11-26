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
const maxHP = () => 100 + (level() - 1) * 13 + stoneMaxHP;
const maxMP = () => 30 + (level() - 1) * 4 + stoneMaxMP;
const attackPower = () => 10 + (level() - 1) * 3 + equipped('weapon').bonus + (townSeconds < innBuffUntil ? 4 : 0) + (townSeconds < stoneBuffUntil ? 6 : 0) + (player.party.includes('一郎') ? 2 : 0);
const defense = () => 5 + (level() - 1) * 2 + equipped('armor').bonus + (player.party.includes('クルミ') ? 1 : 0) + (townSeconds < stoneBuffUntil ? 4 : 0);
function equipped(type) {
  if (type === 'armor' && stoneArmor) return unlockedStoneArmor(stoneArmor);
  if (type === 'weapon' && slashBase !== null) return equipment.weapon[slashBase];
  return prefectures[regionalGear[type]]?.[type] || trials[trialGear[type]]?.reward || equipment[type][player[type]];
}
const activeEnemies = chapter => enemies.slice(chapter * 8, chapter * 8 + 8);
const unlocked = enemy => !enemy.boss || enemy.rank === 'mid' || activeEnemies(enemy.chapter)[6].hp === 0;

const prefs = storage.read('kazumi-audio');
audio.setVolume(numeric(prefs?.volume, 45, 0, 100) / 100, prefs?.muted === true);
audio.setMix(numeric(prefs?.music, 85, 0, 100) / 100, numeric(prefs?.effects, 80, 0, 100) / 100);

function save(explicit = false) {
  if (trialVitals) return false;
  const success = storage.write(saveKey, {
    version: 10, stage:stageSnapshot(), stones:stoneSnapshot(), actionEquipment:{slashBase,shotGear}, trailCaches:[...trailCaches], inn:innSnapshot(), tourism: tourismSnapshot(), town: townSnapshot(), x: player.x, y: player.y, hp: player.hp, mp: player.mp,
    xp: player.xp, gold: player.gold, shards: player.shards, herbs: player.herbs,
    weapon: player.weapon, armor: player.armor, party: player.party, companions: [...companions.values()], checkpoint,
    visited: npcs.map(npc => Boolean(npc.visited)), gems: gems.map(gem => gem.on),
    enemies: enemies.map(enemy => enemy.hp), shrineDefeated,
    special: Math.max(0, specialAt - clock), joined, returning, done,
    trials: [...clearedTrials], trialGear, ring, pots: pots.map(pot => pot.broken)
  });
  if (explicit) say(success ? 'このブラウザに冒険を保存した。' : 'このブラウザでは保存できません。');
  return success;
}

function load(data) {
  if (!data || typeof data !== 'object') return;
  const current = [4, 5, 6, 7, 8, 9, 10].includes(data.version);
  ring = [5, 6, 7, 8, 9, 10].includes(data.version) && data.ring === true;
  pots.forEach((pot, i) => { pot.broken = [5, 6, 7, 8, 9, 10].includes(data.version) && data.pots?.[i] === true; });
  const modern = current || data.version === 3;
  const oldMap = data.version === 2;
  player.xp = numeric(data.xp, 0, 0, 1000000);
  restoreCompanions(data);
  player.shards = numeric(modern ? data.shards : data.art, 0, 0, 100000);
  player.x = modern || oldMap ? numeric(data.x, 25, 0, limit) : 25;
  player.y = modern || oldMap ? numeric(data.y, 104, fieldTop, fieldBottom) : 104;
  restoreStage(data.stage);
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
  loadStones(data);
  const shot = data.actionEquipment?.shotGear;
  const savedSpell = routeSpellById.get(shot);
  shotGear = ring && (shot === 'ring' || savedSpell && data.checkpoint >= savedSpell.chapter) ||
    stoneMagicLearned && shot === 'moon' ? shot : 'star';
  player.hp = numeric(data.hp, maxHP(), 1, maxHP());
  player.mp = numeric(data.mp, maxMP(), 0, maxMP());
  checkpoint = modern ? numeric(data.checkpoint, chapterOf(player.x), 0, last) : chapterOf(player.x);
  for (const [i, npc] of npcs.entries()) {
    npc.visited = player.party.includes(npc.name) || Boolean(modern ? data.visited?.[i] : data.usedNpcs?.[i]);
  }
  gems.forEach((gem, i) => { gem.on = data.gems?.[i] !== false; });
  shrineDefeated = data.shrineDefeated === true;
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
  returning = [9, 10].includes(data.version) && joined && data.returning === true;
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
  if (![9, 10].includes(data.version)) {
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
        if (action === 'jump') releaseJump();
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
    if (action === 'jump' && !pressed('jump')) releaseJump();
  }
});
window.addEventListener('blur', () => clearInput());
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('pointerdown', () => audio.unlock(), {once: true, capture: true});
document.addEventListener('keydown', () => audio.unlock(), {once: true, capture: true});

function fieldTrack() {
  if (interior) return interior.site.kind === 'inn' ? 'innEntry' :
    ['regional','trailroom','secret'].includes(interior.site.kind) ? 'dungeon' : 'town' + interior.site.chapter;
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
  companionTrail.height = 0;
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
  if (document.fullscreenEnabled && $('game').requestFullscreen) {
    const fullscreen = document.createElement('button');
    fullscreen.textContent = document.fullscreenElement ? '全画面表示を終了' : '全画面表示';
    fullscreen.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await $('game').requestFullscreen();
        fullscreen.textContent = document.fullscreenElement ? '全画面表示を終了' : '全画面表示';
      } catch {
        fullscreen.textContent = '全画面表示を利用できません';
      }
    };
    $('panel-body').append(fullscreen);
  }
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
  const actions = [['戻る', resume]];
  if (!battle) actions.push(['斬撃・魔法の装備', actionEquipment], ['石碑手帳', stoneJournal]);
  if (!battle && interior) actions.push(['保存', () => { save(true); resume(); }], ['施設の案内', servicePanel,
    Math.hypot(interior.x - 320, interior.y - 100) > 66]);
  else if (!battle) actions.push(
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
  const member = currentCompanion();
  panel('メニュー', [
    prefectures[chapterOf(player.x)].name + '　' + townTime(),
    'Lv.' + level() + '　経験値 ' + player.xp + '/' + nextXp() + '（あと' + (nextXp() - player.xp) + '）',
    player.gold + 'G　攻撃 ' + attackPower() + ' / 防御 ' + defense(),
    '武器 ' + equipped('weapon').name + '　防具 ' + equipped('armor').name,
    '薬草 ' + player.herbs + '　星の欠片 ' + player.shards,
    nearTavern() || battle ? '' : '酒場のある街では建物の扉から入れる。',
    '仲間 ' + ([...player.party, ...(joined ? ['ソソ'] : [])].join('、') || 'なし'),
    ...(member ? [member.name + ' Lv.' + companionLevel(member) + '　HP ' + member.hp + '/' + companionHP(member) +
      '　MP ' + member.mp + '/' + companionMP(member)] : [])
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
      if (type === 'armor') stoneArmor = null;
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
    offers.push([trial.reward.name + 'を装備', () => { trialGear[type] = index; regionalGear[type] = null; if (type === 'armor') stoneArmor = null; if (type === 'weapon') slashBase = null; save(); shop(); }, trialGear[type] === index]);
  }
  for (const stone of waysideStones) {
    const item = unlockedStoneArmor(stone.id);
    if (item) offers.push([item.name + 'を装備', () => {
      stoneArmor = stone.id;
      trialGear.armor = regionalGear.armor = null;
      save();
      shop();
    }, stoneArmor === stone.id]);
  }
  for (const type of ['weapon', 'armor']) {
    if (type === 'armor' && stoneArmor || trialGear[type] !== null || regionalGear[type] !== null) offers.push([equipment[type][player[type]].name + 'に戻す', () => {
      trialGear[type] = null; regionalGear[type] = null; if (type === 'armor') stoneArmor = null; if (type === 'weapon') slashBase = null; save(); shop();
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
    encounter({...trial, hp: trial.max, flash: 0});
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
  const edge = (chapter + 1) * span;
  const candidates = [
    ...gems.filter(gem => gem.on && gem.x > player.x && gem.x < edge),
    ...npcs.filter(npc => !npc.visited && npc.x > player.x && npc.x < edge).map(npc => ({x: npc.x, row: 104})),
    ...activeEnemies(chapter).filter(enemy => enemy.hp && !enemy.optional && !enemy.boss).map(enemy => ({x: enemy.x, row: enemy.y}))
  ].filter(point => point.x > player.x + 5).sort((a, b) => a.x - b.x);
  const [, , , , , , mid, boss] = activeEnemies(chapter);
  const pending = mid.hp ? mid : boss;
  const target = candidates[0] || (pending.hp ? {x: pending.x, row: pending.y} : camps[Math.min(last, chapter + 1)]);
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
        if (shrine.solved || !quizOpen) return;
        if (choice === question.answer) {
          shrine.solved = true;
          shrine.wrong = 0;
          close();
          if (optional) {
            audio.play('seal');
            optional.success();
          } else grantStoneReward(shrine);
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
  const magnitude = Math.hypot(dx, dy);
  player.facing = {x: dx / magnitude, y: dy / magnitude};
  const chapter = chapterOf(player.x);
  const [, , , , , , mid, boss] = activeEnemies(chapter);
  const gate = mid.hp ? mid : boss;
  const boundary = !returning && gate.hp ? gate.homeX + 17 : limit;
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

function releaseJump() {
  touchCrouch = false;
  if (jumpVelocity > 92 && !dashMotion && !climbing && wallKickUntil <= clock) jumpVelocity = 92;
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

function castMagic() {
  if (!ring || player.mp < starterRing.mp || clock < magicAt) return;
  magicAt = clock + .55;
  player.mp -= starterRing.mp;
  const damage = Math.max(1, Math.floor(attackPower() * .35));
  audio.play('magic');
  launchFireball(damage);
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
  const chapter = chapterOf(player.x);
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !unlocked(enemy) || isFinalBoss(enemy)) continue;
    if (aligned(enemy.x, enemy.y, reach, form.width * .75)) hurtEnemy(enemy, power);
    if (paused) break;
  }
  if (!paused) {
    strikePots(reach, 13);
    cutNearbyStageProp(reach,form.width,charged);
  }
}

let dodgeAt = 0;
function dodge() {
  if (clock < dodgeAt) return;
  beginDash(true);
  if (dashMotion?.emergency) dodgeAt = clock + .85;
}

function special() {
  if (clock < specialAt || player.mp < 10) return;
  const targets = activeEnemies(chapterOf(player.x)).filter(enemy =>
    enemy.hp && unlocked(enemy) && !isFinalBoss(enemy) && Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 105);
  if (!targets.length) return say('近くに敵がいない。');
  player.mp -= 10;
  specialAt = clock + 15;
  burstUntil = clock + .55;
  audio.play('special');
  say('ソソを思う！');
  for (const enemy of targets) {
    const power = attackPower() * 5 + 30 + Math.min(player.shards, 36);
    hurtEnemy(enemy, enemy.boss ? Math.min(Math.ceil(enemy.max * .65), power) : enemy.hp);
  }
  save();
}

function addNumber(text, x, y, color, field = false) {
  numbers.push({text: String(text), x, y, color, field, expires: clock + .7});
}
function hurtEnemy(enemy, damage) {
  const boundary = isFinalBoss(enemy) ? Math.ceil(enemy.max * (3 - finalPhase(enemy)) / 3) : 0;
  enemy.hp = Math.max(boundary, enemy.hp - damage);
  enemy.flash = clock + .16;
  if (!battle) addNumber(damage, enemy.x, enemy.y - 14, '#fff29a', true);
  if (enemy.hp) return;
  if (battle) {
    defeatedFoe = {enemy, scale:battle.body.size, until:clock + .67, chapter:chapterOf(player.x)};
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
  const reinforcementsDefeated = (battle?.command.foes.length ?? 1) - 1;
  const xp = (enemy.boss ? 44 : 7) + enemy.chapter * (enemy.boss ? 4 : 2) + reinforcementsDefeated * (4 + enemy.chapter);
  const gold = (enemy.boss ? 32 : 6) + enemy.chapter + reinforcementsDefeated * (3 + Math.floor(enemy.chapter / 2));
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
      'ソソの行動は戦闘中に選べる。ターンが進むと覚醒し、必殺技で二人の力を合わせられる。'
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

function encounter(enemy, approach = 'normal') {
  battleCinema = null;
  flameBolts = [];
  destination = null;
  clearInput();
  resetCat();
  resetJump();
  battle = createBattle(enemy);
  defeatedFoe = null;
  mode = 'battle';
  player.facing = {x: 1, y: 0};
  swingUntil = clock;
  bladeChain = chainUntil = 0;
  invulnerableUntil = clock;
  audio.play('encounter');
  setEncounterTrack(enemy);
  say('');
  startCommandBattle(enemy, approach);
}

function setEncounterTrack(enemy) {
  audio.setTrack(enemy.trial !== undefined ? 'emperor' + enemy.trial :
    enemy.rank === 'mid' ? 'midboss' : enemy.boss ? 'boss' : 'battle');
}

function escapeBattle() {
  if (trialVitals) {
    leaveTrial();
    save();
    say('試練から離脱した。');
    return;
  }
  if (!battle) return;
  ({x:player.x, y:player.y} = battle.entry);
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

const closeTo = (x, y, radius) => Math.hypot(player.x - x, player.y - y) < radius;

function updateField(dt) {
  followCompanion(dt);
  noteVisit(chapterOf(player.x));
  updateDoorLatch();
  const chapter = chapterOf(player.x);
  discoverTrailCache(chapter);
  const stage = stagePaths[chapter];
  if (stageHazards(dt,stage)) return;
  findStageCache(stage);
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
      if (Math.abs(aim - enemy.x) > .5) enemy.fieldFacing = {x:Math.sign(aim - enemy.x),y:0};
      enemy.x += clamp(aim - enemy.x, -dt * 20, dt * 20);
      enemy.y += clamp(enemy.homeY - enemy.y, -dt * 18, dt * 18);
    } else if (distance > 0) {
      if (distance > 22) enemy.fieldFacing = directionTo(dx,dy);
      const speed = enemy.speed * .53 * dt;
      enemy.x = clamp(enemy.x + dx / distance * speed, enemy.homeX - leash, enemy.homeX + leash);
      enemy.y = clamp(enemy.y + dy / distance * speed, enemy.homeY - leash, enemy.homeY + leash);
    }
    if (jumpHeight >= 18 || clock < fieldSafeUntil || clock < invulnerableUntil || !closeTo(enemy.x, enemy.y, 11)) continue;
    const towardEnemy = directionTo(-dx,-dy,player.facing);
    const enemyFacing = enemy.fieldFacing || {x:-1,y:0};
    const playerToward = player.facing.x * towardEnemy.x + player.facing.y * towardEnemy.y;
    const enemyToward = -(enemyFacing.x * towardEnemy.x + enemyFacing.y * towardEnemy.y);
    encounter(enemy, enemyToward > .45 && playerToward < -.45 ? 'rear' :
      playerToward > .45 && enemyToward < -.45 ? 'first' : 'normal');
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
  if (battle) {
    updateCommandBattle(dt);
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
  updateField(dt);
}

function updateUI() {
  $('game').dataset.battle = String(Boolean(battle));
  $('pause').hidden = Boolean(innScene) || mode === 'title' || mode === 'home';
  const playing = mode === 'field' || mode === 'battle';
  const exploring = mode === 'field' && !innScene;
  $('joystick').hidden = !exploring;
  $('joystick').setAttribute('aria-disabled',String(!movementAllowed()));
  $('actions').hidden = !exploring;
  $('hud').hidden = !playing || Boolean(battle) || Boolean(innScene);
  $('battle-commands').hidden = !battle;
  $('battle-commands').inert = paused;
  $('actions').inert = !movementAllowed();
  attackButton.dataset.charge = String(!bDashUsed && chargeStarted !== null && clock - chargeStarted >= .58);
  updatePlaceTitle();
  $('vitals').textContent = 'HP ' + player.hp + '/' + maxHP() + '　MP ' + player.mp + '/' + maxMP();
  $('field-hp').max = maxHP();
  $('field-hp').value = player.hp;
  $('field-mp').max = maxMP();
  $('field-mp').value = player.mp;
  const shot = $('shot');
  const wait = shotGear === 'star' ? specialAt - clock : magicAt - clock;
  const routeSpell = routeSpellById.get(shotGear);
  const cost = routeSpell?.cost ?? (shotGear === 'ring' ? starterRing.mp : shotGear === 'moon' ? stoneSpell.mp : 10);
  shot.setAttribute('aria-disabled', String(Boolean(interior || wait > 0 || player.mp < cost)));
  const duration = shotGear === 'star' ? 15 : routeSpell ? .7 : .55;
  shot.style.setProperty('--cooldown', clamp(wait / duration, 0, 1) * 100);
  const shootName = routeSpell?.name ?? (shotGear === 'ring' ? '火の玉' :
    shotGear === 'moon' ? stoneSpell.name : 'ソソを思う');
  attackButton.title = equipped('weapon').name + '・' + bladeForm().name;
  shot.title = shootName + (wait > 0 ? '（あと' + Math.ceil(wait) + '秒）' : '');
  shot.setAttribute('aria-description', shot.title);
  attackButton.setAttribute('aria-description',attackButton.title);
  $('level').textContent = clock < levelUntil ? 'レベルアップ！ Lv.' + level() : '';
  $('fade').dataset.encounter = String(Boolean(battle && battle.age < .18));
  $('fade').dataset.active = String(Boolean(battle && battle.age < .18 || doorTransition && clock >= doorTransition.end - .13));
}

showTitle();
