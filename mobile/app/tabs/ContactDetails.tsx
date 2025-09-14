import React from "react";
import { Text, View } from "react-native";
import Info from "../../components/Info";

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
  const showAnyInfo = showLostInfo || showFoundInfo;

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

      {/* name sa nag post dari ibutang */}
      <View className="mb-3 mt-3">
        <Text className="mb-2 text-base font-manrope-semibold">Full Name</Text>
        <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
          <Text className="text-base capitalize font-manrope-medium text-black">
            Display dari ang name sa nag post
          </Text>
        </View>
      </View>

      {/* name sa nag post dari ibutang */}
      <View className="mt-1 mb-3">
        <Text className="mb-2 text-base font-manrope-semibold">
          Contact Number
        </Text>
        <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
          <Text className="text-base capitalize font-manrope-medium text-black">
            Display dari ang contact number sa nag post
          </Text>
        </View>
      </View>

      {/* name sa nag post dari ibutang */}
      <View className="mt-1 mb-3">
        <Text className="mb-2 text-base font-manrope-semibold">Email</Text>
        <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
          <Text className="text-base capitalize font-manrope-medium text-black">
            Display dari ang email sa nag post
          </Text>
        </View>
      </View>
    </View>
  );
}
