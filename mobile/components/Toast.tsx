import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}

const ANIMATION_DURATION = 300;

export default function Toast({
  visible,
  message,
  type,
  onClose,
  duration = 3000
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const currentMessage = useRef(message);

  // Handle show animation
  const show = useCallback(() => {
    if (!isMounted.current) return;

    // Reset animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Handle hide animation
  const hide = useCallback((onComplete = () => {}) => {
    if (!isMounted.current) return;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      })
    ]).start(() => {
      if (isMounted.current) {
        // Only call onComplete if it's provided and not the default noop
        if (onComplete && onComplete !== (() => {})) {
          onComplete();
        }
      }
    });
  }, [fadeAnim, slideAnim]);

  // Handle visibility changes - prevent unnecessary re-renders
  useEffect(() => {
    // Only proceed if visibility state changes
    if (visible === isVisible) return;

    if (visible) {
      // Only update message if it's different
      if (currentMessage.current !== message) {
        currentMessage.current = message;
      }
      
      // Only set visible and show if not already visible
      if (!isVisible) {
        setIsVisible(true);
        show();
      }

      // Clear any existing timeout
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Set new timeout for auto-hide if duration is positive
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          if (isMounted.current && visible) {
            hide(() => {
              if (isMounted.current) {
                setIsVisible(false);
              }
            });
          }
        }, Math.max(duration, 500));
      }
    } else if (isVisible) {
      // Only trigger hide if currently visible
      hide(() => {
        if (isMounted.current) {
          setIsVisible(false);
        }
      });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, message, duration, onClose, show, hide]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

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

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        getToastStyle(),
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.toastContent}>
        <MaterialIcons
          name={getIcon()}
          size={24}
          color="white"
          style={styles.icon}
        />
        <Text style={styles.message} numberOfLines={2} ellipsizeMode="tail">
          {currentMessage.current}
        </Text>
        <TouchableOpacity 
          onPress={() => {
            hide(() => {
              setIsVisible(false);
              onClose();
            });
          }} 
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="close" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
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
