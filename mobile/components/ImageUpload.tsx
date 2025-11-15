import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from 'expo-media-library';
import React, { useState, useEffect } from "react";
import {
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
} from "react-native";

type Props = {
  images: string[];
  setImages: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function ImageUploader({ images, setImages }: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus === 'granted');
        
        const { status: mediaLibraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        setHasMediaLibraryPermission(mediaLibraryStatus === 'granted');
      }
    })();
  }, []);

  const pickImage = async (source: 'camera' | 'library') => {
    if (images.length >= 3) return;

    try {
      let result;
      
      if (source === 'camera') {
        if (hasCameraPermission === false) {
          Alert.alert("Permission required", "Camera permission is required to take photos");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
      } else {
        if (hasMediaLibraryPermission === false) {
          Alert.alert("Permission required", "Media library permission is required to select photos");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: false,
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setImages((prev) => [...prev, uri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    } finally {
      setShowSourceDialog(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <View className="w-full">
      <Text className="text-base font-manrope-semibold">Image Upload</Text>

      <View
        className={`flex-row flex-wrap gap-4 mb-3 ${
          images.length > 0 ? "mt-3" : "mt-0"
        }`}
      >
        {images.map((uri, index) => (
          <View key={index} className="relative">
            <TouchableOpacity onPress={() => setSelectedImage(uri)}>
              <Image
                source={{ uri }}
                className="w-24 h-24 rounded-lg border border-gray-300"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removeImage(index)}
              className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
            >
              <MaterialIcons name="close" size={14} color="white" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {images.length < 3 ? (
        <View className="space-y-2">
          <TouchableOpacity
            onPress={() => setShowSourceDialog(true)}
            className="border border-navyblue bg-navyblue h-[3.3rem] rounded-md items-center justify-center flex-row space-x-2"
          >
            <Ionicons name="cloud-upload" size={20} color="white" />
            <Text className="text-white font-manrope-medium text-base">
              Upload Image
            </Text>
          </TouchableOpacity>
          
          <Modal
            visible={showSourceDialog}
            transparent
            animationType="fade"
            onRequestClose={() => setShowSourceDialog(false)}
          >
            <View className="flex-1 bg-black/50 justify-center items-center">
              <View className="bg-white rounded-xl p-5 w-4/5">
                <Text className="text-lg font-manrope-bold mb-4 text-center">Select Image Source</Text>
                <View className="space-y-3">
                  <TouchableOpacity 
                    onPress={() => pickImage('camera')}
                    className="flex-row items-center justify-center space-x-2 bg-blue-50 p-3 rounded-lg border border-blue-100"
                  >
                    <Ionicons name="camera" size={24} color="#1e40af" />
                    <Text className="text-blue-800 font-manrope-medium">Take Photo</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => pickImage('library')}
                    className="flex-row items-center justify-center space-x-2 bg-purple-50 p-3 rounded-lg border border-purple-100"
                  >
                    <Ionicons name="images" size={24} color="#6b21a8" />
                    <Text className="text-purple-800 font-manrope-medium">Choose from Library</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => setShowSourceDialog(false)}
                    className="mt-2 p-3 rounded-lg items-center"
                  >
                    <Text className="text-gray-600 font-manrope-medium">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      ) : (
        <View className="border border-green-500 py-4 rounded-md items-center">
          <Text className="text-green-500 font-manrope-medium">
            Max Upload Reached
          </Text>
        </View>
      )}

      {/* Modal for image preview */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable
          onPress={() => setSelectedImage(null)}
          className="flex-1 bg-black/80 justify-center items-center"
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              className="w-[90%] h-[70%] rounded-xl"
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}
