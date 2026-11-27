import os

from playwright.sync_api import expect, sync_playwright


URL = os.getenv('KAZUMI_TEST_URL','http://127.0.0.1:3009/')


def button(page,name):
    return page.get_by_role('button',name=name,exact=True)


def begin(page):
    page.goto(URL)
    button(page,'はじめから').tap()
    button(page,'ソソとの思い出').tap()
    button(page,'戸口を調べる').tap()
    button(page,'旅支度をする').tap()
    button(page,'街道へ出る').tap()


def formations(page):
    ranges = page.evaluate('''() => {
      const examples = {
        ordinary:activeEnemies(0)[3],elite:activeEnemies(1)[4],raid:activeEnemies(3)[4],
        mid:activeEnemies(0)[6],major:activeEnemies(0)[7],trial:{...trials[0],hp:trials[0].max}
      };
      const seen = {};
      for (const [kind,source] of Object.entries(examples)) {
        const sizes = [];
        for (let seed=0;seed<30;seed++) {
          Math.random=()=>((seed*47)%101)/101;
          const group=createEnemyGroup(source);
          if (group.kind!==kind || new Set(group.members.map(foe=>foe.unit)).size!==group.members.length) return false;
          sizes.push(group.members.length);
        }
        seen[kind]=[Math.min(...sizes),Math.max(...sizes)];
      }
      return seen;
    }''')
    assert ranges == {
        'ordinary':[3,6],'elite':[5,10],'raid':[10,20],
        'mid':[4,6],'major':[5,8],'trial':[10,15]
    }, ranges


def action_group(page):
    page.evaluate('''() => {
      Math.random=()=>.91;
      player.x=523;player.y=104;player.mp=maxMP();
      encounter(activeEnemies(0)[3]);
      for(let i=0;i<10;i++) update(.05);
    }''')
    assert page.evaluate('livingEnemies(battle.group).length>=3 && reservesRemaining(battle.group)>0')
    expect(page.locator('#arena-actions')).to_be_visible()
    # Strike a nearby escort. The leader and the canonical world symbol are unchanged.
    assert page.evaluate('''() => {
      const group=battle.group;
      const target=livingEnemies(group)[1], previous=target.unit.hp;
      battle.heroX=282; battle.heroY=101;
      for (const foe of livingEnemies(group)) foe.nextAt=clock+20;
      battle[target.key+'X']=304; battle[target.key+'Y']=101;
      battle.enemyX=540;
      player.facing={x:1,y:0}; attackAt=clock;
      const source=group.source.hp;
      swing();
      update(.05); update(.05);
      return target.unit.hp<previous && group.source.hp===source && battle.enemy.hp===battle.enemy.max;
    }''')
    page.evaluate("actionThinkOfSoso()")
    assert page.evaluate('battle && !battle.enemy.hp && battle.group.source.hp>0')
    page.evaluate('update(.05)')
    assert page.evaluate('mode==="battle" && livingEnemies(battle.group).length>0')
    assert '増援' in page.locator('#message').inner_text()
    page.evaluate('''() => {
      for (const foe of livingEnemies(battle.group)) hurtActionEnemy(foe,foe.unit.hp);
      for(let i=0;i<4;i++) {
        if (!battle) break;
        update(.05);
        if (battle) for (const foe of livingEnemies(battle.group)) hurtActionEnemy(foe,foe.unit.hp);
      }
      if (battle) update(.05);
    }''')
    assert page.evaluate('!battle && activeEnemies(0)[3].hp===0')
    # An elite guard counters frontal blows. A healer restores a wounded ally.
    result = page.evaluate('''() => {
      Math.random=()=>.48;
      encounter(activeEnemies(3)[4]);
      const guard=battle.group.members[1], healer=battle.group.members[2], caller=battle.group.members[3];
      const patient=battle.group.members[0];
      patient.unit.hp=Math.floor(patient.unit.max*.27);
      for (const foe of livingEnemies(battle.group)) foe.nextAt=clock+100;
      battle[healer.key+'X']=battle.enemyX+20;
      battle[healer.key+'Y']=battle.enemyY;
      guard.guardUntil=clock+5; guard.facing={x:-1,y:0};
      const mark=actorPoint(guard.key);
      const prior=guard.unit.hp;
      const mp=healer.mp;
      positionalHit({x:mark.x-35,y:mark.y},12,'blade',guard);
      const counter=guard.counterAt>clock && prior-guard.unit.hp<8;
      healer.nextAt=clock;
      for(let i=0;i<29;i++) update(.05);
      const healed=patient.unit.hp/patient.unit.max>.28 && healer.mp<mp;
      const wander=actorPoint(caller.key);
      caller.nextAt=clock;
      for(let i=0;i<42;i++) update(.05);
      const summon=battle.group.members.some(foe=>foe.summoned);
      escapeBattle();
      return {counter,healed,summon,moved:!Number.isNaN(wander.x)};
    }''')
    assert all(result.values()), result


def command_group(page):
    page.evaluate('''() => {
      Math.random=()=>.91; battleStyle='command';
      encounter(activeEnemies(0)[5],'first');
      for(let i=0;i<10;i++) update(.05);
    }''')
    assert page.evaluate('battle.command.foes.filter(commandAlive).length>=3 && reservesRemaining(battle.group)>0')
    button(page,'たたかう').tap()
    expect(page.locator('#battle-options button').first).to_be_visible()
    assert page.locator('#battle-options button').count() >= 4
    button(page,'戻る').tap()
    page.evaluate('''() => {
      const group=battle.group;
      const round=battle.command;
      for (const enemy of round.foes.filter(commandAlive)) damageCommandActor(round,enemy,enemy.enemy.hp,'');
      checkCommandOutcome(round);
    }''')
    assert page.evaluate('battle.command.phase!=="victory" && livingEnemies(battle.group).length')
    page.evaluate('escapeBattle();battleStyle="action"')


def recruitment_progression(page):
    page.evaluate('''() => {
      player.xp=25*34**2;
      recruitment(npcs.find(npc=>npc.name==='一郎'));
    }''')
    expect(page.locator('#panel-body')).to_contain_text('Lv.35')
    button(page,'いいえ').tap()
    assert page.evaluate('!companions.has("一郎")')
    page.evaluate('recruitment(npcs.find(npc=>npc.name==="一郎"))')
    button(page,'はい').tap()
    assert page.evaluate('companionLevel(companions.get("一郎"))===35')
    page.evaluate('''() => {
      Object.assign(companions.get('一郎'),{hp:19,mp:4,gear:2});
      tavern(true);
    }''')
    button(page,'一郎').tap()
    button(page,'別れる').tap()
    button(page,'はい').tap()
    page.evaluate('player.xp=25*42**2')
    button(page,'一郎を誘う').tap()
    expect(page.locator('#panel-body')).to_contain_text('Lv.35')
    button(page,'はい').tap()
    assert page.evaluate('''() => {
      recruitment(npcs.find(npc=>npc.name==='恵美ちゃん'));
      const member=companions.get('一郎');
      const first=initialCompanion(prefectures[0].companion), last=initialCompanion(prefectures[46].companion);
      return member.hp===19 && member.mp===4 && member.gear===2 && companionLevel(member)===35 &&
        companionHP(last)>companionHP(first) && companionPower(last)>companionPower(first) && companionLimit(last);
    }''')
    button(page,'はい').tap()
    page.evaluate('recruitment(npcs.find(npc=>npc.name==="タク"))')
    assert button(page,'はい').count()==0
    assert page.evaluate('humans().length===2')
    button(page,'戻る').tap()


def register_party(page,size):
    page.evaluate('''size => {
      Math.random=()=>0; companions.clear(); player.party=[]; joined=size>=5;
      player.xp=25*34**2;
      const all=['一郎','恵美ちゃん','クルミ'];
      for (const name of all.slice(0,Math.min(size-1,3))) {
        const member=initialCompanion(name);
        member.hp=1;member.mp=0;member.fatigue=75;
        member.affinity=46;member.trust=31;
        player.party.push(name); companions.set(name,member);
      }
      for (const id of [5,3,2].slice(0,Math.max(0,size-5))) {
        const name=monsterCompanion(id),member=initialCompanion(name);
        Object.assign(member,{monster:true,origin:id,hp:1,mp:0,fatigue:85});
        player.party.push(name);companions.set(name,member);
      }
      const site=townSites.get('0-inn');
      player.x=site.x; player.y=site.row; player.gold=100;
      player.hp=18;player.mp=1;player.fatigue=80;
      interior={site,x:320,y:115};
      servicePanel();
    }''',size)


def challenge_and_facilities(page):
    register_party(page,8)
    result = page.evaluate('''() => {
      resume();interior=null;
      player.xp=25*98**2;player.hp=maxHP();player.mp=maxMP();player.weapon=3;player.armor=3;
      for(const member of activeCompanions()) {
        member.xp=30*98**2;member.hp=companionHP(member);member.mp=companionMP(member);
      }
      const startTrial=()=>{
        openTrials();
        [...$('panel-buttons').children].find(button=>button.textContent===trials[0].name).click();
      };
      startTrial();
      battle.auto=true;
      for(let i=0;i<1300 && battle && !paused;i++) update(.05);
      const autoCleared=clearedTrials.has(0);
      if (paused) $('panel-buttons').firstChild.click();
      else if (battle) escapeBattle();
      player.hp=maxHP();player.mp=maxMP();
      startTrial();
      shiftCatForm(5);
      for(let i=0;i<9;i++) update(.05);
      const initial=battle.enemy.hp;
      actionLimit();
      const ultimate=battle.enemy.hp/initial;
      const size=battle.members.length+2;
      const leader=battle.group.members[0];
      for(let i=0;i<4;i++) positionalHit({x:battle.enemyX-33,y:battle.enemyY},100,'air',leader);
      const ward=leader.ward;
      escapeBattle();
      const counts=[];
      for(const kind of ['bath','food','tavern']) {
        const site=townSites.get('0-'+kind);
        interior={site,x:320,y:115};
        shareTownEvent(site);
        counts.push(facilityGathering.guests.length);
        resume();
      }
      interior=null;
      return {autoCleared,ultimate,size,counts,ward};
    }''')
    assert not result['autoCleared'] and result['size']==8 and result['ultimate']>.86, result
    assert result['ward']==0, result
    assert result['counts']==[8,8,8], result


def inn_party(page,size):
    register_party(page,size)
    button(page,'宿泊する　12G').tap()
    assert page.evaluate('size=>innScene.guests.length===size && innScene.room.beds.size===size',size)
    expect(page.locator('#stay-caption')).to_contain_text(str(size)+'名')
    assert page.evaluate('''() => {
      const beds=[...innScene.room.beds.values()];
      return beds.every((bed,index)=>beds.slice(index+1).every(other=>
        bed.y!==other.y || Math.abs(bed.x-other.x)>(bed.width+other.width)/2-1));
    }''')
    page.evaluate('advanceInn(5.36)')
    if size > 1:
        button(page,'一緒に休む').tap()
        assert page.evaluate('innScene.choice[3]==="share" && companions.get("一郎").xp===30*34**2')
    page.evaluate('advanceInn(12)')
    assert page.evaluate('innScene.stage===7 && Boolean(innScene.night.id)')
    if size == 8:
        assert page.evaluate('innScene.guests.some(guest=>guest.large) && innScene.guests.some(guest=>guest.nocturnal)')
    page.evaluate('advanceInn(9)')
    expect(page.locator('#stay-caption')).to_contain_text('朝食')
    page.evaluate('advanceInn(8)')
    assert page.evaluate('''() => !innScene && !innPending && !interior && player.gold===88 &&
      player.hp===maxHP() && player.mp===maxMP() && !player.fatigue &&
      activeCompanions().every(member=>member.hp===companionHP(member) && member.mp===companionMP(member) &&
        !member.fatigue) && readAdventure().town.room===null''')
    if size == 8:
        page.reload()
        button(page,'冒険を再開').tap()
        assert page.evaluate('facilityGuests().length===8 && !innPending && player.gold===88')


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.getenv('KAZUMI_CHROMIUM'))
    context = browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
    page = context.new_page()
    errors = []
    page.on('pageerror',lambda error:errors.append(str(error)))
    begin(page)
    formations(page)
    action_group(page)
    command_group(page)
    recruitment_progression(page)
    challenge_and_facilities(page)
    for count in range(1,9):
        inn_party(page,count)
    assert not errors, errors
    print('敵編成、独立HP、盾カウンター、回復、召喚、増援、Lv.35加入・再加入、四天王のAUTO耐性、1〜8人の宿泊・施設・保存 OK')
    browser.close()
