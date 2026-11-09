import {readFile,writeFile,mkdir} from 'node:fs/promises';
const names=['index.html','app.mjs','model.mjs','styles.css','blnk-theme.css','connected.css'];
const types={html:'text/html; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
const assets={};
for(const name of names)assets['/'+name]={type:types[name.split('.').at(-1)],base64:(await readFile(new URL(name,import.meta.url))).toString('base64')};
const worker=await readFile(new URL('sites-worker.mjs',import.meta.url),'utf8');
await mkdir(new URL('dist/server/',import.meta.url),{recursive:true});
await writeFile(new URL('dist/server/index.js',import.meta.url),'const ASSETS='+JSON.stringify(assets)+';\n'+worker);
console.log('Worker generado en dist/server/index.js. Requiere configurar Sites y su conector antes de publicar.');
