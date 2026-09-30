import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);

// plugins/metadata.json
var metadata_default = {
  name: "apexrest-apex",
  version: "1.3.0-beta.1",
  description: "Develop, deploy and test Oracle APEX applications with Codex.",
  author: {
    name: "APEXREST",
    url: "https://apex.rest"
  },
  license: "Apache-2.0",
  interface: {
    displayName: "APEXREST for Codex",
    shortDescription: "Oracle APEX development workflows",
    longDescription: "Oracle APEX development, controlled deployment and testing directly in your current Codex session.",
    developerName: "APEXREST",
    websiteURL: "https://apex.rest",
    composerIcon: "./assets/apexrest-icon.svg",
    logo: "./assets/apexrest-logo.svg",
    logoDark: "./assets/apexrest-logo.svg",
    category: "Productivity",
    capabilities: ["Read", "Write"],
    defaultPrompt: [
      "Use $apexrest-work to complete my APEX change directly in this Codex session.",
      "Use $apexrest-panel to open project settings and Oracle/APEX operations inside Codex.",
      "Use $apexrest-menu to show all functions, setup and connection diagnostics."
    ]
  }
};

// packages/core/src/version.ts
var VERSION = metadata_default.version;

export {
  VERSION
};
