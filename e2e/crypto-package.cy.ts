describe("@bastiion/crypto package status in SPAs", () => {
  it("is not not-implemented on /enroll/", () => {
    cy.visit("/enroll/");
    cy.get("[data-cy=crypto-package-status]")
      .invoke("text")
      .should("not.include", "not-implemented")
      .and("match", /@bastiion\/crypto:\s*(ready|initialising)/);
  });

  it("is not not-implemented on /verify/", () => {
    cy.visit("/verify/");
    cy.get("[data-cy=crypto-package-status]")
      .invoke("text")
      .should("not.include", "not-implemented")
      .and("match", /@bastiion\/crypto:\s*(ready|initialising)/);
  });
});
