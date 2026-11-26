// The route runs between two rows of buildings, leaving the main trail and shrines clear.
const townTypes = {
  weapon: ['武器屋', '鍛冶見習い', 9, 19, '#a55f53', '武'],
  armor: ['防具屋', '仕立屋', 10, 20, '#697da1', '防'],
  items: ['道具屋', '薬草商', 8, 21, '#69905b', '薬'],
  inn: ['宿屋', '宿の女将', 0, 24, '#b17b57', '宿'],
  tavern: ['酒場', '酒場の主人', 17, 3, '#8d597f', '酒'],
  bank: ['銀行', '窓口係', 9, 17, '#648b92', '銀'],
  store: ['コンビニ', '夜番の店員', 0, 24, '#578d79', '便'],
  food: ['飲食店', '料理人', 11, 22, '#bb7550', '食'],
  church: ['教会', '司祭', 7, 19, '#9696be', '祈'],
  library: ['図書館', '司書', 9, 18, '#858573', '書'],
  bath: ['温泉', '湯守', 6, 23, '#697caa', '湯'],
  smith: ['鍛冶屋', '鍛冶師', 7, 18, '#845d57', '槌'],
  home: ['民家', '家主', 6, 22, '#a38463', '家'],
  casino: ['カジノ', '遊技係', 18, 5, '#9a526a', '遊'],
  ruin: ['廃墟', '遺跡の番人', 6, 20, '#777687', '跡'],
  hall: ['役所', '受付係', 8, 17, '#908d65', '役'],
  regional: ['隠しダンジョン', '守り石', 0, 24, '#666791', '洞'],
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
  const kinds = [...services, ...extra, 'secret'];
  const sites = kinds.map((kind, i) => ({
    id: chapter + '-' + kind, chapter, kind, x: base + (kind === 'secret' ? 188 : i < services.length ? [55,100,156,42,121][i] : 235 + (i - services.length) * 47),
    row: i < 3 ? 56 : 153, upper: i < 3, ...(kind === 'secret' ? {seal:{solved:false}} : {})
  }));
  return {name, style, product, meal, resident, chapter, sites};
});

const townSites = new Map(towns.flatMap(town => town.sites.map(site => [site.id, site])));
for (const [id] of prefectures.entries()) {
  townSites.set('regional-' + id, {id:'regional-' + id, chapter:id, kind:'regional', x:id * span + 335, row:126});
}
const bankLimit = 99999999999;
let townSeconds = 9 * 150;
let townBank = 0;
let townInterestDay = 0;
let townQuests = {};
let townVisits = {};
let interior = null;
let doorContact = null;

const townDay = () => Math.floor(townSeconds / 3600);
const townHour = () => (townSeconds % 3600) / 150;
const townNight = () => townHour() >= 19 || townHour() < 5;

function townTime() {
  const minutes = Math.floor(townHour() * 60);
  return '第' + (townDay() + 1) + '日 ' + String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' + String(minutes % 60).padStart(2, '0');
}

function siteAvailability(site) {
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
  doorContact = towns[chapterOf(player.x)].sites.find(entry => closeTo(entry.x, entry.row, 6));
}

function tickTown(dt) {
  townSeconds += dt;
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
  return {x:home + center + Math.sin(townSeconds * (.52 + index * .09) + index) * swing,
    y:(daytime ? [83,135,114][index] : [131,60,148][index]) + Math.sin(townSeconds * .41 + index) * 5,
    activity, face:Math.cos(townSeconds * (.52 + index * .09) + index)};
}

function townResident(town) { return commuter(town); }

function buildingBlocks(x, y) {
  return towns[chapterOf(x)].sites.some(site => Math.abs(site.x - x) < 19 &&
    (site.upper ? y > 32 && y < 51 : y > 159 && y < 175));
}

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

function checkTownDoor() {
  const nearby = towns[chapterOf(player.x)].sites.find(site =>
    (site.kind !== 'secret' || townQuests[site.chapter] > 0) && closeTo(site.x, site.row, 6));
  if (nearby === doorContact) return false;
  doorContact = nearby;
  if (!nearby) return false;
  destination = null;
  const [name, , start, end] = townTypes[nearby.kind];
  const closed = siteAvailability(nearby);
  panel(name + 'の入口', [
    towns[nearby.chapter].name + '　' + townTime(),
    end === 24 ? '24時間営業' : '営業時間 ' + start + ':00〜' + (end < start ? '翌' : '') + end + ':00',
    closed || '中に入りますか？'
  ], closed ? [['戻る', resume]] : [
    ['入る', () => {
      if (siteAvailability(nearby)) return resume();
      interior = {site:nearby, x:320, y:272};
      townVisits[nearby.id] = (townVisits[nearby.id] || 0) + 1;
      resetJump();
      resume();
      audio.setTrack(nearby.kind === 'inn' ? 'innEntry' : 'town' + nearby.chapter);
      save();
    }], ['入らない', resume]
  ]);
  return true;
}

function exitRoom() {
  const {site} = interior;
  interior = null;
  player.x = site.x;
  player.y = site.row;
  doorContact = site;
  fieldSafeUntil = clock + 1;
  enterField();
  save();
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

function townInteraction() {
  if (paused || battle || mode !== 'field') return;
  if (interior) {
    if (interior.y >= 267 && Math.abs(interior.x - 320) < 47) {
      panel('出口', ['外へ出ますか？'], [['外に出る', exitRoom], ['室内に戻る', resume]]);
    } else if (Math.hypot(interior.x - 320, interior.y - 100) <= 66) servicePanel();
    return;
  }
  const fixture = nearbyFixture();
  if (fixture) return useFixture(fixture);
  if (nearScenicSpot()) return tourPanel();
  const town = towns[chapterOf(player.x)];
  const resident = townResident(town);
  if (closeTo(resident.x, resident.y, 23)) residentTalk(town);
  else {
    // Allow another try after declining without requiring another movement.
    doorContact = null;
    checkTownDoor();
  }
}

function townActionLabel() {
  if (paused || battle || mode !== 'field') return '';
  if (interior) {
    if (interior.y >= 267 && Math.abs(interior.x - 320) < 47) return '出口';
    if (Math.hypot(interior.x - 320, interior.y - 100) <= 66) return '話す';
    return '';
  }
  const fixture = nearbyFixture();
  if (fixture) return fixture.kind === 'bench' ? 'ベンチ' : '自販機';
  if (nearScenicSpot()) return '観光案内';
  const town = towns[chapterOf(player.x)];
  const resident = townResident(town);
  if (closeTo(resident.x, resident.y, 23)) return '住民と話す';
  return doorContact ? '入口' : '';
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
  const companion = currentCompanion();
  if (!companion) return;
  const event = towns[site.chapter].name + 'の' + townTypes[site.kind][0] + 'で過ごした';
  const modifier = companion.name === 'クルミ' && site.kind === 'bath' ? -1 :
    companion.name === '恵美ちゃん' && site.kind === 'inn' ? 4 : 2;
  const response = companion.affinity >= 15 ? '「また一緒に来ようね」' : modifier < 0 ?
    '「羽がぬれるから、私は縁側で待ってるね」' : '「旅の途中でひと息つけてよかった」';
  if (!companion.history.includes(event)) {
    remember(companion, event);
    companion.affinity = clamp(companion.affinity + modifier, -100, 100);
  }
  save();
  panel('仲間とのひととき', [event + '。', companion.name + ' ' + response], [['戻る', servicePanel]]);
}

function servicePanel(note = '') {
  if (!interior) return;
  const {site} = interior;
  if (site.kind === 'regional') return dungeonPanel();
  if (site.kind === 'inn') audio.setTrack('innDesk');
  const town = towns[site.chapter];
  const [name, keeper] = townTypes[site.kind];
  const services = [['室内を歩く', resume]];
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
      lines.push('品揃え　' + equipment[type].map(entry => entry.name).join('、'));
      if (item) buy(item.name + 'を装備', item.cost, () => { player[type] = step; trialGear[type] = null; regionalGear[type] = null; });
      else lines.push('現在の装備より上位の品は売り切れです。');
      break;
    }
    case 'items':
    case 'store':
      lines.push(site.kind === 'store' ? '深夜も営業。薬草は通常の約1.6倍です。' : '旅に必要な薬草を取り扱っています。');
      buy('薬草 ×1', site.kind === 'store' ? 8 : 5, () => { player.herbs++; });
      if (site.kind === 'store') buy('特製弁当を食べる（HP +28）', 13, () => heal(28));
      break;
    case 'inn': {
      const lodging = innProfile(site.chapter);
      lines.push(lodging.name + '・' + lodging.style + '　24時間営業。',
        lodging.modest ? '手ごろな価格で回復。' : lodging.cure ? '全回復し、足止めを解除。' :
        lodging.blessing ? '全回復し、ゲーム内の翌朝まで攻撃力上昇。' :
        lodging.special ? '全回復。眺めのよい客室で特別な会話を楽しめます。' : '宿泊するとHP・MPが全快。');
      services.push(['宿泊する　' + lodging.price + 'G', beginStay, player.gold < lodging.price]);
      break;
    }
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
      buy('入浴する（HP +24・MP +8）', 8, () => {
        heal(24); player.mp = Math.min(maxMP(), player.mp + 8);
        rememberRegionalBath(site.chapter);
      });
      break;
    case 'tavern':
      services.push(['同行者について相談', tavern]);
      buy('香草茶を飲む（MP +6）', 4, () => { player.mp = Math.min(maxMP(), player.mp + 6); });
      break;
    case 'bank':
      services.push(['口座を利用する', bankPanel]);
      break;
    case 'church':
      buy('祈りを捧げる（HP +45）', 6, () => heal(45));
      break;
    case 'library': {
      const shrine = shrines[site.chapter];
      services.push(['章の記録を読む', () => servicePanel(chapters[site.chapter][0])]);
      services.push(['封印の手がかりを探す', () => {
        servicePanel(shrine.solved ? 'この章の封印は解除済みです。' : shrineQuestion(shrine, site.chapter).hint);
        save();
      }]);
      break;
    }
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
          servicePanel('宝箱から' + (35 + site.chapter * 7) + 'Gと星の欠片2個を見つけた。');
        },
        later:servicePanel
      }), site.seal.solved]);
      break;
  }
  if (currentCompanion() && ['inn','food','bath','tavern'].includes(site.kind)) {
    services.push(['仲間と過ごす', () => shareTownEvent(site)]);
  }
  panel(name + '　' + town.name, lines, services);
}
