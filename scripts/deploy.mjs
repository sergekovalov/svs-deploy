import { access, readdir, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LambdaClient, UpdateFunctionCodeCommand } from "@aws-sdk/client-lambda";

const modulePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(modulePath);
const toolRoot = path.resolve(currentDir, "..");
const targetRoot = process.cwd();
const distDir = path.join(targetRoot, "dist");
const zipPath = path.join(distDir, "lambda.zip");

const normalizeBoolean = (value) => {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? targetRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });

const ensureDistFolder = async () => {
  await access(distDir, constants.R_OK);
  const entries = await readdir(distDir);
  const hasDeployableFiles = entries.some((entry) => entry !== "lambda.zip");
  if (!hasDeployableFiles) {
    throw new Error("dist folder is empty. Build your project before deploy.");
  }
};

const parseArgs = (argv) => {
  const parsed = {
    functionName: undefined,
    help: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      parsed.version = true;
      continue;
    }

    if (arg === "version" && index === 0) {
      parsed.version = true;
      continue;
    }

    if (!arg.startsWith("-") && !parsed.functionName) {
      parsed.functionName = arg.trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
};

const printUsage = () => {
  console.log(`Usage:
  svs-deploy <function-name>
  svs-deploy version

Notes:
  - Uses the current project's dist folder as deployment source (no build step).
  - Uses AWS SDK default config/credentials chain from your terminal.
  - Set AWS_PROFILE / AWS_REGION / AWS_LAMBDA_PUBLISH in terminal if needed.
  `);
};

const readPackageVersion = async () => {
  const packageJsonPath = path.join(toolRoot, "package.json");
  const packageJsonSource = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonSource);

  if (!packageJson.version || typeof packageJson.version !== "string") {
    throw new Error("package.json does not contain a valid version field.");
  }

  return packageJson.version;
};

const readConfig = (argv) => {
  const args = parseArgs(argv);
  if (args.help) {
    return {
      help: true,
      version: false,
      functionName: "",
      region: undefined,
      profile: undefined,
      publish: false,
    };
  }

  if (args.version) {
    return {
      help: false,
      version: true,
      functionName: "",
      region: undefined,
      profile: undefined,
      publish: false,
    };
  }

  const functionName = args.functionName;
  if (!functionName) {
    throw new Error("Function name is required. Usage: svs-deploy my-lambda-function");
  }

  const region = process.env.AWS_REGION?.trim();
  const profile = process.env.AWS_PROFILE?.trim();
  const publish = normalizeBoolean(process.env.AWS_LAMBDA_PUBLISH);

  return {
    help: args.help ?? false,
    version: false,
    functionName,
    region,
    profile,
    publish,
  };
};

const createZip = async () => {
  await rm(zipPath, { force: true });
  await runCommand("zip", ["-q", "-r", zipPath, "."], { cwd: distDir });
};

const deploy = async (config) => {
  if (config.profile) {
    process.env.AWS_PROFILE = config.profile;
  }
  process.env.AWS_SDK_LOAD_CONFIG = process.env.AWS_SDK_LOAD_CONFIG ?? "1";

  const lambdaClient = new LambdaClient({
    region: config.region,
  });
  const zipBuffer = await readFile(zipPath);

  await lambdaClient.send(
    new UpdateFunctionCodeCommand({
      FunctionName: config.functionName,
      ZipFile: zipBuffer,
      Publish: config.publish,
    }),
  );

  await lambdaClient.destroy();
};

const runDeploy = async (argv = process.argv.slice(2)) => {
  const config = readConfig(argv);
  if (config.help) {
    printUsage();
    return;
  }

  if (config.version) {
    const version = await readPackageVersion();
    console.log(version);
    return;
  }

  await ensureDistFolder();
  await createZip();
  await deploy(config);
  console.log(`Lambda ${config.functionName} was updated successfully.`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  runDeploy().catch((error) => {
    console.error("Deploy failed:", error);
    process.exit(1);
  });
}

export { runDeploy };
