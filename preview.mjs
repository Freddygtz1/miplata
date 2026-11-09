import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const files = {'/':'index.html','/index.html':'index.html','/app.mjs':'app.mjs','/model.mjs':'model.mjs','/styles.css':'styles.css','/blnk-theme.css':'blnk-theme.css','/connected.css':'connected.css'};
const types = {html:'text/html; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  res.setHeader('X-Content-Type-Options','nosniff');
  if(pathname==='/api/sheets'){
    res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({status:'not_configured',message:'Vista local del diseño. La conexión privada a Google Sheets requiere configurar el servidor de publicación.'}));
  }
  if(!['GET','HEAD'].includes(req.method)||!files[pathname]){res.writeHead(404);return res.end('Not found');}
  try{
    const name=files[pathname];const bytes=await readFile(new URL(name,import.meta.url));
    res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)]});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(500);res.end('No se pudo cargar el archivo.');}
}).listen(8765,'127.0.0.1',()=>console.log('Vista local: http://127.0.0.1:8765 — conexión de datos pendiente.'));
