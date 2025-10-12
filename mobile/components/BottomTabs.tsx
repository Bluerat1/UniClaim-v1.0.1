import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import { useEffect, useState, useRef } from "react";
import {
  Keyboard,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
  },
  mainContent: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: "white",
    paddingTop: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.32,
    shadowRadius: 6,
    elevation: 20,
  },
  tabBarContent: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginHorizontal: 16,
    marginBottom: 20,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 4,
  },
  iconContainer: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  tabLabel: {
    fontSize: 9,
    marginTop: 2,
  },
  activeTabLabel: {
    color: "#0A193A",
  },
  inactiveTabLabel: {
    color: "#000000",
  },
});

export default function CustomTabs() {
  const [currentTab, setCurrentTab] = useState("MyTickets");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 50;
  const previousTabRef = useRef(currentTab);
  const [isInitialized, setIsInitialized] = useState(false);
  const { isBanned, userData } = useAuth();
  const { getUnreadConversationCount } = useMessage();

  // Calculate unread conversation count for badge
  const unreadCount = userData?.uid
    ? getUnreadConversationCount(userData.uid)
    : 0;

  // NEW: Redirect banned users to login
  useEffect(() => {
    if (isBanned) {
      // User is banned, but don't try to navigate since the parent components handle this
      console.log(
        "User is banned in BottomTabs, redirecting via parent components"
      );
    }
  }, [isBanned]);

  // NEW: Don't render tabs if user is banned
  if (isBanned) {
    return null; // This will trigger the parent navigation logic
  }

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
      }
    };

    loadSavedTab();
    setIsInitialized(true);
  }, []);

  // Save tab state when it changes
  useEffect(() => {
    if (isInitialized && currentTab !== previousTabRef.current) {
      AsyncStorage.setItem("lastActiveTab", currentTab);
      previousTabRef.current = currentTab;
    }
  }, [currentTab, isInitialized]);

  // Handle tab press
  const handleTabPress = (tabKey: string) => {
    setCurrentTab(tabKey);
  };

  // Get current tab component
  const CurrentTabComponent =
    tabs.find((tab) => tab.key === currentTab)?.component || HomeScreen;

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

  // Don't render content until tab state is loaded
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Main Content - All tabs mounted but only current one visible */}
      <View style={styles.mainContent}>{renderActiveTab()}</View>

      {/* Bottom Tabs — hidden when keyboard is visible */}
      {!isKeyboardVisible && (
        <View
          style={[
            styles.tabBar,
            {
              paddingBottom: Math.max(insets.bottom, 1),
            },
          ]}
        >
          <View style={styles.tabBarContent}>
            {tabs.map((tab) => {
              const isActive = currentTab === tab.key;
              const isAddTab = tab.key === "CreateReport";

              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key)}
                  style={styles.tabButton}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={isActive ? tab.iconFilled : tab.iconOutline}
                      size={isAddTab ? 28 : 22}
                      color={isActive ? "#0A193A" : "#000"}
                      style={
                        tab.key === "Ticket"
                          ? { transform: [{ rotate: "45deg" }] }
                          : undefined
                      }
                    />
                    {/* Badge count for Messages tab */}
                    {tab.key === "Messages" && unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      isAddTab ? { marginTop: 4 } : { marginTop: 8 },
                      isActive
                        ? styles.activeTabLabel
                        : styles.inactiveTabLabel,
                    ]}
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
