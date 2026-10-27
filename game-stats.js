// Main actions and same-turn follow-ups are deliberately counted separately.
export function summarizeGame(state,cards,entries,elapsedMs=0){
 const players=state.players.map(p=>({score:p.score,turns:0,take:0,double:0,capture:0,reserve:0,pass:0,evolve:0,discard:0,discarded:0,taken:0,masterPaid:0,active:p.active.length,permanent:[0,0,0,0,0],tiers:[0,0,0,0,0]}));
 for(let i=0;i<2;i++)for(const id of state.players[i].active){const c=cards[id];if(c&&c.bonus_color<5)players[i].permanent[c.bonus_color]+=c.bonus_value;}
 for(const entry of entries){const p=players[entry.actor],a=entry.action;if(!p||!a)continue;
  if([0,1,2,3,7].includes(a.kind))p.turns++;
  if(a.kind===0||a.kind===1){p.take++;p.taken+=(a.tokens??[]).reduce((x,y)=>x+y,0);if(a.kind===1)p.double++;}
  if(a.kind===2)p.reserve++;
  if(a.kind===3){p.capture++;p.masterPaid+=a.payment?.[5]??0;const c=cards[a.card];if(c)p.tiers[c.deck]++;}
  if(a.kind===4){p.discard++;p.discarded+=(a.tokens??[]).reduce((x,y)=>x+y,0);}
  if(a.kind===5){p.evolve++;p.masterPaid+=a.payment?.[5]??0;}
  if(a.kind===7)p.pass++;
 }
 return {players,turns:players.reduce((n,p)=>n+p.turns,0),actions:entries.length,elapsedMs:Math.max(0,elapsedMs),winner:state.rewards?.[0]>0?0:state.rewards?.[0]<0?1:null};
}
export function renderGameStats(container,stats){
 const labels=['你','电脑'],colors=['red','blue','black','pink','yellow'],names=['红','蓝','黑','粉','黄'];
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 const duration=stats.elapsedMs?`${Math.floor(stats.elapsedMs/60000)}分${Math.floor(stats.elapsedMs/1000)%60}秒`:'未记录';
 const heading=el('div','result-heading'),title=el('div');title.append(el('p','result-eyebrow','本局复盘'),el('h2','',stats.winner===null?'这一局，平分秋色。':stats.winner===0?'这局，你赢得漂亮。':'这局，电脑略胜一筹。'));
 const score=el('div','result-score',stats.players.map(p=>p.score).join(' : '));score.setAttribute('aria-label',`你${stats.players[0].score}分，电脑${stats.players[1].score}分`);heading.append(title,score);
 container.replaceChildren(heading,el('p','result-meta',`共 ${stats.turns} 个玩家回合 · ${stats.actions} 次行动（含进化、弃球等） · 用时 ${duration}`));
 const grid=el('div','result-grid');
 stats.players.forEach((p,i)=>{const box=el('section','result-player');box.append(el('h3','',labels[i]+'的行动'));
  const stack=el('div','action-stack');stack.setAttribute('aria-label','拿球、捕获与保留的主要行动占比');
  const legend=el('div','action-legend');
  for(const [key,name,cls] of [['take','拿球','take'],['capture','捕获','capture'],['reserve','保留','reserve'],['pass','让过','pass']]){if(key==='pass'&&!p.pass)continue;const percent=p.turns?p[key]/p.turns*100:0;const part=el('span',cls);part.style.width=percent+'%';part.title=`${name} ${p[key]}次 / ${percent.toFixed(1)}%`;stack.append(part);legend.append(el('span',cls,`${name} ${p[key]}次 · ${percent.toFixed(1)}%`));}
  box.append(stack,legend);
  const metrics=el('dl','result-metrics');for(const [name,value] of [['进化',`${p.evolve}次`],['弃球',`${p.discard}次 / ${p.discarded}个`],['双同色拿球',`${p.double}次`],['拿球总量',`${p.taken}个`],['大师球支付',`${p.masterPaid}个`],['终局在场',`${p.active}张`]]){metrics.append(el('dt','',name),el('dd','',value));}box.append(metrics);
  const colorRow=el('div','result-permanent');p.permanent.forEach((n,c)=>{const chip=el('span');const img=el('img');img.src=`assets/balls/ball-${colors[c]}.png`;img.alt=names[c]+'色永久球';chip.append(img,el('strong','',String(n)));colorRow.append(chip);});box.append(el('h4','','终局永久球'),colorRow);
  box.append(el('p','result-tier','捕获来源：'+['初级','进阶','高级','稀有','传说'].map((n,j)=>`${n} ${p.tiers[j]}`).join(' · ')));grid.append(box);
 });
 container.append(grid,el('p','result-footnote','主要行动按玩家回合计算；进化、弃球不额外占回合，单独统计。卡牌层级按直接捕获记录，不包含进化获得。'));
 container.hidden=false;
}
