import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { messageService } from '../utils/firebase/messages';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface Message {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  senderProfilePicture?: string;
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
              
            setMessages(formattedMessages);
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

        setMessages(allMessages);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4B5563" />
        <Text style={styles.loadingText}>Loading conversation history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={24} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="chat-bubble-outline" size={32} color="#9CA3AF" />
        <Text style={styles.emptyText}>No conversation history available</Text>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Conversation History</Text>
        <Text style={styles.messageCount}>{messages.length} messages</Text>
      </View>
      
      <ScrollView style={styles.messagesContainer}>
        {messages.map((message, index) => {
          const isCurrentUser = message.senderId === userData?.uid;
          const isSystemMessage = message.messageType === 'handover_request' || 
                                message.messageType === 'claim_request';
          
          return (
            <View 
              key={`${message.id}-${index}`}
              style={[
                styles.messageBubble,
                isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
                isSystemMessage && styles.systemMessageBubble
              ]}
            >
              {!isCurrentUser && !isSystemMessage && (
                <View style={styles.senderInfo}>
                  <Image 
                    source={{ uri: message.senderProfilePicture }} 
                    style={styles.avatar}
                    contentFit="cover"
                    transition={200}
                  />
                  <Text style={styles.senderName}>{message.senderName}</Text>
                </View>
              )}
              
              {message.messageType === 'handover_request' && (
                <View style={styles.systemMessageContent}>
                  <MaterialIcons name="swap-horiz" size={20} color="#4B5563" />
                  <Text style={styles.systemMessageText}>
                    {message.senderName} initiated a handover request
                  </Text>
                </View>
              )}
              
              {message.messageType === 'claim_request' && (
                <View style={styles.systemMessageContent}>
                  <MaterialIcons name="assignment-returned" size={20} color="#4B5563" />
                  <Text style={styles.systemMessageText}>
                    {message.senderName} submitted a claim request
                  </Text>
                </View>
              )}
              
              {message.text && (
                <Text style={[
                  styles.messageText,
                  isCurrentUser ? styles.currentUserText : styles.otherUserText
                ]}>
                  {message.text}
                </Text>
              )}
              
              {message.images && message.images.length > 0 && (
                <View style={styles.imagesContainer}>
                  {message.images.map((img, idx) => (
                    <Image
                      key={`img-${idx}`}
                      source={{ uri: img }}
                      style={styles.messageImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ))}
                </View>
              )}
              
              <Text style={[
                styles.timestamp,
                isCurrentUser ? styles.currentUserTimestamp : styles.otherUserTimestamp
              ]}>
                {formatMessageTime(message.timestamp)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Manrope_600SemiBold',
  },
  messageCount: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Manrope_500Medium',
  },
  messagesContainer: {
    maxHeight: 300,
    padding: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  currentUserBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderTopRightRadius: 4,
  },
  otherUserBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
  },
  systemMessageBubble: {
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    maxWidth: '90%',
    padding: 8,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    fontFamily: 'Manrope_600SemiBold',
  },
  systemMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  systemMessageText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#4B5563',
    fontFamily: 'Manrope_500Medium',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Manrope_500Medium',
  },
  currentUserText: {
    color: '#FFFFFF',
  },
  otherUserText: {
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'Manrope_500Medium',
  },
  currentUserTimestamp: {
    color: '#E5E7EB',
    textAlign: 'right',
  },
  otherUserTimestamp: {
    color: '#6B7280',
  },
  imagesContainer: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  messageImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#E5E7EB',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingText: {
    marginLeft: 10,
    color: '#4B5563',
    fontFamily: 'Manrope_500Medium',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    margin: 16,
  },
  errorText: {
    marginLeft: 8,
    color: '#DC2626',
    fontFamily: 'Manrope_500Medium',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginVertical: 12,
  },
  emptyText: {
    marginTop: 8,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Manrope_500Medium',
  },
});

export default ConversationHistory;
