import os

from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('KAZUMI_CHROMIUM'))
    p=b.new_page(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
    errs=[]
    p.on('pageerror',lambda e:errs.append(str(e)))
    p.goto(os.getenv('KAZUMI_TEST_URL','http://127.0.0.1:3009/'))
    p.get_by_role('button',name='はじめから',exact=True).tap()
    p.get_by_role('button',name='ソソとの思い出',exact=True).tap()
    p.get_by_role('button',name='戸口を調べる',exact=True).tap()
    p.get_by_role('button',name='旅支度をする',exact=True).tap()
    p.get_by_role('button',name='街道へ出る',exact=True).tap()
    result=p.evaluate('''() => {
      Math.random=()=>.5;
      const phases=new Map(), losses={};
      let tick=0;
      for (;tick<240000 && !done;tick++) {
        if(paused) {
          const title=$('panel-title').textContent;
          if(title.endsWith('を仲間にしますか？')) $('panel-buttons').lastChild.click();
          else if(title.endsWith('は倒れた')) {
            const chapter=chapterOf(player.x)+1;
            losses[chapter]=(losses[chapter]||0)+1;
            if(losses[chapter]>8) break;
            $('panel-buttons').firstChild.click();
          } else if(['第10章クリア・ソソが仲間になった','世界に朝が戻った','若草山から続く道'].includes(title)) {
            $('panel-buttons').firstChild.click();
          } else return {halted:title,x:player.x};
        }
        if(isActionBattle() && battle.age>.42) {
          const foe=battle.enemy;
          battle.auto=true;
          if(isFinalBoss(foe)) {
            if(!phases.has(foe.name)) phases.set(foe.name,new Set());
            phases.get(foe.name).add(finalPhase(foe));
          }
          if(clock>=specialAt && player.mp>=10 && (!foe.boss || foe.hp>foe.max*.12)) actionThinkOfSoso();
          if(isActionBattle() && clock>=battle.limitAt && foe.boss && player.mp>=8) actionLimit();
        }
        if(!battle && !destination) guide();
        update(.05);
      }
      return {done,joined,tick,x:player.x,y:player.y,losses,foe:battle?.enemy.name,
        phases:[...phases].map(([name,forms])=>[name,[...forms]]),
        mid:enemies.filter(enemy=>enemy.rank==='mid' && enemy.hp===0).length,
        major:enemies.filter(enemy=>enemy.rank==='major' && enemy.hp===0).length,
        stones:waysideStones.filter(s=>s.solved).length};
    }''')
    print(result,flush=True)
    assert result['done'] and result['mid']==47 and result['major']==47 and result['stones']==0
    assert [item[1] for item in result['phases']]==[[1,2,3],[1,2,3]],result
    assert not errs,errs
