import React, { useEffect, useRef, useState, useCallback } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, CameraOff, AlertTriangle } from 'lucide-react';
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
  const [overlayText, setOverlayText] = useState<string | null>(null); // New state for text on overlay
  const [boundingBox, setBoundingBox] = useState<any | null>(null); // New state for bounding box
  const quaggaInitializedRef = useRef(false);
  const lastProcessedCodeRef = useRef<string | null>(null); // To track last processed code
  const lastProcessedTimeRef = useRef<number>(0); // To track last processed time
  const detectionCooldown = 1500; // Cooldown for processing the same barcode (1.5 seconds)

  // Function to draw all overlays (guide box, bounding box, text)
  const drawOverlays = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous frame

    // Draw guide box in the center
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
      ctx.beginPath();
      ctx.moveTo(boundingBox[0][0], boundingBox[0][1]);
      for (let i = 1; i < boundingBox.length; i++) {
        ctx.lineTo(boundingBox[i][0], boundingBox[i][1]);
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
    if (!videoRef.current || quaggaInitializedRef.current) return;

    const initializeQuagga = async () => {
      setIsInitializing(true);
      setCameraError(null);
      setOverlayText(null);
      setBoundingBox(null);

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
            readers: [
              "code_128_reader",
              "ean_reader",
              "code_39_reader"
            ],
          },
          locate: true,
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

    Quagga.onDetected((result) => {
      if (!isScanning || isInitializing) return; // Only process if actively scanning and not initializing

      const currentTime = Date.now();
      const code = result?.codeResult?.code?.trim();
      const confidence = result.codeResult.decodedCodes && result.codeResult.decodedCodes.length > 0 
                           ? result.codeResult.decodedCodes[0].confidence 
                           : 0;
      
      if (code && code.length > 0 && confidence >= 0.8) {
        setOverlayText(code); // Display the detected code on the canvas
        setBoundingBox(result.box); // Store bounding box for drawing

        // Check if this is a new code or if enough time has passed since the last *processed* code
        if (code !== lastProcessedCodeRef.current || (currentTime - lastProcessedTimeRef.current > detectionCooldown)) {
          lastProcessedCodeRef.current = code;
          lastProcessedTimeRef.current = currentTime;

          onScan(code); // Directly send to textbox and process
          beepSuccess.play().catch(() => console.log("Audio play failed"));

          // Temporarily pause scanning to prevent immediate re-processing of the same barcode
          setIsScanning(false);
          setTimeout(() => {
            setIsScanning(true);
            setOverlayText(null); // Clear overlay text after processing and brief pause
            setBoundingBox(null); // Clear bounding box
          }, 1500); // Pause for 1.5 seconds
        }
      }
    });

    Quagga.onProcessed((result) => {
      // This callback is used for continuous drawing of overlays
      drawOverlays();
    });

    return () => {
      if (quaggaInitializedRef.current) {
        Quagga.stop();
        quaggaInitializedRef.current = false;
      }
    };
  }, [onScan, isScanning, isInitializing, drawOverlays]); // Added drawOverlays to dependencies

  const handleCloseClick = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    onClose();
  };

  const handleRetryCamera = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    setCameraError(null);
    setOverlayText(null);
    setBoundingBox(null);
    setIsInitializing(true);
    setIsScanning(false); // Ensure scanning is off before re-init
    
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
      
      <div className="relative">
        <div id="interactive" className="w-full h-64 relative" ref={videoRef} />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-64 pointer-events-none"
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

      {/* Scanning guide text */}
      {!cameraError && !isInitializing && (
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