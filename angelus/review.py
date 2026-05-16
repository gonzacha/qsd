import argparse
import datetime as dt
import hashlib
import json
import pathlib
import sys

from .ledger import append_record


class ReviewError(RuntimeError):
    pass


def _build_event_id(target_id, action, created_at, validator, notes):
    payload = f"{target_id}\n{action}\n{created_at}\n{validator}\n{notes}"
    return hashlib.sha256(payload.encode("utf-8", errors="replace")).hexdigest()[:16]


def _load_target_record(ledger_path, target_id):
    path = pathlib.Path(ledger_path)
    if not path.exists():
        raise ReviewError(f"Ledger not found: {ledger_path}")

    target = None
    review_action = None

    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            if entry.get("event_type") == "human_review" and entry.get("target_id") == target_id:
                review_action = entry.get("action")
                continue

            if entry.get("id") == target_id and entry.get("event_type") is None:
                target = entry

    return target, review_action


def review_record(*, target_id, action, ledger_path, validator=None, notes=None):
    if action not in {"approve", "reject"}:
        raise ReviewError("Action must be: approve or reject.")

    target, review_action = _load_target_record(ledger_path, target_id)

    if target is None:
        raise ReviewError(f"Target record not found: {target_id}")
    if review_action in {"approved", "rejected"}:
        raise ReviewError(f"Target already reviewed: {review_action}")
    if target.get("status") != "pending_human":
        raise ReviewError(f"Target not reviewable (status={target.get('status')})")

    created_at = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    action_value = "approved" if action == "approve" else "rejected"
    validator_value = validator.strip() if validator else None
    notes_value = notes.strip() if notes else ""

    event = {
        "id": _build_event_id(target_id, action_value, created_at, validator_value, notes_value),
        "event_type": "human_review",
        "target_id": target_id,
        "action": action_value,
        "validator": validator_value,
        "notes": notes_value,
        "created_at": created_at,
    }

    append_record(event, ledger_path=ledger_path)
    return event


def _parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Angelus v0 — human review helper (append-only)."
    )
    parser.add_argument("--id", dest="target_id", required=True, help="Target record id")
    parser.add_argument(
        "--action",
        required=True,
        choices=["approve", "reject"],
        help="Review action",
    )
    parser.add_argument("--validator", help="Validator name", default=None)
    parser.add_argument("--notes", help="Optional notes", default=None)
    parser.add_argument(
        "--ledger",
        dest="ledger_path",
        default="data/ledger/angelus.jsonl",
        help="Append-only ledger path (JSONL)",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = _parse_args(argv or sys.argv[1:])
    event = review_record(
        target_id=args.target_id,
        action=args.action,
        ledger_path=args.ledger_path,
        validator=args.validator,
        notes=args.notes,
    )
    print(event["id"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
