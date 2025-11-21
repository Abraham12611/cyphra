import React from 'react';
import {
  HiOutlineDocumentText,
  HiOutlineDatabase,
  HiOutlineChip,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
  HiOutlinePlay,
  HiOutlineArrowRight,
} from 'react-icons/hi';
import { useCurrentAccount } from '@mysten/dapp-kit';

interface ProcessDataStepProps {
  campaign: {
    campaign_id: string;
    onchain_campaign_id: string;
    current_contributions: number;
  };
  filePreview: {
    sampleData: string[];
    columns: string[];
  };
  processedDataId: string | null;
  isProcessingData: boolean;
  onProcessData: () => void;
  onNextStep: () => void;
  apiResponse?: any;
  apiError?: string | null;
}

const ProcessDataStep: React.FC<ProcessDataStepProps> = ({
  campaign,
  filePreview,
  processedDataId,
  isProcessingData,
  onProcessData,
  onNextStep,
  apiResponse,
  apiError,
}) => {
  const account = useCurrentAccount();

  return (
    <div className="rounded-xl p-6 border border-[#f5f5fa14]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[#f5f5faf4] text-lg font-semibold">
          Process Contributed Data
        </h3>
        <div className="text-[#f5f5fa7a] text-sm flex items-center gap-2">
          <HiOutlineInformationCircle className="w-4 h-4 text-[#6366f1]" />
          <span>Prepare your campaign data for training</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="rounded-xl p-6 border border-[#f5f5fa14]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
              <HiOutlineDocumentText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[#f5f5fa7a] text-sm">Campaign ID</p>
              <p className="text-[#f5f5faf4] text-lg font-semibold">
                {campaign.campaign_id.slice(0, 8)}...
              </p>
            </div>
          </div>
          <div className="text-[#f5f5fa7a] text-sm mt-2">
            Onchain ID: {campaign.onchain_campaign_id.slice(0, 6)}...
          </div>
        </div>

        <div className="rounded-xl p-6 border border-[#f5f5fa14]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
              <HiOutlineDatabase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[#f5f5fa7a] text-sm">Contributions</p>
              <p className="text-[#f5f5faf4] text-base font-semibold">
                {campaign.current_contributions} contributions / ~ 1000 entries
              </p>
            </div>
          </div>
          <div className="text-[#f5f5fa7a] text-sm mt-2">
            Format: Text samples
          </div>
        </div>

        <div className="rounded-xl p-6 border border-[#f5f5fa14]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
              <HiOutlineChip className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[#f5f5fa7a] text-sm">Task Type</p>
              <p className="text-[#f5f5faf4] text-lg font-semibold">
                Fine-tuning
              </p>
            </div>
          </div>
          <div className="text-[#f5f5fa7a] text-sm mt-2">
            Model: Language Model
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0f] rounded-lg p-4 border border-[#f5f5fa0a] mb-6">
        <div className="flex items-start gap-3 mb-4">
          <HiOutlineInformationCircle className="w-5 h-5 text-[#6366f1] mt-0.5" />
          <div>
            <h4 className="text-[#f5f5faf4] font-medium mb-1">
              Data Processing Steps
            </h4>
            <p className="text-[#f5f5fa7a] text-sm">
              Before training, we'll prepare your data by:
            </p>
            <ul className="list-disc list-inside text-[#f5f5fa7a] text-sm mt-1 space-y-1">
              <li>Converting raw contributions to training samples</li>
              <li>Cleaning and normalizing text</li>
              <li>Creating training/validation splits</li>
              <li>Performing quality checks</li>
            </ul>
          </div>
        </div>

        {apiResponse && (
          <div className="bg-[#f5f5fa05] rounded p-3 text-green-400 text-xs font-mono mt-2">
            <div className="text-[#f5f5fa7a] mb-1">API Response:</div>
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
        )}

        {apiError && (
          <div className="bg-[#f5f5fa05] rounded p-3 text-red-400 text-xs font-mono mt-2">
            <div className="text-[#f5f5fa7a] mb-1">API Error:</div>
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {apiError}
            </pre>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 rounded-lg p-4 border border-[#f5f5fa14] bg-[#f5f5fa05]">
          <h4 className="text-[#f5f5faf4] font-medium mb-3">
            Sample Data Preview
          </h4>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f5f5fa14]">
                  <th className="p-2 text-[#f5f5fa7a] text-sm font-medium">
                    Text
                  </th>
                  <th className="p-2 text-[#f5f5fa7a] text-sm font-medium">
                    Label
                  </th>
                </tr>
              </thead>
              <tbody>
                {filePreview.sampleData.map((row, i) => (
                  <tr key={i} className="border-b border-[#f5f5fa0a]">
                    <td className="p-2 text-[#f5f5faf4] text-sm truncate max-w-xs">
                      {row}
                    </td>
                    <td className="p-2 text-[#f5f5faf4] text-sm">
                      {i % 2 === 0 ? 'positive' : 'negative'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-64 rounded-lg p-4 border border-[#f5f5fa14] bg-[#f5f5fa05] flex flex-col">
          <h4 className="text-[#f5f5faf4] font-medium mb-3">Dataset Status</h4>

          {processedDataId ? (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-green-500 text-sm font-medium">
                    Processed
                  </span>
                </div>
                <p className="text-[#f5f5fa7a] text-xs mb-2">
                  Dataset ID: {processedDataId}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs bg-[#6366f114] text-[#6366f1] px-2 py-0.5 rounded-full">
                    {campaign.current_contributions} samples
                  </span>
                  <span className="text-xs bg-[#6366f114] text-[#6366f1] px-2 py-0.5 rounded-full">
                    Fine-tuning
                  </span>
                </div>
              </div>

              <button
                onClick={onNextStep}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-medium flex items-center justify-center gap-2 hover:opacity-90"
              >
                Continue
                <HiOutlineArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-amber-500 text-sm font-medium">
                    Not Processed
                  </span>
                </div>
                <p className="text-[#f5f5fa7a] text-xs">
                  Your campaign data needs to be processed before training.
                </p>
              </div>

              <button
                onClick={onProcessData}
                disabled={isProcessingData}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingData ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Process Data
                    <HiOutlinePlay className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessDataStep;
