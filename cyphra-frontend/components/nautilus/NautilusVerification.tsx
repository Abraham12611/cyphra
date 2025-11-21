import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, CheckCircle, XCircle, Loader, Eye, Brain, Award } from 'lucide-react';

interface NautilusVerificationProps {
  campaignId: string;
  blobId: string;
  dataType: 'image' | 'text' | 'audio' | 'video';
  onVerificationComplete: (result: VerificationResult) => void;
}

interface VerificationResult {
  verified: boolean;
  qualityScore: number;
  authenticityScore?: number;
  metrics: Record<string, any>;
  attestation?: any;
}

interface VerificationStatus {
  status: 'idle' | 'verifying' | 'success' | 'error';
  type?: 'quality' | 'authenticity' | 'both';
  result?: VerificationResult;
  error?: string;
}

export const NautilusVerification: React.FC<NautilusVerificationProps> = ({
  campaignId,
  blobId,
  dataType,
  onVerificationComplete
}) => {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({ status: 'idle' });
  const [selectedVerificationType, setSelectedVerificationType] = useState<'quality' | 'authenticity' | 'both'>('both');
  const [qualityThreshold, setQualityThreshold] = useState(70);

  const verificationTypes = [
    {
      type: 'quality' as const,
      icon: <Award className="w-5 h-5" />,
      title: 'Quality Verification',
      description: 'Verify data quality using AI models in TEE',
      color: 'blue'
    },
    {
      type: 'authenticity' as const,
      icon: <Eye className="w-5 h-5" />,
      title: 'Authenticity Check',
      description: 'Detect AI-generated or manipulated content',
      color: 'green'
    },
    {
      type: 'both' as const,
      icon: <Brain className="w-5 h-5" />,
      title: 'Complete Analysis',
      description: 'Full quality and authenticity verification',
      color: 'purple'
    }
  ];

  const startVerification = async () => {
    setVerificationStatus({ status: 'verifying', type: selectedVerificationType });

    try {
      const requests = [];

      // Quality verification
      if (selectedVerificationType === 'quality' || selectedVerificationType === 'both') {
        requests.push(
          fetch('/api/nautilus/verify-quality', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              campaign_id: campaignId,
              blob_id: blobId,
              data_type: dataType,
              quality_threshold: (qualityThreshold / 100).toString()
            })
          })
        );
      }

      // Authenticity verification
      if (selectedVerificationType === 'authenticity' || selectedVerificationType === 'both') {
        requests.push(
          fetch('/api/nautilus/verify-authenticity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              campaign_id: campaignId,
              blob_id: blobId,
              data_type: dataType
            })
          })
        );
      }

      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map(r => r.json()));

      // Process results
      let combinedResult: VerificationResult = {
        verified: true,
        qualityScore: 0,
        metrics: {}
      };

      if (selectedVerificationType === 'quality') {
        const qualityResult = results[0];
        combinedResult = {
          verified: qualityResult.verified,
          qualityScore: qualityResult.quality_score * 100,
          metrics: qualityResult.metrics,
          attestation: qualityResult.attestation
        };
      } else if (selectedVerificationType === 'authenticity') {
        const authResult = results[0];
        combinedResult = {
          verified: authResult.verified,
          qualityScore: authResult.quality_score * 100,
          authenticityScore: authResult.quality_score * 100,
          metrics: authResult.metrics,
          attestation: authResult.attestation
        };
      } else {
        // Both verifications
        const qualityResult = results[0];
        const authResult = results[1];
        
        combinedResult = {
          verified: qualityResult.verified && authResult.verified,
          qualityScore: qualityResult.quality_score * 100,
          authenticityScore: authResult.quality_score * 100,
          metrics: {
            quality: qualityResult.metrics,
            authenticity: authResult.metrics
          },
          attestation: qualityResult.attestation
        };
      }

      setVerificationStatus({
        status: 'success',
        type: selectedVerificationType,
        result: combinedResult
      });

      onVerificationComplete(combinedResult);
      
      toast.success('Verification completed successfully!');

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationStatus({
        status: 'error',
        type: selectedVerificationType,
        error: error.message
      });
      toast.error('Verification failed');
    }
  };

  const getStatusIcon = () => {
    switch (verificationStatus.status) {
      case 'verifying':
        return <Loader className="w-6 h-6 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Shield className="w-6 h-6 text-gray-400" />;
    }
  };

  const renderMetrics = (metrics: Record<string, any>) => {
    if (!metrics) return null;

    const renderMetricValue = (key: string, value: any) => {
      if (typeof value === 'number') {
        if (value < 1) {
          return `${(value * 100).toFixed(1)}%`;
        }
        return value.toFixed(3);
      }
      return value.toString();
    };

    return (
      <div className="space-y-2">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="text-sm text-gray-600 capitalize">
              {key.replace(/_/g, ' ')}
            </span>
            <span className="text-sm font-medium">
              {typeof value === 'object' ? (
                <div className="text-right space-y-1">
                  {Object.entries(value).map(([subKey, subValue]) => (
                    <div key={subKey} className="text-xs">
                      {subKey}: {renderMetricValue(subKey, subValue)}
                    </div>
                  ))}
                </div>
              ) : (
                renderMetricValue(key, value)
              )}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          {getStatusIcon()}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Nautilus TEE Verification
        </h3>
        <p className="text-sm text-gray-600">
          Verifiable computation using Trusted Execution Environment
        </p>
      </div>

      {/* Verification Type Selection */}
      {verificationStatus.status === 'idle' && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Select Verification Type</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {verificationTypes.map((option) => (
              <div
                key={option.type}
                className={`
                  p-4 border-2 rounded-lg cursor-pointer transition-colors
                  ${selectedVerificationType === option.type 
                    ? `border-${option.color}-500 bg-${option.color}-50` 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => setSelectedVerificationType(option.type)}
              >
                <div className="flex items-center space-x-3 mb-2">
                  {option.icon}
                  <h5 className="font-medium text-gray-900">{option.title}</h5>
                </div>
                <p className="text-sm text-gray-600">{option.description}</p>
              </div>
            ))}
          </div>

          {/* Quality Threshold */}
          {(selectedVerificationType === 'quality' || selectedVerificationType === 'both') && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Quality Threshold: {qualityThreshold}%
              </label>
              <input
                type="range"
                min="50"
                max="95"
                value={qualityThreshold}
                onChange={(e) => setQualityThreshold(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>50%</span>
                <span>95%</span>
              </div>
            </div>
          )}

          {/* Start Verification Button */}
          <button
            onClick={startVerification}
            disabled={verificationStatus.status === 'verifying'}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start TEE Verification
          </button>
        </div>
      )}

      {/* Verification Progress */}
      {verificationStatus.status === 'verifying' && (
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <div className="h-2 bg-blue-200 rounded-full">
              <div className="h-2 bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
          <p className="text-blue-600 font-medium">
            Running {selectedVerificationType} verification in TEE...
          </p>
          <p className="text-sm text-gray-500">
            This may take a few minutes for complex data analysis
          </p>
        </div>
      )}

      {/* Verification Results */}
      {verificationStatus.status === 'success' && verificationStatus.result && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h4 className="font-medium text-green-900">Verification Complete</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {verificationStatus.result.qualityScore.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Quality Score</div>
              </div>
              
              {verificationStatus.result.authenticityScore && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {verificationStatus.result.authenticityScore.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Authenticity Score</div>
                </div>
              )}
            </div>

            <div className="text-center">
              <span className={`
                inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                ${verificationStatus.result.verified 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
                }
              `}>
                {verificationStatus.result.verified ? '✅ Verified' : '❌ Failed Verification'}
              </span>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-3">Detailed Metrics</h5>
            {renderMetrics(verificationStatus.result.metrics)}
          </div>

          {/* Attestation Info */}
          {verificationStatus.result.attestation && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-2">TEE Attestation</h5>
              <div className="text-sm text-blue-700 space-y-1">
                <div>Enclave ID: {verificationStatus.result.attestation.enclave_id}</div>
                <div>Computation Hash: {verificationStatus.result.attestation.computation_hash?.slice(0, 16)}...</div>
                <div>Timestamp: {new Date(verificationStatus.result.attestation.timestamp).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {verificationStatus.status === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <h4 className="font-medium text-red-900">Verification Failed</h4>
          </div>
          <p className="text-sm text-red-700">
            {verificationStatus.error || 'An error occurred during verification'}
          </p>
          <button
            onClick={() => setVerificationStatus({ status: 'idle' })}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Data Info */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <div>Campaign: {campaignId}</div>
        <div>Blob ID: {blobId.slice(0, 16)}...</div>
        <div>Data Type: {dataType}</div>
      </div>
    </div>
  );
};
