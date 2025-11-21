import React, { useEffect, useState, useCallback } from 'react';
import {
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import axios from 'axios';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import crypto from 'crypto';
import useCampaignStore from '@/helpers/store/useCampaignStore';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

interface EncryptDataProps {
  onNext: () => void;
  onBack: () => void;
  submissionData: {
    name: string;
    file: File | null;
    encryptionStatus: any;
    aiVerificationResult?: {
      status: 'success' | 'failed';
      score: number;
      details?: any;
    };
    campaignId?: string;
    walletAddress?: string;
  };
  updateSubmissionData: (data: Partial<{ encryptionStatus: any }>) => void;
}

// Add window.ethereum type
declare global {
  interface Window {
    ethereum?: any;
  }
}

const uploadSteps = [
  { id: 1, name: 'Preparing Data' },
  { id: 2, name: 'Uploading to Walrus' },
  { id: 3, name: 'Finalizing' },
];

// Walrus endpoints
const WALRUS_PUBLISHER_ENDPOINT =
  'https://publisher.walrus-testnet.walrus.space/v1/blobs';
const WALRUS_AGGREGATOR_ENDPOINT =
  'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

// Contract configuration
const PACKAGE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID || '';
const CAMPAIGN_STORE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_STORE_ID || '';
const CONTRIBUTION_STORE_ID =
  process.env.NEXT_PUBLIC_CONTRIBUTION_STORE_ID || '';
const REPUTATION_REGISTRY_ID =
  process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ID || '';
const TOKEN_TYPE = process.env.NEXT_PUBLIC_TOKEN_TYPE || '0x2::sui::SUI';
const ESCROW_STORE_ID = process.env.NEXT_PUBLIC_ESCROW_STORE_ID || '';

const EncryptData: React.FC<EncryptDataProps> = ({
  onNext,
  onBack,
  submissionData,
  updateSubmissionData,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walrusData, setWalrusData] = useState<any>(null);
  const router = useRouter();
  const account = useCurrentAccount();
  const { campaign } = useCampaignStore();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Helper function to convert MIME type to file extension
  const getFileExtension = (mimeType: string | undefined): string => {
    if (!mimeType) return '';

    const mimeToExtension: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        '.pptx',
      'text/plain': '.txt',
      'text/html': '.html',
      'text/css': '.css',
      'text/javascript': '.js',
      'application/json': '.json',
      'application/xml': '.xml',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/webp': '.webp',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/zip': '.zip',
      'application/x-7z-compressed': '.7z',
      'application/x-rar-compressed': '.rar',
      'application/gzip': '.gz',
    };

    // Try direct match first
    if (mimeToExtension[mimeType]) {
      return mimeToExtension[mimeType];
    }

    // If no direct match, try to extract extension from MIME subtype
    const subtype = mimeType.split('/')[1];
    if (subtype) {
      // Handle special cases
      if (subtype === 'jpeg') return '.jpg';
      if (subtype === 'svg+xml') return '.svg';
      if (subtype === 'vnd.ms-excel') return '.xls';

      // For generic cases, try to use the subtype as extension
      return '.' + subtype;
    }

    return '';
  };

  console.log(getFileExtension(submissionData.file?.type));

  const generateContributionId = (): string => {
    return `contribution_${Date.now()}_${crypto
      .randomBytes(4)
      .toString('hex')}`;
  };

  const handleOnChainSubmission = async () => {
    if (
      !account ||
      !submissionData.aiVerificationResult ||
      !walrusData?.blobId
    ) {
      toast.error('Missing required data for submission');
      return;
    }

    setIsSubmitting(true);
    try {
      const campaignId =
        submissionData.campaignId ||
        campaign?.onchain_campaign_id ||
        router.query.id ||
        router.asPath.split('/').pop();

      if (!campaignId) {
        throw new Error('Campaign ID not found');
      }

      const contributionId = generateContributionId();
      const dataUrl = `${WALRUS_AGGREGATOR_ENDPOINT}/${walrusData.blobId}`;
      const qualityScore = Math.round(
        submissionData.aiVerificationResult.score
      ).toString();

      // Generate a deterministic hash from the blob ID for data_hash
      const dataHash = Array.from(
        new TextEncoder().encode(walrusData.blobId + Date.now().toString())
      );

      // Create the transaction
      const tx = new Transaction();
      tx.setGasBudget(100000000);

      // Add the moveCall to the transaction
      tx.moveCall({
        target: `${PACKAGE_ID}::contribution::submit_contribution`,
        typeArguments: [TOKEN_TYPE],
        arguments: [
          tx.object(CONTRIBUTION_STORE_ID),
          tx.object(CAMPAIGN_STORE_ID),
          tx.object(ESCROW_STORE_ID),
          tx.object(REPUTATION_REGISTRY_ID),
          tx.pure.string(campaignId.toString()),
          tx.pure.string(contributionId),
          tx.pure.string(dataUrl),
          tx.pure(bcs.vector(bcs.U8).serialize(dataHash)),
          tx.pure.u64(qualityScore),
          tx.pure.bool(true), // is_active
        ],
      });

      // Execute the transaction
      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('Transaction result:', result);
            toast.success('Contribution submitted successfully on-chain!');

            // Save to backend if needed
            try {
              const backendResponse = await axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/campaigns/submit-contributions`,
                {
                  onchain_contribution_id: contributionId,
                  campaign_id: campaignId,
                  contributor: account.address,
                  data_url: dataUrl,
                  blob_id: walrusData.blobId,
                  transaction_hash: result.digest,
                  quality_score: submissionData.aiVerificationResult.score,
                  file_type: getFileExtension(submissionData.file?.type),
                  ai_verification_score:
                    submissionData.aiVerificationResult.score,
                }
              );
              console.log('Backend response:', backendResponse.data);
            } catch (backendError) {
              console.error('Backend submission error:', backendError);
              toast.warn(
                'On-chain submission successful, but failed to sync with backend'
              );
            }

            // Update submission data with on-chain information
            updateSubmissionData({
              encryptionStatus: {
                ...walrusData,
                contributionId,
                transactionHash: result.digest,
                status: 'success',
              },
            });

            onNext();
          },
          onError: (error) => {
            console.error('Transaction error:', error);
            toast.error(`Failed to submit contribution: ${error.message}`);
            setIsSubmitting(false);
          },
        }
      );
    } catch (err) {
      console.error('Submission error:', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit contribution'
      );
      setError(
        err instanceof Error ? err.message : 'Failed to submit contribution'
      );
      setIsSubmitting(false);
    }
  };

  const uploadToWalrus = useCallback(async () => {
    if (!submissionData.file || isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      setCurrentStep(1);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setCurrentStep(2);

      // Prepare the file for upload
      const file = submissionData.file;

      // Default to 1 epoch storage duration
      const epochs = 1;

      try {
        const response = await fetch(
          `${WALRUS_PUBLISHER_ENDPOINT}?epochs=${epochs}`,
          {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': 'application/octet-stream',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Walrus upload response:', data);

        const walrusResult = {
          status: 'success',
          blobId:
            data.newlyCreated?.blobObject?.blobId ||
            data.alreadyCertified?.blobId,
          objectId: data.newlyCreated?.blobObject?.id,
          size: data.newlyCreated?.blobObject?.size,
          epochs: epochs,
          storage: data.newlyCreated?.blobObject?.storage || {
            startEpoch: data.alreadyCertified?.startEpoch,
            endEpoch: data.alreadyCertified?.endEpoch,
          },
          fileType: getFileExtension(file.type),
          fileName: file.name,
        };

        if (!walrusResult.blobId) {
          throw new Error('Failed to get blob ID from Walrus response');
        }

        setCurrentStep(3);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setWalrusData(walrusResult);
        setIsComplete(true);
        updateSubmissionData({
          encryptionStatus: walrusResult,
        });
      } catch (uploadErr) {
        console.error('Upload error details:', uploadErr);
        throw uploadErr;
      }
    } catch (err) {
      console.error('Upload error:', err);
      let errorMessage = err instanceof Error ? err.message : 'Upload failed';

      if (err.response?.data?.error) {
        errorMessage = `Upload failed: ${err.response.data.error}`;
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [submissionData.file, isProcessing, updateSubmissionData]);

  useEffect(() => {
    let mounted = true;

    if (
      mounted &&
      submissionData.file &&
      !isComplete &&
      !error &&
      !isProcessing
    ) {
      uploadToWalrus();
    }

    return () => {
      mounted = false;
    };
  }, [submissionData.file, uploadToWalrus, isComplete, error, isProcessing]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-[#f5f5faf4] mb-2">
            Upload Failed
          </h3>
          <p className="text-[#f5f5fa7a]">{error}</p>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-xl border border-[#f5f5fa14] text-[#f5f5faf4] font-semibold hover:bg-[#f5f5fa14] transition-colors focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:ring-offset-2 focus:ring-offset-[#0f0f17]"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isComplete ? (
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <CloudArrowUpIcon className="w-24 h-24 text-[#a855f7] animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-[#f5f5faf4] mb-2">
              Uploading Your Data
            </h3>
            <p className="text-[#f5f5fa7a]">
              Uploading your data securely to Walrus
            </p>
          </div>

          {/* Steps Progress */}
          <div className="max-w-sm mx-auto space-y-3">
            {uploadSteps.map((step) => (
              <div key={step.id} className="flex items-center space-x-3">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                    ${
                      step.id < currentStep
                        ? 'border-[#22c55e] bg-[#22c55e]'
                        : step.id === currentStep
                        ? 'border-[#a855f7] animate-pulse'
                        : 'border-[#f5f5fa14]'
                    }`}
                >
                  {step.id < currentStep && (
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    step.id <= currentStep
                      ? 'text-[#f5f5faf4]'
                      : 'text-[#f5f5fa7a]'
                  }`}
                >
                  {step.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircleIcon className="w-10 h-10 text-[#22c55e]" />
            </div>
            <h3 className="text-lg font-medium text-[#f5f5faf4] mb-2">
              Upload Complete
            </h3>
            <p className="text-[#f5f5fa7a] mb-6">
              Your data has been successfully uploaded to Walrus
            </p>
            <div className="flex flex-col gap-4">
              <div className="bg-[#f5f5fa0a] rounded-xl p-4">
                <p className="text-sm text-[#f5f5fa7a] mb-2">Blob Details</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-sm text-[#f5f5fa7a]">Blob ID:</p>
                    <p className="font-mono text-sm text-[#f5f5faf4]">
                      {walrusData?.blobId ||
                        submissionData.encryptionStatus?.blobId}
                    </p>
                  </div>
                  {(walrusData?.objectId ||
                    submissionData.encryptionStatus?.objectId) && (
                    <div className="flex justify-between">
                      <p className="text-sm text-[#f5f5fa7a]">Object ID:</p>
                      <p className="font-mono text-sm text-[#f5f5faf4]">
                        {walrusData?.objectId ||
                          submissionData.encryptionStatus?.objectId}
                      </p>
                    </div>
                  )}
                  {(walrusData?.size ||
                    submissionData.encryptionStatus?.size) && (
                    <div className="flex justify-between">
                      <p className="text-sm text-[#f5f5fa7a]">Size:</p>
                      <p className="font-mono text-sm text-[#f5f5faf4]">
                        {formatFileSize(
                          walrusData?.size ||
                            submissionData.encryptionStatus?.size
                        )}
                      </p>
                    </div>
                  )}
                  {(walrusData?.storage ||
                    submissionData.encryptionStatus?.storage) && (
                    <div className="flex justify-between">
                      <p className="text-sm text-[#f5f5fa7a]">
                        Storage Period:
                      </p>
                      <p className="font-mono text-sm text-[#f5f5faf4]">
                        Epochs{' '}
                        {walrusData?.storage?.startEpoch ||
                          submissionData.encryptionStatus?.storage
                            ?.startEpoch}{' '}
                        to{' '}
                        {walrusData?.storage?.endEpoch ||
                          submissionData.encryptionStatus?.storage?.endEpoch}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleOnChainSubmission}
                disabled={isSubmitting}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit On-chain'}
              </button>
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl border border-[#f5f5fa14] text-[#f5f5faf4] font-semibold hover:bg-[#f5f5fa14] transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format file size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default EncryptData;
