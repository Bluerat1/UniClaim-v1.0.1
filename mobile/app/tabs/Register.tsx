import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useCallback, memo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../types/type";
import { authService, getFirebaseErrorMessage } from "../../utils/firebase";

type FormErrors = {
  [key: string]: string | undefined;
  firstName?: string;
  lastName?: string;
  contactNumber?: string;
  studentId?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function Register() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Show registration form only for unauthenticated users

  const handleFirstNameChange = useCallback((text: string) => {
    setFirstName(text);
  }, []);

  const handleLastNameChange = useCallback((text: string) => {
    setLastName(text);
  }, []);

  const handleContactNumberChange = useCallback((text: string) => {
    setContactNumber(text);
  }, []);

  const handleStudentIdChange = useCallback((text: string) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    setStudentId(numericText);
    // Clear any existing error when user types
    setErrors(prev => ({ ...prev, studentId: '' }));
  }, []);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
  }, []);

  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPassword(text);
  }, []);

  const handleFocus = useCallback((field: string) => {
    setFocusedInput(field);
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedInput(null);
  }, []);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleRegister = async () => {
    const requestId = `ui_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    console.log(`🚀 [REG:${requestId}] Starting registration process`, {
      email,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      formData: {
        firstNameLength: firstName.length,
        lastNameLength: lastName.length,
        contactNumberLength: contactNumber.length,
        studentIdLength: studentId.length,
        emailLength: email.length,
        passwordLength: password.length,
        confirmPasswordLength: confirmPassword.length
      }
    });
    
    console.log(`📝 [REG:${requestId}] Validating form data...`);
    const validationStart = Date.now();
    const newErrors: FormErrors = {};

    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!contactNumber.trim())
      newErrors.contactNumber = "Contact number is required";
    if (!studentId.trim()) newErrors.studentId = "Student ID is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!validateEmail(email)) newErrors.email = "Invalid email address";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (!confirmPassword) newErrors.confirmPassword = "Please confirm password";
    else if (confirmPassword !== password)
      newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      console.warn(`❌ [REG:${requestId}] Form validation failed`, {
        errors: newErrors,
        timeTaken: `${Date.now() - validationStart}ms`,
        timestamp: new Date().toISOString()
      });
      setErrors(newErrors);
      return;
    }

    console.log(`✅ [REG:${requestId}] Form validation passed`, {
      timeTaken: `${Date.now() - validationStart}ms`,
      timestamp: new Date().toISOString()
    });
    
    console.log(`🔄 [REG:${requestId}] Starting Firebase registration...`);
    setIsLoading(true);
    const registrationStartTime = Date.now();
    
    // Log navigation state before registration
    const currentRoute = navigation.getState()?.routes[navigation.getState().index]?.name;
    console.log(`📍 [REG:${requestId}] Current navigation state`, {
      currentRoute,
      routeCount: navigation.getState()?.routes.length,
      canGoBack: navigation.canGoBack(),
      timestamp: new Date().toISOString()
    });
    try {
      console.log('🔑 [REGISTRATION] Attempting to register user with Firebase Auth...', {
        email,
        timestamp: new Date().toISOString()
      });

      // Register user with Firebase
      console.log(`📤 [REG:${requestId}] Sending registration request to Firebase...`, {
        email,
        hasPassword: !!password,
        firstNameLength: firstName.length,
        lastNameLength: lastName.length,
        contactNumberLength: contactNumber.length,
        studentIdLength: studentId.length,
        timestamp: new Date().toISOString()
      });
      const userCredential = await authService.register(
        email,
        password,
        firstName,
        lastName,
        contactNumber,
        studentId
      );

      const registrationTime = Date.now() - registrationStartTime;
      console.log(`✅ [REG:${requestId}] Firebase registration successful`, {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        emailVerified: userCredential.user.emailVerified,
        timeTaken: `${registrationTime}ms`,
        timestamp: new Date().toISOString(),
        metadata: {
          creationTime: userCredential.user.metadata.creationTime,
          lastSignInTime: userCredential.user.metadata.lastSignInTime
        }
      });

      // Prepare navigation state
      const navState = {
        target: 'EmailVerification',
        params: { 
          email: userCredential.user.email || email,
          fromLogin: false,
          registrationComplete: true
        },
        timestamp: new Date().toISOString()
      };

      console.log(`🔄 [REG:${requestId}] Preparing navigation to EmailVerification`, navState);
      
      try {
        // Clear loading state before navigation
        setIsLoading(false);
        
        // Log navigation attempt
        console.log(`🚀 [REG:${requestId}] Attempting navigation with replace...`, {
          navigationMethod: 'replace',
          ...navState,
          navigationStateBefore: {
            routes: navigation.getState()?.routes.map(r => r.name) || [],
            index: navigation.getState()?.index,
            canGoBack: navigation.canGoBack()
          }
        });
        
        // Use replace to avoid going back to registration
        navigation.replace('EmailVerification', navState.params);
        
        console.log(`✅ [REG:${requestId}] Navigation successful`, {
          ...navState,
          navigationMethod: 'replace',
          timestamp: new Date().toISOString()
        });
        
        return; // Exit the function after successful navigation
      } catch (navError) {
        console.error(`❌ [REG:${requestId}] Navigation with replace failed, falling back to navigate`, {
          error: navError,
          navigationMethod: 'navigate',
          ...navState,
          timestamp: new Date().toISOString()
        });
        
        // Fallback to regular navigation if replace fails
        try {
          navigation.navigate('EmailVerification', navState.params);
          
          console.log(`🔄 [REG:${requestId}] Fallback navigation successful`, {
            ...navState,
            navigationMethod: 'navigate',
            timestamp: new Date().toISOString()
          });
        } catch (fallbackError) {
          console.error(`❌ [REG:${requestId}] Fallback navigation also failed`, {
            error: fallbackError,
            originalError: navError,
            timestamp: new Date().toISOString(),
            navigationState: {
              routes: navigation.getState()?.routes.map(r => r.name) || [],
              index: navigation.getState()?.index,
              canGoBack: navigation.canGoBack()
            }
          });
          
          // As a last resort, try resetting the navigation stack
          try {
            navigation.reset({
              index: 0,
              routes: [{ name: 'EmailVerification', params: navState.params }],
            });
            console.log(`🔄 [REG:${requestId}] Navigation reset successful`);
          } catch (resetError) {
            console.error(`❌ [REG:${requestId}] All navigation attempts failed`, {
              resetError,
              fallbackError,
              originalError: navError,
              timestamp: new Date().toISOString()
            });
          }
        } finally {
          setIsLoading(false);
        }
        return;
      }
    } catch (error: any) {
      const errorTime = Date.now();
      const errorDetails = {
        requestId,
        errorCode: error?.code,
        errorMessage: error?.message,
        timeTaken: `${errorTime - startTime}ms`,
        timestamp: new Date().toISOString(),
        stack: error?.stack,
        navigationState: {
          currentRoute: navigation.getState()?.routes[navigation.getState().index]?.name,
          canGoBack: navigation.canGoBack(),
          routeCount: navigation.getState()?.routes.length
        },
        auth: error?.auth,
        email: error?.email,
        credential: error?.credential ? '[REDACTED]' : undefined,
        tenantId: error?.tenantId,
        appName: error?.appName,
        emailLink: error?.emailLink ? '[REDACTED]' : undefined,
        phoneNumber: error?.phoneNumber ? '[REDACTED]' : undefined,
        verificationId: error?.verificationId ? '[REDACTED]' : undefined
      };
      
      console.error(`❌ [REG:${requestId}] Registration failed`, errorDetails);
      
      // Log additional error details if available
      if (error.details) {
        console.error(`🔍 [REG:${requestId}] Additional error details:`, error.details);
      }
      
      // As a last resort, try resetting the navigation stack
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'EmailVerification', params: { email } }],
        });
        console.log(`🔄 [REG:${requestId}] Navigation reset successful`);
      } catch (resetError: any) {
        const resetErrorDetails = {
          error: resetError?.message,
          code: resetError?.code,
          stack: resetError?.stack,
          timestamp: new Date().toISOString()
        };
        
        console.error(`❌ [REG:${requestId}] All navigation attempts failed`, resetErrorDetails);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `bg-gray-100 rounded-lg px-5 h-[3.5rem] text-black border ${
      focusedInput === field
        ? "border-navyblue"
        : errors[field]
          ? "border-red-500"
          : "border-gray-300"
    }`;

  const passwordInputClass = (field: string) =>
    `flex-row items-center bg-gray-100 rounded-lg px-4 h-[3.5rem] border ${
      focusedInput === field
        ? "border-navyblue"
        : errors[field]
          ? "border-red-500"
          : "border-gray-300"
    }`;

  // Show loading screen during registration process
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center px-6">
        <View className="items-center">
          <ActivityIndicator size="large" color="#1e40af" />
          <Text className="text-sm font-manrope-medium text-gray-600 mt-4 text-center">
            Creating your account...
          </Text>
          <Text className="text-xs font-manrope-medium text-gray-500 mt-2 text-center">
            This may take a few moments...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1">
        <KeyboardAwareScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 36,
          }}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraHeight={100}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-7">
            <Text className="text-4xl font-albert-bold text-brand mb-2">
              Create Account
            </Text>
            <Text className="text-base font-manrope-medium text-black">
              Start your journey here at UniClaim
            </Text>
          </View>

          {/* First Name */}
          <View className="mb-4">
            <Text className="font-manrope-medium text-black mb-2">
              First Name
            </Text>
            <TextInput
              value={firstName}
              onChangeText={handleFirstNameChange}
              onFocus={() => handleFocus("firstName")}
              onBlur={handleBlur}
              placeholder="Enter first name"
              placeholderTextColor="#747476"
              style={{ fontFamily: "ManropeRegular", fontSize: 15 }}
              className={inputClass("firstName")}
            />
            {errors.firstName && (
              <Text className="text-red-500 font-manrope text-sm mt-2">
                {errors.firstName}
              </Text>
            )}
          </View>

          {/* Last Name */}
          <View className="mb-4">
            <Text className="font-manrope-medium text-black mb-2">
              Last Name
            </Text>
            <TextInput
              value={lastName}
              onChangeText={handleLastNameChange}
              onFocus={() => handleFocus("lastName")}
              onBlur={handleBlur}
              placeholder="Enter last name"
              placeholderTextColor="#747476"
              style={{ fontFamily: "ManropeRegular", fontSize: 15 }}
              className={inputClass("lastName")}
            />
            {errors.lastName && (
              <Text className="text-red-500 font-manrope text-sm mt-2">
                {errors.lastName}
              </Text>
            )}
          </View>

          {/* Contact Number */}
          <View className="mb-4">
            <Text className="font-manrope-medium text-black mb-2">
              Contact Number
            </Text>
            <TextInput
              value={contactNumber}
              onChangeText={handleContactNumberChange}
              onFocus={() => handleFocus("contactNumber")}
              onBlur={handleBlur}
              placeholder="Enter contact number"
              placeholderTextColor="#747476"
              style={{ fontFamily: "ManropeRegular", fontSize: 15 }}
              className={inputClass("contactNumber")}
            />
            {errors.contactNumber && (
              <Text className="text-red-500 font-manrope text-sm mt-2">
                {errors.contactNumber}
              </Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="font-manrope-medium text-black mb-2">
              Student ID
            </Text>
            <TextInput
              value={studentId}
              onChangeText={handleStudentIdChange}
              onFocus={() => handleFocus("studentId")}
              onBlur={handleBlur}
              placeholder="Ex. 2022123456"
              placeholderTextColor="#747476"
              keyboardType="numeric"
              maxLength={10}
              style={{ fontFamily: "ManropeRegular", fontSize: 15 }}
              className={inputClass("studentId")}
            />
            {errors.studentId && (
              <Text className="text-red-500 font-manrope text-sm mt-2">
                {errors.studentId}
              </Text>
            )}
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="font-manrope-medium text-black mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={handleEmailChange}
              onFocus={() => handleFocus("email")}
              onBlur={handleBlur}
              placeholder="Ex. juandelacruz@gmail.com"
              placeholderTextColor="#747476"
              style={{ fontFamily: "ManropeRegular", fontSize: 15 }}
              className={inputClass("email")}
            />
            {errors.email && (
              <Text className="text-red-500 font-manrope text-sm mt-2">
                {errors.email}
              </Text>
            )}
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="font-manrope-medium text-black mb-2">
              Password
            </Text>
            <View className={passwordInputClass("password")}>
              <TextInput
                value={password}
                onChangeText={handlePasswordChange}
                onFocus={() => handleFocus("password")}
                onBlur={handleBlur}
                placeholder="Enter password"
                placeholderTextColor="#747476"
                secureTextEntry={!showPassword}
                style={{ fontFamily: "ManropeRegular", fontSize: 15 }}
                className="flex-1 text-black"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye" : "eye-off"}
                  size={20}
                  color="#000"
                />
              </Pressable>
            </View>
            {errors.password && (
              <Text className="text-red-500 font-manrope text-sm mt-2">
                {errors.password}
              </Text>
            )}
          </View>

          {/* Confirm Password */}
          <View className="mb-4">
            <Text className="font-manrope-medium text-black mb-2">
              Confirm Password
            </Text>
            <View className={passwordInputClass("confirmPassword")}>
              <TextInput
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                onFocus={() => handleFocus("confirmPassword")}
                onBlur={handleBlur}
                placeholder="Re-enter password"
                placeholderTextColor="#747476"
                secureTextEntry={!showConfirmPassword}
                style={{ fontFamily: "ManropeRegular", fontSize: 15 }}
                className="flex-1 text-black"
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye" : "eye-off"}
                  size={20}
                  color="#000"
                />
              </Pressable>
            </View>
            {errors.confirmPassword && (
              <Text className="text-red-500 font-manrope text-sm mt-2">
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Register Button */}
          <TouchableOpacity
            className={`flex items-center justify-center py-4 rounded-xl mt-6 ${
              isLoading ? "bg-gray-400" : "bg-brand"
            }`}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white text-base font-manrope-medium ml-2">
                  Creating account...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-lg font-semibold font-manrope-medium">
                Register
              </Text>
            )}
          </TouchableOpacity>

          {/* Already have an account */}
          <View className="flex-row justify-center mt-6 mb-8">
            <Text className="text-base text-gray-700 font-manrope-medium">
              Already have an account?{" "}
            </Text>
            <Pressable onPress={() => navigation.navigate("Login", undefined)}>
              <Text className="text-base font-manrope-medium text-brand underline">
                Login Here
              </Text>
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}

const MemoizedRegister = memo(Register);
export default MemoizedRegister;
