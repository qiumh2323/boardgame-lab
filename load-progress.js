export async function fetchWithProgress(url,onProgress,fetcher=fetch){
 const response=await fetcher(url);if(!response.ok)throw Error(`资源加载失败 (${response.status})`);
 const total=Number(response.headers.get('content-length'))||0;
 if(!response.body?.getReader){const buffer=await response.arrayBuffer();onProgress(buffer.byteLength,buffer.byteLength);return buffer;}
 const reader=response.body.getReader(),chunks=[];let loaded=0;
 for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;onProgress(loaded,total);}
 const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 onProgress(loaded,loaded);return bytes.buffer;
}
export function loadingLabel(stage,loaded=0,total=0){return total>0?`${stage} ${Math.min(100,Math.floor(loaded/total*100))}%`:`${stage}${loaded>0?' '+(loaded/1048576).toFixed(1)+' MB':'…'}`;}
export function preparationLabel(step,message){return `步骤 ${step}/5 · ${message}`;}
