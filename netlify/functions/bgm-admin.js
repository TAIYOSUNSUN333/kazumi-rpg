const { authenticate, sessionValid, origin } = require('../bgm-auth.js');
const { bgmCatalog } = require('../../bgm.js');
const QRCode = require('qrcode');

const limit = 4 * 1024 * 1024;
const folder = 'assets/bgm';
const endpoint = 'https://api.github.com/repos/TAIYOSUNSUN333/kazumi-rpg/contents/';
const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
const result = (statusCode, data) => ({
  statusCode, headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(data)
});

function isMP3(bytes) {
  let offset = 0;
  if (bytes.length >= 10 && bytes.subarray(0,3).toString() === 'ID3') {
    const size = [...bytes.subarray(6,10)];
    if (size.some(value => value > 127)) return false;
    offset = 10 + size.reduce((total,value) => total * 128 + value,0);
    if (bytes[5] & 16 && bytes[3] === 4) offset += 10;
  }
  const [,sync,rate,format] = bytes.subarray(offset,offset+4);
  return offset+4 < bytes.length && bytes[offset] === 255 && (sync & 0xe6) === 0xe2 &&
    (sync & 0x18) !== 8 && (rate & 0xf0) !== 0xf0 && (rate & 12) !== 12 && (format & 3) !== 2;
}

async function github(path, method = 'GET', payload) {
  return fetch(endpoint+path,{
    method, headers:{Authorization:'Bearer '+process.env.BGM_GITHUB_TOKEN,
      Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
    body:payload && JSON.stringify(payload),signal:AbortSignal.timeout(12000)
  });
}

exports.handler = async event => {
  const method = event.httpMethod;
  const query = event.queryStringParameters || {};
  if (method === 'GET' && ['1','download','url'].includes(query.qr)) {
    // Use the platform's production URL, avoiding arbitrary URLs supplied by callers.
    const base = process.env.BGM_PUBLIC_URL || process.env.URL || event.rawUrl;
    let url;
    try {
      const origin = new URL(base);
      if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('Invalid origin');
      url = new URL('/bgm-studio/',origin.origin).href;
    } catch {
      return result(503,{error:'公開URLを取得できません。'});
    }
    if (query.qr === 'url') return result(200,{url});
    const png = await QRCode.toBuffer(url,{type:'png',width:720,margin:4,errorCorrectionLevel:'M'});
    const disposition = query.qr === 'download' ? 'attachment' : 'inline';
    return {statusCode:200,headers:{...headers,'Content-Type':'image/png',
      'Content-Disposition':disposition+'; filename="kazumi-bgm-admin.png"'},
      isBase64Encoded:true,body:png.toString('base64')};
  }
  if (!process.env.BGM_OAUTH_CLIENT_ID || !process.env.BGM_OAUTH_CLIENT_SECRET || !process.env.BGM_GITHUB_TOKEN) {
    return result(503,{error:'NetlifyでGitHubログインの初期設定が必要です。'});
  }
  if (query.auth) return authenticate(event,query,result);
  if (!sessionValid(event)) return result(401,{error:'GitHubでログインしてください。'});
  if (['PUT','DELETE'].includes(method) && event.headers.origin !== origin) {
    return result(403,{error:'本番のBGM管理画面から操作してください。'});
  }
  try {
    if (method === 'GET' && !query.track) {
      const response = await github(folder+'?ref=main');
      if (!response.ok) return result(502,{error:'GitHubの登録状況を取得できません。'});
      const entries = await response.json();
      return result(200,{tracks:bgmCatalog.map(track => {
        const entry = entries.find(file => file.type === 'file' && file.name === track.file);
        return {...track,sha:entry?.sha ?? null,size:entry?.size ?? null};
      })});
    }
    if (!['PUT','DELETE'].includes(method)) return result(405,{error:'この操作には対応していません。'});
    const track = bgmCatalog.find(item => item.id === query.track);
    if (!track) return result(400,{error:'曲を選択してください。'});
    const sha = event.headers['x-bgm-sha'];
    if (sha !== 'new' && !/^[a-f0-9]{40}$/.test(sha || '') || method === 'DELETE' && sha === 'new') {
      return result(400,{error:'最新の登録状況を取得してください。'});
    }
    const payload = {message:(method === 'DELETE' ? 'Remove ' : 'Update ')+track.file,branch:'main'};
    if (sha !== 'new') payload.sha = sha;
    if (method === 'PUT') {
      if (!event.isBase64Encoded || !event.body || event.body.length > Math.ceil(limit/3)*4) {
        return result(413,{error:'4 MiB以下のMP3を選択してください。'});
      }
      const bytes = Buffer.from(event.body,'base64');
      if (bytes.length > limit) return result(413,{error:'4 MiB以下のMP3を選択してください。'});
      if (!isMP3(bytes)) return result(415,{error:'読み取れるMP3を選択してください。'});
      payload.content = bytes.toString('base64');
    }
    const response = await github(folder+'/'+track.file,method,payload);
    if ([409,422,404].includes(response.status)) return result(409,{error:'保存できませんでした。登録状況とGitHubの書き込み権限を確認してください。'});
    if (!response.ok) return result(502,{error:'GitHubへの保存に失敗しました。管理設定を確認してください。'});
    const saved = await response.json();
    return result(200,{sha:saved.content?.sha ?? null,commit:saved.commit.sha});
  } catch {
    return result(502,{error:'GitHubに接続できませんでした。時間をおいて確認してください。'});
  }
};
