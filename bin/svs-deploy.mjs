#!/usr/bin/env node

import { runDeploy } from "../scripts/deploy.mjs";

runDeploy().catch((error) => {
  console.error("Deploy failed:", error);
  process.exit(1);
});
