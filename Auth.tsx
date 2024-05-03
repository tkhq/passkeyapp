import Crypto from 'react-native-quick-crypto';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { btoa, atob } from 'react-native-quick-base64'
import {
  importCredential,
  // p256JWKPrivateToPublic,
  compressRawPublicKey,
  // uncompressRawPublicKey,
  convertEcdsaIeee1363ToDer,
  // hpkeDecrypt,
  // generateTargetKey,
  // base64urlEncode,
  // base64urlDecode,
  // base58checkDecode
} from '@turnkey/frame-utils';
import AesGcmCrypto from 'react-native-aes-gcm-crypto';
import { p256 } from "@noble/curves/p256"; 
import { TextEncoder, TextDecoder } from 'text-encoding';
import CryptoJS from 'crypto-js';
// import { hkdf } from '@noble/hashes/hkdf';
import * as hkdf from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256';
import { gcm } from '@noble/ciphers/aes';
import { utf8ToBytes } from '@noble/ciphers/utils';

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

  const LABEL_BASE_NONCE = new Uint8Array([
    98, 97, 115, 101, 95, 110, 111, 110, 99, 101,
  ]);
  // b"exp"
  const LABEL_EXP = new Uint8Array([101, 120, 112]);
  // b"info_hash"
  // deno-fmt-ignore
  const LABEL_INFO_HASH = new Uint8Array([
    105, 110, 102, 111, 95, 104, 97, 115, 104,
  ]);
  // b"key"
  const LABEL_KEY = new Uint8Array([107, 101, 121]);
  // b"psk_id_hash"
  // deno-fmt-ignore
  const LABEL_PSK_ID_HASH = new Uint8Array([
    112, 115, 107, 95, 105, 100, 95, 104, 97, 115, 104,
  ]);
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

      function modSqrt(x, p) {
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


  async function base58checkDecode(s:any) {
    if (s.length < 5) {
      throw new Error(`cannot base58-decode a string of length < 5 (found length ${s.length})`)
    }

    // See https://en.bitcoin.it/wiki/Base58Check_encoding
    var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    var decoded = BigInt(0);
    var decodedBytes = [];
    var leadingZeros = [];
    for (var i = 0; i < s.length; i++) {
      if (alphabet.indexOf(s[i]) === -1) {
        throw new Error(`cannot base58-decode: ${s[i]} isn't a valid character`)
      }
      var carry = alphabet.indexOf(s[i]);

      // If the current base58 digit is 0, append a 0 byte.
      // "i == leadingZeros.length" can only be true if we have not seen non-zero bytes so far.
      // If we had seen a non-zero byte, carry wouldn't be 0, and i would be strictly more than `leadingZeros.length`
      if (carry == 0 && i === leadingZeros.length) {
        leadingZeros.push(0);
      }

      var j = 0;
      while (j < decodedBytes.length || carry > 0) {
        var currentByte:any = decodedBytes[j];

        // shift the current byte 58 units and add the carry amount
        // (or just add the carry amount if this is a new byte -- undefined case)
        if (currentByte === undefined) {
          currentByte = carry
        } else {
          currentByte = currentByte * 58 + carry
        }

        // find the new carry amount (1-byte shift of current byte value)
        carry = currentByte >> 8;
        // reset the current byte to the remainder (the carry amount will pass on the overflow)
        decodedBytes[j] = currentByte % 256;
        j++
      }
    }

    var result = leadingZeros.concat(decodedBytes.reverse());

    var foundChecksum = result.slice(result.length - 4)

    var msg = result.slice(0, result.length - 4)
    var checksum1 = await crypto.subtle.digest("SHA-256", new Uint8Array(msg))
    var checksum2 = await crypto.subtle.digest("SHA-256", new Uint8Array(checksum1))
    var computedChecksum = Array.from(new Uint8Array(checksum2)).slice(0, 4);

    if (computedChecksum.toString() != foundChecksum.toString()) {
      throw new Error(`checksums do not match: computed ${computedChecksum} but found ${foundChecksum}`)
    }

    return new Uint8Array(msg);
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

const generateTargetKey = async (): Promise<any> => {
  try {
    // Generate a random private key
    const randomBuf = Crypto.randomBytes(32);
    const publicKey = await p256.getPublicKey(randomBuf, false);
    const publicKeyHex = Buffer.from(publicKey).toString('hex');

    if (publicKeyHex.startsWith('04')) {
      const xCoordinate = base64urlEncode(Buffer.from(publicKeyHex.slice(2, 66), 'hex'));
      const yCoordinate = base64urlEncode(Buffer.from(publicKeyHex.slice(66), 'hex'));
      const dBase64url = base64urlEncode(randomBuf);

      // JWK format for EC private key
      // const privateKeyJWK = {
      //   kty: 'EC',
      //   crv: 'P-256',
      //   x: xCoordinate,
      //   y: yCoordinate,
      //   d: dBase64url, 
      // };

      //hardcoded
      const privateKeyJWK = {
        kty: 'EC',
        crv: 'P-256',
ext: true,
        x: "V5vpFxAkqni1ZNs20Hkln6af4civecIgl1XpU67CgaU",
        y: "Y84S3FCLuYlvKnCOmyiwrP_ol8qKK7BVRkS1lWdMv1U",
        d: "_kHJfupH1BuzLTIFKVLwLozqTTodhU_Zi7Jn1Rtl1dM", 
      };

      return privateKeyJWK;
    } else {
      throw new Error('Public key format is not uncompressed');
    }
  } catch (error) {
    console.error('Error generating key:', error);
    throw error;
  }
};

const p256JWKPrivateToPublic = async (privateJwk: any): Promise<Uint8Array> => {
  const privateJwkCopy = { ...privateJwk };
  delete privateJwkCopy.d; 

  try {
    const publicKey = await Crypto.subtle.importKey(
      'jwk',
      privateJwkCopy,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );
    const rawPublicKey = await Crypto.subtle.exportKey('raw', publicKey);
      const resp = new Uint8Array(rawPublicKey)
    return new Uint8Array(rawPublicKey);
  } catch (error) {
    console.error('Error converting private key to public key:', error);
    throw error;
  }
};


  useEffect(() => {
    handleGenerateKey();
  }, []);

  const handleGenerateKey = async () => {
    try {
      const key = await generateTargetKey();
      setEmbeddedKey(key);
      const targetPubBuf = await p256JWKPrivateToPublic(key);
      const targetPubHex =  Buffer.from(targetPubBuf).toString('hex');
      setPublicKey(targetPubHex);
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
const deriveDh = async (encappedKeyBuf:any, privateKeyJWK:any) => {
  const dh = p256.getSharedSecret(base64urlDecode(privateKeyJWK.d), encappedKeyBuf)
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
const hpkeDecrypt = async ({ciphertextBuf, encappedKeyBuf, receiverPrivJwk}:any) => {
  try {
    let ikm
    let info
    const receiverPubBuf = await p256JWKPrivateToPublic(receiverPrivJwk);
    const aad = additionalAssociatedData(encappedKeyBuf, receiverPubBuf);
    const kemContext = getKemContext(encappedKeyBuf,publicKey)

    // Step 1: Generate Shared Secret [DONE]
    const dh = await deriveDh(encappedKeyBuf, receiverPrivJwk);
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


  const handleInjectBundle = async () => {
    try {

      if (
        // Non-alphanumerical characters in base64url: - and _. These aren't in base58.
        credentialBundle.indexOf("-") === -1 && credentialBundle.indexOf("_") === -1
        // Uppercase o (O), uppercase i (I), lowercase L (l), and 0 aren't in the character set either.
        && credentialBundle.indexOf("O") === -1 && credentialBundle.indexOf("I") === -1 && credentialBundle.indexOf("l") === -1 && credentialBundle.indexOf("0") === -1
      ) {
        // If none of these characters are in the bundle we assume it's a base58check-encoded string
        // This isn't perfect: there's a small chance that a base64url-encoded string doesn't have any of these characters by chance!
        // But we accept this risk given this branching is only here to support our transition to base58check.
        // I hear you'd like to quantify this risk? Let's do it.
        // Assuming random bytes in our bundle and a bundle length of 33 (public key, compressed) + 48 (encrypted cred) = 81 bytes.
        // The odds of a byte being in the overlap set between base58 and base64url is 58/64=0.90625.
        // Which means the odds of a 81 bytes string being in the overlap character set for its entire length is...
        // ... 0.90625^81 = 0.0003444209703
        // Are you convinced that this is good enough? I am :)
        var bundleBytes = await base58checkDecode(credentialBundle);
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
        receiverPrivJwk: embeddedKey                      
      });

    setDecryptedData(Buffer.from(decryptedData).toString('hex'));
    } catch (error) {
      console.error('Error injecting bundle:', error);
    }
  };

  const handleStampPayload = async () => {
    try {
      const credential = await importCredential(embeddedKey!);
      // const rawSignature = await signPayload(credential, payload);
      const rawSignature: Uint8Array = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      const derSignature = await convertEcdsaIeee1363ToDer(rawSignature);
      setSignature(base64urlEncode(derSignature));
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
