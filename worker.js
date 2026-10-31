import createEngine from './engine.js?v=4';
import {encode,tieRanks} from './encoder.js';
import {fetchWithProgress,loadingLabel,preparationLabel} from './load-progress.js?v=2';
import * as ort from './vendor/ort.wasm.min.mjs';
let engine,data,session,ready;
let currentRequestId=null;
globalThis.onSearchProgress=(completed,total)=>postMessage({type:'search-progress',id:currentRequestId,completed,total});
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
globalThis.evaluateNative=async packet=>{
 const enc=encode(packet,data);
 const result=await session.run({global:new ort.Tensor('float32',Float32Array.from(enc.global),[enc.global.length]),
   entities:new ort.Tensor('float32',Float32Array.from(enc.entities.flat()),[enc.entities.length,enc.entities[0].length]),
   actions:new ort.Tensor('float32',Float32Array.from(enc.actions.flat()),[enc.actions.length,enc.actions[0].length])});
 const logits=Array.from(result.logits.data),max=Math.max(...logits),exp=logits.map(x=>Math.exp(x-max)),sum=exp.reduce((a,b)=>a+b,0);
 const value=result.value.data[0];Object.values(result).forEach(t=>t.dispose());
 return {priors:exp.map(x=>x/sum),value,...tieRanks(packet.actions,data)};
};
async function dispatch(req){
 const text=await engine.ccall('web_dispatch','string',['string'],[JSON.stringify(req)],{async:true});
 const result=JSON.parse(text);if(result.error)throw Error(result.error);return result;
}
async function initialize(){
 const status=(step,message)=>postMessage({type:'loading',step,totalSteps:5,message:preparationLabel(step,message)});
 status(1,'读取卡牌数据…');
 const catalog=await fetch('./catalog.json');if(!catalog.ok)throw Error(`卡牌数据读取失败 (${catalog.status})`);data=await catalog.json();
 status(2,'读取搜索引擎…');
 const wasmBinary=await fetchWithProgress(new URL('./engine.wasm?v=4',import.meta.url),(n,total)=>status(2,loadingLabel('读取搜索引擎',n,total)));
 status(3,'初始化搜索引擎…');
 engine=await createEngine({wasmBinary,locateFile:name=>new URL(name+'?v=4',import.meta.url).href});
 status(4,'读取冠军模型…');
 const model=await fetchWithProgress(new URL('./champion.onnx',import.meta.url),(n,total)=>status(4,loadingLabel('读取冠军模型',n,total)));
 status(5,'启动推理运行时…');
 session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 status(5,'校验游戏规则…');
 await dispatch({op:'init',data});
 postMessage({type:'ready',data:{version:data.version,cards:data.cards.map(({features,entity,...c})=>c)}});
}
ready=initialize();
self.onmessage=async ({data:req})=>{
 try{await ready;currentRequestId=req.id;const t=performance.now();const result=await dispatch(req);
   postMessage({type:'result',id:req.id,result,elapsed:performance.now()-t});
 }catch(e){postMessage({type:'error',id:req.id,message:e.message});}
};
ready.catch(e=>postMessage({type:'error',message:e.message}));
