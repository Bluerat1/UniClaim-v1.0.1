import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";

type DropdownProps = {
  label?: string;
  data: string[];
  selected: string | null;
  setSelected: (value: string | null) => void;
  placeholder?: string;
};

const CustomDropdown = ({
  label,
  data,
  selected,
  setSelected,
  placeholder = "Select a category",
}: DropdownProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
        </Text>
      )}

      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={styles.dropdownButton}
      >
        <Text style={selected ? styles.selectedText : styles.placeholderText}>
          {selected || placeholder}
        </Text>

        <View style={styles.iconContainer}>
          {selected && (
            <Pressable onPress={() => setSelected(null)} hitSlop={10}>
              <Ionicons name="close" size={20} color="#4B5563" />
            </Pressable>
          )}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#4B5563"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.dropdownMenu}>
          <ScrollView nestedScrollEnabled>
            {data.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  setSelected(item);
                  setExpanded(false);
                }}
                style={styles.option}
              >
                <Text style={styles.optionText}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    zIndex: 50,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedText: {
    fontSize: 16,
    flex: 1,
    color: '#1F2937',
  },
  placeholderText: {
    fontSize: 16,
    flex: 1,
    color: '#374151',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: 192,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optionText: {
    fontSize: 16,
    color: '#1F2937',
  },
});

export default CustomDropdown;
