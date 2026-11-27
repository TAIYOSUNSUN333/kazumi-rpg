const chapterInfo=[
  ['桜の街道','花守りの獅子'],
  ['月影の森','月蝕の梟'],
  ['星降る海','潮の番竜'],
  ['水晶の坑道','鏡の甲虫'],
  ['風切りの峡谷','つむじの鷹'],
  ['錆びた時計街','ねじ巻きの騎士'],
  ['白霧の沼','沼底の姫'],
  ['夕焼けの砂丘','砂をまとう蜥蜴'],
  ['凍星の湖','氷鏡の鯨'],
  ['崩れた天文台','アウレリオ'],
  ['夜明けの雲海','東雲の翼竜'],
  ['天空の神殿','ヴィットリオ'],
];

const chapters = [
  ['桜の木の下に、ソソの首輪が落ちていた。濡れた足跡は村の外へ続いている。', '石碑に残されたのは、月影の森へ向かう黒い荷車の影。'],
  ['鈴の音を追うと、荷車のわだちが森の奥へ消えていた。', '風に混じって、荷車が港へ向かったことを告げる声が聞こえた。'],
  ['渡し守は、猫の声がした荷車を見たという。', '海面に映る星が、荷車の渡った先を指している。'],
  ['坑道の鏡の前に、ソソと同じ白い毛が一本落ちていた。', '鏡に映った荷車は風切りの峡谷へ向かった。'],
  ['ちぎれた橋の向こうで、鳥たちが何かにおびえている。', '石碑が光ると、遠くから止まった時計街の鐘が聞こえた。'],
  ['時計職人は、黒いコートの男が鳴き声のする檻を運んでいたと教えてくれた。', '時計が進み始めた。黒いコートの男が沼へ逃げ込んだ方角がわかった。'],
  ['霧の奥から鳴き声がした。一美はソソの名前を呼んだ。', '霧が晴れ、砂丘へ続く檻の跡が現れた。'],
  ['砂に埋もれた祭壇には、夜道を照らす灯が刻まれている。', '祭壇の灯が、凍った湖へ向かう道を照らした。'],
  ['恵美ちゃんが氷の下を照らす。映っているのは檻の鍵だ。', '一美は溶けた氷の中から、銀色の鍵を拾い上げた。'],
  ['天文台でソソの声がした。檻のそばに立つ男は、アウレリオと名乗った。', '星図には、ソソの力を吸い上げる装置が描かれている。銀の鍵は装置の下に置かれていた。'],
  ['壊れた装置からあふれた力で、空に亀裂が走った。一美とソソは世界の崩壊を止めに向かう。', 'ソソは朝日の差す場所で亀裂を支えた。一美はその奥へ向かう。'],
  ['ヴィットリオが最後の亀裂を広げている。一美は足もとのソソと目を合わせ、剣を抜いた。', '二人の力を合わせれば、ヴィットリオの守りを破れる。']
];

const originalFinal = chapters.length - 1;
const secondJourney = [
  '梅の木の根元で、若草山で止めたはずの振動が聞こえる。', '杉並木に、影だけが先へ歩く旅人がいる。',
  '湯畑の湯気の中で、ソソが遠い昔の鈴の音に耳を立てた。', '蔵の帳面に、異変が起こる前の地脈の記録が残されている。',
  '浜の漁師は、月明かりのない晩にも白く光る波を見たという。', '隅田川の水面で、閉じたはずの亀裂が星を飲み込んでいる。',
  '大仏へ向かう石段で、ソソが割れた星片をくわえてきた。', '雪壁の道に足跡がふた筋ある。一筋は一美より先へ続いていた。',
  '庭の水路に薄い金箔が流れ、地脈の継ぎ目を指し示す。', '断崖に立つと、奇妙に遅れて波の音が返ってきた。',
  '葡萄棚の向こうで、空と谷の稜線がわずかに食い違っている。', '雪の屋根を渡る黒い影が、ソソに向かって頭を下げた。',
  '地図職人が、城の地下に眠る水路を調べてほしいと頼みに来た。', '夫婦岩の間で、夕日と月が同じ光を落としている。',
  '湖畔で拾った鈴は、ソソが近づいたときだけ鳴る。', '竹の葉が風上へ流れる。山の奥から、忘れられた祈りが聞こえる。',
  '堀の橋が映すのは今夜の街ではなく、まだ来ていない朝だ。', '白壁の城門で、古い守り手から旅の続きを託された。',
  '熊野の石段に置かれた灯明が、祭りの日の行列とは別の方角を照らす。', '湖の潮が止まった。しじみを採る人たちは岸で水の音を待っている。',
  '白い壁に星の欠片を当てると、首里まで続く線が現れた。', '潮が引く大鳥居の下で、地脈をつなぐ最後の鍵の名前を聞いた。',
  '草原の裂け目から石灰の粉が舞い上がる。ソソは地底のうなりに気づいた。', '渦の中心に空の裂け目が映り、流れに逆らって動いている。',
  '池を渡る鳥の群れが、一本の青い線に沿って飛び去った。', '湯の街の夜、宿の窓に十年前の月が浮かんだ。',
  '四万十の橋を渡っていると、向こう岸でソソを呼ぶ声がした。', '天満宮の木の下で、星の欠片は何かに応えるように光る。',
  '窯に火を入れた職人が、焼き上がりに見知らぬ紋様を見つけた。', '港を見下ろす坂で、海の向こうの灯台がこちらに合図を送った。',
  '火口を回る影の足音が、地上の足跡より先に聞こえる。', '立ちのぼる湯気が巻き戻り、白い糸をたどるように山へ戻っていく。',
  '峡谷に届いた夜神楽の音を聞くと、ソソの目に星が宿った。', '火山灰の下で眠っていた地脈が、南の島へ光を送る。',
  '各地をつなぎ直した光が、首里の石垣の下で一本の道になる。'
];
for (const [index,region] of prefectures.slice(chapters.length).entries()) {
  const final = region.name === '沖縄県';
  chapterInfo.push([region.town,final ? '星蝕の継承者レグルス' : region.companion + 'の地脈を守る番人']);
  chapters.push([secondJourney[index],region.sight + 'の先へ続く道から、地脈が澄んだ音を返した。']);
}
const span = 960;
const last = chapters.length - 1;
const isFinalBoss = enemy => enemy.rank === 'major' && (enemy.chapter === originalFinal || enemy.chapter === last);
const limit = span * chapters.length - 1;
const camps = chapters.map((_, i) => ({x: i * span + 30, row: 104}));
const shrines = chapters.map((_, i) => ({x: i * span + 775, row: i % 2 ? 146 : 62, solved: false}));
const npcs = [
  {x: 125, name: '渡し守', line: '「黒い荷車を見たら、街道の先を探してごらん」'},
  {x: 290, name: 'クルミ', line: '「一緒に探すよ。焚き火のそばなら装備も整えられる」'},
  {x: 460, name: '一郎', line: '「前を任せろ。ソソを見つけるぞ」'},
  {x: 630, name: '恵美ちゃん', line: '「夜道は私が照らすね」'},
  {x: 710, name: 'タク', line: '「風が変わった。急ごう」'}
];
for (const [chapter, region] of prefectures.entries()) {
  npcs.push({x:chapter * span + 250, name:region.companion,
    line:'「' + region.sight + 'への道なら案内できるよ。' + region.dish + 'も食べていってね」'});
}
const gems = chapters.flatMap((_, i) => [140, 340, 550, 690].map((spot, j) =>
  ({x: i * span + spot, row: [62, 146][(i + j) % 2], on: true})));

const enemyKinds = [
  {name: '影牙', power: 12, interval: 1.3, speed: 58, range: 22, color: '#d46c78'},
  {name: '鎧殻', power: 16, interval: 1.8, speed: 33, range: 26, color: '#c8a269'},
  {name: '星喰い', power: 11, interval: 1.6, speed: 43, range: 43, color: '#bc85d4'},
  {name: '霧の妖', power: 9, interval: 1.05, speed: 65, range: 19, color: '#76baa9'}
];
const bossPatterns = [
  ['bite', 'rush', 'bite'], ['slow', 'slow', 'wave'], ['wave', 'bite', 'rush'],
  ['slow', 'rush', 'slow'], ['rush', 'bite', 'rush'], ['bite', 'slow', 'bite'],
  ['slow', 'wave', 'rush'], ['rush', 'rush', 'wave'], ['wave', 'slow', 'wave'],
  ['wave', 'bite', 'slow'], ['rush', 'wave', 'rush'], ['bite', 'rush', 'wave']
];
const attackPatterns = {
  bite: {label: '攻撃', reach: 0, extra: 0, lead: .28},
  rush: {label: '突進', reach: 38, extra: 5, lead: .52},
  slow: {label: 'ため打ち', reach: 15, extra: 9, lead: .75},
  wave: {label: '星の衝撃波', reach: 52, extra: 8, lead: .58}
};
const midBosses = ['桜鎌の番人', '夜啼き狼', '珊瑚の騎士', '黒晶ゴーレム', '落風の姉妹', '歯車の司祭',
  '霧渡りの魔女', '砂灯の巨人', '銀鍵の猟犬', '星図の番兵', '裂空の使徒', '終鐘の守衛'];
midBosses.push(...prefectures.slice(originalFinal + 1).map(region => region.companion + 'の街道の幻獣'));
const awakening = [
  {turn: 0, name: '無属性', hp: 12000, mp: 600, atk: 1700, def: 500, speed: 168, color: '#f0d6b5', spell: '猫爪'},
  {turn: 3, name: '炎属性', hp: 20000, mp: 1000, atk: 2600, def: 1000, speed: 195, color: '#ff9766', spell: '聖炎'},
  {turn: 5, name: '水・氷属性', hp: 34000, mp: 2000, atk: 3800, def: 1900, speed: 214, color: '#a9e5ff', spell: '氷華'},
  {turn: 7, name: '雷属性', hp: 49000, mp: 3500, atk: 5200, def: 3300, speed: 233, color: '#f7d776', spell: '天雷'},
  {turn: 10, name: '闇属性', hp: 71000, mp: 6000, atk: 7300, def: 6000, speed: 252, color: '#e4bbff', spell: '宵の爪'},
  {turn: 15, name: '全属性・創世神', hp: 99999, mp: 9999, atk: 9999, def: 9999, speed: 280, color: '#fff2a4', spell: '天地創生'}
];
const trials = [
  ['炎帝フェルナンド', '#fa785f', ['rush','slow','wave'], 0, {name:'焔帝の剣', bonus: 36}, '炎冠を継ぐ者'],
  ['氷帝カタリーナ', '#98d7f9', ['slow','wave','slow'], 1, {name:'氷帝の外套', bonus: 24}, '氷冠を継ぐ者'],
  ['雷帝ルシアーノ', '#e2c476', ['rush','wave','rush'], 0, {name:'雷帝の剣', bonus: 48}, '雷冠を継ぐ者'],
  ['闇帝ドミニク', '#b582da', ['wave','rush','wave'], 1, {name:'闇帝の鎧', bonus: 31}, '闇冠を継ぐ者']
].map(([name, color, pattern, armor, reward, title], trial) => ({
  name, color, pattern, armor, reward, title, trial, boss: true, chapter: originalFinal,
  max: 210000 + trial * 38000, speed: 63 + trial * 7, range: 35, power: 65 + trial * 6, interval: 1.25 - trial * .1
}));
const enemies = chapters.flatMap((_, chapter) => [205, 260, 400, 525, 610, 720, 815, 910].map((spot, slot) => {
  const boss = slot >= 6;
  const rank = slot === 7 ? "major" : boss ? "mid" : null;
  const optional = slot === 1 || slot === 4;
  const variant = (chapter + slot) % enemyKinds.length;
  const kind = enemyKinds[variant];
  const max = chapter > originalFinal ? (rank === 'major' ? 62000 + (chapter - 12) * 1800 :
    rank === 'mid' ? 23500 + (chapter - 12) * 850 : 2400 + chapter * 180 + slot * 240) :
    chapter >= 10 ? (rank === 'major' ? 54000 + (chapter - 10) * 54000 :
    rank === 'mid' ? 27000 + (chapter - 10) * 12000 : 3000 + slot * 280) :
    boss ? (rank === 'mid' ? 62 + chapter * 15 : 88 + chapter * 18) : 24 + chapter * 6 + slot * 2;
  const homeX = chapter * span + spot;
  const homeY = optional ? (slot === 1 ? 62 : 146) : 104;
  return {
    ...kind, variant, name: rank === 'major' ? chapterInfo[chapter][1] : rank === 'mid' ? midBosses[chapter] : kind.name,
    power: kind.power + Math.min(chapter, 11) * 2 + Math.floor(Math.max(0, chapter - 11) * .58) + (boss ? 5 : 0), max, hp: max,
    homeX, homeY, x: homeX, y: homeY, chapter, slot, boss, rank, optional,
    nightOnly:slot === 1 && chapter%3 === 1, flash:0
  };
}));

const equipment = {
  weapon: [
    {name: '木の棒', bonus: 3, cost: 0, weight: .2, interval: .25, reach: 32},
    {name: '旅人の剣', bonus: 5, cost: 25, weight: 1.6, interval: .34, reach: 44},
    {name: '月影の剣', bonus: 12, cost: 80, weight: 3.5, interval: .46, reach: 52},
    {name: '星銀の剣', bonus: 23, cost: 170, weight: 5.6, interval: .55, reach: 59}
  ],
  armor: [
    {name: '継ぎはぎの服', bonus: 0, cost: 0},
    {name: '革の上着', bonus: 3, cost: 22},
    {name: '坑道の胸当て', bonus: 8, cost: 70},
    {name: '星織りの外套', bonus: 15, cost: 145}
  ]
};

const chapterOf = x => Math.max(0, Math.min(last, Math.floor(x / span)));

const starterRing = {name: '燐光の指輪', cost: 16, mp: 4, reach: 128};
const pots = chapters.flatMap((_, chapter) => [100, 375, 660].map((offset, i) => ({
  x: chapter * span + offset, y: i % 2 ? 145 : 70, broken: false
})));
