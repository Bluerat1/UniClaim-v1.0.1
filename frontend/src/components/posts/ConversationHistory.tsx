import { useEffect, useState, useCallback } from 'react';
import { messageService } from '@/services/firebase/messages';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/services/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

interface HandoverData {
  status?: 'pending' | 'accepted' | 'rejected' | 'pending_confirmation';
  handoverReason?: string;
  idPhotoUrl?: string;
  // Add other handover data properties as needed
}

interface Message {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  senderProfilePicture?: string;
  timestamp: any;
  messageType: string;
  images?: string[];
  handoverData?: HandoverData;
}

interface ConversationHistoryProps {
  postId: string;
}

export default function ConversationHistory({ postId }: ConversationHistoryProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userData } = useAuth();
  const [profilePictures, setProfilePictures] = useState<Record<string, string>>({});

  // Function to fetch user profile picture
  const fetchUserProfile = useCallback(async (userId: string) => {
    if (!userId || profilePictures[userId]) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.profilePicture) {
          setProfilePictures(prev => ({
            ...prev,
            [userId]: userData.profilePicture
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }, [profilePictures]);

  // Update profile pictures when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const uniqueUserIds = Array.from(new Set(messages.map(msg => msg.senderId)));
      uniqueUserIds.forEach(userId => fetchUserProfile(userId));
    }
  }, [messages, fetchUserProfile]);

  useEffect(() => {
    const fetchConversationHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching conversation history for post:', postId);
        // First, try to get the post to check for archived conversation data
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        
        if (postDoc.exists()) {
          const postData = postDoc.data();
          
          // Check if we have archived conversation data in the post
          if (postData.conversationData) {
            console.log('📦 Found archived conversation data in post', postData.conversationData);
            const formattedMessages = postData.conversationData.messages
              .filter((msg: any) => 
                msg.messageType === 'text' || 
                msg.messageType === 'image' ||
                msg.messageType === 'handover_request' ||
                msg.messageType === 'claim_request' ||
                msg.handoverData // Include messages with handoverData
              )
              .map((msg: any) => ({
                id: msg.id,
                text: msg.text,
                senderId: msg.senderId,
                senderName: msg.senderName,
                senderProfilePicture: msg.senderProfilePicture,
                timestamp: msg.timestamp,
                messageType: msg.messageType,
                images: msg.images || (msg.imageUrl ? [msg.imageUrl] : []),
                handoverData: msg.handoverData
              }));
              
            setMessages(formattedMessages);
            setLoading(false);
            return;
          }
        }
        
        // If no archived data, try to fetch from active conversations
        const conversations = await new Promise<any[]>((resolve) => {
          const unsubscribe = messageService.getUserConversations(
            userData?.uid || '',
            (convs) => {
              resolve(convs);
            },
            (error) => {
              console.error('Error fetching conversations:', error);
              resolve([]); // Resolve with empty array on error
            }
          );
          
          // Clean up the listener after a short delay
          setTimeout(() => {
            if (typeof unsubscribe === 'function') {
              unsubscribe();
            }
          }, 1000);
        });
        
        const postConversations = conversations.filter((conv: any) => conv.postId === postId);

        if (postConversations.length === 0) {
          console.log('ℹ️ No active conversations found for post:', postId);
          setMessages([]);
          setLoading(false);
          return;
        }

        // Get messages from all conversations
        const allMessages: Message[] = [];
        
        for (const conv of postConversations) {
          try {
            // Use getConversationMessages to fetch messages for this conversation
            const convMessages: any[] = [];
            // Get messages for this conversation
            const unsubscribe = messageService.getConversationMessages(
              conv.id,
              userData?.uid || '',
              (msgs: any[]) => {
                convMessages.length = 0; // Clear the array
                convMessages.push(...msgs);
              },
              (error: any) => {
                console.error('Error fetching messages:', error);
              }
            );
            
            // Wait a short time for the initial data to load
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Clean up the listener
            if (typeof unsubscribe === 'function') {
              unsubscribe();
            }
            
            const formattedMessages = convMessages
              .filter((msg: any) => 
                msg.messageType === 'text' || 
                msg.messageType === 'image' ||
                msg.messageType === 'handover_request' ||
                msg.messageType === 'claim_request'
              )
              .map((msg: any) => ({
                id: msg.id,
                text: msg.text,
                senderId: msg.senderId,
                senderName: msg.senderName,
                senderProfilePicture: msg.senderProfilePicture,
                timestamp: msg.timestamp,
                messageType: msg.messageType,
                images: msg.images || (msg.imageUrl ? [msg.imageUrl] : []),
                handoverData: msg.handoverData
              }));
            
            allMessages.push(...formattedMessages);
          } catch (err) {
            console.error(`Error fetching messages for conversation ${conv.id}:`, err);
          }
        }

        // Sort messages by timestamp
        allMessages.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime();
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime();
          return timeA - timeB;
        });

        setMessages(allMessages);
      } catch (err) {
        console.error('Error fetching conversation history:', err);
        setError('Failed to load conversation history');
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchConversationHistory();
    }
  }, [postId, userData?.uid]);

  const formatMessageTime = (timestamp: any) => {
    try {
      const date = timestamp?.seconds 
        ? new Date(timestamp.seconds * 1000) 
        : new Date(timestamp);
      
      if (isNaN(date.getTime())) return '';
      
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting message time:', error);
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-center">
        No conversation history available.
      </div>
    );
  }

  return (
    <div className="mt-4">
      <ScrollArea className="h-64 pr-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.senderId === userData?.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`flex max-w-[80%] ${message.senderId === userData?.uid ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}
              >
                <div className="flex flex-col">
                  {message.senderId !== userData?.uid && (
                    <div className="flex items-center gap-2 mb-1">
                      {profilePictures[message.senderId] ? (
                        <img 
                          src={profilePictures[message.senderId]} 
                          alt={message.senderName || 'User'}
                          className="h-6 w-6 rounded-full object-cover"
                          onError={(e) => {
                            // Fallback to initials if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = document.createElement('div');
                            fallback.className = 'h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs';
                            fallback.textContent = (message.senderName || 'U').charAt(0).toUpperCase();
                            target.parentNode?.insertBefore(fallback, target.nextSibling);
                          }}
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                          {(message.senderName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium">{message.senderName || 'User'}</span>
                    </div>
                  )}
                  <div 
                    className={`rounded-lg px-4 py-2 ${message.senderId === userData?.uid ? 'bg-blue-100' : 'bg-gray-100'}`}
                  >
                  {message.messageType === 'handover_request' || message.handoverData ? (
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">
                        {message.handoverData?.status === 'accepted' 
                          ? '✅ Handover Completed' 
                          : message.handoverData?.status === 'rejected'
                            ? '❌ Handover Rejected'
                            : message.handoverData?.status === 'pending_confirmation'
                              ? '⏳ Handover Pending Confirmation'
                              : 'Handover Request'}
                      </p>
                      {message.handoverData?.handoverReason && (
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Reason:</span> {message.handoverData.handoverReason}
                        </p>
                      )}
                      {message.text && (
                        <p className="text-xs text-gray-500 mt-1">
                          {message.text}
                        </p>
                      )}
                      {message.handoverData?.idPhotoUrl && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">ID Photo:</p>
                          <img 
                            src={message.handoverData.idPhotoUrl} 
                            alt="ID verification" 
                            className="h-20 w-auto rounded border border-gray-200"
                          />
                        </div>
                      )}
                    </div>
                  ) : message.messageType === 'claim_request' ? (
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">Claim Request</p>
                      <p className="text-xs text-gray-500">
                        {message.text || 'No additional message'}
                      </p>
                    </div>
                  ) : message.messageType === 'image' && message.images?.[0] ? (
                    <div className="mt-1">
                      <img 
                        src={message.images[0]} 
                        alt="Shared content" 
                        className="max-w-full h-auto rounded-md max-h-40"
                      />
                    </div>
                  ) : (
                    <p className="text-sm">{message.text}</p>
                  )}
                  <p className={`text-xs mt-1 ${message.senderId === userData?.uid ? 'text-blue-600' : 'text-gray-500'}`}>
                    {formatMessageTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
