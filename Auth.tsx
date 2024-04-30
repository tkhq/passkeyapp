import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import {
  importCredential,
  p256JWKPrivateToPublic,
  compressRawPublicKey,
  uncompressRawPublicKey,
  convertEcdsaIeee1363ToDer,
  // hpkeDecrypt,
  generateTargetKey,
  base64urlEncode,
  base64urlDecode,
  base58checkDecode
} from '@turnkey/frame-utils';
// import {crypto, JsonWebKey,CryptoKey} from './crypto'
import { p256 } from "@noble/curves/p256";
import Crypto from 'react-native-quick-crypto';
const AuthScreen = () => {
  const [embeddedKey, setEmbeddedKey] = useState<any>(null);
  const [credentialBundle, setCredentialBundle] = useState('');
  const [payload, setPayload] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [decryptedData, setDecryptedData] = useState('');
  const [signature, setSignature] = useState('');


// Key material utilities

//exported
// const generateTargetKey = async (): Promise<any> => {
//   const res = await gen()
//   console.log(res)
//   console.log("HERE")
//   const randomBuf = Crypto.randomBytes(32);
// const publicKey = p256.getPublicKey(randomBuf, true);
// console.log(publicKey)
// const publicKeyHex = Buffer.from(publicKey).toString('hex');
// console.log(publicKeyHex);
//   // console.log(crypto.subtle.generateKey)
//   // const keyPair = await crypto.subtle.generateKey(
//   //     { name: 'ECDH', namedCurve: 'P-256' },
//   //     true,
//   //     ['deriveKey']
//   // );
//   // console.log(keyPair)
//   // return crypto.subtle.exportKey("jwk", keyPair.privateKey);
// };



  useEffect(() => {
    handleGenerateKey();
  }, []);

  const handleGenerateKey = async () => {
    try {
      const key = await generateTargetKey();
      console.log("HERE")
      console.log(key)
      setEmbeddedKey(key);
      const pubKey = await p256JWKPrivateToPublic(key);
      const compressedPubKey = await compressRawPublicKey(pubKey);
      setPublicKey(base64urlEncode(compressedPubKey));
    } catch (error) {
      console.error('Error generating key:', error);
    }
  };

  const handleInjectBundle = async () => {
    try {
      const publicKeyDecompressed = await uncompressRawPublicKey(base64urlDecode(publicKey));
      const decryptedData = await hpkeDecrypt({
        ciphertextBuf: base64urlDecode(credentialBundle),
        encappedKeyBuf: publicKeyDecompressed,           
        receiverPrivJwk: embeddedKey                      
      });
    const decoder = new TextDecoder('utf-8'); 
    const decodedString = decoder.decode(decryptedData); 

    setDecryptedData(decodedString);
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
