import * as p from "@clack/prompts";
import type { GeneratedSecrets } from "./secrets.ts";
import { defaultEnvForAuto, type EnvFields } from "./envTemplate.ts";

function isLikelyDomainFromUrl(publicBase: string): string {
  try {
    const u = new URL(publicBase);
    return u.hostname || "";
  } catch {
    return "";
  }
}

export async function promptForFields(secrets: GeneratedSecrets): Promise<EnvFields> {
  p.intro("Production environment wizard");

  const registry = await p.text({
    message: "Container image (REGISTRY_IMAGE, without tag)",
    initialValue: "ghcr.io/bastiion/tutor-certification",
    validate: (v) => (v.trim() === "" ? "Required" : undefined),
  });
  if (p.isCancel(registry)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const tag = await p.text({
    message: "Image tag (IMAGE_TAG), e.g. v0.1.0",
    placeholder: "v0.1.0",
    validate: (v) => (v.trim() === "" ? "Required" : undefined),
  });
  if (p.isCancel(tag)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const publicBase = await p.text({
    message:
      "Public base URL (PUBLIC_BASE_URL) — https origin, no trailing slash (used in enrollment links)",
    placeholder: "https://certs.example.org",
    validate: (v) => {
      const t = v.trim();
      if (t === "") {
        return "Required";
      }
      try {
        const u = new URL(t);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          return "Use http: or https:";
        }
      } catch {
        return "Enter a valid URL";
      }
      return undefined;
    },
  });
  if (p.isCancel(publicBase)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const guessedDomain = isLikelyDomainFromUrl(publicBase.trim());
  const domain = await p.text({
    message:
      "Public hostname for Traefik (DOMAIN) — Host(...) rule; often same as URL host (optional for direct compose)",
    initialValue: guessedDomain,
    placeholder: guessedDomain || "certs.example.org",
  });
  if (p.isCancel(domain)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const tutorEmail = await p.text({
    message: "Tutor notification inbox (TUTOR_EMAIL)",
    placeholder: "tutor@example.org",
    validate: (v) => (v.trim() === "" ? "Required" : undefined),
  });
  if (p.isCancel(tutorEmail)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const smtpHost = await p.text({
    message: "SMTP server (SMTP_HOST)",
    validate: (v) => (v.trim() === "" ? "Required" : undefined),
  });
  if (p.isCancel(smtpHost)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const smtpPort = await p.text({
    message: "SMTP port (SMTP_PORT)",
    initialValue: "587",
    validate: (v) => (v.trim() === "" || !/^\d+$/.test(v.trim()) ? "Port number required" : undefined),
  });
  if (p.isCancel(smtpPort)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const mailFrom = await p.text({
    message: "Mail From address (MAIL_FROM_ADDRESS)",
    placeholder: "noreply@example.org",
    validate: (v) => (v.trim() === "" ? "Required" : undefined),
  });
  if (p.isCancel(mailFrom)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  const smtpSecureRaw = await p.select({
    message: "SMTP encryption (SMTP_SECURE)",
    options: [
      { value: "", label: "None — plain SMTP (local relay, Mailpit)" },
      { value: "tls", label: "STARTTLS — typical with port 587" },
      { value: "ssl", label: "SMTPS — typical with port 465" },
    ],
    initialValue: "",
  });
  if (p.isCancel(smtpSecureRaw)) {
    p.outro("Cancelled");
    process.exit(1);
  }
  const smtpSecureStr = typeof smtpSecureRaw === "string" ? smtpSecureRaw : "";

  const useSmtpAuth = await p.confirm({
    message: "SMTP authentication (set SMTP_USER and SMTP_PASSWORD)?",
    initialValue: false,
  });
  if (p.isCancel(useSmtpAuth)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  let smtpUserVal = "";
  let smtpPassVal = "";
  if (useSmtpAuth) {
    const su = await p.text({
      message: "SMTP user (SMTP_USER)",
      validate: (v) => (v.trim() === "" ? "Required when auth is enabled" : undefined),
    });
    if (p.isCancel(su)) {
      p.outro("Cancelled");
      process.exit(1);
    }
    const sp = await p.password({
      message: "SMTP password (SMTP_PASSWORD — will appear in .env)",
    });
    if (p.isCancel(sp)) {
      p.outro("Cancelled");
      process.exit(1);
    }
    smtpUserVal = typeof su === "string" ? su.trim() : "";
    const passStr = typeof sp === "string" ? sp : "";
    if (passStr === "") {
      p.log.error("SMTP_PASSWORD cannot be empty when authentication is enabled.");
      process.exit(1);
    }
    smtpPassVal = passStr;
  }

  const configureTraefik = await p.confirm({
    message:
      "Fill Traefik-related defaults (TRAEFIK_*)? (Skip if you only use direct port publishing)",
    initialValue: true,
  });
  if (p.isCancel(configureTraefik)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  let traefikNetwork = "traefik";
  let traefikRouter = "bastiion-certs";
  let traefikEntry = "websecure";
  let traefikResolver = "letsencrypt";

  if (configureTraefik) {
    const n = await p.text({
      message: "TRAEFIK_NETWORK_NAME (external Docker network Traefik uses)",
      initialValue: "traefik",
    });
    if (p.isCancel(n)) {
      p.outro("Cancelled");
      process.exit(1);
    }
    traefikNetwork = n.trim() || traefikNetwork;

    const r = await p.text({
      message: "TRAEFIK_ROUTER_NAME (unique router name on shared Traefik)",
      initialValue: "bastiion-certs",
    });
    if (p.isCancel(r)) {
      p.outro("Cancelled");
      process.exit(1);
    }
    traefikRouter = r.trim() || traefikRouter;

    const e = await p.text({
      message: "TRAEFIK_ENTRYPOINT (e.g. websecure)",
      initialValue: "websecure",
    });
    if (p.isCancel(e)) {
      p.outro("Cancelled");
      process.exit(1);
    }
    traefikEntry = e.trim() || traefikEntry;

    const cr = await p.text({
      message: "TRAEFIK_CERT_RESOLVER (ACME resolver name in Traefik)",
      initialValue: "letsencrypt",
    });
    if (p.isCancel(cr)) {
      p.outro("Cancelled");
      process.exit(1);
    }
    traefikResolver = cr.trim() || traefikResolver;
  }

  const cors = await p.text({
    message:
      "CORS_ALLOWED_ORIGINS (optional, comma-separated). Leave empty if tutor/participant/verify are same-origin as API.",
    initialValue: "",
    placeholder: "",
  });
  if (p.isCancel(cors)) {
    p.outro("Cancelled");
    process.exit(1);
  }

  /** `@clack/prompts` may yield `undefined` for an empty optional text field in some runtimes */
  const corsStr = typeof cors === "string" ? cors : "";

  const domainTrim = domain.trim();
  const fields: EnvFields = {
    REGISTRY_IMAGE: registry.trim(),
    IMAGE_TAG: tag.trim(),
    DOMAIN: domainTrim !== "" ? domainTrim : guessedDomain || "localhost",
    TRAEFIK_NETWORK_NAME: traefikNetwork,
    TRAEFIK_ROUTER_NAME: traefikRouter,
    TRAEFIK_ENTRYPOINT: traefikEntry,
    TRAEFIK_CERT_RESOLVER: traefikResolver,
    SERVER_BOX_KEYPAIR_BASE64: secrets.SERVER_BOX_KEYPAIR_BASE64,
    TOKEN_HMAC_KEY_BASE64: secrets.TOKEN_HMAC_KEY_BASE64,
    TUTOR_API_TOKEN: secrets.TUTOR_API_TOKEN,
    TUTOR_EMAIL: tutorEmail.trim(),
    PUBLIC_BASE_URL: publicBase.trim().replace(/\/+$/, ""),
    SMTP_HOST: smtpHost.trim(),
    SMTP_PORT: smtpPort.trim(),
    MAIL_FROM_ADDRESS: mailFrom.trim(),
    SMTP_SECURE: smtpSecureStr,
    SMTP_USER: smtpUserVal,
    SMTP_PASSWORD: smtpPassVal,
    CORS_ALLOWED_ORIGINS: corsStr.trim(),
  };

  const autoPreview = defaultEnvForAuto(secrets);
  if (!configureTraefik) {
    fields.TRAEFIK_NETWORK_NAME = autoPreview.TRAEFIK_NETWORK_NAME;
    fields.TRAEFIK_ROUTER_NAME = autoPreview.TRAEFIK_ROUTER_NAME;
    fields.TRAEFIK_ENTRYPOINT = autoPreview.TRAEFIK_ENTRYPOINT;
    fields.TRAEFIK_CERT_RESOLVER = autoPreview.TRAEFIK_CERT_RESOLVER;
  }

  p.outro("Ready to write environment file.");
  return fields;
}
