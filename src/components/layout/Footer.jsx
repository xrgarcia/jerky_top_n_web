import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './Footer.css';

export default function Footer() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>Navigation</h4>
          <ul className="footer-links">
            <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a></li>
            <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/products'); }}>Products</a></li>
            <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/community'); }}>Community</a></li>
            <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/rank'); }}>Rank Jerky</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Account</h4>
          <ul className="footer-links">
            {user ? (
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/profile'); }}>My Profile</a></li>
            ) : (
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Log In</a></li>
            )}
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Jerky.com</h4>
          <ul className="footer-links">
            <li><a href="https://jerky.com" target="_blank" rel="noopener noreferrer">Shop Jerky</a></li>
            <li><a href="https://jerky.com/pages/quiz" target="_blank" rel="noopener noreferrer">Take the Quiz</a></li>
            <li><a href="https://jerky.com/pages/about" target="_blank" rel="noopener noreferrer">About Us</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Legal</h4>
          <ul className="footer-links">
            <li><a href="https://jerky.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
            <li><a href="https://jerky.com/policies/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</a></li>
          </ul>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; 2025 Jerky.com. All rights reserved. | Community Ranking Platform</p>
      </div>
    </footer>
  );
}
