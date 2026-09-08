import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { sendContactMessage, getApiErrorMessage } from "../api/client";
import { useTheme, Colors } from "../theme";

type Props = Readonly<{
  navigation: Readonly<{
    goBack: () => void;
  }>;
}>;

const SUBJECT_OPTIONS = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Account Issue",
  "Other",
];

export default function ContactUsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = message.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;

    setSending(true);
    try {
      const response = await sendContactMessage({
        subject,
        message: message.trim(),
      });

      Alert.alert("Message Sent", response.message, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to send message. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textInverse} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textInverse }]}>Contact Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="mail-outline" size={24} color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              Have a question, feedback, or need help? Send us a message and we'll get back to you as soon as possible.
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.textMuted }]}>SUBJECT</Text>
            <View style={styles.subjectOptions}>
              {SUBJECT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.subjectChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    subject === option && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  onPress={() => setSubject(option)}
                >
                  <Text
                    style={[
                      styles.subjectChipText,
                      { color: colors.textMuted },
                      subject === option && { color: colors.textInverse },
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>MESSAGE</Text>
            <TextInput
              style={[
                styles.messageInput,
                { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText },
              ]}
              placeholder="Type your message here..."
              placeholderTextColor={colors.placeholder}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              editable={!sending}
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {message.length} / 5000 characters
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!canSend || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!canSend || sending}
        >
          {sending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={Colors.white} />
              <Text style={styles.sendButtonText}>Send Message</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 12,
  },
  subjectOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  subjectChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  subjectChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 180,
  },
  charCount: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sendButton: {
    backgroundColor: Colors.accentOrange,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.white,
  },
});
