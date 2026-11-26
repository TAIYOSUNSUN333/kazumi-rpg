const chapterInfo=[
  ['桜の街道','花守りの獅子','花は水を飲み、月を仰ぐ。','水','月'],
  ['月影の森','月蝕の梟','月影に残るのは羽根と鈴の音。','羽','鈴'],
  ['星降る海','潮の番竜','潮は風で満ち、砂に引く。','風','砂'],
  ['水晶の坑道','鏡の甲虫','石を割って、火で照らせ。','石','火'],
  ['風切りの峡谷','つむじの鷹','羽根は空へ。雲はその向こう。','羽','雲'],
  ['錆びた時計街','ねじ巻きの騎士','鐘が鳴れば、歯車が回る。','鈴','歯'],
  ['白霧の沼','沼底の姫','霧の下に水。その下に泥。','水','泥'],
  ['夕焼けの砂丘','砂をまとう蜥蜴','砂から火が生まれ、火は夜を照らす。','砂','火'],
  ['凍星の湖','氷鏡の鯨','凍った水面に月が映る。','氷','月'],
  ['崩れた天文台','星を読む巨人','遠くを見るには鏡、探すのは星。','鏡','星'],
  ['夜明けの雲海','東雲の翼竜','雲を割る風が、朝日を呼ぶ。','風','日'],
  ['天空の神殿','星喰いの王・ノクス','星は沈み、日が昇る。最後に月が眠る。','星','日','月']
];

const chapters = [
  ['桜の木の下に、ソソの首輪が落ちていた。濡れた足跡は村の外へ続いている。', '石碑に残されたのは、月影の森へ向かう黒い荷車の影。'],
  ['鈴の音を追うと、荷車のわだちが森の奥へ消えていた。', '風に混じって、荷車が港へ向かったことを告げる声が聞こえた。'],
  ['渡し守は、猫の声がした荷車を見たという。', '海面に映る星が、荷車の渡った先を指している。'],
  ['坑道の鏡の前に、ソソと同じ白い毛が一本落ちていた。', '鏡に映った荷車は風切りの峡谷へ向かった。'],
  ['ちぎれた橋の向こうで、鳥たちが何かにおびえている。', '石碑が光ると、遠くから止まった時計街の鐘が聞こえた。'],
  ['時計職人は、ノクスが鳴き声のする檻を運んでいたと教えてくれた。', '時計が進み始めた。ノクスが沼へ逃げ込んだ方角がわかった。'],
  ['霧の奥から鳴き声がした。一美はソソの名前を呼んだ。', '霧が晴れ、砂丘へ続く檻の跡が現れた。'],
  ['砂に埋もれた祭壇には、夜道を照らす灯が刻まれている。', '祭壇の灯が、凍った湖へ向かう道を照らした。'],
  ['恵美ちゃんが氷の下を照らす。映っているのは檻の鍵だ。', '一美は溶けた氷の中から、銀色の鍵を拾い上げた。'],
  ['ノクスは星の光を檻に集めていた。ソソをさらったのもそのためだった。', '望遠鏡の先に神殿が見える。ソソはあそこにいる。'],
  ['雲の切れ間に、小さな家の屋根が見えた。「一緒に帰ろうね、ソソ」', '朝日が雲を割り、神殿への階段が姿を現した。'],
  ['「その猫は星を呼ぶ」ノクスは檻の前に立った。「連れて帰る」と一美は剣を握った。', '銀の鍵が回った。あとは檻を守るノクスを倒すだけだ。']
];

const span = 960;
const last = chapters.length - 1;
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
const enemies = chapters.flatMap((_, chapter) => [205, 260, 400, 525, 610, 720, 815, 910].map((spot, slot) => {
  const boss = slot === 7;
  const optional = slot === 1 || slot === 4;
  const kind = enemyKinds[(chapter + slot) % enemyKinds.length];
  const max = boss ? 88 + chapter * 18 : 24 + chapter * 6 + slot * 2;
  const homeX = chapter * span + spot;
  const homeY = optional ? (slot === 1 ? 62 : 146) : 104;
  return {
    ...kind, name: boss ? chapterInfo[chapter][1] : kind.name,
    power: kind.power + chapter * 2 + (boss ? 5 : 0), max, hp: max,
    homeX, homeY, x: homeX, y: homeY, chapter, slot, boss, optional, flash: 0
  };
}));

const equipment = {
  weapon: [
    {name: '木柄の剣', bonus: 0, cost: 0},
    {name: '旅人の剣', bonus: 5, cost: 25},
    {name: '月影の剣', bonus: 12, cost: 80},
    {name: '星銀の剣', bonus: 23, cost: 170}
  ],
  armor: [
    {name: '継ぎはぎの服', bonus: 0, cost: 0},
    {name: '革の上着', bonus: 3, cost: 22},
    {name: '坑道の胸当て', bonus: 8, cost: 70},
    {name: '星織りの外套', bonus: 15, cost: 145}
  ]
};

const chapterOf = x => Math.max(0, Math.min(last, Math.floor(x / span)));
