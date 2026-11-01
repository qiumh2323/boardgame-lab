export const difficultyLabels={simple:'Blue · 简单的',medium:'Green · 中等难度的',hard:'Red · 令人发狂的'};
export function replayFrame(state){const frame=structuredClone(state);for(const key of ['actions','history','chosen','search'])delete frame[key];return frame;}
export function completeLocalMatch(input){
 if(!input.id||!input.frames?.at(-1)?.terminal||input.frames.length!==input.actions.length+1)throw Error('只有完整结束的对局才能保存');
 const last=input.frames.at(-1);return {...structuredClone(input),schema:'pokemon-local-match-v1',created:input.created??Date.now(),scores:last.players.map(p=>p.score),completed:true};
}
function open(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(Error('此浏览器不支持本地对局保存'));const req=indexedDB.open('boardgame-lab-pokemon-matches',1);req.onupgradeneeded=()=>req.result.createObjectStore('matches',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('无法打开本地对局库，请检查浏览器存储权限'));req.onblocked=()=>reject(Error('本地对局库正被其他标签页占用，请稍后重试'));});}
async function transact(mode,operation){const db=await open();return new Promise((resolve,reject)=>{let result;const tx=db.transaction('matches',mode);const req=operation(tx.objectStore('matches'));req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(Error('本地保存失败，可能是存储空间不足或浏览器限制'));};});}
export async function saveLocalMatch(input){const match=completeLocalMatch(input);await transact('readwrite',store=>store.put(match));return match;}
export async function getLocalMatch(id){return transact('readonly',store=>store.get(id));}
export async function listLocalMatches(){const rows=await transact('readonly',store=>store.getAll());return rows.sort((a,b)=>b.created-a.created).map(({frames,actions,...summary})=>summary);}
