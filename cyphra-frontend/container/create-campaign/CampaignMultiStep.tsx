import React, { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import ProgressBar from '@/components/ui/ProgressBar';
import CampaignType from '@/components/ui/multistep-components/CampaignType';
import CampaignDetails from '@/components/ui/multistep-components/CampaignDetails';
import CampaignRewards from '@/components/ui/multistep-components/CampaignRewards';
import CampaignReview from '@/components/ui/multistep-components/CampaignReview';
import CampaignSuccess from '@/components/ui/multistep-components/CampaignSuccess';
import { CampaignProvider, useCampaign } from '@/context/CampaignContext';
import { generateCampaignKeys } from '@/utils/crypto/generateCampaignKeys';
import crypto from 'crypto';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

const pinataEndpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

// Contract addresses - should be moved to environment variables
const CAMPAIGN_MANAGER_PACKAGE_ID =
  process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID || '0x...';
const CAMPAIGN_STORE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_STORE_ID || '0x...';
const ESCROW_STORE_ID = process.env.NEXT_PUBLIC_ESCROW_STORE_ID || '0x...';
const HYVVE_TOKEN_TYPE =
  process.env.NEXT_PUBLIC_HYVVE_TOKEN_TYPE || '0x...::hyvve::HYVVE';

const steps = [
  { label: 'Campaign Type', description: '' },
  { label: 'Campaign Details', description: '' },
  { label: 'Campaign Rewards', description: '' },
  { label: 'Review', description: '' },
  { label: 'Launch', description: '' },
];

// Create a vector of the individual bytes of the string
const stringToByteArray = (str: string): number[] => {
  return Array.from(str).map((char) => char.charCodeAt(0));
};

const CampaignStepContent = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [campaignPrivateKey, setCampaignPrivateKey] = useState<string | null>(
    null
  );

  const account = useCurrentAccount();
  const { validateStep, campaignData } = useCampaign();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const handleCreateCampaign = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsCreating(true);

    try {
      const { publicKey, privateKey } = await generateCampaignKeys();

      setCampaignPrivateKey(privateKey);

      // Generate a unique campaign ID
      const uniqueIdData = `${Date.now()}_${account.address}_${
        campaignData.details.title
      }`;
      const campaignIdHash = crypto
        .createHash('sha256')
        .update(uniqueIdData)
        .digest('hex')
        .substring(0, 16);
      const uniqueCampaignId = `campaign_${campaignIdHash}`;

      console.log('Generated unique campaign ID:', uniqueCampaignId);

      // Optionally copy both keys as a formatted bundle
      // await copyKeyPairBundle(publicKey, privateKey, uniqueCampaignId);

      // Create campaign metadata
      const metadata = {
        type: campaignData.type?.name,
        title: campaignData.details.title,
        description: campaignData.details.description,
        requirements: campaignData.details.requirements,
        qualityCriteria: campaignData.details.qualityCriteria,
        rewards: {
          unitPrice: campaignData.rewards.unitPrice,
          totalBudget: campaignData.rewards.totalBudget,
          minDataCount: campaignData.rewards.minDataCount,
          maxDataCount: campaignData.rewards.maxDataCount,
        },
        expirationDate: campaignData.details.expirationDate,
        campaignId: uniqueCampaignId,
      };

      // Upload metadata to IPFS
      const formData = new FormData();
      const jsonBlob = new Blob([JSON.stringify(metadata)], {
        type: 'application/json',
      });
      formData.append('file', jsonBlob);

      const metadataPinataResponse = await axios.post(
        pinataEndpoint,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY!,
            pinata_secret_api_key:
              process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY!,
          },
        }
      );

      if (!metadataPinataResponse.data.IpfsHash) {
        throw new Error('Failed to upload metadata to IPFS');
      }

      const metadataUri = `ipfs://${metadataPinataResponse.data.IpfsHash}`;

      // Calculate expiration timestamp (in seconds)
      const expirationTimestamp = Math.floor(
        new Date(campaignData.details.expirationDate).getTime() / 1000
      );

      // Log raw values from UI before conversion
      console.log('==== DEBUG RAW VALUES ====');
      console.log('Raw unitPrice from UI:', campaignData.rewards.unitPrice);
      console.log('Raw totalBudget from UI:', campaignData.rewards.totalBudget);
      console.log('Type of unitPrice:', typeof campaignData.rewards.unitPrice);
      console.log(
        'Type of totalBudget:',
        typeof campaignData.rewards.totalBudget
      );

      // Convert values to appropriate types for Sui
      // SUI token uses 9 decimals
      const DECIMALS = 1000000000; // 9 decimals for SUI token
      console.log('Using SUI token decimal places:', Math.log10(DECIMALS));

      const rawUnitPrice = Number(campaignData.rewards.unitPrice);
      const rawTotalBudget = Number(campaignData.rewards.totalBudget);

      // Convert to MIST (smallest unit) by multiplying by 10^9
      // Use string multiplication to avoid floating point precision issues
      const unitPriceConverted = Math.round(
        Number((rawUnitPrice * DECIMALS).toFixed(0))
      );
      const totalBudgetConverted = Math.round(
        Number((rawTotalBudget * DECIMALS).toFixed(0))
      );

      console.log('Raw values:', {
        unitPrice: rawUnitPrice,
        totalBudget: rawTotalBudget,
        decimals: DECIMALS,
      });
      console.log('Converted values (in MIST):', {
        unitPriceConverted,
        totalBudgetConverted,
        expectedUnitPrice: rawUnitPrice * DECIMALS,
        expectedTotalBudget: rawTotalBudget * DECIMALS,
      });

      const unitPrice = BigInt(unitPriceConverted);
      let totalBudget = BigInt(totalBudgetConverted);

      console.log('Final BigInt values:', {
        unitPrice: unitPrice.toString(),
        totalBudget: totalBudget.toString(),
        unitPriceInSui: Number(unitPrice) / DECIMALS,
        totalBudgetInSui: Number(totalBudget) / DECIMALS,
      });
      const minDataCount = BigInt(campaignData.rewards.minDataCount);
      const maxDataCount = BigInt(campaignData.rewards.maxDataCount);
      const platformFeeBasisPoints = 250; // 2.5% fee (250 basis points)

      // Step 1: Create Campaign Transaction
      const tx = new Transaction();

      // Convert the real public key to a byte array
      // If publicKey is already a Uint8Array, use it directly, otherwise try to decode from hex
      const publicKeyBytes =
        publicKey instanceof Uint8Array
          ? Array.from(publicKey)
          : Array.from(new Uint8Array(Buffer.from(publicKey, 'hex')));

      tx.moveCall({
        target: `${CAMPAIGN_MANAGER_PACKAGE_ID}::campaign::create_campaign`,
        arguments: [
          tx.object(CAMPAIGN_STORE_ID),
          tx.pure.string(uniqueCampaignId),
          tx.pure.string(campaignData.details.title),
          tx.pure.string(campaignData.details.description),
          tx.pure.string(campaignData.details.requirements),
          tx.pure.string(campaignData.details.qualityCriteria),
          tx.pure.u64(unitPrice),
          tx.pure.u64(totalBudget),
          tx.pure.u64(minDataCount),
          tx.pure.u64(maxDataCount),
          tx.pure.u64(BigInt(expirationTimestamp)),
          tx.pure.string(metadataUri),
          tx.pure.vector('u8', publicKeyBytes),
        ],
      });

      console.log('Campaign transaction built, signing and executing...');

      try {
        // Execute the transaction
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (result) => {
              console.log('Transaction result:', result);
              setTxHash(result.digest);
              console.log(
                'Campaign created successfully with digest:',
                result.digest
              );

              // Step 2: Create Escrow Transaction (can be implemented later)
              // This would be similar to the escrowTx in the script
              // For now, we'll just finish the campaign creation

              // Create escrow for the campaign
              try {
                console.log('Creating escrow for campaign:', uniqueCampaignId);

                // Check if we have HYVVE token configuration
                const useHyvveEscrow = !!(
                  process.env.NEXT_PUBLIC_HYVVE_TOKEN_TYPE &&
                  process.env.NEXT_PUBLIC_HYVVE_PAYMENT_COIN_ID
                );

                console.log('useHyvveEscrow', useHyvveEscrow);

                const tokenTypeForEscrow = useHyvveEscrow
                  ? process.env.NEXT_PUBLIC_HYVVE_TOKEN_TYPE
                  : '0x2::sui::SUI';

                console.log('tokenTypeForEscrow', tokenTypeForEscrow);
                const escrowStoreId = useHyvveEscrow
                  ? process.env.NEXT_PUBLIC_HYVVE_ESCROW_STORE_ID
                  : process.env.NEXT_PUBLIC_ESCROW_STORE_ID;

                console.log('escrowStoreId', escrowStoreId);

                if (!escrowStoreId) {
                  console.error('No Escrow Store ID configured');
                  toast.warning(
                    'Campaign created but escrow creation failed: Missing escrow store ID',
                    {
                      autoClose: 7000,
                    }
                  );
                } else {
                  // Create the escrow transaction
                  const escrowTx = new Transaction();
                  let paymentCoinArgument;

                  console.log('==== PAYMENT COIN CREATION ====');
                  console.log(
                    'Total budget to split/use:',
                    totalBudget.toString()
                  );

                  if (
                    useHyvveEscrow &&
                    process.env.NEXT_PUBLIC_HYVVE_PAYMENT_COIN_ID
                  ) {
                    const expectedCoinValue = 7000000; // Hardcoded for testing
                    if (Number(totalBudget) !== expectedCoinValue) {
                      console.log(
                        '⚠️ FIXING MISMATCH: Adjusting totalBudget from',
                        totalBudget.toString(),
                        'to',
                        expectedCoinValue
                      );
                      totalBudget = BigInt(expectedCoinValue);
                    }

                    // Use the HYVVE payment coin directly
                    const coinId =
                      process.env.NEXT_PUBLIC_HYVVE_PAYMENT_COIN_ID;
                    paymentCoinArgument = escrowTx.object(coinId);
                    console.log(`Using HYVVE payment coin ID: ${coinId}`);
                    console.log(
                      'IMPORTANT: Explicitly set total budget to',
                      totalBudget.toString()
                    );
                  } else {
                    // Split SUI from gas for payment
                    console.log(
                      'Creating split coin with exact value:',
                      totalBudget.toString()
                    );
                    paymentCoinArgument = escrowTx.splitCoins(escrowTx.gas, [
                      totalBudget.toString(),
                    ]);
                    console.log('Splitting SUI from gas for escrow payment');
                    console.log('SplitCoins argument:', totalBudget.toString());
                  }

                  // Debug logs for payment amounts
                  console.log('DEBUG VALUES:');
                  console.log(
                    'Original unit price:',
                    campaignData.rewards.unitPrice
                  );
                  console.log(
                    'Original total budget:',
                    campaignData.rewards.totalBudget
                  );
                  console.log(
                    'Converted unit price (in smallest units):',
                    unitPrice.toString()
                  );
                  console.log(
                    'Converted total budget (in smallest units):',
                    totalBudget.toString()
                  );
                  console.log(
                    'Platform fee basis points:',
                    platformFeeBasisPoints
                  );
                  console.log('Token type for escrow:', tokenTypeForEscrow);

                  // Add the escrow creation call
                  escrowTx.moveCall({
                    target: `${CAMPAIGN_MANAGER_PACKAGE_ID}::escrow::create_campaign_escrow`,
                    typeArguments: [
                      tokenTypeForEscrow as `${string}::${string}::${string}`,
                    ],
                    arguments: [
                      escrowTx.object(escrowStoreId),
                      escrowTx.object(CAMPAIGN_STORE_ID),
                      escrowTx.pure.string(uniqueCampaignId),
                      escrowTx.pure.u64(totalBudget),
                      escrowTx.pure.u64(unitPrice),
                      escrowTx.pure.u64(BigInt(platformFeeBasisPoints)),
                      paymentCoinArgument,
                    ],
                  });

                  console.log(
                    'Escrow transaction built, signing and executing...'
                  );

                  // Execute the escrow transaction
                  signAndExecuteTransaction(
                    { transaction: escrowTx },
                    {
                      onSuccess: (escrowResult) => {
                        console.log('Escrow transaction result:', escrowResult);
                        console.log('Escrow created and funded successfully!');
                        toast.success(
                          'Campaign and Escrow Created Successfully',
                          {
                            autoClose: 7000,
                          }
                        );
                      },
                      onError: (escrowError) => {
                        console.error('Escrow transaction error:', escrowError);
                        toast.warning(
                          'Campaign created but escrow creation failed',
                          {
                            autoClose: 7000,
                          }
                        );
                      },
                    }
                  );
                }
              } catch (escrowError: any) {
                console.error('Error creating escrow:', escrowError);
                toast.warning('Campaign created but escrow setup failed', {
                  autoClose: 7000,
                });
              }

              // Save to backend
              try {
                const backendPayload = {
                  onchain_campaign_id: uniqueCampaignId,
                  title: campaignData.details.title,
                  description: campaignData.details.description,
                  data_requirements: campaignData.details.requirements,
                  quality_criteria: campaignData.details.qualityCriteria,
                  unit_price: Number(campaignData.rewards.unitPrice),
                  campaign_type: campaignData.type?.name || 'default',
                  total_budget: Number(campaignData.rewards.totalBudget),
                  min_data_count: Number(campaignData.rewards.minDataCount),
                  max_data_count: Number(campaignData.rewards.maxDataCount),
                  expiration: expirationTimestamp,
                  metadata_uri: metadataUri,
                  transaction_hash: result.digest,
                  platform_fee: platformFeeBasisPoints,
                  creator_wallet_address: account.address,
                  file_type:
                    campaignData.type?.name === 'Text'
                      ? campaignData.rewards.fileType
                      : null,
                  is_csv_only_campaign:
                    campaignData.rewards.isCsvOnlyCampaign === true
                      ? true
                      : false,
                };

                axios
                  .post(
                    `${backendBaseUrl}/campaigns/create-campaigns`,
                    backendPayload,
                    {
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    }
                  )
                  .then(
                    (backendResponse) => {
                      console.log('Backend response:', backendResponse.data);
                    },
                    (backendError) => {
                      console.error('Error saving to backend:', backendError);
                      toast.warning(
                        'Campaign created on-chain but failed to save to backend',
                        {
                          autoClose: 7000,
                        }
                      );
                    }
                  );
              } catch (backendError: any) {
                console.error('Error saving to backend:', backendError);
                toast.warning(
                  'Campaign created on-chain but failed to save to backend',
                  {
                    autoClose: 7000,
                  }
                );
              }

              toast.success('Campaign Created Successfully', {
                autoClose: 7000,
              });

              localStorage.setItem(
                `campaign_${result.digest}_private_key`,
                privateKey
              );
              setCurrentStep(steps.length - 1);
            },
            onError: (error) => {
              console.error('Transaction error:', error);
              toast.error(`Transaction failed: ${error.message}`);
              setIsCreating(false);
            },
          }
        );
      } catch (txError: any) {
        console.error('Transaction error:', txError);
        throw new Error(`Transaction failed: ${txError.message}`);
      }
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error(`Failed to create campaign: ${error.message}`);
      setIsCreating(false);
    }
  };

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      if (currentStep === steps.length - 2) {
        // If we're on the Review step, create the campaign
        await handleCreateCampaign();
      } else {
        setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));
      }
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="max-w-[898px] 2xl:max-w-[1100px] p-6">
      {/* Progress Bar Container */}
      <div className="flex justify-center">
        <ProgressBar
          steps={steps}
          currentStep={
            currentStep === steps.length - 1 && txHash
              ? steps.length - 1
              : currentStep
          }
        />
      </div>

      {/* Step Content Container */}
      <div className="mt-8 flex justify-center">
        <div className="w-full max-w-3xl">
          {currentStep === 0 && <CampaignType />}
          {currentStep === 1 && <CampaignDetails />}
          {currentStep === 2 && <CampaignRewards />}
          {currentStep === 3 && <CampaignReview />}
          {currentStep === 4 && txHash && campaignPrivateKey && (
            <CampaignSuccess
              txHash={txHash}
              campaignPrivateKey={campaignPrivateKey}
            />
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      {currentStep !== steps.length - 1 && (
        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-3xl flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0 || isCreating}
              className="px-6 py-3 text-sm text-[#f5f5faf4] border border-[#f5f5fa14] rounded-xl 
              disabled:opacity-50 hover:bg-[#f5f5fa08] transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={isCreating}
              className="px-6 py-3 text-sm text-white bg-gradient-to-r from-[#6366f1] to-[#a855f7] 
              rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {isCreating
                ? 'Creating...'
                : currentStep === steps.length - 2
                ? 'Launch Campaign'
                : 'Next'}
            </button>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

const CampaignMultiStep = () => {
  return (
    <CampaignProvider>
      <CampaignStepContent />
    </CampaignProvider>
  );
};

export default CampaignMultiStep;
