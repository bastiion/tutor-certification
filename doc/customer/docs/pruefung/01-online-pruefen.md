# Online prüfen

## Ziel

Der Sperrstatus einer Bescheinigung wird anhand ihrer ID abgefragt —
ohne die Bescheinigungsdatei zu besitzen.

## Schritt-für-Schritt

1. `/verify/<Bescheinigungs-ID>` im Browser aufrufen. Die ID
   findet sich z. B. auf dem Ausdruck unterhalb des QR-Codes.

2. Das System fragt den Server nach dem Sperrstatus dieser ID.

    ![ID-Prüfung — „unbekannt"](../img/pruef-02-id-only-unknown.png)

3. Mögliche Ergebnisse:

    - **Keine Sperrung eingetragen** — Der Server hat keinen
      Widerruf für diese ID registriert. Dies ist jedoch *keine*
      Bestätigung der Echtheit (dafür ist die Bescheinigungsdatei erforderlich).
    - **Gesperrt** — Diese Bescheinigung wurde widerrufen.

!!! warning "Hinweis"
    Die reine ID-Prüfung bestätigt *nicht*, dass die Bescheinigung
    echt ist. Der Server prüft lediglich, ob ein Widerruf vorliegt.
    Für eine vollständige kryptographische Prüfung ist die
    JSON-Datei unter `/verify/` hochzuladen.

## Was als Nächstes?

[Offline prüfen](02-offline-pruefen.md) — Bescheinigungsdatei oder
QR-Code-Foto für die vollständige Prüfung hochladen.
