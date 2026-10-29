const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const TAG={crown:'王冠',craft:'工匠',faith:'信仰',trade:'商贸',guard:'守卫',wild:'百搭'};
const defs=[
 ['C01','王室司库','castle',5,'👑',['crown','trade'],['gold',4],['tag','crown',2],'入场获得 4 金币','每个王冠 2 分'],
 ['C02','宫廷画师','castle',3,'🎨',['craft','crown'],['key',1],['row',3],'入场获得 1 钥匙','所在行每张正面牌 3 分'],
 ['C03','皇家卫士','castle',4,'🛡️',['guard','crown'],['gold',2],['adj','guard',3],'入场获得 2 金币','每个相邻守卫 3 分'],
 ['C04','宫廷乐师','castle',2,'🎻',['craft','wild'],['discount','castle',1],['unique',2],'本局城堡牌便宜 1','每种不同标签 2 分'],
 ['C05','女爵','castle',6,'♛',['crown','faith'],['both',2,1],['keyscore',2],'获得 2 金币与 1 钥匙','每把剩余钥匙再得 2 分'],
 ['C06','建筑大师','castle',4,'🏰',['craft','guard'],['goldTag','craft',1],['column',3],'每个已有工匠得 1 金币','所在列每张正面牌 3 分'],
 ['C07','皇家猎鹰师','castle',3,'🦅',['guard','wild'],['gold',3],['edge',3],'入场获得 3 金币','若在边缘得 3 分'],
 ['C08','主教','castle',5,'⛪',['faith','crown'],['key',2],['tag','faith',3],'入场获得 2 钥匙','每个信仰 3 分'],
 ['C09','外交官','castle',4,'📜',['trade','crown'],['gold',3],['mix',10],'入场获得 3 金币','城堡与村庄各至少 3 张得 10 分'],
 ['C10','御厨','castle',2,'🍗',['craft','trade'],['gold',2],['cheap',2],'入场获得 2 金币','每张费用 ≤2 的牌 2 分'],
 ['C11','占星师','castle',5,'🔭',['faith','craft'],['both',1,1],['corner',6],'获得 1 金币与 1 钥匙','若在角落得 6 分'],
 ['C12','骑士长','castle',6,'⚔️',['guard','crown'],['goldTag','guard',1],['tag','guard',3],'每个已有守卫得 1 金币','每个守卫 3 分'],
 ['V01','铁匠','village',3,'🔨',['craft','guard'],['gold',3],['adj','craft',3],'入场获得 3 金币','每个相邻工匠 3 分'],
 ['V02','面包师','village',2,'🥖',['craft','trade'],['gold',4],['row',2],'入场获得 4 金币','所在行每张正面牌 2 分'],
 ['V03','旅店老板','village',4,'🍺',['trade','wild'],['key',1],['tag','trade',2],'入场获得 1 钥匙','每个商贸 2 分'],
 ['V04','牧羊人','village',1,'🐑',['trade'],['gold',2],['cheap',2],'入场获得 2 金币','每张费用 ≤2 的牌 2 分'],
 ['V05','修女','village',3,'🕯️',['faith'],['both',2,1],['tag','faith',4],'获得 2 金币与 1 钥匙','每个信仰 4 分'],
 ['V06','木匠','village',3,'🪚',['craft'],['discount','village',1],['column',3],'本局村庄牌便宜 1','所在列每张正面牌 3 分'],
 ['V07','商贩','village',4,'🧺',['trade'],['goldTag','trade',1],['unique',2],'每个已有商贸得 1 金币','每种不同标签 2 分'],
 ['V08','民兵','village',2,'🏹',['guard'],['gold',2],['edge',4],'入场获得 2 金币','若在边缘得 4 分'],
 ['V09','草药师','village',3,'🌿',['faith','craft'],['key',1],['adj','faith',3],'入场获得 1 钥匙','每个相邻信仰 3 分'],
 ['V10','税务员','village',5,'🪙',['trade','crown'],['gold',6],['wallet',5],'入场获得 6 金币','钱袋容量 5'],
 ['V11','吟游诗人','village',2,'🎶',['wild'],['gold',2],['mix',8],'入场获得 2 金币','城堡与村庄各至少 3 张得 8 分'],
 ['V12','锁匠','village',4,'🗝️',['craft','trade'],['key',2],['keyscore',1],'入场获得 2 钥匙','每把剩余钥匙再得 1 分']
].map(([id,name,row,cost,icon,tags,effect,score,effectText,scoreText])=>({id,name,row,cost,icon,tags,effect,score,effectText,scoreText}));
let state, selected=null, busy=false;
const shuffle=a=>{a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function actor(){return{gold:15,keys:2,grid:Array(9).fill(null),discount:{castle:0,village:0}}}
function deck(row){return shuffle(defs.filter(c=>c.row===row).flatMap((c,i)=>[{...c,id:`${c.id}a${i}`},{...c,id:`${c.id}b${i}`}]))}
function fresh(){return{round:1,turn:'player',messenger:'village',market:{castle:[],village:[]},decks:{castle:deck('castle'),village:deck('village')},discard:{castle:[],village:[]},player:actor(),ai:actor(),log:[]}}
function draw(row){if(!state.decks[row].length){state.decks[row]=shuffle(state.discard[row]);state.discard[row]=[]}return state.decks[row].pop()}
function refill(row){while(state.market[row].length<3){const c=draw(row);if(!c)break;state.market[row].push(c)}}
function start(){state=fresh();refill('castle');refill('village');selected=null;busy=false;note('新一场嘉年华开始：你先行动。')}
function price(card,a){return Math.max(0,card.cost-a.discount[card.row])}
function cardView(c,down=false){const b=document.createElement('button');b.className='card'+(down?' face-down':'');b.type='button';if(down){b.innerHTML='<b>匿名嘉宾</b><span>+6 🪙 · +2 🔑</span>';return b}b.style.setProperty('--tint',c.row==='castle'?'#d9e7df':'#f0d8bd');b.innerHTML=`<span class="cost">${c.cost}</span><div class="portrait">${c.icon}</div><h3>${c.name}</h3><p class="tags">${c.tags.map(t=>TAG[t]).join(' · ')}</p><p class="effect">↯ ${c.effectText}</p><p class="score">★ ${c.scoreText}</p>`;return b}
function render(){
 $('#round').textContent=`${Math.min(state.round,9)} / 9`;$('#gold').textContent=state.player.gold;$('#keys').textContent=state.player.keys;$('#messenger').innerHTML=`<i>♞</i><span>信使在${state.messenger==='castle'?'城堡':'村庄'}</span>`;
 for(const row of ['castle','village']){$(`.market[data-row="${row}"]`).classList.toggle('active',state.messenger===row);const box=$(`#${row}Market`);box.replaceChildren(...state.market[row].map((c,i)=>{const b=cardView(c);b.disabled=busy||state.turn!=='player'||state.messenger!==row;b.classList.toggle('selected',selected?.row===row&&selected?.i===i);b.onclick=()=>selectCard(row,i);return b}))}
 $$('.key-action').forEach(b=>{const valid=b.dataset.action==='move'?b.dataset.row!==state.messenger:b.dataset.row===state.messenger;b.disabled=busy||state.turn!=='player'||state.player.keys<1||!valid;b.onclick=()=>keyAction(b.dataset.action,b.dataset.row)});
 renderGrid('player');renderGrid('ai');$('#previewScore').textContent=`预计 ${score(state.player).total} 分`;$('#aiScore').textContent=`预计 ${score(state.ai).total} 分`;$('#log').replaceChildren(...state.log.slice(-8).reverse().map(x=>{const li=document.createElement('li');li.textContent=x;return li}));
 $('#hint').textContent=busy?'AI 正在思考……':selected?'选择一个高亮空位；若金币不足，将自动翻面招募。':'从信使所在的一行选一张牌，再选择阵列中的空位。';
}
function renderGrid(who){const a=state[who],legal=new Set(positions(a)),box=$(`#${who==='player'?'playerGrid':'aiGrid'}`);box.replaceChildren(...a.grid.map((g,i)=>{const s=document.createElement('div');s.className='slot';if(g)s.append(cardView(g.card,g.down));else if(who==='player'&&selected&&!busy&&legal.has(i)){s.classList.add('available');s.onclick=()=>placePlayer(i)}return s}))}
function selectCard(row,i){selected=selected?.row===row&&selected.i===i?null:{row,i};render()}
function keyAction(action,row){state.player.keys--;if(action==='move'){state.messenger=row;note(`你花 1 把钥匙，将信使移动到${row==='castle'?'城堡':'村庄'}。`)}else{state.discard[row].push(...state.market[row]);state.market[row]=[];refill(row);note(`你花 1 把钥匙，刷新了${row==='castle'?'城堡':'村庄'}市场。`)}selected=null;render()}
function placePlayer(pos){if(!selected)return;const card=state.market[selected.row].splice(selected.i,1)[0];selected=null;recruit('player',card,pos);refill(card.row);render();busy=true;state.turn='ai';render();setTimeout(aiTurn,500)}
function recruit(who,card,pos){const a=state[who],p=price(card,a),down=a.gold<p;if(down){a.gold+=6;a.keys+=2}else{a.gold-=p;applyEffect(a,card)}a.grid[pos]={card,down};note(`${who==='player'?'你':'AI'}${down?'翻面招募':'招募'}了「${card.name}」${down?'，获得 6 金币和 2 钥匙':`（支付 ${p}）`}。`)}
function applyEffect(a,c){const [t,x,y]=c.effect;if(t==='gold')a.gold+=x;if(t==='key')a.keys+=x;if(t==='both'){a.gold+=x;a.keys+=y}if(t==='discount')a.discount[x]++;if(t==='goldTag')a.gold+=a.grid.filter(g=>g&&!g.down&&g.card.tags.includes(x)).length*y}
function positions(a){const occupied=a.grid.map((x,i)=>x?i:null).filter(x=>x!==null);const empty=a.grid.map((x,i)=>x?null:i).filter(x=>x!==null);if(!occupied.length)return empty;return empty.filter(i=>[i-3,i+3,i%3?i-1:-1,i%3<2?i+1:-1].some(n=>occupied.includes(n)))}
function cardPotential(c,a,pos){const p=price(c,a),afford=a.gold>=p;let v=afford?7-p*.65:1.3;const [t,x,y]=c.effect;if(t==='gold')v+=x*.65;if(t==='key')v+=x*1.1;if(t==='both')v+=x*.6+y;if(t==='discount')v+=2.1;if(t==='goldTag')v+=a.grid.filter(g=>g&&!g.down&&g.card.tags.includes(x)).length*y*.6;v+=scoreCard(c,a,pos,false)/2.8;return v}
function bestChoice(row,a){let best=null;for(let i=0;i<state.market[row].length;i++)for(const pos of positions(a)){const c=state.market[row][i],v=cardPotential(c,a,pos)+(Math.random()-.5)*.5;if(!best||v>best.v)best={row,i,pos,c,v}}return best}
function aiTurn(){let current=bestChoice(state.messenger,state.ai),other=bestChoice(state.messenger==='castle'?'village':'castle',state.ai);if(state.ai.keys>0&&other&&other.v>(current?.v??0)+2){state.ai.keys--;state.messenger=other.row;current=other;note(`AI 花 1 把钥匙，把信使移到${other.row==='castle'?'城堡':'村庄'}。`)}const card=state.market[current.row].splice(current.i,1)[0];recruit('ai',card,current.pos);refill(current.row);if(state.round>=9){busy=false;render();setTimeout(endGame,350);return}state.round++;state.turn='player';busy=false;$('#aiThought').textContent=`AI 选择「${card.name}」：综合考虑价格、即时资源、标签联动和落点，估值 ${current.v.toFixed(1)}。`;render()}
function scoreCard(c,a,pos,includeWallet=true){const g=a.grid,[t,x,y]=c.score,row=Math.floor(pos/3),col=pos%3,face=v=>v&&!v.down,faceAt=i=>face(g[i]);let n=0;if(t==='tag')n=g.filter(face).filter(z=>z.card.tags.includes(x)).length*y;if(t==='adj'){const ids=[pos-3,pos+3,pos%3?pos-1:-1,pos%3<2?pos+1:-1];n=ids.filter(i=>i>=0&&i<9&&faceAt(i)&&g[i].card.tags.includes(x)).length*y}if(t==='row')n=[row*3,row*3+1,row*3+2].filter(faceAt).length*x;if(t==='column')n=[col,col+3,col+6].filter(faceAt).length*x;if(t==='unique')n=new Set(g.filter(face).flatMap(z=>z.card.tags)).size*x;if(t==='keyscore')n=a.keys*x;if(t==='edge')n=([0,1,2,3,5,6,7,8].includes(pos)?x:0);if(t==='corner')n=([0,2,6,8].includes(pos)?x:0);if(t==='mix'){const cs=g.filter(face).filter(z=>z.card.row==='castle').length,vs=g.filter(face).filter(z=>z.card.row==='village').length;n=cs>=3&&vs>=3?x:0}if(t==='cheap')n=g.filter(face).filter(z=>z.card.cost<=2).length*x;if(t==='wallet')n=includeWallet?Math.min(a.gold,x):0;return n}
function score(a){let cards=0;a.grid.forEach((g,i)=>{if(g&&!g.down)cards+=scoreCard(g.card,a,i)});return{cards,keys:a.keys,total:cards+a.keys}}
function endGame(){const p=score(state.player),a=score(state.ai);$('#finalPlayer').textContent=p.total;$('#finalAi').textContent=a.total;$('#resultTitle').textContent=p.total>a.total?'你赢得了国王的喝彩！':p.total<a.total?'AI 的宫廷组合更胜一筹':'这是一场势均力敌的嘉年华';$('#resultDetail').textContent=`你的角色与钱袋 ${p.cards} 分、钥匙 ${p.keys} 分；AI 的角色与钱袋 ${a.cards} 分、钥匙 ${a.keys} 分。`;$('#result').showModal()}
function note(t){state.log.push(t);if(state.log.length>30)state.log.shift();render()}
$('#restart').onclick=start;$('#again').onclick=()=>{$('#result').close();start()};$('#rulesBtn').onclick=()=>$('#rules').showModal();$('#rules .close').onclick=()=>$('#rules').close();start();
