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
      atk:profile.power + companionLevel(member) * 3 + member.gear * 4,
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

  const roster = [enemy];
  if (!enemy.boss && enemy.slot >= 2 && (enemy.chapter + enemy.slot) % 3 === 0) {
    const source = activeEnemies(enemy.chapter)[(enemy.slot + 1) % 6];
    const max = Math.ceil(source.max * .62);
    roster.push({...source, name:source.name === enemy.name ? source.name + '（随伴）' : source.name,
      max, hp:max, flash:0});
  }
  const foes = roster.map((foe, index) => {
    const element = foe.trial !== undefined ? battleElements[foe.trial + 1] :
      foe.boss ? battleElements[1 + foe.chapter % 4] : battleElements[foe.variant || 0];
    const character = actor('foe' + index, foe.name, roster.length === 1 ? 176 : 153 + index * 92,
      roster.length === 1 ? 247 : 241 + (index % 2 ? 21 : -17), () => ({
        unit:foe, max:foe.max, maxMP:0, atk:foe.power, def:Math.floor(foe.power * (foe.boss ? .44 : .25)),
        speed:foe.speed * (foe.boss ? 1.15 : 1.38), element, weakness:oppositeElement[element]
      }));
    character.enemy = foe;
    return character;
  });
  battle.command = {
    allies, foes, side, approach, round:1, awakeTurns:0, phase:'entry', delay:.36, plan:[], queue:[],
    pick:0, view:'main', selection:null, action:null, log:approach === 'rear' ? '敵のバックアタック！' :
      approach === 'first' ? '一美たちの先制攻撃！' : enemy.name + 'と遭遇した。'
  };
  battle.entry = {x:player.x, y:player.y};
  battle.heroX = allies[0].x;
  updateCommandUI();
}

const commandAlive = actor => !!actor && actor.stats().unit.hp > 0;

function commandSpeed(actor) {
  const speed = actor.stats().speed;
  return actor.status?.type === 'chill' ? speed * .66 : speed;
}

function commandOrder(actors) {
  return [...actors].sort((a, b) => commandSpeed(b) - commandSpeed(a));
}

function enemyCommand(actor, turn) {
  const enemy = actor.enemy;
  const phase = isFinalBoss(enemy) ? finalPhase(enemy) : 1;
  const bossMoves = enemy.pattern || (isFinalBoss(enemy) ?
    [['bite','slow'], ['rush','wave','rear'], ['wave','stomp','rear']][phase - 1] :
    enemy.rank === 'mid' ? ['slow','bite','rear'] : bossPatterns[enemy.chapter % bossPatterns.length]);
  const kind = enemy.boss ? bossMoves[(turn.round - 1) % bossMoves.length] :
    turn.round % 3 ? 'bite' : ['rush','bite','slow','wave'][enemy.variant || 0];
  const move = arenaAttacks[kind];
  const magic = kind === 'wave';
  const element = magic ? actor.stats().element : '無';
  return {...turnAttack(move.label, 1 + move.extra * .06 + (phase - 1) * .10, element, 0,
    magic ? 'magic' : kind === 'stomp' ? 'quake' : kind === 'rush' ? 'leap' : 'strike',
    magic ? ({炎:'burn',氷:'chill',雷:'chill',闇:'blind'})[element] : null),
    all:kind === 'stomp' || magic && (phase === 3 || enemy.trial !== undefined)};
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
      ...(profile.role === 'magic' ? [turnAttack(profile.skill, 1.4, '雷', 5, 'magic', 'chill')] : [])
    ];
  }
  if (group === 'skill') {
    if (hero) return [turnAttack(bladeForm().name + '・連撃', 1.7, '無', 3, 'combo'),
      turnAttack('跳び込み斬り', 1.3, '無', 2, 'leap')];
    if (catActor) return [turnAttack('ひかりの爪', 1.85, '光', 90, 'leap')];
    return [turnAttack(profile.role === 'sword' ? profile.skill : '跳び込み打ち', 1.5, '無', 3, 'leap')];
  }
  if (group === 'limit') {
    if (catActor && cat.form === 5 && round >= (limitReady?.cat || 0)) {
      return [{...turnAttack('天地創生', 4.3, '全', 999, 'limit'), all:true}];
    }
    if (!hero || round < (limitReady?.hero || 0)) return [];
    const link = joined && cat.hp > 0;
    return [{...turnAttack(link ? '双星の誓い' : 'ソソを思う', 2.9, '光', 10, 'limit'),
      link, all:superAwake}];
  }
  if (group === 'item') return player.herbs > 0 ? [turnHeal('薬草（残り ' + player.herbs + '）', 35, 0, true)] : [];
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
  $('battle-round').textContent = '第' + round + 'ターン';
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
  const {round, approach} = turn;
  if (round === 1 && approach === 'first' && !turn.failedEscape) return [];
  const living = turn.allies.filter(commandAlive);
  return turn.foes.filter(commandAlive).map((actor, index) => {
    const target = living[(round - 1 + index) % living.length];
    return {actor, move:enemyCommand(actor,turn), target};
  });
}

function startCommandRound() {
  const turn = battle.command;
  const plans = [...turn.plan, ...plannedEnemyActions(turn)];
  const order = commandOrder(plans.map(action => action.actor));
  turn.queue = order.map(actor => plans.find(action => action.actor === actor));
  for (const actor of [...turn.allies, ...turn.foes]) actor.guarding = false;
  for (const {actor, move} of turn.plan) if (move.motion === 'guard') actor.guarding = true;
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
  if (move.motion === 'guard') {
    if (actor.id === 'cat') {
      source.unit.mp = Math.min(source.maxMP,source.unit.mp + Math.ceil(source.maxMP * .06));
    }
    return;
  }
  if (source.unit.mp < move.cost || move.herb && !player.herbs) {
    turn.log = move.name + 'を使えなかった。';
    return;
  }
  const friends = actor.enemy ? turn.foes : turn.allies;
  const opponents = actor.enemy ? turn.allies : turn.foes;
  const group = move.motion === 'heal' ? friends : opponents;
  const targets = move.all ? group.filter(commandAlive) : [commandAlive(action.target) ? action.target : group.find(commandAlive)];
  source.unit.mp -= move.cost;
  if (move.herb) player.herbs--;
  if (move.motion === 'summon') {
    turn.summon = {spirit:move.spirit,left:3,glow:clock+.9};
    showSummoning();
    return;
  }
  if (move.motion === 'limit') {
    turn.limitReady ??= {};
    turn.limitReady[actor.id] = turn.round + 4;
    startCinema('impact');
  }
  for (const target of targets) {
    if (!target || !commandAlive(target)) continue;
    if (move.motion === 'heal') {
      const {unit,max} = target.stats();
      const restore = Math.min(max - unit.hp, move.herb && target.id !== 'cat' ? move.power :
        Math.ceil(max * (move.herb ? .05 : move.power)));
      unit.hp += restore;
      commandNumber(target,'+' + restore + ' HP','#aef5c3');
      continue;
    }
    attackCommandTarget(turn,actor,target,move);
  }
}

function commandNumber(actor, number, color) {
  addNumber(number,actor.x,actor.y - (actor.enemy ? 47 : 36),color);
}

function attackCommandTarget(turn, actor, target, move) {
  const attack = actor.stats(), defend = target.stats();
  const magic = ['magic','limit'].includes(move.motion);
  const miss = move.motion === 'limit' || move.all ? 0 :
    Math.min(.19, .035 + Math.max(0,commandSpeed(target) - commandSpeed(actor)) * .0007) +
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
  const tag = [weak ? '弱点' : resist ? '耐性' : '', critical ? '会心' : '', target.guarding ? '防御' : ''].filter(Boolean).join('・');
  damageCommandActor(turn, target, damage, tag);
  audio.play('hit');
}

function damageCommandActor(turn, target, damage, tag) {
  const {unit,max} = target.stats();
  const boundary = target.enemy && isFinalBoss(target.enemy) ? Math.ceil(max * (3 - finalPhase(unit)) / 3) : 0;
  const applied = Math.min(unit.hp - boundary, damage);
  unit.hp -= applied;
  target.hitUntil = clock + .28;
  commandNumber(target, (tag ? tag + ' ' : '') + applied, target.enemy ? '#ffe89b' : '#ffaaa2');
  if (boundary && unit.hp === boundary) {
    battle.body = combatBody(unit);
    turn.log = unit.name + 'が第' + finalPhase(unit) + '形態へ変身！';
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
    if (actor.status?.type === 'burn' && !actor.guarding) {
      const max = actor.stats().max;
      damageCommandActor(turn, actor, Math.max(1, Math.ceil(max * (actor.enemy?.boss ? .016 : .055))), '火傷');
    }
    if (actor.status && --actor.status.remaining === 0) actor.status = null;
  }
  if (checkCommandOutcome(turn)) return;
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
    for (const {enemy} of turn.foes.slice(1)) monsterDex.add(enemy.name);
    hurtEnemy(battle.enemy,0);
    return;
  }
  if (turn.phase === 'select' && turn.auto) {
    const actor = turn.allies[turn.pick];
    const stats = actor.stats();
    const target = turn.foes.find(commandAlive);
    const wounded = turn.allies.find(member => commandAlive(member) && member.stats().unit.hp < member.stats().max * .44);
    const heal = wounded && commandMoves(actor,'magic').find(move => move.motion === 'heal' && move.cost <= stats.unit.mp);
    const danger = plannedEnemyActions(turn).some(intent => intent.target === actor || intent.move.all);
    if (heal) queueCommand(actor,heal,wounded);
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
    next.target = (next.move.motion === 'heal' || next.move.motion === 'guard' ? turn.allies :
      next.actor.enemy ? turn.allies : turn.foes).find(commandAlive);
  }
  turn.action = {...next, start:clock, duration:next.move.motion === 'limit' ? 1.05 : next.move.motion === 'combo' ? .80 : .63};
  turn.delay = .04;
  turn.log = next.actor.name + '　' + next.move.name;
  audio.play({guard:'door',heal:'holy',magic:'magic',leap:'air',strike:'attack',quake:'quake',combo:'attack',
    summon:'summon',limit:next.actor.id === 'cat' ? 'creation' : 'special'}[next.move.motion]);
  updateCommandUI();
}
