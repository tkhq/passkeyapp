# Passkey app

This repo contains a sample passkey app which creates/uses passkeys. For testing purposes only.

## Running the app locally

* `npm run ios` will start the app using expo
* `eas build -p ios --profile preview` will trigger a build through expo (online CI)
* `npx expo prebuild --platform ios` will "prebuild" and let you build locally with xcode. Then open the project with the `PasskeyApp.xcworkspace` file
* `eas build --platform ios --local` can be used to run a local build without xcode

## `http` folder

In the HTTP folder you'll find a folder with what's hosted at passkeyapp.tkhqlabs.xyz. It contains a Cloudflare worker function to give apple-app-site-association the right MIME type.

To run it locally: `npx wrangler pages dev http`
