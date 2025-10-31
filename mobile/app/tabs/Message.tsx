import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  Timestamp, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDoc,
  arrayUnion 
} from 'firebase/firestore';
import { db } from '../../utils/firebase/config';
import PageLayout from "../../layout/PageLayout";
import { useMessage } from "../../context/MessageContext";
import { useAuth } from "../../context/AuthContext";
import ProfilePicture from "../../components/ProfilePicture";
import type { Conversation, RootStackParamList } from "../../types/type";


type MessageNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Message"
>;

const ConversationItem = React.memo(({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) => {
  const { userData } = useAuth();

  const formatTime = useCallback((timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const diffInHours = diffInMinutes / 60;

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  }, []);

  // Participant name state
  const [participantName, setParticipantName] = useState<string>('Loading...');

  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Function to fetch user data from Firestore
  const fetchUserData = useCallback(async (userId: string) => {
    if (!userId) {
      setParticipantName('Unknown User');
      return;
    }
    
    try {
      setIsLoadingProfile(true);
      
      // Check if participant data is just a boolean
      const participant = conversation.participants?.[userId] as any;
      if (participant === true) {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Get the best available name
          const name = [
            userData.displayName,
            userData.name,
            userData.firstName && userData.lastName 
              ? `${userData.firstName} ${userData.lastName}` 
              : null,
            userData.firstName,
            userData.lastName,
            userData.email?.split('@')[0],
            'User'
          ].find(Boolean) as string;
          
          setParticipantName(name);
          
          // Update the conversation's participant data for future use
          try {
            await updateDoc(doc(db, 'conversations', conversation.id), {
              [`participants.${userId}`]: {
                displayName: name,
                photoURL: userData.photoURL || userData.profilePicture,
                email: userData.email,
                participantIds: arrayUnion(userId)
              }
            });
          } catch (updateError) {
            console.error('Failed to update participant data:', updateError);
          }
          
          // Set profile picture
          const pictureUrl = [
            userData.photoURL,
            userData.profilePicture,
            userData.avatar,
            userData.profilePic,
            userData.image,
            userData.picture,
            userData.photo,
            userData.profilePicUrl,
            userData.profile_pic,
            userData.profile_pic_url
          ].find(Boolean) as string | undefined;
          
          setProfilePictureUrl(pictureUrl || null);
        } else {
          // If user document doesn't exist, try to get name from participant data
          const participant = conversation.participants?.[userId];
          
          if (participant && typeof participant === 'object') {
            const p = participant as any;
            const fallbackName = [
              p.displayName,
              p.name,
              (p.firstName || p.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null,
              p.firstName,
              p.lastName,
              p.email?.split('@')[0],
              'User'
            ].find(Boolean) as string;
            
            setParticipantName(fallbackName);
          } else {
            setParticipantName('User');
          }
          setProfilePictureUrl(null);
        }
      } else {
        // Original fetch logic for non-boolean participants
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const name = [
            userData.displayName,
            userData.name,
            userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : null,
            userData.firstName,
            userData.lastName,
            userData.email?.split('@')[0],
            'User'
          ].find(Boolean) as string;
          
          setParticipantName(name);
          
          const pictureUrl = [
            userData.photoURL,
            userData.profilePicture,
            userData.avatar,
            userData.profilePic,
            userData.image,
            userData.picture,
            userData.photo,
            userData.profilePicUrl,
            userData.profile_pic,
            userData.profile_pic_url
          ].find(Boolean) as string | undefined;
          
          setProfilePictureUrl(pictureUrl || null);
        } else {
          console.log(`User document not found for ID: ${userId}`);
          // If user document doesn't exist, try to get name from participant data
          const participant = conversation.participants?.[userId];
          
          if (participant && typeof participant === 'object') {
            const p = participant as any;
            const fallbackName = [
              p.displayName,
              p.name,
              (p.firstName || p.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null,
              p.firstName,
              p.lastName,
              p.email?.split('@')[0],
              'User'
            ].find(Boolean) as string;
            
            setParticipantName(fallbackName);
          } else {
            console.log('No valid participant data, defaulting to "User"');
            setParticipantName('User');
          }
          setProfilePictureUrl(null);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setParticipantName('User');
      setProfilePictureUrl(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  // Function to get the best available name from participant data
  const getParticipantName = useCallback((participantData: any, userId: string): string => {
    if (!participantData) return 'User';
    
    // If participantData is a boolean (old format), we need to fetch the user data
    if (typeof participantData === 'boolean') {
      fetchUserData(userId);
      return 'Loading...';
    }
    
    // Try to get the best available name from participant data
    const p = participantData as Record<string, any>;
    const name = [
      p?.displayName,
      p?.name,
      (p?.firstName || p?.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null,
      p?.firstName,
      p?.lastName,
      p?.email?.split('@')[0],
      'User'
    ].find(Boolean) as string;
    
    return name || 'User';
  }, [fetchUserData]);

  // Function to get the best available profile picture URL from participant data
  const getProfilePictureUrl = useCallback((participantData: any): string | null => {
    if (!participantData || typeof participantData === 'boolean') {
      return null;
    }
    
    const p = participantData as Record<string, any>;
    return [
      p?.photoURL,
      p?.profilePicture,
      p?.avatar,
      p?.profilePic,
      p?.image,
      p?.picture,
      p?.photo,
      p?.profilePicUrl,
      p?.profile_pic,
      p?.profile_pic_url
    ].find(Boolean) || null;
  }, []);

  // Effect to handle participant data and update name/picture
  useEffect(() => {
    if (!userData) return;
    
    // Find the other participant (not the current user)
    const otherParticipant = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid !== userData.uid
    );
    
    if (otherParticipant) {
      const [userId, participantData] = otherParticipant;
      
      // Update participant name
      const name = getParticipantName(participantData, userId);
      setParticipantName(name);
      
      // Update profile picture
      const pictureUrl = getProfilePictureUrl(participantData);
      if (pictureUrl) {
        setProfilePictureUrl(pictureUrl);
      } else if (typeof participantData === 'boolean') {
        // If we only have a boolean, try to fetch the user data
        fetchUserData(userId);
      }
    } else {
      setProfilePictureUrl(null);
    }
  }, [conversation.participants, userData, fetchUserData]);

  const lastMessageSenderName = useMemo(() => {
    if (!conversation.lastMessage?.senderId || !userData) {
      return "Unknown User";
    }

    // If the sender is the current user
    if (conversation.lastMessage.senderId === userData.uid) {
      return "You";
    }

    // Find the sender in participants
    const sender = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid === conversation.lastMessage?.senderId
    );

    if (sender && sender[1]) {
      const participantData = sender[1];
      
      // If participant data is just a boolean, we need to fetch the full user data
      if (typeof participantData === 'boolean') {
        fetchUserData(sender[0]);
        return 'Loading...';
      }
      
      // Otherwise, try to get the best available name
      const p = participantData as Record<string, any>;
      const name = [
        p?.displayName,
        p?.name,
        (p?.firstName || p?.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null,
        p?.firstName,
        p?.lastName,
        p?.email?.split('@')[0],
      ].find(Boolean) as string | undefined;
      
      if (name) return name;
      
      // If we couldn't find a name, try to fetch the user data
      fetchUserData(sender[0]);
      return 'Loading...';
    }

    // If we can't find the sender in participants, try to fetch their data
    if (conversation.lastMessage?.senderId) {
      fetchUserData(conversation.lastMessage.senderId);
    }

    return 'Loading...';
  }, [conversation.lastMessage?.senderId, conversation.participants, userData, fetchUserData]);

  const formattedTime = useMemo(() => formatTime(conversation.lastMessage?.timestamp), [formatTime, conversation.lastMessage?.timestamp]);
  const unreadCount = useMemo(() => conversation.unreadCounts?.[userData?.uid || ""] || 0, [conversation.unreadCounts, userData?.uid]);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white p-4 border-b border-gray-200"
    >
      <View className="flex-row items-start">
        {/* Profile Picture */}
        <View className="mr-3">
<ProfilePicture 
            src={profilePictureUrl} 
            size="md" 
          />
        </View>

        {/* Conversation Details */}
        <View className="flex-1">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className="font-manrope-semibold text-gray-800 text-base"
                  numberOfLines={1}
                >
                  {conversation.postTitle}
                </Text>
                {/* Post Type Badge */}
                <View
                  className={`px-2 py-1 rounded-full ${conversation.postType === "found" ? "bg-green-100" : "bg-orange-100"}`}
                >
                  <Text
                    className={`text-xs font-medium ${conversation.postType === "found" ? "text-green-800" : "text-orange-800"}`}
                  >
                    {conversation.postType === "found" ? "FOUND" : "LOST"}
                  </Text>
                </View>
              </View>
              <Text
                className="text-gray-500 font-manrope-medium text-xs mt-1"
                numberOfLines={1}
              >
                {participantName}
              </Text>
              <Text
                className={`text-sm mt-2 font-inter ${unreadCount > 0 ? "font-bold text-gray-800" : "text-gray-600"}`}
                numberOfLines={2}
              >
                {conversation.lastMessage ? (
                  <>
                    <Text className="font-medium">
                      {lastMessageSenderName}
                    </Text>
                    <Text>: {conversation.lastMessage.text}</Text>
                  </>
                ) : (
                  "No messages yet"
                )}
              </Text>
            </View>
            <View className="ml-2">
              <Text className="text-gray-500 text-xs font-manrope">
                {formattedTime}
              </Text>
              {/* Get the current user's unread count from this conversation */}
              {unreadCount > 0 && (
                <View className="bg-blue-500 rounded-full px-2 py-1 mt-1 self-end min-w-[20px] items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

ConversationItem.displayName = 'ConversationItem';

export default function Message() {
  const navigation = useNavigation<MessageNavigationProp>();
  const {
    conversations,
    loading,
    refreshConversations,
    markConversationAsRead,
  } = useMessage();
  const { userData } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleConversationPress = useCallback(async (conversation: Conversation) => {
    // Mark conversation as read before navigating
    if (userData?.uid) {
      await markConversationAsRead(conversation.id, userData.uid);
    }

    navigation.navigate("Chat", {
      conversationId: conversation.id,
      postTitle: conversation.postTitle,
      postOwnerId: conversation.postCreatorId,
      postId: conversation.postId,
      postOwnerUserData:
        conversation.participants?.[conversation.postCreatorId] || {},
      postType: conversation.postType,
      postStatus: conversation.postStatus,
      foundAction: conversation.foundAction,
    });
  }, [userData?.uid, markConversationAsRead, navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshConversations();
    } catch (error) {
      console.error("Failed to refresh conversations:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshConversations]);

  // Sort conversations by most recent message timestamp (newest first)
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // Get timestamps from last messages
      const aTime = a.lastMessage?.timestamp;
      const bTime = b.lastMessage?.timestamp;

      // Handle conversations without messages
      if (!aTime && !bTime) return 0; // Both have no messages, maintain current order
      if (!aTime) return 1; // Conversation without messages goes to bottom
      if (!bTime) return -1; // Conversation without messages goes to bottom

      // Convert timestamps to comparable values
      const aTimestamp =
        aTime instanceof Date
          ? aTime.getTime()
          : aTime.toDate?.()?.getTime() || 0;
      const bTimestamp =
        bTime instanceof Date
          ? bTime.getTime()
          : bTime.toDate?.()?.getTime() || 0;

      // Sort newest first (descending order)
      return bTimestamp - aTimestamp;
    });
  }, [conversations]);

  if (loading) {
    return (
      <PageLayout>
        <SafeAreaView className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading conversations...</Text>
        </SafeAreaView>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SafeAreaView className="flex-1 bg-gray-50">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500">Loading conversations...</Text>
          </View>
        ) : sortedConversations.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500 text-center">
              No conversations yet.{"\n"}Start a conversation by contacting
              someone about their post!
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedConversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversationItem
                conversation={item}
                onPress={() => handleConversationPress(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}
      </SafeAreaView>
    </PageLayout>
  );
}
