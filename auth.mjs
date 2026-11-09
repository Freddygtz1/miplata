import {SignJWT,jwtVerify} from 'jose';

const encoder=new TextEncoder();
const cookieName='__Host-miplata_session';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};
const json=(body,status)=>Response.json(body,{status,headers});
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured=env=>typeof env.LOGIN_PASSWORD==='string'&&env.LOGIN_PASSWORD.length>=24&&typeof env.ALLOWED_EMAIL==='string'&&/^[^\s@]+@[^\s@]+$/.test(env.ALLOWED_EMAIL);
const email=env=>env.ALLOWED_EMAIL.toLowerCase().trim();
async function sessionKey(env){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode('miplata-session-v1:'+env.LOGIN_PASSWORD)));}
function loginPage(message='',status=200,ready=true){
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceder · Mi Plata</title><style>*{box-sizing:border-box}body{margin:0;background:#f2f1ee;color:#161616;font:16px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{background:white;border-top:6px solid #cc001b;padding:36px;width:min(440px,100%);box-shadow:0 12px 45px #0001}.brand{font-size:30px;font-weight:800;letter-spacing:-1px}h1{font-size:25px;margin:26px 0 10px}.caption{font-size:12px;letter-spacing:1px;color:#666}p{line-height:1.5;color:#555}label{display:block;font-size:14px;font-weight:600;margin:20px 0 7px}input{display:block;width:100%;border:1px solid #bcbcbc;border-radius:4px;padding:12px;font:inherit}button{width:100%;margin-top:24px;background:#cc001b;border:0;color:white;padding:13px;font:inherit;font-weight:700;border-radius:4px;cursor:pointer}button:disabled{opacity:.5;cursor:default}.message{background:#fff1f2;border-left:3px solid #cc001b;padding:12px;font-size:14px}.agency{font-weight:800;color:#cc001b;margin-top:28px}a,input,button{outline-offset:4px}</style></head><body><main class="card"><div class="brand">miPLATA</div><p class="caption">DASHBOARD MARKETING DE PAUTA</p><h1>Acceso al dashboard</h1><p>Ingresa con tu correo autorizado y contraseña.</p>${message?`<p class="message" role="alert">${escape(message)}</p>`:''}<form method="post" action="/auth/login"><label for="email">Correo</label><input id="email" name="email" type="email" autocomplete="username" required maxlength="254"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit" ${ready?'':'disabled'}>Entrar</button></form><div class="agency">bl_nk</div></main></body></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
async function boundedBody(request){
  if(Number(request.headers.get('Content-Length'))>4096)throw Error('body');
  const reader=request.body?.getReader();if(!reader)return '';
  const decoder=new TextDecoder();let result='',length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>4096){await reader.cancel();throw Error('body');}result+=decoder.decode(value,{stream:true});}return result+decoder.decode();}finally{reader.releaseLock();}
}
export async function verifySession(request,env){
  if(!configured(env))throw Error('Sesión no configurada');
  const tokens=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName+'='));
  if(tokens.length!==1)throw Error('Sesión requerida');
  const token=tokens[0].slice(cookieName.length+1);if(token.length>4096)throw Error('Sesión inválida');
  const origin=new URL(request.url).origin;
  const {payload}=await jwtVerify(token,await sessionKey(env),{algorithms:['HS256'],issuer:origin,audience:'mi-plata-dashboard',requiredClaims:['exp','iat','sub','email']});
  if(payload.email!==email(env)||payload.sub!==email(env))throw Error('Correo no autorizado');
  return payload;
}
export async function handleAuthentication(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/auth/logout'){
    if(request.method!=='POST'||request.headers.get('Origin')!==url.origin)return json({status:'invalid_request'},403);
    return new Response(null,{status:303,headers:{...headers,Location:'/auth/login','Set-Cookie':`${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`}});
  }
  if(url.pathname==='/auth/login'){
    if(request.method==='GET'){
      try{await verifySession(request,env);return new Response(null,{status:303,headers:{...headers,Location:'/'}});}catch{}
      return loginPage(configured(env)?'':'El acceso está en preparación. Falta establecer la contraseña en el servidor.',200,configured(env));
    }
    if(request.method!=='POST')return json({status:'invalid_request'},405);
    if(request.headers.get('Origin')!==url.origin)return json({status:'invalid_request'},403);
    if(!configured(env)||!env.LOGIN_LIMITER?.limit)return loginPage('El acceso está en preparación. Intenta más tarde.',503,false);
    if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return json({status:'invalid_request'},415);
    let allowed;try{allowed=(await env.LOGIN_LIMITER.limit({key:'miplata-login:'+email(env)})).success;}catch{return loginPage('El inicio de sesión no está disponible temporalmente.',503);}
    if(!allowed)return loginPage('Demasiados intentos. Espera un minuto antes de intentar de nuevo.',429);
    let form;try{form=new URLSearchParams(await boundedBody(request));}catch{return json({status:'invalid_request'},413);}
    const suppliedEmail=(form.get('email')||'').toLowerCase().trim(),password=form.get('password')||'';
    if(password.length>256)return loginPage('Correo o contraseña incorrectos.',401);
    const key=await crypto.subtle.importKey('raw',encoder.encode(env.LOGIN_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
    const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(env.LOGIN_PASSWORD));
    const correct=await crypto.subtle.verify('HMAC',key,signature,encoder.encode(password));
    if(!correct||suppliedEmail!==email(env))return loginPage('Correo o contraseña incorrectos.',401);
    const token=await new SignJWT({email:email(env)}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setSubject(email(env)).setIssuer(url.origin).setAudience('mi-plata-dashboard').setIssuedAt().setExpirationTime('8h').sign(await sessionKey(env));
    return new Response(null,{status:303,headers:{...headers,Location:'/', 'Set-Cookie':`${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`}});
  }
  try{await verifySession(request,env);return null;}catch{
    if(['GET','HEAD'].includes(request.method)&&(request.headers.get('Accept')||'').includes('text/html'))return new Response(null,{status:303,headers:{...headers,Location:'/auth/login'}});
    return json({status:'authentication_required',message:'Inicia sesión con tu correo y contraseña para consultar el dashboard.'},401);
  }
}
