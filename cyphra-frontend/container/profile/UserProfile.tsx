import React, { useState } from 'react';
import {
  HiOutlineShieldCheck,
  HiOutlineChartBar,
  HiOutlineDocumentText,
  HiOutlineCurrencyDollar,
  HiOutlineClipboardCheck,
  HiOutlineUserGroup,
  HiOutlineBadgeCheck,
  HiOutlineStar,
  HiOutlineSparkles,
  HiSparkles,
  HiOutlineCalendar,
  HiOutlineRefresh,
  HiOutlineBadgeCheck as HiOutlineVerified,
  HiOutlineLightningBolt,
  HiOutlineCode,
  HiOutlineDatabase,
  HiOutlineExternalLink,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlinePlay,
} from 'react-icons/hi';
import ProfileBanner from '@/components/ui/profile/ProfileBanner';
import StatsGrid from '@/components/ui/profile/StatsGrid';
import BadgeGrid from '@/components/ui/profile/BadgeGrid';
import { octasToMove } from '@/utils/sui/octasToMove';
import { useRouter } from 'next/router';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { truncateAddress } from '@/utils/sui/truncateAddress';
import { useSubscription } from '@/context/SubscriptionContext';
import axios from 'axios';

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

const getBadgeIcon = (badgeType: number) => {
  // Contributor badges
  if (badgeType >= 1 && badgeType <= 3) {
    return <HiOutlineClipboardCheck className="w-6 h-6" />;
  }
  // Campaign creator badges
  if (badgeType >= 10 && badgeType <= 13) {
    return <HiOutlineDocumentText className="w-6 h-6" />;
  }
  // Verifier badges
  if (badgeType >= 20 && badgeType <= 22) {
    return <HiOutlineShieldCheck className="w-6 h-6" />;
  }
  // Achievement badges
  if (badgeType >= 30 && badgeType <= 32) {
    return <HiOutlineStar className="w-6 h-6" />;
  }
  // Default
  return <HiOutlineBadgeCheck className="w-6 h-6" />;
};

// Badge color mapping based on badge type
const getBadgeColor = (badgeType: number) => {
  // Contributor badges
  if (badgeType >= 1 && badgeType <= 3) {
    return 'from-blue-500 to-purple-500';
  }
  // Campaign creator badges
  if (badgeType >= 10 && badgeType <= 13) {
    return 'from-green-500 to-emerald-500';
  }
  // Verifier badges
  if (badgeType >= 20 && badgeType <= 22) {
    return 'from-yellow-500 to-amber-500';
  }
  // Achievement badges
  if (badgeType >= 30 && badgeType <= 32) {
    return 'from-purple-500 to-pink-500';
  }
  // Default
  return 'from-indigo-500 to-blue-500';
};

// Badge description mapping
const getBadgeDescription = (badgeType: number) => {
  switch (badgeType) {
    // Contributor badges
    case 1:
      return 'Contributed to multiple campaigns';
    case 2:
      return 'Consistently high-quality contributions';
    case 3:
      return 'Expert-level contributions to the platform';

    // Campaign creator badges
    case 10:
      return 'Created campaigns on the platform';
    case 11:
      return 'Consistently pays contributors on time';
    case 12:
      return 'Created multiple successful campaigns';
    case 13:
      return 'Expert-level campaign creation and management';

    // Verifier badges
    case 20:
      return 'Verified contributions on the platform';
    case 21:
      return 'Trusted by the community for fair verification';
    case 22:
      return 'Expert-level verification skills';

    // Achievement badges
    case 30:
      return 'Completed first contribution on the platform';
    case 31:
      return 'Created first campaign on the platform';
    case 32:
      return 'Completed first verification on the platform';

    default:
      return 'Achievement unlocked on the Hyvve platform';
  }
};

// API fetching functions
const fetchUserStats = async (address: string) => {
  const response = await fetch(
    `/api/reputation/getUserStats?address=${address}`
  );
  // Always return the JSON response, even if it contains default/empty data
  return response.json();
};

const fetchTrainingJobs = async (address: string) => {
  const response = await axios.get(
    `${baseUrl}/mlops/training-jobs/by-user/${address}`
  );
  return response.data;
};

const fetchProcessedDatasets = async (address: string) => {
  const response = await axios.get(`${baseUrl}/mlops/datasets`, {
    params: {
      creator_wallet: address,
      skip: 0,
      limit: 100,
    },
  });
  return response.data;
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return { color: 'text-green-500 bg-green-500/20', text: 'Completed' };
      case 'queued':
      case 'pending':
        return { color: 'text-amber-500 bg-amber-500/20', text: 'Queued' };
      case 'processing':
      case 'running':
        return { color: 'text-blue-500 bg-blue-500/20', text: 'Running' };
      case 'failed':
        return { color: 'text-red-500 bg-red-500/20', text: 'Failed' };
      default:
        return { color: 'text-gray-500 bg-gray-500/20', text: status };
    }
  };

  const config = getStatusConfig(status);
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.text}
    </span>
  );
};

// Training Job Card
const TrainingJobCard = ({ job }: { job: any }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper function to format Hugging Face URL with /tree/main
  const formatHuggingFaceUrl = (url?: string) => {
    if (!url) return '';
    // Remove any existing /tree/main suffix to avoid duplication
    const baseUrl = url.replace(/\/tree\/main\/?$/, '');
    return `${baseUrl}/tree/main`;
  };

  return (
    <div className="bg-[#f5f5fa0a] rounded-xl p-6 border border-[#f5f5fa14] hover:border-[#f5f5fa20] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
            <HiOutlineCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-[#f5f5faf4] font-medium text-lg">
              {job.job_name}
            </h3>
            <p className="text-[#f5f5fa7a] text-sm">
              {job.hyperparameters?.base_model_id || 'Unknown Model'}
            </p>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">Platform</p>
          <p className="text-[#f5f5faf4] text-sm capitalize">
            {job.platform.replace('_', ' ')}
          </p>
        </div>
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">Created</p>
          <p className="text-[#f5f5faf4] text-sm">
            {formatDate(job.created_at)}
          </p>
        </div>
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">Epochs</p>
          <p className="text-[#f5f5faf4] text-sm">
            {job.hyperparameters?.epochs || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">Learning Rate</p>
          <p className="text-[#f5f5faf4] text-sm">
            {job.hyperparameters?.learning_rate
              ? job.hyperparameters.learning_rate.toExponential(2)
              : 'N/A'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {job.logs_url &&
          (job.status === 'failed' || job.status === 'submitted') && (
            <a
              href={job.logs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#f5f5fa14] text-[#f5f5faf4] hover:bg-[#f5f5fa0a] transition-colors flex items-center justify-center gap-1"
            >
              <HiOutlineExternalLink className="w-3 h-3" />
              View Logs
            </a>
          )}
        {job.output_model_url && job.status === 'completed' && (
          <a
            href={formatHuggingFaceUrl(job.output_model_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
          >
            <HiOutlineExternalLink className="w-3 h-3" />
            View Model
          </a>
        )}
      </div>
    </div>
  );
};

// Processed Dataset Card
const ProcessedDatasetCard = ({ dataset }: { dataset: any }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-[#f5f5fa0a] rounded-xl p-6 border border-[#f5f5fa14] hover:border-[#f5f5fa20] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center justify-center">
            <HiOutlineDatabase className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-[#f5f5faf4] font-medium text-lg">
              {dataset.name}
            </h3>
            <p className="text-[#f5f5fa7a] text-sm line-clamp-2 mt-1">
              {dataset.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">Campaign ID</p>
          <p className="text-[#f5f5faf4] text-sm font-mono">
            {dataset.onchain_campaign_id?.slice(0, 16)}...
          </p>
        </div>
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">Created</p>
          <p className="text-[#f5f5faf4] text-sm">
            {formatDate(dataset.created_at)}
          </p>
        </div>
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">Contributions</p>
          <p className="text-[#f5f5faf4] text-sm">
            {dataset.metadata_?.num_source_contributions || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-[#f5f5fa7a] text-xs mb-1">File Type</p>
          <p className="text-[#f5f5faf4] text-sm">
            {dataset.metadata_?.processed_file_type || 'N/A'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#f5f5fa14] text-[#f5f5faf4]">
          <span className="text-[#f5f5fa7a]">Storage:</span>{' '}
          {dataset.storage_type}
        </div>
        {/* {dataset.storage_url && (
          <a
            href={dataset.storage_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs rounded-lg bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <HiOutlineExternalLink className="w-3 h-3" />
            Download
          </a>
        )} */}
      </div>
    </div>
  );
};

const UserProfile = () => {
  const account = useCurrentAccount();
  const walletAddress = account?.address;
  const username = 'Anon';
  const { isSubscribed, subscriptionStatus } = useSubscription();
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'training' | 'datasets'>(
    'training'
  );

  // Fetch financial stats
  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['userStats', walletAddress],
    queryFn: () => fetchUserStats(walletAddress as string),
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch training jobs
  const {
    data: trainingJobs,
    isLoading: isTrainingLoading,
    error: trainingError,
  } = useQuery({
    queryKey: ['trainingJobs', walletAddress],
    queryFn: () => fetchTrainingJobs(walletAddress as string),
    enabled: !!walletAddress,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch processed datasets
  const {
    data: processedDatasets,
    isLoading: isDatasetsLoading,
    error: datasetsError,
  } = useQuery({
    queryKey: ['processedDatasets', walletAddress],
    queryFn: () => fetchProcessedDatasets(walletAddress as string),
    enabled: !!walletAddress,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const isLoading = isStatsLoading;
  const error = statsError;

  const profileStats = {
    campaignsCreated: octasToMove(statsData?.stats?.campaignsCreated || 0),
    campaignsEarnings: octasToMove(statsData?.stats?.totalSpent || 0),
    contributionsMade: octasToMove(statsData?.stats?.totalContributions || 0),
    contributionsEarnings: octasToMove(statsData?.stats?.totalEarned || 0),
    reputationScore: statsData?.stats?.reputationScore || 0,
  };

  // Format subscription end date if available
  const formatSubscriptionEndDate = () => {
    if (!subscriptionStatus?.endTime) return null;

    const endDate = new Date(subscriptionStatus.endTime);
    return endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate days remaining until subscription expires
  const getDaysRemaining = () => {
    if (!subscriptionStatus?.endTime) return null;

    const endDate = new Date(subscriptionStatus.endTime);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="lg:max-w-[1100px] max-w-[1512px] text-white mt-20">
      <ProfileBanner
        walletAddress={walletAddress && truncateAddress(walletAddress)}
        username={username}
        reputationScore={statsData?.stats?.reputationScore}
      />

      <div className="max-w-7xl mx-auto px-8 pt-24">
        {/* Enhanced Subscription Status Banner */}
        {isSubscribed && (
          <div className="mb-8 overflow-hidden">
            <div className="relative bg-gradient-to-r from-[#6366f1]/20 to-[#a855f7]/20 rounded-xl border border-[#a855f7]/30 shadow-lg">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#6366f1] to-[#a855f7] rounded-full opacity-10 -mr-10 -mt-10"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-[#6366f1] to-[#a855f7] rounded-full opacity-10 -ml-10 -mb-10"></div>

              <div className="relative p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] p-0.5">
                        <div className="w-full h-full rounded-full bg-[#0f0f17] flex items-center justify-center">
                          <HiSparkles className="h-8 w-8 text-[#a855f7]" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center">
                        <h3 className="text-xl font-bold text-white">
                          Premium Membership
                        </h3>
                        <span className="ml-3 px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-[#22c55e]/80 to-[#16a34a]/80 text-white">
                          Active
                        </span>
                      </div>

                      <p className="text-[#f5f5fa7a] mt-1">
                        Enjoy exclusive features and benefits with your{' '}
                        {subscriptionStatus?.subscriptionType || 'Premium'}{' '}
                        subscription
                      </p>

                      <button
                        onClick={() =>
                          setShowSubscriptionDetails(!showSubscriptionDetails)
                        }
                        className="mt-2 text-sm text-[#a855f7] hover:text-[#6366f1] transition-colors flex items-center"
                      >
                        {showSubscriptionDetails
                          ? 'Hide details'
                          : 'View details'}
                        <svg
                          className={`ml-1 h-4 w-4 transition-transform ${
                            showSubscriptionDetails ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Subscription status card */}
                  <div className="mt-4 md:mt-0 flex-shrink-0">
                    <div className="bg-[#f5f5fa0a] backdrop-blur-sm rounded-lg p-3 border border-[#f5f5fa14]">
                      {daysRemaining !== null && (
                        <div className="text-center">
                          <span className="text-2xl font-bold text-white">
                            {daysRemaining}
                          </span>
                          <p className="text-xs text-[#f5f5fa7a]">
                            days remaining
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable details section */}
                {showSubscriptionDetails && (
                  <div className="mt-6 pt-4 border-t border-[#f5f5fa14] grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-3 bg-[#f5f5fa0a] rounded-lg p-3">
                      <div className="w-8 h-8 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                        <HiOutlineCalendar className="h-4 w-4 text-[#6366f1]" />
                      </div>
                      <div>
                        <p className="text-xs text-[#f5f5fa7a]">Expires on</p>
                        <p className="text-sm font-medium text-white">
                          {formatSubscriptionEndDate() || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 bg-[#f5f5fa0a] rounded-lg p-3">
                      <div className="w-8 h-8 rounded-full bg-[#a855f7]/20 flex items-center justify-center">
                        <HiOutlineRefresh className="h-4 w-4 text-[#a855f7]" />
                      </div>
                      <div>
                        <p className="text-xs text-[#f5f5fa7a]">Auto-renewal</p>
                        <p className="text-sm font-medium text-white">
                          {subscriptionStatus?.autoRenew
                            ? 'Enabled'
                            : 'Disabled'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 bg-[#f5f5fa0a] rounded-lg p-3">
                      <div className="w-8 h-8 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
                        <HiOutlineVerified className="h-4 w-4 text-[#22c55e]" />
                      </div>
                      <div>
                        <p className="text-xs text-[#f5f5fa7a]">
                          Subscription type
                        </p>
                        <p className="text-sm font-medium text-white">
                          {subscriptionStatus?.subscriptionType || 'Premium'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-[#f5f5fa0a] rounded-xl p-6 border border-[#f5f5fa14] h-32"
                >
                  <div className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-[#f5f5fa14] h-12 w-12"></div>
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-[#f5f5fa14] rounded w-3/4"></div>
                      <div className="h-6 bg-[#f5f5fa14] rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">
              Error: {(error as Error).message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <StatsGrid stats={profileStats} statsData={statsData?.stats} />

            {/* ML Operations Section */}
            <div className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#f5f5faf4]">
                  ML Operations
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 bg-[#f5f5fa0a] rounded-lg p-1 mb-6">
                <button
                  onClick={() => setActiveTab('training')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'training'
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white'
                      : 'text-[#f5f5fa7a] hover:text-[#f5f5faf4]'
                  }`}
                >
                  Training Jobs ({trainingJobs?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('datasets')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'datasets'
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white'
                      : 'text-[#f5f5fa7a] hover:text-[#f5f5faf4]'
                  }`}
                >
                  Processed Data ({processedDatasets?.length || 0})
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'training' && (
                <div>
                  {isTrainingLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="bg-[#f5f5fa0a] rounded-xl p-6 border border-[#f5f5fa14] h-64 animate-pulse"
                        >
                          <div className="flex items-start space-x-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-[#f5f5fa14]"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-[#f5f5fa14] rounded w-3/4"></div>
                              <div className="h-3 bg-[#f5f5fa14] rounded w-1/2"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : trainingError ? (
                    <div className="text-center py-12">
                      <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                      <p className="text-red-500 mb-4">
                        Failed to load training jobs
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : !trainingJobs || trainingJobs.length === 0 ? (
                    <div className="text-center py-12">
                      <HiOutlineCode className="w-12 h-12 text-[#f5f5fa7a] mx-auto mb-4" />
                      <h3 className="text-[#f5f5faf4] text-lg font-medium mb-2">
                        No Training Jobs Yet
                      </h3>
                      <p className="text-[#f5f5fa7a] text-sm">
                        Start fine-tuning AI models from your campaign data to
                        see them here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {trainingJobs.map((job: any) => (
                        <TrainingJobCard key={job.id} job={job} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'datasets' && (
                <div>
                  {isDatasetsLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="bg-[#f5f5fa0a] rounded-xl p-6 border border-[#f5f5fa14] h-64 animate-pulse"
                        >
                          <div className="flex items-start space-x-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-[#f5f5fa14]"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-[#f5f5fa14] rounded w-3/4"></div>
                              <div className="h-3 bg-[#f5f5fa14] rounded w-full"></div>
                              <div className="h-3 bg-[#f5f5fa14] rounded w-2/3"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : datasetsError ? (
                    <div className="text-center py-12">
                      <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                      <p className="text-red-500 mb-4">
                        Failed to load processed datasets
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : !processedDatasets || processedDatasets.length === 0 ? (
                    <div className="text-center py-12">
                      <HiOutlineDatabase className="w-12 h-12 text-[#f5f5fa7a] mx-auto mb-4" />
                      <h3 className="text-[#f5f5faf4] text-lg font-medium mb-2">
                        No Processed Data Yet
                      </h3>
                      <p className="text-[#f5f5fa7a] text-sm">
                        Process campaign data for training to see datasets here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {processedDatasets.map((dataset: any) => (
                        <ProcessedDatasetCard
                          key={dataset.id}
                          dataset={dataset}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
