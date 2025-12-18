// ItemDetails.tsx
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
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
import { useToast } from "../../context/ToastContext";
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
  const { showToastMessage } = useToast();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showOSATurnoverModal, setShowOSATurnoverModal] = useState(false);
  const [showCampusSecurityTurnoverModal, setShowCampusSecurityTurnoverModal] =
    useState(false);
  const [showKeepInfoModal, setShowKeepInfoModal] = useState(false);

  const handleReportClick = (type: "lost" | "found" | null) => {
    if (type === null) {
      setReportType(null);
      setFoundAction(null);
      setIsModalVisible(false);
      setShowOSATurnoverModal(false);
      setShowCampusSecurityTurnoverModal(false);
      setShowKeepInfoModal(false);
    } else {
      setReportType(type);
      if (type === "found") setIsModalVisible(true);
    }
  };

  const handleFoundActionSelect = (
    action: "keep" | "turnover to OSA" | "turnover to Campus Security"
  ) => {
    if (action === "turnover to OSA") {
      setShowOSATurnoverModal(true);
      setIsModalVisible(false);
    } else if (action === "turnover to Campus Security") {
      setShowCampusSecurityTurnoverModal(true);
      setIsModalVisible(false);
    } else if (action === "keep") {
      setShowKeepInfoModal(true);
      setIsModalVisible(false);
    } else {
      setFoundAction(action);
      setIsModalVisible(false);
    }
  };

  const handleOSATurnoverConfirmation = (didTurnOver: boolean) => {
    if (didTurnOver) {
      setFoundAction("turnover to OSA");
    } else {
      // If they selected "No", reset the selection
      setReportType(null);
      setFoundAction(null);
      setIsModalVisible(false);
    }
    setShowOSATurnoverModal(false);
  };

  const handleCampusSecurityTurnoverConfirmation = (didTurnOver: boolean) => {
    if (didTurnOver) {
      setFoundAction("turnover to Campus Security");
    } else {
      // If they selected "No", reset the selection
      setReportType(null);
      setFoundAction(null);
      setIsModalVisible(false);
    }
    setShowCampusSecurityTurnoverModal(false);
  };

  const handleKeepConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      setFoundAction("keep");
    } else {
      // If they selected "No", reset the selection
      setReportType(null);
      setFoundAction(null);
      setIsModalVisible(false);
    }
    setShowKeepInfoModal(false);
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
        if (detectionResult.location && detectionResult.confidence >= 50) {
          setSelectedLocation(detectionResult.location);
        } else if (
          detectionResult.alternatives &&
          detectionResult.alternatives.length > 0
        ) {
          // Show the top alternative if confidence is reasonable (>= 10)
          const topAlternative = detectionResult.alternatives[0];
          if (topAlternative.confidence >= 10) {
            setSelectedLocation(topAlternative.location);
          } else {
            setSelectedLocation(null);
          }
        } else {
          setSelectedLocation(null);
        }
      }
    } else {
      setSelectedLocation(null);
    }
  }, [coordinates, setSelectedLocation]);

  return (
    <View className="flex-1">
      <View
        className={`gap-3 ${showLostInfo || showFoundInfo ? "mt-1" : "mt-0"}`}
      >
        {showLostInfo && (
          <Info type="lost" onClose={() => setShowLostInfo(false)} />
        )}
        {showFoundInfo && (
          <Info type="found" onClose={() => setShowFoundInfo(false)} />
        )}
      </View>

      {/* Report Type */}
      <View className="space-y-3 mt-3">
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
              <View className="flex-row items-center justify-center w-full px-2">
                <Text
                  className={`text-base font-manrope-medium flex-1 text-center ${
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
                {reportType === type && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleReportClick(null);
                    }}
                    hitSlop={10}
                    className="ml-1"
                  >
                    <Ionicons
                      name="close-outline"
                      size={16}
                      color={reportType === type ? "white" : "#4B5563"}
                    />
                  </Pressable>
                )}
              </View>
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

      {/* Additional Remarks Input */}
      <View className="">
        <Text className="text-base font-manrope-semibold mb-2">
          Additional Remarks
        </Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-md px-3 py-3 text-base font-manrope h-24"
          placeholder="Add any relevant details or remarks..."
          value={description}
          onChangeText={setDescription}
          multiline={true}
          textAlignVertical="top"
        />
        <View className="mt-2 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <Text className="text-xs text-yellow-700 font-manrope-medium">
            ⚠️ Important: Do not include specific details about item contents or any personal/sensitive information in the remarks.
          </Text>
        </View>
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
          Date and Time {reportType === "lost" ? "Lost" : "Found"}
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
                // Check if the selected date is in the future
                const now = new Date();
                if (date > now) {
                  showToastMessage(
                    "You cannot set a future date when creating a post",
                    "warning"
                  );
                  setSelectedDate(null);
                  return;
                }
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
                
                // Check if the combined date and time is in the future
                const now = new Date();
                if (updated > now) {
                  showToastMessage(
                    "You cannot set a future date and time when creating a post",
                    "warning"
                  );
                  setSelectedDate(null);
                  return;
                }
                
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

        {/* Instructions */}
        <View className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <View className="flex-row items-start">
            <View className="flex-1">
              <Text className="text-blue-800 text-base font-inter-medium mb-1 border-b border-blue-100 pb-2">
                How to use the location pinning feature?
              </Text>
              <Text className="text-blue-700 text-sm font-inter pt-1">
                • Click on the map to pin a location{"\n"}• Make sure to pin
                within a building or campus area{"\n"}• The system will
                automatically detect the location name{"\n"}• If no location is
                detected, pin it more precisely inside the building.
              </Text>
            </View>
          </View>
        </View>

        {/* Detected Location Display */}
        {selectedLocation && (
          <View className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              <Text className="text-green-800 font-manrope-semibold">
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
          className="flex-1 bg-black/60 justify-center items-center p-4"
          onPress={() => setIsModalVisible(false)}
        >
          <View className="bg-white w-full max-w-md rounded-xl p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="info-outline" size={20} color="#1e3a8a" />
                <Text className="text-xl font-manrope-bold text-gray-900">
                  Keep or Turnover
                </Text>
              </View>
              <Pressable onPress={() => setIsModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            {/* Description */}
            <Text className="text-base text-gray-600 text-center mb-6 leading-relaxed">
              Will you keep the item and return it yourself, or turn it over to
              Campus Security or OSA?
            </Text>

            {/* Action Buttons with Descriptions */}
            <View className="space-y-4">
              {/* Keep Item Option */}
              <Pressable
                onPress={() => handleFoundActionSelect("keep")}
                className={`p-4 rounded-lg border ${
                  foundAction === "keep"
                    ? "border-blue-700 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <View className="flex-row items-start gap-3">
                  <View className={`p-2 rounded-full ${
                    foundAction === "keep"
                      ? "bg-blue-100"
                      : "bg-gray-100"
                  }`}>
                    <Ionicons 
                      name="person-outline" 
                      size={20} 
                      color={foundAction === "keep" ? "#1d4ed8" : "#6b7280"} 
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-manrope-semibold text-gray-900">Keep Item</Text>
                    <Text className="text-sm text-gray-500 mt-1">
                      You will keep the item and handle returning it to the owner yourself. Choose this if you can easily identify the owner.
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Turnover to OSA Option */}
              <Pressable
                onPress={() => handleFoundActionSelect("turnover to OSA")}
                className={`p-4 rounded-lg border ${
                  foundAction === "turnover to OSA"
                    ? "border-blue-700 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <View className="flex-row items-start gap-3">
                  <View className={`p-2 rounded-full ${
                    foundAction === "turnover to OSA"
                      ? "bg-blue-100"
                      : "bg-gray-100"
                  }`}>
                    <Ionicons 
                      name="shield-outline" 
                      size={20} 
                      color={foundAction === "turnover to OSA" ? "#1d4ed8" : "#6b7280"} 
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-manrope-semibold text-gray-900">Turnover to OSA</Text>
                    <Text className="text-sm text-gray-500 mt-1">
                      Give the item to the school office. They will keep it safe and help find the owner. The office is open during school hours.
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Turnover to Campus Security Option */}
              <Pressable
                onPress={() => handleFoundActionSelect("turnover to Campus Security")}
                className={`p-4 rounded-lg border ${
                  foundAction === "turnover to Campus Security"
                    ? "border-blue-700 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <View className="flex-row items-start gap-3">
                  <View className={`p-2 rounded-full ${
                    foundAction === "turnover to Campus Security"
                      ? "bg-blue-100"
                      : "bg-gray-100"
                  }`}>
                    <Ionicons 
                      name="briefcase-outline" 
                      size={20} 
                      color={foundAction === "turnover to Campus Security" ? "#1d4ed8" : "#6b7280"} 
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-manrope-semibold text-gray-900">Turnover to Campus Security</Text>
                    <Text className="text-sm text-gray-500 mt-1">
                      For important items or when found at night. The school guards will keep it safe. Use this for valuable items or when the office is closed.
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* OSA Turnover Confirmation Modal */}
      <Modal
        visible={showOSATurnoverModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOSATurnoverModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center"
          onPress={() => setShowOSATurnoverModal(false)}
        >
          <View className="bg-white w-[23rem] h-auto rounded-xl p-4 items-center flex-col gap-6">
            {/* Header */}
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="info-outline" size={18} color="black" />
              <Text className="text-xl font-manrope-bold">OSA Turnover</Text>
            </View>

            {/* Question */}
            <Text className="text-lg font-inter text-center text-gray-600">
              Did you turn over the item to the Office of Student Affairs (OSA)
              before creating a post or report?
            </Text>

            {/* Action Buttons */}
            <View className="flex-col w-full gap-3">
              <TouchableOpacity
                onPress={() => {
                  handleOSATurnoverConfirmation(false);
                }}
                className="py-3 rounded-md items-center bg-zinc-200"
              >
                <Text className="text-black font-manrope-medium">
                  No, not yet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  handleOSATurnoverConfirmation(true);
                }}
                className="py-3 rounded-md items-center bg-navyblue"
              >
                <Text className="text-white font-manrope-medium">
                  Yes, I turned it over
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Campus Security Turnover Confirmation Modal */}
      <Modal
        visible={showCampusSecurityTurnoverModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCampusSecurityTurnoverModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center"
          onPress={() => setShowCampusSecurityTurnoverModal(false)}
        >
          <View className="bg-white w-[23rem] h-auto rounded-xl p-4 items-center flex-col gap-6">
            {/* Header */}
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="security" size={18} color="black" />
              <Text className="text-xl font-manrope-bold">
                Campus Security Turnover
              </Text>
            </View>

            {/* Question */}
            <Text className="text-lg font-inter text-center text-gray-600">
              Did you turn over the item to Campus Security at the main entrance
              before creating a post or report?
            </Text>

            {/* Action Buttons */}
            <View className="flex-col w-full gap-3">
              <TouchableOpacity
                onPress={() => {
                  handleCampusSecurityTurnoverConfirmation(false);
                }}
                className="py-3 rounded-md items-center bg-zinc-200"
              >
                <Text className="text-black font-manrope-medium">
                  No, not yet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  handleCampusSecurityTurnoverConfirmation(true);
                }}
                className="py-3 rounded-md items-center bg-navyblue"
              >
                <Text className="text-white font-manrope-medium">
                  Yes, I turned it over
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Keep Info Modal */}
      <Modal
        visible={showKeepInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeepInfoModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center"
          onPress={() => setShowKeepInfoModal(false)}
        >
          <View className="bg-white w-[23rem] h-auto rounded-xl p-4 items-center flex-col gap-6">
            {/* Header */}
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="info-outline" size={18} color="black" />
              <Text className="text-xl font-manrope-bold">Keep Item</Text>
            </View>

            {/* Information */}
            <Text className="text-lg font-inter text-center text-gray-600">
              If you choose to keep the item, you are responsible for keeping it safe until you find the rightful owner.
            </Text>

            {/* Additional Info */}
            <View className="bg-blue-50 w-full p-3 rounded-md">
              <Text className="text-sm text-blue-800 font-inter-medium">
                • Keep the item in a safe place{"\n"}• Respond to claimants right away{"\n"}• Verify ownership before returning{"\n"}• Report any issues to OSA
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="flex-col w-full gap-3">
              <TouchableOpacity
                onPress={() => {
                  handleKeepConfirmation(false);
                }}
                className="py-3 rounded-md items-center bg-zinc-200"
              >
                <Text className="text-black font-manrope-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  handleKeepConfirmation(true);
                }}
                className="py-3 rounded-md items-center bg-navyblue"
              >
                <Text className="text-white font-manrope-medium">
                  I understand, I'll keep it
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
