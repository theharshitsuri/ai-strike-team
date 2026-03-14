/* ══════════════════════════════════════════════════════════════════════════════
   AI Strike Team — Production-Ready Workflow UI JavaScript (Pro Edition)
   Enterprise-grade, customizable, sellable workflow interface
   ══════════════════════════════════════════════════════════════════════════════ */

const API_BASE = window.location.origin;

// ══════════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

const WorkflowState = {
  currentStep: 1,
  totalSteps: 5,
  currentFile: null,
  config: {},
  defaultConfig: {},
  result: null,
  isProcessing: false,
  workflowId: null,
  clientId: null
};

// ══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════════

function initWorkflow(workflowId, defaultConfig = {}) {
  WorkflowState.workflowId = workflowId;
  WorkflowState.defaultConfig = defaultConfig;
  WorkflowState.config = { ...defaultConfig };
  
  // Load saved config from localStorage
  const savedConfig = localStorage.getItem(`workflow_config_${workflowId}`);
  if (savedConfig) {
    try {
      WorkflowState.config = { ...defaultConfig, ...JSON.parse(savedConfig) };
    } catch (e) {
      console.warn('Could not load saved config:', e);
    }
  }
  
  initTheme();
  initSidebar();
  initUploadZones();
  initConfigPanel();
  initRevealObserver();
  updateWizardSteps();
  
  // Check for client ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  WorkflowState.clientId = urlParams.get('client');
  
  if (WorkflowState.clientId) {
    loadClientConfig(WorkflowState.clientId);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION & WIZARD
// ══════════════════════════════════════════════════════════════════════════════

function goToStep(step) {
  if (step < 1 || step > WorkflowState.totalSteps) return;
  if (WorkflowState.isProcessing && step !== WorkflowState.currentStep) return;
  
  WorkflowState.currentStep = step;
  
  // Hide all step content
  document.querySelectorAll('.wizard-step-content').forEach(el => {
    el.classList.remove('active');
  });
  
  // Show current step content
  const currentContent = document.getElementById(`step-${step}`);
  if (currentContent) {
    currentContent.classList.add('active');
  }
  
  updateWizardSteps();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (validateCurrentStep()) {
    goToStep(WorkflowState.currentStep + 1);
  }
}

function prevStep() {
  goToStep(WorkflowState.currentStep - 1);
}

function updateWizardSteps() {
  document.querySelectorAll('.wizard-step').forEach((el, idx) => {
    const stepNum = idx + 1;
    el.classList.remove('active', 'completed');
    
    if (stepNum < WorkflowState.currentStep) {
      el.classList.add('completed');
    } else if (stepNum === WorkflowState.currentStep) {
      el.classList.add('active');
    }
  });
  
  // Update connectors
  document.querySelectorAll('.wizard-step-connector').forEach((el, idx) => {
    el.classList.toggle('completed', idx + 1 < WorkflowState.currentStep);
  });
}

function validateCurrentStep() {
  const step = WorkflowState.currentStep;
  
  switch (step) {
    case 2: // Upload step
      if (!WorkflowState.currentFile && !getTextInput()) {
        showToast('Please upload a file or enter text', 'error');
        return false;
      }
      break;
    case 3: // Config step
      if (!validateConfig()) {
        showToast('Please fix configuration errors', 'error');
        return false;
      }
      break;
  }
  
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════

function initSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      document.querySelector('.app-main')?.classList.toggle('expanded');
    });
  }
  
  // Mobile sidebar
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD
// ══════════════════════════════════════════════════════════════════════════════

function initUploadZones() {
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const input = zone.querySelector('input[type="file"]');
    const zoneId = zone.id;
    
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0], zone);
      }
    });
    
    if (input) {
      input.addEventListener('change', () => {
        if (input.files.length) {
          handleFileSelect(input.files[0], zone);
        }
      });
    }
  });
}

function handleFileSelect(file, zone) {
  WorkflowState.currentFile = file;
  zone.classList.add('has-file');
  
  const icon = zone.querySelector('.upload-zone-icon');
  const title = zone.querySelector('.upload-zone-title');
  const subtitle = zone.querySelector('.upload-zone-subtitle');
  
  if (icon) icon.innerHTML = '📄';
  if (title) title.textContent = file.name;
  if (subtitle) subtitle.textContent = `${(file.size / 1024).toFixed(1)} KB — Ready for processing`;
  
  showToast('File uploaded successfully', 'success');
  
  // Auto-advance to next step if on upload step
  if (WorkflowState.currentStep === 2) {
    setTimeout(() => nextStep(), 500);
  }
}

function resetUpload() {
  WorkflowState.currentFile = null;
  
  document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.classList.remove('has-file');
    const icon = zone.querySelector('.upload-zone-icon');
    const title = zone.querySelector('.upload-zone-title');
    const subtitle = zone.querySelector('.upload-zone-subtitle');
    
    if (icon) icon.innerHTML = '📁';
    if (title) title.textContent = 'Drop your file here';
    if (subtitle) subtitle.textContent = 'or click to browse';
  });
}

function getTextInput() {
  const textarea = document.getElementById('text-input');
  return textarea ? textarea.value.trim() : '';
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION PANEL
// ══════════════════════════════════════════════════════════════════════════════

function initConfigPanel() {
  // Initialize all config inputs
  document.querySelectorAll('[data-config]').forEach(input => {
    const key = input.dataset.config;
    const type = input.type;
    
    // Set initial value from config
    if (WorkflowState.config[key] !== undefined) {
      if (type === 'checkbox') {
        input.checked = WorkflowState.config[key];
      } else if (type === 'range') {
        input.value = WorkflowState.config[key];
        updateRangeDisplay(input);
      } else {
        input.value = WorkflowState.config[key];
      }
    }
    
    // Add change listener
    input.addEventListener('change', () => {
      if (type === 'checkbox') {
        WorkflowState.config[key] = input.checked;
      } else if (type === 'number' || type === 'range') {
        WorkflowState.config[key] = parseFloat(input.value);
        if (type === 'range') updateRangeDisplay(input);
      } else {
        WorkflowState.config[key] = input.value;
      }
      
      saveConfig();
      onConfigChange(key, WorkflowState.config[key]);
    });
    
    // Range input live update
    if (type === 'range') {
      input.addEventListener('input', () => {
        updateRangeDisplay(input);
      });
    }
  });
}

function updateRangeDisplay(input) {
  const display = document.getElementById(`${input.id}-value`);
  if (display) {
    const format = input.dataset.format || 'number';
    let value = input.value;
    
    switch (format) {
      case 'currency':
        value = `$${parseFloat(value).toFixed(2)}`;
        break;
      case 'percent':
        value = `${value}%`;
        break;
      case 'minutes':
        value = `${value} min`;
        break;
      case 'hours':
        value = `${value} hrs`;
        break;
    }
    
    display.textContent = value;
  }
}

function saveConfig() {
  localStorage.setItem(
    `workflow_config_${WorkflowState.workflowId}`,
    JSON.stringify(WorkflowState.config)
  );
}

function resetConfig() {
  WorkflowState.config = { ...WorkflowState.defaultConfig };
  localStorage.removeItem(`workflow_config_${WorkflowState.workflowId}`);
  initConfigPanel();
  showToast('Configuration reset to defaults', 'info');
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(WorkflowState.config, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${WorkflowState.workflowId}_config.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Configuration exported', 'success');
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      WorkflowState.config = { ...WorkflowState.defaultConfig, ...imported };
      saveConfig();
      initConfigPanel();
      showToast('Configuration imported successfully', 'success');
    } catch (err) {
      showToast('Invalid configuration file', 'error');
    }
  };
  reader.readAsText(file);
}

function validateConfig() {
  let isValid = true;
  
  document.querySelectorAll('[data-config][required]').forEach(input => {
    const value = input.type === 'checkbox' ? input.checked : input.value;
    if (!value) {
      input.classList.add('error');
      isValid = false;
    } else {
      input.classList.remove('error');
    }
  });
  
  return isValid;
}

function onConfigChange(key, value) {
  // Override in individual workflow pages for custom behavior
  console.log(`Config changed: ${key} = ${value}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT CONFIG LOADING
// ══════════════════════════════════════════════════════════════════════════════

async function loadClientConfig(clientId) {
  try {
    const response = await fetch(`${API_BASE}/clients/${clientId}/workflows/${WorkflowState.workflowId}/config`);
    if (response.ok) {
      const clientConfig = await response.json();
      WorkflowState.config = { ...WorkflowState.defaultConfig, ...clientConfig };
      initConfigPanel();
      showToast(`Loaded ${clientId} configuration`, 'info');
    }
  } catch (err) {
    console.warn('Could not load client config:', err);
  }
}

async function saveClientConfig() {
  if (!WorkflowState.clientId) {
    showToast('No client selected', 'warning');
    return;
  }
  
  try {
    const response = await fetch(
      `${API_BASE}/clients/${WorkflowState.clientId}/workflows/${WorkflowState.workflowId}/config`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(WorkflowState.config)
      }
    );
    
    if (response.ok) {
      showToast('Configuration saved for client', 'success');
    } else {
      throw new Error('Save failed');
    }
  } catch (err) {
    showToast('Could not save client configuration', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOW EXECUTION
// ══════════════════════════════════════════════════════════════════════════════

async function runWorkflow() {
  if (WorkflowState.isProcessing) return;
  
  WorkflowState.isProcessing = true;
  goToStep(4); // Processing step
  
  const formData = new FormData();
  
  if (WorkflowState.currentFile) {
    formData.append('file', WorkflowState.currentFile);
  } else {
    const textInput = getTextInput();
    if (textInput) {
      const blob = new Blob([textInput], { type: 'text/plain' });
      formData.append('file', blob, 'input.txt');
    }
  }
  
  // Add config to request
  formData.append('config', JSON.stringify(WorkflowState.config));
  
  if (WorkflowState.clientId) {
    formData.append('client_id', WorkflowState.clientId);
  }
  
  // Start progress animation
  animateProcessing();
  
  try {
    const response = await fetch(`${API_BASE}/run/${WorkflowState.workflowId}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      WorkflowState.result = data;
      completeProcessing(true);
      setTimeout(() => {
        goToStep(5); // Results step
        renderResults(data);
      }, 800);
    } else {
      completeProcessing(false);
      showToast(data.error || 'Processing failed', 'error');
    }
  } catch (err) {
    completeProcessing(false);
    showToast('Network error: ' + err.message, 'error');
  } finally {
    WorkflowState.isProcessing = false;
  }
}

function animateProcessing() {
  const steps = document.querySelectorAll('.processing-step');
  const progressBar = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percentage');
  
  let currentIdx = 0;
  const totalSteps = steps.length;
  
  function updateStep() {
    if (currentIdx >= totalSteps) return;
    
    steps.forEach((step, idx) => {
      step.classList.remove('active', 'completed');
      if (idx < currentIdx) step.classList.add('completed');
      if (idx === currentIdx) step.classList.add('active');
    });
    
    const progress = ((currentIdx + 1) / totalSteps) * 100;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
    
    const stepEl = steps[currentIdx];
    if (stepEl && progressText) {
      progressText.textContent = stepEl.querySelector('.processing-step-title')?.textContent || 'Processing...';
    }
    
    currentIdx++;
    
    if (currentIdx < totalSteps) {
      setTimeout(updateStep, 800 + Math.random() * 400);
    }
  }
  
  updateStep();
}

function completeProcessing(success) {
  const steps = document.querySelectorAll('.processing-step');
  const progressBar = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percentage');
  
  steps.forEach(step => {
    step.classList.remove('active');
    step.classList.add('completed');
  });
  
  if (progressBar) progressBar.style.width = '100%';
  if (progressPercent) progressPercent.textContent = '100%';
  if (progressText) progressText.textContent = success ? 'Complete!' : 'Failed';
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS RENDERING
// ══════════════════════════════════════════════════════════════════════════════

function renderResults(data) {
  // Render extracted data
  const extractedContainer = document.getElementById('extracted-data');
  if (extractedContainer && data.result) {
    renderExtractedData(extractedContainer, data.result);
  }
  
  // Render ROI metrics
  const roiContainer = document.getElementById('roi-metrics');
  if (roiContainer && data.roi) {
    renderROIMetrics(roiContainer, data.roi);
  }
  
  // Render JSON preview
  const jsonContainer = document.getElementById('json-preview');
  if (jsonContainer && data.result) {
    jsonContainer.innerHTML = syntaxHighlightJSON(JSON.stringify(data.result, null, 2));
  }
  
  // Call custom render function if defined
  if (typeof renderCustomResults === 'function') {
    renderCustomResults(data);
  }
}

function renderExtractedData(container, data, fieldLabels = {}) {
  container.innerHTML = '';
  
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'confidence' || value === null || value === undefined) return;
    
    const label = fieldLabels[key] || formatFieldLabel(key);
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const confidence = data.confidence || 0.9;
    const confClass = confidence >= 0.9 ? 'badge-success' : 
                     confidence >= 0.7 ? 'badge-warning' : 'badge-error';
    
    card.innerHTML = `
      <div class="result-card-header">
        <span class="result-card-label">${label}</span>
        <span class="badge ${confClass}">${Math.round(confidence * 100)}%</span>
      </div>
      <div class="result-card-value">${formatValue(value)}</div>
    `;
    
    container.appendChild(card);
  });
}

function renderROIMetrics(container, roi) {
  container.innerHTML = `
    <div class="metric-card">
      <div class="metric-icon">⏱️</div>
      <div class="metric-value">${roi.time_saved || '—'}</div>
      <div class="metric-label">Time Saved</div>
    </div>
    <div class="metric-card highlight">
      <div class="metric-icon">💰</div>
      <div class="metric-value">${roi.cost_saved || '—'}</div>
      <div class="metric-label">Cost Saved</div>
    </div>
    <div class="metric-card">
      <div class="metric-icon">🎯</div>
      <div class="metric-value">${roi.accuracy || '—'}</div>
      <div class="metric-label">Accuracy</div>
    </div>
    <div class="metric-card">
      <div class="metric-icon">📈</div>
      <div class="metric-value">${roi.annual_value || '—'}</div>
      <div class="metric-label">Annual Value</div>
    </div>
  `;
}

function formatFieldLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (typeof value[0] === 'object') {
      return `<div class="mini-table">${value.map(item => 
        `<div class="mini-row">${Object.entries(item).map(([k, v]) => 
          `<span><strong>${formatFieldLabel(k)}:</strong> ${v}</span>`
        ).join(' ')}</div>`
      ).join('')}</div>`;
    }
    return value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return `<pre class="json-inline">${JSON.stringify(value, null, 2)}</pre>`;
  }
  if (typeof value === 'boolean') {
    return value ? '✓ Yes' : '✗ No';
  }
  return String(value);
}

function syntaxHighlightJSON(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    function(match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT & DOWNLOAD
// ══════════════════════════════════════════════════════════════════════════════

function downloadResults(format = 'json') {
  if (!WorkflowState.result) {
    showToast('No results to download', 'warning');
    return;
  }
  
  let content, filename, type;
  
  switch (format) {
    case 'json':
      content = JSON.stringify(WorkflowState.result, null, 2);
      filename = `${WorkflowState.workflowId}_results.json`;
      type = 'application/json';
      break;
    case 'csv':
      content = convertToCSV(WorkflowState.result.result);
      filename = `${WorkflowState.workflowId}_results.csv`;
      type = 'text/csv';
      break;
    default:
      return;
  }
  
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast(`Downloaded ${filename}`, 'success');
}

function convertToCSV(data) {
  if (!data || typeof data !== 'object') return '';
  
  const flatData = flattenObject(data);
  const headers = Object.keys(flatData);
  const values = Object.values(flatData).map(v => 
    typeof v === 'string' && v.includes(',') ? `"${v}"` : v
  );
  
  return headers.join(',') + '\n' + values.join(',');
}

function flattenObject(obj, prefix = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = value.join('; ');
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// DEMO DATA
// ══════════════════════════════════════════════════════════════════════════════

async function loadDemo() {
  const demoFiles = {
    'detention_tracking': '/shubh/detention_tracking/demo/sample_detention.txt',
    'freight_audit': '/shubh/freight_audit/demo/sample_invoice.txt',
    'load_scheduling': '/shubh/load_scheduling/demo/sample_email.txt',
    'po_email_to_erp': '/shubh/po_email_to_erp/demo/sample_po.txt',
    'maintenance_triage': '/shubh/maintenance_triage/demo/sample_ticket.txt',
    'shipment_followup': '/shubh/shipment_followup/demo/sample_shipment.txt',
    'scheduling_automation': '/shubh/scheduling_automation/demo/sample_request.txt',
    'inventory_restock': '/shubh/inventory_restock/demo/sample_inventory.csv',
    'qa_anomaly': '/shubh/qa_anomaly/demo/sample_inspection.csv',
    'warranty_claims': '/shubh/warranty_claims/demo/sample_claim.txt',
    'production_report': '/shubh/production_report/demo/sample_production.csv'
  };
  
  const path = demoFiles[WorkflowState.workflowId];
  if (!path) {
    showToast('No demo available for this workflow', 'warning');
    return;
  }
  
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Demo file not found');
    
    const text = await response.text();
    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], path.split('/').pop(), { type: 'text/plain' });
    
    // Find upload zone and trigger file select
    const zone = document.querySelector('.upload-zone');
    if (zone) {
      handleFileSelect(file, zone);
    }
    
    showToast('Demo data loaded', 'success');
    goToStep(2);
  } catch (err) {
    showToast('Could not load demo data', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

function showToast(message, type = 'info', title = null) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════════════════════════════════════

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function hideAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('active');
  });
  document.body.style.overflow = '';
}

// ══════════════════════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════════════════════

function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabContainer => {
    const tabs = tabContainer.querySelectorAll('.tab');
    const contentId = tabContainer.dataset.content;
    const contents = document.querySelectorAll(`#${contentId} .tab-content`);
    
    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        if (contents[idx]) contents[idx].classList.add('active');
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ══════════════════════════════════════════════════════════════════════════════
// REVEAL ANIMATION
// ══════════════════════════════════════════════════════════════════════════════

function initRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════════

window.WorkflowPro = {
  // State
  state: WorkflowState,
  
  // Initialization
  init: initWorkflow,
  
  // Navigation
  goToStep,
  nextStep,
  prevStep,
  
  // File handling
  handleFileSelect,
  resetUpload,
  getTextInput,
  
  // Configuration
  saveConfig,
  resetConfig,
  exportConfig,
  importConfig,
  saveClientConfig,
  
  // Execution
  runWorkflow,
  
  // Results
  renderResults,
  renderExtractedData,
  renderROIMetrics,
  downloadResults,
  
  // Demo
  loadDemo,
  
  // UI
  showToast,
  showModal,
  hideModal,
  hideAllModals,
  toggleTheme,
  
  // Utilities
  formatCurrency,
  formatDate,
  formatDateTime,
  debounce
};
