import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cpst_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

API.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export const authAPI = {
  login: (email, password) => API.post('/auth/login', { email, password }),
  me: () => API.get('/auth/me'),
  logout: () => API.post('/auth/logout')
};

export const chatAPI = {
  list: () => API.get('/chat/conversations'),
  create: (title, domain) => API.post('/chat/conversations', { title, domain }),
  messages: (id) => API.get(`/chat/conversations/${id}/messages`),
  send: (id, content) => API.post(`/chat/conversations/${id}/messages`, { content }),
  archive: (id) => API.delete(`/chat/conversations/${id}`)
};

export const dashAPI = {
  summary: () => API.get('/dashboard'),
  decisions: () => API.get('/decisions'),
  createDecision: (d) => API.post('/decisions', d),
  updateDecision: (id, d) => API.patch(`/decisions/${id}`, d),
  risks: () => API.get('/risks'),
  createRisk: (r) => API.post('/risks', r),
  expectativas: () => API.get('/expectativas'),
  users: () => API.get('/users'),
  createUser: (u) => API.post('/users', u)
};

export const integAPI = {
  status: () => API.get('/integrations/status'),
  syncAll: () => API.post('/integrations/sync-all'),
  // ADO
  adoWorkstreams: () => API.get('/integrations/ado/workstreams'),
  adoItems: (params) => API.get('/integrations/ado/items', { params }),
  adoSync: () => API.post('/integrations/ado/sync'),
  // Freshservice
  fsTickets: (limit) => API.get('/integrations/freshservice/tickets', { params: { limit } }),
  fsSync: () => API.post('/integrations/freshservice/sync'),
  // Work/Plane
  workBoards: () => API.get('/integrations/work/boards'),
  workIssues: (params) => API.get('/integrations/work/issues', { params }),
  workSync: () => API.post('/integrations/work/sync'),
  // Graph
  calendarEvents: () => API.get('/integrations/graph/calendar'),
  emails: () => API.get('/integrations/graph/email'),
  graphSync: () => API.post('/integrations/graph/sync'),
  graphAuthUrl: () => API.get('/integrations/graph/auth-url'),
  graphCallback: (code, state) => API.post('/integrations/graph/callback', { code, state }),
  // OKR
  okrSummary: (cycle) => API.get('/integrations/okr/summary', { params: { cycle } }),
  okrSync: (cycle) => API.post('/integrations/okr/sync', { cycle })
};

export const credentialsAPI = {
  list: () => API.get('/admin/credentials'),
  save: (key_name, value) => API.put('/admin/credentials', { key_name, value }),
  remove: (key_name) => API.delete(`/admin/credentials/${key_name}`),
  test: (integration) => API.post(`/admin/credentials/test/${integration}`)
};

export const errorLogAPI = {
  list: (params) => API.get('/admin/integration-errors', { params }),
  fixRequests: () => API.get('/admin/fix-requests'),
  createFixRequest: (payload) => API.post('/admin/fix-requests', payload),
  updateFixRequest: (id, status) => API.patch(`/admin/fix-requests/${id}`, { status })
};

export default API;
