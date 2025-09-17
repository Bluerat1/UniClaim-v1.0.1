// app/RootLayout.tsx
import { useFonts } from "expo-font";
import React, { useEffect, useState } from "react";
import SplashScreen from "../components/SplashScreen";
import LoadingScreen from "../components/LoadingScreen";
import "../global.css";

// screens
import Navigation from "@/navigation/Navigation";

// components
import { SafeAreaProvider } from "react-native-safe-area-context";
import ScreenWrapper from "../components/ScreenWrapper";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { MessageProvider } from "../context/MessageContext";
import { NotificationProvider } from "../context/NotificationContext";
import { CoordinatesProvider } from "../context/CoordinatesContext";

// utils
import { onboardingStorage } from "../utils/onboardingStorage";

// Separate component to access auth context
const AppContent = ({ 
  hasSeenOnBoarding, 
  setHasSeenOnBoarding, 
  hasPassedIndex, 
  setHasPassedIndex 
}: {
  hasSeenOnBoarding: boolean;
  setHasSeenOnBoarding: React.Dispatch<React.SetStateAction<boolean>>;
  hasPassedIndex: boolean;
  setHasPassedIndex: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { user, loading, isBanned } = useAuth();

  // If user is authenticated, skip onboarding and index screens
  useEffect(() => {
    if (user && !hasPassedIndex) {
      setHasPassedIndex(true);
    }
  }, [user, hasPassedIndex, setHasPassedIndex]);

  // Show loading screen while auth state is being determined
  if (loading) {
    return <LoadingScreen />;
  }

  // NEW: If user is banned, show login screen
  if (isBanned) {
    return (
      <NotificationProvider>
        <MessageProvider userId={null}>
          <Navigation
            hasSeenOnBoarding={hasSeenOnBoarding}
            setHasSeenOnBoarding={setHasSeenOnBoarding}
            hasPassedIndex={hasPassedIndex}
            setHasPassedIndex={setHasPassedIndex}
          />
        </MessageProvider>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <MessageProvider userId={user?.uid || null}>
        <Navigation
          hasSeenOnBoarding={hasSeenOnBoarding}
          setHasSeenOnBoarding={setHasSeenOnBoarding}
          hasPassedIndex={hasPassedIndex}
          setHasPassedIndex={setHasPassedIndex}
        />
      </MessageProvider>
    </NotificationProvider>
  );
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AlbertSansLight: require("../assets/fonts/AlbertSans-Light.ttf"),
    AlbertSansRegular: require("../assets/fonts/AlbertSans-Regular.ttf"),
    AlbertSansSemiBold: require("../assets/fonts/AlbertSans-SemiBold.ttf"),
    AlbertSansBold: require("../assets/fonts/AlbertSans-Bold.ttf"),
    InterLight: require("../assets/fonts/Inter-Light.ttf"),
    InterRegular: require("../assets/fonts/Inter-Regular.ttf"),
    InterMedium: require("../assets/fonts/Inter-Medium.ttf"),
    InterSemiBold: require("../assets/fonts/Inter-SemiBold.ttf"),
    InterBold: require("../assets/fonts/Inter-Bold.ttf"),
    ManropeExtraLight: require("../assets/fonts/Manrope-ExtraLight.ttf"),
    ManropeLight: require("../assets/fonts/Manrope-Light.ttf"),
    ManropeRegular: require("../assets/fonts/Manrope-Regular.ttf"),
    ManropeMedium: require("../assets/fonts/Manrope-Medium.ttf"),
    ManropeSemiBold: require("../assets/fonts/Manrope-SemiBold.ttf"),
    ManropeBold: require("../assets/fonts/Manrope-Bold.ttf"),
    ManropeExtraBold: require("../assets/fonts/Manrope-ExtraBold.ttf"),
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [showSplash, setShowSplash] = useState(true);

  const [hasSeenOnBoarding, setHasSeenOnBoarding] = useState(false);
  const [hasPassedIndex, setHasPassedIndex] = useState(false);

  // Check onboarding status from storage when app starts
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasSeen = await onboardingStorage.hasSeenOnBoarding();
        setHasSeenOnBoarding(hasSeen);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Keep default false if there's an error
      }
    };

    if (fontsLoaded) {
      checkOnboardingStatus();
    }
  }, [fontsLoaded]);

  // Delay splash screen after fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      const timeout = setTimeout(() => {
        setShowSplash(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || showSplash) {
    return (
      <SafeAreaProvider>
        <ScreenWrapper statusBarStyle="dark-content" statusBarBg="#FBFDFC">
          <SplashScreen onAnimationEnd={() => {}} />
        </ScreenWrapper>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CoordinatesProvider>
          <AppContent
            hasSeenOnBoarding={hasSeenOnBoarding}
            setHasSeenOnBoarding={setHasSeenOnBoarding}
            hasPassedIndex={hasPassedIndex}
            setHasPassedIndex={setHasPassedIndex}
          />
        </CoordinatesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
