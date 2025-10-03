
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

// Accordion UI
const accordionViewBtn = document.getElementById('accordionViewBtn');
const jsonViewBtn = document.getElementById('jsonViewBtn');
const accordionView = document.getElementById('accordionView');
const jsonView = document.getElementById('jsonView');
const stepsAccordion = document.getElementById('stepsAccordion');

// CSV Import UI
const csvFileInput = document.getElementById('csvFileInput');
const importCsvBtn = document.getElementById('importCsvBtn');
const clearDatasetBtn = document.getElementById('clearDatasetBtn');
const datasetInfo = document.getElementById('datasetInfo');

function send(msg){ return new Promise((resolve)=> chrome.runtime.sendMessage(msg, resolve)); }

// CSV Import functionality
function parseCSV(csvText) {
  try {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}. Skipping.`);
        continue;
      }
      
      const obj = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index] ? values[index].trim() : '';
      });
      data.push(obj);
    }
    
    return data;
  } catch (error) {
    throw new Error(`CSV parsing error: ${error.message}`);
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  // Add the last field
  result.push(current);
  
  return result;
}

function updateDatasetInfo(data) {
  if (!data || data.length === 0) {
    datasetInfo.textContent = 'No dataset loaded';
    datasetInfo.className = 'muted';
    return;
  }
  
  const rowCount = data.length;
  const colCount = Object.keys(data[0] || {}).length;
  const columns = Object.keys(data[0] || {}).join(', ');
  
  datasetInfo.innerHTML = `
    <strong>${rowCount} rows</strong> × <strong>${colCount} columns</strong>
    <br><small>Columns: ${columns.length > 50 ? columns.substring(0, 50) + '...' : columns}</small>
  `;
  datasetInfo.className = 'success-message';
}

function showMessage(message, type = 'info') {
  // Remove existing messages
  const existingMessage = document.querySelector('.csv-import-section .error-message, .csv-import-section .success-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageEl = document.createElement('div');
  messageEl.className = type === 'error' ? 'error-message' : 'success-message';
  messageEl.textContent = message;
  
  const csvSection = document.querySelector('.csv-import-section');
  csvSection.appendChild(messageEl);
  
  // Auto-remove success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 3000);
  }
}

function loadDatasetIntoTextarea(data) {
  jsonInput.value = JSON.stringify(data, null, 2);
  updateDatasetInfo(data);
}

// CSV Import event handlers
importCsvBtn.addEventListener('click', () => {
  csvFileInput.click();
});

csvFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showMessage('Please select a CSV file', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csvText = e.target.result;
      const jsonData = parseCSV(csvText);
      
      if (jsonData.length === 0) {
        showMessage('CSV file is empty or has no valid data', 'error');
        return;
      }
      
      loadDatasetIntoTextarea(jsonData);
      showMessage(`Successfully imported ${jsonData.length} rows from CSV`, 'success');
      
    } catch (error) {
      showMessage(error.message, 'error');
    }
  };
  
  reader.onerror = () => {
    showMessage('Error reading file', 'error');
  };
  
  reader.readAsText(file);
  
  // Reset file input
  event.target.value = '';
});

clearDatasetBtn.addEventListener('click', () => {
  jsonInput.value = '';
  updateDatasetInfo([]);
  showMessage('Dataset cleared', 'success');
});

async function refreshSteps(){
  const res = await send({ from:'panel', type:'PANEL_GET_STEPS' });
  const steps = (res && res.steps) || [];
  stepCountEl.textContent = `${steps.length} step${steps.length===1?'':'s'}`;
  stepsJsonEl.textContent = JSON.stringify(steps, null, 2);
  renderAccordion(steps);
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

// Accordion rendering functions
function getStepIcon(type) {
  const icons = {
    'click': '🖱️',
    'input': '⌨️',
    'text_selection': '📝',
    'shortcut': '⌨️',
    'copy': '📋',
    'cut': '✂️',
    'paste': '📋'
  };
  return icons[type] || '❓';
}

function getStepTitle(step, index) {
  const titles = {
    'click': `Click Element`,
    'input': `Input Text`,
    'text_selection': `Select & Replace Text`,
    'shortcut': `Keyboard Shortcut`,
    'copy': `Copy Text`,
    'cut': `Cut Text`,
    'paste': `Paste Text`
  };
  
  const baseTitle = titles[step.type] || `Step ${index + 1}`;
  const subtitle = getStepSubtitle(step);
  return { title: baseTitle, subtitle };
}

function getStepSubtitle(step) {
  switch (step.type) {
    case 'click':
      return step.target?.css || 'Unknown element';
    case 'input':
      const inputText = step.originalTextSample || '';
      return `"${inputText.length > 30 ? inputText.substring(0, 30) + '...' : inputText}"`;
    case 'text_selection':
      const selectedText = step.selectedText || '';
      return `"${selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText}"`;
    case 'shortcut':
      return step.action || 'Unknown shortcut';
    case 'copy':
    case 'cut':
    case 'paste':
      const text = step.text || '';
      return `"${text.length > 30 ? text.substring(0, 30) + '...' : text}"`;
    default:
      return 'Unknown action';
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown time';
  return new Date(timestamp).toLocaleTimeString();
}

function renderAccordion(steps) {
  if (!steps || steps.length === 0) {
    stepsAccordion.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div>No steps recorded yet</div>
        <div class="empty-state-subtitle">Start recording to see steps here</div>
      </div>
    `;
    return;
  }

  const accordionHTML = steps.map((step, index) => {
    const { title, subtitle } = getStepTitle(step, index);
    const icon = getStepIcon(step.type);
    const timestamp = formatTimestamp(step.timestamp);
    
    return `
      <div class="accordion-item" data-step-index="${index}">
        <div class="accordion-header" data-action="toggle">
          <div class="step-info">
            <div class="step-icon ${step.type}">${icon}</div>
            <div>
              <div class="step-title">${title}</div>
              <div class="step-subtitle">${subtitle}</div>
            </div>
          </div>
          <button class="accordion-toggle" id="toggle-${index}">▼</button>
        </div>
        <div class="accordion-body" id="body-${index}">
          <div class="step-details">
            <div class="detail-row">
              <div class="detail-label">Type:</div>
              <div class="detail-value">${step.type}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Time:</div>
              <div class="detail-value">${timestamp}</div>
            </div>
            ${step.target?.css ? `
            <div class="detail-row">
              <div class="detail-label">Selector:</div>
              <div class="detail-value">${step.target.css}</div>
            </div>
            ` : ''}
            ${step.originalTextSample ? `
            <div class="detail-row">
              <div class="detail-label">Text:</div>
              <div class="detail-value">${step.originalTextSample}</div>
            </div>
            ` : ''}
            ${step.selectedText ? `
            <div class="detail-row">
              <div class="detail-label">Selected:</div>
              <div class="detail-value">${step.selectedText}</div>
            </div>
            ` : ''}
            ${step.action ? `
            <div class="detail-row">
              <div class="detail-label">Action:</div>
              <div class="detail-value">${step.action}</div>
            </div>
            ` : ''}
            ${step.placeholderKey ? `
            <div class="detail-row">
              <div class="detail-label">Data Key:</div>
              <div class="detail-value">${step.placeholderKey}</div>
            </div>
            ` : ''}
            ${step.placeholderIndex ? `
            <div class="detail-row">
              <div class="detail-label">Data Index:</div>
              <div class="detail-value">${step.placeholderIndex}</div>
            </div>
            ` : ''}
            ${step.url ? `
            <div class="detail-row">
              <div class="detail-label">URL:</div>
              <div class="detail-value">${step.url}</div>
            </div>
            ` : ''}
          </div>
          <div class="step-actions">
            <button class="btn-small" data-action="copy" data-index="${index}">📋 Copy Data</button>
            <button class="btn-small" data-action="edit" data-index="${index}">✏️ Edit</button>
            <button class="btn-small" data-action="delete" data-index="${index}">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  stepsAccordion.innerHTML = sanitizeHTML(accordionHTML);
}

// Accordion functionality
function toggleAccordion(index) {
  try {
    const header = document.querySelector(`[data-step-index="${index}"] .accordion-header`);
    const body = document.getElementById(`body-${index}`);
    const toggle = document.getElementById(`toggle-${index}`);
    
    if (!header || !body || !toggle) {
      console.warn(`Could not find accordion elements for index ${index}`);
      return;
    }
    
    const isOpen = body.classList.contains('show');
    
    if (isOpen) {
      body.classList.remove('show');
      header.classList.remove('active');
      toggle.classList.remove('active');
    } else {
      body.classList.add('show');
      header.classList.add('active');
      toggle.classList.add('active');
    }
  } catch (error) {
    console.error('Error toggling accordion:', error);
  }
}

// Step actions
function copyStepData(index) {
  // This would copy step data to clipboard
  console.log('Copy step data:', index);
  // Implementation would go here
}

function editStep(index) {
  // This would allow editing step data
  console.log('Edit step:', index);
  // Implementation would go here
}

function deleteStep(index) {
  // This would delete a step
  console.log('Delete step:', index);
  // Implementation would go here
}

// View toggle functionality
accordionViewBtn.addEventListener('click', () => {
  accordionViewBtn.classList.add('active');
  jsonViewBtn.classList.remove('active');
  accordionView.style.display = 'block';
  jsonView.classList.add('json-view-hidden');
});

jsonViewBtn.addEventListener('click', () => {
  jsonViewBtn.classList.add('active');
  accordionViewBtn.classList.remove('active');
  jsonView.classList.remove('json-view-hidden');
  accordionView.style.display = 'none';
});

// Event delegation for accordion interactions
stepsAccordion.addEventListener('click', (event) => {
  try {
    const target = event.target;
    const action = target.getAttribute('data-action');
    const index = target.getAttribute('data-index');
    
    if (action === 'toggle') {
      const accordionItem = target.closest('.accordion-item');
      if (accordionItem) {
        const stepIndex = accordionItem.getAttribute('data-step-index');
        if (stepIndex !== null) {
          toggleAccordion(parseInt(stepIndex, 10));
        }
      }
    } else if (action === 'copy' && index !== null) {
      copyStepData(parseInt(index, 10));
    } else if (action === 'edit' && index !== null) {
      editStep(parseInt(index, 10));
    } else if (action === 'delete' && index !== null) {
      deleteStep(parseInt(index, 10));
    }
  } catch (error) {
    console.error('Error handling accordion click:', error);
  }
});

// Make functions globally available for onclick handlers (for backward compatibility)
window.toggleAccordion = toggleAccordion;
window.copyStepData = copyStepData;
window.editStep = editStep;
window.deleteStep = deleteStep;

// Initialize dataset info on page load
function initializeDatasetInfo() {
  try {
    const currentData = JSON.parse(jsonInput.value || '[]');
    updateDatasetInfo(currentData);
  } catch (error) {
    updateDatasetInfo([]);
  }
}

// Additional safety: Remove any potential inline event handlers
function sanitizeHTML(html) {
  // This is a basic sanitization - in a real app you might want to use a proper sanitizer
  return html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

// init
(async function(){ 
  await refreshSteps(); 
  await refreshFlowsList(); 
  await refreshClips(); 
  initializeDatasetInfo();
})();
