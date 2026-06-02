"use strict";

// Downloads provider logos from models.dev and writes themed runtime variants.
//
//   raw source  -> assets/source/model-icons/<provider>.svg   (verbatim, currentColor)
//   light theme -> assets/icons/models/<provider>.svg         (dark glyph for light bg)
//   dark theme  -> assets/icons/models/<provider>-dark.svg    (light glyph for dark bg)
//
// models.dev serves a generic fallback logo when a provider has none; we detect that by
// hashing the response for a deliberately bogus slug and skipping any provider whose logo
// matches it. Run with: npm run fetch-model-icons

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const LOGO_BASE = "https://models.dev/logos";
const MISSING_PROBE_SLUG = "__wangpet_missing_provider__";
const SOURCE_DIR = path.join(__dirname, "..", "assets", "source", "model-icons");
const OUTPUT_DIR = path.join(__dirname, "..", "assets", "icons", "models");

// Glyph colors baked per theme. Matches the token display --text values.
const LIGHT_FILL = "#242427"; // dark glyph on the light-theme panel
const DARK_FILL = "#f4f4f5"; // light glyph on the dark-theme panel

// Internal provider key (see src/model-provider-map.js) -> models.dev provider slug.
// Providers without a models.dev logo (e.g. meta/llama) are intentionally omitted; they
// fall back to the agent icon at runtime.
const PROVIDER_SLUGS = {
  anthropic: "anthropic",
  openai: "openai",
  google: "google",
  qwen: "alibaba",
  moonshot: "moonshotai",
  deepseek: "deepseek",
  xai: "xai",
  mistral: "mistral",
  zhipu: "zhipuai",
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

function hashText(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function recolor(svg, fill) {
  return svg.replace(/currentColor/gi, fill);
}

function assertSafeSvg(svg, slug) {
  if (/<script[\s>]/i.test(svg) || /\son\w+\s*=/i.test(svg)) {
    throw new Error(`Refusing unsafe SVG for ${slug} (contains script or event handler)`);
  }
}

async function main() {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const missingHash = hashText(await fetchText(`${LOGO_BASE}/${MISSING_PROBE_SLUG}.svg`));

  const written = [];
  const skipped = [];

  for (const [provider, slug] of Object.entries(PROVIDER_SLUGS)) {
    const svg = await fetchText(`${LOGO_BASE}/${slug}.svg`);
    if (hashText(svg) === missingHash) {
      skipped.push({ provider, slug, reason: "models.dev served the fallback logo" });
      continue;
    }
    assertSafeSvg(svg, slug);

    fs.writeFileSync(path.join(SOURCE_DIR, `${provider}.svg`), svg);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${provider}.svg`), recolor(svg, LIGHT_FILL));
    fs.writeFileSync(path.join(OUTPUT_DIR, `${provider}-dark.svg`), recolor(svg, DARK_FILL));
    written.push({ provider, slug });
  }

  for (const entry of written) {
    console.log(`fetched ${entry.provider} (models.dev/${entry.slug})`);
  }
  for (const entry of skipped) {
    console.warn(`skipped ${entry.provider} (${entry.slug}): ${entry.reason}`);
  }
  console.log(`\n${written.length} logos written to ${path.relative(process.cwd(), OUTPUT_DIR)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { PROVIDER_SLUGS, recolor, assertSafeSvg };
