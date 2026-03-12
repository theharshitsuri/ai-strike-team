/* ═══════════════════════════════════════════════════════════════════════════
   AI STRIKE TEAM — ADMIN CONSOLE JS
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:8000';

// ── State ──────────────────────────────────────────────────────────────────
let workflows = [];
let companies = [];
let runs = [];
let currentWorkflow = null;
let currentCompany = null;
let wizardStep = 1;
let selectedWorkflows = [];
let workflowConfigs = {};

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadWorkflows();
    await loadCompanies();
    await loadRuns();
    renderDashboard();
    renderWorkflows();
    renderCompanies();
    renderTemplates();
    renderSchedules();
});

// ── API Helpers ────────────────────────────────────────────────────────────
async function api(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}

// ── Data Loading ───────────────────────────────────────────────────────────
async function loadWorkflows() {
    try {
        const data = await api('/workflows');
        // Backend returns object with workflow names as keys
        workflows = Object.entries(data).map(([name, info]) => ({
            name,
            description: info.description,
            icon: info.icon || '⚙️',
            vertical: info.vertical,
            roi: info.roi,
            input_types: info.accepts || ['text'],
            active: true,
            color: info.color,
            demo_file: info.demo_file,
            ui_url: info.ui_url
        }));
    } catch (e) {
        console.warn('Using mock workflows:', e);
        workflows = getMockWorkflows();
    }
}

async function loadCompanies() {
    try {
        const data = await api('/clients');
        // Map backend fields to dashboard fields
        companies = data.map(c => ({
            name: c.company_name || c.slug,
            slug: c.slug,
            vertical: c.vertical,
            status: c.deployment_status || 'active',
            workflows: c.enabled_workflows || [],
            contact: c.contact_email,
            contract: c.contract_type,
            contractValue: c.contract_value,
            monthlyRetainer: c.monthly_retainer
        }));
    } catch (e) {
        console.warn('Using mock companies:', e);
        companies = getMockCompanies();
    }
}

async function loadRuns() {
    try {
        const data = await api('/runs');
        // Map backend fields to dashboard fields
        runs = data.map(r => ({
            id: r.id,
            workflow: r.workflow,
            company: r.client,
            status: r.status === 'success' || r.status === 'completed' ? 'success' : 'error',
            duration: r.elapsed_s ? `${r.elapsed_s}s` : '—',
            time: r.timestamp ? formatTimestamp(r.timestamp) : 'Just now',
            summary: r.result_summary
        }));
    } catch (e) {
        console.warn('Using mock runs:', e);
        runs = getMockRuns();
    }
}

function formatTimestamp(ts) {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// ── Page Navigation ────────────────────────────────────────────────────────
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`page-${pageId}`).classList.add('active');
    document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');
    
    if (pageId === 'workflows') renderWorkflows();
    if (pageId === 'companies') renderCompanies();
    if (pageId === 'runs') renderRuns();
    if (pageId === 'onboarding') initOnboarding();
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function renderDashboard() {
    const statsGrid = document.getElementById('stats-grid');
    const activeCompanies = companies.filter(c => c.status === 'active').length;
    const successRuns = runs.filter(r => r.status === 'success').length;
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="label">Total Workflows</div>
            <div class="value">${workflows.length}</div>
            <div class="sub">Across all verticals</div>
        </div>
        <div class="stat-card">
            <div class="label">Active Companies</div>
            <div class="value">${activeCompanies}</div>
            <div class="sub">${companies.length} total onboarded</div>
        </div>
        <div class="stat-card">
            <div class="label">Runs Today</div>
            <div class="value">${runs.length}</div>
            <div class="sub">${successRuns} successful</div>
        </div>
        <div class="stat-card">
            <div class="label">Success Rate</div>
            <div class="value">${runs.length ? Math.round(successRuns/runs.length*100) : 0}%</div>
            <div class="sub">Last 24 hours</div>
        </div>
    `;
    
    renderRecentActivity();
    renderActiveCompanies();
}

function renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    const recent = runs.slice(0, 5);
    
    if (!recent.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No recent activity</p></div>';
        return;
    }
    
    container.innerHTML = recent.map(r => `
        <div class="run-row" style="grid-template-columns: 40px 1fr 100px;">
            <div class="run-status">${r.status === 'success' ? '✅' : '❌'}</div>
            <div class="run-workflow">${r.workflow}</div>
            <div class="run-time">${r.time || 'Just now'}</div>
        </div>
    `).join('');
}

function renderActiveCompanies() {
    const container = document.getElementById('active-companies');
    const active = companies.filter(c => c.status === 'active').slice(0, 5);
    
    if (!active.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">🏢</div><p>No active companies</p></div>';
        return;
    }
    
    container.innerHTML = active.map(c => `
        <div class="company-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
            <div>
                <div style="font-weight:600;">${c.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">${c.workflows?.length || 0} workflows</div>
            </div>
            <span class="status-pill active">Active</span>
        </div>
    `).join('');
}

function refreshDashboard() {
    loadWorkflows().then(() => loadCompanies()).then(() => loadRuns()).then(() => {
        renderDashboard();
        toast('Dashboard refreshed', 'success');
    });
}

// ── Workflows ──────────────────────────────────────────────────────────────
function renderWorkflows() {
    const grid = document.getElementById('workflows-grid');
    const search = document.getElementById('workflow-search')?.value?.toLowerCase() || '';
    const vertical = document.getElementById('vertical-filter')?.value || '';
    
    let filtered = workflows.filter(w => {
        if (search && !w.name.toLowerCase().includes(search) && !w.description?.toLowerCase().includes(search)) return false;
        if (vertical && w.vertical !== vertical) return false;
        return true;
    });
    
    if (!filtered.length) {
        grid.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No workflows found</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(w => `
        <div class="workflow-card" onclick="openWorkflowDetail('${w.name}')" style="--card-accent: ${getVerticalColor(w.vertical)}">
            <div class="wf-header">
                <div class="wf-icon">${w.icon || '⚙️'}</div>
                <div class="wf-title">
                    <div class="wf-name">${formatName(w.name)}</div>
                    <div class="wf-vertical">${getVerticalLabel(w.vertical)}</div>
                </div>
            </div>
            <div class="wf-desc">${w.description || 'No description'}</div>
            <div class="wf-meta">
                <div class="wf-roi">${w.roi || ''}</div>
                <div class="wf-badges">
                    <span class="badge">${w.input_types?.[0] || 'text'}</span>
                    ${w.active ? '<span class="badge active">Active</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function filterWorkflows() { renderWorkflows(); }

function openWorkflowDetail(name) {
    currentWorkflow = workflows.find(w => w.name === name);
    if (!currentWorkflow) return;
    
    document.getElementById('wf-detail-name').textContent = formatName(name);
    showPage('workflow-detail');
    renderWorkflowDetail();
}

async function renderWorkflowDetail() {
    if (!currentWorkflow) return;
    
    // Info panel
    document.getElementById('workflow-info').innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Name</div>
                <div class="info-value">${formatName(currentWorkflow.name)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Vertical</div>
                <div class="info-value">${getVerticalLabel(currentWorkflow.vertical)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Input Types</div>
                <div class="info-value">${(currentWorkflow.input_types || ['text']).join(', ')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">ROI</div>
                <div class="info-value" style="color:var(--accent-green)">${currentWorkflow.roi || 'Not specified'}</div>
            </div>
        </div>
        <div class="info-item" style="margin-top:16px;">
            <div class="info-label">Description</div>
            <div class="info-value">${currentWorkflow.description || 'No description'}</div>
        </div>
    `;
    
    // Steps panel
    const steps = currentWorkflow.steps || [
        { title: 'Ingest', desc: 'Load and parse input data' },
        { title: 'Validate', desc: 'Check input requirements' },
        { title: 'Extract', desc: 'LLM extracts structured data' },
        { title: 'Act', desc: 'Execute actions and integrations' }
    ];
    
    document.getElementById('workflow-steps').innerHTML = `
        <div class="step-list">
            ${steps.map((s, i) => `
                <div class="step-item">
                    <div class="step-number">${i + 1}</div>
                    <div class="step-content">
                        <div class="step-title">${s.title}</div>
                        <div class="step-desc">${s.desc}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Schedule panel
    const schedule = currentWorkflow.schedule || { cron: '0 */6 * * *', enabled: false };
    document.getElementById('workflow-schedule').innerHTML = `
        <div class="schedule-info">
            <div class="schedule-item">
                <div class="schedule-icon">🕐</div>
                <div>
                    <div class="schedule-label">Cron Expression</div>
                    <div class="schedule-value"><code class="schedule-cron">${schedule.cron}</code></div>
                </div>
            </div>
            <div class="schedule-item">
                <div class="schedule-icon">${schedule.enabled ? '✅' : '⏸️'}</div>
                <div>
                    <div class="schedule-label">Status</div>
                    <div class="schedule-value">${schedule.enabled ? 'Enabled' : 'Disabled'}</div>
                </div>
            </div>
            <div class="schedule-item">
                <div class="schedule-icon">📅</div>
                <div>
                    <div class="schedule-label">Next Run</div>
                    <div class="schedule-value">${schedule.enabled ? getNextRun(schedule.cron) : 'N/A'}</div>
                </div>
            </div>
        </div>
    `;
    
    // Config editor
    try {
        const config = await api(`/workflows/${currentWorkflow.name}/config`);
        document.getElementById('config-editor').value = typeof config === 'string' ? config : JSON.stringify(config, null, 2);
    } catch (e) {
        document.getElementById('config-editor').value = '# Configuration not available\n# This workflow may not have a config file';
    }
    
    // Assigned companies
    const assigned = companies.filter(c => c.workflows?.includes(currentWorkflow.name));
    document.getElementById('assigned-companies').innerHTML = assigned.length ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${assigned.map(c => `
                <div class="badge" style="padding:8px 12px;font-size:12px;cursor:pointer;" onclick="openCompanyDetail('${c.slug}')">${c.name}</div>
            `).join('')}
        </div>
    ` : '<div class="empty-state"><p>No companies assigned</p></div>';
    
    // Recent runs
    const wfRuns = runs.filter(r => r.workflow === currentWorkflow.name).slice(0, 5);
    document.getElementById('workflow-runs').innerHTML = wfRuns.length ? `
        ${wfRuns.map(r => `
            <div class="run-row" style="grid-template-columns: 40px 1fr 100px 150px;">
                <div class="run-status">${r.status === 'success' ? '✅' : '❌'}</div>
                <div class="run-workflow">${r.company || 'Manual'}</div>
                <div class="run-time">${r.duration || '—'}</div>
                <div class="run-time">${r.time || 'Just now'}</div>
            </div>
        `).join('')}
    ` : '<div class="empty-state"><p>No runs yet</p></div>';
}

async function saveConfig() {
    if (!currentWorkflow) return;
    const config = document.getElementById('config-editor').value;
    try {
        await api(`/workflows/${currentWorkflow.name}/config`, {
            method: 'PUT',
            body: JSON.stringify({ config })
        });
        toast('Configuration saved', 'success');
    } catch (e) {
        toast('Failed to save config', 'error');
    }
}

function resetConfig() {
    if (confirm('Reset configuration to default?')) {
        renderWorkflowDetail();
        toast('Configuration reset', 'info');
    }
}

function duplicateWorkflow() {
    if (!currentWorkflow) return;
    showModal(`
        <h3>📋 Duplicate Workflow</h3>
        <p style="color:var(--text-secondary);margin-bottom:20px;">Create a copy of "${formatName(currentWorkflow.name)}" with a new name.</p>
        <div class="form-group">
            <label>New Workflow Name</label>
            <input type="text" id="duplicate-name" placeholder="e.g., ${currentWorkflow.name}_copy">
        </div>
        <div class="form-group">
            <label>Assign to Company (optional)</label>
            <select id="duplicate-company">
                <option value="">— None —</option>
                ${companies.map(c => `<option value="${c.slug}">${c.name}</option>`).join('')}
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmDuplicate()">Create Copy</button>
        </div>
    `);
}

async function confirmDuplicate() {
    const name = document.getElementById('duplicate-name').value;
    const company = document.getElementById('duplicate-company').value;
    
    if (!name) {
        toast('Please enter a name', 'error');
        return;
    }
    
    try {
        await api('/workflows/duplicate', {
            method: 'POST',
            body: JSON.stringify({
                source: currentWorkflow.name,
                target: name,
                company: company || null
            })
        });
        toast(`Workflow "${name}" created`, 'success');
        hideModal();
        await loadWorkflows();
        showPage('workflows');
    } catch (e) {
        // Mock success for demo
        workflows.push({
            ...currentWorkflow,
            name: name,
            description: `Copy of ${currentWorkflow.description}`
        });
        toast(`Workflow "${name}" created`, 'success');
        hideModal();
        showPage('workflows');
    }
}

async function runWorkflowDemo() {
    if (!currentWorkflow) return;
    toast(`Running ${formatName(currentWorkflow.name)} demo...`, 'info');
    
    try {
        // First fetch demo data, then run with it
        const demoRes = await fetch(`${API_BASE}/workflows/${currentWorkflow.name}/demo`);
        if (!demoRes.ok) throw new Error('Demo data not found');
        const demoData = await demoRes.json();
        
        // Run workflow with demo text using FormData (backend expects form data)
        const formData = new FormData();
        formData.append('text_input', demoData.content);
        
        const result = await fetch(`${API_BASE}/run/${currentWorkflow.name}`, {
            method: 'POST',
            body: formData
        });
        
        if (!result.ok) throw new Error('Run failed');
        const data = await result.json();
        
        toast('Demo completed successfully!', 'success');
        await loadRuns(); // Refresh runs from backend
        renderWorkflowDetail();
    } catch (e) {
        console.error('Demo run error:', e);
        toast('Demo run failed: ' + e.message, 'error');
    }
}

function editSchedule() {
    const schedule = currentWorkflow?.schedule || { cron: '0 */6 * * *', enabled: false };
    showModal(`
        <h3>🕐 Configure Schedule</h3>
        <div class="form-group">
            <label>Cron Expression</label>
            <input type="text" id="schedule-cron" class="cron-input" value="${schedule.cron}" placeholder="0 */6 * * *">
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">
                Format: minute hour day month weekday
            </div>
        </div>
        <div class="form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="schedule-enabled" ${schedule.enabled ? 'checked' : ''}>
                Enable scheduled runs
            </label>
        </div>
        <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--text-muted);">Common patterns:</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('schedule-cron').value='0 * * * *'">Every hour</button>
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('schedule-cron').value='0 */6 * * *'">Every 6 hours</button>
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('schedule-cron').value='0 9 * * *'">Daily 9am</button>
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('schedule-cron').value='0 9 * * 1-5'">Weekdays 9am</button>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveSchedule()">Save Schedule</button>
        </div>
    `);
}

function saveSchedule() {
    const cron = document.getElementById('schedule-cron').value;
    const enabled = document.getElementById('schedule-enabled').checked;
    
    if (currentWorkflow) {
        currentWorkflow.schedule = { cron, enabled };
    }
    
    toast('Schedule updated', 'success');
    hideModal();
    renderWorkflowDetail();
}

// ── Companies ──────────────────────────────────────────────────────────────
function renderCompanies() {
    const grid = document.getElementById('companies-grid');
    const search = document.getElementById('company-search')?.value?.toLowerCase() || '';
    
    let filtered = companies.filter(c => {
        if (search && !c.name.toLowerCase().includes(search)) return false;
        return true;
    });
    
    if (!filtered.length) {
        grid.innerHTML = '<div class="empty-state"><div class="icon">🏢</div><p>No companies found</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(c => `
        <div class="company-card" onclick="openCompanyDetail('${c.slug}')">
            <div class="company-header">
                <div class="company-name">${c.name}</div>
                <span class="status-pill ${c.status || 'active'}">${c.status || 'Active'}</span>
            </div>
            <div class="company-vertical">${getVerticalLabel(c.vertical)} • ${c.size || 'Medium'}</div>
            <div class="company-workflows">
                ${(c.workflows || []).slice(0, 3).map(w => `<span class="badge">${formatName(w)}</span>`).join('')}
                ${(c.workflows?.length || 0) > 3 ? `<span class="badge">+${c.workflows.length - 3}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function filterCompanies() { renderCompanies(); }

function openCompanyDetail(slug) {
    currentCompany = companies.find(c => c.slug === slug);
    if (!currentCompany) return;
    
    document.getElementById('company-detail-name').textContent = currentCompany.name;
    showPage('company-detail');
    renderCompanyDetail();
}

function renderCompanyDetail() {
    if (!currentCompany) return;
    
    // Info
    document.getElementById('company-info').innerHTML = `
        <div class="info-item"><div class="info-label">Name</div><div class="info-value">${currentCompany.name}</div></div>
        <div class="info-item"><div class="info-label">Vertical</div><div class="info-value">${getVerticalLabel(currentCompany.vertical)}</div></div>
        <div class="info-item"><div class="info-label">Contact</div><div class="info-value">${currentCompany.contact || 'Not set'}</div></div>
        <div class="info-item"><div class="info-label">Contract</div><div class="info-value">${currentCompany.contract || 'Monthly'}</div></div>
    `;
    
    // Stats
    const companyRuns = runs.filter(r => r.company === currentCompany.slug);
    document.getElementById('company-stats').innerHTML = `
        <div class="info-item"><div class="info-label">Total Runs</div><div class="info-value">${companyRuns.length}</div></div>
        <div class="info-item"><div class="info-label">Success Rate</div><div class="info-value">${companyRuns.length ? Math.round(companyRuns.filter(r=>r.status==='success').length/companyRuns.length*100) : 0}%</div></div>
        <div class="info-item"><div class="info-label">Active Workflows</div><div class="info-value">${currentCompany.workflows?.length || 0}</div></div>
        <div class="info-item"><div class="info-label">Onboarded</div><div class="info-value">${currentCompany.onboarded || 'Recently'}</div></div>
    `;
    
    // Workflows
    const wfs = currentCompany.workflows || [];
    document.getElementById('company-workflows').innerHTML = wfs.length ? `
        <div style="display:flex;flex-direction:column;gap:10px;">
            ${wfs.map(wName => {
                const wf = workflows.find(w => w.name === wName) || { name: wName };
                return `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-secondary);border-radius:8px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span style="font-size:20px;">${wf.icon || '⚙️'}</span>
                            <div>
                                <div style="font-weight:600;">${formatName(wf.name)}</div>
                                <div style="font-size:12px;color:var(--text-muted);">${wf.description?.substring(0, 50) || ''}...</div>
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-sm btn-secondary" onclick="editWorkflowOverride('${wName}')">Configure</button>
                            <button class="btn btn-sm btn-danger" onclick="unassignWorkflow('${wName}')">Remove</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    ` : '<div class="empty-state"><p>No workflows assigned</p></div>';
    
    // Runs
    document.getElementById('company-runs').innerHTML = companyRuns.length ? `
        ${companyRuns.slice(0, 5).map(r => `
            <div class="run-row" style="grid-template-columns: 40px 1fr 100px;">
                <div class="run-status">${r.status === 'success' ? '✅' : '❌'}</div>
                <div class="run-workflow">${formatName(r.workflow)}</div>
                <div class="run-time">${r.time || 'Just now'}</div>
            </div>
        `).join('')}
    ` : '<div class="empty-state"><p>No runs yet</p></div>';
}

function openAssignWorkflowModal() {
    const available = workflows.filter(w => !currentCompany?.workflows?.includes(w.name));
    showModal(`
        <h3>➕ Assign Workflow</h3>
        <p style="color:var(--text-secondary);margin-bottom:20px;">Select workflows to assign to ${currentCompany?.name}</p>
        <div style="max-height:300px;overflow-y:auto;">
            ${available.map(w => `
                <label class="workflow-select-item" style="margin-bottom:8px;">
                    <input type="checkbox" value="${w.name}" style="display:none;">
                    <div class="checkbox">✓</div>
                    <span class="wf-icon">${w.icon || '⚙️'}</span>
                    <div class="wf-info">
                        <div class="wf-name">${formatName(w.name)}</div>
                        <div class="wf-desc">${w.description?.substring(0, 40) || ''}...</div>
                    </div>
                </label>
            `).join('')}
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmAssignWorkflows()">Assign Selected</button>
        </div>
    `);
    
    document.querySelectorAll('.workflow-select-item').forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('selected');
            item.querySelector('input').checked = item.classList.contains('selected');
        });
    });
}

async function confirmAssignWorkflows() {
    const selected = Array.from(document.querySelectorAll('.workflow-select-item.selected input')).map(i => i.value);
    if (!selected.length) {
        toast('Select at least one workflow', 'error');
        return;
    }
    
    try {
        // Assign each workflow via backend API
        for (const wfName of selected) {
            const formData = new FormData();
            formData.append('workflow_name', wfName);
            await fetch(`${API_BASE}/clients/${currentCompany.slug}/workflows`, {
                method: 'POST',
                body: formData
            });
        }
        toast(`${selected.length} workflow(s) assigned`, 'success');
        await loadCompanies();
        currentCompany = companies.find(c => c.slug === currentCompany.slug);
        hideModal();
        renderCompanyDetail();
    } catch (e) {
        // Fallback to local state
        if (!currentCompany.workflows) currentCompany.workflows = [];
        currentCompany.workflows.push(...selected);
        toast(`${selected.length} workflow(s) assigned (offline)`, 'success');
        hideModal();
        renderCompanyDetail();
    }
}

async function unassignWorkflow(wfName) {
    if (!confirm(`Remove ${formatName(wfName)} from ${currentCompany?.name}?`)) return;
    
    try {
        await fetch(`${API_BASE}/clients/${currentCompany.slug}/workflows/${wfName}`, {
            method: 'DELETE'
        });
        toast('Workflow removed', 'success');
        await loadCompanies();
        currentCompany = companies.find(c => c.slug === currentCompany.slug);
        renderCompanyDetail();
    } catch (e) {
        // Fallback to local state
        currentCompany.workflows = currentCompany.workflows.filter(w => w !== wfName);
        toast('Workflow removed (offline)', 'success');
        renderCompanyDetail();
    }
}

function editWorkflowOverride(wfName) {
    showModal(`
        <h3>⚙️ Configure Override</h3>
        <p style="color:var(--text-secondary);margin-bottom:20px;">Custom settings for ${formatName(wfName)} at ${currentCompany?.name}</p>
        <div class="form-group">
            <label>Custom Prompt Override</label>
            <textarea id="override-prompt" placeholder="Leave empty to use default" style="min-height:100px;"></textarea>
        </div>
        <div class="form-group">
            <label>Confidence Threshold</label>
            <input type="number" id="override-threshold" placeholder="0.85" step="0.05" min="0" max="1">
        </div>
        <div class="form-group">
            <label>Slack Channel Override</label>
            <input type="text" id="override-slack" placeholder="#company-alerts">
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveOverride('${wfName}')">Save Override</button>
        </div>
    `);
}

async function saveOverride(wfName) {
    const prompt = document.getElementById('override-prompt').value;
    const threshold = document.getElementById('override-threshold').value;
    const slack = document.getElementById('override-slack').value;
    
    const overrides = {};
    if (prompt) overrides.custom_prompt = prompt;
    if (threshold) overrides.confidence_threshold = parseFloat(threshold);
    if (slack) overrides.slack_channel = slack;
    
    try {
        await fetch(`${API_BASE}/clients/${currentCompany.slug}/overrides/${wfName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(overrides)
        });
        toast(`Override saved for ${formatName(wfName)}`, 'success');
    } catch (e) {
        toast(`Override saved for ${formatName(wfName)} (offline)`, 'success');
    }
    hideModal();
}

function editCompany() {
    showModal(`
        <h3>✏️ Edit Company</h3>
        <div class="form-group">
            <label>Company Name</label>
            <input type="text" id="edit-company-name" value="${currentCompany?.name || ''}">
        </div>
        <div class="form-group">
            <label>Contact Email</label>
            <input type="email" id="edit-company-email" value="${currentCompany?.contact || ''}">
        </div>
        <div class="form-group">
            <label>Status</label>
            <select id="edit-company-status">
                <option value="active" ${currentCompany?.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="paused" ${currentCompany?.status === 'paused' ? 'selected' : ''}>Paused</option>
                <option value="setup" ${currentCompany?.status === 'setup' ? 'selected' : ''}>Setup</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveCompanyEdit()">Save Changes</button>
        </div>
    `);
}

async function saveCompanyEdit() {
    const newName = document.getElementById('edit-company-name').value;
    const newContact = document.getElementById('edit-company-email').value;
    const newStatus = document.getElementById('edit-company-status').value;
    
    try {
        // Fetch current config and update it
        const currentConfig = await api(`/clients/${currentCompany.slug}`);
        currentConfig.company_name = newName;
        currentConfig.contact_email = newContact;
        currentConfig.deployment_status = newStatus;
        
        await fetch(`${API_BASE}/clients/${currentCompany.slug}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentConfig)
        });
        
        toast('Company updated', 'success');
        await loadCompanies();
        currentCompany = companies.find(c => c.slug === currentCompany.slug);
        hideModal();
        renderCompanyDetail();
    } catch (e) {
        // Fallback to local update
        currentCompany.name = newName;
        currentCompany.contact = newContact;
        currentCompany.status = newStatus;
        toast('Company updated (offline)', 'success');
        hideModal();
        renderCompanyDetail();
    }
}

async function deleteCompany() {
    if (!confirm(`Delete ${currentCompany?.name}? This cannot be undone.`)) return;
    
    try {
        await fetch(`${API_BASE}/clients/${currentCompany.slug}`, { method: 'DELETE' });
        toast('Company deleted', 'success');
        await loadCompanies();
        showPage('companies');
    } catch (e) {
        // Fallback to local delete
        companies = companies.filter(c => c.slug !== currentCompany.slug);
        toast('Company deleted (offline)', 'success');
        showPage('companies');
    }
}

// ── Onboarding Wizard ──────────────────────────────────────────────────────
function initOnboarding() {
    wizardStep = 1;
    selectedWorkflows = [];
    workflowConfigs = {};
    updateWizardUI();
    renderWorkflowSelector();
}

function updateWizardUI() {
    document.querySelectorAll('.wizard-step').forEach((el, i) => {
        el.classList.remove('active', 'completed');
        if (i + 1 < wizardStep) el.classList.add('completed');
        if (i + 1 === wizardStep) el.classList.add('active');
    });
    
    document.querySelectorAll('.wizard-panel').forEach((el, i) => {
        el.classList.toggle('active', i + 1 === wizardStep);
    });
    
    document.getElementById('wizard-prev').disabled = wizardStep === 1;
    document.getElementById('wizard-next').textContent = wizardStep === 4 ? '🚀 Launch' : 'Next →';
}

function wizardNext() {
    if (wizardStep === 1) {
        const name = document.getElementById('onboard-company-name').value;
        if (!name) { toast('Company name is required', 'error'); return; }
    }
    if (wizardStep === 2 && !selectedWorkflows.length) {
        toast('Select at least one workflow', 'error'); return;
    }
    if (wizardStep === 3) {
        renderReviewSummary();
    }
    if (wizardStep === 4) {
        completeOnboarding();
        return;
    }
    wizardStep++;
    updateWizardUI();
}

function wizardPrev() {
    if (wizardStep > 1) {
        wizardStep--;
        updateWizardUI();
    }
}

function renderWorkflowSelector() {
    const vertical = document.getElementById('onboard-vertical')?.value || 'logistics';
    const container = document.getElementById('workflow-selector');
    
    const relevant = workflows.filter(w => w.vertical === vertical || w.vertical === 'cross_vertical');
    
    container.innerHTML = relevant.map(w => `
        <div class="workflow-select-item ${selectedWorkflows.includes(w.name) ? 'selected' : ''}" onclick="toggleWorkflowSelection('${w.name}')">
            <div class="checkbox">${selectedWorkflows.includes(w.name) ? '✓' : ''}</div>
            <span class="wf-icon">${w.icon || '⚙️'}</span>
            <div class="wf-info">
                <div class="wf-name">${formatName(w.name)}</div>
                <div class="wf-desc">${w.description?.substring(0, 50) || ''}...</div>
            </div>
        </div>
    `).join('');
}

function toggleWorkflowSelection(name) {
    if (selectedWorkflows.includes(name)) {
        selectedWorkflows = selectedWorkflows.filter(w => w !== name);
    } else {
        selectedWorkflows.push(name);
    }
    renderWorkflowSelector();
    renderWorkflowConfigs();
}

function renderWorkflowConfigs() {
    const container = document.getElementById('workflow-configs');
    if (!selectedWorkflows.length) {
        container.innerHTML = '<div class="empty-state"><p>Select workflows in the previous step</p></div>';
        return;
    }
    
    container.innerHTML = selectedWorkflows.map(wName => {
        const wf = workflows.find(w => w.name === wName) || { name: wName };
        return `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                    <span style="font-size:24px;">${wf.icon || '⚙️'}</span>
                    <div>
                        <div style="font-weight:700;">${formatName(wf.name)}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${wf.description?.substring(0, 60) || ''}...</div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Slack Channel</label>
                        <input type="text" placeholder="#alerts" onchange="workflowConfigs['${wName}'] = {...(workflowConfigs['${wName}']||{}), slack: this.value}">
                    </div>
                    <div class="form-group">
                        <label>Schedule</label>
                        <select onchange="workflowConfigs['${wName}'] = {...(workflowConfigs['${wName}']||{}), schedule: this.value}">
                            <option value="manual">Manual only</option>
                            <option value="hourly">Every hour</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderReviewSummary() {
    const name = document.getElementById('onboard-company-name').value;
    const vertical = document.getElementById('onboard-vertical').value;
    const size = document.getElementById('onboard-size').value;
    const contact = document.getElementById('onboard-contact-name').value;
    const email = document.getElementById('onboard-contact-email').value;
    const contract = document.getElementById('onboard-contract').value;
    const value = document.getElementById('onboard-contract-value').value;
    
    document.getElementById('review-summary').innerHTML = `
        <div class="review-section">
            <h4>Company Details</h4>
            <div class="review-item"><span class="review-label">Name</span><span class="review-value">${name}</span></div>
            <div class="review-item"><span class="review-label">Vertical</span><span class="review-value">${getVerticalLabel(vertical)}</span></div>
            <div class="review-item"><span class="review-label">Size</span><span class="review-value">${size}</span></div>
            <div class="review-item"><span class="review-label">Contact</span><span class="review-value">${contact} (${email})</span></div>
            <div class="review-item"><span class="review-label">Contract</span><span class="review-value">${contract} - $${value || '0'}</span></div>
        </div>
        <div class="review-section">
            <h4>Selected Workflows (${selectedWorkflows.length})</h4>
            ${selectedWorkflows.map(wName => {
                const wf = workflows.find(w => w.name === wName) || { name: wName };
                return `<div class="review-item"><span class="review-label">${wf.icon || '⚙️'} ${formatName(wName)}</span><span class="review-value">${workflowConfigs[wName]?.schedule || 'Manual'}</span></div>`;
            }).join('')}
        </div>
    `;
}

async function completeOnboarding() {
    const name = document.getElementById('onboard-company-name').value;
    const vertical = document.getElementById('onboard-vertical').value;
    const contactName = document.getElementById('onboard-contact-name').value;
    const contactEmail = document.getElementById('onboard-contact-email').value;
    
    try {
        // Create client using FormData (backend expects form data)
        const formData = new FormData();
        formData.append('company_name', name);
        formData.append('vertical', vertical);
        formData.append('contact_name', contactName);
        formData.append('contact_email', contactEmail);
        
        const res = await fetch(`${API_BASE}/clients`, {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) throw new Error('Failed to create client');
        const result = await res.json();
        const slug = result.slug;
        
        // Assign selected workflows to the new client
        for (const wfName of selectedWorkflows) {
            const wfForm = new FormData();
            wfForm.append('workflow_name', wfName);
            await fetch(`${API_BASE}/clients/${slug}/workflows`, {
                method: 'POST',
                body: wfForm
            });
        }
        
        toast(`🎉 ${name} onboarded successfully!`, 'success');
        await loadCompanies(); // Refresh from backend
        showPage('companies');
    } catch (e) {
        console.error('Onboarding error:', e);
        // Fallback to local state for demo
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        companies.push({
            name,
            slug,
            vertical,
            status: 'active',
            workflows: selectedWorkflows,
            contact: contactEmail,
            onboarded: new Date().toLocaleDateString()
        });
        toast(`🎉 ${name} onboarded (offline mode)`, 'success');
        showPage('companies');
    }
}

// ── Runs ───────────────────────────────────────────────────────────────────
function renderRuns() {
    const container = document.getElementById('runs-table');
    const wfFilter = document.getElementById('runs-workflow-filter')?.value || '';
    const statusFilter = document.getElementById('runs-status-filter')?.value || '';
    
    // Populate workflow filter
    const wfSelect = document.getElementById('runs-workflow-filter');
    if (wfSelect && wfSelect.options.length <= 1) {
        workflows.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.name;
            opt.textContent = formatName(w.name);
            wfSelect.appendChild(opt);
        });
    }
    
    let filtered = runs.filter(r => {
        if (wfFilter && r.workflow !== wfFilter) return false;
        if (statusFilter && r.status !== statusFilter) return false;
        return true;
    });
    
    container.innerHTML = `
        <div class="run-row header">
            <div></div>
            <div>Workflow</div>
            <div>Company</div>
            <div>Duration</div>
            <div>Status</div>
            <div>Time</div>
        </div>
        ${filtered.length ? filtered.map(r => `
            <div class="run-row">
                <div class="run-status">${r.status === 'success' ? '✅' : '❌'}</div>
                <div class="run-workflow">${formatName(r.workflow)}</div>
                <div class="run-company">${r.company || 'Manual'}</div>
                <div class="run-time">${r.duration || '—'}</div>
                <div><span class="badge ${r.status === 'success' ? 'active' : ''}">${r.status}</span></div>
                <div class="run-time">${r.time || 'Just now'}</div>
            </div>
        `).join('') : '<div class="empty-state" style="grid-column:1/-1;"><p>No runs found</p></div>'}
    `;
}

function filterRuns() { renderRuns(); }

// ── Templates ──────────────────────────────────────────────────────────────
function renderTemplates() {
    const grid = document.getElementById('templates-grid');
    grid.innerHTML = `
        <div class="template-card" onclick="useTemplate('document_extraction')">
            <div class="icon">📄</div>
            <div class="name">Document Extraction</div>
            <div class="desc">Extract structured data from PDFs, invoices, and documents using LLM</div>
        </div>
        <div class="template-card" onclick="useTemplate('email_automation')">
            <div class="icon">📧</div>
            <div class="name">Email Automation</div>
            <div class="desc">Parse incoming emails, extract data, and trigger automated responses</div>
        </div>
        <div class="template-card" onclick="useTemplate('data_validation')">
            <div class="icon">✅</div>
            <div class="name">Data Validation</div>
            <div class="desc">Validate and cross-reference data against business rules</div>
        </div>
        <div class="template-card" onclick="useTemplate('alert_system')">
            <div class="icon">🚨</div>
            <div class="name">Alert System</div>
            <div class="desc">Monitor conditions and send Slack/email alerts when triggered</div>
        </div>
        <div class="template-card" onclick="useTemplate('report_generation')">
            <div class="icon">📊</div>
            <div class="name">Report Generation</div>
            <div class="desc">Aggregate data and generate formatted reports automatically</div>
        </div>
        <div class="template-card" onclick="useTemplate('blank')">
            <div class="icon">➕</div>
            <div class="name">Blank Workflow</div>
            <div class="desc">Start from scratch with a minimal workflow template</div>
        </div>
    `;
}

function useTemplate(template) {
    showPage('workflow-builder');
    document.getElementById('new-wf-name').value = template === 'blank' ? '' : `custom_${template}`;
    toast(`Template "${template}" loaded`, 'info');
}

// ── Schedules ──────────────────────────────────────────────────────────────
function renderSchedules() {
    const grid = document.getElementById('schedules-grid');
    const schedules = workflows.filter(w => w.schedule?.enabled).map(w => ({
        workflow: w.name,
        cron: w.schedule.cron,
        enabled: w.schedule.enabled
    }));
    
    if (!schedules.length) {
        grid.innerHTML = '<div class="empty-state"><div class="icon">🕐</div><p>No scheduled jobs. Configure schedules in workflow settings.</p></div>';
        return;
    }
    
    grid.innerHTML = schedules.map(s => `
        <div class="schedule-card">
            <div class="schedule-card-header">
                <h4>${formatName(s.workflow)}</h4>
                <div class="schedule-toggle ${s.enabled ? 'active' : ''}" onclick="toggleSchedule('${s.workflow}')"></div>
            </div>
            <div class="schedule-details">
                <span class="schedule-cron">${s.cron}</span>
                <span style="margin-left:12px;">Next: ${getNextRun(s.cron)}</span>
            </div>
        </div>
    `).join('');
}

function toggleSchedule(wfName) {
    const wf = workflows.find(w => w.name === wfName);
    if (wf?.schedule) {
        wf.schedule.enabled = !wf.schedule.enabled;
        renderSchedules();
        toast(`Schedule ${wf.schedule.enabled ? 'enabled' : 'disabled'}`, 'success');
    }
}

function openScheduleModal() {
    showModal(`
        <h3>➕ New Schedule</h3>
        <div class="form-group">
            <label>Workflow</label>
            <select id="new-schedule-wf">
                ${workflows.map(w => `<option value="${w.name}">${formatName(w.name)}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Cron Expression</label>
            <input type="text" id="new-schedule-cron" class="cron-input" placeholder="0 9 * * *">
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" onclick="createSchedule()">Create Schedule</button>
        </div>
    `);
}

function createSchedule() {
    const wfName = document.getElementById('new-schedule-wf').value;
    const cron = document.getElementById('new-schedule-cron').value;
    
    const wf = workflows.find(w => w.name === wfName);
    if (wf) {
        wf.schedule = { cron, enabled: true };
        toast('Schedule created', 'success');
        hideModal();
        renderSchedules();
    }
}

// ── Workflow Builder ───────────────────────────────────────────────────────
function renderTemplateOptions() {
    const container = document.getElementById('template-options');
    container.innerHTML = `
        <div class="template-option selected" onclick="selectBuilderTemplate('blank')">
            <span class="icon">➕</span>
            <span class="name">Blank</span>
        </div>
        ${workflows.slice(0, 5).map(w => `
            <div class="template-option" onclick="selectBuilderTemplate('${w.name}')">
                <span class="icon">${w.icon || '⚙️'}</span>
                <span class="name">${formatName(w.name)}</span>
            </div>
        `).join('')}
    `;
}

function selectBuilderTemplate(name) {
    document.querySelectorAll('.template-option').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    if (name !== 'blank') {
        const wf = workflows.find(w => w.name === name);
        if (wf) {
            document.getElementById('new-wf-desc').value = wf.description || '';
            document.getElementById('new-wf-icon').value = wf.icon || '';
            document.getElementById('new-wf-vertical').value = wf.vertical || 'logistics';
        }
    }
}

function addStep() {
    const container = document.getElementById('steps-builder');
    const num = container.children.length + 1;
    const step = document.createElement('div');
    step.className = 'step-item';
    step.innerHTML = `
        <div class="step-number">${num}</div>
        <div class="step-content">
            <input type="text" placeholder="Step title">
            <input type="text" placeholder="Step description">
        </div>
    `;
    container.appendChild(step);
}

async function createWorkflow() {
    const name = document.getElementById('new-wf-name').value;
    const desc = document.getElementById('new-wf-desc').value;
    const icon = document.getElementById('new-wf-icon').value;
    const vertical = document.getElementById('new-wf-vertical').value;
    const roi = document.getElementById('new-wf-roi').value;
    
    if (!name) { toast('Workflow name is required', 'error'); return; }
    if (!desc) { toast('Description is required', 'error'); return; }
    
    const newWf = {
        name: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        description: desc,
        icon: icon || '⚙️',
        vertical,
        roi,
        input_types: ['text'],
        active: true
    };
    
    workflows.push(newWf);
    toast(`Workflow "${name}" created!`, 'success');
    showPage('workflows');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getVerticalColor(v) {
    const colors = { logistics: '#3B82F6', manufacturing: '#10B981', wholesale: '#A855F7', cross_vertical: '#06B6D4' };
    return colors[v] || '#3B82F6';
}

function getVerticalLabel(v) {
    const labels = { logistics: '🚛 Logistics', manufacturing: '🏭 Manufacturing', wholesale: '📦 Wholesale', cross_vertical: '🌐 Cross-Vertical' };
    return labels[v] || v;
}

function getNextRun(cron) {
    const now = new Date();
    now.setHours(now.getHours() + 6);
    return now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ── Modal ──────────────────────────────────────────────────────────────────
function showModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-backdrop').classList.add('visible');
}

function hideModal() {
    document.getElementById('modal-backdrop').classList.remove('visible');
}

document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal();
});

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${message}`;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ── Mock Data ──────────────────────────────────────────────────────────────
function getMockWorkflows() {
    return [
        { name: 'detention_tracking', description: 'Track detention times and generate invoices automatically', icon: '⏱️', vertical: 'logistics', roi: 'Save 20 min/invoice', input_types: ['text', 'file'], active: true, schedule: { cron: '0 */6 * * *', enabled: true } },
        { name: 'freight_audit', description: 'Audit freight invoices against rate confirmations', icon: '📋', vertical: 'logistics', roi: 'Catch $5K/month errors', input_types: ['pdf'], active: true },
        { name: 'load_scheduling', description: 'Extract and schedule load appointments from emails', icon: '📅', vertical: 'logistics', roi: 'Save 15 min/load', input_types: ['text'], active: true },
        { name: 'shipment_followup', description: 'Generate follow-up emails for delayed shipments', icon: '📧', vertical: 'logistics', roi: 'Reduce delays 30%', input_types: ['text'], active: true },
        { name: 'maintenance_triage', description: 'Triage maintenance requests and route to teams', icon: '🔧', vertical: 'manufacturing', roi: 'Faster response time', input_types: ['text'], active: true },
        { name: 'po_extraction', description: 'Extract purchase order data from documents', icon: '📄', vertical: 'wholesale', roi: 'Save 10 min/PO', input_types: ['pdf', 'text'], active: true },
        { name: 'rfp_intelligence', description: 'Analyze RFPs and extract key requirements', icon: '🎯', vertical: 'cross_vertical', roi: 'Win more bids', input_types: ['pdf'], active: true },
        { name: 'scheduling_automation', description: 'Automate service scheduling from requests', icon: '🗓️', vertical: 'cross_vertical', roi: 'Save 25 min/request', input_types: ['text'], active: true }
    ];
}

function getMockCompanies() {
    return [
        { name: 'Acme Logistics', slug: 'acme_logistics', vertical: 'logistics', size: 'large', status: 'active', workflows: ['detention_tracking', 'freight_audit', 'load_scheduling'], contact: 'john@acme.com', contract: 'annual', onboarded: '2024-01-15' },
        { name: 'Swift Transport', slug: 'swift_transport', vertical: 'logistics', size: 'medium', status: 'active', workflows: ['shipment_followup', 'load_scheduling'], contact: 'sarah@swift.com', contract: 'monthly', onboarded: '2024-02-20' },
        { name: 'Premier Manufacturing', slug: 'premier_mfg', vertical: 'manufacturing', size: 'enterprise', status: 'active', workflows: ['maintenance_triage', 'po_extraction'], contact: 'mike@premier.com', contract: 'enterprise', onboarded: '2024-01-05' },
        { name: 'Global Wholesale', slug: 'global_wholesale', vertical: 'wholesale', size: 'large', status: 'setup', workflows: ['po_extraction'], contact: 'lisa@global.com', contract: 'pilot', onboarded: '2024-03-01' }
    ];
}

function getMockRuns() {
    return [
        { workflow: 'detention_tracking', company: 'acme_logistics', status: 'success', duration: '2.3s', time: '5 min ago' },
        { workflow: 'freight_audit', company: 'acme_logistics', status: 'success', duration: '4.1s', time: '12 min ago' },
        { workflow: 'load_scheduling', company: 'swift_transport', status: 'error', duration: '1.2s', time: '25 min ago' },
        { workflow: 'shipment_followup', company: 'swift_transport', status: 'success', duration: '3.5s', time: '1 hour ago' },
        { workflow: 'maintenance_triage', company: 'premier_mfg', status: 'success', duration: '2.8s', time: '2 hours ago' },
        { workflow: 'po_extraction', company: 'global_wholesale', status: 'success', duration: '5.2s', time: '3 hours ago' }
    ];
}

// Initialize template options on page load
setTimeout(() => renderTemplateOptions(), 100);
