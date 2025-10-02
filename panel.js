
// panel.js
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const getBtn = document.getElementById('getBtn');
const clearBtn = document.getElementById('clearBtn');
const playBtn = document.getElementById('playBtn');
const stepCountEl = document.getElementById('stepCount');
const stepsJsonEl = document.getElementById('stepsJson');
const statusEl = document.getElementById('status');
const jsonInput = document.getElementById('jsonInput');
const skipFirstRowEl = document.getElementById('skipFirstRow');
const manualLoopEl = document.getElementById('manualLoop');
const loopCountEl = document.getElementById('loopCount');
const loopControls = document.getElementById('loopControls');
const nextBtn = document.getElementById('nextBtn');
const stopPlayBtn = document.getElementById('stopPlayBtn');

// Flows UI
const flowNameEl = document.getElementById('flowName');
const saveFlowBtn = document.getElementById('saveFlowBtn');
const flowsSelect = document.getElementById('flowsSelect');
const loadFlowBtn = document.getElementById('loadFlowBtn');
const deleteFlowBtn = document.getElementById('deleteFlowBtn');

// Clips UI
const clipCountEl = document.getElementById('clipCount');
const exportClipsJsonBtn = document.getElementById('exportClipsJsonBtn');
const exportClipsCsvBtn = document.getElementById('exportClipsCsvBtn');

function send(msg){ return new Promise((resolve)=> chrome.runtime.sendMessage(msg, resolve)); }

async function refreshSteps(){
  const res = await send({ from:'panel', type:'PANEL_GET_STEPS' });
  const steps = (res && res.steps) || [];
  stepCountEl.textContent = `${steps.length} step${steps.length===1?'':'s'}`;
  stepsJsonEl.textContent = JSON.stringify(steps, null, 2);
}

async function refreshClips(){
  const res = await send({ from:'panel', type:'PANEL_GET_CLIPS' });
  const clips = (res && res.clips) || [];
  clipCountEl.textContent = `${clips.length} item${clips.length===1?'':'s'}`;
  return clips;
}

async function refreshFlowsList(){
  const res = await send({ from:'panel', type:'PANEL_LIST_FLOWS' });
  const names = (res && res.names) || [];
  flowsSelect.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
}

startBtn.onclick = async () => {
  startBtn.disabled = true; stopBtn.disabled = false;
  let seedRow = null;
  try {
    const arr = JSON.parse(jsonInput.value || '[]');
    if (Array.isArray(arr) && arr.length) seedRow = arr[0];
  } catch {}
  const res = await send({ from:'panel', type:'PANEL_START', seedRow });
  if (!res?.ok) alert('Failed to start: ' + (res?.error||''));
  await refreshSteps();
};

stopBtn.onclick = async () => {
  stopBtn.disabled = true; startBtn.disabled = false;
  const res = await send({ from:'panel', type:'PANEL_STOP' });
  if (!res?.ok) alert('Failed to stop: ' + (res?.error||''));
  await refreshSteps();
};

getBtn.onclick = refreshSteps;

clearBtn.onclick = async () => { await send({ from:'panel', type:'PANEL_CLEAR_STEPS' }); await refreshSteps(); };

playBtn.onclick = async () => {
  let rows = [];
  try {
    rows = JSON.parse(jsonInput.value || '[]');
    if (!Array.isArray(rows)) throw new Error('JSON must be an array');
  } catch(err) { alert('Invalid JSON: ' + err.message); return; }
  const interactive = !!manualLoopEl?.checked;
  const skipFirst = !!skipFirstRowEl?.checked;
  const loopCount = Math.max(0, parseInt(loopCountEl.value || '0', 10) || 0);

  let playRows = rows;
  if (rows.length > 0) playRows = skipFirst ? rows.slice(1) : rows;
  else if (loopCount > 0) playRows = Array.from({length: loopCount}, () => ({}));
  else { alert('Provide a dataset or a loop count > 0'); return; }

  playBtn.disabled = true;
  loopControls.style.display = interactive ? 'flex' : 'none';
  nextBtn.disabled = true; stopPlayBtn.disabled = false;
  try {
    const res = await send({ from:'panel', type:'PANEL_PLAY_ALL', rows: playRows, interactive });
    if (!res?.ok) throw new Error(res?.error || 'Playback failed');
    alert(`Played ${playRows.length} item(s).`);
  } catch(err){ alert(String(err.message || err)); }
  finally { playBtn.disabled = false; loopControls.style.display = 'none'; }
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SW_AWAITING_USER') { nextBtn.disabled = false; }
});

nextBtn.onclick = async () => { nextBtn.disabled = true; await send({ from:'panel', type:'PANEL_CONTINUE' }); };
stopPlayBtn.onclick = async () => { stopPlayBtn.disabled = true; nextBtn.disabled = true; await send({ from:'panel', type:'PANEL_STOP_PLAYBACK' }); };

// Flows save/load/delete
saveFlowBtn.onclick = async () => {
  const name = (flowNameEl.value || '').trim();
  if (!name) return alert('Enter a flow name');
  const res = await send({ from:'panel', type:'PANEL_SAVE_FLOW', name });
  if (!res?.ok) return alert('Save failed: ' + (res?.error||''));
  await refreshFlowsList();
  alert('Saved');
};
loadFlowBtn.onclick = async () => {
  const name = flowsSelect.value;
  if (!name) return;
  const res = await send({ from:'panel', type:'PANEL_LOAD_FLOW', name });
  if (!res?.ok) return alert('Load failed: ' + (res?.error||''));
  await refreshSteps();
};

deleteFlowBtn.onclick = async () => {
  const name = flowsSelect.value;
  if (!name) return;
  const res = await send({ from:'panel', type:'PANEL_DELETE_FLOW', name });
  if (!res?.ok) return alert('Delete failed: ' + (res?.error||''));
  await refreshFlowsList();
  await refreshSteps();
};

// Clips export
function downloadBlob(filename, mime, text){
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

exportClipsJsonBtn.onclick = async () => {
  const clips = await refreshClips();
  downloadBlob('clips.json', 'application/json', JSON.stringify(clips, null, 2));
};

exportClipsCsvBtn.onclick = async () => {
  const clips = await refreshClips();
  const header = ['timestamp','action','text','frameUrl'];
  const rows = clips.map(c => [new Date(c.timestamp).toISOString(), c.action, (c.text||'').replace(/"/g,'""'), c.frameUrl||'']);
  const csv = [header.join(','), ...rows.map(r => r.map(x => '"' + (x||'') + '"').join(','))].join('');
  downloadBlob('clips.csv', 'text/csv', csv);
};

// init
(async function(){ await refreshSteps(); await refreshFlowsList(); await refreshClips(); })();
