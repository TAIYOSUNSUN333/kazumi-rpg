const arenaLimits = {left:25, right:615, back:44, front:272};
const arenaHero = {radius:9};
const arenaAlly = {radius:8};
const arenaCat = {radius:6};
const emperorBodies = [
  {size:4.8, radius:37, speed:.80, width:1.32, motion:'charge'},
  {size:3.4, radius:23, speed:1, width:.80, motion:'float'},
  {size:2.9, radius:21, speed:1.25, width:.88, motion:'duel'},
  {size:6.4, radius:49, speed:.68, width:1.46, motion:'stomp'}
];
const ordinaryBodies = [
  {size:.73, radius:10, speed:1.18, width:1.26, motion:'charge'},
  {size:.38, radius:5, speed:1.34, width:1.22, motion:'scuttle'},
  {size:1.12, radius:11, speed:1.05, width:.87, motion:'duel'},
  {size:.66, radius:8, speed:1.18, width:1.05, motion:'float'}
];

function combatBody(enemy) {
  if (enemy.trial !== undefined) return emperorBodies[enemy.trial];
  if (isFinalBoss(enemy) && enemy.chapter === last && finalPhase(enemy) === 3) {
    return {size:10.8, radius:55, speed:.66, width:1.40, motion:'stomp'};
  }
  if (enemy.rank === 'major' || enemy.hiddenRegion !== undefined) return {
    size: isFinalBoss(enemy) ? 5.6 : 3.15 + enemy.chapter % 6 * .42,
    radius: 29 + enemy.chapter % 6 * 2, speed:.84, width:1.0 + enemy.chapter % 3 * .17,
    motion:enemy.chapter % 3 === 1 ? 'duel' : 'stomp'
  };
  if (enemy.rank === 'mid') return {size:2.15 + enemy.chapter % 5 * .36, radius:23 + enemy.chapter % 5 * 2,
    speed:.93, width:1 + enemy.chapter % 3 * .12, motion:enemy.chapter % 2 ? 'charge' : 'stomp'};
  if (enemy.variant === 0 && enemy.optional) return {size:.46, radius:6, speed:1.32, width:1.28, motion:'scuttle'};
  if (enemy.variant === 1 && enemy.slot >= 4) return {size:1.72 + enemy.chapter % 4 * .23, radius:18, speed:.82,
    width:1.43, motion:'stomp'};
  return ordinaryBodies[enemy.variant ?? 0];
}

function directionTo(dx, dy, fallback = {x:1, y:0}) {
  const length = Math.hypot(dx, dy);
  return length > .001 ? {x:dx / length, y:dy / length} : fallback;
}

function actorPoint(role) {
  return {x:battle[role + 'X'], y:battle[role + 'Y']};
}

function arenaDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveArena(role, dx, dy, distance, blockers = []) {
  if (distance <= 0 || !dx && !dy) return;
  const dir = directionTo(dx, dy);
  const xKey = role + 'X', yKey = role + 'Y';
  const radius = role === 'enemy' ? battle.body.radius : role === 'hero' ? arenaHero.radius :
    role === 'ally' ? arenaAlly.radius : arenaCat.radius;
  const clearance = radius * .56;
  const count = Math.ceil(distance / 7);
  const step = distance / count;
  for (let i = 0; i < count; i++) {
    const x = battle[xKey], y = battle[yKey];
    const canMove = (nextX, nextY, fromX, fromY) => blockers.every(blocker => {
      const oldGap = Math.hypot(fromX - blocker.x, fromY - blocker.y);
      const newGap = Math.hypot(nextX - blocker.x, nextY - blocker.y);
      return newGap >= radius + blocker.radius || newGap > oldGap;
    });
    const nx = clamp(x + dir.x * step, arenaLimits.left + clearance, arenaLimits.right - clearance);
    const ny = clamp(y + dir.y * step, arenaLimits.back + clearance, arenaLimits.front - clearance);
    if (canMove(nx, ny, x, y)) {
      battle[xKey] = nx;
      battle[yKey] = ny;
      continue;
    }
    if (canMove(nx, y, x, y)) battle[xKey] = nx;
    if (canMove(battle[xKey], ny, battle[xKey], y)) battle[yKey] = ny;
  }
}

function enemyBlocker() {
  return {...actorPoint('enemy'), radius:battle.body.radius};
}

function aimHitsEnemy(origin, direction, reach, width) {
  const mark = actorPoint('enemy');
  const dx = mark.x - origin.x, dy = mark.y - origin.y;
  const forward = dx * direction.x + dy * direction.y;
  const across = Math.abs(dx * direction.y - dy * direction.x);
  const radius = battle.body.radius;
  return forward > 0 && forward <= reach + radius && across <= width + radius * .74;
}

function attackPosition(origin) {
  const enemy = actorPoint('enemy');
  const offset = directionTo(origin.x - enemy.x, origin.y - enemy.y);
  const front = offset.x * battle.enemyFacing.x + offset.y * battle.enemyFacing.y;
  const candidates = [
    currentCompanion()?.hp > 0 && battle.allyPressure > clock ? actorPoint('ally') : null,
    joined && cat.hp > 0 && battle.catPressure > clock ? actorPoint('cat') : null,
    battle.heroPressure > clock ? actorPoint('hero') : null
  ];
  const pincer = candidates.some(candidate => {
    if (!candidate || arenaDistance(origin, candidate) < 12 || arenaDistance(candidate, enemy) > battle.body.radius + 112) return false;
    const opposing = directionTo(candidate.x - enemy.x, candidate.y - enemy.y);
    return opposing.x * offset.x + opposing.y * offset.y <= -.62;
  });
  return pincer ? ['挟撃',1.75] : front <= -.62 ? ['背後',1.5] : front < .58 ? ['側面',1.25] : ['正面',1];
}

function positionalHit(origin, damage) {
  if (battle.enemyEvade > clock) {
    addNumber('回避', battle.enemyX, battleDepth(battle.enemyY) - 28, '#a7d4e7');
    return;
  }
  const [name, multiplier] = attackPosition(origin);
  const enemy = battle.enemy;
  hurtEnemy(enemy, Math.round(damage * multiplier), multiplier > 1 ? name : '');
  if (battle?.enemy === enemy && battle.body.size < 1.5) {
    const away = directionTo(battle.enemyX - origin.x,battle.enemyY - origin.y);
    moveArena('enemy',away.x,away.y,6,[heroBlocker()]);
  }
}

function strikeContains(strike, point, radius = 0) {
  const dx = point.x - strike.x, dy = point.y - strike.y;
  if (strike.wave) return Math.hypot(dx, dy) <= strike.range + radius;
  const forward = dx * strike.direction.x + dy * strike.direction.y;
  const across = Math.abs(dx * strike.direction.y - dy * strike.direction.x);
  return forward >= -radius && forward <= strike.range + radius &&
    across <= strike.width * (.7 + Math.max(0, forward) / strike.range * .3) + radius;
}

function retreatFromStrike(role, distance) {
  const strike = battle.strike;
  const actor = actorPoint(role);
  const side = Math.sign((actor.x - strike.x) * -strike.direction.y +
    (actor.y - strike.y) * strike.direction.x) || (role === 'ally' ? -1 : 1);
  const dx = strike.wave ? actor.x - strike.x : -strike.direction.y * side;
  const dy = strike.wave ? actor.y - strike.y : strike.direction.x * side;
  moveArena(role, dx, dy, distance, [enemyBlocker()]);
}

function closeOnEnemy(role, dt, speed, reach, flank) {
  const actor = actorPoint(role), enemy = actorPoint('enemy');
  const distance = arenaDistance(actor, enemy);
  if (flank && distance < reach + 100) {
    const hero = actorPoint('hero');
    const desired = directionTo(enemy.x - hero.x, enemy.y - hero.y);
    const flankAngle = role === 'cat' ? .78 : 1.08;
    const heading = directionTo(actor.x - enemy.x, actor.y - enemy.y);
    const dot = heading.x * desired.x + heading.y * desired.y;
    if (dot < flankAngle - .35) {
      const cross = heading.x * desired.y - heading.y * desired.x;
      const side = Math.sign(cross) || (role === 'ally' ? -1 : 1);
      moveArena(role, -heading.y * side, heading.x * side, dt * speed, [enemyBlocker()]);
      return distance <= reach;
    }
  }
  if (distance <= reach) return true;
  moveArena(role, enemy.x - actor.x, enemy.y - actor.y,
    Math.min(distance - reach + 1, dt * speed), [enemyBlocker()]);
  return false;
}

function chooseArena(enemy) {
  if (enemy.trial !== undefined) return ['volcano','snow','temple','otherworld'][enemy.trial];
  if (enemy.hiddenRegion !== undefined) {
    const terrain = prefectures[enemy.hiddenRegion].terrain;
    return terrain === 'snow' ? 'snow' : terrain === 'mountain' ? 'cave' : 'ruins';
  }
  if (enemy.chapter === last && enemy.rank === 'major') return 'otherworld';
  if (enemy.chapter === originalFinal && enemy.boss) return 'temple';
  if (enemy.chapter === 9 && enemy.boss) return 'ruins';
  const offset = player.x - enemy.chapter * span;
  if (offset < 355) return offset < 205 ? 'market' : 'city';
  const region = prefectures[enemy.chapter];
  if (region.name === '鹿児島県' || region.name === '熊本県' && enemy.boss) return 'volcano';
  if (/城/.test(region.sight) && enemy.boss) return 'castle';
  if (/神宮|寺|大社|天満宮|鳥居/.test(region.sight) && enemy.boss) return 'temple';
  if (region.terrain === 'mountain' && enemy.boss) return 'cave';
  return {forest:'forest', coast:'coast', mountain:'grass', water:'grass', snow:'snow', sand:'coast', river:'grass'}[region.terrain];
}

const battleDepth = depth => 147 + depth * .68;
const depthScale = depth => .75 + depth / 470;

function createBattle(enemy, ambush) {
  const body = combatBody(enemy);
  return {
    enemy, body, arena:chooseArena(enemy), heroX:163, heroY:156, enemyX:447, enemyY:156,
    enemyFacing:{x:-1,y:0}, enemyEvade:0, enemyAvoidAt:clock + 1.3, heroPressure:0, allyPressure:0, catPressure:0,
    allyX:131, allyY:121, allyNext:0, allyAction:null, allyDodge:0, allyGuard:0, allyHit:0, allyDefenseAt:0,
    catX:133, catY:190, catNext:0, catStrikes:0, catEffect:null, catDodge:0, catDefenseAt:0,
    age:0, next:0, strike:null, pattern:0, ambush, damageFlash:0, impact:null, link:0, burn:null,
    slowedUntil:0, awakeSince:0, superAwake:false, footstepAt:0
  };
}

function heroBlocker() {
  return {...actorPoint('hero'), radius:arenaHero.radius};
}

const arenaAttacks = {
  ...attackPatterns,
  rear: {label:'後方なぎ払い',reach:34,lead:.58,extra:4},
  stomp: {label:'地鳴り',reach:56,lead:.70,extra:8}
};
const finalSequences = [['bite','slow'], ['rush','wave','rear'], ['wave','stomp','rear']];
const midSequence = ['slow','bite','rear'];

function advanceEnemy(dt) {
  const {enemy, body} = battle;
  if (clock < (battle.enemyHit ?? 0) && body.size < 1.5) return;
  const origin = actorPoint('enemy');
  const targets = [actorPoint('hero')];
  if (currentCompanion()?.hp > 0) targets.push(actorPoint('ally'));
  if (joined && cat.hp > 0) targets.push(actorPoint('cat'));
  const target = targets.reduce((nearest, point) =>
    arenaDistance(point, origin) + 5 < arenaDistance(nearest, origin) ? point : nearest);
  const distance = arenaDistance(origin, target);
  const dir = directionTo(target.x - origin.x, target.y - origin.y, battle.enemyFacing);
  const facingDot = dir.x * battle.enemyFacing.x + dir.y * battle.enemyFacing.y;
  const phase = isFinalBoss(enemy) ? finalPhase(enemy) : 1;
  const sequence = enemy.pattern || (isFinalBoss(enemy) ?
    finalSequences[phase - 1] :
    enemy.rank === 'mid' ? midSequence : bossPatterns[enemy.chapter % bossPatterns.length]);
  let kind = enemy.boss ? sequence[battle.pattern % sequence.length] :
    body.motion === 'duel' && battle.pattern % 3 === 2 ? 'rush' : 'bite';
  if (enemy.boss && body.motion === 'stomp' && phase < 3 && kind === 'slow') kind = 'stomp';
  const move = arenaAttacks[kind];
  const wave = kind === 'stomp' || kind === 'wave' && (phase === 3 || enemy.trial !== undefined);
  const range = Math.min(196, enemy.range * (.88 + body.radius * .013) + body.radius + move.reach);
  const width = (kind === 'rush' ? 15 : 22 + (kind === 'wave' ? 18 : 0)) * body.width + body.radius * .30;
  if (clock >= battle.next && (distance <= range + 5 || kind === 'rear' && distance <= range + 12)) {
    const heading = kind === 'rear' ? {x:-battle.enemyFacing.x,y:-battle.enemyFacing.y} : dir;
    if (kind !== 'rear') battle.enemyFacing = dir;
    const label = kind === 'wave' && wave ? '環状衝撃波' : move.label;
    battle.strike = {x:origin.x,y:origin.y,label,direction:heading,range,width,wave,kind,
      at:clock + move.lead + (body.size >= 3 ? .13 : 0),power:enemy.power + move.extra + (phase - 1) * 8};
    battle.pattern++;
    if (enemy.boss) say(label + 'の構え。赤い予告範囲から離れよう。', 1.5);
    return;
  }
  const blockers = [heroBlocker()];
  if (currentCompanion()?.hp > 0) blockers.push({...actorPoint('ally'),radius:arenaAlly.radius});
  if (joined && cat.hp > 0) blockers.push({...actorPoint('cat'),radius:arenaCat.radius});
  if (!enemy.boss && clock >= battle.enemyAvoidAt && distance < 67 && clock < swingUntil && facingDot > .15) {
    battle.enemyAvoidAt = clock + 3.5;
    battle.enemyEvade = clock + .18;
    moveArena('enemy', -dir.y, dir.x, 23, blockers);
    return;
  }
  const turning = directionTo(battle.enemyFacing.x + dir.x * dt * 5, battle.enemyFacing.y + dir.y * dt * 5, dir);
  battle.enemyFacing = facingDot < -.98 ? directionTo(battle.enemyFacing.x - battle.enemyFacing.y * .25,
    battle.enemyFacing.y + battle.enemyFacing.x * .25) : turning;
  const spacing = Math.max(body.radius + 14, Math.min(range * .63, 42));
  if (distance <= spacing) return;
  const side = Math.sin(battle.age * .87 + (enemy.slot ?? 0)) * (body.motion === 'duel' ? .44 : .17);
  const stride = dt * enemy.speed * body.speed * (enemy.hp <= enemy.max / 2 && enemy.boss ? 1.24 : 1) *
    (clock < battle.slowedUntil ? .55 : 1);
  const step = Math.min(distance - spacing, stride);
  moveArena('enemy', dir.x - dir.y * side, dir.y + dir.x * side, step, blockers);
  if (body.size >= 3 && clock >= battle.footstepAt) {
    audio.play('quake');
    battle.footstepAt = clock + 1.1;
    battle.stepDust = {...actorPoint('enemy'), until:clock + .32};
  }
}
