export type ExpiredVariant = "closed" | "invalid-url" | "invalid-token";

export function Expired(props: { variant: ExpiredVariant }) {
  const title =
    props.variant === "closed"
      ? "Anmeldefenster geschlossen"
      : props.variant === "invalid-token"
        ? "Link ungültig"
        : "Ungültiger Link";

  const body =
    props.variant === "closed"
      ? "Diese Anmeldefrist ist abgelaufen. Bitte wenden Sie sich an Ihre Kursleitung, falls Sie noch eine Bescheinigung benötigen."
      : props.variant === "invalid-token"
        ? "Dieser Anmeldungslink ist nicht mehr gültig oder die Sitzung wurde nicht gefunden."
        : "Der aufgerufene Link ist ungültig. Bitte prüfen Sie die Adresse oder fordern Sie einen neuen Link bei Ihrer Kursleitung an.";

  return (
    <main
      className="mx-auto max-w-xl p-8"
      data-cy="expired-message"
      data-expired-variant={props.variant}
    >
      <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
      <p className="mt-3 text-stone-600">{body}</p>
    </main>
  );
}
