let config;
try{
  const response=await fetch('/api/config',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('Configuración pendiente');
  config=await response.json();
}catch{
  config={sheetId:'',accounts:{B2B:'',B2C:''}};
}
export const SHEET_ID=config.sheetId;
export const ACCOUNTS=config.accounts;
