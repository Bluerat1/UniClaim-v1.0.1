import ScreenWrapper from "../../components/ScreenWrapper";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../types/type";

// test-only

export default function Index({ onContinue }: { onContinue: () => void }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScreenWrapper statusBarBg="#FBFDFC" statusBarStyle="dark-content">
      <SafeAreaView className="flex-1 flex-col items-center justify-between p-5">
        {/* logo with text section */}
        <View className="flex items-center justify-center">
          <View className="flex-row items-center gap-1">
            <Image
              source={require("../../assets/images/uniclaimlogo.png")}
              className="size-10"
            />
            <Text className="text-navyblue font-albert-bold text-2xl">
              <Text className="text-brand">Uni</Text>Claim
            </Text>
          </View>
        </View>
        {/* image container */}
        <View className="flex justify-center items-center w-full">
          <Image
            source={require("../../assets/images/opening_image.png")}
            className="w-[21rem] h-[18rem] object-cover rounded-md"
          />

          <View className="w-full px-4 mt-4">
            <Text className="text-3xl font-semibold font-manrope-semibold text-center mb-3">
              Welcome to <Text className="text-brand">Uni</Text>Claim
            </Text>
            <Text className="font-inter text-base text-center mt-1 text-zinc-700">
              Easily Report and Find Items at{"\n"}USTP-CDO with UniClaim
            </Text>
          </View>
        </View>

        {/* buttons */}
        <View className="w-full">
          <TouchableOpacity
            className="bg-brand flex items-center justify-center py-4 rounded-xl mb-3"
            onPress={() => navigation.navigate("Login")}
          >
            <Text className="font-manrope-medium text-white text-lg">
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="border border-brand flex items-center justify-center py-4 rounded-xl"
            onPress={() => navigation.navigate("Register")}
          >
            <Text className="font-manrope-medium text-brand text-lg">
              Register here
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ScreenWrapper>
  );
}
