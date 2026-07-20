/**
 * Armazena e serve as API keys/segredos de integração.
 * Valores ficam sempre criptografados (AES-256-GCM) na tabela
 * integration_credentials — nunca em texto plano no banco, em logs
 * ou em resposta de API (ver ROTAS ADMIN em routes/index.js, que
 * sempre retornam mask(), nunca o valor real).
 *
 * Prioridade de leitura: DB (override salvo pelo Admin) > variável
 * de ambiente (.env) > vazio.
 */
const crypto = require('crypto');
const db = require('../db');

const ALGO = 'aes-256-gcm';
const RAW_KEY = process.env.CREDENTIALS_ENC_KEY;
if (!RAW_KEY) {
  console.warn('[CredentialStore] CREDENTIALS_ENC_KEY não definido — usando chave de fallback (NÃO seguro para produção)');
}
// sha256 garante 32 bytes independente do tamanho da passphrase fornecida
const ENC_KEY = crypto.createHash('sha256').update(RAW_KEY || 'copastur-dev-insecure-fallback-key').digest();

// Catálogo dos sistemas e campos configuráveis pelo Admin.
const REGISTRY = [
  {
    integration: 'anthropic', label: 'IA — Anthropic (Claude)',
    fields: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key', secret: true }
    ]
  },
  {
    integration: 'azure_devops', label: 'Azure DevOps',
    fields: [
      { key: 'ADO_ORG', label: 'Organização', secret: false },
      { key: 'ADO_PAT', label: 'Personal Access Token', secret: true },
      { key: 'ADO_SYNC_PROJECTS', label: 'Projetos sincronizados (CSV)', secret: false }
    ]
  },
  {
    integration: 'microsoft_graph', label: 'Microsoft Graph / Azure AD',
    fields: [
      { key: 'AZURE_TENANT_ID', label: 'Tenant ID', secret: false },
      { key: 'AZURE_CLIENT_ID', label: 'Client ID', secret: false },
      { key: 'AZURE_CLIENT_SECRET', label: 'Client Secret', secret: true },
      { key: 'AZURE_REDIRECT_URI', label: 'Redirect URI', secret: false },
      { key: 'GRAPH_SCOPES', label: 'Scopes', secret: false }
    ]
  },
  {
    integration: 'freshservice', label: 'Freshservice',
    fields: [
      { key: 'FRESHSERVICE_DOMAIN', label: 'Domínio', secret: false },
      { key: 'FRESHSERVICE_API_KEY', label: 'API Key', secret: true }
    ]
  },
  {
    integration: 'work_plane', label: 'Work / Plane — TI Boards',
    fields: [
      { key: 'WORK_API_URL', label: 'API URL', secret: false },
      { key: 'WORK_TOKEN', label: 'API Token', secret: true }
    ]
  },
  {
    integration: 'smartleader', label: 'SmartLeader (OKRs)',
    fields: [
      { key: 'SMARTLEADER_API_URL', label: 'API URL', secret: false },
      { key: 'SMARTLEADER_API_KEY', label: 'API Key', secret: true }
    ]
  }
];

const ALL_KEYS = new Set(REGISTRY.flatMap(g => g.fields.map(f => f.key)));

function getFieldDef(keyName) {
  for (const group of REGISTRY) {
    const field = group.fields.find(f => f.key === keyName);
    if (field) return { integration: group.integration, ...field };
  }
  return null;
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

let cache = new Map(); // key_name -> { value, updated_at, updated_by }

async function loadAll() {
  const { rows } = await db.query('SELECT key_name, value_encrypted, updated_at, updated_by FROM integration_credentials');
  const next = new Map();
  for (const row of rows) {
    try {
      next.set(row.key_name, { value: decrypt(row.value_encrypted), updated_at: row.updated_at, updated_by: row.updated_by });
    } catch (err) {
      console.error('[CredentialStore] Falha ao decriptar', row.key_name, err.message);
    }
  }
  cache = next;
  console.log(`[CredentialStore] ${cache.size} credencial(is) carregada(s) do banco`);
}

function get(keyName) {
  return cache.get(keyName)?.value || process.env[keyName] || '';
}

function source(keyName) {
  if (cache.has(keyName)) return 'database';
  if (process.env[keyName]) return 'env';
  return 'none';
}

function mask(value) {
  if (!value) return '';
  if (value.length <= 4) return '••••••••';
  return '••••••••' + value.slice(-4);
}

async function set(keyName, value, userId) {
  const field = getFieldDef(keyName);
  if (!field) throw new Error('key_name desconhecida');
  const enc = encrypt(value);
  await db.query(
    `INSERT INTO integration_credentials (integration, key_name, value_encrypted, updated_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (key_name) DO UPDATE SET
       value_encrypted = EXCLUDED.value_encrypted,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [field.integration, keyName, enc, userId]);
  cache.set(keyName, { value, updated_at: new Date(), updated_by: userId });
}

async function remove(keyName) {
  if (!getFieldDef(keyName)) throw new Error('key_name desconhecida');
  await db.query('DELETE FROM integration_credentials WHERE key_name=$1', [keyName]);
  cache.delete(keyName);
}

// Lista para a tela de Admin: nunca inclui o valor real, só mascarado + metadados.
function listForAdmin() {
  return REGISTRY.map(group => ({
    integration: group.integration,
    label: group.label,
    fields: group.fields.map(f => {
      const value = get(f.key);
      const row = cache.get(f.key);
      return {
        key: f.key,
        label: f.label,
        secret: f.secret,
        configured: !!value,
        source: source(f.key),
        masked_value: f.secret ? mask(value) : (value || ''),
        updated_at: row?.updated_at || null
      };
    })
  }));
}

module.exports = { loadAll, get, set, remove, mask, source, listForAdmin, getFieldDef, ALL_KEYS };
