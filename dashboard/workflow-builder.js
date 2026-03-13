// ══════════════════════════════════════════════════════════════════════════════
// AI Strike Team — Visual Workflow Builder (n8n/Zapier Style)
// ══════════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:8000';

// ── State ───────────────────────────────────────────────────────────────────
let nodes = [];
let connections = [];
let selectedNode = null;
let draggedNode = null;
let connecting = null;
let zoom = 1;
let pan = { x: 0, y: 0 };
let nodeIdCounter = 1;
let companies = [];
let workflows = [];
let currentCompany = null;
let undoStack = [];
let redoStack = [];

// ── Node Definitions ────────────────────────────────────────────────────────
const NODE_TYPES = {
    'trigger-email': { 
        label: 'Email Received', 
        icon: '📧', 
        category: 'trigger',
        color: '#3B82F6',
        outputs: ['email'],
        config: {
            mailbox: { type: 'text', label: 'Mailbox/Folder', default: 'INBOX' },
            filter: { type: 'text', label: 'Subject Filter', default: '' },
            polling: { type: 'select', label: 'Check Interval', options: ['1 min', '5 min', '15 min', '1 hour'], default: '5 min' }
        }
    },
    'trigger-webhook': { 
        label: 'Webhook', 
        icon: '🔗', 
        category: 'trigger',
        color: '#3B82F6',
        outputs: ['data'],
        config: {
            method: { type: 'select', label: 'HTTP Method', options: ['POST', 'GET', 'PUT'], default: 'POST' },
            path: { type: 'text', label: 'Endpoint Path', default: '/webhook' }
        }
    },
    'trigger-schedule': { 
        label: 'Schedule', 
        icon: '⏰', 
        category: 'trigger',
        color: '#3B82F6',
        outputs: ['trigger'],
        config: {
            cron: { type: 'text', label: 'Cron Expression', default: '0 9 * * *' },
            timezone: { type: 'text', label: 'Timezone', default: 'America/New_York' }
        }
    },
    'trigger-file': { 
        label: 'File Upload', 
        icon: '📁', 
        category: 'trigger',
        color: '#3B82F6',
        outputs: ['file'],
        config: {
            accept: { type: 'text', label: 'Accepted Types', default: '.pdf,.txt,.csv' }
        }
    },
    'ai-extract': { 
        label: 'LLM Extract', 
        icon: '🧠', 
        category: 'ai',
        color: '#8B5CF6',
        inputs: ['data'],
        outputs: ['extracted'],
        config: {
            prompt: { type: 'textarea', label: 'Extraction Prompt', default: 'Extract the following fields from the input:\n- field1\n- field2' },
            model: { type: 'select', label: 'Model', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3'], default: 'gpt-4o-mini' },
            temperature: { type: 'number', label: 'Temperature', default: 0.1, min: 0, max: 1, step: 0.1 },
            schema: { type: 'textarea', label: 'Output Schema (JSON)', default: '{\n  "field1": "string",\n  "field2": "number"\n}' }
        }
    },
    'ai-classify': { 
        label: 'Classify', 
        icon: '🏷️', 
        category: 'ai',
        color: '#8B5CF6',
        inputs: ['data'],
        outputs: ['category', 'confidence'],
        config: {
            categories: { type: 'textarea', label: 'Categories (one per line)', default: 'urgent\nnormal\nlow_priority' },
            prompt: { type: 'textarea', label: 'Classification Prompt', default: 'Classify the following input into one of the categories.' }
        }
    },
    'ai-summarize': { 
        label: 'Summarize', 
        icon: '📝', 
        category: 'ai',
        color: '#8B5CF6',
        inputs: ['data'],
        outputs: ['summary'],
        config: {
            maxLength: { type: 'number', label: 'Max Length (words)', default: 100 },
            style: { type: 'select', label: 'Style', options: ['bullet_points', 'paragraph', 'executive'], default: 'bullet_points' }
        }
    },
    'ai-generate': { 
        label: 'Generate Text', 
        icon: '✨', 
        category: 'ai',
        color: '#8B5CF6',
        inputs: ['context'],
        outputs: ['text'],
        config: {
            prompt: { type: 'textarea', label: 'Generation Prompt', default: 'Generate a response based on the context.' },
            tone: { type: 'select', label: 'Tone', options: ['professional', 'friendly', 'formal', 'casual'], default: 'professional' }
        }
    },
    'logic-condition': { 
        label: 'If/Else', 
        icon: '🔀', 
        category: 'logic',
        color: '#F97316',
        inputs: ['data'],
        outputs: ['true', 'false'],
        config: {
            field: { type: 'text', label: 'Field to Check', default: 'confidence' },
            operator: { type: 'select', label: 'Operator', options: ['>', '<', '>=', '<=', '==', '!=', 'contains', 'startsWith'], default: '>=' },
            value: { type: 'text', label: 'Compare Value', default: '0.85' }
        }
    },
    'logic-switch': { 
        label: 'Switch', 
        icon: '🎚️', 
        category: 'logic',
        color: '#F97316',
        inputs: ['data'],
        outputs: ['case1', 'case2', 'case3', 'default'],
        config: {
            field: { type: 'text', label: 'Switch Field', default: 'category' },
            cases: { type: 'textarea', label: 'Cases (one per line)', default: 'urgent\nnormal\nlow_priority' }
        }
    },
    'logic-loop': { 
        label: 'Loop', 
        icon: '🔄', 
        category: 'logic',
        color: '#F97316',
        inputs: ['items'],
        outputs: ['item', 'done'],
        config: {
            batchSize: { type: 'number', label: 'Batch Size', default: 1 }
        }
    },
    'logic-merge': { 
        label: 'Merge', 
        icon: '🔗', 
        category: 'logic',
        color: '#F97316',
        inputs: ['input1', 'input2'],
        outputs: ['merged'],
        config: {
            mode: { type: 'select', label: 'Merge Mode', options: ['combine', 'append', 'zip'], default: 'combine' }
        }
    },
    'action-slack': { 
        label: 'Slack Message', 
        icon: '💬', 
        category: 'action',
        color: '#10B981',
        inputs: ['data'],
        outputs: ['sent'],
        config: {
            channel: { type: 'text', label: 'Channel', default: '#alerts' },
            message: { type: 'textarea', label: 'Message Template', default: 'New alert: {{summary}}' },
            mention: { type: 'text', label: 'Mention Users', default: '' }
        }
    },
    'action-email': { 
        label: 'Send Email', 
        icon: '📤', 
        category: 'action',
        color: '#10B981',
        inputs: ['data'],
        outputs: ['sent'],
        config: {
            to: { type: 'text', label: 'To', default: '{{email}}' },
            subject: { type: 'text', label: 'Subject', default: 'Notification: {{title}}' },
            body: { type: 'textarea', label: 'Body Template', default: 'Hello,\n\n{{message}}\n\nBest regards' }
        }
    },
    'action-webhook': { 
        label: 'HTTP Request', 
        icon: '🌐', 
        category: 'action',
        color: '#10B981',
        inputs: ['data'],
        outputs: ['response'],
        config: {
            url: { type: 'text', label: 'URL', default: 'https://api.example.com/endpoint' },
            method: { type: 'select', label: 'Method', options: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'], default: 'POST' },
            headers: { type: 'textarea', label: 'Headers (JSON)', default: '{\n  "Content-Type": "application/json"\n}' },
            body: { type: 'textarea', label: 'Body Template', default: '{{data}}' }
        }
    },
    'action-database': { 
        label: 'Database', 
        icon: '🗄️', 
        category: 'action',
        color: '#10B981',
        inputs: ['data'],
        outputs: ['result'],
        config: {
            operation: { type: 'select', label: 'Operation', options: ['insert', 'update', 'upsert', 'query'], default: 'insert' },
            table: { type: 'text', label: 'Table/Collection', default: 'records' },
            query: { type: 'textarea', label: 'Query/Data', default: '' }
        }
    },
    'action-erp': { 
        label: 'ERP/CRM', 
        icon: '📊', 
        category: 'action',
        color: '#10B981',
        inputs: ['data'],
        outputs: ['result'],
        config: {
            system: { type: 'select', label: 'System', options: ['SAP', 'Oracle', 'Salesforce', 'HubSpot', 'Custom'], default: 'Custom' },
            action: { type: 'text', label: 'Action', default: 'create_record' },
            mapping: { type: 'textarea', label: 'Field Mapping (JSON)', default: '{}' }
        }
    },
    'output-report': { 
        label: 'Generate Report', 
        icon: '📄', 
        category: 'output',
        color: '#EC4899',
        inputs: ['data'],
        outputs: ['report'],
        config: {
            format: { type: 'select', label: 'Format', options: ['PDF', 'Excel', 'HTML', 'Markdown'], default: 'PDF' },
            template: { type: 'text', label: 'Template Name', default: 'default' }
        }
    },
    'output-invoice': { 
        label: 'Create Invoice', 
        icon: '💰', 
        category: 'output',
        color: '#EC4899',
        inputs: ['data'],
        outputs: ['invoice'],
        config: {
            currency: { type: 'select', label: 'Currency', options: ['USD', 'EUR', 'GBP'], default: 'USD' },
            taxRate: { type: 'number', label: 'Tax Rate (%)', default: 0 }
        }
    },
    'output-calendar': { 
        label: 'Calendar Event', 
        icon: '📅', 
        category: 'output',
        color: '#EC4899',
        inputs: ['data'],
        outputs: ['event'],
        config: {
            calendar: { type: 'select', label: 'Calendar', options: ['Google', 'Outlook', 'iCal'], default: 'Google' },
            duration: { type: 'number', label: 'Duration (min)', default: 60 }
        }
    }
};

// ── Workflow Templates ──────────────────────────────────────────────────────
const WORKFLOW_TEMPLATES = {
    'load_scheduling': {
        name: 'Load Scheduling',
        description: 'Parse scheduling emails and create calendar events',
        icon: '📅',
        nodes: [
            { id: 1, type: 'trigger-email', x: 50, y: 150, config: { mailbox: 'scheduling@company.com', filter: 'load|delivery|pickup' } },
            { id: 2, type: 'ai-extract', x: 300, y: 150, config: { prompt: 'Extract load scheduling details:\n- load_id\n- pickup_date\n- pickup_time\n- pickup_location\n- delivery_date\n- delivery_time\n- delivery_location\n- carrier_name\n- driver_phone' } },
            { id: 3, type: 'logic-condition', x: 550, y: 150, config: { field: 'confidence', operator: '>=', value: '0.85' } },
            { id: 4, type: 'output-calendar', x: 800, y: 100, config: { calendar: 'Google', duration: 120 } },
            { id: 5, type: 'action-slack', x: 800, y: 220, config: { channel: '#scheduling-review', message: 'Low confidence extraction needs review:\n{{summary}}' } }
        ],
        connections: [
            { from: 1, fromPort: 'email', to: 2, toPort: 'data' },
            { from: 2, fromPort: 'extracted', to: 3, toPort: 'data' },
            { from: 3, fromPort: 'true', to: 4, toPort: 'data' },
            { from: 3, fromPort: 'false', to: 5, toPort: 'data' }
        ]
    },
    'detention_tracking': {
        name: 'Detention Tracking',
        description: 'Track detention times and generate invoices',
        icon: '⏱️',
        nodes: [
            { id: 1, type: 'trigger-webhook', x: 50, y: 150, config: { method: 'POST', path: '/detention' } },
            { id: 2, type: 'ai-extract', x: 300, y: 150, config: { prompt: 'Extract detention timestamps:\n- arrival_time\n- departure_time\n- location\n- load_id\n- carrier' } },
            { id: 3, type: 'logic-condition', x: 550, y: 150, config: { field: 'detention_hours', operator: '>', value: '2' } },
            { id: 4, type: 'output-invoice', x: 800, y: 100, config: { currency: 'USD', taxRate: 0 } },
            { id: 5, type: 'action-slack', x: 800, y: 220, config: { channel: '#detention-alerts', message: 'Detention fee: ${{amount}} for load {{load_id}}' } }
        ],
        connections: [
            { from: 1, fromPort: 'data', to: 2, toPort: 'data' },
            { from: 2, fromPort: 'extracted', to: 3, toPort: 'data' },
            { from: 3, fromPort: 'true', to: 4, toPort: 'data' },
            { from: 4, fromPort: 'invoice', to: 5, toPort: 'data' }
        ]
    },
    'freight_audit': {
        name: 'Freight Audit',
        description: 'Compare invoices to rate confirmations',
        icon: '🔍',
        nodes: [
            { id: 1, type: 'trigger-email', x: 50, y: 150, config: { mailbox: 'invoices@company.com', filter: 'invoice|freight|carrier' } },
            { id: 2, type: 'ai-extract', x: 300, y: 80, config: { prompt: 'Extract invoice details:\n- invoice_number\n- carrier\n- amount\n- load_id\n- line_items' } },
            { id: 3, type: 'action-database', x: 300, y: 220, config: { operation: 'query', table: 'rate_confirmations', query: 'SELECT * WHERE load_id = {{load_id}}' } },
            { id: 4, type: 'logic-merge', x: 550, y: 150, config: { mode: 'combine' } },
            { id: 5, type: 'ai-classify', x: 750, y: 150, config: { categories: 'match\novercharge\nundercharge\nmissing_data', prompt: 'Compare invoice to rate confirmation and classify.' } },
            { id: 6, type: 'action-slack', x: 950, y: 150, config: { channel: '#freight-audit', message: 'Audit result: {{category}} - {{summary}}' } }
        ],
        connections: [
            { from: 1, fromPort: 'email', to: 2, toPort: 'data' },
            { from: 1, fromPort: 'email', to: 3, toPort: 'data' },
            { from: 2, fromPort: 'extracted', to: 4, toPort: 'input1' },
            { from: 3, fromPort: 'result', to: 4, toPort: 'input2' },
            { from: 4, fromPort: 'merged', to: 5, toPort: 'data' },
            { from: 5, fromPort: 'category', to: 6, toPort: 'data' }
        ]
    },
    'po_email_to_erp': {
        name: 'PO Email to ERP',
        description: 'Parse PO emails and create ERP entries',
        icon: '📧',
        nodes: [
            { id: 1, type: 'trigger-email', x: 50, y: 150, config: { mailbox: 'orders@company.com', filter: 'purchase order|PO' } },
            { id: 2, type: 'ai-extract', x: 300, y: 150, config: { prompt: 'Extract PO details:\n- po_number\n- customer_name\n- items (sku, quantity, price)\n- shipping_address\n- requested_date' } },
            { id: 3, type: 'logic-condition', x: 550, y: 150, config: { field: 'confidence', operator: '>=', value: '0.9' } },
            { id: 4, type: 'action-erp', x: 800, y: 100, config: { system: 'SAP', action: 'create_sales_order' } },
            { id: 5, type: 'action-email', x: 800, y: 220, config: { to: '{{customer_email}}', subject: 'PO {{po_number}} Received', body: 'We have received your order and it is being processed.' } }
        ],
        connections: [
            { from: 1, fromPort: 'email', to: 2, toPort: 'data' },
            { from: 2, fromPort: 'extracted', to: 3, toPort: 'data' },
            { from: 3, fromPort: 'true', to: 4, toPort: 'data' },
            { from: 4, fromPort: 'result', to: 5, toPort: 'data' }
        ]
    },
    'maintenance_triage': {
        name: 'Maintenance Triage',
        description: 'Classify and route maintenance tickets',
        icon: '🔧',
        nodes: [
            { id: 1, type: 'trigger-webhook', x: 50, y: 150, config: { method: 'POST', path: '/maintenance' } },
            { id: 2, type: 'ai-classify', x: 300, y: 150, config: { categories: 'electrical\nmechanical\nplumbing\nhvac\nit\nother', prompt: 'Classify this maintenance request.' } },
            { id: 3, type: 'logic-switch', x: 550, y: 150, config: { field: 'category', cases: 'electrical\nmechanical\nplumbing' } },
            { id: 4, type: 'action-slack', x: 800, y: 50, config: { channel: '#electrical-team', message: 'New ticket: {{summary}}' } },
            { id: 5, type: 'action-slack', x: 800, y: 150, config: { channel: '#mechanical-team', message: 'New ticket: {{summary}}' } },
            { id: 6, type: 'action-slack', x: 800, y: 250, config: { channel: '#facilities', message: 'New ticket: {{summary}}' } }
        ],
        connections: [
            { from: 1, fromPort: 'data', to: 2, toPort: 'data' },
            { from: 2, fromPort: 'category', to: 3, toPort: 'data' },
            { from: 3, fromPort: 'case1', to: 4, toPort: 'data' },
            { from: 3, fromPort: 'case2', to: 5, toPort: 'data' },
            { from: 3, fromPort: 'default', to: 6, toPort: 'data' }
        ]
    },
    'shipment_followup': {
        name: 'Shipment Follow-up',
        description: 'Monitor shipments and send follow-up emails',
        icon: '📦',
        nodes: [
            { id: 1, type: 'trigger-schedule', x: 50, y: 150, config: { cron: '0 9 * * *', timezone: 'America/New_York' } },
            { id: 2, type: 'action-database', x: 300, y: 150, config: { operation: 'query', table: 'shipments', query: 'SELECT * WHERE status = "in_transit" AND eta < NOW()' } },
            { id: 3, type: 'logic-loop', x: 550, y: 150, config: { batchSize: 1 } },
            { id: 4, type: 'ai-generate', x: 750, y: 150, config: { prompt: 'Generate a professional follow-up email asking for shipment status update.', tone: 'professional' } },
            { id: 5, type: 'action-email', x: 950, y: 150, config: { to: '{{carrier_email}}', subject: 'Status Update Request: Load {{load_id}}', body: '{{generated_text}}' } }
        ],
        connections: [
            { from: 1, fromPort: 'trigger', to: 2, toPort: 'data' },
            { from: 2, fromPort: 'result', to: 3, toPort: 'items' },
            { from: 3, fromPort: 'item', to: 4, toPort: 'context' },
            { from: 4, fromPort: 'text', to: 5, toPort: 'data' }
        ]
    }
};

// ── Initialize ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupDragAndDrop();
    setupCanvasInteraction();
    setupKeyboardShortcuts();
    renderNodes();
    renderConnections();
    
    // Check URL params for template or share link
    const params = new URLSearchParams(window.location.search);
    const template = params.get('template');
    const share = params.get('share');
    const company = params.get('company');
    
    if (template && WORKFLOW_TEMPLATES[template]) {
        loadTemplate(template);
    }
    if (company) {
        document.getElementById('company-select').value = company;
        loadCompanyConfig();
    }
    if (share) {
        loadSharedWorkflow(share);
    }
});

async function loadData() {
    try {
        const [wfRes, compRes] = await Promise.all([
            fetch(`${API_BASE}/workflows`),
            fetch(`${API_BASE}/clients`)
        ]);
        workflows = await wfRes.json();
        companies = await compRes.json();
        populateCompanySelect();
    } catch (e) {
        console.warn('Using offline mode');
        companies = [
            { slug: 'acme_logistics', company_name: 'Acme Logistics' },
            { slug: 'swift_freight', company_name: 'Swift Freight' },
            { slug: 'global_shipping', company_name: 'Global Shipping Co' }
        ];
        populateCompanySelect();
    }
}

function populateCompanySelect() {
    const select = document.getElementById('company-select');
    select.innerHTML = '<option value="">— Select Company —</option>' +
        companies.map(c => `<option value="${c.slug}">${c.company_name || c.slug}</option>`).join('');
}

// ── Drag and Drop ───────────────────────────────────────────────────────────
function setupDragAndDrop() {
    document.querySelectorAll('.node-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('nodeType', item.dataset.type);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });
    
    const canvas = document.getElementById('canvas');
    
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('nodeType');
        if (!nodeType || !NODE_TYPES[nodeType]) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        
        addNode(nodeType, x, y);
    });
}

function addNode(type, x, y, config = {}) {
    saveState();
    const nodeDef = NODE_TYPES[type];
    const node = {
        id: nodeIdCounter++,
        type,
        x,
        y,
        config: { ...getDefaultConfig(type), ...config }
    };
    nodes.push(node);
    renderNodes();
    selectNode(node);
    toast(`Added ${nodeDef.label}`, 'success');
}

function getDefaultConfig(type) {
    const nodeDef = NODE_TYPES[type];
    const config = {};
    if (nodeDef.config) {
        Object.entries(nodeDef.config).forEach(([key, def]) => {
            config[key] = def.default;
        });
    }
    return config;
}

// ── Canvas Interaction ──────────────────────────────────────────────────────
function setupCanvasInteraction() {
    const canvas = document.getElementById('canvas');
    let isPanning = false;
    let startPan = { x: 0, y: 0 };
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.target === canvas || e.target.classList.contains('nodes-layer')) {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                isPanning = true;
                startPan = { x: e.clientX - pan.x, y: e.clientY - pan.y };
                canvas.style.cursor = 'grabbing';
            } else if (e.button === 0) {
                deselectAll();
            }
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            pan.x = e.clientX - startPan.x;
            pan.y = e.clientY - startPan.y;
            updateCanvasTransform();
        }
        if (draggedNode) {
            const rect = canvas.getBoundingClientRect();
            draggedNode.x = (e.clientX - rect.left - pan.x) / zoom - draggedNode.offsetX;
            draggedNode.y = (e.clientY - rect.top - pan.y) / zoom - draggedNode.offsetY;
            renderNodes();
            renderConnections();
        }
        if (connecting) {
            renderTempConnection(e);
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        isPanning = false;
        canvas.style.cursor = '';
        if (draggedNode) {
            draggedNode = null;
        }
        if (connecting) {
            connecting = null;
            document.getElementById('temp-connection')?.remove();
        }
    });
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoom = Math.max(0.25, Math.min(2, zoom * delta));
        updateCanvasTransform();
        document.getElementById('zoom-level').textContent = Math.round(zoom * 100) + '%';
    });
}

function updateCanvasTransform() {
    const nodesLayer = document.getElementById('nodes-layer');
    const svg = document.getElementById('connections-svg');
    nodesLayer.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    svg.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelected();
        }
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveWorkflow();
        }
    });
}

// ── Render Nodes ────────────────────────────────────────────────────────────
function renderNodes() {
    const layer = document.getElementById('nodes-layer');
    layer.innerHTML = nodes.map(node => {
        const def = NODE_TYPES[node.type];
        const isSelected = selectedNode?.id === node.id;
        return `
            <div class="workflow-node ${isSelected ? 'selected' : ''}" 
                 id="node-${node.id}"
                 style="left: ${node.x}px; top: ${node.y}px;"
                 data-id="${node.id}">
                <div class="node-header ${def.category}">
                    <span class="node-header-icon">${def.icon}</span>
                    <span class="node-header-title">${def.label}</span>
                    <span class="node-header-menu" onclick="showNodeMenu(event, ${node.id})">⋮</span>
                </div>
                <div class="node-body">
                    ${getNodePreview(node)}
                    <div class="node-status">
                        <span class="status-dot ready"></span>
                        <span>Ready</span>
                    </div>
                </div>
                ${def.inputs ? `<div class="node-port input" data-node="${node.id}" data-port="input"></div>` : ''}
                ${def.outputs ? `<div class="node-port output" data-node="${node.id}" data-port="output"></div>` : ''}
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    layer.querySelectorAll('.workflow-node').forEach(el => {
        el.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('node-port')) return;
            const node = nodes.find(n => n.id === parseInt(el.dataset.id));
            selectNode(node);
            
            const rect = el.getBoundingClientRect();
            draggedNode = {
                ...node,
                offsetX: (e.clientX - rect.left) / zoom,
                offsetY: (e.clientY - rect.top) / zoom
            };
        });
    });
    
    // Port connections
    layer.querySelectorAll('.node-port.output').forEach(port => {
        port.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            connecting = {
                fromNode: parseInt(port.dataset.node),
                fromPort: port.dataset.port,
                startX: port.getBoundingClientRect().left + 6,
                startY: port.getBoundingClientRect().top + 6
            };
        });
    });
    
    layer.querySelectorAll('.node-port.input').forEach(port => {
        port.addEventListener('mouseup', (e) => {
            if (connecting && connecting.fromNode !== parseInt(port.dataset.node)) {
                addConnection(connecting.fromNode, 'output', parseInt(port.dataset.node), 'input');
            }
        });
    });
}

function getNodePreview(node) {
    const def = NODE_TYPES[node.type];
    const config = node.config || {};
    
    switch (node.type) {
        case 'trigger-email':
            return `<div style="font-size:10px;opacity:0.7;">📥 ${config.mailbox || 'INBOX'}</div>`;
        case 'trigger-schedule':
            return `<div style="font-size:10px;opacity:0.7;">🕐 ${config.cron || '0 9 * * *'}</div>`;
        case 'ai-extract':
            return `<div style="font-size:10px;opacity:0.7;">🤖 ${config.model || 'gpt-4o-mini'}</div>`;
        case 'logic-condition':
            return `<div style="font-size:10px;opacity:0.7;">if ${config.field} ${config.operator} ${config.value}</div>`;
        case 'action-slack':
            return `<div style="font-size:10px;opacity:0.7;">${config.channel || '#alerts'}</div>`;
        default:
            return '';
    }
}

// ── Render Connections ──────────────────────────────────────────────────────
function renderConnections() {
    const svg = document.getElementById('connections-svg');
    svg.innerHTML = connections.map((conn, i) => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return '';
        
        const fromX = fromNode.x + 180;
        const fromY = fromNode.y + 50;
        const toX = toNode.x;
        const toY = toNode.y + 50;
        
        const path = generateBezierPath(fromX, fromY, toX, toY);
        return `<path class="connection" d="${path}" data-index="${i}" onclick="selectConnection(${i})"/>`;
    }).join('');
}

function generateBezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function renderTempConnection(e) {
    let temp = document.getElementById('temp-connection');
    if (!temp) {
        const svg = document.getElementById('connections-svg');
        temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        temp.id = 'temp-connection';
        temp.setAttribute('class', 'connection');
        temp.style.stroke = 'var(--accent-blue)';
        temp.style.strokeDasharray = '5,5';
        svg.appendChild(temp);
    }
    
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const x2 = (e.clientX - rect.left - pan.x) / zoom;
    const y2 = (e.clientY - rect.top - pan.y) / zoom;
    
    const fromNode = nodes.find(n => n.id === connecting.fromNode);
    const x1 = fromNode.x + 180;
    const y1 = fromNode.y + 50;
    
    temp.setAttribute('d', generateBezierPath(x1, y1, x2, y2));
}

function addConnection(fromId, fromPort, toId, toPort) {
    saveState();
    // Check for duplicate
    const exists = connections.some(c => c.from === fromId && c.to === toId);
    if (exists) return;
    
    connections.push({ from: fromId, fromPort, to: toId, toPort });
    renderConnections();
    toast('Connected nodes', 'success');
}

// ── Selection ───────────────────────────────────────────────────────────────
function selectNode(node) {
    selectedNode = node;
    renderNodes();
    renderProperties(node);
}

function deselectAll() {
    selectedNode = null;
    renderNodes();
    document.getElementById('properties-content').innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">👆</span>
            <p>Select a node to configure</p>
        </div>
    `;
}

function selectConnection(index) {
    // Could highlight connection, for now just allow deletion
    if (confirm('Delete this connection?')) {
        saveState();
        connections.splice(index, 1);
        renderConnections();
    }
}

// ── Properties Panel ────────────────────────────────────────────────────────
function renderProperties(node) {
    const def = NODE_TYPES[node.type];
    const content = document.getElementById('properties-content');
    
    let html = `
        <div class="property-group">
            <div class="property-group-header">Node Info</div>
            <div class="property-field">
                <label>Type</label>
                <input type="text" value="${def.label}" disabled>
            </div>
            <div class="property-field">
                <label>ID</label>
                <input type="text" value="${node.id}" disabled>
            </div>
        </div>
    `;
    
    if (def.config) {
        html += `<div class="property-group"><div class="property-group-header">Configuration</div>`;
        Object.entries(def.config).forEach(([key, fieldDef]) => {
            const value = node.config?.[key] ?? fieldDef.default;
            html += renderPropertyField(node.id, key, fieldDef, value);
        });
        html += `</div>`;
    }
    
    // Company override section
    if (currentCompany) {
        html += `
            <div class="property-group">
                <div class="property-group-header">Company Override (${currentCompany})</div>
                <p style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">
                    These settings will be applied when running for this company.
                </p>
                <button class="btn btn-sm btn-secondary" onclick="applyCompanyOverride(${node.id})">
                    Load Company Defaults
                </button>
            </div>
        `;
    }
    
    content.innerHTML = html;
    
    // Attach change listeners
    content.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('change', () => {
            const nodeId = parseInt(el.dataset.nodeId);
            const key = el.dataset.key;
            if (nodeId && key) {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    node.config = node.config || {};
                    node.config[key] = el.value;
                    renderNodes();
                }
            }
        });
    });
}

function renderPropertyField(nodeId, key, fieldDef, value) {
    const id = `prop-${nodeId}-${key}`;
    let input = '';
    
    switch (fieldDef.type) {
        case 'select':
            input = `<select id="${id}" data-node-id="${nodeId}" data-key="${key}">
                ${fieldDef.options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>`;
            break;
        case 'textarea':
            input = `<textarea id="${id}" data-node-id="${nodeId}" data-key="${key}">${value || ''}</textarea>`;
            break;
        case 'number':
            input = `<input type="number" id="${id}" data-node-id="${nodeId}" data-key="${key}" value="${value}" 
                     min="${fieldDef.min ?? ''}" max="${fieldDef.max ?? ''}" step="${fieldDef.step ?? 1}">`;
            break;
        default:
            input = `<input type="text" id="${id}" data-node-id="${nodeId}" data-key="${key}" value="${value || ''}">`;
    }
    
    return `
        <div class="property-field">
            <label for="${id}">${fieldDef.label}</label>
            ${input}
            ${fieldDef.hint ? `<div class="hint">${fieldDef.hint}</div>` : ''}
        </div>
    `;
}

// ── Node Menu ───────────────────────────────────────────────────────────────
function showNodeMenu(e, nodeId) {
    e.stopPropagation();
    // Simple context menu
    const action = prompt('Action: duplicate, delete, or cancel');
    if (action === 'duplicate') {
        duplicateNode(nodeId);
    } else if (action === 'delete') {
        deleteNode(nodeId);
    }
}

function duplicateNode(nodeId) {
    saveState();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const newNode = {
        ...node,
        id: nodeIdCounter++,
        x: node.x + 50,
        y: node.y + 50,
        config: { ...node.config }
    };
    nodes.push(newNode);
    renderNodes();
    selectNode(newNode);
    toast('Node duplicated', 'success');
}

function deleteNode(nodeId) {
    saveState();
    nodes = nodes.filter(n => n.id !== nodeId);
    connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    if (selectedNode?.id === nodeId) deselectAll();
    renderNodes();
    renderConnections();
    toast('Node deleted', 'success');
}

function deleteSelected() {
    if (selectedNode) {
        deleteNode(selectedNode.id);
    }
}

// ── Undo/Redo ───────────────────────────────────────────────────────────────
function saveState() {
    undoStack.push(JSON.stringify({ nodes, connections }));
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
}

function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify({ nodes, connections }));
    const state = JSON.parse(undoStack.pop());
    nodes = state.nodes;
    connections = state.connections;
    renderNodes();
    renderConnections();
    toast('Undo', 'info');
}

function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify({ nodes, connections }));
    const state = JSON.parse(redoStack.pop());
    nodes = state.nodes;
    connections = state.connections;
    renderNodes();
    renderConnections();
    toast('Redo', 'info');
}

// ── Zoom Controls ───────────────────────────────────────────────────────────
function zoomIn() {
    zoom = Math.min(2, zoom * 1.2);
    updateCanvasTransform();
    document.getElementById('zoom-level').textContent = Math.round(zoom * 100) + '%';
}

function zoomOut() {
    zoom = Math.max(0.25, zoom / 1.2);
    updateCanvasTransform();
    document.getElementById('zoom-level').textContent = Math.round(zoom * 100) + '%';
}

function resetZoom() {
    zoom = 1;
    pan = { x: 0, y: 0 };
    updateCanvasTransform();
    document.getElementById('zoom-level').textContent = '100%';
}

function autoLayout() {
    // Simple auto-layout: arrange nodes in a grid
    saveState();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((node, i) => {
        node.x = 50 + (i % cols) * 250;
        node.y = 50 + Math.floor(i / cols) * 150;
    });
    renderNodes();
    renderConnections();
    toast('Auto-layout applied', 'success');
}

// ── Templates ───────────────────────────────────────────────────────────────
function loadTemplate(templateId) {
    const template = WORKFLOW_TEMPLATES[templateId];
    if (!template) return;
    
    saveState();
    nodes = template.nodes.map(n => ({
        ...n,
        config: { ...getDefaultConfig(n.type), ...n.config }
    }));
    connections = [...template.connections];
    nodeIdCounter = Math.max(...nodes.map(n => n.id)) + 1;
    
    document.getElementById('workflow-name').value = template.name;
    renderNodes();
    renderConnections();
    toast(`Loaded template: ${template.name}`, 'success');
}

function showTemplates() {
    const modal = document.getElementById('templates-modal');
    const grid = document.getElementById('templates-grid');
    
    grid.innerHTML = Object.entries(WORKFLOW_TEMPLATES).map(([id, t]) => `
        <div class="template-card" onclick="loadTemplate('${id}'); hideTemplates();">
            <div class="template-icon">${t.icon}</div>
            <div class="template-name">${t.name}</div>
            <div class="template-desc">${t.description}</div>
        </div>
    `).join('');
    
    modal.classList.add('active');
}

function hideTemplates() {
    document.getElementById('templates-modal').classList.remove('active');
}

// ── Company Config ──────────────────────────────────────────────────────────
async function loadCompanyConfig() {
    const slug = document.getElementById('company-select').value;
    if (!slug) {
        currentCompany = null;
        toast('No company selected', 'info');
        return;
    }
    
    currentCompany = slug;
    
    try {
        const res = await fetch(`${API_BASE}/clients/${slug}`);
        const config = await res.json();
        toast(`Loaded config for ${config.company_name || slug}`, 'success');
        
        // Re-render properties if a node is selected
        if (selectedNode) {
            renderProperties(selectedNode);
        }
    } catch (e) {
        toast(`Applied company: ${slug}`, 'success');
    }
}

async function applyCompanyOverride(nodeId) {
    if (!currentCompany) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // In a real implementation, this would fetch company-specific overrides
    toast(`Company overrides applied to ${NODE_TYPES[node.type].label}`, 'success');
}

// ── Save/Export/Share ───────────────────────────────────────────────────────
async function saveWorkflow() {
    const name = document.getElementById('workflow-name').value;
    const workflow = {
        name,
        nodes,
        connections,
        company: currentCompany,
        savedAt: new Date().toISOString()
    };
    
    // Save to localStorage for now
    localStorage.setItem(`workflow_${name}`, JSON.stringify(workflow));
    toast(`Saved: ${name}`, 'success');
}

function exportWorkflow() {
    const name = document.getElementById('workflow-name').value;
    const workflow = {
        name,
        nodes,
        connections,
        company: currentCompany,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Workflow exported', 'success');
}

function shareWorkflow() {
    const modal = document.getElementById('share-modal');
    const content = document.getElementById('share-content');
    
    // Generate share URL
    const workflow = {
        name: document.getElementById('workflow-name').value,
        nodes,
        connections
    };
    const encoded = btoa(JSON.stringify(workflow));
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    
    content.innerHTML = `
        <div class="share-url-container">
            <input type="text" value="${shareUrl}" id="share-url" readonly>
            <button class="btn btn-primary" onclick="copyShareUrl()">📋 Copy</button>
        </div>
        <div class="share-options">
            <div class="share-option">
                <input type="checkbox" id="share-readonly" checked>
                <div>
                    <div class="share-option-label">View Only</div>
                    <div class="share-option-desc">Recipients can view but not edit</div>
                </div>
            </div>
            <div class="share-option">
                <input type="checkbox" id="share-with-data">
                <div>
                    <div class="share-option-label">Include Sample Data</div>
                    <div class="share-option-desc">Show example execution with sample data</div>
                </div>
            </div>
        </div>
        <div style="margin-top:20px;">
            <button class="btn btn-accent" onclick="generatePresentationLink()">🎬 Generate Presentation Link</button>
        </div>
    `;
    
    modal.classList.add('active');
}

function hideShare() {
    document.getElementById('share-modal').classList.remove('active');
}

function copyShareUrl() {
    const input = document.getElementById('share-url');
    input.select();
    document.execCommand('copy');
    toast('URL copied to clipboard', 'success');
}

function generatePresentationLink() {
    const name = document.getElementById('workflow-name').value;
    const company = currentCompany || 'demo';
    const url = `${window.location.origin}/static/workflow-presenter.html?workflow=${encodeURIComponent(name)}&company=${company}`;
    
    window.open(url, '_blank');
    toast('Presentation opened in new tab', 'success');
}

function loadSharedWorkflow(encoded) {
    try {
        const workflow = JSON.parse(atob(encoded));
        nodes = workflow.nodes || [];
        connections = workflow.connections || [];
        nodeIdCounter = Math.max(0, ...nodes.map(n => n.id)) + 1;
        document.getElementById('workflow-name').value = workflow.name || 'Shared Workflow';
        renderNodes();
        renderConnections();
        toast('Loaded shared workflow', 'success');
    } catch (e) {
        toast('Failed to load shared workflow', 'error');
    }
}

// ── Run Workflow ────────────────────────────────────────────────────────────
async function runWorkflow() {
    if (!nodes.length) {
        toast('Add some nodes first', 'error');
        return;
    }
    
    const log = document.getElementById('execution-log');
    log.innerHTML = '';
    
    // Find trigger node
    const trigger = nodes.find(n => NODE_TYPES[n.type].category === 'trigger');
    if (!trigger) {
        toast('Workflow needs a trigger node', 'error');
        return;
    }
    
    addLogEntry('System', 'Starting workflow execution...', 'info');
    
    // Simulate execution through nodes
    const executed = new Set();
    const queue = [trigger.id];
    
    while (queue.length) {
        const nodeId = queue.shift();
        if (executed.has(nodeId)) continue;
        
        const node = nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        const def = NODE_TYPES[node.type];
        
        // Update node status
        const el = document.getElementById(`node-${nodeId}`);
        el?.classList.add('running');
        
        addLogEntry(def.label, `Executing...`, 'info');
        
        // Simulate processing time
        await sleep(800 + Math.random() * 400);
        
        el?.classList.remove('running');
        el?.classList.add('success');
        
        addLogEntry(def.label, `Completed successfully`, 'success');
        
        executed.add(nodeId);
        
        // Find connected nodes
        connections.filter(c => c.from === nodeId).forEach(c => {
            if (!executed.has(c.to)) queue.push(c.to);
        });
    }
    
    addLogEntry('System', `Workflow completed. ${executed.size} nodes executed.`, 'success');
    toast('Workflow execution complete', 'success');
    
    // Reset node states after delay
    setTimeout(() => {
        document.querySelectorAll('.workflow-node').forEach(el => {
            el.classList.remove('success', 'error', 'running');
        });
    }, 3000);
}

function addLogEntry(node, message, type = 'info') {
    const log = document.getElementById('execution-log');
    const time = new Date().toLocaleTimeString();
    log.innerHTML += `
        <div class="log-entry ${type}">
            <span class="log-time">${time}</span>
            <span class="log-node">${node}</span>
            <span class="log-message">${message}</span>
        </div>
    `;
    log.scrollTop = log.scrollHeight;
}

function clearLog() {
    document.getElementById('execution-log').innerHTML = '<div class="log-empty">Run the workflow to see execution logs</div>';
}

function toggleExecutionPanel() {
    document.getElementById('execution-panel').classList.toggle('collapsed');
}

// ── Utilities ───────────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
