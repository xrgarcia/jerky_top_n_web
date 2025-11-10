import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg, compressImage, blobToFile } from '../utils/imageCompression';
import './ImageCropModal.css';

function ImageCropModal({ imageSrc, onComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropAndUpload = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      const compressedBlob = await compressImage(croppedBlob, 200);
      
      // Validate the final blob
      if (!compressedBlob || compressedBlob.type !== 'image/jpeg') {
        throw new Error('Image processing failed - invalid format');
      }

      if (compressedBlob.size > 500 * 1024) {
        throw new Error('Image is too large after compression');
      }
      
      const file = blobToFile(compressedBlob, 'profile-image.jpg');
      
      onComplete(file);
    } catch (error) {
      console.error('Error processing image:', error);
      alert(`Failed to process image: ${error.message}. Please try a different image.`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="image-crop-modal-overlay">
      <div className="image-crop-modal">
        <div className="modal-header">
          <h2>Crop Your Profile Picture</h2>
          <button 
            className="modal-close-btn"
            onClick={onCancel}
            disabled={isProcessing}
          >
            ✕
          </button>
        </div>

        <div className="crop-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="crop-controls">
          <div className="zoom-control">
            <label>Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="zoom-slider"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-cancel"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button 
            className="btn btn-crop"
            onClick={handleCropAndUpload}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Crop & Upload'}
          </button>
        </div>

        <p className="crop-hint">
          Drag to position • Pinch or use slider to zoom
        </p>
      </div>
    </div>
  );
}

export default ImageCropModal;
