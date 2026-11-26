const companionProfiles = {
  クルミ: {job:'探索フクロウ', hp:72, mp:34, power:11, defense:3, speed:115, reach:70, skill:'羽根の風刃', role:'magic', color:'#b491d1', hair:'#694c82', skin:'#f2ddb9', width:9},
  一郎: {job:'剣士', hp:105, mp:18, power:18, defense:6, speed:92, reach:36, skill:'踏み込み斬り', role:'sword', color:'#bf6057', hair:'#372e38', skin:'#ca916c', width:11},
  恵美ちゃん: {job:'僧侶', hp:78, mp:55, power:9, defense:4, speed:86, reach:66, skill:'灯火の祈り', role:'heal', color:'#81a8ca', hair:'#60402d', skin:'#f9d1a9', width:8},
  タク: {job:'自然術師', hp:87, mp:43, power:14, defense:4, speed:101, reach:98, skill:'枝走りの雷', role:'magic', color:'#648f70', hair:'#302c29', skin:'#b98165', width:9}
};

const localJobs = {
  forest:['森案内人','木守の風', 'heal'], coast:['潮読み','潮返し', 'magic'],
  mountain:['峠の護衛','岩砕き', 'sword'], water:['水路守','水鏡の祈り', 'heal'],
  sand:['砂丘の道標守','砂走り', 'sword'], snow:['雪道の先導役','霜の灯', 'magic'],
  river:['渡し守','流れ弾き', 'magic']
};
for (const [index, region] of prefectures.entries()) {
  const [job, skill, role] = localJobs[region.terrain];
  companionProfiles[region.companion] = {
    job, skill, role, hp:76 + index % 5 * 6, mp:23 + index % 7 * 4, power:12 + index % 6 * 2,
    defense:4 + index % 4, speed:88 + index % 5 * 6, reach:65 + index % 6 * 6,
    color:region.color, hair:['#49352f','#383242','#704b3f'][index % 3],
    skin:['#f2d2b3','#d49c77','#e7ba95'][index % 3], width:8 + index % 4
  };
}

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
    if (old?.departed) member.departed = {gold:numeric(old.departed.gold,0,0,bankLimit),
      day:numeric(old.departed.day,0,0,100000)};
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
  if (record?.departed) {
    const ready = townDay() > record.departed.day;
    panel(npc.name, [ready ? '「あの晩のこと、謝りたかった。預かったお金を返したい」' :
      'もう少し時間を置いてから、話を聞こう。'], [
      ['話を聞いて和解する', () => {
        player.gold = Math.min(bankLimit,player.gold + record.departed.gold);
        record.departed = null;
        record.affinity = -20;
        remember(record,'和解して返金を受けた');
        save();
        recruitment(npc);
      }, !ready], ['戻る', resume]
    ]);
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

const nearTavern = () => interior?.site.kind === 'tavern' && !siteAvailability(interior.site);

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
  const targetHeight = Math.max(0, jumpHeight - gap * .25);
  companionTrail.height = (companionTrail.height ?? 0) + (targetHeight - (companionTrail.height ?? 0)) * Math.min(1,dt * 10);
  if (gap <= 25) return;
  const step = Math.min(gap - 25, dt * (returning ? 420 : ['run','dash'].includes(gait) ? 182 : 132));
  companionTrail.x += dx / gap * step;
  companionTrail.y += dy / gap * step;
}

function awardCompanion(xp) {
  const member = currentCompanion();
  if (member) member.xp = Math.min(300000, member.xp + xp);
}
