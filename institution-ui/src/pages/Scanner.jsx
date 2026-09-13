import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, resolveMediaUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  Zap,
  ZapOff,
  RefreshCw,
  Play,
  Square,
} from 'lucide-react';

const SCANNER_ELEMENT_ID = 'student-qr-scanner';

/**
 * Scanner
 *
 * Institution-side scanner using the low-level `Html5Qrcode` API so we can
 * expose camera selection, torch, and zoom controls in our own styled UI
 * (the built-in `Html5QrcodeScanner` widget hides those settings behind
 * tiny toggle links that are easy to miss).
 *
 * Reads student-generated identity QRs and POSTs the encrypted payload to
 * `/qrcodes/scan-student`. When an exam is selected, the backend also
 * records attendance in the same call.
 */
export const Scanner = () => {
  const { showToast } = useToast();

  // Data
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scanner state
  const [activeExamId, setActiveExamId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualPayload, setManualPayload] = useState('');

  // Camera device management
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  // Torch (flashlight) support
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Zoom support
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [zoomLevel, setZoomLevel] = useState(1);

  // Live decode diagnostics
  const [scannerReady, setScannerReady] = useState(false);
  const [decodeAttempts, setDecodeAttempts] = useState(0);

  const html5QrRef = useRef(null);
  const activeExamIdRef = useRef('');
  const processingRef = useRef(false);
  const lastDecodedRef = useRef({ text: '', at: 0 });

  useEffect(() => {
    activeExamIdRef.current = activeExamId;
  }, [activeExamId]);

  // Load exams available for scanning
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

  // Enumerate cameras once — needed for the "camera source" dropdown.
  const loadCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices || []);
      if (devices && devices.length > 0 && !selectedCameraId) {
        // Prefer a rear camera by default (usual for exam-hall staff phones).
        const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
        setSelectedCameraId((rear || devices[0]).id);
      }
      return devices || [];
    } catch (err) {
      const message = err?.message || 'Could not enumerate cameras.';
      setCameraError(message);
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  /**
   * Cleanup helper — safe to call even if scanner isn't running.
   */
  const stopScanner = useCallback(async () => {
    const inst = html5QrRef.current;
    if (!inst) return;
    try {
      // isScanning is exposed by html5-qrcode
      if (inst.isScanning) {
        await inst.stop();
      }
      await inst.clear();
    } catch (_err) {
      // Ignore — teardown races are common when the tab changes state.
    }
    html5QrRef.current = null;
    setScannerReady(false);
    setTorchSupported(false);
    setTorchOn(false);
    setZoomSupported(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  /**
   * Called by html5-qrcode when a QR is decoded. We de-duplicate rapid
   * repeat decodes (the scanner keeps firing while the code is in frame)
   * and gate the actual API call behind a processing flag.
   */
  const onDecoded = useCallback(async (decodedText) => {
    if (processingRef.current) return;
    const now = Date.now();
    if (
      lastDecodedRef.current.text === decodedText &&
      now - lastDecodedRef.current.at < 2500
    ) {
      return;
    }
    lastDecodedRef.current = { text: decodedText, at: now };
    processingRef.current = true;
    setProcessing(true);

    // Pause the scanner so the camera preview freezes while the result is shown.
    try {
      if (html5QrRef.current?.isScanning) {
        await html5QrRef.current.stop();
      }
    } catch (_e) {
      // ignore
    }
    setScanning(false);

    try {
      const result = await api.qrCodes.scanStudent(
        decodedText.trim(),
        activeExamIdRef.current || null
      );
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
      processingRef.current = false;
      setProcessing(false);
    }
  }, [showToast]);

  /**
   * Try to pick up torch and zoom capabilities from the running video
   * track. These are optional and only available on some browsers/devices.
   */
  const probeVideoCapabilities = useCallback(() => {
    try {
      const inst = html5QrRef.current;
      if (!inst) return;
      const settings = inst.getRunningTrackCameraCapabilities?.();
      if (settings?.torchFeature) {
        setTorchSupported(settings.torchFeature().isSupported());
      }
      if (settings?.zoomFeature) {
        const zoom = settings.zoomFeature();
        if (zoom.isSupported()) {
          setZoomSupported(true);
          const min = zoom.min();
          const max = zoom.max();
          const step = zoom.step();
          setZoomRange({
            min: Number.isFinite(min) ? min : 1,
            max: Number.isFinite(max) ? max : 1,
            step: Number.isFinite(step) && step > 0 ? step : 0.1,
          });
          const currentValue = zoom.value?.() ?? 1;
          setZoomLevel(currentValue);
        }
      }
    } catch (_err) {
      // Silent — capabilities probing is best-effort.
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (starting || scanning) return;
    setCameraError(null);
    setScanResult(null);
    setStarting(true);
    setDecodeAttempts(0);

    // Ensure we have a camera to use.
    let camId = selectedCameraId;
    if (!camId) {
      const devices = await loadCameras();
      camId = devices?.[0]?.id;
      if (camId) setSelectedCameraId(camId);
    }
    if (!camId) {
      setCameraError(
        'No camera detected. Please connect a camera and allow browser access, or use the manual payload option below.'
      );
      setStarting(false);
      return;
    }

    // Reuse the instance if one already exists; otherwise build a fresh one.
    if (!html5QrRef.current) {
      html5QrRef.current = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        // Only scan QR codes — skip other symbologies for a big speedup.
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        // Use the browser's native BarcodeDetector API when available.
        // It's dramatically faster and better at dense QRs than the JS
        // decoder, which matters for student identity QRs (~190+ chars).
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
    }

    const config = {
      fps: 15,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const size = Math.floor(minEdge * 0.75);
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
      disableFlip: false,
      // Best-guess starting zoom so tiny printed QRs are readable at arm's length.
      defaultZoomValueIfSupported: 1.5,
    };

    try {
      await html5QrRef.current.start(
        camId,
        config,
        (decodedText) => {
          setDecodeAttempts((n) => n + 1);
          onDecoded(decodedText);
        },
        () => {
          // Per-frame decode failures are expected between successful scans.
          setDecodeAttempts((n) => n + 1);
        }
      );
      setScanning(true);
      setScannerReady(true);
      // Give the browser a beat to negotiate the track, then probe capabilities.
      setTimeout(probeVideoCapabilities, 400);
    } catch (err) {
      const message = err?.message || err?.toString() || 'Camera failed to start.';
      let friendly = message;
      if (/NotAllowed|Permission/i.test(message)) {
        friendly = 'Camera permission was denied. Enable it in your browser and try again.';
      } else if (/NotFound|Devices/i.test(message)) {
        friendly = 'No camera was found on this device.';
      } else if (/NotReadable|TrackStart|in use/i.test(message)) {
        friendly = 'Camera is being used by another application. Close it and try again.';
      }
      setCameraError(friendly);
    } finally {
      setStarting(false);
    }
  }, [starting, scanning, selectedCameraId, loadCameras, onDecoded, probeVideoCapabilities]);

  const stopScanning = useCallback(async () => {
    await stopScanner();
    setScanning(false);
  }, [stopScanner]);

  const toggleTorch = useCallback(async () => {
    try {
      const inst = html5QrRef.current;
      if (!inst?.getRunningTrackCameraCapabilities) return;
      const capabilities = inst.getRunningTrackCameraCapabilities();
      const torch = capabilities.torchFeature?.();
      if (!torch?.isSupported()) return;
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
    } catch (_err) {
      showToast('Torch control failed on this device.', 'error');
    }
  }, [torchOn, showToast]);

  const applyZoom = useCallback(async (value) => {
    try {
      const inst = html5QrRef.current;
      if (!inst?.getRunningTrackCameraCapabilities) return;
      const capabilities = inst.getRunningTrackCameraCapabilities();
      const zoom = capabilities.zoomFeature?.();
      if (!zoom?.isSupported()) return;
      await zoom.apply(value);
      setZoomLevel(value);
    } catch (_err) {
      // Silent — some devices reject specific zoom values.
    }
  }, []);

  // Change camera while scanning — stop → restart with the new device id.
  const handleCameraChange = async (deviceId) => {
    setSelectedCameraId(deviceId);
    if (scanning) {
      await stopScanner();
      // Small delay so the previous stream is fully released.
      setTimeout(() => {
        // Update ref first, then start.
        startScanner();
      }, 200);
    }
  };

  const handleReset = async () => {
    setScanResult(null);
    setCameraError(null);
    setManualPayload('');
    await stopScanner();
    setScanning(false);
  };

  const handleScanNext = async () => {
    setScanResult(null);
    // Auto-restart the scanner so staff don't have to keep tapping.
    await startScanner();
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualPayload.trim()) {
      showToast('Paste an encrypted QR payload first.', 'warning');
      return;
    }
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const result = await api.qrCodes.scanStudent(
        manualPayload.trim(),
        activeExamIdRef.current || null
      );
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
      processingRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">
            Staff Scanner
          </h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            Scan a student's QR code to verify identity. Select an active exam to also record
            attendance.
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
          {/* LEFT: Controls + preview + result */}
          <div className="lg:col-span-2 space-y-6">
            {/* SCANNER SETTINGS PANEL — always visible, big & obvious */}
            <div className="flat-card bg-white space-y-4">
              <h3 className="font-black text-sm uppercase border-b-4 border-black pb-2 text-black flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-flatBlue stroke-[2.5]" />
                Scanner Settings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Exam selector */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Active Exam (optional)
                  </label>
                  <select
                    className="flat-select text-sm py-2.5"
                    value={activeExamId}
                    onChange={(e) => {
                      setActiveExamId(e.target.value);
                      setScanResult(null);
                    }}
                  >
                    <option value="">Identity check only</option>
                    {exams.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.courseCode} — {e.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mt-1.5 leading-snug">
                    Choose the exam being audited. If blank, only student info is shown.
                  </p>
                </div>

                {/* Camera selector */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Camera source
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="flat-select text-sm py-2.5 flex-1"
                      value={selectedCameraId}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      disabled={cameras.length === 0}
                    >
                      {cameras.length === 0 && <option value="">No cameras detected</option>}
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label || `Camera ${c.id.slice(0, 6)}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={loadCameras}
                      className="flat-btn bg-white hover:bg-gray-100 p-2.5 cursor-pointer"
                      title="Re-detect cameras"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mt-1.5 leading-snug">
                    Pick the rear camera on a phone for best focus on printed passes.
                  </p>
                </div>
              </div>

              {/* Live controls — only relevant while scanning */}
              {scanning && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-2 border-dashed border-gray-300">
                  {/* Torch */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                      Torch (flashlight)
                    </label>
                    <button
                      type="button"
                      onClick={toggleTorch}
                      disabled={!torchSupported}
                      className={`flat-btn w-full flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase cursor-pointer ${
                        torchOn
                          ? 'bg-flatAmber text-black'
                          : 'bg-white text-black hover:bg-gray-100'
                      } ${!torchSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                      {torchOn ? 'Torch On' : 'Torch Off'}
                    </button>
                    {!torchSupported && (
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-1.5">
                        Not supported by this camera
                      </p>
                    )}
                  </div>

                  {/* Zoom */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black flex justify-between">
                      <span>Zoom</span>
                      {zoomSupported && (
                        <span className="text-flatBlue">{zoomLevel.toFixed(1)}x</span>
                      )}
                    </label>
                    <input
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step}
                      value={zoomLevel}
                      onChange={(e) => applyZoom(parseFloat(e.target.value))}
                      disabled={!zoomSupported}
                      className="w-full accent-flatBlue disabled:opacity-40 disabled:cursor-not-allowed h-2.5 border-2 border-black bg-white cursor-pointer"
                    />
                    {!zoomSupported && (
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-1.5">
                        Not supported by this camera
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SCANNER + RESULT */}
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
                      {resolveMediaUrl(
                        scanResult.student.passportPhoto || scanResult.student.photo
                      ) ? (
                        <img
                          src={resolveMediaUrl(
                            scanResult.student.passportPhoto || scanResult.student.photo
                          )}
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
                          {scanResult.student.name ||
                            `${scanResult.student.lastName}, ${scanResult.student.firstName}`}
                        </h3>
                        <span className="flat-badge bg-white text-xs border-2 py-0.5 px-2 font-black uppercase border-black inline-block">
                          Matric: {scanResult.student.matricNumber}
                        </span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-extrabold text-gray-500 uppercase pt-2 border-t border-gray-300">
                          <div>
                            DEPT:{' '}
                            <span className="text-black font-black">
                              {scanResult.student.department}
                            </span>
                          </div>
                          <div>
                            LEVEL:{' '}
                            <span className="text-black font-black">
                              {scanResult.student.level}
                            </span>
                          </div>
                          {scanResult.student.faculty && (
                            <div>
                              FACULTY:{' '}
                              <span className="text-black font-black">
                                {scanResult.student.faculty}
                              </span>
                            </div>
                          )}
                          {scanResult.student.status && (
                            <div>
                              STATUS:{' '}
                              <span className="text-black font-black">
                                {scanResult.student.status}
                              </span>
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

                  <div className="flex flex-col md:flex-row gap-2">
                    <button
                      onClick={handleScanNext}
                      className="flat-btn bg-flatBlue text-white hover:scale-102 flex-1 flex items-center justify-center gap-2 py-3 cursor-pointer"
                    >
                      <ScanLine className="w-5 h-5" />
                      Scan Next Student
                    </button>
                    <button
                      onClick={handleReset}
                      className="flat-btn bg-black text-white hover:scale-102 flex items-center justify-center gap-2 py-3 px-6 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center py-4">
                  {/* Camera preview area — always rendered so html5-qrcode can attach */}
                  <div className="w-full max-w-[420px] flex flex-col items-center">
                    <div
                      id={SCANNER_ELEMENT_ID}
                      className={`w-full flat-border border-black bg-black overflow-hidden relative ${
                        scanning ? 'aspect-square' : 'hidden'
                      }`}
                    />

                    {!scanning && (
                      <div className="text-center py-8 flex flex-col items-center space-y-4">
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
                                <h4 className="text-xs font-black text-red-700 uppercase">
                                  Camera error
                                </h4>
                                <p className="text-[11px] font-bold text-red-600 mt-1 leading-snug">
                                  {cameraError}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Start / Stop buttons */}
                    {!scanning ? (
                      <button
                        onClick={startScanner}
                        disabled={starting}
                        className="flat-btn-blue text-sm font-black px-10 py-4 mt-4 w-full cursor-pointer disabled:opacity-60"
                      >
                        <Play className="w-5 h-5 stroke-[2.5]" />
                        {starting
                          ? 'Starting camera...'
                          : cameraError
                          ? 'Retry Camera'
                          : 'Start Camera Scanner'}
                      </button>
                    ) : (
                      <div className="w-full space-y-2 mt-4">
                        <div className="flat-border bg-black text-white px-4 py-2 flex items-center justify-between text-xs font-black uppercase">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-flatEmerald rounded-full animate-pulse" />
                            Scanning...
                          </span>
                          <span className="text-flatEmerald">
                            {decodeAttempts} frame{decodeAttempts === 1 ? '' : 's'}
                          </span>
                        </div>
                        <button
                          onClick={stopScanning}
                          className="flat-btn-danger w-full text-xs font-black cursor-pointer flex items-center justify-center gap-2 py-3"
                        >
                          <Square className="w-4 h-4" />
                          Stop Scanner
                        </button>
                      </div>
                    )}
                  </div>
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

          {/* RIGHT: Instructions */}
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
                  <span>Pick the active exam if you want to record attendance.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                    2
                  </span>
                  <span>Choose the right camera and tap <span className="text-black font-black">Start Camera Scanner</span>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flat-border-sm bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                    3
                  </span>
                  <span>Point at the student's QR. Use torch or zoom on the settings panel if lighting is poor.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flat-border-sm bg-flatEmerald text-white w-5 h-5 flex items-center justify-center shrink-0 font-black text-[9px]">
                    ✓
                  </span>
                  <span>Once matched, the student's photo and matric appear here.</span>
                </li>
              </ol>
            </div>

            <div className="flat-card bg-gray-50 border-black space-y-3">
              <h4 className="font-black text-xs uppercase text-black border-b-2 border-black pb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-flatBlue" />
                Result reference
              </h4>
              <ul className="space-y-2 text-[10px] font-bold text-gray-500 uppercase leading-snug">
                <li>
                  <span className="text-flatEmerald font-black">Identity Confirmed:</span> No exam selected — attendance is NOT recorded.
                </li>
                <li>
                  <span className="text-flatEmerald font-black">Attendance Recorded:</span> Student marked present for the selected exam.
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

            {scannerReady && (
              <div className="flat-card bg-white border-black">
                <h4 className="font-black text-xs uppercase text-black border-b-2 border-black pb-2 mb-2 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-flatBlue" />
                  Scanner diagnostics
                </h4>
                <ul className="text-[10px] font-bold text-gray-600 uppercase leading-snug space-y-1">
                  <li className="flex justify-between">
                    <span>Cameras detected</span>
                    <span className="text-black font-black">{cameras.length}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Torch</span>
                    <span className="text-black font-black">
                      {torchSupported ? 'Supported' : 'N/A'}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Zoom</span>
                    <span className="text-black font-black">
                      {zoomSupported
                        ? `${zoomRange.min}x – ${zoomRange.max}x`
                        : 'N/A'}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Native decoder</span>
                    <span className="text-black font-black">
                      {typeof window !== 'undefined' && 'BarcodeDetector' in window
                        ? 'Yes'
                        : 'Fallback JS'}
                    </span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;
