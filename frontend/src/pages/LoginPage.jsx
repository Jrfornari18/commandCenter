import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await login(email, password); navigate('/'); }
    catch (err) { setError(err.response?.data?.error || 'Erro ao autenticar. Verifique suas credenciais.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-tag">Copastur · C-Level Platform</div>
        <div className="login-logo-name">AI Command Center</div>
        <div className="login-sub">Acesso restrito à liderança executiva.<br/>Microsoft Graph · Azure DevOps · Freshservice · Work TI · OKRs</div>
        <div className="login-divider" />
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email corporativo</label>
            <input id="email" type="email" className="form-input" placeholder="seu@copastur.com.br" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Senha</label>
            <input id="password" type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Autenticando...' : 'Acessar plataforma'}</button>
        </form>
        <div className="login-hint">Problemas de acesso? admin@copastur.com.br</div>
      </div>
    </div>
  );
}
