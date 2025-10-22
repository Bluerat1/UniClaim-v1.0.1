import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNotifications } from "../context/NotificationContext";
import NotificationPreferencesModal from "./NotificationPreferences";
import { postService } from "../utils/firebase/posts";
import type { RootStackParamList } from "../types/type";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function Header() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const slideAnim = useState(new Animated.Value(SCREEN_WIDTH))[0];

  console.log('🏠 Header component rendered - isVisible:', isVisible, 'showPreferences:', showPreferences);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const openPanel = () => {
    console.log('🔔 Bell icon pressed! Opening notification panel...');
    console.log('Current isVisible state:', isVisible);
    console.log('Current showPreferences state:', showPreferences);
    
    setIsVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      console.log('✅ Notification panel animation completed');
    });
  };

  const closePanel = () => {
    console.log('❌ Closing notification panel, current isVisible:', isVisible);
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      console.log('✅ Panel animation completed, setting isVisible to false');
      setIsVisible(false);
    });
  };

  const openPreferences = () => {
    console.log('🔧 Settings button pressed!');
    console.log('Current showPreferences state:', showPreferences);
    console.log('Current isVisible state:', isVisible);

    closePanel();
    setTimeout(() => {
      setShowPreferences(true);
      console.log('✅ Preferences modal should now be visible');
    }, 350); // Wait for panel close animation
  };

  const handleNotificationPress = async (notification: any) => {
    try {
      // Mark notification as read if it's not already read
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // Close the notification panel
      closePanel();

      // Navigate to the post if postId exists
      if (notification.postId) {
        const post = await postService.getPostById(notification.postId);
        if (post) {
          navigation.navigate("PostDetails", { post });
        }
      }
    } catch (error) {
      console.error("Error handling notification press:", error);
      // Still close the panel even if navigation fails
      closePanel();
    }
  };

  return (
    <>
      {/* Header Top Bar */}
      <View className="flex-row items-center justify-between mb-4 mt-2 px-4">
        {/* Left: Logo + Title */}
        <View className="flex-row items-center">
          <Image
            source={require("../assets/images/uniclaimlogo.png")}
            className="size-10 mr-1"
            resizeMode="contain"
          />
          <Text className="text-2xl font-albert-bold text-brand">Uni</Text>
          <Text className="text-2xl font-albert-bold text-black-500">
            Claim
          </Text>
        </View>

        {/* Right: Bell Icon */}
        <TouchableOpacity onPress={openPanel} className="relative">
          <Feather name="bell" className="text-blue-900" size={26} />
          {unreadCount > 0 && (
            <View className="absolute -top-1 -right-1 bg-red-500 rounded-full h-5 w-5 items-center justify-center">
              <Text className="text-white text-xs font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Full-Screen Modal with Full-Width Sliding Panel */}
      {isVisible && (
        <Modal transparent animationType="none">
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => {
                console.log('🔙 Backdrop tapped - closing notification panel');
                closePanel();
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: 0,
                width: SCREEN_WIDTH * 0.85,
                backgroundColor: "white",
                padding: 20,
                shadowColor: "#000",
                shadowOffset: { width: -2, height: 0 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                transform: [{ translateX: slideAnim }],
              }}
            >
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center">
                  <Text className="text-xl font-manrope-semibold text-black">
                    Notifications
                  </Text>
                  <Text className="ml-2 text-sm font-inter text-gray-500">
                    ({notifications.length}/15)
                  </Text>
                  {unreadCount > 0 && (
                    <View className="ml-2 bg-red-500 rounded-full px-2 py-1">
                      <Text className="text-white text-xs font-bold">
                        {unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center gap-4">
                  <TouchableOpacity
                    onPress={() => {
                      console.log('⚙️ TouchableOpacity settings button pressed!');
                      openPreferences();
                    }}
                    className="p-1"
                  >
                    <Feather name="settings" size={20} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closePanel}>
                    <Feather name="x" size={24} color="black" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notification content */}
              <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
              >
                {notifications.length === 0 ? (
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-lg font-inter text-gray-700 mt-60">
                      📣 You have no new notifications.
                    </Text>
                  </View>
                ) : (
                  <View className="flex-col gap-3">
                    {notifications.map((notification) => (
                      <TouchableOpacity
                        key={notification.id}
                        onPress={() => handleNotificationPress(notification)}
                        className={`p-3 rounded-lg border-l-4 ${
                          notification.read
                            ? "bg-gray-50 border-navyblue/50"
                            : "bg-yellow-50 border-yellow-500"
                        }`}
                      >
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1">
                            <Text className="font-manrope-semibold text-gray-900 text-sm">
                              {notification.title}
                            </Text>
                            <Text className="text-gray-600 font-inter text-xs mt-1">
                              {notification.body}
                            </Text>
                            <Text className="text-gray-400 text-xs font-inter mt-2">
                              {new Date(
                                notification.createdAt?.toDate?.() ||
                                  notification.createdAt
                              ).toLocaleString()}
                            </Text>
                          </View>
                          <View className="flex-row items-center ml-2">
                            {!notification.read && (
                              <View className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                            )}
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation(); // Prevent triggering the notification click
                                deleteNotification(notification.id);
                              }}
                              className="p-1"
                            >
                              <Feather name="x" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>

              {notifications.length > 0 && (
                <View className="mt-4 pt-4 border-t border-gray-200 flex-col gap-3">
                  <TouchableOpacity
                    onPress={markAllAsRead}
                    className="w-full p-3 rounded-lg border border-navyblue"
                  >
                    <Text className="text-center font-manrope-medium text-navyblue">
                      Mark all as read
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={deleteAllNotifications}
                    className="w-full p-3 rounded-lg border border-red-500"
                  >
                    <Text className="text-center text-red-500 font-manrope-medium">
                      Delete all
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Notification Preferences Modal */}
      {showPreferences && (
        <Modal
          visible={showPreferences}
          animationType="slide"
          onRequestClose={() => {
            console.log('🔙 Back button or outside tap - closing preferences modal');
            setShowPreferences(false);
          }}
        >
          <NotificationPreferencesModal
            onClose={() => {
              console.log('❌ Close button pressed in preferences modal');
              setShowPreferences(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
