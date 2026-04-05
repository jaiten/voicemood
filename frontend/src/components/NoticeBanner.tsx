import { Pressable, StyleSheet, Text, View } from "react-native";

import { NoticeTone } from "../types";
import { colors } from "../theme";

type Props = {
  message: string;
  tone?: NoticeTone;
  onDismiss?: () => void;
};

export function NoticeBanner({ message, tone = "info", onDismiss }: Props) {
  const palette =
    tone === "warning"
      ? { background: colors.warningSoft, text: colors.warning }
      : { background: colors.infoSoft, text: colors.info };

  return (
    <View style={[styles.banner, { backgroundColor: palette.background }]}>
      <Text style={[styles.message, { color: palette.text }]}>{message}</Text>

      {onDismiss ? (
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Text style={[styles.dismissText, { color: palette.text }]}>Close</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  dismissButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
