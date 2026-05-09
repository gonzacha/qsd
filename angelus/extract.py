from html.parser import HTMLParser


class ExtractError(RuntimeError):
    pass


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.in_body = False
        self.in_script = False
        self.in_style = False
        self.title_chunks = []
        self.body_chunks = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "title":
            self.in_title = True
        elif tag == "body":
            self.in_body = True
        elif tag == "script":
            self.in_script = True
        elif tag == "style":
            self.in_style = True
        elif tag in {"p", "br", "div", "section", "article", "h1", "h2", "h3", "li"}:
            self.body_chunks.append("\n")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        elif tag == "body":
            self.in_body = False
        elif tag == "script":
            self.in_script = False
        elif tag == "style":
            self.in_style = False
        elif tag in {"p", "div", "section", "article", "li"}:
            self.body_chunks.append("\n")

    def handle_data(self, data):
        if self.in_script or self.in_style:
            return
        text = data.strip()
        if not text:
            return
        if self.in_title:
            self.title_chunks.append(text)
        if self.in_body or not self.in_title:
            self.body_chunks.append(text)


def _looks_like_html(raw):
    snippet = raw[:500].lower()
    return "<html" in snippet or "<body" in snippet or "<p" in snippet or "</" in snippet


def extract_content(raw):
    if not raw:
        raise ExtractError("Empty source content.")

    if _looks_like_html(raw):
        parser = _TextExtractor()
        parser.feed(raw)
        title = " ".join(parser.title_chunks).strip()
        text = "\n".join(parser.body_chunks).strip()
        return {"title": title, "text": text, "is_html": True}

    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    title = lines[0] if lines else ""
    text = "\n".join(lines)
    return {"title": title, "text": text, "is_html": False}
