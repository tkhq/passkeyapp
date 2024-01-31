# Passkey app

This repo contains a sample passkey app which creates/uses passkeys. For testing purposes only.

## Running the app locally

`npm run ios` will start the app using expo.

## `http` folder

In the HTTP folder you'll find a folder with what's hosted at passkeyapp.tkhqlabs.xyz. It contains a Cloudflare worker function to give apple-app-site-association the right MIME type.

To run it locally: `npx wrangler pages dev http`
