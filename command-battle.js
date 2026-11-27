const battleElements = ['無', '炎', '氷', '雷', '闇', '全'];
const oppositeElement = {炎:'氷', 氷:'炎', 雷:'闇', 闇:'光', 光:'闇'};
const commandColors = {無:'#ffe6b6', 炎:'#ff9f65', 氷:'#9adfff', 雷:'#f0da84', 闇:'#c9a0f6', 光:'#f7efbc', 全:'#ffe693'};
const commandStatusNames = {burn:'火傷', chill:'鈍足', blind:'暗闇'};
const turnAttack = (name, power, element = '無', cost = 0, motion = 'strike', status = null) =>
  ({name, power, element, cost, motion, status});
const turnHeal = (name, power, cost = 0, herb = false) =>
  ({name, power, cost, motion:'heal', element:'光', herb});

function startCommandBattle(enemy, approach) {
  const side = approach === 'rear' ? -1 : 1;
  const displayX = value => 320 + side * (value - 320);
  const actor = (id, name, x, y, stats) => ({
    id, name, x:displayX(x), y, stats, guarding:false, status:null, hitUntil:0
  });
  const allies = [actor('hero', '一美', 476, 240, () => ({
    unit:player, max:maxHP(), maxMP:maxMP(), atk:attackPower(), def:defense(), speed:124 + level() * 2,
    element:'無', weakness:'闇'
  }))];
  for (const [index,member] of activeCompanions().entries()) {
    const profile = companionProfile(member.name);
    const ally = actor('ally'+index,companionName(member),511+(index%2)*44,205+Math.floor(index/2)*26,() => ({
      unit:member, max:companionHP(member), maxMP:companionMP(member),
      atk:companionPower(member),
      def:profile.defense + companionLevel(member) + member.gear,
      speed:profile.speed + companionLevel(member) * 2,
      element:profile.element, weakness:profile.role === 'heal' ? '闇' : '無'
    }));
    ally.member = member;
    allies.push(ally);
  }
  if (joined) allies.push(actor('cat', 'ソソ', 551, 263, () => ({
    unit:cat, max:catForm().hp, maxMP:catForm().mp, atk:catForm().atk, def:catForm().def,
    speed:catForm().speed, element:battleElements[cat.form], weakness:oppositeElement[battleElements[cat.form]]
  })));

  const foes = battle.group.members.map(slot=>commandFoe(slot,side));
  battle.command = {
    allies, foes, side, approach, round:1, awakeTurns:0, phase:'entry', delay:.36, plan:[], queue:[],
    pick:0, view:'main', selection:null, action:null, log:approach === 'rear' ? '敵のバックアタック！' :
      approach === 'first' ? '一美たちの先制攻撃！　' + encounterFormation(battle.group) : encounterFormation(battle.group)
  };
  battle.entry = {x:player.x, y:player.y};
  battle.heroX = allies[0].x;
  updateCommandUI();
}

function commandFoe(slot, side) {
  const {unit:foe,index} = slot;
  const x = slot.leader ? 153 : 61+((index-1)%5)*44+slot.mark*9;
  const y = slot.leader ? 235 : slot.summoned ? 159+slot.depth*19 : 190+Math.floor((index-1)/5)*25+slot.depth*9;
  return {id:'foe'+index,name:slot.leader || slot.summoned ? foe.name : slot.profile.name+' '+index+'・'+foe.name,
    x:320+side*(x-320),y,guarding:false,status:null,hitUntil:0,enemy:foe,enemySlot:slot,
    stats:()=>({unit:foe,max:foe.max,maxMP:slot.profile.mp,atk:foe.power,def:foe.defense,
      speed:foe.speed*1.38,element:foeElement(slot),weakness:oppositeElement[foeElement(slot)]})};
}

const commandAlive = actor => !!actor && (!actor.enemySlot || actor.enemySlot.state === 'active') && actor.stats().unit.hp > 0;

function commandSpeed(actor) {
  const speed = actor.stats().speed;
  return actor.status?.type === 'chill' ? speed * .66 : speed;
}

function commandOrder(actors) {
  return [...actors].sort((a, b) => commandSpeed(b) - commandSpeed(a));
}

function enemyCommand(actor, turn, target) {
  const slot = actor.enemySlot;
  const enemy = actor.enemy;
  const phase = foePhase(enemy);
  if ((slot.type === 'summoner' || enemy.boss && phase > 1) && slot.mp > 0 &&
      canSummonEnemy(battle.group,slot)) {
    return {name:'影狼召喚',cost:1,motion:'enemySummon',target:actor};
  }
  if (slot.type === 'archer') return turnAttack('狙い矢',1.06);
  const patient = slot.type === 'healer' && slot.mp && woundedEnemy(battle.group);
  if (patient) return {...turnHeal('治療の光',.15,1),target:turn.foes[patient.index]};
  if (!enemy.boss && slot.type !== 'guard' && enemy.hp < enemy.max*.20) {
    if (reservesRemaining(battle.group) && !slot.fleeReady) return {name:'仲間を呼ぶ',cost:0,motion:'call',target:actor};
    if (slot.mark < .58 && !reservesRemaining(battle.group)) return {name:'逃げ出す',cost:0,motion:'flee',target:actor};
  }
  if (slot.type === 'guard' && (turn.round+slot.index)%3 === 0) {
    return {name:'盾を構える',cost:0,motion:'guard',target:actor};
  }
  if (slot.mp > 0 && (slot.type === 'mage' || enemy.boss && turn.round%4 === 0)) {
    const element = actor.stats().element === '無' ? '炎' : actor.stats().element;
    return {...turnAttack(enemy.boss ? '必殺・星蝕の陣' : '術師の魔弾',enemy.boss ? 1.55 : 1.05,element,1,
      enemy.boss ? 'limit' : 'magic',element === '炎' ? 'burn' : 'chill'),all:enemy.boss && phase >= 2};
  }
  const bossMoves = enemy.pattern || (isFinalBoss(enemy) ? finalSequences[phase-1] :
    enemy.rank === 'mid' ? midSequence : bossPatterns[enemy.chapter%bossPatterns.length]);
  const kind = enemy.boss ? bossMoves[(turn.round-1)%bossMoves.length] :
    slot.type === 'flanker' && turn.round%2 ? 'rush' : 'bite';
  const move = arenaAttacks[kind];
  const magic = kind === 'wave';
  const element = magic ? actor.stats().element : '無';
  const linked = slot.type === 'flanker' && turn.round%3 === 2 && livingEnemies(battle.group).length >= 3;
  return {...turnAttack(linked ? '十字連携' : move.label,
    (1+move.extra*.053+(phase-1)*.095)*(linked ? 1.17 : slot.leader ? 1 : .86),element,0,
    magic ? 'magic' : kind === 'stomp' ? 'quake' : kind === 'rush' ? 'leap' : 'strike',
    magic ? ({炎:'burn',氷:'chill',雷:'chill',闇:'blind'})[element] : null),
    all:kind === 'stomp' || magic && (phase === 3 || enemy.trial !== undefined),target};
}

function commandMoves(actor, group) {
  const {round, superAwake, limitReady} = battle.command;
  const id = actor.id;
  const hero = id === 'hero';
  const catActor = id === 'cat';
  const form = catForm();
  const element = actor.stats().element;
  const profile = actor.member ? companionProfile(actor.member.name) : null;
  if (group === 'attack') {
    return [turnAttack(catActor ? form.spell : hero ? equipped('weapon').name : '通常攻撃',
      hero && superAwake ? 1.65 : catActor ? 1.5 : 1, element, 0, catActor && cat.form >= 4 ? 'magic' : 'strike')];
  }
  if (group === 'magic') {
    if (hero) return [
      ...(ring ? [turnAttack('燐光の火球', .35, '炎', starterRing.mp, 'magic', 'burn')] : []),
      ...(stoneMagicLearned ? [turnHeal(stoneSpell.name, .28, stoneSpell.mp)] : []),
      ...(battle.command.summon ? [] : learnedSummons().map(spirit =>
        ({name:spirit.name+'を召喚',cost:spirit.cost,motion:'summon',element:spirit.element,spirit,all:true})))
    ];
    if (catActor) return [
      {...turnAttack(cat.form === 5 ? '創世光' : form.spell + 'の加護', 2.15, cat.form ? element : '光',
        120 + cat.form * 35, 'magic', ['blind','burn','chill','chill','blind',null][cat.form])},
      turnHeal('聖なる毛づくろい', .25, 180)
    ];
    return [
      ...(profile.role === 'heal' ? [turnHeal(profile.skill, .34, 6)] : []),
      ...(profile.role === 'magic' ? [turnAttack(profile.skill,1.4,profile.element,5,'magic','chill')] : [])
    ];
  }
  if (group === 'skill') {
    if (hero) return [turnAttack(bladeForm().name + '・連撃', 1.7, '無', 3, 'combo'),
      turnAttack('跳び込み斬り', 1.3, '無', 2, 'leap'),
      {...turnAttack('扇斬り',1.02,'無',5,'combo'),all:true}];
    if (catActor) return [turnAttack('ひかりの爪', 1.85, '光', 90, 'leap')];
    return [turnAttack(profile.role === 'sword' ? profile.skill : '跳び込み打ち', 1.5, '無', 3, 'leap')];
  }
  if (group === 'limit') {
    const signature = actor.member && companionLimit(actor.member);
    if (signature && round >= (limitReady?.[id] || 0)) return [signature.heal ?
      {...turnHeal(signature.name,signature.power,signature.cost),all:true,signature:true} :
      turnAttack(signature.name,signature.power,element,signature.cost,'limit')];
    if (catActor && cat.form === 5 && round >= (limitReady?.cat || 0)) {
      return [{...turnAttack('天地創生', 4.3, '全', 999, 'limit'), all:true}];
    }
    if (!hero || round < (limitReady?.hero || 0)) return [];
    const link = joined && cat.hp > 0;
    return [{...turnAttack(link ? '双星の誓い' : 'ソソを思う', 2.9, '光', 10, 'limit'),
      link,all:true,sweep:battle.group.kind === 'ordinary' || superAwake}];
  }
  if (group === 'item') return marketGoods.filter(good=>goodCount(good)>0).map(good=>({
    ...turnHeal(good.name+'（残り '+goodCount(good)+'）',good.hp || 0,0,good.id === 'herb'),good
  }));
  return [];
}

const commandLabels = [
  ['attack','たたかう'], ['magic','魔法'], ['skill','特技'], ['limit','必殺技'],
  ['item','アイテム'], ['guard','防御'], ['escape','逃げる']
];

function updateCommandUI() {
  const tray = $('battle-commands');
  const turn = battle?.command;
  tray.hidden = !turn;
  if (!turn) return;
  const {phase, round} = turn;
  reflectAuto('command-auto',turn.auto);
  const acting = turn.allies[turn.pick];
  const upcoming = phase === 'resolve' ?
    [...(turn.action ? [turn.action] : []), ...turn.queue].map(action => action.actor) :
    commandOrder((phase === 'entry' && turn.approach === 'rear' ? turn.foes :
      round === 1 && turn.approach === 'first' ? turn.allies : [...turn.allies, ...turn.foes]).filter(commandAlive));
  $('battle-round').textContent = '第'+round+'ターン　敵'+livingEnemies(battle.group).length+'体'+
    (reservesRemaining(battle.group) ? '＋増援' : '');
  $('battle-order').textContent = upcoming.map(actor => actor.name).join(' → ');
  const threat = $('battle-intent');
  const intentions = phase === 'select' ? plannedEnemyActions(turn) : [];
  threat.hidden = intentions.length === 0;
  threat.textContent = intentions.map(({actor,move,target}) =>
    actor.name + '「' + move.name + '」→ ' + (move.all ? '全員' : target.name)).join(' ／ ');
  const party = turn.allies.map(actor => {
    const {unit, max, maxMP} = actor.stats();
    const card = document.createElement('div');
    card.className = 'battle-member';
    card.dataset.selected = String(phase === 'select' && actor === acting);
    const name = document.createElement('strong');
    name.textContent = actor.name + (!unit.hp ? '（戦闘不能）' : actor.status ? '（' + commandStatusNames[actor.status.type] + '）' : '');
    const hp = document.createElement('progress');
    hp.max = max;
    hp.value = unit.hp;
    hp.setAttribute('aria-label', actor.name + 'のHP');
    const vitals = document.createElement('span');
    const lv = actor.id === 'hero' ? level() : actor.id === 'cat' ? 99 : companionLevel(unit);
    vitals.textContent = 'Lv.' + lv + '　HP ' + unit.hp + '/' + max + '　MP ' + unit.mp + '/' + maxMP;
    card.append(name,hp,vitals);
    return card;
  });
  $('battle-party').replaceChildren(...party);
  $('battle-log').textContent = phase === 'select' && turn.view === 'target' ? turn.selection.name + 'の対象を選ぶ' :
    phase === 'select' ? (turn.view === 'main' ? acting.name + 'の行動を選ぶ' + (turn.log ? '　｜　' + turn.log : '') :
      acting.name + '・' + commandLabels.find(([id]) => id === turn.view)[1]) : turn.log;
  const gauge = $('battle-awakening');
  const next = joined ? awakening[cat.form + 1] : null;
  gauge.hidden = !joined;
  if (joined) {
    $('battle-awakening-text').textContent = 'ソソ 第' + (cat.form + 1) + '形態・' + catForm().name +
      (next ? '　覚醒まで ' + (next.turn - turn.awakeTurns) + 'ターン' : '　覚醒完了');
    $('battle-awakening-gauge').max = next ? next.turn - catForm().turn : 1;
    $('battle-awakening-gauge').value = next ? turn.awakeTurns - catForm().turn : 1;
  }
  const buttons = [];
  const add = (label, callback, disabled) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.disabled = Boolean(disabled);
    button.onclick = () => {
      if (!paused && turn === battle?.command && turn.phase === 'select') callback();
    };
    buttons.push(button);
  };
  if (phase === 'select') {
    if (turn.view === 'main') {
      for (const [group,label] of commandLabels) {
        add(label, () => {
          if (group === 'escape') return tryEscapeBattle();
          if (group === 'guard') return queueCommand(acting, {name:'防御', motion:'guard', cost:0}, acting);
          const moves = commandMoves(acting, group);
          if (moves.length === 1) return selectCommandTarget(turn, moves[0], group);
          turn.view = group;
          updateCommandUI();
        }, group === 'escape' && isFinalBoss(battle.enemy) || !['guard','escape'].includes(group) && !commandMoves(acting, group).some(move => move.cost <= acting.stats().unit.mp));
      }
      if (turn.plan.length) add('前の仲間', () => {
        const previous = turn.plan.pop();
        turn.pick = turn.allies.indexOf(previous.actor);
        updateCommandUI();
      });
    } else if (turn.view === 'target') {
      const choices = turn.selection.motion === 'heal' ? turn.allies : turn.foes;
      for (const target of choices.filter(commandAlive)) {
        const {unit,max,element} = target.stats();
        add(target.name + '　HP ' + unit.hp + '/' + max + (target.enemy ? '　' + element : ''), () => {
          queueCommand(acting, turn.selection, target);
        });
      }
      add('戻る', () => {
        turn.view = commandMoves(acting, turn.group).length > 1 ? turn.group : 'main';
        updateCommandUI();
      });
    } else {
      for (const move of commandMoves(acting, turn.view)) {
        add(move.name + (move.cost ? '（MP ' + move.cost + '）' : ''), () =>
          selectCommandTarget(turn,move,turn.view), move.cost > acting.stats().unit.mp);
      }
      add('戻る', () => { turn.view = 'main'; updateCommandUI(); });
    }
  }
  $('battle-options').replaceChildren(...buttons);
  tray.inert = paused;
}

function selectCommandTarget(turn, move, group) {
  if (move.all) {
    queueCommand(turn.allies[turn.pick], move, turn.foes.find(commandAlive));
    return;
  }
  turn.view = 'target';
  turn.selection = move;
  turn.group = group;
  updateCommandUI();
}

function queueCommand(actor, move, target) {
  const turn = battle.command;
  turn.plan.push({actor, move, target});
  const index = turn.allies.findIndex((other, position) => position > turn.pick && commandAlive(other));
  if (index < 0) return startCommandRound();
  turn.pick = index;
  turn.view = 'main';
  updateCommandUI();
}

function plannedEnemyActions(turn) {
  const {round,approach} = turn;
  if (round === 1 && approach === 'first' && !turn.failedEscape) return [];
  const living = turn.allies.filter(commandAlive);
  const enemies = turn.foes.filter(commandAlive);
  const plans = enemies.map((actor,index) => {
    const type = actor.enemySlot.type;
    const target = type === 'flanker' || type === 'mage' ? [...living].sort((a,b) => {
      const score = member => {
        const profile = member.member && companionProfiles[member.member.name];
        const stats = member.stats();
        return hostileThreat(profile,stats.unit.hp/stats.max,stats.def,Math.abs(member.x-actor.x)*.2);
      };
      return score(a)-score(b);
    })[0] : living[(round-1+index)%living.length];
    const move = enemyCommand(actor,turn,target);
    const weight = (move.motion === 'heal' || move.motion === 'call' || move.motion === 'enemySummon' ? 80 : actor.enemy.boss ? 70 :
      move.motion === 'guard' ? 30 : 10) + ((index+round*3)%Math.max(1,enemies.length))*.7;
    return {actor,move,target:move.target || target,weight};
  });
  const slots = battle.group.rule.slots;
  return plans.sort((a,b)=>b.weight-a.weight).slice(0,slots);
}

function startCommandRound() {
  const turn = battle.command;
  const plans = [...turn.plan, ...plannedEnemyActions(turn)];
  const order = commandOrder(plans.map(action => action.actor));
  turn.queue = order.map(actor => plans.find(action => action.actor === actor));
  for (const actor of [...turn.allies, ...turn.foes]) actor.guarding = false;
  turn.countered = new Set();
  for (const {actor,move} of plans) if (move.motion === 'guard') actor.guarding = true;
  turn.phase = 'resolve';
  turn.action = null;
  turn.delay = .14;
  turn.log = '行動開始';
  updateCommandUI();
}

function nextCommandSelection() {
  const turn = battle.command;
  turn.phase = 'select';
  turn.plan = [];
  turn.failedEscape = false;
  turn.pick = turn.allies.findIndex(commandAlive);
  turn.view = 'main';
  updateCommandUI();
}

function shiftCatForm(form) {
  const previous = catForm();
  const next = awakening[form];
  cat.hp = cat.hp > 0 ? Math.max(1,Math.round(cat.hp * next.hp / previous.hp)) : 0;
  cat.mp = Math.round(cat.mp * next.mp / previous.mp);
  cat.form = form;
}

function updateCommandAwakening(turn) {
  if (!joined || !cat.hp) return;
  turn.awakeTurns++;
  const next = awakening[cat.form + 1];
  if (!next || next.turn > turn.awakeTurns) return;
  shiftCatForm(cat.form + 1);
  turn.catGlowUntil = clock + 1.1;
  turn.log = 'ソソが第' + (cat.form + 1) + '形態・' + next.name + 'に覚醒！';
  audio.play('awake' + cat.form);
  if (cat.form === 5) {
    startCinema('awakening');
    audio.setTrack('genesis');
  }
}

function resolveCommand(action) {
  const {actor, move} = action;
  const turn = battle.command;
  const source = actor.stats();
  if (move.motion === 'enemySummon') {
    const slot = actor.enemySlot;
    const spirit = slot.mp > 0 && summonEnemy(battle.group,slot);
    if (spirit) {
      slot.mp--;
      spirit.expiresRound = turn.round+4;
      turn.foes.push(commandFoe(spirit,turn.side));
      turn.log = actor.name+'が影狼を召喚！';
    }
    return;
  }
  if (move.motion === 'call') {
    actor.enemySlot.fleeReady = true;
    battle.group.requested = true;
    return;
  }
  if (move.motion === 'flee') {
    actor.enemySlot.state = 'fled';
    return;
  }
  if (move.motion === 'guard') {
    if (actor.id === 'cat') {
      source.unit.mp = Math.min(source.maxMP,source.unit.mp + Math.ceil(source.maxMP * .06));
    }
    return;
  }
  const mp = actor.enemySlot ? actor.enemySlot.mp : source.unit.mp;
  if (mp < move.cost || move.good && !goodCount(move.good)) {
    turn.log = move.name + 'を使えなかった。';
    return;
  }
  const friends = actor.enemy ? turn.foes : turn.allies;
  const opponents = actor.enemy ? turn.allies : turn.foes;
  const group = move.motion === 'heal' ? friends : opponents;
  const targets = move.all ? group.filter(commandAlive) : [commandAlive(action.target) ? action.target : group.find(commandAlive)];
  if (actor.enemySlot) actor.enemySlot.mp -= move.cost;
  else source.unit.mp -= move.cost;
  if (move.good?.id === 'herb') player.herbs--;
  else if (move.good) pack[move.good.id]--;
  if (move.motion === 'summon') {
    turn.summon = {spirit:move.spirit,left:3,glow:clock+.9};
    showSummoning();
    return;
  }
  if ((move.motion === 'limit' || move.signature) && !actor.enemy) {
    turn.limitReady ??= {};
    turn.limitReady[actor.id] = turn.round + 4;
    startCinema('impact');
  }
  for (const target of targets) {
    if (!target || !commandAlive(target)) continue;
    if (move.motion === 'heal') {
      const {unit,max,maxMP} = target.stats();
      const restore = Math.min(max-unit.hp,move.good && target.id !== 'cat' ? move.power :
        Math.ceil(max*(move.good ? (move.power ? .05 : 0) : move.power)));
      unit.hp += restore;
      const magic = move.good?.mp ? Math.min(maxMP-unit.mp,move.good.mp) : 0;
      if (magic) unit.mp += magic;
      if (move.good?.clean) {
        target.status = null;
        if (target.id === 'hero') footingUntil = clock;
      }
      commandNumber(target,restore ? '+'+restore+' HP' : magic ? '+'+magic+' MP' : '手当て','#aef5c3');
      continue;
    }
    attackCommandTarget(turn,actor,target,move);
  }
}

function commandNumber(actor, number, color) {
  addNumber(number,actor.x,actor.y - (actor.enemy ? 47 : 36),color);
}

function attackCommandTarget(turn, actor, target, move) {
  if (target.enemySlot && target.enemySlot.type !== 'guard' && !move.all) {
    const shield = turn.foes.find(foe => commandAlive(foe) && foe.enemySlot.type === 'guard' && foe.guarding &&
      Math.hypot(foe.x-target.x,foe.y-target.y) < 61);
    if (shield) {
      commandNumber(shield,'かばう','#a4d8f8');
      target = shield;
    }
  }
  const attack = actor.stats(), defend = target.stats();
  const magic = ['magic','limit'].includes(move.motion);
  const dodgeBonus = target.enemySlot?.type === 'flanker' ? .055 : 0;
  const miss = move.motion === 'limit' || move.all ? 0 :
    Math.min(.26, .035 + dodgeBonus + Math.max(0,commandSpeed(target) - commandSpeed(actor)) * .0007) +
    (actor.status?.type === 'blind' ? .18 : 0);
  if (Math.random() < miss) {
    commandNumber(target,'回避','#cde7f4');
    return;
  }
  const weak = move.element !== '無' && (move.element === defend.weakness || move.element === '全');
  const resist = move.element !== '無' && move.element === defend.element && !weak;
  const critical = !magic && Math.random() < .08;
  const guard = target.guarding ? target.id === 'hero' && shieldEquipped ? .31 : .37 : 1;
  let power = attack.atk * move.power + (move.link && cat.hp ? catForm().atk * 1.9 : 0);
  if (actor.enemy && target.id === 'cat') power *= actor.enemy.trial !== undefined ? 158 : actor.enemy.boss ? 112 : 76;
  const armor = Math.min(power * .55, defend.def * (magic ? .35 : .64));
  let damage = Math.max(1, Math.ceil((power - armor) * (weak ? 1.45 : resist ? .60 : 1) * (critical ? 1.55 : 1) * guard));
  if (move.sweep && target.enemy && !target.enemy.boss) damage = Math.max(damage,defend.unit.hp);
  if (target.enemy?.boss) {
    const cap = target.enemy.trial !== undefined ? .11 : .24;
    damage = Math.min(Math.max(8, Math.ceil(defend.max * cap)), damage);
  }
  if (actor.enemy && target.id === 'cat') {
    const threshold = actor.enemy.trial !== undefined ? .34 : actor.enemy.boss ? .24 : .16;
    damage = Math.min(damage,Math.max(1,Math.ceil(defend.max * threshold * guard)));
  }
  if (move.status && !target.guarding && !resist && Math.random() < (weak ? .78 : .43)) {
    target.status = {type:move.status, remaining:3};
  }
  if (target.enemySlot?.ward > 0 && (move.motion === 'leap' || move.motion === 'magic' && weak)) {
    target.enemySlot.ward--;
    turn.log = target.enemySlot.ward ? '王の結界にひびが入った。残り '+target.enemySlot.ward : '王の結界を破壊！';
    audio.play('quake');
  }
  const tag = [target.enemySlot?.ward ? '結界' : '',weak ? '弱点' : resist ? '耐性' : '', critical ? '会心' : '', target.guarding ? '防御' : ''].filter(Boolean).join('・');
  damageCommandActor(turn,target,damage,tag);
  if (target.guarding && target.enemySlot?.type === 'guard' && commandAlive(target) && !magic &&
      !turn.countered.has(target)) {
    turn.countered.add(target);
    turn.queue.unshift({actor:target,move:turnAttack('盾返し',.60),target:actor});
  }
  audio.play('hit');
}

function damageCommandActor(turn, target, damage, tag) {
  const {unit,max} = target.stats();
  const phase = target.enemy ? foePhase(unit) : 0;
  const applied = target.enemySlot ? damageEnemySlot(target.enemySlot,damage) : Math.min(unit.hp,damage);
  if (!target.enemySlot) unit.hp -= applied;
  target.hitUntil = clock+.28;
  commandNumber(target,(tag ? tag+' ' : '')+applied,target.enemy ? '#ffe89b' : '#ffaaa2');
  if (phase && foePhase(unit) > phase) {
    battle.body = combatBody(unit);
    battle.group.requested = true;
    turn.log = unit.name+'が第'+foePhase(unit)+'形態へ変身！';
    audio.play('encounter');
  }
  if (target.id === 'cat' && cat.hp > 0) {
    const next = awakening[cat.form + 1];
    if (!target.guarding && next && turn.awakeTurns + 1 >= next.turn && damage >= max * .12) {
      shiftCatForm(0);
      turn.awakeTurns = 0;
      turn.log = 'ソソの覚醒が中断された。防御や回復で守ろう。';
    }
    if (!turn.superAwake && cat.hp <= catForm().hp * .1) {
      turn.superAwake = true;
      turn.log = '一美が超覚醒した！';
      startCinema('awakening');
      audio.play('awake5');
    }
  }
}

function finishCommandRound(turn) {
  const summon = turn.summon;
  if (summon) {
    const target = turn.foes.find(commandAlive);
    summon.glow = clock+.55;
    if (target) damageCommandActor(turn,target,Math.min(spiritPower(summon.spirit),
      Math.ceil(target.stats().max * (target.enemy.boss ? .13 : 1))),summon.spirit.element);
    if (summon.spirit.id === 'serpent') player.mp = Math.min(maxMP(),player.mp+2);
    if (summon.spirit.id === 'shade') player.hp = Math.min(maxHP(),player.hp + Math.ceil(maxHP()*.055));
    if (summon.spirit.id === 'wolf' && target) target.status = {type:'chill',remaining:2};
    if (!--summon.left) turn.summon = null;
  }
  for (const actor of [...turn.allies, ...turn.foes].filter(commandAlive)) {
    if (actor.enemySlot?.summoned && actor.enemySlot.expiresRound <= turn.round) {
      actor.enemySlot.state = 'faded';
      continue;
    }
    if (actor.status?.type === 'burn' && !actor.guarding) {
      const max = actor.stats().max;
      damageCommandActor(turn, actor, Math.max(1, Math.ceil(max * (actor.enemy?.boss ? .016 : .055))), '火傷');
    }
    if (actor.status && --actor.status.remaining === 0) actor.status = null;
  }
  if (checkCommandOutcome(turn)) return;
  const group = battle.group;
  const incoming = releaseEnemyWave(group,group.requested || turn.round%3 === 0 &&
    livingEnemies(group).length <= group.rule.opening);
  if (incoming.length) {
    turn.log = encounterFormation(group,incoming.length);
    audio.play('encounter');
  }
  updateCommandAwakening(turn);
  turn.round++;
  nextCommandSelection();
}

function checkCommandOutcome(turn) {
  if (!player.hp || joined && !cat.hp) {
    turn.phase = 'loss';
    turn.log = '一行は力尽きた。';
    updateCommandUI();
    defeat(!player.hp ? '一美は倒れた' : 'ソソは倒れた');
    return true;
  }
  if (turn.foes.some(commandAlive)) return false;
  const incoming = releaseEnemyWave(battle.group,true);
  if (incoming.length) {
    turn.log = encounterFormation(battle.group,incoming.length);
    audio.play('encounter');
    updateCommandUI();
    return false;
  }
  turn.phase = 'victory';
  turn.action = null;
  turn.victoryAt = clock + .72;
  turn.log = '勝利！';
  updateCommandUI();
  return true;
}

function updateCommandBattle(dt) {
  const turn = battle.command;
  battle.age += dt;
  if (turn.phase === 'entry') {
    if (battle.age < turn.delay) return;
    if (turn.approach === 'rear') startCommandRound();
    else nextCommandSelection();
    return;
  }
  if (turn.phase === 'victory') {
    if (clock < turn.victoryAt) return;
    finishEnemyGroup();
    return;
  }
  if (turn.phase === 'select' && turn.auto) {
    const actor = turn.allies[turn.pick];
    const stats = actor.stats();
    const target = turn.foes.find(foe=>commandAlive(foe) && foe.enemySlot.type === 'healer') || turn.foes.find(commandAlive);
    const wounded = turn.allies.find(member => commandAlive(member) && member.stats().unit.hp < member.stats().max * .44);
    const heal = wounded && commandMoves(actor,'magic').find(move => move.motion === 'heal' && move.cost <= stats.unit.mp);
    const danger = plannedEnemyActions(turn).some(intent => intent.target === actor || intent.move.all);
    const crowd = turn.foes.filter(commandAlive).length;
    if (heal) queueCommand(actor,heal,wounded);
    else if (actor.id === 'hero' && crowd >= 3 && stats.unit.mp >= 10 && commandMoves(actor,'limit').length) {
      queueCommand(actor,commandMoves(actor,'limit')[0],target);
    } else if (actor.id === 'hero' && crowd >= 3 && stats.unit.mp >= 5) {
      queueCommand(actor,commandMoves(actor,'skill').at(-1),target);
    }
    else if (danger && actor.member?.tactic === '守備優先') queueCommand(actor,{name:'防御',motion:'guard',cost:0},actor);
    else if (danger && actor.id === 'cat' && awakening[cat.form+1]?.turn === turn.awakeTurns+1) {
      queueCommand(actor,{name:'防御',motion:'guard',cost:0},actor);
    } else queueCommand(actor,commandMoves(actor,'attack')[0],target);
    return;
  }
  if (turn.phase !== 'resolve') return;
  if (turn.action) {
    const action = turn.action;
    if (!action.hit && clock - action.start >= action.duration * .52) {
      action.hit = true;
      resolveCommand(action);
      updateCommandUI();
      if (checkCommandOutcome(turn)) return;
    }
    if (clock - action.start < action.duration) return;
    turn.action = null;
  }
  turn.delay -= dt;
  if (turn.delay > 0) return;
  const next = turn.queue.shift();
  if (!next) return finishCommandRound(turn);
  if (!commandAlive(next.actor)) return;
  if (!commandAlive(next.target)) {
    const friendly = next.move.motion === 'heal' || next.move.motion === 'guard';
    const targets = Boolean(next.actor.enemy) === friendly ? turn.foes : turn.allies;
    next.target = targets.find(commandAlive);
  }
  turn.action = {...next, start:clock, duration:next.move.motion === 'limit' ? 1.05 : next.move.motion === 'combo' ? .80 : .63};
  turn.delay = .04;
  turn.log = next.actor.name + '　' + next.move.name;
  audio.play({guard:'door',heal:'holy',magic:'magic',leap:'air',strike:'attack',quake:'quake',combo:'attack',
    call:'encounter',enemySummon:'summon',summon:'summon',limit:next.actor.id === 'cat' ? 'creation' : 'special'}[next.move.motion]);
  updateCommandUI();
}
