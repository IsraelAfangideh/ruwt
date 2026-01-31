/**
 * UserActionBar - A pure UI shell for user message actions
 * 
 * This is a "dumb" component with zero business logic.
 * Runners decide WHAT actions to show, this component only handles HOW they look.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '../../theme';

export type UserAction = {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  color?: 'accent' | 'success' | 'muted';
  disabled?: boolean;
  activeLabel?: string; // Label to show when action is "active" (e.g., "Copied!")
  isActive?: boolean;
};

type Props = {
  actions: UserAction[];
  onDismiss: () => void;
};

export default function UserActionBar({ actions, onDismiss }: Props) {
  const colors = useColors();

  const getColor = (colorKey?: 'accent' | 'success' | 'muted') => {
    switch (colorKey) {
      case 'accent': return colors.accent;
      case 'success': return colors.success;
      case 'muted': return colors.textMuted;
      default: return colors.accent;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgElevated }]}>
      {actions.map((action, index) => {
        const color = getColor(action.color);
        const label = action.isActive && action.activeLabel ? action.activeLabel : action.label;
        
        return (
          <React.Fragment key={action.id}>
            {index > 0 && (
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            )}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={action.onPress}
              activeOpacity={0.7}
              disabled={action.disabled}
            >
              <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
                <Feather name={action.icon} size={15} color={color} />
              </View>
              <Text style={[styles.label, { color: action.isActive ? color : colors.text }]}>
                {label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}

      {/* Dismiss button */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onDismiss}
        activeOpacity={0.7}
      >
        <Feather name="x" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  dismissButton: {
    marginLeft: 4,
    padding: 4,
  },
});

