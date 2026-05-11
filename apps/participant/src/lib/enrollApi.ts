export type EnrollPostResult =
  | { ok: true; rawBody: string }
  | { ok: false; kind: "gone" }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "bad_request"; message: string }
  | { ok: false; kind: "server"; message: string };

export async function postEnrollment(
  token: string,
  body: { name: string; email: string | null },
): Promise<EnrollPostResult> {
  const url = `/api/enroll/${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ name: body.name, email: body.email }),
    });

    const rawBody = await res.text();

    if (res.status === 200) {
      return { ok: true, rawBody };
    }
    if (res.status === 410) {
      return { ok: false, kind: "gone" };
    }
    if (res.status === 404) {
      return { ok: false, kind: "not_found" };
    }
    if (res.status === 400) {
      let message = "Ungültige Anfrage.";
      try {
        const j = JSON.parse(rawBody) as { message?: string };
        if (typeof j.message === "string" && j.message.trim() !== "") {
          message = j.message;
        }
      } catch {
        /* ignore */
      }
      return { ok: false, kind: "bad_request", message };
    }

    return { ok: false, kind: "server", message: `Serverfehler (${String(res.status)}).` };
  } catch {
    return { ok: false, kind: "server", message: "Netzwerkfehler." };
  }
}
