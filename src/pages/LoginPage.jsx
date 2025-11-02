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
    <div style={{ padding: '60px 20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', textAlign: 'center' }}>Login</h1>
      
      <p style={{ 
        textAlign: 'center', 
        fontSize: '16px', 
        color: '#555', 
        marginBottom: '30px',
        lineHeight: '1.6'
      }}>
        Welcome back, jerky lover! Enter your <strong>jerky.com</strong> account email below and we'll send you a magic link to get started.
      </p>
      
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
            placeholder="your@email.com"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{ 
            width: '100%', 
            padding: '14px', 
            background: '#6B8E23', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '16px', 
            fontWeight: '600', 
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1
          }}
        >
          {isLoading ? 'Sending...' : 'Send Magic Link'}
        </button>

        {message && (
          <p style={{ 
            marginTop: '20px', 
            padding: '12px', 
            background: message.includes('error') || message.includes('failed') ? '#fee' : '#efe',
            color: message.includes('error') || message.includes('failed') ? '#c33' : '#363',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            {message}
          </p>
        )}
      </form>

      <div style={{ 
        marginTop: '30px', 
        padding: '24px', 
        background: '#f9f5f0', 
        borderRadius: '8px',
        border: '2px solid #e8d5b7'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#6B8E23', fontSize: '18px' }}>
          New to Jerky Rankings?
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#555', lineHeight: '1.6' }}>
          You'll need a <strong>jerky.com</strong> account to rank your favorite meats and join our community of jerky enthusiasts.
        </p>
        <a 
          href="https://www.jerky.com/account/register" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'inline-block',
            padding: '12px 24px', 
            background: '#8B4513', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '4px', 
            fontWeight: '600',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#6d3410'}
          onMouseOut={(e) => e.target.style.background = '#8B4513'}
        >
          Create Your Account →
        </a>
      </div>
    </div>
  );
}

export default LoginPage;
