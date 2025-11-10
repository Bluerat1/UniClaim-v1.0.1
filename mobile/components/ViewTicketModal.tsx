import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Post } from "../types/type";
import LocationMapView from "./LocationMapView";
import ConversationHistory from "./ConversationHistory";

interface ViewTicketModalProps {
  post: Post;
  isVisible: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export default function ViewTicketModal({
  post,
  isVisible,
  onClose,
  onEdit,
}: ViewTicketModalProps) {
  const formatDate = (dateInput: any) => {
    try {
      if (!dateInput) return "N/A";
      
      let date: Date;
      
      // Handle Firestore Timestamp
      if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
      } 
      // Handle string date
      else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } 
      // If it's already a Date object
      else if (dateInput instanceof Date) {
        date = dateInput;
      } 
      // Handle numeric timestamp
      else if (typeof dateInput === 'number') {
        date = new Date(dateInput);
      } 
      // Fallback for any other case
      else {
        console.warn('Unsupported date format:', dateInput);
        return 'Invalid date';
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'Input:', dateInput);
      return 'Date unavailable';
    }
  };

  const openImage = (uri: string) => {
    // You can implement a full-screen image viewer here
    console.log("Open image:", uri);
  };

  const openMaps = () => {
    if (post.coordinates) {
      const { lat, lng } = post.coordinates;
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-manrope-bold text-gray-800">
            Ticket Details
          </Text>
          {onEdit && post.status !== 'resolved' && (
            <TouchableOpacity onPress={onEdit} className="p-2">
              <Ionicons name="pencil" size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Status Badge */}
          <View className="mb-4">
            <View 
              className={`inline-flex px-3 py-1.5 rounded-full self-start ${
                post.status === "resolved" ? "bg-green-100" : 
                post.status === "deleted" ? "bg-red-100" : 
                "bg-yellow-100"
              }`}
            >
              <Text 
                className={`text-sm font-manrope-semibold capitalize ${
                  post.status === "resolved" ? "text-green-800" : 
                  post.status === "deleted" ? "text-red-800" : 
                  "text-yellow-800"
                }`}
              >
                {post.status || "pending"}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text className="text-xl font-manrope-bold text-gray-900 mb-2">
            {post.title}
          </Text>

          {/* Category */}
          <View className="flex-row items-center mb-4">
            <Ionicons name="pricetag" size={16} color="#6B7280" />
            <Text className="ml-2 text-gray-600 font-manrope-medium">
              {post.category || "No category"}
            </Text>
          </View>

          {/* Type */}
          <View className="flex-row items-center mb-4">
            <Ionicons 
              name={post.type === "lost" ? "search" : "cube"} 
              size={16} 
              color="#6B7280" 
            />
            <Text className="ml-2 text-gray-600 font-manrope-medium capitalize">
              {post.type} item
            </Text>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-base text-gray-700 font-manrope leading-relaxed">
              {post.description}
            </Text>
          </View>

          {/* Location */}
          {post.location && (
            <View className="mb-6">
              <Text className="text-sm font-manrope-semibold text-gray-900 mb-2">
                Location
              </Text>
              <View className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                {post.coordinates && (
                  <View className="h-48 w-full">
                    <LocationMapView 
                      coordinates={post.coordinates} 
                      location={post.location} 
                    />
                  </View>
                )}
                <View className="p-3">
                  <View className="flex-row items-center">
                    <Ionicons name="location" size={18} color="#3B82F6" />
                    <Text className="ml-2 text-sm text-gray-600 font-manrope">
                      {post.location}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Date & Time */}
          {post.dateTime && (
            <View className="flex-row items-center mb-6">
              <Ionicons name="time" size={16} color="#6B7280" />
              <Text className="ml-2 text-gray-600 font-manrope">
                {formatDate(post.dateTime)}
              </Text>
            </View>
          )}

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <View className="mb-6">
              <Text className="text-sm font-manrope-semibold text-gray-900 mb-3">
                Images ({post.images.length})
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                className="-mx-4 px-4"
              >
                {post.images.map((image, index) => (
                  <TouchableOpacity 
                    key={index} 
                    onPress={() => openImage(typeof image === 'string' ? image : String(image))}
                    className="mr-3"
                  >
                    <Image
                      source={{ uri: typeof image === 'string' ? image : String(image) }}
                      className="w-32 h-32 rounded-lg"
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Dates */}
          <View className="bg-gray-50 p-4 rounded-lg mb-6">
            <View className="flex-row justify-between pb-2 border-b border-gray-200">
              <Text className="text-sm text-gray-500 font-manrope">Created</Text>
              <Text className="text-sm text-gray-700 font-manrope-medium">
                {post.createdAt ? formatDate(post.createdAt) : 'N/A'}
              </Text>
            </View>
            {post.updatedAt && post.updatedAt !== post.createdAt && (
              <View className="flex-row justify-between pt-2">
                <Text className="text-sm text-gray-500 font-manrope">Last Updated</Text>
                <Text className="text-sm text-gray-700 font-manrope-medium">
                  {formatDate(post.updatedAt)}
                </Text>
              </View>
            )}
          </View>

          {/* Conversation History */}
          <View className="mb-6">
            <Text className="text-sm font-manrope-semibold text-gray-900 mb-2">
              Conversation History
            </Text>
            <View className="bg-white rounded-lg border border-gray-200 p-3">
              <ConversationHistory 
                postId={post.id} 
                isAdmin={false} 
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
