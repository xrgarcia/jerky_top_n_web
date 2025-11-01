import { useEffect, useState, useRef } from 'react';
import './RankingsPanel.css';

export function RankingsPanel({ rankings, updateRankings, saveStatus, saveMessage, onClearAll, onClearQueue }) {
  const [slotCount, setSlotCount] = useState(10);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const maxRank = Math.max(...rankings.map(r => r.ranking), 10);
    if (maxRank > slotCount) {
      setSlotCount(maxRank);
    }
    
    const filledCount = rankings.length;
    if (filledCount > 0 && filledCount >= slotCount - 2) {
      setSlotCount(prev => prev + 5);
    }
  }, [rankings, slotCount]);

  const handleDrop = (targetRank, e) => {
    e.preventDefault();
    
    let dragData = draggedItem;
    
    if (!dragData) {
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          dragData = JSON.parse(jsonData);
        }
      } catch (err) {
        console.error('Failed to parse drag data:', err);
        return;
      }
    }
    
    if (!dragData) return;

    const newRankings = [...rankings];
    
    const existingIndex = newRankings.findIndex(r => r.ranking === targetRank);

    if (dragData.type === 'product') {
      const existingRank = newRankings.findIndex(r => r.productData.productId === dragData.product.productId);
      if (existingRank !== -1) {
        console.warn(`Product already ranked at position ${newRankings[existingRank].ranking}`);
        return;
      }

      const itemsToPushDown = newRankings
        .filter(r => r.ranking >= targetRank)
        .sort((a, b) => b.ranking - a.ranking);

      itemsToPushDown.forEach(item => {
        item.ranking += 1;
      });

      newRankings.push({
        ranking: targetRank,
        productData: dragData.product
      });

      newRankings.sort((a, b) => a.ranking - b.ranking);
      updateRankings(newRankings);
    } else if (dragData.type === 'slot') {
      const sourceRanking = dragData.ranking;
      const sourceIndex = newRankings.findIndex(r => r.ranking === sourceRanking);
      
      if (sourceIndex === -1) return;
      
      const movedItem = newRankings[sourceIndex];
      newRankings.splice(sourceIndex, 1);

      if (existingIndex !== -1) {
        newRankings.splice(existingIndex, 0, movedItem);
      } else {
        newRankings.push(movedItem);
      }

      movedItem.ranking = targetRank;

      newRankings
        .filter(r => r.ranking > targetRank && r !== movedItem)
        .forEach(r => r.ranking += 1);

      newRankings.sort((a, b) => a.ranking - b.ranking);
      updateRankings(newRankings);
    }

    setDraggedItem(null);
    setDragOverSlot(null);
  };

  const handleDragStart = (ranking, e) => {
    const item = rankings.find(r => r.ranking === ranking);
    if (item) {
      setDraggedItem({ type: 'slot', ranking, product: item.productData });
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleRemove = (ranking) => {
    const newRankings = rankings
      .filter(r => r.ranking !== ranking)
      .map((r, index) => ({ ...r, ranking: index + 1 }));
    
    updateRankings(newRankings);
  };

  const handleClearAllClick = () => {
    if (window.confirm('Are you sure you want to clear all rankings?')) {
      onClearAll();
    }
  };

  const handleClearQueueClick = async () => {
    if (window.confirm('Clear all stuck saves from the queue? This will remove any pending operations that failed to save.')) {
      const success = await onClearQueue();
      if (success) {
        alert('✅ Queue cleared successfully! Please refresh the page.');
      } else {
        alert('❌ Failed to clear queue. Please try again or contact support.');
      }
    }
  };

  const renderSlots = () => {
    const slots = [];
    for (let i = 1; i <= slotCount; i++) {
      const ranking = rankings.find(r => r.ranking === i);
      const isFilled = !!ranking;
      const isDragOver = dragOverSlot === i;

      slots.push(
        <div
          key={i}
          className={`ranking-slot ${isFilled ? 'filled' : ''} ${isDragOver ? 'drag-over' : ''}`}
          data-rank={i}
          draggable={isFilled}
          onDragStart={(e) => isFilled && handleDragStart(i, e)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverSlot(i);
          }}
          onDragLeave={() => setDragOverSlot(null)}
          onDrop={(e) => handleDrop(i, e)}
        >
          <div className="slot-number">{i}</div>
          {isFilled ? (
            <div className="slot-content">
              <img 
                src={ranking.productData.image || '/placeholder.jpg'} 
                alt={ranking.productData.title}
                className="product-thumbnail"
              />
              <div className="product-info">
                <div className="product-title">{ranking.productData.title}</div>
                <div className="product-vendor">{ranking.productData.vendor}</div>
              </div>
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(i);
                }}
                title="Remove from rankings"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="slot-placeholder">
              Drop a product here to rank #{i}
            </div>
          )}
        </div>
      );
    }
    return slots;
  };

  const filledCount = rankings.length;

  return (
    <div className="rankings-panel" ref={panelRef}>
      <div className="rankings-header">
        <h3>Your Rankings</h3>
        <div className="rankings-controls">
          {saveStatus !== 'idle' && (
            <div className={`save-indicator ${saveStatus}`}>
              {saveStatus === 'saving' && <span className="spinner"></span>}
              <span>{saveMessage}</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <button 
              className="clear-queue-btn" 
              onClick={handleClearQueueClick}
              title="Clear stuck saves from queue"
            >
              🗑️ Clear Stuck Saves
            </button>
          )}
          {filledCount > 0 && (
            <button className="clear-all-btn" onClick={handleClearAllClick}>
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="rankings-progress">
        <div className="progress-text">{filledCount} of {slotCount} ranked</div>
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${(filledCount / slotCount) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="ranking-slots-container">
        {renderSlots()}
      </div>
    </div>
  );
}
