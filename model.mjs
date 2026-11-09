export const SHEET_ID='TU_SPREADSHEET_ID';
export const SHEET_URL=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const accounts={B2B:'TU_CUENTA_B2B',B2C:'TU_CUENTA_B2C'};
export function isoDate(value){
 if(typeof value==='number')return new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10);
 const s=String(value??'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw new Error('Fecha no válida en Sheets.');
 return s;
}
export function parseMetrics(values){
 if(!Array.isArray(values)||values.length<1)throw new Error('No se recibió la tabla meta_diario.');
 const expected=['row_key','segment','account_id','campaign_id','campaign','date','spend','impressions','link_clicks','leads','installs','currency','actions_json','extracted_at'];
 if(expected.some((h,i)=>values[0][i]!==h))throw new Error('Cambió la estructura de meta_diario.');
 const keys=new Set();
 const number=(v,optional=false)=>{if(v===''||v==null){if(optional)return null;throw new Error('Métrica obligatoria vacía.');}const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error('Métrica no válida.');return n;};
 return values.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(r=>{
  const [key,segment,account,campaignId,campaign,date]=r;
  const day=isoDate(date);
  if(accounts[segment]!==String(account)||key!==`${account}|${campaignId}|${day}`||keys.has(key)||r[11]!=='USD'||typeof campaign!=='string')throw new Error('Revisa cuentas, moneda o filas duplicadas en Sheets.');
  keys.add(key);
  if(!Number.isFinite(Date.parse(r[13])))throw new Error('Falta la fecha de extracción.');
  return {key,segment,account:String(account),campaignId:String(campaignId),campaign,date:day,spend:number(r[6]),impressions:number(r[7]),clicks:number(r[8]),leads:number(r[9],true),installs:number(r[10],true),extractedAt:r[13]};
 });
}
export function parseLog(values){
 const expected=['fecha','segmento','campana','cambio','responsable','observacion'];
 if(!Array.isArray(values)||expected.some((h,i)=>values[0]?.[i]!==h))throw new Error('Cambió la estructura de bitacora.');
 return values.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(r=>({date:isoDate(r[0]),segment:r[1]||'',campaign:r[2]||'',change:String(r[3]||''),owner:String(r[4]||''),observation:String(r[5]||'')})).sort((a,b)=>b.date.localeCompare(a.date));
}
export function parseFunnel(values){
 const expected=['fecha','campana','vistas','descargas','registros','row_key','account_id','campaign_id','evento_registro','actualizado_en'];
 if(!Array.isArray(values)||expected.some((h,i)=>values[0]?.[i]!==h))throw new Error('Cambió la estructura de embudo_b2c.');
 const keys=new Set();
 const metric=(v,optional=false)=>{if(v===''||v==null){if(optional)return null;throw new Error('Faltan vistas en el embudo B2C.');}const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw new Error('Métrica inválida en el embudo B2C.');return n;};
 return values.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(r=>{
  const date=isoDate(r[0]),account=String(r[6]),campaignId=String(r[7]),key=r[5];
  if(account!==accounts.B2C||key!==`${account}|${campaignId}|${date}`||keys.has(key)||!campaignId||typeof r[1]!=='string')throw new Error('Cuenta o clave duplicada en embudo_b2c.');
  keys.add(key);
  const registrations=metric(r[4],true);
  if(registrations!==null&&r[8]!=='app_custom_event.fb_mobile_complete_registration')throw new Error('El evento de registro B2C no está validado.');
  if(!Number.isFinite(Date.parse(r[9])))throw new Error('Falta la fecha de extracción del embudo B2C.');
  return {key,date,account,campaignId,campaign:r[1],views:metric(r[2]),downloads:metric(r[3],true),registrations,extractedAt:r[9]};
 });
}
export function aggregateFunnel(rows){
 const totals={views:null,downloads:null,registrations:null};
 for(const row of rows)for(const field of Object.keys(totals))if(row[field]!==null)totals[field]=(totals[field]??0)+row[field];
 return totals;
}
export function registrationRate({downloads,registrations}){
 return downloads>0&&registrations!==null?100*registrations/downloads:null;
}
export function aggregate(rows){
 const result={spend:0,impressions:0,clicks:0,leads:null,installs:null};
 for(const r of rows){for(const k of ['spend','impressions','clicks'])result[k]+=r[k];for(const k of ['leads','installs'])if(r[k]!==null)result[k]=(result[k]??0)+r[k];}
 result.ctr=result.impressions?100*result.clicks/result.impressions:null;
 result.cpc=result.clicks?result.spend/result.clicks:null;
 result.cpm=result.impressions?1000*result.spend/result.impressions:null;
 return result;
}
export function periodStart(end,value){
 const d=new Date(end+'T00:00:00Z');
 if(value==='7'||value==='15')d.setUTCDate(d.getUTCDate()-Number(value)+1);
 else{const months=({'1m':1,'3m':3,'6m':6,'1y':12})[value];if(!months)return end;const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last)+1);}
 return d.toISOString().slice(0,10);
}
