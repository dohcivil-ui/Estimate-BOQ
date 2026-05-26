import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initDirtyTracking } from './stores/dirtyTracking';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element not found');

// init subscribers ก่อน mount App
initDirtyTracking();

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
