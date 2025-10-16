import React, { useRef, useState, useEffect } from 'react';
import { Trash2, Save, ArrowLeft } from 'lucide-react';
import './VendorSignatureCanvas.css';

const VendorSignatureCanvas = ({ vendorName, vendorEmail, onSave, onCancel }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 150 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(
      e.clientX - rect.left || e.touches[0].clientX - rect.left,
      e.clientY - rect.top || e.touches[0].clientY - rect.top
    );
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    const x = e.clientX - rect.left || e.touches[0]?.clientX - rect.left;
    const y = e.clientY - rect.top || e.touches[0]?.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');

    // Check if canvas has content (not blank)
    const ctx = canvas.getContext('2d');
    const imageDataArray = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let isBlank = true;

    for (let i = 3; i < imageDataArray.length; i += 4) {
      if (imageDataArray[i] !== 0) {
        isBlank = false;
        break;
      }
    }

    if (isBlank) {
      alert('Please draw your signature before saving.');
      return;
    }

    setIsSaving(true);
    setSignatureData(imageData);

    try {
      await onSave({
        signatureData: imageData,
        vendorName,
        vendorEmail,
        signedAt: new Date().toISOString(),
        canvas: {
          width: canvas.width,
          height: canvas.height,
        },
      });
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Failed to save signature. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="vendor-signature-container">
      <header className="signature-header">
        <h3>Vendor Signature</h3>
        <p>Please sign below to authorize the contract</p>
        <section className="vendor-info-display">
          <span className="vendor-name">{vendorName}</span>
          <span className="vendor-email">{vendorEmail}</span>
        </section>
      </header>

      <section className="signature-canvas-wrapper">
        <label className="canvas-label">Your Signature</label>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="signature-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <p className="canvas-hint">Draw your signature above using mouse or touch</p>
      </section>

      <section className="signature-actions">
        <button
          className="btn-clear"
          onClick={clearSignature}
          type="button"
        >
          <Trash2 size={16} />
          Clear
        </button>
        <button
          className="btn-cancel"
          onClick={onCancel}
          type="button"
        >
          <ArrowLeft size={16} />
          Cancel
        </button>
        <button
          className="btn-save-signature"
          onClick={handleSaveSignature}
          disabled={isSaving}
          type="button"
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save Signature'}
        </button>
      </section>
    </article>
  );
};

export default VendorSignatureCanvas;