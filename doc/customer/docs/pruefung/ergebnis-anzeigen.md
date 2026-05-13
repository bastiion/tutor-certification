# Ergebnis anzeigen

## Die vier Prüfergebnisse

Das System kennt vier mögliche Ergebnisse:

### Gültig (grün)

Die Bescheinigung ist kryptographisch konsistent: Session-Signatur,
Bescheinigungs-Signatur und Instituts-Fingerabdruck stimmen überein.
Der Server hat keine Sperrung eingetragen.

![Ergebnis: gültig](../img/pruef-03-drop-valid.png)

### Gesperrt (rot)

Die Bescheinigung wurde widerrufen. Sperrdatum und
Grund werden angezeigt.

![Ergebnis: gesperrt](../img/pruef-04-drop-revoked.png)

### Manipulation erkannt (gelb)

Mindestens eine Signatur oder der Fingerabdruck stimmt nicht überein.
Die Bescheinigung wurde möglicherweise verändert.

![Ergebnis: Manipulation erkannt](../img/pruef-05-drop-tampered.png)

### Unbekannt / eingeschränkte Prüfung (grau)

Es liegt keine Bescheinigungsdatei vor (nur eine ID-Abfrage).
Der Server kann lediglich mitteilen, ob ein Widerruf vorliegt.

![Ergebnis: unbekannt (nur ID)](../img/pruef-02-id-only-unknown.png)

## Details anzeigen

Unter jedem Ergebnis kann über **Details anzeigen** der vollständige
JSON-Inhalt der Bescheinigung eingesehen werden.

![Details-Panel geöffnet](../img/pruef-06-details-expanded.png)
