import React from 'react';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import PersonalizedGuidance from '../components/personalized/PersonalizedGuidance';
import './CoinBookPage.css';

function CoinBookPage() {
  return (
    <div className="coinbook-page">
      <div className="coinbook-page-header">
        <h1>🪙 Coin Book</h1>
        <PersonalizedGuidance page="coinbook" />
      </div>
      <CoinBookWidget defaultCollapsed={false} />
    </div>
  );
}

export default CoinBookPage;
