import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useColors } from '../theme';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
  runnerName: string;
}

const REPORT_REASONS = [
  'Inappropriate AI response',
  'Offensive content',
  'AI not working correctly',
  'Privacy concern',
  'Other',
];

export default function ReportModal({ visible, onClose, onSubmit, runnerName }: ReportModalProps) {
  const colors = useColors();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    if (selectedReason) {
      onSubmit(selectedReason, details);
      setSelectedReason(null);
      setDetails('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelButton, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Report Issue</Text>
          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={!selectedReason}
          >
            <Text style={[
              styles.submitButton, 
              { color: colors.accent },
              !selectedReason && { color: colors.textSubtle }
            ]}>
              Submit
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Report an issue with {runnerName}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>What's the problem?</Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[
                styles.reasonButton,
                { backgroundColor: colors.bgElevated, borderColor: colors.border },
                selectedReason === reason && { backgroundColor: colors.accent },
              ]}
              onPress={() => setSelectedReason(reason)}
            >
              <Text
                style={[
                  styles.reasonText,
                  { color: colors.text },
                  selectedReason === reason && { color: colors.userBubbleText },
                ]}
              >
                {reason}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.label, { color: colors.text }]}>Additional details (optional)</Text>
          <TextInput
            style={[styles.textInput, {
              borderColor: colors.borderStrong,
              backgroundColor: colors.bgElevated,
              color: colors.text,
            }]}
            placeholder="Describe the issue..."
            placeholderTextColor={colors.textSubtle}
            multiline
            numberOfLines={4}
            value={details}
            onChangeText={setDetails}
          />

          <Text style={[styles.note, { color: colors.textSubtle }]}>
            Reports are reviewed within 24 hours. We take all reports seriously 
            and will take appropriate action.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 17,
  },
  submitButton: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  reasonButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  note: {
    fontSize: 13,
    marginTop: 20,
    lineHeight: 18,
  },
});
