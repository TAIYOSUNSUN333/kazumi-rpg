const emperorBodies = [
  {size:4.8, radius:37, speed:.80, width:1.32, motion:'charge'},
  {size:3.4, radius:23, speed:1, width:.80, motion:'float'},
  {size:2.9, radius:21, speed:1.25, width:.88, motion:'duel'},
  {size:6.4, radius:49, speed:.68, width:1.46, motion:'stomp'}
];
const ordinaryBodies = [
  {size:.73, radius:10, speed:1.18, width:1.26, motion:'charge'},
  {size:.38, radius:5, speed:1.34, width:1.22, motion:'scuttle'},
  {size:1.12, radius:11, speed:1.05, width:.87, motion:'duel'},
  {size:.66, radius:8, speed:1.18, width:1.05, motion:'float'}
];

function combatBody(enemy) {
  if (enemy.trial !== undefined) return emperorBodies[enemy.trial];
  if (isFinalBoss(enemy) && enemy.chapter === last && finalPhase(enemy) === 3) {
    return {size:10.8, radius:55, speed:.66, width:1.40, motion:'stomp'};
  }
  if (enemy.rank === 'major' || enemy.hiddenRegion !== undefined) return {
    size: isFinalBoss(enemy) ? 5.6 : 3.15 + enemy.chapter % 6 * .42,
    radius: 29 + enemy.chapter % 6 * 2, speed:.84, width:1.0 + enemy.chapter % 3 * .17,
    motion:enemy.chapter % 3 === 1 ? 'duel' : 'stomp'
  };
  if (enemy.rank === 'mid') return {size:2.15 + enemy.chapter % 5 * .36, radius:23 + enemy.chapter % 5 * 2,
    speed:.93, width:1 + enemy.chapter % 3 * .12, motion:enemy.chapter % 2 ? 'charge' : 'stomp'};
  if (enemy.variant === 0 && enemy.optional) return {size:.46, radius:6, speed:1.32, width:1.28, motion:'scuttle'};
  if (enemy.variant === 1 && enemy.slot >= 4) return {size:1.72 + enemy.chapter % 4 * .23, radius:18, speed:.82,
    width:1.43, motion:'stomp'};
  return ordinaryBodies[enemy.variant ?? 0];
}

function directionTo(dx, dy, fallback = {x:1, y:0}) {
  const length = Math.hypot(dx, dy);
  return length > .001 ? {x:dx / length, y:dy / length} : fallback;
}

function chooseArena(enemy) {
  if (enemy.trial !== undefined) return ['volcano','snow','temple','otherworld'][enemy.trial];
  if (enemy.hiddenRegion !== undefined) {
    const terrain = prefectures[enemy.hiddenRegion].terrain;
    return terrain === 'snow' ? 'snow' : terrain === 'mountain' ? 'cave' : 'ruins';
  }
  if (enemy.chapter === last && enemy.rank === 'major') return 'otherworld';
  if (enemy.chapter === originalFinal && enemy.boss) return 'temple';
  if (enemy.chapter === 9 && enemy.boss) return 'ruins';
  const offset = player.x - enemy.chapter * span;
  if (offset < 355) return offset < 205 ? 'market' : 'city';
  const region = prefectures[enemy.chapter];
  if (region.name === '鹿児島県' || region.name === '熊本県' && enemy.boss) return 'volcano';
  if (/城/.test(region.sight) && enemy.boss) return 'castle';
  if (/神宮|寺|大社|天満宮|鳥居/.test(region.sight) && enemy.boss) return 'temple';
  if (region.terrain === 'mountain' && enemy.boss) return 'cave';
  return {forest:'forest', coast:'coast', mountain:'grass', water:'grass', snow:'snow', sand:'coast', river:'grass'}[region.terrain];
}

const battleDepth = depth => 147 + depth * .68;
function createBattle(enemy) {
  return {enemy, body:combatBody(enemy), arena:chooseArena(enemy), age:0};
}

const arenaAttacks = {
  ...attackPatterns,
  rear: {label:'後方なぎ払い',reach:34,lead:.58,extra:4},
  stomp: {label:'地鳴り',reach:56,lead:.70,extra:8}
};
