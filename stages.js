const routeSpells = [
  {id:'fire', name:'火種の術', cost:4, chapter:0, color:'#ff9961', hint:'氷の壁を溶かし、蔓に火をつける。'},
  {id:'frost', name:'霜渡り', cost:5, chapter:2, color:'#a4e2ff', hint:'水を凍らせ、渡れる足場を作る。'},
  {id:'thunder', name:'雷の呼び水', cost:5, chapter:4, color:'#ffda7c', hint:'古い昇降機を起動する。'},
  {id:'wind', name:'風の階段', cost:5, chapter:6, color:'#a1ead4', hint:'上昇気流を生み、高所に届く。'},
  {id:'earth', name:'土の足掛け', cost:5, chapter:8, color:'#edc99c', hint:'岩をせり上げ、足場を作る。'},
  {id:'light', name:'明かり導き', cost:6, chapter:10, color:'#fff4aa', hint:'暗がりを照らし、隠された通路を見つける。'}
];
const routeSpellById = new Map(routeSpells.map(spell => [spell.id,spell]));
const stageProps = {
  grass:{name:'草むら', color:'#86ad74', width:9, depth:7, height:5, solid:false},
  crate:{name:'木箱', color:'#ad7d53', width:9, depth:9, height:14, solid:true},
  barrel:{name:'樽', color:'#946845', width:9, depth:8, height:15, solid:true},
  vine:{name:'蔓', color:'#7ba472', width:10, depth:10, height:33, solid:true},
  wall:{name:'ひび割れた壁', color:'#a29abb', width:8, depth:11, height:27, solid:true},
  rope:{name:'吊り縄', color:'#d5b382', width:8, depth:7, height:36, solid:false},
  switch:{name:'刃押しの仕掛け', color:'#93bdc7', width:8, depth:6, height:13, solid:false}
};
const stageThemeHazard = {forest:'falling', coast:'swing', mountain:'rolling', water:'crumble',
  sand:'quicksand', snow:'ice', river:'spikes'};
const hazardNames = {falling:'落石', swing:'振り子', rolling:'転がる岩', crumble:'崩れる橋',
  quicksand:'流砂', ice:'氷の床', spikes:'トゲ', lava:'溶岩', pit:'縦穴'};
const stagePaths = prefectures.map((region, chapter) => {
  const left = chapter * span;
  const row = (chapter % 2 ? 145 : 65) + chapter % 3 * 4;
  const hazard = region.name === '鹿児島県' ? 'lava' : region.name === '東京都' ? 'pit' :
    stageThemeHazard[region.terrain];
  const propType = Object.keys(stageProps)[chapter % 7];
  const prop = {kind:propType, x:left + 446 + chapter % 4 * 9, y:row, ...stageProps[propType]};
  const trap = {kind:hazard, x:left + 535 + chapter % 4 * 10, y:row, width:23, depth:8, height:12};
  const spell = routeSpells[(chapter + Math.floor(chapter / 6)) % routeSpells.length];
  const rune = {spell, x:left + 726 + chapter % 4 * 6, y:row+21, width:13, depth:10, height:spell.id === 'fire' ? 26 : 10};
  if (spell.id === 'frost' && fieldLayouts[chapter].water) rune.y = riverY(rune.x,chapter);
  const cache = {x:rune.x + 34, y:rune.y + 2};
  const refuge = spell.id === 'light' ? {id:'trail-' + chapter, chapter, kind:'trailroom',
    x:cache.x, row:cache.y, upper:chapter % 2 === 0} : null;
  if (refuge) townSites.set(refuge.id,refuge);
  return {chapter, prop, trap, rune, cache, refuge};
});
const cutStageProps = new Set();
const activatedRunes = new Set();
const stageClaims = new Set();
let stageCrumbles = null;
let stageMagicEffect = null;
let stageWindLift = false;

function restoreStage(data) {
  for (const [key, records] of Object.entries({cut:cutStageProps, runes:activatedRunes, claims:stageClaims})) {
    for (const id of Array.isArray(data?.[key]) ? data[key] : []) {
      if (Number.isInteger(id) && id >= 0 && id <= last) records.add(id);
    }
  }
}

function stageSnapshot() {
  return {cut:[...cutStageProps], runes:[...activatedRunes], claims:[...stageClaims]};
}

function stageBlocking(x,y) {
  const path = stagePaths[chapterOf(x)];
  if (!cutStageProps.has(path.chapter) && path.prop.solid && jumpHeight < path.prop.height &&
      atFootprint(x,y,path.prop)) return true;
  return !activatedRunes.has(path.chapter) && ['fire','frost'].includes(path.rune.spell.id) &&
    jumpHeight < path.rune.height && atFootprint(x,y,path.rune);
}

function stageSurface(path) {
  const {chapter, trap, rune} = path;
  if (trap.kind === 'crumble' && (stageCrumbles?.chapter !== chapter || clock < stageCrumbles.until)) {
    return {...trap, stage:'crumble'};
  }
  if (!activatedRunes.has(chapter)) return null;
  if (rune.spell.id === 'thunder') {
    return {...rune, x:rune.x + 14, width:16, height:16 + Math.sin(clock * 1.5) * 11, moving:true, stage:'hoist'};
  }
  if (rune.spell.id === 'earth') return {...rune, x:rune.x + 11, height:24, stage:'earth'};
  if (rune.spell.id === 'frost') return {...rune, width:27, height:12, stage:'frost'};
  return null;
}

function stageRuneAvailable(id) {
  const spell = routeSpellById.get(id);
  return ring && spell && checkpoint >= spell.chapter;
}

function stageRuneTarget(id) {
  const path = stagePaths[chapterOf(player.x)];
  const {rune, prop, chapter} = path;
  if (id === 'fire' && !cutStageProps.has(chapter) && prop.kind === 'vine' &&
      aligned(prop.x,prop.y,92,19)) return prop;
  if (rune.spell.id !== id || activatedRunes.has(chapter)) return null;
  return closeTo(rune.x,rune.y,24) || aligned(rune.x,rune.y,92,19) ? rune : null;
}

function useRouteSpell(id) {
  const spell = routeSpellById.get(id);
  if (!stageRuneAvailable(id) || player.mp < spell.cost || clock < magicAt) return;
  const target = stageRuneTarget(id);
  if (!target) {
    if (id === 'fire') castMagic();
    else say(spell.hint);
    return;
  }
  const path = stagePaths[chapterOf(player.x)];
  player.mp -= spell.cost;
  magicAt = clock + .7;
  stageMagicEffect = {x:target.x, y:target.y, color:spell.color, until:clock + .78};
  if (target === path.prop) cutStageObject(path);
  else {
    activatedRunes.add(path.chapter);
    audio.play('magic');
    say('仕掛けが反応した。先に隠し物があるようだ。');
    save();
  }
}

function cutStageObject(path) {
  if (cutStageProps.has(path.chapter)) return;
  cutStageProps.add(path.chapter);
  const gold = 2 + path.chapter % 5;
  player.gold = Math.min(bankLimit,player.gold + gold);
  if (path.prop.kind === 'crate' || path.prop.kind === 'barrel') player.herbs = Math.min(10000,player.herbs + 1);
  audio.play('pot');
  say(path.prop.name + 'を壊した。' + gold + 'Gを拾った。');
  save();
}

function cutNearbyStageProp(reach,width,charged) {
  const path = stagePaths[chapterOf(player.x)];
  const {prop} = path;
  if (prop.kind === 'wall' && !charged || prop.kind === 'rope' && jumpHeight < 12) return;
  if (aligned(prop.x,prop.y,reach + prop.width,width) && jumpHeight <= prop.height + 14) cutStageObject(path);
}

function stageHazardPose(trap) {
  const cycle = ((clock + trap.x * .013) % 3.2) / 3.2;
  if (trap.kind === 'rolling') return {x:trap.x + (cycle - .5) * 100, y:trap.y, height:9, active:cycle > .11 && cycle < .89};
  if (trap.kind === 'falling') return {x:trap.x,y:trap.y,height:cycle < .52 ? 48 : Math.max(0,48-(cycle-.52)*260),active:cycle > .66 && cycle < .90};
  if (trap.kind === 'swing') return {x:trap.x + Math.sin(clock*2.2) * 26,y:trap.y,height:13 + (1-Math.abs(Math.sin(clock*2.2))) * 12,active:true};
  return {...trap, active:true};
}

function stageHazards(dt, path) {
  const {trap, rune} = path;
  if (stageCrumbles && (stageCrumbles.chapter !== path.chapter || !atFootprint(player.x,player.y,trap) ||
      clock > stageCrumbles.until + 1.6)) stageCrumbles = null;
  if (trap.kind === 'crumble' && groundedOn?.stage === 'crumble' && !stageCrumbles) {
    stageCrumbles = {chapter:path.chapter,until:clock+.54};
    audio.play('quake');
  }
  const nearWind = rune.spell.id === 'wind' && activatedRunes.has(path.chapter) &&
    Math.abs(player.x - rune.x) < 31 && Math.abs(player.y - rune.y) < 13;
  if (!jumpHeight) stageWindLift = false;
  if (nearWind && jumpHeight > 3 && jumpVelocity > 0 && !stageWindLift) {
    jumpVelocity += 96;
    stageWindLift = true;
    audio.play('air');
  }
  const danger = stageHazardPose(trap);
  if (!danger.active || !atFootprint(player.x,player.y,{...trap,x:danger.x}) ||
      jumpHeight > danger.height + (trap.kind === 'swing' ? 6 : 3)) return false;
  if (trap.kind === 'quicksand') {
    const sink = 21 * dt;
    player.x += Math.sign(trap.x - player.x) * sink;
    player.y += Math.sign(trap.y - player.y) * sink;
    return false;
  }
  if (trap.kind === 'ice' || trap.kind === 'crumble' && (!stageCrumbles || clock < stageCrumbles.until)) return false;
  if (clock < invulnerableUntil || clock < fieldSafeUntil) return false;
  const hard = ['pit','lava','crumble'].includes(trap.kind);
  const damage = Math.ceil(maxHP() * (hard ? .11 : .07));
  invulnerableUntil = clock + 1.25;
  player.hp = Math.max(0,player.hp-damage);
  flashUntil = clock + .20;
  addNumber('−' + damage,player.x,player.y-16,'#ffa7a7',true);
  audio.play('hit');
  if (!player.hp) {
    defeat('一美は倒れた',hazardNames[trap.kind] + 'で力尽きた。');
    return true;
  }
  if (hard) {
    player.y = clamp(trap.y + 17,fieldTop,fieldBottom);
    resetJump();
  }
  return false;
}

function findStageCache(path) {
  if (path.refuge || !activatedRunes.has(path.chapter) || stageClaims.has(path.chapter) ||
      !closeTo(path.cache.x,path.cache.y,10)) return;
  if (['wind','thunder','earth'].includes(path.rune.spell.id) && jumpHeight < 14) return;
  claimStageCache(path);
}

function claimStageCache(path) {
  if (!activatedRunes.has(path.chapter) || stageClaims.has(path.chapter)) return;
  stageClaims.add(path.chapter);
  const gold = 14 + path.chapter * 2;
  player.gold = Math.min(bankLimit,player.gold + gold);
  player.herbs = Math.min(10000,player.herbs + 2);
  audio.play('stoneReward');
  say('脇道の宝箱から ' + gold + 'G と薬草2個を見つけた。');
  save();
}
