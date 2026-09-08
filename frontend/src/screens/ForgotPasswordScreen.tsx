import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { forgotPassword } from "../api/client";
import { useTheme, Colors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

const ERROR_RED = "#E05252";
const SUCCESS_GREEN = "#34A853";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      return false;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSubmit() {
    setFormError("");
    setSuccessMessage("");
    if (!validate()) return;

    setLoading(true);
    try {
      const { message } = await forgotPassword(email.trim().toLowerCase());
      setSuccessMessage(message);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleContinueToReset() {
    navigation.navigate("ResetPassword", { email: email.trim().toLowerCase() });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.keyboardView, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <Text style={[styles.logoText, { color: colors.textInverse }]}>HUSTL</Text>
          <Text style={styles.headerSubtitle}>FORGOT PASSWORD</Text>
        </View>

        <View style={styles.body}>
          <Text style={[styles.instructions, { color: colors.textMuted }]}>
            Enter the email address linked to your account. We'll send you a 6-digit reset code.
          </Text>

          {/* Email field */}
          <View style={styles.fieldWrapper}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!emailError && styles.inputError]}
              placeholder="Email"
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (emailError) setEmailError("");
                if (formError) setFormError("");
                if (successMessage) setSuccessMessage("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />
            {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}
          </View>

          {/* Inline error */}
          {!!formError && (
            <View style={styles.bannerError}>
              <Text style={styles.bannerErrorText}>{formError}</Text>
            </View>
          )}

          {/* Success state */}
          {!!successMessage && (
            <View style={styles.bannerSuccess}>
              <Text style={styles.bannerSuccessText}>{successMessage}</Text>
            </View>
          )}

          {/* Send code button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel="Send reset code"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>SEND CODE →</Text>
            )}
          </TouchableOpacity>

          {/* Once the code was sent, show a shortcut to the next step */}
          {!!successMessage && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleContinueToReset}
              accessibilityLabel="Enter reset code"
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>I have a code →</Text>
            </TouchableOpacity>
          )}

          {/* Back to login */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.navigate("Login")}
            accessibilityRole="button"
          >
            <Text style={[styles.backLinkText, { color: colors.textMuted }]}>← Back to Login</Text>
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
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 6,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 3,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 16,
  },
  instructions: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  fieldWrapper: {
    gap: 0,
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
  bannerError: {
    backgroundColor: "rgba(224, 82, 82, 0.12)",
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerErrorText: {
    color: Colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  bannerSuccess: {
    backgroundColor: "rgba(52, 168, 83, 0.12)",
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerSuccessText: {
    color: Colors.success,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: Colors.accentOrange,
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 2,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.accentOrange,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: Colors.accentOrange,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 1,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  backLinkText: {
    fontSize: 14,
  },
});
