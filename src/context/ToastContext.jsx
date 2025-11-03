import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import '../styles/toast.css';

const ToastContext = createContext();

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const queueRef = useRef([]);
  const [currentToast, setCurrentToast] = useState(null);
  const isShowingRef = useRef(false);
  const timeoutRef = useRef(null);

  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0 || isShowingRef.current) {
      return;
    }

    const nextToast = queueRef.current.shift();
    isShowingRef.current = true;
    setCurrentToast(nextToast);

    console.log(`🎬 Showing toast: ${nextToast.title || nextToast.message} (${queueRef.current.length} remaining in queue)`);

    const duration = nextToast.duration || 5000;

    timeoutRef.current = setTimeout(() => {
      setCurrentToast(null);
      isShowingRef.current = false;
      
      console.log(`✅ Toast dismissed, processing next (${queueRef.current.length} in queue)`);
      
      setTimeout(() => {
        processQueue();
      }, 300);
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showToast = useCallback(({ type = 'info', icon = '🔔', title = '', message = '', duration = 5000 }) => {
    const id = Date.now() + Math.random();
    const toast = { id, type, icon, title, message, duration };

    queueRef.current.push(toast);
    console.log(`📥 Toast added to queue (${queueRef.current.length} in queue)`);
    
    if (!isShowingRef.current) {
      processQueue();
    }
  }, [processQueue]);

  const removeToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentToast(null);
    isShowingRef.current = false;
    
    setTimeout(() => {
      processQueue();
    }, 300);
  }, [processQueue]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {currentToast && (
          <div 
            key={currentToast.id} 
            className={`toast toast-${currentToast.type} show`}
            onClick={removeToast}
          >
            <div className="toast-icon">{currentToast.icon}</div>
            <div className="toast-content">
              {currentToast.title && <div className="toast-title">{currentToast.title}</div>}
              <div className="toast-message">{currentToast.message}</div>
            </div>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
