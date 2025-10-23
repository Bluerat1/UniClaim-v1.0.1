import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoViewerModalProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export default function PhotoViewerModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: PhotoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageScale, setImageScale] = useState(1);
  const [imageTranslateX, setImageTranslateX] = useState(0);
  const [imageTranslateY, setImageTranslateY] = useState(0);

  useEffect(() => {
    if (visible && initialIndex !== currentIndex) {
      setCurrentIndex(initialIndex);
      // Reset image transformations when switching images
      setImageScale(1);
      setImageTranslateX(0);
      setImageTranslateY(0);
    }
  }, [visible, initialIndex, currentIndex]);

  const handleClose = () => {
    // Reset transformations before closing
    setImageScale(1);
    setImageTranslateX(0);
    setImageTranslateY(0);
    onClose();
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setImageScale(1);
      setImageTranslateX(0);
      setImageTranslateY(0);
    }
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setImageScale(1);
      setImageTranslateX(0);
      setImageTranslateY(0);
    }
  };

  const handleImageLoad = () => {
    // Reset transformations when image loads
    setImageScale(1);
    setImageTranslateX(0);
    setImageTranslateY(0);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      setImageScale(Math.max(1, Math.min(event.scale, 5))); // Limit zoom between 1x and 5x
    })
    .onEnd(() => {
      if (imageScale < 1.2) {
        runOnJS(setImageScale)(1);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(imageScale > 1) // Only enable pan when zoomed in
    .onUpdate((event) => {
      setImageTranslateX(event.translationX);
      setImageTranslateY(event.translationY);
    })
    .onEnd(() => {
      // If image is zoomed out, reset position
      if (imageScale <= 1) {
        setImageTranslateX(0);
        setImageTranslateY(0);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (imageScale > 1) {
        runOnJS(setImageScale)(1);
        runOnJS(setImageTranslateX)(0);
        runOnJS(setImageTranslateY)(0);
      } else {
        runOnJS(setImageScale)(2);
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <StatusBar hidden={true} />
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="absolute top-12 left-0 right-0 z-10 flex-row justify-between items-center px-4">
          <TouchableOpacity
            onPress={handleClose}
            className="bg-black/50 p-2 rounded-full"
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>

          {images.length > 1 && (
            <Text className="text-white text-lg font-medium">
              {currentIndex + 1} / {images.length}
            </Text>
          )}

          <View style={{ width: 40 }} />
        </View>

        {/* Main Image Container */}
        <View className="flex-1 justify-center items-center">
          {images.length > 0 && (
            <GestureDetector gesture={composedGesture}>
              <View className="w-full h-full justify-center items-center">
                <Image
                  source={{ uri: images[currentIndex] }}
                  style={{
                    width: screenWidth,
                    height: screenHeight,
                    transform: [
                      { scale: imageScale },
                      { translateX: imageTranslateX },
                      { translateY: imageTranslateY },
                    ],
                  }}
                  resizeMode="contain"
                  onLoad={handleImageLoad}
                />
              </View>
            </GestureDetector>
          )}
        </View>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                onPress={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 p-3 rounded-full"
              >
                <Ionicons name="chevron-back" size={28} color="white" />
              </TouchableOpacity>
            )}

            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                onPress={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-3 rounded-full"
              >
                <Ionicons name="chevron-forward" size={28} color="white" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Bottom Image Indicators */}
        {images.length > 1 && (
          <View className="absolute bottom-20 left-0 right-0 flex-row justify-center space-x-2">
            {images.map((_, index) => (
              <View
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </View>
        )}

        {/* Zoom Instructions */}
        {imageScale === 1 && (
          <View className="absolute bottom-8 left-0 right-0 items-center">
            <Text className="text-white/70 text-sm">
              Double tap to zoom • Pinch to zoom
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
