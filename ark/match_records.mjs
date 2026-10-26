const DB_NAME='boardgame-lab-ark-matches';
const STORE='matches';
const VERSION=1;
const clone=value=>structuredClone(value);
let saveQueue=Promise.resolve();
let pendingWrites=0;

function database() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains('backups'))db.createObjectStore('backups',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function transaction(mode,operation,storeName=STORE) {
  const db=await database();
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName);
      let result;
      try{result=operation(store);}catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(result?.result);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||Error('对局记录事务已中止'));
    });
  } finally {db.close();}
}

export function createMatchRecord({mode,ai=null,mapSide,seat=0,roomCode=null,initialState}) {
  const startedAt=new Date().toISOString();
  return {schema:'ark-sanctuary-match-v1',id:crypto.randomUUID(),startedAt,updatedAt:startedAt,
    endedAt:null,status:'active',mode,ai,mapSide,seat,roomCode,initialState:clone(initialState),
    events:[],result:null,revision:0};
}

export function appendMatchEvent(record,{actor,kind='action',label,decision=null,search=null,state}) {
  record.events.push({index:record.events.length+1,at:new Date().toISOString(),actor,kind,
    label:String(label||'完成一步操作'),decision:decision?clone(decision):null,
    search:search?clone(search):null,state:clone(state)});
  record.updatedAt=new Date().toISOString();
  record.revision=(record.revision??record.events.length-1)+1;
  if(state.phase==='ended'){
    record.status='complete';record.endedAt=record.updatedAt;record.result=clone(state.scores);
  }
  return record;
}

export function saveMatchRecord(record){
  const snapshot=clone(record);
  pendingWrites++;
  const operation=saveQueue.catch(()=>{}).then(async()=>{
    await transaction('readwrite',store=>store.put(snapshot));
    return snapshot;
  }).finally(()=>pendingWrites--);
  saveQueue=operation;
  return operation;
}
export const flushMatchRecords=()=>saveQueue;
export const hasPendingMatchWrites=()=>pendingWrites>0;
export async function listMatchRecords(){
  await saveQueue.catch(()=>{});
  const local=await transaction('readonly',store=>store.getAll()).catch(()=>[])||[];
  const remote=[];
  const merged=new Map();
  for(const record of [...remote,...local]){
    const previous=merged.get(record.id);
    if(!previous||(record.revision??record.events.length)>(previous.revision??previous.events.length)
       ||((record.revision??record.events.length)===(previous.revision??previous.events.length)
          &&record.updatedAt>previous.updatedAt))merged.set(record.id,record);
  }
  const records=[...merged.values()];
  return records.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
export async function getMatchRecord(id){return transaction('readonly',store=>store.get(id));}
export async function deleteMatchRecord(id){await saveQueue.catch(()=>{});await transaction('readwrite',store=>store.delete(id));}
export async function clearMatchRecords(){
  await saveQueue.catch(()=>{});
  const records=await listMatchRecords();
  await transaction('readwrite',store=>store.put({id:'last-clear',records}),'backups');
  await transaction('readwrite',store=>store.clear());
  localStorage.setItem('lab-ark-cleared-backup','local');
  return {count:records.length};
}
export async function restoreClearedMatchRecords(){
  const backup=await transaction('readonly',store=>store.get('last-clear'),'backups');
  if(!backup)throw Error('没有可恢复的回放备份');
  for(const record of backup.records)await transaction('readwrite',store=>store.put(record));
  await transaction('readwrite',store=>store.delete('last-clear'),'backups');
  localStorage.removeItem('lab-ark-cleared-backup');
  return {count:backup.records.length};
}

export function replayStates(record){return [record.initialState,...record.events.map(event=>event.state)];}

export function exportMatchRecord(record) {
  const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=`ark-sanctuary-${record.id}.json`;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
