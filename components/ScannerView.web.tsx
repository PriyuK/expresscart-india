import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Plus, BatteryCharging, Eye } from 'lucide-react-native';
import { QUICK_TEST_ITEMS, STORE_CATALOG } from '../data/mockStoreCatalog';

export interface ScannerViewProps {
  onScan: (data: string) => void;
  isScanning: boolean;
  isRollingSleep?: boolean;
  onWakeScanner?: () => void;
  cartTotalPrice?: number;
  cartItemCount?: number;
}

const DEBOUNCE_MS = 1200;
const READER_ELEMENT_ID = 'expresscart-html5-qrcode-reader';

/**
 * Plays a synthetic 880Hz retail scanner beep using the Web Audio API
 * (iOS Safari compatible, zero external audio assets required).
 */
function play880HzBeep() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
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
  const [showAllDebug, setShowAllDebug] = useState(false);

  const triggerScan = useCallback(
    (data: string) => {
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
      }, 200);
      setTimeout(() => {
        if (isMountedRef.current) setCooldownActive(false);
      }, DEBOUNCE_MS);

      play880HzBeep();
      onScanRef.current(data);
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
          qrbox: { width: 220, height: 100 },
          aspectRatio: 1.777,
        },
        (decodedText) => {
          triggerScan(decodedText);
        },
        () => {
          // Per-frame decode miss
        }
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
            ? 'Camera access requires browser permission.'
            : 'Enable camera to scan physical barcodes, or tap any sample SKU below.'
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

  const debugItems = showAllDebug ? STORE_CATALOG : QUICK_TEST_ITEMS;

  return (
    <View style={[styles.container, flashActive && styles.containerFlashBorder]}>
      {/* HTML5-QRCode DOM Mount Target */}
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

      {/* STATE 1: OLED BLACK ECO SLEEP / CART ROLLING MODE */}
      {isRollingSleep ? (
        <TouchableOpacity
          style={styles.oledEcoOverlay}
          activeOpacity={0.9}
          onPress={() => onWakeScanner && onWakeScanner()}
        >
          <View style={styles.oledPillRow}>
            <View style={styles.oledBatteryPill}>
              <BatteryCharging size={12} color="#10B981" strokeWidth={2.2} />
              <Text style={styles.oledBatteryText}>
                OLED Eco Standby · ~5% Battery/Hr
              </Text>
            </View>
            <View style={styles.oledWatchPill}>
              <Eye size={11} color="#A1A1AA" strokeWidth={2} />
              <Text style={styles.oledWatchText}>1 FPS Basket Watch ON</Text>
            </View>
          </View>

          <Text style={styles.oledBigAmount}>
            ₹{cartTotalPrice} · {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.oledSubText}>
            Barcode AI sleeping while cart rolls. Tap screen or pass item over handlebar to wake for 5s scan.
          </Text>
        </TouchableOpacity>
      ) : !isScanning ? (
        <View style={styles.overlayBox}>
          <View style={styles.pausedBadge}>
            <Text style={styles.pausedBadgeText}>Standby Mode · Camera Paused</Text>
          </View>
          <Text style={styles.overlaySub}>
            Resume camera to scan barcodes, or select an item from the quick-scan strip below.
          </Text>
        </View>
      ) : !cameraStarted || needsUserGesture ? (
        <View style={styles.overlayBox}>
          <View style={styles.reticlePreview}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <TouchableOpacity
              style={styles.startCameraBtn}
              activeOpacity={0.8}
              onPress={() => {
                play880HzBeep();
                startCamera();
              }}
            >
              <Camera size={14} color="#09090B" strokeWidth={2} />
              <Text style={styles.startCameraBtnText}>Tap to Start Handlebar Camera</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.overlaySub}>
            {cameraError ||
              'Scan-to-Drop Tracking Active: Pass barcode over handlebar into basket.'}
          </Text>
        </View>
      ) : (
        <View style={styles.liveHud} pointerEvents="none">
          <View style={[styles.reticle, flashActive && styles.reticleFlash]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={[styles.scanLine, flashActive && styles.scanLineSuccess]} />
          </View>
          <View style={styles.liveHudPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: cooldownActive ? '#A1A1AA' : '#10B981' },
              ]}
            />
            <Text style={styles.liveHudText}>
              {cooldownActive
                ? 'Drop Verified · Visual Signature Matched'
                : 'Pass item over handlebar · 1.5s drop tracking'}
            </Text>
          </View>
        </View>
      )}

      {/* 200ms Bright Green Flash Overlay */}
      {flashActive && <View style={styles.greenFlashOverlay} pointerEvents="none" />}

      {/* Bottom Quick-Scan Bar */}
      <View style={styles.quickScanBar}>
        <View style={styles.quickScanHeader}>
          <Text style={styles.quickScanLabel}>
            QUICK SCAN SIMULATION (WORKS IN 0-SIGNAL DEAD ZONES)
          </Text>
          <TouchableOpacity
            onPress={() => setShowAllDebug((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickScanToggle}>
              {showAllDebug ? 'Show Featured' : `All ${STORE_CATALOG.length} SKUs`}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickScanScroll}
        >
          {debugItems.map((item) => (
            <TouchableOpacity
              key={item.barcode}
              style={styles.skuChip}
              onPress={() => triggerScan(item.barcode)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.skuChipAddIcon,
                  { borderLeftWidth: 3, borderLeftColor: item.packageColorHex },
                ]}
              >
                <Plus size={12} color="#FAFAFA" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.skuChipName} numberOfLines={1}>
                  {item.name.split(' ').slice(0, 2).join(' ')} · {item.unit}
                </Text>
                <View style={styles.skuPriceRow}>
                  <Text style={styles.skuChipPrice}>₹{item.storePrice}</Text>
                  {item.mrp > item.storePrice && (
                    <Text style={styles.skuChipMrp}>₹{item.mrp}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerFlashBorder: {
    borderColor: '#10B981',
  },
  readerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
  },
  oledEcoOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 68,
  },
  oledPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  oledBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#091912',
    borderWidth: 1,
    borderColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  oledBatteryText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  oledWatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  oledWatchText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
  },
  oledBigAmount: {
    color: '#FAFAFA',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  oledSubText: {
    color: '#71717A',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 16,
  },
  overlayBox: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 72,
  },
  reticlePreview: {
    width: 236,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  overlaySub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 17,
  },
  pausedBadge: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 8,
  },
  pausedBadgeText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '500',
  },
  startCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  startCameraBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  liveHud: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 72,
  },
  reticle: {
    width: 220,
    height: 86,
    borderRadius: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleFlash: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#E4E4E7',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
  scanLine: {
    width: '82%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  scanLineSuccess: {
    backgroundColor: '#10B981',
    height: 2,
  },
  liveHudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveHudText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '500',
  },
  greenFlashOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 4,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  quickScanBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121215',
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickScanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickScanLabel: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quickScanToggle: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '500',
  },
  quickScanScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  skuChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    gap: 8,
  },
  skuChipAddIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skuChipName: {
    color: '#F4F4F5',
    fontSize: 11,
    fontWeight: '500',
  },
  skuPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  skuChipPrice: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  skuChipMrp: {
    color: '#52525B',
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
});
