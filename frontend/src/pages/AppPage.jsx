import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatAPI, dashAPI, integAPI } from '../services/api';

// ── Constants ──────────────────────────────────────────────────
const EXPECTATIVAS = [
  { n: 1, t: 'Visão Sistêmica + Execução Impecável', d: 'Enxergar o todo enquanto entrega o detalhe. Decisões que conectam estratégia e operação sem lacunas de execução.', c: 'Pré-requisito para todas as demais.', p: 'Como avalio e melhoro minha visão sistêmica e execução impecável como C-Level da Copastur?' },
  { n: 2, t: 'Comportamento de Sócio', d: '"Se isso fosse 100% do meu patrimônio, eu faria assim?" — critério permanente de avaliação de risco, recurso e prioridade.', c: 'Pergunta permanente antes de qualquer decisão relevante.', p: 'Se isso fosse 100% do meu patrimônio, eu faria assim? Como aplico o critério de sócio nas decisões da Copastur?' },
  { n: 3, t: 'Liderança que Forma Líderes', d: 'O C-Level não é o melhor operador — é o multiplicador. A métrica é o desenvolvimento visível dos líderes que reportam.', c: 'A falta de pipeline de liderança é falha direta do C-Level, não do RH.', p: 'Como estruturo minha atuação para formar líderes de segunda e terceira linha na Copastur?' },
  { n: 4, t: 'Dados acima de Opiniões, com Sensibilidade Humana', d: 'Dados como ponto de partida obrigatório. Sensibilidade humana como filtro de contexto. Jamais o contrário.', c: 'Opiniões sem dados são hipóteses. Dados sem sensibilidade são armadilhas.', p: 'Como equilibrar rigor de dados com leitura humana de contexto nas decisões da Copastur?' },
  { n: 5, t: 'Guardiões da Cultura', d: '"Cultura não é slide, é decisão difícil tomada corretamente." O C-Level guarda a cultura quando o custo de guardá-la é alto.', c: 'Critério central na reengenharia cultural atual. Não há negociação.', p: 'Como tomo decisões difíceis que reforçam cultura na Copastur?' },
  { n: 6, t: 'Inquietação Positiva e Visão de Futuro', d: 'Inconformismo produtivo com o status quo. Olhar para o futuro com antecipação, não ansiedade.', c: 'Inquietação sem proposta é reclamação. A expectativa é de movimento com direção.', p: 'Como mantenho inquietação positiva e visão de futuro no contexto de pressão e incerteza da Copastur?' },
  { n: 7, t: 'Alinhamento Radical com o CEO', d: 'Conselho ativo + braço executor. Divergir em privado, executar com comprometimento público.', c: 'Pré-requisito de todas as outras expectativas.', p: 'Como opero como conselho ativo e braço executor do CEO da Copastur de forma efetiva?' }
];

const CHIPS = [
  { label: 'Avaliar contrato de liderança', p: 'Como avalio se minha liderança está cumprindo o contrato das 7 Expectativas Copastur?' },
  { label: 'Roadmap cultural H2', p: 'Monte um roadmap de reengenharia cultural para o segundo semestre considerando os workstreams ativos' },
  { label: 'Status AI-First Q3', p: 'Avalie o status do workstream AI-First e recomende ajustes para atingir as metas de Q3' },
  { label: 'Risco SmartHotel', p: 'Quais os principais riscos do SmartHotel para Q3 e como mitigá-los?' },
  { label: 'SmartSaving recompra', p: 'Qual o plano de execução para colocar o módulo de recompra do SmartSaving em produção?' },
  { label: 'Alinhamento CEO', p: 'Crie uma agenda de alinhamento radical CEO-C-Level para o próximo trimestre' }
];

const WORKSTREAM_COLORS = {
  'AI-First': 'ws-ai', 'SmartHotel': 'ws-hotel', 'SmartSaving': 'ws-saving',
  'Smart-Integration': 'ws-integ', 'CMais': 'ws-mais', 'Zuri': 'ws-zuri'
};

const DOMAINS = [
  'Estratégia Corporativa', 'IA & Tecnologia', 'Produto & Inovação',
  'Operações & Performance', 'Comunicação Executiva', 'Priorização Financeira', 'Governança & Risco'
];

// ── SVG Icons ──────────────────────────────────────────────────
const I = {
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  exp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>,
  ado: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  fs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  work: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  graph: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  okr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  sync: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  arr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
};

// ── Structured AI Response Renderer ───────────────────────────
function AiResponse({ parsed }) {
  if (!parsed) return null;
  if (parsed.simple) return <p>{parsed.text}</p>;
  const rl = l => l === 'High' ? 'rH' : l === 'Medium' ? 'rM' : 'rL';
  const rn = l => l === 'High' ? 'Alto' : l === 'Medium' ? 'Médio' : 'Baixo';
  return (
    <div>
      {parsed.expectativas_aplicadas?.length > 0 && <div className="resp-exp-tags">{parsed.expectativas_aplicadas.map((e, i) => <span key={i} className="resp-exp-tag">{e}</span>)}</div>}
      {parsed.executive_summary?.length > 0 && <div className="resp-sec"><div className="resp-h">Sumário Executivo</div><div className="resp-body"><ul>{parsed.executive_summary.map((b, i) => <li key={i}>{b}</li>)}</ul></div></div>}
      {parsed.assessment && <div className="resp-sec"><div className="resp-h">Avaliação</div><div className="resp-body">{parsed.assessment}</div></div>}
      {parsed.recommendation && <div className="resp-sec"><div className="resp-h">Recomendação</div><div className="resp-body">{parsed.recommendation}</div></div>}
      {parsed.phases?.length > 0 && <div className="resp-sec"><div className="resp-h">Plano de Execução</div><table className="resp-table"><thead><tr><th>Fase</th><th>Objetivo</th><th>Responsável</th><th>KPI</th><th>Risco</th></tr></thead><tbody>{parsed.phases.map((p, i) => <tr key={i}><td style={{fontWeight:500}}>{p.phase}</td><td>{p.objective}{p.actions?` — ${p.actions}`:''}</td><td>{p.owner}</td><td>{p.kpi}</td><td>{p.risk}</td></tr>)}</tbody></table></div>}
      {parsed.risks?.length > 0 && <div className="resp-sec"><div className="resp-h">Riscos & Mitigações</div><table className="resp-table"><thead><tr><th>Área</th><th>Nível</th><th>Descrição</th><th>Mitigação</th></tr></thead><tbody>{parsed.risks.map((r, i) => <tr key={i}><td style={{fontWeight:500}}>{r.area}</td><td><span className={`rbadge ${rl(r.level)}`}>{rn(r.level)}</span></td><td>{r.description}</td><td>{r.mitigation}</td></tr>)}</tbody></table></div>}
      {parsed.decision_required && <div className="dec-box"><div className="dec-lbl">Decisão Necessária</div><div style={{fontSize:12,marginTop:3}}>{parsed.decision_required}</div></div>}
      {parsed.next_action && <div className="next-act">{I.arr}<div><div style={{fontSize:9,fontWeight:500,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:2}}>Próxima Ação</div><div style={{fontSize:12}}>{parsed.next_action}</div></div></div>}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function AppPage() {
  const { user, logout } = useAuth();
  const [panel, setPanel] = useState('chat');
  const [convs, setConvs] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [integData, setIntegData] = useState({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role_name: 'cto', password: 'Copastur@2025' });
  const [adoData, setAdoData] = useState({ workstreams: [], items: [] });
  const [fsData, setFsData] = useState({ tickets: [], kpis: {} });
  const [workData, setWorkData] = useState({ boards: [], kpis: {}, issues: [] });
  const [okrData, setOkrData] = useState({ objectives: [] });
  const [graphData, setGraphData] = useState({ events: [], emails: [] });
  const chatRef = useRef(null);
  const taRef = useRef(null);

  const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
  const fmtTime = d => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

  useEffect(() => { loadConvs(); }, []);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [msgs, aiLoading]);
  useEffect(() => {
    if (panel === 'dashboard') loadDash();
    if (panel === 'ado') loadAdo();
    if (panel === 'freshservice') loadFs();
    if (panel === 'work') loadWork();
    if (panel === 'okr') loadOkr();
    if (panel === 'graph') loadGraph();
    if (panel === 'admin') loadUsers();
  }, [panel]);

  const loadConvs = async () => { try { const r = await chatAPI.list(); setConvs(r.data.conversations); } catch (_) {} };
  const loadDash = async () => { try { const r = await dashAPI.summary(); setDashData(r.data); } catch (_) {} };
  const loadAdo = async () => { try { const [ws, items] = await Promise.all([integAPI.adoWorkstreams(), integAPI.adoItems({ limit: 30 })]); setAdoData({ workstreams: ws.data.workstreams, items: items.data.items }); } catch (_) {} };
  const loadFs = async () => { try { const r = await integAPI.fsTickets(25); setFsData({ tickets: r.data.tickets, kpis: r.data.kpis }); } catch (_) {} };
  const loadWork = async () => { try { const [b, i] = await Promise.all([integAPI.workBoards(), integAPI.workIssues({ limit: 30 })]); setWorkData({ boards: b.data.boards, kpis: b.data.kpis, issues: i.data.issues }); } catch (_) {} };
  const loadOkr = async () => { try { const r = await integAPI.okrSummary('Q2-2026'); setOkrData({ objectives: r.data.objectives }); } catch (_) {} };
  const loadGraph = async () => { try { const [ev, em] = await Promise.all([integAPI.calendarEvents(), integAPI.emails()]); setGraphData({ events: ev.data.events, emails: em.data.emails }); } catch (_) {} };
  const loadUsers = async () => { try { const r = await dashAPI.users(); setUsers(r.data.users); } catch (_) {} };

  const syncAll = async () => {
    setSyncingAll(true);
    try { await integAPI.syncAll(); await loadDash(); } catch (_) {}
    finally { setSyncingAll(false); }
  };

  const openConv = async (id) => {
    setActiveConv(id); setPanel('chat'); setShowChips(false);
    try { const r = await chatAPI.messages(id); setMsgs(r.data.messages.map(m => ({ ...m, parsed: m.parsed_response }))); } catch (_) {}
  };

  const newConv = async () => {
    try {
      const r = await chatAPI.create('Nova conversa');
      const c = r.data.conversation;
      setConvs(p => [c, ...p]); setActiveConv(c.id); setMsgs([]); setShowChips(true); setPanel('chat');
    } catch (_) {}
  };

  const sendMsg = useCallback(async (text) => {
    const content = text || input.trim();
    if (!content || aiLoading) return;
    let cid = activeConv;
    if (!cid) {
      try { const r = await chatAPI.create(content.substring(0, 80)); cid = r.data.conversation.id; setActiveConv(cid); setConvs(p => [r.data.conversation, ...p]); } catch (_) { return; }
    }
    setInput(''); setShowChips(false);
    setMsgs(p => [...p, { role: 'user', content, id: Date.now() }]);
    setAiLoading(true);
    try {
      const r = await chatAPI.send(cid, content);
      const m = r.data.message;
      let parsed = m.parsed_response;
      if (!parsed && m.content) { try { const x = m.content.match(/\{[\s\S]*\}/); parsed = x ? JSON.parse(x[0]) : null; } catch (_) {} }
      setMsgs(p => [...p, { role: 'assistant', content: m.content, parsed, id: m.id }]);
      loadConvs();
    } catch (_) {
      setMsgs(p => [...p, { role: 'assistant', content: '', parsed: { simple: true, text: 'Erro ao processar. Tente novamente.' }, id: Date.now() }]);
    } finally { setAiLoading(false); }
  }, [input, aiLoading, activeConv]);

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
  const autoSize = el => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 110) + 'px'; };

  const createUser = async () => {
    try { await dashAPI.createUser(newUser); setShowUserModal(false); setNewUser({ email: '', full_name: '', role_name: 'cto', password: 'Copastur@2025' }); loadUsers(); }
    catch (e) { alert(e.response?.data?.error || 'Erro'); }
  };

  const navItems = [
    { id: 'chat', label: 'Strategic Chat', icon: I.chat },
    { id: 'dashboard', label: 'Executive Dashboard', icon: I.dash },
    { id: 'expectativas', label: '7 Expectativas', icon: I.exp, badge: 'Copastur', badgeClass: 'green' },
  ];
  const integItems = [
    { id: 'ado', label: 'Azure DevOps', icon: I.ado, badge: '186 proj' },
    { id: 'freshservice', label: 'Freshservice', icon: I.fs },
    { id: 'work', label: 'Work — TI Boards', icon: I.work, badge: '4 boards' },
    { id: 'graph', label: 'Microsoft Graph', icon: I.graph },
    { id: 'okr', label: 'SmartLeader OKRs', icon: I.okr },
  ];
  const adminItems = user?.role_name === 'admin' ? [{ id: 'admin', label: 'Usuários', icon: I.users }] : [];

  const titles = { chat: 'Strategic Chat', dashboard: 'Executive Dashboard', expectativas: '7 Expectativas — Copastur', ado: 'Azure DevOps — copastur-dev', freshservice: 'Freshservice — ITSM', work: 'Work TI Boards — 4 Boards', graph: 'Microsoft Graph — Calendar & Email', okr: 'SmartLeader — OKRs', admin: 'Gestão de Usuários' };

  const priCol = p => p === 'critica' || p === 'urgent' ? 'rH' : p === 'alta' || p === 'high' ? 'rM' : 'rL';
  const priLbl = p => ({ critica:'Crítica', urgent:'Urgente', alta:'Alta', high:'Alta', media:'Média', medium:'Média', baixa:'Baixa', low:'Baixa' }[p] || p);

  return (
    <div className="app">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sb-head">
          <div className="sb-brand">Copastur · C-Level Platform</div>
          <div className="sb-name">AI Command Center</div>
        </div>
        <div className="sb-nav">
          <div className="nav-sec">Workspace</div>
          {navItems.map(n => (
            <button key={n.id} className={`nav-item ${panel === n.id ? 'active' : ''}`} onClick={() => setPanel(n.id)}>
              {n.icon}{n.label}{n.badge && <span className={`nav-badge ${n.badgeClass || ''}`}>{n.badge}</span>}
            </button>
          ))}

          <div className="nav-sec" style={{ marginTop: 8 }}>Integrações</div>
          {integItems.map(n => (
            <button key={n.id} className={`nav-item ${panel === n.id ? 'active' : ''}`} onClick={() => setPanel(n.id)}>
              {n.icon}{n.label}{n.badge && <span className="nav-badge">{n.badge}</span>}
            </button>
          ))}

          <div className="nav-sec" style={{ marginTop: 8 }}>Domínios</div>
          {DOMAINS.map(d => (
            <button key={d} className="nav-item" onClick={() => { setPanel('chat'); setInput(d + ': '); taRef.current?.focus(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/></svg>{d}
            </button>
          ))}

          {adminItems.map(n => (
            <div key={n.id}>
              <div className="nav-sec" style={{ marginTop: 8 }}>Admin</div>
              <button className={`nav-item ${panel === n.id ? 'active' : ''}`} onClick={() => setPanel(n.id)}>{n.icon}{n.label}</button>
            </div>
          ))}

          <div className="nav-sec" style={{ marginTop: 8 }}>Conversas</div>
          <button className="new-conv" onClick={newConv}>{I.plus}Nova conversa</button>
          <div className="conv-list">
            {convs.map(c => (
              <div key={c.id} className={`conv-item ${activeConv === c.id ? 'active' : ''}`} onClick={() => openConv(c.id)}>
                <div className="conv-title">{c.title || 'Conversa'}</div>
                <div className="conv-meta">{c.message_count || 0} msg · {fmtDate(c.updated_at)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="sb-footer">
          <div className="user-row">
            <div className="avatar">{user?.avatar_initials || '?'}</div>
            <div><div className="user-name">{user?.full_name?.split(' ').slice(0, 2).join(' ')}</div><div className="user-role">{user?.role_label}</div></div>
          </div>
          <button className="logout-btn" onClick={logout}>{I.logout} Sair</button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <span className="tb-title">{titles[panel]}</span>
          <span className="tb-badge">Copastur · Fase 3</span>
          <div className="tb-right">
            <button className={`icon-btn sync-btn`} onClick={syncAll} disabled={syncingAll} title="Sincronizar todas as integrações">
              <span className={syncingAll ? 'spinning' : ''}>{I.sync}</span> {syncingAll ? 'Sincronizando...' : 'Sync All'}
            </button>
            {panel === 'chat' && <button className="icon-btn" onClick={() => { setMsgs([]); setActiveConv(null); setShowChips(true); }} title="Limpar chat">{I.trash}</button>}
          </div>
        </div>

        {/* ── CHAT ─────────────────────────────────────────────── */}
        <div className={`panel ${panel === 'chat' ? 'active' : ''}`}>
          {showChips && !msgs.length && (
            <div className="chips-bar">{CHIPS.map(c => <button key={c.label} className="chip" onClick={() => sendMsg(c.p)}>{I.ado}{c.label}</button>)}</div>
          )}
          <div className="chat-area" ref={chatRef}>
            {!msgs.length && (
              <div className="msg assistant">
                <div className="msg-lbl">AI Command Center · Copastur</div>
                <div className="msg-bubble">
                  <strong>Bem-vindo, {user?.full_name?.split(' ')[0]}.</strong> Plataforma integrada às 7 Expectativas de C-Level + Azure DevOps (copastur-dev · 186 proj) + Freshservice + Work TI Boards + Microsoft Graph + SmartLeader OKRs.<br /><br />
                  Toda ação consequencial requer aprovação humana antes da execução. Apresente seu desafio.
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={m.id || i} className={`msg ${m.role}`}>
                {m.role === 'assistant' && <div className="msg-lbl">AI Command Center · Copastur</div>}
                <div className="msg-bubble">
                  {m.role === 'user' ? m.content : (() => { let p = m.parsed; if (!p && m.content) { try { const x = m.content.match(/\{[\s\S]*\}/); p = x ? JSON.parse(x[0]) : { simple: true, text: m.content }; } catch (_) { p = { simple: true, text: m.content }; } } return <AiResponse parsed={p} />; })()}
                </div>
              </div>
            ))}
            {aiLoading && <div className="msg assistant"><div className="msg-lbl">AI Command Center</div><div className="msg-bubble"><div className="ldots"><span/><span/><span/></div></div></div>}
          </div>
          <div className="chat-bar">
            <div className="chat-row">
              <textarea ref={taRef} className="chat-ta" rows={1} placeholder="Apresente seu desafio estratégico..." value={input} onChange={e => { setInput(e.target.value); autoSize(e.target); }} onKeyDown={handleKey} />
              <button className="send-btn" onClick={() => sendMsg()} disabled={aiLoading || !input.trim()}>{I.up}</button>
            </div>
          </div>
        </div>

        {/* ── DASHBOARD ────────────────────────────────────────── */}
        <div className={`panel ${panel === 'dashboard' ? 'active' : ''}`}>
          <div className="panel-scroll">
            <div className="sec-lbl">Pulso Executivo</div>
            <div className="metrics-grid">
              {[
                { l: 'Decisões Pendentes', v: dashData?.metrics?.decisions?.pendentes || '—', s: 'Requerem input C-Level' },
                { l: 'Riscos Críticos/Altos', v: dashData?.metrics?.risks?.criticos || '—', s: 'Estratégicos ativos' },
                { l: 'Iniciativas Ativas', v: dashData?.metrics?.iniciativas?.ativos || '—', s: 'Todos os workstreams' },
                { l: 'Tickets FS Urgentes', v: dashData?.freshservice_kpis?.urgent_count || '—', s: 'Freshservice' },
                { l: 'Work Issues Em Curso', v: dashData?.work_kpis?.in_progress || '—', s: 'TI Boards' },
                { l: 'Overdue ADO', v: dashData?.work_kpis?.overdue || '—', s: 'Azure DevOps' }
              ].map((m, i) => <div key={i} className="metric-card"><div className="metric-lbl">{m.l}</div><div className="metric-val">{m.v}</div><div className="metric-sub">{m.s}</div></div>)}
            </div>

            {/* OKR Summary */}
            {dashData?.okr_summary?.length > 0 && <>
              <div className="sec-lbl" style={{ marginTop: 6 }}>OKRs Q2-2026 — SmartLeader</div>
              {dashData.okr_summary.map((obj, i) => (
                <div key={i} className="okr-card">
                  <div className="okr-title">{obj.title}</div>
                  <div className="okr-meta"><span>{obj.owner}</span><span>{obj.cycle}</span><span className={`tag tag-${obj.status === 'on_track' ? 'ok' : obj.status === 'at_risk' ? 'warn' : 'err'}`}>{obj.status}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="okr-progress">{Math.round(obj.progress || 0)}%</div><div style={{ flex: 1 }}><div className="prog-bar"><div className="prog-fill prog-green" style={{ width: `${obj.progress || 0}%` }} /></div></div></div>
                </div>
              ))}
            </>}

            {/* ADO Workstreams */}
            {dashData?.ado_workstreams?.length > 0 && <>
              <div className="sec-lbl" style={{ marginTop: 6 }}>Azure DevOps — Workstreams Q2/Q3</div>
              <table className="data-table" style={{ marginBottom: 20 }}>
                <thead><tr><th>Workstream</th><th>Total</th><th>Concluídos</th><th>Epics</th><th>Bugs</th></tr></thead>
                <tbody>{dashData.ado_workstreams.map((ws, i) => (
                  <tr key={i}><td><span className={`tag ${WORKSTREAM_COLORS[ws.workstream] || 'tag-info'}`}>{ws.workstream || 'Outros'}</span></td><td>{ws.total}</td><td>{ws.done}</td><td>{ws.epics}</td><td>{ws.bugs > 0 ? <span className="tag tag-err">{ws.bugs}</span> : 0}</td></tr>
                ))}</tbody>
              </table>
            </>}

            {/* Integration Status */}
            <div className="sec-lbl">Status das Integrações</div>
            <div className="integ-grid">
              {(dashData?.integrations || []).map(integ => (
                <div key={integ.integration} className="integ-card">
                  <div className="integ-card-top">
                    <div className={`status-dot dot-${integ.status === 'success' ? 'ok' : integ.status === 'error' ? 'err' : integ.status === 'running' ? 'run' : 'idle'}`} />
                    <div><div className="integ-name">{integ.integration.replace(/_/g,' ').toUpperCase()}</div><div className="integ-status">{integ.status}</div></div>
                  </div>
                  <div className="integ-meta">Último sync: {integ.last_sync_at ? fmtDate(integ.last_sync_at) + ' ' + fmtTime(integ.last_sync_at) : 'Nunca'}<br/>{integ.items_synced ? `${integ.items_synced} itens` : ''}{integ.error_msg ? <span style={{ color: 'var(--red)', display: 'block' }}>{integ.error_msg.substring(0, 60)}</span> : ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 7 EXPECTATIVAS ──────────────────────────────────── */}
        <div className={`panel ${panel === 'expectativas' ? 'active' : ''}`}>
          <div className="panel-scroll">
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>As 7 Expectativas de C-Level — Copastur</h2>
            <p style={{ fontSize: 12, color: 'var(--t1)', marginBottom: 14, lineHeight: 1.6 }}>Apresentadas no início do ano. Não eram retórica — eram contrato. Na reengenharia cultural que vivemos agora, deixaram de ser ideal e viraram critério de permanência.</p>
            <div className="contract-note">"Esta carta é a cobrança desse contrato, agora que o cenário ficou mais claro e mais difícil." — CEO, Copastur 2025</div>
            {EXPECTATIVAS.map(e => (
              <div key={e.n} className="exp-card" onClick={() => { setPanel('chat'); sendMsg(e.p); }}>
                <div className="exp-top"><span className="exp-num">{String(e.n).padStart(2, '0')}</span><span className="exp-ttl">{e.t}</span><button className="exp-btn" onClick={ev => { ev.stopPropagation(); setPanel('chat'); sendMsg(e.p); }}>Analisar ↗</button></div>
                <div className="exp-desc">{e.d}</div>
                {e.c && <div className="exp-crit">{e.c}</div>}
              </div>
            ))}
            <div className="perm-note">
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Critério de Permanência — 2025</div>
              <div style={{ fontSize: 12, color: 'var(--t0)', lineHeight: 1.6 }}>A reengenharia cultural em curso não admite C-Level que conhece essas expectativas mas não as pratica. Clique em qualquer expectativa para análise executiva estruturada.</div>
            </div>
          </div>
        </div>

        {/* ── AZURE DEVOPS ────────────────────────────────────── */}
        <div className={`panel ${panel === 'ado' ? 'active' : ''}`}>
          <div className="panel-scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="sec-lbl" style={{ margin: 0 }}>Workstreams Q2/Q3 — copastur-dev</div>
              <button className="integ-sync-btn" onClick={async () => { await integAPI.adoSync(); loadAdo(); }}>⟳ Sincronizar ADO</button>
            </div>
            <div className="metrics-grid" style={{ marginBottom: 16 }}>
              {[{ l: 'Workstreams', v: adoData.workstreams.length }, { l: 'Itens Recentes', v: adoData.items.length }].map((m, i) => <div key={i} className="metric-card"><div className="metric-lbl">{m.l}</div><div className="metric-val">{m.v}</div></div>)}
            </div>
            {adoData.workstreams.length > 0 && <>
              <div className="sec-lbl">Por Workstream</div>
              <table className="data-table" style={{ marginBottom: 20 }}>
                <thead><tr><th>Workstream</th><th>Total</th><th>Concluídos</th><th>Taxa</th><th>Epics</th><th>Bugs</th></tr></thead>
                <tbody>{adoData.workstreams.map((ws, i) => {
                  const rate = ws.total > 0 ? Math.round((ws.done / ws.total) * 100) : 0;
                  return <tr key={i}><td><span className={`tag ${WORKSTREAM_COLORS[ws.workstream] || 'tag-info'}`}>{ws.workstream || 'Outros'}</span></td><td>{ws.total}</td><td>{ws.done}</td><td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>{rate}%</span><div className="prog-bar" style={{ flex: 1 }}><div className={`prog-fill ${rate > 60 ? 'prog-green' : rate > 30 ? 'prog-amber' : 'prog-red'}`} style={{ width: `${rate}%` }} /></div></div></td><td>{ws.epics}</td><td>{ws.bugs > 0 ? <span className="tag tag-err">{ws.bugs}</span> : 0}</td></tr>;
                })}</tbody>
              </table>
            </>}
            {adoData.items.length > 0 && <>
              <div className="sec-lbl">Itens Recentes</div>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Workstream</th><th>Atribuído</th></tr></thead>
                <tbody>{adoData.items.slice(0, 20).map((item, i) => (
                  <tr key={i}><td style={{ color: 'var(--t2)' }}>#{item.ado_id}</td><td><span className="tag tag-info">{item.work_item_type}</span></td><td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</td><td><span className={`tag ${item.state?.includes('Closed') || item.state?.includes('Resolved') ? 'tag-ok' : 'tag-info'}`}>{item.state}</span></td><td>{item.workstream ? <span className={`tag ${WORKSTREAM_COLORS[item.workstream] || 'tag-info'}`}>{item.workstream}</span> : '—'}</td><td style={{ color: 'var(--t1)' }}>{item.assigned_to || '—'}</td></tr>
                ))}</tbody>
              </table>
            </>}
            {adoData.items.length === 0 && <div style={{ color: 'var(--t2)', fontSize: 13, textAlign: 'center', padding: 40 }}>Sem dados sincronizados. Clique em "Sincronizar ADO" para buscar dados do Azure DevOps.</div>}
          </div>
        </div>

        {/* ── FRESHSERVICE ────────────────────────────────────── */}
        <div className={`panel ${panel === 'freshservice' ? 'active' : ''}`}>
          <div className="panel-scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="sec-lbl" style={{ margin: 0 }}>Tickets — {process.env.REACT_APP_FS_DOMAIN || 'copastur.freshservice.com'}</div>
              <button className="integ-sync-btn" onClick={async () => { await integAPI.fsSync(); loadFs(); }}>⟳ Sincronizar</button>
            </div>
            <div className="metrics-grid" style={{ marginBottom: 16 }}>
              {[
                { l: 'Total', v: fsData.kpis?.total || '—' },
                { l: 'Abertos', v: fsData.kpis?.open_count || '—' },
                { l: 'Urgentes', v: fsData.kpis?.urgent_count || '—' },
                { l: 'Vencidos', v: fsData.kpis?.overdue_count || '—' }
              ].map((m, i) => <div key={i} className="metric-card"><div className="metric-lbl">{m.l}</div><div className="metric-val">{m.v}</div></div>)}
            </div>
            <div className="sec-lbl">Tickets Recentes</div>
            <table className="data-table">
              <thead><tr><th>#</th><th>Assunto</th><th>Status</th><th>Prioridade</th><th>Categoria</th><th>Criado</th></tr></thead>
              <tbody>{(fsData.tickets || []).map((t, i) => (
                <tr key={i}><td style={{ color: 'var(--t2)' }}>{t.fs_id}</td><td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td><td><span className="tag tag-info">{t.status}</span></td><td><span className={`rbadge ${priCol(t.priority)}`}>{priLbl(t.priority)}</span></td><td style={{ color: 'var(--t2)' }}>{t.category || '—'}</td><td style={{ color: 'var(--t2)' }}>{fmtDate(t.created_at_fs)}</td></tr>
              ))}</tbody>
            </table>
            {!fsData.tickets?.length && <div style={{ color: 'var(--t2)', fontSize: 13, textAlign: 'center', padding: 40 }}>Nenhum ticket. Configure FRESHSERVICE_API_KEY e clique em Sincronizar.</div>}
          </div>
        </div>

        {/* ── WORK TI BOARDS ──────────────────────────────────── */}
        <div className={`panel ${panel === 'work' ? 'active' : ''}`}>
          <div className="panel-scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="sec-lbl" style={{ margin: 0 }}>TI Boards — work.cnext.app/copastur</div>
              <button className="integ-sync-btn" onClick={async () => { await integAPI.workSync(); loadWork(); }}>⟳ Sincronizar</button>
            </div>
            <div className="metrics-grid" style={{ marginBottom: 16 }}>
              {[
                { l: 'Total Issues', v: workData.kpis?.total_issues || '—' },
                { l: 'Em Andamento', v: workData.kpis?.in_progress || '—' },
                { l: 'Concluídos', v: workData.kpis?.completed || '—' },
                { l: 'Vencidos', v: workData.kpis?.overdue || '—' }
              ].map((m, i) => <div key={i} className="metric-card"><div className="metric-lbl">{m.l}</div><div className="metric-val">{m.v}</div></div>)}
            </div>
            <div className="sec-lbl">Os 4 Boards TI</div>
            {(workData.boards || []).map((b, i) => {
              const rate = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
              return (
                <div key={i} className="okr-card">
                  <div className="okr-title">{b.board_name}</div>
                  <div className="okr-meta"><span>{b.total} issues</span><span>{b.in_progress} em andamento</span><span>{b.completed} concluídos</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18, fontWeight: 500 }}>{rate}%</span><div style={{ flex: 1 }}><div className="prog-bar"><div className={`prog-fill ${rate > 60 ? 'prog-green' : rate > 30 ? 'prog-amber' : 'prog-red'}`} style={{ width: `${rate}%` }} /></div></div></div>
                </div>
              );
            })}
            {workData.issues?.length > 0 && <>
              <div className="sec-lbl" style={{ marginTop: 8 }}>Issues Recentes</div>
              <table className="data-table">
                <thead><tr><th>Board</th><th>Título</th><th>Estado</th><th>Prioridade</th><th>Vencimento</th></tr></thead>
                <tbody>{workData.issues.slice(0, 20).map((issue, i) => (
                  <tr key={i}><td style={{ color: 'var(--t2)', fontSize: 11 }}>{issue.board_name?.substring(0, 25)}...</td><td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</td><td><span className="tag tag-info">{issue.state}</span></td><td><span className={`rbadge ${priCol(issue.priority)}`}>{priLbl(issue.priority)}</span></td><td style={{ color: 'var(--t2)' }}>{issue.due_date ? fmtDate(issue.due_date) : '—'}</td></tr>
                ))}</tbody>
              </table>
            </>}
          </div>
        </div>

        {/* ── MICROSOFT GRAPH ─────────────────────────────────── */}
        <div className={`panel ${panel === 'graph' ? 'active' : ''}`}>
          <div className="panel-scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="sec-lbl" style={{ margin: 0 }}>Tenant: 5ffc8daf-9a54-46be-9c74-c98d30a2a81a</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="integ-sync-btn" onClick={async () => { try { const r = await integAPI.graphAuthUrl(); window.open(r.data.url, '_blank'); } catch (_) {} }}>Conectar conta Microsoft</button>
                <button className="integ-sync-btn" onClick={async () => { await integAPI.graphSync(); loadGraph(); }}>⟳ Sincronizar</button>
              </div>
            </div>
            <div className="two-col">
              <div>
                <div className="sec-lbl">Próximos Eventos (48h)</div>
                {(graphData.events || []).length === 0 ? <div style={{ color: 'var(--t2)', fontSize: 12, padding: '20px 0' }}>Sem eventos — conecte sua conta Microsoft acima.</div>
                : graphData.events.map((ev, i) => (
                  <div key={i} className="list-item" style={{ cursor: 'default' }}>
                    <div><div className="item-title" style={{ fontSize: 12 }}>{ev.subject}</div><div className="item-desc">{fmtDate(ev.start_dt)} {fmtTime(ev.start_dt)}{ev.is_online ? ' · Online' : ''}</div></div>
                  </div>
                ))}
              </div>
              <div>
                <div className="sec-lbl">Emails Recentes (48h)</div>
                {(graphData.emails || []).length === 0 ? <div style={{ color: 'var(--t2)', fontSize: 12, padding: '20px 0' }}>Sem emails — conecte sua conta Microsoft acima.</div>
                : graphData.emails.map((em, i) => (
                  <div key={i} className="list-item" style={{ cursor: 'default', opacity: em.is_read ? .7 : 1 }}>
                    <div><div className="item-title" style={{ fontSize: 12 }}>{em.subject}</div><div className="item-desc">{em.from_name || em.from_email} · {fmtDate(em.received_at)}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── OKRs ────────────────────────────────────────────── */}
        <div className={`panel ${panel === 'okr' ? 'active' : ''}`}>
          <div className="panel-scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="sec-lbl" style={{ margin: 0 }}>Objetivos Q2-2026 — SmartLeader</div>
              <button className="integ-sync-btn" onClick={async () => { await integAPI.okrSync('Q2-2026'); loadOkr(); }}>⟳ Sincronizar OKRs</button>
            </div>
            {(okrData.objectives || []).map((obj, i) => {
              const prog = Math.round(obj.progress || 0);
              const color = prog > 60 ? 'prog-green' : prog > 30 ? 'prog-amber' : 'prog-red';
              return (
                <div key={i} className="okr-card">
                  <div className="okr-title">{obj.title}</div>
                  <div className="okr-meta"><span>{obj.owner}</span><span className={`tag tag-${obj.status === 'on_track' ? 'ok' : obj.status === 'at_risk' ? 'warn' : 'err'}`}>{obj.status}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div className="okr-progress">{prog}%</div>
                    <div style={{ flex: 1 }}><div className="prog-bar"><div className={`prog-fill ${color}`} style={{ width: `${prog}%` }} /></div></div>
                  </div>
                </div>
              );
            })}
            {!okrData.objectives?.length && <div style={{ color: 'var(--t2)', fontSize: 13, textAlign: 'center', padding: 40 }}>Configure SMARTLEADER_API_KEY para dados reais. Clique em Sincronizar para carregar dados mock.</div>}
          </div>
        </div>

        {/* ── ADMIN ───────────────────────────────────────────── */}
        {user?.role_name === 'admin' && (
          <div className={`panel ${panel === 'admin' ? 'active' : ''}`}>
            <div className="panel-scroll">
              <button className="integ-sync-btn" style={{ marginBottom: 14 }} onClick={() => setShowUserModal(true)}>{I.plus} Adicionar usuário</button>
              <table className="data-table">
                <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Último acesso</th><th>Status</th></tr></thead>
                <tbody>{users.map(u => (
                  <tr key={u.id}><td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>{u.avatar_initials}</div>{u.full_name}</div></td><td style={{ color: 'var(--t1)' }}>{u.email}</td><td><span className="tag tag-info">{u.role_label}</span></td><td style={{ color: 'var(--t2)' }}>{u.last_login_at ? fmtDate(u.last_login_at) : 'Nunca'}</td><td><span className={`tag ${u.is_active ? 'tag-ok' : 'tag-err'}`}>{u.is_active ? 'Ativo' : 'Inativo'}</span></td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL ADD USER ─────────────────────────────────────── */}
      {showUserModal && (
        <div className="modal-ov" onClick={() => setShowUserModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Adicionar usuário C-Level</div>
            {['full_name', 'email'].map(f => (
              <div key={f} className="form-group">
                <label className="form-label">{f === 'full_name' ? 'Nome completo' : 'Email corporativo'}</label>
                <input className="form-input" type={f === 'email' ? 'email' : 'text'} value={newUser[f]} onChange={e => setNewUser(p => ({ ...p, [f]: e.target.value }))} placeholder={f === 'full_name' ? 'João Silva' : 'joao@copastur.com.br'} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Perfil</label>
              <select className="form-select" value={newUser.role_name} onChange={e => setNewUser(p => ({ ...p, role_name: e.target.value }))}>
                {['ceo','cto','cfo','coo','cpto','cio','board','admin'].map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Senha inicial</label>
              <input className="form-input" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="modal-acts"><button className="btn-sec" onClick={() => setShowUserModal(false)}>Cancelar</button><button className="btn-primary" onClick={createUser}>Criar usuário</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
