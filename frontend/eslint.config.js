import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
    settings: { react: { version: "detect" } },
  },
  pluginReact.configs.flat.recommended,
  {
    rules: {
      // Components use destructured props without PropTypes throughout the codebase
      "react/prop-types": "off",
      // Legacy switch/case blocks declare consts without braces
      "no-case-declarations": "off",
      // Existing project contains legacy/dead declarations; re-enable when cleaned up
      "no-unused-vars": "off",
    },
  },
]);
