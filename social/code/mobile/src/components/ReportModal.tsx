import React, { useCallback, useEffect, useState } from 'react';
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
import { submitReport } from '../services/report';
import { getAnonymousUserId, getClientMeta } from '../services/anonymousUserId';
import { Message } from '../types/chat';
import { ToneSettings } from '../types/runner';
import Toast from './Toast';
interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  messages: Message[];
  runnerName: string;
  tone?: ToneSettings;
}

const REPORT_REASONS = [
  'Inappropriate AI response',
  'Offensive content',
  'AI not working correctly',
  'Privacy concern',
  'Other',
];

export default function ReportModal({ visible, onClose, messages, runnerName, tone }: ReportModalProps) {
  const colors = useColors();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [closeAfterToast, setCloseAfterToast] = useState(false);

  useEffect(() => {
    // Reset any toast state when the modal closes.
    if (!visible) {
      setToastVisible(false);
      setToastMessage('');
      setCloseAfterToast(false);
      setIsSubmitting(false);
    }
  }, [visible]);

  const dismissToast = useCallback(() => {
    setToastVisible(false);
    if (closeAfterToast) {
      setCloseAfterToast(false);
      onClose();
    }
  }, [closeAfterToast, onClose]);

  const handleReport = async (reason: string, contactEmail: string) => {
    try {
      setIsSubmitting(true);
      const messagesForReport = messages
        .filter(m => !m.isSystem)
        .map((m, index) => ({
          id: m.id,
          index,
          role: m.sender === 'user' ? 'user' : 'runner',
          text: m.text,
          isActionable: !!m.isActionable,
        }));
      const anonymousUserId = await getAnonymousUserId();
      const clientMeta = getClientMeta();

      await submitReport({
        runner: runnerName,
        reason,
        details: '',
        contactEmail: contactEmail || undefined,
        messages: messagesForReport,
        clientMeta: {
          ...clientMeta,
          anonymousUserId,
          tone,
        },
      });
      
      setToastMessage('Report submitted. Thank you!');
      setCloseAfterToast(true);
      setToastVisible(true);
      
    } catch (error) {
      console.error('Failed to submit report:', error);
      setToastMessage('Failed to submit report. Please try again later.');
      setCloseAfterToast(false);
      setToastVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSubmit = () => {
    if (selectedReason) {
      void handleReport(selectedReason, contactEmail.trim());
      setSelectedReason(null);
      setContactEmail('');
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
          <Text style={[styles.title, { color: colors.text }]}>Report Issue</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close report modal"
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="report-close-button"
          >
            <Text style={[styles.closeButtonText, { color: colors.textMuted }]}>×</Text>
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

          <Text style={[styles.label, { color: colors.text }]}>
            Email (optional)
          </Text>
          <TextInput
            style={[styles.singleLineInput, {
              borderColor: colors.borderStrong,
              backgroundColor: colors.bgElevated,
              color: colors.text,
            }]}
            placeholder="you@email.com"
            placeholderTextColor={colors.textSubtle}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.note, { color: colors.textSubtle }]}>
            We’ll email you when the issue has been fixed
          </Text>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity 
            onPress={onClose} 
            testID="report-cancel-button"
            style={[styles.footerButton, { backgroundColor: colors.bgElevated }]}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            testID="report-submit-button"
            accessibilityLabel="Send"
            style={[
              styles.footerButton, 
              { backgroundColor: colors.accent },
              (!selectedReason || isSubmitting) && { backgroundColor: colors.bgElevated }
            ]}
          >
            <Text style={[
              styles.submitButtonText, 
              { color: colors.userBubbleText },
              (!selectedReason || isSubmitting) && { color: colors.textSubtle }
            ]}>
              {isSubmitting ? 'Sending…' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Render toast inside the Modal layer so it's visible while the modal is open */}
        <Toast
          visible={toastVisible}
          message={toastMessage}
          duration={closeAfterToast ? 1200 : 2500}
          type={closeAfterToast ? 'success' : 'error'}
          onDismiss={dismissToast}
          topOffset={12}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 24,
  },
  title: {
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
  singleLineInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  note: {
    fontSize: 13,
    marginTop: 20,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
