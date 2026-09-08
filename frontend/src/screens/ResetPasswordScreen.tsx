import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useRef, useState } from "react";
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

import { getApiErrorMessage, resetPassword } from "../api/client";
import { useTheme, Colors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

const ERROR_RED = "#E05252";
const SUCCESS_GREEN = "#34A853";

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { email } = route.params;

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [codeError, setCodeError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");

  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  function validate(): boolean {
    let valid = true;

    if (!code.trim() || code.trim().length !== 6 || !/^\d{6}$/.test(code.trim())) {
      setCodeError("Enter the 6-digit code from your email.");
      valid = false;
    } else {
      setCodeError("");
    }

    if (!newPassword) {
      setNewPasswordError("Please enter a new password.");
      valid = false;
    } else if (newPassword.length < 8) {
      setNewPasswordError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setNewPasswordError("");
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password.");
      valid = false;
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    } else {
      setConfirmPasswordError("");
    }

    return valid;
  }

  async function handleReset() {
    setFormError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await resetPassword(email, code.trim(), newPassword);
      setDone(true);
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Invalid or expired code. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={[styles.successTitle, { color: colors.text }]}>Password Reset!</Text>
          <Text style={[styles.successBody, { color: colors.textMuted }]}>
            Your password has been updated. You can now log in with your new password.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Login")}
            accessibilityLabel="Go to login"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>GO TO LOGIN →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
          <Text style={styles.headerSubtitle}>RESET PASSWORD</Text>
        </View>

        <View style={styles.body}>
          <Text style={[styles.instructions, { color: colors.textMuted }]}>
            Enter the 6-digit code sent to{" "}
            <Text style={[styles.emailHighlight, { color: colors.text }]}>{email}</Text>, then choose a new password.
          </Text>

          {/* Code */}
          <View>
            <TextInput
              style={[styles.input, styles.codeInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!codeError && styles.inputError]}
              placeholder="6-digit code"
              placeholderTextColor={colors.placeholder}
              value={code}
              onChangeText={(v) => { setCode(v); if (codeError) setCodeError(""); if (formError) setFormError(""); }}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="next"
              onSubmitEditing={() => newPasswordRef.current?.focus()}
              editable={!loading}
            />
            {!!codeError && <Text style={styles.fieldError}>{codeError}</Text>}
          </View>

          {/* New password */}
          <View>
            <TextInput
              ref={newPasswordRef}
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!newPasswordError && styles.inputError]}
              placeholder="New password"
              placeholderTextColor={colors.placeholder}
              value={newPassword}
              onChangeText={(v) => {
                setNewPassword(v);
                if (newPasswordError) setNewPasswordError("");
                if (confirmPassword && confirmPasswordError) {
                  setConfirmPasswordError(v !== confirmPassword ? "Passwords do not match." : "");
                }
              }}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              editable={!loading}
            />
            {!!newPasswordError && <Text style={styles.fieldError}>{newPasswordError}</Text>}
          </View>

          {/* Confirm new password */}
          <View>
            <TextInput
              ref={confirmPasswordRef}
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, !!confirmPasswordError && styles.inputError]}
              placeholder="Confirm new password"
              placeholderTextColor={colors.placeholder}
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                if (confirmPasswordError) {
                  setConfirmPasswordError(v !== newPassword ? "Passwords do not match." : "");
                }
              }}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleReset}
              editable={!loading}
            />
            {!!confirmPasswordError && <Text style={styles.fieldError}>{confirmPasswordError}</Text>}
          </View>

          {/* Server error */}
          {!!formError && (
            <View style={styles.bannerError}>
              <Text style={styles.bannerErrorText}>{formError}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
            accessibilityLabel="Reset password"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>RESET PASSWORD →</Text>
            )}
          </TouchableOpacity>

          {/* Resend — go back to request a new code */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.navigate("ForgotPassword")}
            accessibilityRole="button"
          >
            <Text style={[styles.backLinkText, { color: colors.textMuted }]}>Didn't get a code? Send again</Text>
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
  emailHighlight: {
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 10,
    textAlign: "center",
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
  backLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
  },
  // Success state
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  successCard: {
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  successIcon: {
    fontSize: 56,
    color: Colors.success,
    lineHeight: 72,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
  },
  successBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 8,
  },
});
