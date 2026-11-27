// Original procedural art. Rendering randomness is independent of gameplay.
const variantCache = new Map();
const creatureKinds = ['獣','甲虫','翼竜','鬼','海獣','樹霊','精霊','機巧','巨人','亡者','妖狐','飛翔獣'];
const artPalettes = [
  ['#211932','#744b73','#d68c95','#ffe1aa'],['#152a33','#376872','#83bd9f','#d7eabd'],
  ['#25243b','#525c92','#a8addd','#f3d8f2'],['#2c222b','#995757','#ddaa6c','#ffe7bb'],
  ['#142938','#31648a','#71b6c5','#e4f0da'],['#26263c','#797a57','#bceb8e','#faf2bd'],
  ['#3c2639','#8c5278','#cb95c7','#ffe8db']
];
const terrainCreatures = {
  forest:[0,1,5,6,10], mountain:[8,2,3,7,11], coast:[4,11,2,6,1],
  water:[4,6,5,11,7], river:[4,10,0,1,5], snow:[0,9,2,8,6], sand:[1,7,9,3,2]
};

function visualSeed(text) {
  let hash = 2166136261;
  for (const letter of String(text)) hash = Math.imul(hash ^ letter.codePointAt(0),16777619);
  return hash>>>0;
}

function visualRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;
  };
}

function cachedCanvas(key,width,height,paint) {
  if (variantCache.has(key)) {
    const hit=variantCache.get(key);
    variantCache.delete(key); variantCache.set(key,hit);
    return hit;
  }
  const canvas=document.createElement('canvas');
  canvas.width=width; canvas.height=height;
  paint(canvas.getContext('2d'));
  variantCache.set(key,canvas);
  const budget=artQuality === 'low' ? 38 : 84;
  while (variantCache.size > budget) variantCache.delete(variantCache.keys().next().value);
  return canvas;
}

function artInk(g,color,points) {
  g.beginPath();
  g.moveTo(...points[0]);
  for (let i=1;i<points.length;i++) g.lineTo(...points[i]);
  g.closePath(); g.fillStyle=color; g.fill();
}

function artOval(g,color,x,y,w,h,angle=0) {
  g.beginPath(); g.ellipse(x,y,w,h,angle,0,Math.PI*2); g.fillStyle=color; g.fill();
}

function anatomyFor(enemy) {
  const seed=visualSeed([enemy.chapter,enemy.slot,enemy.variant,enemy.hiddenRegion,enemy.trial,enemy.name].join('/'));
  const region=prefectures[enemy.chapter] || prefectures[0];
  const group=terrainCreatures[region.terrain] || terrainCreatures.forest;
  const kind=enemy.boss ? (seed>>>5)%creatureKinds.length : group[(seed>>>9)%group.length];
  return {seed,kind,group:creatureKinds[kind]};
}

function creatureArt(enemy) {
  const {seed,kind}=anatomyFor(enemy);
  return cachedCanvas('creature:'+seed,112,96,g => {
    const pick=visualRandom(seed);
    const [shadow,body,trim,light]=artPalettes[Math.floor(pick()*artPalettes.length)];
    const tall=14+pick()*13, long=19+pick()*16, head=8+pick()*6, detail=2+Math.floor(pick()*5);
    g.translate(55,83);
    if (enemy.boss) {
      artOval(g,trim+'30',0,-37,43,34);
      for (let i=0;i<detail;i++) {
        const x=(i-(detail-1)/2)*13;
        artInk(g,light+'b0',[[x,-67],[x+3,-74],[x+6,-67],[x+3,-63]]);
      }
    }
    switch(kind) {
      case 0:
      case 10:
        for (const x of [-17,-6,9,22]) artInk(g,shadow,[[x-3,-23],[x+5,-22],[x+4,-4],[x+9,-1],[x-4,-1]]);
        artInk(g,trim,[[19,-27],[44,-42],[37,-23],[20,-16]]);
        if (kind===10) {
          artInk(g,light,[[19,-29],[43,-49],[37,-33],[48,-39],[41,-22]]);
          artInk(g,trim,[[20,-23],[43,-16],[38,-10],[18,-13]]);
        }
        artOval(g,shadow,0,-23,long+3,18); artOval(g,body,0,-27,long,14); artOval(g,trim,-25,-34,head,14);
        artInk(g,shadow,[[-36,-35],[-48,-29],[-35,-24],[-23,-29]]);
        artInk(g,body,[[-31,-40],[-41,-62],[-23,-45],[-20,-60],[-14,-39]]);
        break;
      case 1:
        for (let i=0;i<detail+2;i++) {
          const x=-28+i*56/(detail+1);
          artInk(g,shadow,[[x,-20],[x-13,-11],[x-14,-2],[x-9,-3],[x+5,-17]]);
          artInk(g,trim,[[x,-24],[x+12,-10],[x+16,-5],[x+11,-6],[x,-15]]);
        }
        artOval(g,shadow,6,-27,long+4,tall*.8); artOval(g,body,6,-32,long,tall*.73);
        for (let i=0;i<5;i++) artOval(g,trim,(-9+i*9),-34,2,9-i);
        artOval(g,trim,-29,-24,head,11);
        artInk(g,shadow,[[-31,-29],[-47,-51],[-42,-30],[-31,-20]]);
        break;
      case 2:
      case 11:
        artInk(g,shadow,[[-6,-34],[-15,-69],[13,-59],[45,-76],[35,-47],[39,-21],[18,-29]]);
        artInk(g,trim,[[2,-39],[-8,-64],[11,-54],[38,-68],[28,-45],[30,-31],[13,-40]]);
        if (kind===11) for (let i=0;i<5;i++) artInk(g,light+'c0',[[18+i*4,-53],[41+i*2,-63],[33+i,-47]]);
        artInk(g,shadow,[[12,-31],[39,-20],[49,-7],[37,-13],[13,-15]]);
        artOval(g,body,0,-24,long*.83,14,-.14); artOval(g,trim,-26,-34,head,13);
        artInk(g,shadow,[[-24,-40],[-30,-62],[-15,-44]]);
        artInk(g,light,[[-34,-37],[-47,-33],[-37,-27]]);
        break;
      case 4:
        artInk(g,shadow,[[15,-43],[45,-67],[45,-31],[39,-14],[16,-26]]);
        artInk(g,trim,[[23,-43],[44,-59],[40,-32],[44,-19],[24,-31]]);
        artOval(g,shadow,-5,-35,long+9,22); artOval(g,body,-7,-39,long+6,18);
        artInk(g,trim,[[-13,-51],[7,-68],[19,-49]]); artInk(g,trim,[[0,-37],[14,-29],[9,-14],[-6,-29]]);
        for (let i=0;i<detail;i++) artOval(g,light,2+i*4,-44+(i%2)*6,2,2);
        break;
      case 5:
      case 6:
        for (let i=0;i<detail;i++) {
          const a=i*Math.PI*2/detail;
          const x=Math.cos(a)*27, y=-40+Math.sin(a)*24;
          artInk(g,i%2 ? body : trim,[[0,-43],[x-5,y-2],[x*1.55,y-13],[x+5,y+3]]);
        }
        artOval(g,shadow,0,-39,long*.72,tall); artOval(g,body,-4,-42,long*.68,tall*.86);
        if (kind===5) {
          artInk(g,shadow,[[-14,-23],[-34,-2],[-11,-4],[2,-21],[18,-3],[31,-3],[14,-27]]);
          artOval(g,trim,-18,-59,17,7,-.4); artOval(g,trim,15,-57,17,6,.29);
        } else {
          artOval(g,trim,0,-43,15,16);
          for (let i=0;i<5;i++) artOval(g,light,-22+i*11,-18-i%2*6,2.5,2.5);
        }
        break;
      default: {
        const square=kind===7, width=kind===8 ? 27 : kind===9 ? 13 : 20;
        for (const side of [-1,1]) {
          const x=side*width*.58;
          artInk(g,shadow,[[x-6,-29],[x+6,-30],[x+7,-4],[x+11,0],[x-10,0],[x-8,-9]]);
          artInk(g,body,[[side*width,-49],[side*(width+10),-42],[side*(width+15),-19],[side*(width+6),-15],[side*(width+1),-31]]);
        }
        const shoulders=square ? width+5 : width;
        artInk(g,shadow,[[-shoulders,-51],[shoulders,-51],[width-3,-25],[-width+4,-25]]);
        artInk(g,body,[[-shoulders+2,-50],[shoulders-2,-49],[width-6,-28],[-width+6,-32]]);
        if (square) {
          g.fillStyle=trim;g.fillRect(-13,-70,26,23);
          g.fillStyle=shadow;g.fillRect(-10,-67,20,10);
          for (let i=0;i<detail;i++) g.fillRect(-width+5+i*5,-48,2,14);
        } else {
          artOval(g,kind===9 ? light : trim,0,-60,head,tall*.7);
          if (kind===3) artInk(g,shadow,[[-11,-65],[-24,-79],[-19,-57],[15,-58],[23,-82],[10,-65]]);
          if (kind===9) for (let i=0;i<4;i++) {g.fillStyle=trim;g.fillRect(-10,-49+i*5,20-i,2);}
        }
      }
    }
    const animalEye=[0,1,2,4,10,11].includes(kind);
    const eyex=animalEye ? -26 : -5;
    const eyey=animalEye ? kind===4 ? -40 : kind===1 ? -26 : -35 : kind===5 || kind===6 ? -43 : -61;
    artOval(g,shadow,eyex,eyey,5,3); artOval(g,light,eyex-1,eyey,2.6,1.8);
    if (!animalEye) artOval(g,light,eyex+10,eyey,2.4,1.8);
    for (let i=0;i<detail;i++) artOval(g,trim,pick()*30-15,pick()*6-34,pick()*2+1,1.4);
  });
}

const hairShapes = [
  [[-11,-40],[-11,-57],[8,-60],[15,-53],[14,-34],[8,-43],[-9,-42]],
  [[-15,-38],[-15,-59],[-1,-65],[12,-59],[15,-47],[10,-36],[7,-48],[-10,-51]],
  [[-14,-39],[-18,-58],[-11,-65],[0,-61],[9,-66],[16,-57],[15,-38],[9,-46],[-10,-45]],
  [[-17,-41],[-12,-62],[5,-65],[15,-55],[22,-42],[17,-38],[11,-49],[-11,-49]],
  [[-15,-31],[-15,-57],[-7,-65],[10,-62],[15,-52],[14,-29],[9,-38],[-9,-47]],
  [[-13,-45],[-18,-59],[-2,-56],[2,-69],[8,-59],[18,-64],[15,-45],[8,-51],[-8,-52]]
];

function personArt(name, pose=0, portrait=false, mood='calm') {
  const seed=visualSeed(name);
  return cachedCanvas('person:'+seed+'/'+pose+'/'+portrait+'/'+mood,92,96,g => {
    const [shadow,cloth,trim,light]=artPalettes[seed%artPalettes.length];
    const skin=['#f2cca7','#c89472','#ddab88','#ad775e'][(seed>>>5)%4];
    const hair=['#37283d','#593c37','#764746','#534861','#654a3e'][(seed>>>9)%5];
    const profile=companionProfiles[name];
    const width=12+(seed>>>13)%7;
    const stride=pose === 1 ? 5 : pose === 2 ? -5 : 0;
    if (portrait) {
      g.fillStyle=shadow;g.fillRect(0,0,92,96);
      artOval(g,trim+'65',48,42,35,35);
      for(let i=0;i<5;i++) artOval(g,light+'90',10+i*17,12+(i*11)%19,1.5,1.5);
    }
    g.translate(46,portrait ? 104 : 90);
    if (portrait) g.scale(1.26,1.26);
    if (pose===8) { g.translate(0,-18); g.rotate(-.9); }
    g.fillStyle=shadow;
    g.fillRect(-width*.64+stride,-14,8,14); g.fillRect(width*.64-8-stride,-14,8,14);
    artInk(g,cloth,[[-width,-37],[width,-37],[width+3,-13],[-width-3,-13]]);
    artInk(g,profile?.color || trim,[[-width,-37],[-3,-33],[5,-16],[-width+2,-16]]);
    g.fillStyle=light;g.fillRect(-width,-19,width*2,3);
    artOval(g,skin,-width-1,-27,5,7);artOval(g,skin,width+1,-27,5,7);
    artInk(g,hair,hairShapes[(seed>>>17)%hairShapes.length]);
    artOval(g,skin,0,-46,12,14);
    artInk(g,hair,[[-13,-49],[-13,-58],[-7,-63],[7,-62],[14,-54],[10,-50],[2,-56],[-3,-50],[-8,-54]]);
    if (profile?.role==='heal' || seed%5===0) {
      artOval(g,light,11,-58,3,4);artOval(g,trim,14,-55,3,2);
    }
    g.fillStyle=shadow;
    const close=mood==='warm' || pose===7;
    g.fillRect(-7,-48,4,close ? 1 : 3);g.fillRect(4,-48,4,close ? 1 : 3);
    if (mood==='solemn' || pose===5) artInk(g,shadow,[[-4,-36],[0,-39],[4,-36],[0,-37]]);
    else artOval(g,close ? '#9b4c58' : shadow,0,-39,close ? 4 : 2,close ? 2 : 1.2);
    if (mood==='warm' || mood==='romance') {
      artOval(g,'#c46f6880',-8,-43,3,1.5);artOval(g,'#c46f6880',8,-43,3,1.5);
    }
    if (mood==='surprised') artOval(g,shadow,0,-39,2,3);
  });
}

function localBackdrop(chapter,season) {
  return cachedCanvas('scenery:'+chapter+'/'+season,320,88,g => {
    const region=prefectures[chapter], random=visualRandom(visualSeed(region.name+season));
    const dark=['#3c6b65b0','#396e65b0','#77546bb0','#536586b0'][season];
    const glow=['#d8a5bba0','#95c3a0a0','#d8b171a0','#ccd8e7a0'][season];
    const terrain=region.terrain;
    for (let i=0;i<12;i++) {
      const x=i*29+random()*17-18, y=55+random()*30;
      if (['mountain','snow','sand'].includes(terrain)) {
        const peak=15+random()*27;
        artInk(g,dark,[[x-19,y],[x,y-peak],[x+26,y]]);
        if (terrain==='snow' || season===3) artInk(g,glow,[[x-7,y-peak*.63],[x,y-peak],[x+9,y-peak*.64]]);
      } else if (['coast','water','river'].includes(terrain)) {
        artOval(g,dark,x,y,23,4);
        artOval(g,glow,x+10,y-4,13,2);
        if(i%3===0) artInk(g,dark,[[x-7,y-6],[x+9,y-6],[x+6,y-1],[x-4,y-1],[x-3,y-6],[x+1,y-20],[x+5,y-7]]);
      } else {
        g.fillStyle=dark;g.fillRect(x-2,y-18,4,22);
        artOval(g,dark,x,y-22,12,15);artOval(g,glow,x-5,y-29,6,5);
      }
    }
    // A regional landmark silhouette follows terrain and the gazetteer entry.
    const x=49+Math.floor(random()*226), y=67;
    const motif=landmarkFor(region);
    g.fillStyle=dark;
    if (motif===0) {
      g.fillRect(x-13,y-23,4,23);g.fillRect(x+9,y-23,4,23);
      artInk(g,dark,[[x-20,y-24],[x-15,y-29],[x+16,y-29],[x+21,y-24]]);
      g.fillRect(x-16,y-19,32,3);
    } else if (motif===1 || motif===2) {
      for (let floor=0;floor<3;floor++) {
        const width=17-floor*5, height=y-floor*9;
        g.fillRect(x-width,height-7,width*2,9);
        artInk(g,dark,[[x-width-4,height-7],[x-3,height-14],[x+4,height-14],[x+width+4,height-7]]);
      }
    } else {
      artOval(g,dark,x,y,21,9);
      for(let post=-15;post<=15;post+=5) g.fillRect(x+post,y-8,2,13);
      if (motif===5) artInk(g,glow,[[x-2,y-8],[x+2,y-25],[x+5,y-9]]);
    }
  });
}

function paintFacade(site,x,y) {
  if (site.kind==='secret') return;
  const seed=visualSeed(site.id);
  const image=cachedCanvas('facade:'+site.id,60,62,g => {
    const paint=townTypes[site.kind][4];
    const kind=(seed>>>4)%8;
    g.translate(30,48);
    switch(kind) {
      case 0: artInk(g,'#584054',[[6,-22],[8,-34],[15,-35],[15,-18]]); break;
      case 1:
        g.strokeStyle='#563c4b';g.lineWidth=1;
        for (const x of [-16,11]) { g.beginPath();g.moveTo(x,-3);g.lineTo(x+5,-18);g.stroke(); }
        break;
      case 2:
        artInk(g,paint,[[-14,-30],[-8,-48],[-3,-31]]);
        g.fillStyle='#51404e';g.fillRect(-13,-30,9,16);break;
      case 3:
        g.fillStyle='#624b49'; g.fillRect(-24,-2,48,3);
        for(let post=-22;post<=22;post+=5) g.fillRect(post,-8,2,9);
        break;
      case 4:
        g.strokeStyle='#e3ba8b';g.lineWidth=2;g.beginPath();g.arc(0,-8,7,Math.PI,0);g.stroke();break;
      case 5:
        for(let i=0;i<6;i++) {
          const x=-19+i*6;
          artInk(g,i%2 ? '#e4be94' : paint,[[x,-15],[x+6,-15],[x+7,-8],[x,-8]]);
        }
        break;
      case 6:
        for(const x of [-19,17]) {
          g.fillStyle='#6c4b4b';g.fillRect(x,-11,4,9);artOval(g,'#efbf82',x+2,-8,3,5);
        }
        break;
      case 7:
        g.fillStyle='#704d52';g.fillRect(-11,-40,5,15);
        g.fillStyle='#e2bc8c';g.fillRect(-13,-42,9,3);break;
    }
  });
  ctx.drawImage(image,x-30,y-48);
}

function sosoFormArt(form) {
  return cachedCanvas('soso-form:'+form,116,108,g => {
    const palette=[
      [],['#4f252a','#be594e','#ffc577'],['#273456','#6d9ac6','#def7ff'],
      ['#3c315a','#8663b1','#f5e79a'],['#211d37','#593e76','#ca94de'],['#43283f','#d19468','#fff1bf']
    ][form];
    const [dark,mid,light]=palette;
    g.translate(58,91);
    for (const side of [-1,1]) {
      g.save();g.scale(side,1);
      if (form===1) artInk(g,mid,[[13,-25],[31,-42],[43,-75],[47,-44],[50,-28],[30,-15]]);
      if (form===2) for (let i=0;i<4;i++) artInk(g,i%2 ? mid : light,[[12+i*5,-25],[19+i*8,-66+i*6],[29+i*6,-45],[25+i*3,-23]]);
      if (form===3) artInk(g,light,[[12,-37],[34,-60],[25,-38],[48,-48],[35,-27],[50,-30],[27,-13]]);
      if (form===4) artInk(g,mid,[[6,-43],[24,-69],[47,-71],[36,-56],[49,-33],[32,-41],[31,-13]]);
      if (form===5) for (let i=0;i<3;i++) artInk(g,i%2 ? mid : light,[[13,-43+i*9],[49,-86+i*17],[42,-59+i*14],[55,-51+i*17],[22,-24+i*6]]);
      artInk(g,dark,[[10,-29],[25,-17],[29,-4],[13,-4],[7,-18]]);
      g.restore();
    }
    artOval(g,dark,0,-30,24,22);artOval(g,mid,0,-36,20,19);
    artInk(g,dark,[[-19,-48],[-19,-66],[-7,-54],[8,-53],[19,-66],[20,-47],[15,-36],[-16,-36]]);
    artOval(g,mid,0,-48,16,11);
    artOval(g,light,-7,-48,4,2);artOval(g,light,7,-48,4,2);
    artInk(g,light,[[0,-55],[-4,-60],[0,-67],[4,-60]]);
    if (form===5) {
      g.strokeStyle=light;g.lineWidth=2;g.beginPath();g.ellipse(0,-72,24,9,0,0,6.283);g.stroke();
      artInk(g,light,[[0,-48],[6,-32],[0,-24],[-6,-32]]);
    }
  });
}

function drawElementPattern(g,x,y,radius,element,seed,progress) {
  if (artQuality==='low' || artMotion.matches) return;
  const colors={炎:'#ffc073',氷:'#c3efff',雷:'#f9e694',水:'#a0cfe9',風:'#9de2c0',土:'#dfa783',光:'#ffedbb',闇:'#c8a7ed',全:'#fff4e1'};
  const color=colors[element] || '#d8e8fb';
  const sides={炎:5,氷:6,雷:4,水:8,風:7,土:4,光:9,闇:3,全:10}[element] || 5;
  const quality=artQuality==='high' ? 2 : 1;
  const t=Math.min(1,Math.max(0,progress));
  g.save();g.globalAlpha=Math.sin(t*Math.PI)*.73;g.strokeStyle=color;g.lineWidth=1.5;
  for(let ring=0;ring<quality;ring++) {
    const points=[];
    for(let i=0;i<sides;i++) {
      const a=i*Math.PI*2/sides+seed%17*.21+t*(ring ? -1.2 : 1.2);
      const r=radius*(.55+t*.5-ring*.19)*(.87+((seed>>>i%12)&3)*.075);
      const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r*.62;
      points.push([px,py]);
      artOval(g,color,px,py,2+ring,1.5);
    }
    g.beginPath(); g.moveTo(...points[0]);
    for (const point of points.slice(1)) g.lineTo(...point);
    g.closePath(); g.stroke();
  }
  g.restore();
}

function equipmentArt(name,kind) {
  const seed=visualSeed(name+'/'+kind);
  return cachedCanvas('equipment:'+seed,34,34,g => {
    const [shadow,body,trim,light]=artPalettes[seed%artPalettes.length];
    g.fillStyle=shadow;g.fillRect(1,1,32,32);
    if (kind==='armor') {
      artInk(g,trim,[[4,9],[11,4],[17,8],[23,4],[30,9],[27,16],[24,14],[24,29],[10,29],[10,14],[7,16]]);
      artInk(g,body,[[12,13],[17,16],[22,13],[21,25],[17,28],[13,25]]);
    } else if (kind==='accessory') {
      artOval(g,trim,17,20,9,9);artOval(g,shadow,17,20,6,6);
      artInk(g,light,[[17,5],[24,11],[17,17],[10,11]]);
    } else {
      const width=2+(seed>>>8)%4;
      artInk(g,trim,[[8,22],[25-width,5],[29,4],[27,10],[12,25]]);
      artInk(g,light,[[12,21],[27,6],[14,23]]);
      artInk(g,body,[[6,19],[15,27],[12,30],[4,22]]);
      artOval(g,trim,8,27,3,3);
    }
  });
}

function showEquipmentArt(items,kind) {
  const list=document.createElement('div');
  list.className='equipment-gallery';
  list.setAttribute('aria-label','装備の見た目');
  for (const item of items) {
    const icon=document.createElement('canvas');
    icon.width=34; icon.height=34; icon.title=item.name;
    icon.setAttribute('role','img');
    icon.setAttribute('aria-label',item.name);
    icon.getContext('2d').drawImage(equipmentArt(item.name,kind),0,0);
    list.append(icon);
  }
  $('panel-body').append(list);
}
