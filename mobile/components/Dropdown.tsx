import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type DropdownProps = {
  label?: string;
  data: string[];
  selected: string | null;
  setSelected: (value: string | null) => void;
  placeholder?: string;
};

const CustomDropdown = ({
  label,
  data,
  selected,
  setSelected,
  placeholder = "Select a category",
}: DropdownProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mb-4 z-50">
      {label && (
        <Text className="text-base font-manrope-semibold text-black mb-2">
          {label}
        </Text>
      )}

      {/* Dropdown Button */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="flex-row justify-between items-center bg-white border border-gray-300 rounded-md px-4 py-3"
      >
        <Text
          className={`text-base flex-1 font-inter ${
            selected ? "text-gray-800" : "text-gray-600"
          }`}
        >
          {selected || placeholder}
        </Text>

        <View className="flex-row items-center space-x-2">
          {selected && (
            <Pressable onPress={() => setSelected(null)} hitSlop={10}>
              <Ionicons name="close" size={20} color="#4B5563" />
            </Pressable>
          )}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#4B5563"
          />
        </View>
      </TouchableOpacity>

      {/* Dropdown Menu */}
      {expanded && (
        <View className="mt-2 bg-white border border-gray-300 rounded-md shadow-md elevation-5 max-h-48">
          <ScrollView nestedScrollEnabled>
            {data.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  setSelected(item);
                  setExpanded(false);
                }}
                className="px-4 py-3 border-b border-gray-200"
              >
                <Text className="text-md font-inter text-gray-800">{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default CustomDropdown;
