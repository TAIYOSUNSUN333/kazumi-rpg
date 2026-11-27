const lodgingTypes = [
  {name:'一般宿',style:'木造旅籠',price:12,art:0},
  {name:'格安宿',style:'民宿',price:7,art:0,modest:true},
  {name:'温泉旅館',style:'温泉旅館',price:20,art:1,cure:true},
  {name:'高級ホテル',style:'眺望ホテル',price:34,art:3,blessing:true},
  {name:'特別な宿',style:'星見の宿',price:23,art:2,special:true},
  {name:'一般宿',style:'町のビジネスホテル',price:12,art:2}
];
const innProfile = chapter => lodgingTypes[chapter%lodgingTypes.length];
let innPending = null;
let innScene = null;
let innBuffUntil = 0;
let footingUntil = 0;

const innStages = [
  {from:0,label:'受付',track:'innDesk'},
  {from:1.5,label:'客室へ',track:'innEntry'},
  {from:3.6,label:'夕べの会話',track:'innTalk'},
  {from:5.3,label:'夕べの会話',track:'innTalk'},
  {from:10,label:'それぞれの寝床へ',track:'innTalk'},
  {from:12.2,label:'消灯',track:'innSleep'},
  {from:14.2,label:'就寝',track:'innSleep'},
  {from:17,label:'夜半',track:'innSleep'},
  {from:20.5,label:'朝日',track:'innWake'},
  {from:22,label:'起床',track:'innWake'},
  {from:26,label:'朝食',track:'innWake'},
  {from:29,label:'出発',track:'innEntry'}
];
const innEnd = 31.2;

function innSnapshot() {
  return {pending:innPending,buffUntil:innBuffUntil,footing:Math.max(0,footingUntil-clock)};
}

function loadInn(data) {
  const saved = data?.pending;
  innPending = saved && townSites.get(saved.site)?.kind === 'inn' ?
    {site:saved.site,day:numeric(saved.day,townDay(),townDay(),townDay()+1),
      seed:numeric(saved.seed,0,0,65535),choice:Number.isInteger(saved.choice) ? saved.choice : null} : null;
  innBuffUntil = numeric(data?.buffUntil,0,0,360003600);
  footingUntil = numeric(Math.ceil(data?.footing),0,0,120);
}

function facilityGuests() {
  const guests = [{id:'hero',name:'一美',kind:'hero',temper:'慎重',fit:0}];
  for (const member of activeCompanions()) {
    const profile = companionProfile(member.name);
    const enemy = member.monster ? enemies[member.origin] : null;
    const size = enemy ? combatBody(enemy).size : 1;
    guests.push({id:member.name,name:companionName(member),member,profile,
      kind:enemy ? 'monster' : member.name === 'クルミ' ? 'owl' : 'human',
      temper:profile.personality,fit:profile.fit,size,large:size >= 1.42,
      nocturnal:Boolean(enemy && (enemy.nightOnly || enemy.variant === 3))});
  }
  if (joined) guests.push({id:'cat',name:'ソソ',kind:'cat',temper:'気まぐれ',fit:30});
  return guests;
}

function innRoom(guests) {
  const width = 290 + Math.max(0,guests.length-1)*36;
  const left = (640-width)/2;
  const humans = guests.filter(guest=>guest.kind === 'human');
  const animals = guests.filter(guest=>!['hero','human'].includes(guest.kind));
  const beds = new Map([['hero',{x:320,y:240,width:76,type:'futon'}]]);
  for (const [index,guest] of humans.entries()) {
    const close = guest.fit >= 0 && guest.member.affinity >= -3;
    const spacing = close ? 106 : width/2-45;
    beds.set(guest.id,{x:320+(index ? 1 : -1)*spacing,y:240,width:72,type:'futon'});
  }
  for (const [index,guest] of animals.entries()) {
    const x = left+width*(index+.55)/(animals.length+.10);
    const type = guest.kind === 'owl' ? 'perch' : guest.large ? 'large' : 'nest';
    beds.set(guest.id,{x,y:174,width:type === 'large' ? 74 : type === 'perch' ? 42 : 46,type});
  }
  return {left,width,beds};
}

function tonightConversation(scene) {
  const humans = scene.guests.filter(guest=>guest.kind === 'human');
  const speaker = humans[scene.seed%humans.length] || scene.guests.find(guest=>guest.kind === 'owl');
  if (!speaker) return {line:scene.guests.some(guest=>guest.kind === 'cat') ? 'ソソが枕を半分空けて鳴いた。' :
    '窓辺で明日の道順をたしかめる。'};
  const {member,name} = speaker;
  const n = (townDay()+scene.site.chapter+member.history.length+scene.seed)%5;
  const line = text => ({speaker,line:name+'「'+text+'」'});
  if (speaker.kind === 'human' && member.affinity >= 38 && (member.trust || 0) >= 14 && speaker.fit >= 10) {
    return {...line('部屋が冷えてきたね。よかったら同じ掛け布団で眠らない？'),
      choices:[['一緒に休む','二人で掛け布団を分け合い、安心して眠った。',4,'share'],
        ['別々の寝床で休む','それぞれの寝床で、ゆっくり休むことにした。',1]]};
  }
  if (member.name === '一郎' && member.affinity >= 16 && n%2 === 0) {
    return {...line('君といると、旅が終わってもまた会いたいと思う。手をつないでもいい？'),romance:true,
      choices:[['手をつなぐ','二人は気持ちを伝え、手をつないだ。',5,'romance'],
        ['今は友達として話す','一郎は気持ちを尊重して、明日の旅の話に戻った。',1]]};
  }
  if (speaker.kind === 'human' && (member.affinity <= -4 || n === 3)) {
    return {...line('昼間の道選び、少し無理をしたと思う。今のうちに話し合いたい。'),
      choices:[['互いの話を聞いて仲直り','お互いの考えを聞き、旅を続けることにした。',5,'reconcile'],
        ['今夜は距離を置く','それぞれの寝床で考える時間を取った。',-2],
        ...(member.affinity <= -4 ? [['ここで別れを告げる','口論になり、'+name+'は部屋を出ていった。',0,'depart']] : [])]};
  }
  const place = prefectures[scene.site.chapter].sight;
  const prompts = ['旅先でいちばんおかしかったこと、覚えてる？','最初に会った日のこと、時々思い出すよ。',
    'この先が少し心配。焦らず歩いてもいいかな。','先に休憩する道も考えておこう。',
    '明日は早めに'+place+'まで歩いてみない？'];
  return {...line(scene.profile.special ? 'この窓から'+place+'の明かりが見えるよ。' : prompts[n]),choices:[
    ['話を聞く','ゆっくり話を聞いた。',3],['明日の計画を相談する','無理のない道順を一緒に考えた。',2]
  ]};
}

function innNightEvent(scene) {
  const events = [{id:'window',text:'窓の外で風が木の葉を揺らした。'}];
  const humans = scene.guests.filter(guest=>guest.kind === 'human' &&
    !(scene.choice?.[3] === 'depart' && guest.id === scene.conversation.speaker?.id));
  if (humans.length) {
    const guest = humans[scene.seed%humans.length];
    events.push({id:'chat',guest,text:guest.name+'「夜が静かだね。また明日、続きを話そう」'},
      {id:'late',guest,text:guest.name+'は目覚ましに気づかず、朝寝坊しそうだ。'});
    if (humans.length > 1) events.push({id:'laugh',guest,text:humans.map(member=>member.name).join('と')+'の小さな笑い声が聞こえた。'});
    if (guest.member.affinity < 0) events.push({id:'quarrel',guest,text:guest.name+'が言い過ぎたと気づき、謝りに来た。'});
  }
  if (scene.choice?.[3] === 'romance') events.push({id:'romance',guest:scene.conversation.speaker,text:'手をつないだ一郎と、窓辺で短い言葉を交わした。'});
  if (scene.choice?.[3] === 'reconcile') events.push({id:'reconcile',guest:scene.conversation.speaker,text:'おやすみの声をかけ合って、わだかまりがほどけた。'});
  for (const guest of scene.guests) {
    if (guest.kind === 'cat') events.push({id:'cat',guest,text:'ソソがそっと一美の布団に潜り込んだ。'});
    if (guest.kind === 'owl') events.push({id:'owl',guest,text:'クルミが止まり木で目を開け、低く一度鳴いた。'});
    if (guest.kind === 'monster') events.push(guest.nocturnal ?
      {id:'watch',guest,text:guest.name+'が窓辺で夜道を見張っている。'} :
      {id:'snore',guest,text:guest.name+'の寝床から、低いいびきが聞こえた。'});
  }
  return events[(scene.seed*17+scene.site.chapter)%events.length];
}

function beginStay() {
  const site = interior?.site;
  if (site?.kind !== 'inn' || innPending) return;
  const profile = innProfile(site.chapter);
  if (player.gold < profile.price) return;
  player.gold -= profile.price;
  innPending = {site:site.id,day:townDay()+Number(townHour()>=6),seed:Math.floor(Math.random()*65536),choice:null};
  save();
  resumeInn();
}

function resumeInn() {
  if (!innPending) return;
  const site = townSites.get(innPending.site);
  if (!site) return;
  if (interior?.site !== site) interior = {site,x:320,y:145};
  const guests = facilityGuests();
  const scene = {site,profile:innProfile(site.chapter),time:0,stage:-1,choice:null,
    guests,room:innRoom(guests),seed:innPending.seed};
  scene.conversation = tonightConversation(scene);
  scene.choice = scene.conversation.choices?.[innPending.choice] || null;
  scene.night = innNightEvent(scene);
  innScene = scene;
  paused = true;
  menuActive = false;
  clearInput();
  $('panel').hidden = true;
  $('stay-controls').hidden = false;
  $('stay-skip').textContent = '宿泊演出をスキップ';
  audio.unlock();
  advanceInn(0);
}

function advanceInn(dt) {
  const scene = innScene;
  if (!scene) return;
  scene.time += dt;
  if (scene.time >= innEnd) return finishStay();
  const index = innStages.findLastIndex(stage=>scene.time >= stage.from);
  if (index === scene.stage) return;
  scene.stage = index;
  const beat = innStages[index];
  const captions = [
    '受付で'+scene.guests.length+'名分の鍵を受け取った。','一行は廊下を通って客室へ向かう。',
    scene.guests.length === 1 ? '一美は窓の外を眺め、旅の手帳を開いた。' : '寝支度をしながら、今日の旅の話をした。',
    scene.choice?.[1] || scene.conversation.line,'それぞれの寝床へ向かった。','明かりがゆっくりと消えていく。',
    '部屋が静かになり、寝息が聞こえた。',scene.night.text,'朝日が窓から差し込む。',
    scene.night.id === 'late' ? scene.night.guest.name+'が最後に大きく伸びをした。' : '窓辺の鳥の声で、一人ずつ目を覚ました。',
    'みんなで'+prefectures[scene.site.chapter].dish+'の朝食を囲んだ。','旅支度を整え、受付へ向かった。'
  ];
  const romance = index === 3 && scene.conversation.romance || index === 7 && scene.night.id === 'romance';
  audio.setTrack(romance ? 'romance' : beat.track,romance ? '22' : index === 10 ? '20' : '16');
  $('stay-caption').textContent = captions[index];
  $('stay-choices').replaceChildren();
  if (index === 7 && ['owl','snore','laugh'].includes(scene.night.id)) audio.play('inn-'+scene.night.id);
  if (index !== 3 || scene.choice || !scene.conversation.choices) return;
  for (const [position,choice] of scene.conversation.choices.entries()) {
    const button = document.createElement('button');
    button.textContent = choice[0];
    button.onclick = () => {
      if (scene.choice) return;
      scene.choice = choice;
      scene.night = innNightEvent(scene);
      innPending.choice = position;
      save();
      $('stay-caption').textContent = choice[1];
      $('stay-choices').replaceChildren();
    };
    $('stay-choices').append(button);
  }
}

function finishStay() {
  if (!innPending || !innScene) return;
  const {profile,site,choice,conversation,guests} = innScene;
  const destinationTime = innPending.day*3600+900;
  tickTown(Math.max(0,destinationTime-townSeconds));
  player.hp = profile.modest ? Math.min(maxHP(),player.hp+Math.ceil(maxHP()*.65)) : maxHP();
  player.mp = profile.modest ? Math.min(maxMP(),player.mp+Math.ceil(maxMP()*.65)) : maxMP();
  player.fatigue = 0;
  if (joined) resetCat();
  if (profile.cure) footingUntil = clock;
  if (profile.blessing) innBuffUntil = townSeconds+3600;
  for (const {member} of guests) {
    if (!member) continue;
    member.hp = profile.modest ? Math.min(companionHP(member),member.hp+38) : companionHP(member);
    member.mp = profile.modest ? Math.min(companionMP(member),member.mp+18) : companionMP(member);
    member.fatigue = 0;
  }
  const member = conversation.speaker?.member;
  const departed = member && choice?.[3] === 'depart';
  if (departed) {
    member.departed = {gold:player.gold,day:townDay()};
    player.gold = 0;
    member.affinity = -100;
    remember(member,'喧嘩別れ');
    player.party = player.party.filter(name=>name !== member.name);
  } else if (member && choice) {
    remember(member,choice[1]);
    member.affinity = clamp(member.affinity+choice[2],-100,100);
    member.trust = clamp((member.trust || 0)+choice[2],-100,100);
  }
  if (activeCompanions().length) regionalInnTalk(site.chapter);
  innPending = innScene = null;
  $('stay-controls').hidden = true;
  $('stay-choices').replaceChildren();
  interior = null;
  player.x = site.x;
  player.y = clamp(site.row+(site.upper ? 12 : -12),fieldTop,fieldBottom);
  exitDoorLock = site;
  fieldSafeUntil = clock+1.8;
  enterField();
  say(profile.modest ? '宿を出た。体力・魔力と疲労が回復した。' :
    profile.blessing ? '宿を出た。全快し、翌朝まで攻撃力が上昇した。' : '宿を出た。HP・MP・疲労が全快した。',7);
  save();
  if (departed) {
    audio.setTrack('loss','23');
    panel(member.name+'の置き手紙',[
      '「今は一緒に旅を続けられない。先に出る」',
      '手持ちの'+member.departed.gold+'Gがなくなっていた。銀行の預金は残っている。'
    ],[['手紙をしまう',resume]]);
  }
}

document.getElementById('stay-skip').onclick = () => bathScene ? finishBath() : finishStay();
