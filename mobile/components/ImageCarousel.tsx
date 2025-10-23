// components/ImageCarousel.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  TouchableOpacity,
  View,
} from "react-native";
import PhotoViewerModal from "./PhotoViewerModal";

const { width: screenWidth } = Dimensions.get("window");

export default function ImageCarousel({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // start with screen width but we'll overwrite it by measuring container
  const [itemWidth, setItemWidth] = useState<number>(screenWidth);

  // when container measures, update itemWidth
  const onContainerLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== itemWidth) setItemWidth(w);
  };

  // scroll using explicit offset so there's no weird centering math
  const scrollTo = (index: number, animated = true) => {
    if (index < 0 || index >= images.length) return;
    setCurrentIndex(index);
    try {
      flatListRef.current?.scrollToOffset({
        offset: index * itemWidth,
        animated,
      });
    } catch {}
  };

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({
        offset: currentIndex * itemWidth,
        animated: false,
      });
    }
  }, [itemWidth, currentIndex]);

  const handleImagePress = (index: number) => {
    setCurrentIndex(index);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <View className="relative" onLayout={onContainerLayout}>
        <FlatList
          ref={flatListRef}
          data={images}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: itemWidth,
            offset: itemWidth * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={{ width: itemWidth }}
              className="h-80 bg-gray-100 rounded-md justify-center items-center"
              onPress={() => handleImagePress(index)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: item }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        />

        {/* Left Arrow */}
        {currentIndex > 0 && (
          <TouchableOpacity
            className="absolute left-1 top-1/2 bg-black/30 -translate-y-1/2 p-2 rounded-lg"
            onPress={() => scrollTo(currentIndex - 1)}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
        )}

        {/* Right Arrow */}
        {currentIndex < images.length - 1 && (
          <TouchableOpacity
            className="absolute right-1 top-1/2 bg-black/30 -translate-y-1/2 p-2 rounded-lg"
            onPress={() => scrollTo(currentIndex + 1)}
          >
            <Ionicons name="chevron-forward" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Photo Viewer Modal */}
      <PhotoViewerModal
        visible={isModalVisible}
        images={images}
        initialIndex={currentIndex}
        onClose={handleModalClose}
      />
    </>
  );
}
