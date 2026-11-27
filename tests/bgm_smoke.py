import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright


URL = os.getenv('KAZUMI_TEST_URL', 'http://127.0.0.1:3009/')


with tempfile.TemporaryDirectory() as folder, sync_playwright() as pw:
    recording = Path(folder) / 'sample.mp3'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i',
                    'sine=frequency=440:sample_rate=22050', '-t', '1', str(recording)], check=True)
    mp3 = recording.read_bytes()
    files = {f'bgm_{number:02}.mp3': mp3 for number in range(1,31)}
    files['bgm_16.mp3'] = b'corrupt recording'
    del files['bgm_08.mp3']
    requests = []

    def serve_mp3(route):
        method = route.request.method
        name = route.request.url.rsplit('/', 1)[-1]
        requests.append((method, name))
        if name == 'bgm_08.mp3':
            route.fulfill(status=200, content_type='text/html', body='Fallback HTML')
        elif name in files:
            route.fulfill(status=200, content_type='audio/mpeg', body=b'' if method == 'HEAD' else files[name])
        else:
            route.fulfill(status=404, body='')

    browser = pw.chromium.launch(executable_path=os.getenv('KAZUMI_CHROMIUM'))
    context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                                  is_mobile=True, service_workers='block')
    context.route('**/assets/bgm/*.mp3', serve_mp3)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    button = lambda name: page.get_by_role('button', name=name, exact=True)
    page.goto(URL)
    assert not requests
    page.locator('#panel-title').tap()
    page.wait_for_function('audio.playingId === "01" && audio.recordingSource.loop')
    assert {name for _, name in requests} == {'bgm_01.mp3'}
    for number, label in enumerate(('はじめから','ソソとの思い出','戸口を調べる','旅支度をする'), 2):
        button(label).tap()
        page.wait_for_function(f'audio.playingId === "{number:02}" && !audio.recordingSource.loop')
    button('街道へ出る').tap()
    page.wait_for_function('audio.playingId === "13"')
    page.evaluate('openMenu()')
    button('装備').tap()
    page.wait_for_function('audio.playingId === "14"')
    button('メニューに戻る').tap()
    page.wait_for_function('audio.playingId === "13"')
    page.evaluate('openMenu()')
    button('酒場').tap()
    page.wait_for_function('audio.playingId === "17" && audio.recordingSource.loop')
    button('クルミを誘う').tap()
    assert page.evaluate('audio.playingId === "17"')
    button('いいえ').tap()
    button('メニューに戻る').tap()
    page.wait_for_function('audio.playingId === "13"')
    page.evaluate('''() => {
      player.x = (originalFinal - 1) * span + 400;
      setFieldTrack();
      const pendingCrisis = audio.musicRequest;
      player.x = (originalFinal - 1) * span + 50;
      setFieldTrack();
      window.reusedCrisisRequest = pendingCrisis === audio.musicRequest;
    }''')
    page.wait_for_function('audio.playingId === "27"')
    assert page.evaluate('window.reusedCrisisRequest')
    assert requests.count(('GET', 'bgm_27.mp3')) == 1
    page.evaluate('''() => {
      window.previousTrackEnded = false;
      audio.recordingSource.onended = () => { window.previousTrackEnded = true; };
      setEncounterTrack(activeEnemies(originalFinal).find(isFinalBoss));
    }''')
    page.wait_for_function('audio.playingId === "28"')
    assert not page.evaluate('window.previousTrackEnded')
    page.wait_for_function('window.previousTrackEnded && audio.music.gain.value > .95')
    page.evaluate('setEncounterTrack(activeEnemies(last).find(isFinalBoss))')
    assert requests.count(('GET', 'bgm_28.mp3')) == 1
    page.evaluate("audio.playInterlude('26'); undefined")
    page.wait_for_function('audio.playingId === "26" && !audio.recordingSource.loop')
    page.wait_for_function('audio.playingId === "28"')
    page.evaluate("setFieldTrack(); audio.playInterlude('29'); undefined")
    page.wait_for_function('audio.playingId === "29" && !audio.recordingSource.loop')
    page.wait_for_function('audio.playingId === "27"')

    button('設定').tap()
    slider = page.get_by_role('slider', name='BGM', exact=True)
    slider.fill('32')
    page.wait_for_function('audio.bgm.gain.value < .33 && audio.bgm.gain.value > .30')
    button('サウンドテスト').tap()
    rows = page.locator('.sound-catalog li')
    expect(rows).to_have_count(30)
    expect(rows.nth(0)).to_contain_text('タイトル画面')
    expect(rows.nth(7)).to_contain_text('未登録')
    expect(rows.nth(16)).to_contain_text('酒場・仲間募集・交流')
    expect(rows.nth(26)).to_contain_text('世界崩壊の危機')
    expect(rows.nth(27)).to_contain_text('ラスボス戦')
    expect(rows.nth(29)).to_contain_text('エンディング・スタッフロール')
    assert ('GET', 'bgm_16.mp3') not in requests
    button('16番を試聴').tap()
    expect(rows.nth(15)).to_contain_text('再生できません')
    button('01番を試聴').tap()
    page.wait_for_function('audio.playingId === "01"')
    button('試聴を止める').tap()
    page.wait_for_function('audio.playingId === "27"')
    button('設定に戻る').tap()
    button('消音').tap()
    page.wait_for_function('audio.master.gain.value < .01')
    page.evaluate('''() => {
      activeEnemies(originalFinal).find(isFinalBoss).hp = 0;
      setFieldTrack();
    }''')
    page.wait_for_function('audio.recording === "13"')
    page.evaluate('arriveHome()')
    page.wait_for_function('audio.playingId === "30" && !audio.recordingSource.loop')
    expect(button('旅を振り返る')).to_be_disabled()
    expect(button('旅を振り返る')).to_be_enabled()
    assert page.evaluate('audio.recordingSource === null')
    button('旅を振り返る').tap()
    page.wait_for_function('audio.playingId === "13"')
    assert not errors, errors
    browser.close()
    print('正式30枠、場面再生、勝利と覚醒後の復帰、ループ、フェード、音量、エンディング完奏 OK')
