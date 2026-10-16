import React, { useState, useRef } from 'react';
import { validateFaces } from '../utils/faceDetection';

const validExtensions = ['.heic', '.heif', '.png', '.jpg', '.jpeg'];
const validMimeTypes = ['image/heic', 'image/heif', 'image/png', 'image/jpeg', 'image/jpg'];

interface UploadedImage extends File {
  status?: string;
  rejectionReasons?: string[];
  id?: string;
  sizeBytes?: number;
}

const ImageUpload: React.FC = () => {
  const [files, setFiles] = useState<UploadedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

const handleFiles = async (newFiles: File[]) => {
  const validFiles: File[] = [];
  const invalidFiles: { file: File; reason: string }[] = [];

  newFiles.forEach(file => {
    const result = validateFile(file);

    if (result.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({
        file,
        reason: result.reason,
      });
    }
  });

  // Keep the existing frontend preview behavior.
  console.log(
  'Selected file details:',
  validFiles.map(file => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }))
);
  setFiles(prev => [...prev, ...validFiles]);

  console.log('Invalid files:', invalidFiles);

  // Upload each valid file to the backend.
  for (const file of validFiles) {
      try {
        // Run face detection in the browser.
        const faceResult = await validateFaces(file);

        console.log('Face validation result:', {
          filename: file.name,
          faceCount: faceResult.faceCount,
          rejectionReasons: faceResult.rejectionReasons,
        });


        console.log('Face result before upload:', faceResult);
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append(
          'faceValidation',
          JSON.stringify(faceResult)
        );

      const response = await fetch(
        'http://localhost:3001/api/v1/images',
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error(`Upload failed for ${file.name}:`, result);
        alert(`Upload failed for ${file.name}: ${result.error || 'Unknown error'}`);
        continue;
      }

      console.log('Image uploaded successfully:', result);

    setFiles(prev =>
      prev.map(item =>
        item.name === file.name
          ? {
              ...item,
              status: result.status,
              rejectionReasons: result.rejectionReasons ?? [],
              id: result.id,
              sizeBytes: result.sizeBytes,
            }
          : item
      )
    );
    } catch (error) {
      console.error(`Upload failed for ${file.name}:`, error);
      alert(`Could not upload ${file.name}. Check whether the backend is running.`);
    }
  }
};

  const validateFile = (file: File): { valid: boolean; reason: string } => {
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(extension)) {
      return { valid: false, reason: `Unsupported extension: ${extension}` };
    }
    if (!validMimeTypes.includes(file.type)) {
      return { valid: false, reason: `Unsupported MIME type: ${file.type}` };
    }
    return { valid: true, reason: '' };
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="image-upload">
      <h2>Image Upload Dashboard</h2>
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>Drag & drop images here, or click to select files</p>
        <input
          type="file"
          multiple
          accept=".heic,.heif,.png,.jpg,.jpeg"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button type="button" onClick={handleFileSelect}>
          Select Files
        </button>
      </div>

      {/* Accepted Images */}
      <div className="file-list accepted-list">
        <h3>
          ✅ Accepted Images (
          {files.filter((file) => file.status === 'ACCEPTED').length})
        </h3>

        {files.filter((file) => file.status === 'ACCEPTED').length === 0 ? (
          <p>No accepted images yet.</p>
        ) : (
          <ul>
            {files
              .map((file, index) => ({ file, index }))
              .filter(({ file }) => file.status === 'ACCEPTED')
              .map(({ file, index }) => (
                <li key={`${file.name}-${index}`}>
                  <div className="file-info">
                    <strong>{file.name}</strong>

                    <span>
                      ({((file.sizeBytes ?? file.size) / 1024).toFixed(1)} KB)
                    </span>

                    <span>Status: {file.status}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Rejected Images */}
      <div className="file-list rejected-list">
        <h3>
          ❌ Rejected Images (
          {files.filter((file) => file.status === 'REJECTED').length})
        </h3>

        {files.filter((file) => file.status === 'REJECTED').length === 0 ? (
          <p>No rejected images yet.</p>
        ) : (
          <ul>
            {files
              .map((file, index) => ({ file, index }))
              .filter(({ file }) => file.status === 'REJECTED')
              .map(({ file, index }) => (
                <li key={`${file.name}-${index}`}>
                  <div className="file-info">
                    <strong>{file.name}</strong>

                    <span>
                      ({((file.sizeBytes ?? file.size) / 1024).toFixed(1)} KB)
                    </span>

                    <span>Status: {file.status}</span>

                    {file.rejectionReasons &&
                      file.rejectionReasons.length > 0 && (
                        <div className="rejection-reasons">
                          <strong>Reasons for rejection:</strong>

                          <ul>
                            {file.rejectionReasons.map((reason, reasonIndex) => (
                              <li key={reasonIndex}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;
