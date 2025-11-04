import { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../utils/api';
import './PersonalizedGuidance.css';

export default function PersonalizedGuidance() {
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { socket } = useSocket();

  const fetchGuidance = async () => {
    try {
      setLoading(true);
      const data = await api.get('/gamification/user-guidance');
      setGuidance(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch guidance:', err);
      setError('Unable to load personalized guidance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidance();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleGuidanceUpdate = (data) => {
      console.log('📬 Received guidance update:', data);
      setGuidance(prev => ({
        ...prev,
        guidance: data.guidance
      }));
    };

    const handleClassificationUpdate = (data) => {
      console.log('🎯 Received classification update:', data);
      fetchGuidance();
    };

    socket.on('guidance:updated', handleGuidanceUpdate);
    socket.on('classification:updated', handleClassificationUpdate);

    return () => {
      socket.off('guidance:updated', handleGuidanceUpdate);
      socket.off('classification:updated', handleClassificationUpdate);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="personalized-guidance loading">
        <div className="guidance-spinner"></div>
      </div>
    );
  }

  if (error || !guidance) {
    return null;
  }

  const { guidance: guidanceMessage } = guidance;

  return (
    <div className={`personalized-guidance ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="guidance-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="guidance-title">
          <span className="guidance-icon">{guidanceMessage.icon}</span>
          <span className="guidance-label">Personalized Tip</span>
        </div>
        <button className="collapse-btn" aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="guidance-content">
          <p className="guidance-message">{guidanceMessage.message}</p>
          {guidanceMessage.action && (
            <div className="guidance-action">
              <span className="action-label">{guidanceMessage.action}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
