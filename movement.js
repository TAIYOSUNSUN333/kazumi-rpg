const walkPace = 86;
let bDashUsed = false;
let touchCrouch = false;
let runBlend = 0;
let stepAt = 0;
let runDust = null;
const roofHeight = 40;
let gait = 'idle';
let wallContact = null;
let wallGraceUntil = 0;
let climbing = false;
let groundedOn = null;
let landedUntil = 0;
let wallKickUntil = 0;
let airDashUsed = false;
let dashMotion = null;
let dashReady = 0;
let chargeStarted = null;
let uprightAt = 0;
const trailCaches = new Set();
const featureCache = [];
const roofCache = new WeakMap();

function movementAllowed() {
  return !paused && !doorTransition && !innScene &&
    (mode === 'field' || isActionBattle() && battle.age >= .36 && player.hp > 0 && (!joined || cat.hp > 0));
}

function playableInput() {
  const x = Number(pressed('right')) - Number(pressed('left')) + joystick.x;
  const y = Number(pressed('down')) - Number(pressed('up')) + joystick.y;
  const magnitude = Math.min(1, Math.hypot(x,y));
  const running = magnitude > .15 && chargeStarted !== null && pressed('attack') &&
    clock - chargeStarted >= .17 && !pressed('guard') && !pressed('crouch');
  return {x,y,magnitude,running};
}

function motionFeatures(chapter) {
  const cached = featureCache[chapter];
  if (cached?.time === clock) return cached;
  const x = chapter * span;
  const features = {
    time:clock,
    lift:{x:x + 499 + Math.sin(clock * 1.65 + chapter * .2) * 31, y:163, width:25, depth:15, height:26, moving:true},
    ledge:{x:x + 583, y:168, width:30, depth:14, height:44},
    tunnel:{x:x + 677, y:172, width:17, depth:10}
  };
  featureCache[chapter] = features;
  return features;
}

function roofSurface(site) {
  if (!roofCache.has(site)) roofCache.set(site,{
    x:site.x,y:site.upper ? site.row-14.5 : site.row+14,
    width:site.width || 18,depth:site.upper ? 9.5 : 8,height:site.height || roofHeight,site
  });
  return roofCache.get(site);
}

function atFootprint(x,y,shape) {
  return Math.abs(shape.x - x) < shape.width && Math.abs(shape.y - y) < shape.depth;
}

function surfacesAt(x,y) {
  const town = towns[chapterOf(x)];
  const {lift,ledge} = motionFeatures(town.chapter);
  const stage = stageSurface(stagePaths[town.chapter]);
  const roof = town.sites.find(site => site.kind !== 'secret' && atFootprint(x,y,roofSurface(site)));
  return [roof && roofSurface(roof), atFootprint(x,y,lift) && lift, atFootprint(x,y,ledge) && ledge, stage && atFootprint(x,y,stage) && stage]
    .filter(Boolean);
}

function nearbyLadder() {
  if (interior || battle) return null;
  const site = towns[chapterOf(player.x)].sites.find(site => site.kind !== 'secret' &&
    Math.abs(player.x - (site.x + 15)) <= 7 && Math.abs(player.y - (site.upper ? site.row-9 : site.row+10)) <= 15);
  return site ? roofSurface(site) : null;
}

function floorUnderHero() {
  if (battle || interior) return 0;
  return surfacesAt(player.x,player.y).reduce((height, surface) =>
    surface.height <= jumpHeight + .35 ? Math.max(height,surface.height) : height,0);
}

function fieldBarrier(x,y) {
  const stage = stagePaths[chapterOf(x)];
  const frozen = stage.rune.spell.id === 'frost' && activatedRunes.has(stage.chapter) && Math.abs(x-stage.rune.x)<29;
  if (waterBlocks(x,y) && jumpHeight < 17 && !frozen || stageBlocking(x,y)) return true;
  const {tunnel} = motionFeatures(chapterOf(x));
  if (atFootprint(x,y,tunnel) && !pressed('crouch') && jumpHeight < 30) return true;
  return surfacesAt(x,y).some(surface => !surface.moving && !surface.stage && jumpHeight + .25 < surface.height);
}

function fieldStepClear(x,y,toX,toY) {
  const steps = Math.max(1,Math.ceil(Math.hypot(toX-x,toY-y) / 4));
  for (let step=1; step<=steps; step++) {
    if (fieldBarrier(x + (toX-x)*step/steps,y + (toY-y)*step/steps)) return false;
  }
  return true;
}

function discoverTrailCache(chapter) {
  if (jumpHeight > 4 || !pressed('crouch') || trailCaches.has(chapter)) return;
  const tunnel = motionFeatures(chapter).tunnel;
  if (!atFootprint(player.x,player.y,tunnel)) return;
  trailCaches.add(chapter);
  player.gold = Math.min(bankLimit,player.gold + 6 + chapter % 5);
  player.herbs++;
  audio.play('pot');
  say('岩のすき間で旅人の隠し物を見つけた。');
  save();
}

function resetMovement() {
  wallContact = null;
  wallGraceUntil = 0;
  climbing = false;
  groundedOn = null;
  landedUntil = 0;
  wallKickUntil = 0;
  airDashUsed = false;
  dashMotion = null;
  gait = 'idle';
  runBlend = 0;
  runDust = null;
}

function beginDash(emergency = false) {
  if (!movementAllowed() || interior || clock < dashReady || dashMotion) return;
  const airborne = jumpHeight > floorUnderHero() + 4;
  if (airborne && airDashUsed) return;
  const {x,y,magnitude} = playableInput();
  const heading = magnitude > .12 ? directionTo(x,y) : player.facing;
  if (airborne) {
    airDashUsed = true;
    jumpVelocity = Math.max(jumpVelocity, 10);
  }
  climbing = false;
  dashMotion = {heading, until:clock + (emergency ? .21 : .19), emergency};
  dashReady = clock + (emergency ? .85 : .36);
  if (emergency) invulnerableUntil = clock + .27;
  audio.play('jump');
}

function beginCharge() {
  if (chargeStarted !== null || pressed('guard')) return;
  chargeStarted = clock;
  bDashUsed = false;
}

function endCharge() {
  const started = chargeStarted;
  chargeStarted = null;
  const wasDash = bDashUsed;
  bDashUsed = false;
  if (started === null || wasDash || !movementAllowed() || interior || pressed('guard')) return;
  swing(clock - started >= .58);
}

function followGuide(dt) {
  const route = destination;
  const target = route.detour?.[0] || route;
  const distance = Math.hypot(target.x - player.x,target.y - player.y);
  if (distance < 3.6) {
    if (route.detour?.length) route.detour.shift();
    else destination = null;
    return;
  }
  gait = 'walk';
  const {x,y} = player;
  movePlayer(target.x-x,target.y-y,Math.min(distance,dt * (returning ? 390 : 83)));
  if (Math.hypot(player.x-x,player.y-y) >= Math.min(.25,dt*30) || interior) return;
  const throughX = x + clamp(route.x-x,-58,58);
  const lanes = [104,86,122,145,65,162].sort((a,b) => Math.abs(y-a)-Math.abs(y-b));
  const lane = lanes.find(row => Math.abs(row-y)>5 && fieldStepClear(x,y,x,row) &&
    fieldStepClear(x,row,throughX,row));
  if (lane !== undefined && Math.abs(throughX-x)>6) route.detour = [{x,y:lane},{x:throughX,y:lane}];
  else if (!jumps && !route.detour?.length) jump();
}

function moveWithInput(dt) {
  const {x,y,magnitude,running} = playableInput();
  const ladder = nearbyLadder();
  if (!ladder) climbing = false;
  if (interactGesture(y,ladder)) return true;
  if (dashMotion && clock < dashMotion.until) {
    gait = 'dash';
    const {heading,emergency} = dashMotion;
    movePlayer(heading.x, heading.y, Math.min(dt,dashMotion.until - clock) * (emergency ? 260 : 340));
    return false;
  }
  dashMotion = null;
  if (wallKickUntil > clock && wallContact) {
    gait = 'wallkick';
    movePlayer(wallContact.x,wallContact.y,dt * 135);
    return false;
  }
  if (ladder && Math.abs(y) >= .4 && Math.abs(x) < .5 && !dashMotion &&
      (y < 0 && jumpHeight < ladder.height || y > 0 && jumpHeight > 0)) {
    climbing = true;
    gait = 'climb';
    destination = null;
    player.x = ladder.site.x + 14;
    player.y = ladder.y;
    jumpVelocity = 0;
    jumpHeight = clamp(jumpHeight - y * dt * 85,0,ladder.height);
    if (jumpHeight === ladder.height || jumpHeight === 0) {
      climbing = false;
      jumps = 0;
      airDashUsed = false;
    }
    return false;
  }
  if (climbing && Math.abs(x) >= .45) climbing = false;
  if (climbing) return false;

  if (running) bDashUsed = true;
  if (magnitude > .01) {
    runBlend += ((running ? 1 : 0) - runBlend) * Math.min(1, dt * (running ? 8 : 12));
    destination = null;
    const pace = walkPace * (.24 + magnitude * .76) * (1 + .8 * runBlend);
    if (runBlend > .44 && clock >= stepAt && jumpHeight <= floorUnderHero() + 4) {
      stepAt = clock + .24;
      audio.play('step');
      const spot = isActionBattle() ? actorPoint('hero') : interior || player;
      runDust = {x:spot.x,y:spot.y,interior,arena:isActionBattle(),until:clock + .24};
    }
    const trap = stagePaths[chapterOf(player.x)].trap;
    const onTrap = !interior && !battle && jumpHeight < 7 && atFootprint(player.x,player.y,trap);
    const terrainPace = onTrap && trap.kind === 'quicksand' ? .44 : onTrap && trap.kind === 'ice' ? 1.23 : 1;
    const fatigue = 1 - player.fatigue*.0009;
    const modifier = fatigue * terrainPace * (clock < footingUntil ? .82 : 1) * (pressed('guard') ? .72 : 1) * (pressed('crouch') ? .51 : 1);
    gait = pressed('crouch') ? 'crouch' : runBlend > .4 ? 'run' : 'walk';
    movePlayer(x,y,dt * pace * modifier);
  } else {
    runBlend = 0;
    gait = pressed('crouch') ? 'crouch' : 'idle';
    if (wallKickUntil <= clock && wallGraceUntil <= clock) wallContact = null;
    if (!battle && destination) followGuide(dt);
  }
  return false;
}

const bladeProfiles = [
  {name:'小刻み打ち', width:18, step:0, chargeReach:19},
  {name:'踏み込み斬り', width:19, step:7, chargeReach:27},
  {name:'半月斬り', width:32, step:0, chargeReach:24},
  {name:'星の大払い', width:25, step:3, chargeReach:45}
];
function bladeForm() {
  if (slashBase !== null) return bladeProfiles[slashBase];
  if (regionalGear.weapon !== null) {
    return [bladeProfiles[1],bladeProfiles[2],bladeProfiles[3]][regionalGear.weapon % 3];
  }
  if (trialGear.weapon !== null) return trialGear.weapon === 0 ? bladeProfiles[3] : bladeProfiles[1];
  return bladeProfiles[player.weapon];
}

function actionEquipment() {
  audio.setTrack(audio.track,'14');
  const weapon = equipped('weapon');
  const chooseBase = index => {
    slashBase = index;
    trialGear.weapon = regionalGear.weapon = null;
    save();
    actionEquipment();
  };
  const buttons = [['戻る',openMenu]];
  for (const [index,item] of equipment.weapon.slice(0,player.weapon + 1).entries()) {
    buttons.push(['斬：' + item.name, () => chooseBase(index), weapon === item]);
  }
  for (const [index,entry] of tourBook.entries()) {
    if (!entry?.weapon) continue;
    const item = prefectures[index].weapon;
    buttons.push(['斬：' + item.name, () => {
      slashBase = trialGear.weapon = null;
      regionalGear.weapon = index;
      save();
      actionEquipment();
    },weapon === item]);
  }
  for (const id of clearedTrials) {
    if (trials[id].armor) continue;
    buttons.push(['斬：' + trials[id].reward.name, () => {
      slashBase = regionalGear.weapon = null;
      trialGear.weapon = id;
      save();
      actionEquipment();
    },weapon === trials[id].reward]);
  }
  for (const [type,label] of [['star','星の護符'],['ring','魔法の指輪']]) {
    buttons.push(['撃：' + label, () => {
      if (type === 'ring' && !ring) return;
      shotGear = type;
      save();
      actionEquipment();
    },shotGear === type || type === 'ring' && !ring]);
  }
  if (stoneMagicLearned) buttons.push(['撃：' + stoneSpell.name, () => {
    shotGear = 'moon';
    save();
    actionEquipment();
  }, shotGear === 'moon']);
  for (const spell of routeSpells.filter(spell => stageRuneAvailable(spell.id))) {
    buttons.push(['撃：' + spell.name, () => {
      shotGear = spell.id;
      save();
      actionEquipment();
    }, shotGear === spell.id]);
  }
  panel('斬撃・魔法の装備', [
    '斬　' + weapon.name + '　' + bladeForm().name,
    routeSpellById.has(shotGear) ? '撃　' + routeSpellById.get(shotGear).hint : shotGear === 'star' ? '撃　星の護符：MP10で必殺技。ソソとの連携に対応。' : shotGear === 'moon' ? '撃　' + stoneSpell.name + '：MP6で一美のHPを回復。' : '撃　魔法の指輪：MP4で飛んでいく火の玉。',
    ring ? '購入・獲得した装備を選べます。' : '魔法の指輪は装備屋・鍛冶屋で入手できます。'
  ],buttons);
}

let flameBolts = [];
function useShot() {
  if (routeSpellById.has(shotGear)) useRouteSpell(shotGear);
  else if (shotGear === 'ring') castMagic();
  else if (shotGear === 'moon') {
    if (player.mp < stoneSpell.mp || player.hp >= maxHP() || clock < magicAt) return;
    magicAt = clock + .55;
    player.mp -= stoneSpell.mp;
    const restored = Math.min(maxHP() - player.hp, Math.ceil(maxHP() * .28));
    player.hp += restored;
    sealEffect = {x:player.x, y:player.y, until:clock + .9};
    addNumber('+' + restored + ' HP', player.x, player.y - 21, '#b4e9bd', true);
    audio.play('holy');
    save();
  } else special();
}

function launchFireball(damage, tint, element) {
  const arena = isActionBattle() ? battle : null;
  const origin = arena ? actorPoint('hero') : player;
  const direction = {...player.facing};
  flameBolts.push({x:origin.x + direction.x * 9,y:origin.y + direction.y * 9,direction,damage,
    height:Math.max(0,jumpHeight), tint, element, arena, distance:0, chapter:chapterOf(player.x)});
}

function updateFireballs(dt) {
  flameBolts = flameBolts.filter(bolt => {
    if (interior || bolt.arena !== battle || bolt.chapter !== chapterOf(player.x)) return false;
    const step = Math.min(dt * 320,starterRing.reach - bolt.distance);
    if (step <= 0) return false;
    const {x,y} = bolt;
    const dx = bolt.direction.x, dy = bolt.direction.y;
    const hits = (tx,ty,radius) => {
      const progress = clamp((tx-x)*dx + (ty-y)*dy,0,step);
      return Math.hypot(tx - x - dx * progress,ty - y - dy * progress) <= radius;
    };
    if (bolt.arena) {
      const target = livingEnemies(battle.group).filter(foe=>{
        const point = actorPoint(foe.key);
        return hits(point.x,point.y,foe.body.radius+8);
      }).sort((a,b)=>arenaDistance({x,y},actorPoint(a.key))-arenaDistance({x,y},actorPoint(b.key)))[0];
      if (target) {
        battle.heroPressure = clock+1.35;
        positionalHit({x:x-dx*14,y:y-dy*14},bolt.damage,'magic',target,bolt.element);
        return false;
      }
    } else {
      const enemy = activeEnemies(bolt.chapter).find(foe =>
        foe.hp && enemyOnField(foe) && !isFinalBoss(foe) && hits(foe.x,foe.y,13));
      if (enemy) {
        hurtFieldEnemy(enemy,bolt.damage);
        return false;
      }
      const pot = pots.slice(bolt.chapter * 3,bolt.chapter * 3 + 3).find(box => !box.broken && hits(box.x,box.y,10));
      if (pot) {
        breakPot(pot);
        return false;
      }
    }
    bolt.x += dx * step;
    bolt.y += dy * step;
    bolt.distance += step;
    return true;
  });
}

function ridePlatform() {
  if (interior || battle || !groundedOn?.moving || jumpHeight !== groundedOn.height) return;
  const chapter = chapterOf(player.x);
  const lift = groundedOn.stage === 'hoist' ? stageSurface(stagePaths[chapter]) : motionFeatures(chapter).lift;
  if (!lift) return;
  player.x += lift.x - groundedOn.x;
  jumpHeight += lift.height - groundedOn.height;
  groundedOn = lift;
}
