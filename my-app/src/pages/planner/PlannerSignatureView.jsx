import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Calendar, Type, CheckSquare, Send, Save, FileCheck, AlertCircle } from 'lucide-react';
import './PlannerSignatureView.css';

const PlannerSignatureView = ({ contract, onFinalize, onSaveDraft, onClose }) => {
  const [signatureData, setSignatureData] = useState({});
  const [isSigning, setIsSigning] = useState(false);
  const canvasRefs = useRef({});

  const fieldTypes = {
    signature: { icon: Edit3, color: '#2563eb', label: 'Signature' },
    initial: { icon: Type, color: '#7c3aed', label: 'Initial' },
    date: { icon: Calendar, color: '#059669', label: 'Date' },
    text: { icon: Type, color: '#d97706', label: 'Text' },
    checkbox: { icon: CheckSquare, color: '#dc2626', label: 'Checkbox' }
  };

  // Load draft signatures if they exist
  useEffect(() => {
    if (contract.signatureFields) {
      const draftData = {};
      contract.signatureFields.forEach((field) => {
        if (field.draftSignature && !field.signed && field.signerRole === 'client') {
          draftData[field.id] = field.draftSignature;
        }
      });
      if (Object.keys(draftData).length > 0) {
        setSignatureData(draftData);
      }
    }
  }, [contract]);

  // Initialize canvases with white background (ONLY for signature fields, not initials)
  useEffect(() => {
    const clientFields = contract.signatureFields?.filter(
      field => field.signerRole === 'client' && field.signed !== true
    ) || [];

    clientFields.forEach((field) => {
      // FIXED: Only initialize canvas for signature fields, not initials
      if (field.type === 'signature' && canvasRefs.current[field.id]) {
        const canvas = canvasRefs.current[field.id];
        const ctx = canvas.getContext('2d');
        
        // Set white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // If there's draft signature data, draw it
        if (signatureData[field.id]) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = signatureData[field.id];
        }
      }
    });
  }, [contract, signatureData]);

  // FIXED: Filter fields for client to sign - exclude already signed fields
  const clientFields = contract.signatureFields?.filter(
    field => field.signerRole === 'client' && field.signed !== true
  ) || [];

  // FIXED: Check if already completed more strictly
  const isCompleted = contract.signatureWorkflow?.workflowStatus === 'completed' &&
                      clientFields.length === 0;

  // Canvas drawing functions for signature fields ONLY
  const startDrawing = (fieldId, e) => {
    const canvas = canvasRefs.current[fieldId];
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    canvasRefs.current[`${fieldId}_isDrawing`] = true;
    canvasRefs.current[`${fieldId}_prevPosition`] = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleSign = (fieldId, e) => {
    if (!canvasRefs.current[`${fieldId}_isDrawing`]) return;
    
    e.preventDefault();
    
    const canvas = canvasRefs.current[fieldId];
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const currentPosition = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(
      canvasRefs.current[`${fieldId}_prevPosition`].x,
      canvasRefs.current[`${fieldId}_prevPosition`].y
    );
    ctx.lineTo(currentPosition.x, currentPosition.y);
    ctx.stroke();

    canvasRefs.current[`${fieldId}_prevPosition`] = currentPosition;
  };

  const stopDrawing = (fieldId) => {
    if (!canvasRefs.current[`${fieldId}_isDrawing`]) return;
    
    canvasRefs.current[`${fieldId}_isDrawing`] = false;
    canvasRefs.current[`${fieldId}_prevPosition`] = null;
    
    const canvas = canvasRefs.current[fieldId];
    if (canvas) {
      setSignatureData(prev => ({
        ...prev,
        [fieldId]: canvas.toDataURL('image/png'),
      }));
    }
  };

  const clearSignature = (fieldId) => {
    const canvas = canvasRefs.current[fieldId];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      setSignatureData(prev => {
        const newData = { ...prev };
        delete newData[fieldId];
        return newData;
      });
    }
  };

  const handleTextChange = (fieldId, value) => {
    setSignatureData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleCheckboxChange = (fieldId, checked) => {
    setSignatureData(prev => ({
      ...prev,
      [fieldId]: checked
    }));
  };

  const handleDateChange = (fieldId) => {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    setSignatureData(prev => ({
      ...prev,
      [fieldId]: today
    }));
  };

  // FIXED: New handler for initials as text input
  const handleInitialsChange = (fieldId, value) => {
    // Limit to 3-4 characters for initials
    const initials = value.toUpperCase().slice(0, 4);
    setSignatureData(prev => ({
      ...prev,
      [fieldId]: initials
    }));
  };

  const handleSaveDraft = async () => {
    if (Object.keys(signatureData).length === 0) {
      alert('Please fill in at least one field before saving draft');
      return;
    }
    setIsSigning(true);
    try {
      await onSaveDraft(signatureData);
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft. Please try again.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleFinalize = async () => {
    const requiredFields = clientFields.filter(f => f.required);
    const missingRequired = requiredFields.filter(f => !signatureData[f.id]);
    
    if (missingRequired.length > 0) {
      alert(`Please complete all required fields: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    const confirmSign = window.confirm(
      '🎉 Are you sure you want to finalize and submit these signatures?\n\nThis will complete the contract signing process and cannot be undone.\n\nThe signed contract will be generated with all signature details attached.'
    );
    if (!confirmSign) return;

    setIsSigning(true);
    try {
      await onFinalize(signatureData);
    } catch (error) {
      console.error('Error finalizing:', error);
      alert('Failed to finalize contract. Please try again.');
    } finally {
      setIsSigning(false);
    }
  };

  const renderField = (field) => {
    const fieldType = fieldTypes[field.type] || fieldTypes.signature;
    const Icon = fieldType.icon;

    return (
      <div key={field.id} className="signature-field-planner" style={{ borderLeftColor: fieldType.color }}>
        <div className="field-header-planner">
          <div className="field-title-planner" style={{ color: fieldType.color }}>
            <Icon size={18} />
            <span>{field.label}</span>
            {field.required && <span className="required-star-planner">*</span>}
          </div>
          <span className="field-type-badge" style={{ 
            background: `${fieldType.color}15`, 
            color: fieldType.color,
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            {fieldType.label}
          </span>
        </div>

        <div className="field-body-planner">
          {/* FIXED: Only signature fields use canvas */}
          {field.type === 'signature' && (
            <div className="canvas-container-planner">
              <div className="canvas-wrapper">
                <canvas
                  ref={el => {
                    if (el && !canvasRefs.current[field.id]) {
                      canvasRefs.current[field.id] = el;
                      const ctx = el.getContext('2d');
                      ctx.fillStyle = '#ffffff';
                      ctx.fillRect(0, 0, el.width, el.height);
                    }
                  }}
                  width={field.position?.width || 400}
                  height={field.position?.height || 100}
                  className="signature-canvas-planner"
                  onMouseDown={e => startDrawing(field.id, e)}
                  onMouseMove={e => handleSign(field.id, e)}
                  onMouseUp={() => stopDrawing(field.id)}
                  onMouseLeave={() => stopDrawing(field.id)}
                  onTouchStart={e => startDrawing(field.id, e)}
                  onTouchMove={e => handleSign(field.id, e)}
                  onTouchEnd={() => stopDrawing(field.id)}
                  style={{ 
                    borderColor: fieldType.color,
                    touchAction: 'none'
                  }}
                />
              </div>
              {signatureData[field.id] && (
                <button
                  type="button"
                  onClick={() => clearSignature(field.id)}
                  className="clear-btn-planner"
                >
                  Clear
                </button>
              )}
              <p className="canvas-hint-planner">
                ✏️ Draw your signature above using your mouse or touchscreen
              </p>
            </div>
          )}

          {/* FIXED: Initials now use text input instead of canvas */}
          {field.type === 'initial' && (
            <div className="text-field-wrapper">
              <input
                type="text"
                value={signatureData[field.id] || ''}
                onChange={e => handleInitialsChange(field.id, e.target.value)}
                placeholder="Enter your initials (e.g., JD)"
                className="text-input-planner initials-input"
                maxLength={4}
                style={{ 
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: '600',
                  fontSize: '1.1rem'
                }}
              />
              <p className="canvas-hint-planner" style={{ borderLeftColor: fieldType.color }}>
                ✍️ Type your initials (2-4 characters, will be converted to uppercase)
              </p>
            </div>
          )}

          {field.type === 'date' && (
            <div className="date-field-planner">
              <input
                type="text"
                value={signatureData[field.id] || ''}
                readOnly
                placeholder="Click 'Use Today' to set date"
                className="date-input-planner"
              />
              <button
                type="button"
                onClick={() => handleDateChange(field.id)}
                className="date-btn-planner"
              >
                <Calendar size={16} />
                Use Today's Date
              </button>
            </div>
          )}

          {field.type === 'text' && (
            <div className="text-field-wrapper">
              <input
                type="text"
                value={signatureData[field.id] || ''}
                onChange={e => handleTextChange(field.id, e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="text-input-planner"
              />
              {signatureData[field.id] && (
                <span className="char-count">{signatureData[field.id].length} characters</span>
              )}
            </div>
          )}

          {field.type === 'checkbox' && (
            <label className="checkbox-label-planner">
              <input
                type="checkbox"
                checked={signatureData[field.id] || false}
                onChange={e => handleCheckboxChange(field.id, e.target.checked)}
                className="checkbox-input-planner"
              />
              <span>I agree / I acknowledge this term</span>
            </label>
          )}
        </div>
      </div>
    );
  };

  // If contract is already completed
  if (isCompleted) {
    return (
      <div className="signature-complete-planner">
        <div className="complete-icon-planner">
          <FileCheck size={64} color="#059669" />
        </div>
        <h2>✅ Contract Signed Successfully!</h2>
        <p>This contract has been completed and signed.</p>
        <p className="signed-date-planner">
          📅 Signed on: {contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
        <p style={{ marginTop: '1rem', color: '#047857', fontSize: '0.95rem' }}>
          The signed contract with all signature details has been saved and can be downloaded.
        </p>
        <button onClick={onClose} className="btn-close-planner">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="planner-signature-container">
      {/* PDF Viewer Section */}
      <div className="pdf-viewer-section-planner">
        <div className="pdf-header-planner">
          <h3>📄 Contract Document</h3>
          <p>Review the contract below, then scroll down to complete the signature fields</p>
        </div>
        
        <div className="pdf-viewer-wrapper-planner">
          <iframe
            src={`${contract.contractUrl}#toolbar=1&navpanes=0&scrollbar=1`}
            className="pdf-iframe-planner"
            title="Contract PDF"
          />
        </div>
      </div>

      {/* Signature Fields Section */}
      <div className="signature-fields-section-planner">
        <div className="fields-header-planner">
          <h3>✏️ Complete Signature Fields</h3>
          <p>The vendor has configured {clientFields.length} field{clientFields.length !== 1 ? 's' : ''} for you to complete</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Fields marked with <span style={{color: '#dc2626', fontWeight: 'bold'}}>*</span> are required
          </p>
        </div>

        {clientFields.length === 0 ? (
          <div className="no-fields-planner">
            <AlertCircle size={48} color="#64748b" />
            <p>No signature fields require your attention.</p>
            <p style={{fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem'}}>
              The vendor has not configured any fields for you to sign.
            </p>
          </div>
        ) : (
          <>
            <div className="fields-list-planner">
              {clientFields.map(renderField)}
            </div>

            {/* Progress Indicator */}
            <div className="progress-indicator">
              <div className="progress-text">
                <span>Progress: {Object.keys(signatureData).length} of {clientFields.length} fields completed</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(Object.keys(signatureData).length / clientFields.length) * 100}%` 
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons-planner">
              <button
                onClick={handleSaveDraft}
                disabled={isSigning || Object.keys(signatureData).length === 0}
                className="btn-draft-planner"
              >
                <Save size={18} />
                {isSigning ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handleFinalize}
                disabled={isSigning}
                className="btn-finalize-planner"
              >
                <Send size={18} />
                {isSigning ? 'Submitting...' : 'Finalize & Submit'}
              </button>
            </div>

            <div className="signing-notice-planner">
              <p>
                <strong>⚖️ Legal Notice:</strong> By clicking "Finalize & Submit", you agree that this electronic signature
                has the same legal effect as a handwritten signature. All signature details including timestamps, 
                IP address, and field data will be permanently attached to the final contract PDF.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlannerSignatureView;