/* ══════════════════════════════════════════════════════════════════════════════
   AI Strike Team — Shared Workflow UI JavaScript
   ══════════════════════════════════════════════════════════════════════════════ */

const API_BASE = window.location.origin;

// ── State ───────────────────────────────────────────────────────────────────
let currentFile = null;
let currentStep = 1;
let processingResult = null;

// ── Navigation ──────────────────────────────────────────────────────────────
function nav(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    
    const link = document.getElementById('nav-' + pageId);
    if (link) link.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepper(step) {
    currentStep = step;
    document.querySelectorAll('.step').forEach((el, idx) => {
        el.classList.remove('active', 'completed');
        if (idx + 1 < step) el.classList.add('completed');
        if (idx + 1 === step) el.classList.add('active');
    });
    document.querySelectorAll('.step-line').forEach((el, idx) => {
        el.classList.toggle('completed', idx + 1 < step);
    });
}

// ── File Handling ───────────────────────────────────────────────────────────
function setupUploadZone(zoneId, onFileSelected) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    
    const input = zone.querySelector('input[type="file"]');
    
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
            handleFileSelect(e.dataTransfer.files[0], zone, onFileSelected);
        }
    });
    
    if (input) {
        input.addEventListener('change', () => {
            if (input.files.length) {
                handleFileSelect(input.files[0], zone, onFileSelected);
            }
        });
    }
}

function handleFileSelect(file, zone, callback) {
    currentFile = file;
    zone.classList.add('has-file');
    
    const icon = zone.querySelector('.upload-icon');
    const title = zone.querySelector('h3');
    const desc = zone.querySelector('p');
    
    if (icon) icon.textContent = '📄';
    if (title) title.textContent = file.name;
    if (desc) desc.textContent = `${(file.size / 1024).toFixed(1)} KB — Ready for processing`;
    
    toast('File loaded successfully', 'success');
    if (callback) callback(file);
}

function resetUploadZone(zoneId) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    
    currentFile = null;
    zone.classList.remove('has-file');
    
    const icon = zone.querySelector('.upload-icon');
    const title = zone.querySelector('h3');
    const desc = zone.querySelector('p');
    
    if (icon) icon.textContent = '📥';
    if (title) title.textContent = 'Drop your file here';
    if (desc) desc.textContent = 'PDF, TXT, CSV, or paste text below';
}

// ── API Calls ───────────────────────────────────────────────────────────────
async function runWorkflow(workflowId, file, textInput = null) {
    const formData = new FormData();
    
    if (file) {
        formData.append('file', file);
    } else if (textInput) {
        const blob = new Blob([textInput], { type: 'text/plain' });
        formData.append('file', blob, 'input.txt');
    }
    
    try {
        const response = await fetch(`${API_BASE}/run/${workflowId}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            return { success: true, result: data.result, roi: data.roi };
        } else {
            return { success: false, error: data.error || 'Unknown error' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ── Progress Animation ──────────────────────────────────────────────────────
function animateProgress(progressId, statusId, steps, onComplete) {
    const progressEl = document.getElementById(progressId);
    const statusEl = document.getElementById(statusId);
    
    let currentIdx = 0;
    
    function nextStep() {
        if (currentIdx >= steps.length) {
            if (onComplete) onComplete();
            return;
        }
        
        const step = steps[currentIdx];
        if (progressEl) progressEl.style.width = step.progress + '%';
        if (statusEl) statusEl.textContent = step.message;
        
        currentIdx++;
        setTimeout(nextStep, step.duration || 800);
    }
    
    nextStep();
}

// ── Live Log ────────────────────────────────────────────────────────────────
function addLogEntry(logId, message, type = 'info') {
    const log = document.getElementById(logId);
    if (!log) return;
    
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${message}</span>
    `;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function clearLog(logId) {
    const log = document.getElementById(logId);
    if (log) log.innerHTML = '';
}

// ── Results Rendering ───────────────────────────────────────────────────────
function renderResults(containerId, result, fieldMapping) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(fieldMapping).forEach(([key, label]) => {
        const value = result[key];
        if (value === undefined || value === null) return;
        
        const confidence = result.confidence || 0.9;
        const confClass = confidence >= 0.9 ? 'confidence-high' : 
                         confidence >= 0.7 ? 'confidence-medium' : 'confidence-low';
        
        const row = document.createElement('div');
        row.className = 'result-row reveal';
        row.innerHTML = `
            <div>
                <div class="result-label">${label}</div>
                <div class="result-value">${formatValue(value)}</div>
            </div>
            <span class="result-confidence ${confClass}">${Math.round(confidence * 100)}%</span>
        `;
        container.appendChild(row);
        
        // Trigger reveal animation
        setTimeout(() => row.classList.add('active'), 50);
    });
}

function formatValue(value) {
    if (Array.isArray(value)) {
        return value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
    }
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'boolean') {
        return value ? '✓ Yes' : '✗ No';
    }
    return String(value);
}

function renderJSON(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const json = JSON.stringify(data, null, 2);
    container.innerHTML = syntaxHighlight(json);
}

function syntaxHighlight(json) {
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

// ── ROI Display ─────────────────────────────────────────────────────────────
function renderROI(containerId, roi) {
    const container = document.getElementById(containerId);
    if (!container || !roi) return;
    
    container.innerHTML = `
        <div class="metric-card">
            <div class="metric-value">${roi.time_saved || '—'}</div>
            <div class="metric-label">Time Saved</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${roi.cost_saved || '—'}</div>
            <div class="metric-label">Cost Saved</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${roi.accuracy || '—'}</div>
            <div class="metric-label">Accuracy</div>
        </div>
    `;
}

// ── Toast Notifications ─────────────────────────────────────────────────────
function toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span> ${message}`;
    container.appendChild(t);
    
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

// ── Theme Toggle ────────────────────────────────────────────────────────────
function toggleTheme() {
    const body = document.body;
    const current = body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
}

// ── Reveal Animation Observer ───────────────────────────────────────────────
function initRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── Demo Data Loading ───────────────────────────────────────────────────────
async function loadDemoFile(workflowId) {
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
        'production_report': '/shubh/production_report/demo/sample_production.csv',
        'rfp_intelligence': '/suri/rfp_intelligence/demo/sample_rfp.txt'
    };
    
    const path = demoFiles[workflowId];
    if (!path) {
        toast('No demo file available', 'warning');
        return null;
    }
    
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error('Demo file not found');
        
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/plain' });
        const file = new File([blob], path.split('/').pop(), { type: 'text/plain' });
        
        toast('Demo file loaded', 'success');
        return file;
    } catch (err) {
        toast('Could not load demo file', 'error');
        return null;
    }
}

// ── Initialization ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initRevealObserver();
});

// ── Export for use in individual workflow pages ─────────────────────────────
window.WorkflowUI = {
    nav,
    updateStepper,
    setupUploadZone,
    resetUploadZone,
    runWorkflow,
    animateProgress,
    addLogEntry,
    clearLog,
    renderResults,
    renderJSON,
    renderROI,
    toast,
    toggleTheme,
    loadDemoFile,
    get currentFile() { return currentFile; },
    set currentFile(f) { currentFile = f; },
    get processingResult() { return processingResult; },
    set processingResult(r) { processingResult = r; }
};
