import React from "react";
import { Text, View, ActivityIndicator } from "react-native";
import Info from "../../components/Info";
import { useAuth } from "../../context/AuthContext";

type Props = {
  showLostInfo: boolean;
  showFoundInfo: boolean;
  setShowLostInfo: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFoundInfo: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function ContactDetails({
  showLostInfo,
  showFoundInfo,
  setShowLostInfo,
  setShowFoundInfo,
}: Props) {
  const { userData, loading } = useAuth();
  const showAnyInfo = showLostInfo || showFoundInfo;

  // Show loading state while checking auth
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text className="text-gray-500 text-base font-manrope-medium mt-3">
          Loading contact details...
        </Text>
      </View>
    );
  }

  // Show error if no user data
  if (!userData) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-red-500 text-base font-manrope-medium">
          Please log in to view contact details
        </Text>
      </View>
    );
  }

  return (
    <View className="">
      <View className={`flex-col gap-3 ${showAnyInfo ? "mt-3" : "mt-0"}`}>
        {showLostInfo && (
          <Info type="lost" onClose={() => setShowLostInfo(false)} />
        )}
        {showFoundInfo && (
          <Info type="found" onClose={() => setShowFoundInfo(false)} />
        )}
      </View>

      {/* Your contact details section */}
      <View className="mb-3 mt-3">
        <Text className="mb-2 text-base font-manrope-semibold">Your contact details</Text>
      </View>

      {/* Full Name */}
      <View className="mb-3 mt-3">
        <Text className="mb-2 text-base font-manrope-semibold">Full Name</Text>
        <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
          <Text className="text-base capitalize font-manrope-medium text-black">
            {userData.firstName} {userData.lastName}
          </Text>
        </View>
      </View>

      {/* Contact Number */}
      <View className="mt-1 mb-3">
        <Text className="mb-2 text-base font-manrope-semibold">
          Contact Number
        </Text>
        <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
          <Text className="text-base capitalize font-manrope-medium text-black">
            {userData.contactNum || 'Not provided'}
          </Text>
        </View>
      </View>

      {/* Email */}
      <View className="mt-1 mb-3">
        <Text className="mb-2 text-base font-manrope-semibold">Email</Text>
        <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
          <Text className="text-base capitalize font-manrope-medium text-black">
            {userData.email}
          </Text>
        </View>
      </View>
    </View>
  );
}
