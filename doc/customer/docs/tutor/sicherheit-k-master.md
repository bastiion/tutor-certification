# Sicherheit: K_master

## Warum so vorsichtig?

Der private Institutsschlüssel K_master ist das Herzstück des
Vertrauensmodells. Wer K_master besitzt, kann beliebige
Bescheinigungen ausstellen und Widerrufe signieren. Deshalb
gelten strenge Regeln:

- **Keine dauerhafte Speicherung.** K_master lebt ausschließlich
  im JavaScript-Speicher des aktuellen Browser-Tabs. Er wird
  weder in `localStorage`, `sessionStorage` noch in `indexedDB`
  abgelegt.

- **Tab schließen = Schlüssel weg.** Beim Schließen oder Neuladen
  des Tabs wird K_master unwiederbringlich aus dem Arbeitsspeicher
  entfernt. Nur die zuvor heruntergeladene `.key`-Datei ermöglicht
  einen erneuten Import.

- **Sicher ablegen.** Die `.key`-Datei (32 Byte, rohes Ed25519-Seed)
  sollte auf einem verschlüsselten Datenträger oder in einem
  Passwortmanager gespeichert werden — niemals unverschlüsselt in
  einer Cloud.

- **Fingerabdruck vergleichen.** Beim Import wird der
  BLAKE2b-256-Fingerabdruck angezeigt. Dieser sollte mit dem Wert
  verglichen werden, der beim Generieren notiert wurde, um
  sicherzustellen, dass der richtige Schlüssel geladen wurde.

## Zusammenfassung

| Eigenschaft | Wert |
|---|---|
| Algorithmus | Ed25519 |
| Speicherort | Nur im Browser-Tab (JavaScript-Heap) |
| Backup | `.key`-Datei (32 Byte Seed) |
| Fingerabdruck | BLAKE2b-256 des öffentlichen Schlüssels |
| Persistenz | Keine — Tab-gebunden |
