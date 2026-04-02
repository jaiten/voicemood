import { useState } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { analyzeVoiceNotes } from "./src/api";
import { ImportScreen } from "./src/screens/ImportScreen";
import { NoteDetailScreen } from "./src/screens/NoteDetailScreen";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { AnalysisResponse, NoteResult, PickedAudioFile, ScreenName } from "./src/types";

export default function App() {
  const [screen, setScreen] = useState<ScreenName>("import");
  const [selectedFiles, setSelectedFiles] = useState<PickedAudioFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage("Pick at least one voice note first.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMessage("");
      setStatusText(`Uploading ${selectedFiles.length} note${selectedFiles.length === 1 ? "" : "s"}...`);

      const response = await analyzeVoiceNotes(selectedFiles, setStatusText);
      setAnalysis(response);
      setScreen("results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      setErrorMessage(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectNote = (note: NoteResult) => {
    if (note.status === "error") {
      return;
    }
    setSelectedNote(note);
    setScreen("detail");
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />

        {screen === "import" && (
          <ImportScreen
            selectedFiles={selectedFiles}
            onSelectedFilesChange={setSelectedFiles}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            statusText={statusText}
            errorMessage={errorMessage}
          />
        )}

        {screen === "results" && analysis && (
          <ResultsScreen
            analysis={analysis}
            onBack={() => setScreen("import")}
            onSelectNote={handleSelectNote}
          />
        )}

        {screen === "detail" && selectedNote && (
          <NoteDetailScreen
            note={selectedNote}
            onBack={() => setScreen("results")}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f5ef",
  },
});
