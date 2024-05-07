import 'react-native-get-random-values'
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import {signWithApiKey} from '@turnkey/api-key-stamper'
import {generateP256KeyPair, decryptBundle, getPublicKey, uint8ArrayFromHexString} from '@turnkey/crypto' // TODO: uint8arrayFromHexString Should live in /encoding
import {stringToBase64urlString, uint8ArrayToHexString} from '@turnkey/encoding'

const AuthScreen = () => {
  const [embeddedKey, setEmbeddedKey] = useState<any>(null);
  const [credentialBundle, setCredentialBundle] = useState('');
  const [payload, setPayload] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [decryptedData, setDecryptedData] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    handleGenerateKey();
  }, []);

  const handleGenerateKey = async () => {
    try {
      const key = generateP256KeyPair();
      setEmbeddedKey(key.privateKey);
      const targetPubHex = key.publicKeyUncompressed;
      console.log(targetPubHex)
      setPublicKey(targetPubHex!);
    } catch (error) {
      console.error('Error generating key:', error);
    }
  };

  const handleInjectBundle = () => {
    try{
    const decryptedData = decryptBundle(credentialBundle, embeddedKey) as Uint8Array

    setDecryptedData(uint8ArrayToHexString(decryptedData));
    }
    catch (error) {
      console.error('Error injecting bundle:', error);
    }
  };
  
  const handleStampPayload = async () => {
    try {
      const publicKey = uint8ArrayToHexString(getPublicKey(uint8ArrayFromHexString(decryptedData), true))
      const privateKey = decryptedData
      const signature = await signWithApiKey({content: payload, publicKey, privateKey} )
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
