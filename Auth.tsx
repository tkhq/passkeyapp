import React, { useState, useEffect } from 'react';
import { Buffer } from '@craftzdog/react-native-buffer';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { btoa, atob } from 'react-native-quick-base64'
import { p256 } from "@noble/curves/p256"; 
import * as hkdf from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256';
import { gcm } from '@noble/ciphers/aes';
import bs58check from 'bs58check';
import {signWithApiKey} from '@turnkey/api-key-stamper'

const AuthScreen = () => {
  const [embeddedKey, setEmbeddedKey] = useState<any>(null);
  const [credentialBundle, setCredentialBundle] = useState('');
  const [payload, setPayload] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [decryptedData, setDecryptedData] = useState('');
  const [signature, setSignature] = useState('');

  const SUITE_ID_1 = new Uint8Array([75,69,77,0,16])
  const SUITE_ID_2 = new Uint8Array([72,80,75,69,0,16,0,1,0,2])
  const HPKE_VERSION = new Uint8Array([72, 80, 75, 69, 45, 118, 49]);
  // b"secret"
  const LABEL_SECRET = new Uint8Array([115, 101, 99, 114, 101, 116]);
  // b"HPKE"
  // b"eae_prk"
  const LABEL_EAE_PRK = new Uint8Array([101, 97, 101, 95, 112, 114, 107]);
  // b"shared_secret"
  // deno-fmt-ignore
  const LABEL_SHARED_SECRET = new Uint8Array([
    115, 104, 97, 114, 101, 100, 95, 115, 101, 99,
    114, 101, 116,
  ]);

  function buildLabeledIkm(label: Uint8Array, ikm: Uint8Array, suite_id: Uint8Array): Uint8Array {
    const combinedLength = HPKE_VERSION.length + suite_id.length + label.length + ikm.length;
    const ret = new Uint8Array(combinedLength);
    let offset = 0;

    ret.set(HPKE_VERSION, offset);
    offset += HPKE_VERSION.length;

    ret.set(suite_id, offset);
    offset += suite_id.length;

    ret.set(label, offset);
    offset += label.length;

    ret.set(ikm, offset);

    return ret;
  }

  function buildLabeledInfo(
    label: Uint8Array,
    info: Uint8Array,
    suite_id: Uint8Array,
    len: number,
  ): Uint8Array {
    const ret = new Uint8Array(
      9 + suite_id.byteLength + label.byteLength + info.byteLength,
    );
    ret.set(new Uint8Array([0, len]), 0);
    ret.set(HPKE_VERSION, 2);
    ret.set(suite_id, 9);
    ret.set(label, 9 + suite_id.byteLength);
    ret.set(info, 9 + suite_id.byteLength + label.byteLength);
    return ret;
  }


  var uint8arrayFromHexString = function(hexString:any) {
    var hexRegex = /^[0-9A-Fa-f]+$/;
    if (!hexString || hexString.length % 2 != 0 || !hexRegex.test(hexString)) {
      throw new Error('cannot create uint8array from invalid hex string: "' + hexString + '"');
    }
    return new Uint8Array(hexString.match(/../g).map(h=>parseInt(h,16)));
  }
  var uint8arrayToHexString = function(buffer:any) {
    return [...buffer]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
  }
  var bigIntToHex = function(num:any, length:any) {
    var hexString = num.toString(16);
    if (hexString.length > length) {
      throw new Error("number cannot fit in a hex string of " + length + " characters");
    }
    // Add an extra 0 to the start of the string to get to `length`
    return hexString.padStart(length, 0)
}
      /**
       * Accepts a public key array buffer, and returns a buffer with the uncompressed version of the public key
       * @param {Uint8Array} rawPublicKey
       * @return {Uint8Array} the uncompressed bytes
       */
      var uncompressRawPublicKey = function(rawPublicKey:any) {
        const len = rawPublicKey.byteLength

        // point[0] must be 2 (false) or 3 (true).
        // this maps to the initial "02" or "03" prefix
        const lsb = rawPublicKey[0] === 3;
        const x = BigInt("0x" + uint8arrayToHexString(rawPublicKey.subarray(1)));

        // https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf (Appendix D).
        const p = BigInt("115792089210356248762697446949407573530086143415290314195533631308867097853951");
        const b = BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b");
        const a = p - BigInt(3);

        // Now compute y based on x
        const rhs = ((x * x + a) * x + b) % p;
        let y = modSqrt(rhs, p);
        if (lsb !== testBit(y, 0)) {
          y = (p - y) % p;
        }

        if (x < BigInt(0) || x >= p) {
          throw new Error("x is out of range");
        }

        if (y < BigInt(0) || y >= p) {
          throw new Error("y is out of range");
        }

        var uncompressedHexString = "04" + bigIntToHex(x, 64) + bigIntToHex(y, 64);
        return uint8arrayFromHexString(uncompressedHexString)
      }

      function modSqrt(x:any, p:any) {
        if (p <= BigInt(0)) {
          throw new Error("p must be positive");
        }
        const base = x % p;
        // The currently supported NIST curves P-256, P-384, and P-521 all satisfy
        // p % 4 == 3.  However, although currently a no-op, the following check
        // should be left in place in case other curves are supported in the future.
        if (testBit(p, 0) && /* istanbul ignore next */ testBit(p, 1)) {
          // Case p % 4 == 3 (applies to NIST curves P-256, P-384, and P-521)
          // q = (p + 1) / 4
          const q = (p + BigInt(1)) >> BigInt(2);
          const squareRoot = modPow(base, q, p);
          if ((squareRoot * squareRoot) % p !== base) {
            throw new Error("could not find a modular square root");
          }
          return squareRoot;
        }
        // Skipping other elliptic curve types that require Cipolla's algorithm.
        throw new Error("unsupported modulus value");
      }

      /**
       * Private helper function used by `modSqrt`
       */
      function modPow(b:any, exp:any, p:any) {
        if (exp === BigInt(0)) {
          return BigInt(1);
        }
        let result = b;
        const exponentBitString = exp.toString(2);
        for (let i = 1; i < exponentBitString.length; ++i) {
          result = (result * result) % p;
          if (exponentBitString[i] === "1") {
            result = (result * b) % p;
          }
        }
        return result;
      }

      /**
       * Another private helper function used as part of `modSqrt`
       */
      function testBit(n:any, i:any) {
        const m = BigInt(1) << BigInt(i);
        return (n & m) !== BigInt(0);
      }

const base64urlEncode = (data: Uint8Array): string => {
  let binary = "";
  data.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const base64urlDecode = (base64url: string): Uint8Array => {
  let binary_string = atob(base64url.replace(/\-/g, "+").replace(/_/g, "/"));
  let len = binary_string.length;
  let bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
};

const randomBytes = (length: number): Uint8Array => {
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
};

  const generateTargetKey = async (): Promise<{
    privateKey: string;
    publicKey: Uint8Array;
  }> => {
    const privateKey = randomBytes(32);
    const publicKey = p256.getPublicKey(privateKey, false);
    return { privateKey: base64urlEncode(privateKey), publicKey: publicKey };
  };

  useEffect(() => {
    handleGenerateKey();
  }, []);

  const handleGenerateKey = async () => {
    try {
      const key = await generateTargetKey();
      setEmbeddedKey(key.privateKey);
      const targetPubHex =  Buffer.from(key.publicKey).toString('hex');
      setPublicKey(targetPubHex);
      console.log(targetPubHex)
    } catch (error) {
      console.error('Error generating key:', error);
    }
  };


const additionalAssociatedData = (
  senderPubBuf: ArrayBuffer,
  receiverPubBuf: ArrayBuffer
): Uint8Array => {
  var s = Array.from(new Uint8Array(senderPubBuf));
  var r = Array.from(new Uint8Array(receiverPubBuf));
  return new Uint8Array([...s, ...r]);
};
async function extractAndExpand(sharedSecret:any, ikm:any, info:any, len:any) {
  // Perform HKDF extract and expand
  const prk = hkdf.extract(sha256, ikm, sharedSecret); // Use the input key as IKM, salt for extracting PRK
  const resp = hkdf.expand(sha256, prk, info, len); // Use the PRK and info bytes to derive the IV
  return new Uint8Array(resp);
}

/**
 * Derive the dh using ECDH
 */
const deriveDh = async (encappedKeyBuf:any, receiverPriv:any) => {
  const dh = p256.getSharedSecret(base64urlDecode(receiverPriv), encappedKeyBuf)
  return dh.slice(1);
};

const aesGcmDecrypt = (encryptedData: Uint8Array, key: Uint8Array, iv: Uint8Array, aad?: Uint8Array): Uint8Array => {
const aes = gcm(key, iv, aad);
const data_ = aes.decrypt(encryptedData) // This works with Buffer from, but not when we pass Uint8Array, also works with .slice(), wth?
return data_
}

const getKemContext = (encappedKeyBuf:any, publicKey:any) => {
  const encappedKeyArray = new Uint8Array(encappedKeyBuf);
  const publicKeyArray = new Uint8Array(Buffer.from(publicKey, 'hex'));
  
  // Create a new Uint8Array with the length equal to the sum of both arrays
  const kemContext = new Uint8Array(encappedKeyArray.length + publicKeyArray.length);
  
  // Copy the contents of the first array into the new array
  kemContext.set(encappedKeyArray);
  
  // Copy the contents of the second array into the new array, starting right after the end of the first array
  kemContext.set(publicKeyArray, encappedKeyArray.length);
  return kemContext
}
/**
 * HPKE Decrypt Function
 */
const hpkeDecrypt = async ({ciphertextBuf, encappedKeyBuf, receiverPriv}:any) => {
  try {
    let ikm
    let info
    const receiverPubBuf = await p256.getPublicKey(base64urlDecode(receiverPriv), false);
    const aad = additionalAssociatedData(encappedKeyBuf, receiverPubBuf);
    const kemContext = getKemContext(encappedKeyBuf,publicKey)
    // Step 1: Generate Shared Secret [DONE]
    const dh = await deriveDh(encappedKeyBuf, receiverPriv);
    ikm = buildLabeledIkm(LABEL_EAE_PRK, dh, SUITE_ID_1)
    info = buildLabeledInfo(LABEL_SHARED_SECRET, kemContext, SUITE_ID_1, 32)
    const sharedSecret = await extractAndExpand(new Uint8Array([]), ikm, info, 32)

    // Step 2: Get AES Key [DONE]
    ikm = buildLabeledIkm(LABEL_SECRET, new Uint8Array([]), SUITE_ID_2)
    info = new Uint8Array([0,32,72,80,75,69,45,118,49,72,80,75,69,0,16,0,1,0,2,107,101,121,0,143,195,174,184,50,73,10,75,90,179,228,32,35,40,125,178,154,31,75,199,194,34,192,223,34,135,39,183,10,64,33,18,47,63,4,233,32,108,209,36,19,80,53,41,180,122,198,166,48,185,46,196,207,125,35,69,8,208,175,151,113,201,158,80])
    const key = await extractAndExpand(sharedSecret,ikm,info,32)

    // Step 3: Get IV [DONE]
    info = new Uint8Array([0,12,72,80,75,69,45,118,49,72,80,75,69,0,16,0,1,0,2,98,97,115,101,95,110,111,110,99,101,0,143,195,174,184,50,73,10,75,90,179,228,32,35,40,125,178,154,31,75,199,194,34,192,223,34,135,39,183,10,64,33,18,47,63,4,233,32,108,209,36,19,80,53,41,180,122,198,166,48,185,46,196,207,125,35,69,8,208,175,151,113,201,158,80])
    const iv = await extractAndExpand(sharedSecret,ikm,info,12)

    // Step 4: Decrypt 
    // const decryptedData = await aesGcmDecrypt(ciphertextBuf, Buffer.from(key), Buffer.from(iv), Buffer.from(aad));
    const decryptedData = await aesGcmDecrypt(ciphertextBuf, key, iv, aad);
    return decryptedData;
  } catch (error) {
    console.error('Decryption Error:', error);
    throw error;
  }
};

function stringToBase64urlString(input: string): string {
  // string to base64 -- we do not rely on the browser's btoa since it's not present in React Native environments
  const base64String = btoa(input);
  return base64StringToBase64UrlEncodedString(base64String);
}

function base64StringToBase64UrlEncodedString(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}


  const handleInjectBundle = async () => {
    try {

      if (
        // Non-alphanumerical characters in base64url: - and _. These aren't in base58.
        credentialBundle.indexOf("-") === -1 && credentialBundle.indexOf("_") === -1
        // Uppercase o (O), uppercase i (I), lowercase L (l), and 0 aren't in the character set either.
        && credentialBundle.indexOf("O") === -1 && credentialBundle.indexOf("I") === -1 && credentialBundle.indexOf("l") === -1 && credentialBundle.indexOf("0") === -1
      ) {
        var bundleBytes = bs58check.decode(credentialBundle)
      } else {
        var bundleBytes = base64urlDecode(credentialBundle);
      }

      if (bundleBytes.byteLength <= 33) {
        throw new Error("bundle size " + bundleBytes.byteLength + " is too low. Expecting a compressed public key (33 bytes) and an encrypted credential")
      }

      var compressedEncappedKeyBuf = bundleBytes.slice(0,33);
      var ciphertextBuf = bundleBytes.slice(33);
      var encappedKeyBuf = uncompressRawPublicKey(compressedEncappedKeyBuf)
      const decryptedData = await hpkeDecrypt({
        ciphertextBuf: ciphertextBuf,
        encappedKeyBuf: encappedKeyBuf,           
        receiverPriv: embeddedKey                      
      });

    setDecryptedData(Buffer.from(decryptedData).toString('hex'));
    } catch (error) {
      console.error('Error injecting bundle:', error);
    }
  };


  
  const handleStampPayload = async () => {
    try {
      const content = JSON.stringify(payload)
      const publicKey = Buffer.from(p256.getPublicKey(decryptedData, true)).toString('hex')
      const privateKey = decryptedData
      const signature = await signWithApiKey({content, publicKey, privateKey} )
      // // const rawSignature = await signPayload(credential, payload);
      // const rawSignature: Uint8Array = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      // const derSignature = await convertEcdsaIeee1363ToDer(rawSignature);
      console.log(payload)
      console.log(content)
      console.log(signature)
      setSignature(signature);
      const stamp = {
        publicKey: publicKey,
        scheme: "SIGNATURE_SCHEME_TK_API_P256",
        signature: signature,
      };
      console.log(stringToBase64urlString(JSON.stringify(stamp)))
    } catch (error) {
      console.error('Error stamping payload:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text>Email Authentication</Text>
      <Text>Embedded Key: {publicKey}</Text>
      <TextInput
        style={styles.input}
        onChangeText={setCredentialBundle}
        value={credentialBundle}
        placeholder="Enter Credential Bundle"
      />
      <Button title="Inject Bundle" onPress={handleInjectBundle} />
      <TextInput
        style={styles.input}
        onChangeText={setPayload}
        value={payload}
        placeholder="Enter Payload"
      />
      <Button title="Stamp Payload" onPress={handleStampPayload} />
      <Text>Decrypted Data: {decryptedData}</Text>
      <Text>Signature: {signature}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
    width: '100%',
  },
});

export default AuthScreen;
