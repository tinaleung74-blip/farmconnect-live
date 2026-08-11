const reservedSignupEmailDomains = new Set(["example.com", "example.net", "example.org"]);

export const reservedSignupEmailMessage =
  "Use a real, deliverable email address. Example and test email domains cannot create a FarmConnect account.";

export function hasReservedSignupEmailDomain(email: string) {
  const domain = email.trim().toLowerCase().split("@").pop() || "";
  return (
    reservedSignupEmailDomains.has(domain) ||
    domain === "localhost" ||
    domain.endsWith(".test") ||
    domain.endsWith(".example") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".localhost")
  );
}

export function signupFailureMessage(error: unknown) {
  const fallback = "Could not create account.";
  const message = error instanceof Error ? error.message : fallback;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";

  if (
    code === "email_address_invalid" ||
    /example and test domains|email address.*invalid/i.test(message)
  ) {
    return reservedSignupEmailMessage;
  }

  return message;
}
