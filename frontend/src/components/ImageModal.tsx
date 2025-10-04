import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiZoomIn, FiZoomOut, FiDownload } from 'react-icons/fi';

interface ImageModalProps {
  imageUrl: string;
  altText?: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, altText = 'Image', onClose }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Lock body scroll when modal opens
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle click outside modal to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Handle image load success
  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  // Handle image load error
  const handleImageError = () => {
    setImageLoaded(false);
    setImageError(true);
  };

  // Toggle zoom state
  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  // Download image
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `image-${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1010] p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-2xl max-w-4xl max-h-full overflow-hidden"
      >
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleZoom}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                title={isZoomed ? 'Zoom Out' : 'Zoom In'}
              >
                {isZoomed ? <FiZoomOut size={20} /> : <FiZoomIn size={20} />}
              </button>
              <button
                onClick={handleDownload}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                title="Download Image"
              >
                <FiDownload size={20} />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
              title="Close"
            >
              <FiX size={24} />
            </button>
          </div>
        </div>

        {/* Image container */}
        <div className="relative w-full h-full">
          {!imageLoaded && !imageError && (
            <div className="flex items-center justify-center min-h-[400px] bg-gray-100">
              <div className="text-gray-500">Loading image...</div>
            </div>
          )}

          {imageError && (
            <div className="flex items-center justify-center min-h-[400px] bg-gray-100">
              <div className="text-red-500 text-center">
                <div>Failed to load image</div>
                <button 
                  onClick={() => window.open(imageUrl, '_blank')}
                  className="mt-2 text-blue-500 hover:underline"
                >
                  Open in new tab instead
                </button>
              </div>
            </div>
          )}

          <img
            src={imageUrl}
            alt={altText}
            className={`
              w-full h-auto transition-transform duration-300 ease-in-out
              ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            style={{
              transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
              cursor: isZoomed ? 'zoom-out' : 'zoom-in'
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onClick={toggleZoom}
          />
        </div>

        {/* Footer with image info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          <div className="text-white text-sm opacity-90">
            {altText}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
