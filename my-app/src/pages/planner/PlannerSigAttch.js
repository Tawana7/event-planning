// PDFSignatureAttachment.js
// Updated to display both vendor (planner) and client signatures on certificate

/**
 * Generates an HTML document with signature details for both vendor and client
 * that can be converted to PDF and attached to the original contract
 */
export const generateSignatureDetailsHTML = (contract, signatureData, signerInfo, vendorSignature) => {
  const signedDate = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });

  const signatureFields = contract.signatureFields?.filter(
    field => field.signerRole === 'client'
  ) || [];

  let signaturesHTML = '';
  
  signatureFields.forEach((field) => {
    const data = signatureData[field.id];
    const fieldType = field.type;
    let displayValue = '';

    if (fieldType === 'signature' || fieldType === 'initial') {
      displayValue = `<img src="${data}" style="max-width: 300px; max-height: 80px; border: 1px solid #e5e7eb; padding: 8px; background: white; border-radius: 4px;" alt="${field.label}" />`;
    } else if (fieldType === 'date') {
      displayValue = `<span style="font-weight: 600; color: #1d4ed8;">${data}</span>`;
    } else if (fieldType === 'text') {
      displayValue = `<span style="font-weight: 600; color: #1f2937;">${data}</span>`;
    } else if (fieldType === 'checkbox') {
      displayValue = `<span style="font-weight: 600; color: ${data ? '#1d4ed8' : '#9ca3af'};">${data ? '✓ Checked' : '○ Not Checked'}</span>`;
    }

    signaturesHTML += `
      <article style="margin-bottom: 20px; padding: 16px; background: white; border: 1px solid #e5e7eb; border-left: 4px solid #1d4ed8; border-radius: 6px;">
        <header style="font-weight: 600; color: #1f2937; margin-bottom: 8px; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
          ${field.label} ${field.required ? '<span style="color: #dc2626;">*</span>' : ''}
        </header>
        <section style="margin-top: 10px;">
          ${displayValue}
        </section>
        <footer style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
          Field Type: ${fieldType} | Required: ${field.required ? 'Yes' : 'No'}
        </footer>
      </article>
    `;
  });

  // Vendor signature section
  let vendorSignatureHTML = '';
  if (vendorSignature && vendorSignature.signatureData) {
    vendorSignatureHTML = `
      <section style="margin-bottom: 30px;">
        <header style="font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; letter-spacing: -0.3px;">
          Planner Signature
        </header>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <article style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; border-left: 3px solid #7c3aed;">
            <header style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
              Signature
            </header>
            <section style="margin-top: 10px;">
              <img src="${vendorSignature.signatureData}" style="max-width: 100%; height: auto; border: 1px solid #e5e7eb; padding: 8px; background: white; border-radius: 4px;" alt="Planner Signature" />
            </section>
          </article>
          <article style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; border-left: 3px solid #7c3aed;">
            <header style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
              Signature Details
            </header>
            <section style="display: flex; flex-direction: column; gap: 10px;">
              <div>
                <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Name</span>
                <span style="font-weight: 600; color: #1f2937; font-size: 14px;">${vendorSignature.vendorName || 'Planner'}</span>
              </div>
              <div>
                <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Email</span>
                <span style="font-weight: 600; color: #1f2937; font-size: 14px;">${vendorSignature.vendorEmail || 'Not specified'}</span>
              </div>
              <div>
                <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Signed</span>
                <span style="font-weight: 600; color: #1d4ed8; font-size: 14px;">${new Date(vendorSignature.signedAt).toLocaleString()}</span>
              </div>
            </section>
          </article>
        </div>
      </section>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Electronic Signature Certificate</title>
      <style>
        @page {
          margin: 0.75in;
          size: A4;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          width: 100%;
          height: 100%;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background: white;
          padding: 40px 30px;
        }

        @media (max-width: 768px) {
          body {
            padding: 25px 20px;
          }
        }

        header.main-header {
          text-align: center;
          padding-bottom: 30px;
          border-bottom: 2px solid #1d4ed8;
          margin-bottom: 40px;
        }

        header.main-header h1 {
          font-size: 28px;
          color: #1f2937;
          margin-bottom: 8px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        header.main-header p {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 16px;
        }

        .signature-badge {
          display: inline-block;
          padding: 8px 16px;
          background: linear-gradient(135deg, #1d4ed8, #7c3aed);
          color: white;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        section.content-section {
          margin-bottom: 35px;
        }

        section.content-section > header {
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e5e7eb;
          letter-spacing: -0.3px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        article.info-item {
          padding: 16px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          border-left: 3px solid #1d4ed8;
          transition: all 0.2s ease;
        }

        article.info-item:hover {
          box-shadow: 0 4px 12px rgba(29, 78, 216, 0.08);
          border-left: 3px solid #7c3aed;
        }

        article.info-item header {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }

        article.info-item section {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          word-break: break-word;
        }

        section.certification {
          background: white;
          border: 2px solid #1d4ed8;
          border-radius: 10px;
          padding: 28px;
          margin-top: 30px;
        }

        section.certification > header {
          color: #1d4ed8;
          font-size: 16px;
          margin-bottom: 14px;
          text-align: center;
          font-weight: 700;
          letter-spacing: -0.3px;
        }

        section.certification p {
          font-size: 13px;
          color: #4b5563;
          line-height: 1.9;
          text-align: center;
        }

        footer.main-footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
        }

        footer.main-footer p {
          margin-bottom: 6px;
        }

        @media print {
          body {
            background: white;
            padding: 0;
          }

          article.info-item:hover {
            box-shadow: none;
            border-left: 3px solid #1d4ed8;
          }

          @page {
            margin: 0.75in;
          }
        }

        @media (max-width: 480px) {
          header.main-header h1 {
            font-size: 24px;
          }

          section.content-section > header {
            font-size: 16px;
          }

          .info-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          section.certification {
            padding: 20px;
          }

          body {
            padding: 20px 15px;
          }
        }
      </style>
    </head>
    <body>
      <header class="main-header">
        <h1>Electronic Signature Certificate</h1>
        <p>Official Signature Verification Document</p>
        <span class="signature-badge">LEGALLY BINDING ELECTRONIC SIGNATURE</span>
      </header>

      <section class="content-section">
        <header>Contract Information</header>
        <article class="info-grid">
          <article class="info-item">
            <header>Contract Name</header>
            <section>${contract?.fileName || 'Not specified'}</section>
          </article>
          <article class="info-item">
            <header>Event</header>
            <section>${contract?.eventName || 'Not specified'}</section>
          </article>
          <article class="info-item">
            <header>Client Name</header>
            <section>${
              contract?.clientName && contract.clientName !== 'undefined' && contract.clientName?.trim() 
                ? contract.clientName 
                : (contract?.client?.name || 'Not specified')
            }</section>
          </article>
          <article class="info-item">
            <header>Client Email</header>
            <section>${
              contract?.clientEmail && contract.clientEmail !== 'undefined' && contract.clientEmail?.trim() 
                ? contract.clientEmail 
                : (contract?.client?.email || 'Not specified')
            }</section>
          </article>
        </article>
      </section>

      <section class="content-section">
        <header>Signing Details</header>
        <article class="info-grid">
          <article class="info-item">
            <header>Signed Date & Time</header>
            <section>${signedDate}</section>
          </article>
          <article class="info-item">
            <header>Signer IP Address</header>
            <section>${signerInfo?.ipAddress || 'Not captured'}</section>
          </article>
          <article class="info-item">
            <header>Device Information</header>
            <section>${signerInfo?.userAgent ? 'Captured' : 'Not captured'}</section>
          </article>
          <article class="info-item">
            <header>Signature Method</header>
            <section>Electronic Signature</section>
          </article>
        </article>
      </section>

      ${vendorSignatureHTML}

      <section class="content-section">
        <header>Client Signature Fields</header>
        ${signaturesHTML}
      </section>

      <section class="certification">
        <header>Legal Certification</header>
        <p>
          This document certifies that the electronic signatures and data shown above were captured 
          at the date and time specified. These electronic signatures are legally binding and have 
          the same force and effect as handwritten signatures under applicable electronic signature laws, 
          including but not limited to the U.S. Electronic Signatures in Global and National Commerce Act (ESIGN), 
          the Uniform Electronic Transactions Act (UETA), and other relevant legislation.
        </p>
      </section>

      <footer class="main-footer">
        <p>This signature details page is automatically generated and attached to the contract.</p>
        <p>Document Generated: ${new Date().toLocaleString()}</p>
        <p>Contract ID: ${contract?.id || 'Not specified'}</p>
      </footer>
    </body>
    </html>
  `;
};

/**
 * Creates a printable signature details page
 * This can be saved as PDF and attached to the contract
 */
export const createSignatureDetailsDocument = (contract, signatureData, signerInfo, vendorSignature) => {
  const html = generateSignatureDetailsHTML(contract, signatureData, signerInfo, vendorSignature);
  
  // Create a blob from the HTML
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  return {
    html,
    blob,
    url,
    // Method to download as HTML (which can be printed to PDF)
    download: () => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${contract.fileName.replace(/\.[^/.]+$/, '')}_SignatureDetails.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    // Method to print (which can save as PDF)
    print: () => {
      const printWindow = window.open(url, '_blank');
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };
};

/**
 * Gets the user's IP address for audit trail
 */
export const getUserIPAddress = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error fetching IP:', error);
    return 'Unable to capture';
  }
};

/**
 * Example usage in your PlannerContract.jsx:
 * 
 * import { createSignatureDetailsDocument, getUserIPAddress } from './PlannerSigAttch.js';
 * import VendorSignatureCanvas from './VendorSignatureCanvas';
 * 
 * // Show vendor signature canvas first
 * const handleVendorSign = async (vendorSignatureData) => {
 *   // Store vendor signature
 *   const vendorInfo = {
 *     signatureData: vendorSignatureData.signatureData,
 *     vendorName: vendorSignatureData.vendorName,
 *     vendorEmail: vendorSignatureData.vendorEmail,
 *     signedAt: vendorSignatureData.signedAt
 *   };
 *   
 *   // Then proceed with client signing or final submission
 * };
 * 
 * // When finalizing, include vendor signature
 * const sendSignedContract = async (signatureDataParam, vendorSignatureData) => {
 *   const ipAddress = await getUserIPAddress();
 *   
 *   const signerInfo = {
 *     ipAddress: ipAddress,
 *     userAgent: navigator.userAgent,
 *     signedAt: new Date().toISOString(),
 *     signerName: selectedContract.clientName,
 *     signerEmail: selectedContract.clientEmail,
 * 
 **/