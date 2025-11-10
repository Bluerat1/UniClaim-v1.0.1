import React, { useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import PageWrapper from "../../layout/PageLayout";
import ContactDetails from "./ContactDetails";
import ItemDetails from "./ItemDetails";
import { useAuth } from "../../context/AuthContext";
import { useCoordinates } from "../../context/CoordinatesContext";
import { postService } from "../../utils/firebase";
import type { Post } from "../../types/type";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function Report() {
  const { user, userData } = useAuth();
  const { coordinates, setCoordinates } = useCoordinates();

  // Form state
  const [activeTab, setActiveTab] = useState<"item" | "contact">("item");
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportType, setReportType] = useState<"lost" | "found" | null>(null);
  const [foundAction, setFoundAction] = useState<
    "keep" | "turnover to OSA" | "turnover to Campus Security" | null
  >(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast visibility state
  const [showLostInfo, setShowLostInfo] = useState(true);
  const [showFoundInfo, setShowFoundInfo] = useState(true);

  const tabAnim = useState(new Animated.Value(0))[0];
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);

  const switchTab = (tab: "item" | "contact") => {
    setActiveTab(tab);
    Animated.timing(tabAnim, {
      toValue: tab === "item" ? 0 : containerWidth / 2,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Validation function
  const validateForm = () => {
    const errors: string[] = [];

    if (!title.trim()) errors.push("Item title is required");
    if (!description.trim()) errors.push("Item description is required");
    if (!reportType) errors.push("Please select Lost or Found");
    if (!selectedCategory) errors.push("Please select a category");
    if (!selectedLocation) errors.push("Please select a location");
    if (!selectedDate) errors.push("Please select date and time");
    if (images.length === 0) errors.push("Please add at least one image");
    if (!userData) errors.push("User information not available");
    if (!user) errors.push("User authentication not available");

    return errors;
  };

  const handleSubmit = async () => {
    const validationErrors = validateForm();

    if (validationErrors.length > 0) {
      Alert.alert("Validation Error", validationErrors.join("\n"), [
        { text: "OK" },
      ]);
      return;
    }

    if (!userData || !reportType || !user) return;

    setIsSubmitting(true);

    try {
      // Check if this should be transferred to Campus Security
      const shouldTransferToCampusSecurity =
        reportType === "found" && foundAction === "turnover to Campus Security";

      // Get real Campus Security user data
      let campusSecurityData = null;
      let campusSecurityUserId = null;

      if (shouldTransferToCampusSecurity) {
        const { userService } = await import("../../utils/firebase/auth");
        const campusSecurityUser = await userService.getCampusSecurityUser();

        if (campusSecurityUser) {
          campusSecurityData = {
            firstName: campusSecurityUser.firstName,
            lastName: campusSecurityUser.lastName,
            email: campusSecurityUser.email,
            contactNum: campusSecurityUser.contactNum,
            studentId: campusSecurityUser.studentId,
            profilePicture: campusSecurityUser.profilePicture || null,
          };
          campusSecurityUserId = campusSecurityUser.uid;
        } else {
          // Fallback to hardcoded data if no Campus Security user found
          campusSecurityData = {
            firstName: "Campus",
            lastName: "Security",
            email: "cs@uniclaim.com",
            contactNum: "",
            studentId: "",
            profilePicture: null,
          };
          campusSecurityUserId = "hedUWuv96VWQek5OucPzXTCkpQU2";
        }
      }

      // Build post data conditionally to avoid undefined values in Firebase
      const postData: Omit<Post, "id" | "createdAt"> = {
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory!,
        location: selectedLocation!,
        type: reportType,
        images: images,
        dateTime: selectedDate!.toISOString(),
        user: shouldTransferToCampusSecurity && campusSecurityData
          ? campusSecurityData
          : userData ? {
              firstName: userData.firstName,
              lastName: userData.lastName,
              email: userData.email,
              contactNum: userData.contactNum,
              studentId: userData.studentId,
              profilePicture: userData.profilePicture || null, // Convert undefined to null
              role: userData.role || "user", // Include user role with default
            } : {
              firstName: "",
              lastName: "",
              email: "",
              contactNum: "",
              studentId: "",
              profilePicture: null,
              role: "user"
            },
        creatorId: shouldTransferToCampusSecurity
          ? campusSecurityUserId || ""
          : user?.uid || "", // Transfer ownership if needed
        postedById: shouldTransferToCampusSecurity
          ? campusSecurityUserId || ""
          : user?.uid || "", // Use Firebase user ID for messaging
        status: "pending",
      };

      // Only add optional fields if they have valid values
      if (coordinates) {
        postData.coordinates = {
          lat: coordinates.latitude,
          lng: coordinates.longitude,
        };
      }

      // Only add foundAction for found items that have a selected action
      if (reportType === "found" && foundAction) {
        postData.foundAction = foundAction;
      }

      // Add turnover details for both OSA and Campus Security turnover
      if (
        reportType === "found" &&
        foundAction &&
        (foundAction === "turnover to OSA" ||
          foundAction === "turnover to Campus Security")
      ) {
        postData.turnoverDetails = {
          originalFinder: {
            uid: user.uid,
            firstName: userData?.firstName || "",
            lastName: userData?.lastName || "",
            email: userData?.email || "",
            contactNum: userData?.contactNum || "",
            studentId: userData?.studentId || "",
            profilePicture: userData?.profilePicture || null,
          },
          turnoverAction: foundAction,
          turnoverDecisionAt: new Date(), // Will be converted to Firebase timestamp
          turnoverStatus:
            foundAction === "turnover to OSA" ? "declared" : "transferred", // Different statuses for different workflows
          // Note: turnoverReason is optional and not included if undefined
        };
      }

      await postService.createPost(postData);

      // Determine success message based on found action
      let successTitle = "Success";
      let successMessage = "Your report has been submitted successfully!";
      
      if (reportType === 'found' && foundAction) {
        if (foundAction === 'turnover to Campus Security') {
          successTitle = 'Successfully created post!';
          successMessage = 'Your post has been successfully created! The name of the post will be changed to Campus Security, but your name will still remain visible.';
        } else if (foundAction === 'turnover to OSA') {
          successTitle = 'Successfully submitted!';
          successMessage = 'Your post has been successfully submitted to the admin! Please visit the OSA office to turn in the found item. Once you hand it over, the admin will publish your post under the admin\'s name, but your name will still remain visible.';
        }
      }

      Alert.alert(successTitle, successMessage, [
        {
          text: "OK",
          onPress: () => {
            // Reset form
            setTitle("");
            setDescription("");
            setReportType(null);
            setSelectedCategory(null);
            setSelectedLocation(null);
            setSelectedDate(null);
            setImages([]);
            setFoundAction(null);
            setCoordinates(null);
            setActiveTab("item");
          },
        },
      ]);
    } catch (error: any) {
      console.error("Error creating post:", error);

      Alert.alert(
        "Error",
        error.message || "Failed to submit report. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper>
      <View className="flex-1 bg-white">
        {/* Tabs */}
        <View
          className="relative mx-4 mb-2"
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
          <View className="flex-row">
            <TouchableOpacity
              className="w-1/2 pb-3 items-center"
              onPress={() => switchTab("item")}
            >
              <Text
                className={`text-base font-manrope-semibold ${
                  activeTab === "item" ? "text-blue-900" : "text-gray-400"
                }`}
              >
                Item Details
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-1/2 pb-3 items-center"
              onPress={() => switchTab("contact")}
            >
              <Text
                className={`text-base font-manrope-semibold ${
                  activeTab === "contact" ? "text-blue-900" : "text-gray-400"
                }`}
              >
                Contact Details
              </Text>
            </TouchableOpacity>
          </View>

          <View className="absolute bottom-0 left-0 w-full h-[3px] bg-gray-200 rounded" />
          <Animated.View
            style={{
              position: "absolute",
              bottom: 0,
              height: 3,
              width: containerWidth / 2,
              backgroundColor: "#0a0f3d",
              transform: [{ translateX: tabAnim }],
            }}
            className="rounded-lg"
          />
        </View>

        {/* Content */}
        <ScrollView
          className="pt-2 px-4"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* 🔹 Added extra padding for button space */}
          {activeTab === "item" ? (
            <ItemDetails
              images={images}
              setImages={setImages}
              showLostInfo={showLostInfo}
              showFoundInfo={showFoundInfo}
              setShowLostInfo={setShowLostInfo}
              setShowFoundInfo={setShowFoundInfo}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              reportType={reportType}
              setReportType={setReportType}
              foundAction={foundAction}
              setFoundAction={setFoundAction}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          ) : (
            <ContactDetails
              showLostInfo={showLostInfo}
              showFoundInfo={showFoundInfo}
              setShowLostInfo={setShowLostInfo}
              setShowFoundInfo={setShowFoundInfo}
            />
          )}
        </ScrollView>

        {/* Submit Button */}
        <View className="absolute bg-yellow-50 bottom-0 left-0 w-full p-4">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`py-4 rounded-lg ${isSubmitting ? "bg-gray-400" : "bg-brand"}`}
          >
            <Text className="text-white text-center text-base font-manrope-semibold">
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </PageWrapper>
  );
}
