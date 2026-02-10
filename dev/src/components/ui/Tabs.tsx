import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Tabs({ defaultValue, value: controlledValue, onValueChange, children, style }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const value = controlledValue ?? internalValue;
  const setValue = (v: string) => {
    if (controlledValue === undefined) setInternalValue(v);
    onValueChange?.(v);
  };
  return (
    <View style={[styles.tabs, style]}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TabsList) {
          return React.cloneElement(child as React.ReactElement<{ value: string; onValueChange: (v: string) => void }>, { value, onValueChange: setValue });
        }
        if (React.isValidElement(child) && child.type === TabsContent) {
          const contentValue = (child.props as { value: string }).value;
          if (contentValue !== value) return null;
          return child;
        }
        return child;
      })}
    </View>
  );
}

function TabsList({ value, onValueChange, children, style }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[styles.list, { borderBottomColor: c.border }, style]}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TabsTrigger) {
          const triggerValue = (child.props as { value: string }).value;
          return React.cloneElement(child as React.ReactElement<{ value: string; selected: boolean; onSelect: () => void }>, {
            selected: value === triggerValue,
            onSelect: () => onValueChange(triggerValue),
          });
        }
        return child;
      })}
    </View>
  );
}

function TabsTrigger({
  value: _value,
  children,
  selected,
  onSelect,
  style,
}: {
  value: string;
  children: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <Pressable onPress={onSelect} style={[styles.trigger, selected && { borderBottomColor: c.accent, borderBottomWidth: 2 }, style]} accessibilityRole="tab">
      <Text style={[styles.triggerText, { color: selected ? c.text : c.textMuted }]}>{children}</Text>
    </Pressable>
  );
}

function TabsContent({ value: _value, children, style }: { value: string; children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  tabs: { flex: 1 },
  list: { flexDirection: 'row', borderBottomWidth: 1 },
  trigger: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  triggerText: { fontSize: fontSizes.sm, fontWeight: '500', fontFamily: fontFamily.body },
  content: { flex: 1 },
});

export { TabsList, TabsTrigger, TabsContent };
