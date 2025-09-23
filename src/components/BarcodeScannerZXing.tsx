import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, Result } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react';
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
  const controlsRef = useRef<IScannerControls | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const [boundingBox, setBoundingBox] = useState<any | null>(null);

  const lastProcessedCodeRef = useRef<string | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);
  const detectionCooldown = 1500; // Cooldown before resuming scan and clearing overlay

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas dimensions match video dimensions for correct drawing
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw scanning frame (always visible when scanning)
    const frameWidth = canvas.width * 0.8;
    const frameHeight = canvas.height * 0.4;
    const frameX = (canvas.width - frameWidth) / 2;
    const frameY = (canvas.height - frameHeight) / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Light white frame
    ctx.lineWidth = 2;
    ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

    // Draw bounding box only if detected
    if (boundingBox) {
      ctx.strokeStyle = '#00ff00'; // Green for detected barcode
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boundingBox[0].x, boundingBox[0].y);
      for (let i = 1; i < boundingBox.length; i++) {
        ctx.lineTo(boundingBox[i].x, boundingBox[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }, [boundingBox]); // Only redraw if boundingBox changes

  useEffect(() => {
    console.log("[ZXing] Component mounted. Initializing camera...");
    const hints = new Map();
    const formats = [
      BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.QR_CODE,
      BarcodeFormat.CODE_39, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC, BarcodeFormat.PDF_417,
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
      lastProcessedCodeRef.current = null;
      lastProcessedTimeRef.current = 0;

      try {
        console.log("[ZXing] Listing video input devices...");
        const videoInputDevices = await codeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          throw new Error("Tidak ada perangkat kamera yang ditemukan.");
        }
        console.log("[ZXing] Found video devices:", videoInputDevices);

        const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
        const deviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[0].deviceId;
        console.log("[ZXing] Using deviceId:", deviceId);

        // Explicitly set video constraints for better resolution
        const videoConstraints: MediaStreamConstraints = {
          video: {
            deviceId: deviceId,
            facingMode: rearCamera ? 'environment' : 'user', // Prefer back camera
            width: { ideal: 1280 }, // Request a good resolution
            height: { ideal: 720 },
          },
        };

        if (videoRef.current) {
          console.log("[ZXing] Video ref current:", videoRef.current);
          
          // Cast the method call to any to bypass TypeScript argument count check
          (codeReader.decodeFromVideoDevice as any)(deviceId, videoRef.current, videoConstraints, ((result: Result | undefined, error: Error | undefined, zxingControls: IScannerControls) => {
            controlsRef.current = zxingControls; // Store the IScannerControls object from the callback
            
            if (error) {
              // Log non-critical errors, e.g., "No MultiFormat Readers were able to detect a barcode."
              if (error.name !== "NotFoundException") {
                console.warn("[ZXing] Decoding error (non-NotFoundException):", error); // Log other errors
              }
            }

            if (result) {
              console.log("[ZXing] Barcode detected:", result.getText());
              const currentTime = Date.now();
              const code = result.getText().trim();

              if (code !== lastProcessedCodeRef.current || (currentTime - lastProcessedTimeRef.current > detectionCooldown)) {
                lastProcessedCodeRef.current = code;
                lastProcessedTimeRef.current = currentTime;

                onScan(code); // Trigger onScan callback in parent
                beepSuccess.play().catch(() => console.log("Audio play failed"));

                setOverlayText(code);
                setBoundingBox(result.getResultPoints());
                setIsScanning(false); // Stop scanning temporarily for visual feedback
                
                // Automatically close scanner after successful scan and cooldown
                setTimeout(() => {
                  setOverlayText(null);
                  setBoundingBox(null);
                  setIsScanning(true); // Resume scanning (though it will be closed by onClose)
                  onClose(); // Close the scanner after a successful scan
                }, detectionCooldown);
              }
            }
            drawOverlay();
          }));
          
          setIsScanning(true); // Set to true when scanning starts successfully
          setIsInitializing(false); // Set to false when scanning starts successfully
          console.log("[ZXing] Scanning started successfully.");
        } else {
          console.error("[ZXing] videoRef.current is null, cannot start scanning.");
          setCameraError("Gagal memulai kamera: Elemen video tidak tersedia.");
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
      console.log("[ZXing] Component unmounted. Resetting code reader.");
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
      // Hentikan semua track media secara eksplisit
      if (controlsRef.current && controlsRef.current.stream) {
        console.log("[ZXing] Stopping media tracks.");
        controlsRef.current.stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
      controlsRef.current = null;
    };
  }, [onScan, drawOverlay, onClose]); // Add onClose to dependencies

  const handleCloseClick = () => {
    onClose();
  };

  const handleRetryCamera = () => {
    console.log("[ZXing] Retrying camera initialization...");
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    // Hentikan track media yang mungkin masih berjalan dari percobaan sebelumnya
    if (controlsRef.current && controlsRef.current.stream) {
      controlsRef.current.stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    controlsRef.current = null; // Reset controlsRef

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

          const videoConstraints: MediaStreamConstraints = {
            video: {
              deviceId: deviceId,
              facingMode: rearCamera ? 'environment' : 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          };

          if (videoRef.current) {
            // Cast the method call to any to bypass TypeScript argument count check
            (codeReader.decodeFromVideoDevice as any)(deviceId, videoRef.current, videoConstraints, ((result: Result | undefined, error: Error | undefined, zxingControls: IScannerControls) => {
              controlsRef.current = zxingControls; // Store the IScannerControls object from the callback
              
              if (error) {
                if (error.name !== "NotFoundException") {
                  console.warn("[ZXing] Decoding error (retry, non-NotFoundException):", error);
                }
              }

              if (result) {
                console.log("[ZXing] Barcode detected (retry):", result.getText());
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
                    onClose(); // Close the scanner after a successful scan
                  }, detectionCooldown);
                }
              }
              drawOverlay();
            }));
            
            setIsScanning(true);
            setIsInitializing(false);
            console.log("[ZXing] Scanning retried successfully.");
          } else {
            console.error("[ZXing] videoRef.current is null during retry, cannot start scanning.");
            setCameraError("Gagal memulai kamera setelah retry: Elemen video tidak tersedia.");
            setIsInitializing(false);
          }
        } catch (err: any) {
          console.error("ZXing Camera access error during retry:", err);
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

      <div className="relative w-full aspect-video bg-black"> {/* Use aspect-video for consistent ratio */}
        <video 
          id="video" 
          ref={videoRef} 
          className="w-full h-full object-cover" // Fill the container
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

      {overlayText && (
        <div className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-center py-2 z-30">
          <p className="text-lg font-semibold">Hasil Scan: {overlayText}</p>
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

      {!cameraError && !isInitializing && isScanning && !overlayText && (
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