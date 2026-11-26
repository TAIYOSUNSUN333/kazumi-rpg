// Artwork is loaded on demand and reused throughout the session.
const artwork = new Map();
const artMotion = matchMedia('(prefers-reduced-motion: reduce)');
const qualityModes = ['low','medium','high'];
let artQuality = 'medium';
try {
  const savedQuality = localStorage.getItem('kazumi-quality');
  if (qualityModes.includes(savedQuality)) artQuality = savedQuality;
} catch {}

function picture(id) {
  if (!artwork.has(id)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = 'assets/' + id + '.webp';
    artwork.set(id, image);
  }
  const image = artwork.get(id);
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function graphicsSettings() {
  const label = document.createElement('label');
  label.className = 'quality-setting';
  const select = document.createElement('select');
  for (const [id, title] of [['high','高'], ['medium','中'], ['low','低']]) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = title;
    select.append(option);
  }
  select.value = artQuality;
  select.onchange = () => {
    artQuality = select.value;
    try { localStorage.setItem('kazumi-quality', artQuality); } catch {}
  };
  label.append('画質 ', select);
  $('panel-body').append(label);
}

const knownActors = new Map([['一美',0],['一郎',1],['恵美ちゃん',2],['タク',3],['クルミ',4],['ソソ',5]]);
function actorRow(name) {
  if (name === 'クルミ') return 4;
  if (knownActors.has(name)) return knownActors.get(name);
  const regional = prefectures.findIndex(region => region.companion === name);
  return regional < 0 ? 5 : 5 + regional % 3;
}

function decoratePanel(title) {
  const parent = $('panel-body');
  const frame = document.createElement('img');
  frame.loading = 'lazy';
  frame.decoding = 'async';
  let source = null;
  if (title === '第10章クリア・ソソが仲間になった') source = 'story-0';
  else if (title === 'おかえり、ソソ') source = 'story-1';
  if (source) {
    frame.className = 'event-art';
    frame.src = 'assets/' + source + '.webp';
    frame.alt = title === 'おかえり、ソソ' ? '朝日に包まれた家で、ソソと一美が寄り添って休む' :
      '天文台の星明かりの下で一美がソソを抱きしめる';
    parent.prepend(frame);
    return;
  }

  const character = [...knownActors.keys()].find(name => title.startsWith(name + 'を') || title.startsWith(name + 'と')) ||
    (title === '仲間とのひととき' ? currentCompanion()?.name : null) ||
    (title === 'ソソは倒れた' ? 'ソソ' : null) ||
    (/^(小さな家の朝|若草山から続く道|世界に朝が戻った|一美は倒れた)/.test(title) ? '一美' : null);
  if (!character) return;
  const portrait = knownActors.get(character);
  const mood = /別れ|倒れ/.test(title) ? 'solemn' : /ひととき/.test(title) ? 'warm' : 'calm';
  if (portrait !== undefined) {
    const expressions = {'小さな家の朝':3,'若草山から続く道':2,'世界に朝が戻った':0,'一美は倒れた':1};
    frame.src = 'assets/' + (character === '一美' && title in expressions ? 'emotion-' + expressions[title] : 'portrait-' + portrait) + '.webp';
    frame.alt = character;
    frame.className = 'dialogue-art';
    frame.dataset.mood = mood;
    parent.prepend(frame);
  } else {
    const preview = document.createElement('div');
    preview.className = 'dialogue-art regional-portrait';
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', character);
    preview.style.setProperty('--pose-row', actorRow(character));
    preview.style.setProperty('--pose-col', mood === 'solemn' ? 5 : mood === 'warm' ? 7 : 0);
    parent.prepend(preview);
  }
}

const artBackground = {forest:0,mountain:0,coast:1,water:1,river:1,sand:2,snow:3};
function landmarkFor(region) {
  if (/鳥居|寺|神宮|天満宮|社/.test(region.sight)) return 0;
  if (/城|武家|屋敷/.test(region.sight)) return 1;
  if (/温泉|町|宿|古道|並木/.test(region.sight)) return 2;
  if (/橋|川|湖|松島|海峡/.test(region.sight)) return 3;
  if (/公園|庭園|兼六園|偕楽園/.test(region.sight)) return 4;
  if (['forest','river','water','snow','coast','sand','mountain'].includes(region.terrain)) {
    return {forest:4,river:3,water:3,snow:2,coast:5,sand:5,mountain:5}[region.terrain];
  }
  return 5;
}

function coverArt(g, image, x, y, w, h, drift = 0) {
  const scale = Math.max((w + Math.abs(drift) * 2) / image.naturalWidth, h / image.naturalHeight);
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
  g.drawImage(image, x + (w - width) / 2 + drift, y + (h - height) / 2, width, height);
}

function landscapeVariant(chapter, cave = false) {
  const region = prefectures[chapter];
  const featured = {'東京都':8,'静岡県':9,'長崎県':10,'北海道':11};
  if (!cave && Object.hasOwn(featured,region.name)) return featured[region.name];
  const southern = /沖縄|鹿児島|宮崎|長崎/.test(region.name);
  return cave ? 2 : southern && region.terrain === 'coast' ? 7 :
    region.terrain === 'river' ? 5 : region.terrain === 'sand' ? 6 :
    region.terrain === 'forest' && chapter > 6 ? 4 : artBackground[region.terrain];
}

function landscapeImage(chapter, cave = false) {
  if (!cave && prefectures[chapter].name === '大阪府') return 'arena-market';
  return 'land-' + landscapeVariant(chapter,cave);
}
function landscapeArt(g, chapter, camera, cave = false) {
  const image = picture(landscapeImage(chapter,cave));
  if (!image) return false;
  g.save();
  g.imageSmoothingEnabled = artQuality !== 'low';
  coverArt(g, image, 0, 0, 640, 360, cave ? 0 : Math.sin(camera / 390) * 22);
  g.restore();
  return true;
}

function lightAt(g, x, y, radius, color) {
  if (artQuality === 'low') return;
  const bloom = g.createRadialGradient(x, y, 1, x, y, radius);
  bloom.addColorStop(0, color);
  bloom.addColorStop(1, 'transparent');
  g.fillStyle = bloom;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function ageLight(g) {
  const hour = townHour();
  const tint = hour < 5 || hour >= 20 ? '#14294e69' :
    hour < 8 ? '#f2ba7a33' : hour >= 17 ? '#d68c624d' : '#b1d1ce14';
  g.fillStyle = tint;
  g.fillRect(0, 0, 640, 360);
  if (artQuality === 'low') return;
  const day = hour >= 5 && hour < 20;
  const cycle = day ? (hour - 5) / 15 : (hour >= 20 ? hour - 20 : hour + 4) / 9;
  const x = 85 + Math.min(1, cycle) * 474, y = 110 - Math.sin(cycle * Math.PI) * 71;
  lightAt(g,x,y,day ? 99 : 55,day ? '#fbd6974c' : '#c5cfff58');
  if (!day) {
    g.fillStyle = '#fff0d3ad';
    g.beginPath();g.arc(x,y,8,0,6.283);g.fill();
    for (let i=0;i<16;i++) g.fillRect((i * 139 + 17)%620,(i * 31 + 8)%114,1,1);
  }
}

const weatherPoints = Array.from({length:72}, (_, i) => ({
  x: (i * 193 + 51) % 647, y: (i * 131 + 11) % 373, speed: (i * 29 % 41) + 20
}));
function skyEffects(g, chapter, forced) {
  if (artQuality === 'low') return;
  const weather = forced || fieldWeather(chapter);
  const wet = weather === 'rain' || weather === 'thunder';
  const time = artMotion.matches ? 0 : clock;
  if (weather === 'mist' || weather === 'cloud') {
    for (let i = 0; i < 3; i++) {
      const x = (time * (i + 3) + i * 255) % 820 - 92;
      lightAt(g, x, (weather === 'mist' ? 140 : 38) + i * 9, 85, '#dce4e43d');
    }
    return;
  }
  g.save();
  if (weather === 'thunder' && artQuality === 'high' && !artMotion.matches && time % 11 > 10.92) {
    g.fillStyle = '#c3c6f329';
    g.fillRect(0,0,640,360);
  }
  g.fillStyle = weather === 'snow' ? '#f5f0e9bd' : '#bdccd886';
  const count = artQuality === 'high' ? 72 : 30;
  for (let i = 0; i < count; i++) {
    const point = weatherPoints[i];
    const x = ((point.x - time * point.speed * .28) % 652 + 652) % 652;
    const y = (point.y + time * point.speed * (wet ? 3.7 : .88)) % 375;
    g.fillRect(x, y, weather === 'snow' && i % 4 === 0 ? 2 : 1, wet ? 9 : 2);
  }
  g.restore();
}

let battleCinema = null;
function startCinema(kind) {
  if (artMotion.matches || artQuality === 'low') return;
  battleCinema = {kind, start:performance.now(), duration:kind === 'awakening' ? 1150 : 580};
}
function cinemaMoment() {
  if (!battleCinema) return null;
  const progress = (performance.now() - battleCinema.start) / battleCinema.duration;
  return progress < 1 ? {...battleCinema, progress} : null;
}

function combatCamera(g) {
  const moment = cinemaMoment();
  if (!moment || !battle) return;
  const t = moment.progress;
  const wave = Math.sin(Math.PI * t);
  const zoom = 1 + wave * (moment.kind === 'awakening' ? .10 : .064);
  const shake = moment.kind === 'impact' ? Math.sin(t * 49) * 3 * (1 - t) : 0;
  g.translate(320 + shake, 195);
  g.scale(zoom, zoom);
  g.translate(-320, -195);
}

function drawCinematicEffect(g, x, y, special = false) {
  const moment = cinemaMoment();
  if (!moment) return;
  const t = moment.progress;
  const hue = moment.kind === 'awakening' || special ? '#ffe5a8' : '#cdeaff';
  g.save();
  g.globalAlpha *= (1 - t) * .84;
  g.strokeStyle = hue;
  g.fillStyle = hue;
  g.lineWidth = 2;
  for (const inset of [13, 0]) {
    g.beginPath();
    g.ellipse(x, y, 20 + t * 98 - inset, 15 + t * 75 - inset, 0, 0, Math.PI * 2);
    g.stroke();
  }
  const count = artQuality === 'high' ? 24 : 12;
  for (let i = 0; i < count; i++) {
    const angle = i * (Math.PI * 2 / count);
    const distance = t * (78 + i % 3 * 15);
    const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
    g.fillRect(px, py, i % 3 === 0 ? 3 : 1, i % 3 === 0 ? 3 : 2);
  }
  g.restore();
  lightAt(g, x, y, 90, special ? '#ffbc534c' : '#babdf343');
}

function arenaZoom() {
  return battle.body.size >= 6 ? .82 : battle.body.size >= 3.5 ? .92 : 1;
}

function drawArenaBackdrop(kind, chapter) {
  const art = picture('arena-' + kind);
  ctx.fillStyle = '#1c243a';
  ctx.fillRect(0,0,640,360);
  if (art) coverArt(ctx,art,0,0,640,360,(battle.heroX - 320) * .034);
  else landscapeArt(ctx,chapter,0,['cave','ruins','temple'].includes(kind));
  const region = prefectures[chapter];
  const season = Math.floor(townDay() / 30) % 4;
  const daylight = townHour();
  const indoor = ['cave','castle','temple','otherworld'].includes(kind);
  if (!indoor) ageLight(ctx);
  const floor = ctx.createLinearGradient(0,171,0,357);
  floor.addColorStop(0,'#1b1d3000');
  floor.addColorStop(.45,'#24243960');
  floor.addColorStop(1,'#151929bf');
  ctx.fillStyle = floor;
  ctx.fillRect(0,171,640,186);
  ctx.fillStyle = region.color + ['18','0e','29','35'][season];
  ctx.fillRect(0,0,640,360);
  if (!indoor) {
    const motif = picture('landmark-' + landmarkFor(region));
    if (motif && artQuality !== 'low' && ['forest','grass','market','city','coast','snow'].includes(kind)) {
      ctx.globalAlpha = .69;
      ctx.drawImage(motif,23,115,75,78);
      ctx.globalAlpha = 1;
    }
    skyEffects(ctx,chapter,kind === 'snow' ? 'snow' : null);
    if (daylight >= 6 && daylight < 17) lightAt(ctx,470,72,128,'#ffe1a44c');
    if (kind === 'coast') {
      for (let row=0;row<4;row++) {
        const drift = artMotion.matches ? 0 : Math.sin(clock * 1.25 + row) * 16;
        ctx.fillStyle = '#e5f2ee6e';
        ctx.fillRect(50 + row * 137 + drift,156 + row * 6,48,1);
      }
    }
  } else if (kind === 'volcano' || kind === 'temple') {
    lightAt(ctx,499,143,134,kind === 'volcano' ? '#f0724e53' : '#ffd78f53');
  }
  ctx.fillStyle = '#1c21359e';
  ctx.fillRect(269,12,102,19);
  label(region.name,320,26,'#efd7a8',11);
}
