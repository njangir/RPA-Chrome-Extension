
// recorder.cs.js
(()=>{
  const C = window.__mvpCommon || {};
  const log = (...a)=> (C.log ? C.log('[recorder]', ...a) : console.log('[MVP][recorder]', ...a));
  let seedRow = null;
  if (window.__mvp_recorder_installed__) { log('already installed, skipping'); return; }
  window.__mvp_recorder_installed__ = true;
  log('attaching listeners… (frame url=' + location.href + ')');
  const listeners = [];

  function matchFromSeed(v){ try{ if(!seedRow) return {}; const s=String(v??'').trim(); if(Array.isArray(seedRow)){ const i=seedRow.findIndex(x => String(x??'').trim()===s); if(i>=0) return { placeholderIndex:i+1, matchedBy:'seedRow' }; } else if(seedRow && typeof seedRow==='object'){ for(const [k,val] of Object.entries(seedRow)){ if(String(val??'').trim()===s) return { placeholderKey:k, matchedBy:'seedRow' }; } } }catch{} return {}; }

  function sendStep(step){
    chrome.runtime.sendMessage({ type:'RECORDER_STEP', payload: step }, (resp)=>{ if(chrome.runtime.lastError) log('ERR send RECORDER_STEP', chrome.runtime.lastError.message); });
  }

  function onClick(e){ try{ const el=e.target; const step={ id: crypto.randomUUID(), type:'click', target: C.buildLocator(el), framePath: C.getFramePath(), timestamp: Date.now() }; log('record click', step.target.css); sendStep(step); }catch(err){ log('ERR onClick', err); } }
  function onChange(e){ try{ const el=e.target; if(!C.isTextInput(el)) return; const v = el.isContentEditable? el.innerText : el.value; let ph=C.inferPlaceholder(v); if(!ph.placeholderKey && !ph.placeholderIndex) ph = { ...ph, ...matchFromSeed(v) }; const step={ id: crypto.randomUUID(), type:'input', target:C.buildLocator(el), framePath:C.getFramePath(), originalTextSample:v, ...ph, timestamp: Date.now() }; log('record input', step.target.css); sendStep(step);}catch(err){ log('ERR onChange', err);} }

  // Shortcut (keydown) as before
  function onKeydown(e){ try{ const mod=(e.ctrlKey||e.metaKey)&&!e.altKey; if(!mod) return; const k=String(e.key||'').toLowerCase(); let action=null; if(k==='a') action='selectAll'; else if(k==='c') action='copy'; else if(k==='v') action='paste'; else if(k==='x') action='cut'; if(!action) return; const el=document.activeElement||e.target; const step={ id: crypto.randomUUID(), type:'shortcut', action, target:C.buildLocator(el instanceof Element? el : document.body), framePath:C.getFramePath(), timestamp: Date.now() }; log('record shortcut', action, step.target.css); sendStep(step);}catch(err){ log('ERR onKeydown', err);} }

  // Clipboard events capture text for export
  function activeSelectionText(){
    const el = document.activeElement;
    try{
      if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA')){
        const start=el.selectionStart||0, end=el.selectionEnd||0; return (el.value||'').slice(start,end);
      }
    }catch{}
    const sel = window.getSelection?.(); return sel?.toString?.() || '';
  }
  function onCopy(e){ try{ const text = activeSelectionText(); chrome.runtime.sendMessage({ type:'RECORDER_CLIP', payload:{ action:'copy', text, timestamp: Date.now() } }); }catch(err){ log('ERR onCopy', err);} }
  function onCut(e){ try{ const text = activeSelectionText(); chrome.runtime.sendMessage({ type:'RECORDER_CLIP', payload:{ action:'cut', text, timestamp: Date.now() } }); }catch(err){ log('ERR onCut', err);} }
  function onPaste(e){ try{ const text = e.clipboardData?.getData?.('text/plain') || ''; chrome.runtime.sendMessage({ type:'RECORDER_CLIP', payload:{ action:'paste', text, timestamp: Date.now() } }); }catch(err){ log('ERR onPaste', err);} }

  function addL(type, handler, capture=true){ document.addEventListener(type, handler, { capture }); listeners.push({ type, handler, capture }); }
  addL('click', onClick, true);
  addL('change', onChange, true);
  addL('input', onChange, true);
  addL('keydown', onKeydown, true);
  addL('copy', onCopy, true);
  addL('cut', onCut, true);
  addL('paste', onPaste, true);

  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (msg?.type === 'RECORDER_SEED') { seedRow = msg.seedRow || null; log('seed received', !!seedRow); send?.({ ok:true }); }
    if (msg?.type === 'RECORDER_STOP') { for(const l of listeners) document.removeEventListener(l.type, l.handler, { capture:l.capture }); window.__mvp_recorder_installed__ = false; log('stopped'); send?.({ ok:true }); }
  });
  log('ready');
})();
