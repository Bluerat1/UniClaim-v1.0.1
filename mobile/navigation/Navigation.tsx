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

  // Check if user needs email verification
  const [localNeedsEmailVerification, setLocalNeedsEmailVerification] = useState(false);

  // Check email verification status when user data changes
  useEffect(() => {
    const checkEmailVerification = async () => {
      if (user && userData && !isBanned) {
        try {
          const needsVerification = await userService.needsEmailVerification(user, userData);
          setLocalNeedsEmailVerification(needsVerification);
        } catch (error) {
          console.error('Error checking email verification:', error);
          // Default to not requiring verification if there's an error
          setLocalNeedsEmailVerification(false);
        }
      } else {
        setLocalNeedsEmailVerification(false);
      }
    };

    checkEmailVerification();
  }, [user, userData, isBanned]);

  // Show loading screen while authentication is being determined
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // If user is banned, redirect to login
  const shouldShowOnboarding = !hasSeenOnBoarding && !user;
  const shouldShowIndex = !hasPassedIndex && !user;

  // Check if user is banned and redirect to login
  const shouldRedirectToLogin = user && isBanned;

  // Check if user needs email verification (show verification screen for logged-in but unverified users)
  const shouldShowEmailVerification = user && !isBanned && needsEmailVerification;

  console.log('Navigation state check:', {
    user: user ? 'present' : 'null',
    isAuthenticated,
    isBanned,
    needsEmailVerification,
    shouldShowEmailVerification,
    shouldShowOnboarding,
    shouldShowIndex
  });

  // Handle redirect when user gets banned
  useEffect(() => {
    if (user && isBanned) {
      console.log('User is banned, redirecting to login via component structure');
    }
  }, [user, isBanned]);

  // Prevent banned users from accessing main app - redirect to index screen
  if (user && isBanned) {
    return (
      <Stack.Navigator
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
    return (
      <Stack.Navigator
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
    return (
      <Stack.Navigator
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

  // If user needs email verification, show email verification screen
  if (needsEmailVerification && user && !isAuthenticated) {
    console.log('Navigation: Email verification condition met, shouldShowEmailVerification:', shouldShowEmailVerification);
    console.log('Navigation: Setting initial route to EmailVerification');
    return (
      <Stack.Navigator
        initialRouteName="EmailVerification"
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Stack.Screen name="EmailVerification">
          {() => (
            <Suspense fallback={<ScreenLoader />}>
              <EmailVerification />
            </Suspense>
          )}
        </Stack.Screen>
        <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
        <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
      </Stack.Navigator>
    );
  }

  const initial = shouldShowOnboarding
    ? "OnBoarding"
    : shouldShowIndex
      ? "Index"
      : shouldShowEmailVerification
        ? "EmailVerification"
        : "RootBottomTabs";

  console.log('Navigation: Final initial route:', initial, {
    shouldShowOnboarding,
    shouldShowIndex,
    shouldShowEmailVerification
  });

  return (
    <Stack.Navigator
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
