import { NextApiRequest, NextApiResponse } from 'next';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

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

async function getContributionStats(
  client: SuiClient,
  address: string
): Promise<{
  totalContributions: number;
  verifiedContributions: number;
}> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::contribution::get_address_total_contributions`,
      arguments: [
        tx.object(process.env.NEXT_PUBLIC_CONTRIBUTION_STORE_ID || ''),
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
      result.results.length === 0 ||
      !result.results[0].returnValues ||
      !result.results[0].returnValues[0][0]
    ) {
      return { totalContributions: 0, verifiedContributions: 0 };
    }

    // Parse the tuple of (total_count, verified_count)
    const totalBytes = result.results[0].returnValues[0][0];
    const verifiedBytes = result.results[0].returnValues[0][1];

    let total = 0;
    for (let i = 0; i < totalBytes.length; i++) {
      total += Number(totalBytes[i]) * Math.pow(256, i);
    }

    let verified = 0;
    for (let i = 0; i < verifiedBytes.length; i++) {
      verified += Number(verifiedBytes[i]) * Math.pow(256, i);
    }

    return {
      totalContributions: total,
      verifiedContributions: verified,
    };
  } catch (error) {
    console.error('Error fetching contribution stats:', error);
    return { totalContributions: 0, verifiedContributions: 0 };
  }
}

async function getReputationStats(
  client: SuiClient,
  address: string
): Promise<{
  score: number;
  contributions: number;
  payments: number;
}> {
  try {
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

    // Parse results
    const scoreValue = parseDevInspectUInt(scoreResult);
    const contributionValue = parseDevInspectUInt(contributionResult);
    const paymentsValue = parseDevInspectUInt(paymentsResult);

    return {
      score: scoreValue,
      contributions: contributionValue,
      payments: paymentsValue,
    };
  } catch (error) {
    console.error('Error fetching reputation stats:', error);
    return { score: 0, contributions: 0, payments: 0 };
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
    const CONTRIBUTION_STORE_ID = process.env.NEXT_PUBLIC_CONTRIBUTION_STORE_ID;

    if (!PACKAGE_ID || !REPUTATION_REGISTRY_ID || !CONTRIBUTION_STORE_ID) {
      return res.status(500).json({
        message: 'Missing environment variables',
        missingVars: {
          PACKAGE_ID: !PACKAGE_ID,
          REPUTATION_REGISTRY_ID: !REPUTATION_REGISTRY_ID,
          CONTRIBUTION_STORE_ID: !CONTRIBUTION_STORE_ID,
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

    // Get reputation stats
    const reputationStats = await getReputationStats(client, address);

    // Get contribution stats
    const contributionStats = await getContributionStats(client, address);

    // Calculate success rate
    const successRate =
      contributionStats.totalContributions > 0
        ? (contributionStats.verifiedContributions /
            contributionStats.totalContributions) *
          100
        : 0;

    return res.status(200).json({
      success: true,
      message: 'User stats retrieved successfully',
      stats: {
        reputationScore: reputationStats.score,
        totalContributions: contributionStats.totalContributions,
        verifiedContributions: contributionStats.verifiedContributions,
        successRate: successRate.toFixed(2),
        successfulPayments: reputationStats.payments,
      },
    });
  } catch (error: any) {
    console.error('Error retrieving user stats:', error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred',
      errorCode: 'SERVER_ERROR',
    });
  }
}
