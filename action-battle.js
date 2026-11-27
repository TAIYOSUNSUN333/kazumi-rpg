const arenaLimits = {left:25, right:615, back:44, front:272};
const arenaHero = {radius:9};
const arenaAlly = {radius:8};
const arenaCat = {radius:6};
const depthScale = depth => .75 + depth / 470;
const isActionBattle = () => Boolean(battle && !battle.command);

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
    role.startsWith('ally') ? arenaAlly.radius : arenaCat.radius;
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
    ...battle.members.filter(slot => slot.member.hp > 0 && slot.pressure > clock).map(slot => actorPoint(slot.role)),
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

function positionalHit(origin, damage, technique) {
  if (battle.enemyEvade > clock) {
    addNumber('回避', battle.enemyX, battleDepth(battle.enemyY) - 28, '#a7d4e7');
    return;
  }
  const [name, multiplier] = attackPosition(origin);
  const enemy = battle.enemy;
  const weakness = technique && ({float:'air', stomp:'charge', scuttle:'magic', charge:'air', duel:'charge'})[battle.body.motion] === technique;
  const critical = technique && Math.random() < .09;
  const part = battle.armorPart;
  if (part?.hp > 0 && (technique === 'charge' || name === '背後' || name === '挟撃')) {
    part.hp = Math.max(0,part.hp - damage);
    if (!part.hp) {
      audio.play('quake');
      battle.strike = null;
      battle.next = clock + 2.4;
      say(part.name + 'を破壊！　敵がひるんだ。',2);
    }
  }
  const tags = [multiplier > 1 ? name : '', weakness ? '弱点' : '', critical ? '会心' : ''].filter(Boolean);
  hurtActionEnemy(Math.round(damage * multiplier * (weakness ? 1.25 : 1) *
    (critical ? 1.5 : 1) * (part?.hp === 0 ? 1.2 : 1)), tags.join('・'));
  if (battle?.enemy === enemy && battle.body.size < 1.5) {
    const away = directionTo(battle.enemyX - origin.x,battle.enemyY - origin.y);
    moveArena('enemy',away.x,away.y,6,[heroBlocker()]);
  }
}

function hurtActionEnemy(damage, label = '') {
  const arena = battle;
  const {enemy} = arena;
  const phase = isFinalBoss(enemy) ? finalPhase(enemy) : 1;
  const hp = enemy.hp;
  hurtEnemy(enemy,damage);
  if (battle !== arena) return;
  const lost = hp - enemy.hp;
  arena.enemyHit = clock + .21;
  arena.hitStop = performance.now() + 61;
  addNumber((label ? label + ' ' : '') + lost, arena.enemyX, battleDepth(arena.enemyY) - 31,
    label.includes('会心') ? '#ffdb86' : '#fff29a');
  if (isFinalBoss(enemy) && finalPhase(enemy) > phase) {
    arena.body = combatBody(enemy);
    arena.strike = null;
    arena.pattern = 0;
    arena.next = clock + 1.15;
    startCinema('impact');
    audio.play('encounter');
    say(enemy.name + 'が第' + finalPhase(enemy) + '形態へ変身！',3);
  }
}

function startActionBattle(enemy, approach) {
  battle.entry = {x:player.x,y:player.y};
  battle.members = activeCompanions().map((member,index) => {
    const role = 'ally' + index;
    battle[role + 'X'] = battle.heroX - 25 - Math.floor(index/3)*23;
    battle[role + 'Y'] = battle.heroY + (index % 3 - 1)*37 + (index >= 3 ? 15 : 0);
    return {member,role,next:0,skillAt:clock+2,action:null,guard:0,dodge:0,hit:0,defenseAt:0,pressure:0};
  });
  if (approach === 'rear') player.facing = {x:1,y:0};
  if (approach === 'first') battle.heroX = battle.enemyX - 90;
  if (battle.body.size >= 3.8) battle.armorPart = {
    name:enemy.trial !== undefined ? '王鎧' : '外殻', hp:Math.ceil(enemy.max * .14), max:Math.ceil(enemy.max * .14)
  };
  say(approach === 'first' ? '先制攻撃の好機！' :
    approach === 'rear' ? '背後からの襲撃！　予告範囲を避けよう。' : enemy.name + 'と遭遇した。');
}

function actionLimit() {
  if (!movementAllowed() || clock < battle.limitAt || player.mp < 8) return;
  player.mp -= 8;
  battle.limitAt = clock + 10;
  const ultimate = joined && cat.form === 5 && cat.mp >= 999;
  if (ultimate) cat.mp -= 999;
  const base = attackPower() * 4 + (joined ? catForm().atk * (ultimate ? 4 : 1.6) : 0);
  const cap = battle.enemy.trial !== undefined ? .13 : .27;
  startCinema('impact');
  if (joined) battle.catEffect = {until:clock + .85,type:ultimate ? 'creation' : 'holy'};
  audio.play(ultimate ? 'creation' : 'special');
  say(ultimate ? '天地創生！' : joined ? '双星の誓い！' : '星閃の一撃！',2);
  hurtActionEnemy(Math.min(battle.enemy.boss ? Math.ceil(battle.enemy.max * cap) : Infinity, base));
}

function actionThinkOfSoso() {
  if (!movementAllowed() || clock < specialAt || player.mp < 10) return;
  specialAt = clock + 15;
  player.mp -= 10;
  startCinema('impact');
  audio.play('special');
  say('ソソを思う！',2);
  const enemy = battle.enemy;
  const power = attackPower() * 5 + Math.min(player.shards,36) + (joined ? catForm().atk : 30);
  hurtActionEnemy(enemy.boss ? Math.min(Math.ceil(enemy.max * .23),power) : enemy.hp);
}

function useActionHerb() {
  if (!movementAllowed() || !player.herbs || player.hp >= maxHP() || clock < battle.herbAt) return;
  player.herbs--;
  battle.herbAt = clock + 1.35;
  const healed = Math.min(maxHP() - player.hp,35);
  player.hp += healed;
  audio.play('holy');
  addNumber('+' + healed + ' HP',battle.heroX,battleDepth(battle.heroY)-35,'#a7ebba');
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
    (actor.y - strike.y) * strike.direction.x) || (role.startsWith('ally') ? -1 : 1);
  const dx = strike.wave ? actor.x - strike.x : -strike.direction.y * side;
  const dy = strike.wave ? actor.y - strike.y : strike.direction.x * side;
  moveArena(role, dx, dy, distance, [enemyBlocker()]);
}

function closeOnEnemy(role, dt, speed, reach, flank) {
  const actor = actorPoint(role), enemy = actorPoint('enemy');
  const distance = arenaDistance(actor,enemy);
  const blockers = [enemyBlocker(),heroBlocker(),
    ...battle.members.filter(slot=>slot.role !== role && slot.member.hp > 0)
      .map(slot=>({...actorPoint(slot.role),radius:arenaAlly.radius-2}))];
  if (joined && role !== 'cat' && cat.hp) blockers.push({...actorPoint('cat'),radius:arenaCat.radius});
  if (flank && distance < reach + 100) {
    const hero = actorPoint('hero');
    const desired = directionTo(enemy.x - hero.x, enemy.y - hero.y);
    const flankAngle = role === 'cat' ? .78 : 1.08;
    const heading = directionTo(actor.x - enemy.x, actor.y - enemy.y);
    const dot = heading.x * desired.x + heading.y * desired.y;
    if (dot < flankAngle - .35) {
      const cross = heading.x * desired.y - heading.y * desired.x;
      const side = Math.sign(cross) || (role.startsWith('ally') ? -1 : 1);
      moveArena(role, -heading.y * side, heading.x * side, dt * speed, blockers);
      return distance <= reach;
    }
  }
  if (distance <= reach) return true;
  moveArena(role, enemy.x - actor.x, enemy.y - actor.y,
    Math.min(distance - reach + 1, dt * speed), blockers);
  return false;
}

function createActionBattle(enemy, approach) {
  const body = combatBody(enemy);
  return {
    enemy, body, arena:chooseArena(enemy), heroX:approach === 'rear' ? 345 : 163, heroY:156,
    enemyX:approach === 'rear' ? 294 : 447, enemyY:156,
    enemyFacing:{x:approach === 'rear' ? 1 : -1,y:0}, enemyEvade:0, enemyAvoidAt:clock + 1.3, heroPressure:0, catPressure:0,
    catX:133, catY:190, catNext:0, catStrikes:0, catEffect:null, catDodge:0, catDefenseAt:0,
    age:0, limitAt:0, herbAt:0, next:clock + (approach === 'first' ? 2 : .65), strike:null, pattern:0, approach, opening:true, damageFlash:0, impact:null, link:0, burn:null,
    slowedUntil:0, awakeSince:0, superAwake:false, footstepAt:0
  };
}

function heroBlocker() {
  return {...actorPoint('hero'), radius:arenaHero.radius};
}

const finalSequences = [['bite','slow'], ['rush','wave','rear'], ['wave','stomp','rear']];
const midSequence = ['slow','bite','rear'];

function advanceEnemy(dt) {
  const {enemy, body} = battle;
  if (clock < (battle.enemyHit ?? 0) && body.size < 1.5) return;
  const origin = actorPoint('enemy');
  const targets = [actorPoint('hero')];
  targets.push(...battle.members.filter(slot => slot.member.hp > 0).map(slot => actorPoint(slot.role)));
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
    return;
  }
  const blockers = [heroBlocker()];
  blockers.push(...battle.members.filter(slot => slot.member.hp > 0).map(slot => ({...actorPoint(slot.role),radius:arenaAlly.radius})));
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

function hurtActionHero(power, strike) {
  if (clock < invulnerableUntil) return;
  const guarding = joined && cat.hp > 0 && player.hp <= maxHP() * .3 && arenaDistance(actorPoint('cat'), actorPoint('hero')) < 32;
  const facing = strike && directionTo(strike.x - battle.heroX, strike.y - battle.heroY);
  const blocked = (pressed('guard') || battle.autoGuard) && (!strike || facing.x * player.facing.x + facing.y * player.facing.y >= -.18);
  const damage = Math.max(1, Math.ceil((power - defense()) * (guarding ? .5 : 1) * (blocked ? shieldEquipped ? .30 : .36 : 1)));
  player.hp = Math.max(0, player.hp - damage);
  flashUntil = clock + .2;
  invulnerableUntil = clock + .22;
  audio.play('hit');
  if (strike?.kind === 'stomp' && !blocked) footingUntil = clock + 65;
  if (strike && !blocked) moveArena('hero', -facing.x, -facing.y, battle.body.size > 3 ? 18 : 9, [enemyBlocker()]);
  addNumber(blocked ? '防御 ' + damage : damage, battle.heroX, battleDepth(battle.heroY) - 48, '#ff9a9a');
  if (!player.hp) defeat('一美は倒れた');
}

function hurtCompanion(strike,slot) {
  const {member,role} = slot;
  const point = actorPoint(role);
  if (!member.hp || !strikeContains(strike,point,arenaAlly.radius) || slot.dodge > clock) return;
  const damage = Math.max(1,Math.round((strike.power-companionProfiles[member.name].defense-
    (companionLevel(member)-1)-member.gear)*(slot.guard > clock ? .42 : 1)));
  member.hp = Math.max(0,member.hp-damage);
  slot.hit = clock+.18;
  const away = directionTo(point.x-strike.x,point.y-strike.y);
  if (slot.guard <= clock) moveArena(role,away.x,away.y,9,[enemyBlocker()]);
  addNumber(damage,point.x,battleDepth(point.y)-40,'#ffada6');
}

const companionLimits = {
  一郎:{name:'天空連斬',cost:7,reach:62,power:2.35,color:'#f7be84'},
  恵美ちゃん:{name:'生命の奇跡',cost:12,reach:92,power:.35,color:'#9ce7bb',heal:true},
  タク:{name:'星降る裁き',cost:10,reach:119,power:2.1,color:'#c5b7ff'},
  クルミ:{name:'月光の翼',cost:8,reach:105,power:1.87,color:'#a8e2fa'}
};

function updateCompanion(dt,slot) {
  const {member,role} = slot;
  if (!member.hp) return;
  const profile = companionProfiles[member.name];
  const warning = battle.strike;
  const defensive = member.tactic === '守備優先';
  const support = member.tactic === '支援優先';
  const point = actorPoint(role);
  if (warning && strikeContains(warning,point,arenaAlly.radius) && warning.at-clock < .27 && clock >= slot.defenseAt) {
    slot.defenseAt = clock + (defensive ? 2.2 : 3.4);
    if (defensive || profile.role === 'sword' || warning.wave) slot.guard = clock+.38;
    else {
      slot.dodge = clock+.32;
      retreatFromStrike(role,42);
    }
    return;
  }
  if (slot.guard > clock || slot.dodge > clock) return;
  const signature = companionLimits[member.name];
  const skillReady = signature && member.mp >= signature.cost && clock >= slot.skillAt;
  const hurt = [{pawn:player,max:maxHP()},...battle.members.filter(other=>other.member.hp > 0)
    .map(other=>({pawn:other.member,max:companionHP(other.member)}))]
    .filter(entry=>entry.pawn.hp < entry.max*(support ? .77 : .67))
    .sort((a,b)=>a.pawn.hp/a.max-b.pawn.hp/b.max)[0];
  if (clock >= slot.next && profile.role === 'heal' && member.mp >= 5 && hurt) {
    const heal = skillReady && signature.heal;
    const amount = heal ? Math.ceil(hurt.max * signature.power) : 16+companionLevel(member)*2;
    member.mp -= heal ? signature.cost : 5;
    hurt.pawn.hp = Math.min(hurt.max,hurt.pawn.hp+amount);
    slot.next = clock+2.7;
    slot.action = {kind:'heal',until:clock+.5};
    if (heal) {
      slot.skillAt = clock+17;
      battle.skillCue = {name:signature.name,color:signature.color,until:clock+1.1,x:point.x,y:battleDepth(point.y)-39};
      startCinema('impact');
    }
    audio.play('holy');
    return;
  }
  const magic = profile.role === 'magic' && member.mp >= (support ? 7 : 3);
  const useSkill = skillReady && !signature.heal;
  const reach = (useSkill ? signature.reach : magic ? profile.reach : 35)+battle.body.radius;
  if (!closeOnEnemy(role,dt,profile.speed*(defensive ? .88 : 1),reach,!defensive)) return;
  if (clock < slot.next) return;
  slot.next = clock+(magic ? 1.7 : 1.22);
  slot.action = {kind:magic || useSkill ? 'magic' : 'attack',until:clock+.33};
  if (useSkill) {
    member.mp -= signature.cost;
    slot.skillAt = clock+14;
    battle.skillCue = {name:signature.name,color:signature.color,until:clock+1.1,x:point.x,y:battleDepth(point.y)-39};
  } else if (magic) member.mp -= 3;
  audio.play(magic || useSkill ? 'magic' : 'attack');
  slot.pressure = clock+1.6;
  const damage = profile.power + (companionLevel(member)-1)*2 + member.gear*3 + (magic ? 5 : 0);
  positionalHit(actorPoint(role),damage*(useSkill ? signature.power : 1));
}

function updateActionCat(dt) {
  const next = awakening[cat.form + 1];
  if (next && battle.age - battle.awakeSince + 1e-8 >= next.turn * 5) {
    shiftCatForm(cat.form + 1);
    battle.catEffect = {until: clock + 1.1, type: 'awakening'};
    audio.play('awake' + cat.form);
    say('ソソが第' + (cat.form + 1) + '形態・' + next.name + 'に覚醒！', 3);
    if (cat.form === 5) {
      audio.setTrack('genesis');
      startCinema('awakening');
    }
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
  const base = form.atk * (resistant ? .65 : 1.45);
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

function resolveHeroStrike() {
  const hit = battle.heroStrike;
  if (!hit || clock < hit.at) return;
  battle.heroStrike = null;
  battle.lastSlash = hit;
  audio.play(hit.sound);
  const point = actorPoint('hero');
  if (!aimHitsEnemy(point,hit.direction,hit.reach,hit.width)) return;
  battle.heroPressure = clock+1.35;
  const link = joined && battle.link > clock;
  if (link) battle.link = 0;
  positionalHit(point,hit.power+(link ? Math.ceil(catForm().atk*.55) : 0),hit.technique);
}

function updateActionBattle(dt) {
  const {enemy} = battle;
  battle.age += dt;
  if (battle.age < .4) return;
  resolveHeroStrike();
  if (!battle || paused) return;
  updateSummon();
  if (!battle || paused) return;
  if (battle.opening) {
    battle.opening = false;
    if (battle.approach === 'rear') {
      battle.strike = {x:battle.enemyX,y:battle.enemyY,label:'背後からの一撃',direction:battle.enemyFacing,
        kind:'rush',wave:false,width:30,range:100,at:clock + .4,power:enemy.power};
    }
  }
  if (battle.burn && clock >= battle.burn.at) {
    const damage = battle.burn.damage;
    battle.burn = null;
    hurtActionEnemy(damage,'炎');
    if (!battle || paused) return;
  }
  if (joined) updateActionCat(dt);
  if (!battle || paused) return;
  for (const slot of battle.members) {
    updateCompanion(dt,slot);
    if (!battle || paused) return;
  }
  const strike = battle.strike;
  if (strike) {
    if (clock < strike.at) return;
    for (const slot of battle.members) hurtCompanion(strike,slot);
    if (joined && cat.hp > 0 && clock >= battle.catDodge &&
        strikeContains(strike, actorPoint('cat'), arenaCat.radius)) {
      const cap = enemy.trial !== undefined ? .28 : enemy.boss ? .21 : .14;
      const damage = Math.min(Math.ceil(catForm().hp * cap),
        Math.max(240, strike.power * (enemy.trial !== undefined ? 132 : 80) - catForm().def));
      cat.hp = Math.max(0, cat.hp - damage);
      addNumber(damage, battle.catX, battleDepth(battle.catY) - 35, '#ff9a9a');
      if (!cat.hp) return defeat('ソソは倒れた');
      const ratio = cat.hp / catForm().hp;
      const next = awakening[cat.form + 1];
      if (next && battle.age - battle.awakeSince >= next.turn * 5 - 2 && damage >= catForm().hp * .12) {
        shiftCatForm(0);
        battle.awakeSince = battle.age;
        say('ソソの覚醒が中断された。');
      }
      if (ratio <= .1 && !battle.superAwake) {
        battle.superAwake = true;
        burstUntil = clock + .55;
        audio.play('creation');
        say('一美が黄金の光をまとった。超覚醒！');
        if (!enemy.boss) {
          hurtActionEnemy(enemy.hp);
          return;
        }
      }
    }
    if (strikeContains(strike, actorPoint('hero'), arenaHero.radius) && (strike.wave || jumpHeight < 18)) {
      hurtActionHero(strike.power, strike);
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

function actionMagic() {
  const spell = routeSpellById.get(shotGear);
  if (shotGear === 'moon' && stoneMagicLearned) return {name:stoneSpell.name, cost:stoneSpell.mp, heal:true};
  if (ring) return spell || {name:'燐光の火球',cost:starterRing.mp,color:'#fa924f'};
  return null;
}

function castActionMagic() {
  const spell = actionMagic();
  if (!spell || clock < magicAt || player.mp < spell.cost || spell.heal && player.hp === maxHP()) return;
  player.mp -= spell.cost;
  magicAt = clock + .72;
  battle.spellUntil = clock + .27;
  audio.play(spell.heal ? 'holy' : 'magic');
  if (spell.heal) {
    const hp = Math.min(maxHP() - player.hp,Math.ceil(maxHP() * .28));
    player.hp += hp;
    addNumber('+' + hp + ' HP',battle.heroX,battleDepth(battle.heroY)-34,'#a7ebba');
  } else launchFireball(Math.max(1,Math.floor(attackPower() * .35)),spell.color);
}

function updateActionStatus() {
  const {enemy} = battle;
  reflectAuto('arena-auto',battle.auto);
  const phase = isFinalBoss(enemy) ? '　第' + finalPhase(enemy) + '形態' : '';
  const part = battle.armorPart ? '　' + battle.armorPart.name + (battle.armorPart.hp ? '' : '破壊済み') : '';
  $('arena-enemy').textContent = enemy.name + phase + part + '　HP ' + enemy.hp + '/' + enemy.max;
  $('arena-enemy-hp').max = enemy.max;
  $('arena-enemy-hp').value = enemy.hp;
  $('arena-warning').textContent = battle.strike?.label || '';
  const party = battle.members.map(({member}) => companionName(member) + ' ' + member.hp + 'HP');
  const text = party.join('　');
  if ($('arena-party').textContent !== text) $('arena-party').textContent = text;
  $('arena-awake').hidden = !joined;
  if (joined) {
    const next = awakening[cat.form + 1];
    const elapsed = Math.max(0,battle.age - battle.awakeSince);
    const remain = next ? '　次まで ' + Math.max(0,Math.ceil(next.turn * 5 - elapsed)) + '秒' : '';
    $('arena-cat').textContent = 'ソソ 第' + (cat.form + 1) + '形態　HP ' + cat.hp + remain;
    $('arena-awake-gauge').max = next ? (next.turn - catForm().turn) * 5 : 1;
    $('arena-awake-gauge').value = next ? elapsed - catForm().turn * 5 : 1;
  }
  const spell = actionMagic();
  const wait = Math.max(0,specialAt-clock);
  $('arena-think-wait').textContent = wait > 0 ? Math.ceil(wait) + '秒' : '';
  $('arena-herb').textContent = '道具 ' + player.herbs;
  for (const [id,enabled] of Object.entries({
    magic:spell && player.mp >= spell.cost && clock >= magicAt,
    herb:player.herbs > 0 && player.hp < maxHP() && clock >= battle.herbAt,
    limit:player.mp >= 8 && clock >= battle.limitAt,
    think:player.mp >= 10 && wait === 0,
    dodge:clock >= dodgeAt
  })) $('arena-' + id).setAttribute('aria-disabled',String(!enabled));
}

function reflectAuto(id, enabled) {
  const button = $(id);
  const text = enabled ? 'AUTO ON' : 'AUTO OFF';
  if (button.textContent !== text) button.textContent = text;
  button.setAttribute('aria-pressed',String(Boolean(enabled)));
}

document.getElementById('arena-auto').onclick = () => {
  if (!isActionBattle() || !movementAllowed()) return;
  battle.auto = !battle.auto;
  battle.autoGuard = false;
  clearInput();
  reflectAuto('arena-auto',battle.auto);
};
document.getElementById('command-auto').onclick = () => {
  if (!battle?.command || paused) return;
  battle.command.auto = !battle.command.auto;
  updateCommandUI();
};

function updateActionAuto(dt) {
  const origin = actorPoint('hero');
  const target = actorPoint('enemy');
  const toward = directionTo(target.x-origin.x,target.y-origin.y,player.facing);
  player.facing = toward;
  const warning = battle.strike;
  battle.autoGuard = false;
  if (warning && warning.at - clock < .23 && strikeContains(warning,origin,arenaHero.radius)) {
    battle.autoGuard = true;
    gait = 'idle';
    if (clock >= dodgeAt) {
      const away = warning.wave ? {x:-toward.x,y:-toward.y} :
        {x:-toward.y,y:toward.x * (origin.y >= target.y ? 1 : -1)};
      moveArena('hero',away.x,away.y,30,[enemyBlocker()]);
      invulnerableUntil = clock + .23;
      dodgeAt = clock + .93;
      gait = 'dash';
    }
    return;
  }
  if (player.hp < maxHP() * .43) useActionHerb();
  const weapon = equipped('weapon');
  const reach = weapon.reach ?? 55;
  if (aimHitsEnemy(origin,toward,reach,bladeForm().width)) {
    gait = 'idle';
    swing(Boolean(battle.armorPart?.hp && clock >= attackAt + .18));
  } else {
    gait = 'walk';
    moveArena('hero',toward.x,toward.y,dt*93,[enemyBlocker()]);
  }
}
