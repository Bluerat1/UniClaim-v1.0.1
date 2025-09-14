import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';

interface AnnouncementBannerProps {
  message: string;
  isVisible: boolean;
  priority?: 'normal' | 'urgent';
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AnnouncementBanner({ 
  message, 
  isVisible, 
  priority = 'normal' 
}: AnnouncementBannerProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible && message) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Start scrolling animation after a short delay
      const scrollTimer = setTimeout(() => {
        startScrollingAnimation();
      }, 500);

      return () => clearTimeout(scrollTimer);
    } else {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, message]);

  const startScrollingAnimation = () => {
    // Calculate the distance to scroll (message width + some padding)
    const messageWidth = message.length * 8; // Approximate character width
    const scrollDistance = messageWidth + SCREEN_WIDTH;
    
    // Reset position
    scrollAnim.setValue(0);
    
    // Start scrolling animation
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: -scrollDistance,
        duration: 20000, // 20 seconds for full scroll
        useNativeDriver: true,
      }),
      { iterations: -1 } // Infinite loop
    ).start();
  };

  if (!isVisible || !message) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      priority === 'urgent' ? styles.urgentContainer : styles.normalContainer
    ]}>
      {/* Scrolling text container */}
      <View style={styles.textContainer}>
        <Animated.View
          style={[
            styles.scrollingText,
            {
              opacity: fadeAnim,
              transform: [{ translateX: scrollAnim }]
            }
          ]}
        >
          {/* Repeat message for seamless scrolling */}
          <Text style={[
            styles.text,
            priority === 'urgent' ? styles.urgentText : styles.normalText
          ]}>
            {message}
          </Text>
          <Text style={[
            styles.text,
            priority === 'urgent' ? styles.urgentText : styles.normalText,
            styles.spacing
          ]}>
            {message}
          </Text>
          <Text style={[
            styles.text,
            priority === 'urgent' ? styles.urgentText : styles.normalText,
            styles.spacing
          ]}>
            {message}
          </Text>
        </Animated.View>
      </View>

      {/* Priority indicator for urgent announcements */}
      {priority === 'urgent' && (
        <View style={styles.urgentIndicator}>
          <View style={styles.urgentDot} />
          <Text style={styles.urgentLabel}>URGENT</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 32,
    maxHeight: 40,
    justifyContent: 'center',
  },
  normalContainer: {
    backgroundColor: '#FFFFFF', // White background for normal
  },
  urgentContainer: {
    backgroundColor: '#FFFFFF', // White background for urgent
  },
  textContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollingText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000', // Black text
    letterSpacing: 0.3,
  },
  normalText: {
    color: '#000000', // Black text
  },
  urgentText: {
    color: '#000000', // Black text
    fontWeight: '700',
  },
  spacing: {
    marginLeft: 48, // Space between repeated messages
  },
  urgentIndicator: {
    position: 'absolute',
    top: 2,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2', // Light red background
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  urgentDot: {
    width: 4,
    height: 4,
    backgroundColor: '#EF4444', // Red dot
    borderRadius: 2,
    marginRight: 3,
  },
  urgentLabel: {
    color: '#EF4444', // Red text
    fontSize: 8,
    fontWeight: '700',
  },
});
