const lodgingTypes = [
  {name:'一般宿', style:'木造旅籠', price:12, art:0},
  {name:'格安宿', style:'民宿', price:7, art:0, modest:true},
  {name:'温泉旅館', style:'温泉旅館', price:20, art:1, cure:true},
  {name:'高級ホテル', style:'眺望ホテル', price:34, art:3, blessing:true},
  {name:'特別な宿', style:'星見の宿', price:23, art:2, special:true},
  {name:'一般宿', style:'町のビジネスホテル', price:12, art:2}
];
const innProfile = chapter => lodgingTypes[chapter % lodgingTypes.length];
let innPending = null;
let innScene = null;
let innBuffUntil = 0;
let footingUntil = 0;

const innStages = [
  {from:0, label:'受付で客室の鍵を受け取った。', track:'innDesk'},
  {from:1.6, label:'仲間と客室へ。', track:'innEntry'},
  {from:3.5, label:'装備を外し、ベッドに腰掛ける。', track:'innTalk'},
  {from:5.3, label:'旅のひととき。', track:'innTalk'},
  {from:10, label:'ベッドに横になり、灯りを落とす。', track:'innSleep'},
  {from:14.3, label:'窓の向こうが白んでくる。', track:'innWake'},
  {from:17.3, label:'朝になった。旅支度をしよう。', track:'innWake'}
];
const innEnd = 19.5;

function innSnapshot() {
  return {pending:innPending, buffUntil:innBuffUntil, footing:Math.max(0,footingUntil - clock)};
}
function loadInn(data) {
  innPending = data?.pending && townSites.get(data.pending.site)?.kind === 'inn' ?
    {site:data.pending.site, day:numeric(data.pending.day,townDay(),townDay(),townDay() + 1)} : null;
  innBuffUntil = numeric(data?.buffUntil,0,0,360003600);
  footingUntil = numeric(Math.ceil(data?.footing),0,0,120);
}

function tonightConversation(scene) {
  const member = currentCompanion();
  if (!member) return {line:joined ? 'ソソが枕を半分空けて鳴いた。' : '窓辺で明日の道順をたしかめる。'};
  const n = (townDay() + scene.site.chapter + member.history.length) % 5;
  if (scene.profile.special) return {
    line:member.name + '「見て。この窓からなら、' + prefectures[scene.site.chapter].sight + 'の明かりが見えるよ」',
    choices:[['窓辺で星を見る','二人でしばらく星を眺めた。',4],['明日に備えて休む','明日の道を確認した。',1]]
  };
  if (member.affinity >= 16 && member.name === '一郎' && n % 2 === 0) return {
    line:'一郎「君といると、旅が終わってもまた会いたいと思う。手をつないでもいい？」',
    choices:[['手をつなぐ','同意して手をつなぎ、互いの気持ちを伝えた。',5],['今は友達として話す','一郎は気持ちを尊重して、明日の旅の話に戻った。',1]]
  };
  if (member.affinity <= -4 || n === 3) return {
    line:member.name + '「昼間の道選び、少し無理をしたと思う。今のうちに話し合いたい」',
    choices:[['互いの話を聞いて仲直り','お互いの考えを聞き、旅を続けることにした。',5],['今夜は距離を置く','それぞれの寝台で考える時間を取った。',-2]]
  };
  const prompts = [
    '「旅先でいちばんおかしかったこと、覚えてる？」', '「最初に会った日のこと、時々思い出すよ」',
    '「この先が少し心配。焦らず歩いてもいいかな」', '「先に休憩する道も考えておこう」',
    '「明日は早めに' + prefectures[scene.site.chapter].sight + 'まで歩いてみない？」'
  ];
  return {line:member.name + prompts[n], choices:[
    ['話を聞く','ゆっくり話を聞いた。',3], ['明日の計画を相談する','無理のない道順を一緒に考えた。',2]
  ]};
}

function beginStay() {
  if (interior?.site.kind !== 'inn' || innPending) return;
  const site = interior.site;
  const profile = innProfile(site.chapter);
  if (player.gold < profile.price) return;
  player.gold -= profile.price;
  innPending = {site:site.id, day:townDay() + (townHour() >= 6 ? 1 : 0)};
  save();
  resumeInn();
}

function resumeInn() {
  if (!innPending) return;
  const site = townSites.get(innPending.site);
  if (!site) return;
  if (interior?.site !== site) interior = {site,x:320,y:145};
  innScene = {site, profile:innProfile(site.chapter), time:0, stage:-1, response:null, choice:null};
  innScene.conversation = tonightConversation(innScene);
  paused = true;
  clearInput();
  $('panel').hidden = true;
  $('stay-controls').hidden = false;
  audio.unlock();
  advanceInn(0);
}

function advanceInn(dt) {
  if (!innScene) return;
  const scene = innScene;
  scene.time += dt;
  if (scene.time >= innEnd) return finishStay();
  const stageIndex = innStages.findLastIndex(stage => scene.time >= stage.from);
  if (stageIndex === scene.stage) return;
  scene.stage = stageIndex;
  const beat = innStages[stageIndex];
  audio.setTrack(beat.track);
  $('stay-caption').textContent = stageIndex === 3 ? scene.conversation.line : beat.label;
  $('stay-choices').replaceChildren();
  if (stageIndex === 3 && scene.conversation.choices) {
    for (const choice of scene.conversation.choices) {
      const button = document.createElement('button');
      button.textContent = choice[0];
      button.onclick = () => {
        if (scene.choice) return;
        scene.choice = choice;
        $('stay-caption').textContent = choice[1];
        $('stay-choices').replaceChildren();
      };
      $('stay-choices').append(button);
    }
  }
}

function finishStay() {
  if (!innPending || !innScene) return;
  const {profile, site, choice} = innScene;
  const target = innPending.day * 3600 + 900;
  tickTown(Math.max(0, target - townSeconds));
  if (profile.modest) {
    player.hp = Math.min(maxHP(), player.hp + Math.ceil(maxHP() * .65));
    player.mp = Math.min(maxMP(), player.mp + Math.ceil(maxMP() * .65));
  } else {
    player.hp = maxHP();
    player.mp = maxMP();
  }
  if (profile.cure) footingUntil = clock;
  if (profile.blessing) innBuffUntil = townSeconds + 3600;
  const member = currentCompanion();
  if (member) {
    member.hp = profile.modest ? Math.min(companionHP(member), member.hp + 38) : companionHP(member);
    member.mp = profile.modest ? Math.min(companionMP(member), member.mp + 18) : companionMP(member);
    if (choice) {
      remember(member, choice[1]);
      member.affinity = clamp(member.affinity + choice[2],-100,100);
    }
    regionalInnTalk(site.chapter);
  }
  innPending = null;
  innScene = null;
  $('stay-controls').hidden = true;
  $('stay-choices').replaceChildren();
  document.activeElement?.blur();
  audio.setTrack('innWake');
  resume();
  say(profile.modest ? '朝になり、体力と魔力が回復した。' :
    profile.blessing ? 'HP・MPが全快。翌朝まで攻撃力が上昇した。' : '朝になり、HP・MPが全快した。',7);
  save();
}

document.getElementById('stay-skip').onclick = finishStay;
