import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

type InfoToastProps = {
  type: "lost" | "found";
  onClose: () => void;
};

export default function Info({ type, onClose }: InfoToastProps) {
  // Info boxes removed - no longer displayed
  return null;
}
