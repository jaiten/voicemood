import { useEffect, useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { analyzeTextNote, analyzeVoiceNotes } from "./src/api";
import { NoticeBanner } from "./src/components/NoticeBanner";
import { PrimaryTabs } from "./src/components/PrimaryTabs";
import { CaptureScreen } from "./src/screens/CaptureScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { NoteDetailScreen } from "./src/screens/NoteDetailScreen";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { TimelineScreen } from "./src/screens/TimelineScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import {
  initializeJournalStore,
  saveImportedAudioEntries,
  saveRecordedAudioEntry,
  saveTextJournalEntry,
} from "./src/storage/journalStore";
import {
  AnalysisResponse,
  JournalEntry,
  JournalEntryType,
  NoticeTone,
  PickedAudioFile,
  RootTabName,
  ScreenName,
  TextNoteDraft,
} from "./src/types";
import { colors } from "./src/theme";
import { noteResultToJournalEntry } from "./src/utils/noteMapping";

type OverlayScreen = "results" | "detail" | null;

export default function App() {
  const [activeTab, setActiveTab] = useState<RootTabName>("today");
  const [overlayScreen, setOverlayScreen] = useState<OverlayScreen>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [detailBackScreen, setDetailBackScreen] = useState<ScreenName>("capture");
  const [detailBackLabel, setDetailBackLabel] = useState("Back to capture");
  const [isBusy, setIsBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [resultFiles, setResultFiles] = useState<PickedAudioFile[]>([]);
  const [resultEntryType, setResultEntryType] = useState<JournalEntryType>("imported_audio");

  useEffect(() => {
    initializeJournalStore().catch((error) => {
      console.warn("VoiceMood journal init failed", error);
    });
  }, []);

  const showNotice = (message: string, tone: NoticeTone = "info") => {
    setNoticeMessage(message);
    setNoticeTone(tone);
  };

  const clearMessages = () => {
    setErrorMessage("");
    setStatusText("");
  };

  const handleImportAnalyze = async (files: PickedAudioFile[]) => {
    if (files.length === 0) {
      setErrorMessage("Pick at least one voice note first.");
      return;
    }

    try {
      setIsBusy(true);
      clearMessages();
      setNoticeMessage("");
      setActiveTab("capture");
      setStatusText(`Uploading ${files.length} entr${files.length === 1 ? "y" : "ies"}...`);
      setResultFiles(files);
      setResultEntryType("imported_audio");

      const response = await analyzeVoiceNotes(files, setStatusText);
      setStatusText("Saving imported notes to your journal...");

      const saveResult = await saveImportedAudioEntries(files, response.results);

      if (saveResult.savedEntries.length > 0) {
        setHistoryRefreshKey((value) => value + 1);
      }

      if (saveResult.duplicateEntries.length > 0) {
        showNotice(
          saveResult.savedEntries.length === 0
            ? "These entries already existed in your journal."
            : `${saveResult.duplicateEntries.length} duplicate entr${saveResult.duplicateEntries.length === 1 ? "y was" : "ies were"} skipped.`,
        );
      }

      setAnalysis(response);
      setOverlayScreen("results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
      setStatusText("");
    }
  };

  const handleRecordedAnalyze = async (params: { file: PickedAudioFile; title?: string }) => {
    try {
      setIsBusy(true);
      clearMessages();
      setNoticeMessage("");
      setActiveTab("capture");
      setResultFiles([params.file]);
      setResultEntryType("recorded_audio");

      const response = await analyzeVoiceNotes([params.file], setStatusText);
      const result = response.results[0];

      if (!result || result.status !== "success") {
        setAnalysis(response);
        setOverlayScreen("results");
        return;
      }

      setStatusText("Saving recording to your journal...");
      const saveResult = await saveRecordedAudioEntry({
        analysis: result,
        file: params.file,
        title: params.title,
      });

      if (!saveResult) {
        throw new Error("The recording finished analyzing, but it could not be saved locally.");
      }

      if (saveResult.status === "saved") {
        setHistoryRefreshKey((value) => value + 1);
      } else {
        showNotice("This voice note already exists in your journal, so VoiceMood kept the original.");
      }

      setSelectedEntry(saveResult.entry);
      setDetailBackScreen("capture");
      setDetailBackLabel("Back to capture");
      setOverlayScreen("detail");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recording analysis failed.";
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
      setStatusText("");
    }
  };

  const handleTextAnalyze = async (draft: TextNoteDraft) => {
    if (!draft.body.trim()) {
      setErrorMessage("Write something before saving a text note.");
      return;
    }

    try {
      setIsBusy(true);
      clearMessages();
      setNoticeMessage("");
      setActiveTab("capture");

      const result = await analyzeTextNote(
        {
          text: draft.body,
          title: draft.title,
        },
        setStatusText,
      );

      if (result.status !== "success") {
        throw new Error(result.error || "Text note analysis failed.");
      }

      setStatusText("Saving text note to your journal...");
      const saveResult = await saveTextJournalEntry({
        title: draft.title,
        textContent: draft.body,
        analysis: result,
      });

      if (!saveResult) {
        throw new Error("The text note finished analyzing, but it could not be saved locally.");
      }

      if (saveResult.status === "saved") {
        setHistoryRefreshKey((value) => value + 1);
      } else {
        showNotice("This text note already exists in your journal, so VoiceMood kept the original.");
      }

      setSelectedEntry(saveResult.entry);
      setDetailBackScreen("capture");
      setDetailBackLabel("Back to capture");
      setOverlayScreen("detail");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Text note analysis failed.";
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
      setStatusText("");
    }
  };

  const handleSelectResultNote = (index: number) => {
    if (!analysis) {
      return;
    }

    const note = analysis.results[index];
    if (!note || note.status === "error") {
      return;
    }

    const previewEntry = noteResultToJournalEntry(note, {
      entryType: resultEntryType,
      file: resultFiles[index],
    });

    setSelectedEntry(previewEntry);
    setDetailBackScreen("results");
    setDetailBackLabel("Back to results");
    setOverlayScreen("detail");
  };

  const handleSelectStoredEntry = (entry: JournalEntry, source: RootTabName) => {
    setSelectedEntry(entry);
    setDetailBackScreen(source);
    setDetailBackLabel(
      source === "history"
        ? "Back to history"
        : source === "timeline"
          ? "Back to timeline"
          : source === "today"
            ? "Back to today"
            : "Back to capture",
    );
    setOverlayScreen("detail");
  };

  const handleBackFromDetail = () => {
    if (detailBackScreen === "results") {
      setOverlayScreen("results");
      return;
    }

    setActiveTab(detailBackScreen as RootTabName);
    setOverlayScreen(null);
  };

  const handleChangeTab = (tab: RootTabName) => {
    setActiveTab(tab);
    clearMessages();
    setNoticeMessage("");
    setOverlayScreen(null);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" />

        {!!noticeMessage ? (
          <NoticeBanner message={noticeMessage} tone={noticeTone} onDismiss={() => setNoticeMessage("")} />
        ) : null}

        <View style={styles.contentArea}>
          <View style={[styles.rootScene, activeTab === "today" ? styles.rootSceneVisible : styles.rootSceneHidden]}>
            <TodayScreen
              refreshKey={historyRefreshKey}
              onSelectEntry={(entry) => handleSelectStoredEntry(entry, "today")}
              onOpenCapture={() => handleChangeTab("capture")}
              onOpenTimeline={() => handleChangeTab("timeline")}
            />
          </View>

          <View style={[styles.rootScene, activeTab === "timeline" ? styles.rootSceneVisible : styles.rootSceneHidden]}>
            <TimelineScreen
              refreshKey={historyRefreshKey}
              onSelectEntry={(entry) => handleSelectStoredEntry(entry, "timeline")}
            />
          </View>

          <View style={[styles.rootScene, activeTab === "history" ? styles.rootSceneVisible : styles.rootSceneHidden]}>
            <HistoryScreen
              refreshKey={historyRefreshKey}
              onSelectEntry={(entry) => handleSelectStoredEntry(entry, "history")}
            />
          </View>

          <View style={[styles.rootScene, activeTab === "capture" ? styles.rootSceneVisible : styles.rootSceneHidden]}>
            <CaptureScreen
              isBusy={isBusy}
              statusText={statusText}
              errorMessage={errorMessage}
              onImportAnalyze={handleImportAnalyze}
              onRecordedAnalyze={handleRecordedAnalyze}
              onTextAnalyze={handleTextAnalyze}
            />
          </View>

          {overlayScreen === "results" && analysis ? (
            <View style={styles.overlayScene}>
              <ResultsScreen analysis={analysis} onBack={() => setOverlayScreen(null)} onSelectNote={handleSelectResultNote} />
            </View>
          ) : null}

          {overlayScreen === "detail" && selectedEntry ? (
            <View style={styles.overlayScene}>
              <NoteDetailScreen entry={selectedEntry} onBack={handleBackFromDetail} backLabel={detailBackLabel} />
            </View>
          ) : null}
        </View>

        {overlayScreen === null ? <PrimaryTabs activeTab={activeTab} onChange={handleChangeTab} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentArea: {
    flex: 1,
    position: "relative",
  },
  rootScene: {
    ...StyleSheet.absoluteFillObject,
  },
  rootSceneVisible: {
    display: "flex",
  },
  rootSceneHidden: {
    display: "none",
  },
  overlayScene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
});
