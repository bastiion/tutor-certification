# QR-Code erklärt

## Was enthält der QR-Code?

Der QR-Code auf der Bescheinigung enthält den **vollständigen
Bescheinigungsinhalt** als Base64URL-kodierte Zeichenkette. Er ist
damit ein eigenständiger, maschinenlesbarer Nachweis.

## Wofür kann der QR-Code verwendet werden?

- **Offline-Prüfung:** Eine prüfende Stelle kann ein Foto des
  QR-Codes auf der [Prüfseite](../pruefung/02-offline-pruefen.md)
  hochladen und die Bescheinigung vollständig offline verifizieren.
- **Weitergabe:** Der QR-Code kann auf einem Ausdruck oder
  in einem Dokument weitergegeben werden. Die prüfende Stelle benötigt
  keinen Internetzugang für die kryptographische Prüfung.

## Technischer Hintergrund

| Eigenschaft | Wert |
|---|---|
| Kodierung | Base64URL(UTF-8-Bytes des JSON-Inhalts) |
| Fehlerstufe | L (niedrig) |
| Inhalt | Vollständiger Bescheinigungstext inkl. Signaturen |
