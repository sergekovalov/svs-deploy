# SVS Lambda Deploy

Lightweight serverless alternative for deploying a Lambda function without the Serverless Framework.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env file:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` values:
   - `AWS_REGION` (optional)
   - `AWS_PROFILE` (optional)
   - `AWS_LAMBDA_PUBLISH` (`true` or `false`, optional)

AWS config is resolved through AWS SDK default chain from your terminal/session (`~/.aws/*`, env vars, SSO, profile).

## Commands

- Upload code from the current project's `dist` folder to Lambda:

  ```bash
  svs-deploy my-lambda-function
  ```

- Show CLI version:

  ```bash
  svs-deploy version
  ```

This deploy script zips the current project's `dist` folder into `dist/lambda.zip` and uploads it via AWS SDK `UpdateFunctionCode`.

Tip: add `dist/lambda.zip` to `.gitignore` in each project where you run `svs-deploy`.

## Global npm command

You can expose deploy as a global command:

```bash
npm link
```

Then run from anywhere:

```bash
svs-deploy my-lambda-function
```

Run it inside the project root whose `dist` folder you want to deploy.
