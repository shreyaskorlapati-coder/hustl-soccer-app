import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useRef, useState } from "react";
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

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen({ navigation }: Props) {
  const { signup, loginWithGoogle } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Per-field inline errors
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");

  // Refs for focus chaining
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const { promptGoogleSignIn, isConfigured: googleConfigured } = useGoogleAuth({
    onSuccess: async (idToken) => {
      try {
        await loginWithGoogle({ id_token: idToken });
      } catch (err) {
        Alert.alert(
          "Google Sign-Up Failed",
          getApiErrorMessage(err, "Could not sign up with Google.")
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (message) => {
      Alert.alert("Google Sign-Up Error", message);
      setGoogleLoading(false);
    },
    onCancel: () => setGoogleLoading(false),
  });

  async function handleGooglePress() {
    if (!googleConfigured) {
      Alert.alert(
        "Google Sign-Up Not Configured",
        "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file.\n\nCreate credentials at console.cloud.google.com/apis/credentials"
      );
      return;
    }

    setGoogleLoading(true);
    const started = await promptGoogleSignIn();
    if (!started) setGoogleLoading(false);
  }

  function validateForm(): boolean {
    let valid = true;

    if (!name.trim()) {
      setNameError("Please enter your full name.");
      valid = false;
    } else {
      setNameError("");
    }

    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      valid = false;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError("Please enter a password.");
      valid = false;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setPasswordError("");
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
      valid = false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    } else {
      setConfirmPasswordError("");
    }

    return valid;
  }

  async function handleSignup() {
    setFormError("");
    if (!validateForm()) return;

    setLoading(true);
    try {
      await signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Could not create account. Please try again."));
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
            <TouchableOpacity style={[styles.tab, styles.tabActive, { backgroundColor: colors.accent }]}>
              <Text style={[styles.tabText, styles.tabTextActive, { color: colors.textInverse }]}>SIGN UP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => navigation.navigate("Login")}>
              <Text style={styles.tabText}>LOG IN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Form ── */}
          <View style={styles.form}>
            {/* Full Name */}
            <View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!nameError && styles.inputError]}
                placeholder="Full Name"
                placeholderTextColor={colors.placeholder}
                value={name}
                onChangeText={(v) => { setName(v); if (nameError) setNameError(""); }}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!anyLoading}
              />
              {!!nameError && <Text style={styles.fieldError}>{nameError}</Text>}
            </View>

            {/* Email */}
            <View>
              <TextInput
                ref={emailRef}
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!emailError && styles.inputError]}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!anyLoading}
              />
              {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}
            </View>

            {/* Password */}
            <View>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!passwordError && styles.inputError]}
                placeholder="Password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (passwordError) setPasswordError("");
                  // Re-check confirm match live once the user starts correcting
                  if (confirmPassword && confirmPasswordError) {
                    setConfirmPasswordError(v !== confirmPassword ? "Passwords do not match." : "");
                  }
                }}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                editable={!anyLoading}
              />
              {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
            </View>

            {/* Confirm Password */}
            <View>
              <TextInput
                ref={confirmPasswordRef}
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!confirmPasswordError && styles.inputError]}
                placeholder="Confirm Password"
                placeholderTextColor={colors.placeholder}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (confirmPasswordError) {
                    setConfirmPasswordError(v !== password ? "Passwords do not match." : "");
                  }
                }}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSignup}
                editable={!anyLoading}
              />
              {!!confirmPasswordError && <Text style={styles.fieldError}>{confirmPasswordError}</Text>}
            </View>

            {/* Server / submission error */}
            {!!formError && (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.accent }, anyLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={anyLoading}
            accessibilityLabel="Create account"
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
