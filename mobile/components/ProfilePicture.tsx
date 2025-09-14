import React from 'react';
import { Image, ImageStyle, View, Text } from 'react-native';

interface ProfilePictureProps {
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  style?: ImageStyle;
}

const ProfilePicture: React.FC<ProfilePictureProps> = ({
  src,
  size = 'md',
  style
}) => {
  // Default profile picture image
  const defaultProfilePicture = require('../assets/images/empty_profile.jpg');
  
  const sizeStyles = {
    xs: { width: 20, height: 20 },
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 48, height: 48 },
    xl: { width: 64, height: 64 },
    '2xl': { width: 80, height: 80 },
    '3xl': { width: 96, height: 96 },
    '4xl': { width: 128, height: 128 },
    '5xl': { width: 160, height: 160 }
  };

  const sizeStyle = sizeStyles[size];
  
  // More robust check for valid source
  const hasValidSrc = src && 
    typeof src === 'string' && 
    src.trim() !== '' && 
    src !== 'null' && 
    src !== 'undefined' &&
    !src.includes('undefined') &&
    src.startsWith('http'); // Only accept valid URLs

  // Use default image if no valid source
  const imageSource = hasValidSrc ? { uri: src } : defaultProfilePicture;

  return (
    <Image
      source={imageSource}
      style={[
        {
          ...sizeStyle,
          borderRadius: sizeStyle.width / 2,
          borderWidth: 1,
          borderColor: '#e5e7eb',
        },
        style
      ]}
      onError={() => {
        // Note: React Native Image onError doesn't work the same as web
        // The fallback is handled by the conditional logic above
      }}
    />
  );
};

export default ProfilePicture;
