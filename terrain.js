const fieldTop = 24;
const fieldBottom = 182;
const seasonIndex = () => Math.floor(townDay() / 30) % 4;

// A stable layout for every chapter, with logical map coordinates retained for old saves.
const fieldLayouts = prefectures.map((region, chapter) => {
  const seed = (chapter + 11) * 97;
  const amplitude = {forest:14,coast:12,mountain:25,water:9,sand:19,snow:17,river:15}[region.terrain];
  const foliage = Array.from({length:31}, (_, i) => {
    const hash = ((i + 5) * 173 * seed) % 32749;
    return {x:chapter * span + (hash % 955), y:i % 3 ? 166 + hash % 25 : 39 - hash % 22,
      size:9 + hash % 19, turn:hash % 9 - 4, type:hash % 5};
  }).sort((a,b) => a.y - b.y);
  const roadTone = {forest:'#93715e',coast:'#ae8f73',mountain:'#857976',water:'#8d7866',sand:'#c3976a',
    snow:'#a6b6bb',river:'#8c7f66'}[region.terrain];
  return {amplitude, wave:121 + seed % 94, phase:seed % 27 * .29, foliage, roadTone,
    water:['coast','river','water'].includes(region.terrain), terrace:region.terrain === 'mountain',
    bridge:chapter * span + 555 + seed % 87, bench:chapter * span + 309, vending:chapter * span + 211};
});

function terrainOffset(x) {
  const chapter = chapterOf(x);
  const u = (x - chapter * span) / span;
  const layout = fieldLayouts[chapter];
  return Math.sin(Math.PI * u) * layout.amplitude * Math.sin((x - chapter * span) / layout.wave + layout.phase);
}
const fieldY = (x,y) => y + 96 + terrainOffset(x);

function districtFixtures(chapter) {
  const layout = fieldLayouts[chapter];
  return [{kind:'bench',x:layout.bench,y:166}, {kind:'vending',x:layout.vending,y:75}];
}
function nearbyFixture() {
  return districtFixtures(chapterOf(player.x)).find(fixture => closeTo(fixture.x,fixture.y,13));
}
function useFixture(fixture) {
  if (fixture.kind === 'bench') {
    panel('木陰のベンチ',['景色を眺めて、少し休んでいきますか？'],[
      ['腰掛けて休む', () => {
        tickTown(15);
        resume();
        say('木陰に腰掛けてひと息ついた。');
        save();
      }], ['戻る',resume]
    ]);
  } else panel('茶の自動販売機',['冷たいお茶　6G。飲むとMPが7回復。'],[
    ['お茶を買う　6G', () => trade(6, () => { player.mp = Math.min(maxMP(),player.mp + 7); },
      () => { resume(); say('冷たいお茶を飲んだ。'); }), player.gold < 6],
    ['戻る',resume]
  ]);
}

function fieldWeather(chapter) {
  const phase = (townDay() * 7 + chapter * 3) % 11;
  const terrain = prefectures[chapter].terrain;
  if (terrain === 'snow' || seasonIndex() === 3 && phase < 6) return 'snow';
  if (phase === 0) return 'thunder';
  if (phase === 1 || phase === 2) return 'rain';
  if (phase === 5 || terrain === 'coast' || terrain === 'water' || townHour() < 7) return 'mist';
  return 'cloud';
}

const riverY = (x,chapter) => 34 + Math.sin((x - chapter * span) / 80 + chapter * .6) * 8;

function waterBlocks(x, y) {
  const chapter = chapterOf(x);
  const layout = fieldLayouts[chapter];
  const u = x - chapter * span;
  return layout.water && u > 388 && u < 805 && Math.abs(x - layout.bridge) > 24 &&
    Math.abs(y - riverY(x,chapter)) < 5;
}
