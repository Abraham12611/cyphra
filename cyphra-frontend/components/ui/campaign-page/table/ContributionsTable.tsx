import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import ContributionsTableRow from './ContributionsTableRow';
import { HiFilter } from 'react-icons/hi';
import { useQuery, useQueries } from '@tanstack/react-query';

// Table contribution interface that the row component expects
interface TableContribution {
  id: string;
  creator: {
    avatar: string;
    name: string;
    address: string;
    reputation: number;
  };
  verificationStatus: 'Verified' | 'Pending';
  verifierReputation: number;
  qualityScore: number;
  rewardStatus: 'Released' | 'Pending';
  dataUrl: string;
  submittedAt: string;
  rewardAmount: number;
}

// Sui blockchain API response interface
interface SuiContributionResponse {
  success: boolean;
  campaignId: string;
  contributions: Array<{
    contribution_id: string;
    campaign_id: string;
    contributor: string;
    data_url: string;
    data_hash: string;
    timestamp: string;
    formatted_timestamp: string;
    is_verified: boolean;
    reward_released: boolean;
    verification_scores: {
      fields: {
        quality_score: string;
        verifier_reputation: string;
      };
    };
    quality_score: string;
  }>;
  stats: {
    totalContributions: number;
    verifiedContributions: number;
    rewardsReleased: number;
    verificationRate: string;
    rewardRate: string;
  };
}

interface ReputationResponse {
  success: boolean;
  message?: string;
  reputation?: {
    address: string;
    reputation_score: string;
    contribution_count: string;
    successful_payments: string;
    campaign_contribution_count: string;
    has_store: boolean;
    badge_count: string;
    badges: any[];
    next_badges: any[];
  };
  error?: string;
  errorCode?: string;
}

interface ContributionsTableProps {
  onContributionsChange: (
    contributions: Array<{
      dataUrl: string;
      creator: {
        name: string;
      };
    }>
  ) => void;
}

const ContributionsTable: React.FC<ContributionsTableProps> = ({
  onContributionsChange,
}) => {
  const router = useRouter();
  const { id } = router.query;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Fetch contributions from the Sui blockchain
  const { data, isLoading, isError, isFetching } =
    useQuery<SuiContributionResponse>({
      queryKey: ['contributions-sui', id],
      queryFn: async () => {
        if (!id) return null as unknown as SuiContributionResponse;
        const response = await fetch(
          `/api/campaign/getCampaignContributions?campaignId=${id}`
        );
        console.log('SUI Contributions API Response:', response);
        if (!response.ok) {
          throw new Error('Failed to fetch SUI contributions');
        }
        const data = await response.json();
        console.log('SUI Contributions API Response:', data);
        return data;
      },
      enabled: !!id,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchInterval: 30000, // Poll every 30 seconds
      retry: 1,
    });

  // Memoize the filtered data
  const filteredData = useMemo(
    () =>
      data?.contributions?.filter((contribution) => {
        const matchesSearch = contribution.contributor
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

        const matchesStatus =
          statusFilter === 'All' ||
          (statusFilter === 'Verified' && contribution.is_verified) ||
          (statusFilter === 'Pending' && !contribution.is_verified);

        return matchesSearch && matchesStatus;
      }) || [],
    [data?.contributions, searchTerm, statusFilter]
  );

  // Get unique contributor addresses for reputation fetching
  const uniqueContributors = useMemo(() => {
    const addresses = new Set<string>();
    filteredData.forEach((contribution) => {
      addresses.add(contribution.contributor);
    });
    return Array.from(addresses);
  }, [filteredData]);

  // Fetch reputation data for all contributors
  const reputationQueries = useQueries({
    queries: uniqueContributors.map((address) => ({
      queryKey: ['reputation', address],
      queryFn: async () => {
        const response = await fetch(
          `/api/campaign/get_user_reputation?address=${address}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch reputation');
        }
        return response.json() as Promise<ReputationResponse>;
      },
      staleTime: 10 * 60 * 1000, // Cache for 10 minutes
      cacheTime: 10 * 60 * 1000, // Cache for 10 minutes
    })),
  });

  // Create a map of address to reputation data
  const reputationMap = useMemo(() => {
    const map = new Map<string, number>();
    reputationQueries.forEach((query) => {
      if (query.data?.success && query.data.reputation) {
        map.set(
          query.data.reputation.address,
          parseInt(query.data.reputation.reputation_score) || 0
        );
      }
    });
    return map;
  }, [reputationQueries]);

  // Memoize the transformed data for parent component
  const transformedData = useMemo(
    () =>
      filteredData.map((contribution) => ({
        dataUrl: contribution.data_url,
        creator: {
          name: `${contribution.contributor.slice(
            0,
            6
          )}...${contribution.contributor.slice(-4)}`,
        },
      })),
    [filteredData]
  );

  // Update parent component only when transformed data changes
  React.useEffect(() => {
    onContributionsChange(transformedData);
  }, [transformedData, onContributionsChange]);

  // Show loading only on initial load (when no data is available)
  if (isLoading && !data) {
    return (
      <div className="text-center py-8">
        <p className="text-[#f5f5fa7a] text-sm animate-pulse">
          Loading contributions...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 text-sm">
          Error loading contributions. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-5">
      {/* Stats Summary */}
      {data?.stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[#f5f5fa0a]">
            <p className="text-[#f5f5fa7a] text-xs">Total Contributions</p>
            <p className="text-[#f5f5faf4] text-xl font-semibold">
              {data.stats.totalContributions}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#f5f5fa0a]">
            <p className="text-[#f5f5fa7a] text-xs">Verified</p>
            <p className="text-[#f5f5faf4] text-xl font-semibold">
              {data.stats.verifiedContributions}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#f5f5fa0a]">
            <p className="text-[#f5f5fa7a] text-xs">Verification Rate</p>
            <p className="text-[#f5f5faf4] text-xl font-semibold">
              {data.stats.verificationRate}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#f5f5fa0a]">
            <p className="text-[#f5f5fa7a] text-xs">Rewards Released</p>
            <p className="text-[#f5f5faf4] text-xl font-semibold">
              {data.stats.rewardsReleased}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#f5f5fa14] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f5f5fa14]">
              <th className="text-left py-4 px-6 text-[#87858F] text-xs font-medium">
                Contributor
              </th>
              <th className="text-left py-4 px-6 text-[#87858F] text-xs font-medium">
                Status
              </th>
              <th className="text-left py-4 px-6 text-[#87858F] text-xs font-medium">
                <div className="flex items-center gap-1">
                  <span>Agent Verifier Rep.</span>
                  <HiFilter className="w-3 h-3" />
                </div>
              </th>
              <th className="text-left py-4 px-6 text-[#87858F] text-xs font-medium">
                <div className="flex items-center gap-1">
                  <span>Quality</span>
                  <HiFilter className="w-3 h-3" />
                </div>
              </th>
              <th className="text-left py-4 px-6 text-[#87858F] text-xs font-medium">
                Reward
              </th>
              <th className="text-left py-4 px-6 text-[#87858F] text-xs font-medium">
                Submitted
              </th>
              <th className="text-left py-4 px-6 text-[#87858F] text-xs font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5fa14]">
            {filteredData.map((contribution) => (
              <ContributionsTableRow
                key={contribution.contribution_id}
                contribution={
                  {
                    id: contribution.contribution_id,
                    creator: {
                      avatar:
                        'https://pbs.twimg.com/profile_images/1744477796301496320/z7AIB7_W_400x400.jpg',
                      name: `${contribution.contributor.slice(
                        0,
                        6
                      )}...${contribution.contributor.slice(-4)}`,
                      address: contribution.contributor,
                      reputation:
                        reputationMap.get(contribution.contributor) || 0,
                    },
                    verificationStatus: contribution.is_verified
                      ? 'Verified'
                      : 'Pending',
                    verifierReputation: parseInt(
                      contribution.verification_scores?.fields
                        ?.verifier_reputation || '0'
                    ),
                    qualityScore: parseInt(contribution.quality_score || '0'),
                    rewardStatus: contribution.reward_released
                      ? 'Released'
                      : 'Pending',
                    dataUrl: contribution.data_url,
                    submittedAt:
                      contribution.formatted_timestamp ||
                      contribution.timestamp,
                    rewardAmount: 0, // We don't have this in the current response
                  } as TableContribution
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredData.length === 0 && (
        <div className="text-center py-8">
          <p className="text-[#f5f5fa7a] text-sm">
            No contributions found matching your criteria
          </p>
        </div>
      )}
    </div>
  );
};

export default ContributionsTable;
