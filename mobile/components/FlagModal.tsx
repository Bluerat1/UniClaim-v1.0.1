import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";

interface FlagModalProps {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isLoading?: boolean;
}

const FLAG_REASONS = [
  "Inappropriate content",
  "Spam/Fake post",
  "Suspicious activity",
  "Wrong category",
  "Other",
];

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  scrollContainer: {
    maxHeight: 360,
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectedOption: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  unselectedOption: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  radioButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadio: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  unselectedRadio: {
    borderColor: '#D1D5DB',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  customReasonContainer: {
    marginBottom: 16,
  },
  customReasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  customReasonInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  submitButtonEnabled: {
    backgroundColor: '#DC2626',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButtonTextEnabled: {
    color: 'white',
  },
  submitButtonTextDisabled: {
    color: '#6B7280',
  },
});

export default function FlagModal({
  onClose,
  onSubmit,
  isLoading = false,
}: FlagModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const handleSubmit = () => {
    const reason = selectedReason === "Other" ? customReason : selectedReason;
    if (reason.trim()) {
      onSubmit(reason.trim());
    } else {
      Alert.alert("Error", "Please select a reason for flagging");
    }
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>
            Why did you flag this post?
          </Text>
          <Text style={styles.subtitle}>
            Please select a reason for flagging this post:
          </Text>

          <ScrollView style={styles.scrollContainer}>
            <View style={styles.optionsContainer}>
              {FLAG_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  style={[
                    styles.optionButton,
                    selectedReason === reason ? styles.selectedOption : styles.unselectedOption,
                  ]}
                >
                  <View
                    style={[
                      styles.radioButton,
                      selectedReason === reason ? styles.selectedRadio : styles.unselectedRadio,
                    ]}
                  >
                    {selectedReason === reason && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text style={styles.optionText}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {selectedReason === "Other" && (
            <View style={styles.customReasonContainer}>
              <Text style={styles.customReasonLabel}>
                Please specify:
              </Text>
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Enter your reason..."
                multiline
                numberOfLines={3}
                style={styles.customReasonInput}
              />
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={
                !selectedReason ||
                (selectedReason === "Other" && !customReason.trim()) ||
                isLoading
              }
              style={[
                styles.submitButton,
                (!selectedReason ||
                (selectedReason === "Other" && !customReason.trim()) ||
                isLoading)
                  ? styles.submitButtonDisabled
                  : styles.submitButtonEnabled,
              ]}
            >
              <Text
                style={[
                  styles.submitButtonText,
                  (!selectedReason ||
                  (selectedReason === "Other" && !customReason.trim()) ||
                  isLoading)
                    ? styles.submitButtonTextDisabled
                    : styles.submitButtonTextEnabled,
                ]}
              >
                {isLoading ? "Flagging..." : "Flag Post"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
