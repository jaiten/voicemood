import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, shadows } from "../theme";
import { RootTabName } from "../types";

type Props = {
  activeTab: RootTabName;
  onChange: (tab: RootTabName) => void;
};

const TAB_ITEMS: Array<{ key: RootTabName; label: string; icon: string }> = [
  { key: "today", label: "Today", icon: "◐" },
  { key: "timeline", label: "Timeline", icon: "▦" },
  { key: "history", label: "History", icon: "◷" },
  { key: "capture", label: "Capture", icon: "+" },
];

export function PrimaryTabs({ activeTab, onChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.outerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabBar}>
        {TAB_ITEMS.map((item) => {
          const isActive = item.key === activeTab;

          return (
            <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.tabButton}>
              <View style={[styles.iconWrap, isActive ? styles.iconWrapActive : null]}>
                <Text style={[styles.iconText, isActive ? styles.iconTextActive : null]}>{item.icon}</Text>
              </View>
              <Text style={[styles.labelText, isActive ? styles.labelTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 28,
    backgroundColor: colors.tabBar,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    minHeight: 58,
    justifyContent: "center",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconWrapActive: {
    backgroundColor: colors.accentSoft,
  },
  iconText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: "700",
  },
  iconTextActive: {
    color: colors.accent,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  labelTextActive: {
    color: colors.text,
  },
});
