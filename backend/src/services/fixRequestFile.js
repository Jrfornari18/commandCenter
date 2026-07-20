/**
 * Grava, em contexto/, uma nota de "solicitação de correção" criada pelo
 * Admin a partir de um erro de integração — para que a próxima sessão do
 * Claude Code a encontre automaticamente (convenção CLAUDE.md §18).
 *
 * Caminho relativo a partir deste arquivo (backend/src/services/) chega
 * na raiz do repo tanto rodando `node src/server.js` localmente quanto
 * dentro do container (ver volume `./contexto:/app/contexto` em
 * docker-compose.yml, que espelha a mesma profundidade de diretórios).
 */
const fs = require('fs');
const path = require('path');

const CONTEXTO_DIR = path.join(__dirname, '../../../contexto');
// Faixa Unicode dos "combining diacritical marks" (U+0300–U+036F), construída
// via charCode para evitar caracteres não-ASCII ambíguos no source file.
const DIACRITICS_RE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function writeFixRequestFile({ integration, title, description, errorEntry, requestedByName }) {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-fix-${slugify(integration)}-${slugify(title)}.md`;
  const filepath = path.join(CONTEXTO_DIR, filename);

  const lines = [
    `# Solicitação de correção — ${integration}`,
    '',
    `**Status:** aberto`,
    `**Solicitado por:** ${requestedByName || 'Admin'}`,
    `**Data:** ${new Date().toISOString()}`,
    '',
    '## Título',
    title,
    '',
    '## Descrição',
    description?.trim() || '_(sem descrição adicional)_'
  ];

  if (errorEntry) {
    lines.push(
      '',
      '## Erro original registrado',
      `- Integração: \`${errorEntry.integration}\``,
      `- Operação: \`${errorEntry.operation || '—'}\``,
      `- HTTP status: ${errorEntry.http_status ?? '—'}`,
      `- Mensagem: ${errorEntry.error_message}`,
      `- Ocorrido em: ${errorEntry.occurred_at}`
    );
  }

  lines.push(
    '',
    '## Instrução para a próxima sessão do Claude Code',
    'Investigar a causa raiz (ver `docs/api-key-handling-baseline.md` para o',
    'mecanismo de API keys e `backend/src/integrations/<integração>/client.js`',
    'para o client afetado), propor e aplicar a correção, e reportar de volta',
    'ao Admin. Marcar esta solicitação como resolvida no painel Admin >',
    'Logs de Integração ao concluir.'
  );

  fs.mkdirSync(CONTEXTO_DIR, { recursive: true });
  fs.writeFileSync(filepath, lines.join('\n') + '\n', 'utf8');
  return `contexto/${filename}`;
}

module.exports = { writeFixRequestFile };
