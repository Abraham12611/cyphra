import {
  getFullnodeUrl,
  SuiClient,
  type DynamicFieldInfo,
} from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// --- ESM-compatible way to get directory name ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PACKAGE_ID = process.env.CAMPAIGN_MANAGER_PACKAGE_ID || '';
const CAMPAIGN_STORE_ID = process.env.CAMPAIGN_STORE_ID || '';
const CONTRIBUTION_STORE_ID = process.env.CONTRIBUTION_STORE_ID || '';

const network = 'testnet'; // Or 'devnet', 'mainnet', 'localnet'
const rpcUrl = getFullnodeUrl(network);
const client = new SuiClient({ url: rpcUrl });

if (!CAMPAIGN_STORE_ID || !CONTRIBUTION_STORE_ID || !PACKAGE_ID) {
  console.error(
    'Error: Missing CAMPAIGN_STORE_ID, CONTRIBUTION_STORE_ID, or PACKAGE_ID.'
  );
  process.exit(1);
}

interface Campaign {
  campaign_id: string;
  owner: string;
  title: string;
  description: string;
  data_requirements: string;
  quality_criteria: string;
  unit_price: string;
  total_budget: string;
  min_data_count: string;
  max_data_count: string;
  expiration: string;
  is_active: boolean;
  total_contributions: string; // u64 represented as string
  metadata_uri: string;
  escrow_setup: boolean;
  encryption_pub_key: number[]; // vector<u8>
}

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

// --- Helper Function to Fetch All Dynamic Fields ---
async function getAllDynamicFields(parentId: string) {
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

// --- Fetch Active Campaigns ---
async function getActiveCampaigns(
  campaignStoreId: string
): Promise<Campaign[]> {
  console.log(`\n--- Fetching Campaigns from Store: ${campaignStoreId} ---`);
  const activeCampaigns: Campaign[] = [];
  const currentEpochMs = Date.now(); // Get current time in milliseconds

  try {
    // 1. Fetch the CampaignStore object itself to get the ID of the campaigns table
    const storeObject = await client.getObject({
      id: campaignStoreId,
      options: { showContent: true },
    });

    if (
      storeObject.data?.content?.dataType !== 'moveObject' ||
      !storeObject.data.content.fields
    ) {
      console.error('Could not fetch or parse CampaignStore object.');
      return [];
    }

    // 2. Extract the ID of the nested 'campaigns' Table
    const storeFields = storeObject.data.content.fields as any;
    const campaignsTableId = storeFields.campaigns?.fields?.id?.id;
    if (!campaignsTableId) {
      console.error(
        'Could not find the campaigns table ID within CampaignStore.'
      );
      return [];
    }
    console.log(`  Found campaigns Table ID: ${campaignsTableId}`);

    // 3. Get dynamic fields from the campaigns TABLE
    const campaignFieldsInfo = await getAllDynamicFields(campaignsTableId);
    console.log(
      `Found ${campaignFieldsInfo.length} potential campaign entries in the table.`
    );

    if (campaignFieldsInfo.length === 0) {
      return [];
    }

    // 4. Fetch the actual Campaign object for each dynamic field using getDynamicFieldObject
    const fetchPromises = campaignFieldsInfo.map(async (fieldInfo) => {
      try {
        const campaignDfo = await client.getDynamicFieldObject({
          parentId: campaignsTableId,
          name: fieldInfo.name, // Use the name from DynamicFieldInfo
        });

        // Ensure the DFO content is a Move object before accessing fields
        if (campaignDfo.data?.content?.dataType === 'moveObject') {
          const dfoFields = campaignDfo.data.content.fields as any;
          const valueFields = dfoFields.value?.fields;
          const valueType = dfoFields.value?.type;

          // Check if the nested value is a Campaign object based on type
          if (valueFields && valueType?.includes('::campaign::Campaign')) {
            return valueFields as any as Campaign;
          }
        }

        // If checks fail, warn and return null
        console.warn(
          `  - Skipping field ${JSON.stringify(
            fieldInfo.name
          )} - not a valid Campaign object or unexpected structure?`,
          campaignDfo.error
        );
        return null;
      } catch (fieldError) {
        console.error(
          `Error fetching dynamic field object for campaign ${JSON.stringify(
            fieldInfo.name
          )}:`,
          fieldError
        );
        return null;
      }
    });

    // Wait for all fetches to complete
    const fetchedCampaigns = await Promise.all(fetchPromises);

    // Filter out nulls and check for active status
    for (const campaignData of fetchedCampaigns) {
      if (campaignData) {
        // Check if active based on boolean flag AND expiration
        const expirationMs = BigInt(campaignData.expiration) * 1000n;
        const isActiveByTime = expirationMs > BigInt(currentEpochMs);

        if (campaignData.is_active && isActiveByTime) {
          console.log(
            `  + Found ACTIVE campaign: ${campaignData.campaign_id} (Title: ${campaignData.title})`
          );
          activeCampaigns.push(campaignData);
        } else {
          console.log(
            `  - Found INACTIVE campaign: ${
              campaignData.campaign_id
            } (Active: ${campaignData.is_active}, Expired: ${!isActiveByTime})`
          );
        }
      }
    }
  } catch (error) {
    console.error('Error fetching or processing campaigns:', error);
  }

  console.log(`Found ${activeCampaigns.length} active campaigns.`);
  return activeCampaigns;
}

// --- Fetch Contributions ---
async function getContributions(
  contributionStoreId: string
): Promise<Contribution[]> {
  console.log(
    `\n--- Fetching Contributions from Store: ${contributionStoreId} ---`
  );
  const contributions: Contribution[] = [];

  try {
    // 1. Fetch the ContributionStore object itself to get the list of IDs
    const storeObject = await client.getObject({
      id: contributionStoreId,
      options: { showContent: true },
    });

    if (
      storeObject.data?.content?.dataType !== 'moveObject' ||
      !storeObject.data.content.fields
    ) {
      console.error('Could not fetch or parse ContributionStore object.');
      return [];
    }

    // 2. Extract the ID of the nested 'contributions' Table
    const storeFields = storeObject.data.content.fields as any;
    const contributionsTableId = storeFields.contributions?.fields?.id?.id;
    if (!contributionsTableId) {
      console.error(
        'Could not find the contributions table ID within ContributionStore.'
      );
      return [];
    }
    console.log(`  Found contributions Table ID: ${contributionsTableId}`);

    // 3. Fetch all dynamic fields from the contributions TABLE
    const contributionFieldsInfo = await getAllDynamicFields(
      contributionsTableId
    );
    console.log(
      `Found ${contributionFieldsInfo.length} potential contribution entries in the table.`
    );

    if (contributionFieldsInfo.length === 0) {
      return [];
    }

    const fetchPromises = contributionFieldsInfo.map(async (fieldInfo) => {
      try {
        const contributionDfo = await client.getDynamicFieldObject({
          parentId: contributionsTableId,
          name: fieldInfo.name,
        });

        if (contributionDfo.data?.content?.dataType === 'moveObject') {
          const dfoFields = contributionDfo.data.content.fields as any;

          const valueFields = dfoFields.value?.fields;
          const valueType = dfoFields.value?.type;

          if (
            valueFields &&
            valueType?.includes('::contribution::Contribution')
          ) {
            return valueFields as any as Contribution;
          }
        }

        console.warn(
          `  - Skipping field ${JSON.stringify(
            fieldInfo.name
          )} - not a Contribution object or unexpected structure?`,
          contributionDfo.error
        );
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

    // Filter out any null results (errors during fetch)
    contributions.push(
      ...fetchedContributions.filter((c): c is Contribution => c !== null)
    );
  } catch (error) {
    console.error('Error fetching contributions:', error);
  }

  console.log(`Successfully fetched ${contributions.length} contributions.`);
  return contributions;
}

// --- Main Function ---
async function main() {
  console.log(`Using Network: ${network}`);
  console.log(`Package ID: ${PACKAGE_ID}`);

  const activeCampaigns = await getActiveCampaigns(CAMPAIGN_STORE_ID!);
  const allContributions = await getContributions(CONTRIBUTION_STORE_ID!);

  console.log('\n=========================================');
  console.log('            FETCH RESULTS');
  console.log('=========================================');

  console.log(`\n--- Active Campaigns (${activeCampaigns.length}) ---`);
  if (activeCampaigns.length > 0) {
    activeCampaigns.forEach((campaign, index) => {
      console.log(`\n[${index + 1}] Campaign ID: ${campaign.campaign_id}`);
      console.log(`    Title: ${campaign.title}`);
      console.log(`    Owner: ${campaign.owner}`);
      const budgetInMist = BigInt(campaign.total_budget);
      const budgetInSui = Number(budgetInMist) / 1_000_000_000;
      console.log(`    Budget: ${budgetInSui.toFixed(9)} SUI`);

      const unitPriceInMist = BigInt(campaign.unit_price);
      const unitPriceInSui = Number(unitPriceInMist) / 1_000_000_000;
      console.log(`    Unit Price: ${unitPriceInSui.toFixed(9)} SUI`);
      console.log(
        `    Expiration: ${new Date(
          Number(BigInt(campaign.expiration) * 1000n)
        ).toLocaleString()}`
      );
      console.log(
        `    Contributions: ${campaign.total_contributions}/${campaign.max_data_count}`
      );
    });
  } else {
    console.log('No active campaigns found.');
  }

  console.log(`\n--- All Contributions (${allContributions.length}) ---`);
  if (allContributions.length > 0) {
    allContributions.forEach((contrib, index) => {
      console.log(
        `\n[${index + 1}] Contribution ID: ${contrib.contribution_id}`
      );
      console.log(`    Campaign ID: ${contrib.campaign_id}`);
      console.log(`    Contributor: ${contrib.contributor}`);
      console.log(`    Data URL: ${contrib.data_url}`);
      console.log(`    Verified: ${contrib.is_verified}`);
      console.log(`    Reward Released: ${contrib.reward_released}`);
      console.log(`    Epoch: ${contrib.timestamp}`);
      console.log(
        `    Quality Score: ${contrib.verification_scores?.fields?.quality_score}`
      );
    });
  } else {
    console.log('No contributions found.');
  }

  console.log('\n=========================================');
}

main();
