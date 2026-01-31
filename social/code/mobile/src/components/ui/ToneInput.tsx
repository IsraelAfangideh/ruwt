import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import BaseInput from './BaseInput';
import { useColors } from '../../theme';
import { ToneSettings } from '../../types/runner';

type Props = {
  input: string;
  isLoading: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
  tone: ToneSettings;
  onToneChange: (tone: ToneSettings) => void;
};

function ToneModal({
  visible,
  onClose,
  tone,
  onToneChange,
}: {
  visible: boolean;
  onClose: () => void;
  tone: ToneSettings;
  onToneChange: (tone: ToneSettings) => void;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width - 32, 520);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.bg, width: containerWidth }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Tone</Text>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderTitle, { color: colors.text }]}>Kindness</Text>
                <Text style={[styles.sliderValue, { color: colors.textMuted }]}>
                  {Math.round(tone.kindness * 100)}%
                </Text>
              </View>
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, { color: colors.textSubtle }]}>Mean</Text>
                <Text style={[styles.sliderLabel, { color: colors.textSubtle }]}>Kind</Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={1}
                value={tone.kindness}
                onValueChange={(value) => onToneChange({ ...tone, kindness: value })}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accent}
              />
            </View>

            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderTitle, { color: colors.text }]}>Formality</Text>
                <Text style={[styles.sliderValue, { color: colors.textMuted }]}>
                  {Math.round(tone.formality * 100)}%
                </Text>
              </View>
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, { color: colors.textSubtle }]}>Casual</Text>
                <Text style={[styles.sliderLabel, { color: colors.textSubtle }]}>Formal</Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={1}
                value={tone.formality}
                onValueChange={(value) => onToneChange({ ...tone, formality: value })}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accent}
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.modalButton, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.modalButtonText, { color: colors.userBubbleText }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ToneInput({
  input,
  isLoading,
  onChangeText,
  onSend,
  tone,
  onToneChange,
}: Props) {
  const colors = useColors();
  const [showTone, setShowTone] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.toneRow}>
        <Text style={[styles.toneLabel, { color: colors.textMuted }]}>
          Tone: Kindness {Math.round(tone.kindness * 100)}% · Formality {Math.round(tone.formality * 100)}%
        </Text>
        <TouchableOpacity
          onPress={() => setShowTone(true)}
          style={[styles.toneButton, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}
        >
          <Text style={[styles.toneButtonText, { color: colors.text }]}>Adjust</Text>
        </TouchableOpacity>
      </View>

      <BaseInput
        input={input}
        isLoading={isLoading}
        onChangeText={onChangeText}
        onSend={onSend}
      />

      <ToneModal
        visible={showTone}
        onClose={() => setShowTone(false)}
        tone={tone}
        onToneChange={onToneChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  toneLabel: {
    fontSize: 13,
  },
  toneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  toneButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalContent: {
    paddingBottom: 8,
  },
  sliderSection: {
    marginBottom: 18,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: 13,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 12,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
