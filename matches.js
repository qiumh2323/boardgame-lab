import {listLocalMatches,difficultyLabels} from './local-matches.js';
const container=document.querySelector('#matches'),message=document.querySelector('#message');
try{const matches=await listLocalMatches();message.textContent=matches.length?`共保存 ${matches.length} 场完整对局`:'还没有已保存的对局。完整打完一局后会自动保存。';
 for(const match of matches){const row=document.createElement('article');row.className='match';const text=document.createElement('div'),time=document.createElement('small'),score=document.createElement('strong'),detail=document.createElement('span'),link=document.createElement('a');time.textContent=new Date(match.created).toLocaleString('zh-CN');score.textContent=`你 ${match.scores[0]} : ${match.scores[1]} 电脑`;detail.textContent=difficultyLabels[match.difficulty]??match.difficulty;link.href='replay.html?local='+encodeURIComponent(match.id);link.textContent='查看回放 →';text.append(time,score,detail);row.append(text,link);container.append(row);}
}catch(e){message.textContent=e.message;}
