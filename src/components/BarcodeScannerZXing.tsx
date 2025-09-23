import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, Result } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react'; // Removed CameraOff, CheckCircle
import { beepSuccess } from '@/utils/audio';

// Define IScannerControls locally as it's not directly exported from @zxing/library
interface IScannerControls {
  stream: MediaStream;
  stop(): void;
}

interface BarcodeScannerZXingProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScannerZXing: React.FC<BarcodeScannerZXingProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  // controlsRef is not strictly needed for ZXing's continuous decode, but kept for consistency if manual stream control is desired
  const controlsRef = useRef<{ stream: MediaStream | null; videoElement: HTMLVideoElement | null }>({ stream: null, videoElement: null });

  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false); // To control if ZXing is actively decoding
  const [overlayText, setOverlayText] = useState<string | null>(null); // For displaying text on canvas
  const [boundingBox, setBoundingBox] = useState<any | null>(null); // For drawing bounding box

  const lastProcessedCodeRef = useRef<string | null>(null); // To track last processed code
  const lastProcessedTimeRef = useRef<number>(0); // To track last processed time
  const detectionCooldown = 1500; // Cooldown for processing the same barcode (1.5 seconds)

  const drawOverlay = useCallback(() => { // Modified to draw bounding box and text
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw guide box in the center (similar to Quagga)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const boxWidth = canvas.width * 0.6; // 60% of canvas width
    const boxHeight = canvas.height * 0.3; // 30% of canvas height

    ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)'; // CornflowerBlue with transparency
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - boxWidth/2, centerY - boxHeight/2, boxWidth, boxHeight);

    // Draw bounding box if available (from last detection)
    if (boundingBox) {
      ctx.strokeStyle = '#00ff00'; // Green for detected barcode
      ctx.lineWidth = 3;
      // ZXing result.resultPoints are {x, y} objects, not arrays like Quagga's box
      ctx.beginPath();
      ctx.moveTo(boundingBox[0].x, boundingBox[0].y);
      for (let i = 1; i < boundingBox.length; i++) {
        ctx.lineTo(boundingBox[i].x, boundingBox[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw detected barcode text if available
    if (overlayText) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, canvas.height - 60, canvas.width, 60); // Bottom bar
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#00ff00'; // Green text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(overlayText, canvas.width / 2, canvas.height - 30);
    }
  }, [overlayText, boundingBox]);

  useEffect(() => {
    const hints = new Map();
    const formats = [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.CODE_39,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const codeReader = new BrowserMultiFormatReader(hints);
    codeReaderRef.current = codeReader;

    const startScanning = async () => {
      setIsInitializing(true);
      setCameraError(null);
      setOverlayText(null);
      setBoundingBox(null);
      lastProcessedCodeRef.current = null; // Reset on start
      lastProcessedTimeRef.current = 0; // Reset on start

      try {
        const videoInputDevices = await codeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          throw new Error("Tidak ada perangkat kamera yang ditemukan.");
        }

        const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
        const deviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[0].deviceId;

        if (videoRef.current) {
          controlsRef.current.videoElement = videoRef.current;

          // Apply 'as any' to the callback function to resolve TS2345
          codeReader.decodeFromVideoDevice(deviceId, videoRef.current, ((result: Result | undefined, error: Error | undefined, controls: IScannerControls) => {
            if (result) {
              const currentTime = Date.now();
              const code = result.getText().trim();

              // Check for cooldown
              if (code !== lastProcessedCodeRef.current || (currentTime - lastProcessedTimeRef.current > detectionCooldown)) {
                lastProcessedCodeRef.current = code;
                lastProcessedTimeRef.current = currentTime;

                onScan(code); // Directly send to textbox and process
                beepSuccess.play().catch(() => console.log("Audio play failed"));

                setOverlayText(code); // Display the detected code on the canvas
                setBoundingBox(result.getResultPoints()); // Store bounding box for drawing

                // Temporarily pause scanning (by setting isScanning to false) and clear overlay after cooldown
                setIsScanning(false); // Indicate that we've processed a barcode
                setTimeout(() => {
                  setOverlayText(null); // Clear overlay text
                  setBoundingBox(null); // Clear bounding box
                  setIsScanning(true); // Resume scanning after cooldown
                }, detectionCooldown);
              }
            }
            // Always draw overlay to keep it updated, even if no new barcode is detected
            drawOverlay();
          }) as any); // Cast the entire callback to any
          setIsScanning(true); // ZXing is now actively looking for barcodes
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.error("ZXing Camera access error:", err);
        setCameraError("Tidak dapat mengakses kamera: " + err.message);
        setIsInitializing(false);
      }
    };

    startScanning();

    return () => {
      if (codeReaderRef.current) {
        console.log("ZXing: Resetting code reader on unmount.");
        codeReaderRef.current.reset(); // This stops the video stream and decoding
        codeReaderRef.current = null;
      }
      // No need to manually stop stream from controlsRef.current.stream
      // because codeReader.reset() handles it.
    };
  }, [onScan, drawOverlay]);

  const handleCloseClick = () => {
    onClose();
  };

  const handleRetryCamera = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setIsInitializing(true);
    setCameraError(null);
    setOverlayText(null);
    setBoundingBox(null);
    setIsScanning(false);

    setTimeout(() => {
      const hints = new Map();
      const formats = [
        BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_39, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC, BarcodeFormat.PDF_417,
      ];
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const codeReader = new BrowserMultiFormatReader(hints);
      codeReaderRef.current = codeReader;

      const startScanningRetry = async () => {
        try {
          const videoInputDevices = await codeReader.listVideoInputDevices();
          const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
          const deviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[0].deviceId;

          if (videoRef.current) {
            controlsRef.current.videoElement = videoRef.current;
            // Apply 'as any' to the callback function to resolve TS2345
            codeReader.decodeFromVideoDevice(deviceId, videoRef.current, ((result: Result | undefined, error: Error | undefined, controls: IScannerControls) => {
              if (result) {
                const currentTime = Date.now();
                const code = result.getText().trim();
                if (code !== lastProcessedCodeRef.current || (currentTime - lastProcessedTimeRef.current > detectionCooldown)) {
                  lastProcessedCodeRef.current = code;
                  lastProcessedTimeRef.current = currentTime;
                  onScan(code);
                  beepSuccess.play().catch(() => console.log("Audio play failed"));
                  setOverlayText(code);
                  setBoundingBox(result.getResultPoints());
                  setIsScanning(false);
                  setTimeout(() => {
                    setOverlayText(null);
                    setBoundingBox(null);
                    setIsScanning(true);
                  }, detectionCooldown);
                }
              }
              drawOverlay();
            }) as any); // Cast the entire callback to any
            setIsScanning(true);
            setIsInitializing(false);
          }
        } catch (err: any) {
          setCameraError("Gagal mengakses kamera setelah retry: " + err.message);
          setIsInitializing(false);
        }
      };
      startScanningRetry();
    }, 500);
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

      <div className="relative">
        <video id="video" ref={videoRef} className="w-full h-64 object-cover" />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-64 pointer-events-none"
          style={{ zIndex: 20 }}
        />
      </div>

      {!cameraError && ( // Always show close button if no camera error
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

      {/* Scanning guide text */}
      {!cameraError && !isInitializing && ( // Show guide text when not initializing and no error
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