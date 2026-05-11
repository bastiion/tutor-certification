describe("Teilnahmebescheinigungen form", () => {
  it("fills required fields and shows preview", () => {
    cy.visit("/tutor/");

    cy.contains("label", "Titel").find("input").clear().type("E2E Teilnahmebescheinigung");
    cy.contains("label", "Datum").find("input").clear().type("11. Mai 2026");
    cy.contains("label", "Name der Einrichtung")
      .find("input")
      .clear()
      .type("IKWSD Test");
    cy.contains("label", "Beschreibung / Fließtext")
      .find("textarea")
      .clear()
      .type("Kurs erfolgreich abgeschlossen.");
    cy.contains("label", "Namen (einer pro Zeile)")
      .find("textarea")
      .clear()
      .type("Erika Musterfrau");

    cy.contains("button", "Generieren").click();

    cy.contains("h2", "Vorschau").should("be.visible");
    cy.get(".certificate-name").should("contain.text", "Erika Musterfrau");
    cy.get(".certificate-title").should("contain.text", "E2E Teilnahmebescheinigung");
  });
});
