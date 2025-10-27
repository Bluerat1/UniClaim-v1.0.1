/// <reference types="nativewind/types" />

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface SafeAreaViewProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface AlertButton {
    className?: string;
  }
}

declare module 'react-native-safe-area-context' {
  interface SafeAreaViewProps {
    className?: string;
  }
}

declare module '@expo/vector-icons' {
  interface IoniconsProps {
    className?: string;
  }
  interface MaterialIconsProps {
    className?: string;
  }
  interface MaterialCommunityIconsProps {
    className?: string;
  }
}
