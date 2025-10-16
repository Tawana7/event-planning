import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Calendar, Type, Save, Send, Trash2 } from 'lucide-react';
import './PDFSignatureEditor.css';

const PDFSignatureEditor = ({ contractUrl, onSave, onSend, savedFields }) => {
  const [signatureFields, setSignatureFields] = useState([]);
  const [pdfDimensions] = useState({ width: 816, height: 1056 });
  const [estimatedPages, setEstimatedPages] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  const pdfViewerRef = useRef(null);

  // FIXED: Only signature, initial, and date fields
  const fieldTypes = [
    { type: 'signature', icon: Edit3, label: 'Signature', color: '#2563eb', defaultWidth: 200, defaultHeight: 60 },
    { type: 'initial', icon: Type, label: 'Initial', color: '#7c3aed', defaultWidth: 100, defaultHeight: 40 },
    { type: 'date', icon: Calendar, label: 'Date', color: '#059669', defaultWidth: 120, defaultHeight: 30 }
  ];

  const signerRoles = ['vendor', 'client', 'witness'];

  // Update saved status when savedFields changes
  useEffect(() => {
    if (savedFields) {
      setIsSaved(true);
    }
  }, [savedFields]);

  // Detect PDF pages on load
  useEffect(() => {
    if (contractUrl && pdfViewerRef.current) {
      detectPDFPages();
    }
  }, [contractUrl]);

  const detectPDFPages = async () => {
    const tempObject = document.createElement('object');
    tempObject.data = contractUrl;
    tempObject.style.position = 'absolute';
    tempObject.style.visibility = 'hidden';
    document.body.appendChild(tempObject);

    tempObject.onload = () => {
      const observer = new ResizeObserver((entries) => {
        const contentHeight = entries[0].contentRect.height;
        const possiblePageHeights = [1056, 1123, 792, 1224];
        let estimatedPageHeight = 1056;
        let minDiff = Infinity;
        
        for (const ph of possiblePageHeights) {
          const pageCount = Math.round(contentHeight / ph);
          const diff = Math.abs(contentHeight / pageCount - ph);
          if (diff < minDiff && pageCount > 0) {
            minDiff = diff;
            estimatedPageHeight = ph;
          }
        }
        
        const estimatedPageCount = Math.max(1, Math.round(contentHeight / estimatedPageHeight));
        setEstimatedPages(estimatedPageCount);
        document.body.removeChild(tempObject);
        observer.disconnect();
      });
      observer.observe(tempObject);
    };

    tempObject.onerror = () => {
      console.error('Error loading PDF for page detection');
      setEstimatedPages(1);
      document.body.removeChild(tempObject);
    };
  };

  const handleAddField = (fieldType) => {
    const fieldConfig = fieldTypes.find(f => f.type === fieldType);
    
    // Calculate position at bottom-right of LAST page
    const lastPage = estimatedPages;
    const pageHeight = pdfDimensions.height;
    const pageWidth = pdfDimensions.width;
    
    // Calculate how many fields of this type already exist to stack them
    const existingFieldsOfType = signatureFields.filter(f => f.type === fieldType).length;
    const verticalOffset = existingFieldsOfType * (fieldConfig.defaultHeight + 20);
    
    const xPosition = pageWidth - fieldConfig.defaultWidth - 50;
    const yPosition = pageHeight - fieldConfig.defaultHeight - 80 - verticalOffset;
    
    const newField = {
      id: `field_${Date.now()}`,
      type: fieldType,
      label: `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field`,
      signerRole: 'client',
      signerEmail: '',
      required: true,
      position: {
        page: lastPage,
        x: Math.max(0, xPosition),
        y: Math.max(0, yPosition),
        width: fieldConfig.defaultWidth,
        height: fieldConfig.defaultHeight
      },
      signed: false,
      signedAt: null,
      signatureData: null
    };

    setSignatureFields([...signatureFields, newField]);
    setIsSaved(false); // Mark as unsaved when fields change
  };

  const updateFieldProperty = (fieldId, property, value) => {
    setSignatureFields(fields =>
      fields.map(field =>
        field.id === fieldId ? { ...field, [property]: value } : field
      )
    );
    setIsSaved(false); // Mark as unsaved when fields change
  };

  const deleteField = (fieldId) => {
    setSignatureFields(fields => fields.filter(field => field.id !== fieldId));
    setIsSaved(false); // Mark as unsaved when fields change
  };

  const handleSave = () => {
    if (signatureFields.length === 0) {
      alert('⚠️ Please add at least one signature field before saving.');
      return;
    }

    const missingEmails = signatureFields.filter(field => !field.signerEmail);
    if (missingEmails.length > 0) {
      alert('⚠️ Please specify signer emails for all fields.');
      return;
    }

    console.log('Saving fields:', signatureFields);
    onSave(signatureFields);
  };

  const handleSendForSignature = () => {
    if (signatureFields.length === 0) {
      alert('⚠️ Please add at least one signature field before sending.');
      return;
    }

    if (!isSaved) {
      alert('⚠️ Please save the signature fields first before sending.');
      return;
    }

    const missingEmails = signatureFields.filter(field => !field.signerEmail);
    if (missingEmails.length > 0) {
      alert('⚠️ Please specify signer emails for all fields.');
      return;
    }

    const confirmSend = window.confirm(
      '📧 Are you sure you want to send this contract for signature?\n\n' +
      'The contract will be sent to the client for electronic signing.'
    );

    if (confirmSend) {
      console.log('Sending fields:', signatureFields);
      onSend(signatureFields);
    }
  };

  const getFieldIcon = (type) => {
    const fieldType = fieldTypes.find(t => t.type === type);
    return fieldType || fieldTypes[0];
  };

  return (
    <div className="signature-editor-vendor">
      {/* PDF Viewer Section */}
      <div className="pdf-section-vendor">
        <div className="pdf-viewer-header-vendor">
          <h3>📄 Contract Document</h3>
          <p>Review the contract below - signature fields will be automatically placed at the bottom of the document</p>
        </div>
        
        <div className="pdf-viewer-container-vendor" ref={pdfViewerRef}>
          <object
            data={contractUrl}
            type="application/pdf"
            width={pdfDimensions.width}
            height="600"
            className="pdf-object-vendor"
            aria-label="Contract PDF"
          >
            <div className="pdf-fallback-vendor">
              <p>PDF cannot be displayed. Please download the contract to view.</p>
              <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="btn-link">
                Open PDF in New Tab
              </a>
            </div>
          </object>
        </div>
      </div>

      {/* Signature Fields Section */}
      <div className="signature-fields-section-vendor">
        <div className="fields-header-vendor">
          <h3>✏️ Signature Fields Setup</h3>
          <p>Add the signature fields that the client needs to complete</p>
          {isSaved && (
            <div className="save-indicator">
              ✅ Fields saved - You can now send for signature
            </div>
          )}
        </div>

        {/* Add Field Buttons */}
        <div className="add-field-toolbar-vendor">
          <h4>Add Field Type:</h4>
          <div className="field-type-buttons-vendor">
            {fieldTypes.map(({ type, icon: Icon, label, color }) => (
              <button
                key={type}
                className="add-field-btn-vendor"
                onClick={() => handleAddField(type)}
                style={{ borderColor: color }}
              >
                <Icon size={16} style={{ color }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields List */}
        <div className="fields-list-section-vendor">
          {signatureFields.length === 0 ? (
            <div className="empty-fields-vendor">
              <Edit3 size={48} color="#cbd5e1" />
              <p>No signature fields added yet</p>
              <p className="hint-vendor">Click on a field type above to add signature fields</p>
            </div>
          ) : (
            <div className="fields-grid-vendor">
              {signatureFields.map((field, index) => {
                const { icon: Icon, color } = getFieldIcon(field.type);
                
                return (
                  <div 
                    key={field.id} 
                    className="field-card-vendor"
                    style={{ borderLeftColor: color }}
                  >
                    <div className="field-card-header-vendor">
                      <div className="field-type-indicator-vendor" style={{ background: `${color}15` }}>
                        <Icon size={16} style={{ color }} />
                        <span style={{ color }}>{field.type.toUpperCase()}</span>
                      </div>
                      <button
                        onClick={() => deleteField(field.id)}
                        className="delete-field-btn-vendor"
                        title="Delete field"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="field-card-body-vendor">
                      <div className="form-group-vendor">
                        <label>Field Label:</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateFieldProperty(field.id, 'label', e.target.value)}
                          placeholder="e.g., Client Signature"
                          className="form-input-vendor"
                        />
                      </div>

                      <div className="form-group-vendor">
                        <label>Signer Role:</label>
                        <select
                          value={field.signerRole}
                          onChange={(e) => updateFieldProperty(field.id, 'signerRole', e.target.value)}
                          className="form-select-vendor"
                        >
                          {signerRoles.map(role => (
                            <option key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group-vendor">
                        <label>Signer Email: *</label>
                        <input
                          type="email"
                          value={field.signerEmail}
                          onChange={(e) => updateFieldProperty(field.id, 'signerEmail', e.target.value)}
                          placeholder="signer@example.com"
                          className="form-input-vendor"
                          required
                        />
                      </div>

                      <div className="form-group-checkbox-vendor">
                        <label>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateFieldProperty(field.id, 'required', e.target.checked)}
                          />
                          <span>Required field</span>
                        </label>
                      </div>
                    </div>

                    <div className="field-card-footer-vendor">
                      <span className="field-number-vendor">Field #{index + 1}</span>
                      {field.required && <span className="required-badge-vendor">Required</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons-fixed-vendor">
          <button 
            onClick={handleSave} 
            className={`btn-save-vendor ${isSaved ? 'saved' : ''}`}
            disabled={signatureFields.length === 0}
          >
            <Save size={16} />
            {isSaved ? 'Fields Saved ✓' : 'Save Fields'}
          </button>
          <button 
            onClick={handleSendForSignature} 
            className="btn-send-vendor"
            disabled={signatureFields.length === 0 || !isSaved}
          >
            <Send size={16} />
            Send for Signature
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFSignatureEditor;