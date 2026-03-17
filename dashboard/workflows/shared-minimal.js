/* ══════════════════════════════════════════════════════════════════════════════
   AI Strike Team — Minimalist Workflow UI JavaScript
   Clean, simple, focused on user experience
   ══════════════════════════════════════════════════════════════════════════════ */

const API_BASE = window.location.origin;

const State = {
  step: 1,
  totalSteps: 4,
  file: null,
  config: {},
  result: null,
  processing: false,
  workflowId: null
};

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════

function init(workflowId, defaultConfig = {}) {
  State.workflowId = workflowId;
  State.config = { ...defaultConfig };
  
  // Load saved config
  const saved = localStorage.getItem(`config_${workflowId}`);
  if (saved) {
    try { State.config = { ...defaultConfig, ...JSON.parse(saved) }; } catch (e) {}
  }
  
  initTheme();
  initUpload();
  initConfig();
  updateSteps();
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════

function goTo(step) {
  if (step < 1 || step > State.totalSteps) return;
  if (State.processing && step !== State.step) return;
  
  State.step = step;
  
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  const content = document.getElementById(`step-${step}`);
  if (content) content.classList.add('active');
  
  updateSteps();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function next() {
  if (validate()) goTo(State.step + 1);
}

function prev() {
  goTo(State.step - 1);
}

function updateSteps() {
  document.querySelectorAll('.step').forEach((el, i) => {
    const num = i + 1;
    el.classList.remove('active', 'completed');
    if (num < State.step) el.classList.add('completed');
    if (num === State.step) el.classList.add('active');
  });
}

function validate() {
  if (State.step === 2 && !State.file && !getText()) {
    toast('Please upload a file or enter text', 'error');
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD
// ══════════════════════════════════════════════════════════════════════════════

function initUpload() {
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const input = zone.querySelector('input[type="file"]');
    
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0], zone);
    });
    
    if (input) {
      input.addEventListener('change', () => {
        if (input.files.length) handleFile(input.files[0], zone);
      });
    }
  });
}

function handleFile(file, zone) {
  State.file = file;
  zone.classList.add('has-file');
  
  const title = zone.querySelector('.upload-title');
  const subtitle = zone.querySelector('.upload-subtitle');
  
  if (title) title.textContent = file.name;
  if (subtitle) subtitle.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  
  toast('File uploaded');
}

function resetUpload() {
  State.file = null;
  document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.classList.remove('has-file');
    const title = zone.querySelector('.upload-title');
    const subtitle = zone.querySelector('.upload-subtitle');
    if (title) title.textContent = 'Drop file here';
    if (subtitle) subtitle.textContent = 'or click to browse';
  });
}

function getText() {
  const el = document.getElementById('text-input');
  return el ? el.value.trim() : '';
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════════════════

function initConfig() {
  document.querySelectorAll('[data-config]').forEach(input => {
    const key = input.dataset.config;
    const type = input.type;
    
    // Set initial value
    if (State.config[key] !== undefined) {
      if (type === 'checkbox') input.checked = State.config[key];
      else input.value = State.config[key];
    }
    
    if (type === 'range') updateRange(input);
    
    // Listen for changes
    input.addEventListener('change', () => {
      if (type === 'checkbox') State.config[key] = input.checked;
      else if (type === 'number' || type === 'range') State.config[key] = parseFloat(input.value);
      else State.config[key] = input.value;
      
      if (type === 'range') updateRange(input);
      saveConfig();
    });
    
    if (type === 'range') {
      input.addEventListener('input', () => updateRange(input));
    }
  });
}

function updateRange(input) {
  const display = document.getElementById(`${input.id}-value`);
  if (display) {
    const fmt = input.dataset.format || '';
    let val = input.value;
    if (fmt === 'currency') val = `$${parseFloat(val).toFixed(0)}`;
    else if (fmt === 'percent') val = `${val}%`;
    else if (fmt === 'minutes') val = `${val} min`;
    display.textContent = val;
  }
}

function saveConfig() {
  localStorage.setItem(`config_${State.workflowId}`, JSON.stringify(State.config));
}

function resetConfig() {
  localStorage.removeItem(`config_${State.workflowId}`);
  location.reload();
}

// ══════════════════════════════════════════════════════════════════════════════
// RUN WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════

async function run() {
  if (State.processing) return;
  
  State.processing = true;
  goTo(3);
  
  const form = new FormData();
  
  if (State.file) {
    form.append('file', State.file);
  } else {
    const text = getText();
    if (text) {
      const blob = new Blob([text], { type: 'text/plain' });
      form.append('file', blob, 'input.txt');
    }
  }
  
  form.append('config', JSON.stringify(State.config));
  
  animateProgress();
  
  try {
    const res = await fetch(`${API_BASE}/run/${State.workflowId}`, {
      method: 'POST',
      body: form
    });
    
    const data = await res.json();
    
    if (data.status === 'success') {
      State.result = data;
      finishProgress(true);
      setTimeout(() => {
        goTo(4);
        renderResults(data);
      }, 600);
    } else {
      finishProgress(false);
      toast(data.error || 'Processing failed', 'error');
    }
  } catch (err) {
    finishProgress(false);
    toast('Network error', 'error');
  } finally {
    State.processing = false;
  }
}

function animateProgress() {
  const steps = document.querySelectorAll('.processing-step');
  const bar = document.getElementById('progress-fill');
  const status = document.getElementById('progress-status');
  const pct = document.getElementById('progress-pct');
  
  let idx = 0;
  const total = steps.length;
  
  function tick() {
    if (idx >= total) return;
    
    steps.forEach((s, i) => {
      s.classList.remove('active', 'completed');
      if (i < idx) s.classList.add('completed');
      if (i === idx) s.classList.add('active');
    });
    
    const progress = ((idx + 1) / total) * 100;
    if (bar) bar.style.width = `${progress}%`;
    if (pct) pct.textContent = `${Math.round(progress)}%`;
    if (status) status.textContent = steps[idx]?.querySelector('.processing-step-title')?.textContent || 'Processing...';
    
    idx++;
    if (idx < total) setTimeout(tick, 600 + Math.random() * 400);
  }
  
  tick();
}

function finishProgress(success) {
  document.querySelectorAll('.processing-step').forEach(s => {
    s.classList.remove('active');
    s.classList.add('completed');
  });
  
  const bar = document.getElementById('progress-fill');
  const status = document.getElementById('progress-status');
  const pct = document.getElementById('progress-pct');
  
  if (bar) bar.style.width = '100%';
  if (pct) pct.textContent = '100%';
  if (status) status.textContent = success ? 'Complete' : 'Failed';
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════════════════════════════════════

function renderResults(data) {
  const grid = document.getElementById('results-grid');
  const json = document.getElementById('json-output');
  
  if (grid && data.result) {
    grid.innerHTML = '';
    Object.entries(data.result).forEach(([key, value]) => {
      if (key === 'confidence' || value === null) return;
      
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <div class="result-label">${formatLabel(key)}</div>
        <div class="result-value">${formatValue(value)}</div>
      `;
      grid.appendChild(item);
    });
  }
  
  if (json && data) {
    json.textContent = JSON.stringify(data, null, 2);
  }
  
  // Custom render hook
  if (typeof onResults === 'function') onResults(data);
}

function formatLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(val) {
  if (Array.isArray(val)) return val.join(', ') || '—';
  if (typeof val === 'object' && val !== null) return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function download(format = 'json') {
  if (!State.result) return toast('No results', 'error');
  
  let content, filename, type;
  
  if (format === 'json') {
    content = JSON.stringify(State.result, null, 2);
    filename = `${State.workflowId}_result.json`;
    type = 'application/json';
  } else {
    content = flattenToCSV(State.result.result);
    filename = `${State.workflowId}_result.csv`;
    type = 'text/csv';
  }
  
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  toast('Downloaded');
}

function flattenToCSV(obj) {
  if (!obj) return '';
  const keys = Object.keys(obj);
  const vals = keys.map(k => {
    const v = obj[k];
    if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
    return v;
  });
  return keys.join(',') + '\n' + vals.join(',');
}

// ══════════════════════════════════════════════════════════════════════════════
// DEMO
// ══════════════════════════════════════════════════════════════════════════════

async function loadDemo() {
  try {
    const res = await fetch(`${API_BASE}/workflows/${State.workflowId}/demo`);
    if (!res.ok) throw new Error('Demo not found');
    
    const data = await res.json();
    
    const textarea = document.getElementById('text-input');
    if (textarea && data.content) {
      textarea.value = data.content;
      toast('Demo loaded');
      goTo(2);
    }
  } catch (err) {
    toast('Could not load demo', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════

function toast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ══════════════════════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════════

window.Workflow = {
  init,
  goTo,
  next,
  prev,
  run,
  loadDemo,
  download,
  resetConfig,
  toggleTheme,
  toast,
  state: State
};
