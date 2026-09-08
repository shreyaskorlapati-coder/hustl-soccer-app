import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { getApiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { useTheme, Colors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login, loginWithGoogle } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");

  const { promptGoogleSignIn, isConfigured: googleConfigured } = useGoogleAuth({
    onSuccess: async (idToken) => {
      try {
        await loginWithGoogle({ id_token: idToken });
      } catch (err) {
        Alert.alert(
          "Google Sign-In Failed",
          getApiErrorMessage(err, "Could not sign in with Google.")
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (message) => {
      Alert.alert("Google Sign-In Error", message);
      setGoogleLoading(false);
    },
    onCancel: () => setGoogleLoading(false),
  });

  async function handleGooglePress() {
    if (!googleConfigured) {
      Alert.alert(
        "Google Sign-In Not Configured",
        "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file.\n\nCreate credentials at console.cloud.google.com/apis/credentials"
      );
      return;
    }

    setGoogleLoading(true);
    const started = await promptGoogleSignIn();
    // If the prompt couldn't start (e.g. already in progress) reset the spinner.
    if (!started) setGoogleLoading(false);
  }

  function validateForm(): boolean {
    let valid = true;
    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      valid = false;
    } else {
      setEmailError("");
    }
    if (!password) {
      setPasswordError("Please enter your password.");
      valid = false;
    } else {
      setPasswordError("");
    }
    return valid;
  }

  async function handleLogin() {
    setFormError("");
    if (!validateForm()) return;

    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  }

  const anyLoading = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      style={[styles.keyboardView, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <Text style={[styles.logoText, { color: colors.textInverse, fontFamily: "Poppins_700Bold_Italic" }]}>hustl</Text>

          <View style={styles.tabContainer}>
            <TouchableOpacity style={styles.tab} onPress={() => navigation.navigate("Signup")}>
              <Text style={styles.tabText}>SIGN UP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, styles.tabActive, { backgroundColor: colors.accent }]}>
              <Text style={[styles.tabText, styles.tabTextActive, { color: colors.textInverse }]}>LOG IN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Email / password form ── */}
          <View style={styles.form}>
            <View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!emailError && styles.inputError]}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); if (formError) setFormError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                editable={!anyLoading}
              />
              {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}
            </View>

            <View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!passwordError && styles.inputError]}
                placeholder="Password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(""); if (formError) setFormError(""); }}
                secureTextEntry
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!anyLoading}
              />
              {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
            </View>

            {!!formError && (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate("ForgotPassword")}
              accessibilityRole="button"
            >
              <Text style={[styles.forgotPasswordText, { color: colors.accent }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.accent }, anyLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={anyLoading}
            accessibilityLabel="Log in"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={[styles.continueButtonText, { color: colors.textInverse }]}>CONTINUE →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    flexDirection: "column",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  logoText: {
    fontSize: 42,
    letterSpacing: 2,
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 22,
  },
  tabActive: {},
  tabText: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1,
  },
  tabTextActive: {},
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
  },
  socialButtons: {
    flexDirection: "row",
    gap: 12,
  },
  googleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 8,
  },
  googleIcon: {
    marginRight: 6,
  },
  googleButtonText: {
    color: "#1a1a1a",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 1,
  },
  appleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  appleIcon: {
    marginRight: 6,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 1,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 12,
    letterSpacing: 1,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  inputError: {
    borderColor: Colors.error,
  },
  fieldError: {
    color: Colors.error,
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  formErrorBox: {
    backgroundColor: "rgba(224, 82, 82, 0.12)",
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  formErrorText: {
    color: Colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "500",
  },
  continueButton: {
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 2,
  },
});
