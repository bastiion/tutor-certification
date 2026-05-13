import { parseInboundJson } from "./parseInboundJson.ts";

/** Parse RFC 5322 header block into lower-cased field names (first line only per field). */
export function parseMailHeaders(headerBlock: string): Map<string, string> {
  const lines = headerBlock.split(/\r?\n/);
  const out = new Map<string, string>();
  let current = "";
  let buf = "";
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (current !== "") buf += " " + line.trim();
      continue;
    }
    if (current !== "") {
      out.set(current.toLowerCase(), buf.trim());
    }
    const idx = line.indexOf(":");
    if (idx === -1) {
      current = "";
      buf = "";
      continue;
    }
    current = line.slice(0, idx).trim();
    buf = line.slice(idx + 1).trim();
  }
  if (current !== "") {
    out.set(current.toLowerCase(), buf.trim());
  }
  return out;
}

function headerParam(headers: Map<string, string>, name: string): string | null {
  const ct = headers.get(name.toLowerCase());
  if (ct === undefined) return null;
  return ct;
}

function boundaryFromContentType(ct: string): string | null {
  const m = /boundary\s*=\s*("?)([^";\s]+)\1/i.exec(ct);
  const raw = m?.[2];
  return raw !== undefined ? raw : null;
}

function decodeTransfer(body: string, encoding: string | undefined): string {
  const enc = (encoding ?? "7bit").toLowerCase().trim();
  const trimmed = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (enc === "base64") {
    const bin = atob(trimmed.replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (enc === "quoted-printable") {
    return trimmed
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(Number.parseInt(String(h), 16)));
  }
  return trimmed;
}

interface MimePart {
  headers: Map<string, string>;
  body: string;
}

function splitMultipart(body: string, boundary: string): string[] {
  const delim = `--${boundary}`;
  const chunks = body.split(delim);
  const out: string[] = [];
  for (const c of chunks) {
    const t = c.trim();
    if (t === "" || t === "--") continue;
    out.push(t);
  }
  return out;
}

function parseSinglePart(raw: string): MimePart {
  const sep = raw.search(/\r?\n\r?\n/);
  if (sep === -1) {
    return { headers: new Map(), body: raw };
  }
  const head = raw.slice(0, sep);
  const body = raw.slice(sep).replace(/^\r?\n\r?/, "");
  return { headers: parseMailHeaders(head), body };
}

function extractJsonFromPart(part: MimePart): string[] {
  const ct = headerParam(part.headers, "Content-Type") ?? "";
  const cte = headerParam(part.headers, "Content-Transfer-Encoding") ?? undefined;
  const decoded = decodeTransfer(part.body, cte);

  if (/^\s*application\/json\b/i.test(ct) || /^\s*text\/json\b/i.test(ct)) {
    const p = parseInboundJson(decoded.trim());
    if (p.ok) return [p.raw];
  }

  if (/^\s*multipart\//i.test(ct)) {
    const b = boundaryFromContentType(ct);
    if (b === null) return [];
    const nested = splitMultipart(part.body, b);
    const acc: string[] = [];
    for (const n of nested) {
      acc.push(...extractJsonFromPart(parseSinglePart(n)));
    }
    return acc;
  }

  return [];
}

/**
 * Scan any decoded chunk for a JSON object that begins with `"cert_id"` as emitted by Stage 4.
 */
function extractInlineCertJson(text: string): string[] {
  const marker = '"cert_id"';
  const idx = text.indexOf(marker);
  if (idx === -1) return [];
  const start = text.lastIndexOf("{", idx);
  if (start === -1) return [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\" && inStr) {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        const p = parseInboundJson(slice);
        return p.ok ? [p.raw] : [];
      }
    }
  }
  return [];
}

/**
 * Given one RFC 822 message (headers + body), return raw JSON certificate strings.
 */
export function extractCertificatesFromEml(emlText: string): string[] {
  const sep = emlText.search(/\r?\n\r?\n/);
  if (sep === -1) return [];
  const headerText = emlText.slice(0, sep);
  const body = emlText.slice(sep).replace(/^\r?\n\r?/, "");
  const headers = parseMailHeaders(headerText);
  const ct = headerParam(headers, "Content-Type") ?? "";

  const jsonStrings: string[] = [];

  if (/^\s*multipart\//i.test(ct)) {
    const b = boundaryFromContentType(ct);
    if (b !== null) {
      for (const chunk of splitMultipart(body, b)) {
        jsonStrings.push(...extractJsonFromPart(parseSinglePart(chunk)));
      }
    }
  } else {
    const cte = headerParam(headers, "Content-Transfer-Encoding") ?? undefined;
    const decoded = decodeTransfer(body, cte);
    jsonStrings.push(...extractJsonFromPart({ headers, body: decoded }));
  }

  if (jsonStrings.length === 0) {
    const cte = headerParam(headers, "Content-Transfer-Encoding") ?? undefined;
    const flat = decodeTransfer(body, cte);
    jsonStrings.push(...extractInlineCertJson(flat));
  }

  return jsonStrings;
}

/**
 * Split an mbox blob into separate RFC 822 messages (unix mbox “From ” delimiters).
 */
export function splitMboxMessages(mboxText: string): string[] {
  const lines = mboxText.split(/\r?\n/);
  const messages: string[] = [];
  let buf: string[] = [];
  let inMsg = false;

  for (const line of lines) {
    if (line.startsWith("From ") && inMsg) {
      messages.push(buf.join("\n"));
      buf = [];
      inMsg = false;
    }
    if (line.startsWith("From ") && !inMsg) {
      inMsg = true;
      continue;
    }
    if (inMsg) buf.push(line);
  }
  if (inMsg && buf.length > 0) {
    messages.push(buf.join("\n"));
  }
  if (messages.length === 0 && mboxText.trim() !== "") {
    return [mboxText.trim()];
  }
  return messages;
}

export function parseEmailAttachments(blob: string, kind: "emailMessage" | "mbox"): string[] {
  const rawCerts =
    kind === "mbox"
      ? splitMboxMessages(blob).flatMap((eml) => extractCertificatesFromEml(eml))
      : extractCertificatesFromEml(blob);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rawCerts) {
    if (seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  return out;
}
