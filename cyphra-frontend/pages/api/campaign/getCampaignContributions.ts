import { NextApiRequest, NextApiResponse } from 'next';
import {
  getFullnodeUrl,
  SuiClient,
  type DynamicFieldInfo,
} from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';

// Types for contributions
interface VerificationScores {
  verifier_reputation: string; // u64
  quality_score: string; // u64
  fields: {
    quality_score: string;
  };
}

interface Contribution {
  contribution_id: string;
  campaign_id: string;
  contributor: string;
  data_url: string;
  data_hash: number[]; // vector<u8>
  timestamp: string; // u64
  verification_scores: VerificationScores;
  is_verified: boolean;
  reward_released: boolean;
}

// Helper to parse byte arrays to hex string
function bytesToHex(bytes: number[]): string {
  return Buffer.from(Uint8Array.from(bytes)).toString('hex');
}

// Helper to format timestamp from epoch to ISO date
function formatTimestamp(timestamp: string): string {
  const milliseconds = BigInt(timestamp) * BigInt(1000);
  return new Date(Number(milliseconds)).toISOString();
}

// Helper function to fetch all dynamic fields
async function getAllDynamicFields(
  client: SuiClient,
  parentId: string
): Promise<DynamicFieldInfo[]> {
  let allFields: DynamicFieldInfo[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.getDynamicFields({
      parentId: parentId,
      cursor: cursor,
    });
    if (page.data) {
      allFields.push(...page.data);
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  return allFields;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { campaignId } = req.query;

  if (!campaignId || typeof campaignId !== 'string') {
    return res.status(400).json({ message: 'Campaign ID is required' });
  }

  try {
    // Configuration - Using the same env var names as in getRemainingBudget.ts
    const PACKAGE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID;
    const CONTRIBUTION_STORE_ID =
      process.env.NEXT_PUBLIC_CONTRIBUTION_STORE_ID || '';

    // Log configuration for debugging
    console.log('Configuration:', {
      PACKAGE_ID,
      CONTRIBUTION_STORE_ID,
      campaignId,
    });

    if (!PACKAGE_ID || !CONTRIBUTION_STORE_ID) {
      return res.status(500).json({
        message: 'Missing environment variables',
        missingVars: {
          PACKAGE_ID: !PACKAGE_ID,
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

    console.log('Network configuration:', { network, rpcUrl });

    const client = new SuiClient({ url: rpcUrl });

    // Fetch contributions from the store
    console.log(`Fetching contributions for campaign: ${campaignId}`);
    const contributions: Contribution[] = [];

    try {
      // 1. Fetch the ContributionStore object to get the table ID
      const storeObject = await client.getObject({
        id: CONTRIBUTION_STORE_ID,
        options: { showContent: true },
      });

      if (
        storeObject.data?.content?.dataType !== 'moveObject' ||
        !storeObject.data.content.fields
      ) {
        console.error('Could not fetch or parse ContributionStore object.');
        return res
          .status(500)
          .json({ message: 'Failed to access contribution store' });
      }

      // 2. Extract the ID of the nested 'contributions' Table
      const storeFields = storeObject.data.content.fields as any;
      const contributionsTableId = storeFields.contributions?.fields?.id?.id;

      if (!contributionsTableId) {
        console.error(
          'Could not find the contributions table ID within ContributionStore.'
        );
        return res
          .status(500)
          .json({ message: 'Failed to find contributions table' });
      }

      console.log(`Found contributions Table ID: ${contributionsTableId}`);

      // 3. Fetch all dynamic fields from the contributions TABLE
      const contributionFieldsInfo = await getAllDynamicFields(
        client,
        contributionsTableId
      );
      console.log(
        `Found ${contributionFieldsInfo.length} potential contribution entries in the table.`
      );

      // 4. Fetch the actual Contribution objects
      const fetchPromises = contributionFieldsInfo.map(async (fieldInfo) => {
        try {
          const contributionDfo = await client.getDynamicFieldObject({
            parentId: contributionsTableId,
            name: fieldInfo.name,
          });

          // Ensure the DFO content is a Move object before accessing fields
          if (contributionDfo.data?.content?.dataType === 'moveObject') {
            const dfoFields = contributionDfo.data.content.fields as any;
            const valueFields = dfoFields.value?.fields;
            const valueType = dfoFields.value?.type;

            // Check if the nested value is a Contribution object
            if (
              valueFields &&
              valueType?.includes('::contribution::Contribution')
            ) {
              return valueFields as any as Contribution;
            }
          }
          return null;
        } catch (fieldError) {
          console.error(
            `Error fetching dynamic field object for contribution ${JSON.stringify(
              fieldInfo.name
            )}:`,
            fieldError
          );
          return null;
        }
      });

      // Wait for all fetches to complete
      const fetchedContributions = await Promise.all(fetchPromises);

      // Filter out nulls and by campaignId
      for (const contribution of fetchedContributions) {
        if (contribution && contribution.campaign_id === campaignId) {
          contributions.push(contribution);
        }
      }
    } catch (error) {
      console.error('Error fetching contributions:', error);
      return res.status(500).json({
        message: 'Error fetching contributions',
        error: (error as Error).message,
      });
    }

    // Calculate statistics
    const verifiedCount = contributions.filter((c) => c.is_verified).length;
    const rewardedCount = contributions.filter((c) => c.reward_released).length;
    const verificationRate =
      contributions.length > 0
        ? (verifiedCount / contributions.length) * 100
        : 0;
    const rewardRate =
      contributions.length > 0
        ? (rewardedCount / contributions.length) * 100
        : 0;

    // Format the contributions for the response
    const formattedContributions = contributions.map((contribution) => {
      return {
        ...contribution,
        // Convert byte array to hex string
        data_hash: bytesToHex(contribution.data_hash),
        // Format timestamp
        timestamp: formatTimestamp(contribution.timestamp),
        formatted_timestamp: new Date(
          Number(BigInt(contribution.timestamp) * BigInt(1000))
        ).toLocaleString(),
        // Extract quality score for easier access
        quality_score:
          contribution.verification_scores?.fields?.quality_score || '0',
      };
    });

    // Return the formatted response
    return res.status(200).json({
      success: true,
      campaignId,
      contributions: formattedContributions,
      stats: {
        totalContributions: contributions.length,
        verifiedContributions: verifiedCount,
        rewardsReleased: rewardedCount,
        verificationRate: verificationRate.toFixed(2) + '%',
        rewardRate: rewardRate.toFixed(2) + '%',
      },
    });
  } catch (error: any) {
    console.error('Error in getCampaignContributions:', error);
    return res.status(500).json({
      message: 'Error fetching campaign contributions',
      details: error.message,
      stack: error.stack,
    });
  }
}
