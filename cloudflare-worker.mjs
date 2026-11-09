import {createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8} from 'jose';

const remoteKeys = new Map();
let googleCache;
const noStore = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json = (body,status=200)=>Response.json(body,{status,headers:noStore});

export async function verifyAccess(request,env,keySet){
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||'') || !env.ACCESS_AUD) throw Error('Access no configurado');
  const token=request.headers.get('cf-access-jwt-assertion');
  if(!token || token.length>16384)throw Error('Sesión requerida');
  if(!keySet){
    if(!remoteKeys.has(env.ACCESS_TEAM_DOMAIN))remoteKeys.set(env.ACCESS_TEAM_DOMAIN,createRemoteJWKSet(new URL(env.ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs')));
    keySet=remoteKeys.get(env.ACCESS_TEAM_DOMAIN);
  }
  const {payload}=await jwtVerify(token,keySet,{issuer:env.ACCESS_TEAM_DOMAIN,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email']});
  if(typeof payload.email!=='string'||!payload.email.includes('@'))throw Error('Identidad requerida');
  return payload;
}

async function googleToken(env){
  if(googleCache?.email===env.GOOGLE_CLIENT_EMAIL && googleCache.key===env.GOOGLE_PRIVATE_KEY && googleCache.until>Date.now())return googleCache.token;
  const key=await importPKCS8(env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),'RS256');
  const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/spreadsheets.readonly'})
    .setProtectedHeader({alg:'RS256',typ:'JWT'}).setIssuer(env.GOOGLE_CLIENT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Google no autorizó la lectura');
  const data=await response.json();
  if(typeof data.access_token!=='string'||!Number.isFinite(data.expires_in))throw Error('Autorización inválida');
  googleCache={email:env.GOOGLE_CLIENT_EMAIL,key:env.GOOGLE_PRIVATE_KEY,token:data.access_token,until:Date.now()+Math.max(0,data.expires_in-120)*1000};
  return data.access_token;
}

export async function readDashboard(env,transport=fetch,tokenProvider=googleToken){
  if(!/^[\w-]+$/.test(env.GOOGLE_SHEET_ID||'')||!env.GOOGLE_CLIENT_EMAIL||!env.GOOGLE_PRIVATE_KEY||!/^\d+$/.test(env.META_B2B_ACCOUNT_ID||'')||!/^\d+$/.test(env.META_B2C_ACCOUNT_ID||''))return json({status:'not_configured',message:'La conexión privada a Sheets todavía no está configurada.'},503);
  try{
    const token=await tokenProvider(env),base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(env.GOOGLE_SHEET_ID);
    const headers={Authorization:'Bearer '+token};
    const metadata=await transport(base+'?fields=sheets(properties(title,gridProperties(rowCount)))',{headers,signal:AbortSignal.timeout(20000)});
    if(!metadata.ok)throw Error('No se pudo abrir la hoja');
    const sheetData=await metadata.json();
    const sizes=Object.fromEntries((sheetData.sheets||[]).map(s=>[s.properties?.title,s.properties?.gridProperties?.rowCount]));
    const read=async(name,last)=>{
      if(!Number.isSafeInteger(sizes[name])||sizes[name]<1||sizes[name]>10000)return {status:'tool_error',message:'Revisa la pestaña '+name+' y su límite de 10 000 filas.'};
      try{
        const range=encodeURIComponent(name+'!A1:'+last+sizes[name]);
        const r=await transport(base+'/values/'+range+'?valueRenderOption=UNFORMATTED_VALUE',{headers,signal:AbortSignal.timeout(20000)});
        if(!r.ok)throw Error('Lectura fallida');
        const data=await r.json();
        return {status:'success',result:{structuredContent:{values:data.values||[]}}};
      }catch{return {status:'upstream_error',message:'No se pudo leer '+name+'. Vuelve a actualizar.'};}
    };
    const [meta,log,funnel]=await Promise.all([read('meta_diario','N'),read('bitacora','F'),read('embudo_b2c','J')]);
    return json({status:meta.status==='success'?'success':meta.status,sources:{meta,log,funnel},checkedAt:new Date().toISOString()});
  }catch{return json({status:'upstream_error',message:'No se pudo consultar Google Sheets. Revisa el acceso de lectura de la cuenta de servicio.'},502);}
}

export default {async fetch(request,env){
  try{await verifyAccess(request,env);}catch{return json({status:'authentication_required',message:'Inicia sesión con un correo autorizado para consultar el dashboard.'},403);}
  const url=new URL(request.url);
  if(url.pathname==='/api/sheets'){
    if(request.method!=='POST')return json({status:'invalid_request',message:'Usa Actualizar datos.'},405);
    if(request.headers.get('Origin')!==url.origin)return json({status:'invalid_request',message:'Origen no permitido.'},403);
    return readDashboard(env);
  }
  if(url.pathname==='/api/config'){
    if(request.method!=='GET')return json({status:'invalid_request'},405);
    if(!env.GOOGLE_SHEET_ID||!env.META_B2B_ACCOUNT_ID||!env.META_B2C_ACCOUNT_ID)return json({status:'not_configured',message:'Falta configurar las cuentas y la hoja en el servidor.'},503);
    return json({sheetId:env.GOOGLE_SHEET_ID,accounts:{B2B:env.META_B2B_ACCOUNT_ID,B2C:env.META_B2C_ACCOUNT_ID}});
  }
  if(url.pathname.startsWith('/api/'))return json({status:'not_found'},404);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:noStore});
  const asset=await env.ASSETS.fetch(request);
  const response=new Response(asset.body,asset);
  for(const [name,value]of Object.entries(noStore))response.headers.set(name,value);
  response.headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return response;
}};
