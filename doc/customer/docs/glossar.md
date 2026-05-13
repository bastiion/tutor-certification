# Glossar

**Bescheinigung**
:   Die digital signierte JSON-Datei, die einer teilnehmenden Person nach der
    Anmeldung ausgestellt wird. Sie enthält alle Kursdaten, den QR-Code und
    die kryptographische Signatur.

**Einschreibe-Link**
:   Eine einmalige URL, die nach dem Erstellen einer Sitzung von der Tutor:in
    an Teilnehmende weitergegeben wird. Über diesen Link kann die Bescheinigung
    beantragt werden.

<a id="fingerabdruck-fingerprint"></a>
**Fingerabdruck (Fingerprint)**
:   Ein kurzer Hashwert (BLAKE2b-256) des öffentlichen Institutsschlüssels
    (`K_master_public`). Er dient der visuellen Überprüfung, ob der
    richtige Schlüssel verwendet wird.

**JSON**
:   Ein textbasiertes Datenformat (JavaScript Object Notation). Bescheinigungen
    werden als `.json`-Dateien gespeichert und weitergegeben.

<a id="k_master"></a>
**K_master**
:   Der private Institutsschlüssel (Ed25519), der ausschließlich im Browser-Tab
    der Tutor:in vorhanden ist. Er wird nirgendwo dauerhaft gespeichert.
    Siehe [Sicherheit: K_master](tutor/sicherheit-k-master.md).

<a id="k_course"></a>
**K_course**
:   Ein pro Sitzung abgeleiteter Schlüssel, der die Bescheinigungen dieser
    Sitzung signiert. Er wird aus `K_master` und den Sitzungsdaten abgeleitet.

**QR-Code**
:   Ein zweidimensionaler Barcode, der den vollständigen Bescheinigungsinhalt
    als Base64URL-kodierte Zeichenkette enthält. Prüfende Stellen können
    ein Foto des QR-Codes hochladen, um die Bescheinigung offline zu prüfen.

**Schlüssel**
:   Siehe [K_master](#k_master) und [K_course](#k_course).

**Sitzung (Session)**
:   Ein von der Tutor:in angelegter Datensatz für eine Kursveranstaltung.
    Jede Sitzung hat eine eigene Kurs-ID, ein Gültigkeitsdatum und einen
    abgeleiteten Sitzungsschlüssel.

**Sperrung / Widerruf (Revocation)**
:   Die signierte Rücknahme einer Bescheinigung. Nach einem Widerruf zeigt
    die Prüfseite den Status „gesperrt" an.
    Siehe [Widerruf erklärt](pruefung/widerruf-erklaert.md).

**Verifizierung / Prüfung**
:   Die kryptographische Überprüfung einer Bescheinigung: Signaturen,
    Fingerabdruck und optional der Online-Sperrstatus.
