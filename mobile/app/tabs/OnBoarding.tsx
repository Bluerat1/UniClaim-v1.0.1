import ScreenWrapper from "../../components/ScreenWrapper";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../types/type";
import { onboardingStorage } from "../../utils/onboardingStorage";

const { width } = Dimensions.get("window");

const slides = [
  {
    key: "1",
    title: "Start a Conversation",
    description:
      "Connect instantly to discuss the item and share important details.",
    image: require("../../assets/images/chat.png"),
  },
  {
    key: "2",
    title: "Report an Item",
    description:
      "Add item info, upload images, and tag where it was lost or found.",
    image: require("../../assets/images/post.png"),
  },
  {
    key: "3",
    title: "Advanced Search Filter",
    description: "Use filters to quickly narrow down lost or found items.",
    image: require("../../assets/images/filter.png"),
  },
];

export default function OnBoarding({ onFinish }: { onFinish: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const flatListRef = useRef<FlatList>(null);

  const onSkip = async () => {
    try {
      // Save that onboarding has been completed
      await onboardingStorage.setOnboardingCompleted();
      // Call the onFinish callback to update parent state
      onFinish();
      // Navigate to Index screen
      navigation.replace("Index");
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      // Still navigate even if saving fails
      onFinish();
      navigation.replace("Index");
    }
  };

  const onComplete = async () => {
    try {
      // Save that onboarding has been completed
      await onboardingStorage.setOnboardingCompleted();
      // Call the onFinish callback to update parent state
      onFinish();
      // Navigate to Index screen
      navigation.replace("Index");
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      // Still navigate even if saving fails
      onFinish();
      navigation.replace("Index");
    }
  };

  return (
    <ScreenWrapper statusBarBg="#ffffff" statusBarStyle="dark-content">
      <SafeAreaView className="flex-1 bg-white">
        {/* Skip/Complete Button */}
        <View className="w-full items-end px-6">
          <TouchableOpacity
            onPress={currentIndex === slides.length - 1 ? onComplete : onSkip}
            className="flex-row items-center mt-4"
          >
            <Text className="text-navyblue font-manrope-medium font-semibold text-base mr-2">
              {currentIndex === slides.length - 1
                ? "Start Using UniClaim"
                : "Skip"}
            </Text>
            <Feather name="arrow-right" className="size-17 text-navyblue" />
          </TouchableOpacity>
        </View>

        {/* Slide Content */}
        <View className="flex-1">
          <FlatList
            ref={flatListRef}
            data={slides}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))
            }
            renderItem={({ item }) => (
              <View className="w-screen items-center justify-center px-6 mt-6">
                <Image
                  source={item.image}
                  className="size-[20rem] mb-10"
                  resizeMode="contain"
                />
                <Text className="text-3xl font-albert-bold text-brand text-center mb-3">
                  {item.title}
                </Text>
                <Text className="text-center font-manrope-medium text-base text-gray-600">
                  {item.description}
                </Text>
              </View>
            )}
          />
        </View>

        {/* Bottom Progress and Info */}
        <View className="px-6 pt-1 pb-2 bg-white">
          <Text className="text-center font-manrope text-zinc-400">
            Swipe right to proceed
          </Text>
          <View className="flex-row justify-center gap-2 mt-4 mb-2">
            {slides.map((_, i) => (
              <View
                key={i}
                className="w-8 h-1.5 rounded-full bg-gray-300 overflow-hidden"
              >
                {i <= currentIndex && (
                  <View className="absolute left-0 top-0 h-full bg-brand w-full" />
                )}
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </ScreenWrapper>
  );
}
