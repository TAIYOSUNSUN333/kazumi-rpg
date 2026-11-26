const canvas = $('scene');
const ctx = canvas.getContext('2d');
const palettes = [
  ['#486352', '#ce89a3'], ['#263f4a', '#638690'], ['#315670', '#80a6b9'],
  ['#373449', '#9d8ac8'], ['#565567', '#a0a9bf'], ['#504451', '#ba875e'],
  ['#3c5553', '#87a78e'], ['#815c50', '#d39970'], ['#425d80', '#b9d5dc'],
  ['#342f4b', '#ac9fc9'], ['#605b83', '#d5b9da'], ['#3e294d', '#b268a0']
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}
function diamond(x, y, w, h, color) {
  polygon([[x - w, y], [x, y - h], [x + w, y], [x, y + h]], color);
}
function label(text, x, y, color = '#fff1df', size = 13) {
  ctx.font = 'bold ' + size + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#21162d';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
function hero(x, y, scale, face) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (face < 0 ? -1 : 1), scale);
  const blink = clock < flashUntil && !reducedMotion.matches;
  rect(-11, 1, 22, 4, '#252236');
  rect(-8, -20, 16, 15, blink ? '#fbd0d2' : '#cd6494');
  rect(-9, -32, 17, 13, '#472c49');
  rect(-5, -29, 12, 11, '#f4ccac');
  rect(3, -26, 2, 3, '#492f45');
  rect(-10, -19, 5, 9, '#e897b4');
  rect(-7, -5, 5, 8, '#63394b');
  rect(3, -5, 5, 8, '#63394b');
  if (rescued) {
    rect(-5, -16, 10, 7, '#e8d0b1');
    rect(-5, -19, 3, 3, '#e8d0b1');
    rect(2, -19, 3, 3, '#e8d0b1');
    rect(2, -15, 1, 2, '#543950');
  }
  ctx.restore();
}
function monster(enemy, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const color = clock < enemy.flash && !reducedMotion.matches ? '#ffe9d7' : enemy.color;
  rect(-14, 0, 28, 4, '#242031');
  polygon([[-14, 0], [-15, -13], [-20, -31], [-6, -24], [0, -30], [6, -24], [20, -31], [15, -13], [14, 0]], '#422944');
  polygon([[-12, -2], [-14, -17], [-9, -23], [9, -23], [14, -17], [12, -2]], color);
  rect(-8, -16, 5, 3, '#382841');
  rect(3, -16, 5, 3, '#382841');
  if (enemy.boss) polygon([[-11, -28], [-13, -39], [-5, -34], [0, -42], [5, -34], [13, -39], [11, -28]], '#ffd280');
  ctx.restore();
}

function drawHome() {
  rect(0, 0, 640, 360, '#24213a');
  for (let i = 0; i < 44; i++) {
    diamond((i * 131 + 16) % 640, (i * 29 + 19) % 232, i % 3 + 1, i % 3 + 1, '#f5cb9a');
  }
  polygon([[0, 254], [130, 149], [239, 221], [380, 121], [640, 237], [640, 360], [0, 360]], '#34374b');
  rect(0, 266, 640, 94, '#46574d');
  rect(402, 187, 117, 88, '#745360');
  polygon([[384, 191], [461, 113], [538, 191]], '#a0687b');
  rect(446, 218, 29, 57, '#3a2d45');
  rect(483, 210, 19, 19, '#ffdc91');
  hero(405, 278, 1.5, 1);
}
function drawField(chapter, camera) {
  const [ground, leaf] = palettes[chapter];
  rect(0, 0, 640, 360, ground);
  rect(0, 172, 640, 54, '#aca07d');
  rect(0, 178, 640, 42, '#bdac89');
  for (let i = Math.floor(camera / 48); i < (camera + 660) / 48; i++) {
    const x = i * 48 - camera;
    rect(x, 184 + i % 4 * 8, 12, 2, '#98866e');
    for (const y of [105 + i % 3 * 5, 280 + i % 2 * 11]) {
      rect(x + 12, y + 14, 7, 17, '#574056');
      rect(x + 3, y + 4, 24, 15, leaf);
      rect(x + 7, y, 16, 8, leaf);
    }
    diamond(x + 15, 145 + i % 3 * 38, 2, 2, '#e4cf9c');
  }
  for (const gem of gems) {
    if (gem.on && Math.abs(gem.x - player.x) < 640) diamond(gem.x - camera, gem.row + 89, 6, 9, '#ffe5a0');
  }
  for (const npc of npcs) {
    if (npc.visited || Math.abs(npc.x - player.x) > 640) continue;
    hero(npc.x - camera, 200, .75, 1);
    label(npc.name, npc.x - camera, 166);
  }
  for (const shrine of shrines) {
    if (Math.abs(shrine.x - player.x) > 640) continue;
    const x = shrine.x - camera, y = shrine.row + 92;
    rect(x - 12, y - 20, 24, 25, '#4b375c');
    diamond(x, y - 10, 7, 10, shrine.solved ? '#efcd84' : '#9d7897');
  }
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !unlocked(enemy)) continue;
    const x = enemy.x - camera, y = enemy.y + 96;
    monster(enemy, x, y, enemy.boss ? 1.05 : .65);
    rect(x - 12, y - 31, 24, 3, '#35203a');
    rect(x - 12, y - 31, 24 * enemy.hp / enemy.max, 3, '#ff8d8d');
  }
  const x = player.x - camera, y = player.y + 96;
  hero(x, y, .9, player.facing.x);
  if (clock < swingUntil) {
    const {x: dx, y: dy} = player.facing;
    polygon([[x, y - 9], [x + dx * 31 - dy * 10, y - 9 + dy * 31 + dx * 10],
      [x + dx * 26 + dy * 11, y - 9 + dy * 26 - dx * 11]], '#fff1be');
  }
}

function drawBattle() {
  const {enemy, heroX, enemyX, strike, damageFlash} = battle;
  const boss = enemy.boss;
  rect(0, 0, 640, 360, boss ? '#301f3e' : '#252f45');
  polygon([[0, 0], [225, 122], [415, 122], [640, 0]], '#433450');
  polygon([[0, 360], [0, 262], [220, 207], [420, 207], [640, 262], [640, 360]], '#554057');
  for (const x of [38, 94, 159, 481, 546, 602]) {
    rect(x, 64, 7, 161, '#725169');
    rect(x - 5, 218, 17, 5, '#a67c84');
  }
  rect(0, 242, 640, 4, '#987388');
  if (strike) {
    const width = strike.wave ? 640 : strike.range;
    const x = strike.wave ? 0 : enemyX + (strike.direction < 0 ? -width : 0);
    rect(x, 237, width, 6, '#e78181');
    label(strike.label, enemyX, 151, '#ffc0ab', 18);
  }
  const offset = clock < damageFlash && !reducedMotion.matches ? Math.sign(heroX - enemyX) * 10 : 0;
  monster(enemy, enemyX + offset, 244, boss ? 1.85 : 1.4);
  hero(heroX, 244, 1.4, player.facing.x);
  if (clock < swingUntil) {
    const dx = player.facing.x;
    polygon([[heroX, 219], [heroX + dx * 46, 196], [heroX + dx * 42, 218], [heroX + dx * 21, 233]], '#fff2b9');
  }
}

function render() {
  const chapter = chapterOf(player.x);
  const camera = clamp(player.x - 245, -85, limit - 515);
  if (mode === 'title' || mode === 'home') drawHome();
  else if (battle) drawBattle();
  else drawField(chapter, camera);
  if (clock < burstUntil && !reducedMotion.matches) {
    const x = battle ? battle.heroX : player.x - camera;
    const y = battle ? 215 : player.y + 86;
    ctx.globalAlpha = Math.min(.8, (burstUntil - clock) * 2);
    ctx.strokeStyle = '#ffe4a4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (1 - (burstUntil - clock) / .55) * 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const number of numbers) {
    if (number.field !== !battle) continue;
    const y = number.y + (number.field ? 96 : 0) - (1 - (number.expires - clock) / .7) * 24;
    label(number.text, number.x - (number.field ? camera : 0), y, number.color, 19);
  }
}

let previousFrame = null;
let lastUI = 0;
function frame(timestamp) {
  const elapsed = previousFrame === null ? 0 : Math.min((timestamp - previousFrame) / 1000, .05);
  previousFrame = timestamp;
  if (!document.hidden) update(elapsed);
  render();
  if (timestamp - lastUI > 55) {
    updateUI();
    lastUI = timestamp;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
