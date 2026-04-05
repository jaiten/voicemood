import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";


type SegmentItem<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  items: SegmentItem<T>[];
  activeKey: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ items, activeKey, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[styles.item, isActive && styles.itemActive]}
          >
            <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    padding: 6,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  itemActive: {
    backgroundColor: colors.accentSoft,
  },
  itemText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  itemTextActive: {
    color: colors.accent,
  },
});
