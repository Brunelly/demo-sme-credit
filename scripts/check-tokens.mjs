#!/usr/bin/env node
// `npm run check:tokens`: fails when a colour is written anywhere but packages/ui/src/tokens.css. Colours come only
// from tokens (var(--color-…)), so the whole app can be rebranded by changing one file.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const scanned = ["apps/web/src", "packages/ui/src"];
const allowed = new Set([path.join(root, "packages/ui/src/tokens.css")]);

// A colour literal: #rgb, #rrggbb, #rrggbbaa, or a colour function.
const colourFunction = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const hexInCss = /:[^;{}]*#[0-9a-f]{3,8}\b/i; // only in a declaration's value, never a selector
const hexInCode = /["'`]#[0-9a-f]{3,8}["'`]/i; // a colour string in TS/TSX
const namedInStyle = /\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*["']?(?:red|green|blue|black|white|gray|grey|orange|yellow|purple|pink)\b/i;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.(css|tsx?|jsx?)$/.test(name)) yield full;
  }
}

const problems = [];
for (const dir of scanned) {
  for (const file of files(path.join(root, dir))) {
    if (allowed.has(file)) continue;
    const isCss = file.endsWith(".css");
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        const code = line.replace(/\/\*.*?\*\/|\/\/.*$/g, ""); // ignore comments
        const found =
          colourFunction.test(code) || (isCss ? hexInCss.test(code) : hexInCode.test(code)) || namedInStyle.test(code);
        if (found) problems.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
      });
  }
}

if (problems.length) {
  console.error("Colours must come from tokens (var(--color-…) in packages/ui/src/tokens.css), not literals:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nAdd a token to tokens.css if none fits, then use it.");
  process.exit(1);
}
console.log(`Tokens only: no colour literals in ${scanned.join(", ")}.`);
