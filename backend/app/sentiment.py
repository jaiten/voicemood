import re
from functools import lru_cache

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


TEXT_WEIGHT = 0.55
ACOUSTIC_WEIGHT = 0.35
KEYWORD_WEIGHT = 0.10
TEXT_ONLY_SENTIMENT_WEIGHT = 0.85
TEXT_ONLY_KEYWORD_WEIGHT = 0.15

POSITIVE_KEYWORDS = {
    "happy": 1.2,
    "good": 0.8,
    "great": 1.4,
    "better": 0.8,
    "calm": 1.0,
    "peaceful": 1.1,
    "grateful": 1.3,
    "thankful": 1.2,
    "hopeful": 1.2,
    "excited": 1.3,
    "joy": 1.4,
    "joyful": 1.4,
    "relaxed": 1.0,
    "love": 1.4,
    "proud": 1.1,
    "fun": 1.0,
    "energized": 1.0,
}

NEGATIVE_KEYWORDS = {
    "sad": 1.2,
    "bad": 0.8,
    "upset": 1.1,
    "angry": 1.4,
    "anxious": 1.4,
    "anxiety": 1.4,
    "stressed": 1.3,
    "stressful": 1.3,
    "stress": 1.2,
    "overwhelmed": 1.4,
    "tired": 0.9,
    "lonely": 1.1,
    "worried": 1.2,
    "worry": 1.1,
    "frustrated": 1.3,
    "depressed": 1.5,
    "drained": 1.1,
}

SUMMARY_STOPWORDS = {
    "a",
    "about",
    "actually",
    "after",
    "all",
    "also",
    "am",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "because",
    "been",
    "but",
    "by",
    "can",
    "could",
    "day",
    "did",
    "do",
    "for",
    "from",
    "get",
    "got",
    "had",
    "has",
    "have",
    "he",
    "her",
    "here",
    "him",
    "his",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "just",
    "kind",
    "like",
    "lot",
    "me",
    "more",
    "my",
    "now",
    "of",
    "on",
    "or",
    "our",
    "out",
    "pretty",
    "really",
    "she",
    "so",
    "some",
    "still",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "they",
    "this",
    "to",
    "today",
    "up",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "with",
    "would",
    "yeah",
    "you",
    "your",
}


def clamp_score(value: float, minimum: int = 0, maximum: int = 100) -> int:
    return int(round(max(minimum, min(maximum, value))))


def label_for_score(score: int) -> str:
    if score <= 39:
        return "Low"
    if score <= 69:
        return "Neutral"
    return "High"


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _count_keywords(text: str, keywords: dict[str, float]) -> float:
    total = 0.0
    for keyword, weight in keywords.items():
        matches = re.findall(rf"\b{re.escape(keyword)}\b", text)
        total += len(matches) * weight
    return total


def _split_sentences(text: str) -> list[str]:
    collapsed = re.sub(r"\s+", " ", text.strip())
    if not collapsed:
        return []

    return [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", collapsed) if sentence.strip()]


def _tokenize_summary_words(text: str) -> list[str]:
    return re.findall(r"[a-z']+", text.lower())


def _extract_topic_keywords(text: str, limit: int = 6) -> list[str]:
    keyword_counts: dict[str, int] = {}

    for token in _tokenize_summary_words(text):
        if len(token) < 3 or token in SUMMARY_STOPWORDS:
            continue
        keyword_counts[token] = keyword_counts.get(token, 0) + 1

    ranked = sorted(keyword_counts.items(), key=lambda item: (-item[1], -len(item[0]), item[0]))
    return [word for word, _ in ranked[:limit]]


def _score_sentence(sentence: str, topic_keywords: list[str]) -> float:
    if not sentence:
        return 0.0

    sentence_tokens = _tokenize_summary_words(sentence)
    if len(sentence_tokens) < 4:
        return 0.0

    keyword_set = set(topic_keywords)
    hits = sum(1 for token in sentence_tokens if token in keyword_set)
    if hits == 0:
        return 0.0

    return hits / max(1.0, len(sentence_tokens) ** 0.5)


def _trim_summary_text(text: str, max_chars: int = 120) -> str:
    collapsed = re.sub(r"\s+", " ", text.strip(" ."))
    if len(collapsed) <= max_chars:
        return collapsed

    clipped = collapsed[:max_chars].rsplit(" ", 1)[0].strip()
    return f"{clipped}..." if clipped else f"{collapsed[:max_chars].strip()}..."


def _topic_summary(text: str) -> str:
    sentences = _split_sentences(text)
    if not sentences:
        return "No clear topic was captured"

    topic_keywords = _extract_topic_keywords(text)
    if topic_keywords:
        ranked_sentences = sorted(
            sentences,
            key=lambda sentence: (
                _score_sentence(sentence, topic_keywords),
                min(len(sentence), 160),
            ),
            reverse=True,
        )
        best_sentence = ranked_sentences[0]
        if _score_sentence(best_sentence, topic_keywords) > 0:
            return _trim_summary_text(best_sentence)

    return _trim_summary_text(sentences[0])


@lru_cache
def get_sentiment_analyzer() -> SentimentIntensityAnalyzer:
    return SentimentIntensityAnalyzer()


def _keyword_scores(text: str) -> tuple[int, int, float, float]:
    positive_hits = _count_keywords(text, POSITIVE_KEYWORDS)
    negative_hits = _count_keywords(text, NEGATIVE_KEYWORDS)

    if positive_hits == 0 and negative_hits == 0:
        return 50, 0, positive_hits, negative_hits

    balance = positive_hits - negative_hits
    keyword_balance_score = clamp_score(50 + (balance * 8))
    keyword_adjustment_score = keyword_balance_score - 50

    return keyword_balance_score, keyword_adjustment_score, positive_hits, negative_hits


def analyze_transcript(text: str) -> dict[str, str | int | float]:
    cleaned_text = _normalize_text(text)
    if not cleaned_text:
        return {
            "transcript_sentiment_score": 50,
            "transcript_label": "Neutral",
            "keyword_balance_score": 50,
            "keyword_adjustment_score": 0,
            "positive_hits": 0.0,
            "negative_hits": 0.0,
        }

    sentiment_analyzer = get_sentiment_analyzer()
    compound = sentiment_analyzer.polarity_scores(cleaned_text)["compound"]
    transcript_sentiment_score = clamp_score((compound + 1) * 50)
    keyword_balance_score, keyword_adjustment_score, positive_hits, negative_hits = _keyword_scores(cleaned_text)

    return {
        "transcript_sentiment_score": transcript_sentiment_score,
        "transcript_label": label_for_score(transcript_sentiment_score),
        "keyword_balance_score": keyword_balance_score,
        "keyword_adjustment_score": keyword_adjustment_score,
        "positive_hits": positive_hits,
        "negative_hits": negative_hits,
    }


def combine_scores(
    transcript_sentiment_score: int,
    acoustic_tone_score: int,
    keyword_balance_score: int,
) -> int:
    return clamp_score(
        (transcript_sentiment_score * TEXT_WEIGHT)
        + (acoustic_tone_score * ACOUSTIC_WEIGHT)
        + (keyword_balance_score * KEYWORD_WEIGHT)
    )


def combine_text_only_scores(
    transcript_sentiment_score: int,
    keyword_balance_score: int,
) -> int:
    return clamp_score(
        (transcript_sentiment_score * TEXT_ONLY_SENTIMENT_WEIGHT)
        + (keyword_balance_score * TEXT_ONLY_KEYWORD_WEIGHT)
    )


def build_summary(
    transcript: str,
    transcript_label: str,
    keyword_adjustment_score: int,
    tone_label: str | None,
) -> str:
    topic_summary = _topic_summary(transcript)

    if transcript_label == "High":
        transcript_phrase = "the wording leans positive"
    elif transcript_label == "Low":
        transcript_phrase = "the wording leans negative"
    elif keyword_adjustment_score >= 6:
        transcript_phrase = "the wording feels slightly positive"
    elif keyword_adjustment_score <= -6:
        transcript_phrase = "the wording feels slightly negative"
    else:
        transcript_phrase = "the wording is fairly balanced"

    if not tone_label:
        return f"Main theme: {topic_summary}. Overall, {transcript_phrase}, with limited vocal cues."

    return f"Main theme: {topic_summary}. Overall, {transcript_phrase}, with {tone_label.lower()} vocal delivery."
