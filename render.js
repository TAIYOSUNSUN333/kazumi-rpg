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
function groundShadow(x, y, width, height) {
  ctx.fillStyle = '#17132176';
  ctx.beginPath();
  ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawActor(name, x, y, scale, face, pose) {
  const sheet = picture('actors');
  groundShadow(x, y + 1, 11 * scale, 3 * scale);
  if (!sheet) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((face < 0 ? -1 : 1) * scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, pose * 64, actorRow(name) * 64, 64, 64, -30, -54, 60, 58);
  ctx.restore();
}

function hero(x, y, scale, face) {
  const moving = Boolean(destination) || ['left','right','up','down'].some(pressed);
  const pose = !player.hp ? 8 : clock < flashUntil ? 5 : clock < swingUntil ? 3 :
    glow && clock < glow.until ? 6 : jumpHeight > 2 ? 2 :
    battle && clock < invulnerableUntil ? 4 : clock < victoryUntil ? 7 :
    moving ? 1 + Math.floor(clock * 10) % 2 : 0;
  drawActor('一美', x, y, scale, face, pose);
  if (player.armor || regionalGear.armor !== null || trialGear.armor !== null) {
    const metal = regionalGear.armor !== null ? prefectures[regionalGear.armor].color :
      ['#817967','#b39571','#8eb2b9','#beadd1'][player.armor];
    const direction = face < 0 ? -1 : 1;
    if (pose !== 8) {
      polygon([[x - direction * 5 * scale,y - 30 * scale],[x + direction * 4 * scale,y - 33 * scale],
        [x + direction * 6 * scale,y - 27 * scale],[x - direction * 5 * scale,y - 26 * scale]], metal);
      diamond(x + 1, y - 28 * scale, 2, 2, '#f9e1b8');
    }
  }
}

function drawCompanion(name, x, y, scale, face, motion = 0, hit = false) {
  const member = currentCompanion();
  const active = battle && member?.name === name && Math.abs(x - battle.allyX) < 14;
  const action = active && battle.allyAction?.until > clock ? battle.allyAction.kind : '';
  const pose = active && !member.hp ? 8 : hit ? 5 : active && battle.allyGuard > clock ? 4 :
    action === 'magic' || action === 'heal' ? 6 : action === 'attack' ? 3 :
    active && battle.allyDodge > clock ? 2 : motion !== 0 ? 1 + Math.floor(clock * 9) % 2 : 0;
  drawActor(name, x, y, scale, face, pose);
}

function drawCat(x, y, scale, formIndex = 0) {
  const sheet = picture('soso');
  const active = battle?.catEffect?.until > clock;
  const frame = battle && !cat.hp ? 3 : active ? 1 :
    reducedMotion.matches ? 0 : Math.floor(clock * 7) % 3;
  groundShadow(x, y + 2, 10 * scale, 3 * scale);
  if (formIndex) lightAt(ctx, x, y - 13, (21 + formIndex * 5) * scale, awakening[formIndex].color + '55');
  if (!sheet) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, frame * 64, formIndex * 64, 64, 64, x - 25 * scale, y - 40 * scale, 50 * scale, 50 * scale);
  ctx.restore();
}

function monster(enemy, x, y, scale) {
  const variant = enemy.variant ?? enemy.trial ?? 0;
  const phase = isFinalBoss(enemy) ? finalPhase(enemy) : 1;
  const featured = enemy.trial !== undefined ? 3 : enemy.rank === 'major' && enemy.chapter === 9 ? 0 :
    isFinalBoss(enemy) ? (enemy.chapter === last || phase === 3 ? 2 : 1) : null;
  const sprite = enemy.boss ? (enemy.hiddenRegion !== undefined && variant % 2 ? 5 : 4) : variant;
  const image = featured === null ? picture('enemy-' + sprite) : picture('boss-' + featured);
  const bob = reducedMotion.matches ? 0 : Math.sin(clock * 6 + (enemy.slot ?? 0)) * (variant > 1 ? 2 : 1);
  const size = (enemy.boss ? 64 : 48) * scale;
  groundShadow(x, y + 1, size * .37, size * .08);
  if (!image) return;
  ctx.save();
  ctx.translate(x, y + bob);
  if (battle && battle.heroX > battle.enemyX && !enemy.boss && sprite === 0) ctx.scale(-1, 1);
  if (clock < enemy.flash && artQuality === 'high') ctx.filter = 'brightness(1.6)';
  else if (enemy.boss && featured === null && artQuality !== 'low') ctx.filter = 'hue-rotate(' + (enemy.chapter * 17 % 140) + 'deg)';
  ctx.imageSmoothingEnabled = artQuality !== 'low';
  ctx.drawImage(image, -size / 2, -size * .95, size, size);
  ctx.restore();
}

function drawHome() {
  const image = picture(mode === 'home' ? 'story-1' : 'land-0');
  if (image) {
    coverArt(ctx, image, 0, 0, 640, 360);
    lightAt(ctx, 468, 123, 155, '#ffc48240');
    return;
  }
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
function drawBuilding(site, camera) {
  const town = towns[site.chapter];
  const [name, , , , color, mark] = townTypes[site.kind];
  const x = site.x - camera, door = site.row + 96;
  const y = door - 3;
  if (site.kind === 'secret') {
    rect(x - 17, y - 6, 34, 14, '#333044');
    rect(x - 12, y - 3, 24, 8, '#796e77');
    for (const rung of [-7, 0, 7]) rect(x + rung, y - 3, 2, 8, '#c1a581');
    label('地下', x, y - 9, '#f2d796', 9);
    return;
  }
  if (!site.upper) {
    rect(x - 20, y + 7, 40, 31, '#bfa080');
    rect(x - 21, y + 32, 42, 6, '#242c36aa');
    polygon([[x - 23, y + 24], [x - 15, y + 43], [x + 15, y + 43], [x + 23, y + 24]], color);
    rect(x - 6, y + 1, 12, 19, '#47364b');
    rect(x + 2, y + 10, 2, 2, '#f4ce88');
    for (const offset of [-15,9]) rect(x + offset, y + 10, 6, 9,
      townNight() && !siteAvailability(site) ? '#ffcf79' : '#70929e');
    label(mark, x, y + 31, '#ffe1ab', 9);
    if (doorContact === site || Math.abs(player.x - site.x) <= 12) label(name, x, y - 5, '#fff0cf', 10);
    return;
  }
  const tall = ['church','hall','library'].includes(site.kind);
  if (site.kind === 'inn' || site.kind === 'home') {
    const inn = picture('landmark-2');
    if (inn) {
      ctx.drawImage(inn, x - 26, y - 49, 52, 53);
      rect(x - 9, y - 11, 18, 9, '#382f42e3');
      label(mark, x, y - 3, '#ffe1ab', 8);
      if (townNight()) lightAt(ctx, x + 7, y - 8, 22, '#ffbc606d');
      if (doorContact === site || Math.abs(player.x - site.x) <= 12) label(name, x, y + 15, '#fff0cf', 10);
      return;
    }
  }
  const highRoof = tall || town.style === '急勾配' ? 52 : 41;
  rect(x - 21, y + 6, 43, 7, '#1a273677');
  rect(x - 19, y - 30, 38, 39, town.style === '白壁' ? '#dbd4be' : '#bfa080');
  if (town.style === '木組み' || town.style === '杭上げ') {
    rect(x - 18, y - 26, 3, 33, '#654735');
    rect(x + 14, y - 26, 3, 33, '#654735');
  }
  if (town.style === '石積み' || town.style === 'レンガ') {
    for (const shift of [-18,-9,0]) rect(x - 18, y + shift, 36, 1, '#8b7065');
  }
  const flat = site.kind === 'store' || town.style === '土壁';
  polygon([[x - 24, y - 26], [x - (flat ? 18 : 4), y - highRoof],
    [x + (flat ? 18 : 4), y - highRoof], [x + 24, y - 26]], color);
  for (let i = -19; i <= 19; i += 5) {
    const edge = (y - 27) - (highRoof - 26) * (flat ? .45 : .8) * (1 - Math.abs(i) / 22);
    ctx.strokeStyle = '#3c344e81';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + i, y - 27); ctx.lineTo(x + i * .56, edge); ctx.stroke();
  }
  rect(x - 23, y - 28, 46, 3, '#514352');
  if (tall) diamond(x, y - highRoof, 3, 6, '#e7ce9e');
  for (const side of [-1,1]) {
    const wx = x + side * 12 - 3;
    rect(wx - 1, y - 18, 8, 11, '#4b434f');
    rect(wx, y - 17, 6, 9, townNight() && !siteAvailability(site) ? '#ffcf79' : '#70929e');
    rect(wx + 2, y - 17, 1, 9, '#a58a73');
  }
  rect(x - 5, y - 11, 10, 20, '#463345');
  if (townNight() && !siteAvailability(site)) lightAt(ctx, x + 16, y - 12, 22, '#ffbc6070');
  rect(x + 2, y - 2, 2, 2, '#f4ce88');
  rect(x - 8, y - 23, 16, 10, '#584554');
  label(mark, x, y - 15, '#ffe1ab', 8);
  if (doorContact === site || Math.abs(player.x - site.x) <= 12) label(name, x, y + 20, '#fff0cf', 10);
}

function drawTown(chapter, camera) {
  for (const town of towns) {
    if (Math.abs(town.chapter - chapter) > 1) continue;
    for (const site of town.sites) {
      if (site.x < camera - 30 || site.x > camera + 665 ||
          site.kind === 'secret' && !(townQuests[site.chapter] > 0)) continue;
      drawBuilding(site, camera);
    }
  }
  const town = towns[chapter];
  const resident = townResident(town);
  if (resident.x >= camera && resident.x <= camera + 640) {
    drawCompanion('タク', resident.x - camera, resident.y + 96, .66, Math.sign(Math.cos(townSeconds * .8)), Math.sin(townSeconds * 12));
    label(town.resident, resident.x - camera, resident.y + 70, '#ffe0a9', 9);
  }
}

const roomDecor = {
  weapon:'剣架', armor:'鎧掛', items:'薬瓶', inn:'寝台', tavern:'樽',
  bank:'金庫', store:'商品棚', food:'食卓', church:'祭壇', library:'書架',
  bath:'湯船', smith:'金床', home:'戸棚', casino:'遊技台', ruin:'石像',
  hall:'掲示板', secret:'石櫃', regional:'石柱'
};

function drawRoomDetail(kind, x, y) {
  const metal = '#c6ccd0', wood = '#d9ac7a';
  if (kind === 'weapon') {
    polygon([[x-4,y+12],[x+3,y-9],[x+7,y-11],[x+7,y-6],[x,y+13]], metal);
    rect(x-7,y+7,14,3,wood);
  } else if (kind === 'armor') {
    polygon([[x-11,y-7],[x-5,y-11],[x+5,y-11],[x+11,y-7],[x+8,y+10],[x-8,y+10]], metal);
    rect(x-6,y+2,12,2,'#73738a');
  } else if (kind === 'bank' || kind === 'secret') {
    rect(x-13,y-10,26,21,'#594a65');
    rect(x-10,y-7,20,15,metal);
    diamond(x,y,3,4,'#424055');
  } else if (kind === 'library' || kind === 'hall') {
    for (const diff of [-9,-2,5]) {
      rect(x+diff,y-8,6,18,diff === -2 ? '#f3dcaa' : metal);
      rect(x+diff+1,y+1,4,1,'#8a6277');
    }
  } else if (kind === 'bath') {
    rect(x-14,y-5,28,11,'#a6d1d8');
    for (const diff of [-8,0,8]) rect(x+diff,y-9,2,6,'#eadbb9');
  } else if (kind === 'church') {
    diamond(x,y-3,8,13,'#f0cd8d');
    rect(x-14,y+9,28,3,wood);
  } else if (kind === 'smith') {
    rect(x-12,y-6,24,5,metal);
    rect(x-6,y-1,12,10,'#4c4657');
    rect(x-10,y+8,20,3,metal);
  } else if (kind === 'casino') {
    rect(x-10,y-9,20,19,'#9d5268');
    for (const diff of [-5,0,5]) diamond(x+diff,y,2,2,'#fff0b7');
  } else {
    rect(x-11,y-8,22,18,wood);
    rect(x-7,y-10,14,4,metal);
    rect(x-7,y-5,14,2,'#805b66');
  }
}

function drawInterior() {
  const {site, x, y} = interior;
  const town = towns[site.chapter];
  const [facility, keeper, , , color] = townTypes[site.kind];
  const name = site.kind === 'regional' ? prefectures[site.chapter].dungeon : facility;
  rect(0, 0, 640, 360, '#202437');
  const cave = ['secret','ruin','regional'].includes(site.kind);
  if (cave) landscapeArt(ctx, site.chapter, 0, true);
  rect(38, 45, 564, 271, cave ? '#4b456887' : '#58465a');
  rect(50, 79, 540, 225, cave ? '#57546a97' : '#86694f');
  for (let row = 80; row < 304; row += 24) {
    rect(52, row, 536, 1, '#e0bf9a44');
    for (let col = 52 + (row % 48 ? 0 : 28); col < 588; col += 56) rect(col, row, 1, 24, '#503b4144');
  }
  rect(226, 154, 188, 91, color);
  rect(232, 160, 176, 79, '#c49d8333');
  if (!['secret','ruin','regional'].includes(site.kind)) {
    for (const wx of [122, 484]) {
      rect(wx, 56, 31, 18, '#282b42');
      rect(wx + 3, 58, 25, 13, townNight() ? '#ffc670' : '#a2c4cb');
      rect(wx + 14, 58, 2, 13, '#7c665a');
      lightAt(ctx, wx + 15, 75, 44, townNight() ? '#ffc36575' : '#cfe6ed45');
    }
  }
  label(name + ' · ' + town.name, 320, 68, '#ffe2b6', 16);
  const furniture = roomFurniture(site.kind);
  for (const [index, box] of furniture.entries()) {
    rect(box.x + 4, box.y + 6, box.w, box.h, '#342f404d');
    rect(box.x, box.y, box.w, box.h, site.kind === 'bath' ? '#597f9a' : '#644756');
    rect(box.x + 3, box.y + 3, box.w - 6, box.h - 7, color);
    if (index === 0) {
      drawRoomDetail(site.kind, box.x + box.w / 2, box.y + box.h / 2);
      label(roomDecor[site.kind], box.x + box.w / 2, box.y - 5, '#ffe0a7', 10);
    } else if (['home','inn'].includes(site.kind)) {
      rect(box.x + 8, box.y + 7, 23, box.h - 15, '#eacbb1');
    } else {
      for (let i = 12; i < box.w - 7; i += 17) {
        rect(box.x + i, box.y + 9, 8, 12, site.kind === 'bath' ? '#9cd4d8' : '#d9af7c');
      }
    }
  }
  rect(292, 300, 56, 16, '#2d293f');
  label('出口', 320, 298, '#ffe6b8', 12);
  if (site.kind === 'regional') {
    lightAt(ctx, 320, 100, 68, '#98a6ef70');
    diamond(320, 100, 16, 23, prefectures[site.chapter].color);
    label('守り石', 320, 76, '#e8d5b9', 12);
  } else if (site.kind === 'secret') {
    rect(301, 88, 38, 20, site.seal.solved ? '#999182' : '#ba8664');
    rect(303, 96, 34, 3, '#685171');
    diamond(320, 99, 4, 5, '#ffda8a');
  } else {
    drawCompanion(site.chapter % 2 ? '恵美ちゃん' : '一郎', 320, 108, 1, 1);
    label(keeper, 320, 80, '#ffe0a7', 12);
  }
  if (joined) drawCat(clamp(x - 22, 47, 593), y + 3, .8);
  const companion = currentCompanion();
  if (companion) drawCompanion(companion.name, clamp(x - 30, 47, 593), y + 8, .9, player.facing.x);
  hero(x, y, 1.1, player.facing.x);
}

function drawField(chapter, camera) {
  const [ground, leaf] = palettes[chapter] || ['#354b50', prefectures[chapter].color];
  const light = ctx.createLinearGradient(0, 0, 0, 360);
  light.addColorStop(0, '#253248');
  light.addColorStop(.40, ground);
  light.addColorStop(1, '#1f3443');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 640, 360);
  const painted = landscapeArt(ctx, chapter, camera);
  if (!painted) for (let i = -1; i < 7; i++) {
    const ridge = i * 130 - (camera * .19 % 130);
    polygon([[ridge, 115],[ridge + 59, 36 + (i % 3) * 12],[ridge + 138, 115]], '#354650');
  }
  if (!painted) rect(0, 119, 640, 23, ['water','coast','river'].includes(prefectures[chapter].terrain) ? '#6b9bb0' : ground);
  if (['water','coast','river'].includes(prefectures[chapter].terrain)) {
    for (let i = 0; i < 20; i++) {
      const x = (i * 79 - camera * .28 + Math.sin(clock * .7 + i) * 8) % 640;
      rect(x, 124 + i * 17 % 38, 10 + i % 5 * 4, 1, '#b1d8d879');
    }
  }
  const pathPaint = ctx.createLinearGradient(0, 167, 0, 229);
  pathPaint.addColorStop(0, '#88736100');
  pathPaint.addColorStop(.30, '#9a866bc2');
  pathPaint.addColorStop(.72, '#a49276c2');
  pathPaint.addColorStop(1, '#88736100');
  ctx.fillStyle = pathPaint;
  ctx.fillRect(0, 167, 640, 62);
  for (let i = Math.floor(camera / 48); i < (camera + 660) / 48; i++) {
    const x = i * 48 - camera;
    rect(x, 184 + i % 4 * 8, 12, 2, '#98866e');
    for (const y of [105 + i % 3 * 5, 280 + i % 2 * 11]) {
      const wind = reducedMotion.matches ? 0 : Math.sin(clock * 1.4 + i * .8) * 3;
      if (y > 200 || !painted) {
        groundShadow(x + 15, y + 25, 11, 3);
        polygon([[x + 14,y + 27],[x + 16 + wind,y + 5],[x + 20 + wind,y + 13],[x + 18,y + 27]], '#51463e');
        for (const offset of [-7,0,7]) {
          const top = y + 8 + Math.abs(offset) * .8;
          polygon([[x + 16 + offset + wind,top - 10],[x + 25 + offset,top + 8],
            [x + 15 + offset,top + 14],[x + 7 + offset,top + 6]], leaf);
        }
      }
    }
    diamond(x + 15, 145 + i % 3 * 38, 2, 2, '#e4cf9c');
  }
  ageLight(ctx);
  drawTown(chapter, camera);
  const view = scenicSpot(chapter);
  const sx = view.x - camera;
  if (sx > -30 && sx < 670) {
    const region = prefectures[chapter];
    const icon = picture('landmark-' + landmarkFor(region));
    const width = 72 + chapter % 4 * 6;
    if (icon) {
      groundShadow(sx, view.y + 93, width * .42, 9);
      ctx.drawImage(icon, sx - width / 2, view.y + 94 - width, width, width);
    } else rect(sx - 18, view.y + 85, 36, 20, '#77708a');
    if (!icon) {
      rect(sx - 14, view.y + 82, 28, 7, region.color);
      rect(sx - 12, view.y + 75, 2, 14, '#f3d9b7');
      rect(sx + 10, view.y + 75, 2, 14, '#f3d9b7');
    }
    label(region.sight, sx, view.y + 106, '#ffe8b6', 10);
    if (townNight()) lightAt(ctx, sx, view.y + 78, 35, '#f6c78069');
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
  skyEffects(ctx, chapter);
  if (clock < swingUntil) {
    const {x: dx, y: dy} = player.facing;
    polygon([[x, y - 9], [x + dx * 31 - dy * 10, y - 9 + dy * 31 + dx * 10],
      [x + dx * 26 + dy * 11, y - 9 + dy * 26 - dx * 11]], swingKind === 'air' ? '#95dfff' : '#fff1be');
  }
}

function slashArc(x, y, face, distance) {
  if (artQuality === 'low') return;
  const progress = clamp(1 - (swingUntil - clock) * 4, 0, 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face < 0 ? -1 : 1, 1);
  ctx.globalAlpha = Math.max(.2, 1 - progress * .7);
  ctx.lineWidth = 5 - progress * 3;
  ctx.strokeStyle = swingKind === 'air' ? '#a5ddff' : '#fce3a9';
  ctx.beginPath();
  ctx.ellipse(8, 0, distance * .75, 28, .24, -.97 + progress, .54 + progress);
  ctx.stroke();
  ctx.restore();
}

function drawBattle() {
  const {enemy, heroX, enemyX, strike, damageFlash} = battle;
  const boss = enemy.boss;
  const phase = isFinalBoss(enemy) ? finalPhase(enemy) : 1;
  ctx.save();
  combatCamera(ctx);
  rect(0, 0, 640, 360, phase === 3 ? '#4c203a' : phase === 2 ? '#362455' : boss ? '#301f3e' : '#252f45');
  landscapeArt(ctx, enemy.chapter, 0, boss);
  const stageLight = ctx.createLinearGradient(0, 164, 0, 350);
  stageLight.addColorStop(0, '#35263a00');
  stageLight.addColorStop(.35, '#342a45b8');
  stageLight.addColorStop(1, '#1e1a33f0');
  ctx.fillStyle = stageLight;
  ctx.fillRect(0, 164, 640, 186);
  rect(0, 245, 640, 1, '#fbd5a34a');
  if (boss) lightAt(ctx, enemyX, 193, 85, phase === 3 ? '#ffc2644e' : '#be8dff45');
  if (strike) {
    const width = strike.wave ? 640 : strike.range;
    const x = strike.wave ? 0 : enemyX + (strike.direction < 0 ? -width : 0);
    rect(x, 237, width, 6, '#e78181');
    label(strike.label, enemyX, 151, '#ffc0ab', 18);
  }
  if (boss && battle.age < 1.25) {
    const fade = Math.min(1, battle.age * 6, (1.25 - battle.age) * 3);
    ctx.save();
    ctx.globalAlpha *= fade;
    rect(118, 120, 404, 29, '#141426d4');
    label(enemy.name, 320, 140, '#ffeac2', 17);
    ctx.restore();
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
  if (joined) drawCat(battle.catX, 247, 1.15 + cat.form * .13, cat.form);
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
    slashArc(heroX, heroY - 23, dx, Math.abs(end));
    polygon([[heroX, heroY - 25], [heroX + end, heroY - (air ? 4 : 48)],
      [heroX + end * .86, heroY - (air ? 17 : 26)], [heroX + end * .45, heroY - 11]], air ? '#95dfff' : '#fff2b9');
  }
  if (clock < enemy.flash && artQuality !== 'low') {
    lightAt(ctx, enemyX, 198, 43, '#ffc88069');
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const spread = (enemy.flash - clock) * 95;
      diamond(enemyX + Math.cos(angle) * spread, 199 + Math.sin(angle) * spread, 2, 3, '#ffdc9a');
    }
  }
  drawCinematicEffect(ctx, battle.catX + 10, 211, cat.form === 5);
  ctx.restore();
}

function render() {
  if (interior && mode === 'field') return drawInterior();
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
    lightAt(ctx, x, glow.y, 45, '#a6d6ff83');
    ctx.beginPath();
    ctx.ellipse(x, glow.y + 13, 22, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
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
let lastDraw = -Infinity;
function frame(timestamp) {
  const elapsed = previousFrame === null ? 0 : Math.min((timestamp - previousFrame) / 1000, .05);
  previousFrame = timestamp;
  const moment = cinemaMoment();
  const timeScale = moment?.kind === 'impact' && moment.progress < .38 ? .52 : 1;
  if (!document.hidden) update(elapsed * timeScale);
  const frameInterval = artQuality === 'low' ? 47 : artQuality === 'medium' ? 24 : 15;
  if (!document.hidden && timestamp - lastDraw >= frameInterval) {
    render();
    lastDraw = timestamp;
  }
  if (timestamp - lastUI > 55) {
    updateUI();
    lastUI = timestamp;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
