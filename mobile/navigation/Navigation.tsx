// Navigation.tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useState, useEffect } from "react";
import type { RootStackParamList } from "../types/type";
import { useAuth } from "../context/AuthContext";

// Screens
import Chat from "@/app/Chat";
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

// Components
import CustomTabs from "../components/BottomTabs";
import ScreenWrapper from "../components/ScreenWrapper";

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
  const { user, isBanned, isAuthenticated } = useAuth();

  // If user is banned, redirect to login
  const shouldShowOnboarding = !hasSeenOnBoarding && !user;
  const shouldShowIndex = !hasPassedIndex && !user;

  // Check if user is banned and redirect to login
  const shouldRedirectToLogin = user && isBanned;

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

  // If user is not authenticated, show index screen (welcome screen with login/register options)
  if (!isAuthenticated && !user) {
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

  const initial = shouldShowOnboarding
    ? "OnBoarding"
    : shouldShowIndex
      ? "Index"
      : "RootBottomTabs";

  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{ headerShown: false, animation: "fade" }}
    >
      {/* Entry Screens */}
      <Stack.Screen name="OnBoarding">
        {() => <OnBoarding onFinish={() => setHasSeenOnBoarding(true)} />}
      </Stack.Screen>

      <Stack.Screen name="Index">
        {() => <Index onContinue={() => setHasPassedIndex(true)} />}
      </Stack.Screen>

      {/* Main Screens */}
      <Stack.Screen
        name="RootBottomTabs"
        component={withScreenWrapper(CustomTabs)}
      />
      <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
      <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
      <Stack.Screen name="Home" component={withScreenWrapper(Home)} />
      <Stack.Screen name="Report" component={withScreenWrapper(Report)} />
      <Stack.Screen name="Profile" component={withScreenWrapper(Profile)} />
      <Stack.Screen name="Message" component={withScreenWrapper(Message)} />
      <Stack.Screen
        name="ForgotPassword"
        component={withScreenWrapper(ForgotPassword)}
      />
      <Stack.Screen
        name="PostDetails"
        component={withScreenWrapper(PostDetails)}
      />
      <Stack.Screen 
        name="Chat" 
        component={withScreenWrapper(Chat)} 
        options={{ animation: 'none' }}
      />
      <Stack.Screen name="ClaimFormScreen" component={withScreenWrapper(ClaimFormScreen)} />
      <Stack.Screen name="PhotoCaptureScreen" component={withScreenWrapper(PhotoCaptureScreen)} />

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
      <Stack.Screen
        name="USTPMapScreen"
        component={USTPMapScreen}
        options={{ title: "USTP Campus Map", presentation: "modal" }} // optional customization
      />
    </Stack.Navigator>
  );
}
