import React from 'react';
import {
  HiOutlineDocumentText,
  HiOutlineChip,
  HiOutlineTerminal,
  HiOutlineCheckCircle,
  HiOutlineArrowRight,
} from 'react-icons/hi';

interface ModelOption {
  id: string;
  name: string;
  description: string;
  parameters: string;
  requirements: string;
  trainingTime: string;
  bestFor: string[];
  icon: React.ReactNode;
}

interface ModelSelectionStepProps {
  campaign: {
    current_contributions: number;
  };
  modelOptions: ModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  onNextStep: () => void;
}

const ModelSelectionStep: React.FC<ModelSelectionStepProps> = ({
  campaign,
  modelOptions,
  selectedModelId,
  onSelectModel,
  onNextStep,
}) => {
  const selectedModel =
    modelOptions.find((model) => model.id === selectedModelId) ||
    modelOptions[0];

  return (
    <>
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-xl p-6 border border-[#f5f5fa14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
              <HiOutlineDocumentText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[#f5f5fa7a] text-sm">Total Data Points</p>
              <p className="text-[#f5f5faf4] text-xl font-semibold">
                {campaign.current_contributions} / ~ 1000 entries
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-6 border border-[#f5f5fa14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
              <HiOutlineChip className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[#f5f5fa7a] text-sm">Campaign Type</p>
              <p className="text-[#f5f5faf4] text-xl font-semibold capitalize">
                Text
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-6 border border-[#f5f5fa14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
              <HiOutlineTerminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[#f5f5fa7a] text-sm">Estimated Time</p>
              <p className="text-[#f5f5faf4] text-xl font-semibold">
                {selectedModel.trainingTime}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Model Selection Cards */}
      <div className="rounded-xl p-6 border border-[#f5f5fa14] mt-6">
        <h3 className="text-[#f5f5faf4] text-lg font-semibold mb-4">
          Select a Base Model
        </h3>
        <div className="grid grid-cols-3 gap-6">
          {modelOptions.map((model) => (
            <div
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              className={`rounded-xl p-6 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                selectedModelId === model.id
                  ? 'bg-gradient-to-br from-[#0f0f17] to-[#0f0f17] border-2 border-[#a855f7]'
                  : 'border border-[#f5f5fa14] bg-[#f5f5fa05] hover:bg-[#f5f5fa0a]'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    selectedModelId === model.id
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7]'
                      : 'bg-[#f5f5fa14]'
                  }`}
                >
                  {model.icon}
                </div>
                {selectedModelId === model.id && (
                  <div className="bg-[#a855f7] rounded-full p-1">
                    <HiOutlineCheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <h4 className="text-[#f5f5faf4] font-medium text-lg mb-1">
                {model.name}
              </h4>
              <div className="text-[#f5f5fa7a] text-sm mb-3">
                {model.description}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#f5f5fa0a] rounded p-2">
                  <span className="text-[#f5f5fa7a]">Parameters:</span>
                  <div className="text-[#f5f5faf4]">{model.parameters}</div>
                </div>
                <div className="bg-[#f5f5fa0a] rounded p-2">
                  <span className="text-[#f5f5fa7a]">Requirements:</span>
                  <div className="text-[#f5f5faf4]">{model.requirements}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {model.bestFor.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs bg-[#6366f114] text-[#6366f1] px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onNextStep}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-medium flex items-center gap-2 hover:opacity-90"
          >
            Continue
            <HiOutlineArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

export default ModelSelectionStep;
