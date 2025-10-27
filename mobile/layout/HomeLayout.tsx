import Header from "../components/Header";
import React, { PropsWithChildren } from "react";
import { View } from "react-native";

export default function HomeLayout({ children }: PropsWithChildren<{}>) {
  return (
    <View className="flex-1 bg-white">
      <View className="flex-1">
        <Header />
        <View className="mt-1 space-y-3 flex-1">{children}</View>
      </View>
    </View>
  );
}
