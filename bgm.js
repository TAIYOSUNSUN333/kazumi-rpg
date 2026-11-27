const bgmScenes = [
  'タイトル画面',
  '一美の日常・平穏な生活',
  '愛猫ソソとの思い出',
  'ソソ誘拐事件',
  '冒険への旅立ち',
  '桜並木・街道・通常フィールド',
  '森林・自然探索',
  '洞窟・地下迷宮',
  '通常戦闘・集団襲撃',
  '中ボス戦',
  '各章の大ボス戦',
  '四天王戦',
  '町・村・市街地',
  '装備品選択・装備変更画面',
  '商店・買い物',
  '宿屋・休息・就寝',
  '酒場・仲間募集・交流',
  '銀行・預金・引き出し',
  '温泉・入浴イベント',
  '焼肉・食事イベント',
  '仲間との友情・絆',
  '恋愛・親密なイベント',
  '仲間との別れ・悲しい場面',
  'なぞなぞ・謎解き',
  'ソソとの再会・救出',
  'ソソの覚醒・第6形態への変身',
  '世界崩壊の危機・終末',
  'ラスボス戦・ヴィットリオ・レグルス',
  '戦闘勝利・達成・報酬',
  'エンディング・スタッフロール',
];
const eventRecordings = new Set(['02','03','04','05','23','25','26','29','30']);
const bgmCatalog = bgmScenes.map((scene,index) => {
  const number = index + 1;
  const id = String(number).padStart(2,'0');
  return {id,number,scene,file:'bgm_'+id+'.mp3',loop:!eventRecordings.has(id)};
});
const bgmById = new Map(bgmCatalog.map(item => [item.id,item]));

function recordingURL(id) {
  return new URL('./assets/bgm/'+bgmById.get(id).file,document.baseURI);
}

function openSoundTest() {
  panel('サウンドテスト',['登録済みのMP3を番号順に試聴できます。'],[
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
    label.textContent = item.id+'　'+item.scene;
    file.textContent = item.file;
    label.append(file);
    status.textContent = '確認中';
    status.className = 'sound-status';
    play.textContent = '試聴';
    play.setAttribute('aria-label',item.id+'番を試聴');
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
