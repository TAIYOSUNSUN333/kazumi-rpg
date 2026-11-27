const marketGoods = [
  {id:'herb',name:'薬草',price:5, hp:35,color:'#9ac58a'},
  {id:'drops',name:'清涼しずく',price:8, mp:12,color:'#90becb'},
  {id:'rice',name:'旅むすび',price:5, hp:18,mp:2,color:'#e4d5bb'},
  {id:'tea',name:'花の香草茶',price:6,mp:7,color:'#cf9ab4'},
  {id:'poultice',name:'足の湿布',price:7,clean:true,hp:10,color:'#c3bb83'},
  {id:'honey',name:'花蜜飴',price:11,mp:16,color:'#e2b972'},
  {id:'soup',name:'温野菜のスープ',price:12,hp:36,mp:6,color:'#d89466'},
  {id:'jam',name:'旅果実のジャム',price:9,hp:28,color:'#ac87b9'},
  {id:'bun',name:'胡桃パン',price:7,hp:20,color:'#bc976b'},
  {id:'plum',name:'塩漬けの梅',price:13,clean:true,mp:13,color:'#d0989a'},
  {id:'tonic',name:'星草の丸薬',price:16,hp:48,mp:11,color:'#84b8a9'},
  {id:'royal',name:'王冠の薬蜜',price:27,hp:76,mp:18,color:'#d3ba79'},
  {id:'travelmeal',name:'携帯郷土膳',price:20,hp:50,mp:9,color:'#e1c3a4'},
  {id:'broth',name:'根菜の煮出し汁',price:18,hp:23,mp:22,clean:true,color:'#a1be86'}
];
const pack = Object.create(null);
const goodCount = item => item.id === 'herb' ? player.herbs : pack[item.id] || 0;

function restorePack(data) {
  for (const item of marketGoods.slice(1)) pack[item.id] = numeric(data?.[item.id],0,0,999);
}

function goodEffect(item) {
  return [item.hp ? 'HP +' + item.hp : '', item.mp ? 'MP +' + item.mp : '', item.clean ? '足止め解除' : ''].filter(Boolean).join('・');
}

function canUseGood(item) {
  return goodCount(item) > 0 && (
    item.hp && player.hp < maxHP() || item.mp && player.mp < maxMP() || item.clean && clock < footingUntil
  );
}

function useGood(item) {
  if (!canUseGood(item) || battle) return;
  if (item.id === 'herb') player.herbs--;
  else pack[item.id]--;
  player.hp = Math.min(maxHP(),player.hp+(item.hp || 0));
  player.mp = Math.min(maxMP(),player.mp+(item.mp || 0));
  if (item.clean) footingUntil = clock;
  audio.play('holy');
  save();
  itemMenu();
}

function marketStock(site, page = 0) {
  if (interior?.site !== site || !roomCounterReady()) return;
  const region = prefectures[site.chapter];
  const factor = site.kind === 'store' ? 1.6 : site.kind === 'pharmacy' ? .92 : 1;
  const items = marketGoods.filter((item,index) => index < 12 || (site.chapter+index)%3 !== 0);
  const buttons = items.slice(page*12,page*12+12).map(item => {
    const named = item.id === 'travelmeal' ? region.dish + 'の携帯膳' : item.name;
    const price = Math.ceil(factor*(item.price+(item.id === 'herb' ? 0 : site.chapter%5)));
    const room = (item.id === 'herb' ? 10000 : 999)-goodCount(item);
    return [named + '　' + price + 'G｜' + goodEffect(item) + '｜所持 ' + goodCount(item),() =>
      confirmPurchase(site,named,price,room,number => {
        if (item.id === 'herb') player.herbs += number;
        else pack[item.id] = goodCount(item)+number;
      },() => marketStock(site,page)),!room || player.gold < price,item.color];
  });
  if (page) buttons.push(['前へ',() => marketStock(site,page-1)]);
  if ((page+1)*12 < items.length) buttons.push(['次へ',() => marketStock(site,page+1)]);
  buttons.push(['店先に戻る',servicePanel]);
  panel(townTypes[site.kind][0]+'の商品一覧',['所持金 '+player.gold+'G'],buttons);
}

function confirmPurchase(site, name, price, available, apply, back = servicePanel) {
  if (interior?.site !== site || !roomCounterReady()) return;
  const maximum = Math.min(99,available,Math.floor(player.gold/price));
  if (maximum < 1) return;
  const input = document.createElement('input');
  input.type = 'number'; input.value = '1'; input.min = '1'; input.max = String(maximum); input.step = '1';
  const title = document.createElement('label');
  title.append('購入数 ',input);
  const total = document.createElement('output');
  input.oninput = () => {
    const quantity = numeric(Number(input.value),1,1,maximum);
    total.value = '合計 ' + price*quantity + 'G';
  };
  input.oninput();
  panel('購入確認',[name+'　'+price+'G'],[['購入する',() => {
    if (interior?.site !== site || !roomCounterReady()) return;
    const quantity = numeric(Number(input.value),1,1,maximum);
    trade(price*quantity,() => { apply(quantity); audio.play('purchase'); },back);
  }],['戻る',back]]);
  if (maximum > 1) $('panel-body').append(title,total);
}
