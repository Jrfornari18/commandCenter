/**
 * Log centralizado de erros de chamadas a APIs externas (integrações).
 * Consultado apenas pelo painel Admin (routes/index.js, requireAdmin).
 * Nunca persiste secrets — sanitiza qualquer campo cujo nome pareça
 * sensível antes de gravar. Uma falha ao gravar o log nunca deve
 * interromper o fluxo de integração que o originou.
 */
const db = require('../db');

const SENSITIVE_KEY_RE = /token|key|secret|password|authorization|pat\b/i;

function sanitize(value) {
  if (value == null) return null;
  if (typeof value !== 'object') return String(value).slice(0, 2000);
  const out = Array.isArray(value) ? [] : {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : (v && typeof v === 'object' ? sanitize(v) : v);
  }
  return out;
}

async function logIntegrationError({ integration, operation, err }) {
  try {
    const httpStatus = err?.response?.status ?? null;
    const message = String(
      err?.response?.data?.error_description ||
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      err?.message ||
      'Erro desconhecido'
    ).slice(0, 500);
    const detail = sanitize({ response_data: err?.response?.data, code: err?.code });

    await db.query(
      `INSERT INTO integration_error_log (integration, operation, http_status, error_message, error_detail)
       VALUES ($1,$2,$3,$4,$5)`,
      [integration, operation || null, httpStatus, message, JSON.stringify(detail)]
    );
  } catch (logErr) {
    console.error('[ErrorLog] Falha ao registrar erro de integração:', logErr.message);
  }
}

module.exports = { logIntegrationError };
