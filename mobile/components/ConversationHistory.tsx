import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { messageService } from '../utils/firebase/messages';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
// Using require for local image to avoid TypeScript module resolution issues
const emptyProfile = require('../assets/images/empty_profile.jpg');
import { userService } from '../utils/firebase/auth';

interface Message {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  senderProfilePicture?: string | null;
  timestamp: any;
  messageType: string;
  images?: string[];
}

interface ConversationHistoryProps {
  postId: string;
  isAdmin?: boolean;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({ postId, isAdmin = false }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userData } = useAuth();
  const profileCacheRef = useRef<Record<string, string | null>>({});

  const enrichMessagesWithProfilePictures = async (
    messageList: Message[]
  ): Promise<Message[]> => {
    if (messageList.length === 0) {
      return messageList;
    }

    const uniqueSenderIds = Array.from(
      new Set(
        messageList
          .map((msg) => msg.senderId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const cache = profileCacheRef.current;
    const idsToFetch = uniqueSenderIds.filter((id) => !(id in cache));

    if (idsToFetch.length > 0) {
      await Promise.all(
        idsToFetch.map(async (id) => {
          try {
            const user = await userService.getUserData(id);
            cache[id] =
              user?.profilePicture ||
              user?.profileImageUrl ||
              (user as any)?.photoURL || // Using type assertion as a fallback
              null;
          } catch (err) {
            cache[id] = null;
          }
        })
      );
    }

    return messageList.map((msg) => {
      const resolved = cache[msg.senderId];
      if (resolved !== undefined) {
        return {
          ...msg,
          senderProfilePicture: resolved,
        };
      }
      return {
        ...msg,
        senderProfilePicture: msg.senderProfilePicture ?? null,
      };
    });
  };

  useEffect(() => {
    const fetchConversationHistory = async () => {
      try {
        setLoading(true);
        
        // First, try to get the post to check for archived conversation data
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../utils/firebase/config');
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        
        if (postDoc.exists()) {
          const postData = postDoc.data();
          
          // Check if we have archived conversation data in the post
          if (postData.conversationData) {
            console.log('📦 Found archived conversation data in post');
            const formattedMessages = postData.conversationData.messages
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
                images: msg.images || (msg.imageUrl ? [msg.imageUrl] : [])
              }));
              
            const enrichedMessages = await enrichMessagesWithProfilePictures(formattedMessages);
            setMessages(enrichedMessages);
            return;
          }
        }
        
        // If no archived data, try to fetch from active conversations
        const conversations = await messageService.getCurrentConversations(userData?.uid || '');
        const postConversations = conversations.filter(conv => conv.postId === postId);

        if (postConversations.length === 0) {
          console.log('ℹ️ No active conversations found for post:', postId);
          setMessages([]);
          return;
        }

        // Get messages from all conversations
        const allMessages: Message[] = [];
        
        for (const conv of postConversations) {
          try {
            // Use getConversationMessages to fetch messages for this conversation
            const convMessages: any[] = [];
            const unsubscribe = messageService.getConversationMessages(conv.id, (messages) => {
              // This callback will be called with the messages
              convMessages.length = 0; // Clear the array
              convMessages.push(...messages);
            });
            
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
                images: msg.images || (msg.imageUrl ? [msg.imageUrl] : [])
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

        const enrichedMessages = await enrichMessagesWithProfilePictures(allMessages);
        setMessages(enrichedMessages);
      } catch (err) {
        console.error('Error fetching conversation history:', err);
        setError('Failed to load conversation history');
      } finally {
        setLoading(false);
      }
    };

    fetchConversationHistory();
  }, [postId, userData?.uid]);

  if (loading) {
    return (
      <View className="flex-row items-center justify-center p-5">
        <ActivityIndicator size="small" color="#4B5563" />
        <Text className="ml-2.5 text-gray-600 font-manrope-medium">Loading conversation history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-row items-center justify-center p-5 bg-red-50 rounded-lg mx-4 my-3">
        <MaterialIcons name="error-outline" size={24} color="#EF4444" />
        <Text className="ml-2 text-red-600 font-manrope-medium">{error}</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View className="items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 my-3">
        <MaterialIcons name="chat-bubble-outline" size={32} color="#9CA3AF" />
        <Text className="mt-2 text-gray-500 text-center font-manrope-medium">No conversation history available</Text>
      </View>
    );
  }

  const formatMessageTime = (timestamp: any) => {
    try {
      const date = timestamp?.seconds 
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);
      
      if (isNaN(date.getTime())) return '';
      
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (err) {
      console.error('Error formatting message time:', err);
      return '';
    }
  };

  return (
    <View className="flex-1 mt-5 bg-gray-50 rounded-xl border border-gray-200 min-h-[200px]">
      <View className="flex-row items-center justify-between p-4 bg-gray-100 border-b border-gray-200">
        <Text className="text-base font-semibold text-gray-800 font-manrope-semibold">Conversation History</Text>
        <Text className="text-xs text-gray-500 font-manrope-medium">{messages.length} messages</Text>
      </View>
      
      <ScrollView 
        className="flex-1 p-3 max-h-[300px] min-h-[100px]"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        {messages.map((message, index) => {
          const isCurrentUser = message.senderId === userData?.uid;
          const isSystemMessage = message.messageType === 'handover_request' || 
                                message.messageType === 'claim_request';
          const senderAvatarSource = message.senderProfilePicture
            ? { uri: message.senderProfilePicture }
            : emptyProfile;
          
          return (
            <View 
              key={`${message.id}-${index}`}
              className={`max-w-[80%] p-3 rounded-xl mb-3 shadow-sm ${
                isSystemMessage 
                  ? 'self-center bg-gray-100 max-w-[90%] p-2' 
                  : isCurrentUser 
                    ? 'self-end bg-blue-500 rounded-tr-sm' 
                    : 'self-start bg-white rounded-tl-sm'
              }`}
            >
              {!isCurrentUser && !isSystemMessage && (
                <View className="flex-row items-center mb-1">
                  <View className="w-6 h-6 rounded-full overflow-hidden mr-2 bg-gray-200">
                    <View className="w-full h-full">
                      {message.senderProfilePicture ? (
                        <Image 
                          source={{ uri: message.senderProfilePicture }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          transition={200}
                          onError={() => {
                            // If there's an error, we'll render the fallback image
                            return <Image source={emptyProfile} style={{ width: '100%', height: '100%' }} contentFit="cover" />;
                          }}
                        />
                      ) : (
                        <Image 
                          source={emptyProfile}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      )}
                    </View>
                  </View>
                  <Text className="text-xs font-semibold text-gray-600 font-manrope-semibold">
                    {message.senderName}
                  </Text>
                </View>
              )}
              
              {message.messageType === 'handover_request' && (
                <View className="flex-row items-center">
                  <MaterialIcons name="swap-horiz" size={20} className="text-gray-600" />
                  <Text className="ml-1 text-sm text-gray-600 font-manrope-medium">
                    {message.senderName} initiated a handover request
                  </Text>
                </View>
              )}
              
              {message.messageType === 'claim_request' && (
                <View className="flex-row items-center">
                  <MaterialIcons name="assignment-returned" size={20} className="text-gray-600" />
                  <Text className="ml-1 text-sm text-gray-600 font-manrope-medium">
                    {message.senderName} submitted a claim request
                  </Text>
                </View>
              )}
              
              {message.text && (
                <Text className={`text-sm leading-5 font-manrope-medium ${
                  isCurrentUser ? 'text-white' : 'text-gray-800'
                }`}>
                  {message.text}
                </Text>
              )}
              
              {message.images && message.images.length > 0 && (
                <View className="flex-row flex-wrap mt-2">
                  {message.images.map((img, idx) => (
                    <Image
                      key={`img-${idx}`}
                      source={{ uri: img }}
                      className="w-[100px] h-[100px] rounded-lg mr-2 mb-2 bg-gray-200"
                      contentFit="cover"
                      transition={200}
                    />
                  ))}
                </View>
              )}
              
              <Text className={`text-xs mt-1 font-manrope-medium ${
                isCurrentUser ? 'text-gray-200 text-right' : 'text-gray-500'
              }`}>
                {formatMessageTime(message.timestamp)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};


export default ConversationHistory;
