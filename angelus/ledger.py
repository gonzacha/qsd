import json
import pathlib


class LedgerError(RuntimeError):
    pass


def append_record(record, *, ledger_path):
    path = pathlib.Path(ledger_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    try:
        line = json.dumps(record, ensure_ascii=True, sort_keys=True)
    except (TypeError, ValueError) as exc:
        raise LedgerError(f"Record is not JSON-serializable: {exc}") from exc

    with path.open("a", encoding="utf-8") as handle:
        handle.write(line)
        handle.write("\n")
