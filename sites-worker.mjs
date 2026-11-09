const CONNECTOR='TU_CONNECTOR_ID';
const SPREADSHEET='TU_SPREADSHEET_ID';
const signIn='/signin-with-chatgpt?return_to=%2F';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function invoke(binding,action,args){
 try{const r=await binding.invoke(CONNECTOR,action,args);if(!r||typeof r.status!=='string'||(r.status==='success'&&(!r.result||r.result.isError||r.result.error)))return {status:'upstream_error',message:'Google Sheets no devolvió un resultado válido.'};return r;}
 catch{return {status:'upstream_error',message:'No se pudo consultar Google Sheets.'};}
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname==='/api/sheets'){
  if(request.method!=='POST')return json({status:'invalid_request',message:'Usa POST.'},405);
  if(request.headers.get('Origin')!==url.origin)return json({status:'invalid_request',message:'Origen no permitido.'},403);
  // The request-scoped connector binding enforces visitor identity, consent and source permissions.
  // Do not infer connector authorization from optional profile headers.
  const binding=ctx.props?.CONNECTORS;
  if(!binding)return json({status:'binding_unavailable',message:'La conexión de Google Sheets no está disponible para esta sesión. Usa Acceder para iniciar sesión y vuelve a actualizar. Si el problema continúa, revisa tu conexión de Google Drive en ChatGPT.'},503);
  const metadata=await invoke(binding,'get_spreadsheet_metadata',{spreadsheet_id:SPREADSHEET});
  if(metadata.status!=='success')return json({...metadata,...(metadata.status==='reauthentication_required'?{chatGPTSignInPath:signIn}:{})});
  const sheets=metadata.result.structuredContent?.sheets;
  const sizes=Object.fromEntries((sheets||[]).map(s=>[s.properties?.title,s.properties?.gridProperties?.rowCount]));
  if(!sizes.meta_diario||!sizes.bitacora||sizes.meta_diario>10000||sizes.bitacora>10000)return json({status:'tool_error',message:'Revisa las pestañas o el tamaño de la hoja.'},422);
  const read=(sheet,last)=>invoke(binding,'get_spreadsheet_range',{spreadsheet_id:SPREADSHEET,sheet_name:sheet,range:`A1:${last}${sizes[sheet]}`,value_render_option:'UNFORMATTED_VALUE'});
  const funnelRead=sizes.embudo_b2c&&sizes.embudo_b2c<=10000?read('embudo_b2c','J'):Promise.resolve({status:'tool_error',message:'La pestaña embudo_b2c no está disponible o supera el límite de lectura.'});
  const [meta,log,funnel]=await Promise.all([read('meta_diario','N'),read('bitacora','F'),funnelRead]);
  return json({status:meta.status==='success'?'success':meta.status,sources:{meta,log,funnel},checkedAt:new Date().toISOString(),...([meta,log,funnel].some(r=>r.status==='reauthentication_required')?{chatGPTSignInPath:signIn}:{})});
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=ASSETS[url.pathname==='/'?'/index.html':url.pathname];
 if(!asset)return new Response('Not found',{status:404});
 const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}};
