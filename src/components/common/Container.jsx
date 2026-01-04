import React from 'react';
import './Container.css';

function Container({ children, size = 'standard', className = '' }) {
  return (
    <div className={`app-container app-container--${size} ${className}`}>
      {children}
    </div>
  );
}

export default Container;
