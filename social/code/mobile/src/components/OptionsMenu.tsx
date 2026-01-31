import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { useColors } from '../theme';

interface OptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  options: Array<{
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }>;
}

export default function OptionsMenu({ visible, onClose, options }: OptionsMenuProps) {
  const colors = useColors();

  // Only render on web
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.menu, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          {options.map((option, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  option.onPress();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: option.destructive ? colors.error || '#c62828' : colors.text },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    width: '100%',
  },
});

