import { readdir, readFile, writeFile } from "node:fs/promises";

const generatedRoot = new URL("../src/lib/api/generated/", import.meta.url);

async function generatedFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await generatedFiles(new URL(`${entry.name}/`, directory))));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(new URL(entry.name, directory));
    }
  }

  return files;
}

for (const file of await generatedFiles(generatedRoot)) {
  const source = await readFile(file, "utf8");
  const normalized = `${source.replace(/[\t\r\n ]+$/u, "")}\n`;
  if (normalized !== source) {
    await writeFile(file, normalized, "utf8");
  }
}
