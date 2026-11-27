// The route runs between two rows of buildings, leaving the main trail and shrines clear.
const townTypes = {
  weapon: ['武器屋', '鍛冶見習い', 9, 19, '#a55f53', '武'],
  armor: ['防具屋', '仕立屋', 10, 20, '#697da1', '防'],
  clinic: ['病院', '診療係', 7, 22, '#8b9f90', '診'],
  pharmacy: ['薬屋', '薬師', 8, 20, '#588f72', '薬'],
  shrine: ['神社', '宮司', 6, 20, '#a36659', '社'],
  visitor: ['観光案内所', '案内係', 8, 20, '#56859e', '旅'],
  station: ['駅', '駅員', 7, 22, '#818c9d', '駅'],
  restaurant: ['レストラン', '給仕', 11, 23, '#bd8065', '食'],
  items: ['道具屋', '薬草商', 8, 21, '#69905b', '薬'],
  inn: ['宿屋', '宿の女将', 0, 24, '#b17b57', '宿'],
  tavern: ['酒場', '酒場の主人', 17, 3, '#8d597f', '酒'],
  bank: ['銀行', '窓口係', 9, 17, '#648b92', '銀'],
  store: ['コンビニ', '夜番の店員', 0, 24, '#578d79', '便'],
  food: ['飲食店', '料理人', 11, 22, '#bb7550', '食'],
  church: ['教会', '司祭', 7, 19, '#9696be', '祈'],
  library: ['図書館', '司書', 9, 18, '#858573', '書'],
  bath: ['温泉', '湯守', 6, 23, '#697caa', '湯'],
  magic: ['魔法屋', '魔術具商', 10, 20, '#7473a1', '魔'],
  smith: ['鍛冶屋', '鍛冶師', 7, 18, '#845d57', '槌'],
  home: ['民家', '家主', 6, 22, '#a38463', '家'],
  casino: ['カジノ', '遊技係', 18, 5, '#9a526a', '遊'],
  ruin: ['廃墟', '遺跡の番人', 6, 20, '#777687', '跡'],
  hall: ['役所', '受付係', 8, 17, '#908d65', '役'],
  regional: ['隠しダンジョン', '守り石', 0, 24, '#666791', '洞'],
  trailroom: ['灯の抜け道', '道しるべ', 0, 24, '#656789', '灯'],
  secret: ['地下の宝庫', '記録係', 0, 24, '#636985', '鍵']
};

const towns = [
  ['桜並木の村', '瓦屋根', '桜蜜', '桜蜜のおやき', 'ミナ', ['weapon','inn','bank','store','tavern']],
  ['鈴守りの集落', '木組み', '森の胡桃', '胡桃がゆ', 'リネ', ['armor','tavern','library','home']],
  ['星浜港', '白壁', '潮干し魚', '魚の香草焼き', 'トウマ', ['items','food','casino','hall']],
  ['鏡鉱の街', '石積み', '鏡石', '坑夫の煮込み', 'バルド', ['smith','bath','church','ruin']],
  ['風車の里', '木組み', '風麦', '風麦パン', 'アニカ', ['items','inn','food','home']],
  ['鐘の工房街', 'レンガ', '精巧な歯車', '時計砂糖のタルト', 'ヨル', ['weapon','smith','library','bank']],
  ['霧渡の村', '杭上げ', '沼の香草', '香草の蒸し魚', 'セナ', ['tavern','church','bath','store']],
  ['砂灯のオアシス', '土壁', '甘い干し果実', '干し果実の蒸しパン', 'サミラ', ['armor','food','casino','ruin']],
  ['氷鏡宿場', '急勾配', '氷蓮', '氷蓮の温い汁', 'ユキネ', ['inn','items','bath','hall']],
  ['星図台の街', '石積み', '星図紙', '星形の焼き菓子', 'ルチア', ['library','bank','smith','home']],
  ['朝雲の集落', '杭上げ', '雲豆', '雲豆の煮込み', 'ナギ', ['weapon','church','food','store']],
  ['終鐘の門前町', 'レンガ', '鐘銀', '鐘銀通りの包み焼き', 'ヴィオラ', ['tavern','inn','hall','ruin']]
].concat(prefectures.slice(12).map((region, index) => [
  region.town, {forest:'木組み',coast:'白壁',mountain:'石積み',water:'杭上げ',sand:'土壁',snow:'急勾配',river:'レンガ'}[region.terrain],
  region.specialty, region.dish, region.companion + 'の親戚',
  [['inn','food','bath','items'], ['tavern','inn','food','bank'], ['bath','food','inn','smith']][index % 3]
])).map(([name, style, product, meal, resident, services], chapter) => {
  const base = chapter * span;
  const extra = ['inn','food','bath'].filter(kind => !services.includes(kind));
  if ([0,8,17,26,32,46].includes(chapter)) extra.push('magic');
  extra.push(['station','pharmacy','clinic','shrine','visitor','restaurant'][chapter%6]);
  if (!services.includes('weapon') && !services.includes('armor') && !extra.includes('visitor')) extra.push('visitor');
  const kinds = [...services,...extra,'secret'];
  const sites = kinds.map((kind,i) => ({
    id:chapter + '-' + kind, chapter, kind, x:base + 49 + i*37 + (chapter*11 + i*3)%6,
    row:59 + (i%2)*8, upper:true,
    width:kind === 'inn' ? 23 : kind === 'home' ? 16 : 17+(chapter+i*2)%5,
    height:kind === 'inn' ? 49 : kind === 'home' ? 33 : 36+(chapter*3+i*5)%13,
    ...(kind === 'secret' ? {seal:{solved:false}} : {})
  }));
  if (!sites.some(site => site.kind === 'clinic')) {
    sites.splice(sites.length-1,0,{id:chapter+'-clinic',chapter,kind:'clinic',x:base+315,
      row:150,upper:false,width:19,height:39});
  }
  return {name, style, product, meal, resident, chapter, sites};
});

const townSites = new Map(towns.flatMap(town => town.sites.map(site => [site.id, site])));
for (const [id] of prefectures.entries()) {
  townSites.set('regional-' + id, {id:'regional-' + id, chapter:id, kind:'regional', x:id * span + 375, row:169, upper:false});
}
const bankLimit = 99999999999;
let townSeconds = 9 * 150;
let townBank = 0;
let townInterestDay = 0;
let townQuests = {};
let townVisits = {};
let interior = null;
let doorContact = null;
let doorTransition = null;
let exitDoorLock = null;
let doorGestureConsumed = false;
let counterContact = false;
let facilityGathering = null;
let placeCaptionUntil = 0;
let lastPlace = null;

const townDay = () => Math.floor(townSeconds / 3600);
const townHour = () => (townSeconds % 3600) / 150;
const townNight = () => townHour() >= 19 || townHour() < 5;

function townTime() {
  const minutes = Math.floor(townHour() * 60);
  return '第' + (townDay() + 1) + '日 ' + String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' + String(minutes % 60).padStart(2, '0');
}

function siteAvailability(site) {
  if (interior?.site === site) return '';
  const [, , start, end] = townTypes[site.kind];
  if (end === 24) return '';
  if (!['home','ruin','church'].includes(site.kind)) {
    if ((townDay() + site.chapter) % 7 === 6) return '本日は定休日。';
    if (townDay() > 0 && (townDay() + site.chapter * 3 + start) % 19 === 0) return '本日は臨時休業。';
  }
  const hour = townHour();
  const open = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  return open ? '' : '営業時間外（' + start + ':00〜' + (end < start ? '翌' : '') + end + ':00）。';
}

function townSnapshot() {
  return {seconds:townSeconds, bank:townBank, interestDay:townInterestDay, quests:townQuests, visits:townVisits,
    room:interior && {id:interior.site.id, x:interior.x, y:interior.y},
    seals:towns.map(town => {
      const seal = town.sites.at(-1).seal;
      return [seal.solved, seal.questionId ?? null, seal.wrong ?? 0];
    })};
}

function loadTowns(data) {
  townSeconds = numeric(data?.seconds, 1350, 0, 360000000);
  townBank = numeric(data?.bank, 0, 0, bankLimit);
  townInterestDay = numeric(data?.interestDay, townDay(), 0, townDay());
  townQuests = {};
  townVisits = {};
  for (const town of towns) {
    const n = town.chapter;
    townQuests[n] = numeric(data?.quests?.[n], 0, 0, 2);
    for (const site of town.sites) {
      townVisits[site.id] = numeric(data?.visits?.[site.id], 0, 0, 999999);
    }
    const seal = town.sites.at(-1).seal;
    const progress = data?.seals?.[n];
    seal.solved = progress?.[0] === true;
    seal.questionId = riddlesById.has(progress?.[1]) ? progress[1] : undefined;
    seal.wrong = numeric(progress?.[2], 0, 0, 999);
  }
  const site = townSites.get(data?.room?.id);
  if (site && site.chapter === chapterOf(player.x)) {
    interior = {site, x:numeric(data.room.x, 320, 52, 588), y:numeric(data.room.y, 276, 80, 303)};
  }
  doorContact = null;
  exitDoorLock = entranceNearHero();
}

function tickTown(dt) {
  townSeconds += dt;
  tickFamily();
  const periods = Math.floor((townDay() - townInterestDay) / 30);
  if (periods <= 0) return;
  townInterestDay += periods * 30;
  for (let i = 0; i < periods; i++) townBank = Math.min(bankLimit, townBank + Math.floor(townBank / 1000));
}

function commuter(town, index = 0) {
  const hour = townHour(), home = town.chapter * span;
  const coastal = ['coast','river','water'].includes(prefectures[town.chapter].terrain);
  const daytime = hour >= 7 && hour < 18;
  const activity = !daytime ? '帰宅' : hour < 10 ? '買い物' : index === 1 ? (coastal ? '漁の支度' : '畑仕事') : '散策';
  const center = daytime ? [128,191,237][index] : [95,53,149][index];
  const swing = daytime ? 27 + index * 6 : 15;
  return {x:home + center + Math.sin(clock * (.52 + index * .09) + index) * swing,
    y:(daytime ? [83,135,114][index] : [131,60,148][index]) + Math.sin(clock * .41 + index) * 5,
    activity, face:Math.cos(clock * (.52 + index * .09) + index)};
}

function townResident(town) { return commuter(town); }

function roomFurniture(kind) {
  if (kind === 'regional') {
    const terrain = prefectures[interior.site.chapter].terrain;
    return ({
      forest: [{x:103,y:141,w:112,h:42},{x:429,y:175,w:80,h:51}],
      coast: [{x:90,y:110,w:131,h:59},{x:402,y:164,w:132,h:31}],
      mountain: [{x:140,y:127,w:90,h:63},{x:451,y:119,w:68,h:78}],
      water: [{x:92,y:194,w:135,h:35},{x:411,y:132,w:115,h:60}],
      sand: [{x:105,y:107,w:103,h:85},{x:397,y:181,w:121,h:40}],
      snow: [{x:124,y:165,w:107,h:51},{x:424,y:120,w:97,h:75}],
      river: [{x:88,y:136,w:140,h:46},{x:400,y:182,w:143,h:43}]
    })[terrain];
  }
  const right = ['home','inn','bath','food','tavern','casino'].includes(kind);
  return [{x:100, y:119, w:112, h:39}, {x: right ? 426 : 455, y:174, w: right ? 99 : 67, h:44}];
}

function moveInRoom(dx, dy, distance) {
  const size = Math.hypot(dx, dy);
  if (!size) return;
  const x = clamp(interior.x + dx * distance / size, 52, 588);
  const y = clamp(interior.y + dy * distance / size, 80, 303);
  const clear = (px, py) => !roomFurniture(interior.site.kind).some(r =>
    px > r.x - 7 && px < r.x + r.w + 7 && py > r.y - 6 && py < r.y + r.h + 6);
  if (clear(x, interior.y)) interior.x = x;
  if (clear(interior.x, y)) interior.y = y;
  player.facing = {x:dx / size, y:dy / size};
}

function withinDoor(site, extra = 0) {
  return Math.abs(site.x - player.x) <= 24 + extra && Math.abs(site.row - player.y) <= 17 + extra;
}

function entranceNearHero(contact = false) {
  if (interior || battle || jumpHeight > 8) return null;
  const chapter = chapterOf(player.x);
  const sites = towns[chapter].sites;
  const candidates = [...sites];
  if (tourBook[chapter]?.photo) candidates.push(townSites.get('regional-' + chapter));
  const refuge = stagePaths[chapter].refuge;
  if (refuge && activatedRunes.has(chapter)) candidates.push(refuge);
  return candidates.reduce((nearest, site) => {
    if (site.kind === 'secret' && !(townQuests[site.chapter] > 0)) return nearest;
    if (contact) {
      const delta = (player.y - site.row) * (site.upper ? 1 : -1);
      if (Math.abs(site.x - player.x) > 21 || delta < -5 || delta > 8) return nearest;
    } else if (!withinDoor(site)) return nearest;
    return !nearest || Math.hypot(site.x - player.x,site.row - player.y) <
      Math.hypot(nearest.x - player.x,nearest.row - player.y) ? site : nearest;
  }, null);
}

function updateDoorLatch() {
  if (exitDoorLock && !withinDoor(exitDoorLock,5)) exitDoorLock = null;
  doorContact = entranceNearHero();
}

function interactGesture(y,ladder) {
  if (y > -.32) doorGestureConsumed = false;
  if (battle || y > -.62 || doorGestureConsumed || ladder) return false;
  if (interior) return false;
  // Up at an entrance is movement. Other points accept a short look-up gesture.
  if (entranceNearHero(true)) return false;
  const action = nearbyFieldAction();
  if (!action) return false;
  doorGestureConsumed = true;
  destination = null;
  action.run();
  return true;
}

function checkZoneContact(manual) {
  if (battle || !manual || !movementAllowed() || (jumpHeight > 8 && !interior)) return false;
  if (interior) {
    if (interior.y >= 293 && Math.abs(interior.x - 320) < 61) return exitRoom();
    if (interior.y > 153 || Math.abs(interior.x - 320) >= 61) counterContact = false;
    if (!counterContact && interior.y <= 132 && Math.abs(interior.x - 320) < 55) {
      counterContact = true;
      servicePanel();
      return true;
    }
    return false;
  }
  const site = entranceNearHero(true);
  if (!site || site === exitDoorLock || nearbyLadder() && Math.abs(site.x - player.x) > 11) return false;
  return enterTownDoor(site);
}

function enterTownDoor(site) {
  if (!site || !movementAllowed() || !withinDoor(site) || interior || battle) return false;
  destination = null;
  const [name,,start,end] = townTypes[site.kind];
  const closed = siteAvailability(site);
  if (closed) {
    exitDoorLock = site;
    showPlaceTitle(name + ' ― ' + closed + ' ' + start + ':00〜' + (end < start ? '翌' : '') + end + ':00');
    return false;
  }
  clearInput();
  doorContact = site;
  doorTransition = {site,start:clock,end:clock + (artMotion.matches ? 0 : .32),exit:false};
  audio.play('door');
  return true;
}

function exitRoom() {
  if (!interior || doorTransition) return false;
  clearInput();
  doorTransition = {site:interior.site,start:clock,end:clock + (artMotion.matches ? 0 : .24),exit:true};
  audio.play('door');
  return true;
}

function advanceTownDoor() {
  if (clock < doorTransition.end) return;
  const {site,exit} = doorTransition;
  doorTransition = null;
  player.x = site.x;
  player.y = site.row;
  resetJump();
  if (exit) {
    interior = null;
    exitDoorLock = site;
    fieldSafeUntil = clock + 1;
    enterField();
  } else {
    interior = {site,x:320,y:266};
    counterContact = false;
    townVisits[site.id] = (townVisits[site.id] || 0) + 1;
    if (site.kind === 'regional') tourismFor(site.chapter).dungeon = true;
    setFieldTrack();
  }
  save();
}

function showPlaceTitle(text) {
  const banner = $('place-title');
  for (const animation of banner.getAnimations()) animation.cancel();
  banner.textContent = text;
  banner.hidden = false;
  placeCaptionUntil = performance.now() + 3200;
  if (!artMotion.matches) banner.animate([{opacity:0,offset:0},{opacity:1,offset:.11},
    {opacity:1,offset:.77},{opacity:0,offset:1}],{duration:3200,fill:'both'});
}

function updatePlaceTitle() {
  if (performance.now() >= placeCaptionUntil) $('place-title').hidden = true;
  if (mode !== 'field') {
    lastPlace = null;
    $('place-title').hidden = true;
    return;
  }
  if (doorTransition) return;
  const chapter = chapterOf(player.x);
  const region = prefectures[chapter], town = towns[chapter];
  let key, text;
  if (innScene && innScene.stage >= 1) {
    key = innScene.site.id + '-room';
    text = '宿屋2階 ― 客室';
  } else if (interior) {
    const site = interior.site;
    key = site.id;
    text = site.kind === 'regional' ? prefectures[site.chapter].dungeon :
      site.kind === 'inn' ? '宿屋 ― ' + innProfile(site.chapter).name :
      townTypes[site.kind][0] + ' ― ' + town.name;
  } else {
    const district = player.x - chapter * span < 355;
    key = chapter + '-' + (district ? 'district':'field');
    text = region.name + ' ― ' + (district ? town.name : chapterInfo[chapter][0]);
  }
  if (key !== lastPlace) {
    lastPlace = key;
    showPlaceTitle(text);
  }
}

function residentTalk(town) {
  const stage = townQuests[town.chapter] || 0;
  const request = 1 + town.chapter % 3;
  const material = town.chapter % 3 === 1 ? 'shards' : 'herbs';
  const item = material === 'shards' ? '星の欠片' : '薬草';
  const purpose = material === 'shards' ? '夜道の灯りの修理に' :
    town.chapter % 3 === 2 ? '船や荷車の救急箱に' : '旅人の手当てに';
  const actions = [['戻る', resume]];
  if (!stage) actions.unshift(['依頼を引き受ける', () => {
    townQuests[town.chapter] = 1;
    save();
    residentTalk(town);
  }]);
  if (stage === 1) actions.unshift([item + 'を渡す', () => {
    if (player[material] < request || townQuests[town.chapter] !== 1) return;
    player[material] -= request;
    player.gold += 12 + town.chapter * 3;
    townQuests[town.chapter] = 2;
    save();
    residentTalk(town);
  }, player[material] < request]);
  const chapterCleared = activeEnemies(town.chapter).at(-1).hp === 0;
  const greeting = chapterCleared ? 'あなたが章の守り手を倒してから、夜道を歩けるようになった。' :
    townNight() ? '日が落ちると、みんな窓に灯りをともすよ。' : town.product + 'を見かけたら、この町のものだよ。';
  panel(town.resident + '（' + town.name + '）', [
    greeting,
    stage === 2 ? item + 'をありがとう。裏路地の地下扉はいつでも使えるよ。' :
      purpose + item + 'を' + request + '個ほしい。引き受けてくれたら、裏路地の地下扉を教えるよ。'
  ], actions);
}

function reachableGem(radius = 24) {
  const offset = chapterOf(player.x) * 4;
  return gems.slice(offset,offset + 4).find(gem => gem.on && closeTo(gem.x,gem.row,radius));
}

function collectGem(gem) {
  if (!gem.on) return;
  gem.on = false;
  player.shards++;
  player.mp = Math.min(maxMP(), player.mp + 6);
  say('星の欠片を拾った。MPが回復した。');
  save();
}

function roomCounterReady() {
  return Boolean(interior && Math.hypot(interior.x - 320,interior.y - 100) <= 80);
}

function shopCounterReady() {
  return roomCounterReady() && ['weapon','armor','items','store','food','smith','magic','pharmacy'].includes(interior.site.kind) &&
    !siteAvailability(interior.site);
}

function openShopSell() {
  if (!shopCounterReady()) return;
  const sell = count => {
    if (count <= 0 || count > player.herbs || player.gold + count * 2 > bankLimit) return;
    player.herbs -= count;
    player.gold += count * 2;
    save();
    show();
  };
  function show() {
    const batch = Math.min(5,player.herbs,Math.floor((bankLimit-player.gold)/2));
    panel('売る',['薬草　1個2G','所持：薬草 ' + player.herbs + '個　' + player.gold + 'G'],[
      ['薬草を1個売る', () => sell(1), batch < 1],
      ['薬草を' + batch + '個まとめて売る', () => sell(batch), batch < 2],
      ['戻る',servicePanel]
    ]);
  }
  show();
}

function nearbyFieldAction() {
  const gem = reachableGem();
  if (gem) return {label:'拾う', run:() => collectGem(gem)};
  const fixture = nearbyFixture();
  if (fixture) return {label:'調べる', run:() => useFixture(fixture)};
  if (nearScenicSpot()) return {label:'調べる', run:tourPanel};
  const town = towns[chapterOf(player.x)];
  const resident = townResident(town);
  if (closeTo(resident.x,resident.y,27)) return {label:'話す', run:() => residentTalk(town)};
  const npc = npcs.find(person => !player.party.includes(person.name) && closeTo(person.x,104,24));
  if (npc) return {label:'話す', run:() => {
    contactNpc = npc;
    npc.visited = true;
    if (companionProfiles[npc.name]) recruitment(npc);
    else say(npc.name + ' ' + npc.line);
  }};
  return null;
}

function townInteraction() {
  if (!movementAllowed() || battle) return;
  if (interior) {
    if (roomCounterReady()) servicePanel();
    return;
  }
  nearbyFieldAction()?.run();
}

function trade(amount, apply, next = servicePanel) {
  if (player.gold < amount) return;
  player.gold -= amount;
  apply();
  save();
  next();
}

function bankPanel() {
  const move = (amount, deposit) => {
    const value = Math.min(amount, deposit ? player.gold : townBank,
      bankLimit - (deposit ? townBank : player.gold));
    if (value <= 0) return;
    townBank += deposit ? value : -value;
    player.gold += deposit ? -value : value;
    save();
    bankPanel();
  };
  panel('共通口座', ['手持ち ' + player.gold + 'G　預金 ' + townBank + 'G',
    '入出金は無料。普通預金は30日ごとに0.1%（1G未満切り捨て）。'], [
    ['10G預ける', () => move(10, true), !player.gold || townBank === bankLimit],
    ['全額預ける', () => move(player.gold, true), !player.gold || townBank === bankLimit],
    ['10G引き出す', () => move(10, false), !townBank || player.gold >= bankLimit],
    ['全額引き出す', () => move(townBank, false), !townBank || player.gold >= bankLimit],
    ['窓口へ戻る', servicePanel]
  ]);
}

function shareTownEvent(site) {
  const guests = facilityGuests();
  if (guests.length < 2) return;
  const place = towns[site.chapter].name;
  const event = place+'の'+townTypes[site.kind][0]+'で過ごした';
  const lines = [];
  for (const guest of guests.slice(1)) {
    if (guest.kind === 'cat') {
      lines.push('ソソは椅子のそばで丸くなった。');
      continue;
    }
    const {member,kind,name} = guest;
    const amount = kind === 'owl' && site.kind === 'bath' ? -1 : guest.fit < 0 ? 1 : 3;
    if (!member.history.includes(event)) {
      remember(member,event);
      member.affinity = clamp(member.affinity+amount,-100,100);
    }
    if (kind === 'monster') lines.push(name+'は' + (member.affinity >= 15 ? '一美の足元でくつろいだ。' : '部屋の匂いを確かめた。'));
    else lines.push(name+'「'+(amount < 0 ? '羽がぬれるから、縁側で待ってるね。' :
      member.affinity >= 15 ? 'また一緒に休みに来よう。' : site.kind === 'food' || site.kind === 'restaurant' ?
        'この町の味を覚えておきたいね。' : '歩き疲れたね。少し話していこう。')+'」');
  }
  audio.setTrack(audio.track,'21');
  facilityGathering = {guests,site,start:performance.now()};
  save();
  panel('仲間とのひととき',lines,[['戻る',servicePanel]]);
}

function servicePanel(note = '') {
  facilityGathering = null;
  if (!interior) return;
  const {site} = interior;
  if (site.kind === 'regional') return dungeonPanel();
  if (site.kind === 'trailroom') {
    const path = stagePaths[site.chapter];
    const claimed = stageClaims.has(site.chapter);
    return panel('灯の抜け道', [claimed ? '宝箱は空になっている。' :
      '古い地下道の奥に、旅人の備蓄が残っている。'], [
      ['宝箱を開ける', () => { claimStageCache(path); servicePanel(); }, claimed], ['戻る',resume]
    ]);
  }
  if (site.kind === 'inn') audio.setTrack('innDesk','16');
  else setFieldTrack();
  const town = towns[site.chapter];
  const [name, keeper] = townTypes[site.kind];
  const services = [['室内を歩く', resume]];
  if (['items','pharmacy','store'].includes(site.kind)) services.push(['生活用品を買う',familyShop]);
  if (site.kind === 'clinic') services.push(['妊娠・出産の相談',maternityClinic]);
  if (shopCounterReady()) services.push(['売る',openShopSell]);
  const closed = siteAvailability(site);
  if (closed) return panel(name + '　' + town.name, [closed, '店を出るには入口へ戻ってください。'], services);
  const welcome = townVisits[site.id] > 1 ? 'また来てくれたんですね' : (townNight() ? '夜の' : '') + town.name + 'へようこそ';
  const lines = [keeper + '「' + welcome + '」',
    townTime() + '　所持金 ' + player.gold + 'G'];
  if (typeof note === 'string' && note) lines.push(note);
  const buy = (label, cost, apply) => services.push([label + '　' + cost + 'G', () => trade(cost, apply), player.gold < cost]);
  const heal = amount => { player.hp = Math.min(maxHP(), player.hp + amount); };
  switch (site.kind) {
    case 'weapon':
    case 'armor': {
      const type = site.kind;
      const step = player[type] + 1;
      const item = equipment[type][step];
      services.push(['限定装備を見る',regionalShop]);
      lines.push('品揃え　' + equipment[type].map(entry => entry.name).join('、'));
      if (item) services.push([item.name + '　' + item.cost + 'G',() =>
        confirmPurchase(site,item.name,item.cost,1,() => {
          player[type] = step;
          if (type === 'armor') armorBase = stoneArmor = null;
          if (type === 'weapon') slashBase = null;
          trialGear[type] = regionalGear[type] = null;
        }),player.gold < item.cost]);
      else lines.push('現在の装備より上位の品は売り切れです。');
      if (type === 'armor' && !shieldOwned) services.push(['木枠の盾　19G',() =>
        confirmPurchase(site,'木枠の盾（防御時の被ダメージを軽減）',19,1,() => {
          shieldOwned = shieldEquipped = true;
        }),player.gold < 19]);
      break;
    }
    case 'pharmacy':
    case 'items':
    case 'store':
      lines.push(site.kind === 'store' ? '深夜も営業。薬草は通常の約1.6倍です。' : '旅に必要な薬草を取り扱っています。');
      services.push(['商品一覧',() => marketStock(site)]);
      if (site.kind === 'store') buy('特製弁当を食べる（HP +28）', 13, () => heal(28));
      break;
    case 'inn': {
      const lodging = innProfile(site.chapter);
      lines.push(lodging.name + '・' + lodging.style + '　24時間営業。',
        lodging.modest ? '手ごろな価格で回復。' : lodging.cure ? '全回復し、足止めを解除。' :
        lodging.blessing ? '全回復し、ゲーム内の翌朝まで攻撃力上昇。' :
        lodging.special ? '全回復。眺めのよい客室で特別な会話を楽しめます。' : '宿泊するとHP・MPが全快。');
      services.push(['宿泊する　' + lodging.price + 'G', beginStay, player.gold < lodging.price]);
      if (availableAdults().some(name => ['dating','married'].includes(relationship(name).stage))) {
        services.push(['二人で過ごす宿泊を選ぶ',romanceAtInn,player.gold < lodging.price]);
      }
      break;
    }
    case 'restaurant':
    case 'food':
      const local = prefectures[site.chapter];
      lines.push('名物は' + local.dish + '。');
      buy(local.dish + 'を食べる（HP +32）', 10 + site.chapter, () => {
        heal(32);
        tourismFor(site.chapter).dish = true;
      });
      if (town.meal !== local.dish) buy(town.meal + 'を食べる（HP +32）', 10 + site.chapter, () => heal(32));
      buy(town.product + 'の旅用弁当（薬草つき）', 15 + site.chapter, () => { heal(26); player.herbs++; });
      break;
    case 'bath':
      services.push(['入浴する　8G',beginBath,player.gold < 8]);
      lines.push('受付でタオルを借り、露天風呂で旅の疲れを癒やせます。');
      break;
    case 'tavern':
      services.push(['同行者について相談', tavern]);
      buy('香草茶を飲む（MP +6）', 4, () => { player.mp = Math.min(maxMP(), player.mp + 6); });
      break;
    case 'bank':
      services.push(['口座を利用する', bankPanel]);
      break;
    case 'clinic':
      buy('一行の手当て',12+site.chapter,() => {
        heal(70);
        footingUntil = clock;
        for (const member of activeCompanions()) member.hp = companionHP(member);
      });
      break;
    case 'shrine':
      buy('旅の安全を祈る（MP回復）',5,() => { player.mp = maxMP(); });
      services.push(['この土地の言い伝え',() => servicePanel(prefectures[site.chapter].festival + 'の灯が旅人を見送ります。')]);
      break;
    case 'visitor':
      services.push(['ご当地装備を扱う売店へ',regionalShop]);
      services.push(['観光案内を聞く',() => servicePanel(prefectures[site.chapter].sight + 'は' + town.product + 'でも知られています。')]);
      break;
    case 'station':
      services.push(['行き先を選ぶ',() => travelList()]);
      break;
    case 'church':
      buy('祈りを捧げる（HP +45）', 6, () => heal(45));
      break;
    case 'library': {
      const shrine = shrines[site.chapter];
      services.push(['章の記録を読む', () => servicePanel(chapters[site.chapter][0])]);
      services.push(['旅の石碑の手がかりを読む', () => {
        shrine.seen = true;
        servicePanel(shrine.solved ? 'この章の星路の石碑には正解済みです。' : shrineQuestion(shrine, site.chapter).hint);
        save();
      }]);
      break;
    }
    case 'magic':
      lines.push('星のかけらで作った魔術具。買った指輪はメニューで魔法枠にセットできます。');
      if (!ring) buy(starterRing.name + 'を購入', starterRing.cost, () => { ring = true; });
      buy('魔力を補う', 5, () => { player.mp = maxMP(); });
      break;
    case 'smith':
      if (!ring) buy(starterRing.name + 'を作る', starterRing.cost, () => { ring = true; });
      buy('装備を手入れしてMPを回復', 7, () => { player.mp = maxMP(); });
      lines.push('道具の手入れと旅の指輪の製作を承ります。');
      break;
    case 'home':
      services.push(['家主の話を聞く', () => residentTalk(town)]);
      services.push(['家の飾りを見る', () => servicePanel('棚には家族の古い写真と、小さな' + town.product + 'の飾りが並ぶ。')]);
      break;
    case 'casino':
      lines.push('ゲーム内の10Gを使う偶奇遊び。当たりは18G、外れは0G。');
      for (const [label, parity] of [['偶数',0], ['奇数',1]]) {
        services.push([label + 'に10G賭ける', () => {
          const result = 1 + Math.floor(Math.random() * 6);
          trade(10, () => { if (result % 2 === parity) player.gold += 18; },
            () => servicePanel('出目は' + result + '。' + (result % 2 === parity ? '18G獲得。' : '外れ。')));
        }, player.gold < 10]);
      }
      break;
    case 'hall':
      services.push(['住民の依頼を確認', () => residentTalk(town)]);
      services.push(['街の案内を読む', () => servicePanel(town.style + 'の建物と、特産品の' + town.product + 'で知られる街です。')]);
      break;
    case 'ruin':
      services.push(['地下通路への記録を読む', () => residentTalk(town)]);
      lines.push('古い案内板に、裏路地を通って地下へ進む道が描かれている。');
      break;
    case 'secret':
      lines.push(site.seal.solved ? '宝箱は空になっている。' : '地下の宝箱は、なぞなぞの封印で閉じられている。');
      services.push(['宝箱の封印を解く', () => openShrine(site.seal, site.chapter, {
        title:'地下の宝箱のなぞなぞ',
        success:() => {
          player.gold = Math.min(bankLimit, player.gold + 35 + site.chapter * 7);
          player.shards += 2;
          const stone = [2,5,8].includes(site.chapter) ? '　魂の契約石も手に入れた。' : '';
          servicePanel('宝箱から' + (35 + site.chapter * 7) + 'Gと星の欠片2個を見つけた。' + stone);
        },
        later:servicePanel
      }), site.seal.solved]);
      break;
  }
  if ((activeCompanions().length || joined) && ['inn','food','restaurant','bath','tavern'].includes(site.kind)) {
    services.push(['仲間と過ごす', () => shareTownEvent(site)]);
  }
  panel(name + '　' + town.name, lines, services);
}
