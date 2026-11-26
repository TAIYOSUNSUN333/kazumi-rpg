let tourBook = [];
let regionalGear = {weapon:null, armor:null};
let nationalPrize = false;
const monsterDex = new Set();

function tourismFor(chapter) {
  return tourBook[chapter] ??= {visited:false, dish:false, photo:null, fished:0, gathered:0, cooked:false,
    festival:false, dungeon:false, boss:false, medal:false, bath:false, weapon:false, armor:false};
}

function tourismSnapshot() {
  return {regions:tourBook, gear:regionalGear, prize:nationalPrize, monsters:[...monsterDex]};
}

function loadTourism(data) {
  tourBook = [];
  const savedRegions = Array.isArray(data?.regions) ? data.regions : [];
  for (const [index, saved] of savedRegions.slice(0, prefectures.length).entries()) {
    if (!saved) continue;
    const entry = tourismFor(index);
    for (const key of ['visited','dish','cooked','festival','dungeon','boss','medal','bath','weapon','armor']) {
      entry[key] = saved[key] === true;
    }
    entry.fished = numeric(saved.fished, 0, 0, 9999);
    entry.gathered = numeric(saved.gathered, 0, 0, 9999);
    if (saved.photo && typeof saved.photo.partner === 'string') {
      entry.photo = {partner:saved.photo.partner.slice(0, 60), night:saved.photo.night === true};
    }
  }
  for (const type of ['weapon','armor']) {
    const id = data?.gear?.[type];
    regionalGear[type] = Number.isInteger(id) && tourBook[id]?.[type] ? id : null;
  }
  nationalPrize = data?.prize === true;
  monsterDex.clear();
  if (Array.isArray(data?.monsters)) {
    for (const name of data.monsters.slice(0, 2000)) if (typeof name === 'string') monsterDex.add(name);
  }
}

function noteVisit(chapter) {
  const entry = tourismFor(chapter);
  if (entry.visited) return;
  entry.visited = true;
  save();
}

function regionalInnTalk(chapter) {
  const member = currentCompanion();
  if (!member) return '';
  const key = prefectures[chapter].name + 'で宿泊';
  if (!member.history.includes(key)) {
    remember(member, key);
    member.affinity = Math.min(100, member.affinity + 2);
  }
  return member.name + '「明日は' + prefectures[chapter].sight + 'へ寄ってみようよ」';
}

function rememberRegionalBath(chapter) {
  const entry = tourismFor(chapter);
  if (entry.bath) return;
  entry.bath = true;
  const member = currentCompanion();
  if (member) {
    remember(member, prefectures[chapter].name + 'の湯で休んだ');
    member.affinity = Math.min(100, member.affinity + (member.name === 'クルミ' ? 1 : 3));
  }
}

const localMilestones = entry => [
  entry?.visited, entry?.photo, entry?.dish, entry?.cooked, entry?.festival, entry?.dungeon,
  entry?.boss, entry?.weapon, entry?.armor, entry?.medal
];
const percent = entry => localMilestones(entry).filter(Boolean).length * 10;
const medalReady = entry => entry.photo && entry.dish && (entry.cooked || entry.festival);
const scenicSpot = chapter => ({x:chapter * span + 335, y:126});
function nearScenicSpot() {
  const spot = scenicSpot(chapterOf(player.x));
  return !interior && closeTo(spot.x, spot.y, 38);
}

function localFestivalOpen(chapter) {
  const season = Math.floor(townDay() / 30) % 4;
  const day = townDay() % 30;
  return (season === chapter % 4 && day % 5 === 0 || day === chapter % 30) && townHour() >= 9 && townHour() < 20;
}

function tourChange(action, next = tourPanel) {
  action();
  save();
  next();
}

function tourPanel(note = '') {
  const chapter = chapterOf(player.x);
  const region = prefectures[chapter];
  const entry = tourismFor(chapter);
  const funded = player.gold >= 9;
  const festival = localFestivalOpen(chapter);
  const actions = [
    ['戻る', resume],
    ['全国手帳', travelBook],
    ['記念撮影', () => tourChange(() => {
      entry.photo = {partner:[currentCompanion()?.name, joined ? 'ソソ' : null].filter(Boolean).join('・') || '一美', night:townNight()};
    }, () => photoPanel(chapter, tourPanel)), Boolean(entry.photo)],
    ['釣りをする', () => tourChange(() => { entry.fished++; }, () => tourPanel(region.terrain === 'coast' ? '浜で魚が釣れた。' : '水辺で魚が釣れた。')), entry.fished >= 9999],
    [region.specialty + 'を採集', () => tourChange(() => { entry.gathered++; }), entry.gathered >= 9999],
    [region.dish + 'を食べる　9G', () => townDish(9), !funded],
    [region.dish + 'を作る', () => tourChange(() => {
      entry.fished--; entry.gathered--; entry.cooked = true;
      eatLocalDish(entry);
    }), !entry.fished || !entry.gathered],
    ['温泉で休む　7G', () => {
      trade(7, () => {
        player.hp = Math.min(maxHP(), player.hp + 30);
        player.mp = Math.min(maxMP(), player.mp + 7);
        rememberRegionalBath(chapter);
      }, () => tourPanel('湯につかって旅の疲れを癒やした。'));
    }, player.gold < 7],
    [region.festival + 'に参加', () => tourChange(() => {
      entry.festival = true;
      player.shards++;
    }, () => tourPanel('灯りを飾り、旅の記念に星の欠片を受け取った。')), !festival || entry.festival],
    ['次の祭りの日まで待つ', () => tourChange(() => {
      const start = townSeconds;
      for (let day = 0; day < 31; day++) {
        const next = (Math.floor(start / 3600) + day) * 3600 + 9 * 150;
        if (next <= start) continue;
        townSeconds = next;
        if (localFestivalOpen(chapter)) {
          tickTown(0);
          return;
        }
      }
      townSeconds = start;
    }), festival || entry.festival],
    ['ご当地メダルを受け取る', () => tourChange(() => { entry.medal = true; }), !medalReady(entry) || entry.medal],
    ['限定装備を買う・使う', regionalShop],
    [region.dungeon + 'へ', () => {
      interior = {site:townSites.get('regional-' + chapter), x:320, y:274};
      entry.dungeon = true;
      resetJump();
      resume();
      audio.setTrack('dungeon');
      save();
    }, !entry.photo]
  ];
  const festivalText = festival ? '開催中' : '第' + (chapter % 30 + 1) + '日または' +
    ['春','夏','秋','冬'][chapter % 4] + 'の5日おき、9〜20時';
  panel(region.name + '　' + region.sight, [
    '名物 ' + region.specialty + '　郷土料理 ' + region.dish, '達成率 ' + percent(entry) + '%　釣果 ' + entry.fished + '　採集 ' + entry.gathered,
    region.festival + '　' + festivalText, 'メダルの条件：記念撮影・郷土料理・料理作りか祭りへの参加。',
    typeof note === 'string' ? note : ''
  ], actions);
}

function eatLocalDish(entry) {
  entry.dish = true;
  player.hp = Math.min(maxHP(), player.hp + 26);
  player.mp = Math.min(maxMP(), player.mp + 5);
}
function townDish(cost) {
  trade(cost, () => eatLocalDish(tourismFor(chapterOf(player.x))), tourPanel);
}

function regionalShop() {
  const chapter = chapterOf(player.x);
  const region = prefectures[chapter];
  const entry = tourismFor(chapter);
  const buttons = [['戻る', tourPanel]];
  for (const type of ['weapon','armor']) {
    const item = region[type];
    const price = (type === 'weapon' ? 32 : 27) + chapter * 3;
    const equip = () => {
      regionalGear[type] = chapter;
      if (type === 'weapon') slashBase = null;
      trialGear[type] = null;
    };
    if (entry[type]) buttons.push([item.name + 'を装備', () => tourChange(equip, regionalShop), regionalGear[type] === chapter]);
    else buttons.push([item.name + 'を購入　' + price + 'G', () => trade(price, () => {
      entry[type] = true;
      equip();
    }, regionalShop), player.gold < price]);
  }
  panel(region.name + 'の装備', ['所持金 ' + player.gold + 'G',
    region.weapon.name + '　攻撃 +' + region.weapon.bonus + '　射程 ' + region.weapon.reach,
    region.armor.name + '　防御 +' + region.armor.bonus], buttons);
}

function travelBook() {
  const visited = tourBook.filter(entry => entry?.visited).length;
  const medals = tourBook.filter(entry => entry?.medal).length;
  const complete = tourBook.filter(entry => percent(entry) === 100).length;
  panel('全国旅の手帳', [
    '踏破 ' + visited + '/47（' + Math.floor(visited / 47 * 100) + '%）　メダル ' + medals + '/47',
    '完全達成 ' + complete + '/47'
  ], [
    ['戻る', openMenu], ['地域別の達成率・移動', () => travelList(0)], ['郷土料理図鑑', () => tourDex('dish')],
    ['装備図鑑', () => tourDex('gear')], ['モンスター図鑑', () => tourDex('monsters')],
    ['思い出アルバム', () => albumPanel()], ['全国完全制覇の報酬', () => tourChange(() => {
      nationalPrize = true;
      player.gold = Math.min(bankLimit, player.gold + 4700);
      player.shards += 47;
    }, () => panel('称号「全国を結ぶ旅人」', ['特別報酬 4,700G、星の欠片47個。'], [['手帳へ', travelBook]])),
    complete !== 47 || nationalPrize]
  ]);
}

function tourismUnlocked(chapter) {
  return Boolean(done || returning || tourBook[chapter]?.visited ||
    chapter > 0 && tourBook[chapter - 1]?.visited && activeEnemies(chapter - 1).at(-1).hp === 0);
}

function travelList(page) {
  const perPage = 8;
  const start = page * perPage;
  const buttons = prefectures.slice(start, start + perPage).map((region, i) => {
    const id = start + i;
    const entry = tourBook[id];
    const unlocked = tourismUnlocked(id);
    return [region.name + ' ' + percent(entry) + '%', () => panel(region.name + '　' + region.town,
      ['観光 ' + region.sight + '　名物 ' + region.dish, '達成率 ' + percent(entry) + '%'],
      [['移動する', () => travelTo(id), !unlocked], ['一覧へ戻る', () => travelList(page)]])];
  });
  if (page) buttons.push(['前へ', () => travelList(page - 1)]);
  if (start + perPage < 47) buttons.push(['次へ', () => travelList(page + 1)]);
  buttons.push(['手帳へ', travelBook]);
  panel('地域別の達成率・移動', ['現在地 ' + prefectures[chapterOf(player.x)].name + '。訪問済み・道を開いた地域へ移動できます。'], buttons);
}

function travelTo(chapter) {
  if (!camps[chapter] || !tourismUnlocked(chapter)) return;
  interior = null;
  destination = null;
  doorContact = null;
  player.x = camps[chapter].x;
  player.y = 104;
  fieldSafeUntil = clock + 1.5;
  noteVisit(chapter);
  enterField();
  save();
}

function tourDex(kind, page = 0) {
  const entries = kind === 'monsters' ? [...monsterDex] : prefectures.flatMap((region, i) => {
    const entry = tourBook[i];
    return kind === 'dish' ? [region.name + '　' + (entry?.dish ? region.dish : '未登録')] : [
      region.name + '　武器 ' + (entry?.weapon ? region.weapon.name : '未発見') + '／防具 ' + (entry?.armor ? region.armor.name : '未発見')
    ];
  });
  const chunk = entries.slice(page * 8, (page + 1) * 8);
  const buttons = [['手帳へ', travelBook]];
  if (page) buttons.push(['前へ', () => tourDex(kind, page - 1)]);
  if (entries.length > (page + 1) * 8) buttons.push(['次へ', () => tourDex(kind, page + 1)]);
  panel({monsters:'モンスター図鑑', dish:'郷土料理図鑑', gear:'装備図鑑'}[kind],
    chunk.length ? chunk : ['まだ登録がありません。'], buttons);
}

function albumPanel(page = 0) {
  const photos = tourBook.flatMap((entry, i) => entry?.photo ? [i] : []);
  const buttons = photos.slice(page * 6, (page + 1) * 6).map(id =>
    [prefectures[id].sight, () => photoPanel(id, () => albumPanel(page))]);
  if (page) buttons.push(['前へ', () => albumPanel(page - 1)]);
  if (photos.length > (page + 1) * 6) buttons.push(['次へ', () => albumPanel(page + 1)]);
  buttons.push(['手帳へ', travelBook]);
  panel('思い出アルバム', ['記念写真 ' + photos.length + '/47'], buttons);
}

function photoPanel(id, back) {
  const region = prefectures[id];
  const photo = tourBook[id].photo;
  panel(region.sight + 'の記念写真', [region.name + '　' + photo.partner], [['戻る', back]]);
  const image = document.createElement('canvas');
  image.width = 360;
  image.height = 156;
  image.setAttribute('aria-label', region.sight + 'での' + photo.partner + 'との記念写真');
  image.className = 'postcard';
  const g = image.getContext('2d');
  const assetIds = [landscapeImage(id), 'landmark-' + landmarkFor(region), 'actors', 'soso'];
  function draw() {
    g.fillStyle = photo.night ? '#242d49' : '#9ed1d7';
    g.fillRect(0, 0, 360, 156);
    const [scenery, sight, actors, catAtlas] = assetIds.map(picture);
    if (scenery) coverArt(g, scenery, 0, 0, 360, 156);
    if (photo.night) {
      g.fillStyle = '#181d446b';
      g.fillRect(0, 0, 360, 156);
    }
    if (sight) g.drawImage(sight, 24, 44, 100, 100);
    const group = ['一美', ...photo.partner.split('・').filter(name => name !== '一美')];
    g.imageSmoothingEnabled = false;
    for (const [i, name] of group.entries()) {
      const x = 148 + i * 36;
      if (name === 'ソソ' && catAtlas) g.drawImage(catAtlas, 0, 0, 64, 64, x, 107, 44, 44);
      else if (actors) g.drawImage(actors, 7 * 64, actorRow(name) * 64, 64, 64, x, 81, 60, 60);
    }
    g.imageSmoothingEnabled = true;
  }
  draw();
  for (const asset of assetIds) {
    const pending = artwork.get(asset);
    if (!pending.complete) pending.addEventListener('load', draw, {once:true});
  }
  $('panel-body').append(image);
}

function dungeonPanel() {
  const id = chapterOf(player.x);
  const region = prefectures[id], entry = tourismFor(id);
  if (!entry.dungeon) {
    entry.dungeon = true;
    save();
  }
  const description = {
    coast:'潮が引くとだけ見える海食洞。奥で波の音が反響する。',
    forest:'木の根を避けながら進むと、苔むした石段が下へ続く。',
    river:'水門の奥は水路が入り組んでいる。石段を伝って足場を渡る。',
    water:'湖畔の裂け目から、水面の下をくぐる古い回廊へ入った。',
    sand:'風下の砂紋に沿って、石積みの階段が地下へ降りている。',
    snow:'足元を確かめながら、雪に覆われた迷宮の灯をたどる。',
    mountain:'岩稜の風を避け、岩壁に切られた細い段を下りた。'
  }[region.terrain];
  panel(region.dungeon, [description, entry.boss ? region.guardian + 'を討伐済み。' : '奥にいるのは' + region.guardian + '。'], [
    ['洞窟を歩く', resume], ['隠しボスに挑む', () => startRegionalBoss(id), entry.boss]
  ]);
}

function startRegionalBoss(id) {
  const region = prefectures[id];
  interior = null;
  trialVitals = {hp:player.hp, mp:player.mp, herbs:player.herbs, remaining:Math.max(0, specialAt - clock)};
  player.hp = maxHP();
  player.mp = maxMP();
  specialAt = clock;
  const max = joined ? 22000 + id * 950 : 180 + id * 36;
  const patterns = {forest:['slow','bite'],coast:['wave','rush'],mountain:['slow','rush'],
    river:['rush','bite','wave'],water:['wave','slow'],sand:['rush','rush','slow'],snow:['slow','wave','bite']};
  encounter({name:region.guardian, hiddenRegion:id, boss:true, chapter:id, hp:max, max,
    power:19 + Math.floor(id * .55), interval:1.26, speed:47 + id % 6 * 5, range:32,
    color:region.color, variant:id % 4, pattern:patterns[region.terrain], flash:0}, false);
  resume();
}
