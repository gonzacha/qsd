import datetime as dt
import pathlib
import urllib.request


class FetchError(RuntimeError):
    pass


def fetch_source(*, url=None, file_path=None, raw_text=None, timeout=12):
    if sum(v is not None for v in [url, file_path, raw_text]) != 1:
        raise FetchError("Provide exactly one of: url, file_path, raw_text.")

    fetched_at = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    if url is not None:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Angelus/0.1 (+local)",
                    "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
                },
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                content_type = resp.headers.get("Content-Type", "")
                charset = "utf-8"
                if "charset=" in content_type:
                    charset = content_type.split("charset=", 1)[1].split(";")[0].strip() or "utf-8"
                body = resp.read().decode(charset, errors="replace")
        except Exception as exc:
            raise FetchError(f"Failed to fetch URL: {exc}") from exc
        return {
            "source": url,
            "fetched_at": fetched_at,
            "raw": body,
        }

    if file_path is not None:
        path = pathlib.Path(file_path)
        if not path.exists():
            raise FetchError(f"File not found: {file_path}")
        body = path.read_text(encoding="utf-8", errors="replace")
        return {
            "source": str(path),
            "fetched_at": fetched_at,
            "raw": body,
        }

    return {
        "source": "raw_text",
        "fetched_at": fetched_at,
        "raw": raw_text or "",
    }
