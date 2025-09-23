import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XCircle, Loader2, CameraOff, AlertTriangle, Keyboard, Check, X } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

interface BarcodeScannerQuaggaProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

interface DetectionPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BarcodeScannerQuagga: React.FC<BarcodeScannerQuaggaProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [detectionPosition, setDetectionPosition] = useState<DetectionPosition | null>(null);
  const quaggaInitializedRef = useRef(false);
  const lastDetectionTime = useRef<number>(0);
  const detectionCooldown = 2000; // 2 seconds cooldown between detections

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setCameraError("Browser environment not detected");
      setIsInitializing(false);
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access not supported in this browser");
      setIsInitializing(false);
      return;
    }

    // Check if we're on HTTPS (required for camera access)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setCameraError("Camera access requires HTTPS connection");
      setIsInitializing(false);
      return;
    }

    if (!videoRef.current || quaggaInitializedRef.current) return;

    const initializeQuagga = async () => {
      setIsInitializing(true);
      setIsScanning(false);
      setCameraError(null);
      quaggaInitializedRef.current = true;

      try {
        await Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: videoRef.current,
            constraints: {
              width: { min: 640 },
              height: { min: 480 },
              aspectRatio: { min: 1, max: 100 },
              facingMode: "environment",
            },
          },
          locator: {
            patchSize: "large", // Changed to large for better detection
            halfSample: false, // Disable half sample for more accurate reading
            debug: {
              showCanvas: false, // Disable canvas overlay
              showPatches: false, // Disable patches overlay
              showFoundPatches: false,
              showSkeleton: false,
              showLabels: false,
              showTestMarkers: false,
              showQuagga: false,
            },
          },
          numOfWorkers: Math.max(1, navigator.hardwareConcurrency - 1), // Use fewer workers
          locate: true,
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader",
              "code_39_reader",
            ],
          },
          frequency: 10, // Lower frequency for slower scanning
        }, (err) => {
          if (err) {
            console.error("QuaggaJS initialization error:", err);
            let errorMessage = "Gagal mengakses kamera";
            
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              errorMessage = "Izin akses kamera ditolak. Silakan berikan izin akses kamera di pengaturan browser Anda.";
            } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
              errorMessage = "Tidak ada kamera yang ditemukan. Pastikan perangkat Anda memiliki kamera yang berfungsi.";
            } else if (err.name === 'NotReadableError') {
              errorMessage = "Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang menggunakan kamera dan coba lagi.";
            } else if (err.name === 'AbortError') {
              errorMessage = "Operasi kamera dibatalkan. Silakan coba lagi.";
            } else if (err.message?.includes('getUserMedia')) {
              errorMessage = "Browser tidak mendukung akses kamera. Pastikan Anda menggunakan browser modern seperti Chrome, Firefox, atau Safari.";
            }
            
            setCameraError(errorMessage);
            setIsInitializing(false);
            quaggaInitializedRef.current = false;
            return;
          }
          console.log("QuaggaJS initialization finished. Starting...");
          Quagga.start();
          setIsInitializing(false);
          setIsScanning(true);
          showSuccess("Kamera siap digunakan");
        });
      } catch (error: any) {
        console.error("QuaggaJS init promise error:", error);
        const errorMessage = error.message || "Terjadi kesalahan tak terduga saat mengakses kamera";
        setCameraError(errorMessage);
        setIsInitializing(false);
        quaggaInitializedRef.current = false;
      }
    };

    initializeQuagga();

    Quagga.onDetected((result) => {
      const currentTime = Date.now();
      
      // Cooldown mechanism to prevent rapid detections
      if (currentTime - lastDetectionTime.current < detectionCooldown) {
        return;
      }

      if (result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        console.log("Barcode detected:", code);
        
        // Validate barcode length to prevent partial reads
        if (code.length < 5) {
          console.log("Barcode too short, likely partial read:", code);
          return;
        }
        
        // Get the position of the detected barcode
        if (result.box) {
          const box = result.box;
          const position: DetectionPosition = {
            x: box[0][0],
            y: box[0][1],
            width: box[2][0] - box[0][0],
            height: box[2][1] - box[0][1]
          };
          setDetectionPosition(position);
        }
        
        setDetectedBarcode(code);
        lastDetectionTime.current = currentTime;
      }
    });

    return () => {
      if (quaggaInitializedRef.current) {
        Quagga.stop();
        console.log("QuaggaJS stopped.");
        quaggaInitializedRef.current = false;
      }
    };
  }, [onScan, onClose]);

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
    setIsInitializing(true);
    setShowManualInput(false);
    setDetectedBarcode(null);
    setDetectionPosition(null);
    
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
                  aspectRatio: { min: 1, max: 100 },
                  facingMode: "environment",
                },
              },
              locator: {
                patchSize: "large",
                halfSample: false,
                debug: {
                  showCanvas: false,
                  showPatches: false,
                  showFoundPatches: false,
                  showSkeleton: false,
                  showLabels: false,
                  showTestMarkers: false,
                  showQuagga: false,
                },
              },
              numOfWorkers: Math.max(1, navigator.hardwareConcurrency - 1),
              locate: true,
              decoder: {
                readers: [
                  "code_128_reader",
                  "ean_reader",
                  "code_39_reader",
                ],
              },
              frequency: 10,
            }, (err) => {
              if (err) {
                setCameraError("Gagal mengakses kamera setelah percobaan ulang");
                setIsInitializing(false);
                quaggaInitializedRef.current = false;
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
            quaggaInitializedRef.current = false;
          }
        };
        initializeQuagga();
      }
    }, 500);
  };

  const handleManualInput = () => {
    if (manualInput.trim()) {
      // Play sound when manually entering barcode
      const beepStart = new Audio('/sounds/beep-start.mp3');
      beepStart.play().catch(() => console.log("Audio play failed"));
      
      onScan(manualInput.trim());
      setManualInput('');
      setShowManualInput(false);
    }
  };

  const handleConfirmBarcode = () => {
    if (detectedBarcode) {
      // Play sound when confirming barcode
      const beepStart = new Audio('/sounds/beep-start.mp3');
      beepStart.play().catch(() => console.log("Audio play failed"));
      
      onScan(detectedBarcode);
      setDetectedBarcode(null);
      setDetectionPosition(null);
    }
  };

  const handleCancelBarcode = () => {
    setDetectedBarcode(null);
    setDetectionPosition(null);
  };

  return (
    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden">
      {isInitializing && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 text-white z-10 p-4">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Memulai kamera...</p>
        </div>
      )}
      
      {cameraError && !showManualInput && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10 p-4">
          <AlertTriangle className="h-12 w-12 mb-4 text-yellow-400" />
          <p className="text-center mb-4">{cameraError}</p>
          <p className="text-sm text-center mb-6 text-gray-300">
            Kamera tidak dapat diakses karena koneksi HTTP. 
            Gunakan input manual atau coba dengan koneksi HTTPS.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowManualInput(true)}
              className="bg-blue-600 hover:bg-blue-700 mb-2"
            >
              <Keyboard className="mr-2 h-4 w-4" />
              Input Manual
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryCamera}
              className="text-white border-white hover:bg-white/20"
            >
              Coba Lagi Kamera
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseClick}
              className="text-white border-white hover:bg-white/20"
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {showManualInput && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10 p-4">
          <Keyboard className="h-12 w-12 mb-4 text-blue-400" />
          <h3 className="text-lg font-semibold mb-2">Input Manual Resi</h3>
          <div className="w-full max-w-xs mb-4">
            <Input
              ref={manualInputRef}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Masukkan nomor resi"
              className="text-gray-800 h-12 text-center text-lg"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  // Play sound on Enter key
                  const beepStart = new Audio('/sounds/beep-start.mp3');
                  beepStart.play().catch(() => console.log("Audio play failed"));
                  handleManualInput();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleManualInput}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!manualInput.trim()}
            >
              Simpan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualInput(false)}
              className="text-white border-white hover:bg-white/20"
            >
              Kembali
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
                <Check className="mr-2 h-4 w-4" />
                Konfirmasi
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelBarcode}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <X className="mr-2 h-4 w-4" />
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div id="interactive" className="w-full h-64 relative" ref={videoRef}>
        {/* Camera view only - no overlay boxes */}
      </div>
      
      {!cameraError && !detectedBarcode && (
        <div className="absolute top-2 right-2 flex gap-2 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setShowManualInput(true)}
            title="Input Manual"
          >
            <Keyboard className="h-6 w-6" />
          </Button>
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