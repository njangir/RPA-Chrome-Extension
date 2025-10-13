
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

// Dataset Header Buttons UI
const datasetButtonsSection = document.getElementById('datasetButtonsSection');
const datasetButtons = document.getElementById('datasetButtons');

// Start URL UI
const startUrlDisplay = document.getElementById('startUrlDisplay');
const navigateToStartBtn = document.getElementById('navigateToStartBtn');

// Test Flow UI
const testFlowBtn = document.getElementById('testFlowBtn');
const testFlowModal = document.getElementById('testFlowModal');
const closeTestFlowBtn = document.getElementById('closeTestFlowBtn');
const currentStepNumber = document.getElementById('currentStepNumber');
const totalSteps = document.getElementById('totalSteps');
const stepDescription = document.getElementById('stepDescription');
const highlightDetails = document.getElementById('highlightDetails');
const highlightElementBtn = document.getElementById('highlightElementBtn');
const recheckElementBtn = document.getElementById('recheckElementBtn');
const changeSelectorBtn = document.getElementById('changeSelectorBtn');
const testSelectorDropdown = document.getElementById('testSelectorDropdown');
// Removed executeStepBtn - no longer needed
const confirmElementBtn = document.getElementById('confirmElementBtn');
const skipStepBtn = document.getElementById('skipStepBtn');
const stopTestBtn = document.getElementById('stopTestBtn');
const testProgressFill = document.getElementById('testProgressFill');
const testProgressText = document.getElementById('testProgressText');

function send(msg){ return new Promise((resolve)=> chrome.runtime.sendMessage(msg, resolve)); }

// Test Flow State Management
let testFlowState = {
  isActive: false,
  currentStepIndex: 0,
  steps: [],
  currentElement: null,
  currentSelector: null,
  skippedSteps: new Set(),
  testResults: []
};

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
            console.log('Could not send message to content script:', chrome.runtime.lastError.message);
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
      console.log('Text copied to clipboard:', text);
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
  stepsJsonEl.textContent = JSON.stringify(steps, null, 2);
  renderAccordion(steps);
  
  // Show/hide test flow button based on steps
  if (steps.length > 0) {
    testFlowBtn.classList.remove('hidden-button');
  } else {
    testFlowBtn.classList.add('hidden-button');
  }
  
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
    // Get start URL for navigation
    let startUrl = null;
    try {
      const urlRes = await send({ from: 'panel', type: 'PANEL_GET_START_URL' });
      startUrl = urlRes?.startUrl;
    } catch (error) {
      console.warn('Could not get start URL:', error);
    }
    
    const res = await send({ 
      from:'panel', 
      type:'PANEL_PLAY_ALL', 
      rows: playRows, 
      interactive,
      startUrl 
    });
    if (!res?.ok) throw new Error(res?.error || 'Playback failed');
    alert(`Played ${playRows.length} item(s).`);
  } catch(err){ alert(String(err.message || err)); }
  finally { playBtn.disabled = false; loopControls.style.display = 'none'; }
};

chrome.runtime.onMessage.addListener((msg) => {
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
  }
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
        <div class="accordion-header">
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
            <button class="btn-small" data-action="highlight" data-index="${index}">🔍 Highlight</button>
            <button class="btn-small" data-action="delete" data-index="${index}">🗑️ Delete</button>
          </div>
          <div class="selector-selection">
            <label for="selector-${index}" class="selector-label">Choose Selector:</label>
            <select id="selector-${index}" class="selector-dropdown" data-step-index="${index}">
              <option value="">Loading selectors...</option>
            </select>
            <div class="selector-info">
              <small class="selector-description">Select which method to use for finding this element</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  stepsAccordion.innerHTML = sanitizeHTML(accordionHTML);
  
  // Populate selector dropdowns
  steps.forEach((step, index) => {
    const dropdown = document.getElementById(`selector-${index}`);
    if (dropdown) {
      populateSelectorDropdown(dropdown, step, index);
    }
  });
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
      console.log('Copied step data:', stepData);
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
      const selector = step.target?.css;
      
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
function handleSelectorChange(dropdown, stepIndex) {
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
      } else {
        // Reset to previous selection
        dropdown.selectedIndex = 0;
      }
    }
    
    // Save selector preference
    saveSelectorPreference(stepIndex, selectedValue);
    
    console.log(`Step ${stepIndex} selector changed to:`, selectedValue);
    
  } catch (error) {
    console.error('Error handling selector change:', error);
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
    const selectors = generateSelectorsForStep(step);
    
    // Clear existing options
    dropdown.innerHTML = '';
    
    if (selectors.length === 0) {
      dropdown.innerHTML = '<option value="">No selectors available</option>';
      return;
    }
    
    // Load saved preference
    const savedPreference = loadSelectorPreference(stepIndex);
    
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
      
      dropdown.appendChild(option);
    });
    
    // Add custom selector option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom Selector...';
    customOption.dataset.type = 'custom';
    customOption.dataset.description = 'Enter a custom CSS selector';
    dropdown.appendChild(customOption);
    
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

// Test Flow Functions
async function startTestFlow() {
  try {
    console.log('Starting test flow...');
    
    // Get current steps
    const res = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (res && res.steps) || [];
    
    if (steps.length === 0) {
      alert('No steps recorded to test');
      return;
    }
    
    // Initialize test flow state
    testFlowState = {
      isActive: true,
      currentStepIndex: 0,
      steps: steps,
      currentElement: null,
      currentSelector: null,
      skippedSteps: new Set(),
      testResults: []
    };
    
    // Show modal
    console.log('Showing modal...');
    testFlowModal.classList.remove('hidden-section');
    
    // Start first step
    await processCurrentTestStep();
    
  } catch (error) {
    console.error('Error starting test flow:', error);
    alert('Error starting test flow: ' + error.message);
  }
}

async function processCurrentTestStep() {
  if (!testFlowState.isActive || testFlowState.currentStepIndex >= testFlowState.steps.length) {
    await finishTestFlow();
    return;
  }
  
  const step = testFlowState.steps[testFlowState.currentStepIndex];
  
  // Update UI
  currentStepNumber.textContent = testFlowState.currentStepIndex + 1;
  totalSteps.textContent = testFlowState.steps.length;
  
  // Update step description
  const stepTitle = getStepTitle(step, testFlowState.currentStepIndex);
  stepDescription.textContent = `${stepTitle.title}: ${stepTitle.subtitle}`;
  
  // Update progress
  const progress = ((testFlowState.currentStepIndex) / testFlowState.steps.length) * 100;
  testProgressFill.style.width = `${progress}%`;
  testProgressText.textContent = `${Math.round(progress)}% Complete`;
  
  // Try to find element
  await findElementForStep(step);
}

async function findElementForStep(step) {
  try {
    highlightDetails.innerHTML = `
      <div style="color: #f59e0b; font-weight: bold;">🔍 Looking for element...</div>
      <div><strong>Step:</strong> ${step.type}</div>
    `;
    
    // Send message to find and highlight element
    const res = await send({ 
      from: 'panel', 
      type: 'PANEL_TEST_FIND_ELEMENT', 
      stepIndex: testFlowState.currentStepIndex,
      step: step
    });
    
    if (res?.ok && res.element) {
      testFlowState.currentElement = res.element;
      testFlowState.currentSelector = res.selector;
      
      highlightDetails.innerHTML = `
        <div style="color: #10b981; font-weight: bold;">✅ Element found!</div>
        <div><strong>Selector:</strong> ${res.selector}</div>
        <div><strong>Tag:</strong> ${res.element.tagName}</div>
        <div><strong>ID:</strong> ${res.element.id || 'None'}</div>
        <div><strong>Classes:</strong> ${res.element.className || 'None'}</div>
        <div><strong>Text:</strong> ${res.element.textContent?.substring(0, 100) || 'None'}</div>
      `;
      
      // Populate selector dropdown
      populateTestSelectorDropdown(step);
      
      // Enable buttons
      highlightElementBtn.disabled = false;
      highlightElementBtn.textContent = '🔍 Highlight Element';
    } else {
      highlightDetails.innerHTML = `
        <div style="color: #ef4444; font-weight: bold;">❌ Element not found</div>
        <div><strong>Error:</strong> ${res?.error || 'Unknown error'}</div>
        <div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
          Try changing the selector using the dropdown below.
        </div>
      `;
      highlightElementBtn.disabled = true;
      highlightElementBtn.textContent = '❌ Element Not Found';
    }
    
  } catch (error) {
    console.error('Error finding element:', error);
    highlightDetails.innerHTML = `
      <div style="color: #ef4444; font-weight: bold;">❌ Error finding element</div>
      <div><strong>Error:</strong> ${error.message}</div>
    `;
    highlightElementBtn.disabled = true;
    highlightElementBtn.textContent = '❌ Error';
  }
}

async function highlightCurrentElement() {
  try {
    if (!testFlowState.currentElement) return;
    
    // Send message to highlight element
    await send({ 
      from: 'panel', 
      type: 'PANEL_TEST_HIGHLIGHT_ELEMENT', 
      stepIndex: testFlowState.currentStepIndex
    });
    
    highlightElementBtn.textContent = '✅ Highlighted';
    highlightElementBtn.disabled = true;
    
    // Re-enable after 3 seconds
    setTimeout(() => {
      if (testFlowState.isActive) {
        highlightElementBtn.textContent = '🔍 Highlight Element';
        highlightElementBtn.disabled = false;
      }
    }, 3000);
    
  } catch (error) {
    console.error('Error highlighting element:', error);
    alert('Error highlighting element: ' + error.message);
  }
}

async function recheckCurrentElement() {
  try {
    if (!testFlowState.currentSelector) {
      showMessage('No selector available to recheck', 'error');
      return;
    }
    
    // Show loading state
    recheckElementBtn.disabled = true;
    recheckElementBtn.textContent = '🔄 Rechecking...';
    
    // Recheck the current selector
    await testAndUpdateSelector(testFlowState.currentSelector);
    
    // Re-enable button
    recheckElementBtn.disabled = false;
    recheckElementBtn.textContent = '🔄 Recheck Element';
    
  } catch (error) {
    console.error('Error rechecking element:', error);
    showMessage('Error rechecking element: ' + error.message, 'error');
    
    // Re-enable button
    recheckElementBtn.disabled = false;
    recheckElementBtn.textContent = '🔄 Recheck Element';
  }
}

// Populate test selector dropdown
function populateTestSelectorDropdown(step) {
  try {
    const selectors = generateSelectorsForStep(step);
    
    // Clear existing options
    testSelectorDropdown.innerHTML = '';
    
    if (selectors.length === 0) {
      testSelectorDropdown.innerHTML = '<option value="">No selectors available</option>';
      return;
    }
    
    // Load saved preference
    const savedPreference = loadSelectorPreference(testFlowState.currentStepIndex);
    
    // Add options for each selector
    selectors.forEach((selector, index) => {
      const option = document.createElement('option');
      option.value = selector.value;
      option.textContent = selector.label;
      option.dataset.type = selector.type;
      option.dataset.description = selector.description;
      
      // Set selected based on saved preference or current selector
      if (savedPreference === selector.value) {
        option.selected = true;
      } else if (testFlowState.currentSelector === selector.value) {
        option.selected = true;
      } else if (!savedPreference && !testFlowState.currentSelector && selector.type === 'primary') {
        option.selected = true;
      }
      
      testSelectorDropdown.appendChild(option);
    });
    
    // Add custom selector option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom Selector...';
    customOption.dataset.type = 'custom';
    customOption.dataset.description = 'Enter a custom CSS selector';
    testSelectorDropdown.appendChild(customOption);
    
    // Update description
    updateTestSelectorDescription();
    
  } catch (error) {
    console.error('Error populating test selector dropdown:', error);
    testSelectorDropdown.innerHTML = '<option value="">Error loading selectors</option>';
  }
}

// Update test selector description
function updateTestSelectorDescription() {
  const selectedOption = testSelectorDropdown.options[testSelectorDropdown.selectedIndex];
  const descriptionEl = testSelectorDropdown.parentNode.querySelector('.selector-description');
  
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

async function changeCurrentSelector() {
  try {
    // Show custom selector dialog
    const customSelector = prompt('Enter custom CSS selector:', testFlowState.currentSelector || '');
    if (customSelector) {
      await testAndUpdateSelector(customSelector);
    }
    
  } catch (error) {
    console.error('Error changing selector:', error);
    alert('Error changing selector: ' + error.message);
  }
}

async function testAndUpdateSelector(selector) {
  try {
    // Show loading state
    highlightDetails.innerHTML = `
      <div style="color: #f59e0b; font-weight: bold;">🔍 Testing selector...</div>
      <div><strong>Selector:</strong> ${selector}</div>
    `;
    
    // Test the new selector
    const res = await send({ 
      from: 'panel', 
      type: 'PANEL_TEST_SELECTOR', 
      selector: selector,
      stepIndex: testFlowState.currentStepIndex
    });
    
    if (res?.ok && res.element) {
      testFlowState.currentSelector = selector;
      testFlowState.currentElement = res.element;
      
      highlightDetails.innerHTML = `
        <div style="color: #10b981; font-weight: bold;">✅ Element found!</div>
        <div><strong>Selector:</strong> ${selector}</div>
        <div><strong>Tag:</strong> ${res.element.tagName}</div>
        <div><strong>ID:</strong> ${res.element.id || 'None'}</div>
        <div><strong>Classes:</strong> ${res.element.className || 'None'}</div>
        <div><strong>Text:</strong> ${res.element.textContent?.substring(0, 100) || 'None'}</div>
      `;
      
      // Enable highlight button
      highlightElementBtn.disabled = false;
      highlightElementBtn.textContent = '🔍 Highlight Element';
      
      // Save selector preference
      saveSelectorPreference(testFlowState.currentStepIndex, selector);
      
      // Update the step in storage with new selector
      const step = testFlowState.steps[testFlowState.currentStepIndex];
      if (step) {
        const updatedStep = {
          ...step,
          target: {
            ...step.target,
            css: selector
          }
        };
        
        // Update step in storage
        await send({ 
          from: 'panel', 
          type: 'PANEL_UPDATE_STEP', 
          index: testFlowState.currentStepIndex,
          step: updatedStep
        });
        
        // Update the step in test flow state
        testFlowState.steps[testFlowState.currentStepIndex] = updatedStep;
        
        // Refresh the accordion to show updated selector
        await refreshSteps();
      }
      
      // Update dropdown selection
      const option = Array.from(testSelectorDropdown.options).find(opt => opt.value === selector);
      if (option) {
        testSelectorDropdown.selectedIndex = option.index;
        updateTestSelectorDescription();
      }
      
      console.log('Selector updated successfully:', selector);
    } else {
      // Element not found - show error state
      highlightDetails.innerHTML = `
        <div style="color: #ef4444; font-weight: bold;">❌ Element not found</div>
        <div><strong>Selector:</strong> ${selector}</div>
        <div><strong>Error:</strong> ${res?.error || 'Element not found on page'}</div>
        <div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
          Try a different selector or check if the element exists on the current page.
        </div>
      `;
      
      // Disable highlight button
      highlightElementBtn.disabled = true;
      highlightElementBtn.textContent = '❌ Element Not Found';
      
      // Show error message
      showMessage(`Element not found: ${res?.error || 'Invalid selector'}`, 'error');
    }
    
  } catch (error) {
    console.error('Error testing selector:', error);
    
    // Show error state
    highlightDetails.innerHTML = `
      <div style="color: #ef4444; font-weight: bold;">❌ Error testing selector</div>
      <div><strong>Selector:</strong> ${selector}</div>
      <div><strong>Error:</strong> ${error.message}</div>
    `;
    
    // Disable highlight button
    highlightElementBtn.disabled = true;
    highlightElementBtn.textContent = '❌ Error';
    
    showMessage('Error testing selector: ' + error.message, 'error');
  }
}

// Handle test selector dropdown change
async function handleTestSelectorChange(event) {
  try {
    const selectedValue = event.target.value;
    
    if (!selectedValue) {
      updateTestSelectorDescription();
      return;
    }
    
    if (selectedValue === 'custom') {
      // Handle custom selector - show prompt and validate
      const customSelector = prompt('Enter custom CSS selector:', testFlowState.currentSelector || '');
      if (customSelector) {
        await testAndUpdateSelector(customSelector);
      } else {
        // Reset to previous selection if cancelled
        const previousSelector = testFlowState.currentSelector;
        if (previousSelector) {
          const option = Array.from(testSelectorDropdown.options).find(opt => opt.value === previousSelector);
          if (option) {
            testSelectorDropdown.selectedIndex = option.index;
          }
        }
        updateTestSelectorDescription();
      }
      return;
    }
    
    // Automatically test and update the selector
    await testAndUpdateSelector(selectedValue);
    
  } catch (error) {
    console.error('Error handling test selector change:', error);
  }
}

async function confirmCurrentStep() {
  try {
    // First execute the step interaction
    await executeCurrentStep();
    
    // Record test result
    testFlowState.testResults.push({
      stepIndex: testFlowState.currentStepIndex,
      step: testFlowState.steps[testFlowState.currentStepIndex],
      status: 'confirmed',
      selector: testFlowState.currentSelector,
      timestamp: Date.now()
    });
    
    // Refresh the accordion to show any changes
    await refreshSteps();
    
    // Move to next step
    testFlowState.currentStepIndex++;
    await processCurrentTestStep();
    
  } catch (error) {
    console.error('Error confirming step:', error);
    alert('Error confirming step: ' + error.message);
  }
}

async function executeCurrentStep() {
  try {
    if (!testFlowState.currentElement || !testFlowState.currentSelector) {
      throw new Error('No element or selector available for execution');
    }
    
    const step = testFlowState.steps[testFlowState.currentStepIndex];
    
    // Update UI to show execution
    highlightDetails.textContent = 'Executing step interaction...';
    
    // Send message to execute the step
    const res = await send({ 
      from: 'panel', 
      type: 'PANEL_TEST_EXECUTE_STEP', 
      stepIndex: testFlowState.currentStepIndex,
      step: step,
      selector: testFlowState.currentSelector
    });
    
    if (res?.ok) {
      highlightDetails.innerHTML = `
        <div style="color: #10b981; font-weight: bold;">✅ Step executed successfully!</div>
        <div><strong>Action:</strong> ${res.stepType}</div>
        <div><strong>Result:</strong> ${res.result}</div>
        <div><strong>Selector:</strong> ${res.selector}</div>
      `;
      console.log('Step executed:', step.type, res.result);
    } else {
      throw new Error(res?.error || 'Step execution failed');
    }
    
  } catch (error) {
    console.error('Error executing step:', error);
    highlightDetails.innerHTML = `
      <div style="color: #ef4444; font-weight: bold;">❌ Execution failed</div>
      <div><strong>Error:</strong> ${error.message}</div>
    `;
    throw error;
  }
}

async function skipCurrentStep() {
  try {
    const currentIndex = testFlowState.currentStepIndex;
    const step = testFlowState.steps[currentIndex];
    
    // Record test result
    testFlowState.testResults.push({
      stepIndex: currentIndex,
      step: step,
      status: 'skipped',
      selector: testFlowState.currentSelector,
      timestamp: Date.now()
    });
    
    // Delete the step from storage
    await send({ 
      from: 'panel', 
      type: 'PANEL_DELETE_STEP', 
      index: currentIndex
    });
    
    // Remove the step from test flow state
    testFlowState.steps.splice(currentIndex, 1);
    testFlowState.skippedSteps.add(currentIndex);
    
    // Update total steps count
    totalSteps.textContent = testFlowState.steps.length;
    
    // Refresh the accordion to show the deleted step
    await refreshSteps();
    
    // If we're at the end or beyond, finish the test
    if (currentIndex >= testFlowState.steps.length) {
      await finishTestFlow();
      return;
    }
    
    // Don't increment currentStepIndex since we removed a step
    // The next step is now at the same index
    await processCurrentTestStep();
    
  } catch (error) {
    console.error('Error skipping step:', error);
    alert('Error skipping step: ' + error.message);
  }
}

async function stopTestFlow() {
  try {
    console.log('Stopping test flow...');
    testFlowState.isActive = false;
    
    // Hide modal
    console.log('Hiding modal...');
    testFlowModal.classList.add('hidden-section');
    
    // Show results
    const confirmed = testFlowState.testResults.filter(r => r.status === 'confirmed').length;
    const skipped = testFlowState.testResults.filter(r => r.status === 'skipped').length;
    const total = testFlowState.steps.length;
    
    alert(`Test Flow Completed!\n\nConfirmed: ${confirmed}/${total}\nSkipped: ${skipped}/${total}\n\nCheck the console for detailed results.`);
    
    console.log('Test Flow Results:', testFlowState.testResults);
    
  } catch (error) {
    console.error('Error stopping test flow:', error);
  }
}

async function finishTestFlow() {
  await stopTestFlow();
}

// Test Flow Event Listeners
testFlowBtn.addEventListener('click', startTestFlow);
closeTestFlowBtn.addEventListener('click', stopTestFlow);
highlightElementBtn.addEventListener('click', highlightCurrentElement);
recheckElementBtn.addEventListener('click', recheckCurrentElement);
changeSelectorBtn.addEventListener('click', changeCurrentSelector);
testSelectorDropdown.addEventListener('change', handleTestSelectorChange);
confirmElementBtn.addEventListener('click', confirmCurrentStep);
skipStepBtn.addEventListener('click', skipCurrentStep);
stopTestBtn.addEventListener('click', stopTestFlow);

// Close modal when clicking outside
testFlowModal.addEventListener('click', (event) => {
  if (event.target === testFlowModal) {
    stopTestFlow();
  }
});

// Prevent modal content clicks from closing modal
document.querySelector('.test-flow-content').addEventListener('click', (event) => {
  event.stopPropagation();
});

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

let selectedStepType = null;

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
      form.style.display = 'none';
    });
    
    // Show appropriate form
    switch (selectedStepType) {
      case 'navigate_url':
        document.getElementById('navigateUrlForm').style.display = 'block';
        break;
      case 'find_by_value':
        document.getElementById('findByValueForm').style.display = 'block';
        break;
      case 'find_by_index':
        document.getElementById('findByIndexForm').style.display = 'block';
        break;
      case 'loop_group_start':
        document.getElementById('loopGroupStartForm').style.display = 'block';
        break;
      case 'loop_group_end':
        document.getElementById('loopGroupEndForm').style.display = 'block';
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
    
    default:
      return null;
  }
}

// Get friendly step type name
function getStepTypeName(stepType) {
  const names = {
    'navigate_url': 'Navigate URL',
    'find_by_value': 'Find By Value',
    'find_by_index': 'Find By Index',
    'loop_group_start': 'Loop Start',
    'loop_group_end': 'Loop End'
  };
  return names[stepType] || stepType;
}

// Update getStepIcon to include new types
const originalGetStepIcon = getStepIcon;
function getStepIcon(type) {
  const newIcons = {
    'navigate_url': '🌐',
    'find_by_value': '🔍',
    'find_by_index': '🔢',
    'loop_group': '🔄'
  };
  return newIcons[type] || originalGetStepIcon(type);
}

// Update getStepTitle to include new types
const originalGetStepTitle = getStepTitle;
function getStepTitle(step, index) {
  const newTitles = {
    'navigate_url': {
      title: 'Navigate to URL',
      subtitle: step.column ? `Column: ${step.column}` : (step.value || step.url || 'URL')
    },
    'find_by_value': {
      title: 'Find By Value',
      subtitle: `Column: ${step.column} → ${step.action || 'click'}`
    },
    'find_by_index': {
      title: 'Find By Index',
      subtitle: `${step.selector} [${step.index}] → ${step.action || 'click'}`
    },
    'loop_group': {
      title: step.action === 'start' ? 'Loop Start' : 'Loop End',
      subtitle: step.action === 'start' ? `Group by: ${step.groupBy || step.name || 'unknown'}` : 'End of loop'
    }
  };
  
  return newTitles[step.type] || originalGetStepTitle(step, index);
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

// Update playback to use grouped execution if needed
const originalPlayBtnHandler = playBtn.onclick;
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
    // Get start URL
    let startUrl = null;
    try {
      const urlRes = await send({ from: 'panel', type: 'PANEL_GET_START_URL' });
      startUrl = urlRes?.startUrl;
    } catch (error) {
      console.warn('Could not get start URL:', error);
    }
    
    // Get steps
    const stepsRes = await send({ from: 'panel', type: 'PANEL_GET_STEPS' });
    const steps = (stepsRes && stepsRes.steps) || [];
    
    // Check if we need grouped execution
    const hasLoopGroups = steps.some(s => s.type === 'loop_group');
    
    if (hasLoopGroups) {
      // Use grouped execution
      console.log('Using grouped execution');
      const groupingAnalysis = await analyzeDataGrouping();
      
      if (groupingAnalysis.hasGroups) {
        console.log('Grouping preview:', groupingAnalysis.preview);
      }
      
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
    playBtn.disabled = false; 
    loopControls.style.display = 'none'; 
  }
};

// init
(async function(){ 
  await refreshSteps(); 
  await refreshFlowsList(); 
  await refreshClips(); 
  initializeDatasetInfo();
})();
