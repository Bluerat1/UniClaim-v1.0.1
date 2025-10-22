import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiZoomIn, FiZoomOut, FiDownload, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface ImageModalProps {
  images: string[];
  initialIndex?: number;
  altText?: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  images,
  initialIndex = 0,
  altText = 'Image',
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
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

    const handleKeyNavigation = (e: KeyboardEvent) => {
      if (images.length <= 1) return;

      if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
        setIsZoomed(false);
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
        setIsZoomed(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleKeyNavigation);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleKeyNavigation);
    };
  }, [onClose, images.length]);

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

  // Navigation functions
  const goToPrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    setIsZoomed(false);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    setIsZoomed(false);
  };

  // Toggle zoom state
  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  // Download current image
  const handleDownload = () => {
    const currentImage = images[currentIndex];
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `image-${currentIndex + 1}-${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle zoom on image click
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleZoom();
  };

  const currentImageUrl = images[currentIndex];
  const hasMultipleImages = images.length > 1;

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[1010] p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-2xl max-w-6xl max-h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Navigation arrows for multiple images */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                    title="Previous Image"
                  >
                    <FiChevronLeft size={20} />
                  </button>
                  <button
                    onClick={goToNext}
                    className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                    title="Next Image"
                  >
                    <FiChevronRight size={20} />
                  </button>
                </>
              )}

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

            <div className="flex items-center space-x-2">
              {/* Image counter for multiple images */}
              {hasMultipleImages && (
                <span className="text-white text-sm font-medium px-3 py-1 bg-black/30 rounded-full">
                  {currentIndex + 1} / {images.length}
                </span>
              )}

              <button
                onClick={onClose}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                title="Close"
              >
                <FiX size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Image container */}
        <div className="relative w-full h-full min-h-[400px] max-h-[80vh] flex items-center justify-center">
          {!imageLoaded && !imageError && (
            <div className="flex items-center justify-center w-full h-full bg-gray-100">
              <div className="text-gray-500">Loading image...</div>
            </div>
          )}

          {imageError && (
            <div className="flex items-center justify-center w-full h-full bg-gray-100">
              <div className="text-red-500 text-center">
                <div className="mb-2">Failed to load image</div>
                <button
                  onClick={() => window.open(currentImageUrl, '_blank')}
                  className="text-blue-500 hover:underline"
                >
                  Open in new tab instead
                </button>
              </div>
            </div>
          )}

          <img
            src={currentImageUrl}
            alt={`${altText} ${hasMultipleImages ? `(Image ${currentIndex + 1})` : ''}`}
            className={`
              max-w-full max-h-full object-contain transition-transform duration-300 ease-in-out cursor-pointer
              ${isZoomed ? 'scale-150' : 'scale-100'}
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onClick={handleImageClick}
            style={{
              cursor: isZoomed ? 'zoom-out' : 'zoom-in'
            }}
          />
        </div>

        {/* Footer with image info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="text-white text-sm opacity-90">
            {altText}
            {hasMultipleImages && ` (Image ${currentIndex + 1} of ${images.length})`}
          </div>

          {/* Navigation dots for multiple images */}
          {hasMultipleImages && (
            <div className="flex justify-center space-x-2 mt-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsZoomed(false);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                  title={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
