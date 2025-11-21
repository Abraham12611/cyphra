import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import { Upload, File, CheckCircle, XCircle, Loader } from 'lucide-react';

interface WalrusUploadProps {
  campaignId: string;
  onUploadSuccess: (blobId: string, fileName: string) => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
}

interface UploadStatus {
  file: File;
  status: 'uploading' | 'success' | 'error';
  blobId?: string;
  error?: string;
  progress?: number;
}

export const WalrusUpload: React.FC<WalrusUploadProps> = ({
  campaignId,
  onUploadSuccess,
  maxFiles = 10,
  acceptedFileTypes = ['*']
}) => {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadToWalrus = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaign_id', campaignId);
    formData.append('epochs', '5');

    const response = await fetch('/api/walrus/store', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.blob_id;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    
    // Initialize upload status for all files
    const initialUploads: UploadStatus[] = acceptedFiles.map(file => ({
      file,
      status: 'uploading' as const,
      progress: 0
    }));
    
    setUploads(initialUploads);

    // Upload files sequentially to avoid overwhelming the network
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      
      try {
        const blobId = await uploadToWalrus(file);
        
        setUploads(prev => prev.map((upload, index) => 
          index === i 
            ? { ...upload, status: 'success', blobId }
            : upload
        ));
        
        onUploadSuccess(blobId, file.name);
        toast.success(`${file.name} uploaded successfully to Walrus`);
        
      } catch (error) {
        console.error('Upload error:', error);
        
        setUploads(prev => prev.map((upload, index) => 
          index === i 
            ? { ...upload, status: 'error', error: error.message }
            : upload
        ));
        
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setIsUploading(false);
  }, [campaignId, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    disabled: isUploading
  });

  const getStatusIcon = (status: UploadStatus['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        
        {isDragActive ? (
          <p className="text-blue-600">Drop files here to upload to Walrus...</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-2">
              Drag & drop files here, or click to select files
            </p>
            <p className="text-sm text-gray-500">
              Files will be stored on Walrus decentralized network
            </p>
          </div>
        )}
      </div>

      {/* Upload Status */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Upload Status</h4>
          
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <File className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {upload.file.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({(upload.file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(upload.status)}
                
                {upload.status === 'success' && upload.blobId && (
                  <span className="text-xs text-green-600 font-mono">
                    {upload.blobId.slice(0, 8)}...
                  </span>
                )}
                
                {upload.status === 'error' && upload.error && (
                  <span className="text-xs text-red-600">
                    {upload.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
