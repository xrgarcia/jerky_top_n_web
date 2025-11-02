import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { checkAuth } = useAuthStore();
  
  const redirectMessage = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/customer/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Check your email for a magic login link!');
      } else {
        setMessage(data.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '520px', margin: '0 auto' }}>
      <h1 style={{ 
        marginBottom: '32px', 
        textAlign: 'center',
        fontSize: '36px',
        color: '#2c2c2c',
        fontWeight: '700'
      }}>
        Login
      </h1>
      
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        {redirectMessage && (
          <div style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%)',
            borderBottom: '3px solid #f5c518',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: 0, 
              color: '#8B6914', 
              fontSize: '16px', 
              lineHeight: '1.6',
              fontWeight: '500'
            }}>
              🥩 {redirectMessage}
            </p>
          </div>
        )}
        
        <div style={{ padding: '40px' }}>
          <p style={{ 
            textAlign: 'center', 
            fontSize: '15px', 
            color: '#666', 
            marginBottom: '28px',
            lineHeight: '1.6'
          }}>
            Welcome back, jerky lover! Enter your <strong style={{ color: '#6B8E23' }}>jerky.com</strong> account email and we'll send you a magic link.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="email" style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c2c2c',
                fontSize: '14px'
              }}>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ 
                  width: '100%', 
                  padding: '14px 16px', 
                  border: '2px solid #e0e0e0', 
                  borderRadius: '8px', 
                  fontSize: '16px',
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                placeholder="your@email.com"
                onFocus={(e) => e.target.style.borderColor = '#6B8E23'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{ 
                width: '100%', 
                padding: '16px', 
                background: isLoading ? '#8ca849' : '#6B8E23',
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '16px', 
                fontWeight: '600', 
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: isLoading ? 'none' : '0 2px 8px rgba(107, 142, 35, 0.3)'
              }}
              onMouseOver={(e) => !isLoading && (e.target.style.background = '#5a7a1e')}
              onMouseOut={(e) => !isLoading && (e.target.style.background = '#6B8E23')}
            >
              {isLoading ? 'Sending...' : 'Send Magic Link'}
            </button>

            {message && (
              <div style={{ 
                marginTop: '20px', 
                padding: '14px 16px', 
                background: message.includes('error') || message.includes('failed') ? '#ffebee' : '#e8f5e9',
                color: message.includes('error') || message.includes('failed') ? '#c62828' : '#2e7d32',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '15px',
                fontWeight: '500',
                border: `2px solid ${message.includes('error') || message.includes('failed') ? '#ef9a9a' : '#a5d6a7'}`
              }}>
                {message}
              </div>
            )}
          </form>
        </div>
      </div>

      <div style={{ 
        marginTop: '32px', 
        padding: '32px', 
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '2px solid #f5e6d3'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            color: '#6B8E23', 
            fontSize: '20px',
            fontWeight: '700'
          }}>
            New to Jerky Rankings?
          </h3>
          <p style={{ margin: 0, color: '#666', lineHeight: '1.6', fontSize: '15px' }}>
            You'll need a <strong style={{ color: '#2c2c2c' }}>jerky.com</strong> account to rank your favorite meats and join our community.
          </p>
        </div>
        <a 
          href="https://www.jerky.com/account/register" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'block',
            padding: '14px 28px', 
            background: '#8B4513', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '8px', 
            fontWeight: '600',
            transition: 'all 0.2s',
            textAlign: 'center',
            fontSize: '16px',
            boxShadow: '0 2px 8px rgba(139, 69, 19, 0.3)'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#6d3410';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(139, 69, 19, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = '#8B4513';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(139, 69, 19, 0.3)';
          }}
        >
          Create Your Account →
        </a>
      </div>
    </div>
  );
}

export default LoginPage;
