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
  const armorColors = ['#cd6494', '#ae7869', '#86a9b9', '#a188cc'];
  rect(-8, -20, 16, 15, blink ? '#fbd0d2' : trialGear.armor !== null ? '#745b9f' : armorColors[player.armor]);
  rect(-8, -12, 16, 2, '#efc08f');
  rect(8, -13, 3, 13, player.weapon || trialGear.weapon !== null ? '#d7e8e8' : '#a98062');
  rect(-9, -32, 17, 13, '#472c49');
  rect(-5, -29, 12, 11, '#f4ccac');
  rect(3, -26, 2, 3, '#492f45');
  rect(-10, -19, 5, 9, '#e897b4');
  rect(-7, -5, 5, 8, '#63394b');
  rect(3, -5, 5, 8, '#63394b');
  ctx.restore();
}
function drawCompanion(name, x, y, scale, face, motion = 0, hit = false) {
  const profile = companionProfiles[name];
  if (!profile) return hero(x, y, scale, face);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (face < 0 ? -1 : 1), scale);
  rect(-12, 1, 24, 4, '#2a2635');
  if (name === 'クルミ') {
    polygon([[-12,-4],[-16,-20],[-10,-29],[-6,-21],[5,-21],[10,-29],[15,-17],[12,-4]], profile.hair);
    rect(-10, -17, 23, 14, profile.color);
    rect(-5, -19, 14, 9, profile.skin);
    rect(-3, -17, 3, 4, '#352541');
    rect(5, -17, 3, 4, '#352541');
    diamond(3, -11, 3, 2, '#ffbb74');
  } else {
    const w = profile.width;
    rect(-w, -21, w * 2, 16, hit ? '#ffbab1' : profile.color);
    rect(-w + 2, -10, w * 2 - 4, 3, '#e9c18c');
    rect(-9, -33, 18, name === '恵美ちゃん' ? 22 : 14, profile.hair);
    rect(-5, -28, 12, 10, profile.skin);
    rect(3, -26, 2, 3, '#312642');
    rect(-7, -5, 5, 8 - motion, '#45415a');
    rect(3, -5, 5, 8 + motion, '#45415a');
    if (name === '一郎') rect(7, -20, 4, 15, '#dab988');
    if (name === 'タク') diamond(-8, -28, 4, 5, '#91c37e');
    if (name === '恵美ちゃん') rect(-10, -32, 18, 3, '#accbda');
  }
  ctx.restore();
}

function drawCat(x, y, scale, formIndex = 0) {
  const form = awakening[formIndex];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (formIndex) {
    for (let i = 0; i < formIndex + 1; i++) {
      const angle = Math.PI * 2 * i / (formIndex + 1);
      diamond(Math.cos(angle) * 20, Math.sin(angle) * 15 - 7, 2 + formIndex / 2, 4, form.color);
    }
  }
  polygon([[-14, -6], [-20, -15], [-16, -19], [-9, -10]], form.color);
  rect(-12, -12, 22, 13, form.color);
  if (formIndex >= 2) {
    polygon([[-5,-7],[-25,-25],[-20,-8],[-8,2]], form.color);
  }
  if (formIndex >= 4) {
    polygon([[1,-18],[3,-32],[7,-25],[11,-34],[12,-18]], form.color);
  }
  if (formIndex === 5) {
    ctx.strokeStyle = form.color;
    ctx.beginPath();
    ctx.ellipse(3, -33, 15, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  polygon([[-5, -12], [-4, -23], [1, -17], [8, -17], [12, -23], [13, -8]], form.color);
  rect(1, -13, 2, 3, '#402d4b');
  rect(8, -13, 2, 3, '#402d4b');
  rect(5, -8, 3, 2, '#a95776');
  ctx.restore();
}

function monster(enemy, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const color = clock < enemy.flash && !reducedMotion.matches ? '#ffe9d7' : enemy.color;
  rect(-14, 0, 28, 4, '#242031');
  const variant = enemy.variant ?? enemy.trial;
  const bob = reducedMotion.matches ? 0 : Math.sin(clock * 6 + (enemy.slot ?? 0)) * 2;
  if (variant === 1) {
    polygon([[-19,-3],[-21,-15],[-12,-29],[11,-29],[22,-15],[19,-3]], '#3d3748');
    polygon([[-16,-8],[-14,-19],[-7,-25],[8,-25],[16,-19],[16,-8]], color);
    rect(-14,-14,28,3,'#503745');
    rect(-6,-11,12,3,'#f2bf85');
  } else if (variant === 2) {
    ctx.translate(0, bob - 5);
    diamond(0, -16, 17, 18, '#422944');
    diamond(0, -16, 13, 14, color);
    diamond(0, -16, 5, 7, '#fff0ad');
    diamond(-18, -10, 3, 5, color);
    diamond(18, -21, 3, 5, color);
  } else if (variant === 3) {
    ctx.translate(0, bob);
    polygon([[-17,0],[-19,-12],[-8,-26],[6,-29],[15,-16],[20,0],[10,-5],[5,1],[-2,-5],[-11,1]], color);
    rect(-7,-18,3,4,'#382841');
    rect(4,-18,3,4,'#382841');
  } else {
    polygon([[-14, 0], [-15, -13], [-20, -31], [-6, -24], [0, -30], [6, -24], [20, -31], [15, -13], [14, 0]], '#422944');
    polygon([[-12, -2], [-14, -17], [-9, -23], [9, -23], [14, -17], [12, -2]], color);
    rect(-8, -16, 5, 3, '#382841');
    rect(3, -16, 5, 3, '#382841');
  }
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
  if (joined) drawCat(428, 280, 1.25);
}
function drawField(chapter, camera) {
  const [ground, leaf] = palettes[chapter];
  const light = ctx.createLinearGradient(0, 0, 0, 360);
  light.addColorStop(0, '#253248');
  light.addColorStop(.40, ground);
  light.addColorStop(1, '#1f3443');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 640, 360);
  for (let i = -1; i < 7; i++) {
    const ridge = i * 130 - (camera * .19 % 130);
    polygon([[ridge, 115],[ridge + 59, 36 + (i % 3) * 12],[ridge + 138, 115]], '#354650');
  }
  rect(0, 119, 640, 23, chapter === 2 || chapter === 8 ? '#6b9bb0' : ground);
  if (chapter === 2 || chapter === 8) {
    for (let i = 0; i < 20; i++) rect((i * 79 - camera * .3) % 640, 121 + i * 5 % 18, 19, 1, '#abcbcb');
  }
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
    if (npc.name === player.party[0] || Math.abs(npc.x - player.x) > 640) continue;
    drawCompanion(npc.name, npc.x - camera, 200, .8, 1);
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
  for (const pot of pots) {
    if (Math.abs(pot.x - player.x) > 640) continue;
    const x = pot.x - camera, y = pot.y + 96;
    if (pot.broken) {
      rect(x - 9, y - 1, 5, 3, '#b57758');
      rect(x + 3, y - 3, 5, 4, '#ce9874');
    } else {
      rect(x - 7, y - 11, 14, 11, '#ad634f');
      rect(x - 5, y - 14, 10, 4, '#e2ab81');
      rect(x - 6, y - 7, 12, 2, '#dfa18a');
    }
  }
  const x = player.x - camera, y = player.y + 96 - jumpHeight;
  const member = currentCompanion();
  if (member) drawCompanion(member.name, companionTrail.x - camera, companionTrail.y + 96, .9,
    Math.sign(player.x - companionTrail.x), Math.sin(clock * 15) * 1.8);
  if (joined) drawCat(cat.x - camera, cat.y + 96, .8);
  if (jumpHeight) rect(x - 7, player.y + 98, 14, 3, '#292735');
  if (clock < swingUntil && swingKind === 'afterimage' && !reducedMotion.matches) {
    ctx.globalAlpha = .3;
    hero(x - player.facing.x * 12, y, .9, player.facing.x);
    ctx.globalAlpha = 1;
  }
  hero(x, y, .9, player.facing.x);
  if (clock < swingUntil) {
    const {x: dx, y: dy} = player.facing;
    polygon([[x, y - 9], [x + dx * 31 - dy * 10, y - 9 + dy * 31 + dx * 10],
      [x + dx * 26 + dy * 11, y - 9 + dy * 26 - dx * 11]], swingKind === 'air' ? '#95dfff' : '#fff1be');
  }
}

function drawBattle() {
  const {enemy, heroX, enemyX, strike, damageFlash} = battle;
  const boss = enemy.boss;
  const phase = enemy.rank === 'major' && enemy.chapter === last ? finalPhase(enemy) : 1;
  rect(0, 0, 640, 360, phase === 3 ? '#4c203a' : phase === 2 ? '#362455' : boss ? '#301f3e' : '#252f45');
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
  monster(enemy, enemyX + offset, 244, boss ? 1.55 + phase * .25 : 1.4);
  const heroY = 244 - jumpHeight;
  if (battle.superAwake) {
    ctx.strokeStyle = '#ffd769';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(heroX, heroY - 20, 24, 33, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (jumpHeight) rect(heroX - 10, 245, 20, 3, '#242236');
  if (clock < swingUntil && swingKind === 'afterimage' && !reducedMotion.matches) {
    ctx.globalAlpha = .3;
    hero(heroX - player.facing.x * 15, heroY, 1.4, player.facing.x);
    ctx.globalAlpha = 1;
  }
  hero(heroX, heroY, 1.4, player.facing.x);
  const member = currentCompanion();
  if (member) {
    const x = battle.allyX;
    const visibleAction = battle.allyAction?.until > clock ? battle.allyAction : null;
    const activity = battle.allyDodge > clock ? 8 : 0;
    ctx.globalAlpha = member.hp > 0 ? 1 : .43;
    drawCompanion(member.name, x - activity, 247 + (member.hp ? 0 : 8), 1.2,
      Math.sign(enemyX - x), member.hp ? Math.sin(clock * 11) * 1.3 : 0, battle.allyHit > clock);
    ctx.globalAlpha = 1;
    if (battle.allyGuard > clock) diamond(x + 13, 224, 9, 15, '#98d5e1');
    if (visibleAction?.kind === 'magic') {
      ctx.strokeStyle = '#c3a7ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 223);
      ctx.lineTo(enemyX, 205);
      ctx.stroke();
    } else if (visibleAction?.kind === 'heal') {
      diamond(heroX, 211, 11, 20, '#a6e0b1');
    } else if (visibleAction) {
      const reach = visibleAction.direction * 30;
      polygon([[x,224],[x + reach,205],[x + reach * .65,232]], '#ffe0a0');
    }
  }
  if (joined && cat.hp > 0) drawCat(battle.catX, 247, 1.15 + cat.form * .13, cat.form);
  const effect = battle.catEffect;
  if (effect && effect.until > clock && !reducedMotion.matches) {
    const color = catForm().color;
    if (effect.type === 'strike') {
      const x = enemyX, y = 210;
      const reach = 12 + cat.form * 5;
      polygon([[x - reach,y + 12],[x + reach,y - 24],[x + reach * .5,y - 4],[x - reach * .8,y + 18]], color);
      if (cat.form === 1) {
        polygon([[x - 25,y + 2],[x + 20,y - 20],[x + 7,y - 7],[x - 25,y + 10]], color);
      } else if (cat.form === 2 || cat.form === 3) {
        for (const shift of [-14, 0, 14]) diamond(x + shift, y, 5, cat.form === 2 ? 10 : 20, color);
      } else if (cat.form >= 4) {
        polygon([[x + 12,y - 74],[x - 9,y - 36],[x + 6,y - 39],[x - 5,y + 7],[x + 13,y - 49],[x - 1,y - 46]], color);
      }
      label(cat.form === 5 ? '創世光' : catForm().spell, x, y - 30, color);
    } else {
      const radius = (effect.type === 'creation' ? 170 : 85) * (1 - (effect.until - clock) / 1.2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(battle.catX, 226, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (clock < swingUntil) {
    const dx = player.facing.x;
    const end = (equipped('weapon').reach ?? 55) * dx;
    const air = swingKind === 'air';
    polygon([[heroX, heroY - 25], [heroX + end, heroY - (air ? 4 : 48)],
      [heroX + end * .86, heroY - (air ? 17 : 26)], [heroX + end * .45, heroY - 11]], air ? '#95dfff' : '#fff2b9');
  }
}

function render() {
  const chapter = chapterOf(player.x);
  const camera = clamp(player.x - 245, -85, limit - 515);
  if (mode === 'title' || mode === 'home') drawHome();
  else if (battle) drawBattle();
  else drawField(chapter, camera);
  if (mode === 'field' && sealEffect && clock < sealEffect.until && !reducedMotion.matches) {
    const progress = 1 - (sealEffect.until - clock) / .9;
    const x = sealEffect.x - camera, y = sealEffect.y + 83;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#ffeaa3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 12 + progress * 44, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      diamond(x + Math.cos(angle) * progress * 48, y + Math.sin(angle) * progress * 48 - progress * 12, 3, 5, '#ffeaa3');
    }
    ctx.globalAlpha = 1;
  }
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
  if (glow && clock < glow.until && glow.field === !battle) {
    const x = glow.x - (glow.field ? camera : 0);
    ctx.strokeStyle = '#9ee8ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, glow.y);
    ctx.lineTo(x + glow.dx * starterRing.reach, glow.y + glow.dy * starterRing.reach);
    ctx.stroke();
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
