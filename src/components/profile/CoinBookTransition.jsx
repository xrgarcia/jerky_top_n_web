import React, { forwardRef } from 'react';
import './CoinBookTransition.css';

const CoinBookTransition = forwardRef((props, ref) => {
  return (
    <section ref={ref} className="coin-book-transition">
      <div className="page-turn-wrapper">
        <div className="transition-content">
          <p className="transition-line line-1">
            The journey reel captured the bites; now your <strong>COIN BOOK</strong> captures the legend.
          </p>
          <p className="transition-line line-2">
            Pop each capsule to celebrate the hunts, streaks, and discoveries that keep you on top.
          </p>
        </div>
      </div>
    </section>
  );
});

CoinBookTransition.displayName = 'CoinBookTransition';

export default CoinBookTransition;
