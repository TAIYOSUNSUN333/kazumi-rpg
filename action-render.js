function drawDanger(strike, impact = false) {
  ctx.save();
  if (strike.effect === 'summon') {
    lightAt(ctx,strike.x,battleDepth(strike.y)-16,47,'#e2a4ef7a');
    label('召喚詠唱',strike.x,battleDepth(strike.y)-28,'#ead0fa',10);
    ctx.restore();
    return;
  }
  if (strike.effect === 'heal') {
    const mark = actorPoint(strike.patient.key);
    lightAt(ctx,mark.x,battleDepth(mark.y)-14,34,'#99e7b47a');
    ctx.restore();
    return;
  }
  ctx.fillStyle = impact ? '#ffbd6461' : strike.effect === 'spell' ? '#976ee555' : '#dc595c4c';
  ctx.strokeStyle = impact ? '#ffe3a7bc' : strike.effect === 'spell' ? '#d9bbffc8' : '#ff9691c8';
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

function drawActionBattle() {
  const {enemy,body,group} = battle;
  const live = livingEnemies(group);
  const largeImpact = live.find(foe=>foe.impact?.strong && foe.impact.until > clock)?.impact;
  const heroPoint = actorPoint('hero'), enemyPoint = actorPoint('enemy');
  const heroY = battleDepth(heroPoint.y) - jumpHeight;
  const enemyY = battleDepth(enemyPoint.y);
  const phase = foePhase(enemy);
  if (enemy.boss && battle.age < 1.25) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, battle.age * 6, (1.25 - battle.age) * 3);
    rect(105, 107, 430, 30, '#111526d9');
    label(enemy.name, 320, 128, '#ffeac2', 17);
    ctx.restore();
  }
  ctx.save();
  const shake = !reducedMotion.matches && artQuality !== 'low' && largeImpact ?
    Math.sin((largeImpact.until-clock)*56)*Math.min(6,(largeImpact.until-clock)*19) : 0;
  ctx.translate(320 + shake, 245);
  const zoom = body.size >= 8 ? .72 : body.size >= 4 ? .83 : live.length >= 9 ? .91 : 1;
  ctx.scale(zoom, zoom);
  ctx.translate(-320, -245);
  combatCamera(ctx);
  for (const foe of live) {
    if (foe.strike) drawDanger(foe.strike);
    if (foe.impact?.until-clock > .22) drawDanger(foe.impact,true);
    if (foe.impact?.strong) dustAt(foe.impact);
  }
  dustAt(battle.stepDust);
  drawRunningDust();
  if (enemy.boss && enemy.hp) lightAt(ctx, enemyPoint.x, enemyY - 32, 88, phase === 3 ? '#ffc2644e' : '#be8dff45');

  const actors = [
    {depth:heroPoint.y, paint:() => {
      const scale = depthScale(heroPoint.y);
      if (jumpHeight) groundShadow(heroPoint.x, heroY + jumpHeight, 11, 3);
      hero(heroPoint.x, heroY, scale, player.facing.x);
      if (battle.superAwake) lightAt(ctx, heroPoint.x, heroY - 20, 55, '#ffd76985');
      if (pressed('guard') || battle.autoGuard) diamond(heroPoint.x + player.facing.x * 12,heroY - 20,9,17,'#95d7ddc7');
      if (clock < swingUntil && !battle.heroStrike && battle.lastSlash) {
        const slash = battle.lastSlash.direction;
        const reach = (equipped('weapon').reach ?? 55) + (swingKind === 'charged' ? bladeForm().chargeReach : 0);
        const end = {x:heroPoint.x + slash.x * reach, y:heroY - 26 + slash.y * reach * .68};
        slashArc(heroPoint.x, heroY - 25, slash.x, reach * .76);
        polygon([[heroPoint.x,heroY - 26],[end.x,end.y - 9],[end.x,end.y + 5]], swingKind === 'air' ? '#9de0ef' : '#ffe5ad');
      }
    }}
  ];
  for (const foe of group.members) {
    if (foe.state !== 'active' && (foe.state !== 'defeated' || clock > foe.fallenAt+.42)) continue;
    const point = actorPoint(foe.key);
    actors.push({depth:point.y,paint:() => {
      const y = battleDepth(point.y);
      const size = foe.body.size*depthScale(point.y);
      const {unit,armorPart,profile} = foe;
      monster(unit,point.x,y,size,{face:foe.facing.x,pose:!unit.hp ? 8 : foe.hitUntil>clock ? 5 : foe.strike ? 3 : undefined});
      if (!unit.hp) return;
      const height = Math.max(44,y-26-size*21);
      if (foe.guardUntil > clock) diamond(point.x+foe.facing.x*9,y-17,8,14,'#a7d5eea5');
      if (foe.healedUntil > clock) lightAt(ctx,point.x,y-16,31,'#c9f0b78c');
      if (foe.helpUntil > clock) label('救援',point.x,height-5,'#ffeabb',10);
      if (armorPart?.hp > 0) {
        rect(point.x-24,height+7,48,3,'#2d283a');
        rect(point.x-24,height+7,48*armorPart.hp/armorPart.max,3,'#ddb980');
      }
      if (!foe.leader && (live.length < 10 || foe.type === 'healer' || foe.type === 'mage' || foe.strike)) {
        label(foe.summoned ? '影狼' : profile.name,point.x,height-5,profile.color,9);
      }
      if (unit.hp < unit.max || foe.leader) {
        const bar = foe.leader ? 42 : 26;
        rect(point.x-bar/2,height,bar,3,'#261f32');
        rect(point.x-bar/2,height,bar*unit.hp/unit.max,3,'#ff9780');
        const phases = foePhaseCount(unit);
        for (let mark=1; mark<phases; mark++) rect(point.x-bar/2+bar*mark/phases,height,1,3,'#261f32');
      }
    }});
  }
  for (const slot of battle.members) {
    const {member,role} = slot;
    const ally = actorPoint(role);
    actors.push({depth:ally.y,paint:() => {
      const y = battleDepth(ally.y);
      const nearest = slot.action ? null : nearestActionFoe(ally);
      const target = slot.action?.target || (nearest ? actorPoint(nearest.key) : enemyPoint);
      const direction = Math.sign(target.x-ally.x);
      const pose = !member.hp ? 8 : slot.hit > clock ? 5 : slot.guard > clock ? 4 : slot.dodge > clock ? 2 :
        slot.action?.until > clock ? slot.action.kind === 'attack' ? 3 : 6 : 1+Math.floor(clock*9)%2;
      drawPartyMember(member,ally.x,y,depthScale(ally.y),direction,pose);
      if (slot.guard > clock) diamond(ally.x+direction*9,y-20,8,13,'#98d5e1');
      if (slot.action?.until > clock) {
        if (slot.action.kind === 'magic') {
          ctx.strokeStyle = '#dbc2ff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ally.x,y-25); ctx.lineTo(target.x,battleDepth(target.y)-27); ctx.stroke();
        } else if (slot.action.kind === 'heal') lightAt(ctx,heroPoint.x,heroY-25,39,'#a6e0b197');
        else slashArc(ally.x,y-18,direction,34);
      }
    }});
  }
  if (joined) {
    const p = actorPoint('cat');
    actors.push({depth:p.y, paint:() => drawCat(p.x,battleDepth(p.y),depthScale(p.y) * (1 + cat.form * .12),cat.form)});
  }
  const summon = battle.summon;
  if (summon) actors.push({depth:heroPoint.y-8,paint:() => {
    const entrance = Math.min(1.4,.6+2*(clock-summon.start));
    drawSummon(summon.spirit,heroPoint.x-player.facing.x*39,heroY-19,entrance,summon.flash>clock);
  }});
  actors.sort((a, b) => a.depth - b.depth).forEach(actor => actor.paint());

  if (battle.familyEffectUntil > clock) {
    drawElementPattern(ctx,heroPoint.x,heroY-18,41,battle.familyElement,127,1-(battle.familyEffectUntil-clock)/.65);
  }
  const effect = battle.catEffect;
  if (effect?.until > clock && !reducedMotion.matches) {
    const x = effect.type === 'strike' ? (effect.target?.x ?? enemyPoint.x) : battle.catX;
    const y = effect.type === 'strike' ? battleDepth(effect.target?.y ?? enemyPoint.y)-32 : battleDepth(battle.catY) - 16;
    const color = catForm().color;
    const radius = effect.type === 'creation' ? 84 : 25 + cat.form * 4;
    lightAt(ctx,x,y,radius,color + '70');
    drawElementPattern(ctx,x,y,radius,['光','炎','氷','雷','闇','全'][cat.form],cat.form,1-clamp((effect.until-clock)/.85,0,1));
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x,y,radius,radius * .51,0,0,6.283); ctx.stroke();
    if (effect.type === 'strike') label(cat.form === 5 ? '創世光' : catForm().spell,x,y - 24,color);
  }
  if (enemy.hp && clock < enemy.flash && artQuality !== 'low') {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const spread = (enemy.flash - clock) * 115;
      diamond(enemyPoint.x + Math.cos(angle) * spread, enemyY - 29 + Math.sin(angle) * spread, 2, 3, '#ffdc9a');
    }
  }
  drawCinematicEffect(ctx, battle.catX + 10, battleDepth(battle.catY) - 20, cat.form === 5);
  const cue = battle.skillCue;
  if (cue?.until > clock) {
    lightAt(ctx,cue.x,cue.y,44,cue.color + '85');
    label(cue.name,cue.x,cue.y-15,cue.color,15);
  }
  drawFireballs(0,true);
  for (const number of numbers) {
    if (!number.field) label(number.text,number.x,number.y - (1 - (number.expires - clock) / .7) * 24,number.color,16);
  }
  ctx.restore();
}
