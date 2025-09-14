// ItemDetails.tsx
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import React, { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import CustomDropdown from "../../components/Dropdown";
import ImageUpload from "../../components/ImageUpload";
import Info from "../../components/Info";
import { useCoordinates } from "../../context/CoordinatesContext";
import { ITEM_CATEGORIES } from "../../constants";
import { detectLocationFromCoordinates } from "../../utils/locationDetection";

// navigation
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/type";

// Props
type ItemDetailsProps = {
  images: string[];
  setImages: React.Dispatch<React.SetStateAction<string[]>>;
  showLostInfo: boolean;
  showFoundInfo: boolean;
  setShowLostInfo: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFoundInfo: React.Dispatch<React.SetStateAction<boolean>>;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  reportType: "lost" | "found" | null;
  setReportType: React.Dispatch<React.SetStateAction<"lost" | "found" | null>>;
  foundAction:
    | "keep"
    | "turnover to OSA"
    | "turnover to Campus Security"
    | null;
  setFoundAction: React.Dispatch<
    React.SetStateAction<
      "keep" | "turnover to OSA" | "turnover to Campus Security" | null
    >
  >;
  selectedDate: Date | null;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date | null>>;
  selectedLocation: string | null;
  setSelectedLocation: React.Dispatch<React.SetStateAction<string | null>>;
  selectedCategory: string | null;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string | null>>;
};

type NavigationProps = NativeStackNavigationProp<
  RootStackParamList,
  "ItemDetails"
>;

export default function ItemDetails({
  images,
  setImages,
  showLostInfo,
  showFoundInfo,
  setShowLostInfo,
  setShowFoundInfo,
  title,
  setTitle,
  description,
  setDescription,
  reportType,
  setReportType,
  foundAction,
  setFoundAction,
  selectedDate,
  setSelectedDate,
  selectedLocation,
  setSelectedLocation,
  selectedCategory,
  setSelectedCategory,
}: ItemDetailsProps) {
  const navigation = useNavigation<NavigationProps>();
  const { coordinates, setCoordinates } = useCoordinates();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleReportClick = (type: "lost" | "found") => {
    setReportType(type);
    if (type === "found") setIsModalVisible(true);
  };

  // Detect location when coordinates change
  useEffect(() => {
    if (
      coordinates &&
      coordinates.latitude !== 0 &&
      coordinates.longitude !== 0
    ) {
      // Use detected location from coordinates if available
      if (coordinates.detectedLocation) {
        setSelectedLocation(coordinates.detectedLocation);
      } else {
        // Fallback to detection logic
        const detectionResult = detectLocationFromCoordinates(coordinates);
        if (detectionResult.location && detectionResult.confidence >= 80) {
          setSelectedLocation(detectionResult.location);
        } else {
          setSelectedLocation(null);
        }
      }
    } else {
      setSelectedLocation(null);
    }
  }, [coordinates]);

  return (
    <View className="flex-1">
      <View
        className={`gap-3 ${showLostInfo || showFoundInfo ? "mt-3" : "mt-0"}`}
      >
        {showLostInfo && (
          <Info type="lost" onClose={() => setShowLostInfo(false)} />
        )}
        {showFoundInfo && (
          <Info type="found" onClose={() => setShowFoundInfo(false)} />
        )}
      </View>

      {/* Report Type */}
      <View className="space-y-3 mt-4">
        <Text className="text-base font-manrope-semibold mb-3">
          Item Report
        </Text>
        <View className="flex-row gap-3 mb-4">
          {["lost", "found"].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => handleReportClick(type as "lost" | "found")}
              className={`flex-1 h-[3rem] rounded-md justify-center items-center ${
                reportType === type ? "bg-navyblue" : "bg-zinc-200"
              }`}
            >
              <Text
                className={`text-base font-manrope-medium ${
                  reportType === type ? "text-white" : "text-black"
                }`}
              >
                {type === "found" && foundAction
                  ? `Found (${
                      foundAction === "keep"
                        ? "Keep"
                        : foundAction === "turnover to OSA"
                          ? "OSA"
                          : "Campus Security"
                    })`
                  : type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ImageUpload images={images} setImages={setImages} />

      {/* Title Input */}
      <View className="mb-4">
        <Text className="text-base font-manrope-semibold mb-2 mt-3">
          Item Title
        </Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-md px-3 py-3 text-base font-manrope"
          placeholder="Enter item title (e.g., Blue Jansport Backpack)"
          value={title}
          onChangeText={setTitle}
          multiline={false}
        />
      </View>

      {/* Description Input */}
      <View className="">
        <Text className="text-base font-manrope-semibold mb-2">
          Description
        </Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-md px-3 py-3 text-base font-manrope h-24"
          placeholder="Describe the item in detail..."
          value={description}
          onChangeText={setDescription}
          multiline={true}
          textAlignVertical="top"
        />
      </View>

      {/* item category dropdown */}
      <View className="mt-3">
        <CustomDropdown
          label="Item Category"
          data={ITEM_CATEGORIES}
          selected={selectedCategory}
          setSelected={setSelectedCategory}
        />
      </View>

      {/* Date and Time */}
      <View className="mb-4">
        <Text className="text-base font-manrope-semibold mb-2">
          Date and Time
        </Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="h-[3.3rem] border border-zinc-300 rounded-md px-3 flex-row items-center justify-between"
        >
          <Text className="font-manrope text-base text-gray-700 flex-1">
            {selectedDate
              ? selectedDate.toLocaleString("en-US", {
                  hour: "numeric",
                  minute: "numeric",
                  hour12: true,
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Select date and time"}
          </Text>
          {selectedDate && (
            <Pressable onPress={() => setSelectedDate(null)} hitSlop={10}>
              <Ionicons name="close-outline" size={20} color="#4B5563" />
            </Pressable>
          )}
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (event.type === "set" && date) {
                setSelectedDate(new Date(date));
                setShowTimePicker(true);
              }
            }}
          />
        )}
        {showTimePicker && selectedDate && (
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display="default"
            onChange={(event, time) => {
              setShowTimePicker(false);
              if (event.type === "set" && time) {
                const updated = new Date(selectedDate);
                updated.setHours(time.getHours(), time.getMinutes());
                setSelectedDate(updated);
              }
            }}
          />
        )}
      </View>

      {/* Location */}
      <View className="mb-4">
        <Text className="text-base font-manrope-semibold mb-2">Location</Text>
        <Text className="text-sm text-gray-600 mb-3 font-inter">
          Pin a location on the map to automatically detect the building or area
        </Text>

        {/* Detected Location Display */}
        {selectedLocation && (
          <View className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              <Text className="text-green-800 font-medium">
                Detected Location: {selectedLocation}
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row items-center border border-gray-300 rounded-md px-3 h-[3.3rem] bg-white">
          <Text className="flex-1 font-manrope text-base text-gray-700">
            {selectedLocation
              ? `${selectedLocation} (${coordinates?.latitude.toFixed(5)}, ${coordinates?.longitude.toFixed(5)})`
              : coordinates
                ? `Coordinates: ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
                : "Pin a location on the map to detect building/area"}
          </Text>
          {coordinates && (
            <Pressable
              onPress={() => {
                setCoordinates({
                  latitude: 0,
                  longitude: 0,
                  detectedLocation: null,
                });
                setSelectedLocation(null);
              }}
              hitSlop={10}
            >
              <Ionicons name="close-outline" size={20} color="#4B5563" />
            </Pressable>
          )}
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("USTPMapScreen")}
          className="mt-3 h-[3.3rem] bg-navyblue rounded-md justify-center items-center"
        >
          <Text className="text-white font-manrope-medium text-base">
            Open USTP CDO Map
          </Text>
        </TouchableOpacity>

        {/* Instructions */}
        <View className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <View className="flex-row items-start">
            <View className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2" />
            <View className="flex-1">
              <Text className="text-blue-800 text-sm font-inter font-medium mb-1">
                How to use:
              </Text>
              <Text className="text-blue-700 text-xs font-inter">
                • Click on the map to pin a location{"\n"}• Make sure to pin
                within a building or campus area{"\n"}• The system will
                automatically detect the location name{"\n"}• If no location is
                detected, pin it more precisely inside the building.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="w-full flex-row gap-2 justify-center bg-orange-50 rounded-md py-4">
        <MaterialIcons name="warning-amber" size={18} color="orange" />
        <Text className="font-inter-medium text-center text-orange-500 text-sm">
          Your post/ticket will expire within 30 days if not found
        </Text>
      </View>

      {/* Found Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center"
          onPress={() => setIsModalVisible(false)}
        >
          <View className="bg-white w-[23rem] h-auto rounded-xl p-4 items-center flex-col gap-6">
            {/* Header */}
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="info-outline" size={18} color="black" />
              <Text className="text-xl font-manrope-bold">
                Keep or Turnover
              </Text>
            </View>

            {/* Description */}
            <Text className="text-lg font-inter text-center text-gray-600">
              Will you keep the item and return it yourself, or turn it over to
              Campus Security or OSA?
            </Text>

            {/* Action Buttons */}
            <View className="flex-col w-full gap-3">
              {["keep", "turnover to OSA", "turnover to Campus Security"].map(
                (action) => (
                  <TouchableOpacity
                    key={action}
                    onPress={() => {
                      setFoundAction(
                        action as
                          | "keep"
                          | "turnover to OSA"
                          | "turnover to Campus Security"
                      );
                      setIsModalVisible(false);
                    }}
                    className={`py-3 rounded-md items-center ${
                      foundAction === action ? "bg-navyblue" : "bg-zinc-200"
                    }`}
                  >
                    <Text
                      className={
                        foundAction === action
                          ? "text-white font-manrope-medium"
                          : "text-black font-manrope-medium"
                      }
                    >
                      {action.charAt(0).toUpperCase() + action.slice(1)}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
