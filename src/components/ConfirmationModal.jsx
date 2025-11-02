import React, { useState, useEffect } from 'react';
import '../styles/modal.css';

function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  requiredText = null,
  confirmButtonText = 'Confirm',
  confirmButtonClass = 'btn-danger'
}) {
  const [inputValue, setInputValue] = useState('');
  const [isValid, setIsValid] = useState(!requiredText);

  useEffect(() => {
    if (requiredText) {
      setIsValid(inputValue === requiredText);
    }
  }, [inputValue, requiredText]);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setIsValid(!requiredText);
    }
  }, [isOpen, requiredText]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm();
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isValid) {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, isValid]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        
        <div className="modal-body">
          <p className="modal-message">{message}</p>
          
          {requiredText && (
            <div className="modal-input-container">
              <label className="modal-input-label">
                Type <span className="required-text">{requiredText}</span> to confirm:
              </label>
              <input
                type="text"
                className="modal-input"
                placeholder={`Type "${requiredText}" here`}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn-secondary" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className={confirmButtonClass}
            onClick={handleConfirm}
            disabled={!isValid}
            style={{
              opacity: isValid ? 1 : 0.5,
              cursor: isValid ? 'pointer' : 'not-allowed'
            }}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
