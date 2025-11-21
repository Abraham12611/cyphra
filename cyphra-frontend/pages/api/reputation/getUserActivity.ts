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

async function getCampaignStats(
  client: SuiClient,
  address: string
): Promise<{
  total: number;
  active: number;
  completed: number;
}> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::campaign::get_address_campaign_stats`,
      arguments: [
        tx.object(process.env.NEXT_PUBLIC_CAMPAIGN_STORE_ID || ''),
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
      !result.results[0].returnValues[0] ||
      result.results[0].returnValues[0].length < 3
    ) {
      return { total: 0, active: 0, completed: 0 };
    }

    // Parse the tuple of (total, active, completed)
    const returnValues = result.results[0].returnValues[0] as unknown as [
      number[],
      number[],
      number[]
    ];
    const [totalBytes, activeBytes, completedBytes] = returnValues;

    let total = 0;
    for (let i = 0; i < totalBytes.length; i++) {
      total += Number(totalBytes[i]) * Math.pow(256, i);
    }

    let active = 0;
    for (let i = 0; i < activeBytes.length; i++) {
      active += Number(activeBytes[i]) * Math.pow(256, i);
    }

    let completed = 0;
    for (let i = 0; i < completedBytes.length; i++) {
      completed += Number(completedBytes[i]) * Math.pow(256, i);
    }

    return {
      total,
      active,
      completed,
    };
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    return { total: 0, active: 0, completed: 0 };
  }
}

async function getContributionStats(
  client: SuiClient,
  address: string
): Promise<{
  total: number;
  verified: number;
  pending: number;
}> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID}::contribution::get_address_contribution_stats`,
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
      !result.results[0].returnValues[0] ||
      result.results[0].returnValues[0].length < 3
    ) {
      return { total: 0, verified: 0, pending: 0 };
    }

    // Parse the tuple of (total, verified, pending)
    const returnValues = result.results[0].returnValues[0] as unknown as [
      number[],
      number[],
      number[]
    ];
    const [totalBytes, verifiedBytes, pendingBytes] = returnValues;

    let total = 0;
    for (let i = 0; i < totalBytes.length; i++) {
      total += Number(totalBytes[i]) * Math.pow(256, i);
    }

    let verified = 0;
    for (let i = 0; i < verifiedBytes.length; i++) {
      verified += Number(verifiedBytes[i]) * Math.pow(256, i);
    }

    let pending = 0;
    for (let i = 0; i < pendingBytes.length; i++) {
      pending += Number(pendingBytes[i]) * Math.pow(256, i);
    }

    return {
      total,
      verified,
      pending,
    };
  } catch (error) {
    console.error('Error fetching contribution stats:', error);
    return { total: 0, verified: 0, pending: 0 };
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
    const CAMPAIGN_STORE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_STORE_ID;
    const CONTRIBUTION_STORE_ID = process.env.NEXT_PUBLIC_CONTRIBUTION_STORE_ID;

    if (!PACKAGE_ID || !CAMPAIGN_STORE_ID || !CONTRIBUTION_STORE_ID) {
      return res.status(500).json({
        message: 'Missing environment variables',
        missingVars: {
          PACKAGE_ID: !PACKAGE_ID,
          CAMPAIGN_STORE_ID: !CAMPAIGN_STORE_ID,
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

    // Get campaign stats
    const campaignStats = await getCampaignStats(client, address);

    // Get contribution stats
    const contributionStats = await getContributionStats(client, address);

    return res.status(200).json({
      success: true,
      message: 'User activity retrieved successfully',
      stats: {
        campaigns: campaignStats,
        contributions: contributionStats,
      },
    });
  } catch (error: any) {
    console.error('Error retrieving user activity:', error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred',
      errorCode: 'SERVER_ERROR',
    });
  }
}
