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

  // States for rendering
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningState, setIsScanningState] = useState(false);
  const [overlayTextState, setOverlayTextState] = useState<string | null>(null);
  const [boundingBoxState, setBoundingBoxState] = useState<any | null>(null);
  const [scanLinePositionState, setScanLinePositionState] = useState(0);

  // Refs to hold the latest state values for drawOverlay to keep it stable
  const isScanningRef = useRef(isScanningState);
  const overlayTextRef = useRef(overlayTextState);
  const boundingBoxRef = useRef(boundingBoxState);
  const scanLinePositionRef = useRef(scanLinePositionState);

  // Update refs whenever state changes
  useEffect(() => { isScanningRef.current = isScanningState; }, [isScanningState]);
  useEffect(() => { overlayTextRef.current = overlayTextState; }, [overlayTextState]);
  useEffect(() => { boundingBoxRef.current = boundingBoxState; }, [boundingBoxState]);
  useEffect(() => { scanLinePositionRef.current = scanLinePositionState; }, [scanLinePositionState]);

  const lastProcessedCodeRef = useRef<string | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);
  const detectionCooldown = 1500;

  // drawOverlay now accesses values from refs, making it truly stable
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight; // Corrected from video.height
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const frameWidth = canvas.width * 0.8;
    const frameHeight = canvas.height * 0.4;
    const frameX = (canvas.width - frameWidth) / 2;
    const frameY = (canvas.height - frameHeight) / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

    // Access values from refs
    if (isScanningRef.current && !overlayTextRef.current) {
        const currentScanLineY = frameY + (frameHeight * scanLinePositionRef.current);
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(frameX, currentScanLineY);
        ctx.lineTo(frameX + frameWidth, currentScanLineY);
        ctx.stroke();
    }

    if (boundingBoxRef.current) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boundingBoxRef.current[0].x, boundingBoxRef.current[0].y);
      for (let i = 1; i < boundingBoxRef.current.length; i++) {
        ctx.lineTo(boundingBoxRef.current[i].x, boundingBoxRef.current[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }, []); // Empty dependency array: drawOverlay is now truly stable

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
      }
    }
    controlsRef.current = null;
    setIsScanningState(false); // Use state setter
    setIsInitializing(false);
    setCameraError(null);
    setOverlayTextState(null); // Use state setter
    setBoundingBoxState(null); // Use state setter
    lastProcessedCodeRef.current = null;
    lastProcessedTimeRef.current = 0;
  }, []); // No dependencies, as it only uses refs or state setters

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
    hints.set(DecodeHintType.TRY_HARDER, true);

    if (!codeReaderRef.current) {
      codeReaderRef.current = new BrowserMultiFormatReader(hints);
    }

    try {
      let stream: MediaStream | null = null;
      let cameraInfoMessage: string | null = null;

      // --- Attempt 1: Find specific rear camera deviceId ---
      try {
        console.log("[ZXing] Listing video input devices...");
        const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();
        
        const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
        
        if (rearCamera) {
          console.log("[ZXing] Attempting to use identified rear camera deviceId.");
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: rearCamera.deviceId,
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          cameraInfoMessage = "Kamera belakang digunakan.";
        } else if (videoInputDevices.length > 0) {
          console.log("[ZXing] No explicit rear camera found, trying first device with 'environment' facingMode.");
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: videoInputDevices[0].deviceId,
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          cameraInfoMessage = "Kamera belakang digunakan (melalui facingMode 'environment' pada perangkat default).";
        }
      } catch (e: any) {
        console.warn("[ZXing] Failed to get stream with specific deviceId/enumerateDevices:", e.message);
        stream = null;
      }

      // --- Attempt 2: Fallback to generic 'environment' facingMode ---
      if (!stream) {
        try {
          console.log("[ZXing] Attempting fallback to generic facingMode: 'environment'.");
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          cameraInfoMessage = "Kamera belakang digunakan (melalui facingMode 'environment').";
        } catch (e: any) {
          console.warn("[ZXing] Failed to get stream with generic 'environment' facingMode:", e.message);
          stream = null;
        }
      }

      // --- Attempt 3: Fallback to 'user' (front) camera ---
      if (!stream) {
        try {
          console.log("[ZXing] Attempting fallback to facingMode: 'user' (front camera).");
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
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
        if (videoRef.current.paused) {
          videoRef.current.play().catch(e => console.error("Error playing video:", e));
        }

        let currentAnimationFrameId: number;
        const animateScanLine = (timestamp: DOMHighResTimeStamp) => {
            const duration = 2000;
            const progress = (timestamp % duration) / duration;
            const position = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2;
            setScanLinePositionState(position); // Update state, which updates ref
            currentAnimationFrameId = requestAnimationFrame(animateScanLine);
        };
        currentAnimationFrameId = requestAnimationFrame(animateScanLine);

        controlsRef.current = (codeReaderRef.current.decodeFromStream(stream, videoRef.current, (result: Result | undefined, error: Error | undefined) => {
          if (error) {
            if (error.name !== "NotFoundException") {
              console.warn("[ZXing] Decoding error (non-NotFoundException):", error);
            }
          }

          if (result) {
            console.log("[ZXing] Barcode detected:", result.getText());
            const currentTime = Date.now();
            const code = result.getText().trim();

            if (code !== lastProcessedCodeRef.current || (currentTime - lastProcessedTimeRef.current > detectionCooldown)) {
              lastProcessedCodeRef.current = code;
              lastProcessedTimeRef.current = currentTime;

              onScan(code);
              beepSuccess.play().catch(() => console.log("Audio play failed"));

              setOverlayTextState(code); // Update state, which updates ref
              setBoundingBoxState(result.getResultPoints()); // Update state, which updates ref
              setIsScanningState(false); // Update state, which updates ref
              
              setTimeout(() => {
                setOverlayTextState(null);
                setBoundingBoxState(null);
                onClose(); // Close the scanner after a successful scan
              }, detectionCooldown);
            }
          }
          drawOverlay(); // Call the stable drawOverlay
        }) as unknown) as IScannerControls;
        
        setIsScanningState(true); // Update state, which updates ref
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
  }, [onScan, onClose, drawOverlay]); // drawOverlay is now stable, so this dependency is fine.

  useEffect(() => {
    let animationFrameId: number; // Declare animationFrameId here

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
        }
      }
      controlsRef.current = null;
      cancelAnimationFrame(animationFrameId); // Use the local animationFrameId
      setIsScanningState(false); // Use state setter
      setIsInitializing(false);
      setCameraError(null);
      setOverlayTextState(null); // Use state setter
      setBoundingBoxState(null); // Use state setter
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
  }, [isActive, startScanning]); // startScanning is now stable because drawOverlay is stable.

  const handleCloseClick = () => {
    onClose(); // This will set isActive to false in the parent
  };

  const handleRetryCamera = () => {
    console.log("[ZXing] Retrying camera initialization...");
    cleanupCamera(); // Clean up existing camera resources
    startScanning(); // Attempt to start scanning again
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

      {overlayTextState && (
        <div className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-center py-2 z-30">
          <p className="text-lg font-semibold">Hasil Scan: {overlayTextState}</p>
        </div>
      )}

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

      {!cameraError && !isInitializing && isScanningState && !overlayTextState && (
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