export async function api(path,body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),path==='me'?4000:40000);
 try{const r=await fetch('./api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
  if(!r.headers.get('content-type')?.includes('application/json'))throw Error('账号服务尚未接入此网址；仍可免登录游玩。');
  const data=await r.json();if(!r.ok)throw Error(data.error||'服务暂不可用');return data;
 }catch(e){if(e.name==='AbortError')throw Error('连接超时，请稍后重试');throw e;}finally{clearTimeout(timer);}
}
export async function currentUser(){try{return(await api('me')).user;}catch{return null;}}
