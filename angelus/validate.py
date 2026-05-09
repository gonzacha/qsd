class ValidationError(RuntimeError):
    pass


def validate_record(record, *, min_text_length=200):
    title = (record.get("title") or "").strip()
    text = (record.get("text") or "").strip()

    if not title:
        raise ValidationError("Validation failed: title is empty.")
    if not text:
        raise ValidationError("Validation failed: text is empty.")
    if len(text) < min_text_length:
        raise ValidationError(
            f"Validation failed: text length {len(text)} < {min_text_length}."
        )

    record["status"] = "pending_human"
    record["validator"] = None
    record["notes"] = record.get("notes") or ""
    return record
