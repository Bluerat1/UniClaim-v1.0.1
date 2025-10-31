import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState, useCallback, memo } from "react";
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
    setStudentId(text);
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
    console.log('🚀 [REGISTRATION] Starting registration process...', {
      email,
      timestamp: new Date().toISOString()
    });
    
    console.log('📝 [REGISTRATION] Validating form data...');
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
      console.warn('❌ [REGISTRATION] Form validation failed:', newErrors);
      setErrors(newErrors);
      return;
    }

    console.log('✅ Form validation passed');
    console.log('🔄 Starting Firebase registration...');
    setIsLoading(true);

    const registrationStartTime = Date.now();
    try {
      console.log('🔑 [REGISTRATION] Attempting to register user with Firebase Auth...', {
        email,
        timestamp: new Date().toISOString()
      });

      // Register user with Firebase
      console.log('📤 Sending registration request to Firebase...', {
        email,
        hasPassword: !!password,
        firstName,
        lastName,
        contactNumber,
        studentId
      });
      const userCredential = await authService.register(
        email,
        password,
        firstName,
        lastName,
        contactNumber,
        studentId
      );

      console.log('✅ [REGISTRATION] User registration successful', {
        uid: userCredential.user.uid,
        emailVerified: userCredential.user.emailVerified,
        timeTaken: `${Date.now() - registrationStartTime}ms`,
        timestamp: new Date().toISOString()
      });

      console.log('🎉 [REGISTRATION] Registration successful, navigating to EmailVerification', {
        email: userCredential.user.email,
        uid: userCredential.user.uid,
        timestamp: new Date().toISOString()
      });
      
      // Force navigation to EmailVerification screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'EmailVerification' }],
      });

      try {
        // First, ensure any loading state is cleared
        setIsLoading(false);
        
        // Use replace instead of reset to avoid going back to registration
        navigation.replace('EmailVerification', { 
          email, 
          fromLogin: false 
        });
        
        return; // Exit the function after navigation
      } catch (navError) {
        console.error('❌ Navigation error:', navError);
        // Fallback to regular navigation if replace fails
        navigation.navigate('EmailVerification', { 
          email, 
          fromLogin: false 
        });
        setIsLoading(false);
        return;
      }
    } catch (error: any) {
      console.error('❌ Registration failed:', {
        errorCode: error?.code,
        errorMessage: error?.message,
        timestamp: new Date().toISOString()
      });
      console.error('❌ [REGISTRATION] Registration failed:', {
        error: error.message || error,
        code: error.code,
        timeTaken: `${Date.now() - registrationStartTime}ms`,
        timestamp: new Date().toISOString()
      });
      
      Alert.alert(
        "Registration Failed", 
        error.message || 'An error occurred during registration. Please try again.'
      );
      setIsLoading(false);
    } finally {
      console.log('⏱️ [REGISTRATION] Registration process completed in', 
        `${Date.now() - registrationStartTime}ms`,
        { timestamp: new Date().toISOString() }
      );
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
          <Text className="text-lg font-manrope-bold text-brand mt-4">
            Account created successfully!
          </Text>
          <Text className="text-sm font-manrope-medium text-gray-600 mt-2 text-center">
            Please verify your email to access the app. Check your inbox for the verification link.
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

export default memo(Register);
