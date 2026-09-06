import React from 'react';
import ReactDOM from 'react-dom/client';
import SwapCard from './SwapCard.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ padding: '32px 16px', minHeight: '100vh', boxSizing: 'border-box' }}>
      <SwapCard />
    </div>
  </React.StrictMode>
);
