// Life events use the same in-game calendar as lodging, travel and banking.
const familyAdults = {
  一郎:{age:26, affection:'約束を守ることと、一緒に食卓を囲むことを大切にする。', preference:'meal'},
  タク:{age:25, affection:'お互いの自由を尊重し、知らない景色を一緒に見るのが好き。', preference:'date'}
};
const familyStats = ['愛情','知力','体力','感性','勇気','道徳','社交性','魔力','器用さ','ソソとの絆'];
const lifeActivities = {
  ミルク:[0,2], 授乳:[0,2], 抱っこ:[0,3], 遊び:[2,3,6], 読書:[1,5], 音楽:[3,7],
  家族旅行:[4,6], お手伝い:[5,8], ソソと遊ぶ:[0,9], 冒険の話:[4,7]
};
const ageEvents = {
  1:'初めて言葉を話し、歩き始めた。',2:'一緒に遊び、自分の好きなことを話せるようになった。',
  3:'ソソの守護のもと、冒険の支援を覚えた。',5:'得意な属性が目覚めた。',
  7:'入学し、職業の適性が表れた。',10:'固有スキルを習得した。',
  15:'上級職に進んだ。',18:'成人し、独立した冒険者になった。'
};
const houseRooms = ['寝室','子供部屋','台所','浴室','庭','ソソの遊び場'];
const houseStyles = ['木づくり','花柄','星明かり'];
const lifeSupplies = {避妊具:6, 育児用品:8, 衣服:12, おもちゃ:9, 絵本:10, 贈り物:12};
const childhoodDays = 10;
const knownAdult = name => Object.hasOwn(familyAdults,name);
const validChild = name => typeof name === 'string' && name.trim().length > 0;

function newFamily(day = 0) {
  return {relationships:{}, spouse:null, pregnancy:null, children:[], houses:{}, supplies:{},
    photos:[], history:[], outingPrize:false, savings:0, expenses:0, automatic:true, day};
}

let family = newFamily();

function restoreFamily(data) {
  family = newFamily(townDay());
  if (!data || typeof data !== 'object') return;
  for (const name of Object.keys(familyAdults)) {
    const row = data.relationships?.[name];
    if (!row) continue;
    family.relationships[name] = {
      stage:['friend','dating','married','separated'].includes(row.stage) ? row.stage : 'friend',
      intimacy:numeric(row.intimacy,0,0,100), trust:numeric(row.trust,0,0,100),
      love:numeric(row.love,0,0,100), conflict:row.conflict === true,
      day:numeric(row.day,-1,-1,townDay())
    };
  }
  if (knownAdult(data.spouse) && family.relationships[data.spouse]?.stage === 'married') family.spouse = data.spouse;
  if (data.pregnancy && knownAdult(data.pregnancy.parent)) {
    const row = data.pregnancy;
    family.pregnancy = {parent:row.parent, start:numeric(row.start,townDay(),0,townDay()),
      twins:row.twins === true, told:row.told === true, notice:numeric(row.notice,0,0,3)};
  }
  for (const row of (Array.isArray(data.children) ? data.children.slice(0,12) : [])) {
    if (!row || !validChild(row.name) || !knownAdult(row.parent)) continue;
    const born = numeric(row.born,townDay(),0,townDay());
    family.children.push({
      name:row.name.trim().slice(0,16), parent:row.parent, born,
      age:numeric(row.age,0,0,18), seed:numeric(row.seed,0,0,999),
      stats:familyStats.map((_,i) => numeric(row.stats?.[i],5,0,100)),
      careDay:numeric(row.careDay,-1,-1,townDay()), patrol:numeric(row.patrol,-1,-1,townDay())
    });
  }
  for (let region=0; region<=last; region++) {
    const row = data.houses?.[region];
    if (!row) continue;
    const styles = {};
    for (const key of ['家具','壁紙','床','照明']) styles[key] = numeric(row.styles?.[key],0,0,2);
    family.houses[region] = {tier:numeric(row.tier,1,1,3),styles,
      planted:numeric(row.planted,-1,-1,townDay()), fish:numeric(row.fish,0,0,9),
      produce:numeric(row.produce,0,0,9), fished:numeric(row.fished,-1,-1,townDay())};
  }
  for (const name of Object.keys(lifeSupplies)) family.supplies[name] = numeric(data.supplies?.[name],0,0,99);
  family.photos = Array.isArray(data.photos) ? data.photos.filter(row => row && Number.isInteger(row.region) &&
    row.region >= 0 && row.region <= last && Array.isArray(row.people)).slice(-24).map(row => ({
      region:row.region, day:numeric(row.day,0,0,townDay()), people:row.people.filter(p => p && validChild(p.name))
        .slice(0,14).map(p => ({name:p.name.slice(0,16),age:numeric(p.age,18,0,30),seed:numeric(p.seed,0,0,999)}))
    })) : [];
  family.history = Array.isArray(data.history) ? data.history.filter(text => typeof text === 'string').slice(-90)
    .map(text => text.slice(0,120)) : [];
  family.outingPrize = data.outingPrize === true;
  family.savings = numeric(data.savings,0,0,bankLimit);
  family.expenses = numeric(data.expenses,0,0,bankLimit);
  family.automatic = data.automatic !== false;
  family.day = numeric(data.day,townDay(),0,townDay());
  tickFamily();
}

function familyLog(text, day = townDay()) {
  family.history.push('第'+(day+1)+'日　'+text);
  if (family.history.length > 90) family.history.shift();
}

function relationship(name) {
  if (!knownAdult(name)) return null;
  return family.relationships[name] ??= {stage:'friend',intimacy:0,trust:0,love:0,conflict:false,day:-1};
}

function availableAdults() {
  return Object.keys(familyAdults).filter(name => player.party.includes(name) && !companions.get(name)?.departed);
}

function familyCalendar(day = townDay()) {
  const hour = townHour();
  const part = hour < 5 ? '深夜' : hour < 10 ? '朝' : hour < 16 ? '昼' : hour < 19 ? '夕方' : '夜';
  return '旅暦'+(Math.floor(day/360)+1)+'年'+(Math.floor(day/30)%12+1)+'月'+(day%30+1)+'日'+
    (day === townDay() ? '　'+['春','夏','秋','冬'][Math.floor(day/90)%4]+'・'+part : '');
}

function raiseChild(child, activity, amount = 3) {
  for (const i of lifeActivities[activity]) child.stats[i] = Math.min(100,child.stats[i]+amount);
}

function growthAge(child, day = townDay()) {
  return Math.min(18,Math.max(0,Math.floor((day-child.born)/childhoodDays)));
}

function childTalents(child) {
  const ranks = [
    ['学者','星図の導師',1,'光'],['護り手','星盾の守護者',4,'土'],['音楽家','響きの賢者',3,'風'],
    ['術師','星脈の術師',7,'雷'],['工匠','星細工師',8,'水']
  ];
  const [job,advanced,,element] = ranks.reduce((best,row) => child.stats[row[2]] > child.stats[best[2]] ? row : best);
  const inherited = companionProfile(child.parent).element;
  return {job:child.age >= 15 ? advanced : job, element:child.stats[7] >= 12 ? element : inherited || element,
    nature:child.stats[6] >= child.stats[1] ? '人なつこい' : '物思いにふける',
    skill:child.stats[9] >= 18 ? 'ソソと星灯の結界' : '旅星の助け'};
}

function tickFamily() {
  const day = townDay();
  if (day <= family.day) return;
  const elapsed = day-family.day;
  for (const child of family.children) {
    if (family.automatic) {
      const babies = clamp(child.born+childhoodDays-Math.max(child.born,family.day),0,elapsed);
      const growing = elapsed-babies;
      if (babies) raiseChild(child,'ミルク',Math.min(20,babies));
      if (growing) {
        raiseChild(child,'読書',Math.min(15,growing));
        raiseChild(child,'遊び',Math.min(12,growing));
      }
      if (joined) raiseChild(child,'ソソと遊ぶ',Math.min(20,elapsed));
    }
    const next = growthAge(child,day);
    for (let age=child.age+1; age<=next; age++) {
      const stamp = child.born+age*childhoodDays;
      familyLog(child.name+'は'+age+'歳の誕生日を迎えた。'+(ageEvents[age] || ''),stamp);
      if (age === 3 && joined) familyLog('ソソが'+child.name+'の前に立ち、星の守りを教えた。',stamp);
    }
    child.age = next;
  }
  const pregnancy = family.pregnancy;
  if (pregnancy) {
    const age = day-pregnancy.start;
    for (const [stage,threshold,line] of [[1,2,'診療所で妊娠が分かった。'],[2,7,'妊娠中期。小さな胎動を感じた。'],
      [3,13,'妊娠後期。仲間が荷物を持ち、休息を勧めてくれた。']]) {
      if (age >= threshold && pregnancy.notice < stage) {
        pregnancy.notice = stage;
        familyLog(line,pregnancy.start+threshold);
        if (mode === 'field' && !battle && !paused) say(line+'　家族メニューで確認できます。',5);
      }
    }
  }
  const periods = Math.floor(day/30)-Math.floor(family.day/30);
  if (periods && family.children.length) {
    const cost = Math.min(family.savings,periods*(2+family.children.length*2));
    family.savings -= cost;
    family.expenses = Math.min(bankLimit,family.expenses+cost);
  }
  family.day = day;
}

function lifeChange(change) {
  change();
  save();
}

function lifePanel(title, lines, buttons, track = null) {
  if (track) audio.setTrack(track === '22' ? 'romance' : 'home',track);
  panel(title,lines,buttons);
  $('panel').dataset.kind='life';
  $('panel').scrollTop = 0;
}

function lifeExit(back = openMenu) {
  setFieldTrack();
  back();
}

function relationshipMenu() {
  tickFamily();
  const names = [...new Set([...availableAdults(),...Object.keys(family.relationships)])];
  lifePanel('恋愛・相性',['一美（24歳）', '一緒に過ごす時間が、親密度・信頼・愛情につながります。'],[
    ...names.map(name => [name,() => adultMenu(name)]),['戻る',() => lifeExit()]
  ],'22');
}

function adultMenu(name) {
  const rel = relationship(name);
  const adult = familyAdults[name];
  const member = companions.get(name);
  const available = availableAdults().includes(name);
  const fit = clamp(50+companionProfile(name).fit,0,100);
  const stages = {friend:'友人',dating:'交際中',married:'結婚',separated:'別れた相手'};
  const social = (kind,cost = 0) => {
    if (!available || rel.day === townDay() || player.gold < cost) return;
    lifeChange(() => {
      player.gold -= cost;
      rel.day = townDay();
      rel.intimacy = Math.min(100,rel.intimacy+8);
      rel.trust = Math.min(100,rel.trust+(kind === 'talk' ? 8 : 4));
      rel.love = Math.min(100,rel.love+(adult.preference === kind ? 10 : 5));
      if (member) {
        member.affinity = Math.min(100,member.affinity+3);
        member.trust = Math.min(100,(member.trust || 0)+2);
      }
      const partner = family.spouse || Object.keys(family.relationships).find(other => family.relationships[other].stage === 'dating');
      if (partner && partner !== name && kind === 'date') {
        relationship(partner).conflict = true;
        familyLog(partner+'は最近の距離に寂しさを感じている。');
      }
    });
    adultMenu(name);
  };
  const busy = !available || rel.day === townDay();
  lifePanel(name+'との関係',[name+'（'+adult.age+'歳）　'+stages[rel.stage],adult.affection,
    '親密度 '+rel.intimacy+'　相性 '+fit+'　信頼 '+rel.trust+'　愛情 '+rel.love,
    rel.conflict ? 'すれ違いについて、落ち着いて話す時間が必要です。' : ''],[
    ['会話する',() => social('talk'),busy],
    ['贈り物を渡す',() => { if (!family.supplies.贈り物 || busy) return; family.supplies.贈り物--; social('gift'); },busy || !family.supplies.贈り物],
    ['一緒に食事をする　6G',() => social('meal',6),busy || player.gold < 6],
    ['景色を見に行く　4G',() => social('date',4),busy || player.gold < 4],
    ['告白する',() => declareLove(name),!available || !['friend','separated'].includes(rel.stage)],
    ...(rel.conflict ? [['仲直りする',() => reconcileFamily(name),!available]] : []),
    ...(rel.stage === 'dating' ? [['結婚を申し込む',() => offerWedding(name),!available || !!family.spouse]] : []),
    ...(['dating','married'].includes(rel.stage) ? [['別々の道を選ぶ',() => separateFamily(name)]] : []),
    ['戻る',relationshipMenu]
  ],'22');
}

function declareLove(name) {
  const rel = relationship(name);
  const willing = availableAdults().includes(name) && !family.spouse && rel.intimacy >= 24 &&
    rel.trust >= 16 && rel.love >= 13 && !rel.conflict &&
    !Object.values(family.relationships).some(r => r.stage === 'dating');
  lifePanel('気持ちを伝える',[willing ? name+'「僕も、これから二人で歩いてみたい」' :
    name+'「話してくれてありがとう。今はこの関係のままでいたい」'],[
    ...(willing ? [['交際を始める',() => {
      lifeChange(() => { rel.stage='dating'; familyLog(name+'と交際を始めた。'); });
      adultMenu(name);
    }]] : []),['戻る',() => adultMenu(name)]
  ],'22');
}

function reconcileFamily(name) {
  const rel = relationship(name);
  lifePanel('仲直り',[name+'「どちらの気持ちも、急がず話そう」'],[
    ['相手の気持ちを聞く',() => {
      lifeChange(() => { rel.conflict=false; rel.trust=Math.min(100,rel.trust+6); familyLog(name+'と話し合った。'); });
      adultMenu(name);
    }],['あとで話す',() => adultMenu(name)]
  ],'22');
}

function separateFamily(name) {
  lifePanel('二人のこれから',['関係を終えても、子供や家族の記録は引き継がれます。'],[
    ['別れを伝える',() => {
      lifeChange(() => {
        const rel = relationship(name);
        rel.stage='separated'; rel.love=Math.floor(rel.love/2); rel.conflict=false;
        if (family.spouse === name) family.spouse=null;
        familyLog(name+'と別々の道を歩むことにした。');
      });
      adultMenu(name);
    }],['戻る',() => adultMenu(name)]
  ],'23');
}

function offerWedding(name) {
  const rel = relationship(name);
  const willing = availableAdults().includes(name) && !family.spouse && rel.stage === 'dating' &&
    rel.trust >= 32 && rel.love >= 27 && !rel.conflict;
  lifePanel('結婚の申し込み',[willing ? name+'「うん。一緒に家族になろう」' :
    name+'「大事な話だから、もう少し時間をかけて考えたい」'],[
    ...(willing ? [['式を挙げる　40G',() => {
      if (player.gold < 40 || family.spouse) return;
      lifeChange(() => {
        player.gold -= 40; family.spouse=name; rel.stage='married';
        familyLog(name+'と結婚式を挙げた。');
      });
      audio.setTrack('familyWedding');
      audio.play('level');
      lifePanel('星明かりの結婚式',['二人は仲間たちの前で誓いを交わした。',
        joined ? 'ソソが花びらの落ちる足もとに座り、二人を見上げた。' : '仲間たちが花を贈ってくれた。'],
        [['祝いの席を出る',relationshipMenu]]);
      familyPicture([{name:'一美',age:24,seed:2},{name,age:familyAdults[name].age,seed:7}],'wedding');
    },player.gold < 40]] : []),['戻る',() => adultMenu(name)]
  ],'22');
}

function familyVictory() {
  for (const name of availableAdults()) {
    const rel = relationship(name);
    rel.trust = Math.min(100,rel.trust+1);
    if (rel.stage === 'dating' || rel.stage === 'married') rel.intimacy = Math.min(100,rel.intimacy+1);
  }
}

function romanceAtInn() {
  const names = availableAdults().filter(name => ['dating','married'].includes(relationship(name).stage));
  lifePanel('宿屋・二人の時間',['一緒に過ごす相手を選びます。通常の宿泊は受付で選べます。'],[
    ...names.map(name => [name,() => innConsent(name,0)]),['受付に戻る',() => lifeExit(servicePanel)]
  ],'22');
}

function innConsent(name, step) {
  const site = interior?.site;
  const rel = relationship(name);
  if (site?.kind !== 'inn' || !availableAdults().includes(name) || !['dating','married'].includes(rel.stage)) return lifeExit();
  const willing = !rel.conflict && rel.trust >= [16,22,28][step] && rel.love >= [10,15,21][step];
  const scene = (townDay()+site.chapter+Number(name === 'タク'))%3;
  const lines = [
    ['灯を落とした客室で、今日の旅について語った。','窓辺で、二人は次に行きたい場所の話をした。','雨音を聞きながら、静かな時間を過ごした。'][scene],
    name+'「抱きしめてもいい？　このまま話していてもいいよ」',
    name+'「キスのあと、もう少し二人きりで過ごしたい。君はどうしたい？」'
  ];
  const label = ['話を続ける','抱擁する','キスを交わす'][step];
  lifePanel(['夕べの会話','気持ちを確かめる','二人の約束'][step],[lines[step],
    willing ? '一美も自分の気持ちを伝えられます。' : name+'「今夜はここまでにしよう」'],[
    ...(willing ? [[label,() => step < 2 ? innConsent(name,step+1) : chooseProtection(name)]] : []),
    ['今夜はここまで',() => lifeExit(servicePanel)]
  ],'22');
}

function chooseProtection(name) {
  const cost = innProfile(interior.site.chapter).price;
  lifePanel('泊まる前の確認',[name+'「どちらかが迷ったら、いつでも止めよう」',
    '二人で避妊について話した。避妊具を使う場合は所持品から1個を使います。'],[
    ['同意して宿泊・避妊具を使う',() => spendNight(name,true),!family.supplies.避妊具 || player.gold < cost],
    ['同意して宿泊・避妊具を使わない',() => spendNight(name,false),player.gold < cost],
    ['やめる',() => lifeExit(servicePanel)]
  ],'22');
}

function spendNight(name, protectedStay, chance = Math.random) {
  const site = interior?.site;
  const rel = relationship(name);
  if (site?.kind !== 'inn' || !availableAdults().includes(name) || rel.conflict ||
      !['dating','married'].includes(rel.stage) || rel.trust < 28 || rel.love < 21 ||
      protectedStay && !family.supplies.避妊具) return;
  const cost = innProfile(site.chapter).price;
  if (player.gold < cost) return;
  lifeChange(() => {
    player.gold -= cost;
    if (protectedStay) family.supplies.避妊具--;
    if (!family.pregnancy && family.children.length < 12 && chance() < (protectedStay ? .01 : .28)) {
      family.pregnancy = {parent:name,start:townDay(),twins:family.children.length < 11 && chance()<.08,told:false,notice:0};
    }
    rel.love = Math.min(100,rel.love+5);
    rel.trust = Math.min(100,rel.trust+3);
    restWithFamily();
    familyLog(name+'と静かな一夜を過ごした。');
  });
  lifePanel('灯を落とした部屋',['二人は手を取り合った。窓の灯がゆっくり消えていく。'],[
    ['翌朝へ',() => lifePanel('朝の窓辺',[name+'「おはよう。これからのことも、一緒に話していこう」'],[
      ['受付へ',() => lifeExit(servicePanel)]
    ],'22')]
  ],'22');
  familyPicture([{name:'一美',age:24,seed:2},{name,age:familyAdults[name].age,seed:7}],'night');
}

function restWithFamily() {
  const nextMorning = (townDay()+Number(townHour() >= 6))*3600+900;
  tickTown(Math.max(0,nextMorning-townSeconds));
  player.hp=maxHP(); player.mp=maxMP(); player.fatigue=0;
  if (joined) resetCat();
}

function familyMenu() {
  tickFamily();
  lifePanel('家族',[
    familyCalendar(),
    family.spouse ? '配偶者　'+family.spouse : '',
    family.children.length+'人　家族専用枠　・　自動育成 '+(family.automatic ? 'オン' : 'オフ'),
    family.outingPrize ? '家族の旅の記念品を受け取りました。' : ''
  ],[
    ['診療所・産院',maternityClinic],
    ...family.children.map(child => [child.name+'　'+child.age+'歳',() => childMenu(child)]),
    ['家系図',familyTree],['成長記録',familyHistory],['思い出アルバム',familyAlbum],
    ['家族の資産',familyBank],
    ['家族の遠足',familyOuting,!family.children.length],
    ['家族の旅の依頼',familyTravelQuest,!family.children.length],
    ['自動育成を'+(family.automatic ? 'オフ' : 'オン')+'にする',() => {
      lifeChange(() => { family.automatic=!family.automatic; }); familyMenu();
    }],['戻る',() => lifeExit()]
  ]);
}

function maternityClinic() {
  tickFamily();
  const p = family.pregnancy;
  const visible = p?.notice > 0;
  const due = visible && townDay() >= p.start+18;
  lifePanel(prefectures[chapterOf(player.x)].name+'の診療所・産院',visible ? [
    ['','妊娠初期　無理のないペースで旅を続けましょう。','妊娠中期　小さな胎動を感じるようになりました。',
      '妊娠後期　仲間が荷物を持ち、休憩を勧めてくれます。'][p.notice],
    '出産予定日　'+familyCalendar(p.start+18), due ? '出産を迎える準備ができました。' : ''
  ] : ['診察と相談は無料です。'],[
    ...(visible && !p.told ? [['相手に報告する',() => {
      lifeChange(() => { p.told=true; familyLog(p.parent+'に妊娠を伝えた。'); });
      lifePanel('これからの家族',[p.parent+'「驚いたけれど、うれしい。心配なことも一緒に考えよう」'],[
        ['これからの話をする',maternityClinic]
      ],'22');
    }]] : []),
    ...(due ? [['出産を迎える',birthNames]] : []),
    ['家族メニューへ',familyMenu]
  ],visible ? '21' : null);
  if (visible) familyPicture([{name:'一美',age:24,seed:2,pregnancy:p.notice}],'day');
}

function birthNames() {
  const p = family.pregnancy;
  if (!p || townDay() < p.start+18) return maternityClinic();
  lifePanel(p.twins ? '双子の誕生' : '新しい家族の誕生',['赤ちゃんの名前を入力してください。'],[['戻る',maternityClinic]]);
  const form = document.createElement('form');
  form.className='family-form';
  const inputs = Array.from({length:p.twins ? 2 : 1},(_,i) => {
    const label = document.createElement('label');
    label.textContent = (i+1)+'人目の名前';
    const input = document.createElement('input');
    input.required=true; input.maxLength=16; input.value=i ? 'ひかり' : 'あかり';
    label.append(input); form.append(label);
    return input;
  });
  const submit = document.createElement('button');
  submit.textContent='名前を決める';
  form.append(submit);
  form.addEventListener('submit',event => {
    event.preventDefault();
    const names = inputs.map(input => input.value.trim().slice(0,16));
    if (p !== family.pregnancy || !names.every(validChild)) return;
    const children = names.map(name => {
      const parent = companionProfile(p.parent);
      const seed = (familySeedForParent(p.parent)+Math.floor(Math.random()*19)*7)%1000;
      const stats = [10,5,Math.round(parent.hp/22),6,5,5,6,Math.round(parent.mp/5),5,joined ? 6 : 0];
      return {name,parent:p.parent,born:townDay(),age:0,seed,stats,careDay:-1};
    });
    lifeChange(() => {
      family.children.push(...children);
      family.pregnancy=null;
      for (const child of children) familyLog(child.name+'が誕生し、家族専用枠に加わった。');
    });
    audio.setTrack('familyBirth');
    if (audio.context?.state === 'running') {
      const at = audio.context.currentTime;
      for (const [i,note] of [76,81,77].entries()) audio.note(note,at+i*.11,.18,.065*audio.effectsVolume,'oboe',audio.master);
    }
    lifePanel('はじめまして、新しい家族',[
      p.parent+'「小さな声が聞こえた。これからよろしくね」',
      joined ? 'ソソは赤ちゃんのそばで丸くなり、仲間たちが見守った。' : '仲間たちが花を贈り、誕生を祝った。'
    ],[['家族の記録へ',familyMenu]]);
    familyPicture(children,'day');
  });
  $('panel-body').append(form);
}

function childMenu(child) {
  const talents = childTalents(child);
  const busy = child.careDay === townDay();
  const activities = child.age === 0 ? ['ミルク','授乳','抱っこ'] : ['遊び','読書','音楽','お手伝い','冒険の話'];
  if (joined) activities.push('ソソと遊ぶ');
  lifePanel(child.name+'　'+child.age+'歳',[
    child.age === 0 ? 'ときどき夜泣きします。抱っこやミルクで落ち着きます。' : talents.nature,
    '誕生日　'+familyCalendar(child.born)+'　・　旅暦10日につき1歳成長',
    child.age >= 5 ? '得意属性　'+talents.element : '',
    child.age >= 7 ? '適性　'+talents.job : '',
    child.age >= 10 ? '固有スキル　'+talents.skill : '',
    familyStats.map((stat,i) => stat+' '+child.stats[i]).join('　')
  ],[
    ...activities.map(activity => [activity,() => {
      if (child.careDay === townDay()) return;
      lifeChange(() => {
        child.careDay=townDay();
        const supply = {ミルク:'育児用品',遊び:'おもちゃ',読書:'絵本',お手伝い:'衣服'}[activity];
        const extra = supply && family.supplies[supply] > 0 ? 2 : 0;
        if (extra) family.supplies[supply]--;
        raiseChild(child,activity,3+extra);
        familyLog(child.name+'と「'+activity+'」の時間を過ごした。');
      });
      childMenu(child);
    },busy]),
    ...(child.age === 18 ? [['独立した冒険者として出かける',() => {
      if (child.patrol === townDay()) return;
      lifeChange(() => {
        child.patrol=townDay();
        player.gold=Math.min(bankLimit,player.gold+8);
        familyLog(child.name+'は'+talents.job+'として近隣を巡り、旅土産を持ち帰った。');
      });
      lifePanel(child.name+'の冒険',[child.name+'は人々を手伝い、独立した冒険者として帰ってきた。','旅土産　8G'],[
        ['成長記録へ',familyHistory],['戻る',familyMenu]
      ],'21');
    },child.patrol === townDay()]] : []),
    ...(family.children.length > 1 ? [['兄弟姉妹と遊ぶ',() => {
      if (child.careDay === townDay()) return;
      lifeChange(() => { child.careDay=townDay(); family.children.forEach(sibling => raiseChild(sibling,'遊び',2)); });
      childMenu(child);
    },busy]] : []),['戻る',familyMenu]
  ],'21');
  familyPicture([child],'day');
}

function familySupport() {
  if (!joined || !battle || !cat.hp || battle.command && battle.command.phase !== 'resolve') return;
  const helpers = family.children.filter(member => member.age >= 3);
  if (!helpers.length) return;
  battle.familyHelpAt ??= clock+6;
  if (battle.familyHelpAt > clock) return;

  const index = battle.familyHelper || 0;
  const child = helpers[index%helpers.length];
  battle.familyHelper = index+1;
  battle.familyHelpAt = clock+20;
  const hp=Math.min(maxHP()-player.hp,Math.ceil(maxHP()*.06)+Math.floor(child.stats[0]/6));
  player.hp+=hp;
  player.mp=Math.min(maxMP(),player.mp+2+Math.floor(child.stats[7]/15));
  const linked = child.age >= 10 && child.stats[9] >= 18;
  if (linked) invulnerableUntil=Math.max(invulnerableUntil,clock+1.2);
  const target = child.age >= 5 && battle.group?.members.find(foe =>
    foe.state === 'active' && !foe.unit.boss && foe.unit.hp > 10);
  const element = childTalents(child).element;
  if (target) {
    damageEnemySlot(target,Math.min(8,2+Math.floor(child.stats[7]/16)));
    battle.familyEffectUntil=clock+.65;
    battle.familyElement=element;
  }
  audio.play('holy');
  say(child.name+'とソソの'+(linked ? '星灯の結界' : target ? element+'の支援魔法' : '守りの支援')+'！',2.5);
}

function familyTree() {
  lifePanel('家系図',[
    '一美'+(family.spouse ? ' ─ '+family.spouse : ''),
    ...family.children.map(child => '　└ '+child.name+'（一美と'+child.parent+'の子）'),
    joined ? '守り神　ソソ（永久固定枠）' : ''
  ],[['戻る',familyMenu]]);
}

function familyHistory() {
  lifePanel('成長記録',family.history.slice().reverse().slice(0,24),[['戻る',familyMenu]]);
}

function familyPeople() {
  return [{name:'一美',age:24,seed:2},...(family.spouse ? [{name:family.spouse,age:26,seed:7}] : []),
    ...family.children.map(({name,age,seed}) => ({name,age,seed})),...(joined ? [{name:'ソソ',age:0,seed:32}] : [])];
}

function familyOuting() {
  const region = chapterOf(player.x);
  if (family.photos.some(photo => photo.region === region && photo.day === townDay())) return familyAlbum();
  lifeChange(() => {
    family.children.forEach(child => raiseChild(child,'家族旅行'));
    family.photos.push({region,day:townDay(),people:familyPeople()});
    if (family.photos.length>24) family.photos.shift();
    familyLog(prefectures[region].name+'で家族の遠足を楽しみ、記念写真を撮った。');
  });
  lifePanel('家族の遠足',['みんなで'+prefectures[region].sight+'を訪れた。'],[['アルバムを見る',familyAlbum]],'21');
  familyPicture(familyPeople(),'day',region);
}

function familyTravelQuest() {
  const count = new Set(family.photos.map(photo => photo.region)).size;
  lifePanel('家族の旅の依頼',['異なる3地域で家族の写真を撮ろう。','撮影した地域 '+count+'/3'],[
    ...(!family.outingPrize ? [['記念品を受け取る',() => {
      if (count < 3 || family.outingPrize) return;
      lifeChange(() => {
        family.outingPrize=true;
        family.supplies.絵本=Math.min(99,(family.supplies.絵本 || 0)+2);
        familyLog('家族の旅の記念品として絵本を2冊受け取った。');
      });
      audio.play('stoneReward');
      familyMenu();
    },count < 3]] : []),['戻る',familyMenu]
  ],'21');
}

function familyAlbum() {
  lifePanel('思い出アルバム',family.photos.length ? ['撮影時の姿で写真を見返せます。'] : ['写真はまだありません。'],[
    ...family.photos.slice().reverse().map(photo => [
      prefectures[photo.region].name+'・第'+(photo.day+1)+'日',() => {
        lifePanel('家族の記念写真',[prefectures[photo.region].sight],[['アルバムに戻る',familyAlbum]]);
        const image = familyPicture(photo.people,'day',photo.region);
        const download = document.createElement('a');
        download.textContent='写真を保存';
        download.download='kazumi-family-'+photo.day+'.png';
        download.href=image.toDataURL();
        $('panel-body').append(download);
      }
    ]),['戻る',familyMenu]
  ]);
}

function familyBank() {
  const deposit = () => {
    const amount = Math.min(10,townBank,bankLimit-family.savings);
    lifeChange(() => { townBank-=amount; family.savings+=amount; }); familyBank();
  };
  const withdraw = () => {
    const amount = Math.min(10,family.savings,bankLimit-townBank);
    lifeChange(() => { family.savings-=amount; townBank+=amount; }); familyBank();
  };
  lifePanel('家族の資産',[
    '銀行 '+townBank+'G　家族貯金 '+family.savings+'G　家族生活費の累計 '+family.expenses+'G',
    '家族生活費は30日ごとに家族貯金からのみ充当します。'
  ],[['銀行から家族貯金へ　10G',deposit,!townBank],['家族貯金から銀行へ　10G',withdraw,!family.savings],
    ['戻る',familyMenu]]);
}

function familyShop() {
  lifePanel('生活用品',['持ち物　'+Object.keys(lifeSupplies).map(key => key+' '+(family.supplies[key] || 0)).join('／')],[
    ...Object.entries(lifeSupplies).map(([item,price]) => [item+'　'+price+'G',() => {
      if (player.gold < price || (family.supplies[item] || 0)>=99) return;
      lifeChange(() => { player.gold-=price; family.supplies[item]=(family.supplies[item] || 0)+1; });
      audio.play('purchase');
      familyShop();
    },player.gold < price || (family.supplies[item] || 0)>=99]),
    ['窓口に戻る',servicePanel]
  ],'15');
}

function housingMenu() {
  const region = chapterOf(player.x);
  const house = family.houses[region];
  const title = prefectures[region].name+'の住まい';
  const price = 75+region*4;
  if (!house) {
    lifePanel(title,['土地と小さな家　'+price+'G',
      '購入すると休息・セーブができ、家族の集まる場所になります。'],[
      ['土地と家を買う',() => {
        if (player.gold < price || family.houses[region]) return;
        lifeChange(() => {
          player.gold-=price;
          family.houses[region]={tier:1,styles:{家具:0,壁紙:0,床:0,照明:0},planted:-1,fish:0,produce:0,fished:-1};
          familyLog(prefectures[region].name+'に家を建てた。');
        });
        housingMenu();
      },player.gold < price],['戻る',() => lifeExit()]
    ],'21');
    return;
  }
  const upgrade = house.tier*120+region*5;
  lifePanel(title,[
    ['','小さな家','家族の家','星灯の屋敷'][house.tier],
    ['寝室・台所','子供部屋・浴室・庭','ソソの遊び場'].slice(0,house.tier).join('／'),
    '野菜 '+house.produce+'　魚 '+house.fish+'　所持金 '+player.gold+'G'
  ],[
    ['自宅で休む・保存',() => {
      lifeChange(() => { restWithFamily(); familyLog('自宅で一晩休んだ。'); });
      housingMenu();
    }],
    ['家具・内装を変える',() => decorateHouse(house)],
    ...houseRooms.map((room,index) => [room,() => houseRoom(house,room),
      house.tier < (index === 0 || index === 2 ? 1 : index === 5 ? 3 : 2)]),
    ['家族で食卓を囲む',() => houseMeal(house)],
    ...(house.tier < 3 ? [['家を拡張　'+upgrade+'G',() => {
      if (player.gold < upgrade || house.tier >= 3) return;
      lifeChange(() => { player.gold-=upgrade; house.tier++; familyLog('家を増築した。'); });
      housingMenu();
    },player.gold < upgrade]] : []),
    ['ほかの地域の家を確認',houseRegistry],['戻る',() => lifeExit()]
  ],'21');
  familyPicture(familyPeople(),'house',region,house);
}

function houseRegistry() {
  lifePanel('住まいの台帳',Object.entries(family.houses).map(([region,house]) =>
    prefectures[region].name+'　'+['','小さな家','家族の家','星灯の屋敷'][house.tier]),[['戻る',housingMenu]]);
}

function decorateHouse(house) {
  lifePanel('家具と内装',['現在のスタイル　'+Object.entries(house.styles)
    .map(([key,value]) => key+'：'+houseStyles[value]).join('／')],[
    ...Object.keys(house.styles).map(key => [key+'を選ぶ',() => {
      lifePanel(key+'を選ぶ',[],[
        ...houseStyles.map((name,style) => [name+'　12G',() => {
          if (player.gold < 12 || house.styles[key] === style) return;
          lifeChange(() => { player.gold-=12; house.styles[key]=style; });
          decorateHouse(house);
        },house.styles[key] === style || player.gold < 12]),['戻る',() => decorateHouse(house)]
      ],'21');
    }]),['部屋へ戻る',housingMenu]
  ],'21');
  familyPicture(familyPeople(),'house',chapterOf(player.x),house);
}

function houseRoom(house, room) {
  const choices = [['自宅へ戻る',housingMenu]];
  const lines = {
    寝室:'眠る前に、明日の行き先をみんなで話した。',子供部屋:'子供たちの本と、ソソの寝床が並んでいる。',
    台所:'菜園の野菜や釣った魚を使って、家族の食事を作れる。',浴室:'湯気の中で深呼吸すると、旅の疲れがほどけた。',
    庭:'菜園と小さな釣り場がある。',ソソの遊び場:'窓から日が差し、ソソの寝床と木のおもちゃを照らしている。'
  };
  if (room === '庭') {
    choices.unshift(
      ['野菜の種をまく',() => {
        lifeChange(() => { house.planted=townDay(); });
        houseRoom(house,room);
      },house.planted >= 0],
      ['収穫する',() => {
        lifeChange(() => { house.planted=-1; house.produce=Math.min(9,house.produce+3); });
        houseRoom(house,room);
      },house.planted < 0 || townDay() < house.planted+3 || house.produce>=9],
      ['釣りをする',() => {
        lifeChange(() => { house.fished=townDay(); house.fish=Math.min(9,house.fish+1); });
        houseRoom(house,room);
      },house.fished === townDay() || house.fish>=9]
    );
  }
  if (room === '台所') choices.unshift(['家族の料理',() => houseMeal(house)]);
  if (room === '浴室') choices.unshift(['湯に浸かる',() => {
    lifeChange(() => { player.fatigue=0; player.hp=maxHP(); }); houseRoom(house,room);
  }]);
  if (room === '子供部屋' || room === 'ソソの遊び場') {
    choices.unshift(...family.children.map(child => [child.name+'と話す',() => childMenu(child)]));
  }
  lifePanel(room,[lines[room]],choices,'21');
  familyPicture(familyPeople(),'house',chapterOf(player.x),house);
}

function houseMeal(house) {
  lifePanel('家族の食卓',['今日は何を作ろう。'],[
    ...[['畑の野菜スープ','produce'],['釣った魚の塩焼き','fish']].map(([dish,key]) => [dish,() => {
      if (!house[key]) return;
      lifeChange(() => {
        house[key]--; player.hp=maxHP();
        family.children.forEach(child => raiseChild(child,child.age ? 'お手伝い' : 'ミルク',2));
        familyLog('家族で'+dish+'を食べた。');
      });
      audio.play('holy');
      lifePanel(dish,['温かい湯気を囲んで、今日いちばん楽しかったことを話した。'],[['自宅へ戻る',housingMenu]],'20');
      familyPicture(familyPeople(),'house',chapterOf(player.x),house);
    },!house[key]]),['戻る',housingMenu]
  ],'20');
}

function familySeedForParent(parent) {
  const tag = familyAdults[parent].preference;
  return tag === 'meal' ? 4 : 7;
}

function familyPicture(people, style, region = chapterOf(player.x), house = null) {
  const canvas = document.createElement('canvas');
  canvas.width=480; canvas.height=180; canvas.className='family-picture';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',people.map(person => person.name).join('、')+'の記念画');
  const g = canvas.getContext('2d');
  const night = style === 'night';
  const wall = house?.styles.壁紙 ?? 0, floor = house?.styles.床 ?? 0;
  const wallColor=night ? '#25263d' : house ? ['#d6a978','#dcb1a6','#8f83a4'][wall] : '#abcac9';
  const ground=night ? '#36354d' : house ? ['#936b55','#a57365','#68648a'][floor] : prefectures[region].color;
  const sky=g.createLinearGradient(0,0,0,124);
  sky.addColorStop(0,night ? '#15162b' : house ? '#6b4e72' : '#68859e');
  sky.addColorStop(1,wallColor);
  g.fillStyle=sky; g.fillRect(0,0,480,180);
  g.fillStyle=ground; g.fillRect(0,124,480,56);
  if (house || night) {
    const window=g.createLinearGradient(0,24,0,109);
    window.addColorStop(0,night ? '#17233e' : '#7ea5bf');
    window.addColorStop(1,night ? '#39496a' : '#d3c9b1');
    g.fillStyle='#43344c';g.fillRect(322,19,107,96);
    g.fillStyle=window;g.fillRect(328,25,95,84);
    g.fillStyle=night ? '#eee0ae' : '#f7deb1';
    g.beginPath();g.arc(396,44,9,0,6.283);g.fill();
    g.fillStyle=night ? '#25364f' : '#688d86';
    g.beginPath();g.moveTo(328,105);g.lineTo(348,67);g.lineTo(378,94);g.lineTo(399,74);g.lineTo(423,100);
    g.lineTo(423,109);g.lineTo(328,109);g.closePath();g.fill();
    g.fillStyle='#664e5d';g.fillRect(373,25,4,84);g.fillRect(328,65,95,4);g.fillRect(318,111,115,5);
  }
  if (house) {
    g.strokeStyle='#39293430';
    for (let stripe=130;stripe<180;stripe+=13) {
      g.beginPath();g.moveTo(0,stripe);g.lineTo(480,stripe);g.stroke();
    }
    g.fillStyle=['#77503c','#b46e76','#675e92'][house.styles.家具];
    g.fillRect(17,101,114,6);g.fillRect(20,105,108,18);
    g.fillRect(27,123,7,26);g.fillRect(115,123,7,26);
    g.fillStyle='#d7bc9a';g.fillRect(29,110,90,2);
    g.fillStyle=['#ffe4a3','#ffd2d1','#d3d6fd'][house.styles.照明];
    g.fillRect(213,13,54,16);
    g.fillStyle='#614c69';g.fillRect(237,0,5,12);
    g.fillStyle='#ede3ca';g.fillRect(234,29,11,4);
  }
  for (let i=0;i<12;i++) {
    g.fillStyle = night ? '#6e6788' : style === 'wedding' ? '#ffe2ae' : '#f4dec5';
    g.fillRect((i*73+region*9)%480,14+(i*39)%80,style === 'wedding' ? 7 : 3,3);
  }
  const gap = Math.min(71,440/(people.length || 1));
  people.forEach((person,i) => {
    const x=240+(i-(people.length-1)/2)*gap;
    const seed=person.seed || 0, adult=person.age>=18;
    const scale=Math.min(adult ? 1.1 : .48+person.age*.027,gap/34);
    g.save(); g.translate(x,132); g.scale(scale,scale);
    if (person.name === 'ソソ') {
      g.fillStyle=night ? '#242032' : '#988087';
      g.fillRect(-16,-12,32,12); g.fillRect(-13,-23,19,16);
      g.fillRect(-14,-28,6,9); g.fillRect(1,-28,6,9);
      g.fillStyle='#f4cb78'; g.fillRect(-10,-17,4,2); g.fillRect(0,-17,4,2);
    } else {
      const skin=['#edc198','#ce986f','#f0cbb0'][seed%3];
      const hair=['#493035','#3c303c','#645063','#715249'][seed%4];
      g.fillStyle=night ? '#211e2f' : ['#765f96','#688891','#b76672','#58816f'][seed%4];
      g.fillRect(-15,-36,30,28);
      if (person.pregnancy) g.fillRect(8,-27,person.pregnancy*4,19);
      g.fillStyle=night ? '#211e2f' : skin;
      g.fillRect(-11,-61,22,24); g.fillRect(-20,-33,7,16); g.fillRect(13,-33,7,16);
      g.fillStyle=night ? '#211e2f' : hair;
      g.fillRect(-13,-65,26,10); g.fillRect(-13,-56,5,person.age%2 ? 14 : 7);
      g.fillRect(8,-56,5,seed%2 ? 18 : 9);
      g.fillRect(-12,-8,9,8); g.fillRect(3,-8,9,8);
      g.fillRect(-7,-50,3,3); g.fillRect(4,-50,3,3);
      if (style === 'wedding') { g.fillStyle='#ffe7af'; g.fillRect(-6,-42,12,4); }
    }
    g.restore();
    if (gap>35) {
      g.fillStyle=night ? '#f1d8b4' : '#282038';
      g.font='12px sans-serif'; g.textAlign='center';
      g.fillText(person.name,x,155,gap);
    }
  });
  $('panel-body').prepend(canvas);
  return canvas;
}
