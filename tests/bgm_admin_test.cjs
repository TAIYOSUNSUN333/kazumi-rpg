const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { handler } = require('../netlify/functions/bgm-admin.js');
const origin = 'https://kazumi-rpg.netlify.app';
let session;
const sha = 'c'.repeat(40);
const commit = 'd'.repeat(40);
const event = (httpMethod, track, extra = {}) => ({
  httpMethod, queryStringParameters:track && {track},
  headers:{cookie:session,origin,'x-bgm-sha':'new'},...extra
});

test('admin authentication, 30 slots, safe writes and QR', async () => {
  assert.equal((await handler(event('GET'))).statusCode,503);
  process.env.BGM_OAUTH_CLIENT_ID = 'test-client';
  process.env.BGM_OAUTH_CLIENT_SECRET = 'test-secret';
  process.env.BGM_GITHUB_TOKEN = 'mock-contents-token';
  process.env.BGM_PUBLIC_URL = 'https://example.netlify.app';
  const calls = [];
  let login = 'other-user';
  global.fetch = async (url,options) => {
    if (url.endsWith('/access_token')) return Response.json({access_token:'mock-login'});
    if (url.endsWith('/user')) return Response.json({login});
    assert.equal(options.headers.Authorization,'Bearer mock-contents-token');
    calls.push([url,options.method,options.body && JSON.parse(options.body)]);
    if (!options.body) return Response.json([{type:'file',name:'bgm_01.mp3',sha,size:20}]);
    return Response.json({commit:{sha:commit},content:options.method === 'PUT' ? {sha} : null});
  };
  assert.equal((await handler(event('GET',null,{headers:{}}))).statusCode,401);
  assert.equal(calls.length,0);
  const begin = await handler(event('GET',null,{queryStringParameters:{auth:'login'},headers:{}}));
  const state = new URL(begin.headers.Location).searchParams.get('state');
  const cookie = begin.multiValueHeaders['Set-Cookie'][0].split(';')[0];
  const callback = state => handler(event('GET',null,{queryStringParameters:{auth:'callback',code:'test',state},headers:{cookie}}));
  assert.match((await callback('0'.repeat(64))).headers.Location,/login=retry/);
  assert.match((await callback(state)).headers.Location,/login=denied/);
  login = 'TAIYOSUNSUN333';
  const authenticated = await callback(state);
  assert.equal(authenticated.headers.Location,'/bgm-studio/');
  session = authenticated.multiValueHeaders['Set-Cookie'][1].split(';')[0];
  assert.equal((await handler(event('GET',null,{headers:{cookie:session+'0'}}))).statusCode,401);
  assert.equal((await handler(event('DELETE','01',{headers:{cookie:session,origin:'https://example.org'}}))).statusCode,403);
  const list = JSON.parse((await handler(event('GET'))).body);
  assert.equal(list.tracks.length,30);
  assert.equal(list.tracks[0].sha,sha);
  assert.deepEqual(list.tracks.map(track => track.number),Array.from({length:30},(_, i) => i + 1));
  assert.deepEqual(list.tracks.map(track => track.file),
    Array.from({length:30},(_, i) => 'bgm_'+String(i+1).padStart(2,'0')+'.mp3'));
  assert.equal(list.tracks[0].scene,'タイトル画面');
  assert.equal(list.tracks[16].scene,'酒場・仲間募集・交流');
  assert.equal(list.tracks[27].scene,'ラスボス戦・ヴィットリオ・レグルス');
  assert.equal(list.tracks[29].scene,'エンディング・スタッフロール');
  assert.equal(list.tracks[29].loop,false);
  assert.equal((await handler(event('PUT','../../main'))).statusCode,400);
  assert.equal((await handler(event('PUT','01',{body:'aGVsbG8=',isBase64Encoded:true}))).statusCode,415);
  assert.equal((await handler(event('PUT','01',{body:'A'.repeat(6*1024*1024),isBase64Encoded:true}))).statusCode,413);
  const bytes = execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=440','-t','0.1','-f','mp3','pipe:1']);
  const first = await handler(event('PUT','01',{body:bytes.toString('base64'),isBase64Encoded:true}));
  assert.equal(first.statusCode,200);
  assert.match(calls.at(-1)[0],/assets\/bgm\/bgm_01.mp3$/);
  assert.equal(calls.at(-1)[2].content,bytes.toString('base64'));
  const headers = {cookie:session,origin,'x-bgm-sha':sha};
  const replace = await handler(event('PUT','01',{headers,body:bytes.toString('base64'),isBase64Encoded:true}));
  assert.equal(replace.statusCode,200);
  assert.equal(calls.at(-1)[2].sha,sha);
  assert.equal((await handler(event('DELETE','01',{headers}))).statusCode,200);
  assert.equal(calls.at(-1)[2].branch,'main');
  const qr = await handler(event('GET',null,{queryStringParameters:{qr:'1'},headers:{}}));
  assert.equal(qr.headers['Content-Type'],'image/png');
  assert.equal(Buffer.from(qr.body,'base64').subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const download = await handler(event('GET',null,{queryStringParameters:{qr:'download'},headers:{}}));
  assert.match(download.headers['Content-Disposition'],/^attachment/);
  assert.equal(download.body,qr.body);
  process.env.BGM_PUBLIC_URL += '/?debug=secret#token';
  const link = await handler(event('GET',null,{queryStringParameters:{qr:'url'},headers:{}}));
  assert.equal(JSON.parse(link.body).url,'https://example.netlify.app/bgm-studio/');
  assert.equal((await handler(event('GET',null,{queryStringParameters:{qr:'1'},headers:{}}))).body,qr.body);
});
