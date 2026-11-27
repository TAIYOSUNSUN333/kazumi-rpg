const {createHmac, randomBytes, timingSafeEqual} = require('node:crypto');
const origin = 'https://kazumi-rpg.netlify.app';
const callback = origin+'/.netlify/functions/bgm-admin?auth=callback';
const sessionName = '__Host-kazumi-bgm';
const stateName = '__Host-kazumi-bgm-state';
const cookie = (name, value, age) => name+'='+value+'; Max-Age='+age+'; Path=/; Secure; HttpOnly; SameSite=Lax';
const cookies = event => Object.fromEntries((event.headers.cookie || '').split(';').map(part=>part.trim().split('=',2)));
const signature = value => createHmac('sha256',process.env.BGM_OAUTH_CLIENT_SECRET).update(value).digest('hex');
const matches = (a,b) => typeof a==='string' && typeof b==='string' && a.length===b.length &&
  timingSafeEqual(Buffer.from(a,'ascii'),Buffer.from(b,'ascii'));

function sessionValid(event) {
  const token = cookies(event)[sessionName] || '';
  if (!/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires,mac] = token.split('.');
  return Number(expires) > Date.now()/1000 && matches(mac,signature('session:'+expires));
}

async function authenticate(event, query, result) {
  const redirect = (location, values = []) => ({
    statusCode:303,headers:{Location:location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'},
    multiValueHeaders:{'Set-Cookie':values},body:''
  });
  if (query.auth === 'logout' && event.httpMethod === 'POST' && event.headers.origin === origin) {
    const response = result(200,{signedOut:true});
    response.headers['Set-Cookie'] = cookie(sessionName,'',0);
    return response;
  }
  if (event.httpMethod !== 'GET') return result(405,{error:'この操作には対応していません。'});
  if (query.auth === 'login') {
    const state = randomBytes(32).toString('hex');
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({client_id:process.env.BGM_OAUTH_CLIENT_ID,redirect_uri:callback,state});
    return redirect(url.href,[cookie(stateName,state,600)]);
  }
  if (query.auth !== 'callback') return result(404,{error:'操作が見つかりませんでした。'});
  const finish = (status, session) => redirect('/bgm-admin/'+(status ? '?login='+status : ''),[
    cookie(stateName,'',0),session ? cookie(sessionName,session,28800) : cookie(sessionName,'',0)
  ]);
  if (!query.code || !/^[a-f0-9]{64}$/.test(query.state || '') || !matches(query.state,cookies(event)[stateName])) {
    return finish('retry');
  }
  try {
    const exchange = await fetch('https://github.com/login/oauth/access_token',{
      method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({client_id:process.env.BGM_OAUTH_CLIENT_ID,client_secret:process.env.BGM_OAUTH_CLIENT_SECRET,
        code:query.code,redirect_uri:callback}),signal:AbortSignal.timeout(10000)
    });
    const {access_token:token} = await exchange.json();
    if (!exchange.ok || !token) return finish('retry');
    const identity = await fetch('https://api.github.com/user',{
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)
    });
    if (!identity.ok) return finish('retry');
    const account = await identity.json();
    if (account.login?.toLowerCase() !== 'taiyosunsun333') return finish('denied');
    const expires = String(Math.floor(Date.now()/1000)+28800);
    return finish('',expires+'.'+signature('session:'+expires));
  } catch {
    return finish('retry');
  }
}

module.exports = {authenticate,sessionValid,origin};
