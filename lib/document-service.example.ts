/**
 * Example usage of DocumentService
 * 
 * This file demonstrates how to use the DocumentService for managing
 * proposal documents in the BidSync platform.
 */

import { DocumentService } from './document-service';

/**
 * Example 1: Upload a document with validation
 */
export async function exampleUploadDocument() {
  // Assume we have a file from an input element
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const file = fileInput.files?.[0];
  
  if (!file) {
    console.error('No file selected');
    return;
  }

  // First, validate the file client-side
  const validation = DocumentService.validateFile(file);
  
  if (!validation.valid) {
    alert(`File validation failed: ${validation.error}`);
    return;
  }

  // Prepare metadata
  const metadata = {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    isRequired: false, // Set to true if this is a required document
  };

  // Upload the document
  const proposalId = 'your-proposal-id';
  const userId = 'current-user-id';

  const result = await DocumentService.uploadDocument(
    proposalId,
    file,
    metadata,
    userId
  );

  if (result.success && result.document) {
    console.log('Document uploaded successfully!');
    console.log('Document ID:', result.document.id);
    console.log('Document URL:', result.document.url);
    console.log('File name:', result.document.fileName);
    console.log('File size:', result.document.fileSize, 'bytes');
  } else {
    console.error('Upload failed:', result.error);
    
    // Handle specific error codes
    switch (result.errorCode) {
      case 'INVALID_FILE_TYPE':
        alert('This file type is not allowed. Please upload a PDF, Word, Excel, or image file.');
        break;
      case 'FILE_TOO_LARGE':
        alert('File is too large. Maximum size is 10MB.');
        break;
      case 'UNAUTHORIZED':
        alert('You do not have permission to upload documents to this proposal.');
        break;
      default:
        alert('An error occurred while uploading the document.');
    }
  }
}

/**
 * Example 2: Display all documents for a proposal
 */
export async function exampleDisplayDocuments(proposalId: string) {
  const result = await DocumentService.getDocuments(proposalId);

  if (result.success && result.documents) {
    console.log(`Found ${result.documents.length} documents`);

    result.documents.forEach((doc, index) => {
      console.log(`\nDocument ${index + 1}:`);
      console.log('  Name:', doc.fileName);
      console.log('  Type:', doc.docType);
      console.log('  Size:', (doc.fileSize / 1024).toFixed(2), 'KB');
      console.log('  Uploaded by:', doc.uploadedBy);
      console.log('  Uploaded at:', new Date(doc.uploadedAt).toLocaleString());
      console.log('  Required:', doc.isRequired ? 'Yes' : 'No');
      console.log('  URL:', doc.url);
    });

    // Example: Render in UI
    const documentList = document.getElementById('document-list');
    if (documentList) {
      documentList.innerHTML = result.documents
        .map(
          (doc) => `
          <div class="document-item">
            <h4>${doc.fileName}</h4>
            <p>Size: ${(doc.fileSize / 1024).toFixed(2)} KB</p>
            <p>Type: ${doc.docType}</p>
            ${doc.isRequired ? '<span class="badge">Required</span>' : ''}
            <a href="${doc.url}" target="_blank">Download</a>
            <button onclick="deleteDocument('${doc.id}')">Delete</button>
          </div>
        `
        )
        .join('');
    }
  } else {
    console.error('Failed to fetch documents:', result.error);
  }
}

/**
 * Example 3: Delete a document with confirmation
 */
export async function exampleDeleteDocument(documentId: string, userId: string) {
  // Show confirmation dialog
  const confirmed = confirm(
    'Are you sure you want to delete this document? This action cannot be undone.'
  );

  if (!confirmed) {
    return;
  }

  const result = await DocumentService.deleteDocument(documentId, userId);

  if (result.success) {
    console.log('Document deleted successfully');
    alert('Document deleted successfully');
    
    // Refresh the document list
    // exampleDisplayDocuments(proposalId);
  } else {
    console.error('Delete failed:', result.error);
    
    switch (result.errorCode) {
      case 'DOCUMENT_NOT_FOUND':
        alert('Document not found');
        break;
      case 'UNAUTHORIZED':
        alert('You do not have permission to delete this document');
        break;
      default:
        alert('Failed to delete document');
    }
  }
}

/**
 * Example 4: Validate required documents before submission
 */
export async function exampleValidateBeforeSubmission(proposalId: string) {
  // Define which document types are required for this proposal
  const requiredDocTypes = [
    'application/pdf', // Technical proposal PDF
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Budget spreadsheet
  ];

  const validation = await DocumentService.validateRequiredDocuments(
    proposalId,
    requiredDocTypes
  );

  if (validation.valid) {
    console.log('All required documents are present');
    // Proceed with submission
    return true;
  } else {
    console.error('Missing required documents:', validation.missingDocuments);
    
    // Show user-friendly error message
    const missingDocs = validation.missingDocuments
      .map((type) => {
        switch (type) {
          case 'application/pdf':
            return 'Technical Proposal (PDF)';
          case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            return 'Budget Spreadsheet (Excel)';
          default:
            return type;
        }
      })
      .join(', ');

    alert(`Cannot submit proposal. Missing required documents: ${missingDocs}`);
    return false;
  }
}

/**
 * Example 5: Upload multiple documents with progress tracking
 */
export async function exampleBulkUpload(
  proposalId: string,
  userId: string,
  files: FileList
) {
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    console.log(`Uploading ${i + 1}/${files.length}: ${file.name}`);

    // Validate file
    const validation = DocumentService.validateFile(file);
    if (!validation.valid) {
      console.error(`Skipping ${file.name}: ${validation.error}`);
      failCount++;
      results.push({ file: file.name, success: false, error: validation.error });
      continue;
    }

    // Upload file
    const metadata = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isRequired: false,
    };

    const result = await DocumentService.uploadDocument(
      proposalId,
      file,
      metadata,
      userId
    );

    if (result.success) {
      successCount++;
      results.push({ file: file.name, success: true });
    } else {
      failCount++;
      results.push({ file: file.name, success: false, error: result.error });
    }
  }

  console.log(`\nUpload complete: ${successCount} succeeded, ${failCount} failed`);
  
  // Show summary
  alert(`Upload complete!\n${successCount} files uploaded successfully\n${failCount} files failed`);

  return results;
}

/**
 * Example 6: Get a single document by ID
 */
export async function exampleGetDocument(documentId: string) {
  const document = await DocumentService.getDocument(documentId);

  if (document) {
    console.log('Document found:');
    console.log('  ID:', document.id);
    console.log('  Name:', document.fileName);
    console.log('  Size:', (document.fileSize / 1024).toFixed(2), 'KB');
    console.log('  Type:', document.docType);
    console.log('  URL:', document.url);
    console.log('  Required:', document.isRequired);
    
    return document;
  } else {
    console.error('Document not found');
    return null;
  }
}

/**
 * Example 7: React component for document upload
 * 
 * Note: This is a conceptual example. In a real implementation,
 * this would be in a .tsx file with proper React imports.
 */
export function exampleReactComponent() {
  // This is pseudo-code showing how to use the service in React
  const handleFileChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = DocumentService.validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Show file info
    console.log('Selected file:', {
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB',
      type: file.type,
    });

    // Upload would happen here
    // const result = await DocumentService.uploadDocument(...);
  };

  // JSX would look like:
  // <div>
  //   <input
  //     type="file"
  //     onChange={handleFileChange}
  //     accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv"
  //   />
  //   <p>Maximum file size: 10MB</p>
  //   <p>Allowed types: PDF, Word, Excel, PowerPoint, Images, Text, CSV</p>
  // </div>
  
  return handleFileChange;
}

/**
 * Example 8: Integration with compliance checking
 */
export async function exampleComplianceCheck(proposalId: string) {
  // Get project requirements
  const projectRequirements = {
    requiredDocTypes: [
      'application/pdf', // Technical proposal
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Budget
    ],
  };

  // Validate documents
  const docValidation = await DocumentService.validateRequiredDocuments(
    proposalId,
    projectRequirements.requiredDocTypes
  );

  const issues = [];

  if (!docValidation.valid) {
    issues.push({
      type: 'missing_document',
      severity: 'error',
      message: `Missing required documents: ${docValidation.missingDocuments.join(', ')}`,
      field: 'documents',
    });
  }

  // Get all documents to check for other issues
  const docsResult = await DocumentService.getDocuments(proposalId);
  
  if (docsResult.success && docsResult.documents) {
    // Check if any documents are too old (example: older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldDocuments = docsResult.documents.filter(
      (doc) => new Date(doc.uploadedAt) < thirtyDaysAgo
    );

    if (oldDocuments.length > 0) {
      issues.push({
        type: 'outdated_document',
        severity: 'warning',
        message: `${oldDocuments.length} document(s) are older than 30 days`,
        field: 'documents',
      });
    }
  }

  return {
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}
