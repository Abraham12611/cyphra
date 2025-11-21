import React, { useEffect, useState, useCallback } from 'react';
import {
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import useCampaignStore from '@/helpers/store/useCampaignStore';

interface AIVerificationProps {
  onNext: () => void;
  onBack: () => void;
  submissionData: {
    name: string;
    file: File | null;
    aiVerificationResult: any;
    campaignId?: string;
    walletAddress?: string;
  };
  updateSubmissionData: (data: Partial<{ aiVerificationResult: any }>) => void;
}

interface VerificationCheck {
  name: string;
  status: 'passed' | 'failed' | 'pending';
  message?: string;
}

const PASS_MARK = 70;
const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
const useSimulation = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';

const AIVerification: React.FC<AIVerificationProps> = ({
  onNext,
  onBack,
  submissionData,
  updateSubmissionData,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);
  const [checks, setChecks] = useState<VerificationCheck[]>([
    { name: 'Quality Check', status: 'pending' },
  ]);

  const { campaign } = useCampaignStore();

  // Handle progress simulation separately
  useEffect(() => {
    if (!isAnalyzing) return;

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 2 : prev));
    }, 100);

    return () => clearInterval(progressInterval);
  }, [isAnalyzing]);

  const simulateVerification = useCallback(async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 6000));

      const randomScore = Math.floor(Math.random() * 21) + 80;

      const result = {
        message: 'Submission processed.',
        onchain_campaign_id: 'campaign_20cfa0e68a1ef694',
        contributor_wallet_address:
          submissionData.walletAddress ||
          '0x8b0feb23f410bdebc133b93856b5cb5df6caab9d085d900d40da569ae83762f4',
        decision: 'ACCEPT',
        score: randomScore,
        reasoning: `Score ${randomScore} accepted against threshold ${PASS_MARK}.`,
        file_type_processed: campaign?.campaign_type?.toLowerCase() || 'text',
      };

      console.log('Simulated verification result:', result);

      setIsAnalyzing(false);
      setProgress(100);
      setVerificationDetails(result);

      const passed = result.decision === 'ACCEPT';
      const score = result.score || 0;

      updateSubmissionData({
        aiVerificationResult: {
          status: passed ? 'success' : 'failed',
          score: score,
          details: result,
          checks: [
            {
              name: 'Quality Check',
              status: passed ? 'passed' : 'failed',
              message:
                result.reasoning ||
                (passed
                  ? 'Data meets quality requirements'
                  : 'Data quality score is below required threshold'),
            },
          ],
        },
      });

      if (!passed) {
        setError(
          `Quality score (${Math.round(
            score
          )}%) is below the required threshold of ${PASS_MARK}%`
        );
      }
    } catch (err) {
      console.error('Simulation error:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
      setIsAnalyzing(false);
      setProgress(0);
      updateSubmissionData({
        aiVerificationResult: {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Verification failed',
        },
      });
    }
  }, [updateSubmissionData, submissionData.walletAddress, campaign]);

  const getGenericRejectionResult = (originalResult: any) => {
    // If the original score exists and is a number, use it if it's below the threshold
    // Otherwise use a consistent score just below the threshold
    const score =
      originalResult.score !== null &&
      originalResult.score !== undefined &&
      !isNaN(Number(originalResult.score)) &&
      Number(originalResult.score) < PASS_MARK
        ? Number(originalResult.score)
        : PASS_MARK - 40; // Consistently 5 points below threshold

    // Use original reasoning if it exists, otherwise provide a generic one
    const originalReasoning = originalResult.reasoning || '';

    // Standard rejection reasons
    const rejectionReason =
      originalResult.decision === 'UNKNOWN'
        ? 'Verification could not be completed. The content may not meet required criteria or format.'
        : 'Content does not meet the minimum quality standards required for this campaign.';

    return {
      ...originalResult,
      score: score,
      decision: 'REJECTED',
      reasoning:
        originalReasoning ||
        `Score ${score} rejected against threshold ${PASS_MARK}. ${rejectionReason}`,
    };
  };

  const performRealVerification = useCallback(async () => {
    if (!submissionData.file || !campaign) return;

    try {
      const formData = new FormData();
      formData.append(
        'onchain_campaign_id',
        submissionData.campaignId || campaign.onchain_campaign_id || ''
      );
      formData.append(
        'wallet_address',
        submissionData.walletAddress ||
          '0x810c0ea5b2de31e9d9d34e3041cefd1f198c68551cabe7a9f601d0a49121f823'
      );

      formData.append(
        'submission_file',
        submissionData.file,
        submissionData.file.name
      );

      const endpoint =
        campaign.campaign_type === 'Text'
          ? `${baseUrl}/ai-verification/verify-submission`
          : `${baseUrl}/ai-verification/verify-submission`;

      console.log('Endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,

        headers: {
          // Explicitly adding these headers to match a typical browser request
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response text:', errorText);

        let errorData;
        try {
          // Try to parse as JSON if possible
          errorData = JSON.parse(errorText);
        } catch (e) {
          // If not JSON, use the raw text
          errorData = { message: errorText };
        }

        throw new Error(
          errorData?.message ||
            `Verification failed with status ${response.status}`
        );
      }

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      // Try to parse the response as JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response format');
      }

      console.log('Real verification result:', result);

      // Handle cases where decision is unknown or rejected or score is null
      if (
        result.decision?.toUpperCase() !== 'ACCEPT' ||
        result.score === null ||
        result.score === undefined
      ) {
        result = getGenericRejectionResult(result);
      }

      setIsAnalyzing(false);
      setProgress(100);
      setVerificationDetails(result);

      const passed = result.decision?.toUpperCase() === 'ACCEPT';
      const score = result.score || 0;

      updateSubmissionData({
        aiVerificationResult: {
          status: passed ? 'success' : 'failed',
          score: score,
          details: result,
          checks: [
            {
              name: 'Quality Check',
              status: passed ? 'passed' : 'failed',
              message:
                result.reasoning ||
                (passed
                  ? 'Data meets quality requirements'
                  : 'Data quality score is below required threshold'),
            },
          ],
        },
      });

      if (!passed) {
        setError(
          `Quality score (${Math.round(
            score
          )}%) is below the required threshold of ${PASS_MARK}%`
        );
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
      setIsAnalyzing(false);
      setProgress(0);
      updateSubmissionData({
        aiVerificationResult: {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Verification failed',
        },
      });
    }
  }, [
    submissionData.file,
    submissionData.campaignId,
    submissionData.walletAddress,
    updateSubmissionData,
    campaign,
  ]);

  const verifyData = useCallback(async () => {
    if (!submissionData.file || verificationStarted || !campaign) return;

    setVerificationStarted(true);

    if (useSimulation) {
      await simulateVerification();
    } else {
      await performRealVerification();
    }
  }, [
    submissionData.file,
    verificationStarted,
    campaign,
    useSimulation,
    simulateVerification,
    performRealVerification,
  ]);

  useEffect(() => {
    if (submissionData.file && !verificationStarted) {
      verifyData();
    }
  }, [submissionData.file, verifyData, verificationStarted]);

  const handleRetry = () => {
    setError(null);
    setIsAnalyzing(true);
    setProgress(0);
    setVerificationStarted(false); // Reset the verification flag
  };

  // Helper function to truncate addresses
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  if (error) {
    return (
      <div className="relative h-full flex flex-col">
        <div className="flex-1 space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Verification Failed
            </h3>
            <p className="text-[#f5f5fa7a]">{error}</p>
          </div>
        </div>

        <div className="flex justify-between pt-4 pb-[10px]">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-xl border border-[#f5f5fa14] text-[#f5f5faf4] font-semibold hover:bg-[#f5f5fa14] transition-colors focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:ring-offset-2 focus:ring-offset-[#0f0f17]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleRetry}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-semibold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:ring-offset-2 focus:ring-offset-[#0f0f17]"
          >
            Retry Verification
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 space-y-6">
        {isAnalyzing ? (
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-24 h-24">
              <SparklesIcon className="w-24 h-24 text-[#a855f7] animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#f5f5faf4] mb-2">
                Analyzing Your{' '}
                {campaign?.campaign_type === 'Text' ? 'Data' : 'Image'}
              </h3>
              <p className="text-[#f5f5fa7a]">
                Our AI is verifying the quality and format of your submission
              </p>
            </div>
            <div className="w-full bg-[#f5f5fa14] rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircleIcon className="w-10 h-10 text-[#22c55e]" />
              </div>
              <h3 className="text-lg font-medium text-[#f5f5faf4] mb-2">
                Verification Complete
              </h3>
              <p className="text-[#f5f5fa7a]">
                Your {campaign?.campaign_type === 'Text' ? 'data' : 'image'} has
                passed our AI verification checks
              </p>
            </div>

            {/* Beautiful Verification Details */}
            {verificationDetails && (
              <div className="bg-gradient-to-r from-[#6366f114] to-[#a855f714] rounded-xl p-6 border border-[#f5f5fa14]">
                <div className="flex flex-col gap-4">
                  {/* Score Card */}
                  <div className="bg-[#f5f5fa0a] rounded-lg p-4 border border-[#f5f5fa14]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#f5f5faf4] font-medium">
                        Quality Score
                      </span>
                      <div className="flex items-center">
                        <span
                          className={`text-xl font-bold ${
                            Number(verificationDetails.score) >= PASS_MARK
                              ? 'text-[#22c55e]'
                              : 'text-red-500'
                          }`}
                        >
                          {Number(verificationDetails.score).toFixed(2)}%
                        </span>
                        <span className="text-[#f5f5fa7a] ml-2 text-sm">
                          (Threshold: {PASS_MARK}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#f5f5fa14] rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          Number(verificationDetails.score) >= PASS_MARK
                            ? 'bg-gradient-to-r from-[#22c55e] to-[#4ade80]'
                            : 'bg-gradient-to-r from-[#f43f5e] to-[#fb7185]'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Number(verificationDetails.score)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Decision */}
                  <div className="flex items-center gap-3 bg-[#f5f5fa0a] rounded-lg p-4 border border-[#f5f5fa14]">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full ${
                        verificationDetails.decision?.toUpperCase() === 'ACCEPT'
                          ? 'bg-[#22c55e]/20'
                          : 'bg-red-500/20'
                      } flex items-center justify-center`}
                    >
                      {verificationDetails.decision?.toUpperCase() ===
                      'ACCEPT' ? (
                        <CheckCircleIcon className="w-6 h-6 text-[#22c55e]" />
                      ) : (
                        <XCircleIcon className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-[#f5f5faf4] font-medium">
                          Decision:
                        </span>
                        <span
                          className={`ml-2 font-bold ${
                            verificationDetails.decision?.toUpperCase() ===
                            'ACCEPT'
                              ? 'text-[#22c55e]'
                              : 'text-red-500'
                          }`}
                        >
                          {verificationDetails.decision?.toUpperCase() ===
                          'ACCEPT'
                            ? 'ACCEPTED'
                            : 'REJECTED'}
                        </span>
                      </div>
                      <p className="text-sm text-[#f5f5fa7a] mt-1">
                        {verificationDetails.reasoning}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 pb-[10px]">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-[#f5f5fa14] text-[#f5f5faf4] font-semibold hover:bg-[#f5f5fa14] transition-colors focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:ring-offset-2 focus:ring-offset-[#0f0f17]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={
            isAnalyzing ||
            !submissionData.aiVerificationResult ||
            submissionData.aiVerificationResult.status === 'failed'
          }
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-semibold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:ring-offset-2 focus:ring-offset-[#0f0f17] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Walrus Upload
        </button>
      </div>
    </div>
  );
};

export default AIVerification;
