
// sw.js
let stepsByTab = new Map();          // tabId -> steps[]
let clipsByTab = new Map();          // tabId -> clips[]
let seedRowByTab = new Map();
let pendingContinueResolve = null;
let aborted = false;
const recordingTabs = new Set();
function slog(...a){ console.log('[MVP][sw]', ...a); }

chrome.runtime.onInstalled.addListener(async () => {
  try { await chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }); }
  catch (e) { slog('setPanelBehavior fail', e?.message); }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab?.id) {
      await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'panel.html', enabled: true });
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (e) { slog('action onClicked open failed', e?.message); }
});

// Helper: build framePath (array of {frameId, url}) using webNavigation
async function buildFramePath(tabId, leafFrameId){
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const byId = new Map(frames.map(f => [f.frameId, f]));
    const path = [];
    let cur = byId.get(leafFrameId);
    while (cur){
      path.unshift({ frameId: cur.frameId, url: cur.url, parentFrameId: cur.parentFrameId });
      if (cur.parentFrameId === -1) break;
      cur = byId.get(cur.parentFrameId);
    }
    return path;
  } catch (e) {
    slog('buildFramePath fail', e?.message);
    return [{ frameId: leafFrameId, url: undefined }];
  }
}

// Helper: resolve frameId at playback time from recorded framePath
async function resolveFrameIdFromPath(tabId, framePath){
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    // Try exact url matches from root to leaf
    let candidates = frames.filter(f => f.parentFrameId === -1);
    for (let i = 0; i < framePath.length; i++){
      const targetUrl = framePath[i]?.url;
      if (!targetUrl){ // if unknown, pick any child that continues chain
        const nextLevel = [];
        for (const c of candidates){
          const children = frames.filter(f => f.parentFrameId === c.frameId);
          nextLevel.push(...children);
        }
        candidates = nextLevel.length ? nextLevel : candidates;
        continue;
      }
      const nextLevel = [];
      for (const c of candidates){
        const children = frames.filter(f => f.parentFrameId === c.frameId && (f.url === targetUrl || f.url.startsWith(targetUrl.split('#')[0])));
        nextLevel.push(...children);
      }
      if (nextLevel.length) candidates = nextLevel;
      else break;
    }
    // If we found an exact leaf match, return it; else fallback to last recorded frameId if present in frames
    if (candidates.length === 1) return candidates[0].frameId;
    const leafId = framePath?.[framePath.length-1]?.frameId ?? 0;
    if (frames.some(f => f.frameId === leafId)) return leafId;
    return 0; // top frame fallback
  } catch (e) {
    slog('resolveFrameIdFromPath fail', e?.message);
    return framePath?.[framePath.length-1]?.frameId ?? 0;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  (async () => {
    if (msg?.type === 'RECORDER_STEP' && sender.tab){
      const tabId = sender.tab.id;
      if (!stepsByTab.has(tabId)) stepsByTab.set(tabId, []);
      const framePath = await buildFramePath(tabId, sender.frameId ?? 0);
      const step = { ...msg.payload, frameId: sender.frameId ?? 0, framePath };
      stepsByTab.get(tabId).push(step);
      slog('RECORDER_STEP', tabId, step.type, step.target?.css, 'frameId=', step.frameId);
      return send?.({ ok: true });
    }
    if (msg?.type === 'RECORDER_CLIP' && sender.tab){
      const tabId = sender.tab.id;
      if (!clipsByTab.has(tabId)) clipsByTab.set(tabId, []);
      const framePath = await buildFramePath(tabId, sender.frameId ?? 0);
      const frameUrl = framePath?.[framePath.length-1]?.url;
      clipsByTab.get(tabId).push({ ...msg.payload, frameUrl });
      return send?.({ ok: true});
    }
  })().catch(e => slog('onMessage ERR', e));
});

async function getActiveTab(){ const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return tab; }

async function startRecording(seedRow){
  const tab = await getActiveTab(); if (!tab) throw new Error('No active tab');
  stepsByTab.set(tab.id, []); clipsByTab.set(tab.id, []);
  seedRowByTab.set(tab.id, seedRow || null);
  recordingTabs.add(tab.id);
  await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['common.js', 'recorder.cs.js'], world: 'ISOLATED' });
}

async function stopRecording(){
  const tab = await getActiveTab(); if (!tab) return [];
  recordingTabs.delete(tab.id);
  try { const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
        for (const f of frames || []) { try { await chrome.tabs.sendMessage(tab.id, { type: 'RECORDER_STOP' }, { frameId: f.frameId }); } catch {} } }
  catch {}
  // Persist last flow
  const steps = stepsByTab.get(tab.id) || [];
  await chrome.storage.local.set({ lastFlow: { when: Date.now(), url: tab.url, steps } });
  return steps;
}

// Reinjection for dynamic frames while recording
chrome.webNavigation.onCommitted.addListener(async ({tabId, frameId}) => {
  if (!recordingTabs.has(tabId)) return;
  try { await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['common.js','recorder.cs.js'], world: 'ISOLATED' }); }
  catch (e) { slog('reinjection onCommitted fail', e?.message); }
});
chrome.webNavigation.onDOMContentLoaded.addListener(async ({tabId, frameId}) => {
  if (!recordingTabs.has(tabId)) return;
  try { await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['common.js','recorder.cs.js'], world: 'ISOLATED' }); }
  catch (e) { slog('reinjection onDOMContentLoaded fail', e?.message); }
});

async function runStepInFrame(tabId, step, row){
  const frameId = await resolveFrameIdFromPath(tabId, step.framePath || [{ frameId: step.frameId ?? 0 }]);
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['common.js','player.cs.js'], world: 'ISOLATED' });
  return await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'PLAYER_RUN', steps: [step], row }, { frameId }, (reply) => {
      if (chrome.runtime.lastError) resolve({ ok:false, error: chrome.runtime.lastError.message });
      else resolve(reply);
    });
  });
}

async function playAll(rows, { interactive = false } = {}){
  const tab = await getActiveTab(); if (!tab) throw new Error('No active tab');
  const steps = stepsByTab.get(tab.id) || [];
  aborted = false;
  for (let i = 0; i < rows.length; i++){
    for (let k = 0; k < steps.length; k++){
      const step = steps[k];
      const res = await runStepInFrame(tab.id, step, rows[i]);
      if (!res?.ok) throw new Error(`Step ${k+1} failed: ${res?.error || 'unknown'}`);
    }
    if (interactive){ await new Promise((resolve)=>{ pendingContinueResolve = resolve; chrome.runtime.sendMessage({ type:'SW_AWAITING_USER', index:i, total:rows.length }); }); if (aborted) throw new Error('Playback interrupted by user'); }
  }
  try { chrome.runtime.sendMessage({ type:'SW_PLAY_DONE' }); } catch {}
}

// Persist/load flows
async function listFlows(){ const { flows = {} } = await chrome.storage.local.get('flows'); return Object.keys(flows).sort(); }
async function saveFlow(name, steps){ const { flows = {} } = await chrome.storage.local.get('flows'); flows[name] = { steps, when: Date.now() }; await chrome.storage.local.set({ flows }); }
async function loadFlow(name){ const { flows = {} } = await chrome.storage.local.get('flows'); return flows[name]?.steps || []; }
async function deleteFlow(name){ const { flows = {} } = await chrome.storage.local.get('flows'); delete flows[name]; await chrome.storage.local.set({ flows }); }

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  (async () => {
    if (msg?.from !== 'panel') return;
    if (msg.type === 'PANEL_START'){ await startRecording(msg.seedRow); send({ ok:true }); }
    else if (msg.type === 'PANEL_STOP'){ const steps = await stopRecording(); send({ ok:true, steps }); }
    else if (msg.type === 'PANEL_GET_STEPS'){ const tab = await getActiveTab(); send({ ok:true, steps: stepsByTab.get(tab?.id) || [] }); }
    else if (msg.type === 'PANEL_CLEAR_STEPS'){ const tab = await getActiveTab(); if (tab) stepsByTab.set(tab.id, []); send({ ok:true }); }
    else if (msg.type === 'PANEL_PLAY_ALL'){ await playAll(msg.rows || [], { interactive: !!msg.interactive }); send({ ok:true }); }
    else if (msg.type === 'PANEL_CONTINUE'){ if (pendingContinueResolve) pendingContinueResolve(); send({ ok:true }); }
    else if (msg.type === 'PANEL_STOP_PLAYBACK'){ aborted = true; if (pendingContinueResolve) pendingContinueResolve(); send({ ok:true }); }
    else if (msg.type === 'PANEL_LIST_FLOWS'){ send({ ok:true, names: await listFlows() }); }
    else if (msg.type === 'PANEL_SAVE_FLOW'){ const tab = await getActiveTab(); await saveFlow(msg.name, stepsByTab.get(tab?.id) || []); send({ ok:true }); }
    else if (msg.type === 'PANEL_LOAD_FLOW'){ const steps = await loadFlow(msg.name); const tab = await getActiveTab(); if (tab) stepsByTab.set(tab.id, steps); send({ ok:true }); }
    else if (msg.type === 'PANEL_DELETE_FLOW'){ await deleteFlow(msg.name); send({ ok:true }); }
    else if (msg.type === 'PANEL_GET_CLIPS'){ const tab = await getActiveTab(); send({ ok:true, clips: clipsByTab.get(tab?.id) || [] }); }
  })().catch(err => { slog('ERR', err); send({ ok:false, error: String(err?.stack || err) }); });
  return true;
});
