import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, Result } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { beepSuccess } from '@/utils/audio';

interface IScannerControls {
  stream: MediaStream;
  stop(): void;
}

interface BarcodeScannerZXingProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isActive: boolean;
}

const BarcodeScannerZXing: React.FC<BarcodeScannerZXingProps> = ({ onScan, onClose, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningState, setIsScanningState] = useState(false);
  // Keep these states for internal logic, even if not rendered visually for now
  const [overlayTextState, setOverlayTextState] = useState<string | null>(null);
  const [boundingBoxState, setBoundingBoxState] = useState<any | null>(null);

  // Refs to hold the latest state values for drawOverlay to keep it stable
  const isScanningRef = useRef(isScanningState);
  const overlayTextRef = useRef(overlayTextState);
  const boundingBoxRef = useRef(boundingBoxState);

  // Update refs whenever state changes
  useEffect(() => { isScanningRef.current = isScanningState; }, [isScanningState]);
  useEffect(() => { overlayTextRef.current = overlayTextState; }, [overlayTextState]);
  useEffect(() => { boundingBoxRef.current = boundingBoxState; }, [boundingBoxState]);

  const lastProcessedCodeRef = useRef<string | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);
  const detectionCooldown = 1500;

  // drawOverlay now includes a static scanning frame
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a static scanning frame
    const frameWidth = canvas.width * 0.7; // 70% of canvas width
    const frameHeight = canvas.height * 0.3; // 30% of canvas height
    const frameX = (canvas.width - frameWidth) / 2;
    const frameY = (canvas.height - frameHeight) / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // White, semi-transparent
    ctx.lineWidth = 2;
    ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

    // Optional: Draw a small crosshair in the center of the frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    const centerX = frameX + frameWidth / 2;
    const centerY = frameY + frameHeight / 2;
    const crosshairSize = 10;
    ctx.beginPath();
    ctx.moveTo(centerX - crosshairSize, centerY);
    ctx.lineTo(centerX + crosshairSize, centerY);
    ctx.moveTo(centerX, centerY - crosshairSize);
    ctx.lineTo(centerX, centerY + crosshairSize);
    ctx.stroke();

    // All other overlay drawing logic (scan line, bounding box) remains removed
  }, []); // Empty dependency array: drawOverlay is truly stable

  const cleanupCamera = useCallback(() => {
    console.log("[ZXing] Performing camera cleanup.");
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (controlsRef.current && controlsRef.current.stream) {
      console.log("[ZXing] Stopping media tracks.");
      controlsRef.current.stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null; // Ensure listener is cleaned up
      }
    }
    controlsRef.current = null;
    setIsScanningState(false);
    setIsInitializing(false);
    setCameraError(null);
    setOverlayTextState(null);
    setBoundingBoxState(null);
    lastProcessedCodeRef.current = null;
    lastProcessedTimeRef.current = 0;
  }, []);

  const startScanning = useCallback(async () => {
    setIsInitializing(true);
    setCameraError(null);
    setOverlayTextState(null);
    setBoundingBoxState(null);
    lastProcessedCodeRef.current = null;
    lastProcessedTimeRef.current = 0;

    const hints = new Map();
    const formats = [
      BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.QR_CODE,
      BarcodeFormat.CODE_39, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC, BarcodeFormat.PDF_417,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.PURE_BARCODE, true);
    // hints.set(DecodeHintType.OPTIMIZE_FOR_SCANS, true); // Menambahkan hint OPTIMIZE_FOR_SCANS

    if (!codeReaderRef.current) {
      codeReaderRef.current = new BrowserMultiFormatReader(hints);
    }

    try {
      let stream: MediaStream | null = null;
      let cameraInfoMessage: string | null = null;

      // Prioritize 'environment' (rear) camera
      try {
        console.log("[ZXing] Attempting to use facingMode: 'environment' (rear camera).");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 800 }, // Mengurangi resolusi ideal
            height: { ideal: 600 }, // Mengurangi resolusi ideal
          },
        });
        cameraInfoMessage = "Kamera belakang digunakan.";
      } catch (e: any) {
        console.warn("[ZXing] Failed to get stream with 'environment' facingMode:", e.message);
        // Fallback to 'user' (front) camera if 'environment' fails
        try {
          console.log("[ZXing] Attempting fallback to facingMode: 'user' (front camera).");
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 800 }, // Mengurangi resolusi ideal
              height: { ideal: 600 }, // Mengurangi resolusi ideal
            },
          });
          cameraInfoMessage = "Kamera depan digunakan (kamera belakang tidak dapat diakses).";
        } catch (e: any) {
          console.warn("[ZXing] Failed to get stream with 'user' facingMode:", e.message);
          stream = null;
        }
      }

      if (!stream) {
        throw new Error("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan dan aplikasi berjalan di HTTPS.");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Mengatur atribut video secara programatis
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;

        // Add a listener to log video dimensions once metadata is loaded
        videoRef.current.onloadedmetadata = () => {
            console.log(`[ZXing] Video metadata loaded. Dimensions: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
            // Menghapus panggilan play() eksplisit di sini karena autoplay sudah diatur
        };

        controlsRef.current = (codeReaderRef.current.decodeFromStream(stream, videoRef.current, (result: Result | undefined, error: Error | undefined) => {
          if (error) {
            // Log ALL errors for debugging, not just filter NotFoundException
            console.error("[ZXing] Decoding error:", error); 
          }

          if (result) {
            console.log("[ZXing] Barcode detected:", result.getText());
            // Log successful result for debugging
            console.log("[ZXing] Decoder Result:", result);

            const currentTime = Date.now();
            const code = result.getText().trim();

            if (code !== lastProcessedCodeRef.current || (currentTime - lastProcessedTimeRef.current > detectionCooldown)) {
              lastProcessedCodeRef.current = code;
              lastProcessedTimeRef.current = currentTime;

              onScan(code);
              beepSuccess.play().catch(() => console.log("Audio play failed"));

              setOverlayTextState(code); // State ini tetap diperbarui untuk debugging internal
              setBoundingBoxState(result.getResultPoints()); // State ini tetap diperbarui untuk debugging internal
              setIsScanningState(false);
              
              setTimeout(() => {
                setOverlayTextState(null);
                setBoundingBoxState(null);
                onClose();
              }, detectionCooldown);
            }
          }
          drawOverlay(); // Call the stable drawOverlay (which now draws a static frame)
        }) as unknown) as IScannerControls;
        
        setIsScanningState(true);
        setIsInitializing(false);
        console.log("[ZXing] Scanning started successfully. " + (cameraInfoMessage || ""));
        if (cameraInfoMessage && cameraInfoMessage.includes("Kamera depan digunakan")) {
          setCameraError(cameraInfoMessage + " Pastikan aplikasi berjalan di HTTPS dan izin kamera diberikan.");
        }
      } else {
        console.error("[ZXing] videoRef.current is null, cannot start scanning.");
        setCameraError("Gagal memulai kamera: Elemen video tidak tersedia.");
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.error("ZXing Camera access error:", err);
      setCameraError("Tidak dapat mengakses kamera: " + err.message + ". Pastikan aplikasi berjalan di HTTPS dan izin kamera diberikan.");
      setIsInitializing(false);
    }
  }, [onScan, onClose, drawOverlay]);

  useEffect(() => {
    const cleanup = () => {
      console.log("[ZXing] Performing cleanup.");
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
      if (controlsRef.current && controlsRef.current.stream) {
        console.log("[ZXing] Stopping media tracks.");
        controlsRef.current.stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.onloadedmetadata = null; // Ensure listener is cleaned up
        }
      }
      controlsRef.current = null;
      setIsScanningState(false);
      setIsInitializing(false);
      setCameraError(null);
      setOverlayTextState(null);
      setBoundingBoxState(null);
      lastProcessedCodeRef.current = null;
      lastProcessedTimeRef.current = 0;
    };

    if (isActive) {
      console.log("[ZXing] Component active. Initializing camera...");
      startScanning();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isActive, startScanning]);

  const handleCloseClick = () => {
    onClose();
  };

  const handleRetryCamera = () => {
    console.log("[ZXing] Retrying camera initialization...");
    cleanupCamera();
    startScanning();
  };

  return (
    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden">
      {isInitializing && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 text-white z-10 p-4">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Memulai kamera...</p>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10 p-4">
          <AlertTriangle className="h-12 w-12 mb-4 text-yellow-400" />
          <p className="text-center mb-4">{cameraError}</p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryCamera}
              className="text-white border-white hover:bg-white/20 mb-2"
            >
              Coba Lagi Kamera
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseClick}
              className="text-white border-white hover:bg-white/20"
            >
              Tutup Kamera
            </Button>
          </div>
        </div>
      )}

      <div className="relative w-full aspect-video bg-black">
        <video 
          id="video" 
          ref={videoRef} 
          className="w-full h-full object-cover"
          autoPlay 
          playsInline 
          muted 
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 20 }}
        />
      </div>

      {!cameraError && (
        <div className="absolute top-2 right-2 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={handleCloseClick}
            disabled={isInitializing}
            title="Tutup Kamera"
          >
            <XCircle className="h-6 w-6" />
          </Button>
        </div>
      )}

      {!cameraError && !isInitializing && isScanningState && (
        <div className="absolute bottom-4 left-0 right-0 text-center z-20">
          <p className="text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full inline-block">
            Arahkan barcode ke tengah layar
          </p>
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerZXing;