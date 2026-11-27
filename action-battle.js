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
  const foe = battle.group.members.find(slot=>slot.key === role);
  const radius = foe ? foe.body.radius : role === 'hero' ? arenaHero.radius :
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

function groupBlockers(ignore = null, passUnder = false) {
  return livingEnemies(battle.group).filter(foe=>foe !== ignore && (!passUnder || foe.body.size < 4.5))
    .map(foe=>({...actorPoint(foe.key),radius:foe.body.radius}));
}

function nearestActionFoe(origin) {
  let nearest = null, distance = Infinity;
  for (const foe of livingEnemies(battle.group)) {
    const gap = arenaDistance(origin,actorPoint(foe.key))-foe.body.radius*.6;
    if (gap < distance) { nearest = foe; distance = gap; }
  }
  return nearest;
}

function aimHitsEnemy(origin, direction, reach, width, foe) {
  const mark = actorPoint(foe.key);
  const dx = mark.x-origin.x, dy = mark.y-origin.y;
  const forward = dx*direction.x+dy*direction.y;
  const across = Math.abs(dx*direction.y-dy*direction.x);
  return forward > 0 && forward <= reach+foe.body.radius && across <= width+foe.body.radius*.74;
}

function attackPosition(origin, foe) {
  const point = actorPoint(foe.key);
  const offset = directionTo(origin.x-point.x,origin.y-point.y);
  const front = offset.x*foe.facing.x + offset.y*foe.facing.y;
  const candidates = [
    ...battle.members.filter(slot=>slot.member.hp && slot.pressure > clock).map(slot=>actorPoint(slot.role)),
    joined && cat.hp && battle.catPressure > clock ? actorPoint('cat') : null,
    battle.heroPressure > clock ? actorPoint('hero') : null
  ];
  const pincer = candidates.some(candidate => {
    if (!candidate || arenaDistance(origin,candidate) < 12 || arenaDistance(candidate,point) > foe.body.radius+112) return false;
    const opposing = directionTo(candidate.x-point.x,candidate.y-point.y);
    return opposing.x*offset.x+opposing.y*offset.y <= -.62;
  });
  return pincer ? ['挟撃',1.75] : front <= -.62 ? ['背後',1.5] : front < .58 ? ['側面',1.25] : ['正面',1];
}

function positionalHit(origin, damage, technique, foe, element) {
  if (foe.type !== 'guard') {
    const target = actorPoint(foe.key);
    const cover = livingEnemies(battle.group).find(guard=>{
      if (guard.type !== 'guard' || guard.guardUntil <= clock) return false;
      const body = actorPoint(guard.key);
      return arenaDistance(body,target) < 39 && arenaDistance(body,origin) < arenaDistance(target,origin);
    });
    if (cover) {
      const guard = actorPoint(cover.key);
      addNumber('かばう',guard.x,battleDepth(guard.y)-42,'#abd5f3');
      foe = cover;
    }
  }
  const point = actorPoint(foe.key);
  if (foe.evadeAt > clock) {
    addNumber('回避',point.x,battleDepth(point.y)-28,'#a7d4e7');
    return;
  }
  const [name,multiplier] = attackPosition(origin,foe);
  const weakness = technique && ({float:'air',stomp:'charge',scuttle:'magic',charge:'air',duel:'charge'})[foe.body.motion] === technique;
  const enemyElement = foeElement(foe);
  const elementalWeakness = element && oppositeElement[enemyElement] === element;
  const resistant = element && enemyElement === element;
  const critical = technique && Math.random() < .09;
  const blocked = foe.guardUntil > clock && name === '正面' && technique !== 'charge' && technique !== 'magic';
  if (blocked && !foe.counterAt) foe.counterAt = clock + .28;
  if (foe.ward > 0 && (technique === 'air' || technique === 'charge' && name !== '正面')) {
    foe.ward--;
    say(foe.ward ? '王の結界にひびが入った。残り '+foe.ward : '王の結界を破壊！',2.4);
    audio.play('quake');
  }
  const part = foe.armorPart;
  if (part?.hp > 0 && (technique === 'charge' || name === '背後' || name === '挟撃')) {
    part.hp = Math.max(0,part.hp-damage);
    if (!part.hp) {
      audio.play('quake');
      foe.strike = null;
      foe.nextAt = clock+2.4;
      say(part.name + 'を破壊！　敵がひるんだ。',2);
    }
  }
  const armor = Math.min(damage*.32,foe.unit.defense*(technique === 'magic' ? .28 : .54));
  const tags = [foe.ward ? '結界' : '',blocked ? '防御' : '',multiplier > 1 ? name : '',weakness || elementalWeakness ? '弱点' : resistant ? '耐性' : '',critical ? '会心' : ''].filter(Boolean);
  const result = (damage-armor)*multiplier*(weakness ? 1.25 : 1)*(critical ? 1.5 : 1)*
    (part?.hp === 0 ? 1.2 : 1)*(blocked ? .32 : 1)*(elementalWeakness ? 1.32 : resistant ? .63 : 1);
  hurtActionEnemy(foe,result,tags.join('・'));
  if (foe.state === 'active' && !blocked && foe.body.size < 1.5) {
    const away = directionTo(point.x-origin.x,point.y-origin.y);
    moveArena(foe.key,away.x,away.y,6,[heroBlocker(),...groupBlockers(foe)]);
  }
}

function hurtActionEnemy(foe, damage, label = '') {
  if (!foe || foe.state !== 'active') return;
  const {unit} = foe;
  const phase = foePhase(unit);
  const lost = damageEnemySlot(foe,damage);
  if (!lost) return;
  const point = actorPoint(foe.key);
  foe.hitUntil = clock+.21;
  if (label.includes('会心') || foe.leader) battle.hitStop = performance.now()+45;
  addNumber((label ? label+' ' : '')+lost,point.x,battleDepth(point.y)-29,'#fff29a');
  if (foePhase(unit) > phase) {
    battle.body = foe.body = groupCombatBody(foe);
    foe.strike = null;
    foe.pattern = 0;
    foe.nextAt = clock+1.15;
    battle.group.requested = true;
    startCinema('impact');
    audio.play('encounter');
    say(unit.name+'が第'+foePhase(unit)+'形態へ変身！',3);
  }
}

function placeActionEnemy(foe) {
  const {unit,leader,index,mark,depth} = foe;
  foe.key = leader ? 'enemy' : 'enemy'+index;
  foe.body = groupCombatBody(foe);
  const rear = battle.approach === 'rear';
  const edge = rear ? 22 : 618;
  const band = ((index-1)%9+9)%9;
  const x = leader ? (rear ? 294 : 447) : foe.wave ? edge+(rear ? 1 : -1)*(18+mark*60) :
    (rear ? 81 : 424)+Math.floor(band/3)*56+mark*29;
  const y = leader ? 156 : 68+(band%3)*71+depth*28+(band >= 6 ? 19 : 0);
  battle[foe.key+'X'] = x;
  battle[foe.key+'Y'] = y;
  foe.facing = {x:rear ? 1 : -1,y:0};
  foe.pattern = 0;
  foe.nextAt = clock + (battle.approach === 'first' && !foe.wave ? 1.45 : .62) + mark*.87;
  foe.defendAt = clock + .9 + mark*2;
  foe.guardUntil = foe.evadeAt = foe.hitUntil = foe.counterAt = foe.slowedUntil = 0;
  if (leader && foe.body.size >= 3.8) foe.armorPart = {
    name:unit.trial !== undefined ? '王鎧' : '外殻',hp:Math.ceil(unit.max*.14),max:Math.ceil(unit.max*.14)
  };
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
  for (const foe of livingEnemies(battle.group)) placeActionEnemy(foe);
  const notice = encounterFormation(battle.group);
  say((approach === 'first' ? '先制攻撃！　' : approach === 'rear' ? '背後からの襲撃！　' : '')+notice);
}

function actionLimit() {
  const targets = isActionBattle() ? livingEnemies(battle.group) : [];
  if (!targets.length || !movementAllowed() || clock < battle.limitAt || player.mp < 8) return;
  player.mp -= 8;
  battle.limitAt = clock+10;
  const ultimate = joined && cat.form === 5 && cat.mp >= 999;
  if (ultimate) cat.mp -= 999;
  const base = attackPower()*4+(joined ? catForm().atk*(ultimate ? 4 : 1.6) : 0);
  const origin = actorPoint('hero');
  const closest = nearestActionFoe(origin);
  const hit = ultimate ? targets : targets.filter(foe=>foe === closest || arenaDistance(origin,actorPoint(foe.key)) < 144);
  startCinema('impact');
  if (joined) battle.catEffect = {until:clock+.85,type:ultimate ? 'creation' : 'holy'};
  audio.play(ultimate ? 'creation' : 'special');
  say(ultimate ? '天地創生！' : joined ? '双星の誓い！' : '星閃の一撃！',2);
  for (const foe of hit) {
    const cap = foe.unit.trial !== undefined ? .13 : .27;
    hurtActionEnemy(foe,Math.min(foe.unit.boss ? Math.ceil(foe.unit.max*cap) : Infinity,base));
  }
}

function actionThinkOfSoso() {
  const targets = isActionBattle() ? livingEnemies(battle.group) : [];
  if (!targets.length || !movementAllowed() || clock < specialAt || player.mp < 10) return;
  specialAt = clock+15;
  player.mp -= 10;
  startCinema('impact');
  audio.play('special');
  say('ソソを思う！',2);
  const power = attackPower()*5+Math.min(player.shards,36)+(joined ? catForm().atk : 30);
  for (const foe of targets) {
    const {unit} = foe;
    const damage = unit.boss ? Math.min(Math.ceil(unit.max*.23),power) :
      battle.group.kind === 'ordinary' ? unit.hp : Math.min(Math.ceil(unit.max*.75),power);
    hurtActionEnemy(foe,damage);
  }
}

function useActionHerb() {
  if (!movementAllowed()) return;
  const item = marketGoods[0];
  if (canUseGood(item)) applyActionItem(item);
}

function applyActionItem(item) {
  if (!isActionBattle() || !canUseGood(item) || clock < battle.herbAt) return;
  if (item.id === 'herb') player.herbs--;
  else pack[item.id]--;
  battle.herbAt = clock+1.35;
  const hp = Math.min(maxHP()-player.hp,item.hp || 0);
  player.hp += hp;
  player.mp = Math.min(maxMP(),player.mp+(item.mp || 0));
  if (item.clean) footingUntil = clock;
  audio.play('holy');
  addNumber(hp ? '+'+hp+' HP' : item.mp ? 'MP回復' : '手当て',battle.heroX,battleDepth(battle.heroY)-35,'#a7ebba');
}

function actionItemMenu() {
  if (!isActionBattle()) return;
  panel('戦闘の道具',[],[
    ...marketGoods.filter(item=>goodCount(item)>0).map(item=>[
      item.name+' ×'+goodCount(item)+'　'+goodEffect(item),()=>{
        applyActionItem(item);
        resume();
      },!canUseGood(item) || clock<battle.herbAt,item.color
    ]),['戻る',openMenu]
  ]);
}

function strikeContains(strike, point, radius = 0) {
  const dx = point.x - strike.x, dy = point.y - strike.y;
  if (strike.wave) return Math.hypot(dx, dy) <= strike.range + radius;
  const forward = dx * strike.direction.x + dy * strike.direction.y;
  const across = Math.abs(dx * strike.direction.y - dy * strike.direction.x);
  return forward >= -radius && forward <= strike.range + radius &&
    across <= strike.width * (.7 + Math.max(0, forward) / strike.range * .3) + radius;
}

function retreatFromStrike(role, strike, distance) {
  const actor = actorPoint(role);
  const side = Math.sign((actor.x - strike.x) * -strike.direction.y +
    (actor.y - strike.y) * strike.direction.x) || (role.startsWith('ally') ? -1 : 1);
  const dx = strike.wave ? actor.x - strike.x : -strike.direction.y * side;
  const dy = strike.wave ? actor.y - strike.y : strike.direction.x * side;
  moveArena(role,dx,dy,distance,groupBlockers());
}

function closeOnEnemy(role, dt, speed, reach, flank, foe) {
  const actor = actorPoint(role), enemy = actorPoint(foe.key);
  const distance = arenaDistance(actor,enemy);
  const blockers = [...groupBlockers(),heroBlocker(),
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
    enemy,body,arena:chooseArena(enemy),heroX:approach === 'rear' ? 345 : 163,heroY:156,
    enemyX:approach === 'rear' ? 294 : 447,enemyY:156,
    heroPressure:0,catPressure:0,catX:133,catY:190,catNext:0,catStrikes:0,
    catEffect:null,catDodge:0,catDefenseAt:0,age:0,limitAt:0,herbAt:0,approach,opening:true,
    nextAttackAt:clock+.55,awakeSince:0,superAwake:false,link:0
  };
}

function heroBlocker() {
  return {...actorPoint('hero'), radius:arenaHero.radius};
}

const finalSequences = [['bite','slow'], ['rush','wave','rear'], ['wave','stomp','rear']];
const midSequence = ['slow','bite','rear'];

function hostileTargets() {
  const allies = [{key:'hero',unit:player,max:maxHP(),armor:defense(),radius:arenaHero.radius}];
  for (const {member,role} of battle.members) {
    if (member.hp > 0) {
      const profile = companionProfiles[member.name];
      allies.push({key:role,unit:member,max:companionHP(member),profile,
        armor:profile.defense+companionLevel(member)+member.gear,radius:arenaAlly.radius});
    }
  }
  if (joined && cat.hp) allies.push({key:'cat',unit:cat,max:catForm().hp,armor:catForm().def,radius:arenaCat.radius});
  return allies.map(ally=>({...ally,...actorPoint(ally.key)}));
}

function actionDanger(point, radius) {
  return livingEnemies(battle.group).map(foe=>foe.strike).filter(strike=>
    strike && strike.effect !== 'heal' && strike.effect !== 'summon' && strikeContains(strike,point,radius))
    .sort((a,b)=>a.at-b.at)[0];
}

function enemyTacticMove(foe, target, distance) {
  const {unit,type} = foe;
  const phase = foePhase(unit);
  if ((type === 'summoner' || unit.boss && phase > 1) && foe.mp > 0 &&
      canSummonEnemy(battle.group,foe)) {
    return {label:'影狼召喚',effect:'summon',lead:1.14,range:0,power:0};
  }
  if (type === 'archer' && foe.pattern%3 !== 2) {
    return {label:'狙い矢',kind:'arrow',lead:.83,range:137,width:12,power:unit.power*1.17};
  }
  if (type === 'healer' && foe.mp > 0) {
    const wounded = woundedEnemy(battle.group);
    if (wounded && arenaDistance(actorPoint(foe.key),actorPoint(wounded.key)) < 174) {
      return {label:'治療の光', effect:'heal',patient:wounded,lead:.83,range:174,power:0};
    }
  }
  if ((type === 'mage' || unit.boss && foe.pattern % 4 === 3) && foe.mp > 0) {
    return {label:unit.boss ? '必殺・星蝕の陣' : '術師の魔弾',effect:'spell',kind:'wave',
      lead:unit.boss ? .93 : .73,range:unit.boss ? 147 : 113,width:24,power:unit.power*(unit.boss ? 1.48 : 1.17)};
  }
  if (foe.counterAt && clock >= foe.counterAt && distance < 66) {
    return {label:'盾返し',kind:'rush',lead:.47,range:67,width:25,power:unit.power*1.18};
  }
  const sequence = unit.pattern || (isFinalBoss(unit) ? finalSequences[phase-1] :
    unit.rank === 'mid' ? midSequence : bossPatterns[unit.chapter%bossPatterns.length]);
  let kind = unit.boss ? sequence[foe.pattern%sequence.length] : type === 'flanker' && foe.pattern%2 ? 'rush' : 'bite';
  if (unit.boss && foe.body.motion === 'stomp' && kind === 'slow') kind = 'stomp';
  const move = arenaAttacks[kind];
  const combo = unit.boss && phase > 1 && kind === 'rush';
  const wave = kind === 'stomp' || kind === 'wave' && (phase === 3 || unit.trial !== undefined);
  const reach = type === 'mage' || type === 'healer' ? unit.range-foe.profile.range : unit.range;
  const range = Math.min(190,reach+foe.body.radius+move.reach+5);
  const linked = !unit.boss && livingEnemies(battle.group).some(other=>{
    const contact = other !== foe && other.strike?.target === target.key && other.strike.effect !== 'heal' && other.strike.effect !== 'summon';
    return contact && Math.abs(actorPoint(other.key).y-actorPoint(foe.key).y) > 28;
  });
  return {label:linked ? '十字連携' : combo ? '連続突進' : wave && kind === 'wave' ? '環状衝撃波' : move.label,
    kind,repeat:combo,lead:move.lead+(unit.boss ? .18 : .17)+(linked ? .15 : 0),wave,range,width:22+foe.body.radius*.4,
    power:(unit.power+move.extra+(phase-1)*8)*(linked ? 1.21 : 1)};
}

function advanceEnemy(dt,foe,targets) {
  const {unit,body,type} = foe;
  if (foe.strike || clock < foe.hitUntil && body.size < 1.5) return;
  const point = actorPoint(foe.key);
  const blockers = [...groupBlockers(foe),...targets];
  const scout = type === 'flanker';
  const score = mark => {
    const distance = arenaDistance(point,mark);
    return scout || type === 'mage' ? hostileThreat(mark.profile,mark.unit.hp/mark.max,mark.armor,distance) : distance;
  };
  const target = targets.reduce((a,b)=>score(a)<=score(b) ? a : b);
  const distance = arenaDistance(point,target);
  const dir = directionTo(target.x-point.x,target.y-point.y,foe.facing);
  const nearDeath = !unit.boss && unit.hp < unit.max*.19 && type !== 'guard';
  if (nearDeath && !foe.fleeReady && reservesRemaining(battle.group)) {
    foe.fleeReady = true;
    foe.helpUntil = clock+1.0;
    battle.group.requested = true;
    say(unit.name+'が仲間を呼んだ！',1.5);
  } else if (nearDeath && !unit.boss && foe.mark < .56 && !reservesRemaining(battle.group) &&
      !livingEnemies(battle.group).some(other=>other.type === 'healer' && other.mp > 0)) {
    const right = point.x >= target.x;
    if (right ? point.x > 559 : point.x < 81) {
      foe.state = 'fled';
      foe.fallenAt = clock;
      say(unit.name+'が逃げ出した。',1.4);
    } else moveArena(foe.key,right ? 1 : -1,-dir.y*.34,dt*unit.speed*1.25,groupBlockers(foe));
    return;
  }
  if (foe.helpUntil > clock) return;
  const facingDot = dir.x*foe.facing.x+dir.y*foe.facing.y;
  if (clock >= foe.defendAt && distance < 73 && battle.heroStrike && facingDot > .14) {
    foe.defendAt = clock+(type === 'guard' ? 2.8 : 4.1);
    if (type === 'guard' || unit.boss && foePhase(unit) > 1 && battle.heroCombo >= 3) {
      foe.guardUntil = clock+.64;
    }
    else if (scout) {
      foe.evadeAt = clock+.21;
      moveArena(foe.key,-dir.y,dir.x,23,blockers);
      return;
    }
  }
  const move = enemyTacticMove(foe,target,distance);
  const occupied = battle.group.members.filter(other=>other.strike && other.state === 'active').length;
  if (clock >= foe.nextAt && clock >= battle.nextAttackAt && occupied < battle.group.rule.slots &&
      (move.effect === 'heal' || move.effect === 'summon' || distance <= move.range+3)) {
    const heading = move.kind === 'rear' ? {x:-foe.facing.x,y:-foe.facing.y} : dir;
    if (move.kind !== 'rear') foe.facing = dir;
    if (move.effect) foe.mp--;
    if (move.effect === 'summon') foe.summoning = true;
    foe.strike = {...move,...point,direction:heading,target:target.key,at:clock+move.lead};
    foe.pattern++;
    foe.counterAt = 0;
    battle.nextAttackAt = clock+(battle.group.kind === 'trial' ? .29 : .43);
    return;
  }
  if (foe.guardUntil > clock) return;
  foe.facing = directionTo(foe.facing.x+dir.x*dt*4,foe.facing.y+dir.y*dt*4,dir);
  const ranged = type === 'archer' || move.effect === 'spell';
  const spacing = Math.max(body.radius+13,Math.min(move.range*.72,ranged ? 102 : 44));
  if (ranged && distance < spacing*.55 && clock < foe.nextAt) {
    moveArena(foe.key,-dir.x,-dir.y,Math.min(spacing-distance,dt*unit.speed*.7),blockers);
    return;
  }
  if (distance <= spacing) return;
  const lane = clamp(target.y+(foe.index%2 ? 1 : -1)*(scout ? 64 : 34),55,255);
  const back = scout && target.key === 'hero' ?
    {x:clamp(target.x-player.facing.x*52,49,589),y:clamp(lane-player.facing.y*18,55,255)} : {x:target.x,y:lane};
  const approach = !unit.boss && (scout || foe.index%3 === 2) && Math.abs(point.y-back.y)>13 && distance>48 ?
    directionTo(back.x-point.x,back.y-point.y,dir) : dir;
  const speed = dt*unit.speed*body.speed*(clock < foe.slowedUntil ? .55 : 1)*(unit.boss && unit.hp < unit.max*.5 ? 1.20 : 1);
  moveArena(foe.key,approach.x,approach.y,Math.min(distance-spacing,speed),blockers);
  if (foe.leader && body.size >= 3 && clock >= (foe.footstepAt || 0)) {
    audio.play('quake');
    foe.footstepAt = clock+1.1;
    battle.stepDust = {...actorPoint(foe.key),until:clock+.32};
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
  if ((strike?.kind === 'stomp' || strike?.effect === 'spell') && !blocked) {
    footingUntil = Math.max(footingUntil,clock+(strike.kind === 'stomp' ? 3.1 : 2.4));
  }
  if (strike && !blocked) moveArena('hero', -facing.x, -facing.y, battle.body.size > 3 ? 18 : 9, groupBlockers());
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
  if (slot.guard <= clock) moveArena(role,away.x,away.y,9,groupBlockers());
  addNumber(damage,point.x,battleDepth(point.y)-40,'#ffada6');
}

function updateCompanion(dt,slot) {
  const {member,role} = slot;
  if (!member.hp) return;
  const profile = companionProfiles[member.name];
  const warning = actionDanger(actorPoint(role),arenaAlly.radius);
  const defensive = member.tactic === '守備優先';
  const support = member.tactic === '支援優先';
  const point = actorPoint(role);
  if (warning && strikeContains(warning,point,arenaAlly.radius) && warning.at-clock < .27 && clock >= slot.defenseAt) {
    slot.defenseAt = clock + (defensive ? 2.2 : 3.4);
    if (defensive || profile.role === 'sword' || warning.wave) slot.guard = clock+.38;
    else {
      slot.dodge = clock+.32;
      retreatFromStrike(role,warning,42);
    }
    return;
  }
  if (slot.guard > clock || slot.dodge > clock) return;
  const signature = companionLimit(member);
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
  const foe = nearestActionFoe(point);
  if (!foe) return;
  const reach = (useSkill ? signature.reach : magic ? profile.reach : 35)+foe.body.radius;
  if (!closeOnEnemy(role,dt,profile.speed*(defensive ? .88 : 1),reach,!defensive,foe)) return;
  if (clock < slot.next) return;
  slot.next = clock+(magic ? 1.7 : 1.22);
  slot.action = {kind:magic || useSkill ? 'magic' : 'attack',until:clock+.33,target:actorPoint(foe.key)};
  if (useSkill) {
    member.mp -= signature.cost;
    slot.skillAt = clock+14;
    battle.skillCue = {name:signature.name,color:signature.color,until:clock+1.1,x:point.x,y:battleDepth(point.y)-39};
  } else if (magic) member.mp -= 3;
  audio.play(magic || useSkill ? 'magic' : 'attack');
  slot.pressure = clock+1.6;
  const damage = companionPower(member)+(magic ? 5 : 0);
  const element = (magic || useSkill) && companionProfile(member.name).element;
  positionalHit(actorPoint(role),damage*(useSkill ? signature.power : 1),magic ? 'magic' : null,foe,element);
}

function updateActionCat(dt) {
  const next = awakening[cat.form + 1];
  if (next && battle.age - battle.awakeSince + 1e-8 >= next.turn * 5) {
    shiftCatForm(cat.form + 1);
    battle.catEffect = {until: clock + 1.1, type: 'awakening'};
    audio.play('awake' + cat.form);
    say('ソソが第' + (cat.form + 1) + '形態・' + next.name + 'に覚醒！', 3);
    if (cat.form === 5) {
      audio.playInterlude('26');
      startCinema('awakening');
    }
  }
  const point = actorPoint('cat');
  const foe = nearestActionFoe(point);
  if (!cat.hp || !foe) return;
  const form = catForm();
  const reach = [25,38,42,46,110,150][cat.form]+foe.body.radius;
  const warning = actionDanger(point,arenaCat.radius);
  if (warning && warning.at-clock < .22 && clock >= battle.catDefenseAt) {
    battle.catDefenseAt = clock+3.6;
    battle.catDodge = clock+.30;
    retreatFromStrike('cat',warning,36);
    return;
  }
  if (clock < battle.catDodge) return;
  if (player.hp <= maxHP()*.23 && !battle.auto) {
    const hero = actorPoint('hero');
    const target = actorPoint(foe.key);
    const guard = directionTo(target.x-hero.x,target.y-hero.y);
    moveArena('cat',hero.x+guard.x*15-point.x,hero.y+guard.y*15-point.y,form.speed*dt,groupBlockers());
    if (arenaDistance(actorPoint('cat'),target) > reach) return;
  } else if (!closeOnEnemy('cat',dt,form.speed*.71,reach,true,foe)) return;
  if (clock < battle.catNext) return;
  const holy = ++battle.catStrikes % 4 === 0 && cat.mp >= 80;
  if (holy) {
    cat.mp -= 80;
    cat.hp = Math.min(form.hp, cat.hp + Math.ceil(form.hp * .1));
    player.hp = Math.min(maxHP(), player.hp + 12);
    audio.play('holy');
    say('ソソの神聖魔法・星祈。ふたりのHPが回復！', 1.4);
  }
  battle.catEffect = {until: clock + (holy ? .65 : .32), type: holy ? 'holy' : 'strike',target:actorPoint(foe.key)};
  battle.catNext = clock + [1.32, 1.2, 1.16, 1.14, 1.06, 1][cat.form];
  battle.link = clock + .95;
  const resistant = foe.unit.trial !== undefined || foe.unit.chapter >= 10 && foe.unit.boss;
  const base = form.atk * (resistant ? .65 : 1.45);
  let damage = Math.ceil(base * (holy ? 1.5 : 1));
  if (!holy && cat.form === 1) foe.burn = {at: clock + .55, damage: Math.ceil(base * .35)};
  if (!holy && cat.form === 2) foe.slowedUntil = clock + .65;
  if (!holy && cat.form === 3 && foe.strike) damage += Math.ceil(base * .45);
  if (!holy && cat.form === 4) {
    const drained = Math.ceil(base * .18);
    damage += drained;
    cat.hp = Math.min(form.hp, cat.hp + drained);
  }
  if (!holy && cat.form === 5) damage += Math.ceil(base * .3);
  battle.catPressure = clock + 1.55;
  positionalHit(actorPoint('cat'),damage,cat.form >= 4 ? 'magic' : null,foe);
}

function resolveHeroStrike() {
  const hit = battle.heroStrike;
  if (!hit || clock < hit.at) return;
  battle.heroStrike = null;
  battle.lastSlash = hit;
  audio.play(hit.sound);
  const point = actorPoint('hero');
  const hits = livingEnemies(battle.group).filter(foe=>aimHitsEnemy(point,hit.direction,hit.reach,hit.width,foe))
    .sort((a,b)=>arenaDistance(point,actorPoint(a.key))-arenaDistance(point,actorPoint(b.key)));
  if (!hits.length) return;
  battle.heroPressure = clock+1.35;
  battle.heroCombo = battle.lastTechnique === hit.technique ? (battle.heroCombo || 0)+1 : 1;
  battle.lastTechnique = hit.technique;
  const link = joined && battle.link > clock;
  if (link) battle.link = 0;
  for (const [index,foe] of hits.entries()) positionalHit(point,
    (hit.power+(link ? Math.ceil(catForm().atk*.55) : 0))*(index ? .72 : 1),hit.technique,foe);
}

function resolveEnemyStrike(foe) {
  const strike = foe.strike;
  const {unit} = foe;
  foe.strike = null;
  foe.nextAt = clock + unit.interval + (unit.boss ? .22 : .83);
  if (strike.effect === 'summon') {
    const spirit = summonEnemy(battle.group,foe);
    if (!spirit) return;
    placeActionEnemy(spirit);
    const mark = actorPoint(foe.key);
    battle[spirit.key+'X'] = clamp(mark.x-foe.facing.x*38,55,585);
    battle[spirit.key+'Y'] = clamp(mark.y+(foe.index%2 ? 38 : -38),55,255);
    spirit.expiresAt = clock+16;
    say(foe.unit.name+'が影狼を召喚！',2.8);
    audio.play('summon');
    return;
  }
  if (strike.effect === 'heal') {
    const target = strike.patient;
    if (target.state !== 'active') return;
    const healed = Math.min(target.unit.max-target.unit.hp,Math.ceil(target.unit.max*.13));
    target.unit.hp += healed;
    target.healedUntil = clock+.65;
    const point = actorPoint(target.key);
    addNumber('治療 +'+healed,point.x,battleDepth(point.y)-30,'#b3ecbe');
    audio.play('holy');
    return;
  }
  for (const slot of battle.members) hurtCompanion(strike,slot);
  if (joined && cat.hp && clock >= battle.catDodge && strikeContains(strike,actorPoint('cat'),arenaCat.radius)) {
    const cap = unit.trial !== undefined ? .26 : unit.boss ? .19 : .105;
    const damage = Math.min(Math.ceil(catForm().hp*cap),Math.max(140,strike.power*(unit.boss ? 110 : 55)-catForm().def));
    cat.hp = Math.max(0,cat.hp-damage);
    addNumber(damage,battle.catX,battleDepth(battle.catY)-35,'#ff9a9a');
    if (!cat.hp) return defeat('ソソは倒れた');
    const ratio = cat.hp/catForm().hp;
    const next = awakening[cat.form+1];
    if (next && battle.age-battle.awakeSince >= next.turn*5-2 && damage >= catForm().hp*.12) {
      shiftCatForm(0);
      battle.awakeSince = battle.age;
      say('ソソの覚醒が中断された。');
    }
    if (ratio <= .1 && !battle.superAwake) {
      battle.superAwake = true;
      audio.play('creation');
      say('一美が黄金の光をまとった。超覚醒！');
      for (const enemy of livingEnemies(battle.group)) {
        if (!enemy.unit.boss) hurtActionEnemy(enemy,enemy.unit.hp);
      }
    }
  }
  if (strikeContains(strike,actorPoint('hero'),arenaHero.radius) &&
      (strike.wave || strike.effect === 'spell' || jumpHeight < 18)) hurtActionHero(strike.power,strike);
  if (paused || foe.state !== 'active') return;
  if (strike.kind === 'rush') moveArena(foe.key,strike.direction.x,strike.direction.y,18,[heroBlocker(),...groupBlockers(foe)]);
  if (strike.repeat) {
    const point = actorPoint(foe.key);
    const target = actorPoint('hero');
    const direction = directionTo(target.x-point.x,target.y-point.y,strike.direction);
    foe.strike = {...strike,...point,label:'連続突進・追撃',direction,repeat:false,at:clock+.68,power:strike.power*.87};
  }
  foe.impact = {...strike,until:clock+.45,strong:foe.body.size >= 2.8};
  if (foe.impact.strong) audio.play('quake');
}

function updateActionBattle(dt) {
  const {group} = battle;
  battle.age += dt;
  if (battle.age < .4) return;
  if (battle.opening) {
    battle.opening = false;
    const leader = group.members[0];
    if (battle.approach === 'rear' && leader.state === 'active') leader.strike = {
      ...actorPoint(leader.key),label:'背後からの一撃',direction:leader.facing,kind:'rush',
      width:30,range:100,at:clock+.58,power:leader.unit.power,target:'hero'
    };
  }
  resolveHeroStrike();
  updateSummon();
  for (const foe of livingEnemies(group)) {
    if (foe.summoned && foe.expiresAt <= clock) {
      foe.state = 'faded';
      continue;
    }
    if (foe.burn?.at <= clock) {
      hurtActionEnemy(foe,foe.burn.damage,'炎');
      foe.burn = null;
    }
  }
  if (joined) updateActionCat(dt);
  for (const slot of battle.members) updateCompanion(dt,slot);
  const reinforcements = releaseEnemyWave(group,group.requested || clock >= group.nextAt && livingEnemies(group).length <= group.rule.opening);
  if (reinforcements.length) {
    for (const foe of reinforcements) placeActionEnemy(foe);
    say(encounterFormation(group,reinforcements.length),2.8);
    audio.play('encounter');
  }
  if (!livingEnemies(group).length) {
    finishEnemyGroup();
    return;
  }
  const targets = hostileTargets();
  for (const foe of livingEnemies(group)) {
    if (foe.strike?.at <= clock) resolveEnemyStrike(foe);
    else advanceEnemy(dt,foe,targets);
    if (paused) return;
  }
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
  } else launchFireball(Math.max(1,Math.floor(attackPower()*.48)),spell.color,
    ({frost:'氷',thunder:'雷',light:'光'})[spell.id] || '炎');
}

function updateActionStatus() {
  const leader = battle.group.members[0];
  const enemy = leader.state === 'active' ? leader.unit : nearestActionFoe(actorPoint('hero'))?.unit || leader.unit;
  reflectAuto('arena-auto',battle.auto);
  const phases = foePhaseCount(enemy);
  const phase = phases > 1 ? '　第' + foePhase(enemy) + '形態' : '';
  const armorPart = battle.group.members[0].armorPart;
  const ward = leader.ward > 0 ? '　王の結界 '+leader.ward : '';
  const part = armorPart ? '　' + armorPart.name + (armorPart.hp ? '' : '破壊済み') : '';
  $('arena-enemy').textContent = enemy.name + phase + ward + part + '　HP ' + enemy.hp + '/' + enemy.max;
  $('arena-enemy-hp').max = enemy.max;
  $('arena-enemy-hp').value = enemy.hp;
  const hp = $('arena-enemy-hp');
  if (hp.style.getPropertyValue('--phases') !== String(phases)) {
    hp.style.setProperty('--phases',String(phases));
    hp.dataset.phased = String(phases > 1);
  }
  const live = livingEnemies(battle.group);
  const warning = live.filter(foe=>foe.strike).sort((a,b)=>a.strike.at-b.strike.at)[0]?.strike;
  const status = '残り '+live.length+'体'+(reservesRemaining(battle.group) ? ' ＋ 増援' : '')+(warning ? '　'+warning.label : '');
  if ($('arena-warning').textContent !== status) $('arena-warning').textContent = status;
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
  const foe = nearestActionFoe(origin);
  if (!foe) return;
  const target = actorPoint(foe.key);
  const toward = directionTo(target.x-origin.x,target.y-origin.y,player.facing);
  player.facing = toward;
  const warning = actionDanger(origin,arenaHero.radius);
  battle.autoGuard = false;
  if (warning && warning.at - clock < .23 && strikeContains(warning,origin,arenaHero.radius)) {
    battle.autoGuard = true;
    gait = 'idle';
    if (clock >= dodgeAt) {
      const away = warning.wave ? {x:-toward.x,y:-toward.y} :
        {x:-toward.y,y:toward.x * (origin.y >= target.y ? 1 : -1)};
      moveArena('hero',away.x,away.y,30,groupBlockers());
      invulnerableUntil = clock + .23;
      dodgeAt = clock + .93;
      gait = 'dash';
    }
    return;
  }
  if (player.hp < maxHP() * .43) useActionHerb();
  const weapon = equipped('weapon');
  const reach = weapon.reach ?? 55;
  if (aimHitsEnemy(origin,toward,reach,bladeForm().width,foe)) {
    gait = 'idle';
    swing(Boolean(foe.armorPart?.hp && clock >= attackAt + .18));
  } else {
    gait = 'walk';
    moveArena('hero',toward.x,toward.y,dt*93,groupBlockers());
  }
}
