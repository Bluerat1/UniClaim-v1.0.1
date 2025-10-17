// Navigation.tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { auth, authService, UserData, db, userService } from '../utils/firebase';
import React, { useState, useEffect, Suspense } from "react";
import { View, ActivityIndicator } from "react-native";
import type { RootStackParamList } from "../types/type";
import { useAuth } from "../context/AuthContext";

// Simple loading component for Suspense fallback
const ScreenLoader = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
    <ActivityIndicator size="large" color="#2563eb" />
  </View>
);

// Components
import CustomTabs from "../components/BottomTabs";
import ScreenWrapper from "../components/ScreenWrapper";

// Screens - keeping direct imports for React Native compatibility
import Chat from "@/app/Chat";
import EmailVerification from "@/app/tabs/EmailVerification";
import ForgotPassword from "@/app/tabs/ForgotPassword";
import Home from "../app/tabs/Home";
import Index from "../app/tabs/index";
import ItemDetails from "../app/tabs/ItemDetails";
import Login from "../app/tabs/Login";
import Message from "../app/tabs/Message";
import OnBoarding from "../app/tabs/OnBoarding";
import PostDetails from "../app/tabs/PostDetails";
import Profile from "../app/tabs/Profile";
import Register from "../app/tabs/Register";
import Report from "../app/tabs/Report";
import USTPMapScreen from "../app/tabs/USTPMapScreen";
import ClaimFormScreen from "../app/tabs/ClaimFormScreen";
import PhotoCaptureScreen from "../app/tabs/PhotoCaptureScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

const withScreenWrapper = <P extends object>(Component: React.ComponentType<P>) => {
  return (props: P) => (
    <ScreenWrapper statusBarStyle="dark-content" statusBarBg="#fff">
      <Component {...props} />
    </ScreenWrapper>
  );
};

interface NavigationProps {
  hasSeenOnBoarding: boolean;
  setHasSeenOnBoarding: React.Dispatch<React.SetStateAction<boolean>>;
  hasPassedIndex: boolean;
  setHasPassedIndex: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Navigation({
  hasSeenOnBoarding,
  setHasSeenOnBoarding,
  hasPassedIndex,
  setHasPassedIndex,
}: NavigationProps) {
  const [images, setImages] = useState<string[]>([]);
  const [showLostInfo, setShowLostInfo] = useState(false);
  const [showFoundInfo, setShowFoundInfo] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportType, setReportType] = useState<"lost" | "found" | null>(null);
  const [foundAction, setFoundAction] = useState<"keep" | "turnover to OSA" | "turnover to Campus Security" | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user, userData, isBanned, isAuthenticated, needsEmailVerification, loading, loginAttemptFailed } = useAuth();

  // Force re-render when authentication state changes
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    console.log('🔄 Navigation: Auth state changed, forcing re-render', {
      isAuthenticated,
      user: user ? 'present' : 'null',
      loading,
      needsEmailVerification
    });
    setRenderKey(prev => prev + 1);
  }, [isAuthenticated, user, loading, needsEmailVerification]);

  // If user is banned, redirect to login
  const shouldRedirectToLogin = user && isBanned;

  // Check if user needs email verification (show verification screen for logged-in but unverified users)
  const shouldShowEmailVerification = user && !isBanned && needsEmailVerification;

  const shouldShowOnboarding = !hasSeenOnBoarding && !user;
  const shouldShowIndex = !hasPassedIndex && !user;

  console.log('🔍 Navigation state check:', {
    user: user ? 'present' : 'null',
    isAuthenticated,
    isBanned,
    needsEmailVerification,
    shouldShowEmailVerification: user && !isBanned && needsEmailVerification,
    shouldShowOnboarding: !hasSeenOnBoarding && !user,
    shouldShowIndex: !hasPassedIndex && !user,
    loginAttemptFailed,
    loading,
    conditionCheck: `isAuthenticated && user && !isBanned = ${isAuthenticated && user && !isBanned}`,
    shouldShowMainApp: isAuthenticated && user && !isBanned && !shouldShowEmailVerification
  });

  // Handle redirect when user gets banned
  useEffect(() => {
    if (user && isBanned) {
      console.log('User is banned, redirecting to login via component structure');
    }
  }, [user, isBanned]);

  // Prevent banned users from accessing main app - redirect to index screen
  if (user && isBanned) {
    console.log('🔄 Navigation: Showing banned user navigator');
    return (
      <Stack.Navigator
        key={`banned-navigation-${renderKey}`}
        initialRouteName="Index"
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Stack.Screen name="Index">{() => <Index onContinue={() => {}} />}</Stack.Screen>
        <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
        <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
        <Stack.Screen name="ForgotPassword" component={withScreenWrapper(ForgotPassword)} />
      </Stack.Navigator>
    );
  }

  // If user is not authenticated and login attempt failed, show login screen
  if (!isAuthenticated && !user && loginAttemptFailed) {
    console.log('🔄 Navigation: Showing login failed navigator');
    return (
      <Stack.Navigator
        key={`login-failed-navigation-${renderKey}`}
        initialRouteName="Login"
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
        <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
        <Stack.Screen name="ForgotPassword" component={withScreenWrapper(ForgotPassword)} />
        <Stack.Screen name="Index">{() => <Index onContinue={() => {}} />}</Stack.Screen>
      </Stack.Navigator>
    );
  }

  // If user is not authenticated, show index screen (welcome screen with login/register options)
  if (!isAuthenticated && !user && !needsEmailVerification && !loginAttemptFailed) {
    console.log('🔄 Navigation: Showing index navigator');
    console.log('🚨 DEBUG: Showing Index screen - checking conditions:', {
      isAuthenticated,
      user: user ? 'present' : 'null',
      needsEmailVerification,
      loginAttemptFailed,
      conditionResult: !isAuthenticated && !user && !needsEmailVerification && !loginAttemptFailed
    });
    return (
      <Stack.Navigator
        key={`index-navigation-${renderKey}`}
        initialRouteName="Index"
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Stack.Screen name="Index">{() => <Index onContinue={() => {}} />}</Stack.Screen>
        <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
        <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
        <Stack.Screen name="ForgotPassword" component={withScreenWrapper(ForgotPassword)} />
      </Stack.Navigator>
    );
  }

  // CRITICAL FIX: If user is authenticated, always show main app
  if (isAuthenticated && user && !isBanned) {
    console.log('✅ Navigation: Showing main app navigator');
    return (
      <Stack.Navigator
        key={`authenticated-navigation-${renderKey}`}
        initialRouteName="RootBottomTabs"
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Stack.Screen
          name="RootBottomTabs"
          component={withScreenWrapper(CustomTabs)}
        />
        <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
        <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
        <Stack.Screen name="ForgotPassword" component={withScreenWrapper(ForgotPassword)} />
        <Stack.Screen name="EmailVerification">
          {() => (
            <Suspense fallback={<ScreenLoader />}>
              <EmailVerification />
            </Suspense>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  const initial = shouldShowOnboarding
    ? "OnBoarding"
    : shouldShowIndex
      ? "Index"
      : shouldShowEmailVerification
        ? "EmailVerification"
        : isAuthenticated && user && !isBanned
          ? "RootBottomTabs"
          : "Index"; // Fallback to Index if no other condition matches

  console.log('Navigation: Final initial route:', initial, {
    shouldShowOnboarding,
    shouldShowIndex,
    shouldShowEmailVerification,
    isAuthenticated,
    hasUser: !!user,
    isNotBanned: !isBanned
  });

  console.log('🔄 Navigation: Using fallback navigator with initial route:', initial);

  return (
    <Stack.Navigator
      key={`main-navigation-${renderKey}`}
      initialRouteName={initial}
      screenOptions={{ headerShown: false, animation: "fade" }}
    >
      {/* Entry Screens */}
      <Stack.Screen name="OnBoarding">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <OnBoarding onFinish={() => setHasSeenOnBoarding(true)} />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen name="Index">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Index onContinue={() => setHasPassedIndex(true)} />
          </Suspense>
        )}
      </Stack.Screen>

      {/* Main Screens */}
      <Stack.Screen
        name="RootBottomTabs"
        component={withScreenWrapper(CustomTabs)}
      />
      <Stack.Screen name="Login">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Login />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Register />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Home">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Home />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Report">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Report />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Profile">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Profile />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Message">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Message />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <ForgotPassword />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="EmailVerification">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <EmailVerification />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="PostDetails">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <PostDetails />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Chat">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <Chat />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="ClaimFormScreen">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <ClaimFormScreen />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="PhotoCaptureScreen">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <PhotoCaptureScreen />
          </Suspense>
        )}
      </Stack.Screen>

      {/* ✅ FIXED: Pass props using render function */}
      <Stack.Screen name="ItemDetails">
        {(props) => (
          <ScreenWrapper statusBarStyle="dark-content" statusBarBg="#fff">
            <ItemDetails
              {...props}
              images={images}
              setImages={setImages}
              showLostInfo={showLostInfo}
              showFoundInfo={showFoundInfo}
              setShowLostInfo={setShowLostInfo}
              setShowFoundInfo={setShowFoundInfo}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              reportType={reportType}
              setReportType={setReportType}
              foundAction={foundAction}
              setFoundAction={setFoundAction}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="USTPMapScreen">
        {() => (
          <Suspense fallback={<ScreenLoader />}>
            <USTPMapScreen />
          </Suspense>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
