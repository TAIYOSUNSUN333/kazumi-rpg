const stoneRewardTypes = ['gold', 'xp', 'herb', 'armor', 'spell', 'vitals', 'chest', 'buff', 'recover'];
const waysideStones = [];
const stonesByChapter = prefectures.map((region, chapter) => {
  const historyStone = shrines[chapter];
  Object.assign(historyStone, {id: chapter + '-trail', chapter, name: '星路の石碑'});
  const localStone = {
    id: chapter + '-local', chapter, x: chapter * span + 642, row: chapter % 2 ? 131 : 78,
    name: region.name + 'の旅碑', questionId: 'local-' + chapter
  };
  return [historyStone, localStone].map((stone, index) => {
    const tier = chapter < 4 ? 0 : chapter < 8 ? 1 : 2;
    const amount = (tier + 1) * (index + 1);
    const kind = stoneRewardTypes[(chapter * 2 + index) % stoneRewardTypes.length];
    const reward = {kind, amount};
    if (kind === 'armor') {
      reward.gear = {name: region.specialty + 'の碑守衣', bonus: 7 + amount * 3 + Math.floor(chapter / 5)};
    }
    if (kind === 'chest') reward.chest = {x:stone.x + 30, row:stone.row};
    stone.reward = reward;
    waysideStones.push(stone);
    return stone;
  });
});
const stonesById = new Map(waysideStones.map(stone => [stone.id, stone]));
const stoneSpell = {name:'月雫の癒し', mp:6};
let stoneArmor = null;
let stoneBuffUntil = 0;
let stoneMaxHP = 0;
let stoneMaxMP = 0;
let stoneMagicLearned = false;

function stoneSnapshot() {
  return {
    progress: Object.fromEntries(waysideStones.filter(stone => stone.seen || stone.solved).map(stone => [
      stone.id, [stone.questionId ?? null, stone.wrong ?? 0, !!stone.solved, !!stone.rewarded, !!stone.claimed]
    ])),
    armor: stoneArmor, buffUntil: stoneBuffUntil
  };
}

function loadStones(data) {
  stoneBuffUntil = numeric(data.stones?.buffUntil, 0, 0, 360003600);
  stoneMaxHP = stoneMaxMP = 0;
  stoneMagicLearned = false;
  for (const stone of waysideStones) {
    const legacy = stone === shrines[stone.chapter];
    const old = legacy ? data.riddleProgress?.[stone.chapter] : undefined;
    const state = data.stones?.progress?.[stone.id];
    stone.solved = state?.[2] === true || legacy && data.shrines?.[stone.chapter] === true;
    stone.rewarded = stone.solved && state?.[3] === true;
    stone.claimed = stone.rewarded && state?.[4] === true;
    stone.seen = !!state || !!old?.[0] || stone.solved;
    const id = state?.[0] ?? old?.[0];
    if (riddlesById.has(id)) stone.questionId = id;
    stone.wrong = numeric(state?.[1] ?? old?.[1], 0, 0, 999);
    if (stone.rewarded) applyStoneUnlock(stone);
  }
  stoneArmor = unlockedStoneArmor(data.stones?.armor) ? data.stones.armor : null;
}

function unlockedStoneArmor(id) {
  const stone = stonesById.get(id);
  return stone?.rewarded ? stone.reward.gear : null;
}

function applyStoneUnlock(stone, heal = false) {
  const {kind, amount} = stone.reward;
  if (kind === 'spell') stoneMagicLearned = true;
  if (kind === 'vitals') {
    stoneMaxHP += 2 * amount;
    stoneMaxMP += amount;
    if (heal) {
      player.hp += 2 * amount;
      player.mp += amount;
    }
  }
}

function stoneRewardLabel(stone) {
  const {kind, amount, gear} = stone.reward;
  return {
    gold: (amount * 18) + 'G', xp: '経験値 +' + amount * 16, herb: '薬草 ×' + amount,
    armor: gear?.name, spell: stoneSpell.name + 'の魔法、薬草 ×' + amount,
    vitals: '最大HP +' + amount * 2 + '、最大MP +' + amount, chest: '近くに宝箱が現れる',
    buff: '攻撃・防御強化（ゲーム内' + amount + '時間）', recover: '一行のHP・MP全回復、' + amount * 5 + 'G'
  }[kind];
}

function grantStoneReward(stone) {
  if (stone.rewarded) return;
  stone.rewarded = true;
  applyStoneUnlock(stone, true);
  const {kind, amount} = stone.reward;
  if (kind === 'gold') player.gold = Math.min(bankLimit, player.gold + amount * 18);
  if (kind === 'xp') {
    const previous = level();
    player.xp = Math.min(1000000, player.xp + amount * 16);
    awardCompanion(amount * 16);
    if (level() > previous) {
      player.hp = maxHP();
      player.mp = maxMP();
      levelUntil = clock + 2;
    }
  }
  if (kind === 'herb' || kind === 'spell') player.herbs = Math.min(10000, player.herbs + amount);
  if (kind === 'buff') stoneBuffUntil = Math.max(stoneBuffUntil, townSeconds + amount * 150);
  if (kind === 'recover') {
    player.hp = maxHP();
    player.mp = maxMP();
    const member = currentCompanion();
    if (member) {
      member.hp = companionHP(member);
      member.mp = companionMP(member);
    }
    player.gold = Math.min(bankLimit, player.gold + amount * 5);
  }
  sealEffect = {x:stone.x, y:stone.row, until:clock + .9};
  addNumber(stoneRewardLabel(stone), stone.x, stone.row - 27, '#ffe7a1', true);
  audio.play('stoneReward');
  say('正解！ ' + stoneRewardLabel(stone), 5);
}

function nearbyStoneInteraction() {
  const stone = stonesByChapter[chapterOf(player.x)].find(stone =>
    closeTo(stone.x, stone.row, 54) || stone.reward.chest && stone.rewarded && !stone.claimed &&
    closeTo(stone.reward.chest.x, stone.reward.chest.row, 54));
  if (!stone) return null;
  const chest = stone.reward.chest;
  if (chest && stone.rewarded && !stone.claimed && closeTo(chest.x, chest.row, 22)) {
    return {run:() => claimStoneChest(stone)};
  }
  return closeTo(stone.x, stone.row, 54) ? {run:() => inspectStone(stone)} : null;
}

function inspectStone(stone) {
  destination = null;
  stone.seen = true;
  save();
  const note = stone === shrines[stone.chapter] ? chapters[stone.chapter][1] : prefectures[stone.chapter].town + 'に伝わる旅のクイズ。';
  const lines = [note];
  if (stone.solved) lines.push('正解済み');
  else lines.push('報酬　' + stoneRewardLabel(stone));
  panel(stone.name, lines, stone.solved ? [['閉じる', resume]] : [
    ['クイズに挑戦する', () => openShrine(stone, stone.chapter)], ['あとで解く', resume]
  ]);
}

function claimStoneChest(stone) {
  if (!stone.rewarded || stone.claimed) return;
  stone.claimed = true;
  const gold = stone.reward.amount * 22;
  player.gold = Math.min(bankLimit, player.gold + gold);
  player.herbs = Math.min(10000, player.herbs + 1);
  audio.play('stoneReward');
  say('宝箱から ' + gold + 'G と薬草を獲得した。');
  save();
}

function stoneJournal() {
  const seen = waysideStones.filter(stone => stone.seen).length;
  const solved = waysideStones.filter(stone => stone.solved).length;
  const lines = ['発見 ' + seen + '/' + waysideStones.length + '　正解 ' + solved + '/' + waysideStones.length];
  for (const [chapter, stones] of stonesByChapter.entries()) {
    if (!stones.some(stone => stone.seen)) continue;
    lines.push(prefectures[chapter].name + '　' +
      stones.map(stone => stone.name + ' ' + (stone.solved ? '正解' : stone.seen ? '発見' : '未発見')).join(' / '));
  }
  panel('石碑手帳', lines, [['戻る', openMenu]]);
}
