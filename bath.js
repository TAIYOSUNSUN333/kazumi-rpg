let bathPending = null;
let bathScene = null;

function beginBath() {
  const site = interior?.site;
  if (!site || site.kind !== 'bath' || player.gold < 8 || bathPending) return;
  player.gold -= 8;
  bathPending = site.id;
  save();
  resumeBath();
}

function resumeBath() {
  const site = townSites.get(bathPending);
  if (!site || site.kind !== 'bath') return;
  bathScene = {site,time:0,stage:-1};
  paused = true;
  menuActive = false;
  clearInput();
  $('panel').hidden = true;
  $('stay-controls').hidden = false;
  $('stay-skip').textContent = '入浴演出をスキップ';
  $('stay-choices').replaceChildren();
  audio.setTrack('bath');
  advanceBath(0);
}

function advanceBath(dt) {
  if (!bathScene) return;
  const scene = bathScene;
  scene.time += dt;
  if (scene.time >= 11.4) return finishBath();
  const stage = scene.time < 1.3 ? 0 : scene.time < 3.5 ? 1 : scene.time < 9.4 ? 2 : 3;
  if (stage === scene.stage) return;
  scene.stage = stage;
  const guests = activeCompanions();
  const guest = guests.find(member => ['female','animal'].includes(companionProfile(member.name).gender));
  $('stay-caption').textContent = [
    '受付で浴場の鍵とタオルを受け取った。',
    'それぞれの脱衣所へ向かう。',
    guest ? companionName(guest) + (guest.affinity < 0 ? 'は離れた洗い場で休んでいる。' : '「いい湯だね。少しゆっくりしよう」') :
      joined ? 'ソソがぬれないよう、温かい縁側で丸まった。' : '湯気の向こうから、水が流れる音が聞こえる。',
    '髪を乾かして、受付へ戻る。'
  ][stage];
  if (stage === 2) audio.play('water');
}

function finishBath() {
  if (!bathScene || !bathPending) return;
  const chapter = bathScene.site.chapter;
  player.hp = Math.min(maxHP(),player.hp+Math.ceil(maxHP()*.46));
  player.mp = Math.min(maxMP(),player.mp+Math.ceil(maxMP()*.34));
  footingUntil = clock;
  player.fatigue = Math.max(0,player.fatigue-42);
  for (const member of activeCompanions()) {
    member.hp = Math.min(companionHP(member),member.hp+Math.ceil(companionHP(member)*.4));
    member.mp = Math.min(companionMP(member),member.mp+8);
    member.fatigue = Math.max(0,(member.fatigue || 0)-42);
  }
  rememberRegionalBath(chapter);
  bathPending = bathScene = null;
  $('stay-controls').hidden = true;
  setFieldTrack();
  resume();
  say('温泉で体力と魔力が回復した。');
  save();
}

function drawBathStay() {
  const {site,time,stage} = bathScene;
  const color = prefectures[site.chapter].color;
  const image = picture('inn-1');
  rect(0,0,640,360,'#394352');
  if (image) coverArt(ctx,image,0,0,640,360,Math.sin(time*.5)*8);
  if (stage < 2 || stage === 3) {
    const travel = clamp((time-1.3)/2.2,0,1);
    const x = stage === 3 ? 438-(time-9.4)*82 : 231+travel*233;
    rect(109,166,124,62,'#735345');
    rect(101,152,141,16,'#c29b74');
    drawActor('恵美ちゃん',164,157,.89,1,0);
    drawActor('一美',x,247,1.05,1,stage ? 1+Math.floor(time*7)%2 : 6);
    for (const [i,member] of activeCompanions().entries()) {
      drawPartyMember(member,x-31-i*18,252+(i%2)*8,.83,1,1+Math.floor(time*7+i)%2);
    }
    label(stage === 1 ? '脱衣所' : '温泉受付',320,99);
    return;
  }
  const guests = activeCompanions();
  const men = guests.filter(member => companionProfile(member.name).gender === 'male');
  const women = guests.filter(member => companionProfile(member.name).gender !== 'male');
  const room = (left,width,title,visitors,hero) => {
    const mid = left+width/2;
    rect(left,197,width,86,'#49575c');
    for (let x=left+3;x<left+width;x+=21) rect(x,252,1,29,'#c1b3a36e');
    const waterY = 217;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(mid,waterY,width*.44,31,0,0,6.283); ctx.fill();
    const bathers = [...(hero ? [null] : []),...visitors];
    for (const [i,member] of bathers.entries()) {
      const x = left+width*(i+1)/(bathers.length+1);
      const y = waterY+Math.sin(time*3+i)*1.8;
      if (member?.monster) {
        drawPartyMember(member,x,y,.49,1,0);
        continue;
      }
      const sheet = picture('actors');
      if (sheet) ctx.drawImage(sheet,0,actorRow(member?.name || '一美')*64+3,64,24,x-24,y-26,48,24);
      rect(x-7,y-17,14,3,'#ede0cb');
    }
    // An opaque foreground rim and water line keep every bather covered.
    const pool = ctx.createLinearGradient(0,waterY,0,waterY+39);
    pool.addColorStop(0,'#8daea9'); pool.addColorStop(1,'#647c80');
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.ellipse(mid,waterY+13,width*.44,26,0,0,Math.PI); ctx.lineTo(mid-width*.44,waterY+2);
    ctx.lineTo(mid+width*.44,waterY+2); ctx.closePath(); ctx.fill();
    for (let i=0;i<5;i++) {
      const x = left+width*(.15+i*.14), y = waterY+8+i%4*5;
      rect(x+Math.sin(time*2+i)*9,y,24,1,'#e8f2dda0');
      const vapor = (time*21+i*7)%48;
      lightAt(ctx,x+9,waterY-vapor,12+vapor*.19,'#d9f1ec56');
    }
    label(title,mid,168,'#f5e3bb',14);
  };
  if (men.length) {
    room(49,267,'女湯',women,true);
    rect(316,156,7,120,'#9d8570');
    room(324,267,'男湯',men,false);
  } else room(90,460,'女湯・露天',women,true);
  if (joined) drawCat(men.length ? 81 : 137,263+Math.sin(time*4),.72);
}
