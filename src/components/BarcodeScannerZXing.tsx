import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, Result, IScannerControls } from '@zxing/library'; // Import IScannerControls
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, CameraOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { beepSuccess } from '@/utils/audio';

interface BarcodeScannerZXingProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScannerZXing: React.FC<BarcodeScannerZXingProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stream: MediaStream | null; videoElement: HTMLVideoElement | null }>({ stream: null, videoElement: null });

  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false); // To control if ZXing is actively decoding

  const drawOverlay = useCallback((text: string | null) => {
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

    if (text) {
      // Draw a semi-transparent background for the text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, canvas.height - 60, canvas.width, 60); // Bottom bar

      // Draw the detected barcode text
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#00ff00'; // Green text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height - 30);
    }
  }, []);

  useEffect(() => {
    const hints = new Map();
    const formats = [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.QR_CODE, // Added QR_CODE for broader detection
      BarcodeFormat.CODE_39,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true); // Try harder for better detection

    const codeReader = new BrowserMultiFormatReader(hints);
    codeReaderRef.current = codeReader;

    const startScanning = async () => {
      setIsInitializing(true);
      setCameraError(null);
      setDetectedBarcode(null);

      try {
        const videoInputDevices = await codeReader.listVideoInputDevices(); 
        if (videoInputDevices.length === 0) {
          throw new Error("Tidak ada perangkat kamera yang ditemukan.");
        }

        // Try to find an 'environment' (back) camera
        const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
        const deviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[0].deviceId;

        if (videoRef.current) {
          controlsRef.current.videoElement = videoRef.current;
          // FIX 1: Correct callback signature and stream access
          codeReader.decodeFromVideoDevice(deviceId, videoRef.current, (result: Result | undefined, error: Error | undefined, controls: IScannerControls) => { 
            if (result) {
              console.log('ZXing Barcode detected:', result.getText(), 'Format:', result.getBarcodeFormat().toString());
              if (!detectedBarcode) { // Only set if no barcode is currently detected
                setDetectedBarcode(result.getText());
                setIsScanning(false); // Pause active scanning
                drawOverlay(result.getText()); // Draw the detected text
                controlsRef.current.stream = controls.stream; // Store stream for manual stop if needed
                // ZXing automatically pauses decoding when a result is found,
                // but we explicitly set isScanning to false to control UI.
              }
            }
            if (error && !result) {
              // Only log errors if no result was found, to avoid spamming for intermittent errors
              // console.error('ZXing Decoding error:', error);
            }
          });
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
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
      if (controlsRef.current.stream) {
        controlsRef.current.stream.getTracks().forEach(track => track.stop());
        controlsRef.current.stream = null;
      }
    };
  }, [drawOverlay, detectedBarcode]); // Re-run effect if detectedBarcode changes to manage scanning state

  useEffect(() => {
    // Clear overlay when detectedBarcode is cleared
    if (!detectedBarcode) {
      drawOverlay(null);
      if (codeReaderRef.current && !isScanning && !isInitializing && !cameraError) {
        // Resume scanning if it was paused due to detection and now cleared
        // This is handled by ZXing's internal state, but we ensure our UI state is consistent
        setIsScanning(true);
        // No need to call decodeFromVideoDevice again, as it's continuous
      }
    }
  }, [detectedBarcode, drawOverlay, isScanning, isInitializing, cameraError]);

  const handleCloseClick = () => {
    onClose();
  };

  const handleConfirmBarcode = () => {
    if (detectedBarcode) {
      beepSuccess.play().catch(() => console.log("Audio play failed"));
      onScan(detectedBarcode); // Send to parent component
      setDetectedBarcode(null); // Clear detected barcode
      setIsScanning(true); // Resume scanning
    }
  };

  const handleCancelBarcode = () => {
    setDetectedBarcode(null); // Clear detected barcode
    setIsScanning(true); // Resume scanning
  };

  const handleRetryCamera = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setIsInitializing(true);
    setCameraError(null);
    setDetectedBarcode(null);
    setIsScanning(false); // Ensure scanning is off before re-init
    
    // Re-initialize after a short delay
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
            // FIX 2: Correct callback signature and stream access
            codeReader.decodeFromVideoDevice(deviceId, videoRef.current, (result: Result | undefined, error: Error | undefined, controls: IScannerControls) => {
              if (result) {
                if (!detectedBarcode) {
                  setDetectedBarcode(result.getText());
                  setIsScanning(false);
                  drawOverlay(result.getText());
                  controlsRef.current.stream = controls.stream;
                }
              }
            });
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
        <video id="video" ref={videoRef} className="w-full h-64 object-cover" style={{ transform: 'scaleX(-1)' }} /> {/* Added transform for mirror effect */}
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

export default BarcodeScannerZXing;