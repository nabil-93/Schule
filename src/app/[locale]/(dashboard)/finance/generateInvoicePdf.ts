'use client';

import { jsPDF } from 'jspdf';

export interface InvoicePdfData {
  schoolName: string;
  schoolLogo?: string; // Data URL or URL
  studentName: string;
  className: string;
  month: string; // "YYYY-MM"
  amount: number;
  paidAt: string; // ISO date
  invoiceId: string;
  locale?: string;
}

const MONTHS: Record<string, string[]> = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
};

const LABELS: Record<string, any> = {
  de: {
    invoice: 'RECHNUNG',
    date: 'Datum',
    studentInfo: 'SCHÜLERINFORMATIONEN',
    name: 'Vollständiger Name',
    class: 'Klasse',
    paymentDetails: 'ZAHLUNGSDETAILS',
    period: 'Zeitraum',
    paymentDate: 'Zahlungsdatum',
    description: 'BESCHREIBUNG',
    amount: 'BETRAG HT',
    service: 'Monatliche Schulgebühren',
    subtotal: 'Zwischensumme',
    tax: 'MwSt. (0%)',
    total: 'GESAMT TTC',
    paid: 'BEZAHLT',
    ref: 'Referenz',
    footer: 'Automatisch generiertes Dokument. Keine Unterschrift erforderlich.'
  },
  fr: {
    invoice: 'FACTURE',
    date: 'Date',
    studentInfo: 'INFORMATIONS ÉLÈVE',
    name: 'Nom complet',
    class: 'Classe',
    paymentDetails: 'DÉTAILS DU PAIEMENT',
    period: 'Période',
    paymentDate: 'Date de paiement',
    description: 'DESCRIPTION',
    amount: 'MONTANT HT',
    service: 'Frais de scolarité mensuels',
    subtotal: 'Sous-total',
    tax: 'TVA (0%)',
    total: 'TOTAL TTC',
    paid: 'PAYÉ',
    ref: 'Référence',
    footer: 'Document généré automatiquement. Ne nécessite pas de signature.'
  },
  en: {
    invoice: 'INVOICE',
    date: 'Date',
    studentInfo: 'STUDENT INFORMATION',
    name: 'Full Name',
    class: 'Class',
    paymentDetails: 'PAYMENT DETAILS',
    period: 'Period',
    paymentDate: 'Payment Date',
    description: 'DESCRIPTION',
    amount: 'AMOUNT HT',
    service: 'Monthly School Fees',
    subtotal: 'Subtotal',
    tax: 'VAT (0%)',
    total: 'TOTAL TTC',
    paid: 'PAID',
    ref: 'Reference',
    footer: 'Automatically generated document. No signature required.'
  },
  ar: {
    invoice: 'فاتورة',
    date: 'التاريخ',
    studentInfo: 'معلومات الطالب',
    name: 'الاسم الكامل',
    class: 'الفصل',
    paymentDetails: 'تفاصيل الدفع',
    period: 'الفترة',
    paymentDate: 'تاريخ الدفع',
    description: 'الوصف',
    amount: 'المبلغ',
    service: 'الرسوم المدرسية الشهرية',
    subtotal: 'المجموع الفرعي',
    tax: 'الضريبة (0٪)',
    total: 'الإجمالي',
    paid: 'مدفوع',
    ref: 'المرجع',
    footer: 'وثيقة تم إنشاؤها تلقائياً. لا تتطلب توقيعاً.'
  }
};

function monthLabel(month: string, locale = 'de'): string {
  const [y, m] = month.split('-');
  const list = MONTHS[locale] || MONTHS.en;
  return `${list[Number(m) - 1] ?? m} ${y}`;
}

function formatDate(iso: string, locale = 'de'): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale).format(d);
  } catch {
    return iso;
  }
}

function formatEuro(n: number): string {
  // Manual formatting to avoid non-breaking space char (160) that jsPDF renders as "/"
  const parts = n.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];
  // Add thousand separators with regular space
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted},${decPart} EUR`;
}

/** Draws a rounded rectangle (fill & optional stroke) */
function roundRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number, r: number,
  style: 'F' | 'S' | 'FD' = 'F',
) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

export function downloadInvoicePdf(data: InvoicePdfData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const ML = 18;
  const MR = 18;
  const CW = W - ML - MR;
  const L = LABELS[data.locale || 'de'] || LABELS.en;

  // Header background bar (Professional Gradient-like look)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, W, 40, 'F');

  // --- LOGO & SCHOOL NAME ---
  if (data.schoolLogo) {
     try {
        // Logo on the left
        doc.addImage(data.schoolLogo, 'PNG', ML, 10, 20, 20);
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(data.schoolName.toUpperCase(), ML + 25, 22);
     } catch (e) {
        console.error('Failed to add logo to PDF', e);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(data.schoolName.toUpperCase(), ML, 22);
     }
  } else {
    // Just text if no logo
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(data.schoolName.toUpperCase(), ML, 22);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  // FACTURE badge (right side)
  doc.setFillColor(59, 130, 246);
  roundRect(doc, W - MR - 50, 12, 50, 12, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(L.invoice, W - MR - 25, 20, { align: 'center' });

  // Invoice number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const invoiceNo = `${L.ref} ${data.invoiceId.slice(0, 8).toUpperCase()}`;
  doc.text(invoiceNo, W - MR, 32, { align: 'right' });

  // Date
  doc.text(`${L.date}: ${formatDate(new Date().toISOString(), data.locale)}`, W - MR, 38, { align: 'right' });

  // ═══════════════════════════════════════════════════
  //  SECTION: Student & Payment Info (two columns)
  // ═══════════════════════════════════════════════════
  let y = 62;

  // Left column: Informations eleve
  doc.setFillColor(248, 250, 252); // slate-50
  roundRect(doc, ML, y, CW / 2 - 4, 52, 3, 'F');
  doc.setDrawColor(226, 232, 240); // slate-200
  roundRect(doc, ML, y, CW / 2 - 4, 52, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(L.studentInfo, ML + 8, y + 10);

  doc.setDrawColor(226, 232, 240);
  doc.line(ML + 8, y + 13, ML + CW / 2 - 12, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(L.name, ML + 8, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(data.studentName, ML + 8, y + 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(L.class, ML + 8, y + 39);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(data.className, ML + 8, y + 46);

  // Right column: Details paiement
  const rx = ML + CW / 2 + 4;
  const rw = CW / 2 - 4;
  doc.setFillColor(248, 250, 252);
  roundRect(doc, rx, y, rw, 52, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  roundRect(doc, rx, y, rw, 52, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(L.paymentDetails, rx + 8, y + 10);

  doc.setDrawColor(226, 232, 240);
  doc.line(rx + 8, y + 13, rx + rw - 8, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(L.period, rx + 8, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(monthLabel(data.month, data.locale), rx + 8, y + 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(L.paymentDate, rx + 8, y + 39);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(formatDate(data.paidAt, data.locale), rx + 8, y + 46);

  // ═══════════════════════════════════════════════════
  //  SECTION: Invoice table
  // ═══════════════════════════════════════════════════
  y += 64;

  // Table header
  doc.setFillColor(15, 23, 42);
  roundRect(doc, ML, y, CW, 10, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(L.description, ML + 8, y + 7);
  doc.text(L.period.toUpperCase(), ML + CW * 0.45, y + 7);
  doc.text(L.amount, W - MR - 8, y + 7, { align: 'right' });

  // Table row
  y += 10;
  doc.setFillColor(255, 255, 255);
  doc.rect(ML, y, CW, 14, 'F');
  doc.setDrawColor(241, 245, 249);
  doc.line(ML, y + 14, ML + CW, y + 14);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(L.service, ML + 8, y + 9);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text(monthLabel(data.month, data.locale), ML + CW * 0.45, y + 9);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(formatEuro(data.amount), W - MR - 8, y + 9, { align: 'right' });

  // Totals section
  y += 20;
  // Subtotal line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(L.subtotal, W - MR - 60, y + 5);
  doc.setTextColor(30, 41, 59);
  doc.text(formatEuro(data.amount), W - MR - 8, y + 5, { align: 'right' });

  // TVA
  y += 8;
  doc.setTextColor(100, 116, 139);
  doc.text(L.tax, W - MR - 60, y + 5);
  doc.setTextColor(30, 41, 59);
  doc.text(formatEuro(0), W - MR - 8, y + 5, { align: 'right' });

  // Total line
  y += 12;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(W - MR - 70, y, W - MR, y);

  doc.setFillColor(15, 23, 42);
  roundRect(doc, W - MR - 70, y + 2, 70, 14, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(L.total, W - MR - 62, y + 11);
  doc.setFontSize(12);
  doc.text(formatEuro(data.amount), W - MR - 5, y + 11, { align: 'right' });

  // ═══════════════════════════════════════════════════
  //  SECTION: Payment status stamp
  // ═══════════════════════════════════════════════════
  y += 28;
  
  // Stamp
  doc.setFillColor(220, 252, 231); // green-100
  roundRect(doc, ML, y, 70, 22, 3, 'F');
  doc.setDrawColor(34, 197, 94);   // green-500
  doc.setLineWidth(0.6);
  roundRect(doc, ML, y, 70, 22, 3, 'S');

  doc.setTextColor(22, 101, 52);    // green-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(L.paid, ML + 35, y + 14, { align: 'center' });

  // Method & Reference
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${L.ref}: ${data.invoiceId.slice(0, 12).toUpperCase()}`, ML + 75, y + 14);

  // ═══════════════════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════════════════
  // Decorative line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(ML, H - 30, W - MR, H - 30);

  // Footer text
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(data.schoolName, ML, H - 23);
  doc.text(L.footer, ML, H - 18);
  doc.text(`${L.date}: ${formatDate(new Date().toISOString(), data.locale)}`, W - MR, H - 18, { align: 'right' });

  // Bottom accent bar
  doc.setFillColor(59, 130, 246);
  doc.rect(0, H - 6, W, 6, 'F');

  // ── Download ──
  const safeName = data.studentName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Facture_${safeName}_${data.month}.pdf`;
  doc.save(filename);
}
