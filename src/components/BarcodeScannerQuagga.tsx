import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, CameraOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { beepSuccess } from '@/utils/audio'; // Import beepSuccess from audio utility

interface BarcodeScannerQuaggaProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScannerQuagga: React.FC<BarcodeScannerQuaggaProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [scanningActive, setScanningActive] = useState(true);
  const quaggaInitializedRef = useRef(false);
  const lastDetectionTime = useRef<number>(0);
  const detectionCooldown = 1000; // Reduced from 2000ms to 1000ms
  const animationRef = useRef<number>();

  // Draw bounding box overlay
  const drawBoundingBox = (box: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Added willReadFrequently
    if (!ctx) return;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding box
    ctx.strokeStyle = '#00ff00'; // Green for detected barcode
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(box[0][0], box[0][1]);
    for (let i = 1; i < box.length; i++) {
      ctx.lineTo(box[i][0], box[i][1]);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw crosshair in the center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const crosshairSize = 20;

    ctx.strokeStyle = '#ff0000'; // Red crosshair
    ctx.lineWidth = 2;
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(centerX - crosshairSize, centerY);
    ctx.lineTo(centerX + crosshairSize, centerY);
    ctx.stroke();
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - crosshairSize);
    ctx.lineTo(centerX, centerY + crosshairSize);
    ctx.stroke();
  };

  useEffect(() => {
    if (!videoRef.current || quaggaInitializedRef.current) return;

    const initializeQuagga = async () => {
      setIsInitializing(true);
      setCameraError(null);

      try {
        // Test camera access first with simpler constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());

        await Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: videoRef.current,
            constraints: {
              width: { min: 320, ideal: 640 },
              height: { min: 240, ideal: 480 },
              aspectRatio: { min: 1, max: 2 },
              facingMode: "environment",
            },
            // Define a specific area for detection to focus on the center
            area: {
              top: "20%",    // top 20% of the stream
              right: "20%",  // right 20%
              left: "20%",   // left 20%
              bottom: "20%"  // bottom 20%
            }
          },
          locator: {
            patchSize: "medium",
            halfSample: false,
            minConfidence: 0.8, // Only decode if confidence is 80% or higher
          },
          numOfWorkers: 1,
          frequency: 10,
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader",
              "code_39_reader"
            ],
          },
          locate: true, // Enable location to draw bounding boxes
        }, (err) => {
          if (err) {
            console.error("Quagga initialization error:", err);
            setCameraError("Gagal mengakses kamera: " + err.message);
            setIsInitializing(false);
            return;
          }
          
          console.log("Quagga initialized successfully");
          Quagga.start();
          setIsInitializing(false);
          setIsScanning(true);
          quaggaInitializedRef.current = true;
        });

      } catch (error: any) {
        console.error("Camera access error:", error);
        setCameraError("Tidak dapat mengakses kamera: " + error.message);
        setIsInitializing(false);
      }
    };

    initializeQuagga();

    // Handle detected barcodes
    Quagga.onDetected((result) => {
      // Ignore new detections if scanning is not active, still initializing, or a barcode is already detected and waiting for confirmation
      if (!scanningActive || isInitializing || detectedBarcode !== null) return;

      const currentTime = Date.now();
      
      // Apply cooldown for new detections
      if (currentTime - lastDetectionTime.current < detectionCooldown) {
        return;
      }

      if (result?.codeResult?.code && result.codeResult.format) {
        const code = result.codeResult.code.trim();
        // Safely get confidence, defaulting to 0 if not available
        const confidence = result.codeResult.decodedCodes && result.codeResult.decodedCodes.length > 0 
                           ? result.codeResult.decodedCodes[0].confidence 
                           : 0;
        
        console.log("Barcode detected:", code, "Format:", result.codeResult.format, "Confidence:", confidence);

        // Only process if confidence is high and code is not empty
        if (confidence >= 0.8 && code.length > 0) { 
          // Draw bounding box
          if (result.box) {
            drawBoundingBox(result.box);
          }

          setDetectedBarcode(code);
          lastDetectionTime.current = currentTime; // Update last detection time for a valid detection
          
          // Auto-confirm after short delay
          setTimeout(() => {
            // Only confirm if the detectedBarcode state still matches the code we just detected
            setDetectedBarcode(currentDetectedBarcode => {
                if (currentDetectedBarcode === code) {
                    handleConfirmBarcode(); // Call the handler directly
                    return null; // Clear it immediately after handling
                }
                return currentDetectedBarcode; // Keep it if it changed (e.g., a new barcode was detected very quickly)
            });
          }, 500);
        }
      }
    });

    // Handle process frames for better performance and drawing guide box
    Quagga.onProcessed((result) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Added willReadFrequently
      if (!ctx) return;

      // Clear previous drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw guide box in the center (more subtle blue)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const boxWidth = canvas.width * 0.6; // 60% of canvas width
      const boxHeight = canvas.height * 0.3; // 30% of canvas height

      ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)'; // CornflowerBlue with transparency
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - boxWidth/2, centerY - boxHeight/2, boxWidth, boxHeight);
    });

    return () => {
      if (quaggaInitializedRef.current) {
        Quagga.stop();
        quaggaInitializedRef.current = false;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [onScan, scanningActive, detectedBarcode]); // Added detectedBarcode to dependencies for auto-confirm logic

  const handleCloseClick = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    onClose();
  };

  const handleConfirmBarcode = () => {
    if (detectedBarcode) {
      // Play success sound using the imported audio object
      beepSuccess.play().catch(() => console.log("Audio play failed"));
      
      onScan(detectedBarcode);
      setDetectedBarcode(null); // Clear detected barcode after processing
      setScanningActive(false); // Temporarily pause scanning
      
      // Resume scanning after short delay
      setTimeout(() => {
        setScanningActive(true);
      }, 1000);
    }
  };

  const handleCancelBarcode = () => {
    setDetectedBarcode(null); // Clear detected barcode
    setScanningActive(true); // Resume scanning immediately
  };

  const handleRetryCamera = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    setCameraError(null);
    setDetectedBarcode(null);
    setScanningActive(true);
    setIsInitializing(true);
    
    setTimeout(() => {
      if (videoRef.current) {
        const initializeQuagga = async () => {
          try {
            await Quagga.init({
              inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoRef.current,
                constraints: {
                  width: { min: 320 },
                  height: { min: 240 },
                  facingMode: "environment",
                },
                area: {
                  top: "20%",
                  right: "20%",
                  left: "20%",
                  bottom: "20%"
                }
              },
              locator: {
                patchSize: "medium",
                halfSample: false,
                minConfidence: 0.8,
              },
              numOfWorkers: 1,
              frequency: 10,
              decoder: {
                readers: ["code_128_reader", "ean_reader", "code_39_reader"],
              },
              locate: true,
            }, (err) => {
              if (err) {
                setCameraError("Gagal mengakses kamera setelah retry");
                setIsInitializing(false);
                return;
              }
              Quagga.start();
              setIsInitializing(false);
              setIsScanning(true);
              setCameraError(null);
              quaggaInitializedRef.current = true;
            });
          } catch (error) {
            setCameraError("Gagal mengakses kamera");
            setIsInitializing(false);
          }
        };
        initializeQuagga();
      }
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

      {detectedBarcode && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-30 p-4">
          <CheckCircle className="h-16 w-16 text-green-400 mb-4" />
          <p className="text-lg font-semibold mb-2">Barcode Terdeteksi!</p>
          <div className="bg-green-100 border border-green-300 rounded-md p-4 mb-4">
            <p className="text-green-800 font-mono text-xl font-bold">{detectedBarcode}</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleConfirmBarcode}
              className="bg-green-600 hover:bg-green-700 text-white px-6"
            >
              Konfirmasi
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelBarcode}
              className="border-white text-white hover:bg-white/20 px-6"
            >
              Scan Ulang
            </Button>
          </div>
        </div>
      )}
      
      <div className="relative">
        <div id="interactive" className="w-full h-64 relative" ref={videoRef} />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-64 pointer-events-none"
          style={{ zIndex: 20 }}
        />
      </div>
      
      {!cameraError && !detectedBarcode && (
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
      {!detectedBarcode && !cameraError && !isInitializing && (
        <div className="absolute bottom-4 left-0 right-0 text-center z-20">
          <p className="text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full inline-block">
            Arahkan barcode ke tengah layar
          </p>
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerQuagga;