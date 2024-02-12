import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import { PasskeyStamper, createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyClient } from "@turnkey/http";
import { Buffer } from "buffer";

const RPID = "passkeyapp.tkhqlabs.xyz"

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Native Passkeys + Turnkey</Text>
      <Button title='Sign Up' onPress={onPasskeyCreate}></Button>
      <Button title='Sign In & get your ID' onPress={onPasskeySignature}></Button>
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    margin: 42,
  },
});


async function onPasskeyCreate() {
  if (!isSupported()) {
    alert("Passkeys are not supported on this device")
  }

  try {
    const now = new Date()
    const humanReadableDateTime = `${now.getFullYear()}-${now.getMonth()}-${now.getDay()}@${now.getHours()}h${now.getMinutes()}min`
    console.log("creating passkey with the following datetime: ", humanReadableDateTime);

    // ID isn't visible by users, but needs to be random enough and valid base64 (for Android)
    const userId = Buffer.from(String(Date.now())).toString("base64");

    const authenticatorParams = await createPasskey({
      // This doesn't matter much, it will be the name of the authenticator persisted on the Turnkey side.
      // Won't be visible by default.
      authenticatorName: "End-User Passkey",
      rp: {
        id: RPID,
        name: "Passkey App",
      },
      user: {
        id: userId,
        // ...but name and display names are
        // We insert a human-readable date time for ease of use
        name: `Key @ ${humanReadableDateTime}`,
        displayName: `Key @ ${humanReadableDateTime}`,
      },
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "preferred",
      }
    })
    console.log("passkey registration succeeded: ", authenticatorParams);
    const response = await createSubOrganization(authenticatorParams);
    console.log("created sub-org", response)
    alert(`Sub-org created! Your ID: ${response.activity.result.createSubOrganizationResultV4?.subOrganizationId}`);
  } catch(e) {
    console.error("error during passkey creation", e);
  }
}

async function onPasskeySignature() {
  try {
    const stamper = await new PasskeyStamper({
      rpId: RPID,
    });
    const client = new TurnkeyClient({baseUrl: "https://api.turnkey.com"}, stamper);
    const getWhoamiResult = await client.getWhoami({
      organizationId: process.env.TURNKEY_ORGANIZATION_ID
    })
    console.log("passkey authentication succeeded: ", getWhoamiResult);
    alert(`Successfully logged into sub-organization ${getWhoamiResult.organizationId}`)
  } catch(e) {
    console.error("error during passkey signature", e);
  }
}

async function createSubOrganization(authenticatorParams: Awaited<ReturnType<typeof createPasskey>>) {
  const stamper = new ApiKeyStamper({
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  });
  const client = new TurnkeyClient({baseUrl: "https://api.turnkey.com"}, stamper);

  const data = await client.createSubOrganization({
    type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4",
    timestampMs: String(Date.now()),
    organizationId: process.env.TURNKEY_ORGANIZATION_ID,
    parameters: {
      subOrganizationName: `Sub-organization at ${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: "Root User",
          apiKeys: [],
          authenticators: [authenticatorParams]
        },
      ],
    }
  });
  return data
}
