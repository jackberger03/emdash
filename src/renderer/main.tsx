import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FloatingChat from './components/FloatingChat';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// Route based on hash
const renderApp = () => {
  const hash = window.location.hash;
  if (hash === '#/floating-chat') {
    return <FloatingChat />;
  }
  return <App />;
};

// Avoid double-mount in dev which can duplicate PTY sessions
root.render(renderApp());
