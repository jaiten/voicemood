import * as DocumentPicker from "expo-document-picker";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import { PickedAudioFile } from "../types";
import { formatFilename } from "../utils/display";

type Props = {
  selectedFiles: PickedAudioFile[];
  onSelectedFilesChange: (files: PickedAudioFile[]) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  statusText: string;
  errorMessage: string;
};

const ACCEPTED_TYPES = ["audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/*"];

export function ImportScreen(props: Props) {
  const { selectedFiles, onSelectedFilesChange, onAnalyze, isAnalyzing, statusText, errorMessage } = props;

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const audioFiles = result.assets
      .filter((asset) => /\.(m4a|mp3|wav)$/i.test(asset.name))
      .map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      }));

    onSelectedFilesChange(audioFiles);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>VoiceMood</Text>
      <Text style={styles.title}>Import voice notes and get a lightweight happiness snapshot.</Text>
      <Text style={styles.subtitle}>
        This is a simple emotional summary that blends transcript wording with vocal tone. It is not medical advice.
      </Text>

      <Pressable onPress={pickFiles} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Import Voice Notes</Text>
      </Pressable>

      <View style={styles.fileBlock}>
        <View style={styles.fileBlockHeader}>
          <Text style={styles.sectionTitle}>Selected files</Text>
          <Text style={styles.countPill}>{selectedFiles.length}</Text>
        </View>

        {selectedFiles.length === 0 ? (
          <Text style={styles.emptyText}>Pick one or more `.m4a`, `.mp3`, or `.wav` files from Files.</Text>
        ) : (
          <FlatList
            data={selectedFiles}
            keyExtractor={(item) => item.uri}
            renderItem={({ item }) => (
              <View style={styles.fileRow}>
                <Text style={styles.fileName}>{formatFilename(item.name)}</Text>
                <Text style={styles.fileMeta}>{formatSize(item.size)}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            scrollEnabled={false}
          />
        )}
      </View>

      <Pressable
        onPress={onAnalyze}
        style={[styles.analyzeButton, (selectedFiles.length === 0 || isAnalyzing) && styles.disabledButton]}
        disabled={selectedFiles.length === 0 || isAnalyzing}
      >
        <Text style={styles.analyzeButtonText}>{isAnalyzing ? "Analyzing..." : "Analyze Notes"}</Text>
      </Pressable>

      {isAnalyzing && (
        <View style={styles.statusBox}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.statusText}>{statusText || "Working..."}</Text>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) {
    return "Size unavailable";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: colors.background,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  primaryButton: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  fileBlock: {
    marginTop: 20,
    borderRadius: 22,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  countPill: {
    minWidth: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
    textAlign: "center",
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  fileRow: {
    paddingVertical: 10,
  },
  fileName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  fileMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  analyzeButton: {
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.text,
  },
  analyzeButtonText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  disabledButton: {
    opacity: 0.5,
  },
  statusBox: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.accentSoft,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  errorBox: {
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.warningSoft,
  },
  errorText: {
    color: colors.warning,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
