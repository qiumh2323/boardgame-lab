import {saveLocalMatch} from './local-matches.js?v=1';
import {verifyReplayFile} from './replay-file.js?v=1';
const input=document.querySelector('#replay-file'),message=document.querySelector('#message');
input.onchange=async()=>{const file=input.files[0];if(!file)return;input.disabled=true;
 try{if(file.size>20*1024*1024)throw Error('文件过大，请选择20MB以内的对局JSON文件');let data;try{data=JSON.parse(await file.text());}catch{throw Error('文件无法解析，请选择保存的对局JSON文件');}
 message.textContent='正在加载规则引擎，核对每一步行动…';
 const [{default:createEngine},catalog]=await Promise.all([import('./engine.js'),fetch('./catalog.json').then(r=>{if(!r.ok)throw Error('无法读取卡牌资料');return r.json();})]);
 const engine=await createEngine();const match=await verifyReplayFile(data,engine,catalog,(n,total)=>message.textContent=`正在核对行动 ${n}/${total}…`);
 await saveLocalMatch(match);message.textContent='校验通过，正在打开回放…';location.href='replay.html?local='+encodeURIComponent(match.id);
 }catch(e){message.textContent='读取失败：'+e.message;input.disabled=false;input.value='';}
};
