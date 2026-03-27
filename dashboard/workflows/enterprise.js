/* ══════════════════════════════════════════════════════════════════════════════
   AI Strike Team — Enterprise Workflow Engine
   Production-grade, industry-standard, fully customizable
   ══════════════════════════════════════════════════════════════════════════════ */

const API_BASE = window.location.origin;

// ══════════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

const WorkflowState = {
  workflowId: null,
  workflowMeta: {},
  currentStep: 1,
  totalSteps: 4,
  file: null,
  textInput: '',
  config: {},
  defaultConfig: {},
  companyConfig: {},
  result: null,
  history: [],
  processing: false,
  startTime: null,
  
  // Company customization
  company: {
    name: '',
    logo: '',
    primaryColor: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'YYYY-MM-DD',
    currency: 'USD',
    units: 'imperial'
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════════

function initWorkflow(workflowId, meta = {}) {
  WorkflowState.workflowId = workflowId;
  WorkflowState.workflowMeta = meta;
  WorkflowState.defaultConfig = { ...meta.defaultConfig || {} };
  
  // Load saved configs
  loadCompanyConfig();
  loadWorkflowConfig();
  loadHistory();
  
  // Initialize UI
  initTheme();
  initUploadZone();
  initConfigInputs();
  initTabs();
  updateStepUI();
  
  // Load workflow config from server
  fetchWorkflowConfig();
  
  console.log(`[Workflow] Initialized: ${workflowId}`);
}

function loadCompanyConfig() {
  const saved = localStorage.getItem('company_config');
  if (saved) {
    try {
      WorkflowState.company = { ...WorkflowState.company, ...JSON.parse(saved) };
      applyCompanyBranding();
    } catch (e) {}
  }
}

function loadWorkflowConfig() {
  const saved = localStorage.getItem(`workflow_config_${WorkflowState.workflowId}`);
  if (saved) {
    try {
      WorkflowState.config = { ...WorkflowState.defaultConfig, ...JSON.parse(saved) };
    } catch (e) {
      WorkflowState.config = { ...WorkflowState.defaultConfig };
    }
  } else {
    WorkflowState.config = { ...WorkflowState.defaultConfig };
  }
}

function loadHistory() {
  const saved = localStorage.getItem(`workflow_history_${WorkflowState.workflowId}`);
  if (saved) {
    try {
      WorkflowState.history = JSON.parse(saved);
    } catch (e) {}
  }
}

async function fetchWorkflowConfig() {
  try {
    const res = await fetch(`${API_BASE}/workflows/${WorkflowState.workflowId}/config`);
    if (res.ok) {
      const serverConfig = await res.json();
      WorkflowState.workflowMeta = { ...WorkflowState.workflowMeta, ...serverConfig };
      
      // Merge with defaults
      if (serverConfig.defaults) {
        WorkflowState.defaultConfig = { ...WorkflowState.defaultConfig, ...serverConfig.defaults };
        WorkflowState.config = { ...WorkflowState.defaultConfig, ...WorkflowState.config };
      }
      
      // Update UI with server config
      updateConfigUI();
    }
  } catch (e) {
    console.warn('[Workflow] Could not fetch server config:', e);
  }
}

function applyCompanyBranding() {
  const { primaryColor, name } = WorkflowState.company;
  
  if (primaryColor) {
    document.documentElement.style.setProperty('--accent', primaryColor);
  }
  
  const logoEl = document.querySelector('.company-logo');
  const nameEl = document.querySelector('.company-name');
  
  if (nameEl && name) nameEl.textContent = name;
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════

function goToStep(step) {
  if (step < 1 || step > WorkflowState.totalSteps) return;
  if (WorkflowState.processing && step !== WorkflowState.currentStep) return;
  
  // Validate before moving forward
  if (step > WorkflowState.currentStep && !validateCurrentStep()) {
    return;
  }
  
  WorkflowState.currentStep = step;
  updateStepUI();
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  goToStep(WorkflowState.currentStep + 1);
}

function prevStep() {
  goToStep(WorkflowState.currentStep - 1);
}

function updateStepUI() {
  const step = WorkflowState.currentStep;
  
  // Update step indicators
  document.querySelectorAll('.wizard-step').forEach((el, i) => {
    const stepNum = i + 1;
    el.classList.remove('active', 'completed');
    
    if (stepNum < step) el.classList.add('completed');
    else if (stepNum === step) el.classList.add('active');
  });
  
  // Update connectors
  document.querySelectorAll('.wizard-connector').forEach((el, i) => {
    el.classList.toggle('completed', i < step - 1);
  });
  
  // Show/hide content
  document.querySelectorAll('.wizard-content').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === step);
  });
}

function validateCurrentStep() {
  const step = WorkflowState.currentStep;
  
  if (step === 2) {
    // Validate upload step
    if (!WorkflowState.file && !getTextInput()) {
      showToast('Please upload a file or enter text', 'error');
      return false;
    }
  }
  
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD
// ══════════════════════════════════════════════════════════════════════════════

function initUploadZone() {
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const input = zone.querySelector('input[type="file"]');
    
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0], zone);
      }
    });
    
    if (input) {
      input.addEventListener('change', () => {
        if (input.files.length > 0) {
          handleFileUpload(input.files[0], zone);
        }
      });
    }
  });
}

function handleFileUpload(file, zone) {
  // Validate file type
  const allowedTypes = WorkflowState.workflowMeta.acceptedTypes || [
    'text/plain', 'text/csv', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  const allowedExtensions = WorkflowState.workflowMeta.acceptedExtensions || [
    '.txt', '.csv', '.pdf', '.xlsx', '.xls', '.doc', '.docx'
  ];
  
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    showToast(`File type not supported. Allowed: ${allowedExtensions.join(', ')}`, 'error');
    return;
  }
  
  // Validate file size (max 10MB)
  const maxSize = WorkflowState.workflowMeta.maxFileSize || 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast(`File too large. Maximum size: ${formatFileSize(maxSize)}`, 'error');
    return;
  }
  
  WorkflowState.file = file;
  zone.classList.add('has-file');
  
  // Update UI
  const title = zone.querySelector('.upload-title');
  const subtitle = zone.querySelector('.upload-subtitle');
  
  if (title) title.textContent = file.name;
  if (subtitle) subtitle.textContent = formatFileSize(file.size);
  
  // Show file preview
  showFilePreview(file, zone);
  
  showToast('File uploaded successfully', 'success');
}

function showFilePreview(file, zone) {
  // Remove existing preview
  const existing = zone.parentElement.querySelector('.file-preview');
  if (existing) existing.remove();
  
  const preview = document.createElement('div');
  preview.className = 'file-preview';
  preview.innerHTML = `
    <div class="file-preview-icon">${getFileIcon(file.name)}</div>
    <div class="file-preview-info">
      <div class="file-preview-name">${file.name}</div>
      <div class="file-preview-size">${formatFileSize(file.size)}</div>
    </div>
    <button class="file-preview-remove" onclick="removeFile(this)" title="Remove file">×</button>
  `;
  
  zone.parentElement.appendChild(preview);
}

function removeFile(btn) {
  WorkflowState.file = null;
  
  const preview = btn.closest('.file-preview');
  const zone = preview.parentElement.querySelector('.upload-zone');
  
  if (zone) {
    zone.classList.remove('has-file');
    const title = zone.querySelector('.upload-title');
    const subtitle = zone.querySelector('.upload-subtitle');
    if (title) title.textContent = 'Drop file here';
    if (subtitle) subtitle.textContent = 'or click to browse';
    
    const input = zone.querySelector('input[type="file"]');
    if (input) input.value = '';
  }
  
  preview.remove();
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: '📄',
    csv: '📊',
    xlsx: '📊',
    xls: '📊',
    txt: '📝',
    doc: '📃',
    docx: '📃'
  };
  return icons[ext] || '📎';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getTextInput() {
  const el = document.getElementById('text-input');
  return el ? el.value.trim() : '';
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

function initConfigInputs() {
  document.querySelectorAll('[data-config]').forEach(input => {
    const key = input.dataset.config;
    const type = input.type;
    
    // Set initial value
    if (WorkflowState.config[key] !== undefined) {
      if (type === 'checkbox') {
        input.checked = WorkflowState.config[key];
      } else {
        input.value = WorkflowState.config[key];
      }
    }
    
    // Update range display
    if (type === 'range') {
      updateRangeDisplay(input);
    }
    
    // Listen for changes
    input.addEventListener('change', () => {
      if (type === 'checkbox') {
        WorkflowState.config[key] = input.checked;
      } else if (type === 'number' || type === 'range') {
        WorkflowState.config[key] = parseFloat(input.value);
      } else {
        WorkflowState.config[key] = input.value;
      }
      
      if (type === 'range') {
        updateRangeDisplay(input);
      }
      
      saveWorkflowConfig();
    });
    
    if (type === 'range') {
      input.addEventListener('input', () => updateRangeDisplay(input));
    }
  });
}

function updateRangeDisplay(input) {
  const displayId = input.id + '-value';
  const display = document.getElementById(displayId);
  
  if (display) {
    const format = input.dataset.format || '';
    let value = input.value;
    
    switch (format) {
      case 'currency':
        value = formatCurrency(parseFloat(value));
        break;
      case 'percent':
        value = value + '%';
        break;
      case 'minutes':
        value = value + ' min';
        break;
      case 'hours':
        value = value + ' hrs';
        break;
      case 'days':
        value = value + ' days';
        break;
    }
    
    display.textContent = value;
  }
}

function updateConfigUI() {
  document.querySelectorAll('[data-config]').forEach(input => {
    const key = input.dataset.config;
    const type = input.type;
    
    if (WorkflowState.config[key] !== undefined) {
      if (type === 'checkbox') {
        input.checked = WorkflowState.config[key];
      } else {
        input.value = WorkflowState.config[key];
      }
      
      if (type === 'range') {
        updateRangeDisplay(input);
      }
    }
  });
}

function saveWorkflowConfig() {
  localStorage.setItem(
    `workflow_config_${WorkflowState.workflowId}`,
    JSON.stringify(WorkflowState.config)
  );
}

function resetConfig() {
  WorkflowState.config = { ...WorkflowState.defaultConfig };
  updateConfigUI();
  saveWorkflowConfig();
  showToast('Configuration reset to defaults', 'info');
}

function exportConfig() {
  const config = {
    workflowId: WorkflowState.workflowId,
    config: WorkflowState.config,
    company: WorkflowState.company,
    exportedAt: new Date().toISOString()
  };
  
  downloadJSON(config, `${WorkflowState.workflowId}_config.json`);
  showToast('Configuration exported', 'success');
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      
      if (data.config) {
        WorkflowState.config = { ...WorkflowState.defaultConfig, ...data.config };
        updateConfigUI();
        saveWorkflowConfig();
      }
      
      if (data.company) {
        WorkflowState.company = { ...WorkflowState.company, ...data.company };
        localStorage.setItem('company_config', JSON.stringify(WorkflowState.company));
        applyCompanyBranding();
      }
      
      showToast('Configuration imported', 'success');
    } catch (err) {
      showToast('Invalid configuration file', 'error');
    }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPANY SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

function openCompanySettings() {
  const modal = document.getElementById('company-settings-modal');
  if (modal) {
    // Populate form
    document.getElementById('company-name').value = WorkflowState.company.name || '';
    document.getElementById('company-timezone').value = WorkflowState.company.timezone || '';
    document.getElementById('company-currency').value = WorkflowState.company.currency || 'USD';
    document.getElementById('company-units').value = WorkflowState.company.units || 'imperial';
    
    modal.classList.add('show');
  }
}

function closeCompanySettings() {
  const modal = document.getElementById('company-settings-modal');
  if (modal) modal.classList.remove('show');
}

function saveCompanySettings() {
  WorkflowState.company.name = document.getElementById('company-name').value;
  WorkflowState.company.timezone = document.getElementById('company-timezone').value;
  WorkflowState.company.currency = document.getElementById('company-currency').value;
  WorkflowState.company.units = document.getElementById('company-units').value;
  
  localStorage.setItem('company_config', JSON.stringify(WorkflowState.company));
  applyCompanyBranding();
  closeCompanySettings();
  showToast('Company settings saved', 'success');
}

// ══════════════════════════════════════════════════════════════════════════════
// RUN WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════

async function runWorkflow() {
  if (WorkflowState.processing) return;
  
  WorkflowState.processing = true;
  WorkflowState.startTime = Date.now();
  
  goToStep(3);
  
  // Prepare form data
  const formData = new FormData();
  
  if (WorkflowState.file) {
    formData.append('file', WorkflowState.file);
  } else {
    const text = getTextInput();
    if (text) {
      const blob = new Blob([text], { type: 'text/plain' });
      formData.append('file', blob, 'input.txt');
    }
  }
  
  formData.append('config', JSON.stringify(WorkflowState.config));
  
  // Start progress animation
  animateProgress();
  
  try {
    const response = await fetch(`${API_BASE}/run/${WorkflowState.workflowId}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      WorkflowState.result = data;
      
      // Save to history
      saveToHistory(data);
      
      // Complete progress
      completeProgress(true);
      
      // Go to results after animation
      setTimeout(() => {
        goToStep(4);
        renderResults(data);
      }, 500);
      
    } else {
      completeProgress(false);
      showToast(data.error || 'Processing failed', 'error');
    }
    
  } catch (error) {
    console.error('[Workflow] Error:', error);
    completeProgress(false);
    showToast('Network error. Please try again.', 'error');
  } finally {
    WorkflowState.processing = false;
  }
}

function animateProgress() {
  const steps = document.querySelectorAll('.processing-item');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const progressValue = document.getElementById('progress-value');
  
  let currentIdx = 0;
  const totalSteps = steps.length;
  
  function tick() {
    if (currentIdx >= totalSteps || !WorkflowState.processing) return;
    
    // Update step states
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed');
      if (i < currentIdx) step.classList.add('completed');
      if (i === currentIdx) step.classList.add('active');
    });
    
    // Update progress bar
    const progress = ((currentIdx + 1) / totalSteps) * 100;
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressValue) progressValue.textContent = `${Math.round(progress)}%`;
    
    // Update label
    const currentStep = steps[currentIdx];
    if (progressLabel && currentStep) {
      const title = currentStep.querySelector('.processing-item-title');
      if (title) progressLabel.textContent = title.textContent;
    }
    
    currentIdx++;
    
    if (currentIdx < totalSteps) {
      setTimeout(tick, 500 + Math.random() * 500);
    }
  }
  
  tick();
}

function completeProgress(success) {
  const steps = document.querySelectorAll('.processing-item');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const progressValue = document.getElementById('progress-value');
  
  steps.forEach(step => {
    step.classList.remove('active');
    step.classList.add('completed');
  });
  
  if (progressFill) {
    progressFill.style.width = '100%';
    progressFill.classList.toggle('success', success);
  }
  
  if (progressValue) progressValue.textContent = '100%';
  if (progressLabel) progressLabel.textContent = success ? 'Complete' : 'Failed';
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════════════════════════════════════

function renderResults(data) {
  const result = data.result || {};
  
  // Render metrics
  renderResultMetrics(result);
  
  // Render extracted data grid
  renderResultGrid(result);
  
  // Render JSON output
  renderJSONOutput(data);
  
  // Calculate and show processing time
  if (WorkflowState.startTime) {
    const duration = ((Date.now() - WorkflowState.startTime) / 1000).toFixed(1);
    const timeEl = document.getElementById('processing-time');
    if (timeEl) timeEl.textContent = `${duration}s`;
  }
  
  // Custom render hook
  if (typeof onResultsRendered === 'function') {
    onResultsRendered(data);
  }
}

function renderResultMetrics(result) {
  const container = document.getElementById('result-metrics');
  if (!container) return;
  
  // Get workflow-specific metrics
  const metrics = calculateMetrics(result);
  
  container.innerHTML = metrics.map(m => `
    <div class="metric-card">
      <div class="metric-icon">${m.icon}</div>
      <div class="metric-value">${m.value}</div>
      <div class="metric-label">${m.label}</div>
      ${m.change ? `<div class="metric-change ${m.change > 0 ? 'positive' : 'negative'}">${m.change > 0 ? '↑' : '↓'} ${Math.abs(m.change)}%</div>` : ''}
    </div>
  `).join('');
}

function calculateMetrics(result) {
  // Override this per workflow
  return [
    { icon: '✓', value: 'Complete', label: 'Status' },
    { icon: '⏱', value: result.processing_time || '—', label: 'Processing Time' },
    { icon: '📊', value: Object.keys(result).length, label: 'Fields Extracted' }
  ];
}

function renderResultGrid(result) {
  const container = document.getElementById('results-grid');
  if (!container) return;
  
  container.innerHTML = '';
  
  Object.entries(result).forEach(([key, value]) => {
    // Skip internal fields
    if (key.startsWith('_') || key === 'confidence') return;
    
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-label">${formatLabel(key)}</div>
      <div class="result-value">${formatValue(value)}</div>
    `;
    container.appendChild(item);
  });
}

function renderJSONOutput(data) {
  const container = document.getElementById('json-output');
  if (!container) return;
  
  container.textContent = JSON.stringify(data, null, 2);
}

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatCurrency(amount, currency = null) {
  const curr = currency || WorkflowState.company.currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr
  }).format(amount);
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════════════════════════════

function saveToHistory(result) {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    filename: WorkflowState.file?.name || 'Text input',
    config: { ...WorkflowState.config },
    result: result
  };
  
  WorkflowState.history.unshift(entry);
  
  // Keep last 50 entries
  if (WorkflowState.history.length > 50) {
    WorkflowState.history = WorkflowState.history.slice(0, 50);
  }
  
  localStorage.setItem(
    `workflow_history_${WorkflowState.workflowId}`,
    JSON.stringify(WorkflowState.history)
  );
}

function showHistory() {
  const modal = document.getElementById('history-modal');
  if (!modal) return;
  
  const list = modal.querySelector('.history-list');
  if (list) {
    list.innerHTML = WorkflowState.history.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No history yet</div></div>'
      : WorkflowState.history.map(entry => `
        <div class="history-item" onclick="loadHistoryEntry(${entry.id})">
          <div class="history-item-icon">📄</div>
          <div class="history-item-info">
            <div class="history-item-name">${entry.filename}</div>
            <div class="history-item-date">${formatDate(entry.timestamp)}</div>
          </div>
        </div>
      `).join('');
  }
  
  modal.classList.add('show');
}

function closeHistory() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.classList.remove('show');
}

function loadHistoryEntry(id) {
  const entry = WorkflowState.history.find(e => e.id === id);
  if (entry) {
    WorkflowState.result = entry.result;
    goToStep(4);
    renderResults(entry.result);
    closeHistory();
  }
}

function clearHistory() {
  if (confirm('Clear all history? This cannot be undone.')) {
    WorkflowState.history = [];
    localStorage.removeItem(`workflow_history_${WorkflowState.workflowId}`);
    showHistory();
    showToast('History cleared', 'info');
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT / DOWNLOAD
// ══════════════════════════════════════════════════════════════════════════════

function downloadResults(format = 'json') {
  if (!WorkflowState.result) {
    showToast('No results to download', 'error');
    return;
  }
  
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${WorkflowState.workflowId}_${timestamp}`;
  
  switch (format) {
    case 'json':
      downloadJSON(WorkflowState.result, `${filename}.json`);
      break;
    case 'csv':
      downloadCSV(WorkflowState.result.result, `${filename}.csv`);
      break;
    case 'pdf':
      generatePDF();
      break;
  }
  
  showToast(`Downloaded as ${format.toUpperCase()}`, 'success');
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function downloadCSV(data, filename) {
  if (!data || typeof data !== 'object') return;
  
  const rows = [];
  
  // Headers
  rows.push(Object.keys(data).join(','));
  
  // Values
  const values = Object.values(data).map(v => {
    if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
    if (Array.isArray(v)) return `"${v.join('; ')}"`;
    if (typeof v === 'object') return `"${JSON.stringify(v)}"`;
    return v;
  });
  rows.push(values.join(','));
  
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generatePDF() {
  // Simple print-based PDF
  window.print();
}

// ══════════════════════════════════════════════════════════════════════════════
// DEMO DATA
// ══════════════════════════════════════════════════════════════════════════════

async function loadDemo() {
  try {
    const res = await fetch(`${API_BASE}/workflows/${WorkflowState.workflowId}/demo`);
    
    if (!res.ok) {
      throw new Error('Demo not found');
    }
    
    const data = await res.json();
    
    if (data.content) {
      const textarea = document.getElementById('text-input');
      if (textarea) {
        textarea.value = data.content;
        WorkflowState.textInput = data.content;
      }
      
      goToStep(2);
      showToast('Demo data loaded', 'success');
    }
    
  } catch (error) {
    showToast('Could not load demo data', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════════════════════

function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabContainer => {
    const tabs = tabContainer.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;
        
        // Update tab states
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update content
        const parent = tabContainer.parentElement;
        parent.querySelectorAll('.tab-content').forEach(content => {
          content.classList.toggle('active', content.id === targetId);
        });
      });
    });
  });
}

function switchTab(tabId) {
  const tab = document.querySelector(`[data-tab="${tabId}"]`);
  if (tab) tab.click();
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ══════════════════════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', saved);
  updateThemeIcon();
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ══════════════════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  // Ctrl/Cmd + Enter to run
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (WorkflowState.currentStep === 2 && !WorkflowState.processing) {
      runWorkflow();
    }
  }
  
  // Escape to close modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(modal => {
      modal.classList.remove('show');
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT GLOBAL API
// ══════════════════════════════════════════════════════════════════════════════

window.Workflow = {
  init: initWorkflow,
  state: WorkflowState,
  
  // Navigation
  goToStep,
  nextStep,
  prevStep,
  
  // Actions
  run: runWorkflow,
  loadDemo,
  
  // Config
  resetConfig,
  exportConfig,
  importConfig,
  
  // Company
  openCompanySettings,
  closeCompanySettings,
  saveCompanySettings,
  
  // History
  showHistory,
  closeHistory,
  clearHistory,
  
  // Export
  download: downloadResults,
  
  // UI
  toggleTheme,
  toggleSidebar,
  showToast,
  switchTab,
  
  // Helpers
  formatCurrency,
  formatDate,
  formatLabel,
  formatValue
};
