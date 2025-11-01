import React from 'react';
import './Header.css';

function Header() {
  return (
    <div className="announcement-banner">
      <span className="announcement-icon">🎉</span>
      <span className="announcement-text">Take our quiz, get free jerky</span>
      <a 
        href="https://jerky.com/pages/jerky-type" 
        target="_blank" 
        rel="noopener noreferrer"
        className="announcement-btn"
      >
        Take the Quiz
      </a>
    </div>
  );
}

export default Header;
