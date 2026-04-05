import { StyleSheet, Text, View } from "react-native";

import { getEntryTypeTheme } from "../theme";
import { JournalEntryType } from "../types";


type Props = {
  entryType: JournalEntryType;
};

const LABELS: Record<JournalEntryType, string> = {
  imported_audio: "Imported audio",
  recorded_audio: "Recorded audio",
  text: "Text note",
};

export function EntryTypeBadge({ entryType }: Props) {
  const theme = getEntryTypeTheme(entryType);

  return (
    <View style={[styles.badge, { backgroundColor: theme.background }]}>
      <Text style={[styles.badgeText, { color: theme.text }]}>{LABELS[entryType]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
