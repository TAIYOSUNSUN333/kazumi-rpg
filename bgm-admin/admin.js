const $ = id => document.getElementById(id);
const api = '/.netlify/functions/bgm-admin';
const maxSize = 4 * 1024 * 1024;
let key = '';
let generation = 0;
let busy = false;
const songs = ['星を継ぐ旅','風の街道','小さな灯の町','木漏れ日の森','深き岩の記憶',
  '潮騒の岬','白銀の峠','星明かりの旅路','剣と疾風','立ちはだかる影',
  '王座を揺らす剣','四つの王冠','最後の星蝕','旅籠の灯','湯けむりの庭',
  '宵の酒場','ふたりの星','さよならの余韻','ソソの小さな足音','おかえり、ソソ',
  '覚醒の鼓動','創世の光','契約の呼び声','伝説の同行者','神話の邂逅',
  '勝利の星章','消えゆく灯','石碑のささやき','大都市の灯火','旅籠の朝'];

function request(method, track, body, progress) {
  return new Promise((resolve,reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method,api+(track ? '?track='+encodeURIComponent(track.id) : ''));
    xhr.timeout = 30000;
    xhr.setRequestHeader('Authorization','Bearer '+key);
    if (track) xhr.setRequestHeader('X-BGM-Sha',track.sha || 'new');
    if (body) {
      xhr.setRequestHeader('Content-Type','application/octet-stream');
      xhr.upload.onprogress = event => { if (event.lengthComputable) progress(100*event.loaded/event.total); };
    }
    xhr.onload = () => {
      let data;
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else reject(new Error(data?.error || '接続できませんでした。公開URLと通信状態を確認してください。'));
    };
    xhr.onerror = xhr.ontimeout = () => reject(new Error('通信を完了できませんでした。再操作の前に登録状況を更新してください。'));
    xhr.send(body || null);
  });
}

const asset = track => new URL('../assets/bgm/'+track.file,location.href);

async function liveStatus(track, signal) {
  const url = asset(track);
  url.searchParams.set('check',Date.now());
  const response = await fetch(url,{cache:'no-store',signal});
  if (response.status === 404 || response.status === 410) return !track.sha;
  if (!response.ok) throw new Error('公開ファイルを確認できません。');
  if (!/^(audio\/|application\/octet-stream)/.test(response.headers.get('content-type') || '')) return !track.sha;
  if (!track.sha) return false;
  const body = await response.arrayBuffer();
  const head = new TextEncoder().encode('blob '+body.byteLength+'\0');
  const bytes = new Uint8Array(head.length+body.byteLength);
  bytes.set(head);
  bytes.set(new Uint8Array(body),head.length);
  const digest = await crypto.subtle.digest('SHA-1',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('') === track.sha;
}

function trackCard(track, index) {
  const article = document.createElement('article');
  const name = document.createElement('h2');
  name.textContent = String(index+1).padStart(2,'0')+'　'+songs[index];
  const scene = document.createElement('p');
  scene.textContent = '使用場面　'+track.scene;
  const filename = document.createElement('small');
  filename.textContent = track.file;
  const status = document.createElement('p');
  status.className = 'status';
  status.setAttribute('role','status');
  const registered = () => track.sha ? 'GitHub登録済み' : '未登録';
  status.textContent = registered();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.mp3,audio/mpeg';
  input.setAttribute('aria-label',songs[index]+'のMP3を選択');
  const progress = document.createElement('progress');
  progress.max = 100;
  progress.hidden = true;
  const actions = document.createElement('div');
  actions.className = 'actions';
  const preview = document.createElement('button');
  preview.textContent = '公開音源を試聴';
  const remove = document.createElement('button');
  remove.textContent = '削除';
  remove.disabled = !track.sha;
  const check = document.createElement('button');
  check.textContent = '反映を確認';
  const player = document.createElement('audio');
  player.controls = true;
  player.hidden = true;
  preview.onclick = () => {
    const url = asset(track);
    url.searchParams.set('listen',Date.now());
    player.src = url.href;
    player.hidden = false;
    player.play().catch(()=>{ status.textContent = '公開音源を再生できません。反映状況を確認してください。'; });
  };
  let checking;
  async function verify(attempts = 1) {
    checking?.abort();
    const controller = checking = new AbortController();
    const lifecycle = generation;
    for (let attempt=0; attempt<attempts && !controller.signal.aborted && lifecycle===generation; attempt++) {
      status.textContent = registered()+'・公開先を確認中…';
      try {
        if (await liveStatus(track,controller.signal)) {
          status.textContent = track.sha ? '公開反映済み' : '公開先に音源なし';
          return;
        }
        status.textContent = 'Netlifyの反映待ち';
      } catch {
        if (!controller.signal.aborted) status.textContent = registered()+'・公開先を確認できません';
      }
      if (attempt+1<attempts) await new Promise(resolve=>setTimeout(resolve,7000));
    }
  }
  check.onclick = () => verify();
  async function save(method, file) {
    if (busy) { status.textContent = '別の曲を保存中です。完了後に選択してください。'; return; }
    checking?.abort();
    busy = input.disabled = remove.disabled = true;
    progress.hidden = method !== 'PUT';
    progress.value = 0;
    status.textContent = method === 'PUT' ? 'アップロード中…' : '削除中…';
    try {
      const saved = await request(method,track,file,value=>{
        progress.value = value;
        if (value === 100) status.textContent = 'GitHubへ保存中…';
      });
      track.sha = saved.sha;
      article.dataset.registered = String(Boolean(track.sha));
      $('count').textContent = document.querySelectorAll('article[data-registered="true"]').length+' / 30曲';
      verify(25);
    } catch(error) { status.textContent = error.message; }
    finally {
      busy = input.disabled = false;
      remove.disabled = !track.sha;
      progress.hidden = true;
    }
  }
  input.onchange = () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (!/\.mp3$/i.test(file.name) || !file.size || file.size > maxSize) {
      status.textContent = '4 MiB以下のMP3を選択してください。';
      return;
    }
    save('PUT',file);
  };
  remove.onclick = () => { if (confirm(name.textContent+'を削除しますか？')) save('DELETE'); };
  article.dataset.registered = String(Boolean(track.sha));
  actions.append(preview,remove,check);
  article.append(name,scene,filename,status,input,progress,actions,player);
  return article;
}

async function load() {
  if (busy) return;
  const lifecycle = ++generation;
  try {
    const {tracks} = await request('GET');
    if (lifecycle !== generation) return;
    $('tracks').replaceChildren(...tracks.map(trackCard));
    $('count').textContent = tracks.filter(track=>track.sha).length+' / '+tracks.length+'曲';
    $('login').hidden = true;
    $('library').hidden = false;
    $('message').textContent = '';
  } catch(error) {
    if (lifecycle === generation) $('message').textContent = error.message;
  }
}
$('login').onsubmit = event => {
  event.preventDefault();
  key = $('key').value.trim();
  $('key').value = '';
  load();
};
$('refresh').onclick = load;
$('logout').onclick = () => {
  if (busy) { $('message').textContent = '保存の完了を待ってください。'; return; }
  generation++;
  key = '';
  $('tracks').replaceChildren();
  $('message').textContent = '';
  $('library').hidden = true;
  $('login').hidden = false;
};
const direct = new URL('/bgm-admin/',location.href).href;
$('direct').textContent = direct;
$('direct').href = direct;
$('qr').onerror = () => { $('qr').hidden = true; $('qr-error').hidden = false; };
$('qr').src = api+'?qr=1';
