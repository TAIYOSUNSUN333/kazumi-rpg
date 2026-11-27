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
    files = {'01_title.mp3': mp3, '09_battle.mp3': mp3, '14_inn.mp3': mp3,
             '21_transform.mp3': mp3, '30_morning.mp3': b'corrupt recording'}
    requests = []

    def serve_mp3(route):
        method = route.request.method
        name = route.request.url.rsplit('/', 1)[-1]
        requests.append((method, name))
        if name == '03_town.mp3':
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
    page.wait_for_function('audio.playingId === "title" && audio.recordingSource.loop')
    button('はじめから').tap()
    button('街道へ出る').tap()
    page.wait_for_function('audio.synthTrack === "town0" && !audio.playingId')
    page.evaluate('paused=true; setEncounterTrack(activeEnemies(0)[0])')
    page.wait_for_function('audio.playingId === "battle"')
    page.evaluate('''() => {
      window.previousTrackEnded = false;
      audio.recordingSource.onended = () => { window.previousTrackEnded = true; };
      audio.setTrack('innEntry');
    }''')
    page.wait_for_function('audio.playingId === "inn"')
    assert not page.evaluate('window.previousTrackEnded')
    page.wait_for_function('window.previousTrackEnded && audio.music.gain.value > .95')
    page.evaluate('''() => {
      window.innPlaying = audio.recordingSource;
      audio.setTrack('innDesk');
    }''')
    assert page.evaluate('window.innPlaying === audio.recordingSource && audio.recordingSource.loop')
    page.evaluate("audio.play('awake2')")
    page.wait_for_function('audio.cueSource && !audio.cueSource.loop')
    page.wait_for_function('!audio.cueSource')

    page.evaluate('openMenu()')
    button('設定').tap()
    slider = page.get_by_role('slider', name='BGM', exact=True)
    slider.fill('32')
    page.wait_for_function('audio.bgm.gain.value < .33 && audio.bgm.gain.value > .30')
    button('サウンドテスト').tap()
    rows = page.locator('.sound-catalog li')
    expect(rows).to_have_count(30)
    expect(rows.nth(2)).to_contain_text('未登録')
    expect(rows.nth(6)).to_contain_text('07_snow.mp3')
    expect(rows.nth(29)).to_contain_text('登録済み')
    expect(rows.nth(0)).to_contain_text('登録済み')
    assert ('GET', '30_morning.mp3') not in requests
    button('宿屋・起床を試聴').tap()
    expect(rows.nth(29)).to_contain_text('再生できません')
    button('タイトルを試聴').tap()
    page.wait_for_function('audio.playingId === "title"')
    button('試聴を止める').tap()
    page.wait_for_function('audio.playingId === "inn"')
    files['02_field.mp3'] = mp3
    button('登録状況を更新').tap()
    expect(rows.nth(1)).to_contain_text('登録済み')
    button('フィールドを試聴').tap()
    page.wait_for_function('audio.playingId === "field"')
    button('設定に戻る').tap()
    page.wait_for_function('!audio.previewId && audio.playingId === "inn"')
    button('消音').tap()
    page.wait_for_function('audio.master.gain.value < .01')
    assert not errors, errors
    browser.close()
    print('登録30枠、MP3の再生とループ、クロスフェード、変身曲、未登録・破損時の代替、登録更新、音量・消音 OK')
