const grid=document.querySelector('#game-grid');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function showNotes(game){document.querySelector('#experiment-title').textContent=game.title;document.querySelector('#experiment-description').textContent=game.description;document.querySelector('#experiment-notes').replaceChildren(...game.notes.map(t=>el('li','',t)));document.querySelector('#experiment-play').href=game.href;document.querySelector('#experiment-dialog').showModal();}
function gameCard(game){
 if(game.status==='upcoming'){
  const card=el('article','game-card '+game.theme+' upcoming');card.dataset.game=game.id;
  const visual=el('div','game-art');visual.append(el('span','exhibit-number',game.number),el('span','exhibit-type','敬请期待'));
  if(game.cover){const image=el('img','custom-cover');image.src=game.cover;image.alt=game.title;visual.append(image);}
  const body=el('div','game-body'),title=el('h3','',game.title);body.append(title,el('p','game-subtitle',game.subtitle));
  const bottom=el('div','game-bottom');bottom.append(el('span','coming-soon','敬请期待'),el('span','coming-note','这一桌，正在准备。'));body.append(bottom);card.append(visual,body);return card;
 }
 const card=el('article','game-card '+game.theme);card.dataset.game=game.id;
 const visual=el('a','game-art');visual.href=game.href;visual.setAttribute('aria-label',`进入${game.title}`);
 visual.append(el('span','exhibit-number',game.number),el('span','exhibit-type',game.theme==='ark'?'栖息地规划':'资源与进化'));
 if(game.cover){const img=el('img','custom-cover');img.src=game.cover;img.alt=game.title;visual.append(img);}
 else if(game.theme==='pokemon'){[['assets/cards/pdf-t1-bulbasaur-01.jpg','妙蛙种子','art-card one'],['assets/cards/pdf-legendary-mewtwo.jpg','超梦','art-card two'],['assets/balls/ball-red.png','红球','art-ball']].forEach(([src,alt,cls])=>{const img=el('img',cls);img.src=src;img.alt=alt;visual.append(img);});}
 const body=el('div','game-body'),meta=el('div','game-meta');meta.append(el('span','game-category',game.type),el('span','game-version',game.theme==='ark'?'轻量试玩':'V32.9'));body.append(meta);const title=el('h3'),titleLink=el('a','',game.title);titleLink.href=game.href;title.append(titleLink);body.append(title,el('p','game-subtitle',game.theme==='ark'?'规划栖息地，经营你的保护区。':'收集精灵球，捕获与进化宝可梦。'));
 const bottom=el('div','game-bottom'),play=el('a','play-link','开始游戏');play.href=game.href;play.append(el('span','','↗'));const notes=el('button','notes-link','游戏说明');notes.setAttribute('aria-label',`${game.title}游戏说明`);notes.onclick=()=>showNotes(game);bottom.append(play,notes);body.append(bottom);card.append(visual,body);return card;
}
const dialog=document.querySelector('#experiment-dialog');document.querySelector('#close-experiment').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
try{const response=await fetch('./games.json',{cache:'no-cache'});if(!response.ok)throw Error('load');const games=await response.json();grid.replaceChildren(...games.filter(g=>g.status==='upcoming'||(g.status==='live'&&g.href)).map(gameCard));}catch{const p=el('p','load-error','游戏列表加载失败。');for(const [title,href]of[['宝可梦璀璨宝石','game.html']]){const a=el('a','',`直接进入${title} ↗ `);a.href=href;p.append(a);}grid.append(p);}
