import { Platform, Share } from 'react-native';
import { ExitPassPayload } from '../store/useCartStore';
import { formatCleanStoreName } from '../theme/tokens';

export const STORE_GSTIN = '27AABCU9603R1ZM';

export interface GstBreakdown {
  gstin: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  grandTotal: number;
}

export function computeGstBreakdown(order: ExitPassPayload): GstBreakdown {
  const grandTotal = Math.max(0, Number(order.totalPrice || 0));
  const taxableValue = Number((grandTotal / 1.09).toFixed(2));
  const totalGst = Number((grandTotal - taxableValue).toFixed(2));
  const cgst = Number((totalGst / 2).toFixed(2));
  const sgst = Number((totalGst - cgst).toFixed(2));
  return {
    gstin: STORE_GSTIN,
    taxableValue,
    cgst,
    sgst,
    totalGst,
    grandTotal,
  };
}

function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildGstInvoiceText(order: ExitPassPayload): string {
  const gst = computeGstBreakdown(order);
  const storeLabel = formatCleanStoreName(undefined, order.storeName);
  const items = order.allPaidItems || order.auditItems || [];
  const itemLines = items
    .map(
      (i) =>
        `${i.name} x${i.quantity} @ ₹${i.storePrice} = ₹${
          i.storePrice * i.quantity
        }`
    )
    .join('\n');

  const statusText =
    order.verificationMode === 'PHYSICAL_COUNTER_BILL'
      ? `Cleared via Physical Counter Bill (${order.physicalBillRef || 'POS'})`
      : order.exitVerified
      ? 'Verified at Exit Gate'
      : order.requiresCounterCheckout
      ? 'Counter Handoff Pending'
      : 'Active Express Exit Pass';

  return [
    'EXPRESSCART INDIA · TAX INVOICE',
    `Store: ${storeLabel}`,
    `GSTIN: ${gst.gstin}`,
    `Order ID: ${order.orderId}`,
    `Date: ${new Date(order.timestamp).toLocaleString('en-IN')}`,
    `Customer: ${order.customerName || 'Shopper'}`,
    `Payment: ${order.paymentMethod || 'UPI Instant'} (${
      order.physicalBillRef || order.upiRef
    })`,
    `Status: ${statusText}`,
    '--------------------------------',
    itemLines || 'No items',
    '--------------------------------',
    `Taxable Value: ₹${gst.taxableValue.toFixed(2)}`,
    `CGST (4.5%):   ₹${gst.cgst.toFixed(2)}`,
    `SGST (4.5%):   ₹${gst.sgst.toFixed(2)}`,
    order.totalSavings > 0 ? `Total Savings: ₹${order.totalSavings}` : null,
    `Grand Total:   ₹${gst.grandTotal.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPrintableGstHtml(order: ExitPassPayload): string {
  const gst = computeGstBreakdown(order);
  const storeLabel = escapeHtml(
    formatCleanStoreName(undefined, order.storeName)
  );
  const items = order.allPaidItems || order.auditItems || [];
  const rowsHtml = items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">&#8377;${item.storePrice}</td>
        <td style="text-align:right;">&#8377;${
          item.storePrice * item.quantity
        }</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GST Tax Invoice - ${escapeHtml(order.orderId)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 24px; max-width: 420px; margin: 0 auto; font-size: 13px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .muted { color: #6B7280; font-size: 12px; margin: 2px 0; }
    hr { border: none; border-top: 1px dashed #D1D5DB; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 6px 2px; border-bottom: 1px solid #F3F4F6; font-size: 12px; }
    th { text-align: left; color: #6B7280; font-weight: 600; }
    .sum-row { display: flex; justify-content: space-between; margin: 4px 0; }
    .total { font-weight: 700; font-size: 15px; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>ExpressCart India · Tax Invoice</h1>
  <p class="muted">${storeLabel}</p>
  <p class="muted">Store GSTIN: ${gst.gstin}</p>
  <hr />
  <p class="muted"><strong>Invoice / Order:</strong> ${escapeHtml(
    order.orderId
  )}</p>
  <p class="muted"><strong>Date:</strong> ${escapeHtml(
    new Date(order.timestamp).toLocaleString('en-IN')
  )}</p>
  <p class="muted"><strong>Customer:</strong> ${escapeHtml(
    order.customerName || 'Shopper'
  )}</p>
  <p class="muted"><strong>Payment Ref:</strong> ${escapeHtml(
    order.paymentMethod || 'UPI Instant'
  )} · ${escapeHtml(order.physicalBillRef || order.upiRef)}</p>
  <hr />
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <hr />
  <div class="sum-row"><span>Taxable value</span><span>&#8377;${gst.taxableValue.toFixed(
    2
  )}</span></div>
  <div class="sum-row"><span>CGST (4.5%)</span><span>&#8377;${gst.cgst.toFixed(
    2
  )}</span></div>
  <div class="sum-row"><span>SGST (4.5%)</span><span>&#8377;${gst.sgst.toFixed(
    2
  )}</span></div>
  ${
    order.totalSavings > 0
      ? `<div class="sum-row"><span>Discount savings</span><span>-&#8377;${order.totalSavings}</span></div>`
      : ''
  }
  <div class="sum-row total"><span>Grand Total</span><span>&#8377;${gst.grandTotal.toFixed(
    2
  )}</span></div>
  <hr />
  <p class="muted" style="text-align:center;">Digital retail tax invoice issued via ExpressCart India (SilvyOS).</p>
</body>
</html>`;
}

export async function shareOrPrintGstInvoice(
  order: ExitPassPayload
): Promise<'print' | 'share' | 'clipboard' | 'none'> {
  const plainText = buildGstInvoiceText(order);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const popup = window.open('', '_blank', 'width=480,height=720');
    if (popup) {
      popup.document.write(buildPrintableGstHtml(order));
      popup.document.close();
      popup.focus();
      setTimeout(() => {
        try {
          popup.print();
        } catch {}
      }, 200);
      return 'print';
    }

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          title: `GST Invoice ${order.orderId}`,
          text: plainText,
        });
        return 'share';
      } catch {}
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(plainText);
        return 'clipboard';
      } catch {}
    }

    return 'none';
  }

  try {
    await Share.share({
      title: `GST Invoice ${order.orderId}`,
      message: plainText,
    });
    return 'share';
  } catch {
    return 'none';
  }
}
