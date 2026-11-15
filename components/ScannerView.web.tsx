import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Html5Qrcode } from 'html5-qrcode';
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
const READER_ELEMENT_ID = 'expresscart-html5-qrcode-reader';

function play880HzBeep() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch {
    // Ignore audio context errors if browser blocked audio
  }
}

export default function ScannerView({
  onScan,
  isScanning,
  isRollingSleep = false,
  onWakeScanner,
  cartTotalPrice = 0,
  cartItemCount = 0,
  manualPlaceholder = 'Enter barcode number',
}: ScannerViewProps) {
  const lastScannedTime = useRef<number>(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [flashActive, setFlashActive] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const triggerScan = useCallback(
    (data: string) => {
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
      setTimeout(() => {
        if (isMountedRef.current) setFlashActive(false);
      }, 220);
      setTimeout(() => {
        if (isMountedRef.current) setCooldownActive(false);
      }, DEBOUNCE_MS);

      play880HzBeep();
      onScanRef.current(cleaned);
    },
    [onWakeScanner]
  );

  const stopCamera = useCallback(async () => {
    const instance = scannerRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Ignore cleanup race conditions
    } finally {
      scannerRef.current = null;
      if (isMountedRef.current) {
        setCameraStarted(false);
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof document === 'undefined') return;
    const containerEl = document.getElementById(READER_ELEMENT_ID);
    if (!containerEl) return;

    await stopCamera();
    setCameraError(null);
    setNeedsUserGesture(false);

    try {
      const html5QrCode = new Html5Qrcode(READER_ELEMENT_ID);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 190, height: 68 },
          aspectRatio: 1.777,
        },
        (decodedText) => {
          triggerScan(decodedText);
        },
        () => {}
      );

      if (isMountedRef.current) {
        setCameraStarted(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isMountedRef.current) {
        setCameraStarted(false);
        setNeedsUserGesture(true);
        setCameraError(
          msg.includes('NotAllowedError') || msg.includes('Permission')
            ? 'Allow camera access to scan barcodes.'
            : 'Point camera at a barcode or enter the number below.'
        );
      }
    }
  }, [stopCamera, triggerScan]);

  const effectiveActiveScan = isScanning && !isRollingSleep;

  useEffect(() => {
    isMountedRef.current = true;
    if (effectiveActiveScan) {
      const timer = setTimeout(() => {
        startCamera();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [effectiveActiveScan, startCamera, stopCamera]);

  const handleManualSubmit = () => {
    if (!manualBarcode.trim()) return;
    triggerScan(manualBarcode.trim());
    setManualBarcode('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.readerContainer}>
        <div
          id={READER_ELEMENT_ID}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            display: effectiveActiveScan ? 'block' : 'none',
          }}
        />
      </View>

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
      ) : !cameraStarted || needsUserGesture ? (
        <View style={styles.overlayBox}>
          <TouchableOpacity
            style={styles.enableCameraBtn}
            activeOpacity={0.85}
            onPress={() => {
              play880HzBeep();
              startCamera();
            }}
          >
            <Camera
              size={ICON.size}
              color={COLORS.white}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={styles.enableCameraBtnText}>Enable camera</Text>
          </TouchableOpacity>
          <Text style={styles.overlaySub} numberOfLines={1}>
            {cameraError || 'Point camera at a barcode or enter it below'}
          </Text>
        </View>
      ) : (
        <View style={styles.liveHud} pointerEvents="none">
          <View style={[styles.reticle, flashActive && styles.reticleFlash]} />
          <Text style={styles.liveHudText} numberOfLines={1}>
            {cooldownActive ? 'Added to cart' : 'Center barcode in frame'}
          </Text>
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
  readerContainer: {
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
    bottom: 52,
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
