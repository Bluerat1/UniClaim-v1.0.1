import React, { useState } from 'react';
import type { Post } from '@/types/Post';
import ImageModal from './ImageModal';

interface HandoverDetailsDisplayProps {
  handoverDetails: Post['handoverDetails'];
  conversationData?: Post['conversationData']; // Add conversation data prop
}

const HandoverDetailsDisplay: React.FC<HandoverDetailsDisplayProps> = ({ 
  handoverDetails, 
  conversationData 
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  if (!handoverDetails) return null;

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
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-green-800">
            ✅ Item Successfully Handed Over
          </h3>
        </div>
        
        <div className="space-y-3">
          {/* Handover Person Information */}
          <div className="bg-white p-3 rounded border">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Handed Over By:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {handoverDetails.handoverPersonName}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Contact:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {handoverDetails.handoverPersonContact}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Student ID:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {handoverDetails.handoverPersonStudentId}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {handoverDetails.handoverPersonEmail}
                </span>
              </div>
            </div>
          </div>

          {/* Handover Photos */}
          {handoverDetails.handoverItemPhotos && handoverDetails.handoverItemPhotos.length > 0 && (
            <div className="bg-white p-3 rounded border">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                Item Photos During Handover:
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {handoverDetails.handoverItemPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo.url}
                      alt={`Handover item photo ${index + 1}`}
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
                <p className="text-xs text-gray-500 mb-1">Handover Person ID:</p>
                <img
                  src={handoverDetails.handoverIdPhoto}
                  alt="Handover person ID"
                  className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => openImageModal(handoverDetails.handoverIdPhoto)}
                />
              </div>
              {handoverDetails.ownerIdPhoto && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Owner ID:</p>
                  <img
                    src={handoverDetails.ownerIdPhoto}
                    alt="Owner ID"
                    className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => openImageModal(handoverDetails.ownerIdPhoto)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Details */}
          <div className="bg-white p-3 rounded border">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Handover Confirmation:
            </h4>
            <div className="text-xs text-gray-600">
              <p>Confirmed on: {formatDateTime(handoverDetails.handoverConfirmedAt)}</p>
              {handoverDetails.ownerName ? (
                <p>Confirmed by: {handoverDetails.ownerName}</p>
              ) : (
                <p>Confirmed by: {handoverDetails.handoverConfirmedBy}</p>
              )}
            </div>
          </div>

          {/* Handover Request Chat Bubble Details - Show the preserved chat bubble information */}
          {handoverDetails.handoverRequestDetails && (
            <div className="bg-white p-3 rounded border">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                💬 Original Handover Request Details:
              </h4>
              <div className="space-y-2 text-xs text-gray-600">
                {/* Original Message Information */}
                <div className="bg-gray-50 p-2 rounded">
                  <p className="font-medium text-gray-700 mb-1">Original Message:</p>
                  <p className="text-gray-600">{handoverDetails.handoverRequestDetails.messageText}</p>
                  <p className="text-gray-500 mt-1">
                    Sent on: {formatDateTime(handoverDetails.handoverRequestDetails.messageTimestamp)}
                  </p>
                </div>

                {/* Handover Reason */}
                {handoverDetails.handoverRequestDetails.handoverReason && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="font-medium text-gray-700 mb-1">Handover Reason:</p>
                    <p className="text-gray-600">{handoverDetails.handoverRequestDetails.handoverReason}</p>
                  </div>
                )}

                {/* Handover Timeline - HIDDEN PER USER REQUEST */}
                {/* <div className="bg-gray-50 p-2 rounded">
                  <p className="font-medium text-gray-700 mb-1">Handover Timeline:</p>
                  <div className="space-y-1">
                    <p className="text-gray-600">
                      Requested: {formatDateTime(handoverDetails.handoverRequestDetails.handoverRequestedAt)}
                    </p>
                    {handoverDetails.handoverRequestDetails.handoverRespondedAt && (
                      <p className="text-gray-600">
                        Responded: {formatDateTime(handoverDetails.handoverRequestDetails.handoverRespondedAt)}
                      </p>
                    )}
                    {handoverDetails.handoverRequestDetails.handoverResponseMessage && (
                      <p className="text-gray-600">
                        Response: "{handoverDetails.handoverRequestDetails.handoverResponseMessage}"
                      </p>
                    )}
                  </div>
                </div> */}

                {/* ID Photo Verification Status - HIDDEN PER USER REQUEST */}
                {/* <div className="bg-gray-50 p-2 rounded">
                  <p className="font-medium text-gray-700 mb-1">ID Photo Verification:</p>
                  <div className="space-y-1">
                    <p className="text-gray-600">
                      Status: {handoverDetails.handoverRequestDetails.idPhotoConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                    </p>
                    {handoverDetails.handoverRequestDetails.idPhotoConfirmed && (
                      <>
                        <p className="text-gray-600">
                          Confirmed on: {formatDateTime(handoverDetails.handoverRequestDetails.idPhotoConfirmedAt)}
                        </p>
                        <p className="text-gray-600">
                          Confirmed by: {handoverDetails.handoverRequestDetails.idPhotoConfirmedBy}
                        </p>
                      </>
                    )}
                  </div>
                </div> */}

                {/* Item Photos Verification Status - HIDDEN PER USER REQUEST */}
                {/* handoverDetails.handoverRequestDetails.itemPhotos && handoverDetails.handoverRequestDetails.itemPhotos.length > 0 && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="font-medium text-gray-700 mb-1">Item Photos Verification:</p>
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        Photos uploaded: {handoverDetails.handoverRequestDetails.itemPhotos.length}
                      </p>
                      <p className="text-gray-600">
                        Status: {handoverDetails.handoverRequestDetails.itemPhotosConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                      </p>
                      {handoverDetails.handoverRequestDetails.itemPhotosConfirmed && (
                        <>
                          <p className="text-gray-600">
                            Confirmed on: {formatDateTime(handoverDetails.handoverRequestDetails.itemPhotosConfirmedAt)}
                          </p>
                          <p className="text-gray-600">
                            Confirmed by: {handoverDetails.handoverRequestDetails.itemPhotosConfirmedBy}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) */}

                {/* Owner Verification Status - HIDDEN PER USER REQUEST */}
                {/* handoverDetails.handoverRequestDetails.ownerIdPhoto && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="font-medium text-gray-700 mb-1">Owner ID Photo Verification:</p>
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        Status: {handoverDetails.handoverRequestDetails.ownerIdPhotoConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                      </p>
                      {handoverDetails.handoverRequestDetails.ownerIdPhotoConfirmed && (
                        <>
                          <p className="text-gray-600">
                            Confirmed on: {formatDateTime(handoverDetails.handoverRequestDetails.ownerIdPhotoConfirmedAt)}
                          </p>
                          <p className="text-gray-600">
                            Confirmed by: {handoverDetails.handoverRequestDetails.ownerIdPhotoConfirmedBy}
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
          images={[selectedImage]}
          initialIndex={0}
          altText="Handover Photo"
          onClose={closeImageModal}
        />
      )}
    </>
  );
};

export default HandoverDetailsDisplay;
