const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const numeric = (value, fallback, min, max) =>
  Number.isFinite(value) ? clamp(Math.floor(value), min, max) : fallback;
const storage = {
  read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
};
const saveSlot = numeric(storage.read('kazumi-slot'),1,1,3);
const slotKey = slot => slot === 1 ? 'kazumi' : 'kazumi-slot-' + slot;
const saveKey = slotKey(saveSlot);
const validAdventure = data => data && typeof data === 'object' && !Array.isArray(data) &&
  (Number.isInteger(data.version) || Number.isFinite(data.xp) || Number.isFinite(data.x));
function readAdventure(key = saveKey) {
  const active = storage.read(key);
  if (validAdventure(active)) return active;
  const backup = storage.read(key + '-backup');
  return validAdventure(backup) ? backup : null;
}

const player = {
  x: 25, y: 104, hp: 100, mp: 30, fatigue:0, xp: 0, gold: 0, shards: 0, herbs: 0,
  weapon: 0, armor: 0, party: [], facing: {x: 1, y: 0}
};
let mode = 'title';
let paused = false;
let menuActive = false;
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
let armorBase = null;
let shieldOwned = false;
let shieldEquipped = false;
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
  if (type === 'armor' && armorBase !== null) return equipment.armor[armorBase];
  if (type === 'armor' && stoneArmor) return unlockedStoneArmor(stoneArmor);
  if (type === 'weapon' && slashBase !== null) return equipment.weapon[slashBase];
  return prefectures[regionalGear[type]]?.[type] || trials[trialGear[type]]?.reward || equipment[type][player[type]];
}
const activeEnemies = chapter => enemies.slice(chapter * 8, chapter * 8 + 8);
const unlocked = enemy => !enemy.boss || enemy.rank === 'mid' || activeEnemies(enemy.chapter)[6].hp === 0;
const enemyOnField = enemy => unlocked(enemy) && (!enemy.nightOnly || townNight());

let battleStyle = storage.read('kazumi-battle-style') === 'command' ? 'command' : 'action';
const prefs = storage.read('kazumi-audio');
audio.setVolume(numeric(prefs?.volume, 45, 0, 100) / 100, prefs?.muted === true);
audio.setMix(numeric(prefs?.music, 85, 0, 100) / 100, numeric(prefs?.effects, 80, 0, 100) / 100);

function save(explicit = false) {
  if (trialVitals) return false;
  const previous = readAdventure();
  const snapshot = {
    version: 11, bathPending, pack, shieldOwned, shieldEquipped, stage:stageSnapshot(), stones:stoneSnapshot(), actionEquipment:{slashBase,armorBase,shotGear}, trailCaches:[...trailCaches], inn:innSnapshot(), tourism: tourismSnapshot(), town: townSnapshot(), x: player.x, y: player.y, hp: player.hp, mp: player.mp,
    xp: player.xp, fatigue:player.fatigue, gold: player.gold, shards: player.shards, herbs: player.herbs,
    weapon: player.weapon, armor: player.armor, party: player.party, companions: [...companions.values()], checkpoint,
    visited: npcs.map(npc => Boolean(npc.visited)), gems: gems.map(gem => gem.on),
    enemies: enemies.map(enemy => enemy.hp), shrineDefeated,
    special: Math.max(0, specialAt - clock), joined, returning, done,
    trials: [...clearedTrials], trialGear, ring, pots: pots.map(pot => pot.broken)
  };
  const success = storage.write(saveKey,snapshot);
  if (success) storage.write(saveKey + '-backup',previous || snapshot);
  if (explicit) say(success ? 'このブラウザに冒険を保存した。' : 'このブラウザでは保存できません。');
  return success;
}

function load(data) {
  if (!data || typeof data !== 'object') return;
  const current = [4, 5, 6, 7, 8, 9, 10, 11].includes(data.version);
  ring = [5, 6, 7, 8, 9, 10, 11].includes(data.version) && data.ring === true;
  pots.forEach((pot, i) => { pot.broken = [5, 6, 7, 8, 9, 10, 11].includes(data.version) && data.pots?.[i] === true; });
  const modern = current || data.version === 3;
  const oldMap = data.version === 2;
  player.xp = numeric(data.xp,0,0,1000000);
  player.fatigue = numeric(data.fatigue,0,0,100);
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
  restorePack(data.pack);
  player.herbs = modern ? numeric(data.herbs, 0, 0, 10000) : 0;
  player.weapon = numeric(data.weapon, 0, 0, equipment.weapon.length - 1);
  player.armor = numeric(data.armor, 0, 0, equipment.armor.length - 1);
  slashBase = Number.isInteger(data.actionEquipment?.slashBase) ?
    clamp(data.actionEquipment.slashBase,0,player.weapon) : null;
  armorBase = Number.isInteger(data.actionEquipment?.armorBase) ?
    clamp(data.actionEquipment.armorBase,0,player.armor) : null;
  shieldOwned = data.shieldOwned === true;
  shieldEquipped = shieldOwned && data.shieldEquipped === true;
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
  returning = [9, 10, 11].includes(data.version) && joined && data.returning === true;
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
  bathPending = interior?.site.kind === 'bath' && data.bathPending === interior.site.id ? data.bathPending : null;
  loadInn(data.inn);
  loadTourism(data.tourism);
  if (![9, 10, 11].includes(data.version)) {
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
  KeyB: 'limit', KeyH: 'herb', KeyT: 'think',
  Space: 'attack', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyX: 'shot', KeyZ: 'jump', KeyC: 'shot', KeyQ: 'guard', KeyV: 'dash', KeyF: 'crouch'
};
const controls = [...document.querySelectorAll('[data-hold]')];
const attackButton = document.querySelector('[data-hold=attack]');
const joystick = {id:null,x:0,y:0,centerX:0,centerY:0,radius:36};
function resetJoystick() {
  joystick.id = null;
  joystick.x = joystick.y = 0;
  $('joystick').hidden = true;
  $('stick-knob').style.transform = 'translate(-50%, -50%)';
}
function tiltJoystick(event) {
  const x = (event.clientX - joystick.centerX) / joystick.radius;
  const y = (event.clientY - joystick.centerY) / joystick.radius;
  const length = Math.hypot(x,y);
  joystick.x = length < .13 ? 0 : x / Math.max(1,length);
  joystick.y = length < .13 ? 0 : y / Math.max(1,length);
  $('stick-knob').style.transform = 'translate(-50%, -50%) translate(' + joystick.x * joystick.radius * .82 +
    'px, ' + joystick.y * joystick.radius * .82 + 'px)';
}

const movementSurface = $('scene');
movementSurface.onpointerdown = event => {
  if (!movementAllowed() || joystick.id !== null || event.button !== 0) return;
  event.preventDefault();
  audio.unlock();
  const gameBounds = $('game').getBoundingClientRect();
  joystick.id = event.pointerId;
  joystick.centerX = event.clientX;
  joystick.centerY = event.clientY;
  const stick = $('joystick');
  stick.style.left = (event.clientX - gameBounds.left) + 'px';
  stick.style.top = (event.clientY - gameBounds.top) + 'px';
  stick.hidden = false;
  joystick.radius = stick.clientWidth * .33;
  movementSurface.setPointerCapture(event.pointerId);
  tiltJoystick(event);
};
movementSurface.onpointermove = event => {
  if (event.pointerId === joystick.id) tiltJoystick(event);
};
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  movementSurface.addEventListener(type,event => {
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
  if (isActionBattle()) {
    if (battle.auto) return;
    if (action === 'attack') {
      const input = playableInput();
      if (input.magnitude > .16) player.facing = directionTo(input.x,input.y);
      swing(pressed('guard'));
      return;
    }
    if (action === 'limit') return actionLimit();
    if (action === 'herb') return useActionHerb();
    if (action === 'think') return actionThinkOfSoso();
    if (action === 'shot' || action === 'battle-magic') return castActionMagic();
  }
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
    if (action === 'attack' && !isActionBattle()) swing();
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
const playSurface = '#scene, #joystick, #actions, #arena-actions, #battle-commands';
const touchOnGame = touch => touch.target instanceof Element && Boolean(touch.target.closest(playSurface));
for (const type of ['touchstart','touchmove']) {
  $('game').addEventListener(type,event => {
    if (event.touches.length > 1 && Array.from(event.touches).some(touchOnGame) && event.cancelable) event.preventDefault();
  },{passive:false});
}
for (const type of ['gesturestart','gesturechange','contextmenu']) {
  $('game').addEventListener(type,event => {
    if (touchOnGame(event) && event.cancelable) event.preventDefault();
  },{passive:false});
}
document.addEventListener('pointerdown', () => audio.unlock(), {once: true, capture: true});
document.addEventListener('keydown', () => audio.unlock(), {once: true, capture: true});

function fieldTrack() {
  if (interior) return interior.site.kind === 'inn' ? 'innEntry' : interior.site.kind === 'tavern' ? 'tavern' :
    ['regional','trailroom','secret'].includes(interior.site.kind) ? 'dungeon' : 'town' + interior.site.chapter;
  const chapter = chapterOf(player.x);
  if (player.x - chapter * span >= 0 && player.x - chapter * span < 355) return 'town' + chapter;
  if ([3,6,9,11].includes(chapter)) return 'dungeon';
  const track = prefectures[chapter].terrain;
  return ['forest','coast','snow'].includes(track) ? track : 'field';
}

const cityMusicRegions = new Set(['東京都','神奈川県','愛知県','京都府','大阪府','兵庫県','福岡県']);
const merchantMusicSites = new Set(['weapon','armor','items','pharmacy','store','magic','smith','food','restaurant','tavern','casino']);
function setFieldTrack() {
  const score = fieldTrack();
  if (interior?.site.kind === 'ruin') return audio.setTrack(score,'dungeon');
  if (interior && merchantMusicSites.has(interior.site.kind)) return audio.setTrack(score,'tavern');
  if (!interior && townNight()) return audio.setTrack(score,'night');
  if (score.startsWith('town') && cityMusicRegions.has(prefectures[chapterOf(player.x)].name)) return audio.setTrack(score,'city');
  audio.setTrack(score);
}

function panel(title, lines, buttons) {
  clearInput();
  paused = true;
  const frame = $('panel');
  frame.dataset.kind = menuActive ? 'menu' : mode === 'title' || mode === 'home' ? 'intro' : 'dialogue';
  frame.hidden = false;
  $('panel-title').textContent = title;
  $('panel-body').replaceChildren(...lines.filter(Boolean).map(line => {
    const p = document.createElement('p');
    const spoken = typeof line === 'string' && line.match(/^([^「]{1,24})\s*「(.+)」$/u);
    if (spoken) {
      const speaker = document.createElement('strong');
      speaker.className = 'speaker';
      speaker.textContent = spoken[1];
      p.className = 'spoken';
      p.append(speaker,'「' + spoken[2] + '」');
    } else p.textContent = line;
    return p;
  }));
  decoratePanel(title);
  $('panel-buttons').replaceChildren(...buttons.map(([label, callback, disabled, icon]) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.disabled = Boolean(disabled);
    button.onclick = callback;
    if (icon) {
      const symbol = document.createElement('span');
      symbol.className = 'goods-icon';
      symbol.setAttribute('aria-hidden','true');
      symbol.style.backgroundColor = icon;
      button.prepend(symbol);
    }
    return button;
  }));
  $('panel-buttons').querySelector('button:not(:disabled)')?.focus({preventScroll: true});
}
function resume() {
  audio.stopPreview();
  facilityGathering = null;
  paused = false;
  menuActive = false;
  $('pause').setAttribute('aria-expanded','false');
  $('panel').hidden = true;
  document.activeElement?.blur();
}
function enterField() {
  mode = 'field';
  companionTrail.x = player.x - 24;
  companionTrail.y = player.y;
  companionTrail.height = 0;
  otherTrails.clear();
  cat.x = player.x - 18;
  cat.y = player.y;
  setFieldTrack();
  $('hud').hidden = $('pause').hidden = $('actions').hidden = false;
  resume();
}
function arriveHome() {
  done = true;
  mode = 'home';
  save();
  audio.setTrack('ending');
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
  const data = readAdventure();
  const begin = () => {
    audio.setTrack('home');
    panel('小さな家の朝', [
      '貧しい暮らしをしている一美の宝物は、古い剣と愛猫ソソ。ふたりは小さな家で、わずかなパンを分け合って暮らしていた。',
      'ある朝、戸口にソソの足跡と荷車の跡だけが残っていた。一美は剣を手に、ソソを取り戻す旅に出る。'
    ], [['街道へ出る', () => { enterField(); save(); }]]);
  };
  const actions = [['はじめから', () => {
    if (!data || confirm('保存済みの冒険を上書きしますか？')) {
      removeAdventure();
      begin();
    }
  }]];
  if (data) actions.unshift(['冒険を再開', () => {
    load(data);
    enterField();
    if (innPending) resumeInn();
    if (bathPending) resumeBath();
    if (shrineDefeated) {
      player.hp = 0;
      defeat('一美は倒れた', '石碑の反動で一美は力尽きた。');
    }
  }]);
  actions.push(['セーブ枠を選ぶ',showSaveSlots]);
  panel('一美のスター街道', [
    '愛猫ソソをさらわれた一美は、やがて47都道府県を巡る旅に出る。',
    '画面を押したまま指をずらすか、矢印キーで移動。剣を長押しして移動するとダッシュ。下を向いてジャンプボタンを押し続けるとしゃがむ。キーボードはSpaceで剣、Zでジャンプ、Cで魔法、Eで調べる。'
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
  const style = document.createElement('select');
  for (const [value,text] of [['action','アクション'],['command','コマンド']]) {
    style.add(new Option(text,value));
  }
  style.value = battleStyle;
  style.disabled = Boolean(battle);
  style.onchange = () => {
    battleStyle = style.value;
    storage.write('kazumi-battle-style',battleStyle);
  };
  const label = document.createElement('label');
  label.append('戦闘方式 ',style);
  $('panel-body').append(label);
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
  if (innScene || bathScene || doorTransition || quizOpen || shrineDefeated) return;
  if (battle && (!player.hp || joined && !cat.hp)) return;
  if (mode !== 'field' && mode !== 'battle') return;
  audio.stopPreview();
  menuActive = true;
  $('pause').setAttribute('aria-expanded','true');
  const actions = [['閉じる',resume]];
  if (isActionBattle() && learnedSummons().length) actions.push(['召喚魔法',summonMenu]);
  if (isActionBattle()) actions.push(['道具',actionItemMenu],['逃げる',tryEscapeBattle,isFinalBoss(battle.enemy) || clock < (battle.escapeAt || 0)]);
  if (!battle) actions.push(
    ['アイテム', itemMenu], ['魔法', magicMenu], ['装備', ownedEquipment], ['ステータス', statusMenu],
    ['マップ', travelBook], ['セーブ・ロード', saveMenu], ['酒場', () => tavern(true)],
    ['石碑手帳', stoneJournal], ['召喚獣図鑑',summonDex], ['設定', settingsMenu]
  );
  if (!battle && interior) {
    actions.push(['施設の案内', servicePanel, !roomCounterReady()]);
  } else if (!battle) {
    actions.push(['観光案内', tourPanel, !nearScenicSpot()], ['四天王の試練', openTrials, !joined],
      [returning && !done ? '自宅へ向かう' : '先へ進む', () => { guide(); resume(); }]);
  }
  if (battle) actions.push(['契約する',offerCapture,!canCapture()],['酒場',() => tavern(true)],['設定',settingsMenu]);
  panel('メニュー',[],actions);
}

$('pause').onclick = () => {
  if (menuActive) resume();
  else if (!paused) openMenu();
};

function settingsMenu() {
  audio.stopPreview();
  panel('設定',[],[['サウンドテスト',openSoundTest],['メニューに戻る',openMenu]]);
  settings();
}

function statusMenu() {
  const member = currentCompanion();
  panel('ステータス',[
    '一美　Lv.' + level() + '　HP ' + player.hp + '/' + maxHP() + '　MP ' + player.mp + '/' + maxMP(),
    '攻撃 ' + attackPower() + '　防御 ' + defense() + '　経験値 ' + player.xp + '/' + nextXp(),
    '疲労 ' + player.fatigue + '/100',
    '所持金 ' + player.gold + 'G　預金 ' + townBank + 'G',
    prefectures[chapterOf(player.x)].name + '　' + townTime(),
    member ? member.name + ' Lv.' + companionLevel(member) + '　HP ' + member.hp + '/' + companionHP(member) +
      '　MP ' + member.mp + '/' + companionMP(member) + '　好感度 ' + member.affinity : '',
    joined ? 'ソソが同行中' : ''
  ],[['メニューに戻る',openMenu]]);
}

function itemMenu() {
  const owned = marketGoods.filter(item => goodCount(item)>0);
  panel('アイテム',[
    '星の欠片 ×' + player.shards + '　住民の依頼などで使用。',
    owned.length ? '使用対象は一美。回復できる道具を選択。' : '回復に使える道具を持っていない。'
  ],[...owned.map(item => [item.name + ' ×' + goodCount(item) + '　' + goodEffect(item),
    () => useGood(item),!canUseGood(item),item.color]),['メニューに戻る',openMenu]]);
}

function magicMenu() {
  const options = [
    {id:'star',name:'ソソを思う',element:'光',cost:10,hint:'周囲の敵。ボスには耐性があります。',known:true},
    {id:'ring',name:'燐光の火球',element:'炎',cost:4,hint:'前方の敵。指輪から火球を放つ。',known:ring},
    {id:'moon',name:stoneSpell.name,element:'光',cost:stoneSpell.mp,hint:'一美のHPを回復する。',known:stoneMagicLearned},
    ...routeSpells.map(spell=>({...spell,element:({fire:'炎',frost:'氷',thunder:'雷',wind:'風',earth:'土',light:'光'})[spell.id],
      known:stageRuneAvailable(spell.id)}))
  ];
  panel('魔法',options.map(spell=>spell.name+'　'+spell.element+'　MP '+spell.cost+'　'+
    (spell.known ? spell.hint : '未習得。'+(spell.chapter !== undefined ? '指輪と第'+(spell.chapter+1)+'章への到達が必要。' : ''))),
  [...options.filter(spell=>spell.known).map(spell=>[spell.name+'をセット',() => {
    shotGear = spell.id;
    save();
    magicMenu();
  },shotGear === spell.id]),['戻る',openMenu]]);
}

function saveMenu() {
  panel('セーブ・ロード',['セーブ枠 ' + saveSlot + ' を使用中。'],[
    ['保存',() => { save(true); resume(); }],
    ['保存済みの冒険を開く',() => { if (confirm('保存した時点に戻りますか？')) location.reload(); },!readAdventure()],
    ['別のセーブ枠を開く',showSaveSlots],
    ['最初から',() => {
      if (confirm('現在の冒険を消して、最初から遊びますか？')) {
        removeAdventure();
        location.reload();
      }
    }], ['メニューに戻る',openMenu]
  ]);
}

function removeAdventure() {
  try {
    localStorage.removeItem(saveKey);
    localStorage.removeItem(saveKey + '-backup');
  } catch {}
}

function showSaveSlots() {
  const buttons = [1,2,3].map(slot => {
    const info = readAdventure(slotKey(slot));
    const data = info ? '第' + (chapterOf(info.x || 0)+1) + '章' : '空き';
    return ['セーブ枠 '+slot+'　'+data,() => {
      if (storage.write('kazumi-slot',slot)) location.reload();
    },slot === saveSlot];
  });
  panel('セーブ枠',['切り替えると、そのセーブ枠のタイトルに戻ります。'],[...buttons,['戻る',saveMenu]]);
}

function useHerb() {
  if (!player.herbs || player.hp >= maxHP() || battle) return;
  player.herbs--;
  player.hp = Math.min(maxHP(), player.hp + 35);
  save();
  resume();
  say('薬草でHPを回復した。');
}

function ownedEquipment() {
  const current = equipped('armor');
  const offers = [
    ['メニューに戻る',openMenu],
    ['武器・魔法の付け替え',actionEquipment]
  ];
  function wear(item,label,change) {
    offers.push([label + '（防御 ' + (item.bonus >= current.bonus ? '+' : '') + (item.bonus-current.bonus) + '）',() => {
      armorBase = stoneArmor = trialGear.armor = regionalGear.armor = null;
      change();
      save();
      ownedEquipment();
    },item === current]);
  }
  for (const [i,item] of equipment.armor.slice(0,player.armor+1).entries()) {
    wear(item,item.name,() => { armorBase = i; });
  }
  for (const id of clearedTrials) {
    if (trials[id].armor) wear(trials[id].reward,trials[id].reward.name,() => { trialGear.armor = id; });
  }
  for (const [id,entry] of tourBook.entries()) {
    if (entry?.armor) wear(prefectures[id].armor,prefectures[id].armor.name,() => { regionalGear.armor = id; });
  }
  if (shieldOwned) offers.push([shieldEquipped ? '木枠の盾を外す' : '木枠の盾を装備',() => {
    shieldEquipped = !shieldEquipped;
    save();
    ownedEquipment();
  }]);
  for (const stone of waysideStones) {
    const item = unlockedStoneArmor(stone.id);
    if (item) wear(item,item.name,() => { stoneArmor = stone.id; });
  }
  panel('所持装備',[
    '武器 ' + equipped('weapon').name + '　攻撃 +' + equipped('weapon').bonus,
    '防具 ' + current.name + '　防御 +' + current.bonus,
    '盾 ' + (shieldEquipped ? '木枠の盾（防御時の軽減率が上昇）' : 'なし'),
    'アクセサリー ' + (shotGear === 'moon' ? stoneSpell.name : shotGear === 'star' ? '星の護符' : starterRing.name)
  ],offers);
}

function openTrials() {
  panel('四天王の試練', ['本編とは独立した闘技場。勝つと限定装備と称号を獲得する。',
    '称号 ' + ([...clearedTrials].map(index => trials[index].title).join('、') || 'なし')
  ], [['メニューに戻る', openMenu], ...trials.map(trial => [trial.name, () => {
    trialVitals = {hp: player.hp, mp: player.mp, herbs: player.herbs, pack:{...pack}, remaining: Math.max(0, specialAt - clock)};
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
  restorePack(trialVitals.pack);
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
  audio.setTrack(fieldTrack(),'riddle');
  const question = shrineQuestion(shrine, chapter);
  save();
  function close() {
    quizOpen = false;
    delete $('panel').dataset.quiz;
    setFieldTrack();
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
          } else {
            grantStoneReward(shrine);
            panel('正解・' + shrine.name,[question.answer,question.hint,'獲得　' + stoneRewardLabel(shrine)],[['旅に戻る',resume]]);
          }
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
  if (isActionBattle()) {
    player.facing = directionTo(dx,dy,player.facing);
    const underBoss = battle.body.size >= 4.5 && (pressed('crouch') || dashMotion);
    moveArena('hero',dx,dy,distance,groupBlockers(null,underBoss));
    return;
  }
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
  if (clock < attackAt || battle?.command) return;
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
  const sound = charged || finisher ? 'special' : airborne ? 'air' : 'attack';
  if (isActionBattle()) {
    const delay = charged ? .145 : burden >= 2 ? .12 : .067;
    battle.heroStrike = {
      at:clock+delay, direction:{...player.facing}, reach, width:form.width,
      technique:charged ? 'charge' : airborne ? 'air' : 'blade', power,sound
    };
    swingUntil = Math.max(swingUntil,clock+delay+.13);
    return;
  }
  audio.play(sound);
  const chapter = chapterOf(player.x);
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !enemyOnField(enemy) || isFinalBoss(enemy)) continue;
    if (aligned(enemy.x, enemy.y, reach, form.width * .75)) hurtFieldEnemy(enemy,power);
    if (paused) break;
  }
  if (!paused) {
    strikePots(reach, 13);
    cutNearbyStageProp(reach,form.width,charged);
    const stone = stonesByChapter[chapter].find(mark =>
      !mark.solved && jumpHeight < 32 && aligned(mark.x,mark.row,reach + 10,form.width + 4));
    if (stone) {
      sealEffect = {x:stone.x,y:stone.row,until:clock+.9};
      audio.play('seal');
      stone.seen = true;
      openShrine(stone,chapter);
    }
  }
}

let dodgeAt = 0;
function dodge() {
  if (clock < dodgeAt) return;
  beginDash(true);
  if (dashMotion?.emergency) dodgeAt = clock + .85;
}

function special() {
  if (isActionBattle()) return actionThinkOfSoso();
  if (clock < specialAt || player.mp < 10) return;
  const targets = activeEnemies(chapterOf(player.x)).filter(enemy =>
    enemy.hp && enemyOnField(enemy) && !isFinalBoss(enemy) && Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 105);
  if (!targets.length) return say('近くに敵がいない。');
  player.mp -= 10;
  specialAt = clock + 15;
  burstUntil = clock + .55;
  audio.play('special');
  say('ソソを思う！');
  for (const enemy of targets) {
    const power = attackPower() * 5 + 30 + Math.min(player.shards, 36);
    hurtFieldEnemy(enemy,enemy.boss ? Math.min(Math.ceil(enemy.max*.65),power) : enemy.hp);
  }
  save();
}

function addNumber(text, x, y, color, field = false) {
  numbers.push({text: String(text), x, y, color, field, expires: clock + .7});
}
function hurtFieldEnemy(enemy, damage) {
  const protectedEncounter = enemy.boss || ['elite','raid'].includes(encounterKind(enemy));
  if (protectedEncounter) {
    const floor = Math.min(enemy.hp,Math.ceil(enemy.max*.65));
    const loss = Math.min(damage,enemy.hp-floor);
    if (loss > 0) hurtEnemy(enemy,loss);
    return;
  }
  hurtEnemy(enemy,damage);
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
  const reinforcementsDefeated = battle?.group.members.filter(foe=>!foe.leader && !foe.summoned && foe.state === 'defeated').length ?? 0;
  const xp = (enemy.boss ? 44 : 7) + enemy.chapter * (enemy.boss ? 4 : 2) + reinforcementsDefeated * (4 + enemy.chapter);
  const gold = (enemy.boss ? 32 : 6) + enemy.chapter + reinforcementsDefeated * (3 + Math.floor(enemy.chapter / 2));
  player.xp += xp;
  awardCompanion(xp);
  player.gold = Math.min(bankLimit,player.gold+gold);
  player.herbs = Math.min(10000,player.herbs+1);
  if (battle) {
    battle = null;
    flameBolts = [];
    resetCat();
    resetJump();
    mode = 'field';
    player.facing = {x: 1, y: 0};
    fieldSafeUntil = clock + 1.2;
    swingUntil = clock;
    numbers.splice(0);
    setFieldTrack();
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
    audio.setTrack('soso');
    panel('第10章クリア・ソソが仲間になった', [
      '「気まぐれで私の膝に乗っただけの猫だと思った」アウレリオは檻の鍵を落とした。「だが、あの力を見て、連れ去ることにした」',
      '世界最強のソソは、一美の足もとでおなかを見せた。けれど空の亀裂を見ると、毛を逆立てて一美の隣に並んだ。',
      'ソソは戦闘が続くと覚醒する。必殺技で二人の力を合わせよう。'
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
      rememberEncounterDamage();
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
  const action = battleStyle === 'action';
  clearInput(action);
  resetCat();
  resetJump();
  const group = createEnemyGroup(enemy);
  if (!trialVitals) {
    const cost = enemy.boss ? 10 : 5;
    player.fatigue = Math.min(100,player.fatigue+cost);
    for (const member of activeCompanions()) member.fatigue = Math.min(100,(member.fatigue || 0)+cost);
  }
  const leader = group.members[0].unit;
  battle = action ? createActionBattle(leader,approach) : createBattle(leader);
  battle.group = group;
  defeatedFoe = null;
  mode = 'battle';
  player.facing = {x: 1, y: 0};
  swingUntil = clock;
  bladeChain = chainUntil = 0;
  invulnerableUntil = clock;
  audio.play('encounter');
  setEncounterTrack(enemy);
  say('');
  if (action) startActionBattle(leader,approach);
  else startCommandBattle(leader,approach);
}

function setEncounterTrack(enemy) {
  if (isFinalBoss(enemy)) audio.setTrack('boss','finalboss');
  else audio.setTrack(enemy.trial !== undefined ? 'emperor' + enemy.trial :
    enemy.rank === 'mid' ? 'midboss' : enemy.boss ? 'boss' : 'battle');
}

function tryEscapeBattle() {
  if (!battle || isFinalBoss(battle.enemy) || clock < (battle.escapeAt || 0)) return;
  const {enemy,command} = battle;
  const slowed = command ? command.allies[0].status?.type === 'chill' : clock < footingUntil;
  const heroSpeed = 124 + level() * 2;
  const chance = clamp((enemy.boss ? .33 : .71) + (heroSpeed - enemy.speed * 1.55) * .003 -
    (slowed ? .21 : 0) - (enemy.trial !== undefined ? .14 : 0),.15,.93);
  if (Math.random() < chance) return escapeBattle();

  if (menuActive) resume();
  if (command) {
    command.plan = [];
    command.failedEscape = true;
    startCommandRound();
    command.log = '逃走失敗！　敵が反撃する。';
    updateCommandUI();
  } else {
    battle.escapeAt = clock + 2.7;
    for (const foe of livingEnemies(battle.group)) foe.nextAt = Math.min(foe.nextAt,clock+.24+foe.index*.22);
    say('逃走に失敗した！　戦闘を続けよう。',3);
  }
}

function escapeBattle() {
  if (trialVitals) {
    leaveTrial();
    save();
    say('試練から離脱した。');
    return;
  }
  if (!battle) return;
  rememberEncounterDamage();
  ({x:player.x, y:player.y} = battle.entry);
  battle = null;
  clearInput();
  resetJump();
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
  setFieldTrack();
  if (returning && !done && closeTo(25, 104, 14)) return arriveHome();
  const nearbyNpc = npcs.find(npc => !player.party.includes(npc.name) && closeTo(npc.x, 104, 13));
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
    if (!enemy.hp || !enemyOnField(enemy) || (returning && !done)) continue;
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

function update(dt, elapsed = dt) {
  if (paused || (mode !== 'field' && mode !== 'battle')) return;
  clock += dt;
  if (battle?.command?.phase !== 'select') tickTown(elapsed * 150);
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
    if (battle.command) updateCommandBattle(dt);
    else {
      updateJump(dt);
      if (movementAllowed()) {
        if (battle.auto) updateActionAuto(dt);
        else moveWithInput(dt);
      }
      updateFireballs(dt);
      if (isActionBattle() && !paused) updateActionBattle(dt);
    }
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
  $('game').dataset.battle = battle?.command ? 'command' : battle ? 'action' : '';
  $('pause').hidden = Boolean(innScene || bathScene) || mode === 'title' || mode === 'home';
  const playing = (mode === 'field' || mode === 'battle') && !bathScene;
  const exploring = mode === 'field' && !innScene && !bathScene;
  const action = isActionBattle();
  $('joystick').hidden = joystick.id === null || !exploring && !action;
  $('joystick').setAttribute('aria-disabled',String(!movementAllowed()));
  $('actions').hidden = !exploring;
  $('hud').hidden = !playing || Boolean(battle?.command) || Boolean(innScene);
  $('battle-commands').hidden = !battle?.command;
  $('arena-actions').hidden = !action;
  $('arena-actions').inert = !movementAllowed();
  $('arena-status').hidden = !action;
  if (action) updateActionStatus();
  $('battle-commands').inert = paused;
  $('actions').inert = !movementAllowed();
  attackButton.dataset.charge = String(!bDashUsed && chargeStarted !== null && clock - chargeStarted >= .58);
  updatePlaceTitle();
  $('town-clock').hidden = mode === 'title';
  $('town-clock').textContent = townTime();
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

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load',() => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  },{once:true});
}
