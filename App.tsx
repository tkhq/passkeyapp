import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import { PasskeyStamper, createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper";
import {TURNKEY_ORGANIZATION_ID, TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY} from "@env"
import { ApiKeyStamper } from "./ApiKeyStamper";
import { TurnkeyClient } from "@turnkey/http";

const RPID = "passkeyapp.tkhqlabs.xyz"

export default function App() {
  return (
    <View style={styles.container}>
      <Text>React Native Passkey App</Text>
      <Button title='Create Passkey' onPress={onPasskeyCreate}></Button>
      <Button title='Sign with Passkey' onPress={onPasskeySignature}></Button>
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
        name: "Newest Passkey",
        displayName: "Newest Passkey",
      },
    })
    console.log("passkey registration succeeded: ", authenticatorParams);
    const response = await createSubOrganization(authenticatorParams);
    console.log("created sub-org", response)
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
      organizationId: TURNKEY_ORGANIZATION_ID
    })
    console.log("passkey authentication succeeded: ", getWhoamiResult);
  } catch(e) {
    console.error("error during passkey signature", e);
  }
}

async function createSubOrganization(authenticatorParams: Awaited<ReturnType<typeof createPasskey>>) {
  const stamper = new ApiKeyStamper({
    apiPublicKey: TURNKEY_API_PUBLIC_KEY,
    apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
  });
  const client = new TurnkeyClient({baseUrl: "https://api.turnkey.com"}, stamper);

  const data = await client.createSubOrganization({
    type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4",
    timestampMs: String(Date.now()),
    organizationId: TURNKEY_ORGANIZATION_ID,
    parameters: {
      subOrganizationName: `Sub-organization at ${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: "Root end-user",
          apiKeys: [],
          authenticators: [{
            authenticatorName: authenticatorParams.authenticatorName,
            challenge: authenticatorParams.challenge,
            attestation: {
                credentialId: base64Tobase64url(authenticatorParams.attestation.credentialId),
                clientDataJson: base64Tobase64url(authenticatorParams.attestation.clientDataJson),
                attestationObject: base64Tobase64url(authenticatorParams.attestation.attestationObject),
                transports: authenticatorParams.attestation.transports
            }
          }],
        },
      ],
    }
  });
  return data
}

/**
 * Simple util to convert a base64-encoded string to base64url
 */
function base64Tobase64url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
