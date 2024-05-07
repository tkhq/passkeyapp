import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import {signWithApiKey} from '@turnkey/api-key-stamper'
import {generateTargetKey, decryptBundle, stringToBase64urlString, base64StringToBase64UrlEncodedString, uint8arrayToHexString, getPublicKey, uint8arrayFromHexString} from '@turnkey/crypto'

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
      const key = await generateTargetKey();
      setEmbeddedKey(key.privateKey);
      const targetPubHex = uint8arrayToHexString(key.publicKey);
      console.log(targetPubHex)
      setPublicKey(targetPubHex);
    } catch (error) {
      console.error('Error generating key:', error);
    }
  };

  const handleInjectBundle = async () => {
    try{
    const decryptedData = await decryptBundle(credentialBundle, embeddedKey) as Uint8Array

    setDecryptedData(uint8arrayToHexString(decryptedData));
    }
    catch (error) {
      console.error('Error injecting bundle:', error);
    }
  };
  
  const handleStampPayload = async () => { //TODO
    try {
      const content = JSON.stringify(payload)
      const publicKey = uint8arrayToHexString(getPublicKey(uint8arrayFromHexString(decryptedData), true))
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
