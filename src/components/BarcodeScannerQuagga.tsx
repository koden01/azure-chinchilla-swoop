import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, CameraOff, AlertTriangle } from 'lucide-react';

interface BarcodeScannerQuaggaProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScannerQuagga: React.FC<BarcodeScannerQuaggaProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const quaggaInitializedRef = useRef(false);
  const lastDetectionTime = useRef<number>(0);
  const detectionCooldown = 2000;

  useEffect(() => {
    if (!videoRef.current || quaggaInitializedRef.current) return;

    const initializeQuagga = async () => {
      setIsInitializing(true);
      setCameraError(null);

      try {
        // Test camera access first
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
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
              width: { min: 640, ideal: 1280 },
              height: { min: 480, ideal: 720 },
              aspectRatio: { min: 1, max: 2 },
              facingMode: "environment",
            },
          },
          locator: {
            patchSize: "large",
            halfSample: true,
          },
          numOfWorkers: 1,
          frequency: 3,
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader",
              "code_39_reader"
            ],
          },
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
      const currentTime = Date.now();
      
      if (currentTime - lastDetectionTime.current < detectionCooldown) {
        return;
      }

      if (result?.codeResult?.code) {
        const code = result.codeResult.code.trim();
        console.log("Barcode detected:", code);
        
        // Validate barcode length
        if (code.length >= 5) {
          setDetectedBarcode(code);
          lastDetectionTime.current = currentTime;
        }
      }
    });

    return () => {
      if (quaggaInitializedRef.current) {
        Quagga.stop();
        quaggaInitializedRef.current = false;
      }
    };
  }, [onScan]);

  const handleCloseClick = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    onClose();
  };

  const handleConfirmBarcode = () => {
    if (detectedBarcode) {
      // Play start sound on confirm
      const beepStart = new Audio('/sounds/beep-start.mp3');
      beepStart.play().catch(() => console.log("Audio play failed"));
      
      onScan(detectedBarcode);
      setDetectedBarcode(null);
    }
  };

  const handleCancelBarcode = () => {
    setDetectedBarcode(null);
  };

  const handleRetryCamera = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    setCameraError(null);
    setDetectedBarcode(null);
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
                  width: { min: 640 },
                  height: { min: 480 },
                  facingMode: "environment",
                },
              },
              locator: {
                patchSize: "large",
                halfSample: true,
              },
              numOfWorkers: 1,
              frequency: 3,
              decoder: {
                readers: ["code_128_reader", "ean_reader", "code_39_reader"],
              },
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
        <div className="absolute top-full left-0 right-0 bg-white rounded-b-lg p-4 shadow-lg z-30 mt-2">
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 mb-2">Barcode Terdeteksi</p>
            <div className="bg-green-100 border border-green-300 rounded-md p-3 mb-3">
              <p className="text-green-800 font-mono text-lg font-bold">{detectedBarcode}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                size="sm"
                onClick={handleConfirmBarcode}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Konfirmasi
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelBarcode}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div id="interactive" className="w-full h-64 relative" ref={videoRef} />
      
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
    </div>
  );
};

export default BarcodeScannerQuagga;