import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Phone,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Wallet,
  UserCheck,
  ArrowRight,
  Sparkles,
  LogOut,
  Plus,
} from 'lucide-react-native';
import { useCartStore } from '../store/useCartStore';

const PILOT_OTP = '4821';

export default function AuthScreen() {
  const router = useRouter();
  const {
    userProfile,
    loginWithOtp,
    logoutUser,
    linkAadhaarKyc,
    topUpWallet,
  } = useCartStore();

  const [name, setName] = useState(userProfile?.name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [aadhaarLast4, setAadhaarLast4] = useState(userProfile?.aadhaarLast4 || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [kycInput, setKycInput] = useState('');

  const handleRequestOtp = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!name.trim()) {
      setErrorMsg('Please enter your full name for GST billing & exit verification.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setErrorMsg(null);
    setOtpSent(true);
  };

  const handleVerifyOtp = (overrideOtp?: string) => {
    const code = (overrideOtp ?? otpInput).trim();
    if (code.length !== 4) {
      setErrorMsg('Please enter the 4-digit OTP sent to your mobile number.');
      return;
    }
    setErrorMsg(null);
    loginWithOtp(name, phone, aadhaarLast4 || undefined);
    router.replace('/shop');
  };

  const handleQuickPilotLogin = () => {
    setName('Aarav Sharma');
    setPhone('9820411290');
    setAadhaarLast4('8492');
    loginWithOtp('Aarav Sharma', '9820411290', '8492');
    router.replace('/shop');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {userProfile?.isVerified ? (
          /* LOGGED-IN VERIFIED SHOPPER PROFILE & WALLET VIEW */
          <View>
            <View style={styles.verifiedCard}>
              <View style={styles.verifiedHeaderRow}>
                <View style={styles.avatarCircle}>
                  <UserCheck size={20} color="#FFFFFF" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameBadgeRow}>
                    <Text style={styles.profileName}>{userProfile.name}</Text>
                    <View style={styles.verifiedPill}>
                      <CheckCircle2 size={11} color="#059669" strokeWidth={2.2} />
                      <Text style={styles.verifiedPillText}>OTP Verified</Text>
                    </View>
                  </View>
                  <Text style={styles.profilePhone}>+91 {userProfile.phone}</Text>
                </View>
              </View>

              {/* Trust Score & KYC Status */}
              <View style={styles.statsStrip}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>TRUST SCORE</Text>
                  <Text style={styles.statValue}>{userProfile.trustScore}/100</Text>
                  <Text style={styles.statSub}>Express Green Lane Eligible</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>AADHAAR / KYC</Text>
                  <Text style={styles.statValue}>
                    {userProfile.aadhaarLast4
                      ? `XXXX-${userProfile.aadhaarLast4}`
                      : 'Optional'}
                  </Text>
                  <Text style={styles.statSub}>
                    {userProfile.aadhaarLast4 ? 'Linked for High-Cart Limit' : 'Phone OTP Active'}
                  </Text>
                </View>
              </View>

              {!userProfile.aadhaarLast4 && (
                <View style={styles.kycOptionalBox}>
                  <Text style={styles.kycTitle}>
                    Optional: Link Aadhaar Last 4 Digits (Boosts Trust Score)
                  </Text>
                  <View style={styles.kycRow}>
                    <TextInput
                      style={styles.kycInput}
                      value={kycInput}
                      onChangeText={(t) => setKycInput(t.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Last 4 digits (e.g. 8492)"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={styles.kycBtn}
                      onPress={() => {
                        if (kycInput.length === 4) {
                          linkAadhaarKyc(kycInput);
                          setKycInput('');
                        }
                      }}
                    >
                      <Text style={styles.kycBtnText}>Link KYC</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* ExpressCart In-Store Wallet Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <View style={styles.walletIconBox}>
                  <Wallet size={18} color="#09090B" strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletTitle}>ExpressCart Store Wallet</Text>
                  <Text style={styles.walletSub}>
                    1-tap instant self-checkout without banking delays
                  </Text>
                </View>
                <Text style={styles.walletBalanceText}>₹{userProfile.walletBalance}</Text>
              </View>

              <View style={styles.topUpRow}>
                {[500, 1000, 2000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.topUpChip}
                    onPress={() => topUpWallet(amt)}
                    activeOpacity={0.75}
                  >
                    <Plus size={12} color="#09090B" strokeWidth={2.2} />
                    <Text style={styles.topUpChipText}>Add ₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.continueShopBtn}
              onPress={() => router.replace('/shop')}
              activeOpacity={0.85}
            >
              <Text style={styles.continueShopBtnText}>Proceed to Cart Scanner</Text>
              <ArrowRight size={16} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={logoutUser}
              activeOpacity={0.75}
            >
              <LogOut size={14} color="#DC2626" strokeWidth={1.8} />
              <Text style={styles.logoutBtnText}>Sign Out / Switch Mobile Number</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* SIGN-UP / MOBILE OTP VERIFICATION FLOW */
          <View style={styles.authCard}>
            <View style={styles.authBadge}>
              <ShieldCheck size={14} color="#059669" strokeWidth={2} />
              <Text style={styles.authBadgeText}>MANDATORY SHOPPER VERIFICATION</Text>
            </View>

            <Text style={styles.authTitle}>Verify your mobile to start scanning</Text>
            <Text style={styles.authSub}>
              To prevent cart misuse and enable instant UPI / Wallet self-checkout, every shopper is verified via mobile OTP.
            </Text>

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name (for GST Bill & Exit Pass)</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Aarav Sharma"
                placeholderTextColor="#A1A1AA"
                editable={!otpSent}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mobile Number (+91 India)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryPrefix}>
                  <Phone size={13} color="#52525B" strokeWidth={1.8} />
                  <Text style={styles.countryPrefixText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#A1A1AA"
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!otpSent}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Aadhaar Last 4 Digits (Optional — Future KYC Readiness)
              </Text>
              <TextInput
                style={styles.textInput}
                value={aadhaarLast4}
                onChangeText={(t) => setAadhaarLast4(t.replace(/\D/g, '').slice(0, 4))}
                placeholder="Optional 4 digits (unlocks 98% Trust Score)"
                placeholderTextColor="#A1A1AA"
                keyboardType="numeric"
                maxLength={4}
                editable={!otpSent}
              />
            </View>

            {!otpSent ? (
              <TouchableOpacity
                style={styles.primaryAuthBtn}
                onPress={handleRequestOtp}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryAuthBtnText}>Send 4-Digit Verification OTP</Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            ) : (
              <View style={styles.otpSection}>
                <View style={styles.otpHeaderRow}>
                  <Lock size={14} color="#09090B" strokeWidth={2} />
                  <Text style={styles.otpTitle}>
                    Enter OTP sent to +91 {phone}
                  </Text>
                </View>
                <Text style={styles.otpHint}>
                  Pilot Demo OTP is <Text style={{ fontWeight: '700', color: '#09090B' }}>{PILOT_OTP}</Text> (or any 4 digits)
                </Text>

                <View style={styles.otpInputRow}>
                  <TextInput
                    style={styles.otpInput}
                    value={otpInput}
                    onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4821"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <TouchableOpacity
                    style={styles.verifyOtpBtn}
                    onPress={() => handleVerifyOtp()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.verifyOtpBtnText}>Verify & Start</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.autoFillOtpLink}
                  onPress={() => {
                    setOtpInput(PILOT_OTP);
                    handleVerifyOtp(PILOT_OTP);
                  }}
                >
                  <Text style={styles.autoFillOtpText}>
                    Auto-fill OTP ({PILOT_OTP}) & Continue →
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Development 1-Tap Pilot Bypass */}
            <View style={styles.devBypassBox}>
              <TouchableOpacity
                style={styles.devBypassBtn}
                onPress={handleQuickPilotLogin}
                activeOpacity={0.8}
              >
                <Sparkles size={14} color="#09090B" strokeWidth={1.8} />
                <Text style={styles.devBypassText}>
                  1-Tap Demo Login (Aarav Sharma · +91 9820411290 · ₹1,500 Wallet)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 44,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  authBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  authTitle: {
    color: '#09090B',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  authSub: {
    color: '#52525B',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#27272A',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: '#09090B',
    fontSize: 14,
    fontWeight: '500',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  countryPrefixText: {
    color: '#18181B',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryAuthBtn: {
    backgroundColor: '#09090B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryAuthBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  otpSection: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  otpTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
  },
  otpHint: {
    color: '#71717A',
    fontSize: 12,
    marginBottom: 10,
  },
  otpInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#09090B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#09090B',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
  },
  verifyOtpBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyOtpBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  autoFillOtpLink: {
    marginTop: 10,
    paddingVertical: 4,
  },
  autoFillOtpText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  devBypassBox: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  devBypassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  devBypassText: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
  },
  // Profile & Wallet Styles
  verifiedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  verifiedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  profileName: {
    color: '#09090B',
    fontSize: 17,
    fontWeight: '600',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  verifiedPillText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  profilePhone: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 2,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  statBox: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E4E4E7',
    marginHorizontal: 14,
  },
  statLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statValue: {
    color: '#09090B',
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 2,
  },
  statSub: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '500',
  },
  kycOptionalBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  kycTitle: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  kycRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kycInput: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#09090B',
  },
  kycBtn: {
    backgroundColor: '#18181B',
    borderRadius: 9,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  kycBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  walletIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTitle: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '600',
  },
  walletSub: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 1,
  },
  walletBalanceText: {
    color: '#09090B',
    fontSize: 22,
    fontWeight: '700',
  },
  topUpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  topUpChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: 9,
    paddingVertical: 9,
  },
  topUpChipText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  continueShopBtn: {
    backgroundColor: '#09090B',
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  continueShopBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
});

