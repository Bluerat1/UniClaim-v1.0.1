import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  visible,
  message,
  type,
  onClose,
  duration = 4000
}: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Slide in and fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return styles.successToast;
      case 'error':
        return styles.errorToast;
      case 'warning':
        return styles.warningToast;
      case 'info':
        return styles.infoToast;
      default:
        return styles.defaultToast;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'error-outline';
      case 'warning':
        return 'warning-amber';
      case 'info':
        return 'info-outline';
      default:
        return 'info-outline';
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        getToastStyle()
      ]}
    >
      <View style={styles.content}>
        <MaterialIcons
          name={getIcon() as any}
          size={24}
          color="white"
        />
        <Text style={styles.message}>
          {message}
        </Text>
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <MaterialIcons name="close" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    marginLeft: 12,
    fontFamily: 'Manrope-Medium',
  },
  closeButton: {
    padding: 4,
  },
  successToast: {
    backgroundColor: '#10B981', // green-500
    borderColor: '#059669', // green-600
    borderWidth: 1,
  },
  errorToast: {
    backgroundColor: '#EF4444', // red-500
    borderColor: '#DC2626', // red-600
    borderWidth: 1,
  },
  warningToast: {
    backgroundColor: '#F59E0B', // yellow-500
    borderColor: '#D97706', // yellow-600
    borderWidth: 1,
  },
  infoToast: {
    backgroundColor: '#3B82F6', // blue-500
    borderColor: '#2563EB', // blue-600
    borderWidth: 1,
  },
  defaultToast: {
    backgroundColor: '#6B7280', // gray-500
    borderColor: '#4B5563', // gray-600
    borderWidth: 1,
  },
});
