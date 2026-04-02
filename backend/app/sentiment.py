import re
from functools import lru_cache

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


TEXT_WEIGHT = 0.55
ACOUSTIC_WEIGHT = 0.35
KEYWORD_WEIGHT = 0.10

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


def build_summary(
    transcript_label: str,
    keyword_adjustment_score: int,
    tone_label: str | None,
) -> str:
    if transcript_label == "High":
        transcript_phrase = "Positive transcript"
    elif transcript_label == "Low":
        transcript_phrase = "Negative transcript"
    elif keyword_adjustment_score >= 6:
        transcript_phrase = "Slightly positive transcript"
    elif keyword_adjustment_score <= -6:
        transcript_phrase = "Slightly negative transcript"
    else:
        transcript_phrase = "Balanced transcript"

    if not tone_label:
        return f"{transcript_phrase} with limited vocal cues."

    return f"{transcript_phrase} with {tone_label.lower()} vocal delivery."
