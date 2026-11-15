import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, ChevronRight, LogOut, Check } from 'lucide-react-native';
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

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const {
    isDarkMode,
    legalAccepted,
    setLegalAccepted,
    userProfile,
    activeStore,
    loginWithOtp,
    loginAsStaff,
    logoutUser,
    topUpWallet,
  } = useCartStore();

  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [authTab, setAuthTab] = useState<'shopper' | 'staff'>(
    params.mode === 'staff' ? 'staff' : 'shopper'
  );
  const [name, setName] = useState(userProfile?.name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [employeeId, setEmployeeId] = useState(
    userProfile?.employeeId || ''
  );
  const [storePasscode, setStorePasscode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestOtp = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a 10-digit mobile number.');
      return;
    }
    if (authTab === 'staff') {
      if (!employeeId.trim()) {
        setErrorMsg('Please enter your employee ID (e.g. EMP-101).');
        return;
      }
      if (!storePasscode.trim()) {
        setErrorMsg('Please enter the 4-digit store passcode.');
        return;
      }
    }
    if (!legalAccepted) {
      setErrorMsg(
        'Please accept the Terms & Conditions and Privacy Policy to continue.'
      );
      return;
    }
    setErrorMsg(null);
    setOtpSent(true);
  };

  const handleVerifyOtp = async () => {
    const code = otpInput.trim();
    if (code.length !== 4) {
      setErrorMsg('Please enter the 4-digit code.');
      return;
    }
    setErrorMsg(null);

    if (authTab === 'staff') {
      setIsSubmitting(true);
      const res = await loginAsStaff({
        name,
        phone,
        employeeId,
        storePasscode,
        assignedStore: activeStore,
      });
      setIsSubmitting(false);
      if (!res.ok) {
        setErrorMsg(res.error || 'Staff sign in failed.');
        return;
      }
      router.replace('/guard');
      return;
    }

    loginWithOtp(name, phone);
    router.replace('/shop');
  };

  const userInitial =
    userProfile?.name ? userProfile.name.trim().charAt(0).toUpperCase() : 'U';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {userProfile?.isVerified ? (
          userProfile.role === 'STORE_STAFF' ? (
            /* SIGNED-IN STORE STAFF */
            <View>
              <View style={styles.profileHeader}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarInitialText}>{userInitial}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {userProfile.name}
                  </Text>
                  <Text style={styles.profileMeta} numberOfLines={1}>
                    Staff {userProfile.employeeId} · +91 {userProfile.phone}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/guard')}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonLabel}>
                  Open staff terminal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signOutRow}
                onPress={logoutUser}
                activeOpacity={0.7}
              >
                <LogOut
                  size={ICON.size}
                  color={COLORS.danger}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* SIGNED-IN SHOPPER */
            <View>
              <View style={styles.profileHeader}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarInitialText}>{userInitial}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {userProfile.name}
                  </Text>
                  <Text style={styles.profileMeta}>+91 {userProfile.phone}</Text>
                </View>
              </View>

              {/* Store Wallet Surface Card */}
              <View style={styles.walletCard}>
                <Text style={styles.walletCaption}>Store wallet balance</Text>
                <Text style={styles.walletBalance}>
                  ₹{userProfile.walletBalance}
                </Text>

                <View style={styles.topUpRow}>
                  {[500, 1000, 2000].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={styles.topUpChip}
                      onPress={() => topUpWallet(amt)}
                      activeOpacity={0.75}
                    >
                      <Plus
                        size={14}
                        color={COLORS.accent}
                        strokeWidth={ICON.strokeWidth}
                      />
                      <Text style={styles.topUpChipText}>₹{amt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/shop')}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonLabel}>Start shopping</Text>
              </TouchableOpacity>

              <View style={styles.plainListSection}>
                <TouchableOpacity
                  style={styles.plainListRow}
                  onPress={() => router.push('/orders')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.plainListLabel}>Passes & receipts</Text>
                  <ChevronRight
                    size={ICON.size}
                    color={COLORS.textSecondary}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.plainListRow, styles.plainListDivider]}
                  onPress={() => router.push('/legal')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.plainListLabel}>
                    Terms & privacy policy
                  </Text>
                  <ChevronRight
                    size={ICON.size}
                    color={COLORS.textSecondary}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.plainListRow, styles.plainListDivider]}
                  onPress={logoutUser}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.plainListLabel, { color: COLORS.danger }]}>
                    Sign out
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        ) : (
          /* SIGN-IN FLOW */
          <View>
            <View style={styles.introBlock}>
              <Text style={styles.pageTitle}>
                {authTab === 'staff' ? 'Staff sign in' : 'Sign in'}
              </Text>
              <Text style={styles.pageBody}>
                {authTab === 'staff'
                  ? 'Enter your employee ID and store passcode.'
                  : 'Enter your mobile number to start scanning items.'}
              </Text>
            </View>

            <View style={styles.formSection}>
              {authTab === 'staff' && (
                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Employee ID</Text>
                    <TextInput
                      style={styles.textInput}
                      value={employeeId}
                      onChangeText={(t) => setEmployeeId(t.toUpperCase())}
                      placeholder="EMP-101"
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="characters"
                      editable={!otpSent}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Passcode</Text>
                    <TextInput
                      style={styles.textInput}
                      value={storePasscode}
                      onChangeText={(t) =>
                        setStorePasscode(t.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="1234"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="numeric"
                      secureTextEntry
                      maxLength={4}
                      editable={!otpSent}
                    />
                  </View>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Your name</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Aarav Sharma"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!otpSent}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile number</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryPrefix}>
                    <Text style={styles.countryPrefixText}>+91</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={phone}
                    onChangeText={(t) =>
                      setPhone(t.replace(/\D/g, '').slice(0, 10))
                    }
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!otpSent}
                  />
                </View>
              </View>

              {otpSent && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    4-digit code sent to +91 {phone}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={otpInput}
                    onChangeText={(t) =>
                      setOtpInput(t.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="Enter any 4 digits (e.g. 4821)"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              )}

              <View style={styles.consentRow}>
                <TouchableOpacity
                  style={[
                    styles.consentCheckbox,
                    legalAccepted && styles.consentCheckboxChecked,
                  ]}
                  onPress={() => {
                    setLegalAccepted(!legalAccepted);
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: legalAccepted }}
                >
                  {legalAccepted && (
                    <Check
                      size={14}
                      color={COLORS.white}
                      strokeWidth={ICON.strokeWidth}
                    />
                  )}
                </TouchableOpacity>

                <View style={styles.consentTextWrap}>
                  <Text style={styles.consentText}>
                    I agree to the{' '}
                    <Text
                      style={styles.consentLink}
                      onPress={() => router.push('/legal?tab=terms')}
                    >
                      Terms & Conditions
                    </Text>{' '}
                    and{' '}
                    <Text
                      style={styles.consentLink}
                      onPress={() => router.push('/legal?tab=privacy')}
                    >
                      Privacy Policy
                    </Text>{' '}
                    (incl. exit gate verification).
                  </Text>
                </View>
              </View>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              <TouchableOpacity
                style={styles.primaryButton}
                disabled={isSubmitting}
                onPress={otpSent ? handleVerifyOtp : handleRequestOtp}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonLabel}>
                  {!otpSent
                    ? 'Continue'
                    : isSubmitting
                    ? 'Signing in...'
                    : 'Verify & start shopping'}
                </Text>
              </TouchableOpacity>

              {otpSent && (
                <TouchableOpacity
                  style={styles.switchRoleLink}
                  onPress={() => {
                    setOtpSent(false);
                    setOtpInput('');
                  }}
                >
                  <Text style={styles.switchRoleText}>
                    Change mobile number
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.switchRoleLink}
              onPress={() => {
                setAuthTab(authTab === 'shopper' ? 'staff' : 'shopper');
                setOtpSent(false);
                setErrorMsg(null);
              }}
            >
              <Text style={styles.switchRoleText}>
                {authTab === 'shopper'
                  ? 'Store staff? Sign in here'
                  : 'Back to customer sign in'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.page,
    paddingTop: SPACING.page,
    paddingBottom: SPACING.xl,
  },
  introBlock: {
    marginBottom: SPACING.section,
  },
  pageTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
  },
  pageBody: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  formSection: {
    gap: SPACING.page,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  textInput: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.page,
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  countryPrefix: {
    height: 48,
    paddingHorizontal: SPACING.page,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryPrefixText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  errorText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.danger,
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
  switchRoleLink: {
    minHeight: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  switchRoleText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.accent,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.page,
    marginBottom: SPACING.section,
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.discountBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.accent,
  },
  profileName: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  profileMeta: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  walletCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.page,
    marginBottom: SPACING.section,
  },
  walletCaption: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  walletBalance: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.page,
  },
  topUpRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  topUpChip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.discountBg,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.card,
  },
  topUpChipText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.discountText,
  },
  plainListSection: {
    marginTop: SPACING.section,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.divider,
  },
  plainListRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  plainListDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  plainListLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  signOutRow: {
    minHeight: TOUCH_TARGET.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.section,
  },
  signOutText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.danger,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  consentCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentCheckboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  consentTextWrap: {
    flex: 1,
  },
  consentText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  consentLink: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.weightSemibold,
  },
});
