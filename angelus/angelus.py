import argparse
import hashlib
import sys

from .clean import clean_text, clean_title
from .extract import extract_content
from .fetch import fetch_source
from .ledger import append_record
from .structure import build_draft
from .validate import validate_record


def _build_id(source, title, text):
    payload = f"{source}\n{title}\n{text[:2000]}"
    return hashlib.sha256(payload.encode("utf-8", errors="replace")).hexdigest()[:16]


def run_pipeline(*, url=None, file_path=None, raw_text=None, ledger_path="data/ledger/angelus.jsonl"):
    fetched = fetch_source(url=url, file_path=file_path, raw_text=raw_text)
    extracted = extract_content(fetched["raw"])

    title = clean_title(extracted["title"])
    text = clean_text(extracted["text"])

    record = build_draft(
        source=fetched["source"],
        fetched_at=fetched["fetched_at"],
        title=title,
        text=text,
    )
    record["id"] = _build_id(record["source"], record["title"], record["text"])
    record["status"] = "ingested"

    record = validate_record(record)
    append_record(record, ledger_path=ledger_path)
    return record


def _parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Angelus v0 — deterministic editorial pipeline (local-first)."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="Fetch from URL")
    source.add_argument("--file", dest="file_path", help="Read raw content from file")
    source.add_argument("--text", dest="raw_text", help="Use raw text string")
    source.add_argument("--stdin", action="store_true", help="Read raw content from stdin")
    parser.add_argument(
        "--ledger",
        dest="ledger_path",
        default="data/ledger/angelus.jsonl",
        help="Append-only ledger path (JSONL)",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = _parse_args(argv or sys.argv[1:])
    raw_text = args.raw_text
    if args.stdin:
        raw_text = sys.stdin.read()

    record = run_pipeline(
        url=args.url,
        file_path=args.file_path,
        raw_text=raw_text,
        ledger_path=args.ledger_path,
    )
    print(record["id"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
