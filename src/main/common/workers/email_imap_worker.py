#!/usr/bin/env python3
import argparse
import imaplib
import json
import os
import re
import ssl
from datetime import datetime, timezone
from email import policy
from email.header import decode_header
from email.parser import BytesParser
from email.utils import parsedate_to_datetime


def _decode_header(value: str | None) -> str:
    if not value:
        return ""
    decoded_parts = decode_header(value)
    output = []
    for item, encoding in decoded_parts:
        if isinstance(item, bytes):
            try:
                output.append(item.decode(encoding or "utf-8", errors="replace"))
            except Exception:
                output.append(item.decode("utf-8", errors="replace"))
        else:
            output.append(item)
    return "".join(output).strip()


def _extract_body(msg) -> str:
    if msg.is_multipart():
        parts = msg.walk()
    else:
        parts = [msg]

    text_parts = []
    html_parts = []
    for part in parts:
        content_type = part.get_content_type()
        disposition = part.get_content_disposition() or ""
        if disposition == "attachment":
            continue

        try:
            payload = part.get_content()
        except Exception:
            payload = ""

        if isinstance(payload, bytes):
            charset = part.get_content_charset() or "utf-8"
            payload = payload.decode(charset, errors="replace")

        if not isinstance(payload, str):
            continue

        if content_type == "text/plain":
            text_parts.append(payload)
        elif content_type == "text/html":
            html_parts.append(payload)

    if text_parts:
        return "\n".join(text_parts).strip()

    if html_parts:
        stripped = re.sub(r"<[^>]+>", " ", "\n".join(html_parts))
        return re.sub(r"\s+", " ", stripped).strip()

    return ""


def _internal_date(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _imap_connect(host: str, port: int, use_tls: bool):
    if use_tls:
        context = ssl.create_default_context()
        return imaplib.IMAP4_SSL(host=host, port=port, ssl_context=context)

    client = imaplib.IMAP4(host=host, port=port)
    client.starttls(ssl_context=ssl.create_default_context())
    return client


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch unread IMAP messages")
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", required=True, type=int)
    parser.add_argument("--use-tls", required=True, choices=["true", "false"])
    parser.add_argument("--username", required=True)
    parser.add_argument("--max", required=False, type=int, default=50)
    parser.add_argument("--last-uid", required=False, type=int, default=0)
    args = parser.parse_args()

    password = os.environ.get("PRANA_IMAP_PASSWORD", "")
    if not password:
        raise RuntimeError("Missing PRANA_IMAP_PASSWORD environment variable.")

    client = _imap_connect(args.host, args.port, args.use_tls == "true")
    try:
        client.login(args.username, password)
        status, _ = client.select("INBOX")
        if status != "OK":
            raise RuntimeError("Unable to select INBOX.")

        status, data = client.uid("SEARCH", None, "UNSEEN")
        if status != "OK":
            raise RuntimeError("IMAP UID SEARCH failed.")

        raw_uids = []
        if data and isinstance(data[0], (bytes, bytearray)):
            raw_uids = [entry for entry in data[0].decode("utf-8", errors="ignore").split() if entry]

        filtered = []
        for uid_text in raw_uids:
            try:
                uid_number = int(uid_text)
            except ValueError:
                continue
            if uid_number > args.last_uid:
                filtered.append(uid_number)

        selected_uids = sorted(filtered)[-max(args.max, 1) :]
        output = []

        for uid in selected_uids:
            status, message_data = client.uid("FETCH", str(uid), "(RFC822)")
            if status != "OK" or not message_data:
                continue

            raw_message = None
            for block in message_data:
                if isinstance(block, tuple) and len(block) >= 2 and isinstance(block[1], (bytes, bytearray)):
                    raw_message = bytes(block[1])
                    break

            if raw_message is None:
                continue

            msg = BytesParser(policy=policy.default).parsebytes(raw_message)
            body = _extract_body(msg)
            normalized_body = re.sub(r"\s+", " ", body).strip()
            snippet = normalized_body[:500]

            output.append(
                {
                    "uid": uid,
                    "from": _decode_header(msg.get("From")) or "unknown@unknown",
                    "subject": _decode_header(msg.get("Subject")) or "(no subject)",
                    "snippet": snippet,
                    "body": normalized_body,
                    "internalDate": _internal_date(msg.get("Date")),
                    "threadId": _decode_header(msg.get("Message-ID"))
                    or _decode_header(msg.get("References"))
                    or f"uid:{uid}",
                }
            )

        print(json.dumps(output, ensure_ascii=True))
        return 0
    finally:
        try:
            client.close()
        except Exception:
            pass
        try:
            client.logout()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
