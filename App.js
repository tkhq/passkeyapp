import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import { sha256 } from "@noble/hashes/sha256";
import { Buffer } from "buffer";
import { Passkey } from "react-native-passkey";
import 'react-native-get-random-values';
import "text-encoding-polyfill";

const RPID = "passkeyapp.tkhqlabs.xyz"

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Passkey Test App</Text>
      <Button title='Create Passkey' onPress={onPasskeyCreate}>Create Passkey</Button>
      <Button title='Sign with Passkey' onPress={onPasskeySignature}>Sign with Passkey</Button>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

async function onPasskeyCreate() {
  // Check that challenge generation works, and passkeys are supported
  console.log(getChallengeFromPayload("hello"));
  console.log("random challenge", getRandomChallenge());
  console.log("support", Passkey.isSupported());
  try {
    const result = await Passkey.register(
      {
        challenge: getChallengeFromPayload("hello"),
        rp: {
          id: RPID,
          name: "Passkey App",
        },
        user: {
          id: "new-id",
          name: "New Passkey",
          displayName: "New Passkey",
        },
        excludeCredentials: [],
        authenticatorSelection: {
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "preferred",
        },
        attestation: "none",
        extensions: {},
        // All algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
        // We only support ES256 and RS256, which are listed below
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7,
          },
          {
            type: "public-key",
            alg: -257,
          },
        ],
      }
    );
    console.log(result);
  } catch(e) {
    console.error("error during passkey creation", e);
  }
}

async function onPasskeySignature() {
  try {
    const result = await Passkey.authenticate({
      rpId: RPID,
      challenge: getChallengeFromPayload("test payload")
    });
    console.log("success", result);
  } catch(e) {
    console.error("error during passkey signature", e);
  }
}

// Functions below copied from @turnkey/react-native-passkey-stamper
// TODO delete once the mystery is solved

function getChallengeFromPayload(payload) {
  const hashBuffer = sha256(payload);
  const hexString = Buffer.from(hashBuffer).toString("hex");
  const hexBuffer = Buffer.from(hexString, "utf8");
  return hexBuffer.toString("base64");
}

// Function to return 32 random bytes encoded as hex
// The return value looks like "5e4c2c235fc876a9bef433506cf596f2f7db19a959e3e30c5a2d965ec149d40f"
function getRandomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}
