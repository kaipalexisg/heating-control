const TABS=['Settings','Readings','Purchases','Payments'];
function store(){const p=PropertiesService.getScriptProperties();let id=p.getProperty('SHEET_ID');if(!id){const s=SpreadsheetApp.create('Heating Control Data');id=s.getId();p.setProperty('SHEET_ID',id);}const ss=SpreadsheetApp.openById(id);for(const n of TABS){if(!ss.getSheetByName(n)){const sh=ss.insertSheet(n);sh.appendRow(n==='Settings'?['key','value']:n==='Readings'?['date','ground','first']:n==='Purchases'?['date','liters','unitPrice']:['date','floor','amount']);}}return ss;}
function doGet(e){
  if(e && e.parameter && e.parameter.mode==='snapshot'){
    const cb=String(e.parameter.callback||'');
    if(!/^hc_[A-Za-z0-9_]{1,60}$/.test(cb))return ContentService.createTextOutput('Invalid callback');
    const payload=JSON.stringify({ok:true,data:snapshot()}).replace(/</g,'\\u003c');
    return ContentService.createTextOutput(cb+'('+payload+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Heating Control').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function doPost(e){
  const q=(e&&e.parameter)||{};
  try{
    const real=PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
    if(!real || !q.pin || digest(String(q.pin))!==digest(String(real)))throw Error('Unauthorized');
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(15000))throw Error('Busy');
    try{
      const type=String(q.type||'');
      const data=JSON.parse(String(q.data||'{}'));
      const token=Utilities.getUuid();
      CacheService.getScriptCache().put('auth_'+digest(token),'1',60);
      put(token,type,data);
      return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
    }finally{lock.releaseLock();}
  }catch(err){return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err.message)})).setMimeType(ContentService.MimeType.JSON);}
}
function rows(sh){const a=sh.getDataRange().getValues();return a.slice(1).filter(r=>r.some(v=>v!==''));}
function snapshot(){const ss=store(),s=Object.fromEntries(rows(ss.getSheetByName('Settings')).map(r=>[r[0],r[1]]));return {settings:s,readings:rows(ss.getSheetByName('Readings')).map(r=>({date:String(r[0]),ground:Number(r[1]),first:Number(r[2])})),purchases:rows(ss.getSheetByName('Purchases')).map(r=>({date:String(r[0]),liters:Number(r[1]),unitPrice:Number(r[2])})),payments:rows(ss.getSheetByName('Payments')).map(r=>({date:String(r[0]),floor:String(r[1]),amount:Number(r[2])}))};}
function digest(s){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s);return Utilities.base64EncodeWebSafe(bytes);}
function login(pin){const p=PropertiesService.getScriptProperties(),real=p.getProperty('ADMIN_PIN');if(!real)throw Error('Ο διαχειριστής πρέπει πρώτα να ορίσει ADMIN_PIN στις Script Properties.');if(digest(String(pin))!==digest(real))throw Error('Λάθος PIN');const token=Utilities.getUuid()+Utilities.getUuid(),exp=Date.now()+12*3600*1000;CacheService.getScriptCache().put('auth_'+digest(token),'1',21600);return {token,expires:exp};}
function authorized(t){if(!t||!CacheService.getScriptCache().get('auth_'+digest(String(t))))throw Error('Απαιτείται PIN διαχειριστή');}
function put(token,type,data){authorized(token);const ss=store();if(type==='start'){if(rows(ss.getSheetByName('Readings')).length)throw Error('Η περίοδος έχει ήδη ξεκινήσει');const g=Number(data.ground),f=Number(data.first),stock=Number(data.stock);if(![g,f,stock].every(Number.isFinite)||Math.min(g,f,stock)<0)throw Error('Μη έγκυρες αρχικές τιμές');const sh=ss.getSheetByName('Settings');[['initialGround',g],['initialFirst',f],['initialStock',stock],['startDate',data.date]].forEach(r=>sh.appendRow(r));ss.getSheetByName('Readings').appendRow([data.date,g,f]);}else if(type==='reading'){const a=rows(ss.getSheetByName('Readings'));if(!a.length)throw Error('Πρώτα ξεκίνα περίοδο');const prev=a[a.length-1],g=Number(data.ground),f=Number(data.first);if(![g,f].every(Number.isFinite)||g<Number(prev[1])||f<Number(prev[2]))throw Error('Οι ενδείξεις δεν μπορούν να μειώνονται');ss.getSheetByName('Readings').appendRow([data.date,g,f]);}else if(type==='purchase'){const l=Number(data.liters),u=Number(data.unitPrice);if(![l,u].every(Number.isFinite)||l<=0||u<=0)throw Error('Χρειάζονται λίτρα και τιμή ανά λίτρο');ss.getSheetByName('Purchases').appendRow([data.date,l,u]);}else if(type==='payment'){const a=Number(data.amount);if(!Number.isFinite(a)||a<=0||!['ground','first'].includes(data.floor))throw Error('Μη έγκυρη πληρωμή');ss.getSheetByName('Payments').appendRow([data.date,data.floor,a]);}else if(type==='stock'){const v=Number(data.stock);if(!Number.isFinite(v)||v<0)throw Error('Μη έγκυρο υπόλοιπο');const sh=ss.getSheetByName('Settings');sh.appendRow(['stock_'+Date.now(),JSON.stringify({date:data.date,stock:v})]);}else throw Error('Άγνωστη ενέργεια');return snapshot();}
