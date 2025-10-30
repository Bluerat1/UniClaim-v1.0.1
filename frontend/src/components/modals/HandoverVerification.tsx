import React, { useState } from 'react';

interface HandoverVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (handoverReason: string, idPhotoFile: File | null, itemPhotoFiles: File[]) => void;
  itemTitle: string;
  itemDescription?: string;
  isLoading?: boolean;
  onSuccess?: () => void; // New prop to handle successful submission
}

const HandoverVerificationModal: React.FC<HandoverVerificationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  itemTitle,
  itemDescription,
  isLoading = false,
  onSuccess
}) => {
  const [handoverReason, setHandoverReason] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [itemPhotoFiles, setItemPhotoFiles] = useState<File[]>([]);
  const [itemPhotoPreviews, setItemPhotoPreviews] = useState<string[]>([]);

  const handleIdPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setIdPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleItemPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Limit to 3 photos
    const remainingSlots = 3 - itemPhotoFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    if (filesToAdd.length === 0) return;
    
    // Add new files
    const newFiles = [...itemPhotoFiles, ...filesToAdd];
    setItemPhotoFiles(newFiles);
    
    // Generate previews for new files
    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setItemPhotoPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeIdPhoto = () => {
    setIdPhotoFile(null);
    setIdPhotoPreview(null);
    const fileInput = document.getElementById('id-photo-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const removeItemPhoto = (index: number) => {
    setItemPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setItemPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllItemPhotos = () => {
    setItemPhotoFiles([]);
    setItemPhotoPreviews([]);
    const fileInput = document.getElementById('item-photo-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // Function to clear all form entries
  const clearForm = () => {
    setHandoverReason('');
    setIsConfirmed(false);
    setIdPhotoFile(null);
    setIdPhotoPreview(null);
    setItemPhotoFiles([]);
    setItemPhotoPreviews([]);
    
    // Reset file inputs
    const idPhotoInput = document.getElementById('id-photo-input') as HTMLInputElement;
    const itemPhotoInput = document.getElementById('item-photo-input') as HTMLInputElement;
    
    if (idPhotoInput) idPhotoInput.value = '';
    if (itemPhotoInput) itemPhotoInput.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmed && idPhotoFile && itemPhotoFiles.length > 0) {
      // Clear the form immediately after submission
      clearForm();
      // Call the onSubmit function
      onSubmit(handoverReason, idPhotoFile, itemPhotoFiles);
      // Call onSuccess if provided
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  const handleClose = () => {
    clearForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={handleClose} />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Verify Handover Request
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Please provide your ID photo and a photo of the item before requesting to handover
            </p>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            {/* Item Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item to Handover
              </label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-800 font-medium">{itemTitle}</p>
                {itemDescription && (
                  <p className="text-sm text-gray-600 mt-1">{itemDescription}</p>
                )}
              </div>
            </div>

            {/* Handover Reason */}
            <div className="mb-4">
              <label htmlFor="handover-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Handover
              </label>
              <textarea
                id="handover-reason"
                value={handoverReason}
                onChange={(e) => setHandoverReason(e.target.value)}
                placeholder="Please explain why you want to handover this item..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                required
              />
            </div>

            {/* ID Photo Upload */}
            <div className="mb-4">
              <label htmlFor="id-photo-input" className="block text-sm font-medium text-gray-700 mb-2">
                ID Photo <span className="text-red-500">*</span>
              </label>
              <input
                id="id-photo-input"
                type="file"
                accept="image/*"
                onChange={handleIdPhotoChange}
                className="hidden"
                required
              />
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('id-photo-input')?.click()}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  {idPhotoFile ? 'Change ID Photo' : 'Upload ID Photo'}
                </button>
                {idPhotoPreview && (
                  <div className="relative">
                    <img
                      src={idPhotoPreview}
                      alt="ID Photo Preview"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={removeIdPhoto}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Item Photos Upload - REQUIRED */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Photos <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Please upload up to 3 photos of the item you want to handover (e.g., different angles, item details, etc.)
              </p>
              
              {itemPhotoFiles.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-green-400 transition-colors">
                  <input
                    id="item-photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleItemPhotoSelect}
                    className="hidden"
                    required
                  />
                  <label htmlFor="item-photo-input" className="cursor-pointer">
                    <div className="text-gray-600">
                      <div className="text-2xl mb-2">📸</div>
                      <div className="font-medium">Click to upload item photos</div>
                      <div className="text-sm">JPEG, PNG up to 5MB each (Max 3 photos)</div>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Photo Counter and Remove All Button */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {itemPhotoFiles.length}/3 photos selected
                    </span>
                    {itemPhotoFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={removeAllItemPhotos}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove All
                      </button>
                    )}
                  </div>
                  
                  {/* Photo Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    {itemPhotoFiles.map((photo, index) => (
                      <div key={index} className="border border-gray-300 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Item Photo {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItemPhoto(index)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        
                        {/* Photo Preview */}
                        <div className="mb-2">
                          {itemPhotoPreviews[index] && (
                            <img
                              src={itemPhotoPreviews[index]}
                              alt={`Item Photo ${index + 1}`}
                              className="w-full h-32 object-cover rounded border"
                            />
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-600">
                          <div>File: {photo.name}</div>
                          <div>Size: {(photo.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add More Photos Button (if less than 3) */}
                  {itemPhotoFiles.length < 3 && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-green-400 transition-colors">
                      <input
                        id="item-photo-input-additional"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleItemPhotoSelect}
                        className="hidden"
                      />
                      <label htmlFor="item-photo-input-additional" className="cursor-pointer">
                        <div className="text-gray-600">
                          <div className="text-sm">📸 Add more photos</div>
                          <div className="text-xs">Up to {3 - itemPhotoFiles.length} more</div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirmation Checkbox */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  required
                />
                <span className="ml-2 text-sm text-gray-700">
                  I confirm that I have this item and want to handover it to the owner
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isConfirmed || !idPhotoFile || itemPhotoFiles.length === 0 || isLoading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </div>
                ) : (
                  'Send Handover Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HandoverVerificationModal;
