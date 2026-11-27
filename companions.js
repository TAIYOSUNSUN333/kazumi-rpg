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
  const [job,skill,role] = localJobs[region.terrain];
  const tier = Math.floor(index/9);
  const growth = 1+tier*.065;
  companionProfiles[region.companion] = {
    job,skill,role,growth,hp:76+index%5*6+tier*9,mp:23+index%7*4+tier*3,power:12+index%6*2+tier*3,
    recruitCue:index >= 45 ? 'mythic' : index >= 36 ? 'legend' : null,
    defense:4+index%4+tier*2,speed:88+index%5*6+tier*3, reach:65 + index % 6 * 6,
    color:region.color, hair:['#49352f','#383242','#704b3f'][index % 3],
    skin:['#f2d2b3','#d49c77','#e7ba95'][index % 3], width:8 + index % 4
  };
}

const companions = new Map();
const companionTrail = {x: 0, y: 104};
let contactNpc = null;
const currentCompanion = () => companions.get(player.party[0]);
const companionLevel = member => Math.min(99, 1 + Math.floor(Math.sqrt(member.xp / 30)));
const companionGrowth = member => companionProfiles[member.name].growth || 1;
const companionHP = member => companionProfiles[member.name].hp+Math.round((companionLevel(member)-1)*9*companionGrowth(member));
const companionMP = member => companionProfiles[member.name].mp+Math.round((companionLevel(member)-1)*3*companionGrowth(member));
const companionPower = member => companionProfiles[member.name].power+
  Math.round((companionLevel(member)-1)*3*companionGrowth(member))+member.gear*3;

function initialCompanion(name) {
  const levelAtJoining = name === 'クルミ' ? 1 : Math.min(99,level());
  const member = {name,xp:30*(levelAtJoining-1)**2,gear:0,affinity:0,trust:0,fatigue:0,tactic:'攻撃優先',history:[]};
  member.hp = companionHP(member);
  member.mp = companionMP(member);
  return member;
}

const activeCompanions = () => player.party.map(name => companions.get(name)).filter(Boolean);
const humans = () => activeCompanions().filter(member => member.name !== 'クルミ' && !member.monster);
const capturedCompanions = () => [...companions.values()].filter(member => member.monster);
const companionName = member => member.monster ? enemies[member.origin].name : member.name;
const companionTraits = [
  ['慎重','杖','風',20],['快活','剣','炎',34],['思いやり深い','祈りの杖','光',26],
  ['自由奔放','投げ槍','雷',-18],['実直','盾剣','土',10],['気まぐれ','弓','水',-24]
];
function companionProfile(name) {
  const profile = companionProfiles[name];
  const entry = companionTraits[Object.keys(companionProfiles).indexOf(name) % companionTraits.length] || companionTraits[0];
  const gender = ['クルミ'].includes(name) || profile?.job === '契約モンスター' ? 'animal' :
    ['一郎','タク'].includes(name) ? 'male' : name === '恵美ちゃん' ? 'female' :
    Object.keys(companionProfiles).indexOf(name)%2 ? 'male' : 'female';
  return {gender,personality:entry[0],weapon:entry[1],element:entry[2],fit:entry[3],...profile};
}

const companionLimits = {
  一郎:{name:'天空連斬',cost:7,reach:62,power:2.35,color:'#f7be84'},
  恵美ちゃん:{name:'生命の奇跡',cost:12,reach:92,power:.35,color:'#9ce7bb',heal:true},
  タク:{name:'星降る裁き',cost:10,reach:119,power:2.1,color:'#c5b7ff'},
  クルミ:{name:'月光の翼',cost:8,reach:105,power:1.87,color:'#a8e2fa'}
};

function companionLimit(member) {
  if (companionLimits[member.name]) return companionLimits[member.name];
  if (member.monster || companionLevel(member) < 20) return null;
  const profile = companionProfiles[member.name];
  const heal = profile.role === 'heal';
  return {name:profile.skill+'・奥義',cost:heal ? 10 : 8,reach:profile.reach+19,
    power:heal ? .30 : 1.85,color:profile.color,heal};
}

function monsterCompanion(origin) {
  const foe = enemies[origin];
  if (!foe || foe.boss) return null;
  const name = '魂-' + origin;
  companionProfiles[name] ||= {
    job:'契約モンスター', personality:['気まま','勇敢','慎重','忠実'][foe.variant], weapon:'牙・魔力',
    element:['無','土','雷','氷'][foe.variant], fit:10, role:foe.variant === 3 ? 'magic' : 'sword',
    hp:Math.min(220,foe.max+45), mp:22+foe.variant*5, power:foe.power+5, defense:5+foe.variant,
    speed:82+foe.speed*.22, reach:48, skill:foe.name+'の共鳴'
  };
  return name;
}

function restoreCompanions(data) {
  companions.clear();
  const records = Array.isArray(data.companions) ? data.companions : [];
  for (const entry of records) {
    if (entry?.monster && entry.name === '魂-' + entry.origin) monsterCompanion(entry.origin);
  }
  for (const name of Object.keys(companionProfiles)) {
    const old = records.find(entry => entry?.name === name);
    if (!old && !(Array.isArray(data.party) && data.party.includes(name))) continue;
    const member = {name, xp:numeric(old?.xp, 0, 0, 300000), gear:numeric(old?.gear, 0, 0, 3),
      fatigue:numeric(old?.fatigue,0,0,100),
      affinity:numeric(old?.affinity, 0, -100, 100), trust:numeric(old?.trust,0,-100,100),
      tactic:['攻撃優先','支援優先','守備優先'].includes(old?.tactic) ? old.tactic : '攻撃優先',
      history:Array.isArray(old?.history) ? old.history.filter(value => typeof value === 'string').slice(-50) : []};
    if (old?.monster && monsterCompanion(old.origin) === name) {
      if (capturedCompanions().length >= 3) continue;
      member.monster = true;
      member.origin = old.origin;
    }
    if (old?.departed) member.departed = {gold:numeric(old.departed.gold,0,0,bankLimit),
      day:numeric(old.departed.day,0,0,100000)};
    member.hp = numeric(old?.hp, companionHP(member), 0, companionHP(member));
    member.mp = numeric(old?.mp, companionMP(member), 0, companionMP(member));
    companions.set(name, member);
  }
  const ordered = [...new Set(Array.isArray(data.party) ? data.party : [])];
  player.party = [];
  for (const name of ordered) {
    const member = companions.get(name);
    if (member && !member.departed && (member.monster || name === 'クルミ' || humans().length < 2)) player.party.push(name);
  }
}

function remember(member, event) {
  member.history.push(event);
  if (member.history.length > 50) member.history.shift();
}

function recruitment(npc, onBack = resume) {
  const {track,recording} = audio;
  audio.setTrack('tavern','17');
  const back = () => {
    audio.setTrack(track,recording);
    onBack();
  };
  const profile = companionProfile(npc.name);
  const record = companions.get(npc.name);
  const candidate = record || initialCompanion(npc.name);
  const hasRoom = () => npc.name === 'クルミ' ? !player.party.includes(npc.name) : humans().length < 2;
  const lines = [npc.line, profile.job + '　' + profile.personality + '　Lv.' + companionLevel(candidate),
    '得意武器 ' + profile.weapon + '　属性 ' + profile.element + '　相性 ' + profile.fit,
    'HP ' + companionHP(candidate) + '　MP ' + companionMP(candidate),
    '得意技 ' + profile.skill + '　攻撃 ' + companionPower(candidate)];
  const signature = companionLimit(candidate);
  if (signature) lines.push('習得済みの必殺技 ' + signature.name);
  if (profile.recruitCue) lines.push(profile.recruitCue === 'mythic' ? '神話級' : '伝説級');
  if (!hasRoom()) {
    panel(npc.name,[...lines,'酒場で人間の同行枠を空けると、誘うことができます。'],[['戻る',back]]);
    return;
  }
  if (record?.departed) {
    const ready = townDay() > record.departed.day;
    panel(npc.name,[ready ? '「あの晩のこと、謝りたかった。預かったお金を返したい」' :
      'もう少し時間を置いてから、話を聞こう。'],[
      ['話を聞いて和解する',() => {
        if (!record.departed) return;
        player.gold = Math.min(bankLimit,player.gold+record.departed.gold);
        record.departed = null;
        record.affinity = record.trust = -20;
        remember(record,'和解して返金を受けた');
        save();
        audio.setTrack(track,recording);
        recruitment(npc,onBack);
      },!ready],['戻る',back]
    ]);
    return;
  }
  panel(npc.name + 'を仲間にしますか？',lines,[
    ['はい',() => {
      if (!hasRoom() || player.party.includes(npc.name)) return back();
      const member = candidate;
      companions.set(npc.name,member);
      player.party.push(npc.name);
      remember(member,'加入');
      save();
      back();
    }],['いいえ',back]
  ]);
}

const nearTavern = () => interior?.site.kind === 'tavern' && !siteAvailability(interior.site);

function tavern(remote = false) {
  if (!remote && (mode !== 'field' || !nearTavern())) return;
  if (!battle) audio.setTrack('tavern','17');
  const back = () => tavern(remote);
  const leave = () => {
    if (!battle) setFieldTrack();
    if (remote) openMenu();
    else servicePanel();
  };
  const actions = [[remote ? 'メニューに戻る' : '窓口に戻る',leave]];
  for (const member of activeCompanions()) actions.push([companionName(member),() => companionOptions(member,back,remote)]);
  if (!battle) {
    if (!companions.has('クルミ')) actions.push(['クルミを誘う',() => recruitment(npcs.find(npc => npc.name === 'クルミ'),back)]);
    for (const member of companions.values()) {
      if (player.party.includes(member.name)) continue;
      if (member.monster) {
        actions.push([companionName(member) + 'を同行させる',() => {
          if (!player.party.includes(member.name)) player.party.push(member.name);
          save();
          back();
        }]);
      } else actions.push([member.name + 'を誘う',() => recruitment(npcs.find(npc => npc.name === member.name),back)]);
    }
  }
  panel('酒場',[
    '人間 ' + humans().length + '/2　フクロウ ' + Number(player.party.includes('クルミ')) + '/1　ソソ ' +
      Number(joined) + '/1　契約 ' + activeCompanions().filter(member => member.monster).length + '/3',
    battle ? '戦闘を一時停止中。作戦を変更できます。' : '隊列の先頭に近い順に表示。'
  ],actions);
}

function companionOptions(member,back,remote) {
  const profile = companionProfile(member.name);
  const name = companionName(member);
  const actions = [['戻る',back]];
  for (const tactic of ['攻撃優先','支援優先','守備優先']) actions.push([tactic,() => {
    member.tactic = tactic;
    if (!battle) save();
    companionOptions(member,back,remote);
  },member.tactic === tactic]);
  if (!battle) {
    actions.push(['会話する',() => {
      const place = prefectures[chapterOf(player.x)].name;
      const memory = place + 'で旅の思い出を話した';
      if (!member.history.includes(memory)) {
        remember(member,memory);
        member.affinity = clamp(member.affinity + (profile.fit < 0 ? 1 : 3),-100,100);
        member.trust = clamp((member.trust || 0)+2,-100,100);
        save();
      }
      audio.setTrack(audio.track,'21');
      panel(name,[name + '「' + (profile.fit < 0 ? '歩く速さは違うけれど、一緒なら知らない景色が見えてくるね。' :
        'ここで見た景色を、次の旅先でも思い出しそうだね。') + '」'],[['戻る',() => { audio.setTrack('tavern','17'); companionOptions(member,back,remote); }]]);
    }],['隊列の先頭へ',() => {
      player.party = [member.name,...player.party.filter(name => name !== member.name)];
      save();
      back();
    },player.party[0] === member.name],['別れる',() => panel(name + 'と別れますか？',[
      '能力と会話の記録を保存します。'
    ],[['はい',() => {
      player.party = player.party.filter(name => name !== member.name);
      remember(member,'酒場で離脱');
      save();
      back();
      audio.playInterlude('23');
    }],['いいえ',back]])]);
    if (member.monster) actions.push(['契約を解く',() => panel(name + 'との契約を解きますか？',[
      '契約石を再び使えるようになります。'
    ],[['解く',() => {
      player.party = player.party.filter(name => name !== member.name);
      companions.delete(member.name);
      save();
      back();
    }],['戻る',back]])]);
    const cost = 20 + member.gear * 15;
    if (!remote) actions.push(['装備を整える　' + cost + 'G',() => trade(cost,() => { member.gear++; },back),member.gear >= 3 || player.gold < cost]);
    if (!remote) actions.push(['休ませる',() => {
      member.hp = companionHP(member);
      member.mp = companionMP(member);
      save();
      back();
    }]);
  }
  panel(name,[profile.job + '　属性 ' + profile.element,
    'HP ' + member.hp + '/' + companionHP(member) + '　MP ' + member.mp + '/' + companionMP(member),
    '相性 ' + profile.fit + '　好感度 ' + member.affinity + '　信頼 ' + (member.trust || 0)],actions);
}

const otherTrails = new Map();
function partyTrail(name,index) {
  if (index === 0) return companionTrail;
  if (!otherTrails.has(name)) otherTrails.set(name,{x:player.x-27-index*15,y:player.y+(index%2 ? -10 : 10)});
  return otherTrails.get(name);
}

function followCompanion(dt) {
  for (const [index,member] of activeCompanions().entries()) {
    const trail = partyTrail(member.name,index);
    const gap = 24 + index * 11;
    const dx = player.x - trail.x, dy = player.y + (index % 3 - 1) * 7 - trail.y;
    const length = Math.hypot(dx,dy);
    const aim = Math.max(0,jumpHeight-length*.25);
    trail.height = (trail.height || 0) + (aim-(trail.height || 0))*Math.min(1,dt*9);
    if (length <= gap) continue;
    const step = Math.min(length-gap,dt*(returning ? 430 : gait === 'run' || gait === 'dash' ? 190 : 135));
    trail.x += dx/length*step;
    trail.y += dy/length*step;
  }
}

function awardCompanion(xp) {
  for (const member of activeCompanions()) member.xp = Math.min(300000,member.xp+xp);
}

function contractStones() {
  return [2,5,8].filter(chapter => towns[chapter].sites.at(-1).seal.solved).length;
}

const captureOrigin = foe => foe.unit.chapter*8+foe.unit.slot;

function captureCandidates() {
  if (!battle?.group || battle.group.source.boss || battle.command && battle.command.phase !== 'select' ||
      capturedCompanions().length >= contractStones() || clock < (battle.captureAt || 0)) return [];
  const seen = new Set();
  return livingEnemies(battle.group).filter(foe=>{
    const name = '魂-'+captureOrigin(foe);
    if (foe.summoned || foe.unit.hp > foe.unit.max*.42 || companions.has(name) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

const canCapture = () => captureCandidates().length > 0;

function offerCapture() {
  const candidates = captureCandidates();
  if (!candidates.length) return;
  if (candidates.length === 1) return confirmCapture(candidates[0]);
  panel('契約する相手を選ぶ',[],[
    ...candidates.map(foe=>[foe.unit.name+'・'+foe.profile.name,()=>confirmCapture(foe)]),['戻る',openMenu]
  ]);
}

function confirmCapture(slot) {
  const foe = slot.unit;
  const probability = Math.round(clamp(.34+(.42-foe.hp/foe.max)*1.24-foe.variant*.045,.18,.88)*100);
  panel(foe.name+'と契約しますか？',[
    '成功率 '+probability+'%　魂の契約石 '+(contractStones()-capturedCompanions().length)+'個が使用可能。'
  ],[['契約する',()=>{
    if (!captureCandidates().includes(slot)) return openMenu();
    if (Math.random()*100 >= probability) {
      if (battle.command) {
        battle.command.plan = [];
        battle.command.failedEscape = true;
        startCommandRound();
      } else {
        battle.captureAt = clock+5;
        slot.nextAt = clock;
      }
      resume();
      say('契約に失敗した。',2);
      return;
    }
    const origin = captureOrigin(slot);
    const name = monsterCompanion(origin);
    if (!name || companions.has(name)) return openMenu();
    const profile = companionProfiles[name];
    companions.set(name,{name,monster:true,origin,hp:profile.hp,mp:profile.mp,xp:0,gear:0,
      affinity:0,trust:0,fatigue:0,tactic:'攻撃優先',history:[]});
    player.party.push(name);
    monsterDex.add(foe.name);
    slot.state = 'captured';
    slot.strike = null;
    foe.hp = 0;
    resume();
    if (battle.command) {
      if (!checkCommandOutcome(battle.command)) updateCommandUI();
    }
    say(foe.name+'と契約した。残りの敵との戦闘を続ける。');
  }],['戻る',openMenu]]);
}
