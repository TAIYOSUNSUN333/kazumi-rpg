const companionProfiles = {
  クルミ: {job:'探索フクロウ', hp:72, mp:34, power:11, defense:3, speed:115, reach:70, skill:'羽根の風刃', role:'magic', color:'#b491d1', hair:'#694c82', skin:'#f2ddb9', width:9},
  一郎: {job:'剣士', hp:105, mp:18, power:18, defense:6, speed:92, reach:36, skill:'踏み込み斬り', role:'sword', color:'#bf6057', hair:'#372e38', skin:'#ca916c', width:11},
  恵美ちゃん: {job:'僧侶', hp:78, mp:55, power:9, defense:4, speed:86, reach:66, skill:'灯火の祈り', role:'heal', color:'#81a8ca', hair:'#60402d', skin:'#f9d1a9', width:8},
  タク: {job:'自然術師', hp:87, mp:43, power:14, defense:4, speed:101, reach:98, skill:'枝走りの雷', role:'magic', color:'#648f70', hair:'#302c29', skin:'#b98165', width:9}
};

const companions = new Map();
const companionTrail = {x: 0, y: 104};
let contactNpc = null;
const currentCompanion = () => companions.get(player.party[0]);
const companionLevel = member => Math.min(99, 1 + Math.floor(Math.sqrt(member.xp / 30)));
const companionHP = member => companionProfiles[member.name].hp + (companionLevel(member) - 1) * 9;
const companionMP = member => companionProfiles[member.name].mp + (companionLevel(member) - 1) * 3;

function restoreCompanions(data) {
  companions.clear();
  for (const name of Object.keys(companionProfiles)) {
    const old = data.companions?.find?.(entry => entry?.name === name);
    if (!old && !(Array.isArray(data.party) && data.party.includes(name))) continue;
    const member = {name, xp:numeric(old?.xp, 0, 0, 300000), gear:numeric(old?.gear, 0, 0, 3),
      affinity:numeric(old?.affinity, 0, -100, 100),
      history:Array.isArray(old?.history) ? old.history.filter(value => typeof value === 'string').slice(-50) : []};
    member.hp = numeric(old?.hp, companionHP(member), 0, companionHP(member));
    member.mp = numeric(old?.mp, companionMP(member), 0, companionMP(member));
    companions.set(name, member);
  }
  const ordered = Array.isArray(data.party) ? data.party : [];
  player.party = ordered.filter(name => companions.has(name)).slice(0, 1);
}

function remember(member, event) {
  member.history.push(event);
  if (member.history.length > 50) member.history.shift();
}

function recruitment(npc) {
  const profile = companionProfiles[npc.name];
  const record = companions.get(npc.name);
  const existing = currentCompanion();
  const lines = [npc.line, profile.job + '　Lv.' + (record ? companionLevel(record) : 1),
    'HP ' + (record ? companionHP(record) : profile.hp) + '　MP ' + (record ? companionMP(record) : profile.mp) +
    '　攻撃 ' + (profile.power + (record ? companionLevel(record) - 1 + record.gear * 3 : 0)) + '　防御 ' + profile.defense,
    '得意技 ' + profile.skill];
  if (existing) {
    panel(npc.name, [...lines, '同行中の' + existing.name + 'と酒場で別れると、誘うことができます。'], [['戻る', resume]]);
    return;
  }
  panel(npc.name + 'を仲間にしますか？', lines, [
    ['はい', () => {
      if (currentCompanion()) return resume();
      const member = record || {name:npc.name, xp:0, hp:profile.hp, mp:profile.mp, gear:0, affinity:0, history:[]};
      companions.set(npc.name, member);
      player.party = [npc.name];
      remember(member, '加入');
      companionTrail.x = player.x - 24;
      companionTrail.y = player.y;
      save();
      resume();
    }], ['いいえ', resume]
  ]);
}

const nearTavern = () => Math.abs(player.x - camps[chapterOf(player.x)].x) <= 80;

function tavern() {
  if (mode !== 'field' || !nearTavern()) return;
  const member = currentCompanion();
  const actions = [['メニューに戻る', openMenu]];
  if (member) {
    actions.push(['別れる', () => panel(member.name + 'と別れますか？',
      ['経験値、装備、好感度と会話の記録は残ります。'], [
        ['はい', () => {
          if (currentCompanion() !== member) return tavern();
          remember(member, '酒場で離脱');
          player.party = [];
          save();
          tavern();
        }], ['いいえ', tavern]
      ])]);
    actions.push(['話す', () => {
      const profile = companionProfiles[member.name];
      const topic = '第' + (chapterOf(player.x) + 1) + '章・' + chapterInfo[chapterOf(player.x)][0];
      const event = topic + 'で旅を語った';
      panel(member.name + 'と話す', [topic, npcs.find(npc => npc.name === member.name).line,
        '得意技 ' + profile.skill + '　好感度 ' + member.affinity], [
        ['旅の話を聞く', () => {
          if (!member.history.includes(event)) {
            remember(member, event);
            member.affinity = Math.min(100, member.affinity + 3);
            save();
          }
          tavern();
        }, member.history.includes(event)], ['戻る', tavern]
      ]);
    }]);
    const cost = 20 + member.gear * 15;
    actions.push(['同行者の装備を整える ' + cost + 'G', () => {
      if (member.gear >= 3 || player.gold < cost) return;
      player.gold -= cost;
      member.gear++;
      save();
      tavern();
    }, member.gear >= 3 || player.gold < cost]);
    actions.push(['同行者を休ませる', () => {
      member.hp = companionHP(member);
      member.mp = companionMP(member);
      save();
      tavern();
    }, member.hp === companionHP(member) && member.mp === companionMP(member)]);
  }
  for (const record of companions.values()) {
    if (!member) actions.push([record.name + 'に話す', () => recruitment(npcs.find(npc => npc.name === record.name))]);
  }
  panel('街道の酒場', [member ? member.name + 'が同行中。装備段階 ' + member.gear + '　好感度 ' + member.affinity : '同行枠は空いている。'], actions);
}

function followCompanion(dt) {
  if (!currentCompanion()) return;
  const dx = player.x - companionTrail.x, dy = player.y - companionTrail.y;
  const gap = Math.hypot(dx, dy);
  if (gap <= 25) return;
  const step = Math.min(gap - 25, dt * (returning ? 420 : 132));
  companionTrail.x += dx / gap * step;
  companionTrail.y += dy / gap * step;
}

function awardCompanion(xp) {
  const member = currentCompanion();
  if (member) member.xp = Math.min(300000, member.xp + xp);
}

function companionInStrike(strike) {
  const offset = battle.allyX - battle.enemyX;
  return strike.wave || Math.sign(offset) === strike.direction && Math.abs(offset) <= strike.range + 5;
}

function hurtCompanion(strike) {
  const member = currentCompanion();
  if (!member?.hp || !companionInStrike(strike) || battle.allyDodge > clock) return;
  const damage = Math.max(1, Math.round((strike.power - companionProfiles[member.name].defense -
    (companionLevel(member) - 1) - member.gear) * (battle.allyGuard > clock ? .42 : 1)));
  member.hp = Math.max(0, member.hp - damage);
  battle.allyHit = clock + .18;
  addNumber(damage, battle.allyX, 205, '#ffada6');
}

function updateCompanion(dt) {
  const member = currentCompanion();
  if (!member?.hp) return;
  const profile = companionProfiles[member.name];
  const warning = battle.strike;
  if (warning && companionInStrike(warning) && warning.at - clock < .27 && clock >= battle.allyDefenseAt) {
    battle.allyDefenseAt = clock + 3.4;
    if (profile.role === 'sword' || warning.wave) battle.allyGuard = clock + .38;
    else battle.allyDodge = clock + .32;
    return;
  }
  if (battle.allyGuard > clock || battle.allyDodge > clock) return;
  const delta = battle.enemyX - battle.allyX;
  const direction = Math.sign(delta);
  if (clock >= battle.allyNext && profile.role === 'heal' && member.mp >= 5 &&
      (player.hp < maxHP() * .68 || member.hp < companionHP(member) * .62)) {
    const heal = 16 + companionLevel(member) * 2;
    player.hp = Math.min(maxHP(), player.hp + heal);
    member.hp = Math.min(companionHP(member), member.hp + heal);
    member.mp -= 5;
    battle.allyNext = clock + 2.7;
    battle.allyAction = {kind:'heal', until:clock + .45};
    audio.play('holy');
    return;
  }
  const magic = profile.role === 'magic' && member.mp >= 3;
  const reach = magic ? profile.reach : 35;
  if (Math.abs(delta) > reach) {
    battle.allyX += direction * Math.min(profile.speed * dt, Math.abs(delta) - reach + 1);
    return;
  }
  if (clock < battle.allyNext) return;
  battle.allyNext = clock + (magic ? 1.7 : 1.22);
  battle.allyAction = {kind:magic ? 'magic' : 'attack', until:clock + .29, direction};
  if (magic) member.mp -= 3;
  audio.play(magic ? 'magic' : 'attack');
  hurtEnemy(battle.enemy, profile.power + (companionLevel(member) - 1) * 2 + member.gear * 3 + (magic ? 5 : 0));
}
