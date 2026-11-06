const TABS=['Settings','Readings','Purchases','Payments'];
const MAX_FAILS=5, FAIL_WINDOW_SEC=600, RID_TTL_SEC=21600;

function store(){const p=PropertiesService.getScriptProperties();let id=p.getProperty('SHEET_ID');if(!id){const s=SpreadsheetApp.create('Heating Control Data');id=s.getId();p.setProperty('SHEET_ID',id);}const ss=SpreadsheetApp.openById(id);for(const n of TABS){if(!ss.getSheetByName(n)){const sh=ss.insertSheet(n);sh.appendRow(n==='Settings'?['key','value']:n==='Readings'?['date','ground','first']:n==='Purchases'?['date','liters','unitPrice']:['date','floor','amount']);}}return ss;}

function json(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}

function doGet(e){
  if(e && e.parameter && e.parameter.mode==='snapshot'){
    const cb=String(e.parameter.callback||'');
    if(!/^hc_[A-Za-z0-9_]{1,60}$/.test(cb))return ContentService.createTextOutput('Invalid callback');
    let res;
    try{res={ok:true,data:snapshot()};}catch(err){res={ok:false,error:String(err.message)};}
    const payload=JSON.stringify(res).replace(/</g,'\\u003c');
    return ContentService.createTextOutput(cb+'('+payload+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  // Το αρχείο HTML «Index» δεν περιλαμβάνεται στο repo· αν λείπει, επιστρέφουμε καθαρό μήνυμα αντί για σφάλμα.
  try{return HtmlService.createHtmlOutputFromFile('Index').setTitle('Heating Control').addMetaTag('viewport','width=device-width, initial-scale=1');}
  catch(err){return ContentService.createTextOutput('Heating Control API. Δείτε το GitHub Pages frontend.');}
}

function doPost(e){
  const q=(e&&e.parameter)||{};
  try{
    const cache=CacheService.getScriptCache();
    const fails=Number(cache.get('pin_fails')||0);
    if(fails>=MAX_FAILS)throw Error('Locked');
    const real=PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
    if(!real || !q.pin || digest(String(q.pin))!==digest(String(real))){
      cache.put('pin_fails',String(fails+1),FAIL_WINDOW_SEC);
      throw Error('Unauthorized');
    }
    cache.remove('pin_fails');
    const type=String(q.type||'');
    if(type==='verify')return json({ok:true});
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(15000))throw Error('Busy');
    try{
      // Αποφυγή διπλών εγγραφών: το ίδιο αναγνωριστικό αιτήματος (rid) εφαρμόζεται μία μόνο φορά.
      const rid=String(q.rid||'');
      if(rid && !/^[A-Za-z0-9-]{8,64}$/.test(rid))throw Error('Μη έγκυρο αναγνωριστικό αιτήματος');
      if(rid && cache.get('rid_'+rid))return json({ok:true,duplicate:true});
      const data=JSON.parse(String(q.data||'{}'));
      put(type,data);
      if(rid)cache.put('rid_'+rid,'1',RID_TTL_SEC);
      return json({ok:true});
    }finally{lock.releaseLock();}
  }catch(err){return json({ok:false,error:String(err.message)});}
}

function rows(sh){const a=sh.getDataRange().getValues();return a.slice(1).filter(r=>r.some(v=>v!==''));}
function dateStr(v,tz){return v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v);}
function snapshot(){
  const ss=store(),tz=ss.getSpreadsheetTimeZone();
  const s=Object.fromEntries(rows(ss.getSheetByName('Settings')).map(r=>[r[0],r[1] instanceof Date?dateStr(r[1],tz):r[1]]));
  return {
    settings:s,
    readings:rows(ss.getSheetByName('Readings')).map(r=>({date:dateStr(r[0],tz),ground:Number(r[1]),first:Number(r[2])})),
    purchases:rows(ss.getSheetByName('Purchases')).map(r=>({date:dateStr(r[0],tz),liters:Number(r[1]),unitPrice:Number(r[2])})),
    payments:rows(ss.getSheetByName('Payments')).map(r=>({date:dateStr(r[0],tz),floor:String(r[1]),amount:Number(r[2])}))
  };
}
function digest(s){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s);return Utilities.base64EncodeWebSafe(bytes);}

function put(type,data){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date||'')))throw Error('Μη έγκυρη ημερομηνία');
  const ss=store();
  if(type==='start'){
    if(rows(ss.getSheetByName('Readings')).length)throw Error('Η περίοδος έχει ήδη ξεκινήσει');
    const g=Number(data.ground),f=Number(data.first);
    // Το αρχικό απόθεμα είναι προαιρετικό: αν λείπει, δεν καταγράφεται (δεν γίνεται 0).
    const hasStock=data.stock!==undefined && data.stock!==null && data.stock!=='';
    const stock=hasStock?Number(data.stock):null;
    if(![g,f].every(Number.isFinite)||Math.min(g,f)<0||(hasStock&&(!Number.isFinite(stock)||stock<0)))throw Error('Μη έγκυρες αρχικές τιμές');
    const sh=ss.getSheetByName('Settings');
    const settings=[['initialGround',g],['initialFirst',f],['startDate',data.date]];
    if(hasStock)settings.push(['initialStock',stock]);
    settings.forEach(r=>sh.appendRow(r));
    ss.getSheetByName('Readings').appendRow([data.date,g,f]);
  }else if(type==='reading'){
    const a=rows(ss.getSheetByName('Readings'));
    if(!a.length)throw Error('Πρώτα ξεκίνα περίοδο');
    const prev=a[a.length-1],g=Number(data.ground),f=Number(data.first);
    if(![g,f].every(Number.isFinite)||g<Number(prev[1])||f<Number(prev[2]))throw Error('Οι ενδείξεις δεν μπορούν να μειώνονται');
    ss.getSheetByName('Readings').appendRow([data.date,g,f]);
  }else if(type==='purchase'){
    const l=Number(data.liters),u=Number(data.unitPrice);
    if(![l,u].every(Number.isFinite)||l<=0||u<=0)throw Error('Χρειάζονται λίτρα και τιμή ανά λίτρο');
    ss.getSheetByName('Purchases').appendRow([data.date,l,u]);
  }else if(type==='payment'){
    const a=Number(data.amount);
    if(!Number.isFinite(a)||a<=0||!['ground','first'].includes(data.floor))throw Error('Μη έγκυρη πληρωμή');
    ss.getSheetByName('Payments').appendRow([data.date,data.floor,a]);
  }else if(type==='stock'){
    const v=Number(data.stock);
    if(!Number.isFinite(v)||v<0)throw Error('Μη έγκυρο υπόλοιπο');
    ss.getSheetByName('Settings').appendRow(['stock_'+Date.now(),JSON.stringify({date:data.date,stock:v})]);
  }else throw Error('Άγνωστη ενέργεια');
}
