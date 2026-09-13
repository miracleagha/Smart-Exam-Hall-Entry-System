import React, { useState, useEffect, useRef } from 'react';
import { api, resolveMediaUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Camera,
  CheckCircle,
  XCircle,
  RotateCcw,
  ScanLine,
  BookOpen,
  User,
  AlertCircle,
  Info,
} from 'lucide-react';

/**
 * Scanner
 *
 * Institution-side scanner. Reads a student's identity QR (generated on
 * the student portal) and POSTs the encrypted payload to
 * `/qrcodes/scan-student`. If an exam is selected, the backend also
 * records attendance for that exam.
 */
export const Scanner = () => {
  const { showToast } = useToast();

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeExamId, setActiveExamId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualPayload, setManualPayload] = useState('');

  const scannerRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const list = await api.exams.list({ limit: 500 });
        const rows = Array.isArray(list) ? list : list?.exams || [];
        setExams(rows.filter((e) => ['upcoming', 'active'].includes(e.status)));
      } catch (err) {
        showToast(err.message || 'Failed to load exams.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

  const requestCameraPermission = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Your browser does not support camera access. Please use a modern browser like Chrome or Firefox.'
        );
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permission and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is in use by another application.');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unknown error occurred'}`);
      }
      return false;
    }
  };

  // Start / stop the html5-qrcode scanner when `scanning` toggles.
  useEffect(() => {
    if (!scanning) return undefined;

    const timeout = setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.7);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      });
      scannerRef.current = scanner;
      scanner.render(
        async (decodedText) => {
          try {
            await scanner.clear();
          } catch (_e) {
            // ignore
          }
          scannerRef.current = null;
          setScanning(false);
          await processScan(decodedText);
        },
        () => {
          // per-frame decode errors are noisy — swallow
        }
      );
    }, 150);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (_e) {
          // ignore
        }
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const processScan = async (payload) => {
    const cleaned = (payload || '').toString().trim();
    if (!cleaned) return;
    setProcessing(true);
    try {
      const result = await api.qrCodes.scanStudent(cleaned, activeExamId || null);
      setScanResult(result);
      if (result?.verified) {
        showToast(result.message || 'Student verified.', 'success');
      } else {
        showToast(result?.reason || 'Verification failed.', 'error');
      }
    } catch (err) {
      const message = err.message || 'Scan request failed.';
      setScanResult({ verified: false, reason: message, status: 'ERROR' });
      showToast(message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const startScanning = async () => {
    setScanResult(null);
    setCameraError(null);
    const ok = await requestCameraPermission();
    if (ok) setScanning(true);
  };

  const handleReset = () => {
    setScanResult(null);
    setScanning(false);
    setCameraError(null);
    setManualPayload('');
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualPayload.trim()) {
      showToast('Paste an encrypted QR payload first.', 'warning');
      return;
    }
    await processScan(manualPayload);
  };

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Staff Scanner</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            Scan a student's QR code to verify their identity. Select an active exam to also record attendance.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <div className="w-10 h-10 border-4 border-t-flatBlue border-black rounded-full animate-spin mx-auto mb-4" />
          <p className="font-extrabold text-sm uppercase text-gray-500">Loading exam list...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scanner + Result */}
          <div className="lg:col-span-2 space-y-6">
            {/* Exam selector (optional) */}
            <div className="flat-card bg-white">
              <h3 className="font-black text-xs uppercase text-black mb-3">
                Select active exam (optional — for attendance recording)
              </h3>
              <select
                className="flat-select text-sm py-2.5"
                value={activeExamId}
                onChange={(e) => {
                  setActiveExamId(e.target.value);
                  handleReset();
                }}
              >
                <option value="">Identity check only (don't record attendance)</option>
                {exams.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.courseCode} — {e.title} ({e.venue})
                  </option>
                ))}
              </select>
              <p className="text-[10px] font-bold text-gray-500 uppercase mt-2 leading-snug">
                Leaving this blank still shows the student's info, but nothing is written to attendance.
              </p>
            </div>

            {/* Scanner panel */}
            <div className="flat-card bg-white flex flex-col items-center">
              {processing ? (
                <div className="w-full text-center py-16 flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-t-flatBlue border-black rounded-full animate-spin mb-6" />
                  <h3 className="text-xl font-black uppercase text-black">Verifying student...</h3>
                </div>
              ) : scanResult ? (
                <div className="w-full text-center space-y-6">
                  <div
                    className={`flat-border p-6 flex flex-col items-center text-white select-none ${
                      scanResult.verified ? 'bg-flatEmerald' : 'bg-red-500'
                    }`}
                  >
                    {scanResult.verified ? (
                      <CheckCircle className="w-16 h-16 stroke-[2.5]" />
                    ) : (
                      <XCircle className="w-16 h-16 stroke-[2.5]" />
                    )}
                    <h2 className="text-3xl font-black uppercase mt-3 tracking-wide">
                      {scanResult.verified
                        ? scanResult.status === 'VERIFIED'
                          ? 'Attendance Recorded'
                          : 'Identity Confirmed'
                        : 'Verification Failed'}
                    </h2>
                    <span className="text-xs font-bold bg-black text-white px-3 py-1 mt-2 flat-border-sm uppercase border-white max-w-full break-words">
                      {scanResult.verified
                        ? scanResult.message || 'Student verified.'
                        : scanResult.reason}
                    </span>
                  </div>

                  {scanResult.student && (
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 p-4 text-left border-2 border-black bg-gray-50">
                      {resolveMediaUrl(scanResult.student.passportPhoto || scanResult.student.photo) ? (
                        <img
                          src={resolveMediaUrl(scanResult.student.passportPhoto || scanResult.student.photo)}
                          alt="Student"
                          className="w-28 h-32 border-4 border-black object-cover shrink-0 mx-auto md:mx-0"
                        />
                      ) : (
                        <div className="w-28 h-32 border-4 border-black bg-white flex items-center justify-center shrink-0 mx-auto md:mx-0">
                          <User className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                      <div className="space-y-2 flex-1">
                        <h3 className="font-black text-lg uppercase text-black leading-tight">
                          {scanResult.student.name || `${scanResult.student.lastName}, ${scanResult.student.firstName}`}
                        </h3>
                        <span className="flat-badge bg-white text-xs border-2 py-0.5 px-2 font-black uppercase border-black inline-block">
                          Matric: {scanResult.student.matricNumber}
                        </span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-extrabold text-gray-500 uppercase pt-2 border-t border-gray-300">
                          <div>
                            DEPT:{' '}
                            <span className="text-black font-black">{scanResult.student.department}</span>
                          </div>
                          <div>
                            LEVEL:{' '}
                            <span className="text-black font-black">{scanResult.student.level}</span>
                          </div>
                          {scanResult.student.faculty && (
                            <div>
                              FACULTY:{' '}
                              <span className="text-black font-black">{scanResult.student.faculty}</span>
                            </div>
                          )}
                          {scanResult.student.status && (
                            <div>
                              STATUS:{' '}
                              <span className="text-black font-black">{scanResult.student.status}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {scanResult.exam && (
                    <div className="p-4 text-left border-2 border-black bg-gray-50 space-y-1 font-bold text-xs text-gray-600">
                      <h4 className="font-black uppercase text-black text-xs border-b border-gray-300 pb-1 mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-flatBlue" />
                        Exam
                      </h4>
                      <div className="flex justify-between">
                        <span>Course</span>
                        <span className="font-extrabold text-black uppercase">
                          {scanResult.exam.courseCode} — {scanResult.exam.title}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Venue</span>
                        <span className="font-extrabold text-black">{scanResult.exam.venue}</span>
                      </div>
                      {scanResult.attendance?.verifiedAt && (
                        <div className="flex justify-between">
                          <span>Verified At</span>
                          <span className="font-extrabold text-flatBlue font-mono">
                            {new Date(scanResult.attendance.verifiedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleReset}
                    className="w-full flat-btn bg-black text-white hover:scale-102 flex items-center justify-center gap-2 py-3 cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Scan Next Student
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center py-4">
                  {scanning ? (
                    <div className="w-full max-w-[340px] md:max-w-md flex flex-col items-center">
                      <div id="qr-reader" className="w-full flat-border border-black bg-black overflow-hidden" />
                      <button
                        onClick={() => setScanning(false)}
                        className="flat-btn-danger w-full mt-4 text-xs font-black cursor-pointer"
                      >
                        Cancel Camera Scan
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-12 flex flex-col items-center space-y-4">
                      <div className="w-24 h-24 bg-gray-100 border-4 border-dashed border-black flex items-center justify-center relative">
                        <Camera className="w-12 h-12 text-gray-600" />
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-flatBlue border-2 border-black flex items-center justify-center">
                          <ScanLine className="w-3.5 h-3.5 text-white stroke-[3]" />
                        </div>
                      </div>
                      <h3 className="text-xl font-black uppercase text-black">Ready to scan</h3>
                      <p className="text-xs font-bold text-gray-500 max-w-sm uppercase leading-snug px-4">
                        Point your camera at the student's QR code (from the Student app or a printed pass).
                      </p>

                      {cameraError && (
                        <div className="w-full max-w-sm bg-red-50 border-2 border-red-500 p-4 text-left space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-xs font-black text-red-700 uppercase">Camera Access Error</h4>
                              <p className="text-[11px] font-bold text-red-600 mt-1 leading-snug">
                                {cameraError}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={startScanning}
                        className="flat-btn-blue text-sm font-black px-10 py-4 cursor-pointer"
                      >
                        <Camera className="w-5 h-5 stroke-[2.5]" />
                        {cameraError ? 'Retry Camera Scanner' : 'Start Camera Scanner'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual paste fallback */}
            {!scanResult && !scanning && !processing && (
              <div className="flat-card bg-white space-y-3">
                <h4 className="font-black text-xs uppercase text-black border-b-2 border-black pb-2 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-flatBlue" />
                  Manual Payload (Backup)
                </h4>
                <p className="text-[10px] font-bold text-gray-500 uppercase leading-snug">
                  Paste the encrypted QR payload directly. Useful when the camera is unavailable.
                </p>
                <form onSubmit={handleManualSubmit} className="flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    className="flat-input text-xs py-2 font-mono flex-1"
                    placeholder="Paste encrypted payload..."
                    value={manualPayload}
                    onChange={(e) => setManualPayload(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="flat-btn bg-black text-white hover:scale-102 py-2 px-4 text-xs font-black uppercase cursor-pointer"
                  >
                    Verify
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Info / rules */}
          <div className="space-y-6">
            <div className="flat-card bg-white space-y-4">
              <h3 className="font-black text-sm uppercase border-b-2 border-black pb-2 text-black flex items-center gap-1.5">
                <ScanLine className="w-4 h-4 text-flatBlue" />
                How to scan
              </h3>
              <ol className="space-y-3 text-[11px] font-bold text-gray-600 uppercase leading-snug">
                <li className="flex items-start gap-2">
                  <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                    1
                  </span>
                  <span>Choose an active exam if you want to record attendance.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                    2
                  </span>
                  <span>Tap <span className="text-black font-black">Start Camera Scanner</span>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                    3
                  </span>
                  <span>Point the camera at the student's QR — the student's name, matric, and photo will appear on this screen.</span>
                </li>
              </ol>
            </div>

            <div className="flat-card bg-gray-50 border-black space-y-3">
              <h4 className="font-black text-xs uppercase text-black border-b-2 border-black pb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-flatBlue" />
                Verification results
              </h4>
              <ul className="space-y-2 text-[10px] font-bold text-gray-500 uppercase leading-snug">
                <li>
                  <span className="text-flatEmerald font-black">Identity Confirmed:</span> Student matched. No exam selected — attendance is NOT recorded.
                </li>
                <li>
                  <span className="text-flatEmerald font-black">Attendance Recorded:</span> Student matched and marked present for the selected exam.
                </li>
                <li>
                  <span className="text-red-500 font-black">Not Registered:</span> Student isn't enrolled in the selected exam.
                </li>
                <li>
                  <span className="text-red-500 font-black">Already Verified:</span> Student was already recorded for this exam.
                </li>
                <li>
                  <span className="text-red-500 font-black">Expired / Revoked:</span> QR is no longer valid — ask the student to regenerate.
                </li>
                <li>
                  <span className="text-red-500 font-black">Wrong Institution:</span> QR belongs to a different institution.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;
