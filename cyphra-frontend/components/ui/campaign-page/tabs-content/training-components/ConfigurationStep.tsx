import React from 'react';
import {
  HiOutlineInformationCircle,
  HiOutlineArrowRight,
} from 'react-icons/hi';

interface ColumnInfo {
  name: string;
  type: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean';
  description?: string;
  missing_values?: number;
  unique_values?: number;
  sample_values?: string[];
}

interface ModelOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  parameters: string;
}

interface DeploymentTarget {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  requiresAuth: boolean;
  isAuthenticated?: boolean;
}

interface TrainingHyperparams {
  epochs: number;
  batchSize: number;
  learningRate: number;
  useAdvancedOptions: boolean;
  warmupSteps: number;
  weightDecay: number;
}

interface ConfigurationStepProps {
  filePreview: {
    totalRows: number;
    sampleData: string[];
    columns: string[];
  };
  selectedModel: ModelOption;
  hyperparams: TrainingHyperparams;
  updateHyperparam: (param: keyof TrainingHyperparams, value: any) => void;
  deployTarget: string;
  deploymentTargets: DeploymentTarget[];
  setDeployTarget: (target: string) => void;
  onNextStep: () => void;
  onPreviousStep: () => void;
  formatNumber: (num: number) => string;
}

const ConfigurationStep: React.FC<ConfigurationStepProps> = ({
  filePreview,
  selectedModel,
  hyperparams,
  updateHyperparam,
  deployTarget,
  deploymentTargets,
  setDeployTarget,
  onNextStep,
  onPreviousStep,
  formatNumber,
}) => {
  return (
    <>
      {/* Data Preview */}
      <div className="rounded-xl p-6 border border-[#f5f5fa14] mb-6">
        <h3 className="text-[#f5f5faf4] text-lg font-semibold mb-4">
          Data Preview
        </h3>
        <div className="bg-[#0a0a0f] rounded-lg p-4 border border-[#f5f5fa0a] mb-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#f5f5fa14]">
                {filePreview.columns.map((column, i) => (
                  <th
                    key={i}
                    className="p-2 text-[#f5f5fa7a] text-sm font-medium"
                  >
                    {column}
                  </th>
                ))}
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
                  <td className="p-2 text-[#f5f5fa7a] text-sm">
                    {new Date().toISOString().split('T')[0]}
                  </td>
                  <td className="p-2 text-[#f5f5fa7a] text-sm">
                    {`id-${i + 1000}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[#f5f5fa7a] text-sm">
          Showing 4 of {filePreview.totalRows} records
        </div>
      </div>

      {/* Training Configuration */}
      <div className="rounded-xl p-6 border border-[#f5f5fa14]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#f5f5faf4] text-lg font-semibold">
            Fine-Tuning Configuration
          </h3>
          <div className="flex items-center gap-2 text-[#f5f5fa7a] text-sm">
            <HiOutlineInformationCircle className="w-4 h-4 text-[#6366f1]" />
            <span>Set up your fine-tuning parameters</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Selected Model */}
          <div className="p-4 bg-[#f5f5fa0a] rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] flex items-center justify-center">
                {selectedModel.icon}
              </div>
              <div>
                <p className="text-[#f5f5faf4] font-medium">
                  {selectedModel.name}
                </p>
                <p className="text-[#f5f5fa7a] text-sm">
                  {selectedModel.parameters} parameters
                </p>
              </div>
            </div>
          </div>

          {/* Hyperparameters */}
          <div>
            <label className="text-[#f5f5fa7a] text-sm mb-2 block">
              Hyperparameters
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#f5f5fa7a] text-sm">Epochs</label>
                <input
                  type="number"
                  value={hyperparams.epochs}
                  onChange={(e) =>
                    updateHyperparam('epochs', Number(e.target.value))
                  }
                  className="w-full bg-[#f5f5fa14] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>
              <div>
                <label className="text-[#f5f5fa7a] text-sm">Batch Size</label>
                <input
                  type="number"
                  value={hyperparams.batchSize}
                  onChange={(e) =>
                    updateHyperparam('batchSize', Number(e.target.value))
                  }
                  className="w-full bg-[#f5f5fa14] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>
              <div>
                <label className="text-[#f5f5fa7a] text-sm">
                  Learning Rate
                </label>
                <input
                  type="number"
                  value={formatNumber(hyperparams.learningRate)}
                  onChange={(e) =>
                    updateHyperparam('learningRate', Number(e.target.value))
                  }
                  className="w-full bg-[#f5f5fa14] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[#f5f5fa7a] text-sm">
                    Advanced Options
                  </label>
                  <button
                    onClick={() =>
                      updateHyperparam(
                        'useAdvancedOptions',
                        !hyperparams.useAdvancedOptions
                      )
                    }
                    className="text-[#6366f1] text-xs"
                  >
                    {hyperparams.useAdvancedOptions ? 'Hide' : 'Show'}
                  </button>
                </div>
                {hyperparams.useAdvancedOptions && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="text-[#f5f5fa7a] text-xs">
                        Warmup Steps
                      </label>
                      <input
                        type="number"
                        value={hyperparams.warmupSteps}
                        onChange={(e) =>
                          updateHyperparam(
                            'warmupSteps',
                            Number(e.target.value)
                          )
                        }
                        className="w-full bg-[#f5f5fa14] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] focus:outline-none focus:ring-2 focus:ring-[#6366f1] text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[#f5f5fa7a] text-xs">
                        Weight Decay
                      </label>
                      <input
                        type="number"
                        value={formatNumber(hyperparams.weightDecay)}
                        onChange={(e) =>
                          updateHyperparam(
                            'weightDecay',
                            Number(e.target.value)
                          )
                        }
                        className="w-full bg-[#f5f5fa14] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] focus:outline-none focus:ring-2 focus:ring-[#6366f1] text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deployment Target */}
          <div>
            <label className="text-[#f5f5fa7a] text-sm mb-2 block">
              Deployment Target
            </label>
            <div className="grid grid-cols-4 gap-3">
              {deploymentTargets.map((target) => (
                <div
                  key={target.id}
                  onClick={() => setDeployTarget(target.id)}
                  className={`rounded-lg p-4 cursor-pointer border transition-all ${
                    deployTarget === target.id
                      ? 'border-[#a855f7] bg-[#a855f71a]'
                      : 'border-[#f5f5fa14] bg-[#f5f5fa0a] hover:bg-[#f5f5fa14]'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-r ${target.color} flex items-center justify-center mb-3`}
                  >
                    {target.icon}
                  </div>
                  <div className="text-[#f5f5faf4] font-medium text-sm mb-1">
                    {target.name}
                  </div>
                  <div className="text-[#f5f5fa7a] text-xs">
                    {target.provider}
                  </div>
                  {target.requiresAuth && !target.isAuthenticated && (
                    <div className="mt-2 text-xs text-amber-500 flex items-center gap-1">
                      <HiOutlineInformationCircle className="w-3 h-3" />
                      Authentication required
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <button
              onClick={onPreviousStep}
              className="px-6 py-2 rounded-lg border border-[#f5f5fa14] text-[#f5f5faf4] font-medium hover:bg-[#f5f5fa0a]"
            >
              Back
            </button>
            <button
              onClick={onNextStep}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-medium flex items-center gap-2 hover:opacity-90"
            >
              Continue
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfigurationStep;
