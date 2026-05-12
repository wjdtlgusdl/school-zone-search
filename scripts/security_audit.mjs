import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const HEADERS_FILE = path.join(ROOT, "public", "_headers");

const dataPatterns = [
  ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["phone", /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/],
  ["resident-registration-number", /\d{6}-[1-4]\d{6}/],
  ["secret-keyword", /(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|github_pat|cloudflare)/i],
];

const requiredHeaders = [
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Content-Security-Policy",
];

function readFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name));
}

function auditDataFiles() {
  const findings = [];
  for (const file of readFiles(DATA_DIR)) {
    const content = fs.readFileSync(file, "utf8");
    for (const [label, pattern] of dataPatterns) {
      const match = content.match(pattern);
      if (match) {
        findings.push({
          file: path.relative(ROOT, file),
          label,
          sample: match[0].slice(0, 80),
        });
      }
    }
  }
  return findings;
}

function auditHeaders() {
  const content = fs.readFileSync(HEADERS_FILE, "utf8");
  return requiredHeaders.filter((header) => !content.includes(`${header}:`));
}

const dataFindings = auditDataFiles();
const missingHeaders = auditHeaders();

if (dataFindings.length || missingHeaders.length) {
  if (dataFindings.length) {
    console.error("Sensitive data pattern findings:");
    for (const finding of dataFindings) {
      console.error(`- ${finding.file}: ${finding.label} (${finding.sample})`);
    }
  }

  if (missingHeaders.length) {
    console.error("Missing security headers:");
    for (const header of missingHeaders) {
      console.error(`- ${header}`);
    }
  }

  process.exit(1);
}

console.log("Security audit passed");
