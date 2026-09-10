import { accessSync, constants, readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { resolve } from "node:path";
import { createSecureContext } from "node:tls";

function readLocalEnvValue(environmentName) {
  try {
    const localEnv = readFileSync(resolve(".env.local"), "utf8");
    const line = localEnv
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${environmentName}=`));
    if (!line) return undefined;

    const value = line.slice(environmentName.length + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      return value.slice(1, -1);
    }

    return value;
  } catch {
    return undefined;
  }
}

function configuredPath(environmentName) {
  return process.env[environmentName]?.trim() || readLocalEnvValue(environmentName);
}

const configuredCertificatePath = configuredPath("COMPASS_LOCAL_STAGING_CA_CERT");

if (!configuredCertificatePath) {
  console.error(
    "COMPASS_LOCAL_STAGING_CA_CERT is required for pnpm start:local. " +
      "Set it to the generated local Caddy root certificate.",
  );
  process.exit(64);
}

const resolvedCertificatePath = resolve(configuredCertificatePath);

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

function requiredPath(environmentName, description) {
  const value = configuredPath(environmentName);
  if (!value) {
    console.error(`${environmentName} is required for ${description}.`);
    process.exit(64);
  }

  const resolvedPath = resolve(value);
  try {
    accessSync(resolvedPath, constants.R_OK);
  } catch {
    console.error(`${environmentName} must point to a readable file.`);
    process.exit(64);
  }

  return resolvedPath;
}

const tlsCertificatePath = requiredPath(
  "COMPASS_LOCAL_STAGING_TLS_CERT",
  "the local HTTPS frontend",
);
const tlsChainPath = requiredPath(
  "COMPASS_LOCAL_STAGING_TLS_CHAIN",
  "the local HTTPS frontend",
);
const tlsKeyPath = requiredPath(
  "COMPASS_LOCAL_STAGING_TLS_KEY",
  "the local HTTPS frontend",
);

let tlsCertificate;
let tlsKey;
try {
  const tlsLeaf = readFileSync(tlsCertificatePath);
  const tlsChain = readFileSync(tlsChainPath);
  tlsCertificate = Buffer.concat([tlsLeaf, Buffer.from("\n"), tlsChain]);
  tlsKey = readFileSync(tlsKeyPath);
  const certificate = new X509Certificate(tlsLeaf);
  if (!certificate.subjectAltName?.includes("DNS:localhost")) {
    throw new Error("TLS certificate does not cover localhost");
  }
  createSecureContext({ cert: tlsCertificate, key: tlsKey });
} catch {
  console.error(
    "COMPASS_LOCAL_STAGING_TLS_CERT, COMPASS_LOCAL_STAGING_TLS_CHAIN, and " +
      "COMPASS_LOCAL_STAGING_TLS_KEY must be a matching localhost certificate " +
      "chain and private key.",
  );
  process.exit(64);
}

const nextCommand = process.platform === "win32" ? "next.cmd" : "next";
const forwardedArguments = process.argv.slice(2);
const useDevelopmentServer = forwardedArguments[0] === "--dev";
if (useDevelopmentServer) {
  forwardedArguments.shift();
}
if (forwardedArguments[0] === "--") {
  forwardedArguments.shift();
}

function parsePort(argumentsList) {
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "-p" || argument === "--port") {
      const value = argumentsList[index + 1];
      if (value) return Number(value);
    }
    if (argument?.startsWith("--port=")) {
      return Number(argument.slice("--port=".length));
    }
  }

  return Number(process.env.PORT ?? 3000);
}

function isValidPort(value) {
  return Number.isInteger(value) && value > 0 && value <= 65535;
}

const frontendPort = parsePort(forwardedArguments);
const nextPort = Number(
  process.env.COMPASS_LOCAL_STAGING_NEXT_PORT ?? frontendPort + 1,
);

if (!isValidPort(frontendPort) || !isValidPort(nextPort) || frontendPort === nextPort) {
  console.error(
    "The local HTTPS frontend and internal Next.js ports must be distinct valid ports.",
  );
  process.exit(64);
}

function replaceNextPort(argumentsList) {
  const nextArguments = [...argumentsList];
  let foundPort = false;

  for (let index = 0; index < nextArguments.length; index += 1) {
    const argument = nextArguments[index];
    if (argument === "-p" || argument === "--port") {
      nextArguments[index + 1] = String(nextPort);
      foundPort = true;
    } else if (argument?.startsWith("--port=")) {
      nextArguments[index] = `--port=${nextPort}`;
      foundPort = true;
    }
  }

  if (!foundPort) nextArguments.push("-p", String(nextPort));
  const hasHostname = nextArguments.some(
    (argument) =>
      argument === "-H" ||
      argument === "--hostname" ||
      argument?.startsWith("--hostname="),
  );
  if (!hasHostname) {
    nextArguments.push("-H", "127.0.0.1");
  }

  return nextArguments;
}

const nextArguments = replaceNextPort(forwardedArguments);
const child = spawn(nextCommand, [useDevelopmentServer ? "dev" : "start", ...nextArguments], {
  env: {
    ...process.env,
    NODE_EXTRA_CA_CERTS: resolvedCertificatePath,
  },
  stdio: "inherit",
});

const frontendServer = createHttpsServer(
  {
    cert: tlsCertificate,
    key: tlsKey,
  },
  (request, response) => {
    const headers = {
      ...request.headers,
      host: `127.0.0.1:${nextPort}`,
      "x-forwarded-host": request.headers.host ?? `localhost:${frontendPort}`,
      "x-forwarded-proto": "https",
    };
    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port: nextPort,
        method: request.method,
        path: request.url ?? "/",
        headers,
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      },
    );

    upstream.once("error", () => {
      if (response.headersSent) {
        response.destroy();
        return;
      }

      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end("The local frontend is still starting.");
    });

    request.pipe(upstream);
  },
);

frontendServer.on("upgrade", (request, socket, head) => {
  const headers = {
    ...request.headers,
    host: `127.0.0.1:${nextPort}`,
    "x-forwarded-host": request.headers.host ?? `localhost:${frontendPort}`,
    "x-forwarded-proto": "https",
  };
  const upstream = httpRequest({
    hostname: "127.0.0.1",
    port: nextPort,
    method: request.method ?? "GET",
    path: request.url ?? "/",
    headers,
  });

  upstream.once("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => {
    const statusLine = `HTTP/${upstreamResponse.httpVersion} ${upstreamResponse.statusCode} ${upstreamResponse.statusMessage ?? ""}\r\n`;
    const responseHeaders = Object.entries(upstreamResponse.headers)
      .flatMap(([name, value]) => {
        if (Array.isArray(value)) {
          return value.map((entry) => `${name}: ${entry}\r\n`);
        }
        return value === undefined ? [] : [`${name}: ${value}\r\n`];
      })
      .join("");

    socket.write(`${statusLine}${responseHeaders}\r\n`);
    if (upstreamHead.length > 0) socket.write(upstreamHead);
    if (head.length > 0) upstreamSocket.write(head);
    upstreamSocket.pipe(socket).pipe(upstreamSocket);
  });

  upstream.once("response", (upstreamResponse) => {
    upstreamResponse.resume();
    socket.destroy();
  });
  upstream.once("error", () => socket.destroy());
  request.pipe(upstream);
});

let shuttingDown = false;

function closeFrontend(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!child.killed) child.kill();
  frontendServer.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode), 1_000).unref();
}

child.once("error", (error) => {
  console.error(`Unable to start Next.js: ${error.message}`);
  closeFrontend(1);
});

child.once("exit", (exitCode) => {
  if (!shuttingDown) {
    shuttingDown = true;
    frontendServer.close(() => process.exit(exitCode ?? 1));
  }
});

frontendServer.once("error", (error) => {
  console.error(`Unable to start local HTTPS frontend: ${error.message}`);
  closeFrontend(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => closeFrontend(0));
}

frontendServer.listen(frontendPort, "127.0.0.1", () => {
  console.log(`Local HTTPS frontend available at https://localhost:${frontendPort}`);
  console.log(`Next.js is running behind it on 127.0.0.1:${nextPort}`);
});
