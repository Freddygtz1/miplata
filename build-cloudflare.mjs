import {mkdir,copyFile} from 'node:fs/promises';
const files=['index.html','app.mjs','model.mjs','config.mjs','styles.css','blnk-theme.css','connected.css'];
await mkdir(new URL('dist/public/',import.meta.url),{recursive:true});
for(const file of files)await copyFile(new URL(file,import.meta.url),new URL('dist/public/'+file,import.meta.url));
console.log('Frontend preparado para Cloudflare Workers. El servidor bloquea el acceso si falta configurar Access.');
