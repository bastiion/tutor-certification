import { useCallback, useId, useState } from "react";
import { z } from "zod";
import "./index.css";
import {
  type CertificateConfig,
  generatePayloadSchema,
  parseNamesFromText,
} from "./schemas";

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(" ");
}

function CertificateSheet({
  config,
  participantName,
}: {
  config: CertificateConfig;
  participantName: string;
}) {
  const desc = config.description.trim();
  return (
    <article className="certificate-sheet flex min-h-[min(100vh,900px)] flex-col">
      {config.logoDataUrl ? (
        <img
          src={config.logoDataUrl}
          alt=""
          className="certificate-logo mx-auto mb-8 max-h-28 w-auto object-contain"
        />
      ) : null}
      <h1 className="certificate-title">{config.title}</h1>
      <p className="certificate-lead mt-10">Hiermit wird bescheinigt, dass</p>
      <p className="certificate-name my-8">{participantName}</p>
      {desc ? (
        <div className="certificate-description mt-6 max-w-prose whitespace-pre-wrap text-center leading-relaxed">
          {desc}
        </div>
      ) : null}
      <p className="certificate-date mt-12">Datum: {config.date}</p>
      <footer className="certificate-footer mt-auto pt-16 text-center">
        {config.institutionName}
      </footer>
    </article>
  );
}

export function App() {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [namesText, setNamesText] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [generated, setGenerated] = useState<{
    config: CertificateConfig;
    names: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file?.type.startsWith("image/")) {
        setLogoDataUrl("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setLogoDataUrl(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const handleGenerate = () => {
    setError(null);
    const names = parseNamesFromText(namesText);
    const parsed = generatePayloadSchema.safeParse({
      config: {
        title,
        date,
        description,
        institutionName,
        logoDataUrl,
      },
      names,
    });
    if (!parsed.success) {
      setError(formatZodError(parsed.error));
      setGenerated(null);
      return;
    }
    setGenerated({
      config: parsed.data.config,
      names: parsed.data.names,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="app-root min-h-screen bg-stone-100 text-stone-900">
      <div className="no-print mx-auto max-w-3xl px-4 pb-6 pt-10">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-800">
            Teilnahmebescheinigungen
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Namen eintragen, Bescheinigung konfigurieren, generieren und drucken.
          </p>
        </header>

        <form
          id={formId}
          className="space-y-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Titel
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                placeholder="z. B. Teilnahmebescheinigung"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Datum
              </span>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                placeholder="z. B. 14. April 2026"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Name der Einrichtung
              </span>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                placeholder="Ihre Organisation"
                autoComplete="organization"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Beschreibung / Fließtext
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-stone-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                placeholder="Optionaler Text zur Veranstaltung oder zum Kurs …"
              />
            </label>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Logo (optional)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-800 hover:file:bg-stone-300"
                />
                {logoDataUrl ? (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl("")}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    Logo entfernen
                  </button>
                ) : null}
              </div>
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Namen (einer pro Zeile)
              </span>
              <textarea
                value={namesText}
                onChange={(e) => setNamesText(e.target.value)}
                rows={8}
                className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm text-stone-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                placeholder={"Max Mustermann\nErika Musterfrau"}
                spellCheck={false}
              />
            </label>
          </div>

          {error ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Generieren
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!generated}
              className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Drucken
            </button>
          </div>
        </form>

        {generated ? (
          <section className="mt-10" aria-label="Vorschau">
            <h2 className="mb-4 text-center text-sm font-medium uppercase tracking-wide text-stone-500">
              Vorschau
            </h2>
          </section>
        ) : null}
      </div>

      {generated ? (
        <div className="print-area mx-auto max-w-4xl px-4 pb-10 print:max-w-none print:px-0 print:pb-0">
          {generated.names.map((name, index) => (
            <CertificateSheet
              key={`${index}-${name}`}
              config={generated.config}
              participantName={name}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default App;
