import os

from playwright.sync_api import expect, sync_playwright

URL = os.getenv('KAZUMI_TEST_URL', 'http://127.0.0.1:3014/')

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.getenv('KAZUMI_CHROMIUM'))
    page = browser.new_page(viewport={'width': 390, 'height': 844}, has_touch=True,
                            is_mobile=True, service_workers='block')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    tap = lambda name: page.get_by_role('button', name=name, exact=True).tap()
    for name in ('はじめから','ソソとの思い出','戸口を調べる','旅支度をする','街道へ出る'):
        tap(name)
    # An old save must load with its progress, an empty family and its original Soso state.
    page.evaluate("""() => {
      player.gold=900;
      companions.set('一郎',initialCompanion('一郎'));
      player.party.push('一郎');
      joined=true;
      save();
      const old=readAdventure();
      delete old.family;
      storage.write(saveKey,old);
    }""")
    page.reload()
    tap('冒険を再開')
    assert page.evaluate("player.gold === 900 && joined && family.children.length === 0")
    page.evaluate('openMenu()')
    tap('恋愛・相性')
    tap('一郎')
    tap('告白する')
    expect(page.get_by_text('今はこの関係のままでいたい',exact=False)).to_be_visible()
    tap('戻る')
    for day in range(5):
        tap('会話する')
        page.evaluate('tickTown(3600); adultMenu("一郎")')
    tap('一緒に食事をする　6G')
    tap('告白する')
    tap('交際を始める')
    tap('結婚を申し込む')
    tap('式を挙げる　40G')
    expect(page.get_by_role('img',name='一美、一郎の記念画')).to_be_visible()
    assert page.evaluate("family.spouse === '一郎' && audio.track === 'familyWedding'")

    page.evaluate("""() => {
      const site=towns[0].sites.find(s=>s.kind==='store');
      interior={site,x:320,y:145};
      servicePanel();
    }""")
    tap('生活用品を買う')
    tap('避妊具　6G')
    page.evaluate("""() => {
      const site=towns[0].sites.find(s=>s.kind==='inn');
      interior={site,x:320,y:145};
      servicePanel();
    }""")
    tap('二人で過ごす宿泊を選ぶ')
    tap('一郎')
    tap('話を続ける')
    tap('抱擁する')
    tap('キスを交わす')
    tap('やめる')
    assert page.evaluate('family.pregnancy === null && family.supplies.避妊具 === 1')
    page.evaluate("spendNight('一郎',true,()=>.1)")
    assert page.evaluate('family.pregnancy === null && family.supplies.避妊具 === 0')
    page.evaluate("spendNight('一郎',false,()=>0)")
    assert page.evaluate('family.pregnancy.twins && family.pregnancy.notice === 0')
    tap('翌朝へ')
    tap('受付へ')
    page.evaluate('tickTown(2*3600); maternityClinic()')
    expect(page.get_by_text('妊娠初期',exact=False)).to_be_visible()
    tap('相手に報告する')
    tap('これからの話をする')
    page.evaluate('tickTown(16*3600); maternityClinic()')
    tap('出産を迎える')
    page.get_by_role('textbox',name='1人目の名前').fill('春')
    page.get_by_role('textbox',name='2人目の名前').fill('空')
    tap('名前を決める')
    assert page.evaluate("family.children.map(c=>c.name).join() === '春,空' && player.party.join()==='一郎'")
    assert page.evaluate("family.pregnancy === null && audio.track === 'familyBirth'")
    page.evaluate('tickTown(50*3600); familyMenu()')
    tap('春　5歳')
    expect(page.get_by_text('得意属性',exact=False)).to_be_visible()
    tap('ソソと遊ぶ')
    page.evaluate('familyMenu()')
    tap('家族の遠足')
    tap('アルバムを見る')
    page.get_by_role('button',name='青森県・第',exact=False).tap()
    expect(page.get_by_role('link',name='写真を保存')).to_be_visible()

    page.evaluate('housingMenu()')
    tap('土地と家を買う')
    tap('家を拡張　120G')
    tap('庭')
    tap('野菜の種をまく')
    tap('釣りをする')
    page.evaluate("tickTown(3*3600); houseRoom(family.houses[0],'庭')")
    tap('収穫する')
    tap('自宅へ戻る')
    tap('家族で食卓を囲む')
    tap('釣った魚の塩焼き')
    assert page.evaluate('family.houses[0].fish === 0 && family.houses[0].produce === 3')
    page.reload()
    tap('冒険を再開')
    assert page.evaluate("joined && family.spouse === '一郎' && family.children.length === 2 && family.houses[0].tier === 2")
    assert page.evaluate("""() => {
      const silhouettes = new Set(enemies.map(enemy => anatomyFor(enemy).group));
      const forms = new Set([1,2,3,4,5].map(form => sosoFormArt(form).toDataURL()));
      const portraits = new Set(prefectures.map(region=>personArt(region.companion,0,true).toDataURL()));
      const regions = new Set(prefectures.map((_,i)=>localBackdrop(i,0).toDataURL()));
      return silhouettes.size >= 10 && forms.size === 5 && portraits.size === 47 && regions.size === 47 &&
        variantCache.size <= 84 && towns.every(town => town.sites.some(site=>site.kind==='clinic'));
    }""")
    page.evaluate("""() => {
      interior=null;
      resume();
      const foe=activeEnemies(0)[0];
      encounter(foe);
      player.hp=40;
      battle.familyHelpAt=clock;
      familySupport();
    }""")
    assert page.evaluate('player.hp > 40 && battle.familyHelpAt > clock')
    assert not errors, errors
    browser.close()
    print('Old-save migration, consent, marriage, pregnancy, twins, growth, housing, family support and regional art OK')
