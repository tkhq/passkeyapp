import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import { PasskeyStamper, createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper";
import {TURNKEY_ORGANIZATION_ID, TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY} from "@env"

const RPID = "passkeyapp.tkhqlabs.xyz"

export default function App() {
  return (
    <View style={styles.container}>
      <Text>React Native Passkey App</Text>
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
  if (!isSupported()) {
    alert("Passkeys are not supported on this device")
  }

  try {
    const authenticatorParams = await createPasskey({
      // This doesn't matter much, it will be the name of the authenticator persisted on the Turnkey side.
      // Won't be visible by default.
      authenticatorName: "New Passkey",
      rp: {
        id: RPID,
        name: "Passkey App",
      },
      user: {
        id: "new-id",
        name: "New Passkey",
        displayName: "New Passkey",
      },
    })
    console.log("passkey registration succeeded: ", authenticatorParams);
    // Now let's use the authenticator params to create a new sub-organization on the Turnkey side
    // TODO: do it.
    // console.log(TURNKEY_API_PRIVATE_KEY, TURNKEY_API_PUBLIC_KEY, TURNKEY_ORGANIZATION_ID);
  } catch(e) {
    console.error("error during passkey creation", e);
  }
}

async function onPasskeySignature() {
  try {
    const result = await new PasskeyStamper({
      rpId: RPID,
    }).stamp(`{"organizationId": "${TURNKEY_ORGANIZATION_ID}"}`)
    console.log("passkey authentication succeeded: ", result);
  } catch(e) {
    console.error("error during passkey signature", e);
  }
}
