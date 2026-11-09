import {parseMetrics,parseLog,parseFunnel,aggregateFunnel,registrationRate,aggregate,periodStart,SHEET_URL} from './model.mjs';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const int=v=>v==null?'N/D':new Intl.NumberFormat('es-MX').format(v);
const money=v=>v==null?'N/D':'US$ '+new Intl.NumberFormat('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const pct=v=>v==null?'N/D':v.toFixed(2)+'%';
const date=v=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'));
const timestamp=v=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Mexico_City'}).format(new Date(v));
let metrics=[],logs=[],funnelRows=[],segment='Todos',loaded=false,logLoaded=false,funnelLoaded=false,busy=false,lastChecked=null,logError='',funnelError='';
$('sheet-link').href=SHEET_URL+'#gid=1014401736';$('source-sheet').href=SHEET_URL;
const selected=()=>metrics.filter(r=>(segment==='Todos'||segment===r.segment)&&r.date>=$('from').value&&r.date<=$('to').value);
const card=(label,value,note)=>`<article><p>${esc(label)}</p><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
function render(){
 const from=$('from').value,to=$('to').value,invalid=!!(from&&to&&from>to);
 $('error').hidden=!invalid;$('error').textContent='La fecha inicial debe ser anterior o igual a la fecha final.';
 const rows=invalid?[]:selected(),all=aggregate(rows),b2b=aggregate(rows.filter(r=>r.segment==='B2B')),b2c=aggregate(rows.filter(r=>r.segment==='B2C'));
 const range=from&&to?date(from)+' — '+date(to):'Periodo pendiente';
 const available=metrics.filter(r=>segment==='Todos'||r.segment===segment).map(r=>r.date).sort();
 $('scope').textContent=(segment==='Todos'?'B2B y B2C':segment)+' · '+range+(available.length?' · Último día con datos: '+date(available.at(-1)):'');
 $('meta-period').textContent='META ADS · USD · '+(loaded?'GOOGLE SHEETS':'CONEXIÓN PENDIENTE');
 const has=rows.length>0;
 const cards=[card('Inversión publicitaria',has?money(all.spend):'N/D','Importes en USD'),card('Impresiones',has?int(all.impressions):'N/D','Exposiciones de los anuncios')];
 if(segment==='B2B')cards.push(card('Leads de Meta',int(b2b.leads),'Eventos atribuidos · B2B'),card('CPL de Meta',money(b2b.leads?b2b.spend/b2b.leads:null),'Inversión B2B / leads Meta'));
 else if(segment==='B2C')cards.push(card('Instalaciones de Meta',int(b2c.installs),'Eventos atribuidos · B2C'),card('Costo por instalación',money(b2c.installs?b2c.spend/b2c.installs:null),'Inversión B2C / instalaciones Meta'));
 else cards.push(card('Leads de Meta · B2B',int(b2b.leads),'Eventos atribuidos, sin conciliación CRM'),card('Instalaciones Meta · B2C',int(b2c.installs),'Eventos atribuidos, no usuarios únicos'));
 $('kpis').innerHTML=cards.join('');
 $('flows').innerHTML=['B2B','B2C'].filter(s=>segment==='Todos'||segment===s).map(s=>{
  const group=rows.filter(r=>r.segment===s),a=aggregate(group),exists=group.length>0;
  const stages=[['Inversión',exists?money(a.spend):'N/D','USD'],['Impresiones',exists?int(a.impressions):'N/D','Meta Ads'],['Clics de enlace',exists?int(a.clicks):'N/D','Meta Ads'],['CTR',pct(a.ctr),'Clics / impresiones'],['CPC',money(a.cpc),'Inversión / clics'],['CPM',money(a.cpm),'Costo por 1,000 impresiones'],s==='B2B'?['Leads de Meta',int(a.leads),'Eventos atribuidos']:['Instalaciones de Meta',int(a.installs),'Eventos atribuidos'],s==='B2B'?['Empresas activadas','N/D','CRM pendiente']:['Primer depósito','N/D','App pendiente']];
  return `<article class="flow"><div class="flow-header"><div><h3>${s==='B2B'?'Empresas · B2B':'Personas · B2C'}</h3><p>Cuenta Meta: ${s==='B2B'?'TU_CUENTA_B2B':'TU_CUENTA_B2C'}</p></div><span class="route-label">${s==='B2B'?'Adquisición empresarial':'Adquisición de usuarios'}</span></div><div class="stages">${stages.map(([l,v,n])=>`<div class="stage"><h4>${l}</h4><strong>${esc(v)}</strong><small>${n}</small></div>`).join('')}</div><p class="flow-foot">${s==='B2B'?'Los leads no equivalen a empresas activadas.':'Las instalaciones no equivalen a usuarios con cuenta, KYC o depósito.'}</p></article>`;
 }).join('');
 const previous=$('campaign').value,campaigns=[...new Map(rows.map(r=>[r.account+'|'+r.campaignId,r.campaign])).entries()];
 $('campaign').innerHTML='<option value="">Todas</option>'+campaigns.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
 if(campaigns.some(([id])=>id===previous))$('campaign').value=previous;
 renderCampaigns(rows);renderLog(invalid);renderTrend(rows);renderFunnel(invalid);
}
function renderFunnel(invalid=false){
 $('b2c-funnel').hidden=segment==='B2B';
 const rows=invalid?[]:funnelRows.filter(r=>r.date>=$('from').value&&r.date<=$('to').value);
 const totals=aggregateFunnel(rows);
 const cards=[['Vistas',totals.views,'Impresiones de los anuncios'],['Descargas',totals.downloads,'Instalaciones atribuidas por Meta'],['Registros',totals.registrations,'Registro completo en la app']];
 $('funnel-steps').innerHTML=cards.map(([name,value,note])=>`<article class="funnel-step"><p>${name}</p><strong>${int(value)}</strong><small>${note}</small></article>`).join('');
 const rate=registrationRate(totals);
 $('funnel-conversion').innerHTML=`<div><p>Tasa de registro</p><strong>${pct(rate)}</strong></div><p>Registros ÷ descargas × 100${rate===null?' · Sin datos suficientes para calcular.':` · ${int(totals.registrations)} registros / ${int(totals.downloads)} descargas`}<small>Relación entre eventos atribuidos del periodo; no es seguimiento individual de cada usuario.</small></p>`;
 const extraction=funnelRows.map(r=>r.extractedAt).sort().at(-1),lastDay=funnelRows.map(r=>r.date).sort().at(-1);
 $('funnel-status').textContent=funnelError||(funnelLoaded?(rows.length?`Carga de n8n: ${timestamp(extraction)} · Datos hasta ${date(lastDay)} · ${rows.length} filas del periodo.`:'No hay filas del embudo B2C para el periodo seleccionado.'):'El embudo B2C está pendiente de consultar Google Sheets.');
 if(extraction&&!funnelError&&Date.now()-Date.parse(extraction)>36*3600000)$('funnel-status').textContent+=' La carga tiene más de 36 horas.';
 const groups=new Map();for(const r of rows){if(!groups.has(r.campaignId))groups.set(r.campaignId,[]);groups.get(r.campaignId).push(r);}
 $('funnel-campaigns').innerHTML=groups.size?[...groups.values()].map(group=>{const a=aggregateFunnel(group);return `<tr><td>${esc(group[0].campaign)}</td><td>${int(a.views)}</td><td>${int(a.downloads)}</td><td>${int(a.registrations)}</td><td>${pct(registrationRate(a))}</td></tr>`;}).join(''):'<tr><td colspan="5">Sin datos del embudo para estos filtros.</td></tr>';
}
function renderCampaigns(rows=selected()){
 if($('from').value>$('to').value)rows=[];
 const groups=new Map();for(const r of rows){const key=r.account+'|'+r.campaignId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const sorted=[...groups].filter(([key])=>!$('campaign').value||$('campaign').value===key).map(([key,r])=>({key,r,a:aggregate(r)})).sort((a,b)=>b.a.spend-a.a.spend);
 $('campaign-rows').innerHTML=sorted.length?sorted.map(({r,a})=>`<tr><td><strong>${r[0].segment}</strong><small>${esc(r[0].campaign)}</small></td><td>${money(a.spend)}</td><td>${int(a.impressions)}</td><td>${int(a.clicks)}</td><td>${pct(a.ctr)}</td><td>${money(a.cpc)}</td><td>${int(a.leads)}</td><td>${int(a.installs)}</td></tr>`).join(''):'<tr><td colspan="8">'+(loaded?'No hay filas para el periodo y segmento seleccionados.':'Conecta Google Sheets para ver tus campañas.')+'</td></tr>';
 $('table-count').textContent=sorted.length+' campañas · '+sorted.reduce((n,g)=>n+g.r.length,0)+' filas diarias de origen';
}
function renderLog(invalid=false){
 const rows=invalid?[]:logs.filter(r=>r.date>=$('from').value&&r.date<=$('to').value&&(segment==='Todos'||r.segment.toUpperCase().includes(segment)||!r.segment||/todas|todos/i.test(r.segment)));
 $('log-rows').innerHTML=rows.length?rows.map(r=>`<tr><td>${date(r.date)}</td><td>${esc(r.segment||'Todos')}<small>${esc(r.campaign)}</small></td><td>${esc(r.change)}</td><td>${esc(r.owner||'—')}</td><td>${esc(r.observation||'—')}</td></tr>`).join(''):'<tr><td colspan="5">'+(logLoaded?'No hay cambios registrados para estos filtros.':'La bitácora todavía no se ha cargado.')+'</td></tr>';
 $('log-status').textContent=logError||(logLoaded?rows.length+' cambios visibles · Fuente: pestaña bitacora':'Conexión pendiente');
}
function renderTrend(rows){
 if(!rows.length){$('trend').innerHTML='<p class="empty">Sin datos para este periodo.</p>';return;}
 const days=[...new Set(rows.map(r=>r.date))].sort(),totals=new Map();for(const r of rows){const k=r.date+'|'+r.segment;totals.set(k,(totals.get(k)||0)+r.spend);}
 const max=Math.max(...totals.values(),1),x=i=>55+(days.length===1?400:800*i/(days.length-1)),y=v=>215-175*v/max;
 let svg='<svg viewBox="0 0 890 260" role="img" aria-label="Inversión diaria en USD por segmento"><title>Inversión diaria en USD</title>';
 for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);svg+=`<line x1="55" y1="${yy}" x2="855" y2="${yy}" stroke="#e7e7e7"/><text x="47" y="${yy+4}" text-anchor="end">${v.toFixed(0)}</text>`;}
 for(const s of ['B2B','B2C'].filter(s=>segment==='Todos'||segment===s)){
  let path='',previous=-2;days.forEach((d,i)=>{if(totals.has(d+'|'+s)){path+=(previous===i-1?'L':'M')+x(i)+','+y(totals.get(d+'|'+s));previous=i;}});
  const color=s==='B2B'?'#c60517':'#353535';svg+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
  days.forEach((d,i)=>{const v=totals.get(d+'|'+s);if(v!==undefined)svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="${days.length>60?1.5:3}" fill="${color}"><title>${s} · ${d} · ${money(v)}</title></circle>`;});
 }
 [...new Set([0,Math.floor((days.length-1)/2),days.length-1])].forEach(i=>{svg+=`<text x="${x(i)}" y="245" text-anchor="middle">${days[i]}</text>`;});
 $('trend').innerHTML=svg+'</svg>';
}
function setPeriod(){if($('period').value!=='custom'&&$('to').value)$('from').value=periodStart($('to').value,$('period').value);render();}
function navigate(view){if(!['resumen','operacion','bitacora','fuentes'].includes(view))view='resumen';document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==view);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('title').textContent=({resumen:'KPIs relevantes',operacion:'Campañas',bitacora:'Bitácora de cambios',fuentes:'Fuentes y medición'})[view];history.replaceState(null,'','#'+view);}
function connect(error,href){if(error.status==='reauthentication_required'&&href?.startsWith('/signin-with-chatgpt?')){$('connect').href=href;$('connect').hidden=false;}}
async function refresh(){
 if(busy)return;busy=true;$('refresh-data').disabled=true;$('refresh-data').textContent='Actualizando…';$('refresh-data').setAttribute('aria-busy','true');$('refresh-status').textContent='Consultando Google Sheets…';$('connect').hidden=true;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
 try{
  const response=await fetch('/api/sheets',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store',signal:controller.signal});
  const data=await response.json();
  if(data.status!=='success'){connect(data,data.chatGPTSignInPath);const failed=data.sources?.meta;if(failed)connect(failed,data.chatGPTSignInPath);throw new Error(failed?.message||data.message||'No se pudo leer la hoja de marketing.');}
  const meta=data.sources?.meta;if(meta?.status!=='success')throw new Error('La hoja de marketing no confirmó una lectura válida.');
  const next=parseMetrics(meta.result?.structuredContent?.values),wasLoaded=loaded;metrics=next;loaded=true;lastChecked=data.checkedAt;
  const log=data.sources?.log;logError='';
  if(log?.status==='success'){try{logs=parseLog(log.result?.structuredContent?.values);logLoaded=true;}catch(e){logError=e.message+' Se conserva la última bitácora de esta sesión.';}}
  else{logError='No se pudo actualizar la bitácora. '+(log?.message||'');connect(log||{},data.chatGPTSignInPath);}
  const funnel=data.sources?.funnel;funnelError='';
  if(funnel?.status==='success'){try{funnelRows=parseFunnel(funnel.result?.structuredContent?.values);funnelLoaded=true;}catch(e){funnelError=e.message+' Se conserva la última carga válida de esta sesión.';}}
  else{funnelError='No se pudo actualizar el embudo B2C. '+(funnel?.message||'')+(funnelLoaded?' Se conserva la última carga válida de esta sesión.':'');connect(funnel||{},data.chatGPTSignInPath);}
  const days=metrics.map(r=>r.date).sort();if(!wasLoaded&&days.length){$('to').value=days.at(-1);$('from').value=periodStart(days.at(-1),$('period').value);}
  const extraction=metrics.map(r=>r.extractedAt).sort().at(-1);
  const stale=extraction&&Date.now()-Date.parse(extraction)>36*3600000;
  $('extracted').textContent=extraction?timestamp(extraction):'Sin filas';
  $('connection-status').textContent=stale?'Carga de origen antigua':'Google Sheets conectado';
  $('refresh-status').textContent=(extraction?'Última carga de n8n: '+timestamp(extraction)+'. ':'')+'Consulta del dashboard: '+timestamp(lastChecked)+'.'+(stale?' La carga de origen tiene más de 36 horas.':'')+(logError?' La bitácora requiere revisión.':'');
  $('footer-update').textContent='Consulta · '+timestamp(lastChecked);render();
 }catch(e){$('connection-status').textContent=loaded?'Datos sin actualizar':'Conexión pendiente';$('refresh-status').textContent=(e.name==='AbortError'?'La consulta tardó demasiado.':e.message)+(loaded?' Se conservan los datos anteriores de esta sesión.':'');funnelError='No se pudo actualizar el embudo B2C.'+(funnelLoaded?' Se conserva la última carga válida de esta sesión.':'');renderFunnel($('from').value>$('to').value);}
 finally{clearTimeout(timer);busy=false;$('refresh-data').disabled=false;$('refresh-data').textContent='Actualizar datos';$('refresh-data').removeAttribute('aria-busy');}
}
$('refresh-data').addEventListener('click',refresh);$('campaign').addEventListener('change',()=>renderCampaigns());$('period').addEventListener('change',setPeriod);
for(const id of ['from','to'])$(id).addEventListener('change',()=>{$('period').value='custom';render();});
for(const b of document.querySelectorAll('[data-segment]'))b.addEventListener('click',()=>{segment=b.dataset.segment;document.querySelectorAll('[data-segment]').forEach(x=>x.classList.toggle('selected',x===b));render();});
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>navigate(b.dataset.view));
let lastVisible=Date.now();setInterval(()=>{if(document.visibilityState==='visible')refresh();},15*60*1000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')lastVisible=Date.now();else if(Date.now()-lastVisible>=15*60*1000)refresh();});
render();navigate(location.hash.slice(1));refresh();
