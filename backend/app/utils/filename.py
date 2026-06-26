import re
from string import Formatter

WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
}


class SafeTemplateValues(dict[str, str]):
    def __missing__(self, key: str) -> str:
        return f"{{{key}}}"


def find_template_tokens(template: str) -> list[str]:
    return [field_name for _, field_name, _, _ in Formatter().parse(template) if field_name]


def find_missing_template_tokens(template: str, values: dict[str, str]) -> list[str]:
    return [token for token in find_template_tokens(template) if token not in values or values[token] == ""]


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", value).strip(" .")
    cleaned = re.sub(r"\s+", "_", cleaned)
    if not cleaned:
        cleaned = "document"
    if cleaned.upper() in WINDOWS_RESERVED_NAMES:
        cleaned = f"{cleaned}_file"
    return cleaned[:180]


def sanitize_extension(extension: str) -> str:
    if not extension:
        return ""

    extension = extension.strip().lower()
    if not extension.startswith("."):
        extension = f".{extension}"
    return re.sub(r"[^.a-z0-9]", "", extension)[:16]


def build_filename(
    template: str,
    values: dict[str, str],
    prefix: str = "",
    suffix: str = "",
    extension: str = "",
) -> str:
    rendered = template.format_map(SafeTemplateValues(values))
    filename = sanitize_filename(f"{prefix}{rendered}{suffix}")
    normalized_extension = sanitize_extension(extension)
    return f"{filename}{normalized_extension}"


def append_duplicate_counter(filename: str, counter: int) -> str:
    dot_index = filename.rfind(".")
    if dot_index > 0:
        stem = filename[:dot_index]
        extension = filename[dot_index:]
    else:
        stem = filename
        extension = ""
    return f"{stem}_{counter}{extension}"
