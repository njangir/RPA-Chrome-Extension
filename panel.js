
// panel.js
const startBtn = document.getElementById('startBtn');
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
const stopPlayBtn = document.getElementById('stopPlayBtn');
const getBtn = document.getElementById('getBtn');
const clearBtn = document.getElementById('clearBtn');
// playBtn removed - functionality moved to stopPlayBtn
const stepCountEl = document.getElementById('stepCount');
const stepsJsonEl = document.getElementById('stepsJson');
const statusEl = document.getElementById('status');
const saveJsonBtn = document.getElementById('saveJsonBtn');
const resetJsonBtn = document.getElementById('resetJsonBtn');
const jsonStatus = document.getElementById('jsonStatus');
const jsonInput = document.getElementById('jsonInput');
const skipFirstRowEl = document.getElementById('skipFirstRow');
const manualLoopEl = document.getElementById('manualLoop');
const loopCountEl = document.getElementById('loopCount');
const loopControls = document.getElementById('loopControls');
const nextBtn = document.getElementById('nextBtn');

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
const exportExtractedDataBtn = document.getElementById('exportExtractedDataBtn');

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

// Dataset Header Buttons UI
const datasetButtonsSection = document.getElementById('datasetButtonsSection');
const datasetButtons = document.getElementById('datasetButtons');

// Start URL UI
const startUrlDisplay = document.getElementById('startUrlDisplay');
const navigateToStartBtn = document.getElementById('navigateToStartBtn');

function send(msg){ 
  // Log key communication messages
  if (msg.type && (msg.type.includes('PANEL_') || msg.type.includes('DEBUG'))) {
    console.log('[PANEL] Sending:', msg.type);
  }
  return new Promise((resolve)=> chrome.runtime.sendMessage(msg, resolve)); 
}

// Real-time refresh functionality
let realTimeRefreshInterval = null;

function startRealTimeRefresh() {
  if (realTimeRefreshInterval) return; // Already running
  
  // Only start if we're actually recording
  if (!isRecording) {
    return;
  }
  
  // Refresh every 500ms during recording
  realTimeRefreshInterval = setInterval(async () => {
    try {
      // Double-check we're still recording before refreshing
      if (!isRecording) {
        stopRealTimeRefresh();
        return;
      }
      await refreshSteps();
    } catch (error) {
      console.error('Error during real-time refresh:', error);
    }
  }, 500);
}

function stopRealTimeRefresh() {
  if (realTimeRefreshInterval) {
    clearInterval(realTimeRefreshInterval);
    realTimeRefreshInterval = null;
  }
}

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
  updateDatasetButtons(data);
}

// Dataset Header Buttons Functions
function updateDatasetButtons(data) {
  try {
    // Clear existing buttons
    datasetButtons.innerHTML = '';
    
    if (!data || data.length === 0) {
      datasetButtonsSection.classList.add('hidden-section');
      return;
    }
    
    // Get first row for values
    const firstRow = data[0];
    if (!firstRow || typeof firstRow !== 'object') {
      datasetButtonsSection.classList.add('hidden-section');
      return;
    }
    
    // Create buttons for each key in the first row
    const keys = Object.keys(firstRow);
    if (keys.length === 0) {
      datasetButtonsSection.classList.add('hidden-section');
      return;
    }
    
    keys.forEach(key => {
      const value = firstRow[key] || '';
      const button = createDatasetButton(key, value);
      datasetButtons.appendChild(button);
    });
    
    // Show the section
    datasetButtonsSection.classList.remove('hidden-section');
    
  } catch (error) {
    console.error('Error updating dataset buttons:', error);
    datasetButtonsSection.classList.add('hidden-section');
  }
}

function createDatasetButton(key, value) {
  const button = document.createElement('button');
  button.className = 'dataset-btn';
  button.dataset.key = key;
  button.dataset.value = value;
  button.draggable = true;
  
  // Button content
  button.innerHTML = `
    <span class="dataset-btn-icon">📋</span>
    <span class="dataset-btn-key">${key}</span>
    <span class="dataset-btn-value" title="${value}">${value.length > 20 ? value.substring(0, 20) + '...' : value}</span>
  `;
  
  // Click handler for paste functionality
  button.addEventListener('click', (e) => {
    e.preventDefault();
    handleDatasetButtonClick(key, value);
  });
  
  // Drag and drop handlers
  button.addEventListener('dragstart', (e) => {
    handleDragStart(e, key, value);
  });
  
  button.addEventListener('dragend', (e) => {
    handleDragEnd(e);
  });
  
  return button;
}

function handleDatasetButtonClick(key, value) {
  try {
    // Send message to content script to paste the value
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'DATASET_BUTTON_CLICK',
          key: key,
          value: value
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Fallback: copy to clipboard
            copyToClipboard(value);
            showMessage(`Copied "${key}" value to clipboard: ${value}`, 'success');
          } else if (response && response.success) {
            showMessage(`Pasted "${key}" value: ${value}`, 'success');
          } else {
            // Fallback: copy to clipboard
            copyToClipboard(value);
            showMessage(`Copied "${key}" value to clipboard: ${value}`, 'success');
          }
        });
      }
    });
  } catch (error) {
    console.error('Error handling dataset button click:', error);
    // Fallback: copy to clipboard
    copyToClipboard(value);
    showMessage(`Copied "${key}" value to clipboard: ${value}`, 'success');
  }
}

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text).then(() => {
      // Text copied successfully
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  } catch (error) {
    console.error('Error copying to clipboard:', error);
  }
}

// Drag and Drop functionality
function handleDragStart(e, key, value) {
  e.dataTransfer.setData('text/plain', value);
  e.dataTransfer.setData('application/json', JSON.stringify({ key, value }));
  e.dataTransfer.effectAllowed = 'copy';
  
  e.target.classList.add('dragging');
  
  // Add visual feedback to input fields
  addInputFieldHighlight();
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  removeInputFieldHighlight();
}

function addInputFieldHighlight() {
  // This will be handled by the content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'DATASET_DRAG_START'
      });
    }
  });
}

function removeInputFieldHighlight() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'DATASET_DRAG_END'
      });
    }
  });
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
  updateDatasetButtons([]);
  showMessage('Dataset cleared', 'success');
});

// Navigate to start URL
navigateToStartBtn.addEventListener('click', async () => {
  try {
    const res = await send({ from: 'panel', type: 'PANEL_GET_START_URL' });
    const startUrl = res?.startUrl;
    
    if (startUrl) {
      // Open start URL in current tab
      await chrome.tabs.update({ url: startUrl });
      showMessage('Navigating to start URL...', 'success');
    } else {
      showMessage('No start URL available', 'error');
    }
  } catch (error) {
    console.error('Error navigating to start URL:', error);
    showMessage('Error navigating to start URL', 'error');
  }
});

async function refreshSteps(){
  const res = await send({ from:'panel', type:'PANEL_GET_STEPS' });
  const steps = (res && res.steps) || [];
  stepCountEl.textContent = `${steps.length} step${steps.length===1?'':'s'}`;
  
  // Update JSON view only if it's not being actively edited
  if (!stepsJsonEl.matches(':focus')) {
    stepsJsonEl.value = JSON.stringify(steps, null, 2);
  }
  
  renderAccordion(steps);
  
  // Refresh start URL
  await refreshStartUrl();
}

async function refreshStartUrl() {
  try {
    const res = await send({ from: 'panel', type: 'PANEL_GET_START_URL' });
    const startUrl = res?.startUrl;
    
    if (startUrl) {
      startUrlDisplay.textContent = startUrl;
      startUrlDisplay.className = 'success-message';
      document.getElementById('startUrlSection').className = 'section';
      navigateToStartBtn.className = 'btn-small';
    } else {
      startUrlDisplay.textContent = 'No start URL recorded';
      startUrlDisplay.className = 'muted';
      document.getElementById('startUrlSection').className = 'section hidden-section';
      navigateToStartBtn.className = 'btn-small hidden-button';
    }
  } catch (error) {
    console.error('Error refreshing start URL:', error);
    startUrlDisplay.textContent = 'Error loading start URL';
    startUrlDisplay.className = 'error-message';
  }
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

// State tracking
let isRecording = false;
let isPaused = false;
let isPlaying = false;

startBtn.onclick = async () => {
  startBtn.disabled = true; 
  pauseResumeBtn.disabled = false;
  pauseResumeBtn.textContent = 'Pause';
  stopPlayBtn.disabled = false;
  stopPlayBtn.textContent = 'Stop';
  isRecording = true;
  isPaused = false;
  isPlaying = false;
  
  let seedRow = null;
  try {
    const arr = JSON.parse(jsonInput.value || '[]');
    if (Array.isArray(arr) && arr.length) seedRow = arr[0];
  } catch {}
  console.log('[PANEL] Starting recording...');
  const res = await send({ from:'panel', type:'PANEL_START', seedRow });
  if (!res?.ok) {
    alert('Failed to start: ' + (res?.error||''));
  } else {
    console.log('[PANEL] Recording started successfully');
  }
  await refreshSteps();
  // Start real-time refresh during recording
  startRealTimeRefresh();
};

pauseResumeBtn.onclick = async () => {
  if (isRecording && !isPaused) {
    // Pause recording
    const res = await send({ from:'panel', type:'PANEL_PAUSE' });
    if (!res?.ok) alert('Failed to pause: ' + (res?.error||''));
    pauseResumeBtn.textContent = 'Resume';
    isPaused = true;
    stopRealTimeRefresh();
  } else if (isRecording && isPaused) {
    // Resume recording
    const res = await send({ from:'panel', type:'PANEL_RESUME' });
    if (!res?.ok) alert('Failed to resume: ' + (res?.error||''));
    pauseResumeBtn.textContent = 'Pause';
    isPaused = false;
    await refreshSteps();
    startRealTimeRefresh();
  }
};

stopPlayBtn.onclick = async () => {
  if (isRecording) {
    // Stop recording
    console.log('[PANEL] Stopping recording...');
    const res = await send({ from:'panel', type:'PANEL_STOP' });
    if (!res?.ok) {
      alert('Failed to stop: ' + (res?.error||''));
    } else {
      console.log('[PANEL] Recording stopped successfully');
    }
    
    // Update button state immediately (before heavy operations)
    stopPlayBtn.textContent = 'Play All';
    pauseResumeBtn.disabled = true;
    pauseResumeBtn.textContent = 'Pause';
    startBtn.disabled = false;
    isRecording = false;
    isPaused = false;
    
    // Stop real-time refresh first
    stopRealTimeRefresh();
    
    // Refresh steps asynchronously to avoid blocking UI
    refreshSteps().catch(error => {
      console.error('Error refreshing steps after stop:', error);
    });
  } else if (isPlaying) {
    // Stop playback
    const res = await send({ from:'panel', type:'PANEL_STOP_PLAYBACK' });
    if (!res?.ok) alert('Failed to stop playback: ' + (res?.error||''));
    stopPlayBtn.textContent = 'Play All';
    isPlaying = false;
  } else {
    // Start playback - check if steps exist first
    const res = await send({ from:'panel', type:'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    if (steps.length === 0) {
      const userChoice = confirm(
        'No steps recorded yet!\n\n' +
        'Would you like to:\n' +
        '• Click OK to load a saved flow\n' +
        '• Click Cancel to start recording new steps'
      );
      
      if (userChoice) {
        // Focus on flows section
        const flowsSelect = document.getElementById('flowsSelect');
        if (flowsSelect) {
          flowsSelect.closest('.section').scrollIntoView({ behavior: 'smooth' });
          flowsSelect.focus();
        }
        alert('Please select a flow from the dropdown and click "Load"');
      } else {
        // Focus on start recording button
        startBtn.focus();
        alert('Please click "Start Recording" to begin recording new steps');
      }
      return;
    }
    
    console.log('[PANEL] Starting playback...');
    await playAll();
  }
};

getBtn.onclick = refreshSteps;

clearBtn.onclick = async () => { await send({ from:'panel', type:'PANEL_CLEAR_STEPS' }); await refreshSteps(); };

// JSON editing functionality
saveJsonBtn.onclick = async () => {
  try {
    const jsonText = stepsJsonEl.value.trim();
    if (!jsonText) {
      jsonStatus.textContent = 'Empty JSON';
      jsonStatus.className = 'error-message';
      return;
    }
    
    const steps = JSON.parse(jsonText);
    if (!Array.isArray(steps)) {
      jsonStatus.textContent = 'JSON must be an array';
      jsonStatus.className = 'error-message';
      return;
    }
    
    // Validate step structure
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step || typeof step !== 'object') {
        jsonStatus.textContent = `Step ${i + 1} is not a valid object`;
        jsonStatus.className = 'error-message';
        return;
      }
      if (!step.type) {
        jsonStatus.textContent = `Step ${i + 1} missing required 'type' field`;
        jsonStatus.className = 'error-message';
        return;
      }
    }
    
    // Save the steps
    const res = await send({ 
      from: 'panel', 
      type: 'PANEL_SET_STEPS', 
      steps: steps 
    });
    
    if (res?.ok) {
      jsonStatus.textContent = `Saved ${steps.length} steps successfully`;
      jsonStatus.className = 'success-message';
      await refreshSteps();
    } else {
      jsonStatus.textContent = 'Failed to save: ' + (res?.error || 'Unknown error');
      jsonStatus.className = 'error-message';
    }
  } catch (error) {
    jsonStatus.textContent = 'Invalid JSON: ' + error.message;
    jsonStatus.className = 'error-message';
  }
};

resetJsonBtn.onclick = async () => {
  await refreshSteps();
  jsonStatus.textContent = 'Reset to current steps';
  jsonStatus.className = 'success-message';
};

async function playAll() {
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
  else { 
    alert('Provide a dataset or a loop count > 0'); 
    return; 
  }

  // Update button state
  stopPlayBtn.textContent = 'Stop';
  stopPlayBtn.disabled = false;
  isPlaying = true;
  loopControls.style.display = interactive ? 'flex' : 'none';
  nextBtn.disabled = true;
  
  try {
    // Get start URL for navigation
    let startUrl = null;
    try {
      const urlRes = await send({ from: 'panel', type: 'PANEL_GET_START_URL' });
      startUrl = urlRes?.startUrl;
    } catch (error) {
      // Could not get start URL
    }
    
    // Get steps to check if we need grouped execution
    const stepsRes = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (stepsRes && stepsRes.steps) || [];
    
    // Check if we need grouped execution
    const hasLoopGroups = steps.some(s => s.type === 'loop_group');
    
    if (hasLoopGroups) {
      // Use grouped execution
      const groupingAnalysis = await analyzeDataGrouping();
      
      const res = await send({ 
        from:'panel', 
        type:'PANEL_PLAY_ALL_GROUPED', 
        rows: playRows, 
        interactive,
        startUrl,
        groupingInfo: groupingAnalysis.hierarchy
      });
      
      if (!res?.ok) throw new Error(res?.error || 'Playback failed');
      alert(`Grouped playback completed.\n\n${groupingAnalysis.preview}`);
    } else {
      // Use normal execution
      const res = await send({ 
        from:'panel', 
        type:'PANEL_PLAY_ALL', 
        rows: playRows, 
        interactive,
        startUrl 
      });
      if (!res?.ok) throw new Error(res?.error || 'Playback failed');
      alert(`Played ${playRows.length} item(s).`);
    }
  } catch(err){ 
    alert(String(err.message || err)); 
  } finally { 
    // Reset button state
    stopPlayBtn.textContent = 'Play All';
    isPlaying = false;
    loopControls.style.display = 'none'; 
  }
}

// playBtn removed - functionality moved to stopPlayBtn

// Debug function to test message flow
async function debugMessageFlow() {
  try {
    // Test service worker communication
    const swTest = await send({ from: 'panel', type: 'DEBUG_TEST' });
    
    // Test getting steps
    const stepsRes = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    
    // Test getting start URL
    const urlRes = await send({ from: 'panel', type: 'PANEL_GET_START_URL' });
    
  } catch (error) {
    console.error('Debug test failed:', error);
  }
}

// Add debug button to the panel (temporary)
if (typeof window !== 'undefined') {
  window.debugMessageFlow = debugMessageFlow;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SW_AWAITING_USER') { 
    nextBtn.disabled = false; 
  } else if (msg?.type === 'DATASET_BUTTON_SUCCESS') {
    if (msg.success) {
      showMessage(`Successfully pasted "${msg.key}" value: ${msg.value}`, 'success');
    } else if (msg.fallback === 'clipboard') {
      showMessage(`Copied "${msg.key}" value to clipboard: ${msg.value}`, 'success');
    } else {
      showMessage(`Failed to paste "${msg.key}" value: ${msg.error || 'Unknown error'}`, 'error');
    }
  } else if (msg?.type === 'DATASET_DROP_SUCCESS') {
    showMessage(`Successfully dropped "${msg.key}" value into ${msg.element.tagName}`, 'success');
  } else if (msg?.type === 'PANEL_STEP_ERROR') {
    // Handle step error from service worker
    handleStepError(msg.step, msg.stepIndex, msg.error, msg.context).then(result => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
});

nextBtn.onclick = async () => { nextBtn.disabled = true; await send({ from:'panel', type:'PANEL_CONTINUE' }); };

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
  const header = ['timestamp','action','text','title','url','frameUrl'];
  const rows = clips.map(c => [
    new Date(c.timestamp).toISOString(), 
    c.action, 
    (c.text||'').replace(/"/g,'""'), 
    (c.title||'').replace(/"/g,'""'),
    (c.url||'').replace(/"/g,'""'),
    c.frameUrl||''
  ]);
  const csv = [header.join(','), ...rows.map(r => r.map(x => '"' + (x||'') + '"').join(','))].join('\n');
  downloadBlob('clips.csv', 'text/csv', csv);
};

exportExtractedDataBtn.onclick = async () => {
  const clips = await refreshClips();
  const extractedData = clips.filter(c => c.type === 'extract');
  
  if (extractedData.length === 0) {
    showMessage('No extracted data found', 'warning');
    return;
  }
  
  // Create CSV with extracted data
  const header = ['timestamp','action','title','url','frameUrl'];
  const rows = extractedData.map(c => [
    new Date(c.timestamp).toISOString(),
    c.action,
    (c.title||'').replace(/"/g,'""'),
    (c.url||'').replace(/"/g,'""'),
    c.frameUrl||''
  ]);
  const csv = [header.join(','), ...rows.map(r => r.map(x => '"' + (x||'') + '"').join(','))].join('\n');
  downloadBlob('extracted-data.csv', 'text/csv', csv);
  
  showMessage(`Exported ${extractedData.length} extracted data items`, 'success');
};

// Accordion rendering functions
function getStepIcon(type) {
  const icons = {
    'click': '🖱️',
    'input': '⌨️',
    'text_selection': '📝',
    'shortcut': '⌨️',
    'key_press': '🔑',
    'extract_title': '📄',
    'extract_url': '🔗',
    'extract_metadata': '📊',
    'copy': '📋',
    'cut': '✂️',
    'paste': '📋',
    'file_upload': '📁',
    // New step types
    'navigate_url': '🌐',
    'find_by_value': '🔍',
    'find_by_index': '🔢',
    'loop_group': '🔄'
  };
  return icons[type] || '❓';
}

function getStepTitle(step, index) {
  // Handle new step types first
  if (step.type === 'navigate_url') {
    return {
      title: 'Navigate to URL',
      subtitle: step.column ? `Column: ${step.column}` : (step.value || step.url || 'URL')
    };
  }
  
  if (step.type === 'find_by_value') {
    return {
      title: 'Find By Value',
      subtitle: `Column: ${step.column} → ${step.action || 'click'}`
    };
  }
  
  if (step.type === 'find_by_index') {
    return {
      title: 'Find By Index',
      subtitle: `${step.selector} [${step.index}] → ${step.action || 'click'}`
    };
  }
  
  if (step.type === 'file_upload') {
    return {
      title: 'File Upload',
      subtitle: step.fileNames ? `${step.fileCount} file(s): ${step.fileNames}` : 'No files selected'
    };
  }
  
  if (step.type === 'key_press') {
    return {
      title: 'Key Press',
      subtitle: step.key ? `Pressed: ${step.key}` : 'Unknown key'
    };
  }
  
  if (step.type === 'extract_title') {
    return {
      title: 'Extract Title',
      subtitle: step.extractedData?.title ? `Title: ${step.extractedData.title}` : 'No title extracted'
    };
  }
  
  if (step.type === 'extract_url') {
    return {
      title: 'Extract URL',
      subtitle: step.extractedData?.url ? `URL: ${step.extractedData.url}` : 'No URL extracted'
    };
  }
  
  if (step.type === 'extract_metadata') {
    return {
      title: 'Extract Metadata',
      subtitle: step.extractedData ? `Title: ${step.extractedData.title || 'N/A'} | URL: ${step.extractedData.url || 'N/A'}` : 'No metadata extracted'
    };
  }
  
  if (step.type === 'loop_group') {
    return {
      title: step.action === 'start' ? 'Loop Start' : 'Loop End',
      subtitle: step.action === 'start' ? `Group by: ${step.groupBy || step.name || 'unknown'}` : 'End of loop'
    };
  }
  
  // Handle original step types
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

function formatDelay(delayMs) {
  if (delayMs === undefined || delayMs === null) return 'N/A';
  if (delayMs === 0) return 'No delay';
  
  if (delayMs < 1000) {
    return `${delayMs}ms`;
  } else if (delayMs < 60000) {
    const seconds = (delayMs / 1000).toFixed(1);
    return `${seconds}s`;
  } else {
    const minutes = Math.floor(delayMs / 60000);
    const seconds = ((delayMs % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
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
    const delayText = step.delay !== undefined ? ` (${formatDelay(step.delay)})` : '';
    
    return `
      <div class="accordion-item" data-step-index="${index}">
        <div class="accordion-header">
          <div class="step-info">
            <div class="step-icon ${step.type}">${icon}</div>
            <div>
              <div class="step-title">${title}${delayText}</div>
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
            ${step.delay !== undefined ? `
            <div class="detail-row">
              <div class="detail-label">Delay:</div>
              <div class="detail-value">${formatDelay(step.delay)}</div>
            </div>
            ` : ''}
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
            ${step.fileNames ? `
            <div class="detail-row">
              <div class="detail-label">Files:</div>
              <div class="detail-value">${step.fileNames}</div>
            </div>
            ` : ''}
            ${step.fileCount ? `
            <div class="detail-row">
              <div class="detail-label">File Count:</div>
              <div class="detail-value">${step.fileCount}</div>
            </div>
            ` : ''}
            ${step.accept ? `
            <div class="detail-row">
              <div class="detail-label">Accept:</div>
              <div class="detail-value">${step.accept}</div>
            </div>
            ` : ''}
            ${step.multiple !== undefined ? `
            <div class="detail-row">
              <div class="detail-label">Multiple:</div>
              <div class="detail-value">${step.multiple ? 'Yes' : 'No'}</div>
            </div>
            ` : ''}
            ${step.key ? `
            <div class="detail-row">
              <div class="detail-label">Key:</div>
              <div class="detail-value">${step.key}</div>
            </div>
            ` : ''}
            ${step.code ? `
            <div class="detail-row">
              <div class="detail-label">Code:</div>
              <div class="detail-value">${step.code}</div>
            </div>
            ` : ''}
            ${step.extractedData?.title ? `
            <div class="detail-row">
              <div class="detail-label">Extracted Title:</div>
              <div class="detail-value">${step.extractedData.title}</div>
            </div>
            ` : ''}
            ${step.extractedData?.url ? `
            <div class="detail-row">
              <div class="detail-label">Extracted URL:</div>
              <div class="detail-value">${step.extractedData.url}</div>
            </div>
            ` : ''}
            ${step.column ? `
            <div class="detail-row">
              <div class="detail-label">Dataset Column:</div>
              <div class="detail-value">${step.column}</div>
            </div>
            ` : ''}
            ${step.titleColumn ? `
            <div class="detail-row">
              <div class="detail-label">Title Column:</div>
              <div class="detail-value">${step.titleColumn}</div>
            </div>
            ` : ''}
            ${step.urlColumn ? `
            <div class="detail-row">
              <div class="detail-label">URL Column:</div>
              <div class="detail-value">${step.urlColumn}</div>
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
            ${step.target?.css ? `<button class="btn-small" data-action="highlight" data-index="${index}">🔍 Highlight</button>` : ''}
            <button class="btn-small" data-action="delete" data-index="${index}">🗑️ Delete</button>
          </div>
          ${!['navigate_url', 'find_by_value', 'find_by_index', 'loop_group'].includes(step.type) && step.target ? `
          <div class="selector-selection">
            <label for="selector-${index}" class="selector-label">Choose Selector:</label>
            <select id="selector-${index}" class="selector-dropdown" data-step-index="${index}">
              <option value="">Loading selectors...</option>
            </select>
            <div class="selector-info">
              <small class="selector-description">Select which method to use for finding this element</small>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  stepsAccordion.innerHTML = sanitizeHTML(accordionHTML);
  
  // Update step count immediately
  stepCountEl.textContent = `${steps.length} step${steps.length !== 1 ? 's' : ''}`;
  
  // Populate selector dropdowns asynchronously to avoid blocking UI
  setTimeout(() => {
    steps.forEach((step, index) => {
      const dropdown = document.getElementById(`selector-${index}`);
      if (dropdown) {
        populateSelectorDropdown(dropdown, step, index);
      }
    });
  }, 0);
}

// Accordion functionality
function toggleAccordion(index) {
  try {
    const header = document.querySelector(`[data-step-index="${index}"] .accordion-header`);
    const body = document.getElementById(`body-${index}`);
    const toggle = document.getElementById(`toggle-${index}`);
    
    if (!header || !body || !toggle) {
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
async function copyStepData(index) {
  try {
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    if (index >= 0 && index < steps.length) {
      const step = steps[index];
      const stepData = {
        type: step.type,
        selector: step.target?.css || '',
        text: step.originalTextSample || step.selectedText || '',
        action: step.action || '',
        url: step.url || '',
        timestamp: step.timestamp || '',
        placeholderKey: step.placeholderKey || '',
        placeholderIndex: step.placeholderIndex || ''
      };
      
      // Copy to clipboard
      const stepJson = JSON.stringify(stepData, null, 2);
      await navigator.clipboard.writeText(stepJson);
      
      showMessage(`Copied step ${index + 1} data to clipboard`, 'success');
    } else {
      showMessage('Invalid step index', 'error');
    }
  } catch (error) {
    console.error('Error copying step data:', error);
    showMessage('Failed to copy step data: ' + error.message, 'error');
  }
}

async function editStep(index) {
  try {
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    if (index >= 0 && index < steps.length) {
      const step = steps[index];
      
      // Create a simple edit dialog
      const editDialog = document.createElement('div');
      editDialog.className = 'edit-dialog';
      editDialog.innerHTML = `
        <div class="edit-dialog-content">
          <h3>Edit Step ${index + 1}</h3>
          <div class="edit-form">
            <div class="form-group">
              <label>Selector:</label>
              <input type="text" id="editSelector" value="${step.target?.css || ''}" />
            </div>
            <div class="form-group">
              <label>Text:</label>
              <input type="text" id="editText" value="${step.originalTextSample || step.selectedText || ''}" />
            </div>
            <div class="form-group">
              <label>Action:</label>
              <input type="text" id="editAction" value="${step.action || ''}" />
            </div>
            <div class="form-group">
              <label>Data Key:</label>
              <input type="text" id="editDataKey" value="${step.placeholderKey || ''}" />
            </div>
            <div class="form-group">
              <label>Data Index:</label>
              <input type="text" id="editDataIndex" value="${step.placeholderIndex || ''}" />
            </div>
          </div>
          <div class="edit-actions">
            <button id="saveEditBtn" class="btn-primary">Save</button>
            <button id="cancelEditBtn" class="btn-secondary">Cancel</button>
          </div>
        </div>
      `;
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .edit-dialog {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .edit-dialog-content {
          background: white;
          border-radius: 8px;
          padding: 20px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }
        .edit-form {
          margin: 20px 0;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .edit-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(editDialog);
      
      // Handle save
      document.getElementById('saveEditBtn').onclick = async () => {
        try {
          const updatedStep = {
            ...step,
            target: {
              ...step.target,
              css: document.getElementById('editSelector').value
            },
            originalTextSample: document.getElementById('editText').value,
            action: document.getElementById('editAction').value,
            placeholderKey: document.getElementById('editDataKey').value,
            placeholderIndex: document.getElementById('editDataIndex').value
          };
          
          // Update the step in storage
          const updateRes = await send({ 
            from: 'panel', 
            type: 'PANEL_UPDATE_STEP', 
            index: index,
            step: updatedStep
          });
          
          if (updateRes?.ok) {
            showMessage(`Step ${index + 1} updated successfully`, 'success');
            await refreshSteps();
          } else {
            showMessage('Failed to update step: ' + (updateRes?.error || 'Unknown error'), 'error');
          }
          
          // Clean up
          document.body.removeChild(editDialog);
          document.head.removeChild(style);
        } catch (error) {
          console.error('Error saving step:', error);
          showMessage('Failed to save step: ' + error.message, 'error');
        }
      };
      
      // Handle cancel
      document.getElementById('cancelEditBtn').onclick = () => {
        document.body.removeChild(editDialog);
        document.head.removeChild(style);
      };
      
    } else {
      showMessage('Invalid step index', 'error');
    }
  } catch (error) {
    console.error('Error editing step:', error);
    showMessage('Failed to edit step: ' + error.message, 'error');
  }
}

async function deleteStep(index) {
  try {
    if (confirm(`Are you sure you want to delete step ${index + 1}?`)) {
      const res = await send({ 
        from: 'panel', 
        type: 'PANEL_DELETE_STEP', 
        index: index
      });
      
      if (res?.ok) {
        showMessage(`Step ${index + 1} deleted successfully`, 'success');
        await refreshSteps();
      } else {
        showMessage('Failed to delete step: ' + (res?.error || 'Unknown error'), 'error');
      }
    }
  } catch (error) {
    console.error('Error deleting step:', error);
    showMessage('Failed to delete step: ' + error.message, 'error');
  }
}

async function highlightStepElement(index) {
  try {
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    if (index >= 0 && index < steps.length) {
      const step = steps[index];
      
      // Get the selected selector from the dropdown
      const dropdown = document.getElementById(`selector-${index}`);
      let selector = null;
      
      if (dropdown && dropdown.value) {
        // Use the selected selector from dropdown (including custom selectors)
        selector = dropdown.value;
        const selectedOption = dropdown.options[dropdown.selectedIndex];
        const isCustom = selectedOption && selectedOption.dataset.type === 'custom';
      } else {
        // Fallback to step's original selector
        selector = step.target?.css;
      }
      
      if (!selector) {
        showMessage('No selector available for this step', 'error');
        return;
      }
      
      
      // Send message to highlight element
      const highlightRes = await send({ 
        from: 'panel', 
        type: 'PANEL_HIGHLIGHT_ELEMENT', 
        selector: selector,
        stepIndex: index
      });
      
      
      if (highlightRes?.ok) {
        showMessage(`Highlighted element for step ${index + 1}`, 'success');
      } else {
        showMessage('Failed to highlight element: ' + (highlightRes?.error || 'Element not found'), 'error');
      }
    } else {
      showMessage('Invalid step index', 'error');
    }
  } catch (error) {
    console.error('Error highlighting step element:', error);
    showMessage('Failed to highlight element: ' + error.message, 'error');
  }
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

// Initialize view state - ensure accordion view is shown by default
accordionViewBtn.classList.add('active');
jsonViewBtn.classList.remove('active');
accordionView.style.display = 'block';
jsonView.classList.add('json-view-hidden');

// Event delegation for accordion interactions
stepsAccordion.addEventListener('click', (event) => {
  try {
    const target = event.target;
    const action = target.getAttribute('data-action');
    const index = target.getAttribute('data-index');
    
    // Check if clicking on accordion header or toggle button
    const accordionHeader = target.closest('.accordion-header');
    const accordionItem = target.closest('.accordion-item');
    
    if (accordionHeader && accordionItem) {
      const stepIndex = accordionItem.getAttribute('data-step-index');
      if (stepIndex !== null) {
        toggleAccordion(parseInt(stepIndex, 10));
        return;
      }
    }
    
    // Handle other actions
    if (action === 'copy' && index !== null) {
      copyStepData(parseInt(index, 10));
    } else if (action === 'edit' && index !== null) {
      editStep(parseInt(index, 10));
    } else if (action === 'highlight' && index !== null) {
      highlightStepElement(parseInt(index, 10));
    } else if (action === 'delete' && index !== null) {
      deleteStep(parseInt(index, 10));
    }
  } catch (error) {
    console.error('Error handling accordion click:', error);
  }
});

// Event delegation for selector dropdowns
stepsAccordion.addEventListener('change', (event) => {
  try {
    if (event.target.classList.contains('selector-dropdown')) {
      const stepIndex = event.target.getAttribute('data-step-index');
      if (stepIndex !== null) {
        handleSelectorChange(event.target, parseInt(stepIndex, 10));
      }
    }
  } catch (error) {
    console.error('Error handling selector change:', error);
  }
});

// Handle selector dropdown change
async function handleSelectorChange(dropdown, stepIndex) {
  try {
    const selectedValue = dropdown.value;
    const selectedOption = dropdown.options[dropdown.selectedIndex];
    
    // Update description
    updateSelectorDescription(dropdown, stepIndex);
    
    // Handle custom selector
    if (selectedValue === 'custom') {
      const customSelector = prompt('Enter custom CSS selector:', '');
      if (customSelector) {
        // Add custom option to dropdown
        const customOption = document.createElement('option');
        customOption.value = customSelector;
        customOption.textContent = `Custom: ${customSelector}`;
        customOption.dataset.type = 'custom';
        customOption.dataset.description = 'Custom CSS selector';
        customOption.selected = true;
        
        // Remove previous custom option if exists
        const existingCustom = dropdown.querySelector('option[data-type="custom"]');
        if (existingCustom && existingCustom.value !== 'custom') {
          existingCustom.remove();
        }
        
        dropdown.insertBefore(customOption, dropdown.lastElementChild);
        
        // Update the step with the new selector
        await updateStepSelector(stepIndex, customSelector);
      } else {
        // Reset to previous selection
        dropdown.selectedIndex = 0;
      }
    } else if (selectedValue && selectedValue !== 'custom') {
      // Update the step with the selected selector
      await updateStepSelector(stepIndex, selectedValue);
    }
    
    // Save selector preference
    saveSelectorPreference(stepIndex, selectedValue);
    
    
  } catch (error) {
    console.error('Error handling selector change:', error);
  }
}

// Update step selector in storage and refresh display
async function updateStepSelector(stepIndex, newSelector) {
  try {
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    if (stepIndex >= 0 && stepIndex < steps.length) {
      const step = steps[stepIndex];
      
      // Update the step's target CSS selector
      const updatedStep = {
        ...step,
        target: {
          ...step.target,
          css: newSelector
        }
      };
      
      // Update the step in storage
      const updateRes = await send({ 
        from: 'panel', 
        type: 'PANEL_UPDATE_STEP', 
        index: stepIndex,
        step: updatedStep
      });
      
      if (updateRes?.ok) {
        // Refresh the accordion to show updated selector
        await refreshSteps();
      } else {
        console.error('Failed to update step selector:', updateRes?.error);
      }
    }
  } catch (error) {
    console.error('Error updating step selector:', error);
  }
}

// Save selector preference
function saveSelectorPreference(stepIndex, selector) {
  try {
    // Get current preferences
    let preferences = JSON.parse(localStorage.getItem('selectorPreferences') || '{}');
    
    // Update preference for this step
    preferences[stepIndex] = selector;
    
    // Save back to localStorage
    localStorage.setItem('selectorPreferences', JSON.stringify(preferences));
    
  } catch (error) {
    console.error('Error saving selector preference:', error);
  }
}

// Load selector preference
function loadSelectorPreference(stepIndex) {
  try {
    const preferences = JSON.parse(localStorage.getItem('selectorPreferences') || '{}');
    return preferences[stepIndex] || null;
  } catch (error) {
    console.error('Error loading selector preference:', error);
    return null;
  }
}

// Make functions globally available for onclick handlers (for backward compatibility)
window.toggleAccordion = toggleAccordion;
window.copyStepData = copyStepData;
window.editStep = editStep;
window.highlightStepElement = highlightStepElement;
window.deleteStep = deleteStep;

// Test function for custom selectors
window.testCustomSelector = async function(stepIndex, customSelector) {
  try {
    
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    if (stepIndex >= 0 && stepIndex < steps.length) {
      // Send message to highlight element
      const highlightRes = await send({ 
        from: 'panel', 
        type: 'PANEL_HIGHLIGHT_ELEMENT', 
        selector: customSelector,
        stepIndex: stepIndex
      });
      
      
      if (highlightRes?.ok) {
        showMessage(`Custom selector "${customSelector}" highlighted successfully`, 'success');
      } else {
        showMessage('Failed to highlight with custom selector: ' + (highlightRes?.error || 'Element not found'), 'error');
      }
    } else {
      showMessage('Invalid step index', 'error');
    }
  } catch (error) {
    console.error('Error testing custom selector:', error);
    showMessage('Failed to test custom selector: ' + error.message, 'error');
  }
};

// Initialize dataset info on page load
function initializeDatasetInfo() {
  try {
    const currentData = JSON.parse(jsonInput.value || '[]');
    updateDatasetInfo(currentData);
    updateDatasetButtons(currentData);
  } catch (error) {
    updateDatasetInfo([]);
    updateDatasetButtons([]);
  }
}

// Additional safety: Remove any potential inline event handlers
function sanitizeHTML(html) {
  // This is a basic sanitization - in a real app you might want to use a proper sanitizer
  return html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

// Generate all possible selectors for a step
function generateSelectorsForStep(step) {
  const selectors = [];
  
  // Skip special step types that don't have selectable elements
  const specialTypes = ['navigate_url', 'find_by_value', 'find_by_index', 'loop_group'];
  if (specialTypes.includes(step.type)) {
    return selectors; // Return empty array for special steps
  }
  
  const sig = step.target?.signature || {};
  
  try {
    // Primary selector (recorded)
    if (step.target?.css) {
      selectors.push({
        value: step.target.css,
        label: `Primary: ${step.target.css}`,
        type: 'primary',
        description: 'Original recorded selector'
      });
    }
    
    // ID-based selectors
    if (sig.id) {
      selectors.push({
        value: `#${sig.id}`,
        label: `ID: #${sig.id}`,
        type: 'id',
        description: 'Element ID selector'
      });
      
      // SAP UI5 fallbacks
      if (sig.id.includes('__xmlview') || sig.id.includes('--')) {
        const controlId = sig.id.split('--').pop();
        if (controlId) {
          selectors.push({
            value: `[id$="${controlId}"]`,
            label: `Control ID: [id$="${controlId}"]`,
            type: 'sap-control',
            description: 'SAP UI5 control ID (ends with)'
          });
          selectors.push({
            value: `[id*="${controlId}"]`,
            label: `Control ID: [id*="${controlId}"]`,
            type: 'sap-control',
            description: 'SAP UI5 control ID (contains)'
          });
        }
      }
    }
    
    // Data attributes
    if (sig.dataTestId) {
      selectors.push({
        value: `[data-testid="${sig.dataTestId}"]`,
        label: `Test ID: [data-testid="${sig.dataTestId}"]`,
        type: 'data-testid',
        description: 'Data test ID (most reliable)'
      });
    }
    
    // Name attribute
    if (sig.nameAttr) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}[name="${sig.nameAttr}"]`,
        label: `Name: ${tag}[name="${sig.nameAttr}"]`,
        type: 'name',
        description: 'Name attribute selector'
      });
    }
    
    // Aria-label selectors
    if (sig.ariaLabel) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}[aria-label="${sig.ariaLabel}"]`,
        label: `Aria Label: ${tag}[aria-label="${sig.ariaLabel}"]`,
        type: 'aria-label',
        description: 'Aria-label selector with tag'
      });
      selectors.push({
        value: `[aria-label="${sig.ariaLabel}"]`,
        label: `Aria Label: [aria-label="${sig.ariaLabel}"]`,
        type: 'aria-label',
        description: 'Aria-label selector (broader)'
      });
    }
    
    // Placeholder selectors
    if (sig.placeholder) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}[placeholder="${sig.placeholder}"]`,
        label: `Placeholder: ${tag}[placeholder="${sig.placeholder}"]`,
        type: 'placeholder',
        description: 'Placeholder selector with tag'
      });
      selectors.push({
        value: `[placeholder="${sig.placeholder}"]`,
        label: `Placeholder: [placeholder="${sig.placeholder}"]`,
        type: 'placeholder',
        description: 'Placeholder selector (broader)'
      });
    }
    
    // Type attribute
    if (sig.type) {
      const tag = sig.tag || 'input';
      selectors.push({
        value: `${tag}[type="${sig.type}"]`,
        label: `Type: ${tag}[type="${sig.type}"]`,
        type: 'type',
        description: 'Input type selector'
      });
    }
    
    // Class-based selectors
    if (sig.classes && sig.classes.length > 0) {
      const tag = sig.tag || '*';
      const classSelector = sig.classes.map(c => `.${c}`).join('');
      selectors.push({
        value: `${tag}${classSelector}`,
        label: `Classes: ${tag}${classSelector}`,
        type: 'classes',
        description: 'Class-based selector with tag'
      });
      selectors.push({
        value: classSelector,
        label: `Classes: ${classSelector}`,
        type: 'classes',
        description: 'Class-based selector (broader)'
      });
    }
    
    // Multiple attribute combinations
    if (sig.ariaLabel && sig.type) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}[aria-label="${sig.ariaLabel}"][type="${sig.type}"]`,
        label: `Combo: aria-label + type`,
        type: 'combination',
        description: 'Aria-label and type combination'
      });
    }
    
    if (sig.ariaLabel && sig.placeholder) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}[aria-label="${sig.ariaLabel}"][placeholder="${sig.placeholder}"]`,
        label: `Combo: aria-label + placeholder`,
        type: 'combination',
        description: 'Aria-label and placeholder combination'
      });
    }
    
    if (sig.placeholder && sig.type) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}[placeholder="${sig.placeholder}"][type="${sig.type}"]`,
        label: `Combo: placeholder + type`,
        type: 'combination',
        description: 'Placeholder and type combination'
      });
    }
    
    // Role attribute
    if (sig.role) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}[role="${sig.role}"]`,
        label: `Role: ${tag}[role="${sig.role}"]`,
        type: 'role',
        description: 'Role attribute selector'
      });
    }
    
    // Text content
    if (sig.textSnippet) {
      const tag = sig.tag || '*';
      selectors.push({
        value: `${tag}:contains("${sig.textSnippet}")`,
        label: `Text: contains "${sig.textSnippet}"`,
        type: 'text',
        description: 'Text content selector'
      });
    }
    
  } catch (error) {
    console.error('Error generating selectors for step:', error);
  }
  
  return selectors;
}

// Populate selector dropdown for a step
function populateSelectorDropdown(dropdown, step, stepIndex) {
  try {
    // Skip if dropdown doesn't exist or step doesn't need selectors
    if (!dropdown || !step.target) {
      return;
    }
    
    const selectors = generateSelectorsForStep(step);
    
    // Clear existing options
    dropdown.innerHTML = '';
    
    if (selectors.length === 0) {
      dropdown.innerHTML = '<option value="">No selectors available</option>';
      return;
    }
    
    // Load saved preference
    const savedPreference = loadSelectorPreference(stepIndex);
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Add options for each selector
    selectors.forEach((selector, index) => {
      const option = document.createElement('option');
      option.value = selector.value;
      option.textContent = selector.label;
      option.dataset.type = selector.type;
      option.dataset.description = selector.description;
      
      // Set selected based on saved preference or primary selector
      if (savedPreference === selector.value) {
        option.selected = true;
      } else if (!savedPreference && selector.type === 'primary') {
        option.selected = true;
      }
      
      fragment.appendChild(option);
    });
    
    // Add custom selector option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom Selector...';
    customOption.dataset.type = 'custom';
    customOption.dataset.description = 'Enter a custom CSS selector';
    fragment.appendChild(customOption);
    
    // Append all options at once
    dropdown.appendChild(fragment);
    
    // Update description
    updateSelectorDescription(dropdown, stepIndex);
    
  } catch (error) {
    console.error('Error populating selector dropdown:', error);
    dropdown.innerHTML = '<option value="">Error loading selectors</option>';
  }
}

// Update selector description
function updateSelectorDescription(dropdown, stepIndex) {
  const selectedOption = dropdown.options[dropdown.selectedIndex];
  const descriptionEl = document.querySelector(`#selector-${stepIndex}`).parentNode.querySelector('.selector-description');
  
  if (descriptionEl && selectedOption) {
    descriptionEl.textContent = selectedOption.dataset.description || 'Select a method for finding this element';
    
    // Update status indicator
    const statusEl = descriptionEl.parentNode.querySelector('.selector-status');
    if (statusEl) {
      statusEl.remove();
    }
    
    if (selectedOption.dataset.type) {
      const status = document.createElement('span');
      status.className = `selector-status ${selectedOption.dataset.type}`;
      status.textContent = selectedOption.dataset.type.toUpperCase();
      descriptionEl.parentNode.appendChild(status);
    }
  }
}

// ============ INSERT STEP MODAL FUNCTIONALITY ============

const insertStepModal = document.getElementById('insertStepModal');
const insertStepBtn = document.getElementById('insertStepBtn');
const closeInsertStepBtn = document.getElementById('closeInsertStepBtn');
const cancelInsertStepBtn = document.getElementById('cancelInsertStepBtn');
const confirmInsertStepBtn = document.getElementById('confirmInsertStepBtn');
const stepTypeOptions = document.querySelectorAll('.step-type-option');

// Form elements
const navigateUrlColumn = document.getElementById('navigateUrlColumn');
const navigateUrlStatic = document.getElementById('navigateUrlStatic');
const findByValueColumn = document.getElementById('findByValueColumn');
const findByValueAction = document.getElementById('findByValueAction');
const findByValueExact = document.getElementById('findByValueExact');
const findByValueCaseSensitive = document.getElementById('findByValueCaseSensitive');
const findByIndexSelector = document.getElementById('findByIndexSelector');
const findByIndexNumber = document.getElementById('findByIndexNumber');
const findByIndexAction = document.getElementById('findByIndexAction');
const loopGroupColumn = document.getElementById('loopGroupColumn');
const loopGroupName = document.getElementById('loopGroupName');
const fileUploadSelector = document.getElementById('fileUploadSelector');
const fileUploadAccept = document.getElementById('fileUploadAccept');
const fileUploadMultiple = document.getElementById('fileUploadMultiple');
const keyPressSelector = document.getElementById('keyPressSelector');
const keyPressKey = document.getElementById('keyPressKey');
const errorReportBtn = document.getElementById('errorReportBtn');

// Extraction form elements
const extractTitleColumn = document.getElementById('extractTitleColumn');
const extractUrlColumn = document.getElementById('extractUrlColumn');
const extractMetadataTitleColumn = document.getElementById('extractMetadataTitleColumn');
const extractMetadataUrlColumn = document.getElementById('extractMetadataUrlColumn');

// Error dialog elements
const errorDialogModal = document.getElementById('errorDialogModal');
const closeErrorDialogBtn = document.getElementById('closeErrorDialogBtn');
const retryStepBtn = document.getElementById('retryStepBtn');
const skipStepBtn = document.getElementById('skipStepBtn');
const stopPlaybackBtn = document.getElementById('stopPlaybackBtn');
const skipAllSimilarErrors = document.getElementById('skipAllSimilarErrors');
const showErrorDetails = document.getElementById('showErrorDetails');
const errorTechnicalDetails = document.getElementById('errorTechnicalDetails');

// Error handling state
let currentErrorStep = null;
let currentErrorIndex = -1;
let errorHandlingResolve = null;
let skipSimilarErrors = new Set();
let errorLog = [];
let errorStats = {
  totalErrors: 0,
  skippedErrors: 0,
  retriedErrors: 0,
  stoppedErrors: 0,
  errorTypes: {}
};

let selectedStepType = null;

// Error Dialog Event Handlers
closeErrorDialogBtn.addEventListener('click', () => {
  errorDialogModal.classList.add('hidden-section');
  if (errorHandlingResolve) {
    errorHandlingResolve({ action: 'close' });
    errorHandlingResolve = null;
  }
});

retryStepBtn.addEventListener('click', () => {
  errorDialogModal.classList.add('hidden-section');
  if (errorHandlingResolve) {
    errorHandlingResolve({ action: 'retry' });
    errorHandlingResolve = null;
  }
});

skipStepBtn.addEventListener('click', () => {
  errorDialogModal.classList.add('hidden-section');
  if (errorHandlingResolve) {
    errorHandlingResolve({ action: 'skip' });
    errorHandlingResolve = null;
  }
});

stopPlaybackBtn.addEventListener('click', () => {
  errorDialogModal.classList.add('hidden-section');
  if (errorHandlingResolve) {
    errorHandlingResolve({ action: 'stop' });
    errorHandlingResolve = null;
  }
});

showErrorDetails.addEventListener('change', () => {
  if (showErrorDetails.checked) {
    errorTechnicalDetails.classList.remove('hidden-section');
  } else {
    errorTechnicalDetails.classList.add('hidden-section');
  }
});

// Error handling functions
function showErrorDialog(step, stepIndex, error, context = {}) {
  return new Promise((resolve) => {
    errorHandlingResolve = resolve;
    currentErrorStep = step;
    currentErrorIndex = stepIndex;
    
    // Update dialog content
    document.getElementById('errorStepNumber').textContent = stepIndex + 1;
    document.getElementById('errorStepType').textContent = getStepTypeName(step.type);
    
    // Format step details
    let stepDetails = `Type: ${step.type}`;
    if (step.target?.css) {
      stepDetails += `\nSelector: ${step.target.css}`;
    }
    if (step.originalTextSample) {
      stepDetails += `\nText: ${step.originalTextSample.substring(0, 100)}`;
    }
    if (step.url) {
      stepDetails += `\nURL: ${step.url}`;
    }
    document.getElementById('errorStepDetails').textContent = stepDetails;
    
    // Update error message
    document.getElementById('errorMessage').textContent = error.message || error;
    
    // Update context
    let contextText = '';
    if (context.url) contextText += `Current URL: ${context.url}\n`;
    if (context.timestamp) contextText += `Time: ${new Date(context.timestamp).toLocaleString()}\n`;
    if (context.userAgent) contextText += `Browser: ${context.userAgent.substring(0, 100)}...\n`;
    if (context.stepCount) contextText += `Total Steps: ${context.stepCount}\n`;
    if (context.currentRow) contextText += `Current Row: ${context.currentRow + 1}\n`;
    
    document.getElementById('errorContext').textContent = contextText || 'No additional context available';
    
    // Update technical details
    const stackTrace = error.stack || error.toString();
    document.getElementById('errorStackTrace').textContent = stackTrace;
    
    // Reset checkboxes
    skipAllSimilarErrors.checked = false;
    showErrorDetails.checked = false;
    errorTechnicalDetails.classList.add('hidden-section');
    
    // Show dialog
    errorDialogModal.classList.remove('hidden-section');
  });
}

function logError(step, stepIndex, error, context, action) {
  const errorEntry = {
    timestamp: Date.now(),
    step: step,
    stepIndex: stepIndex,
    error: error,
    context: context,
    action: action
  };
  
  errorLog.push(errorEntry);
  errorStats.totalErrors++;
  
  // Track error types
  const errorType = `${step.type}_${error.name || 'Error'}`;
  errorStats.errorTypes[errorType] = (errorStats.errorTypes[errorType] || 0) + 1;
  
  // Track action types
  if (action === 'skip') errorStats.skippedErrors++;
  else if (action === 'retry') errorStats.retriedErrors++;
  else if (action === 'stop') errorStats.stoppedErrors++;
  
}

function getErrorReport() {
  return {
    stats: errorStats,
    recentErrors: errorLog.slice(-10), // Last 10 errors
    skipList: Array.from(skipSimilarErrors)
  };
}

function clearErrorLog() {
  errorLog = [];
  errorStats = {
    totalErrors: 0,
    skippedErrors: 0,
    retriedErrors: 0,
    stoppedErrors: 0,
    errorTypes: {}
  };
  skipSimilarErrors.clear();
}

function showErrorReport() {
  const report = getErrorReport();
  
  // Create error report dialog
  const dialog = document.createElement('div');
  dialog.className = 'error-report-modal';
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 20px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  `;
  
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
      <h3 style="margin: 0; color: #1f2937;">⚠️ Error Report</h3>
      <button id="closeErrorReportBtn" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="color: #374151; margin-bottom: 10px;">📊 Statistics</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 15px;">
        <div style="background: #f3f4f6; padding: 10px; border-radius: 6px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${report.stats.totalErrors}</div>
          <div style="font-size: 12px; color: #6b7280;">Total Errors</div>
        </div>
        <div style="background: #fef3c7; padding: 10px; border-radius: 6px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #d97706;">${report.stats.skippedErrors}</div>
          <div style="font-size: 12px; color: #6b7280;">Skipped</div>
        </div>
        <div style="background: #d1fae5; padding: 10px; border-radius: 6px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #059669;">${report.stats.retriedErrors}</div>
          <div style="font-size: 12px; color: #6b7280;">Retried</div>
        </div>
        <div style="background: #fee2e2; padding: 10px; border-radius: 6px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${report.stats.stoppedErrors}</div>
          <div style="font-size: 12px; color: #6b7280;">Stopped</div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="color: #374151; margin-bottom: 10px;">🔍 Error Types</h4>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px;">
        ${Object.entries(report.stats.errorTypes).map(([type, count]) => 
          `<div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
            <span style="font-family: monospace; font-size: 13px;">${type}</span>
            <span style="font-weight: bold; color: #dc2626;">${count}</span>
          </div>`
        ).join('') || '<div style="color: #6b7280; font-style: italic;">No errors recorded</div>'}
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="color: #374151; margin-bottom: 10px;">📝 Recent Errors</h4>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; max-height: 200px; overflow-y: auto;">
        ${report.recentErrors.map(error => `
          <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: bold; color: #374151;">Step ${error.stepIndex + 1}: ${error.step.type}</div>
            <div style="font-size: 12px; color: #6b7280; margin: 2px 0;">${error.error.message}</div>
            <div style="font-size: 11px; color: #9ca3af;">${new Date(error.timestamp).toLocaleString()} - ${error.action}</div>
          </div>
        `).join('') || '<div style="color: #6b7280; font-style: italic;">No recent errors</div>'}
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button id="clearErrorLogBtn" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Clear Log</button>
      <button id="exportErrorReportBtn" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Export Report</button>
      <button id="closeErrorReportBtn2" style="background: #374151; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Close</button>
    </div>
  `;
  
  dialog.appendChild(content);
  document.body.appendChild(dialog);
  
  // Event handlers
  const closeBtn = document.getElementById('closeErrorReportBtn');
  const closeBtn2 = document.getElementById('closeErrorReportBtn2');
  const clearBtn = document.getElementById('clearErrorLogBtn');
  const exportBtn = document.getElementById('exportErrorReportBtn');
  
  const closeDialog = () => {
    document.body.removeChild(dialog);
  };
  
  closeBtn.onclick = closeDialog;
  closeBtn2.onclick = closeDialog;
  
  clearBtn.onclick = () => {
    if (confirm('Are you sure you want to clear the error log?')) {
      clearErrorLog();
      closeDialog();
      showMessage('Error log cleared', 'success');
    }
  };
  
  exportBtn.onclick = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      ...report
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showMessage('Error report exported', 'success');
  };
}

function handleStepError(step, stepIndex, error, context = {}) {
  // Check if we should skip similar errors
  const errorKey = `${step.type}_${error.message}`;
  if (skipSimilarErrors.has(errorKey)) {
    logError(step, stepIndex, error, context, 'skip');
    return Promise.resolve({ action: 'skip' });
  }
  
  // Show error dialog
  return showErrorDialog(step, stepIndex, error, context).then(result => {
    // Log the error and action
    logError(step, stepIndex, error, context, result.action);
    
    // Handle "skip all similar errors" option
    if (result.action === 'skip' && skipAllSimilarErrors.checked) {
      skipSimilarErrors.add(errorKey);
    }
    
    return result;
  });
}

// Error Report Button
errorReportBtn.addEventListener('click', () => {
  showErrorReport();
});

// Open Insert Step Modal
insertStepBtn.addEventListener('click', () => {
  insertStepModal.classList.remove('hidden-section');
  selectedStepType = null;
  resetInsertStepModal();
  populateColumnDropdowns();
});

// Close Insert Step Modal
function closeInsertStepModal() {
  insertStepModal.classList.add('hidden-section');
  resetInsertStepModal();
}

closeInsertStepBtn.addEventListener('click', closeInsertStepModal);
cancelInsertStepBtn.addEventListener('click', closeInsertStepModal);

// Close modal when clicking outside
insertStepModal.addEventListener('click', (event) => {
  if (event.target === insertStepModal) {
    closeInsertStepModal();
  }
});

// Prevent modal content clicks from closing modal
document.querySelector('.insert-step-content').addEventListener('click', (event) => {
  event.stopPropagation();
});

// Reset modal state
function resetInsertStepModal() {
  selectedStepType = null;
  
  // Reset all step type options
  stepTypeOptions.forEach(option => {
    option.classList.remove('selected');
  });
  
  // Hide all forms
  document.querySelectorAll('.step-config-form').forEach(form => {
    form.style.display = 'none';
  });
  
  // Reset form values
  if (navigateUrlColumn) navigateUrlColumn.value = '';
  if (navigateUrlStatic) navigateUrlStatic.value = '';
  if (findByValueColumn) findByValueColumn.value = '';
  if (findByValueAction) findByValueAction.value = 'click';
  if (findByValueExact) findByValueExact.checked = false;
  if (findByValueCaseSensitive) findByValueCaseSensitive.checked = false;
  if (findByIndexSelector) findByIndexSelector.value = '';
  if (findByIndexNumber) findByIndexNumber.value = '0';
  if (findByIndexAction) findByIndexAction.value = 'click';
  if (loopGroupColumn) loopGroupColumn.value = '';
  if (loopGroupName) loopGroupName.value = '';
  
  confirmInsertStepBtn.disabled = true;
}

// Populate column dropdowns from dataset
function populateColumnDropdowns() {
  try {
    const data = JSON.parse(jsonInput.value || '[]');
    if (!Array.isArray(data) || data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    const dropdowns = [navigateUrlColumn, findByValueColumn, loopGroupColumn];
    
    dropdowns.forEach(dropdown => {
      if (!dropdown) return;
      
      dropdown.innerHTML = '<option value="">-- Select Column --</option>';
      columns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        dropdown.appendChild(option);
      });
    });
  } catch (error) {
    console.error('Error populating column dropdowns:', error);
  }
}

// Handle step type selection
stepTypeOptions.forEach(option => {
  option.addEventListener('click', () => {
    // Remove selected class from all options
    stepTypeOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Add selected class to clicked option
    option.classList.add('selected');
    
    // Get selected type
    selectedStepType = option.getAttribute('data-type');
    
    // Hide all forms
    document.querySelectorAll('.step-config-form').forEach(form => {
      form.classList.add('hidden-form');
    });
    
    // Show appropriate form
    switch (selectedStepType) {
      case 'navigate_url':
        document.getElementById('navigateUrlForm').classList.remove('hidden-form');
        break;
      case 'find_by_value':
        document.getElementById('findByValueForm').classList.remove('hidden-form');
        break;
      case 'find_by_index':
        document.getElementById('findByIndexForm').classList.remove('hidden-form');
        break;
      case 'loop_group_start':
        document.getElementById('loopGroupStartForm').classList.remove('hidden-form');
        break;
      case 'loop_group_end':
        document.getElementById('loopGroupEndForm').classList.remove('hidden-form');
        break;
      case 'file_upload':
        document.getElementById('fileUploadForm').classList.remove('hidden-form');
        break;
      case 'key_press':
        document.getElementById('keyPressForm').classList.remove('hidden-form');
        break;
      case 'extract_title':
        document.getElementById('extractTitleForm').classList.remove('hidden-form');
        break;
      case 'extract_url':
        document.getElementById('extractUrlForm').classList.remove('hidden-form');
        break;
      case 'extract_metadata':
        document.getElementById('extractMetadataForm').classList.remove('hidden-form');
        break;
    }
    
    // Enable insert button
    confirmInsertStepBtn.disabled = false;
  });
});

// Confirm and insert step
confirmInsertStepBtn.addEventListener('click', async () => {
  if (!selectedStepType) return;
  
  try {
    const step = buildStepFromForm(selectedStepType);
    
    if (!step) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    // Add new step at the end
    steps.push(step);
    
    // Save updated steps
    const updateRes = await send({ 
      from: 'panel', 
      type: 'PANEL_SET_STEPS', 
      steps: steps
    });
    
    if (updateRes?.ok) {
      showMessage(`Step "${getStepTypeName(selectedStepType)}" inserted successfully`, 'success');
      await refreshSteps();
      closeInsertStepModal();
    } else {
      alert('Failed to insert step: ' + (updateRes?.error || 'Unknown error'));
    }
    
  } catch (error) {
    console.error('Error inserting step:', error);
    alert('Error inserting step: ' + error.message);
  }
});

// Build step object from form data
function buildStepFromForm(stepType) {
  const baseStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    url: location.href
  };
  
  switch (stepType) {
    case 'navigate_url': {
      const column = navigateUrlColumn.value;
      const staticUrl = navigateUrlStatic.value;
      
      if (!column && !staticUrl) return null;
      
      return {
        ...baseStep,
        type: 'navigate_url',
        column: column || null,
        value: staticUrl || null,
        url: staticUrl || `{${column}}`
      };
    }
    
    case 'find_by_value': {
      const column = findByValueColumn.value;
      if (!column) return null;
      
      return {
        ...baseStep,
        type: 'find_by_value',
        column: column,
        action: findByValueAction.value,
        options: {
          exactMatch: findByValueExact.checked,
          caseSensitive: findByValueCaseSensitive.checked
        }
      };
    }
    
    case 'find_by_index': {
      const selector = findByIndexSelector.value;
      const index = findByIndexNumber.value;
      
      if (!selector) return null;
      
      return {
        ...baseStep,
        type: 'find_by_index',
        selector: selector,
        index: parseInt(index, 10),
        action: findByIndexAction.value
      };
    }
    
    case 'loop_group_start': {
      const column = loopGroupColumn.value;
      if (!column) return null;
      
      return {
        ...baseStep,
        type: 'loop_group',
        action: 'start',
        groupBy: column,
        name: loopGroupName.value || column
      };
    }
    
    case 'loop_group_end': {
      return {
        ...baseStep,
        type: 'loop_group',
        action: 'end'
      };
    }
    
    case 'file_upload': {
      const selector = fileUploadSelector.value;
      if (!selector) return null;
      
      return {
        ...baseStep,
        type: 'file_upload',
        target: { css: selector, signature: {} },
        accept: fileUploadAccept.value || '',
        multiple: fileUploadMultiple.checked
      };
    }
    
    case 'key_press': {
      const selector = keyPressSelector.value;
      const key = keyPressKey.value;
      if (!selector || !key) return null;
      
      return {
        ...baseStep,
        type: 'key_press',
        target: { css: selector, signature: {} },
        key: key,
        code: getKeyCode(key)
      };
    }
    
    case 'extract_title': {
      const column = extractTitleColumn.value;
      
      return {
        ...baseStep,
        type: 'extract_title',
        target: { css: 'body', signature: {} },
        column: column || null
      };
    }
    
    case 'extract_url': {
      const column = extractUrlColumn.value;
      
      return {
        ...baseStep,
        type: 'extract_url',
        target: { css: 'body', signature: {} },
        column: column || null
      };
    }
    
    case 'extract_metadata': {
      const titleColumn = extractMetadataTitleColumn.value;
      const urlColumn = extractMetadataUrlColumn.value;
      
      return {
        ...baseStep,
        type: 'extract_metadata',
        target: { css: 'body', signature: {} },
        titleColumn: titleColumn || null,
        urlColumn: urlColumn || null
      };
    }
    
    default:
      return null;
  }
}

// Helper function to get key code for keyboard events
function getKeyCode(key) {
  const keyCodes = {
    'Tab': 9,
    'Enter': 13,
    'Escape': 27,
    'ArrowUp': 38,
    'ArrowDown': 40,
    'ArrowLeft': 37,
    'ArrowRight': 39,
    'Home': 36,
    'End': 35,
    'PageUp': 33,
    'PageDown': 34,
    'Backspace': 8,
    'Delete': 46,
    'Insert': 45,
    'F1': 112,
    'F2': 113,
    'F3': 114,
    'F4': 115,
    'F5': 116,
    'F6': 117,
    'F7': 118,
    'F8': 119,
    'F9': 120,
    'F10': 121,
    'F11': 122,
    'F12': 123
  };
  return keyCodes[key] || 0;
}

// Get friendly step type name
function getStepTypeName(stepType) {
  const names = {
    'navigate_url': 'Navigate URL',
    'find_by_value': 'Find By Value',
    'find_by_index': 'Find By Index',
    'loop_group_start': 'Loop Start',
    'loop_group_end': 'Loop End',
    'file_upload': 'File Upload',
    'key_press': 'Key Press',
    'extract_title': 'Extract Title',
    'extract_url': 'Extract URL',
    'extract_metadata': 'Extract Metadata'
  };
  return names[stepType] || stepType;
}

// ============ DATA GROUPING & PREVIEW ============

// Analyze and preview grouping
async function analyzeDataGrouping() {
  try {
    const data = JSON.parse(jsonInput.value || '[]');
    if (!Array.isArray(data) || data.length === 0) {
      return { hasGroups: false, preview: 'No dataset loaded' };
    }
    
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    // Find loop group columns
    const loopColumns = [];
    for (const step of steps) {
      if (step.type === 'loop_group' && step.action === 'start' && step.groupBy) {
        loopColumns.push(step.groupBy);
      }
    }
    
    if (loopColumns.length === 0) {
      return { hasGroups: false, preview: 'No loop groups defined' };
    }
    
    // Use data grouping engine if available
    if (typeof window !== 'undefined' && window.__mvpDataGrouping) {
      const hierarchy = window.__mvpDataGrouping.detectHierarchy(data, loopColumns);
      const preview = window.__mvpDataGrouping.generateExecutionPreview(hierarchy);
      return { hasGroups: true, preview: preview.summary, hierarchy };
    }
    
    return { hasGroups: false, preview: 'Data grouping engine not loaded' };
    
  } catch (error) {
    console.error('Error analyzing data grouping:', error);
    return { hasGroups: false, preview: 'Error analyzing data' };
  }
}

// Old playBtn code removed - functionality moved to stopPlayBtn

// Collapsible sections functionality
function initializeCollapsibleSections() {
  const sectionHeaders = document.querySelectorAll('.section-header');
  
  sectionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.section');
      const content = section.querySelector('.section-content');
      const toggle = header.querySelector('.section-toggle');
      
      if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        toggle.classList.remove('collapsed');
      } else {
        content.classList.add('collapsed');
        toggle.classList.add('collapsed');
      }
    });
  });
}

// Initialize button states
function initializeButtonStates() {
  // Set initial button states
  stopPlayBtn.textContent = 'Play All';
  stopPlayBtn.disabled = false;
  pauseResumeBtn.disabled = true;
  pauseResumeBtn.textContent = 'Pause';
  startBtn.disabled = false;
  
  // Reset state variables
  isRecording = false;
  isPaused = false;
  isPlaying = false;
}

// ============ PRELOADED FLOWS FUNCTIONALITY ============

// Preloaded Flows UI Elements
const preloadedFlowsList = document.getElementById('preloadedFlowsList');
const preloadedFlowActions = document.getElementById('preloadedFlowActions');
const preloadedFlowInfo = document.getElementById('preloadedFlowInfo');
const loadPreloadedFlowBtn = document.getElementById('loadPreloadedFlowBtn');
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
const importPreloadedCsvBtn = document.getElementById('importPreloadedCsvBtn');
const preloadedCsvFileInput = document.getElementById('preloadedCsvFileInput');

let selectedPreloadedFlow = null;

// Initialize preloaded flows
async function initializePreloadedFlows() {
  try {
    // Load preloaded flows data
    if (typeof PRELOADED_FLOWS === 'undefined') {
      console.error('PRELOADED_FLOWS not loaded');
      return;
    }

    renderPreloadedFlowsList();
    bindPreloadedFlowEvents();
  } catch (error) {
    console.error('Error initializing preloaded flows:', error);
    showMessage('Failed to load preloaded flows', 'error');
  }
}

// Render the list of preloaded flows
function renderPreloadedFlowsList() {
  if (!preloadedFlowsList || typeof PRELOADED_FLOWS === 'undefined') return;

  const flows = Object.values(PRELOADED_FLOWS);
  
  preloadedFlowsList.innerHTML = flows.map(flow => `
    <div class="preloaded-flow-card" data-flow-id="${flow.id}">
      <div class="preloaded-flow-header">
        <h4 class="preloaded-flow-title">${flow.name}</h4>
        <span class="preloaded-flow-badge">${flow.category}</span>
      </div>
      <p class="preloaded-flow-description">${flow.description}</p>
      <div class="preloaded-flow-meta">
        <span>📊 ${flow.steps.length} steps</span>
        <span>📁 CSV template included</span>
        <span>v${flow.version}</span>
      </div>
      <div class="preloaded-flow-steps">
        ${flow.steps.slice(0, 3).map(step => `
          <div class="preloaded-flow-step">
            <div class="preloaded-flow-step-icon ${step.type}">${getStepIcon(step.type)}</div>
            <span>${getStepTitle(step, 0).title}</span>
          </div>
        `).join('')}
        ${flow.steps.length > 3 ? `<div class="preloaded-flow-step"><span>... and ${flow.steps.length - 3} more steps</span></div>` : ''}
      </div>
    </div>
  `).join('');
}

// Bind event handlers for preloaded flows
function bindPreloadedFlowEvents() {
  // Flow card selection
  preloadedFlowsList.addEventListener('click', (e) => {
    const card = e.target.closest('.preloaded-flow-card');
    if (!card) return;

    const flowId = card.dataset.flowId;
    selectPreloadedFlow(flowId);
  });

  // Load flow button
  loadPreloadedFlowBtn.addEventListener('click', loadSelectedPreloadedFlow);

  // Download template button
  downloadTemplateBtn.addEventListener('click', downloadPreloadedTemplate);

  // Import CSV button
  importPreloadedCsvBtn.addEventListener('click', () => {
    preloadedCsvFileInput.click();
  });

  // CSV file input
  preloadedCsvFileInput.addEventListener('change', handlePreloadedCsvImport);
}

// Select a preloaded flow
function selectPreloadedFlow(flowId) {
  if (!PRELOADED_FLOWS[flowId]) return;

  // Remove previous selection
  document.querySelectorAll('.preloaded-flow-card').forEach(card => {
    card.classList.remove('selected');
  });

  // Add selection to clicked card
  const card = document.querySelector(`[data-flow-id="${flowId}"]`);
  if (card) {
    card.classList.add('selected');
  }

  selectedPreloadedFlow = PRELOADED_FLOWS[flowId];
  showPreloadedFlowDetails(selectedPreloadedFlow);
  preloadedFlowActions.classList.remove('hidden-section');
}

// Show details for selected preloaded flow
function showPreloadedFlowDetails(flow) {
  if (!preloadedFlowInfo) return;

  const csvPreview = flow.csvTemplate.slice(0, 2).map(row => 
    Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(', ')
  ).join('\n');

  preloadedFlowInfo.innerHTML = `
    <div>
      <strong>${flow.name}</strong> - ${flow.description}
    </div>
    <div class="preloaded-flow-steps">
      <strong>Steps:</strong>
      ${flow.steps.map((step, index) => `
        <div class="preloaded-flow-step">
          <div class="preloaded-flow-step-icon ${step.type}">${getStepIcon(step.type)}</div>
          <span>${index + 1}. ${getStepTitle(step, index).title}</span>
        </div>
      `).join('')}
    </div>
    <div>
      <strong>Instructions:</strong> ${flow.instructions}
    </div>
    <div class="template-preview">
      <strong>CSV Template Preview:</strong><br>
      <pre>${csvPreview}</pre>
    </div>
  `;
}

// Load selected preloaded flow
async function loadSelectedPreloadedFlow() {
  if (!selectedPreloadedFlow) {
    showMessage('Please select a preloaded flow first', 'error');
    return;
  }

  try {
    // Load the steps into the current flow
    const res = await send({ 
      from: 'panel', 
      type: 'PANEL_SET_STEPS', 
      steps: selectedPreloadedFlow.steps
    });

    if (res?.ok) {
      showMessage(`Loaded "${selectedPreloadedFlow.name}" flow with ${selectedPreloadedFlow.steps.length} steps`, 'success');
      await refreshSteps();
    } else {
      showMessage('Failed to load flow: ' + (res?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Error loading preloaded flow:', error);
    showMessage('Failed to load flow: ' + error.message, 'error');
  }
}

// Download CSV template for selected flow
function downloadPreloadedTemplate() {
  if (!selectedPreloadedFlow) {
    showMessage('Please select a preloaded flow first', 'error');
    return;
  }

  try {
    const csvContent = convertToCSV(selectedPreloadedFlow.csvTemplate);
    downloadBlob(`${selectedPreloadedFlow.id}-template.csv`, 'text/csv', csvContent);
    showMessage(`Downloaded template for "${selectedPreloadedFlow.name}"`, 'success');
  } catch (error) {
    console.error('Error downloading template:', error);
    showMessage('Failed to download template: ' + error.message, 'error');
  }
}

// Handle CSV import for preloaded flow
function handlePreloadedCsvImport(event) {
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

      // Validate CSV structure against the template
      const templateKeys = Object.keys(selectedPreloadedFlow.csvTemplate[0] || {});
      const csvKeys = Object.keys(jsonData[0] || {});
      
      const missingKeys = templateKeys.filter(key => !csvKeys.includes(key));
      if (missingKeys.length > 0) {
        showMessage(`CSV is missing required columns: ${missingKeys.join(', ')}`, 'error');
        return;
      }

      // Load the data into the dataset
      loadDatasetIntoTextarea(jsonData);
      showMessage(`Successfully imported ${jsonData.length} rows for "${selectedPreloadedFlow.name}" flow`, 'success');

    } catch (error) {
      showMessage('Error parsing CSV: ' + error.message, 'error');
    }
  };

  reader.onerror = () => {
    showMessage('Error reading file', 'error');
  };

  reader.readAsText(file);

  // Reset file input
  event.target.value = '';
}

// Convert array of objects to CSV
function convertToCSV(data) {
  if (!Array.isArray(data) || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ];

  return csvRows.join('\n');
}

// Get step icon for preloaded flows
function getStepIcon(type) {
  const icons = {
    'click': '🖱️',
    'input': '⌨️',
    'text_selection': '📝',
    'shortcut': '⌨️',
    'copy': '📋',
    'cut': '✂️',
    'paste': '📋',
    'navigate_url': '🌐',
    'find_by_value': '🔍',
    'find_by_index': '🔢',
    'loop_group': '🔄'
  };
  return icons[type] || '❓';
}

// Get step title for preloaded flows
function getStepTitle(step, index) {
  if (step.type === 'navigate_url') {
    return {
      title: 'Navigate to URL',
      subtitle: step.column ? `Column: ${step.column}` : (step.value || step.url || 'URL')
    };
  }
  
  if (step.type === 'find_by_value') {
    return {
      title: 'Find By Value',
      subtitle: `Column: ${step.column} → ${step.action || 'click'}`
    };
  }
  
  if (step.type === 'find_by_index') {
    return {
      title: 'Find By Index',
      subtitle: `${step.selector} [${step.index}] → ${step.action || 'click'}`
    };
  }
  
  if (step.type === 'loop_group') {
    return {
      title: step.action === 'start' ? 'Loop Start' : 'Loop End',
      subtitle: step.action === 'start' ? `Group by: ${step.groupBy || step.name || 'unknown'}` : 'End of loop'
    };
  }
  
  const titles = {
    'click': 'Click Element',
    'input': 'Input Text',
    'text_selection': 'Select & Replace Text',
    'shortcut': 'Keyboard Shortcut',
    'copy': 'Copy Text',
    'cut': 'Cut Text',
    'paste': 'Paste Text'
  };
  
  const baseTitle = titles[step.type] || `Step ${index + 1}`;
  return { title: baseTitle, subtitle: '' };
}

// init
(async function(){ 
  initializeButtonStates();
  await refreshSteps(); 
  await refreshFlowsList(); 
  await refreshClips(); 
  initializeDatasetInfo();
  initializeCollapsibleSections();
  await initializePreloadedFlows();
})();
