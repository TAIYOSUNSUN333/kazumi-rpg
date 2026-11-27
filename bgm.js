const bgmCatalog = [
  ['title','タイトル','title'],
  ['field','フィールド','field'],
  ['town','町・村','village'],
  ['forest','森林','forest'],
  ['dungeon','洞窟','dungeon'],
  ['coast','海岸','coast'],
  ['snow','雪山','snow'],
  ['night','夜','field'],
  ['battle','通常戦闘','battle'],
  ['midboss','中ボス','midboss'],
  ['boss','大ボス','boss'],
  ['elite','四天王','emperor0'],
  ['finalboss','ラスボス','boss'],
  ['inn','宿屋','innEntry'],
  ['onsen','温泉','bath'],
  ['tavern','酒場・店舗','tavern'],
  ['romance','恋愛','romance'],
  ['farewell','別れ','loss'],
  ['soso','ソソのテーマ','soso'],
  ['ending','エンディング','ending'],
  ['transform','ソソの変身','soso'],
  ['soso_final','ソソ最終形態','genesis'],
  ['summon','召喚獣','boss'],
  ['legend','伝説級加入','village'],
  ['mythic','神話級加入','genesis'],
  ['victory','戦闘勝利','battle'],
  ['defeat','戦闘敗北','loss'],
  ['riddle','石碑クイズ','dungeon'],
  ['city','大都市','village'],
  ['morning','宿屋・起床','innWake']
].map(([id,scene,score],index) => ({id,scene,score,file:String(index+1).padStart(2,'0')+'_'+id+'.mp3'}));
const bgmById = new Map(bgmCatalog.map(item=>[item.id,item]));

function recordingForScore(score) {
  if (score.startsWith('town') || score === 'village') return 'town';
  if (score.startsWith('emperor')) return 'elite';
  if (score === 'innWake') return 'morning';
  if (score.startsWith('inn')) return 'inn';
  return ({bath:'onsen',genesis:'soso_final',loss:'defeat'})[score] || (bgmById.has(score) ? score : null);
}

function recordingURL(id) {
  return new URL('./assets/bgm/'+bgmById.get(id).file,document.baseURI);
}

function openSoundTest() {
  panel('サウンドテスト',['登録済みのMP3を試聴できます。未登録の場面では従来のBGMが流れます。'],[
    ['試聴を止める',() => audio.stopPreview()],['登録状況を更新',openSoundTest],['設定に戻る',settingsMenu]
  ]);
  const root = document.createElement('ul');
  root.className = 'sound-catalog';
  const states = {registered:'登録済み',missing:'未登録',unreadable:'再生できません',unknown:'確認できません'};
  const entries = bgmCatalog.map(item => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    const file = document.createElement('small');
    const status = document.createElement('span');
    const play = document.createElement('button');
    label.textContent = item.scene;
    file.textContent = item.file;
    label.append(file);
    status.textContent = '確認中';
    status.className = 'sound-status';
    play.textContent = '試聴';
    play.setAttribute('aria-label',item.scene+'を試聴');
    play.disabled = true;
    play.onclick = async () => {
      audio.unlock();
      const played = await audio.preview(item.id);
      if (!played && audio.recordingStatus.get(item.id) === 'unreadable') {
        status.textContent = states.unreadable;
        play.disabled = true;
      }
    };
    row.append(label,status,play);
    root.append(row);
    return {item,status,play};
  });
  $('panel-body').append(root);
  async function updateRegistration() {
    for (let index=0; index<entries.length && root.isConnected; index+=5) {
      await Promise.all(entries.slice(index,index+5).map(async ({item,status,play}) => {
        const result = await audio.checkRecording(item.id, true);
        status.textContent = states[result];
        play.disabled = result !== 'registered';
      }));
    }
    audio.refreshRecording();
  }
  updateRegistration();
}

if (typeof module !== 'undefined') module.exports = {bgmCatalog};
