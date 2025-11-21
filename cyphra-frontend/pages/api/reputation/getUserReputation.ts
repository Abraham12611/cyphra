import { NextApiRequest, NextApiResponse } from 'next';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

interface Badge {
  badge_type: number;
  timestamp: string | number;
  description: number[];
}

interface ReputationStore {
  reputation_score: number;
  badges: Badge[];
  contribution_count: number;
  successful_payments: number;
}

function getBadgeTypeName(badge_type: number): string {
  switch (badge_type) {
    // Contributor badges
    case 1:
      return 'Active Contributor';
    case 2:
      return 'Top Contributor';
    case 3:
      return 'Expert Contributor';

    // Campaign creator badges
    case 10:
      return 'Campaign Creator';
    case 11:
      return 'Reliable Payer';
    case 12:
      return 'Trusted Creator';
    case 13:
      return 'Expert Creator';

    // Verifier badges
    case 20:
      return 'Verifier';
    case 21:
      return 'Trusted Verifier';
    case 22:
      return 'Expert Verifier';

    // Achievement badges
    case 30:
      return 'First Contribution';
    case 31:
      return 'First Campaign';
    case 32:
      return 'First Verification';

    default:
      return 'Unknown Badge';
  }
}

async function hasReputationStore(
  client: SuiClient,
  address: string
): Promise<boolean> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::reputation::has_reputation_store`,
      arguments: [
        tx.object(process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ID || ''),
        tx.pure.address(address),
      ],
    });

    const result = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: tx,
    });

    if (
      result.effects.status.status !== 'success' ||
      !result.results ||
      result.results.length === 0
    ) {
      return false;
    }

    return result.results[0].returnValues?.[0]?.[0]?.[0] === 1;
  } catch (error) {
    console.error('Error checking reputation store:', error);
    return false;
  }
}

async function getReputationStore(
  client: SuiClient,
  address: string
): Promise<ReputationStore | null> {
  try {
    // First check if the user has a reputation store
    const hasStore = await hasReputationStore(client, address);
    if (!hasStore) {
      return null;
    }

    // Get reputation score
    const scoreTx = new Transaction();
    scoreTx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::reputation::get_reputation_score`,
      arguments: [
        scoreTx.object(process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ID || ''),
        scoreTx.pure.address(address),
      ],
    });

    const scoreResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: scoreTx,
    });

    // Get contribution count
    const contributionTx = new Transaction();
    contributionTx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::reputation::get_contribution_count`,
      arguments: [
        contributionTx.object(
          process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ID || ''
        ),
        contributionTx.pure.address(address),
      ],
    });

    const contributionResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: contributionTx,
    });

    // Get successful payments
    const paymentsTx = new Transaction();
    paymentsTx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::reputation::get_successful_payments`,
      arguments: [
        paymentsTx.object(process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ID || ''),
        paymentsTx.pure.address(address),
      ],
    });

    const paymentsResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: paymentsTx,
    });

    // Get badges
    const badgesTx = new Transaction();
    badgesTx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::reputation::get_badges`,
      arguments: [
        badgesTx.object(process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ID || ''),
        badgesTx.pure.address(address),
      ],
    });

    const badgesResult = await client.devInspectTransactionBlock({
      sender: address,
      transactionBlock: badgesTx,
    });

    // Parse results
    const scoreValue = parseDevInspectUInt(scoreResult);
    const contributionValue = parseDevInspectUInt(contributionResult);
    const paymentsValue = parseDevInspectUInt(paymentsResult);
    const badges = parseDevInspectBadges(badgesResult);

    return {
      reputation_score: scoreValue,
      badges: badges,
      contribution_count: contributionValue,
      successful_payments: paymentsValue,
    };
  } catch (error) {
    console.error('Error fetching reputation store:', error);
    return null;
  }
}

// Helper to parse devInspect result for U64 values
function parseDevInspectUInt(result: any): number {
  if (
    result.effects.status.status !== 'success' ||
    !result.results ||
    result.results.length === 0 ||
    !result.results[0].returnValues
  ) {
    return 0;
  }

  // Convert the returned Uint8Array to a number
  const bytes = result.results[0].returnValues[0][0];
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value += bytes[i] * Math.pow(256, i);
  }
  return value;
}

// Helper to parse devInspect result for badges
function parseDevInspectBadges(result: any): Badge[] {
  if (
    result.effects.status.status !== 'success' ||
    !result.results ||
    result.results.length === 0 ||
    !result.results[0].returnValues
  ) {
    return [];
  }

  try {
    const badgeData = result.results[0].returnValues[0][0];
    const badges: Badge[] = [];
    return badges;
  } catch (error) {
    console.error('Error parsing badges:', error);
    return [];
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ message: 'User address is required' });
  }

  try {
    // Configuration
    const PACKAGE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID;
    const REPUTATION_REGISTRY_ID =
      process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ID;

    if (!PACKAGE_ID || !REPUTATION_REGISTRY_ID) {
      return res.status(500).json({
        message: 'Missing environment variables',
        missingVars: {
          PACKAGE_ID: !PACKAGE_ID,
          REPUTATION_REGISTRY_ID: !REPUTATION_REGISTRY_ID,
        },
      });
    }

    // Network configuration
    const networkMap = {
      testnet: 'testnet',
      mainnet: 'mainnet',
      devnet: 'devnet',
      localnet: 'localnet',
    } as const;

    const networkInput =
      process.env.NETWORK || process.env.NEXT_PUBLIC_NETWORK || 'testnet';
    const network =
      networkMap[networkInput as keyof typeof networkMap] || 'testnet';
    const rpcUrl = getFullnodeUrl(network);

    const client = new SuiClient({ url: rpcUrl });

    // Get reputation information
    const reputationStore = await getReputationStore(client, address);

    if (!reputationStore) {
      return res.status(200).json({
        success: true,
        message: 'No reputation store found for this address',
        reputationInfo: {
          address,
          reputationScore: 0,
          badges: [],
          contributionCount: 0,
          successfulPayments: 0,
          hasStore: false,
        },
      });
    }

    // Format badges with names
    const formattedBadges = reputationStore.badges.map((badge) => ({
      type: badge.badge_type,
      name: getBadgeTypeName(badge.badge_type),
      earnedDate: new Date(Number(badge.timestamp) * 1000).toISOString(),
    }));

    // Calculate badge progress
    const thresholds = {
      'Bronze (Active Contributor)': 100,
      'Silver (Reliable Participant)': 500,
      'Gold (Top Contributor)': 1000,
      'Platinum (Expert)': 5000,
    };

    const badgeProgress = Object.entries(thresholds).map(
      ([badge, threshold]) => ({
        badge,
        threshold,
        progress: Math.min(reputationStore.reputation_score, threshold),
        progressPercentage: Math.min(
          (reputationStore.reputation_score / threshold) * 100,
          100
        ),
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Reputation data retrieved successfully',
      reputationInfo: {
        address,
        reputationScore: reputationStore.reputation_score,
        badges: formattedBadges,
        contributionCount: reputationStore.contribution_count,
        successfulPayments: reputationStore.successful_payments,
        hasStore: true,
        badgeProgress,
      },
    });
  } catch (error: any) {
    console.error('Error retrieving user reputation:', error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred',
      errorCode: 'SERVER_ERROR',
    });
  }
}
