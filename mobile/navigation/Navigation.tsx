// Navigation.tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { auth, authService, UserData, db, userService } from '../utils/firebase';
import React, { useState, useEffect, Suspense } from "react";
import { View, ActivityIndicator, Text, SafeAreaView } from "react-native";
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
import Toast from "../components/Toast";
import { useToast } from "../context/ToastContext";

// Screens - using relative imports for EAS build compatibility
import Chat from "../app/Chat";
import EmailVerification from "../app/tabs/EmailVerification";
import ForgotPassword from "../app/tabs/ForgotPassword";
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

// Linking configuration for deep links
const linking = {
  prefixes: ['uniclaimapp://'],
  config: {
    screens: {
      Index: '',
      OnBoarding: 'onboarding',
      Login: 'login',
      Register: 'register',
      Home: 'home',
      Profile: 'profile',
      Report: 'report',
      Message: 'message',
      PostDetails: 'post/:id',
      ItemDetails: 'item/:id',
      Chat: 'chat/:id',
      ClaimFormScreen: 'claim',
      PhotoCaptureScreen: 'photo-capture',
      USTPMapScreen: 'map',
      EmailVerification: 'email-verification',
      ForgotPassword: 'forgot-password'
    }
  }
};

const withScreenWrapper = <P extends object>(Component: React.ComponentType<P>) => {
  return (props: P) => (
    <ScreenWrapper statusBarStyle="dark-content" statusBarBg="#fff">
      <Component {...props} />
    </ScreenWrapper>
  );
};

// Navigation wrapper component that includes Toast
const NavigationWrapper = ({ children, toastProps }: {
  children: React.ReactNode;
  toastProps: { showToast: boolean; toastMessage: string; toastType: string; toastDuration: number; }
}) => (
  <>
    {children}
    <Toast
      visible={toastProps.showToast}
      message={toastProps.toastMessage}
      type={toastProps.toastType as any}
      duration={toastProps.toastDuration}
      onClose={() => {}}
    />
  </>
);

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

  // Add toast context
  const { showToast, toastMessage, toastType, toastDuration } = useToast();

  // Force re-render when authentication state changes
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [isAuthenticated, user, loading, needsEmailVerification]);

  // Debug logging for navigation state changes
  useEffect(() => {
    console.log('🔄 Navigation Debug:', {
      renderKey,
      isAuthenticated,
      user: !!user,
      userData: !!userData,
      isBanned,
      needsEmailVerification,
      loading,
      loginAttemptFailed
    });
  }, [renderKey, isAuthenticated, user, userData, isBanned, needsEmailVerification, loading, loginAttemptFailed, showToast, toastMessage, toastType, toastDuration]);

  // Determine which navigator to show based on authentication state
  let navigatorContent;

  if (loading) {
    navigatorContent = (
      <NavigationWrapper toastProps={{ showToast, toastMessage, toastType, toastDuration }}>
        <SafeAreaView className="flex-1 bg-white justify-center items-center px-6">
          <View className="items-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="text-lg font-manrope-bold text-brand mt-4">
              Loading...
            </Text>
          </View>
        </SafeAreaView>
      </NavigationWrapper>
    );
  } else if (!isAuthenticated && !user && !loginAttemptFailed) {
    // Show login screen when not authenticated and no failed login attempt
    navigatorContent = (
      <NavigationWrapper toastProps={{ showToast, toastMessage, toastType, toastDuration }}>
        <Stack.Navigator
          key="unauth-navigation"
          initialRouteName="Login"
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
          <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
          <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
          <Stack.Screen name="ForgotPassword" component={withScreenWrapper(ForgotPassword)} />
          <Stack.Screen name="Index">{() => <Index onContinue={() => {}} />}</Stack.Screen>
          <Stack.Screen name="EmailVerification">
            {() => (
              <Suspense fallback={<ScreenLoader />}>
                <EmailVerification />
              </Suspense>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationWrapper>
    );
  } else if (user && isBanned) {
    navigatorContent = (
      <NavigationWrapper toastProps={{ showToast, toastMessage, toastType, toastDuration }}>
        <Stack.Navigator
          key={`banned-navigation-${renderKey}`}
          initialRouteName="Index"
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
          <Stack.Screen name="Index">{() => <Index onContinue={() => {}} />}</Stack.Screen>
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
      </NavigationWrapper>
    );
  } else if (!isAuthenticated && !user && loginAttemptFailed) {
    navigatorContent = (
      <NavigationWrapper toastProps={{ showToast, toastMessage, toastType, toastDuration }}>
        <Stack.Navigator
          key={`login-failed-navigation-${renderKey}`}
          initialRouteName="Login"
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
          <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
          <Stack.Screen name="Register" component={withScreenWrapper(Register)} />
          <Stack.Screen name="ForgotPassword" component={withScreenWrapper(ForgotPassword)} />
          <Stack.Screen name="Index">{() => <Index onContinue={() => {}} />}</Stack.Screen>
          <Stack.Screen name="EmailVerification">
            {() => (
              <Suspense fallback={<ScreenLoader />}>
                <EmailVerification />
              </Suspense>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationWrapper>
    );
  } else if (user && !isBanned) {
    navigatorContent = (
      <NavigationWrapper toastProps={{ showToast, toastMessage, toastType, toastDuration }}>
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
          <Stack.Screen name="PostDetails">
            {() => (
              <Suspense fallback={<ScreenLoader />}>
                <PostDetails />
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
      </NavigationWrapper>
    );
  } else if (needsEmailVerification) {
    navigatorContent = (
      <NavigationWrapper toastProps={{ showToast, toastMessage, toastType, toastDuration }}>
        <Stack.Navigator
          key={`email-verification-navigation-${renderKey}`}
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
          <Stack.Screen name="ForgotPassword" component={withScreenWrapper(ForgotPassword)} />
          <Stack.Screen name="Index">{() => <Index onContinue={() => {}} />}</Stack.Screen>
        </Stack.Navigator>
      </NavigationWrapper>
    );
  } else {
    // Default case: show onboarding or index
    const initialRoute = !hasSeenOnBoarding ? "OnBoarding" : !hasPassedIndex ? "Index" : "RootBottomTabs";
    navigatorContent = (
      <NavigationWrapper toastProps={{ showToast, toastMessage, toastType, toastDuration }}>
        <Stack.Navigator
          key={`main-navigation-${renderKey}`}
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
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
      </NavigationWrapper>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {navigatorContent}
    </NavigationContainer>
  );
}
