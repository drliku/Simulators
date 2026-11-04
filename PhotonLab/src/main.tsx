import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useStore, useTraceStore } from './state/store';

// Debug/E2E hook (development builds only)
if (import.meta.env.DEV) Object.assign(window, { __photon: { useStore, useTraceStore } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
