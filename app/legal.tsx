import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, ShieldCheck, FileText } from 'lucide-react-native';
import { useCartStore } from '../store/useCartStore';
import {
  ThemeColors,
  getThemeColors,
  FONTS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  ICON,
  TOUCH_TARGET,
} from '../theme/tokens';

interface LegalSection {
  title: string;
  body: string;
}

const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Scope & Service Operator',
    body: 'ExpressCart India is operated by SilvyOS for participating Indian retail partner stores (including DMart Express and Reliance Smart Point pilot locations). By signing in or scanning products in-store, you agree to these Terms & Conditions.',
  },
  {
    title: '2. Scan-As-You-Shop Rule',
    body: 'Every physical item placed into your shopping basket, bag, or family-linked cart must be scanned in the app before proceeding to checkout. Unscanned items or mismatched product barcodes are not permitted through the express exit lane.',
  },
  {
    title: '3. Exit Gate Spot-Check & Weight Verification',
    body: 'Upon payment, you receive a cryptographically signed QR exit pass. Store exit staff may conduct a brief verification consisting of a random 2 to 5 item spot-check and basket weight verification (within ±75 g packaging tolerance) before opening the express gate.',
  },
  {
    title: '4. Assisted Counter Checkout & Physical Bill Clearance',
    body: 'Participating stores reserve the right to route any transaction to a manned billing counter via a Counter Handoff QR. When an order is billed or re-billed at a physical POS counter, the digital exit pass QR is locked/closed to prevent reuse, and any duplicate in-app wallet charge is refunded.',
  },
  {
    title: '5. Anti-Theft & Misuse Policy',
    body: 'Deliberate barcode swapping, concealing unscanned merchandise, tampering with weight/sensor checks, or attempting to reuse an expired, un-scanned, or counter-cleared QR pass violates store rules and applicable provisions of Indian law (including the Bharatiya Nyaya Sanhita, 2023) and will result in suspension of self-checkout access.',
  },
  {
    title: '6. Pricing, GST, Offers & Returns',
    body: 'All item prices are displayed in INR inclusive of applicable GST. Store promotions (such as Buy 1 Get 1 and multi-buy discounts) apply automatically at checkout. Exchanges, refunds, and billing disputes are handled at the store customer service desk upon presenting your digital or physical POS bill.',
  },
];

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. DPDP Act 2023 & IT Act 2000 Compliance',
    body: 'SilvyOS processes customer information strictly in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000. We collect only the minimum personal data needed for in-store billing, fraud prevention, and exit gate verification.',
  },
  {
    title: '2. Personal Data Collected',
    body: 'We process your name, 10-digit Indian mobile number for OTP login, optional last 4 digits of your Aadhaar for KYC badge verification (full 12-digit Aadhaar numbers and biometrics are never collected), store selection, and itemized digital/POS receipt history.',
  },
  {
    title: '3. Camera & Sensor Privacy (On-Device Only)',
    body: 'Camera frames captured while scanning EAN-13/EAN-8 barcodes, QR exit passes, or running real-time basket-watch checks are processed strictly on your device in memory. No video streams, still photos, facial geometry, or audio are ever recorded or uploaded to any server.',
  },
  {
    title: '4. Automated Basket Security Checks',
    body: 'Order consistency indicators and internal eligibility checks are used exclusively to determine whether a basket qualifies for the express exit lane or requires assisted counter billing. These internal checks are never sold or shared with external advertisers or credit bureaus.',
  },
  {
    title: '5. UPI & Payment Data Security',
    body: 'UPI payments are initiated via NPCI-compliant intent handoffs to your installed UPI app (Google Pay, PhonePe, or Paytm) or via prepaid Store Wallet balance. ExpressCart never accesses, transmits, or stores your UPI PIN, bank login, or full card CVV.',
  },
  {
    title: '6. Your Rights & Grievance Redressal',
    body: 'Under the DPDP Act 2023, you have the right to access, correct, or request deletion of your personal data and withdraw consent by discontinuing use or contacting our Grievance Officer: Privacy & Grievance Desk, SilvyOS (ExpressCart India) · privacy@silvyos.in · Response within 48 hours.',
  },
];

export default function LegalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { isDarkMode, legalAccepted, legalAcceptedAt, setLegalAccepted } =
    useCartStore();

  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(
    params.tab === 'privacy' ? 'privacy' : 'terms'
  );

  useEffect(() => {
    if (params.tab === 'privacy') {
      setActiveTab('privacy');
    } else if (params.tab === 'terms') {
      setActiveTab('terms');
    }
  }, [params.tab]);

  const sections = activeTab === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  const handleConfirmConsent = () => {
    setLegalAccepted(true);
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topTabsWrap}>
        <View style={styles.segmentedTabs}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'terms' && styles.tabBtnActive]}
            onPress={() => setActiveTab('terms')}
            activeOpacity={0.8}
          >
            <FileText
              size={16}
              color={
                activeTab === 'terms' ? COLORS.accent : COLORS.textSecondary
              }
              strokeWidth={ICON.strokeWidth}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'terms' && styles.tabBtnTextActive,
              ]}
            >
              Terms & Conditions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'privacy' && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab('privacy')}
            activeOpacity={0.8}
          >
            <ShieldCheck
              size={16}
              color={
                activeTab === 'privacy' ? COLORS.accent : COLORS.textSecondary
              }
              strokeWidth={ICON.strokeWidth}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'privacy' && styles.tabBtnTextActive,
              ]}
            >
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introBlock}>
          <Text style={styles.pageTitle}>
            {activeTab === 'terms'
              ? 'Terms & Conditions'
              : 'Privacy Policy (India)'}
          </Text>
          <Text style={styles.metaCaption}>
            Effective 15 Nov 2026 · ExpressCart India (SilvyOS) · Governed by
            laws of India
          </Text>
        </View>

        <View style={styles.cardsStack}>
          {sections.map((section) => (
            <View key={section.title} style={styles.surfaceCard}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footerBar}>
        <View style={styles.statusRow}>
          <View style={styles.statusTag}>
            <Check
              size={14}
              color={COLORS.discountText}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={styles.statusTagText}>
              {legalAccepted
                ? `Accepted${
                    legalAcceptedAt
                      ? ` · ${new Date(legalAcceptedAt).toLocaleDateString(
                          'en-IN'
                        )}`
                      : ''
                  }`
                : 'Consent required before checkout'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleConfirmConsent}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryButtonLabel}>
            {legalAccepted ? 'I agree · Done' : 'Accept Terms & Privacy Policy'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    topTabsWrap: {
      paddingHorizontal: SPACING.page,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
      backgroundColor: COLORS.background,
    },
    segmentedTabs: {
      flexDirection: 'row',
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.xs,
      gap: SPACING.xs,
    },
    tabBtn: {
      flex: 1,
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      borderRadius: SPACING.sm,
      paddingHorizontal: SPACING.sm,
    },
    tabBtnActive: {
      backgroundColor: COLORS.background,
    },
    tabBtnText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
    },
    tabBtnTextActive: {
      color: COLORS.textPrimary,
      fontWeight: TYPOGRAPHY.weightSemibold,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: SPACING.page,
      paddingTop: SPACING.page,
      paddingBottom: SPACING.xl,
    },
    introBlock: {
      marginBottom: SPACING.page,
      gap: SPACING.xs,
    },
    pageTitle: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.titleSize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.textPrimary,
      letterSpacing: -0.3,
    },
    metaCaption: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
    },
    cardsStack: {
      gap: SPACING.md,
    },
    surfaceCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.page,
      gap: SPACING.xs,
    },
    sectionTitle: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.textPrimary,
    },
    sectionBody: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      lineHeight: 22,
    },
    footerBar: {
      backgroundColor: COLORS.background,
      borderTopWidth: 1,
      borderTopColor: COLORS.divider,
      paddingHorizontal: SPACING.page,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.page,
      gap: SPACING.sm,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      backgroundColor: COLORS.discountBg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
    },
    statusTagText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightMedium,
      color: COLORS.discountText,
    },
    primaryButton: {
      height: TOUCH_TARGET.primaryButtonHeight,
      backgroundColor: COLORS.accent,
      borderRadius: RADIUS.button,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    primaryButtonLabel: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.white,
    },
  });
