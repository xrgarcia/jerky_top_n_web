import React from 'react';
import Container from '../components/common/Container';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import '../styles/hero-headers.css';
import './CoinBookPage.css';

function CoinBookPage() {
  return (
    <div className="coinbook-page">
      <Container size="standard">
        <div className="coinbook-hero">
          <div className="hero-intro">
            <h1 className="hero-title">Your Coin Book</h1>
            <p className="hero-subtitle">
              Like collecting state quarters, your Coin Book shows both what you've earned and what's waiting to be discovered.
            </p>
          </div>
        </div>
        <CoinBookWidget defaultCollapsed={false} />
      </Container>
    </div>
  );
}

export default CoinBookPage;
