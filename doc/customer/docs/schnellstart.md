# Schnellstart

Eine 5-Minuten-Orientierung zum gesamten Ablauf.

## Überblick

Das System kennt drei Rollen:

1. **Tutor:in** — legt einen kryptographischen Schlüssel an, erstellt eine Kurssitzung
   und generiert einen Einschreibe-Link.
2. **Teilnehmer:in** — öffnet den Einschreibe-Link, gibt den eigenen Namen ein und
   erhält eine signierte Bescheinigung als JSON-Datei mit QR-Code.
3. **Prüfende Stelle** — überprüft eine vorliegende Bescheinigung auf Echtheit und
   Gültigkeit, online oder vollständig offline.

## Typischer Ablauf

```text
Tutor:in                   Teilnehmer:in              Prüfende Stelle
────────                   ──────────────              ───────────────
1. Schlüssel generieren
2. Server verbinden
3. Sitzung erstellen
   → Einschreibe-Link
                           4. Link öffnen
                           5. Name eingeben
                           6. Bescheinigung erhalten
                              (JSON + QR-Code)
                                                       7. JSON-Datei oder
                                                          QR-Code hochladen
                                                       8. Ergebnis ablesen
```

## Nächste Schritte

- [Tutor:in — Schlüssel anlegen](tutor/01-schluessel-anlegen.md)
- [Teilnehmer:in — Link öffnen](teilnehmer/01-link-oeffnen.md)
- [Prüfende Stelle — Online prüfen](pruefung/01-online-pruefen.md)
- [Glossar](glossar.md) — Fachbegriffe auf einen Blick
