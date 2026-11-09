import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import worker,{verifyAccess,readDashboard} from './cloudflare-worker.mjs';

const env={ACCESS_TEAM_DOMAIN:'https://example.cloudflareaccess.com',ACCESS_AUD:'miplata-test',GOOGLE_SHEET_ID:'test-sheet',GOOGLE_CLIENT_EMAIL:'test@example.iam.gserviceaccount.com',GOOGLE_PRIVATE_KEY:'test-only',META_B2B_ACCOUNT_ID:'111',META_B2C_ACCOUNT_ID:'222'};
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk=await exportJWK(publicKey);jwk.kid='test';
const keys=createLocalJWKSet({keys:[jwk]});
const sign=(aud=env.ACCESS_AUD,expires='5m')=>new SignJWT({email:'client@example.com'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(aud).setSubject('client').setIssuedAt().setExpirationTime(expires).sign(privateKey);
const request=token=>new Request('https://dashboard.example/',{headers:token?{'cf-access-jwt-assertion':token}:{}});

test('Access acepta una sesión firmada para esta aplicación',async()=>assert.equal((await verifyAccess(request(await sign()),env,keys)).email,'client@example.com'));
test('Access rechaza sesiones de otra aplicación y sesiones vencidas',async()=>{
  await assert.rejects(()=>verifyAccess(request(awaitTokenWrong),env,keys));
  await assert.rejects(()=>verifyAccess(request(awaitTokenExpired),env,keys));
});
const awaitTokenWrong=await sign('another-app');
const awaitTokenExpired=await sign(env.ACCESS_AUD,'-1m');

test('Un correo en un encabezado no sustituye la firma de Access',async()=>{
  const r=await worker.fetch(new Request('https://dashboard.example/api/sheets',{method:'POST',headers:{'cf-access-authenticated-user-email':'client@example.com',Origin:'https://dashboard.example'}}),env);
  assert.equal(r.status,403);assert.equal(r.headers.get('cache-control'),'private, no-store');
});
test('La interfaz y la configuración también requieren autenticación',async()=>{
  for(const path of ['/','/index.html','/model.mjs','/api/config']){
    const r=await worker.fetch(new Request('https://dashboard.example'+path),env);
    assert.equal(r.status,403,path);
  }
});
test('Configuración incompleta bloquea la lectura sin realizar solicitudes',async()=>{
  const r=await readDashboard({},()=>{throw Error('No debe consultar Google');});assert.equal(r.status,503);
});
test('Una pestaña faltante no impide leer las métricas disponibles',async()=>{
  const seen=[];
  const transport=async(url,options)=>{
    seen.push(url);assert.equal(options.headers.Authorization,'Bearer test-token');
    if(url.includes('?fields='))return Response.json({sheets:[{properties:{title:'meta_diario',gridProperties:{rowCount:10}}},{properties:{title:'bitacora',gridProperties:{rowCount:10}}}]});
    return Response.json({values:[['header'],['value']]});
  };
  const r=await readDashboard(env,transport,async()=>'test-token'),data=await r.json();
  assert.equal(data.status,'success');assert.equal(data.sources.meta.status,'success');assert.equal(data.sources.funnel.status,'tool_error');
  assert.equal(seen.length,3);assert(seen.every(url=>url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/test-sheet')));
});
test('No se truncan hojas que exceden el límite de filas',async()=>{
  let calls=0;
  const transport=async()=>{calls++;return Response.json({sheets:[{properties:{title:'meta_diario',gridProperties:{rowCount:10001}}}]});};
  const data=await(await readDashboard(env,transport,async()=>'test-token')).json();assert.equal(data.status,'tool_error');assert.equal(calls,1);
});
