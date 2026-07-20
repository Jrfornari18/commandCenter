import React, { useEffect, useState } from 'react';
import { integAPI } from '../services/api';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('processing'); // processing | success | error
  const [message, setMessage] = useState('Concluindo conexão com a Microsoft...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error_description') || params.get('error');

    if (oauthError) {
      setStatus('error');
      setMessage(oauthError);
      return;
    }
    if (!code || !state) {
      setStatus('error');
      setMessage('Parâmetros de autenticação ausentes no retorno da Microsoft.');
      return;
    }

    integAPI.graphCallback(code, state)
      .then(() => {
        setStatus('success');
        setMessage('Conta Microsoft conectada com sucesso. Você já pode fechar esta aba.');
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Erro ao concluir a conexão com a Microsoft.');
      });
  }, []);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-tag">Copastur · C-Level Platform</div>
        <div className="login-logo-name">Microsoft Graph</div>
        <div className="login-divider" />
        {status === 'error' && <div className="login-error">{message}</div>}
        {status !== 'error' && <div className="login-sub">{message}</div>}
      </div>
    </div>
  );
}
