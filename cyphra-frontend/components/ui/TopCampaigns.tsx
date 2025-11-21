import React, { useEffect, useState } from 'react';
import TopCampaignsCard from './cards/TopCampaignsCard';
import { useQuery } from '@tanstack/react-query';

interface LeaderboardCreator {
  creator: string;
  reputation_score: number | null;
  total_amount_spent: number;
  total_campaigns: number;
}

interface UserReputation {
  reputation_score: number;
  contribution_count: number;
  successful_payments: number;
  has_store: boolean;
}

interface CreatorWithReputation extends LeaderboardCreator {
  actualReputationScore: number;
}

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

const TopContributors = () => {
  const [creatorsWithReputation, setCreatorsWithReputation] = useState<
    CreatorWithReputation[]
  >([]);
  const [isLoadingReputation, setIsLoadingReputation] = useState(false);

  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['globalLeaderboard'],
    queryFn: async () => {
      const response = await fetch(
        `${baseUrl}/campaigns/analytics/leaderboard/global/creators`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch global leaderboard data');
      }
      const data = await response.json();
      console.log('Global leaderboard data:', data);
      return data as LeaderboardCreator[];
    },
  });

  // Fetch reputation for each creator
  useEffect(() => {
    if (!leaderboardData || leaderboardData.length === 0) return;

    const fetchReputationData = async () => {
      setIsLoadingReputation(true);
      const creatorPromises = leaderboardData
        .slice(0, 3)
        .map(async (creator) => {
          try {
            const response = await fetch(
              `/api/campaign/get_user_reputation?address=${creator.creator}`
            );
            if (!response.ok) {
              throw new Error('Failed to fetch reputation');
            }
            const data = await response.json();
            console.log(`Reputation data for ${creator.creator}:`, data);

            return {
              ...creator,
              actualReputationScore: data.reputation?.reputation_score
                ? parseInt(data.reputation.reputation_score)
                : 1,
            };
          } catch (error) {
            console.error(
              `Error fetching reputation for ${creator.creator}:`,
              error
            );
            return {
              ...creator,
              actualReputationScore: 0, // Default value if fetch fails
            };
          }
        });

      const creatorsData = await Promise.all(creatorPromises);
      setCreatorsWithReputation(creatorsData);
      setIsLoadingReputation(false);
    };

    fetchReputationData();
  }, [leaderboardData]);

  return (
    <div className="lg:max-w-[1100px] max-w-[1512px] relative mt-[40px]">
      <h1 className="text-[18px] tracking-[2px] font-extrabold text-white/80">
        Top Campaign Creators
      </h1>

      <div className="mt-6 flex flex-col md:flex-row gap-8">
        {isLoading || isLoadingReputation ? (
          <>
            <TopCampaignsCard />
            <TopCampaignsCard />
            <TopCampaignsCard />
          </>
        ) : creatorsWithReputation.length === 0 ? (
          <div className="w-full text-center py-12">
            <div className="bg-white/5 border border-white/10 rounded-lg p-8">
              <div className="text-white/60 text-lg mb-2">
                No campaign creators found
              </div>
              <div className="text-white/40 text-sm">
                There are currently no active campaign creators to display.
              </div>
            </div>
          </div>
        ) : (
          creatorsWithReputation.map((creator, index) => (
            <TopCampaignsCard
              key={creator.creator}
              creator={creator.creator}
              totalCampaigns={creator.total_campaigns}
              totalAmountSpent={creator.total_amount_spent}
              reputationScore={creator.actualReputationScore}
              rank={index + 1}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TopContributors;
