import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, resolveMediaUrl } from '../services/api';
import {
  QrCode,
  Download,
  FileText,
  RefreshCw,
  Printer,
  ShieldCheck,
  Sparkles,
  User,
  AlertCircle,
} from 'lucide-react';

/**
 * MyQRCode
 *
 * Shows the student's identity QR code. The QR encodes an AES-encrypted
 * fingerprint that only our backend can resolve back into the student's
 * profile — the QR itself never contains raw name / matric / photo data.
 *
 * Students can:
 *   - Download the QR as PNG
 *   - Download a printable PDF pass (QR + photo + name + matric)
 *   - Regenerate the QR (revokes the old one)
 */
export const MyQRCode = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);

  const qrContainerRef = useRef(null);

  const fetchMyQR = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.qrCodes.getMyQR();
      setQrData(data);
    } catch (err) {
      setError(err.message || 'Failed to load your QR code.');
      showToast(err.message || 'Failed to load your QR code.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMyQR();
  }, [fetchMyQR]);

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerate your QR code? Your current code will stop working.')) return;
    setRegenerating(true);
    try {
      const data = await api.qrCodes.regenerate();
      setQrData(data);
      showToast('New QR code generated.', 'success');
    } catch (err) {
      showToast(err.message || 'Regeneration failed.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  /**
   * Render the SVG QR into a canvas and hand back a PNG data URL.
   * Falls back to the server-generated PNG (qrBase64) if canvas rendering
   * isn't possible.
   */
  const qrToPng = (size = 600) =>
    new Promise((resolve, reject) => {
      const svgEl = qrContainerRef.current?.querySelector('svg');
      if (!svgEl) {
        if (qrData?.qrBase64) return resolve(qrData.qrBase64);
        return reject(new Error('QR code is not ready yet.'));
      }

      const svgString = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });

  const downloadPNG = async () => {
    try {
      const pngUrl = await qrToPng(800);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `student_qr_${user?.matricNumber || 'me'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('QR code PNG downloaded.', 'success');
    } catch (err) {
      showToast('Could not export the QR image.', 'error');
    }
  };

  /**
   * Load an image into a data URL so jsPDF can embed it (avoids CORS issues
   * with regular <img> src).
   */
  const loadImageAsDataUrl = (src) =>
    new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (_e) {
          resolve(null); // tainted canvas — skip photo silently
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const downloadPDF = async () => {
    try {
      const [qrPng, photoDataUrl] = await Promise.all([
        qrToPng(600),
        loadImageAsDataUrl(resolveMediaUrl(user?.passportPhoto)),
      ]);

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header bar
      doc.setFillColor(17, 17, 17);
      doc.rect(0, 0, pageWidth, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('STUDENT IDENTITY QR PASS', pageWidth / 2, 14, { align: 'center' });

      // Institution name (if available)
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const instName = user?.institution?.name || user?.institutionId?.name || '';
      if (instName) {
        doc.text(instName.toUpperCase(), pageWidth / 2, 32, { align: 'center' });
      }

      // Passport photo
      let photoY = 45;
      if (photoDataUrl) {
        const photoW = 40;
        const photoH = 45;
        const photoX = (pageWidth - photoW) / 2;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.rect(photoX - 1, photoY - 1, photoW + 2, photoH + 2);
        doc.addImage(photoDataUrl, 'PNG', photoX, photoY, photoW, photoH, undefined, 'FAST');
        photoY += photoH + 10;
      } else {
        photoY += 5;
      }

      // Name + matric
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      const fullName = [user?.firstName, user?.otherName, user?.lastName]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();
      doc.text(fullName || 'STUDENT', pageWidth / 2, photoY, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text(`Matric No: ${user?.matricNumber || 'N/A'}`, pageWidth / 2, photoY + 7, {
        align: 'center',
      });

      doc.setFontSize(10);
      doc.setTextColor(85, 85, 85);
      const dept = user?.department || '';
      const level = user?.level || '';
      doc.text(
        [dept, level].filter(Boolean).join('  •  ').toUpperCase(),
        pageWidth / 2,
        photoY + 13,
        { align: 'center' }
      );

      // QR code
      const qrSize = 90;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = photoY + 22;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
      doc.addImage(qrPng, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST');

      // Footer instructions
      doc.setFontSize(9);
      doc.setTextColor(85, 85, 85);
      doc.setFont('helvetica', 'normal');
      const footerY = qrY + qrSize + 12;
      doc.text(
        'Present this QR code at the exam hall entrance for identity verification.',
        pageWidth / 2,
        footerY,
        { align: 'center' }
      );
      if (qrData?.expiresAt) {
        doc.text(
          `Valid until ${new Date(qrData.expiresAt).toLocaleDateString()}`,
          pageWidth / 2,
          footerY + 6,
          { align: 'center' }
        );
      }

      doc.save(`student_qr_${user?.matricNumber || 'me'}.pdf`);
      showToast('PDF pass downloaded.', 'success');
    } catch (err) {
      showToast('Could not export the PDF pass.', 'error');
    }
  };

  const printQR = async () => {
    try {
      const pngUrl = await qrToPng(600);
      const photoUrl = resolveMediaUrl(user?.passportPhoto) || '';
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('Please allow pop-ups to print your pass.', 'warning');
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>My Student QR Pass</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 32px; }
              .card { border: 4px solid #000; padding: 24px; max-width: 420px; margin: 0 auto; }
              h1 { margin: 0 0 8px 0; font-weight: 900; letter-spacing: 2px; }
              .photo { width: 120px; height: 140px; object-fit: cover; border: 3px solid #000; }
              .name { font-weight: 800; font-size: 20px; margin-top: 12px; }
              .matric { font-weight: 700; color: #444; margin: 4px 0 12px; }
              .qr { margin: 16px auto; }
              .foot { font-size: 12px; color: #666; margin-top: 12px; }
            </style>
          </head>
          <body onload="window.print(); setTimeout(() => window.close(), 500);">
            <div class="card">
              <h1>STUDENT QR PASS</h1>
              ${photoUrl ? `<img class="photo" src="${photoUrl}" alt="Passport" />` : ''}
              <div class="name">${(user?.firstName || '')} ${(user?.otherName || '')} ${(user?.lastName || '')}</div>
              <div class="matric">Matric No: ${user?.matricNumber || 'N/A'}</div>
              <div class="matric">${user?.department || ''} — ${user?.level || ''}</div>
              <img class="qr" src="${pngUrl}" width="280" height="280" />
              <div class="foot">Present this pass at the exam hall entrance for verification.</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      showToast('Could not open the print view.', 'error');
    }
  };

  const passportUrl = resolveMediaUrl(user?.passportPhoto);
  const fullName = [user?.firstName, user?.otherName, user?.lastName].filter(Boolean).join(' ');

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">My QR Code</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            Your personal identity QR — download it, print it, and present at exam halls.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* QR Panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flat-card bg-white flex flex-col items-center">
            {loading ? (
              <div className="w-full text-center py-16 flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-t-flatBlue border-black rounded-full animate-spin mb-6" />
                <h3 className="text-xl font-black uppercase text-black">Loading your QR code...</h3>
              </div>
            ) : error ? (
              <div className="w-full text-center py-16 flex flex-col items-center gap-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h3 className="text-xl font-black uppercase text-black">Could not load QR</h3>
                <p className="text-xs font-bold text-gray-500 uppercase max-w-sm">{error}</p>
                <button
                  onClick={fetchMyQR}
                  className="flat-btn-blue text-xs font-black py-3 px-6 uppercase mt-2 inline-flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            ) : (
              <div className="w-full text-center space-y-6">
                {/* ID card layout */}
                <div className="flat-border border-black p-6 bg-gray-50 flex flex-col items-center gap-4">
                  <div className="flex flex-col md:flex-row items-center gap-6 w-full">
                    {passportUrl ? (
                      <img
                        src={passportUrl}
                        alt="Passport"
                        className="w-28 h-32 border-4 border-black object-cover"
                      />
                    ) : (
                      <div className="w-28 h-32 border-4 border-black bg-white flex items-center justify-center">
                        <User className="w-10 h-10 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 text-center md:text-left space-y-1.5">
                      <h2 className="text-2xl font-black uppercase text-black leading-tight">
                        {fullName || 'Student'}
                      </h2>
                      <span className="inline-block flat-badge bg-black text-white text-[10px] py-0.5 px-2 font-black uppercase">
                        Matric: {user?.matricNumber || 'N/A'}
                      </span>
                      <p className="text-xs font-black text-gray-600 uppercase pt-1">
                        {user?.department}
                      </p>
                      <p className="text-xs font-black text-gray-500 uppercase">
                        {user?.faculty} — {user?.level}
                      </p>
                    </div>
                  </div>

                  {/* QR itself */}
                  <div
                    ref={qrContainerRef}
                    id="qr-wrapper"
                    className="p-4 bg-white flat-border border-black"
                  >
                    <QRCode
                      value={qrData?.encryptedPayload || ' '}
                      size={260}
                      level="H"
                      style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                    />
                  </div>

                  {qrData?.expiresAt && (
                    <p className="text-[10px] font-black text-gray-500 uppercase">
                      Valid until {new Date(qrData.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={downloadPDF}
                    className="flat-btn bg-black text-white hover:scale-102 py-2.5 px-3 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    Download PDF
                  </button>
                  <button
                    onClick={downloadPNG}
                    className="flat-btn bg-white hover:scale-102 py-2.5 px-3 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    PNG
                  </button>
                  <button
                    onClick={printQR}
                    className="flat-btn bg-white hover:scale-102 py-2.5 px-3 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flat-btn bg-flatAmber hover:scale-102 py-2.5 px-3 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                    {regenerating ? 'Working...' : 'Regenerate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flat-card bg-white space-y-4">
            <h3 className="font-black text-sm uppercase border-b-2 border-black pb-2 text-black flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-flatEmerald" />
              How It Works
            </h3>
            <ol className="space-y-3 text-[11px] font-bold text-gray-600 uppercase leading-snug">
              <li className="flex items-start gap-2">
                <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                  1
                </span>
                <span>Your QR is auto-generated the first time you visit this page.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                  2
                </span>
                <span>Download the PDF, print it, or show it on your phone at the exam hall.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                  3
                </span>
                <span>The exam officer scans your code — your name, photo, and matric appear on their screen.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flat-border-sm bg-flatEmerald text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                  ✓
                </span>
                <span>
                  <span className="text-flatEmerald font-black">Verified</span> — attendance is recorded automatically.
                </span>
              </li>
            </ol>
          </div>

          <div className="flat-card bg-gray-50 border-black space-y-3">
            <h4 className="font-black text-xs uppercase text-black border-b-2 border-black pb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-flatAmber" />
              Security
            </h4>
            <ul className="space-y-2 text-[10px] font-bold text-gray-500 uppercase leading-snug">
              <li>The QR encodes an encrypted, non-reversible token — your personal data is never in the code itself.</li>
              <li>If your code is ever exposed or lost, tap <span className="text-black font-black">Regenerate</span> to invalidate it and mint a fresh one.</li>
              <li>Only your institution can scan and match the code to your record.</li>
            </ul>
          </div>

          {qrData && (
            <div className="flat-card bg-white border-black space-y-2">
              <h4 className="font-black text-xs uppercase text-black border-b-2 border-black pb-2 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-flatBlue" />
                Details
              </h4>
              <div className="text-[10px] font-bold text-gray-600 uppercase space-y-1">
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="text-flatEmerald font-black">{qrData.status || 'active'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Issued</span>
                  <span className="text-black font-black">
                    {qrData.createdAt ? new Date(qrData.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                {qrData.expiresAt && (
                  <div className="flex justify-between">
                    <span>Expires</span>
                    <span className="text-black font-black">
                      {new Date(qrData.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyQRCode;
