import React from "react";
import { View, Text } from "react-native";

export default function PostCardSkeleton() {
  return (
    <View className="bg-white rounded-lg p-4 mb-4 shadow-sm border border-gray-100">
      {/* Header skeleton */}
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 bg-gray-200 rounded-full mr-3" />
        <View className="flex-1">
          <View className="w-24 h-4 bg-gray-200 rounded mb-2" />
          <View className="w-16 h-3 bg-gray-200 rounded" />
        </View>
      </View>

      {/* Title skeleton */}
      <View className="w-3/4 h-5 bg-gray-200 rounded mb-3" />

      {/* Description skeleton */}
      <View className="space-y-2 mb-3">
        <View className="w-full h-4 bg-gray-200 rounded" />
        <View className="w-2/3 h-4 bg-gray-200 rounded" />
      </View>

      {/* Image skeleton */}
      <View className="w-full h-32 bg-gray-200 rounded mb-3" />

      {/* Footer skeleton */}
      <View className="flex-row justify-between items-center">
        <View className="flex-row space-x-3">
          <View className="w-16 h-6 bg-gray-200 rounded" />
          <View className="w-20 h-6 bg-gray-200 rounded" />
        </View>
        <View className="w-12 h-6 bg-gray-200 rounded" />
      </View>
    </View>
  );
}

export function PostCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View className="flex-col gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </View>
  );
}
