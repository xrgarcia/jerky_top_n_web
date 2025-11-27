import React from 'react';
import Container from '../components/common/Container';
import CoinBookPageV2 from '../components/coinbook/CoinBookPageV2/CoinBookPageV2';
import '../styles/layout.css';
import '../styles/hero-headers.css';

function CoinBookPageV2Wrapper() {
  return (
    <div className="page-shell coinbook-page">
      <Container size="standard">
        <div className="coinbook-hero">
          <div className="hero-intro">
            <h1 className="hero-title">The Coin Book</h1>
            <p className="hero-subtitle">
              Your complete flavor collection.
            </p>
          </div>
        </div>
        <CoinBookPageV2 />
      </Container>
    </div>
  );
}

export default CoinBookPageV2Wrapper;
