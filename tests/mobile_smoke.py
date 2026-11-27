import os

from playwright.sync_api import expect, sync_playwright


URL = os.getenv('KAZUMI_TEST_URL', 'http://127.0.0.1:3009/')


def button(page, name):
    return page.get_by_role('button', name=name, exact=True)


def start(page):
    page.goto(URL, wait_until='load')
    button(page, 'はじめから').tap()
    button(page, '街道へ出る').tap()
    page.wait_for_function('mode === "field"')


def mobile_touch(context, page, width, height):
    surface = page.locator('#scene').bounding_box()
    assert surface['width'] == width and surface['height'] == height
    assert page.locator('#joystick').is_hidden()
    client = context.new_cdp_session(page)

    def send(kind, *points):
        client.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [
            {'id': i, 'x': x, 'y': y} for i, x, y in points
        ]})

    def center(selector):
        box = page.locator(selector).bounding_box()
        return box['x'] + box['width'] / 2, box['y'] + box['height'] / 2

    page.evaluate('player.x=474;player.y=103;fieldSafeUntil=clock+30')
    x, y = width * .44, height * .42
    send('touchStart', (0, x, y))
    expect(page.locator('#joystick')).to_be_visible()
    assert abs(center('#joystick')[0] - x) < 1 and abs(center('#joystick')[1] - y) < 1
    send('touchMove', (0, x + 47, y + 13))
    page.wait_for_function('player.x > 483 && player.y > 104')
    cut = center('#slash')
    jump = center('#jump')
    send('touchStart', (0, x + 47, y + 13), (1, *cut))
    send('touchStart', (0, x + 47, y + 13), (1, *cut), (2, *jump))
    page.wait_for_function('jumpHeight > 12 && pressed("jump") && pressed("attack") && joystick.x > .4')
    send('touchEnd')
    expect(page.locator('#joystick')).to_be_hidden()
    page.wait_for_function('jumpHeight === 0 && !pressed("attack") && joystick.id === null')
    for _ in range(10):
        send('touchStart', (1, *cut))
        send('touchEnd')
    send('touchStart', (0, x, y), (1, x + 28, y))
    send('touchMove', (0, x - 24, y), (1, x + 94, y))
    send('touchEnd')
    assert page.evaluate('visualViewport.scale === 1 && scrollX === 0 && scrollY === 0 && !getSelection().toString()')
    assert page.evaluate("""() => {
      const long = new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
      document.querySelector('#slash').dispatchEvent(long);
      return long.defaultPrevented;
    }""")


def menu_and_stone(page):
    button(page, 'メニュー').tap()
    button(page, '装備').tap()
    expect(page.locator('#panel-title')).to_have_text('所持装備')
    assert page.locator('#panel-buttons button').filter(has_text='購入').count() == 0
    button(page, 'メニュー').tap()
    expect(page.locator('#panel')).to_be_hidden()
    page.evaluate('''() => {
      const stone=shrines[0];
      player.x=stone.x-23; player.y=stone.row;
      player.facing={x:1,y:0}; attackAt=clock; fieldSafeUntil=clock+30;
      player.gold=0;player.hp=maxHP();
    }''')
    button(page, '斬撃').tap()
    expect(page.locator('#panel-title')).to_have_text('石碑のなぞなぞ')
    assert page.locator('#panel').get_attribute('data-kind') == 'dialogue'
    question = page.evaluate('shrineQuestion(shrines[0],0)')
    for _ in range(3):
        button(page, question['choices'][1]).tap()
    expect(page.get_by_text('ヒント　' + question['hint'], exact=True)).to_be_visible()
    button(page, question['answer']).tap()
    expect(page.locator('#panel-title')).to_contain_text('正解')
    button(page, '旅に戻る').tap()
    assert page.evaluate('shrines[0].solved && player.gold === 18 && player.hp === maxHP()-3*Math.ceil(maxHP()*.1)')


def battle_and_party(page):
    result = page.evaluate('''() => {
      for (const name of ['一郎','恵美ちゃん','クルミ']) {
        const profile=companionProfile(name);
        companions.set(name,{name,hp:profile.hp,mp:profile.mp,xp:0,gear:0,
          affinity:22,trust:15,history:[],tactic:'攻撃優先'});
        player.party.push(name);
      }
      for (let i=0;i<3;i++) {
        towns[[2,5,8][i]].sites.at(-1).seal.solved=true;
        const name=monsterCompanion(i);
        const profile=companionProfile(name);
        companions.set(name,{name,monster:true,origin:i,hp:profile.hp,mp:profile.mp,xp:0,
          gear:0,affinity:0,trust:0,history:[],tactic:'攻撃優先'});
        player.party.push(name);
      }
      joined=true;
      const foe=activeEnemies(10)[7];
      player.x=10*span+880; player.y=104;
      encounter(foe);
      return battle.members.length === 6 && joined && isActionBattle();
    }''')
    assert result
    page.wait_for_function('battle.age>.42')
    assert page.locator('#arena-actions').is_visible()
    page.evaluate('battle.catX=120;battle.catY=249;Math.random=()=>.52')
    button(page, 'AUTO OFF').tap()
    expect(button(page, 'AUTO ON')).to_be_visible()
    page.wait_for_function('battle.heroX>180')
    button(page, 'AUTO ON').tap()
    page.evaluate('Math.random=()=>.999')
    button(page, 'メニュー').tap()
    button(page, '逃げる').tap()
    assert page.evaluate('isActionBattle() && battle.escapeAt>clock && !paused')
    button(page, 'メニュー').tap()
    button(page, '酒場').tap()
    expect(page.locator('#panel-title')).to_have_text('酒場')
    button(page, '一郎').tap()
    button(page, '守備優先').tap()
    button(page, 'メニュー').tap()
    paused = page.evaluate('''() => {
      const expected=companions.get('一郎').tactic==='守備優先';
      battle.escapeAt=clock;Math.random=()=>0;
      return expected && !paused && battle.members.length===6;
    }''')
    assert paused
    button(page, 'メニュー').tap()
    button(page, '逃げる').tap()
    assert page.evaluate('!battle && player.x===10*span+880')
    page.reload(wait_until='load')
    button(page, '冒険を再開').tap()
    assert page.evaluate('activeCompanions().length===6 && humans().length===2 && joined && readAdventure().version===11')


def shops_and_bath(page):
    page.evaluate('''() => {
      const site=townSites.get('0-store');
      player.x=site.x;player.y=site.row;player.gold=95;
      interior={site,x:320,y:112};servicePanel();
    }''')
    initial_herbs = page.evaluate('player.herbs')
    button(page, '商品一覧').tap()
    assert page.locator('#panel-buttons .goods-icon').count() == 12
    page.locator('#panel-buttons button').filter(has_text='薬草').first.tap()
    page.locator('#panel input[type=number]').fill('3')
    button(page, '購入する').tap()
    assert page.evaluate('(before)=>player.herbs===before+3 && player.gold===71', initial_herbs), page.evaluate('({herbs:player.herbs,gold:player.gold})')
    page.evaluate('''() => {
      const site=townSites.get('0-bath');
      player.x=site.x;player.y=site.row;player.hp=28;
      interior={site,x:320,y:115};servicePanel();
    }''')
    button(page, '入浴する　8G').tap()
    page.evaluate('advanceBath(4)')
    assert page.evaluate("bathScene.stage === 2 && audio.track === 'bath'")
    button(page, '入浴演出をスキップ').tap()
    assert page.evaluate('!bathPending && player.gold===63 && player.hp===Math.min(maxHP(),28+Math.ceil(maxHP()*.46))')


def pwa(context, page):
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    manifest = page.evaluate("fetch('manifest.webmanifest').then(response=>response.json())")
    assert manifest['display'] == 'standalone'
    context.set_offline(True)
    page.reload(wait_until='load')
    button(page, '冒険を再開').tap()
    assert page.evaluate('readAdventure().version === 11 && activeCompanions().length === 6')
    context.set_offline(False)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.getenv('KAZUMI_CHROMIUM'))
    for width, height in [(390, 844), (844, 390)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        start(page)
        mobile_touch(context, page, width, height)
        menu_and_stone(page)
        battle_and_party(page)
        shops_and_bath(page)
        pwa(context, page)
        assert not errors, errors
        print(f'{width}x{height} floating stick, triple touch, zoom, riddle, eight-member party, AUTO, escape, purchase, bath, save and offline OK')
        context.close()
    browser.close()
