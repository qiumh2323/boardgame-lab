import {assignColors} from './player-colors.js?v=0.40';
// Independent rules implementation. facts.json contains physical game quantities.
export let F;
export const TYPES=['cottonMill','coalMine','ironWorks','manufacturer','pottery','brewery'];
export const ZH={cottonMill:'棉纺厂',coalMine:'煤矿',ironWorks:'铁厂',manufacturer:'包装厂',pottery:'陶器厂',brewery:'酿酒厂'};
export const CITY_ZH={birmingham:'伯明翰',coventry:'考文垂',dudley:'达德利',walsall:'沃尔索尔',wolverhampton:'伍尔弗汉普顿',coalbrookdale:'柯尔布鲁德尔',kidderminster:'基德明斯特',worcester:'伍斯特',redditch:'雷迪奇',cannock:'坎诺克',tamworth:'谭沃斯',stafford:'斯塔福德',burtonOnTrent:'特伦河畔伯顿',nuneaton:'纳尼顿',stone:'斯东',stokeOnTrent:'斯托克',uttoxeter:'尤托克西特',leek:'利克',belper:'贝尔珀',derby:'德比',northern:'北部农场',southern:'南部农场',shrewsbury:'什鲁斯伯里',gloucester:'格洛斯特',oxford:'牛津',warrington:'沃灵顿',nottingham:'诺丁汉'};
export const cityName=id=>CITY_ZH[id]||id;
export const clone=x=>structuredClone(x);
export function configure(f){F=f;}
export function income(n){return n<=10?n-10:n<=30?Math.ceil((n-10)/2):n<=60?10+Math.ceil((n-30)/3):n<=96?20+Math.ceil((n-60)/4):30;}
export function incomeTop(n){return n<=0?n+10:n<=10?10+2*n:n<=20?30+3*(n-10):n<=29?60+4*(n-20):99;}
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return (x>>>0)/4294967296;}
function shuffle(s,a){for(let i=a.length-1;i>0;i--){let j=Math.floor(rng(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function createDeck(n){let d=[],k=0,f=F.cards[n];for(const [loc,count] of Object.entries(f.locations))for(let i=0;i<count;i++)d.push({id:++k,kind:'location',loc});for(const [type,count] of Object.entries(f.industries))for(let i=0;i<count;i++)d.push({id:++k,kind:'industry',types:[type]});for(let i=0;i<(f.dualCottonManufacturer||0);i++)d.push({id:++k,kind:'industry',types:['cottonMill','manufacturer']});return d;}
function fill(s,p){while(p.hand.length<8&&s.deck.length)p.hand.push(s.deck.pop());}
export function createGame(names=['你','规则 AI'],ai=[false,true],seed=Date.now()>>>0,colorPreferences=[]){
 if(!F)throw Error('游戏数据未加载');if(names.length<2||names.length>4)throw Error('需要2至4名玩家');
 let s={version:1,rev:0,seed:seed||1,era:'canal',round:1,turn:0,used:0,phase:'play',players:[],order:[],board:{},links:{},merchants:[],coal:13,iron:8,discard:[],seenCards:[],wild:{location:4,industry:4},log:[],scores:[],gameOver:false};
 const colors=assignColors(names.length,colorPreferences);
 s.players=names.map((name,id)=>({id,color:colors[id],name:String(name).slice(0,18),ai:!!ai[id],money:17,income:10,vp:0,spent:0,hand:[],stacks:Object.fromEntries(TYPES.map(t=>[t,F.industries[t].flatMap(d=>Array(d.count).fill(d.level))])),linkCount:0}));
 s.order=shuffle(s,s.players.map(p=>p.id));s.deck=shuffle(s,createDeck(names.length));s.hiddenDiscard=[];for(let p of s.players){fill(s,p);s.hiddenDiscard.push(s.deck.pop());}
 let mix=shuffle(s,[...F.merchantMix[names.length]]);for(let [loc,m] of Object.entries(F.merchants))if(m.minPlayers<=names.length)for(let i=0;i<m.slots;i++){let buys=mix.pop();s.merchants.push({id:s.merchants.length,loc,buys,beer:buys!=='blank'});}
 note(s,'开局：运河时代，每人首回合1次行动。');return s;
}
export function current(s){return s.phase==='liquidation'?s.debtQueue[0]:s.order[s.turn];}
export const nextTile=(s,id,type)=>F.industries[type].find(d=>d.level===s.players[id].stacks[type][0]);
export const tileData=t=>F.industries[t.type].find(d=>d.level===t.level);
export const tileLocation=key=>key.split(':')[0];
export const isGoods=t=>['cottonMill','manufacturer','pottery'].includes(t);
export function cardName(c){return c.kind==='location'?cityName(c.loc):c.kind==='industry'?c.types.map(t=>ZH[t]).join(' / '):c.kind==='wildLocation'?'万能地点':'万能产业';}
function note(s,t){s.log.push(t);if(s.log.length>180)s.log.shift();}
function insist(ok,msg){if(!ok)throw Error(msg);}
export function ends(id){let c=F.connections.find(c=>c.id===id);return c?[c.from,c.to,...(c.from==='kidderminster'&&c.to==='worcester'||c.from==='worcester'&&c.to==='kidderminster'?['southern']:[])]:[];}
export function network(s,id){let set=new Set();for(let [k,t]of Object.entries(s.board))if(t.owner===id)set.add(tileLocation(k));for(let [k,t]of Object.entries(s.links))if(t.owner===id)ends(k).forEach(x=>set.add(x));return set;}
export function distances(s,starts){let d=Object.fromEntries(starts.map(x=>[x,0])),q=[...starts];while(q.length){let x=q.shift();for(let k of Object.keys(s.links)){let e=ends(k);if(e.includes(x))for(let y of e)if(d[y]===undefined){d[y]=d[x]+1;q.push(y);}}}return d;}
export const merchantConnected=(s,loc)=>Object.keys(distances(s,[loc])).some(x=>F.merchants[x]);
function flip(s,t){if(t.flipped)return;t.flipped=true;let d=tileData(t);s.players[t.owner].income=Math.min(99,s.players[t.owner].income+d.income);}
function spend(s,p,n,ctx){insist(p.money>=n,'现金不足，需要 £'+n);p.money-=n;p.spent+=n;if(ctx.activity)ctx.activity.spent+=n;}
function choose(ctx,kind,options,explicit=false){
 insist(options.length,'没有可用的'+kind);if(options.length===1&&!explicit)return options[0];
 let i=ctx.index++,value=ctx.choices?.[i];if(value!==undefined){let found=options.find(o=>o.id===value);insist(found,'资源选择已失效');return found;}
 if(ctx.auto)return options[0];let err=Error('请选择'+kind);err.choice={index:i,kind,options};throw err;
}
function takeResource(s,id,resource,locations,ctx,merchant=null){
 let p=s.players[id],dist=distances(s,locations),type={coal:'coalMine',iron:'ironWorks',beer:'brewery'}[resource];
 let options=Object.entries(s.board).filter(([k,t])=>t.type===type&&t.resource>0&&(resource==='iron'||resource==='beer'&&t.owner===id||dist[tileLocation(k)]!==undefined)).map(([k,t])=>({id:k,label:`${cityName(tileLocation(k))} · ${s.players[t.owner].name} · 余${t.resource}`,owner:t.owner,distance:dist[tileLocation(k)]??999}));
 if(resource==='coal'&&options.length){let d=Math.min(...options.map(o=>o.distance));options=options.filter(o=>o.distance===d);}
 options.sort((a,b)=>(a.owner===id?0:1)-(b.owner===id?0:1)||a.id.localeCompare(b.id));
 if(resource==='beer'&&merchant?.beer)options.unshift({id:'merchant:'+merchant.id,label:cityName(merchant.loc)+'商人啤酒（含奖励）'});
 if(!options.length&&resource!=='beer'){
  insist(resource==='iron'||locations.some(loc=>merchantConnected(s,loc)),'煤炭不可达：需要接通煤矿或任意商人地点');
  let cap=resource==='coal'?14:10,count=s[resource],price=count>0?Math.floor((cap-count)/2)+1:(resource==='coal'?8:6);
  spend(s,p,price,ctx);s[resource]=Math.max(0,count-1);return;
 }
 let pick=choose(ctx,{coal:'煤矿（必须最近）',iron:'铁厂',beer:'啤酒来源'}[resource],options,resource==='beer');
 if(pick.id.startsWith('merchant:')){merchant.beer=false;return merchant;}
 let tile=s.board[pick.id];tile.resource--;if(!tile.resource)flip(s,tile);
}
function developOne(s,p,type,ctx){let t=nextTile(s,p.id,type);insist(t&&t.canDevelop,'该产业当前最低等级不能研发');p.stacks[type].shift();ctx.activity?.developed.push({type,level:t.level});}
function merchantBonus(s,p,m,ctx){let f=F.merchants[m.loc];if(f.bonusType==='vp')p.vp+=f.bonusAmount;if(f.bonusType==='money')p.money+=f.bonusAmount;if(f.bonusType==='income')p.income=Math.min(99,p.income+f.bonusAmount);if(f.bonusType==='develop'){
 let options=TYPES.filter(t=>nextTile(s,p.id,t)?.canDevelop).map(t=>({id:t,label:ZH[t],level:nextTile(s,p.id,t).level}));if(options.length){options.push({id:'skip',label:'放弃本次免费研发'});let t=choose(ctx,'商人奖励：免费研发',options).id;if(t!=='skip')developOne(s,p,t,ctx);}
 }}
function discard(s,p,indices){
 const sorted=[...new Set(indices)].sort((a,b)=>b-a);
 insist(sorted.length===indices.length,'不能重复选择卡牌');
 for(const i of sorted){
  insist(Number.isInteger(i)&&p.hand[i],'请选择有效的手牌');
  const [card]=p.hand.splice(i,1);
  if(card.kind.startsWith('wild')){
   s.wild[card.kind==='wildLocation'?'location':'industry']++;
  }else{
   s.seenCards??=[...s.discard];
   if(!s.seenCards.some(c=>c.id===card.id))s.seenCards.push(card);
   s.discard.push(card);
  }
 }
}
function matches(s,id,c,loc,type){let net=network(s,id),farm=!!F.farms[loc];if(c.kind==='location')return !farm&&c.loc===loc;if(c.kind==='wildLocation')return !farm;return (c.kind==='wildIndustry'||c.kind==='industry'&&c.types.includes(type))&&(net.size===0||net.has(loc));}
function build(s,p,a,ctx){
 let loc=a.loc,type=a.industry,index=a.slot,key=loc+':'+index,d=nextTile(s,p.id,type),old=s.board[key];
 insist(d,'该产业板块已用完');insist(s.era==='canal'?d.canalEra:d.railEra,'该等级不能在当前时代建造');
 let slots=F.cities[loc]?.slots||(F.farms[loc]?[['brewery']]:null);insist(slots?.[index]?.includes(type),'地点不允许建造该产业');
 insist(matches(s,p.id,p.hand[a.card],loc,type),'手牌不匹配地点或产业网络');
 if(s.era==='canal')insist(!Object.entries(s.board).some(([k,t])=>tileLocation(k)===loc&&k!==key&&t.owner===p.id),'运河时代同一地点每人只能有一个产业');
 if(old){insist(old.type===type&&d.level>old.level,'覆盖必须是同类更高等级产业');if(old.owner!==p.id){insist(['coalMine','ironWorks'].includes(type),'只能覆盖对手的煤矿或铁厂');let res=type==='coalMine'?'coal':'iron';insist(!s[res]&&!Object.values(s.board).some(t=>t.type===type&&t.resource>0),'覆盖对手前，市场和全图相应资源必须耗尽');}}
 else if(slots[index].length>1)insist(!slots.some((allowed,i)=>allowed.length===1&&allowed[0]===type&&!s.board[loc+':'+i]),'必须优先使用只有该产业图标的空位');
 // Existing overbuilt resources cannot supply their replacement.
 delete s.board[key];spend(s,p,d.cost,ctx);
 for(let i=0;i<d.costCoal;i++)takeResource(s,p.id,'coal',[loc],ctx);
 for(let i=0;i<d.costIron;i++)takeResource(s,p.id,'iron',[loc],ctx);
 p.stacks[type].shift();let t={owner:p.id,type,level:d.level,flipped:false,resource:type==='brewery'?(s.era==='canal'?1:2):d.resourceCubes};s.board[key]=t;
 if(type==='ironWorks'||type==='coalMine'&&merchantConnected(s,loc)){
  let res=type==='ironWorks'?'iron':'coal',cap=res==='iron'?10:14;
  while(t.resource>0&&s[res]<cap){let price=Math.floor((cap-s[res]-1)/2)+1;p.money+=price;s[res]++;t.resource--;}
  if(!t.resource)flip(s,t);
 }
 return `建造 ${cityName(loc)} ${ZH[type]} ${d.level}级`;
}
function putLink(s,p,key,ctx){
 let c=F.connections.find(c=>c.id===key);insist(c&&!s.links[key]&&c[s.era],'该线路不能建造');let net=network(s,p.id);
 insist(!net.size||ends(key).some(x=>net.has(x)),'线路必须连接自己的网络');insist(p.linkCount<14,'本时代的14条连接板块已用完');
 s.links[key]={owner:p.id};p.linkCount++;if(s.era==='rail')takeResource(s,p.id,'coal',ends(key),ctx);
}
function sell(s,p,a,ctx,{settleRewards=true}={}){
 insist(Array.isArray(a.sales)&&a.sales.length,'请选择要出售的产业');
 const seen=new Set(),rewards=[];
 for(const sale of a.sales){let t=s.board[sale.key],m=s.merchants.find(x=>x.id===sale.merchant),loc=tileLocation(sale.key);
  insist(!seen.has(sale.key)&&t?.owner===p.id&&!t.flipped&&isGoods(t.type),'只能出售自己尚未翻面的商品产业');seen.add(sale.key);
  insist(m&&(m.buys==='any'||m.buys===t.type)&&distances(s,[loc])[m.loc]!==undefined,'需要连接能接收此商品的商人');
  for(let i=0;i<tileData(t).beersToSell;i++){
   const rewardedMerchant=takeResource(s,p.id,'beer',[loc],ctx,m);
   if(rewardedMerchant)rewards.push(rewardedMerchant);
  }
  flip(s,t);
 }
 if(settleRewards)for(const merchant of rewards)merchantBonus(s,p,merchant,ctx);
 return `出售 ${a.sales.length}个产业`;
}
// Preview the transaction without discarding, advancing or touching the live game.
export function previewSales(state,id,sales,choices=[],options){
 const s=clone(state),ctx={choices,index:0,auto:false};
 try{sell(s,s.players[id],{sales},ctx,options);return {ok:true,state:s};}
 catch(e){return {ok:false,error:e.message,choice:e.choice};}
}
export function estimateEraScore(s){
 if(s.gameOver)return s.players.map(()=>({industry:0,links:0}));
 let pts=s.players.map(()=>({industry:0,links:0}));for(let t of Object.values(s.board))if(t.flipped)pts[t.owner].industry+=tileData(t).vp;
 const value=loc=>(F.merchants[loc]?2:0)+Object.entries(s.board).filter(([k,t])=>tileLocation(k)===loc&&t.flipped).reduce((sum,[,t])=>sum+tileData(t).linkVP,0);
 for(let [key,l]of Object.entries(s.links))pts[l.owner].links+=ends(key).reduce((n,loc)=>n+value(loc),0);
 return pts;
}
function eraScore(s){
 const pts=estimateEraScore(s);
 pts.forEach((p,i)=>s.players[i].vp+=p.industry+p.links);s.scores.push({era:s.era,points:pts});note(s,`${s.era==='canal'?'运河':'铁路'}时代计分：`+pts.map((p,i)=>s.players[i].name+' +'+(p.industry+p.links)).join('，'));
 s.links={};for(let p of s.players)p.linkCount=0;
 if(s.era==='rail'){s.gameOver=true;s.phase='finished';s.winners=[...s.players].sort((a,b)=>b.vp-a.vp||income(b.income)-income(a.income)||b.money-a.money).filter((p,i,all)=>p.vp===all[0].vp&&income(p.income)===income(all[0].income)&&p.money===all[0].money).map(p=>p.id);return;}
 for(let [k,t]of Object.entries(s.board))if(t.level===1)delete s.board[k];
 for(let m of s.merchants)m.beer=m.buys!=='blank';s.era='rail';s.round=1;s.used=0;s.deck=shuffle(s,[...s.discard,...s.hiddenDiscard]);s.discard=[];s.hiddenDiscard=[];for(let p of s.players)fill(s,p);note(s,'铁路时代开始：每回合2次行动，二级及以上产业保留。');
}
function afterUpkeep(s){
 s.order.sort((a,b)=>s.players[a].spent-s.players[b].spent);for(let p of s.players)p.spent=0;s.turn=0;s.used=0;
 if(!s.deck.length&&s.players.every(p=>!p.hand.length))eraScore(s);else s.round++;
}
function endRound(s){
 let final=s.era==='rail'&&!s.deck.length&&s.players.every(p=>!p.hand.length);
 if(!final)for(let p of s.players)p.money+=income(p.income);
 s.debtQueue=s.order.filter(id=>s.players[id].money<0);
 settleDebts(s);
}
function settleDebts(s){
 while(s.debtQueue.length){let p=s.players[s.debtQueue[0]];
  if(p.money>=0){s.debtQueue.shift();continue;}
  if(!Object.values(s.board).some(t=>t.owner===p.id)){p.vp=Math.max(0,p.vp+p.money);note(s,p.name+'收入不足，失去胜利点');p.money=0;s.debtQueue.shift();continue;}
  s.phase='liquidation';return;
 }
 s.phase='play';afterUpkeep(s);
}
function advance(s,deferTurnEnd){
 let p=s.players[current(s)];s.used++;let limit=s.era==='canal'&&s.round===1?1:2;
 if(s.used<limit&&p.hand.length)return;
 if(deferTurnEnd){s.turnPending=true;return;}
 closeTurn(s);
}
function closeTurn(s){
 const p=s.players[current(s)];
 fill(s,p);s.used=0;s.turn++;
 if(s.turn>=s.order.length){endRound(s);return;}
 while(!s.players[s.order[s.turn]].hand.length){s.turn++;if(s.turn>=s.order.length){endRound(s);return;}}
}
export function endTurn(state,id){
 if(state.gameOver||state.phase!=='play'||!state.turnPending||id!==current(state))return {ok:false,error:'当前不能结束回合。'};
 const s=clone(state);delete s.turnPending;closeTurn(s);s.rev++;
 return {ok:true,state:s};
}
export function applyAction(state,id,action,{auto=false,recordActivity=false,deferTurnEnd=false}={}){
 let s=clone(state),a=clone(action),ctx={choices:a.choices,index:0,auto,activity:recordActivity?{spent:0,developed:[]}:null};
 try{
  insist(!s.gameOver,'对局已结束');insist(Number.isInteger(id)&&id===current(s),'尚未轮到该玩家');let p=s.players[id],message;
  if(s.phase==='liquidation'){
   insist(a.type==='liquidate'&&s.board[a.key]?.owner===id,'请选择自己的产业支付欠款');let t=s.board[a.key];p.money+=Math.floor(tileData(t).cost/2);delete s.board[a.key];message='出售产业支付收入欠款';settleDebts(s);
  }else{
   insist(s.phase==='play'&&!s.turnPending,'当前不能行动');insist(Number.isInteger(a.card)&&p.hand[a.card],'请先选择一张手牌');
   if(a.type==='build')message=build(s,p,a,ctx);
   else if(a.type==='network'){
    insist(Array.isArray(a.edges)&&a.edges.length>=1&&a.edges.length<=(s.era==='canal'?1:2),'请选择1条运河，或1至2条铁路');
    spend(s,p,s.era==='canal'?3:a.edges.length===2?15:5,ctx);for(let edge of a.edges)putLink(s,p,edge,ctx);if(a.edges.length===2)takeResource(s,id,'beer',ends(a.edges[1]),ctx);message='连接'+a.edges.length+'条'+(s.era==='canal'?'运河':'铁路');
   }else if(a.type==='sell')message=sell(s,p,a,ctx);
   else if(a.type==='develop'){
    insist(Array.isArray(a.industries)&&a.industries.length>=1&&a.industries.length<=2,'每次研发1至2个板块');for(let t of a.industries){developOne(s,p,t,ctx);takeResource(s,id,'iron',[],ctx);}message='研发 '+a.industries.map(t=>ZH[t]).join('、');
   }else if(a.type==='loan'){let n=income(p.income)-3;insist(n>=-10,'贷款会使收入低于-10');p.income=incomeTop(n);p.money+=30;message='贷款 £30，收入降低3级';}
   else if(a.type==='scout'){
    insist(!p.hand.some(c=>c.kind.startsWith('wild')),'持有万能牌时不能探索');insist(s.wild.location&&s.wild.industry,'万能牌供应不足');insist(Array.isArray(a.extra)&&a.extra.length===2,'探索需要额外弃2张牌');discard(s,p,[a.card,...a.extra]);p.hand.push({kind:'wildLocation'},{kind:'wildIndustry'});s.wild.location--;s.wild.industry--;message='探索，获得两张万能牌';
   }else if(a.type==='pass')message='跳过行动';else throw Error('未知行动');
   if(a.type!=='scout')discard(s,p,[a.card]);
   const entry=p.name+'：'+message;note(s,entry);if(ctx.activity)ctx.activity.logEntry=entry;advance(s,deferTurnEnd);
  }
  if(a.type==='liquidate'){const entry=p.name+'：'+message;note(s,entry);if(ctx.activity)ctx.activity.logEntry=entry;}s.rev++;return {ok:true,state:s,...(ctx.activity?{activity:ctx.activity}:{})};
 }catch(e){return {ok:false,error:e.message,choice:e.choice};}
}
export function legalActions(s,id=current(s),{allCards=false,doubleRails=true}={}){
 if(s.gameOver||s.turnPending||id!==current(s))return [];
 if(s.phase==='liquidation')return Object.entries(s.board).filter(([,t])=>t.owner===id).map(([key])=>({type:'liquidate',key}));
 let p=s.players[id],result=[],test=a=>{if(applyAction(s,id,a,{auto:true}).ok)result.push(a);};
 let cards=allCards?p.hand.map((_,i)=>i):[0];
 for(let card of cards){test({type:'loan',card});test({type:'pass',card});}
 // Builds need every distinct printed card, other actions may discard any card.
 let seen=new Set();p.hand.forEach((c,card)=>{
  let sig=JSON.stringify({...c,id:undefined});if(!allCards&&seen.has(sig))return;seen.add(sig);
  for(let [loc,city]of Object.entries({...F.cities,...Object.fromEntries(Object.keys(F.farms).map(k=>[k,{slots:[['brewery']]}]))}))city.slots.forEach((types,slot)=>types.forEach(industry=>{
   if(matches(s,id,c,loc,industry)&&nextTile(s,id,industry))test({type:'build',card,loc,slot,industry});
  }));
 });
 let available=F.connections.filter(c=>c[s.era]&&!s.links[c.id]);
 for(let c of available)test({type:'network',card:0,edges:[c.id]});
 if(s.era==='rail'&&doubleRails&&p.money>=15&&p.linkCount<13){
  for(let c of available){let tmp=clone(s);try{putLink(tmp,tmp.players[id],c.id,{auto:true,index:0});}catch{continue;}
   for(let c2 of available)if(c2.id!==c.id&&ends(c2.id).some(x=>network(tmp,id).has(x)))test({type:'network',card:0,edges:[c.id,c2.id]});
  }
 }
 for(let t of TYPES){test({type:'develop',card:0,industries:[t]});for(let u of TYPES)test({type:'develop',card:0,industries:[t,u]});}
 let singleSales=[];
 for(let [key,t]of Object.entries(s.board))if(t.owner===id&&!t.flipped&&isGoods(t.type))for(let m of s.merchants)if(m.buys==='any'||m.buys===t.type){let a={type:'sell',card:0,sales:[{key,merchant:m.id}]};if(applyAction(s,id,a,{auto:true}).ok){result.push(a);singleSales.push(a.sales[0]);}}
 if(singleSales.length>1){let saleList=[],seenSale=new Set();for(let sale of singleSales)if(!seenSale.has(sale.key)){let a={type:'sell',card:0,sales:[...saleList,sale]};if(applyAction(s,id,a,{auto:true}).ok){saleList.push(sale);seenSale.add(sale.key);}}if(saleList.length>1)result.push({type:'sell',card:0,sales:saleList});}
 if(p.hand.length>=3)test({type:'scout',card:0,extra:[1,2]});return result;
}
export function actionLabel(a){return a.type==='build'?`建造 ${cityName(a.loc)} · ${ZH[a.industry]} ${a.slot+1}号位`:a.type==='network'?`连接 ${a.edges.map(e=>{let c=F.connections.find(x=>x.id===e);return cityName(c.from)+'—'+cityName(c.to);}).join(' / ')}`:a.type==='develop'?'研发 '+a.industries.map(x=>ZH[x]).join('、'):a.type==='sell'?'出售 '+a.sales.map(x=>cityName(tileLocation(x.key))).join('、'):a.type==='loan'?'贷款 £30':a.type==='scout'?'探索万能牌':a.type==='liquidate'?'变卖 '+cityName(tileLocation(a.key)):'跳过';}
export function publicView(s,id){
 const v=clone(s);
 v.deckCount=v.deck.length;
 v.hiddenDiscardCount=v.hiddenDiscard?.length??0;
 delete v.deck;delete v.seed;delete v.hiddenDiscard;
 for(const p of v.players){
  delete p.discardPile; // Discard ownership from older saves is not part of the public view.
  p.handCount=p.hand.length;
  if(p.id!==id)p.hand=[];
 }
 return v;
}
