import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";
const pluginsDir = join(root, "plugins");
const distDir = join(root, "dist");

if (existsSync(distDir)) rmSync(distDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

// Each plugin is hosted in its own directory (Vendetta polymanifest): a
// manifest.json describing it and a bundled `index.js`. The Vendetta loader
// evaluates the bundle as `vendetta => { return <index.js> }`, so the bundle
// must be a single EXPRESSION whose value is the plugin's default export.
// We bundle to CJS and wrap it in an IIFE that returns module.exports.default.

const names = readdirSync(pluginsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const name of names) {
  const srcDir = join(pluginsDir, name);
  const manifest = JSON.parse(readFileSync(join(srcDir, "manifest.json"), "utf8"));
  const outDir = join(distDir, name);
  mkdirSync(outDir, { recursive: true });

  const result = await build({
    entryPoints: [join(srcDir, "index.tsx")],
    bundle: true,
    format: "cjs",
    write: false,
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    external: ["react", "react-native"],
    // Kettu runs on Hermes, whose eval parser rejects modern syntax such as
    // optional-call `?.()`, optional chaining, `??`, and `??=`. Target an older
    // baseline so esbuild transpiles all of it to compatible ES.
    target: "es2017",
    supported: { "optional-chain": false, "nullish-coalescing": false, "logical-assignment": false },
    legalComments: "none",
  });

  const cjs = result.outputFiles[0].text;
  // Wrap the CJS module into a self-contained expression. `vendetta` stays a
  // free identifier, resolved from the loader's `vendetta => {...}` param.
  // NOTE: this wrapper is hand-written and NOT transpiled by esbuild, so it must
  // itself avoid syntax Hermes rejects (no `??`, no `?.`).
  const iife =
    "(function(){var module={exports:{}},exports=module.exports;\n" +
    cjs +
    "\nvar __d=module.exports&&module.exports.default;return __d?__d:module.exports;})()";

  const hash = createHash("sha256").update(iife).digest("hex");

  writeFileSync(join(outDir, "index.js"), iife);
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify({ ...manifest, main: "index.js", hash }, null, 2),
  );
  console.log("built", name, "->", `${name}/  (hash ${hash.slice(0, 8)})`);
}

console.log(`\nInstall URLs (each plugin folder, trailing slash required):`);
for (const name of names) {
  console.log(`  https://brotherguns.github.io/kettu-plugins/${name}/`);
}
