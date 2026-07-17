import { build } from "esbuild";
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";
const pluginsDir = join(root, "plugins");
const distDir = join(root, "dist");

if (existsSync(distDir)) rmSync(distDir, { recursive: true });
mkdirSync(join(distDir, "builds"), { recursive: true });

const ids = readdirSync(pluginsDir);
const repo = {
  $meta: { name: "brotherguns' plugins", description: "Moderation plugins for Kettu" },
};

for (const dir of ids) {
  const srcDir = join(pluginsDir, dir);
  const manifest = JSON.parse(readFileSync(join(srcDir, "manifest.json"), "utf8"));
  const id = manifest.id;
  const outDir = join(distDir, "builds", id);
  mkdirSync(outDir, { recursive: true });

  await build({
    entryPoints: [join(srcDir, "index.tsx")],
    bundle: true,
    format: "iife",
    globalName: "plugin",
    outfile: join(outDir, "index.js"),
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    external: ["react", "react-native"],
    target: "esnext",
    legalComments: "none",
  });

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  repo[id] = { version: manifest.version };
  console.log("built", id);
}

writeFileSync(join(distDir, "repo.json"), JSON.stringify(repo, null, 2));
console.log("wrote repo.json");
