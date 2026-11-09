import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAuthentication,verifySession} from './auth.mjs';
import worker from './cloudflare-worker.mjs';
const env={ALLOWED_EMAIL:'test@example.com',LOGIN_PASSWORD:'Synthetic-long-password-for-tests-123',LOGIN_LIMITER:{limit:async()=>({success:true})}};
const origin='https://dashboard.example';
function login(email=env.ALLOWED_EMAIL,password=env.LOGIN_PASSWORD,from=origin){return new Request(origin+'/auth/login',{method:'POST',headers:{Origin:from,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password})});}
async function cookie(){const response=await handleAuthentication(login(),env);assert.equal(response.status,303);return response.headers.get('Set-Cookie').split(';')[0];}

test('La navegación sin sesión llega al formulario; las APIs permanecen privadas',async()=>{
  const page=await worker.fetch(new Request(origin,{headers:{Accept:'text/html'}}),env);assert.equal(page.status,303);assert.equal(page.headers.get('Location'),'/auth/login');
  for(const path of ['/api/config','/api/sheets','/model.mjs'])assert.equal((await worker.fetch(new Request(origin+path),env)).status,401,path);
});
test('El formulario no necesita una conexión a Google ni una tarjeta',async()=>{
  const response=await worker.fetch(new Request(origin+'/auth/login'),env);assert.equal(response.status,200);assert.match(await response.text(),/name="password"/);
});
test('Una contraseña correcta crea una sesión segura de ocho horas',async()=>{
  const response=await handleAuthentication(login(),env),setCookie=response.headers.get('Set-Cookie');
  assert.equal(response.status,303);for(const flag of ['__Host-','HttpOnly','Secure','SameSite=Strict','Max-Age=28800'])assert(setCookie.includes(flag));
  const payload=await verifySession(new Request(origin,{headers:{Cookie:setCookie.split(';')[0]}}),env);assert.equal(payload.email,env.ALLOWED_EMAIL);assert.equal(payload.exp-payload.iat,28800);
});
test('Correo y contraseña se comprueban; no se revela cuál falló',async()=>{
  const a=await handleAuthentication(login('other@example.com'),env),b=await handleAuthentication(login(env.ALLOWED_EMAIL,'wrong'),env);
  assert.equal(a.status,401);assert.equal(b.status,401);assert.equal(await a.text(),await b.text());assert.equal(a.headers.get('Set-Cookie'),null);
});
test('Se rechazan inicios de sesión desde otro origen y exceso de intentos',async()=>{
  assert.equal((await handleAuthentication(login(env.ALLOWED_EMAIL,env.LOGIN_PASSWORD,'https://other.example'),env)).status,403);
  assert.equal((await handleAuthentication(login(),{...env,LOGIN_LIMITER:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await handleAuthentication(login(),{...env,LOGIN_LIMITER:undefined})).status,503);
});
test('Una sesión modificada, de otro sitio o anterior al cambio de contraseña no sirve',async()=>{
  const good=await cookie();
  await assert.rejects(()=>verifySession(new Request(origin,{headers:{Cookie:good.slice(0,-2)+'xx'}}),env));
  await assert.rejects(()=>verifySession(new Request('https://other.example',{headers:{Cookie:good}}),env));
  await assert.rejects(()=>verifySession(new Request(origin,{headers:{Cookie:good}}),{...env,LOGIN_PASSWORD:'Another-synthetic-password-456789'}));
});
test('La sesión permite servir la interfaz pero no inventa la configuración de Sheets',async()=>{
  const authCookie=await cookie(),authEnv={...env,ASSETS:{fetch:async()=>new Response('dashboard')}};
  const page=await worker.fetch(new Request(origin,{headers:{Cookie:authCookie}}),authEnv);assert.equal(page.status,200);assert.equal(await page.text(),'dashboard');assert.equal(page.headers.get('Cache-Control'),'private, no-store');
  const data=await worker.fetch(new Request(origin+'/api/config',{headers:{Cookie:authCookie}}),authEnv);assert.equal(data.status,503);
});
test('Cerrar sesión requiere el mismo origen y elimina la cookie',async()=>{
  assert.equal((await handleAuthentication(new Request(origin+'/auth/logout',{method:'POST'}),env)).status,403);
  const r=await handleAuthentication(new Request(origin+'/auth/logout',{method:'POST',headers:{Origin:origin}}),env);assert.equal(r.status,303);assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);
});
test('Cuerpos demasiado grandes se rechazan antes de procesar las credenciales',async()=>{
  const r=await handleAuthentication(login('test@example.com','x'.repeat(5000)),env);assert.equal(r.status,413);
});
