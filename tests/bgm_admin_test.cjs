const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { handler } = require('../netlify/functions/bgm-admin.js');
const key = 'a'.repeat(64);
const sha = 'c'.repeat(40);
const commit = 'd'.repeat(40);
const event = (httpMethod, track, extra = {}) => ({
  httpMethod, queryStringParameters:track && {track},
  headers:{authorization:'Bearer '+key,'x-bgm-sha':'new'},...extra
});

test('admin authentication, 30 slots, safe writes and QR', async () => {
  assert.equal((await handler(event('GET'))).statusCode,503);
  process.env.BGM_ADMIN_KEY = key;
  process.env.BGM_GITHUB_TOKEN = 'mock-contents-token';
  process.env.BGM_PUBLIC_URL = 'https://example.netlify.app';
  const calls = [];
  global.fetch = async (url,options) => {
    assert.equal(options.headers.Authorization,'Bearer mock-contents-token');
    calls.push([url,options.method,options.body && JSON.parse(options.body)]);
    if (!options.body) return Response.json([{type:'file',name:'01_title.mp3',sha,size:20}]);
    return Response.json({commit:{sha:commit},content:options.method === 'PUT' ? {sha} : null});
  };
  assert.equal((await handler(event('GET',null,{headers:{}}))).statusCode,401);
  assert.equal(calls.length,0);
  const list = JSON.parse((await handler(event('GET'))).body);
  assert.equal(list.tracks.length,30);
  assert.equal(list.tracks[0].sha,sha);
  assert.equal(list.tracks[29].file,'30_morning.mp3');
  assert.equal((await handler(event('PUT','../../main'))).statusCode,400);
  assert.equal((await handler(event('PUT','title',{body:'aGVsbG8=',isBase64Encoded:true}))).statusCode,415);
  assert.equal((await handler(event('PUT','title',{body:'A'.repeat(6*1024*1024),isBase64Encoded:true}))).statusCode,413);
  const bytes = execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=440','-t','0.1','-f','mp3','pipe:1']);
  const first = await handler(event('PUT','title',{body:bytes.toString('base64'),isBase64Encoded:true}));
  assert.equal(first.statusCode,200);
  assert.match(calls.at(-1)[0],/assets\/bgm\/01_title.mp3$/);
  assert.equal(calls.at(-1)[2].content,bytes.toString('base64'));
  const headers = {authorization:'Bearer '+key,'x-bgm-sha':sha};
  const replace = await handler(event('PUT','title',{headers,body:bytes.toString('base64'),isBase64Encoded:true}));
  assert.equal(replace.statusCode,200);
  assert.equal(calls.at(-1)[2].sha,sha);
  assert.equal((await handler(event('DELETE','title',{headers}))).statusCode,200);
  assert.equal(calls.at(-1)[2].branch,'main');
  const qr = await handler(event('GET',null,{queryStringParameters:{qr:'1'},headers:{}}));
  assert.equal(qr.headers['Content-Type'],'image/png');
  assert.equal(Buffer.from(qr.body,'base64').subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const download = await handler(event('GET',null,{queryStringParameters:{qr:'download'},headers:{}}));
  assert.match(download.headers['Content-Disposition'],/^attachment/);
  assert.equal(download.body,qr.body);
  process.env.BGM_PUBLIC_URL += '/?debug=secret#token';
  const link = await handler(event('GET',null,{queryStringParameters:{qr:'url'},headers:{}}));
  assert.equal(JSON.parse(link.body).url,'https://example.netlify.app/bgm-admin/');
  assert.equal((await handler(event('GET',null,{queryStringParameters:{qr:'1'},headers:{}}))).body,qr.body);
});
