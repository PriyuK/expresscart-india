import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Camera, ScanLine } from 'lucide-react-native';
import {
  COLORS,
  FONTS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  ICON,
  TOUCH_TARGET,
} from '../theme/tokens';

export interface ScannerViewProps {
  onScan: (data: string) => void;
  isScanning: boolean;
  isRollingSleep?: boolean;
  onWakeScanner?: () => void;
  cartTotalPrice?: number;
  cartItemCount?: number;
  manualPlaceholder?: string;
}

const DEBOUNCE_MS = 1000;

export default function ScannerView({
  onScan,
  isScanning,
  isRollingSleep = false,
  onWakeScanner,
  cartTotalPrice = 0,
  cartItemCount = 0,
  manualPlaceholder = 'Enter barcode number',
}: ScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScannedTime = useRef<number>(0);
  const [flashActive, setFlashActive] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const triggerScan = (data: string) => {
    const cleaned = data.trim();
    if (!cleaned) return;
    const now = Date.now();
    if (now - lastScannedTime.current < DEBOUNCE_MS) {
      return;
    }
    lastScannedTime.current = now;

    if (onWakeScanner) {
      onWakeScanner();
    }

    setFlashActive(true);
    setCooldownActive(true);
    setTimeout(() => setFlashActive(false), 220);
    setTimeout(() => setCooldownActive(false), DEBOUNCE_MS);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScan(cleaned);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!isScanning || isRollingSleep || !result?.data) return;
    triggerScan(result.data);
  };

  const handleManualSubmit = () => {
    if (!manualBarcode.trim()) return;
    triggerScan(manualBarcode.trim());
    setManualBarcode('');
  };

  return (
    <View style={styles.container}>
      {isRollingSleep ? (
        <TouchableOpacity
          style={styles.standbyOverlay}
          activeOpacity={0.9}
          onPress={() => onWakeScanner && onWakeScanner()}
        >
          <Text style={styles.standbyPrice}>
            ₹{cartTotalPrice} · {cartItemCount}{' '}
            {cartItemCount === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.standbySub}>Tap to resume scanning</Text>
        </TouchableOpacity>
      ) : !permission ? (
        <View style={styles.overlayBox}>
          <Text style={styles.overlaySub}>Starting camera...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.overlayBox}>
          <TouchableOpacity
            style={styles.enableCameraBtn}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Camera
              size={ICON.size}
              color={COLORS.white}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={styles.enableCameraBtnText}>Enable camera</Text>
          </TouchableOpacity>
          <Text style={styles.overlaySub}>
            Allow camera access to scan barcodes
          </Text>
        </View>
      ) : !isScanning ? (
        <View style={styles.overlayBox}>
          <ScanLine
            size={ICON.size}
            color={COLORS.textSecondary}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={styles.overlaySub}>
            Camera paused · Enter barcode number below
          </Text>
        </View>
      ) : (
        <View style={styles.cameraArea}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'qr'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.liveHud} pointerEvents="none">
            <View
              style={[styles.reticle, flashActive && styles.reticleFlash]}
            />
            <Text style={styles.liveHudText} numberOfLines={1}>
              {cooldownActive ? 'Added to cart' : 'Center barcode in frame'}
            </Text>
          </View>
        </View>
      )}

      {/* Manual Barcode Input Bar */}
      <View style={styles.manualEntryBar}>
        <TextInput
          style={styles.manualInput}
          value={manualBarcode}
          onChangeText={setManualBarcode}
          placeholder={manualPlaceholder}
          placeholderTextColor={COLORS.textSecondary}
          onSubmitEditing={handleManualSubmit}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[
            styles.manualSubmitBtn,
            !manualBarcode.trim() && styles.manualSubmitBtnDisabled,
          ]}
          disabled={!manualBarcode.trim()}
          onPress={handleManualSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.manualSubmitText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    position: 'relative',
    overflow: 'hidden',
  },
  cameraArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 52,
    left: 0,
    backgroundColor: COLORS.textPrimary,
  },
  standbyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 52,
    left: 0,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.page,
  },
  standbyPrice: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  standbySub: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  overlayBox: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 52,
    left: 0,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.page,
    gap: SPACING.sm,
  },
  enableCameraBtn: {
    minHeight: TOUCH_TARGET.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.page,
    borderRadius: RADIUS.card,
  },
  enableCameraBtnText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.white,
  },
  overlaySub: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  liveHud: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  reticle: {
    width: 196,
    height: 64,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  reticleFlash: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(11, 107, 79, 0.2)',
  },
  liveHudText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.white,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  manualEntryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: SPACING.page,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  manualInput: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  manualSubmitBtn: {
    height: 38,
    paddingHorizontal: SPACING.page,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSubmitBtnDisabled: {
    opacity: 0.4,
  },
  manualSubmitText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.white,
  },
});
