import { Client } from '@hubspot/api-client';
import { v4 as uuid } from 'uuid';

const MOCK = process.env.MOCK_MODE === 'true';

function getClient(accessToken) {
  return new Client({ accessToken });
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function createContact(config, fields) {
  if (MOCK) return mockContact(fields);
  const hs = getClient(config.hubspot.accessToken);
  const res = await hs.crm.contacts.basicApi.create({ properties: fields });
  return res;
}

export async function updateContact(config, contactId, fields) {
  if (MOCK) return { id: contactId, properties: fields };
  const hs = getClient(config.hubspot.accessToken);
  return hs.crm.contacts.basicApi.update(contactId, { properties: fields });
}

export async function searchContacts(config, query) {
  if (MOCK) return { results: [mockContact({ email: query }), mockContact({ company: query })], total: 2 };
  const hs = getClient(config.hubspot.accessToken);
  return hs.crm.contacts.searchApi.doSearch({
    filterGroups: [{
      filters: [{ propertyName: 'email', operator: 'EQ', value: query }]
    }],
    properties: ['firstname', 'lastname', 'email', 'company', 'phone', 'dealstage'],
    limit: 10
  });
}

export async function getContact(config, contactId) {
  if (MOCK) return mockContact({ id: contactId });
  const hs = getClient(config.hubspot.accessToken);
  return hs.crm.contacts.basicApi.getById(contactId, ['firstname', 'lastname', 'email', 'company', 'phone', 'hs_lead_status']);
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export async function createDeal(config, fields) {
  if (MOCK) return mockDeal(fields, config);
  const hs = getClient(config.hubspot.accessToken);
  return hs.crm.deals.basicApi.create({ properties: { ...fields, pipeline: config.hubspot.pipelineId } });
}

export async function updateDealStage(config, dealId, stage) {
  if (MOCK) return { id: dealId, properties: { dealstage: stage } };
  const hs = getClient(config.hubspot.accessToken);
  const stageId = config.hubspot.stages[stage] || stage;
  return hs.crm.deals.basicApi.update(dealId, { properties: { dealstage: stageId } });
}

export async function getDeals(config, limit = 50) {
  if (MOCK) return generateMockDeals(config, limit);
  const hs = getClient(config.hubspot.accessToken);
  return hs.crm.deals.basicApi.getPage(limit, undefined, ['dealname', 'amount', 'dealstage', 'closedate', 'hs_deal_stage_probability']);
}

// ─── Activity / Notes ─────────────────────────────────────────────────────────

export async function logActivity(config, contactId, message, type = 'NOTE') {
  if (MOCK) return { id: `note_${uuid().slice(0, 8)}`, body: message };
  const hs = getClient(config.hubspot.accessToken);
  const note = await hs.crm.objects.notes.basicApi.create({
    properties: { hs_note_body: message, hs_timestamp: Date.now().toString() }
  });
  // Associate with contact
  await hs.crm.objects.notes.associationsApi.create(note.id, 'contacts', contactId, [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }]);
  return note;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function getPipeline(config) {
  if (MOCK) return mockPipeline(config);
  const hs = getClient(config.hubspot.accessToken);
  return hs.crm.pipelines.pipelinesApi.getAll('deals');
}

// ─── Mock Generators ──────────────────────────────────────────────────────────

function mockContact(overrides = {}) {
  const names = [['John', 'Smith'], ['Sarah', 'Johnson'], ['Michael', 'Chen'], ['Emily', 'Davis'], ['Robert', 'Wilson']];
  const companies = ['Acme Corp', 'Pinnacle Industries', 'Summit Logistics', 'BlueSky Mfg', 'Vertex Services'];
  const [fn, ln] = names[Math.floor(Math.random() * names.length)];
  return {
    id: `ct_${uuid().slice(0, 8)}`,
    properties: {
      firstname: fn,
      lastname: ln,
      email: `${fn.toLowerCase()}@${companies[Math.floor(Math.random() * companies.length)].toLowerCase().replace(' ', '')}.com`,
      company: companies[Math.floor(Math.random() * companies.length)],
      phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
      hs_lead_status: ['NEW', 'OPEN', 'IN_PROGRESS', 'QUALIFIED'][Math.floor(Math.random() * 4)],
      ...overrides
    },
    createdAt: new Date().toISOString()
  };
}

function mockDeal(fields, config) {
  const stages = Object.keys(config?.hubspot?.stages || { new_lead: 'new_lead' });
  return {
    id: `deal_${uuid().slice(0, 8)}`,
    properties: {
      dealname: fields.dealname || 'New Opportunity',
      amount: fields.amount || Math.floor(Math.random() * 50000 + 5000),
      dealstage: stages[Math.floor(Math.random() * stages.length)],
      closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      hs_deal_stage_probability: Math.floor(Math.random() * 80 + 10),
      ...fields
    },
    createdAt: new Date().toISOString()
  };
}

function generateMockDeals(config, count = 20) {
  const stages = Object.keys(config.hubspot?.stages || {});
  const companies = ['Acme Corp', 'Summit Logistics', 'BlueSky Mfg', 'Vertex Services', 'Pinnacle Co', 'Atlas Group', 'Nexus LLC', 'Core Industries'];
  const deals = [];
  for (let i = 0; i < count; i++) {
    const stage = stages[Math.floor(Math.random() * stages.length)] || 'new_lead';
    deals.push({
      id: `deal_${uuid().slice(0, 8)}`,
      properties: {
        dealname: `${companies[Math.floor(Math.random() * companies.length)]} - Q${Math.ceil(Math.random() * 4)} Deal`,
        amount: Math.floor(Math.random() * 95000 + 5000),
        dealstage: stage,
        closedate: new Date(Date.now() + Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString(),
        hs_deal_stage_probability: Math.floor(Math.random() * 80 + 10),
        hs_lastmodifieddate: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  }
  return { results: deals, total: deals.length };
}

function mockPipeline(config) {
  const stages = config.hubspot?.stages || {};
  return {
    results: [{
      id: 'default',
      label: 'Sales Pipeline',
      stages: Object.entries(stages).map(([key, id]) => ({ id, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), metadata: { probability: '0.5' } }))
    }]
  };
}
