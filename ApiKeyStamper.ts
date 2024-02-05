import { p256 } from "@noble/curves/p256";
import { createHash } from "sha256-uint8array";
import { Buffer } from "buffer";

// Polyfill `btoa` for API stamper to work correctly
// TODO: replace btoa with a pure JS implementation of it. Not worth the dependency!
import 'core-js/actual/btoa';

// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

export type TApiKeyStamperConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
};

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export class ApiKeyStamper {
  apiPublicKey: string;
  apiPrivateKey: string;

  constructor(config: TApiKeyStamperConfig) {
    this.apiPublicKey = config.apiPublicKey;
    this.apiPrivateKey = config.apiPrivateKey;
  }

  async stamp(payload: string) {
    const signature = signWithApiKey({
      publicKey: this.apiPublicKey,
      privateKey: this.apiPrivateKey,
      content: payload,
    });

    const stamp = {
      publicKey: this.apiPublicKey,
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
      signature: signature,
    };

    return {
      stampHeaderName: stampHeaderName,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}

// TODO: this should be part of of Turnkey's api-key-stamper package!
function signWithApiKey(input: {
    content: string;
    publicKey: string;
    privateKey: string;
  }): string {

    const publicKey = p256.getPublicKey(input.privateKey, true);
    // Public key in the usual 02 or 03 + 64 hex digits
    const publicKeyString = Buffer.from(publicKey).toString("hex");
    
    if (publicKeyString != input.publicKey) {
        throw new Error(`Bad API key. Expected to get public key ${input.publicKey}, got ${publicKeyString}`)
    }

    const hash = createHash().update(input.content).digest();
    const signature = p256.sign(hash, input.privateKey)
    return signature.toDERHex()
}

/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */
function stringToBase64urlString(input: string): string {
    // string to base64
    const base64String = btoa(input);
    // base64 to base64url
    return base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
