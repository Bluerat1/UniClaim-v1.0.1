export interface Post {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  type: "lost" | "found";
  coordinates?: { lat: number; lng: number };
  images: (string | File)[];
  creatorId: string; // Add this field to identify the post creator
  postedById?: string; // User ID of the poster for messaging (for backward compatibility)
  user: {
    firstName: string;
    lastName: string;
    email: string;
    contactNum: string;
    studentId: string;
    profilePicture?: string | null;
    profileImageUrl?: string;
    role?: 'user' | 'admin' | 'campus_security';
  };
  createdAt?: string | Date | any; // Firebase timestamp or Date
  updatedAt?: string | Date | any; // Firebase timestamp or Date
  status?: "pending" | "resolved" | "unclaimed" | "completed";
  foundAction?: "keep" | "turnover to OSA" | "turnover to Campus Security"; // For found items
  dateTime?: string; // When the item was lost/found
  // New fields for 30-day lifecycle system
  expiryDate?: string | Date | any; // When the post expires (30 days from creation)
  isExpired?: boolean; // Boolean flag for quick filtering
  movedToUnclaimed?: boolean; // Boolean flag to track if moved to unclaimed
  originalStatus?: "pending" | "resolved" | "unclaimed" | "completed"; // Store the original status before moving to unclaimed

  // Flagging system fields
  isFlagged?: boolean; // Whether the post has been flagged by a user
  flagReason?: string; // Reason for flagging (inappropriate content, spam, etc.)
  flaggedBy?: string; // User ID who flagged the post
  flaggedAt?: string | Date | any; // When the post was flagged
  isHidden?: boolean; // Whether admin chose to hide the post from public view

  // Soft delete fields
  deletedAt?: string | Date | null; // When the post was soft deleted (null means not deleted)
  deletedBy?: string; // User ID who performed the deletion
  originalId?: string; // Original post ID (for restored posts)
  isDeleted?: boolean; // Flag to identify deleted posts in the UI
  // Add index signature for dynamic properties
  [key: string]: any;

  // New fields for handover details (when ID photo is confirmed)
  handoverDetails?: {
    handoverPersonName: string; // Full name of person who handed over
    handoverPersonContact: string; // Contact number of person who handed over
    handoverPersonStudentId: string; // Student ID of person who handed over
    handoverPersonEmail: string; // Email of person who handed over
    handoverItemPhotos: {
      url: string;
      uploadedAt: any;
      description?: string;
    }[]; // Photos of the item during handover
    handoverIdPhoto: string; // ID photo of person who handed over
    ownerIdPhoto: string; // ID photo of the item owner
    handoverConfirmedAt: any; // When the handover was confirmed
    handoverConfirmedBy: string; // User ID who confirmed the handover
    ownerName?: string; // Name of the person who confirmed the handover

    // New field: Complete handover request chat bubble details
    handoverRequestDetails?: {
      // Original message details
      messageId: string;
      messageText: string;
      messageTimestamp: any;
      senderId: string;
      senderName: string;
      senderProfilePicture?: string;

      // Handover data from the message
      handoverReason?: string;
      handoverRequestedAt: any;
      handoverRespondedAt?: any;
      handoverResponseMessage?: string;

      // ID photo verification details
      idPhotoUrl?: string;
      idPhotoConfirmed: boolean;
      idPhotoConfirmedAt: any;
      idPhotoConfirmedBy: string;

      // Item photos
      itemPhotos: {
        url: string;
        uploadedAt: any;
        description?: string;
      }[];
      itemPhotosConfirmed?: boolean;
      itemPhotosConfirmedAt?: any;
      itemPhotosConfirmedBy?: string;

      // Owner verification details
      ownerIdPhoto?: string;
      ownerIdPhotoConfirmed?: boolean;
      ownerIdPhotoConfirmedAt?: any;
      ownerIdPhotoConfirmedBy?: string;
    };
  };

  // New field for conversation data when post is resolved
  conversationData?: {
    conversationId: string;
    messages: any[]; // Array of conversation messages
    participants: any; // Conversation participants
    createdAt: any; // When the conversation was created
    lastMessage: any; // Last message in the conversation
  };

  // New fields for claim details (when claim is confirmed)
  claimDetails?: {
    claimerName: string; // Full name of person who claimed
    claimerContact: string; // Contact number of person who claimed
    claimerStudentId: string; // Student ID of person who claimed
    claimerEmail: string; // Email of person who claimed
    evidencePhotos: {
      url: string;
      uploadedAt: any;
      description?: string;
    }[]; // Evidence photos for ownership proof
    claimerIdPhoto: string; // ID photo of person who claimed
    ownerIdPhoto: string; // ID photo of the item owner
    claimConfirmedAt: any; // When the claim was confirmed
    claimConfirmedBy: string; // User ID who confirmed the claim
    ownerName?: string; // Name of the person who confirmed the claim

    // New field: Complete claim request chat bubble details
    claimRequestDetails?: {
      // Original message details
      messageId: string;
      messageText: string;
      messageTimestamp: any;
      senderId: string;
      senderName: string;
      senderProfilePicture?: string;

      // Claim data from the message
      claimReason?: string;
      claimRequestedAt: any;
      claimRespondedAt?: any;
      claimResponseMessage?: string;
      claimConfirmedAt?: any;
      claimConfirmedBy?: string;

      // ID photo verification details
      idPhotoUrl?: string;
      idPhotoConfirmed: boolean;
      idPhotoConfirmedAt: any;
      idPhotoConfirmedBy: string;

      // Evidence photos
      evidencePhotos: {
        url: string;
        uploadedAt: any;
        description?: string;
      }[];
      evidencePhotosConfirmed?: boolean;
      evidencePhotosConfirmedAt?: any;
      evidencePhotosConfirmedBy?: string;

      // Owner verification details
      ownerIdPhoto?: string;
      ownerIdPhotoConfirmed?: boolean;
      ownerIdPhotoConfirmedAt?: any;
      ownerIdPhotoConfirmedBy?: string;
    };
  };

  // New field for turnover details (when item is turned over to OSA or Campus Security)
  turnoverDetails?: {
    originalFinder: {
      uid: string;                    // Original finder's user ID
      firstName: string;              // Original finder's first name
      lastName: string;               // Original finder's last name
      email: string;                  // Original finder's email
      contactNum: string;             // Original finder's contact number
      studentId: string;              // Original finder's student ID
      profilePicture?: string | null; // Original finder's profile picture
    };
    turnoverAction: "turnover to OSA" | "turnover to Campus Security";
    turnoverDecisionAt: any;          // When the turnover decision was made (Firebase timestamp)
    turnoverReason?: string;          // Optional reason for turnover

    // New fields for turnover confirmation system
    turnoverStatus: "declared" | "confirmed" | "not_received" | "transferred"; // Status of the turnover process
    confirmedBy?: string;             // OSA admin user ID who confirmed receipt
    confirmedAt?: any;                // When OSA confirmed receipt (Firebase timestamp)
    confirmationNotes?: string;       // Optional notes from OSA about the item condition
  };
}

// Message Types
export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderProfilePicture?: string;
  text: string;
  timestamp: any; // Firebase timestamp
  readBy: string[];
  // New fields for message types
  messageType?: "text" | "handover_request" | "handover_response" | "claim_request" | "claim_response" | "system";
  // Fields for handover requests
  handoverData?: {
    postId: string;
    postTitle: string;
    status: "pending" | "accepted" | "rejected" | "pending_confirmation";
    requestedAt: any;
    respondedAt?: any;
    responseMessage?: string;
    handoverReason?: string; // Reason for handover request
    // New fields for ID photo verification
    idPhotoUrl?: string; // URL of the uploaded ID photo
    idPhotoConfirmed?: boolean; // Whether the item owner confirmed the ID photo
    idPhotoConfirmedAt?: any; // When the ID photo was confirmed
    idPhotoConfirmedBy?: string; // User ID who confirmed the ID photo
    // Item photos for handover verification (REQUIRED - up to 3)
    itemPhotos?: {
      url: string;
      uploadedAt: any;
      description?: string;
    }[];
    itemPhotosConfirmed?: boolean; // Whether the item owner confirmed the item photos
    itemPhotosConfirmedAt?: any; // When the item photos were confirmed
    itemPhotosConfirmedBy?: string; // User ID who confirmed the item photos
    // New field for owner ID photo during handover verification
    ownerIdPhoto?: string; // ID photo of the item owner for verification
    // Photo deletion tracking
    photosDeleted?: boolean; // Whether photos were deleted after rejection
    photosDeletedAt?: any; // When photos were deleted
  };
  // Fields for claim requests
  claimData?: {
    postId: string;
    postTitle: string;
    status: "pending" | "accepted" | "rejected" | "pending_confirmation";
    requestedAt: any;
    respondedAt?: any;
    responseMessage?: string;
    claimReason?: string; // New field for claim reason
    // ID photo for identity verification (REQUIRED)
    idPhotoUrl?: string; // URL of the uploaded ID photo
    idPhotoConfirmed?: boolean; // Whether the item owner confirmed the ID photo
    idPhotoConfirmedAt?: any; // When the ID photo was confirmed
    idPhotoConfirmedBy?: string; // User ID who confirmed the ID photo
    // New field for owner ID photo during claim verification
    ownerIdPhoto?: string; // ID photo of the item owner for verification
    // Evidence photos for ownership proof (REQUIRED - up to 3)
    evidencePhotos?: {
      url: string;
      uploadedAt: any;
      description?: string;
    }[];
    evidencePhotosConfirmed?: boolean; // Whether the item owner confirmed the evidence photos
    evidencePhotosConfirmedAt?: any; // When the evidence photos were confirmed
    evidencePhotosConfirmedBy?: string; // User ID who confirmed the evidence photos
    // Legacy field for backward compatibility
    verificationPhotos?: {
      url: string;
      uploadedAt: any;
      description?: string;
    }[];
    photosConfirmed?: boolean; // Whether the item owner confirmed the verification photos
    photosConfirmedAt?: any; // When the photos were confirmed
    photosConfirmedBy?: string; // User ID who confirmed the verification photos
    // Photo deletion tracking
    photosDeleted?: boolean; // Whether photos were deleted after rejection
    photosDeletedAt?: any; // When photos were deleted
  };
}

export interface Conversation {
  id: string;
  postId: string;
  postTitle: string;
  // New fields for handover button functionality
  postType: "lost" | "found";
  postStatus?: "pending" | "resolved" | "unclaimed" | "completed";
  postCreatorId: string;
  foundAction?: "keep" | "turnover to OSA" | "turnover to Campus Security"; // For found items
  participants: {
    [userId: string]: {
      uid: string;
      firstName: string;
      lastName: string;
      profilePicture?: string;
      profileImageUrl?: string;
      joinedAt: any;
      role?: 'user' | 'admin' | 'campus_security';
    };
  };
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: any;
    readBy?: string[];
  };
  createdAt: any;
  // Replace global unreadCount with user-specific counts
  unreadCounts: {
    [userId: string]: number;
  };
  // New field for handover request limit
  handoverRequested?: boolean;
  // New field for claim request limit
  hasClaimRequest?: boolean;
  // Indicates if the post was created by an admin
  isAdminPost?: boolean;
}
