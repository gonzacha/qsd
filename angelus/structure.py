def build_draft(*, source, fetched_at, title, text):
    return {
        "id": None,
        "source": source,
        "fetched_at": fetched_at,
        "title": title,
        "text": text,
        "summary": None,
        "key_facts": [],
        "status": "structured_draft",
        "_llm_draft": False,
        "validator": None,
        "notes": "",
    }
