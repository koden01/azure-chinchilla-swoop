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
  const [scanLinePosition, setScanLinePosition] = useState(0); // 0 to 1, representing vertical position

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

    // Draw scanning line
    if (isScanning && !overlayText) { // Only draw if actively scanning and no barcode detected yet
        const currentScanLineY = frameY + (frameHeight * scanLinePosition);
        ctx.strokeStyle = '#FF0000'; // Red scanning line
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(frameX, currentScanLineY);
        ctx.lineTo(frameX + frameWidth, currentScanLineY);
        ctx.stroke();
    }

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
  }, [boundingBox, isScanning, scanLinePosition, overlayText]); // Redraw if these change

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

    let animationFrameId: number;

    const startScanning = async () => {
      setIsInitializing(true);
      setCameraError(null);
      setOverlayText(null);
      setBoundingBox(null);
      lastProcessedCodeRef.current = null;
      lastProcessedTimeRef.current = 0;

      try {
        let stream: MediaStream | null = null;
        let cameraInfoMessage: string | null = null;

        // --- Attempt 1: Find specific rear camera deviceId ---
        try {
          console.log("[ZXing] Listing video input devices...");
          const videoInputDevices = await codeReader.listVideoInputDevices();
          
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
            // If no explicit rear camera, try the first available device with 'environment' facingMode
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
          stream = null; // Reset stream for next attempt
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
            stream = null; // Reset stream for next attempt
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
            stream = null; // Reset stream for next attempt
          }
        }

        // --- Final check: If no stream, throw error ---
        if (!stream) {
          throw new Error("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan dan aplikasi berjalan di HTTPS.");
        }

        // --- If stream is acquired, proceed ---
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          if (videoRef.current.paused) {
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
          }

          // Start scan line animation
          const animateScanLine = (timestamp: DOMHighResTimeStamp) => {
              const duration = 2000; // 2 seconds for one full cycle (down and up)
              const progress = (timestamp % duration) / duration; // 0 to 1 over duration
              
              // Make it go down then up
              const position = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2; // 0 -> 1 -> 0
              setScanLinePosition(position);
              animationFrameId = requestAnimationFrame(animateScanLine);
          };
          animationFrameId = requestAnimationFrame(animateScanLine);


          // Capture controls from the return value of decodeFromStream
          controlsRef.current = (codeReader.decodeFromStream(stream, videoRef.current, (result: Result | undefined, error: Error | undefined) => {
            
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
          }) as unknown) as IScannerControls; // Added double assertion here
          
          setIsScanning(true); // Set to true when scanning starts successfully
          setIsInitializing(false); // Set to false when scanning starts successfully
          console.log("[ZXing] Scanning started successfully. " + (cameraInfoMessage || ""));
          if (cameraInfoMessage && cameraInfoMessage.includes("Kamera depan digunakan")) {
            setCameraError(cameraInfoMessage + " Pastikan aplikasi berjalan di HTTPS dan izin kamera diberikan.");
          }
        } else {
          throw new Error("Gagal memulai kamera: Elemen video tidak tersedia.");
        }
      } catch (err: any) {
        console.error("ZXing Camera access error:", err);
        setCameraError("Tidak dapat mengakses kamera: " + err.message + ". Pastikan aplikasi berjalan di HTTPS dan izin kamera diberikan.");
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
      cancelAnimationFrame(animationFrameId); // Stop animation on unmount
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

      let retryAnimationFrameId: number; // New animation frame ID for retry

      const startScanningRetry = async () => {
        try {
          let stream: MediaStream | null = null;
          let cameraInfoMessage: string | null = null;

          // --- Attempt 1: Find specific rear camera deviceId ---
          try {
            const videoInputDevices = await codeReader.listVideoInputDevices();
            const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
            
            if (rearCamera) {
              console.log("[ZXing] Attempting to use identified rear camera deviceId (retry).");
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
              console.log("[ZXing] No explicit rear camera found, trying first device with 'environment' facingMode (retry).");
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
            console.warn("[ZXing] Failed to get stream with specific deviceId/enumerateDevices (retry):", e.message);
            stream = null;
          }

          // --- Attempt 2: Fallback to generic 'environment' facingMode ---
          if (!stream) {
            try {
              console.log("[ZXing] Attempting fallback to generic facingMode: 'environment' (retry).");
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: 'environment',
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              });
              cameraInfoMessage = "Kamera belakang digunakan (melalui facingMode 'environment').";
            } catch (e: any) {
              console.warn("[ZXing] Failed to get stream with generic 'environment' facingMode (retry):", e.message);
              stream = null;
            }
          }

          // --- Attempt 3: Fallback to 'user' (front) camera ---
          if (!stream) {
            try {
              console.log("[ZXing] Attempting fallback to facingMode: 'user' (front camera, retry).");
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: 'user',
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              });
              cameraInfoMessage = "Kamera depan digunakan (kamera belakang tidak dapat diakses).";
            } catch (e: any) {
              console.warn("[ZXing] Failed to get stream with 'user' facingMode (retry):", e.message);
              stream = null;
            }
          }

          // --- Final check: If no stream, throw error ---
          if (!stream) {
            throw new Error("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan dan aplikasi berjalan di HTTPS.");
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            if (videoRef.current.paused) {
              videoRef.current.play().catch(e => console.error("Error playing video on metadata loaded (retry):", e));
            }

            // Start scan line animation for retry
            const animateScanLineRetry = (timestamp: DOMHighResTimeStamp) => {
                const duration = 2000;
                const progress = (timestamp % duration) / duration;
                const position = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2;
                setScanLinePosition(position);
                retryAnimationFrameId = requestAnimationFrame(animateScanLineRetry);
            };
            retryAnimationFrameId = requestAnimationFrame(animateScanLineRetry);

            // Capture controls from the return value of decodeFromStream
            controlsRef.current = (codeReader.decodeFromStream(stream, videoRef.current, (result: Result | undefined, error: Error | undefined) => {
              
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
            }) as unknown) as IScannerControls; // Added double assertion here
            
            setIsScanning(true);
            setIsInitializing(false);
            console.log("[ZXing] Scanning retried successfully. " + (cameraInfoMessage || ""));
            if (cameraInfoMessage && cameraInfoMessage.includes("Kamera depan digunakan")) {
              setCameraError(cameraInfoMessage + " Pastikan aplikasi berjalan di HTTPS dan izin kamera diberikan.");
            }
          } else {
            throw new Error("Gagal memulai kamera setelah retry: Elemen video tidak tersedia.");
          }
        } catch (err: any) {
          console.error("ZXing Camera access error during retry:", err);
          setCameraError("Gagal mengakses kamera setelah retry: " + err.message + ". Pastikan aplikasi berjalan di HTTPS dan izin kamera diberikan.");
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