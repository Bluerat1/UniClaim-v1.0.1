import React, { useState } from 'react';
import type { Post } from '@/types/Post';
import ImageModal from './ImageModal';

interface ClaimDetailsDisplayProps {
  claimDetails: Post['claimDetails'];
  conversationData?: Post['conversationData'];
}

const ClaimDetailsDisplay: React.FC<ClaimDetailsDisplayProps> = ({ 
  claimDetails, 
  conversationData 
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  if (!claimDetails) return null;

  const formatDateTime = (datetime: any) => {
    if (!datetime) return 'N/A';
    
    try {
      const date = typeof datetime === 'string' ? new Date(datetime) : datetime;
      
      // Handle Firebase Timestamp
      if (datetime && typeof datetime === 'object' && 'seconds' in datetime) {
        const firebaseDate = new Date(datetime.seconds * 1000);
        return firebaseDate.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
      
      return date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  return (
    <>
      <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-purple-800">
            ✅ Item Successfully Claimed
          </h3>
        </div>
        
        <div className="space-y-3">
          {/* Claimer Information */}
          <div className="bg-white p-3 rounded border">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Claimed By:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {claimDetails.claimerName}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Contact:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {claimDetails.claimerContact}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Student ID:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {claimDetails.claimerStudentId}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {claimDetails.claimerEmail}
                </span>
              </div>
            </div>
          </div>

          {/* Evidence Photos */}
          {claimDetails.evidencePhotos && claimDetails.evidencePhotos.length > 0 && (
            <div className="bg-white p-3 rounded border">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                Evidence Photos for Ownership Proof:
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {claimDetails.evidencePhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo.url}
                      alt={`Evidence photo ${index + 1}`}
                      className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => openImageModal(photo.url)}
                    />
                    {photo.description && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b">
                        {photo.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ID Photos */}
          <div className="bg-white p-3 rounded border">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Verification Photos:
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Claimer ID:</p>
                <img
                  src={claimDetails.claimerIdPhoto}
                  alt="Claimer ID"
                  className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => openImageModal(claimDetails.claimerIdPhoto)}
                />
              </div>
              {claimDetails.ownerIdPhoto && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Owner ID:</p>
                  <img
                    src={claimDetails.ownerIdPhoto}
                    alt="Owner ID"
                    className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => openImageModal(claimDetails.ownerIdPhoto)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Details */}
          <div className="bg-white p-3 rounded border">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Claim Confirmation:
            </h4>
            <div className="text-xs text-gray-600">
              <p>Confirmed on: {formatDateTime(claimDetails.claimConfirmedAt)}</p>
              {claimDetails.ownerName ? (
                <p>Confirmed by: {claimDetails.ownerName}</p>
              ) : (
                <p>Confirmed by: {claimDetails.claimConfirmedBy}</p>
              )}
            </div>
          </div>

          {/* Claim Request Chat Bubble Details - Show the preserved chat bubble information */}
          {claimDetails.claimRequestDetails && (
            <div className="bg-white p-3 rounded border">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                💬 Original Claim Request Details:
              </h4>
              <div className="space-y-2 text-xs text-gray-600">
                {/* Original Message Information */}
                <div className="bg-gray-50 p-2 rounded">
                  <p className="font-medium text-gray-700 mb-1">Original Message:</p>
                  <p className="text-gray-600">{claimDetails.claimRequestDetails.messageText}</p>
                  <p className="text-gray-500 mt-1">
                    Sent on: {formatDateTime(claimDetails.claimRequestDetails.messageTimestamp)}
                  </p>
                </div>

                {/* Claim Timeline - HIDDEN PER USER REQUEST */}
                {/* <div className="bg-gray-50 p-2 rounded">
                  <p className="font-medium text-gray-700 mb-1">Claim Timeline:</p>
                  <div className="space-y-1">
                    <p className="text-gray-600">
                      Requested: {formatDateTime(claimDetails.claimRequestDetails.claimRequestedAt)}
                    </p>
                    {claimDetails.claimRequestDetails.claimRespondedAt && (
                      <p className="text-gray-600">
                        Responded: {formatDateTime(claimDetails.claimRequestDetails.claimRespondedAt)}
                      </p>
                    )}
                    {claimDetails.claimRequestDetails.claimResponseMessage && (
                      <p className="text-gray-600">
                        Response: "{claimDetails.claimRequestDetails.claimResponseMessage}"
                      </p>
                    )}
                  </div>
                </div> */}

                {/* Claimer ID Photo Verification Status - HIDDEN PER USER REQUEST */}
                {/* <div className="bg-gray-50 p-2 rounded">
                  <p className="font-medium text-gray-700 mb-1">Claimer ID Photo Verification:</p>
                  <div className="space-y-1">
                    <p className="text-gray-600">
                      Status: {claimDetails.claimRequestDetails.idPhotoConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                    </p>
                    {claimDetails.claimRequestDetails.idPhotoConfirmed && (
                      <>
                        <p className="text-gray-600">
                          Confirmed on: {formatDateTime(claimDetails.claimRequestDetails.idPhotoConfirmedAt)}
                        </p>
                        <p className="text-gray-600">
                          Confirmed by: {claimDetails.claimRequestDetails.idPhotoConfirmedBy}
                        </p>
                      </>
                    )}
                  </div>
                </div> */}

                {/* Evidence Photos Verification Status - HIDDEN PER USER REQUEST */}
                {/* claimDetails.claimRequestDetails.evidencePhotos && claimDetails.claimRequestDetails.evidencePhotos.length > 0 && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="font-medium text-gray-700 mb-1">Evidence Photos Verification:</p>
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        Photos uploaded: {claimDetails.claimRequestDetails.evidencePhotos.length}
                      </p>
                      <p className="text-gray-600">
                        Status: {claimDetails.claimRequestDetails.evidencePhotosConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                      </p>
                      {claimDetails.claimRequestDetails.evidencePhotosConfirmed && (
                        <>
                          <p className="text-gray-600">
                            Confirmed on: {formatDateTime(claimDetails.claimRequestDetails.evidencePhotosConfirmedAt)}
                          </p>
                          <p className="text-gray-600">
                            Confirmed by: {claimDetails.claimRequestDetails.evidencePhotosConfirmedBy}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) */}

                {/* Owner Verification Status - HIDDEN PER USER REQUEST */}
                {/* claimDetails.claimRequestDetails.ownerIdPhoto && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="font-medium text-gray-700 mb-1">Owner ID Photo Verification:</p>
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        Status: {claimDetails.claimRequestDetails.ownerIdPhotoConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                      </p>
                      {claimDetails.claimRequestDetails.ownerIdPhotoConfirmed && (
                        <>
                          <p className="text-gray-600">
                            Confirmed on: {formatDateTime(claimDetails.claimRequestDetails.ownerIdPhotoConfirmedAt)}
                          </p>
                          <p className="text-gray-600">
                            Confirmed by: {claimDetails.claimRequestDetails.ownerIdPhotoConfirmedBy}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) */}
              </div>
            </div>
          )}

          {/* Conversation Data - Show if available */}
          {conversationData && (
            <div className="bg-white p-3 rounded border">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                💬 Conversation Summary:
              </h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Total messages: {conversationData.messages?.length || 0}</p>
                <p>Conversation started: {formatDateTime(conversationData.createdAt)}</p>
                {conversationData.lastMessage && (
                  <p>Last message: {conversationData.lastMessage.text}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          altText="Claim Photo"
          onClose={closeImageModal}
        />
      )}
    </>
  );
};

export default ClaimDetailsDisplay;
