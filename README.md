# Passkey app

This repo contains a sample passkey app which creates/uses passkeys. It it built with Expo.

## Running the app locally (iOS)

To trigger passkey prompts you will need a way to sign the app with a proper provisioning profile. Follow the steps outlined in https://docs.expo.dev/app-signing/app-credentials/#provisioning-profiles. TL;DR: run `eas credentials`.

* `npm run ios` will start the app using expo
* `eas build -p ios --profile preview` will trigger a build through expo (online CI). This gets you a QR code to install on any device covered by the provisioning profile
* `npx expo prebuild --platform ios` will "prebuild" and let you build locally with xcode. Then open the project with the `PasskeyApp.xcworkspace` file to build with xcode (this is useful)
* `eas build --platform ios --local --profile preview` can be used to run a local build without xcode, and will produce a `.ipa` file. The `.ipa` can be dropped on the device through xcode: "Window" -> "Devices and Simulators", then drop the app under the "Installed Apps" section.add to "installed apps" section under your device), errors with "This app cannot be installed because its integrity could not be verified".
* To run with expo on your iOS device, connect the device and run `npx expo run:ios --device` (the device needs to have developer mode enabled and be connected to your Mac)

TODO:
- [ ] npx expo install --check
- [ ] npm audit

## `http` folder

In the HTTP folder you'll find a folder with what's hosted at https://passkeyapp.tkhqlabs.xyz. It contains a Cloudflare worker function to give apple-app-site-association the right MIME type.

To run it locally: `npx wrangler pages dev http`.

This is a necessary step 


## Troubleshooting

### com.apple.AuthenticationServices.AuthorizationError Code=1004

```
[AuthenticationServices] ASAuthorizationController credential request failed with error: Error
Domain=com.apple.AuthenticationServices.AuthorizationError Code=1004 "(null)"
```

This happens when the RPID is incorrect. I have no idea why Apple doesn't return a proper error here. The RPID should be the domain name (inverse of the bundle ID). E.g. `passkeyapp.tkhqlabs.xyz`

### This app cannot be installed because its integrity could not be verified

If you're trying to installed a `.ipa` file on a device without signing it with a provisioning profile linked to this device, that's the message you get. Make sure you select the right profile when building (this also happened to me if I do not select a profile at all: `eas build --platform ios --local` produces a by-default unsigned `.ipa` file!)
