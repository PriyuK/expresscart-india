import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
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

export default function ScannerView({
  onScan,
  isScanning,
  isRollingSleep = false,
  onWakeScanner,
  cartTotalPrice = 0,
  cartItemCount = 0,
}: ScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScannedTime = useRef<number>(0);
  const [flashActive, setFlashActive] = useState(false);
  const [showAllDebug, setShowAllDebug] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);

  const triggerScan = (data: string) => {
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
    setTimeout(() => setFlashActive(false), 200);
    setTimeout(() => setCooldownActive(false), DEBOUNCE_MS);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScan(data);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!isScanning || isRollingSleep || !result?.data) return;
    triggerScan(result.data);
  };

  const debugItems = showAllDebug ? STORE_CATALOG : QUICK_TEST_ITEMS;

  return (
    <View style={styles.container}>
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
      ) : !permission ? (
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackTitle}>Initializing Scanner...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.fallbackBox}>
          <View style={styles.cameraIconBox}>
            <Camera size={20} color="#FAFAFA" strokeWidth={1.8} />
          </View>
          <Text style={styles.fallbackTitle}>Camera Access Required</Text>
          <Text style={styles.fallbackSub}>
            Allow camera access to scan EAN-13 product barcodes and exit pass QR codes.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      ) : !isScanning ? (
        <View style={styles.fallbackBox}>
          <View style={styles.pausedBadge}>
            <Text style={styles.pausedBadgeText}>Standby Mode · Camera Paused</Text>
          </View>
          <Text style={styles.fallbackSub}>
            Resume the scanner when ready, or tap a sample SKU below.
          </Text>
        </View>
      ) : (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'qr'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      )}

      {/* Corner-Bracket Viewfinder Reticle */}
      {isScanning && !isRollingSleep && permission?.granted && (
        <View style={styles.reticleWrapper} pointerEvents="none">
          <View style={[styles.reticle, flashActive && styles.reticleFlash]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={[styles.scanLine, flashActive && styles.scanLineSuccess]} />
          </View>
          <View style={styles.reticleStatusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: cooldownActive ? '#A1A1AA' : '#10B981' },
              ]}
            />
            <Text style={styles.reticleHint}>
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
    justifyContent: 'center',
  },
  oledEcoOverlay: {
    flex: 1,
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
  fallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 74,
    backgroundColor: '#09090B',
  },
  cameraIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  fallbackTitle: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  fallbackSub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    maxWidth: 320,
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
  permissionBtn: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#09090B',
    fontWeight: '600',
    fontSize: 12,
  },
  reticleWrapper: {
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
    width: 224,
    height: 92,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  reticleFlash: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
  reticleStatusPill: {
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
  reticleHint: {
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
