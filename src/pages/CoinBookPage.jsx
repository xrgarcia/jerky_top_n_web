import React from 'react';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import './CoinBookPage.css';

function CoinBookPage() {
  return (
    <div className="coinbook-page">
      <div className="coinbook-page-header">
        <h1>🪙 Coin Book</h1>
        <p>Track your achievements and progress</p>
      </div>
      <CoinBookWidget defaultCollapsed={false} />
    </div>
  );
}

export default CoinBookPage;
