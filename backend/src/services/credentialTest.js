/**
 * Testa a conectividade de cada integração usando as credenciais
 * atualmente ativas (override do banco > .env — ver credentialStore).
 * Todas as chamadas são somente leitura e usam page size mínimo —
 * nenhuma escrita é feita nos sistemas externos.
 */
const axios = require('axios');
const credentialStore = require('./credentialStore');

function authErrorMessage(err, label) {
  const status = err.response?.status;
  const detail = err.response?.data?.error_description || err.response?.data?.error?.message || err.response?.data?.message || err.message;
  if (status === 401 || status === 403) return `${label}: credencial inválida ou sem permissão (HTTP ${status})`;
  if (status) return `${label}: erro HTTP ${status} — ${String(detail).substring(0, 160)}`;
  if (err.code === 'ECONNABORTED') return `${label}: timeout ao conectar`;
  return `${label}: ${err.message}`;
}

async function testAnthropic() {
  const key = credentialStore.get('ANTHROPIC_API_KEY');
  if (!key) return { ok: false, message: 'ANTHROPIC_API_KEY não configurada' };
  try {
    await axios.get('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      timeout: 10000
    });
    return { ok: true, message: 'Chave válida — API Anthropic respondeu com sucesso' };
  } catch (err) {
    return { ok: false, message: authErrorMessage(err, 'Anthropic') };
  }
}

async function testAzureDevOps() {
  const pat = credentialStore.get('ADO_PAT');
  const org = credentialStore.get('ADO_ORG') || 'copastur-dev';
  if (!pat) return { ok: false, message: 'ADO_PAT não configurado' };
  try {
    const res = await axios.get(`https://dev.azure.com/${org}/_apis/projects`, {
      headers: { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}` },
      params: { 'api-version': '7.1', '$top': 1 },
      timeout: 10000
    });
    const count = res.data.count ?? res.data.value?.length ?? 0;
    return { ok: true, message: `Conectado a ${org} — ${count} projeto(s) visível(is)` };
  } catch (err) {
    return { ok: false, message: authErrorMessage(err, 'Azure DevOps') };
  }
}

async function testFreshservice() {
  const key = credentialStore.get('FRESHSERVICE_API_KEY');
  const domain = credentialStore.get('FRESHSERVICE_DOMAIN') || 'copastur.freshservice.com';
  if (!key) return { ok: false, message: 'FRESHSERVICE_API_KEY não configurada' };
  try {
    await axios.get(`https://${domain}/api/v2/tickets`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:X`).toString('base64')}` },
      params: { per_page: 1 },
      timeout: 10000
    });
    return { ok: true, message: `Conectado a ${domain}` };
  } catch (err) {
    return { ok: false, message: authErrorMessage(err, 'Freshservice') };
  }
}

async function testWorkPlane() {
  const token = credentialStore.get('WORK_TOKEN');
  const base = credentialStore.get('WORK_API_URL') || 'https://work.cnext.app/api/plane/v1/workspaces/copastur';
  if (!token) return { ok: false, message: 'WORK_TOKEN não configurado' };
  try {
    const res = await axios.get(`${base}/projects/`, {
      headers: { 'X-API-Key': token },
      params: { per_page: 1 },
      timeout: 10000
    });
    const count = Array.isArray(res.data) ? res.data.length : (res.data.results?.length ?? res.data.total_count ?? 0);
    return { ok: true, message: `Conectado — workspace acessível (${count} projeto(s) na primeira página)` };
  } catch (err) {
    return { ok: false, message: authErrorMessage(err, 'Work/Plane') };
  }
}

async function testSmartLeader() {
  const key = credentialStore.get('SMARTLEADER_API_KEY');
  const base = credentialStore.get('SMARTLEADER_API_URL');
  if (!key || !base) return { ok: false, message: 'SMARTLEADER_API_KEY ou SMARTLEADER_API_URL não configurados — sistema usará dados mock' };
  try {
    await axios.get(`${base}/objectives`, {
      headers: { Authorization: `Bearer ${key}` },
      params: { cycle: 'Q2-2026' },
      timeout: 10000
    });
    return { ok: true, message: 'Conectado à API SmartLeader' };
  } catch (err) {
    return { ok: false, message: authErrorMessage(err, 'SmartLeader') };
  }
}

async function testMicrosoftGraph() {
  const tenant = credentialStore.get('AZURE_TENANT_ID');
  const clientId = credentialStore.get('AZURE_CLIENT_ID');
  const clientSecret = credentialStore.get('AZURE_CLIENT_SECRET');
  if (!tenant || !clientId || !clientSecret) return { ok: false, message: 'Tenant ID, Client ID ou Client Secret não configurados' };
  try {
    await axios.post(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
    );
    return { ok: true, message: 'Tenant, Client ID e Client Secret validados junto ao Azure AD (client credentials)' };
  } catch (err) {
    return { ok: false, message: authErrorMessage(err, 'Microsoft Graph / Azure AD') };
  }
}

const TESTS = {
  anthropic: testAnthropic,
  azure_devops: testAzureDevOps,
  freshservice: testFreshservice,
  work_plane: testWorkPlane,
  smartleader: testSmartLeader,
  microsoft_graph: testMicrosoftGraph
};

async function testIntegration(integration) {
  const fn = TESTS[integration];
  if (!fn) throw new Error('Integração desconhecida');
  return fn();
}

module.exports = { testIntegration, KNOWN_INTEGRATIONS: Object.keys(TESTS) };
