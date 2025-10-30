import React, { useState, useRef } from 'react';

interface ImagePickerProps {
  onImageSelect: (file: File) => void;
  onClose: () => void;
  isUploading?: boolean;
}

const ImagePicker: React.FC<ImagePickerProps> = ({ onImageSelect, onClose, isUploading = false }) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB. Please choose a smaller image.');
        return;
      }
      setSelectedImage(file);
    } else {
      alert('Please select a valid image file (JPEG, PNG, etc.)');
    }
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB. Please choose a smaller image.');
        return;
      }
      setSelectedImage(file);
    } else {
      alert('Please select a valid image file (JPEG, PNG, etc.)');
    }
  };

  const handleUpload = () => {
    if (selectedImage) {
      onImageSelect(selectedImage);
    }
  };

  const openGallery = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg m-4 max-w-sm w-full">
        <h3 className="text-lg font-bold mb-3 text-center">Upload ID Photo</h3>
        <p className="text-sm text-gray-600 mb-4 text-center">
          Please provide a photo of your ID as proof that you received the item.
        </p>
        
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
          className="hidden"
        />
        
        {/* Action buttons */}
        <div className="space-y-3 mb-4">
          <button
            onClick={openCamera}
            className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
            disabled={isUploading}
          >
            📷 Take New Photo
          </button>
          
          <button
            onClick={openGallery}
            className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-colors"
            disabled={isUploading}
          >
            🖼️ Choose from Gallery
          </button>
        </div>
        
        {/* Selected image preview */}
        {selectedImage && (
          <div className="mb-4 p-3 bg-gray-50 rounded border">
            <div className="text-sm font-medium text-gray-700 mb-2">Selected Photo:</div>
            <div className="text-sm text-gray-600">{selectedImage.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              Size: {(selectedImage.size / 1024).toFixed(1)} KB
            </div>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={!selectedImage || isUploading}
            className="flex-1 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Upload Photo'}
          </button>
          
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-700 p-3 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImagePicker;
