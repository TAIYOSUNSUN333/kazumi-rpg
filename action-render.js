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

function drawActionBattle() {
  const {enemy, body, strike, impact, arena} = battle;
  const heroPoint = actorPoint('hero'), enemyPoint = actorPoint('enemy');
  const heroY = battleDepth(heroPoint.y) - jumpHeight;
  const enemyY = battleDepth(enemyPoint.y);
  const phase = isFinalBoss(enemy) ? finalPhase(enemy) : 1;
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
  const zoom = body.size >= 8 ? .72 : body.size >= 4 ? .83 : 1;
  ctx.scale(zoom, zoom);
  ctx.translate(-320, -245);
  combatCamera(ctx);
  if (strike) drawDanger(strike);
  if (impact?.until > clock && impact.until - clock > .22) drawDanger(impact, true);
  dustAt(impact);
  dustAt(battle.stepDust);
  drawRunningDust();
  if (enemy.boss) lightAt(ctx, enemyPoint.x, enemyY - 32, 88, phase === 3 ? '#ffc2644e' : '#be8dff45');

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
    }},
    {depth:enemyPoint.y, paint:() => {
      monster(enemy,enemyPoint.x,enemyY,body.size * depthScale(enemyPoint.y),
        {face:battle.enemyFacing.x,pose:battle.enemyHit > clock ? 5 : strike ? 3 : undefined});
      if (battle.armorPart?.hp > 0) {
        const y = Math.max(62,enemyY - 32 - body.size * 17);
        rect(enemyPoint.x - 24,y,48,4,'#2d283a');
        rect(enemyPoint.x - 24,y,48 * battle.armorPart.hp / battle.armorPart.max,4,'#ddb980');
      }
    }}
  ];
  for (const slot of battle.members) {
    const {member,role} = slot;
    const ally = actorPoint(role);
    actors.push({depth:ally.y,paint:() => {
      const y = battleDepth(ally.y);
      const direction = Math.sign(enemyPoint.x-ally.x);
      const pose = !member.hp ? 8 : slot.hit > clock ? 5 : slot.guard > clock ? 4 : slot.dodge > clock ? 2 :
        slot.action?.until > clock ? slot.action.kind === 'attack' ? 3 : 6 : 1+Math.floor(clock*9)%2;
      drawPartyMember(member,ally.x,y,depthScale(ally.y),direction,pose);
      if (slot.guard > clock) diamond(ally.x+direction*9,y-20,8,13,'#98d5e1');
      if (slot.action?.until > clock) {
        if (slot.action.kind === 'magic') {
          ctx.strokeStyle = '#dbc2ff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ally.x,y-25); ctx.lineTo(enemyPoint.x,enemyY-36); ctx.stroke();
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
