import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import { Shield, Lock, Users, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

interface SealEncryptionProps {
  campaignId: string;
  onEncryptionSuccess: (policyId: string, encryptedDataHash: string) => void;
}

type PolicyType = 'subscription' | 'allowlist' | 'timelock';

interface PolicyConfig {
  type: PolicyType;
  params: Record<string, any>;
}

export const SealEncryption: React.FC<SealEncryptionProps> = ({
  campaignId,
  onEncryptionSuccess
}) => {
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyType>('subscription');
  const [policyParams, setPolicyParams] = useState<Record<string, any>>({});
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionStatus, setEncryptionStatus] = useState<'idle' | 'encrypting' | 'success' | 'error'>('idle');

  const policyOptions = [
    {
      type: 'subscription' as PolicyType,
      icon: <Users className="w-5 h-5" />,
      title: 'Subscription Access',
      description: 'Users pay a subscription fee to access encrypted data',
      params: ['subscription_price', 'duration_days']
    },
    {
      type: 'allowlist' as PolicyType,
      icon: <Shield className="w-5 h-5" />,
      title: 'Allowlist Access',
      description: 'Only pre-approved addresses can access the data',
      params: ['allowed_addresses']
    },
    {
      type: 'timelock' as PolicyType,
      icon: <Clock className="w-5 h-5" />,
      title: 'Time-locked Access',
      description: 'Data becomes accessible after a specific time',
      params: ['unlock_timestamp']
    }
  ];

  const handlePolicyParamChange = (param: string, value: any) => {
    setPolicyParams(prev => ({
      ...prev,
      [param]: value
    }));
  };

  const encryptData = async (file: File): Promise<{ policyId: string; encryptedDataHash: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaign_id', campaignId);
    formData.append('policy_type', selectedPolicy);
    formData.append('policy_params', JSON.stringify(policyParams));

    const response = await fetch('/api/seal/encrypt', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Encryption failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      policyId: result.policy_id,
      encryptedDataHash: result.encrypted_data_hash || 'hash_placeholder'
    };
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0]; // Only encrypt one file at a time
    setIsEncrypting(true);
    setEncryptionStatus('encrypting');

    try {
      const result = await encryptData(file);
      
      setEncryptionStatus('success');
      onEncryptionSuccess(result.policyId, result.encryptedDataHash);
      toast.success(`File encrypted successfully with Seal`);
      
    } catch (error) {
      console.error('Encryption error:', error);
      setEncryptionStatus('error');
      toast.error(`Failed to encrypt file: ${error.message}`);
    } finally {
      setIsEncrypting(false);
    }
  }, [campaignId, selectedPolicy, policyParams, onEncryptionSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: isEncrypting
  });

  const renderPolicyParams = () => {
    const selectedPolicyOption = policyOptions.find(p => p.type === selectedPolicy);
    if (!selectedPolicyOption) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Policy Configuration</h4>
        
        {selectedPolicyOption.params.map(param => (
          <div key={param} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 capitalize">
              {param.replace('_', ' ')}
            </label>
            
            {param === 'allowed_addresses' ? (
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter addresses separated by commas"
                value={policyParams[param] || ''}
                onChange={(e) => handlePolicyParamChange(param, e.target.value.split(',').map(addr => addr.trim()))}
                rows={3}
              />
            ) : param === 'unlock_timestamp' ? (
              <input
                type="datetime-local"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={policyParams[param] || ''}
                onChange={(e) => handlePolicyParamChange(param, new Date(e.target.value).getTime())}
              />
            ) : (
              <input
                type={param.includes('price') ? 'number' : 'text'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Enter ${param.replace('_', ' ')}`}
                value={policyParams[param] || ''}
                onChange={(e) => handlePolicyParamChange(param, param.includes('price') ? parseFloat(e.target.value) : e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const getStatusIcon = () => {
    switch (encryptionStatus) {
      case 'encrypting':
        return <Loader className="w-5 h-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Lock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Policy Selection */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Choose Access Policy</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {policyOptions.map((option) => (
            <div
              key={option.type}
              className={`
                p-4 border-2 rounded-lg cursor-pointer transition-colors
                ${selectedPolicy === option.type 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
              onClick={() => setSelectedPolicy(option.type)}
            >
              <div className="flex items-center space-x-3 mb-2">
                {option.icon}
                <h4 className="font-medium text-gray-900">{option.title}</h4>
              </div>
              <p className="text-sm text-gray-600">{option.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Policy Parameters */}
      {renderPolicyParams()}

      {/* File Upload Area */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Encrypt File</h3>
        
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${isEncrypting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center space-y-4">
            {getStatusIcon()}
            
            {isDragActive ? (
              <p className="text-blue-600">Drop file here to encrypt with Seal...</p>
            ) : encryptionStatus === 'success' ? (
              <div className="text-center">
                <p className="text-green-600 font-medium">File encrypted successfully!</p>
                <p className="text-sm text-gray-500">Data is now secured with Seal encryption</p>
              </div>
            ) : encryptionStatus === 'error' ? (
              <div className="text-center">
                <p className="text-red-600 font-medium">Encryption failed</p>
                <p className="text-sm text-gray-500">Please try again</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  Drag & drop a file here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  File will be encrypted with the selected access policy
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Encryption Status */}
      {encryptionStatus !== 'idle' && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium text-gray-900">
                {encryptionStatus === 'encrypting' && 'Encrypting with Seal...'}
                {encryptionStatus === 'success' && 'Encryption Complete'}
                {encryptionStatus === 'error' && 'Encryption Failed'}
              </p>
              <p className="text-sm text-gray-600">
                Policy: {selectedPolicy} | Campaign: {campaignId}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
