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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Report Issue</Text>
          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={!selectedReason}
          >
            <Text style={[styles.submitButton, !selectedReason && styles.disabled]}>
              Submit
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.subtitle}>
            Report an issue with {runnerName}
          </Text>

          <Text style={styles.label}>What's the problem?</Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[
                styles.reasonButton,
                selectedReason === reason && styles.reasonButtonSelected,
              ]}
              onPress={() => setSelectedReason(reason)}
            >
              <Text
                style={[
                  styles.reasonText,
                  selectedReason === reason && styles.reasonTextSelected,
                ]}
              >
                {reason}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>Additional details (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe the issue..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={details}
            onChangeText={setDetails}
          />

          <Text style={styles.note}>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  submitButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabled: {
    color: '#ccc',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
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
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  reasonButtonSelected: {
    backgroundColor: '#000',
  },
  reasonText: {
    fontSize: 16,
    color: '#333',
  },
  reasonTextSelected: {
    color: '#fff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  note: {
    fontSize: 13,
    color: '#999',
    marginTop: 20,
    lineHeight: 18,
  },
});

