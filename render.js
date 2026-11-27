const canvas = $('scene');
const scene = document.createElement('canvas');
scene.width = 640;
scene.height = 360;
const ctx = scene.getContext('2d');
const screen = canvas.getContext('2d');
const sceneBlend = document.createElement('canvas');
sceneBlend.width = 640;
sceneBlend.height = 360;
const blend = sceneBlend.getContext('2d');
const edgeMask = blend.createLinearGradient(0,0,0,360);
for (const [stop,alpha] of [[0,0],[.14,.4],[.34,1],[.85,1],[1,0]]) {
  edgeMask.addColorStop(stop,'rgba(0,0,0,' + alpha + ')');
}
let sceneView = {height:360, top:0};
let fieldCameraY = 0;
let battleStageBottom = 280;

function portraitBackdrop() {
  const chapter = chapterOf(player.x);
  if (battle) return picture('arena-' + battle.arena);
  if (mode === 'home') return picture('story-1');
  if (mode === 'title') return picture('land-0');
  if (bathScene) return picture('inn-1');
  if (innScene) return picture('inn-' + innScene.profile.art);
  return picture(landscapeImage(chapter,Boolean(interior && ['secret','ruin','regional','trailroom'].includes(interior.site.kind))));
}

function presentScene() {
  const height = clamp(Math.round(640 * canvas.clientHeight / Math.max(1,canvas.clientWidth)), 240, 1600);
  if (canvas.height !== height) canvas.height = height;
  const extra = height-360;
  const top = Math.round(extra >= 0 ? extra * .49 : extra / 2);
  sceneView = {height,top};
  screen.imageSmoothingEnabled = artQuality !== 'low';
  if (extra <= 36) {
    screen.drawImage(scene,0,0,640,height);
    sceneView.top = 0;
    sceneView.scaleY = height / 360;
    return;
  }
  const background = portraitBackdrop();
  screen.fillStyle = interior ? '#292338' : '#35434e';
  screen.fillRect(0,0,640,height);
  if (background) coverArt(screen,background,0,0,640,height);
  const haze = screen.createLinearGradient(0,0,0,height);
  haze.addColorStop(0,'#1d26334a');
  haze.addColorStop(.52,'#1f26355e');
  haze.addColorStop(1,'#161928ba');
  screen.fillStyle = haze;
  screen.fillRect(0,0,640,height);
  if (mode === 'title' || mode === 'home') return;
  blend.globalCompositeOperation = 'copy';
  blend.drawImage(scene,0,0);
  blend.globalCompositeOperation = 'destination-in';
  blend.fillStyle = edgeMask;
  blend.fillRect(0,0,640,360);
  screen.drawImage(sceneBlend,0,top);
}

function canvasPoint(clientX,clientY) {
  const bounds = canvas.getBoundingClientRect();
  const {height,top,scaleY = 1} = sceneView;
  const y = ((clientY-bounds.top)*height/bounds.height - top) / scaleY;
  return {x:(clientX-bounds.left)*640/bounds.width,y};
}
new ResizeObserver(() => {
  battleStageBottom = canvasPoint(0,$('battle-commands').getBoundingClientRect().top).y - 12;
}).observe($('battle-commands'));

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

function actionSprite(x,y,scale,face,frame) {
  const sheet = picture('action-poses');
  if (!sheet) return false;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale((face < 0 ? -1 : 1) * scale,scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet,frame*64,0,64,64,-30,-54,60,58);
  ctx.restore();
  return true;
}

function hero(x, y, scale, face) {
  const moving = gait === 'walk' || gait === 'run';
  const pose = !player.hp ? 8 : clock < flashUntil ? 5 : clock < swingUntil ? battle?.heroStrike ? 2 : 3 :
    battle?.spellUntil > clock ? 6 : jumpHeight > 2 ? 2 : (pressed('guard') || battle?.autoGuard) ? 4 : clock < victoryUntil ? 7 :
    moving ? 1 + Math.floor(clock * 10) % 2 : 0;
  const frame = !player.hp || clock < flashUntil || clock < swingUntil ? -1 :
    gait === 'dash' ? 10 : wallKickUntil > clock ? 5 : climbing ? 7 + Math.floor(clock * 9) % 2 :
    wallContact && jumpHeight > floorUnderHero() + 8 ? 4 :
    jumpHeight > floorUnderHero() + 4 ? 2 : clock < landedUntil ? 3 :
    clock < uprightAt ? 9 : gait === 'crouch' ? 6 :
    chargeStarted !== null && clock - chargeStarted >= .58 ? 11 :
    gait === 'run' ? Math.floor(clock * 17) % 2 : -1;
  if (frame < 0 || !actionSprite(x,y,scale,face,frame)) drawActor('一美', x, y, scale, face, pose);
  const armor = equipped('armor');
  if (armor !== equipment.armor[0]) {
    const metal = stoneArmor ? '#dbb878' : regionalGear.armor !== null ? prefectures[regionalGear.armor].color :
      ['#817967','#b39571','#8eb2b9','#beadd1'][armorBase ?? player.armor];
    const direction = face < 0 ? -1 : 1;
    if (pose !== 8) {
      polygon([[x - direction * 5 * scale,y - 30 * scale],[x + direction * 4 * scale,y - 33 * scale],
        [x + direction * 6 * scale,y - 27 * scale],[x - direction * 5 * scale,y - 26 * scale]], metal);
      diamond(x + 1, y - 28 * scale, 2, 2, '#f9e1b8');
    }
  }
}

function drawCompanion(name, x, y, scale, face, motion = 0, hit = false) {
  const pose = hit ? 5 : motion ? 1 + Math.floor(clock * 9) % 2 : 0;
  drawActor(name, x, y, scale, face, pose);
}

function drawPartyMember(member,x,y,scale,face,pose) {
  if (member.monster) {
    const foe = enemies[member.origin];
    monster(foe,x,y,Math.min(1.04,combatBody(foe).size)*scale,{face,pose});
  } else drawActor(member.name,x,y,scale,face,pose);
}

function drawCat(x, y, scale, formIndex = 0) {
  const sheet = picture('soso');
  const active = battle?.command?.action?.actor.id === 'cat' || battle?.command?.catGlowUntil > clock ||
    battle?.catEffect?.until > clock;
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

function monster(enemy, x, y, scale, commandPose) {
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
  const facing = commandPose?.face ?? enemy.fieldFacing?.x ?? (enemy.x < player.x ? 1 : -1);
  if (!enemy.boss && body.motion === 'duel') {
    const pose = commandPose?.pose ?? 1 + Math.floor(clock * 9) % 2;
    drawActor('守衛',x,y,scale,facing,pose);
    return;
  }
  const image = enemy.trial !== undefined ? picture('emperor-' + enemy.trial) :
    featured === null ? picture('enemy-' + sprite) : picture('boss-' + featured);
  if (!image) return;
  ctx.save();
  const attack = commandPose?.pose === 3;
  const flinch = commandPose?.pose === 5 ? -Math.sign(facing) * 5 : 0;
  const lift = body.motion === 'float' ? -5 : 0;
  ctx.translate(x + flinch, y + bob + lift);
  if (attack && body.motion === 'stomp') ctx.scale(1.06, .94);
  if (attack && ['duel','charge'].includes(body.motion)) {
    ctx.rotate(-Math.sign(facing) * (body.motion === 'charge' ? .15 : .07));
  }
  if (facing > .1 && body.motion !== 'float') ctx.scale(-1, 1);
  if (commandPose?.pose === 8) {
    ctx.globalAlpha *= .35;
    ctx.scale(.88,.72);
  }
  if ((commandPose?.pose === 5 || clock < enemy.flash) && artQuality === 'high') ctx.filter = 'brightness(1.6)';
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
function drawBuilding(site,camera) {
  const x = site.x-camera, y = fieldY(site.x,site.row);
  ctx.save();
  ctx.translate(x,y);
  ctx.scale((site.width || 19)/19,(site.height || 40)/40);
  ctx.translate(-x,-y);
  drawBuildingArt(site,camera);
  ctx.restore();
}

function drawBuildingArt(site, camera) {
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

function drawDoorHint(site,camera) {
  const x = site.x - camera;
  const y = fieldY(site.x,site.row);
  const opening = doorTransition?.site === site;
  const pulse = reducedMotion.matches ? 0 : Math.sin(clock * 7) * 3;
  if (opening) {
    const t = clamp((clock-doorTransition.start)/.30,0,1);
    rect(x-7,y-18,14,19,'#292141');
    polygon([[x-7,y-18],[x-7+14*(1-t),y-19+t*3],[x-7+14*(1-t),y+t*2],[x-7,y]],'#b69368');
    lightAt(ctx,x,y-8,20+t*18,'#ffe2a782');
    return;
  }
  lightAt(ctx,x,y-9,34,'#ffd48674');
  const [, , opens, closes] = townTypes[site.kind];
  if (doorContact === site && clock % 4 < 3.4) {
    label(closes === 24 ? '24時間' : opens+'〜'+(closes<opens ? '翌':'')+closes+'時',x,y-32,'#ffedbd',10);
  }
  polygon([[x-5,y-22+pulse],[x+5,y-22+pulse],[x,y-16+pulse]],'#fff2ac');
}

function drawPlatforms(chapter,camera) {
  const features = motionFeatures(chapter);
  for (const surface of [features.lift,features.ledge]) {
    const x = surface.x-camera, foot = fieldY(surface.x,surface.y);
    if (x < -60 || x > 700) continue;
    groundShadow(x,foot,surface.width,.16*surface.width);
    const tone = surface.moving ? '#b89a78' : '#80819a';
    polygon([[x-surface.width,foot-surface.height],[x+surface.width,foot-surface.height],
      [x+surface.width-4,foot-surface.height+9],[x-surface.width+4,foot-surface.height+9]],tone);
    rect(x-surface.width+3,foot-surface.height+2,surface.width*2-6,2,'#e3c3a1');
    if (!surface.moving) rect(x-21,foot-surface.height+9,42,surface.height-9,'#554b67bc');
  }
  const tunnel=features.tunnel;
  const x=tunnel.x-camera, y=fieldY(tunnel.x,tunnel.y);
  if (x > -30 && x < 670) {
    rect(x-19,y-18,38,26,'#6d6578');
    if (closeTo(tunnel.x,tunnel.y,25) || trailCaches.has(chapter)) rect(x-11,y-8,22,16,'#252639');
    else rect(x-9,y-8,20,15,'#5b546a');
    rect(x-15,y-18,30,4,'#b4a68c');
  }
}

function drawTown(chapter, camera) {
  for (const town of towns) {
    if (Math.abs(town.chapter - chapter) > 1) continue;
    for (const site of [...town.sites].sort((a,b)=>a.row-b.row)) {
      if (site.x < camera - 30 || site.x > camera + 665 ||
          site.kind === 'secret' && !(townQuests[site.chapter] > 0)) continue;
      drawBuilding(site,camera);
      if (site.kind !== 'secret') {
        const x = site.x - camera + 14, y = fieldY(site.x,roofSurface(site).y);
        for (let r=8;r<=39;r+=7) rect(x-3,y-r,7,1,'#cbb38b');
        rect(x-4,y-40,1,35,'#a27a66'); rect(x+4,y-40,1,35,'#a27a66');
      }
      if (site === doorContact || site === doorTransition?.site) drawDoorHint(site,camera);
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
  hall:'掲示板', secret:'石櫃', regional:'石柱', magic:'魔術の書'
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

function drawRunningDust(camera = 0) {
  if (!runDust || runDust.arena !== isActionBattle() || clock >= runDust.until || runDust.interior !== interior ||
      artQuality === 'low' || reducedMotion.matches) return;
  const t = 1 - (runDust.until - clock) / .24;
  const x = interior || runDust.arena ? runDust.x : runDust.x - camera;
  const y = runDust.arena ? battleDepth(runDust.y) : interior ? runDust.y : fieldY(runDust.x,runDust.y);
  ctx.save();
  ctx.globalAlpha = .5 * (1 - t);
  ctx.fillStyle = '#e0c59b';
  for (let i=0;i<5;i++) {
    const spread = t * (12 + i*3);
    ctx.beginPath();
    ctx.ellipse(x + spread * Math.cos(i*1.9),y - t*7 + spread * Math.sin(i*1.9)*.35,2+t*3,1+t*2,0,0,6.283);
    ctx.fill();
  }
  ctx.restore();
}

function drawInterior() {
  const {site, x, y} = interior;
  const town = towns[site.chapter];
  const [facility, keeper, , , color] = townTypes[site.kind];
  const name = site.kind === 'regional' ? prefectures[site.chapter].dungeon : facility;
  rect(0, 0, 640, 360, '#202437');
  const cave = ['secret','ruin','regional','trailroom'].includes(site.kind);
  if (cave) landscapeArt(ctx, site.chapter, 0, true);
  rect(38, 45, 564, 271, cave ? '#4b456887' : '#58465a');
  rect(50, 79, 540, 225, cave ? '#57546a97' : '#86694f');
  for (let row = 80; row < 304; row += 24) {
    rect(52, row, 536, 1, '#e0bf9a44');
    for (let col = 52 + (row % 48 ? 0 : 28); col < 588; col += 56) rect(col, row, 1, 24, '#503b4144');
  }
  rect(226, 154, 188, 91, color);
  rect(232, 160, 176, 79, '#c49d8333');
  if (!['secret','ruin','regional','trailroom'].includes(site.kind)) {
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
  if (doorTransition?.exit) {
    const open = Math.max(0, Math.min(1, (clock - doorTransition.start) / .24));
    rect(294,300, 26 * (1-open),16,'#b3916a');
    rect(346 - 26 * (1-open),300,26 * (1-open),16,'#b3916a');
    lightAt(ctx,320,299,23+open*24,'#ffd99577');
  }
  label('出口', 320, 298, '#ffe6b8', 12);
  if (site.kind === 'regional') {
    lightAt(ctx, 320, 100, 68, '#98a6ef70');
    diamond(320, 100, 16, 23, prefectures[site.chapter].color);
    label('守り石', 320, 76, '#e8d5b9', 12);
  } else if (site.kind === 'secret' || site.kind === 'trailroom') {
    rect(301, 88, 38, 20, (site.kind === 'secret' ? site.seal.solved : stageClaims.has(site.chapter)) ? '#999182' : '#ba8664');
    rect(303, 96, 34, 3, '#685171');
    diamond(320, 99, 4, 5, '#ffda8a');
  } else {
    drawCompanion(site.chapter % 2 ? '恵美ちゃん' : '一郎', 320, 108, 1, 1);
    label(keeper, 320, 80, '#ffe0a7', 12);
  }
  if (joined) drawCat(clamp(x - 22, 47, 593), y + 3, .8);
  if (facilityGathering?.site === site) {
    const gathering = facilityGathering;
    const t = (performance.now()-gathering.start)/1000;
    gatherAtTable(gathering.guests,t,320,204,Math.min(393,122+gathering.guests.length*34));
    return;
  }
  for (const [index,member] of activeCompanions().entries()) {
    drawPartyMember(member,clamp(x-30-index*15,47,593),y+8+(index%2)*10,.9,player.facing.x,gait === 'idle' ? 0 : 1);
  }
  drawRunningDust();
  hero(x, y-jumpHeight, 1.1, player.facing.x);
}

function drawStage(path, camera) {
  const {chapter, prop, trap, rune, cache} = path;
  const scroll = mark => ({x:mark.x-camera,y:fieldY(mark.x,mark.y)});
  const material = scroll(prop);
  if (!cutStageProps.has(chapter) && material.x >= -30 && material.x <= 670) {
    const {x,y} = material, {width,height,color} = prop;
    groundShadow(x,y+1,width+2,4);
    if (prop.kind === 'grass' || prop.kind === 'vine') {
      for (let i = -1; i < 2; i++) {
        ctx.strokeStyle = i === 0 ? color : '#92ad83';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x+i*4,y);
        ctx.quadraticCurveTo(x+i*12,y-height*.7,x+i*3,y-height-4);
        ctx.stroke();
      }
    } else if (prop.kind === 'rope') {
      rect(x-12,y-height-3,24,4,'#866750');
      rect(x-2,y-height,4,height-10,color);
      diamond(x,y-11,4,4,'#d9bb91');
    } else {
      rect(x-width,y-height,width*2,height,color);
      rect(x-width,y-height,width*2,3,'#e7c8a273');
      rect(x-width,y-height*.3,width*2,2,'#4f3d46');
      if (prop.kind === 'wall') {
        polygon([[x,y-height],[x-4,y-height*.65],[x+4,y-height*.55],[x-2,y-2],[x+1,y-height*.59],[x-5,y-height*.64]],'#4c4158');
      } else if (prop.kind === 'crate') polygon([[x-width,y-height],[x+width,y-2],[x+width,y-5],[x-width,y-height+3]],'#e2af77');
      else if (prop.kind === 'switch') diamond(x,y-height,6,4,'#d7eff2');
    }
  }
  const base = scroll(trap);
  if (base.x > -75 && base.x < 715) {
    const {x,y} = base, left = x-trap.width, width = trap.width*2;
    if (trap.kind === 'spikes') {
      rect(left,y-4,width,6,'#484158');
      for (let i=0;i<6;i++) polygon([[left+i*8,y-4],[left+i*8+3,y-13],[left+i*8+7,y-4]],'#b0bacd');
    } else if (['lava','ice','quicksand','pit','crumble'].includes(trap.kind)) {
      const tones = {lava:['#872e41','#ef884c'], ice:['#6393a6','#c3e9ff'], quicksand:['#806047','#cd9a65'],
        pit:['#292039','#47384b'], crumble:['#382a3f','#978166']}[trap.kind];
      rect(left,y-trap.depth,width,trap.depth*2,tones[0]);
      for (let i=0;i<4;i++) rect(left+i*11,y-6+(i%3)*5,9,2,tones[1]);
      if (trap.kind === 'lava') lightAt(ctx,x,y,35,'#ff763055');
    } else {
      const danger = stageHazardPose(trap);
      const {x:rockX, y:rockY} = scroll(danger);
      if (danger.active && trap.kind === 'falling') lightAt(ctx,x,y,20,'#ff9d6858');
      if (trap.kind === 'swing') {
        ctx.strokeStyle='#7b6b66'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x,y-61); ctx.lineTo(rockX,rockY-danger.height); ctx.stroke();
      }
      groundShadow(rockX,rockY,12,3);
      const lifted = rockY-danger.height;
      polygon([[rockX-11,lifted],[rockX-9,lifted-10],[rockX+2,lifted-17],[rockX+10,lifted-7],[rockX+8,lifted+2]],'#726c78');
      polygon([[rockX-9,lifted-10],[rockX+2,lifted-17],[rockX+5,lifted-10],[rockX-2,lifted-5]],'#9f908f');
    }
    if (closeTo(trap.x,trap.y,36)) label(hazardNames[trap.kind],x,y-23,'#ffe1af',11);
  }
  const mark = scroll(rune);
  const active = activatedRunes.has(chapter);
  if (mark.x > -28 && mark.x < 668) {
    const {x,y} = mark;
    if (!active && rune.spell.id === 'fire') polygon([[x-15,y],[x-10,y-22],[x-1,y-30],[x+12,y-21],[x+15,y]],'#85a9cb');
    if (!active && rune.spell.id === 'frost') rect(x-13,y-8,26,17,'#5995bca8');
    lightAt(ctx,x,y-7,active ? 29 : 16,rune.spell.color+'8a');
    diamond(x,y-9,6,8,rune.spell.color);
    if (active && rune.spell.id === 'wind') {
      for (let i=0;i<4;i++) {
        const drift = (clock*33 + i*17) % 61;
        diamond(x + Math.sin(clock+i)*11,y-drift,3,2,rune.spell.color);
      }
    }
    if (!active && closeTo(rune.x,rune.y,42)) label(rune.spell.name,x,y-37,rune.spell.color,11);
  }
  const shelf = stageSurface(path);
  if (shelf) {
    const {x,y} = scroll(shelf);
    if (x > -34 && x < 674) {
      const tone = shelf.stage === 'crumble' && stageCrumbles ? '#b48872' :
        shelf.stage === 'frost' ? '#a7ddf2' : '#ad9774';
      groundShadow(x,y,shelf.width,4);
      rect(x-shelf.width,y-shelf.height,shelf.width*2,6,tone);
      rect(x-shelf.width,y-shelf.height-2,shelf.width*2,2,'#e7dbc2');
    }
  }
  if (active && path.refuge) {
    const {x,y} = scroll(cache);
    lightAt(ctx,x,y-18,25,'#f3d49f83');
    polygon([[x-17,y+2],[x-14,y-18],[x-6,y-25],[x+12,y-24],[x+18,y+2]],'#746878');
    polygon([[x-10,y],[x-8,y-15],[x,y-20],[x+8,y-15],[x+11,y]],'#28243e');
    label('灯の抜け道',x,y-31,'#f7ddab',11);
  } else if (active && !stageClaims.has(chapter)) {
    const {x,y} = scroll(cache);
    const py = y-(['wind','earth','thunder'].includes(rune.spell.id) ? 15 : 0);
    lightAt(ctx,x,py-5,19,'#ffd772a8');
    rect(x-9,py-12,18,12,'#8e5838');
    rect(x-9,py-8,18,2,'#c99c51');
    rect(x-2,py-7,4,4,'#ffe2a1');
  }
  if (stageMagicEffect?.until > clock) {
    const {x,y} = scroll(stageMagicEffect);
    const size = 11 + (.78-(stageMagicEffect.until-clock))*51;
    lightAt(ctx,x,y-12,size,stageMagicEffect.color+'90');
    ctx.strokeStyle = stageMagicEffect.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x,y-12,size,size*.48,0,0,2*Math.PI); ctx.stroke();
  }
}

function drawOpaqueTerrain(chapter,camera) {
  const terrain = prefectures[chapter].terrain;
  const colors = {
    forest:['#55633f','#74704e','#3a493c'], coast:['#af976d','#b49d78','#7b7760'],
    mountain:['#7f7567','#82795d','#4a5147'], water:['#68684d','#8d8261','#4b5b51'],
    sand:['#a78355','#c39860','#89623e'], snow:['#c4c9c1','#a5b5b5','#748687'],
    river:['#6f7d52','#8d8660','#465f4d']
  }[terrain];
  const gradient = ctx.createLinearGradient(0,143,0,360);
  gradient.addColorStop(0,colors[0]); gradient.addColorStop(.38,colors[1]); gradient.addColorStop(1,colors[2]);
  ctx.save();
  ctx.beginPath();
  for (let x=-24;x<=675;x+=17) {
    const y = fieldY(clamp(camera+x,0,limit),31) + Math.sin((camera+x)*.021)*5;
    if (x === -24) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.lineTo(675,380); ctx.lineTo(-24,380); ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.clip();
  const offset = Math.floor(camera/20);
  for (let col=offset-1;col<offset+34;col++) {
    for (let row=0;row<7;row++) {
      const key = (col+322)*19 + row*173 + chapter*113;
      const x = col*20-camera+(key%17), y = 128+row*34+key%26;
      rect(x,y,4+key%12,1,key%2 ? '#fae2a546' : '#242d2938');
    }
  }
  ctx.restore();
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
  ctx.save();
  ctx.translate(0,-fieldCameraY);
  drawOpaqueTerrain(chapter,camera);
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
  drawTown(chapter,camera);
  drawPlatforms(chapter,camera);
  drawStage(stagePaths[chapter],camera);
  if (tourBook[chapter]?.photo) {
    const portal = townSites.get('regional-' + chapter);
    const x = portal.x-camera, y = fieldY(portal.x,portal.row);
    if (x > -40 && x < 680) {
      const icon = picture('landmark-5');
      if (icon) ctx.drawImage(icon,x-35,y-47,70,61);
      rect(x-11,y-18,22,21,'#292638');
      lightAt(ctx,x,y-13,35,'#b895f983');
      if (doorContact === portal || doorTransition?.site === portal) drawDoorHint(portal,camera);
    }
  }
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
    if (player.party.includes(npc.name) || Math.abs(npc.x - player.x) > 640) continue;
    drawCompanion(npc.name, npc.x - camera, fieldY(npc.x,104), .8, 1);
    label(npc.name, npc.x - camera, fieldY(npc.x,104) - 34);
  }
  for (const stone of waysideStones) {
    if (Math.abs(stone.x - player.x) > 640) continue;
    drawWaysideStone(stone,camera);
  }
  for (const enemy of activeEnemies(chapter)) {
    if (!enemy.hp || !enemyOnField(enemy)) continue;
    const x = enemy.x - camera, y = fieldY(enemy.x,enemy.y);
    monster(enemy,x,y,Math.min(1.38,combatBody(enemy).size*.73));
    if (!enemy.boss && enemy.slot === 4 && Math.abs(player.x-enemy.x) < 110) {
      label(encounterKind(enemy) === 'raid' ? '集団襲撃' : '強敵',x,y-40,'#ffc18e',10);
    }
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
  const followers = activeCompanions().map((member,index) => ({member,trail:partyTrail(member.name,index)}))
    .sort((a,b)=>a.trail.y-b.trail.y);
  for (const {member,trail} of followers) {
    drawPartyMember(member,trail.x-camera,fieldY(trail.x,trail.y)-(trail.height || 0),.9,
      Math.sign(player.x-trail.x) || player.facing.x,trail.height > 4 ? 2 :
      gait === 'idle' ? 0 : 1+Math.floor(clock*9)%2);
  }
  if (joined) drawCat(cat.x - camera, fieldY(cat.x,cat.y), .8);
  if (jumpHeight) rect(x - 7, fieldY(player.x,player.y) + 2, 14, 3, '#292735');
  if (clock < swingUntil && swingKind === 'afterimage' && !reducedMotion.matches) {
    ctx.globalAlpha = .3;
    hero(x - player.facing.x * 12, y, .9, player.facing.x);
    ctx.globalAlpha = 1;
  }
  drawRunningDust(camera);
  hero(x, y, .9, player.facing.x);
  if (jumpHeight < 28) {
    const site = towns[chapter].sites.find(place => place.kind !== 'secret' &&
      Math.abs(place.x - player.x) < 22 && player.y < place.row - 6 && player.y > place.row - 37);
    const leaves = layout.foliage.find(plant => Math.abs(plant.x-player.x) < plant.size*.44 &&
      plant.y > player.y && plant.y - player.y < plant.size*.8 && plant.type >= 2);
    if (site || leaves) {
      ctx.save();
      ctx.globalAlpha = .37;
      if (site) drawBuilding(site,camera);
      if (leaves) {
        ctx.fillStyle = tones[1];
        ctx.beginPath(); ctx.ellipse(leaves.x-camera,fieldY(leaves.x,leaves.y)-leaves.size*.6,
          leaves.size*.5,leaves.size*.39,.12,0,6.283); ctx.fill();
      }
      ctx.restore();
    }
  }
  skyEffects(ctx, chapter);
  if (clock < swingUntil) {
    const {x: dx, y: dy} = player.facing;
    polygon([[x, y - 9], [x + dx * 31 - dy * 10, y - 9 + dy * 31 + dx * 10],
      [x + dx * 26 + dy * 11, y - 9 + dy * 26 - dx * 11]], swingKind === 'charged' ? '#eaa4ff' : swingKind === 'combo' ? '#d9f7ff' : swingKind === 'air' ? '#95dfff' : '#fff1be');
  }
  ctx.restore();
}

function slashArc(x, y, face, distance, progress = clamp(1 - (swingUntil - clock) * 4, 0, 1)) {
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

function commandPose(actor, turn) {
  const action = turn.action;
  const facing = actor.enemy ? turn.side : -turn.side;
  const live = commandAlive(actor);
  const hit = clock < actor.hitUntil;
  const position = {x:actor.x - (hit ? facing * 5 : 0), y:actor.y, jump:0, face:facing, pose:0};
  if (!live) position.pose = 8;
  else if (hit) position.pose = 5;
  else if (turn.phase === 'victory' && !actor.enemy) position.pose = 7;
  else if (action?.actor === actor) {
    const {move,target} = action;
    const t = clamp((clock - action.start) / action.duration,0,1);
    const melee = ['strike','combo','leap'].includes(move.motion);
    const stretch = t < .36 ? t / .36 : t < .64 ? 1 : (1 - t) / .36;
    if (melee && target && !reducedMotion.matches) {
      const gap = Math.abs(target.x - actor.x);
      const standOff = clamp(target.enemy ? combatBody(target.enemy).size * 15 + 21 : 38, 35, gap - 9);
      const nextX = target.x - position.face * standOff;
      position.x += (nextX - actor.x) * stretch;
      position.y += (target.y - actor.y) * stretch;
      if (move.motion === 'leap') position.jump = Math.max(0, Math.sin(t * Math.PI) * 41);
    }
    if (melee) position.pose = t < .31 || t > .73 ? 1 + Math.floor(clock*14) % 2 :
      move.motion === 'leap' && t < .42 ? 2 : move.motion === 'combo' && Math.floor(t * 20) % 2 ? 2 : 3;
    else position.pose = move.motion === 'guard' ? 4 : move.motion === 'quake' ? 3 : 6;
  } else if (actor.guarding) position.pose = 4;
  return position;
}

function drawCommandEffect(action, positions) {
  if (!action) return;
  const t = clamp((clock - action.start) / action.duration,0,1);
  const from = positions.get(action.actor);
  const target = positions.get(action.target) || from;
  const {motion,element} = action.move;
  const hue = commandColors[element] || commandColors.無;
  if (motion === 'guard') {
    lightAt(ctx,from.x,from.y-24,33,'#9ee6e591');
    diamond(from.x + from.face * 13,from.y-17,10,17,'#a8eddfb0');
    return;
  }
  if (['magic','heal','limit'].includes(motion)) {
    const marks = t < .47 ? from : target;
    const radius = motion === 'limit' ? 49 + t * 40 : 15 + t * 24;
    lightAt(ctx,marks.x,marks.y-23,radius + 16,(motion === 'heal' ? '#9defb6' : hue) + 'a0');
    ctx.strokeStyle = motion === 'heal' ? '#a2f1bb' : hue;
    for (const size of [radius,radius*.67]) {
      ctx.beginPath();
      ctx.ellipse(marks.x,marks.y-10,size,size * .26,0,0,2*Math.PI);
      ctx.stroke();
    }
    if (t >= .25 && t <= .68 && motion !== 'heal') {
      const line = clamp((t - .25) / .22,0,1);
      ctx.lineWidth = motion === 'limit' ? 6 : 3;
      ctx.beginPath(); ctx.moveTo(from.x,from.y-33);
      ctx.lineTo(from.x + (target.x - from.x)*line,from.y-33 + (target.y-from.y)*line);
      ctx.stroke();
    }
    return;
  }
  if (t < .35 || t > .78) return;
  if (motion === 'quake') {
    ctx.strokeStyle = '#ffd7a0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(from.x,from.y,30+170*t,8+23*t,0,0,6.283); ctx.stroke();
    dustAt({x:from.x,y:(from.y-147)/.68,until:clock+.26});
    return;
  }
  slashArc(from.x,from.y-from.jump-26,from.face,motion === 'combo' ? 48 : 37,t);
  if (motion === 'combo') slashArc(from.x+from.face*14,from.y-from.jump-32,from.face,30,t);
  if (t > .47) {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      diamond(target.x + Math.cos(angle) * t * 52,target.y-28 + Math.sin(angle) * t * 42,2,3,hue);
    }
  }
}

function drawBattle() {
  const {command:turn, arena, enemy} = battle;
  drawArenaBackdrop(arena,enemy.chapter);
  const visibleFoes = turn.foes.filter(actor=>commandAlive(actor) ||
    actor.enemySlot.state === 'defeated' && clock-actor.enemySlot.fallenAt < .4);
  const group = [...visibleFoes,...turn.allies];
  const positions = new Map(group.map(actor => [actor,commandPose(actor,turn)]));
  ctx.save();
  combatCamera(ctx);
  const moving = turn.action;
  const shake = !reducedMotion.matches && moving?.move.motion === 'quake' && moving.hit ?
    Math.sin((clock - moving.start) * 73) * 4 : 0;
  const lowest = Math.max(...group.map(actor => actor.y));
  ctx.translate(shake,Math.min(0,Math.max(154,battleStageBottom)-lowest));
  const scale = battle.body.size >= 3.5 && battle.body.size < 9 ? .86 : 1;
  for (const actor of group.sort((a,b) => positions.get(a).y - positions.get(b).y)) {
    const {x,y,face,pose,jump} = positions.get(actor);
    const stats = actor.stats();
    if (actor.enemy) {
      const size = groupCombatBody(actor.enemySlot).size*scale*(actor.enemySlot.leader ? 1 : .83);
      monster(actor.enemy,x,y-jump,size,{face,pose});
      if (stats.unit.hp) {
        const labelY = Math.max(49,y - size * 42 - 9);
        const {leader,profile} = actor.enemySlot;
        const bar = leader ? 70 : 24;
        const phases = foePhaseCount(stats.unit);
        const name = phases > 1 ? actor.name+'・第'+foePhase(stats.unit)+'形態'+(actor.enemySlot.ward ? '　結界 '+actor.enemySlot.ward : '') :
          leader ? actor.name : actor.enemySlot.summoned ? '影狼' : profile.name;
        label(name,x,labelY,profile.color,leader ? 12 : 8);
        rect(x-bar/2,labelY+5,bar,3,'#221b35cc');
        rect(x-bar/2,labelY+5,bar*stats.unit.hp/stats.max,3,'#f19186');
        for (let mark=1; mark<phases; mark++) rect(x-bar/2+bar*mark/phases,labelY+5,1,3,'#221b35');
        if (actor.status) label(commandStatusNames[actor.status.type],x,labelY+20,'#d4ecff',10);
      }
    } else if (actor.id === 'cat') {
      drawCat(x,y-jump,(.87 + cat.form * .09) * scale,cat.form);
      if (turn.catGlowUntil > clock) drawCinematicEffect(ctx,x,y-20,cat.form === 5);
    } else {
      if (actor.id === 'hero' && turn.superAwake) lightAt(ctx,x,y-25,57,'#ffe67091');
      groundShadow(x,y,12,4);
      if (actor.member) drawPartyMember(actor.member,x,y-jump,scale,face,pose);
      else drawActor(actor.name,x,y-jump,scale,face,pose);
    }
  }
  if (turn.summon) {
    const leader = turn.allies[0];
    drawSummon(turn.summon.spirit,leader.x+turn.side*48,leader.y-27,1.12,turn.summon.glow>clock);
  }
  drawCommandEffect(turn.action,positions);
  for (const number of numbers) {
    if (!number.field) label(number.text,number.x,number.y - (1-(number.expires-clock)/.7)*24,number.color,16);
  }
  ctx.restore();
}

function drawFireballs(camera, arena = false) {
  if (!flameBolts.length) return;
  ctx.save();
  for (const bolt of flameBolts) {
    if (Boolean(bolt.arena) !== arena || bolt.chapter !== chapterOf(player.x)) continue;
    const x = bolt.x - camera;
    const y = (arena ? battleDepth(bolt.y) : fieldY(bolt.x,bolt.y)) - 19 - bolt.height * .54;
    lightAt(ctx,x,y,28,(bolt.tint || '#ff7631') + 'a0');
    const dx=bolt.direction.x, dy=bolt.direction.y*.68;
    polygon([[x-dx*20,y-dy*20],[x-dx*9+dy*7,y-dy*9-dx*7],[x+dx*7,y+dy*7],[x-dx*9-dy*7,y-dy*9+dx*7]],'#f38340c7');
    diamond(x,y,7,6,'#ffe5a5');
    diamond(x+1,y-1,3,3,'#fffbd1');
  }
  ctx.restore();
}

function drawWaysideStone(stone, camera) {
  const x = stone.x - camera, y = fieldY(stone.x, stone.row);
  const close = closeTo(stone.x, stone.row, 54);
  const gold = stone.solved;
  if (gold || close) lightAt(ctx,x,y - 15,30,gold ? '#f7c75d8a' : '#bfddfb70');
  groundShadow(x,y + 2,17,5);
  polygon([[x-13,y],[x-10,y-29],[x-3,y-36],[x+10,y-33],[x+15,y-6],[x+11,y+2]], gold ? '#8e6740' : '#393a55');
  polygon([[x-9,y-4],[x-7,y-28],[x-2,y-32],[x+7,y-29],[x+10,y-5]], gold ? '#d6a766' : '#727b97');
  rect(x-12,y-5,25,6,gold ? '#aa7f46' : '#4c4d65');
  diamond(x,y-21,4,7,gold ? '#fff0a4' : close ? '#d6ebff' : '#939fbc');
  for (let row = 0; row < 2; row++) rect(x-4,y-12+row*3,8,1,gold ? '#fbe7a8' : '#b7bdd4');
  if (close) label(gold ? '正解済み' : '剣で調べる',x,y-42,gold ? '#fff0aa' : '#e1edff',12);
  const chest = stone.reward.chest;
  if (!chest || !stone.rewarded || stone.claimed) return;
  const cx = chest.x - camera, cy = fieldY(chest.x,chest.row);
  lightAt(ctx,cx,cy-8,26,'#ffe48786');
  groundShadow(cx,cy+2,14,4);
  rect(cx-12,cy-16,24,16,'#594031');
  rect(cx-10,cy-15,20,7,'#ac663d');
  rect(cx-11,cy-8,22,8,'#845533');
  rect(cx-12,cy-9,24,2,'#f1bd68');
  rect(cx-2,cy-8,4,4,'#ffe59e');
}

canvas.addEventListener('click', event => {
  if (!movementAllowed() || mode !== 'field' || interior || innScene) return;
  const point = canvasPoint(event.clientX,event.clientY);
  const x = point.x + fieldCamera;
  const y = point.y + fieldCameraY;
  for (const stone of waysideStones) {
    const chest = stone.reward.chest;
    if (chest && stone.rewarded && !stone.claimed && closeTo(chest.x,chest.row,54) &&
        Math.abs(chest.x - x) <= 17 && Math.abs(fieldY(chest.x,chest.row) - 8 - y) <= 15) {
      claimStoneChest(stone);
      return;
    }

  }
});

function renderScene() {
  if (bathScene) return drawBathStay();
  if (innScene) return drawInnStay();
  if (interior && mode === 'field') return drawInterior();
  const chapter = chapterOf(player.x);
  const camera = fieldCamera;
  if (mode === 'title' || mode === 'home') drawHome();
  else if (battle) {
    if (battle.command) drawBattle();
    else {
      drawArenaBackdrop(battle.arena,battle.enemy.chapter);
      drawActionBattle();
    }
  }
  else drawField(chapter,camera);
  if (mode === 'field') ctx.translate(0,-fieldCameraY);
  drawFireballs(camera);
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
    const x = player.x - camera;
    const y = fieldY(player.x,player.y) - 10;
    ctx.globalAlpha = Math.min(.8, (burstUntil - clock) * 2);
    ctx.strokeStyle = '#ffe4a4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (1 - (burstUntil - clock) / .55) * 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
  const realTime = previousFrame === null ? 0 : Math.min((timestamp-previousFrame)/1000,.5);
  const elapsed = Math.min(realTime,.05);
  previousFrame = timestamp;
  const moment = cinemaMoment();
  const timeScale = battle?.hitStop > timestamp ? .20 : moment?.kind === 'impact' && moment.progress < .38 ? .52 : 1;
  if (!document.hidden) {
    update(elapsed*timeScale,realTime);
    advanceInn(elapsed);
    advanceBath(elapsed);
    const lookAhead = (player.facing.x || 0) * (gait === 'run' || gait === 'dash' ? 33 : 12);
    const target = clamp(player.x - 265 + lookAhead,-85,limit - 515);
    const aimY = mode === 'field' && !interior ? -Math.min(24, jumpHeight * .32) : 0;
    fieldCameraY = reducedMotion.matches ? 0 : fieldCameraY + (aimY - fieldCameraY) * (1 - Math.exp(-elapsed * 8));
    fieldCamera = Math.abs(fieldCamera - target) > 350 || reducedMotion.matches ?
      target : fieldCamera + (target - fieldCamera) * (1 - Math.exp(-elapsed * 9));
  }
  const frameInterval = artQuality === 'low' ? 47 : artQuality === 'medium' ? 24 : 15;
  if (!document.hidden && timestamp - lastDraw >= frameInterval) {
    ctx.setTransform(1,0,0,1,0,0);
    renderScene();
    presentScene();
    lastDraw = timestamp;
  }
  if (timestamp - lastUI > 55) {
    updateUI();
    lastUI = timestamp;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',() => { previousFrame = null; });
