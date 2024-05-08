import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./Home";
import AuthScreen from "./Auth";

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="AuthScreen"
          component={AuthScreen}
          options={{ title: "Authenticate" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
