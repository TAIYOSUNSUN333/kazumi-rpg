const walkRatio = .66;
const runPace = 142;
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
  return !paused && (mode === 'field' || mode === 'battle') && !doorTransition;
}

function playableInput() {
  const x = Number(pressed('right')) - Number(pressed('left')) + joystick.x;
  const y = Number(pressed('down')) - Number(pressed('up')) + joystick.y;
  const magnitude = Math.min(1, Math.hypot(x,y));
  const running = magnitude >= walkRatio && !pressed('guard') && !pressed('crouch');
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
    x:site.x,y:site.upper ? 41.5 : 167,width:18,depth:site.upper ? 9.5 : 8,height:roofHeight,site
  });
  return roofCache.get(site);
}

function atFootprint(x,y,shape) {
  return Math.abs(shape.x - x) < shape.width && Math.abs(shape.y - y) < shape.depth;
}

function surfacesAt(x,y) {
  const town = towns[chapterOf(x)];
  const {lift,ledge} = motionFeatures(town.chapter);
  const roof = town.sites.find(site => site.kind !== 'secret' && atFootprint(x,y,roofSurface(site)));
  return [roof && roofSurface(roof), atFootprint(x,y,lift) && lift, atFootprint(x,y,ledge) && ledge]
    .filter(Boolean);
}

function nearbyLadder() {
  if (interior || battle) return null;
  const site = towns[chapterOf(player.x)].sites.find(site => site.kind !== 'secret' &&
    Math.abs(player.x - (site.x + 15)) <= 7 && Math.abs(player.y - (site.upper ? 47 : 163)) <= 15);
  return site ? roofSurface(site) : null;
}

function floorUnderHero() {
  if (battle || interior) return 0;
  return surfacesAt(player.x,player.y).reduce((height, surface) =>
    surface.height <= jumpHeight + .35 ? Math.max(height,surface.height) : height,0);
}

function fieldBarrier(x,y) {
  if (waterBlocks(x,y) && jumpHeight < 17) return true;
  const {tunnel} = motionFeatures(chapterOf(x));
  if (atFootprint(x,y,tunnel) && !pressed('crouch') && jumpHeight < 30) return true;
  return surfacesAt(x,y).some(surface => !surface.moving && jumpHeight + .25 < surface.height);
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
  swing();
}

function endCharge() {
  const heldFor = chargeStarted === null ? 0 : clock - chargeStarted;
  chargeStarted = null;
  if (heldFor >= .58 && movementAllowed() && !interior && !pressed('guard')) swing(true);
}

function updateCharge() {
  if (chargeStarted === null || !pressed('attack') || pressed('guard')) return;
  if (clock - chargeStarted >= 1.05) {
    swing(true);
    chargeStarted = clock;
  }
}

function moveWithInput(dt) {
  const {x,y,magnitude,running} = playableInput();
  const ladder = nearbyLadder();
  if (!ladder) climbing = false;
  if (doorStickGesture(y, ladder)) return true;
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

  if (magnitude > .01) {
    destination = null;
    const pace = running ? runPace * (.82 + magnitude * .18) : 64 * (.36 + magnitude * .64);
    const modifier = (clock < footingUntil ? .82 : 1) * (pressed('guard') ? .72 : 1) * (pressed('crouch') ? .51 : 1);
    gait = pressed('crouch') ? 'crouch' : running ? 'run' : 'walk';
    movePlayer(x,y,dt * pace * modifier);
  } else {
    gait = pressed('crouch') ? 'crouch' : 'idle';
    if (wallKickUntil <= clock && wallGraceUntil <= clock) wallContact = null;
    if (!battle && destination) {
      const dx = destination.x - player.x, dy = destination.y - player.y;
      const distance = Math.hypot(dx,dy);
      if (distance < 1) destination = null;
      else {
        gait = 'walk';
        movePlayer(dx,dy,Math.min(distance,dt * (returning ? 390 : 83)));
      }
    }
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
  panel('斬・撃の装備', [
    '斬　' + weapon.name + '　' + bladeForm().name,
    shotGear === 'star' ? '撃　星の護符：MP10で必殺技。ソソとの連携に対応。' : '撃　魔法の指輪：MP4で飛んでいく火の玉。',
    ring ? '購入・獲得した装備を選べます。' : '魔法の指輪は装備屋・鍛冶屋で入手できます。'
  ],buttons);
}

let flameBolts = [];
function useShot() {
  if (shotGear === 'ring') castMagic(true);
  else special();
}

function launchFireball(damage) {
  const origin = battle ? actorPoint('hero') : player;
  const direction = {...player.facing};
  flameBolts.push({x:origin.x + direction.x * 9,y:origin.y + direction.y * 9,direction,damage,
    battle, height:Math.max(0,jumpHeight), distance:0, chapter:chapterOf(player.x)});
}

function updateFireballs(dt) {
  flameBolts = flameBolts.filter(bolt => {
    if (interior || bolt.battle !== battle || !battle && bolt.chapter !== chapterOf(player.x)) return false;
    const step = Math.min(dt * 320,starterRing.reach - bolt.distance);
    if (step <= 0) return false;
    const {x,y} = bolt;
    const dx = bolt.direction.x, dy = bolt.direction.y;
    const hits = (tx,ty,radius) => {
      const progress = clamp((tx-x)*dx + (ty-y)*dy,0,step);
      return Math.hypot(tx - x - dx * progress,ty - y - dy * progress) <= radius;
    };
    if (battle) {
      if (hits(battle.enemyX,battle.enemyY,battle.body.radius + 8)) {
        const approach = {x:x - dx * 20,y:y - dy * 20};
        battle.heroPressure = clock + 1.35;
        positionalHit(approach,bolt.damage,'magic');
        return false;
      }
    } else {
      const enemy = activeEnemies(bolt.chapter).find(foe =>
        foe.hp && unlocked(foe) && !isFinalBoss(foe) && hits(foe.x,foe.y,13));
      if (enemy) {
        hurtEnemy(enemy,bolt.damage);
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
  const lift = motionFeatures(chapterOf(player.x)).lift;
  player.x += lift.x - groundedOn.x;
  groundedOn = lift;
}
