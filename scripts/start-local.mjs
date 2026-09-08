import { accessSync, constants, readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const certificatePath = process.env.COMPASS_LOCAL_STAGING_CA_CERT?.trim();

if (!certificatePath) {
  console.error(
    "COMPASS_LOCAL_STAGING_CA_CERT is required for pnpm start:local. " +
      "Set it to the generated local Caddy root certificate.",
  );
  process.exit(64);
}

const resolvedCertificatePath = resolve(certificatePath);

try {
  accessSync(resolvedCertificatePath, constants.R_OK);
  const certificate = new X509Certificate(
    readFileSync(resolvedCertificatePath, "utf8"),
  );

  if (!certificate.ca) {
    throw new Error("certificate is not a CA certificate");
  }
} catch {
  console.error(
    "COMPASS_LOCAL_STAGING_CA_CERT must point to a readable PEM-encoded " +
      "local Caddy CA certificate.",
  );
  process.exit(64);
}

const nextCommand = process.platform === "win32" ? "next.cmd" : "next";
const forwardedArguments = process.argv.slice(2);
if (forwardedArguments[0] === "--") {
  forwardedArguments.shift();
}

const child = spawn(nextCommand, ["start", ...forwardedArguments], {
  env: {
    ...process.env,
    NODE_EXTRA_CA_CERTS: resolvedCertificatePath,
  },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`Unable to start Next.js: ${error.message}`);
  process.exit(1);
});

child.once("exit", (exitCode) => {
  process.exit(exitCode ?? 1);
});
