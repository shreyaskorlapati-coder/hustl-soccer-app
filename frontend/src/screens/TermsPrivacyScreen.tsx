import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../theme";

type Props = Readonly<{
  navigation: Readonly<{
    goBack: () => void;
  }>;
}>;

type TabType = "terms" | "privacy";

export default function TermsPrivacyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>("terms");

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textInverse} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textInverse }]}>Terms & Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "terms" && [styles.activeTab, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab("terms")}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textMuted },
              activeTab === "terms" && { color: colors.accent, fontWeight: "600" },
            ]}
          >
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "privacy" && [styles.activeTab, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab("privacy")}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textMuted },
              activeTab === "privacy" && { color: colors.accent, fontWeight: "600" },
            ]}
          >
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "terms" ? (
          <TermsContent colors={colors} />
        ) : (
          <PrivacyContent colors={colors} />
        )}

        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
          Last updated: August 2026
        </Text>
      </ScrollView>
    </View>
  );
}

function TermsContent({ colors }: Readonly<{ colors: ThemeColors }>) {
  return (
    <>
      <Section title="1. Acceptance of Terms" colors={colors}>
        By accessing or using the Hustl application ("App"), you agree to be bound by these Terms of
        Service. If you do not agree to these terms, please do not use the App.
      </Section>

      <Section title="2. Description of Service" colors={colors}>
        Hustl is a sports community platform that allows users to find nearby sports facilities,
        organize games, create and join teams, and connect with other sports enthusiasts.
      </Section>

      <Section title="3. User Accounts" colors={colors}>
        You must create an account to use certain features of the App. You are responsible for
        maintaining the confidentiality of your account credentials and for all activities that
        occur under your account. You agree to provide accurate and complete information when
        creating your account.
      </Section>

      <Section title="4. User Conduct" colors={colors}>
        You agree not to:{"\n"}
        • Use the App for any unlawful purpose{"\n"}
        • Harass, abuse, or harm other users{"\n"}
        • Post false, misleading, or offensive content{"\n"}
        • Attempt to gain unauthorized access to the App{"\n"}
        • Interfere with the proper functioning of the App
      </Section>

      <Section title="5. Content" colors={colors}>
        You retain ownership of content you post on the App. By posting content, you grant Hustl a
        non-exclusive, worldwide, royalty-free license to use, display, and distribute your content
        in connection with the App.
      </Section>

      <Section title="6. Disclaimer of Warranties" colors={colors}>
        The App is provided "as is" without warranties of any kind. We do not guarantee the
        accuracy, completeness, or reliability of any content or information on the App.
      </Section>

      <Section title="7. Limitation of Liability" colors={colors}>
        To the maximum extent permitted by law, Hustl shall not be liable for any indirect,
        incidental, special, or consequential damages arising from your use of the App.
      </Section>

      <Section title="8. Changes to Terms" colors={colors}>
        We reserve the right to modify these Terms at any time. Continued use of the App after
        changes constitutes acceptance of the modified Terms.
      </Section>

      <Section title="9. Contact" colors={colors}>
        If you have questions about these Terms, please contact us through the Contact Us page in
        the App.
      </Section>
    </>
  );
}

function PrivacyContent({ colors }: Readonly<{ colors: ThemeColors }>) {
  return (
    <>
      <Section title="1. Information We Collect" colors={colors}>
        We collect information you provide directly:{"\n"}
        • Account information (name, email, phone number){"\n"}
        • Profile information (favorite sports, preferences){"\n"}
        • Content you create (games, teams, messages){"\n"}
        • Location data (when you search for nearby facilities)
      </Section>

      <Section title="2. How We Use Your Information" colors={colors}>
        We use your information to:{"\n"}
        • Provide and improve the App{"\n"}
        • Personalize your experience{"\n"}
        • Connect you with other users and sports facilities{"\n"}
        • Send notifications about games and teams{"\n"}
        • Respond to your inquiries
      </Section>

      <Section title="3. Information Sharing" colors={colors}>
        We may share your information:{"\n"}
        • With other users (profile info, games you join){"\n"}
        • With service providers who assist our operations{"\n"}
        • When required by law{"\n"}
        • To protect the rights and safety of users
      </Section>

      <Section title="4. Data Security" colors={colors}>
        We implement reasonable security measures to protect your information. However, no method
        of transmission over the Internet is completely secure.
      </Section>

      <Section title="5. Your Choices" colors={colors}>
        You can:{"\n"}
        • Update your account information at any time{"\n"}
        • Control notification preferences{"\n"}
        • Request deletion of your account{"\n"}
        • Opt out of certain data collection
      </Section>

      <Section title="6. Location Data" colors={colors}>
        We collect location data only when you use location-based features. You can disable
        location services in your device settings, though some features may not work properly.
      </Section>

      <Section title="7. Children's Privacy" colors={colors}>
        The App is not intended for children under 13. We do not knowingly collect information from
        children under 13.
      </Section>

      <Section title="8. Changes to Privacy Policy" colors={colors}>
        We may update this Privacy Policy periodically. We will notify you of significant changes
        through the App or by email.
      </Section>

      <Section title="9. Contact Us" colors={colors}>
        If you have questions about this Privacy Policy, please contact us through the Contact Us
        page in the App.
      </Section>
    </>
  );
}

function Section({
  title,
  children,
  colors,
}: Readonly<{
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
}>) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sectionText, { color: colors.textMuted }]}>{children}</Text>
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
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  lastUpdated: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
