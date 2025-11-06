import { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../utils/api';
import './PersonalizedGuidance.css';

/**
 * Parse message text and convert image paths to actual <img> elements
 * Handles paths like: /objects/achievement-icons/uuid.png
 */
function parseMessageWithImages(message) {
  if (!message) return null;
  
  // Regex to match image paths (supports /path/to/file.png, .jpg, .svg, .gif, .webp)
  const imagePathRegex = /(\/[\w\-\/]+\.(?:png|jpg|jpeg|svg|gif|webp))/gi;
  
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Find all image paths in the message
  while ((match = imagePathRegex.exec(message)) !== null) {
    // Add text before the image
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: message.slice(lastIndex, match.index)
      });
    }
    
    // Add the image
    parts.push({
      type: 'image',
      content: match[1]
    });
    
    lastIndex = match.index + match[1].length;
  }
  
  // Add remaining text after last image
  if (lastIndex < message.length) {
    parts.push({
      type: 'text',
      content: message.slice(lastIndex)
    });
  }
  
  // If no images found, return plain text
  if (parts.length === 0) {
    return message;
  }
  
  // Render parts with images as actual <img> tags
  return parts.map((part, index) => {
    if (part.type === 'image') {
      return (
        <img 
          key={index}
          src={part.content} 
          alt="achievement icon" 
          className="guidance-inline-icon"
          style={{ height: '1.2em', width: '1.2em', verticalAlign: 'middle', marginLeft: '2px', marginRight: '2px' }}
        />
      );
    }
    return <span key={index}>{part.content}</span>;
  });
}

export default function PersonalizedGuidance({ page = 'general' }) {
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { socket } = useSocket();

  const fetchGuidance = async () => {
    try {
      setLoading(true);
      console.log(`🎯 Fetching guidance for page: ${page}`);
      const data = await api.get(`/gamification/user-guidance?page=${page}`);
      console.log('📦 Guidance API Response:', data);
      setGuidance(data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch guidance:', err);
      setError('Unable to load personalized guidance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidance();
  }, [page]);

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
    console.log('⚠️ No guidance to display:', { error, guidance, page });
    return null;
  }

  console.log('✅ Rendering guidance:', guidance);
  const { guidance: guidanceMessage } = guidance;

  return (
    <div className="personalized-guidance">
      <div className="guidance-header">
        <div className="guidance-title">
          <span className="guidance-icon">{guidanceMessage.icon}</span>
          <span className="guidance-label">{guidanceMessage.title || 'Personalized Tip'}</span>
        </div>
      </div>
      
      <div className="guidance-content">
        <p className="guidance-message">{parseMessageWithImages(guidanceMessage.message)}</p>
        {guidanceMessage.action && (
          <div className="guidance-action">
            <span className="action-label">{guidanceMessage.action}</span>
          </div>
        )}
      </div>
    </div>
  );
}
