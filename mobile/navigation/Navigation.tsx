// Navigation.tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { navigationRef } from "../context/AuthContext";
import {
  auth,
  authService,
  UserData,
  db,
  userService,
} from "../utils/firebase";
import React, { useState, useEffect, Suspense } from "react";
import { View, ActivityIndicator, Text, SafeAreaView } from "react-native";
import type { RootStackParamList } from "../types/type";
import { useAuth } from "../context/AuthContext";

// Simple loading component for Suspense fallback
const ScreenLoader = () => (
  <View
    style={{
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#fff",
    }}
  >
    <ActivityIndicator size="large" color="#2563eb" />
  </View>
);

// Components
import CustomTabs from "../components/BottomTabs";
import ScreenWrapper from "../components/ScreenWrapper";

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
  prefixes: ["uniclaimapp://"],
  config: {
    screens: {
      Index: "",
      OnBoarding: "onboarding",
      Login: "login",
      Register: "register",
      Home: "home",
      Profile: "profile",
      Report: "report",
      Message: "message",
      PostDetails: "post/:id",
      ItemDetails: "item/:id",
      Chat: "chat/:id",
      ClaimFormScreen: "claim",
      PhotoCaptureScreen: "photo-capture",
      USTPMapScreen: "map",
      EmailVerification: "email-verification",
      ForgotPassword: "forgot-password",
    },
  },
};

const withScreenWrapper = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P) => (
    <ScreenWrapper statusBarStyle="dark-content" statusBarBg="#fff">
      <Component {...props} />
    </ScreenWrapper>
  );
};

// Navigation wrapper component
const NavigationWrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
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
  const [foundAction, setFoundAction] = useState<
    "keep" | "turnover to OSA" | "turnover to Campus Security" | null
  >(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const {
    user,
    userData,
    isBanned,
    isAuthenticated,
    needsEmailVerification,
    loading,
    loginAttemptFailed,
  } = useAuth();

  // Track previous state to only force re-render when navigator type changes
  const [renderKey, setRenderKey] = useState(0);
  const previousStateRef = React.useRef<{
    wasLoading: boolean;
    wasAuthenticated: boolean;
    hadUser: boolean;
    hadEmailVerification: boolean;
    hadLoginFailed: boolean;
    wasBanned: boolean;
  } | null>(null);

  useEffect(() => {
    console.log("[NAVIGATION] Auth state updated", {
      isAuthenticated,
      user: user ? "User exists" : "No user",
      loading,
      needsEmailVerification,
      loginAttemptFailed,
      userEmail: user?.email || "No email",
      userVerified: user?.emailVerified ? "Verified" : "Not verified",
    });

    // Determine current navigator type
    let currentNavigator = "unknown";
    if (loading) {
      currentNavigator = "loading";
    } else if (
      (!isAuthenticated || !user) &&
      !loginAttemptFailed &&
      !needsEmailVerification
    ) {
      currentNavigator = "unauth";
    } else if ((user || isAuthenticated) && needsEmailVerification) {
      currentNavigator = "email-verification";
    } else if (user && isBanned) {
      currentNavigator = "banned";
    } else if (!isAuthenticated && !user && loginAttemptFailed) {
      currentNavigator = "login-failed";
    } else if (user && !isBanned) {
      currentNavigator = "authenticated";
    }

    // Determine previous navigator type
    const prevState = previousStateRef.current;
    let previousNavigator = "unknown";
    if (prevState) {
      if (prevState.wasLoading) {
        previousNavigator = "loading";
      } else if (
        (!prevState.wasAuthenticated || !prevState.hadUser) &&
        !prevState.hadLoginFailed &&
        !prevState.hadEmailVerification
      ) {
        previousNavigator = "unauth";
      } else if (
        (prevState.hadUser || prevState.wasAuthenticated) &&
        prevState.hadEmailVerification
      ) {
        previousNavigator = "email-verification";
      } else if (prevState.hadUser && prevState.wasBanned) {
        previousNavigator = "banned";
      } else if (
        !prevState.wasAuthenticated &&
        !prevState.hadUser &&
        prevState.hadLoginFailed
      ) {
        previousNavigator = "login-failed";
      } else if (prevState.hadUser && !prevState.wasBanned) {
        previousNavigator = "authenticated";
      }
    }

    // Only increment renderKey if the navigator type actually changed
    if (previousNavigator !== currentNavigator) {
      console.log(
        `[NAVIGATION] Navigator changed from ${previousNavigator} to ${currentNavigator}, incrementing renderKey`
      );
      setRenderKey((prev) => prev + 1);
    }

    // Update previous state
    previousStateRef.current = {
      wasLoading: loading,
      wasAuthenticated: isAuthenticated,
      hadUser: !!user,
      hadEmailVerification: needsEmailVerification,
      hadLoginFailed: loginAttemptFailed,
      wasBanned: isBanned,
    };
  }, [
    isAuthenticated,
    user,
    loading,
    needsEmailVerification,
    loginAttemptFailed,
    isBanned,
  ]);

  // Determine which navigator to show based on authentication state
  let navigatorContent;

  if (loading) {
    console.log("[NAVIGATION] Rendering loading state");
    navigatorContent = (
      <NavigationWrapper>
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
  } else if (
    (!isAuthenticated || !user) &&
    !loginAttemptFailed &&
    !needsEmailVerification
  ) {
    console.log(
      "[NAVIGATION] Rendering unauthenticated flow - showing Index screen"
    );
    // Show Index screen first when not authenticated
    navigatorContent = (
      <NavigationWrapper>
        <Stack.Navigator
          key={`unauth-navigation-${renderKey}`}
          initialRouteName="Index"
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
          <Stack.Screen name="Index">
            {() => (
              <Index
                onContinue={() => navigationRef.current?.navigate("Login")}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
          <Stack.Screen
            name="Register"
            component={withScreenWrapper(Register)}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={withScreenWrapper(ForgotPassword)}
          />
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
  } else if ((user || isAuthenticated) && needsEmailVerification) {
    console.log("[NAVIGATION] Rendering email verification flow", {
      userEmail: user?.email || "No email",
      emailVerified: user?.emailVerified || false,
      needsEmailVerification,
    });
    // Show email verification screen
    navigatorContent = (
      <NavigationWrapper>
        <Stack.Navigator
          key={`verification-navigation-${renderKey}`}
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
          <Stack.Screen
            name="Register"
            component={withScreenWrapper(Register)}
          />
          <Stack.Screen name="Index">
            {() => <Index onContinue={() => {}} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationWrapper>
    );
  } else if (user && isBanned) {
    console.log("[NAVIGATION] Rendering banned user flow", {
      userEmail: user.email,
      isBanned,
    });
    navigatorContent = (
      <NavigationWrapper>
        <Stack.Navigator
          key={`banned-navigation-${renderKey}`}
          initialRouteName="Index"
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
          <Stack.Screen name="Index">
            {() => <Index onContinue={() => {}} />}
          </Stack.Screen>
          <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
          <Stack.Screen
            name="Register"
            component={withScreenWrapper(Register)}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={withScreenWrapper(ForgotPassword)}
          />
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
      <NavigationWrapper>
        <Stack.Navigator
          key={`login-failed-navigation-${renderKey}`}
          initialRouteName="Login"
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
          <Stack.Screen name="Login" component={withScreenWrapper(Login)} />
          <Stack.Screen
            name="Register"
            component={withScreenWrapper(Register)}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={withScreenWrapper(ForgotPassword)}
          />
          <Stack.Screen name="Index">
            {() => <Index onContinue={() => {}} />}
          </Stack.Screen>
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
      <NavigationWrapper>
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
          <Stack.Screen
            name="Register"
            component={withScreenWrapper(Register)}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={withScreenWrapper(ForgotPassword)}
          />
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
      <NavigationWrapper>
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
          <Stack.Screen
            name="Register"
            component={withScreenWrapper(Register)}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={withScreenWrapper(ForgotPassword)}
          />
          <Stack.Screen name="Index">
            {() => <Index onContinue={() => {}} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationWrapper>
    );
  } else {
    // Default case: show onboarding or index
    const initialRoute = !hasSeenOnBoarding
      ? "OnBoarding"
      : !hasPassedIndex
      ? "Index"
      : "RootBottomTabs";
    navigatorContent = (
      <NavigationWrapper>
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
    <NavigationContainer
      ref={
        navigationRef as React.Ref<NavigationContainerRef<RootStackParamList>>
      }
      linking={linking}
      fallback={<ScreenLoader />}
    >
      {navigatorContent}
    </NavigationContainer>
  );
}
