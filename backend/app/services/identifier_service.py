from dataclasses import dataclass
import re


@dataclass(frozen=True)
class IdentifierMatch:
    label: str
    display_label: str
    value: str
    confidence: float


@dataclass(frozen=True)
class IdentifierRule:
    label: str
    display_label: str
    patterns: tuple[re.Pattern[str], ...]
    min_length: int
    max_length: int
    base_confidence: float


class IdentifierService:
    _VALUE_PATTERN = r"([A-Z0-9][A-Z0-9 ./_-]{2,48}[A-Z0-9])"
    _SEPARATOR_PATTERN = r"\s*(?:no\.?|number|num|id|#)?\s*[:#\-]?\s*"

    RULES: tuple[IdentifierRule, ...] = (
        IdentifierRule(
            label="account_number",
            display_label="Account Number",
            patterns=(
                re.compile(rf"\b(?:account|acct|a/c){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
                re.compile(rf"\b(?:account\s*(?:holder\s*)?number){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
            ),
            min_length=5,
            max_length=34,
            base_confidence=0.84,
        ),
        IdentifierRule(
            label="certificate_number",
            display_label="Certificate Number",
            patterns=(
                re.compile(rf"\b(?:certificate|cert){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
                re.compile(rf"\b(?:certificate\s*(?:id|serial)){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
            ),
            min_length=4,
            max_length=40,
            base_confidence=0.84,
        ),
        IdentifierRule(
            label="invoice_number",
            display_label="Invoice Number",
            patterns=(
                re.compile(rf"\b(?:invoice|inv){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
                re.compile(rf"\b(?:bill\s*(?:no\.?|number|#)){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
            ),
            min_length=3,
            max_length=35,
            base_confidence=0.86,
        ),
        IdentifierRule(
            label="receipt_number",
            display_label="Receipt Number",
            patterns=(
                re.compile(rf"\b(?:receipt|rcpt){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
                re.compile(rf"\b(?:transaction\s*(?:receipt|ref|reference)){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
            ),
            min_length=3,
            max_length=35,
            base_confidence=0.85,
        ),
        IdentifierRule(
            label="membership_id",
            display_label="Membership ID",
            patterns=(
                re.compile(rf"\b(?:membership|member|mem){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
                re.compile(rf"\b(?:member\s*(?:id|no\.?|number|#)){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
            ),
            min_length=3,
            max_length=35,
            base_confidence=0.84,
        ),
        IdentifierRule(
            label="registration_number",
            display_label="Registration Number",
            patterns=(
                re.compile(rf"\b(?:registration|regn|reg){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
                re.compile(rf"\b(?:registration\s*(?:id|code)){_SEPARATOR_PATTERN}{_VALUE_PATTERN}", re.I),
            ),
            min_length=4,
            max_length=40,
            base_confidence=0.84,
        ),
    )

    _TRAILING_WORDS = re.compile(
        r"\b(?:date|name|address|amount|total|balance|ifsc|branch|phone|email|page|issued|valid)\b.*$",
        re.I,
    )
    _INVALID_ONLY_PUNCTUATION = re.compile(r"^[._\-/ ]+$")

    def detect(self, text: str) -> list[IdentifierMatch]:
        normalized_text = self._normalize_text(text)
        if not normalized_text:
            return []

        best_by_label_value: dict[tuple[str, str], IdentifierMatch] = {}
        for rule in self.RULES:
            for pattern in rule.patterns:
                for match in pattern.finditer(normalized_text):
                    value = self._normalize_value(match.group(1))
                    if not self._is_valid_value(value, rule):
                        continue

                    candidate = IdentifierMatch(
                        label=rule.label,
                        display_label=rule.display_label,
                        value=value,
                        confidence=self._score_match(rule, value, match.group(0)),
                    )
                    key = (candidate.label, candidate.value.upper())
                    existing = best_by_label_value.get(key)
                    if existing is None or candidate.confidence > existing.confidence:
                        best_by_label_value[key] = candidate

        return sorted(
            best_by_label_value.values(),
            key=lambda item: (item.label, -item.confidence, item.value),
        )

    def detect_as_dicts(self, text: str) -> list[dict[str, str | float]]:
        return [
            {
                "label": match.label,
                "display_label": match.display_label,
                "value": match.value,
                "confidence": match.confidence,
            }
            for match in self.detect(text)
        ]

    def _normalize_text(self, text: str) -> str:
        text = text.replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    def _normalize_value(self, value: str) -> str:
        value = value.strip()
        value = self._TRAILING_WORDS.sub("", value).strip()
        value = re.sub(r"\s{2,}", " ", value)
        return value.strip(" .,:;#")

    def _is_valid_value(self, value: str, rule: IdentifierRule) -> bool:
        compact = re.sub(r"[\s._/-]", "", value)
        if not compact:
            return False
        if self._INVALID_ONLY_PUNCTUATION.match(value):
            return False
        if len(compact) < rule.min_length or len(compact) > rule.max_length:
            return False
        if not re.search(r"\d", compact):
            return False
        if re.fullmatch(r"0+", compact):
            return False
        return True

    def _score_match(self, rule: IdentifierRule, value: str, matched_text: str) -> float:
        compact = re.sub(r"[\s._/-]", "", value)
        score = rule.base_confidence

        if re.search(r"(?:no\.?|number|id|#)", matched_text, re.I):
            score += 0.05
        if re.search(r"[:#-]", matched_text):
            score += 0.03
        if any(separator in value for separator in ("-", "/", "_")):
            score += 0.02
        if re.search(r"[A-Z]", compact, re.I) and re.search(r"\d", compact):
            score += 0.03
        if len(compact) >= 8:
            score += 0.02
        if re.search(r"\b(?:date|amount|total|phone|pin|zip)\b", matched_text, re.I):
            score -= 0.08

        return round(max(0.1, min(score, 0.99)), 2)
