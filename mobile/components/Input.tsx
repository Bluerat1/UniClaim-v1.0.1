import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CustomDropdownWithSearch from "../components/DropdownWithSearch";
import { USTP_LOCATIONS, ITEM_CATEGORIES } from "../constants";

type Props = {
  query: string;
  setQuery: (val: string) => void;
  categorySearch: string;
  setCategorySearch: (val: string) => void;
  locationSearch: string;
  setLocationSearch: (val: string) => void;
  descriptionSearch: string;
  setDescriptionSearch: (val: string) => void;
  numeric?: boolean;
};

export default function SearchWithToggle({
  query,
  setQuery,
  categorySearch,
  setCategorySearch,
  locationSearch,
  setLocationSearch,
  descriptionSearch,
  setDescriptionSearch,
  numeric = false,
}: Props) {
  const [filterVisible, setFilterVisible] = useState(false);
  const [categoryExpanded, setCategoryExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleFilter = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: filterVisible ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setFilterVisible(!filterVisible);
  };

  const toggleWithLayout = (fn: () => void) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    fn();
  };

  const handleLocationSelect = (value: string | null) => {
    setLocationSearch(value || "");
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const clearAllFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQuery("");
    setCategorySearch("");
    setLocationSearch("");
    setDescriptionSearch("");
    setCategoryExpanded(false);
  };

  const InputDropdown = ({
    label,
    value,
    expanded,
    onToggle,
    options,
    onSelect,
  }: {
    label: string;
    value: string;
    expanded: boolean;
    onToggle: () => void;
    options: string[];
    onSelect: (val: string) => void;
  }) => (
    <View>
      <Text className="text-sm font-manrope-semibold text-gray-700 mb-3">
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => toggleWithLayout(onToggle)}
        className="flex-row items-center bg-white/30 border border-gray-300 rounded-md px-3 h-[3rem] backdrop-blur-md"
        activeOpacity={0.8}
      >
        <Text
          className={`flex-1 text-base font-manrope tracking-tight ${
            value ? "text-gray-700" : "text-gray-700"
          }`}
        >
          {value || `Select ${label.toLowerCase()}`}
        </Text>
        {value && (
          <Pressable onPress={() => onSelect("")} hitSlop={30}>
            <Ionicons name="close-outline" size={20} color="#4B5563" />
          </Pressable>
        )}
        <Ionicons
          name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
          size={20}
          color="#4B5563"
        />
      </TouchableOpacity>

      {expanded && (
        <View
          className="bg-white/90 border border-gray-200 rounded-md mt-1"
          style={{ maxHeight: 200 }}
        >
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                className="px-4 py-2"
                onPress={() =>
                  toggleWithLayout(() => {
                    onSelect(opt);
                    onToggle();
                  })
                }
              >
                <Text className="text-base text-gray-700 py-1 font-manrope">
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View className="w-full">
      {/* Search Row */}
      <View className="flex-row items-center gap-2">
        <View className="flex-1 bg-gray-100 border border-zinc-300 rounded-md px-2 h-[3.3rem] flex-row items-center">
          <TextInput
            className="flex-1 text-gray-800 text-[13px] ml-1 font-manrope"
            placeholder="Search an item"
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="#6B7280"
          />
        </View>
        {/* Search Icon Button */}
        <TouchableOpacity className="bg-yellow-500 rounded-md w-auto h-[3.3rem] items-center justify-center px-3">
          {/* <Ionicons name="search-outline" size={23} color="#fff" /> */}
          <Text className="text-white text-base font-manrope-medium">
            Search
          </Text>
        </TouchableOpacity>

        {/* Filter Toggle */}
        <TouchableOpacity
          className="bg-slate-900 rounded-md px-3 h-[3.3rem] items-center justify-center"
          onPress={toggleFilter}
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="filter-outline" size={23} color="#fff" />
          </Animated.View>
        </TouchableOpacity>

        {/* X (Clear) Icon */}
        {(query || categorySearch || locationSearch || descriptionSearch) && (
          <TouchableOpacity
            className="bg-red-500 rounded-md px-3 h-[3.3rem] items-center justify-center"
            onPress={clearAllFilters}
          >
            <Ionicons name="close-outline" size={23} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Section */}
      {filterVisible && (
        <View className="mt-4 space-y-4">
          <InputDropdown
            label="Item Category"
            value={categorySearch}
            expanded={categoryExpanded}
            onToggle={() => setCategoryExpanded(!categoryExpanded)}
            options={ITEM_CATEGORIES}
            onSelect={setCategorySearch}
          />
          <View className="mb-4">
            <Text className="text-sm font-manrope-semibold text-gray-700 mb-1 mt-3">
              Description
            </Text>
            <TextInput
              className="h-[3rem] w-full bg-white/30 border border-gray-300 rounded-md px-3 text-gray-700 text-base font-manrope tracking-tight"
              placeholder="Enter description"
              placeholderTextColor="#9CA3AF"
              value={descriptionSearch}
              onChangeText={(text) => {
                if (numeric) {
                  // Only allow numeric input
                  const numericText = text.replace(/[^0-9]/g, '');
                  setDescriptionSearch(numericText);
                } else {
                  setDescriptionSearch(text);
                }
              }}
              keyboardType={numeric ? 'numeric' : 'default'}
              style={{ textAlignVertical: 'center' }}
            />
          </View>
          {/* last known location */}
          <CustomDropdownWithSearch
            label="Last Known Location"
            data={USTP_LOCATIONS}
            selected={locationSearch}
            setSelected={handleLocationSelect}
            placeholder="Select a place"
          />
        </View>
      )}
    </View>
  );
}






// mobile/components/Input.tsx
import { ITEM_CATEGORIES } from "../constants";

// inside the component
<InputDropdown
  label="Item Category"
  value={categorySearch}
  expanded={categoryExpanded}
  onToggle={() => setCategoryExpanded(!categoryExpanded)}
  options={ITEM_CATEGORIES}
  onSelect={setCategorySearch}
/>

const InputDropdown = ({
  label,
  value,
  expanded,
  onToggle,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
  options: string[];
  onSelect: (val: string) => void;
}) => (
  <View>
    <Text className="text-sm font-manrope-semibold text-gray-700 mb-3">
      {label}
    </Text>
    <TouchableOpacity
      onPress={() => toggleWithLayout(onToggle)}
      className="flex-row items-center bg-white/30 border border-gray-300 rounded-md px-3 h-[3rem] backdrop-blur-md"
      activeOpacity={0.8}
    >
      <Text
        className={`flex-1 text-base font-manrope tracking-tight ${
          value ? "text-gray-700" : "text-gray-700"
        }`}
      >
        {value || `Select ${label.toLowerCase()}`}
      </Text>
      {value && (
        <Pressable onPress={() => onSelect("")} hitSlop={30}>
          <Ionicons name="close-outline" size={20} color="#4B5563" />
        </Pressable>
      )}
      <Ionicons
        name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
        size={20}
        color="#4B5563"
      />
    </TouchableOpacity>

    {expanded && (
      <View
        className="bg-white/90 border border-gray-200 rounded-md mt-1"
        style={{ maxHeight: 200 }}
      >
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              className="px-4 py-2"
              onPress={() =>
                toggleWithLayout(() => {
                  onSelect(opt);
                  onToggle();
                })
              }
            >
              <Text className="text-base text-gray-700 py-1 font-manrope">
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )}
  </View>
);


export const ITEM_CATEGORIES = [
    "Student Essentials",
    "Gadgets",
    "Personal Belongings"
];