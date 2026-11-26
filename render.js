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
  const moving = Boolean(destination) || Boolean(battle && joystick.id !== null) || ['left','right','up','down'].some(pressed);
  const pose = !player.hp ? 8 : clock < flashUntil ? 5 : clock < swingUntil ? 3 :
    glow && clock < glow.until ? 6 : jumpHeight > 2 ? 2 :
    battle && (pressed('guard') || clock < invulnerableUntil) ? 4 : clock < victoryUntil ? 7 :
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
  const bob = reducedMotion.matches ? 0 : Math.sin(clock * 6 + (enemy.slot ?? 0)) * (variant > 1 ? 2 : 1);
  const body = battle?.enemy === enemy ? battle.body : combatBody(enemy);
  const size = 56 * scale;
  const large = Math.min(125, size * .35 * body.width);
  groundShadow(x, y + 1, large, Math.min(27, size * .075));
  const engaged = battle?.enemy === enemy;
  if (!enemy.boss && body.motion === 'duel') {
    const pose = engaged && battle.enemyHit > clock ? 5 : engaged && battle.strike ? 3 :
      1 + Math.floor(clock * 9) % 2;
    drawActor('守衛',x,y,scale,engaged ? battle.enemyFacing.x : -1,pose);
    return;
  }
  const image = enemy.trial !== undefined ? picture('emperor-' + enemy.trial) :
    featured === null ? picture('enemy-' + sprite) : picture('boss-' + featured);
  if (!image) return;
  ctx.save();
  const attack = engaged && battle.strike;
  const facing = engaged ? battle.enemyFacing.x : enemy.x < player.x ? 1 : -1;
  const flinch = engaged && battle.enemyHit > clock ? -Math.sign(facing) * 5 : 0;
  const lift = body.motion === 'float' ? -5 : 0;
  ctx.translate(x + flinch, y + bob + lift);
  if (attack && body.motion === 'stomp') ctx.scale(1.06, .94);
  if (attack && ['duel','charge'].includes(body.motion)) {
    ctx.rotate(-Math.sign(attack.direction.x) * (body.motion === 'charge' ? .15 : .07));
  }
  if (facing > .1 && body.motion !== 'float') ctx.scale(-1, 1);
  if (clock < enemy.flash && artQuality === 'high') ctx.filter = 'brightness(1.6)';
  else if (enemy.boss && featured === null && artQuality !== 'low') ctx.filter = 'hue-rotate(' + (enemy.chapter * 17 % 140) + 'deg)';
  ctx.imageSmoothingEnabled = artQuality !== 'low';
  ctx.drawImage(image, -size * body.width / 2, -size * .95, size * body.width, size);
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
  const x = site.x - camera, door = fieldY(site.x,site.row);
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
  for (let index = 0; index < 3; index++) {
    const resident = commuter(town,index);
    if (resident.x < camera || resident.x > camera + 640) continue;
    const x = resident.x - camera, y = fieldY(resident.x,resident.y);
    drawCompanion(['タク','薬師','守衛'][index],x,y,.68,resident.face,1);
    if (index === 0) label(town.resident,x,y - 36,'#ffe0a9',9);
    if (index === 1 && townHour() >= 10 && townHour() < 18) {
      rect(x + 7,y - 12,2,14,'#b68c66');
      if (resident.activity === '漁の支度') diamond(x + 12,y + 1,4,3,'#a6d3cf');
    }
  }
  for (const fixture of districtFixtures(chapter)) {
    const x = fixture.x - camera, y = fieldY(fixture.x,fixture.y);
    if (x < -25 || x > 670) continue;
    if (fixture.kind === 'bench') {
      groundShadow(x,y + 1,15,3);
      rect(x - 13,y - 11,26,4,'#a57a5c');
      rect(x - 13,y - 6,26,4,'#c49b75');
      rect(x - 9,y - 3,2,7,'#413844'); rect(x + 7,y - 3,2,7,'#413844');
    } else {
      groundShadow(x,y + 1,10,3);
      rect(x - 8,y - 29,17,29,'#477b84');
      rect(x - 6,y - 25,13,15,'#cbb29d');
      for (let i=0;i<3;i++) rect(x - 4 + 4*i,y - 23,2,7,'#8e697c');
      rect(x - 3,y - 7,7,2,'#283445');
      if (townNight()) lightAt(ctx,x,y - 20,29,'#e6d59166');
    }
  }
  const animalX = town.chapter * span + 71 + ((clock * 14 + 51) % 174);
  if (animalX >= camera && animalX <= camera + 640) {
    const lane = 125 + Math.sin(clock * .8) * 8;
    drawCat(animalX - camera,fieldY(animalX,lane),.55);
  }
  const dogX = town.chapter * span + 52 + ((clock * 10 + 32) % 120);
  if (dogX >= camera && dogX <= camera + 640) {
    const dog = picture('enemy-0');
    if (dog) ctx.drawImage(dog,dogX-camera-15,fieldY(dogX,73)-25,30,30);
  }
  if (artQuality !== 'low' && !reducedMotion.matches) {
    const birdX = (clock * 22 + chapter * 131) % 700 - 30;
    ctx.strokeStyle = '#d6dbd7bd';
    ctx.lineWidth = 1.5;
    for (let i=0;i<3;i++) {
      const lift = 3 + Math.sin(clock * 12 + i) * 2;
      ctx.beginPath(); ctx.moveTo(birdX + i * 17,63 + i * 4);
      ctx.quadraticCurveTo(birdX + i * 17 + 3,63 + i * 4 - lift,birdX + i * 17 + 6,63 + i * 4);
      ctx.quadraticCurveTo(birdX + i * 17 + 9,63 + i * 4 - lift,birdX + i * 17 + 12,63 + i * 4);
      ctx.stroke();
    }
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
  const layout = fieldLayouts[chapter], season = seasonIndex();
  const ridge = [];
  for (let x = -15; x <= 670; x += 19) {
    const world = camera + x;
    ridge.push([x,fieldY(clamp(world,0,limit),104)]);
  }
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ridge.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  for (const [width, alpha] of [[61,.15],[50,.27],[39,.41],[22,.14]]) {
    ctx.globalAlpha = alpha; ctx.strokeStyle = layout.roadTone; ctx.lineWidth = width; ctx.stroke();
  }
  ctx.restore();
  if (layout.water) {
    const start = chapter * span;
    ctx.save();
    ctx.beginPath();
    for (let world = start + 368; world <= start + 824; world += 12) {
      const x = world - camera, y = fieldY(world,riverY(world,chapter));
      if (world === start + 368) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#5c8a9f90'; ctx.lineWidth = 23; ctx.stroke();
    ctx.strokeStyle = '#c8e4dc6e'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    const x = layout.bridge - camera;
    if (x > -40 && x < 680) {
      const bridge = picture('landmark-3');
      if (bridge) ctx.drawImage(bridge,x - 30,fieldY(layout.bridge,riverY(layout.bridge,chapter)) - 34,59,52);
    }
  }
  if (layout.terrace) {
    const x = layout.bridge - camera;
    const y = fieldY(layout.bridge,68);
    if (x > -50 && x < 690) for (let i=0;i<6;i++) rect(x - 18 + i * 4,y + i * 5,34,4,'#9a97958a');
  }
  const tones = season === 0 ? ['#759c77','#c4969e','#d8a9ac'] :
    season === 1 ? ['#51866e','#68956e','#84a77a'] :
    season === 2 ? ['#ad684f','#bd8c59','#917052'] : ['#7d9694','#abc3c7','#c9d9d6'];
  for (const plant of layout.foliage) {
    const x = plant.x - camera;
    if (x < -38 || x > 678) continue;
    const y = fieldY(plant.x, plant.y);
    const size = plant.size;
    const wind = reducedMotion.matches ? 0 : Math.sin(clock * 1.3 + plant.x * .05) * 3;
    groundShadow(x,y + 1,size * .49,size * .12);
    if (plant.type === 0) {
      polygon([[x-size*.48,y],[x-size*.33,y-size*.31],[x+size*.25,y-size*.40],[x+size*.47,y]],'#777881');
    } else if (plant.type === 1) {
      for (const offset of [-4,0,4]) {
        ctx.strokeStyle = tones[0]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + offset,y); ctx.quadraticCurveTo(x+offset + 2,y-9,x+offset+wind,y-13); ctx.stroke();
        diamond(x+offset+wind,y-13,2,2,tones[2]);
      }
    } else {
      polygon([[x-2,y],[x+plant.turn+wind,y-size],[x+4,y-size*.32],[x+2,y]],'#55463d');
      for (const [i,tint] of tones.entries()) {
        const px = x + (i - 1) * size * .19 + wind + plant.turn;
        ctx.fillStyle = tint; ctx.beginPath();
        ctx.ellipse(px,y-size*.68-i*2,size*(.39-i*.035),size*.43,plant.turn*.11,0,6.283);
        ctx.fill();
      }
    }
  }
  ageLight(ctx);
  drawTown(chapter, camera);
  const view = scenicSpot(chapter);
  const sx = view.x - camera;
  const viewY = fieldY(view.x,view.y) - 96;
  if (sx > -30 && sx < 670) {
    const region = prefectures[chapter];
    const icon = picture('landmark-' + landmarkFor(region));
    const width = 72 + chapter % 4 * 6;
    if (icon) {
      groundShadow(sx, viewY + 93, width * .42, 9);
      ctx.drawImage(icon, sx - width / 2, viewY + 94 - width, width, width);
    } else rect(sx - 18, viewY + 85, 36, 20, '#77708a');
    if (!icon) {
      rect(sx - 14, viewY + 82, 28, 7, region.color);
      rect(sx - 12, viewY + 75, 2, 14, '#f3d9b7');
      rect(sx + 10, viewY + 75, 2, 14, '#f3d9b7');
    }
    label(region.sight, sx, viewY + 106, '#ffe8b6', 10);
    if (townNight()) lightAt(ctx, sx, viewY + 78, 35, '#f6c78069');
  }
  for (const gem of gems) {
    if (gem.on && Math.abs(gem.x - player.x) < 640) diamond(gem.x - camera, fieldY(gem.x,gem.row) - 7, 6, 9, '#ffe5a0');
  }
  for (const npc of npcs) {
    if (npc.name === player.party[0] || Math.abs(npc.x - player.x) > 640) continue;
    drawCompanion(npc.name, npc.x - camera, fieldY(npc.x,104), .8, 1);
    label(npc.name, npc.x - camera, fieldY(npc.x,104) - 34);
  }
  for (const shrine of shrines) {
    if (Math.abs(shrine.x - player.x) > 640) continue;
    const x = shrine.x - camera, y = fieldY(shrine.x,shrine.row) - 4;
    rect(x - 12, y - 20, 24, 25, '#4b375c');
    diamond(x, y - 10, 7, 10, shrine.solved ? '#efcd84' : '#9d7897');
  }
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !unlocked(enemy)) continue;
    const x = enemy.x - camera, y = fieldY(enemy.x,enemy.y);
    monster(enemy, x, y, Math.min(1.38, combatBody(enemy).size * .73));
    rect(x - 12, y - 31, 24, 3, '#35203a');
    rect(x - 12, y - 31, 24 * enemy.hp / enemy.max, 3, '#ff8d8d');
  }
  for (const pot of pots) {
    if (Math.abs(pot.x - player.x) > 640) continue;
    const x = pot.x - camera, y = fieldY(pot.x,pot.y);
    if (pot.broken) {
      rect(x - 9, y - 1, 5, 3, '#b57758');
      rect(x + 3, y - 3, 5, 4, '#ce9874');
    } else {
      rect(x - 7, y - 11, 14, 11, '#ad634f');
      rect(x - 5, y - 14, 10, 4, '#e2ab81');
      rect(x - 6, y - 7, 12, 2, '#dfa18a');
    }
  }
  const x = player.x - camera, y = fieldY(player.x,player.y) - jumpHeight;
  const member = currentCompanion();
  if (member) drawCompanion(member.name, companionTrail.x - camera, fieldY(companionTrail.x,companionTrail.y), .9,
    Math.sign(player.x - companionTrail.x), Math.sin(clock * 15) * 1.8);
  if (joined) drawCat(cat.x - camera, fieldY(cat.x,cat.y), .8);
  if (jumpHeight) rect(x - 7, fieldY(player.x,player.y) + 2, 14, 3, '#292735');
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

function drawDanger(strike, impact = false) {
  ctx.save();
  ctx.fillStyle = impact ? '#ffbd6461' : '#dc595c4c';
  ctx.strokeStyle = impact ? '#ffe3a7bc' : '#ff9691c8';
  ctx.lineWidth = impact ? 3 : 2;
  const {x,y,range,direction,width} = strike;
  ctx.beginPath();
  if (strike.wave) ctx.ellipse(x, battleDepth(y), range, range * .68, 0, 0, Math.PI * 2);
  else {
    const side = {x:-direction.y,y:direction.x};
    ctx.moveTo(x - side.x * width * .7,battleDepth(y - side.y * width * .7));
    ctx.lineTo(x + side.x * width * .7,battleDepth(y + side.y * width * .7));
    ctx.lineTo(x + direction.x * range + side.x * width,battleDepth(y + direction.y * range + side.y * width));
    ctx.lineTo(x + direction.x * range - side.x * width,battleDepth(y + direction.y * range - side.y * width));
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function dustAt(event) {
  if (!event || artQuality === 'low' || event.until <= clock) return;
  const t = 1 - (event.until - clock) / .45;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t) * .55;
  const quantity = artQuality === 'high' ? 14 : 7;
  for (let i = 0; i < quantity; i++) {
    const angle = i * 6.283 / quantity;
    const drift = 12 + t * (event.strong ? 53 : 25);
    ctx.fillStyle = i % 2 ? '#b3967b' : '#fed8a0';
    ctx.beginPath();
    ctx.ellipse(event.x + Math.cos(angle) * drift,battleDepth(event.y) + Math.sin(angle) * drift * .68 - t * 14,
      3 + t * 5,2 + t * 3,0,0,6.283);
    ctx.fill();
  }
  ctx.restore();
}

function drawBattle() {
  const {enemy, body, strike, impact, arena} = battle;
  const heroPoint = actorPoint('hero'), enemyPoint = actorPoint('enemy');
  const heroY = battleDepth(heroPoint.y) - jumpHeight;
  const enemyY = battleDepth(enemyPoint.y);
  const phase = isFinalBoss(enemy) ? finalPhase(enemy) : 1;
  drawArenaBackdrop(arena, enemy.chapter);
  if (enemy.boss && battle.age < 1.25) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, battle.age * 6, (1.25 - battle.age) * 3);
    rect(105, 107, 430, 30, '#111526d9');
    label(enemy.name, 320, 128, '#ffeac2', 17);
    ctx.restore();
  }
  ctx.save();
  const shake = !reducedMotion.matches && artQuality !== 'low' && impact?.strong && impact.until > clock ?
    Math.sin((impact.until - clock) * 56) * Math.min(6, (impact.until - clock) * 19) : 0;
  ctx.translate(320 + shake, 245);
  const zoom = arenaZoom();
  ctx.scale(zoom, zoom);
  ctx.translate(-320, -245);
  combatCamera(ctx);
  if (strike) drawDanger(strike);
  if (impact?.until > clock && impact.until - clock > .22) drawDanger(impact, true);
  dustAt(impact);
  dustAt(battle.stepDust);
  if (enemy.boss) lightAt(ctx, enemyPoint.x, enemyY - 32, 88, phase === 3 ? '#ffc2644e' : '#be8dff45');

  const actors = [
    {depth:heroPoint.y, paint:() => {
      const scale = depthScale(heroPoint.y);
      if (jumpHeight) groundShadow(heroPoint.x, heroY + jumpHeight, 11, 3);
      hero(heroPoint.x, heroY, scale, player.facing.x);
      if (battle.superAwake) lightAt(ctx, heroPoint.x, heroY - 20, 55, '#ffd76985');
      if (pressed('guard')) diamond(heroPoint.x + player.facing.x * 12,heroY - 20,9,17,'#95d7ddc7');
      if (clock < swingUntil) {
        const reach = equipped('weapon').reach ?? 55;
        const end = {x:heroPoint.x + player.facing.x * reach, y:heroY - 26 + player.facing.y * reach * .68};
        slashArc(heroPoint.x, heroY - 25, player.facing.x, reach * .76);
        polygon([[heroPoint.x,heroY - 26],[end.x,end.y - 9],[end.x,end.y + 5]], swingKind === 'air' ? '#9de0ef' : '#ffe5ad');
      }
    }},
    {depth:enemyPoint.y, paint:() => monster(enemy, enemyPoint.x, enemyY, body.size * depthScale(enemyPoint.y))}
  ];
  const member = currentCompanion();
  if (member) {
    const ally = actorPoint('ally');
    actors.push({depth:ally.y, paint:() => {
      const y = battleDepth(ally.y);
      const direction = Math.sign(enemyPoint.x - ally.x);
      ctx.save();
      if (!member.hp) ctx.globalAlpha = .52;
      drawCompanion(member.name,ally.x,y,depthScale(ally.y),direction,1,battle.allyHit > clock);
      ctx.restore();
      if (battle.allyGuard > clock) diamond(ally.x + direction * 9,y - 20,8,13,'#98d5e1');
      const action = battle.allyAction;
      if (action?.until > clock) {
        if (action.kind === 'magic') {
          ctx.strokeStyle = '#dbc2ff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ally.x,y - 25); ctx.lineTo(enemyPoint.x,enemyY - 36); ctx.stroke();
        } else if (action.kind === 'heal') diamond(heroPoint.x,heroY - 25,11,20,'#a6e0b1');
        else slashArc(ally.x,y - 18,direction,34);
      }
    }});
  }
  if (joined) {
    const p = actorPoint('cat');
    actors.push({depth:p.y, paint:() => drawCat(p.x,battleDepth(p.y),depthScale(p.y) * (1 + cat.form * .12),cat.form)});
  }
  actors.sort((a, b) => a.depth - b.depth).forEach(actor => actor.paint());

  const effect = battle.catEffect;
  if (effect?.until > clock && !reducedMotion.matches) {
    const x = effect.type === 'strike' ? enemyPoint.x : battle.catX;
    const y = effect.type === 'strike' ? enemyY - 32 : battleDepth(battle.catY) - 16;
    const color = catForm().color;
    const radius = effect.type === 'creation' ? 84 : 25 + cat.form * 4;
    lightAt(ctx,x,y,radius,color + '70');
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x,y,radius,radius * .51,0,0,6.283); ctx.stroke();
    if (effect.type === 'strike') label(cat.form === 5 ? '創世光' : catForm().spell,x,y - 24,color);
  }
  if (clock < enemy.flash && artQuality !== 'low') {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const spread = (enemy.flash - clock) * 115;
      diamond(enemyPoint.x + Math.cos(angle) * spread, enemyY - 29 + Math.sin(angle) * spread, 2, 3, '#ffdc9a');
    }
  }
  drawCinematicEffect(ctx, battle.catX + 10, battleDepth(battle.catY) - 20, cat.form === 5);
  if (glow && !glow.field && clock < glow.until) {
    const endX = glow.x + glow.dx * starterRing.reach;
    const endY = glow.y + glow.dy * starterRing.reach;
    lightAt(ctx,glow.x,glow.y,42,'#a6d6ff83');
    ctx.strokeStyle = '#9ee8ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(glow.x,glow.y); ctx.lineTo(endX,endY); ctx.stroke();
  }
  for (const number of numbers) {
    if (!number.field) label(number.text,number.x,number.y - (1 - (number.expires - clock) / .7) * 24,number.color,16);
  }
  ctx.restore();
}

function render() {
  if (innScene) return drawInnStay();
  if (interior && mode === 'field') return drawInterior();
  const chapter = chapterOf(player.x);
  const camera = fieldCamera;
  if (mode === 'title' || mode === 'home') drawHome();
  else if (battle) drawBattle();
  else drawField(chapter, camera);
  if (!battle && mode === 'field' && defeatedFoe?.until > clock && defeatedFoe.chapter === chapter) {
    ctx.save();
    ctx.globalAlpha = (defeatedFoe.until - clock) / .67;
    const fadeY = fieldY(player.x,player.y) - (1 - ctx.globalAlpha) * 23;
    monster(defeatedFoe.enemy, player.x - camera + 45, fadeY, Math.min(1.4, defeatedFoe.scale));
    ctx.restore();
  }
  if (mode === 'field' && sealEffect && clock < sealEffect.until && !reducedMotion.matches) {
    const progress = 1 - (sealEffect.until - clock) / .9;
    const x = sealEffect.x - camera, y = fieldY(sealEffect.x,sealEffect.y) - 13;
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
  if (!battle && clock < burstUntil && !reducedMotion.matches) {
    const x = battle ? battle.heroX : player.x - camera;
    const y = fieldY(player.x,player.y) - 10;
    ctx.globalAlpha = Math.min(.8, (burstUntil - clock) * 2);
    ctx.strokeStyle = '#ffe4a4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (1 - (burstUntil - clock) / .55) * 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (!battle && glow && clock < glow.until && glow.field) {
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
    if (battle || !number.field) continue;
    const y = fieldY(number.x,number.y) - (1 - (number.expires - clock) / .7) * 24;
    label(number.text, number.x - (number.field ? camera : 0), y, number.color, 19);
  }
}

let fieldCamera = -85;
let previousFrame = null;
let lastUI = 0;
let lastDraw = -Infinity;
function frame(timestamp) {
  const elapsed = previousFrame === null ? 0 : Math.min((timestamp - previousFrame) / 1000, .05);
  previousFrame = timestamp;
  const moment = cinemaMoment();
  const timeScale = moment?.kind === 'impact' && moment.progress < .38 ? .52 : 1;
  if (!document.hidden) {
    update(elapsed * timeScale);
    advanceInn(elapsed);
    const target = clamp(player.x - 245,-85,limit - 515);
    fieldCamera = Math.abs(fieldCamera - target) > 350 || reducedMotion.matches ?
      target : fieldCamera + (target - fieldCamera) * (1 - Math.exp(-elapsed * 9));
  }
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

function seatedAtInn(name, x, y, facing) {
  const actor = picture('actors');
  if (!actor) return;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(facing,1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(actor,0,actorRow(name)*64,64,44,-30,-42,60,42);
  polygon([[-9,-2],[1,-3],[9,3],[7,14],[2,14],[3,6],[-7,6]],'#574358');
  polygon([[2,12],[8,12],[12,16],[2,16]],'#4a3641');
  ctx.restore();
}

function drawInnStay() {
  const scene = innScene;
  const t = scene.time;
  const reception = scene.stage <= 1;
  const sleep = scene.stage === 4;
  const dawn = scene.stage >= 5;
  const night = sleep || scene.stage === 3;
  const image = picture('inn-' + (reception ? 2 : scene.profile.art));
  rect(0,0,640,360,'#46323a');
  if (image) coverArt(ctx,image,0,0,640,360);
  const glow = ctx.createLinearGradient(0,140,0,345);
  glow.addColorStop(0,'#56424900');
  glow.addColorStop(1,'#34272add');
  ctx.fillStyle = glow;
  ctx.fillRect(0,140,640,205);
  const sun = dawn ? clamp((t - 14.3) / 3,0,1) : 0;
  rect(431,55,95,86,'#241d2a');
  rect(438,61,81,72,night ? '#26304c' : dawn ? '#bc977e' : '#827c93');
  polygon([[438,124],[455,100],[477,114],[502,92],[518,109],[518,132],[438,132]],'#4c5263');
  if (night) {
    ctx.fillStyle='#ddd8b8';ctx.beginPath();ctx.arc(493,81,11,0,6.283);ctx.fill();
  } else if (dawn) {
    ctx.fillStyle='#ffdd9a';ctx.beginPath();ctx.arc(495,125-sun*38,13,0,6.283);ctx.fill();
    lightAt(ctx,474,123,105,'#ffc17b83');
  }
  rect(476,61,4,72,'#75594f');
  rect(438,96,81,3,'#75594f');
  if (reception) {
    groundShadow(234,224,68,9);
    rect(174,174,117,53,'#70514a');
    rect(170,170,125,10,'#b18c6a');
    for (let i=0;i<5;i++) rect(178+i*23,183,1,40,'#4e3740');
    drawCompanion('恵美ちゃん',229,172,.92,1);
    if (scene.stage === 0) {
      diamond(275,177 + Math.sin(t*8)*2,4,6,'#ffcf7c');
      rect(277,175,6,1,'#e8ba81');
    }
  } else {
    const heat = sleep ? 0 : 1;
    rect(114,119,85,75,'#6b5755');
    rect(124,135,65,55,'#2a2330');
    if (heat) {
      const fire = reducedMotion.matches ? 0 : Math.sin(t*14)*4;
      polygon([[136,183],[140,166],[150,169],[155+fire,147],[165,172],[174,166],[182,183]],'#e88955');
      polygon([[145,184],[151,171],[160+fire,164],[170,184]],'#f8c475');
      lightAt(ctx,156,168,88,'#ffa05787');
    }
    for (const x of [310,460]) {
      groundShadow(x,231,57,9);
      rect(x-51,176,102,54,'#493441');
      rect(x-48,178,96,42,'#8c665b');
      rect(x-42,184,27,27,'#eee1bb');
      rect(x-11,180,58,36,scene.profile.art === 1 ? '#648b84' : '#9c5b6e');
      rect(x+40,184,4,30,'#c19883');
      rect(x-47,220,91,3,'#6d4e52');
    }
    if (scene.stage >= 2 && scene.stage <= 5) {
      rect(241,199,78,26,'#79594c');
      rect(235,195,86,5,'#ac8163');
      polygon([[245,199],[268,184],[272,186],[252,203]],'#ced6d3');
      rect(277,198,21,9,'#984f68');
    }
  }
  const ally = currentCompanion();
  if (scene.stage <= 1) {
    const travel = clamp((t - 1.6) / 1.9,0,1);
    drawActor('一美',263 + travel*139,237 - travel*19,1.12,1,scene.stage ? 1 + Math.floor(t*9)%2 : 6);
    if (ally) drawActor(ally.name,224 + travel*136,246 - travel*21,1.06,1,scene.stage ? 1 + Math.floor(t*9)%2 : 0);
    if (joined) drawCat(208 + travel*130,248 - travel*18,.8);
  } else {
    const tired = scene.stage === 4 || scene.stage === 5;
    const rising = scene.stage === 6;
    const rise = clamp((t-17.3)/1.6,0,1);
    const pose = tired ? 8 : rising ? 1 + Math.floor(t*7)%2 : scene.stage === 3 ? 6 : 0;
    const y = tired ? 214 : rising ? 216 + rise*27 : 228;
    if (scene.stage === 2 || scene.stage === 3) {
      seatedAtInn('一美',335,210,1);
      if (ally) seatedAtInn(ally.name,472,210,-1);
    } else {
      drawActor('一美',335,y,1.13,1,pose);
      if (ally) drawActor(ally.name,472,y,1.02,-1,pose);
    }
    if (tired) {
      rect(322,195,30,14,'#a76578');
      if (ally) rect(459,195,30,14,'#a76578');
    }
    if (joined) {
      const catTime = sleep ? 0 : Math.floor(t*5)%3;
      const sheet = picture('soso');
      if (sheet) ctx.drawImage(sheet,catTime*64,0,64,64,345, sleep ? 191 : 207,42, sleep ? 32 : 40);
    }
  }
  if (night) {
    ctx.fillStyle = sleep ? '#111733' : '#29243d';
    ctx.globalAlpha = sleep ? .32 + clamp((t - 10) / 1.6,0,1) * .47 : .24;
    ctx.fillRect(0,0,640,360);
    ctx.globalAlpha = 1;
  } else if (dawn) lightAt(ctx,451,103,220,'#f6c47971');
}
