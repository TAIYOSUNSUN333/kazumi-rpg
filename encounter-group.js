const enemyRoles = {
  fighter: {name:'剣兵', color:'#efbb8d', hp:1.04, power:1.09, armor:.22, speed:1.08, range:0, mp:0},
  guard: {name:'盾兵', color:'#a8bfd8', hp:1.32, power:.98, armor:.59, speed:.86, range:0, mp:0},
  flanker: {name:'斥候', color:'#b9dc9f', hp:.89, power:1.13, armor:.14, speed:1.45, range:4, mp:0},
  mage: {name:'術師', color:'#c5aff9', hp:.91, power:1.18, armor:.18, speed:1.02, range:61, mp:3},
  healer: {name:'治療兵', color:'#f6df94', hp:.87, power:.92, armor:.20, speed:1.06, range:30, mp:2},
  archer: {name:'弓兵',color:'#cbd998',hp:.94,power:1.05,armor:.20,speed:1.09,range:52,mp:0},
  summoner: {name:'召喚士',color:'#e0a5cf',hp:1.08,power:1.01,armor:.25,speed:.94,range:36,mp:2},
  giant: {name:'巨獣',color:'#edaf81',hp:1.52,power:1.31,armor:.48,speed:.78,range:9,mp:0},
  commander: {name:'隊長', color:'#ffd18b', hp:1.2, power:1.18, armor:.37, speed:1.12, range:0, mp:3}
};

const encounterRules = {
  ordinary:{name:'敵の小隊', min:3,max:6,opening:3,slots:2},
  elite:{name:'強敵の部隊', min:5,max:10,opening:5,slots:3},
  raid:{name:'集団襲撃', min:10,max:20,opening:10,slots:4},
  mid:{name:'中ボスと直属部隊', min:4,max:6,opening:4,slots:3},
  major:{name:'大ボスと精鋭部隊', min:5,max:8,opening:5,slots:3},
  trial:{name:'四天王の親衛隊', min:10,max:15,opening:8,slots:4}
};

function encounterKind(enemy) {
  if (enemy.trial !== undefined) return 'trial';
  if (enemy.boss) return enemy.rank === 'mid' ? 'mid' : 'major';
  if (enemy.slot !== 4) return 'ordinary';
  return enemy.chapter % 5 === 3 ? 'raid' : 'elite';
}

function groupRole(source, kind, index) {
  if (!index && source.boss) return 'commander';
  if (kind !== 'ordinary' && index === 1) return 'guard';
  if (index === 2 && (kind !== 'ordinary' || source.chapter >= 3)) return 'healer';
  if (index === 3 && ['major','raid','trial'].includes(kind)) return 'summoner';
  if (index === 4 && ['major','raid','trial'].includes(kind)) return 'giant';
  if (index === 3 && kind !== 'ordinary' && source.chapter >= 30) return 'summoner';
  if (index === 5 && source.chapter >= 20 && source.trial === undefined) return 'flanker';
  const wings = [
    ['mage','fighter','flanker'],['guard','healer','mage'],
    ['flanker','flanker','mage'],['flanker','guard','healer']
  ];
  const choices = source.trial !== undefined ? wings[source.trial] : source.chapter >= 12 && source.chapter < 20 ?
    ['mage','guard','flanker','archer','mage'] : ['fighter','guard','flanker','mage','archer'];
  return choices[Math.floor(Math.random()*choices.length)];
}

function createEnemyGroup(source) {
  const kind = encounterKind(source);
  const rule = encounterRules[kind];
  const chapter = source.chapter+1;
  const progression = chapter <= 5 ? 0 : chapter < 10 ? .07 : chapter <= 12 ? .16 :
    chapter <= 20 ? .09 : chapter <= 30 ? .14 : chapter <= 40 ? .20 : chapter <= 46 ? .26 : .32;
  const total = rule.min + Math.floor(Math.random()*(rule.max-rule.min+1));
  const opening = Math.min(total,rule.opening+Math.floor(Math.random()*2));
  const reserve = kind !== 'ordinary' || total >= 5 ? Math.max(0,total-opening) : 0;
  const terrainFoes = activeEnemies(source.chapter).slice(0,6);
  const members = Array.from({length:total},(_,index) => {
    const leader = index === 0;
    const base = leader ? source : terrainFoes[Math.floor(Math.random()*terrainFoes.length)];
    const type = groupRole(source,kind,index);
    const profile = enemyRoles[type];
    const protection = kind === 'trial' ? 1.55 : kind === 'major' || kind === 'raid' ? 1.22 : kind === 'elite' ? 1.12 : 1;
    const scale = leader ? profile.hp*(1.10+progression) : (source.chapter < 10 ? .47 : .52) * profile.hp * protection;
    const max = Math.max(9,Math.ceil(base.max*scale));
    const unit = {...base,max,
      hp:leader ? Math.max(1,Math.ceil(max*source.hp/source.max)) : max,
      power:Math.ceil(base.power*profile.power*(leader ? 1.07+progression*.30 : protection*.72)),
      speed:base.speed*profile.speed*(1+progression*.27), defense:Math.ceil(base.power*profile.armor*(leader ? 1.2 : 1)),
      range:base.range+profile.range, flash:0};
    const wave = index < total-reserve ? 0 : index < opening+Math.ceil(reserve*.56) ? 1 : 2;
    return {unit,index,leader,type,profile,wave,mp:profile.mp,state:wave ? 'reserve' : 'active',
      mark:Math.random(),depth:Math.random(),fleeReady:false,fallenAt:-Infinity,
      ward:leader && kind === 'trial' ? 4 : 0};
  });
  return {source,kind,rule,members,wave:0,nextAt:clock+8,requested:false};
}

const livingEnemies = group => group.members.filter(foe=>foe.state === 'active' && foe.unit.hp > 0);
const reservesRemaining = group => group.members.filter(foe=>foe.state === 'reserve').length;

function releaseEnemyWave(group, trigger = false) {
  if (!reservesRemaining(group)) return [];
  if (!trigger && livingEnemies(group).length > 1) return [];
  const wave = ++group.wave;
  const incoming = group.members.filter(foe=>foe.state === 'reserve' && foe.wave === wave);
  for (const foe of incoming) foe.state = 'active';
  group.nextAt = clock+9;
  group.requested = false;
  return incoming;
}

function canSummonEnemy(group, caster) {
  return !caster.summonedOnce && !caster.summoning && group.members.filter(foe=>foe.summoned).length < 2;
}

function summonEnemy(group, caster) {
  caster.summoning = false;
  if (!canSummonEnemy(group,caster)) return null;
  caster.summonedOnce = true;
  const base = activeEnemies(group.source.chapter)[3];
  const max = Math.max(13,Math.ceil(caster.unit.max*(caster.leader ? .14 : .57)));
  const unit = {...base,name:'影狼（敵の召喚）',max,hp:max,flash:0,
    power:Math.ceil(caster.unit.power*.74),defense:Math.ceil(caster.unit.defense*.5),speed:base.speed*1.32};
  const foe = {unit,index:group.members.length,leader:false,type:'flanker',profile:enemyRoles.flanker,mp:0,
    state:'active',summoned:true,wave:0,mark:Math.random(),depth:Math.random(),fallenAt:-Infinity};
  group.members.push(foe);
  return foe;
}

function foePhaseCount(unit) {
  if (isFinalBoss(unit)) return 3;
  return unit.rank === 'major' || unit.trial !== undefined ? 2 : 1;
}

function foePhase(unit) {
  const count = foePhaseCount(unit);
  for (let phase=count;phase>1;phase--) {
    if (unit.hp <= Math.ceil(unit.max*(count-phase+1)/count)) return phase;
  }
  return 1;
}

function foeElement(foe) {
  const original = foe.unit.trial !== undefined ? ['炎','氷','雷','闇'][foe.unit.trial] :
    foe.unit.boss ? ['炎','氷','雷','闇'][foe.unit.chapter%4] :
    foe.type === 'mage' && !foe.unit.variant ? '炎' : ['無','炎','氷','雷'][foe.unit.variant || 0];
  const phase = foePhase(foe.unit);
  return phase === 3 ? '闇' : phase === 2 ? (oppositeElement[original] || '光') : original;
}

function groupCombatBody(foe) {
  const body = combatBody(foe.unit);
  const scale = foe.type === 'giant' ? 1.70 : foe.leader ? 1 : .90+foe.mark*.28;
  return {...body,size:body.size*scale,radius:body.radius*scale};
}

function damageEnemySlot(foe, damage) {
  if (foe.state !== 'active' || foe.unit.hp <= 0) return 0;
  const enemy = foe.unit;
  const previous = enemy.hp;
  const stages = foePhaseCount(enemy);
  const boundary = Math.ceil(enemy.max*(stages-foePhase(enemy))/stages);
  enemy.hp = Math.max(boundary,enemy.hp-Math.max(1,Math.round(damage*(foe.ward ? .32 : 1))));
  enemy.flash = clock+.16;
  if (!enemy.hp) {
    foe.state = 'defeated';
    foe.fallenAt = clock;
    foe.strike = null;
  }
  return previous-enemy.hp;
}

function woundedEnemy(group, limit = .62) {
  return livingEnemies(group).filter(foe=>foe.unit.hp < foe.unit.max*limit)
    .sort((a,b)=>a.unit.hp/a.unit.max-b.unit.hp/b.unit.max)[0];
}

function rememberEncounterDamage() {
  const group = battle?.group;
  if (!group || group.source.trial !== undefined || group.source.hiddenRegion !== undefined) return;
  const leader = group.members[0].unit;
  const source = group.source;
  // Only winning the entire encounter clears the symbol and advances the story.
  source.hp = Math.min(source.hp,Math.max(1,Math.ceil(leader.hp/leader.max*source.max)));
}

function finishEnemyGroup() {
  const group = battle?.group;
  if (!group || reservesRemaining(group) || livingEnemies(group).length) return;
  const source = group.source;
  source.hp = 0;
  for (const foe of group.members) {
    if (!foe.summoned && (foe.state === 'defeated' || foe.state === 'captured')) monsterDex.add(foe.unit.name);
  }
  hurtEnemy(source,0);
}

function encounterFormation(group, count) {
  return count ? '増援 ' + count + '体が到着！' : group.rule.name + '　敵 ' +
    livingEnemies(group).length + '体' + (reservesRemaining(group) ? '・増援あり' : '');
}

function hostileThreat(profile, healthRatio, armor, distance) {
  const prey = profile?.role === 'heal' ? 74 : 0;
  return distance + Math.min(100,armor)*.45 + healthRatio*22 - prey;
}
