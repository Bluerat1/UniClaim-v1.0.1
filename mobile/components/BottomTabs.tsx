import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import { useEffect, useState, useRef } from "react";
import {
  Keyboard,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { useMessage } from "../context/MessageContext";

// Screens
import HomeScreen from "../app/tabs/Home";
import Message from "../app/tabs/Message";
import ProfileScreen from "../app/tabs/Profile";
import CreateReportScreen from "../app/tabs/Report";
import MyTicket from "../app/tabs/Ticket";

type TabConfig = {
  key: string;
  iconOutline: keyof typeof Ionicons.glyphMap;
  iconFilled: keyof typeof Ionicons.glyphMap;
  label: string;
  component: () => JSX.Element;
};

// Static tabs configuration - moved outside component
const tabs: TabConfig[] = [
  {
    key: "MyTickets",
    iconOutline: "home-outline",
    iconFilled: "home",
    label: "Home",
    component: HomeScreen,
  },
  {
    key: "Ticket",
    iconOutline: "ticket-outline",
    iconFilled: "ticket",
    label: "My Ticket",
    component: MyTicket,
  },
  {
    key: "CreateReport",
    iconOutline: "add-circle",
    iconFilled: "add-circle",
    label: "Create a report",
    component: CreateReportScreen,
  },
  {
    key: "Messages",
    iconOutline: "chatbubble-outline",
    iconFilled: "chatbubble",
    label: "Messages",
    component: Message,
  },
  {
    key: "Profile",
    iconOutline: "person-outline",
    iconFilled: "person",
    label: "Profile",
    component: ProfileScreen,
  },
];

export default function CustomTabs() {
  const [currentTab, setCurrentTab] = useState("MyTickets");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const previousTabRef = useRef(currentTab);
  const [isInitialized, setIsInitialized] = useState(false);
  const { isBanned, userData } = useAuth();
  const { getUnreadConversationCount } = useMessage();

  // Calculate unread conversation count for badge
  const unreadCount = userData?.uid
    ? getUnreadConversationCount(userData.uid)
    : 0;

  // Load saved tab state on component mount
  useEffect(() => {
    const loadSavedTab = async () => {
      try {
        const savedTab = await AsyncStorage.getItem("lastActiveTab");
        if (savedTab && tabs.some((tab) => tab.key === savedTab)) {
          setCurrentTab(savedTab);
        }
      } catch (error) {
        console.log("Failed to load saved tab:", error);
      } finally {
        // Always set initialized to true, even if AsyncStorage fails
        setIsInitialized(true);
      }
    };

    loadSavedTab();
  }, []);

  // Save tab state when it changes
  useEffect(() => {
    if (isInitialized && currentTab !== previousTabRef.current) {
      AsyncStorage.setItem("lastActiveTab", currentTab);
      previousTabRef.current = currentTab;
    }
  }, [currentTab, isInitialized]);

  useEffect(() => {
    const keyboardShow = Keyboard.addListener("keyboardDidShow", () =>
      setIsKeyboardVisible(true)
    );
    const keyboardHide = Keyboard.addListener("keyboardDidHide", () =>
      setIsKeyboardVisible(false)
    );

    return () => {
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, []);

  // NEW: Redirect banned users to login
  useEffect(() => {
    if (isBanned) {
      // User is banned, but don't try to navigate since the parent components handle this
      console.log(
        "User is banned in BottomTabs, redirecting via parent components"
      );
    }
  }, [isBanned]);

  // Handle tab press
  const handleTabPress = (tabKey: string) => {
    setCurrentTab(tabKey);
  };

  // Render only the active tab component to prevent background processing
  const renderActiveTab = () => {
    switch (currentTab) {
      case "MyTickets":
        return <HomeScreen />;
      case "Ticket":
        return <MyTicket />;
      case "CreateReport":
        return <CreateReportScreen />;
      case "Messages":
        return <Message />;
      case "Profile":
        return <ProfileScreen />;
      default:
        return <HomeScreen />;
    }
  };

  // NEW: Don't render tabs if user is banned
  if (isBanned) {
    return null; // This will trigger the parent navigation logic
  }

  // Don't render content until tab state is loaded
  if (!isInitialized) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
        <View className="flex-1 justify-center items-center">
          <Text className="text-base text-gray-500">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      {/* Main Content - All tabs mounted but only current one visible */}
      <View className="flex-1">{renderActiveTab()}</View>

      {/* Bottom Tabs — hidden when keyboard is visible */}
      {!isKeyboardVisible && (
        <View
          className="bg-white pt-[15px] shadow-lg"
          style={{
            paddingBottom: Math.max(insets.bottom, 1),
          }}
        >
          <View className="h-[50px] flex-row items-center justify-around mx-4 mb-5">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.key;
              const isAddTab = tab.key === "CreateReport";

              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key)}
                  className="items-center justify-center flex-col gap-1"
                >
                  <View className="relative">
                    <Ionicons
                      name={isActive ? tab.iconFilled : tab.iconOutline}
                      size={isAddTab ? 28 : 22}
                      color={isActive ? "#0A193A" : "#6B7280"}
                      style={
                        tab.key === "Ticket"
                          ? { transform: [{ rotate: "45deg" }] }
                          : undefined
                      }
                    />
                    {/* Badge count for Messages tab */}
                    {tab.key === "Messages" && unreadCount > 0 && (
                      <View className="absolute -top-2 -right-2 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
                        <Text className="text-white text-xs font-bold">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    className={`text-[9px] ${isAddTab ? 'mt-1' : 'mt-2'} ${isActive ? 'text-[#0A193A]' : 'text-gray-500'}`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
