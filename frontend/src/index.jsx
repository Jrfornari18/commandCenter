import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AppPage from './pages/AppPage';
import './styles/global.css';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9d9d99', fontSize: 13 }}>Carregando...</div>;
  return user ? children : <Navigate to="/login" replace />;
}
function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Public><LoginPage /></Public>} />
        <Route path="/" element={<Private><AppPage /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
