function litInnRoom(scene) {
  const {profile,site,time,stage,room} = scene;
  const reception = stage < 2 || stage === 11;
  const image = picture('inn-' + (reception ? 2 : profile.art));
  rect(0,0,640,360,'#44323d');
  if (image) coverArt(ctx,image,0,0,640,360);
  const width = room.width, left = room.left;
  const floor = ctx.createLinearGradient(0,113,0,292);
  floor.addColorStop(0,'#886b59');
  floor.addColorStop(1,'#54434d');
  polygon([[left+14,112],[left+width-14,112],[left+width,284],[left,284]],'#4a3443');
  ctx.fillStyle = floor;
  ctx.fillRect(left+6,117,width-12,160);
  for (let y=125;y<276;y+=13) {
    rect(left+7,y,width-14,1,'#372c405c');
    for (let x=left+30+(y%3)*16;x<left+width-6;x+=67) rect(x,y,1,11,'#3c304054');
  }
  const night = stage >= 5 && stage <= 7;
  const dawn = stage >= 8;
  const window = left+width*.80;
  rect(window-44,55,88,60,'#4a3745');
  rect(window-40,59,80,52,night ? '#323f64' : dawn ? '#d7ad84' : '#9aa2aa');
  polygon([[window-40,107],[window-24,88],[window-9,98],[window+16,79],[window+40,104],[window+40,111],[window-40,111]],'#5f6e71');
  rect(window,58,2,53,'#564553');
  if (night) {
    ctx.fillStyle = '#ece5bd';
    ctx.beginPath();ctx.arc(window+20,73,8,0,6.283);ctx.fill();
  } else if (dawn) {
    const rise = clamp((time-20.5)/2,0,1);
    lightAt(ctx,window+14,92,110,'#ffda958c');
    polygon([[window-36,109],[window+38,109],[window+30,275],[window-152,254]],'#ffd28c32');
    ctx.fillStyle = '#ffd69a';
    ctx.beginPath();ctx.arc(window+19,100-rise*21,8,0,6.283);ctx.fill();
  }
  if (!reception) {
    rect(left+17,99,53,37,'#604653');
    rect(left+23,104,40,30,'#332253');
    const glow = night ? .32 : 1;
    const dx = reducedMotion.matches ? 0 : Math.sin(time*11)*2;
    ctx.save();
    ctx.globalAlpha = glow;
    polygon([[left+26,132],[left+35,114],[left+40+dx,119],[left+47,109],[left+61,131]],'#ee9658');
    lightAt(ctx,left+43,123,44,'#ef94566e');
    ctx.restore();
  }
  if (reception) {
    rect(left+7,146,99,38,'#6a4d53');
    rect(left+4,140,105,9,'#c4a477');
    drawActor(townTypes.inn[1],left+49,141,.76,1,0);
    if (stage === 0) diamond(left+91,142+Math.sin(time*7)*2,5,4,'#ffce7a');
  }
  if (site.chapter%2) rect(left+6,118,width-12,3,'#b5916580');
}

function drawInnBed(bed, shared = false) {
  const {x,y,type} = bed;
  if (type === 'perch') {
    groundShadow(x,y+2,19,4);
    rect(x-3,y-19,5,18,'#795142');
    rect(x-16,y-18,30,4,'#aa7956');
    rect(x-11,y-2,22,3,'#94705c');
    return;
  }
  if (type !== 'futon') {
    groundShadow(x,y+2,bed.width*.48,5);
    ctx.fillStyle = type === 'large' ? '#81776a' : '#887066';
    ctx.beginPath();ctx.ellipse(x,y-4,bed.width*.5,13,0,0,6.283);ctx.fill();
    ctx.strokeStyle = '#c4a183';
    ctx.lineWidth = 2;
    ctx.beginPath();ctx.ellipse(x,y-5,bed.width*.42,10,0,0,6.283);ctx.stroke();
    return;
  }
  const width = shared ? 94 : bed.width;
  groundShadow(x,y+5,width*.53,7);
  rect(x-width/2,y-31,width,34,'#745557');
  rect(x-width/2+3,y-29,width-6,30,'#d3b99c');
  rect(x-width/2+5,y-28,width-10,11,'#e9d6b7');
  rect(x-width/2+5,y-16,width-10,15,shared ? '#9d7177' : '#77718d');
  rect(x-width/2+5,y-15,width-10,3,'#c2a0a0');
}

function innPosition(scene,guest,index) {
  const {width,left,beds} = scene.room;
  const {time,stage} = scene;
  const bed = beds.get(guest.id);
  const lineup = {x:320+(index%4-(Math.min(4,scene.guests.length)-1)/2)*63,y:205+Math.floor(index/4)*32};
  const talk = {x:left+width*(index+.65)/(scene.guests.length+.25),y:207+(index%2)*11};
  const shared = scene.choice?.[3] === 'share' && scene.conversation.speaker?.id === guest.id;
  const sharedBed = scene.choice?.[3] === 'share' && (shared || guest.kind === 'hero');
  const sleep = {
    x:sharedBed ? 320+(shared ? 18 : -17) : bed.x,
    y:bed.y+(guest.kind === 'owl' ? -19 : 0)
  };
  const breakfast = tableSeat(index,scene.guests.length,320,203,Math.min(width-66,399));
  const step = (a,b,progress) => ({
    x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress,walk:progress > 0 && progress < 1
  });
  if (stage === 0) return lineup;
  if (stage === 1) return step(lineup,talk,clamp((time-1.5-index*.065)/1.52,0,1));
  if (stage === 2 || stage === 3) return talk;
  if (stage === 4) return step(talk,sleep,clamp((time-10-index*.039)/1.53,0,1));
  if (stage === 9) {
    const rise = Math.min(24.7,guestWakeAt(scene,guest,index)+.54);
    return step(sleep,breakfast,clamp((time-rise)/(25.95-rise),0,1));
  }
  if (stage === 11) return step(breakfast,{x:548-(index%4)*48,y:230+Math.floor(index/4)*23},clamp((time-29-index*.064)/1.43,0,1));
  if (guest.kind === 'cat' && scene.night.id === 'cat' && stage >= 7) {
    const heroBed = beds.get('hero');
    return step(sleep,{x:heroBed.x+33,y:heroBed.y-5},clamp((time-17)/1.2,0,1));
  }
  if (guest.nocturnal && stage === 7) {
    return step(sleep,{x:roomWindowX(scene)-37-index*8,y:152},clamp((time-17-index*.14)/1.36,0,1));
  }
  return sleep;
}

const roomWindowX = scene => scene.room.left+scene.room.width*.80;
const guestWakeAt = (scene,guest,index) => 22.15+index*.27+(scene.night.id === 'late' && scene.night.guest === guest ? 1.28 : 0);

function drawLodgingGuest(scene,guest,point,index) {
  const {time,stage,night} = scene;
  const {x,y} = point;
  const poseTick = reducedMotion.matches ? 0 : time;
  const onWatch = guest.nocturnal && stage >= 6 && stage <= 7;
  const wakingAt = guestWakeAt(scene,guest,index);
  const sleepy = !onWatch && (stage >= 5 && stage <= 8 || stage === 9 && time < wakingAt);
  const yawn = stage === 9 && time >= wakingAt && time < wakingAt+.47;
  const restless = guest.temper === '自由奔放' || guest.temper === '快活';
  const turn = restfulTurn(poseTick,index,restless);
  const bob = sleepy ? Math.sin(poseTick*(restless ? 2.8 : 1.9)+index)*.75 : 0;
  const talk = (stage === 2 || stage === 3) && Math.floor(time*2)%scene.guests.length === index;
  const pose = point.walk ? 1+Math.floor(poseTick*10+index)%2 : yawn || talk ? 7 : 0;
  if (guest.kind === 'cat') {
    const sheet = picture('soso');
    if (sleepy && sheet) {
      groundShadow(x,y,11,3);
      const frame = (Math.floor(poseTick/2)+index)%2 ? 3 : 0;
      ctx.drawImage(sheet,frame*64,0,64,64,x-22,y-24+bob,44,27);
    } else drawCat(x,y,.79);
  } else if (guest.kind === 'owl') {
    const face = (Math.floor(poseTick*1.23)+index)%3 === 0 ? -1 : 1;
    drawPartyMember(guest.member,x,y,.73,face,sleepy && night.id !== 'owl' ? 4 : pose);
  } else if (guest.kind === 'monster') {
    ctx.save();
    ctx.translate(x,y+bob);
    if (sleepy) ctx.scale(guest.large ? 1.16 : 1.06,guest.large ? .49 : .62);
    drawPartyMember(guest.member,0,0,guest.large ? 1.23 : .94,turn,pose);
    ctx.restore();
  } else if (sleepy) {
    const sheet = picture('actors');
    if (sheet) {
      ctx.save();
      ctx.translate(x,y-18+bob);
      ctx.scale(turn,1);
      ctx.drawImage(sheet,0,actorRow(guest.name)*64+1,64,26,-24,-13,48,22);
      ctx.restore();
    }
    rect(x-13,y-12,26,12,guest.kind === 'hero' ? '#ad7d87' : '#8b83a0');
  } else {
    drawActor(guest.name,x,y,.91,turn,pose);
    if (stage <= 2 || stage === 11) {
      const blade = guest.kind === 'hero' ? 1 : .77;
      const stow = stage === 2 ? clamp((time-3.85-index*.08)/.60,0,1) : 0;
      ctx.globalAlpha = 1-stow;
      const hand = x+turn*(9+stow*12), grip = y-19+stow*17;
      polygon([[hand-2,grip+2],[hand+2,grip+2],[hand+turn*7*blade,grip-18*blade],[hand+turn*3,grip-14*blade]],'#dacdd0');
      rect(hand-4,grip,8,2,'#c2a177');
      ctx.globalAlpha = 1;
    }
  }
  if (onWatch) diamond(x+7,y-23,2,2,'#eacf88');
  if (sleepy && artQuality !== 'low' && !reducedMotion.matches) {
    const breath = (poseTick*9+index*13)%19;
    ctx.globalAlpha = Math.max(0,.72-breath/28);
    rect(x+12+breath*.3,y-23-breath,Math.max(1,4-breath/6),1,'#dcdcf8');
    if (night.id === 'snore' && night.guest === guest) rect(x+13+breath*.4,y-27-breath,5,2,'#e8dbb4');
    ctx.globalAlpha = 1;
  }
  if (yawn) lightAt(ctx,x,y-25,23,'#f9ddb75e');
  if (stage <= 3 && scene.guests.length <= 8) label(guest.name,x,y+10,'#fff0cc',9);
}

function restfulTurn(time,index,restless) {
  return (Math.floor(time/(restless ? 1.9 : 3.1))+index)%2 ? -1 : 1;
}

function tableSeat(index,count,x,y,width) {
  const angle = index*2*Math.PI/count+Math.PI/2;
  return {x:x+Math.cos(angle)*width*.48,y:y+Math.sin(angle)*31};
}

function gatherAtTable(guests,time,x,y,width) {
  groundShadow(x,y+16,width*.50,17);
  ctx.fillStyle = '#a78363';
  ctx.beginPath();ctx.ellipse(x,y,width*.5,17,0,0,6.283);ctx.fill();
  const guestsInOrder = guests.map((guest,index)=>({guest,index,...tableSeat(index,guests.length,x,y,width)}))
    .sort((a,b)=>a.y-b.y);
  for (const {guest,x:gx,y:gy,index} of guestsInOrder) {
    if (guest.kind === 'cat') drawCat(gx,gy,.74);
    else if (guest.member) drawPartyMember(guest.member,gx,gy,.84,gx<x ? 1 : -1,Math.floor(time*2)%guests.length === index ? 6 : 0);
    else drawActor(guest.name,gx,gy,.92,gx<x ? 1 : -1,0);
  }
  for (let index=0;index<guests.length;index++) {
    const plate = x - width*.39 + (index+.5)*width*.78/guests.length;
    diamond(plate,y+index%2*9-5,6,3,'#f4ddaa');
  }
}

function drawInnStay() {
  const scene = innScene;
  const {time,stage,room} = scene;
  litInnRoom(scene);
  const departed = scene.choice?.[3] === 'depart' && stage >= 7 ? scene.conversation.speaker?.id : null;
  const guests = scene.guests.filter(guest=>guest.id !== departed);
  if (stage === 10) gatherAtTable(guests,time,320,203,Math.min(room.width-66,399));
  else {
    if (stage >= 2 && stage < 11) {
      for (const [id,bed] of room.beds) {
        const share = scene.choice?.[3] === 'share';
        if (share && id === scene.conversation.speaker?.id) continue;
        drawInnBed(bed,share && id === 'hero');
      }
    }
    guests.map((guest,index)=>({guest,index,point:innPosition(scene,guest,index)}))
      .sort((a,b)=>a.point.y-b.point.y).forEach(({guest,index,point})=>drawLodgingGuest(scene,guest,point,index));
  }
  if (stage >= 5 && stage <= 7) {
    ctx.fillStyle = '#181d39';
    ctx.globalAlpha = .27 + clamp((time-12.2)/2.4,0,1)*.38;
    ctx.fillRect(0,0,640,360);
    ctx.globalAlpha = 1;
  }
}
