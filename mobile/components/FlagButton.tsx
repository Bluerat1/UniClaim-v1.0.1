import React, { useState } from 'react';
import { TouchableOpacity, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { postService } from '../utils/firebase/posts';
import { useAuth } from '../context/AuthContext';
import FlagModal from './FlagModal';
import Toast from './Toast';

interface FlagButtonProps {
  postId: string;
  isFlagged?: boolean;
  flaggedBy?: string;
  onFlagSuccess?: () => void;
  className?: string;
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  flaggedButton: {
    backgroundColor: '#F3F4F6',
  },
  unflaggedButton: {
    backgroundColor: '#FEF2F2',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
  },
  flagIcon: {
    fontSize: 12,
  },
  flaggedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  unflaggedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
  },
});

export default function FlagButton({ 
  postId, 
  isFlagged = false, 
  flaggedBy, 
  onFlagSuccess,
  className = ""
}: FlagButtonProps) {
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "warning" | "info">("success");
  const { user } = useAuth();

  const handleFlagClick = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to flag posts');
      return;
    }
    setShowFlagModal(true);
  };

  const handleFlagSubmit = async (reason: string) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await postService.flagPost(postId, user.uid, reason);
      setShowFlagModal(false);
      setToastMessage("Post has been flagged for review");
      setToastType("success");
      setShowToast(true);
      onFlagSuccess?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to flag post');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if current user has already flagged this post
  const isAlreadyFlaggedByUser = isFlagged && flaggedBy === user?.uid;

  return (
    <>
      <TouchableOpacity
        onPress={handleFlagClick}
        disabled={isAlreadyFlaggedByUser || isLoading}
        style={[
          styles.button,
          isAlreadyFlaggedByUser ? styles.flaggedButton : styles.unflaggedButton,
          { opacity: isAlreadyFlaggedByUser || isLoading ? 0.6 : 1 }
        ]}
      >
        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#DC2626" />
            <Text style={styles.loadingText}>
              Flagging...
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.flagIcon}>🚩</Text>
            <Text style={isAlreadyFlaggedByUser ? styles.flaggedText : styles.unflaggedText}>
              {isAlreadyFlaggedByUser ? 'Flagged' : 'Flag'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {showFlagModal && (
        <FlagModal
          onClose={() => setShowFlagModal(false)}
          onSubmit={handleFlagSubmit}
          isLoading={isLoading}
        />
      )}

      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </>
  );
}
