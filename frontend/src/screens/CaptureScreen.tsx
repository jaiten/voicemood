import * as DocumentPicker from "expo-document-picker";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedCard } from "../components/AnimatedCard";
import { SegmentedControl } from "../components/SegmentedControl";
import { colors, shadows } from "../theme";
import { CaptureMode, PickedAudioFile, TextNoteDraft } from "../types";
import { formatFilename } from "../utils/display";


const ACCEPTED_TYPES = ["audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/*"];
const CAPTURE_MODES: Array<{ key: CaptureMode; label: string }> = [
  { key: "import", label: "Import" },
  { key: "record", label: "Record" },
  { key: "text", label: "Write" },
];

type Props = {
  isBusy: boolean;
  statusText: string;
  errorMessage: string;
  onImportAnalyze: (files: PickedAudioFile[]) => Promise<void>;
  onRecordedAnalyze: (params: { file: PickedAudioFile; title?: string }) => Promise<void>;
  onTextAnalyze: (draft: TextNoteDraft) => Promise<void>;
};

export function CaptureScreen({ isBusy, statusText, errorMessage, onImportAnalyze, onRecordedAnalyze, onTextAnalyze }: Props) {
  const [mode, setMode] = useState<CaptureMode>("import");
  const [selectedFiles, setSelectedFiles] = useState<PickedAudioFile[]>([]);
  const [recordingTitle, setRecordingTitle] = useState("");
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;

    const configureAudio = async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted && mounted) {
          setRecordingError("Microphone access is required to record inside the app.");
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : "Could not prepare recording.";
          setRecordingError(message);
        }
      }
    };

    configureAudio();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (recorderState.isRecording) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.12,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();

      return () => {
        animation.stop();
      };
    }

    Animated.timing(pulse, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    return () => {
      pulse.stopAnimation();
    };
  }, [pulse, recorderState.isRecording]);

  const pulseStyle = {
    transform: [{ scale: pulse }],
    opacity: recorderState.isRecording ? 0.25 : 0,
  };

  const handlePickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const importedAt = new Date().toISOString();
    const audioFiles = result.assets.filter((asset) => /\.(m4a|mp3|wav)$/i.test(asset.name));
    const preparedFiles = audioFiles.map((asset) => {
      const file = new File(asset.uri);
      const info = file.info();

      return {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        sourceCreatedAt: null,
        sourceModifiedAt: asset.lastModified
          ? new Date(asset.lastModified).toISOString()
          : info.modificationTime
            ? new Date(info.modificationTime).toISOString()
            : null,
        importedAt,
      } satisfies PickedAudioFile;
    });

    setSelectedFiles(preparedFiles);
  };

  const handleAnalyzeImports = async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    await onImportAnalyze(selectedFiles);
    setSelectedFiles([]);
  };

  const handleToggleRecording = async () => {
    setRecordingError("");

    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        setRecordingUri(recorder.uri ?? null);
        return;
      }

      setRecordingUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recording could not start.";
      setRecordingError(message);
    }
  };

  const handleDiscardRecording = () => {
    setRecordingUri(null);
    setRecordingTitle("");
  };

  const handleSaveRecording = async () => {
    if (!recordingUri) {
      return;
    }

    const recordingsDirectory = new Directory(Paths.document, "recordings");
    recordingsDirectory.create({ intermediates: true, idempotent: true });

    const importedAt = new Date().toISOString();
    const filename = buildRecordingFilename(recordingTitle, importedAt);
    const sourceFile = new File(recordingUri);
    const destination = new File(recordingsDirectory, filename);
    sourceFile.copy(destination);

    const info = destination.info();
    const pickedFile: PickedAudioFile = {
      uri: destination.uri,
      name: filename,
      mimeType: "audio/mp4",
      size: info.size ?? undefined,
      sourceCreatedAt: info.creationTime ? new Date(info.creationTime).toISOString() : importedAt,
      sourceModifiedAt: info.modificationTime ? new Date(info.modificationTime).toISOString() : importedAt,
      importedAt,
    };

    await onRecordedAnalyze({
      file: pickedFile,
      title: recordingTitle.trim() || undefined,
    });

    setRecordingTitle("");
    setRecordingUri(null);
  };

  const handleSaveTextNote = async () => {
    if (!textBody.trim()) {
      return;
    }

    await onTextAnalyze({
      title: textTitle.trim() || undefined,
      body: textBody.trim(),
    });

    setTextTitle("");
    setTextBody("");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>VoiceMood Journal</Text>
      <Text style={styles.title}>Capture thoughts by voice or text, then revisit the emotional pattern over time.</Text>
      <Text style={styles.subtitle}>Use import for old memos, record for new reflections, or write a quick text entry.</Text>

      <View style={styles.segmentWrap}>
        <SegmentedControl items={CAPTURE_MODES} activeKey={mode} onChange={setMode} />
      </View>

      {mode === "import" && (
        <AnimatedCard delay={40} style={styles.heroCard}>
          <Text style={styles.cardTitle}>Import Voice Memos</Text>
          <Text style={styles.cardBody}>
            Bring in one or many recordings from Files. When available, the original file date is kept for history and
            timeline grouping.
          </Text>

          <Pressable onPress={handlePickFiles} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Choose audio files</Text>
          </Pressable>

          <View style={styles.selectionPanel}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Selected files</Text>
              <Text style={styles.selectionCount}>{selectedFiles.length}</Text>
            </View>

            {selectedFiles.length === 0 ? (
              <Text style={styles.selectionEmpty}>Pick `.m4a`, `.mp3`, or `.wav` files from Files.</Text>
            ) : (
              selectedFiles.map((file) => (
                <View key={file.uri} style={styles.selectionRow}>
                  <Text style={styles.selectionName}>{formatFilename(file.name)}</Text>
                  <Text style={styles.selectionMeta}>{formatFileDateHint(file)}</Text>
                </View>
              ))
            )}
          </View>

          <Pressable
            onPress={handleAnalyzeImports}
            disabled={selectedFiles.length === 0 || isBusy}
            style={[styles.secondaryButton, (selectedFiles.length === 0 || isBusy) && styles.buttonDisabled]}
          >
            <Text style={styles.secondaryButtonText}>{isBusy ? "Analyzing..." : "Analyze imported notes"}</Text>
          </Pressable>
        </AnimatedCard>
      )}

      {mode === "record" && (
        <AnimatedCard delay={40} style={styles.heroCard}>
          <Text style={styles.cardTitle}>Record Voice Note</Text>
          <Text style={styles.cardBody}>Record inside the app, then save and analyze it as a journal entry.</Text>

          <TextInput
            value={recordingTitle}
            onChangeText={setRecordingTitle}
            placeholder="Optional title"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <View style={styles.recordingPanel}>
            <Animated.View style={[styles.recordPulse, pulseStyle]} />
            <Pressable onPress={handleToggleRecording} style={styles.recordButton}>
              <Text style={styles.recordButtonLabel}>{recorderState.isRecording ? "Stop" : "Record"}</Text>
            </Pressable>
          </View>

          <Text style={styles.recordingHint}>
            {recorderState.isRecording
              ? `Recording ${formatDuration(recorderState.durationMillis)}`
              : recordingUri
                ? `Ready to save - ${formatDuration(recorderState.durationMillis)}`
                : "Tap record when you are ready"}
          </Text>

          {!!recordingUri && (
            <View style={styles.recordingActions}>
              <Pressable onPress={handleSaveRecording} disabled={isBusy} style={[styles.primaryButton, isBusy && styles.buttonDisabled]}>
                <Text style={styles.primaryButtonText}>{isBusy ? "Analyzing..." : "Save and analyze"}</Text>
              </Pressable>

              <Pressable onPress={handleDiscardRecording} style={styles.ghostButton}>
                <Text style={styles.ghostButtonText}>Discard</Text>
              </Pressable>
            </View>
          )}

          {!!recordingError && <Text style={styles.inlineError}>{recordingError}</Text>}
        </AnimatedCard>
      )}

      {mode === "text" && (
        <AnimatedCard delay={40} style={styles.heroCard}>
          <Text style={styles.cardTitle}>Write Text Note</Text>
          <Text style={styles.cardBody}>Add a short title if you want, then write the note and save it into your journal.</Text>

          <TextInput
            value={textTitle}
            onChangeText={setTextTitle}
            placeholder="Optional title"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <TextInput
            value={textBody}
            onChangeText={setTextBody}
            placeholder="What happened today? What's on your mind?"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textArea]}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            onPress={handleSaveTextNote}
            disabled={!textBody.trim() || isBusy}
            style={[styles.primaryButton, (!textBody.trim() || isBusy) && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{isBusy ? "Analyzing..." : "Analyze and save text note"}</Text>
          </Pressable>
        </AnimatedCard>
      )}

      {isBusy && (
        <AnimatedCard delay={80} style={styles.statusCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.statusText}>{statusText || "Working..."}</Text>
        </AnimatedCard>
      )}

      {!!errorMessage && (
        <AnimatedCard delay={80} style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </AnimatedCard>
      )}
    </ScrollView>
  );
}

function buildRecordingFilename(title: string, importedAt: string): string {
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const timestamp = importedAt.replace(/[:.]/g, "-");
  return `${safeTitle || "voice-note"}-${timestamp}.m4a`;
}

function formatDuration(durationMillis: number): string {
  const totalSeconds = Math.floor(durationMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatFileDateHint(file: PickedAudioFile): string {
  if (file.sourceCreatedAt) {
    return "Original date kept";
  }

  if (file.sourceModifiedAt) {
    return "Using source modified date";
  }

  return "Using import date";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.accent,
  },
  title: {
    marginTop: 10,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  segmentWrap: {
    marginTop: 20,
  },
  heroCard: {
    marginTop: 18,
    padding: 22,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.text,
  },
  cardBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.accent,
    ...shadows.card,
  },
  primaryButtonText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.text,
  },
  secondaryButtonText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  selectionPanel: {
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.surfaceMutedSoft,
  },
  selectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  selectionCount: {
    minWidth: 32,
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    color: colors.text,
    fontWeight: "700",
  },
  selectionEmpty: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  selectionRow: {
    paddingTop: 12,
  },
  selectionName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  selectionMeta: {
    marginTop: 3,
    fontSize: 13,
    color: colors.textMuted,
  },
  input: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMutedSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    minHeight: 176,
    paddingTop: 16,
  },
  recordingPanel: {
    marginTop: 26,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
  },
  recordPulse: {
    position: "absolute",
    width: 134,
    height: 134,
    borderRadius: 999,
    backgroundColor: colors.warning,
  },
  recordButton: {
    width: 96,
    height: 96,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning,
    ...shadows.card,
  },
  recordButtonLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  recordingHint: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    color: colors.textMuted,
  },
  recordingActions: {
    marginTop: 18,
    gap: 12,
  },
  ghostButton: {
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    backgroundColor: colors.surfaceMuted,
  },
  ghostButtonText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  inlineError: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
    fontWeight: "600",
  },
  statusCard: {
    marginTop: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  errorCard: {
    marginTop: 16,
    padding: 18,
    backgroundColor: colors.warningSoft,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
    fontWeight: "600",
  },
});
