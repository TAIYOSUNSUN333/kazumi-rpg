import os

from playwright.sync_api import sync_playwright, expect
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.getenv('KAZUMI_CHROMIUM'))
  page=browser.new_page(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.getenv('KAZUMI_TEST_URL', 'http://127.0.0.1:3009/'))
  buttons=lambda n: page.get_by_role('button',name=n,exact=True)
  buttons('はじめから').tap()
  buttons('街道へ出る').tap()
  result=page.evaluate('''() => {
    Math.random=()=>.5;
    const forms=new Map(), losses={};
    let tick=0, guideLast=0;
    for (; tick<300000 && !done; tick++) {
      if (paused) {
        const text=$('panel-title').textContent;
        if (text.endsWith('を仲間にしますか？')) $('panel-buttons').lastChild.click();
        else if (text.endsWith('は倒れた')) {
          const place=chapterOf(player.x)+1;
          losses[place]=(losses[place]||0)+1;
          if (losses[place]>6) break;
          $('panel-buttons').firstChild.click();
        } else if (['第10章クリア・ソソが仲間になった','世界に朝が戻った','若草山から続く道'].includes(text)) {
          $('panel-buttons').firstChild.click();
        } else return {halted:text,x:player.x};
      }
      if (battle?.command.phase==='select') {
        const turn=battle.command;
        const actor=turn.allies[turn.pick];
        const foe=turn.foes.find(commandAlive);
        const stats=actor.stats();
        if (isFinalBoss(foe.enemy)) {
          if(!forms.has(foe.name)) forms.set(foe.name, new Set());
          forms.get(foe.name).add(finalPhase(foe.enemy));
        }
        const wounded=turn.allies.filter(a=>commandAlive(a) && a.stats().unit.hp<a.stats().max*.68);
        const hp=actor.stats().unit.hp;
        const heal=wounded.sort((a,b)=>a.stats().unit.hp/a.stats().max-b.stats().unit.hp/b.stats().max)[0];
        const move=(hp<stats.max*.65 && actor.id === 'hero' && commandMoves(actor,'item')[0]) ||
          (heal && commandMoves(actor,'magic').find(move=>move.motion==='heal' && move.cost<=stats.unit.mp)) ||
          commandMoves(actor,'limit').find(move=>move.cost<=stats.unit.mp) ||
          (actor.id==='cat' && commandMoves(actor,'magic').find(move=>move.motion==='magic' && move.cost<=stats.unit.mp)) ||
          (stats.unit.mp > (actor.id==='hero' ? 10 : 6) && commandMoves(actor,'skill')[0]) || commandMoves(actor,'attack')[0];
        queueCommand(actor, move, move.motion==='heal' ? (move.herb ? actor : heal) : foe);
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
  buttons('逃げる').tap()
  assert page.evaluate('!battle && done')
  browser.close()
  assert not errors,errors
  print('47章と両ラスボス3形態、石碑未回答の帰宅、四天王戦への再訪 OK')
