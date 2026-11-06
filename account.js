import {api} from './account-api.js';
const $=s=>document.querySelector(s);let mode='login',mailReady=false,challenge='',bindChallenge='',cooldowns=new Map();
function tab(next){
 mode=next;challenge='';$('#code').value='';
 $('#login-tab').setAttribute('aria-pressed',String(mode==='login'));$('#register-tab').setAttribute('aria-pressed',String(mode==='register'));
 for(const [field,visible] of [['email',mode!=='password'],['code',mode!=='password'],['username',mode==='register'||mode==='password'],['password',mode!=='login'],['consent',mode==='register']]){
  $('#'+field+'-row').hidden=!visible;$('#'+field).required=visible;$('#'+field).disabled=!visible;
 }
 $('#password').autocomplete=mode==='password'?'current-password':'new-password';
 $('#submit').textContent=({login:'邮箱验证码登录',register:'验证邮箱并注册',password:'账号密码登录',reset:'重设密码'})[mode];
 $('#submit').disabled=mode!=='password'&&!mailReady;$('#send-code').disabled=!mailReady;$('#message').textContent='';
}
$('#login-tab').onclick=()=>tab('login');$('#register-tab').onclick=()=>tab('register');
$('#password-login').onclick=()=>tab('password');$('#reset-tab').onclick=()=>tab('reset');
function countdown(button){const until=cooldowns.get(button)||0,seconds=Math.ceil((until-Date.now())/1000);button.disabled=!mailReady||seconds>0;button.textContent=seconds>0?`${seconds}秒后重发`:(button.id==='bind-send'?'获取绑定验证码':'获取验证码');}
setInterval(()=>{countdown($('#send-code'));countdown($('#bind-send'));},1000);
async function sendCode(binding=false){
 const button=$(binding?'#bind-send':'#send-code'),email=$(binding?'#bind-email':'#email');
 if(!email.reportValidity())return;
 if(binding&&!$('#bind-password').reportValidity())return;
 button.disabled=true;
 try{
  const result=await api('email/send',{email:email.value,purpose:binding?'bind':mode,...(binding?{current_password:$('#bind-password').value}:{})});
  if(binding)bindChallenge=result.challenge;else challenge=result.challenge;
  cooldowns.set(button,Date.now()+result.retry_after*1000);$('#message').textContent=result.message;
 }catch(error){$('#message').textContent=error.message;}
 finally{countdown(button);}
}
$('#send-code').onclick=()=>sendCode();$('#bind-send').onclick=()=>sendCode(true);
async function show(user){$('#auth').hidden=!!user;$('#profile').hidden=!user;if(!user)return;$('#bound-email').textContent=user.email||'尚未绑定邮箱；绑定后可用邮箱验证码登录和找回密码。';$('#bind-email-form').hidden=!!user.email;$('#welcome').textContent=user.username+'的对局';const {matches}=await api('matches');$('#matches').replaceChildren();if(!matches.length){$('#matches').textContent='还没有完整对局。开一局，结束后会自动出现在这里。';return;}for(const m of matches){const row=document.createElement('article');row.className='match';const text=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong'),detail=document.createElement('span'),a=document.createElement('a');const scores=JSON.parse(m.scores);small.textContent=new Date(m.created*1000).toLocaleString('zh-CN');strong.textContent=`你 ${scores[0]} : ${scores[1]} 电脑`;detail.textContent=`${{simple:'简单',medium:'中等',hard:'困难'}[m.difficulty]}电脑 · ${m.turns}回合`;a.href='replay.html?id='+encodeURIComponent(m.id);a.textContent='查看回放 →';text.append(small,strong,detail);row.append(text,a);$('#matches').append(row);}}
$('#account-form').onsubmit=async e=>{e.preventDefault();$('#submit').disabled=true;try{
 if(mode!=='password'&&!challenge)throw Error('请先获取邮箱验证码');
 const data={username:$('#username').value.trim(),password:$('#password').value,email:$('#email').value,code:$('#code').value,challenge,consent:$('#consent').checked};
 const result=await api(mode==='password'?'login':'email/'+mode,data);$('#password').value='';$('#code').value='';challenge='';$('#message').textContent='';
 if(mode==='reset'){tab('login');$('#message').textContent='密码已重设，所有设备已退出，请重新登录。';}else await show(result.user);
 }catch(error){$('#message').textContent=error.message;}finally{$('#submit').disabled=mode!=='password'&&!mailReady;}};
$('#bind-email-form').onsubmit=async e=>{e.preventDefault();$('#bind-submit').disabled=true;try{
 if(!bindChallenge)throw Error('请先获取绑定验证码');
 const {user}=await api('email/bind',{email:$('#bind-email').value,code:$('#bind-code').value,challenge:bindChallenge,current_password:$('#bind-password').value});
 e.target.reset();bindChallenge='';await show(user);$('#message').textContent='邮箱已绑定，以后可以使用邮箱验证码登录。';
 }catch(error){$('#message').textContent=error.message;}finally{$('#bind-submit').disabled=!mailReady;}};
$('#logout').onclick=async()=>{try{await api('logout',{});await show(null);}catch(e){$('#message').textContent=e.message;}};
$('#change-password-form').onsubmit=async e=>{
 e.preventDefault();const button=$('#change-password-submit');button.disabled=true;
 try{
  if($('#new-password').value!==$('#repeat-password').value)throw Error('两次输入的新密码不一致');
  await api('account/password',{current_password:$('#current-password').value,new_password:$('#new-password').value});
  await show(null);tab('login');$('#message').textContent='密码已修改，请使用新密码重新登录。';
 }catch(error){$('#message').textContent=error.message;}
 finally{e.target.reset();button.disabled=false;}
};
$('#delete-account-form').onsubmit=async e=>{
 e.preventDefault();const button=$('#delete-account-submit');button.disabled=true;
 try{
  await api('account/delete',{current_password:$('#delete-password').value,confirmation:$('#delete-confirmation').value});
  await show(null);tab('login');$('#message').textContent='账号及站点数据库中的云端对局已删除。';
 }catch(error){$('#message').textContent=error.message;}
 finally{e.target.reset();button.disabled=false;}
};
try{
 const status=await api('status');mailReady=!!status.email;
 $('#mail-status').textContent=mailReady?'':'邮箱服务正在配置中，暂未开放注册。已有账号可使用账号密码登录。';
 $('#bind-submit').disabled=!mailReady;tab('login');await show((await api('me')).user);
}catch(e){$('#message').textContent=e.message;$('#submit').disabled=true;}
