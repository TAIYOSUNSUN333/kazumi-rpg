import os

from playwright.sync_api import sync_playwright, expect
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.getenv('KAZUMI_CHROMIUM'))
  page=browser.new_page(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("localStorage.setItem('kazumi-battle-style', JSON.stringify('command'))")
  page.goto(os.getenv('KAZUMI_TEST_URL', 'http://127.0.0.1:3009/'))
  buttons=lambda n: page.get_by_role('button',name=n,exact=True)
  buttons('はじめから').tap()
  buttons('街道へ出る').tap()
  result=page.evaluate('''() => {
    Math.random=()=>.5;
    const forms=new Map(), losses={};
    let tick=0, guideLast=0, prepared=-1;
    for (; tick<440000 && !done; tick++) {
      if (paused) {
        const text=$('panel-title').textContent;
        if (text.endsWith('を仲間にしますか？')) $('panel-buttons').firstChild.click();
        else if (npcs.some(npc=>npc.name===text) && $('panel-buttons').firstChild?.textContent === '戻る') {
          $('panel-buttons').firstChild.click();
        }
        else if (text.endsWith('は倒れた')) {
          const place=chapterOf(player.x)+1;
          losses[place]=(losses[place]||0)+1;
          if (losses[place]>7) break;
          $('panel-buttons').firstChild.click();
          prepared = -1;
        } else if (['第10章クリア・ソソが仲間になった','世界に朝が戻った','若草山から続く道'].includes(text)) {
          $('panel-buttons').firstChild.click();
        } else return {halted:text,x:player.x};
      }
      const chapter=chapterOf(player.x);
      if (!battle && !returning) {
        for (const kind of ['weapon','armor']) {
          const next=equipment[kind][player[kind]+1];
          if (next && player.gold>=next.cost+40) {
            player.gold-=next.cost;
            player[kind]++;
          }
        }
        if (chapter>=10 && player.gold>90 && !goodCount(marketGoods[11])) {
          player.gold-=marketGoods[11].price*2;
          pack[marketGoods[11].id]=2;
        }
      }
      if (!battle && !returning && chapter!==prepared && player.gold>=innProfile(chapter).price &&
          activeCompanions().some(member=>member.hp<companionHP(member)*.66)) {
        prepared=chapter;
        const site=townSites.get(chapter+'-inn');
        interior={site,x:320,y:115};
        beginStay();
        finishStay();
        destination=null;
      }
      if (battle?.command.phase==='select') {
        const turn=battle.command;
        const actor=turn.allies[turn.pick];
        const threat=turn.foes.find(foe=>commandAlive(foe) && foe.enemySlot.type==='healer');
        const foe=threat || turn.foes.find(commandAlive);
        const leader=turn.foes[0];
        const crowd=turn.foes.filter(commandAlive).length;
        const stats=actor.stats();
        if (isFinalBoss(leader.enemy)) {
          if(!forms.has(leader.name)) forms.set(leader.name,new Set());
          forms.get(leader.name).add(finalPhase(leader.enemy));
        }
        const wounded=turn.allies.filter(a=>commandAlive(a) && a.stats().unit.hp<a.stats().max*.68);
        const hp=actor.stats().unit.hp;
        const heal=wounded.sort((a,b)=>a.stats().unit.hp/a.stats().max-b.stats().unit.hp/b.stats().max)[0];
        const limit=commandMoves(actor,'limit').find(move=>move.cost<=stats.unit.mp && (heal || move.motion!=='heal'));
        const warned=plannedEnemyActions(turn).some(intent=>intent.move.all || intent.target===actor);
        const next=awakening[cat.form+1];
        const move=(actor.id==='cat' && warned && next && next.turn<=turn.awakeTurns+1 &&
            {name:'防御',motion:'guard',cost:0}) ||
          (heal?.id==='cat' && actor.id==='cat' && commandMoves(actor,'magic').find(m=>m.motion==='heal' && m.cost<=stats.unit.mp)) ||
          (hp<stats.max*.58 && actor.id==='hero' && commandMoves(actor,'item').sort((a,b)=>b.power-a.power)[0]) ||
          limit ||
          (heal && commandMoves(actor,'magic').find(move=>move.motion==='heal' && move.cost<=stats.unit.mp)) ||
          (actor.id==='hero' && crowd>=3 && stats.unit.mp>=5 && commandMoves(actor,'skill').at(-1)) ||
          (actor.id==='cat' && commandMoves(actor,'magic').find(move=>move.motion==='magic' && move.cost<=stats.unit.mp)) ||
          (stats.unit.mp > (actor.id==='hero' ? 10 : 6) && commandMoves(actor,'skill')[0]) || commandMoves(actor,'attack')[0];
        queueCommand(actor,move,move.motion==='guard' || move.good ? actor : move.motion==='heal' ? heal : foe);
      } else if (!battle && !destination && tick > guideLast + 5) {
        guide();
        guideLast=tick;
      }
      update(.05);
    }
    return {done, joined, tick, x:player.x,y:player.y, target:destination, foe:battle?.enemy.name, losses,
      phases:[...forms].map(([name,phases])=>[name,[...phases]]),
      mid: enemies.filter(e=>e.rank==='mid' && !e.hp).length,
      major: enemies.filter(e=>e.rank==='major' && !e.hp).length,
      trials:clearedTrials.size, stones:waysideStones.filter(s=>s.solved).length};
  }''')
  print(result,flush=True)
  assert result['done'] and result['mid']==47 and result['major']==47 and result['trials']==0 and result['stones']==0
  assert [pair[1] for pair in result['phases']]==[[1,2,3],[1,2,3]]
  expect(page.locator('#panel-title')).to_have_text('おかえり、ソソ')
  buttons('旅を振り返る').tap()
  buttons('メニュー').tap()
  buttons('四天王の試練').tap()
  buttons('炎帝フェルナンド').tap()
  page.wait_for_function("battle.command.phase==='select'")
  assert page.evaluate('battle.enemy.trial===0 && done && cat.form===0')
  page.evaluate('Math.random=()=>0')
  buttons('逃げる').tap()
  assert page.evaluate('!battle && done')
  browser.close()
  assert not errors,errors
  print('47章と両ラスボス3形態、石碑未回答の帰宅、四天王戦への再訪 OK')
