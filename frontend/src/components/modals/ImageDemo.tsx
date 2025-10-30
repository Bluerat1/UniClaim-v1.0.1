import React, { useState } from 'react';
import ImageModal from '@/components/common/ImageModal';

const ImageModalDemo: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const sampleImages = [
    'https://picsum.photos/800/600?random=1',
    'https://picsum.photos/600/800?random=2',
    'https://picsum.photos/1000/400?random=3',
    'https://picsum.photos/400/400?random=4',
    'https://picsum.photos/1200/800?random=5'
  ];

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
    setShowModal(true);
  };


  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Enhanced ImageModal Demo</h1>
      <p className="text-gray-600 mb-8 text-center">
        Click on any image below to test the enhanced ImageModal with multi-image navigation
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {sampleImages.map((imageUrl, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div
              className="relative cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                aspectRatio: '4/3',
              }}
            >
              <img
                src={imageUrl}
                alt={`Sample Image ${index + 1}`}
                className="w-full h-full object-cover"
                onClick={() => handleImageClick(index)}
                title={`Click to view full size - Image ${index + 1} of ${sampleImages.length}`}
              />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all rounded flex items-center justify-center pointer-events-none">
                <span className="text-white opacity-0 hover:opacity-100 text-sm font-medium bg-black/50 px-2 py-1 rounded">
                  Click to expand
                </span>
              </div>
              {/* Image counter badge */}
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                {index + 1}/{sampleImages.length}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Image {index + 1}</h3>
              <p className="text-sm text-gray-600">
                Click to view in full-screen modal with navigation
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced Image Modal */}
      {showModal && (
        <ImageModal
          imageUrl={sampleImages[selectedImageIndex]}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="mt-12 p-6 bg-blue-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-blue-800">Enhanced Features:</h2>
        <ul className="space-y-2 text-blue-700">
          <li>• Click any image to open the enhanced modal</li>
          <li>• Navigate between multiple images with arrow keys or buttons</li>
          <li>• Zoom in/out with buttons, double-click, or scroll</li>
          <li>• View image counter and navigation dots</li>
          <li>• Download individual images</li>
          <li>• Close with X button, ESC key, or click outside</li>
          <li>• Responsive design for all screen sizes</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageModalDemo;
