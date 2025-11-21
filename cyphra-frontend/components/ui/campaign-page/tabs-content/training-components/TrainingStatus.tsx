import React from 'react';
import {
  HiOutlinePlay,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiOutlineCloudUpload,
  HiOutlineExternalLink,
  HiOutlineClock,
} from 'react-icons/hi';

interface TrainingMetrics {
  loss?: number;
  accuracy?: number;
  steps?: number;
  epochs?: number;
}

interface TrainingStatusProps {
  status:
    | 'idle'
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'submitted';
  progress?: number;
  error?: string;
  result_url?: string;
  training_status_id?: string;
  started_at?: string;
  completed_at?: string;
  metrics?: TrainingMetrics;
  onStartTraining: () => void;
  onClearTrainingStatus: () => void;
  hyperparams: {
    epochs: number;
  };
  campaign: {
    campaign_id: string;
  };
}

const TrainingStatus: React.FC<TrainingStatusProps> = ({
  status,
  progress,
  error,
  result_url,
  training_status_id,
  started_at,
  completed_at,
  metrics,
  onStartTraining,
  onClearTrainingStatus,
  hyperparams,
  campaign,
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return '-';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Helper function to format Hugging Face URL with /tree/main
  const formatHuggingFaceUrl = (url?: string) => {
    if (!url) return '';
    // Remove any existing /tree/main suffix to avoid duplication
    const baseUrl = url.replace(/\/tree\/main\/?$/, '');
    return `${baseUrl}/tree/main`;
  };

  return (
    <div className="space-y-6">
      {status === 'idle' && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#f5f5fa0a] mb-4">
            <HiOutlinePlay className="w-8 h-8 text-[#a855f7]" />
          </div>
          <h4 className="text-[#f5f5faf4] font-medium mb-2">
            Ready to Start Fine-Tuning
          </h4>
          <p className="text-[#f5f5fa7a] text-sm mb-6 max-w-md mx-auto">
            You're all set to start the fine-tuning process. This will train a
            custom model on your campaign data.
          </p>
          <button
            onClick={onStartTraining}
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-medium inline-flex items-center gap-2 hover:opacity-90"
          >
            Start Fine-Tuning
            <HiOutlinePlay className="w-4 h-4" />
          </button>
        </div>
      )}

      {status === 'submitted' && (
        <div className="space-y-6">
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
              <HiOutlineCloudUpload className="w-8 h-8 text-blue-500" />
            </div>
           
            <h4 className="text-[#f5f5faf4] font-medium mb-2">
              Training In Progress
            </h4>
            <p className="text-[#f5f5fa7a] text-sm mb-4 max-w-md mx-auto">
              Your fine-tuning request has been successfully submitted to
              Hugging Face. <br />
              <br />
              <div className="text-green-500 text-xs">
                This process typically takes 15-30 minutes. You'll be notified
                when complete.
              </div>
            </p>
            {training_status_id && (
              <div className="text-xs text-[#f5f5fa7a] font-mono bg-[#f5f5fa0a] rounded px-3 py-1 inline-block">
                Request ID: {training_status_id}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-[#f5f5fa7a] text-sm">
                Submitting request...
              </div>
              <div className="text-[#f5f5faf4] font-medium text-sm">
                {progress?.toFixed(0) || 0}%
              </div>
            </div>
            <div className="h-2 w-full bg-[#f5f5fa14] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${progress || 20}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {status === 'pending' && (
        <div className="space-y-6">
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
              <HiOutlineClock className="w-8 h-8 text-amber-500" />
            </div>
            <h4 className="text-[#f5f5faf4] font-medium mb-2">
              Training Job Queued
            </h4>
            <p className="text-[#f5f5fa7a] text-sm mb-4 max-w-md mx-auto">
              Your training job has been submitted and is waiting to start. This
              usually takes a few minutes.
            </p>
            {training_status_id && (
              <div className="text-xs text-[#f5f5fa7a] font-mono bg-[#f5f5fa0a] rounded px-3 py-1 inline-block">
                Job ID: {training_status_id}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-[#f5f5fa7a] text-sm">Initializing...</div>
              <div className="text-[#f5f5faf4] font-medium text-sm">
                {progress?.toFixed(0) || 5}%
              </div>
            </div>
            <div className="h-2 w-full bg-[#f5f5fa14] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full transition-all duration-300"
                style={{ width: `${progress || 5}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-[#f5f5fa7a] text-sm">
                Training in progress...
              </div>
              <div className="text-[#f5f5faf4] font-medium text-sm">
                {progress?.toFixed(0) || 0}%
              </div>
            </div>
            <div className="h-2 w-full bg-[#f5f5fa14] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-full transition-all duration-300"
                style={{ width: `${progress || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Training Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
              <div className="text-[#f5f5fa7a] text-xs mb-1">Started</div>
              <div className="text-[#f5f5faf4] font-medium text-sm">
                {formatDate(started_at)}
              </div>
            </div>
            <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
              <div className="text-[#f5f5fa7a] text-xs mb-1">Job ID</div>
              <div className="text-[#f5f5faf4] font-medium text-sm font-mono">
                {training_status_id?.slice(0, 8)}...
              </div>
            </div>
          </div>

          {/* Training Metrics - only show if available */}
          {metrics && (metrics.loss || metrics.accuracy || metrics.steps) && (
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
                <div className="text-[#f5f5fa7a] text-xs mb-1">Loss</div>
                <div className="text-[#f5f5faf4] font-medium text-lg">
                  {metrics.loss ? metrics.loss.toFixed(4) : '-'}
                </div>
              </div>
              <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
                <div className="text-[#f5f5fa7a] text-xs mb-1">Accuracy</div>
                <div className="text-[#f5f5faf4] font-medium text-lg">
                  {metrics.accuracy
                    ? `${(metrics.accuracy * 100).toFixed(1)}%`
                    : '-'}
                </div>
              </div>
              <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
                <div className="text-[#f5f5fa7a] text-xs mb-1">Steps</div>
                <div className="text-[#f5f5faf4] font-medium text-lg">
                  {metrics.steps || '-'}
                </div>
              </div>
              <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
                <div className="text-[#f5f5fa7a] text-xs mb-1">Epoch</div>
                <div className="text-[#f5f5faf4] font-medium text-lg">
                  {metrics.epochs || 0}/{hyperparams.epochs}
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className="rounded-lg p-4 bg-[#0a0a0f] border border-[#f5f5fa0a]">
            <div className="text-[#f5f5fa7a] text-sm mb-2">Training Status</div>
            <div className="space-y-1 text-sm">
              <div className="text-green-500 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Training model on Hugging Face infrastructure...
              </div>
              <div className="text-[#f5f5fa7a] text-xs">
                This process typically takes 15-30 minutes. You'll be notified
                when complete.
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'completed' && (
        <div className="space-y-6">
          <div className="text-center py-6 bg-[#f5f5fa0a] rounded-lg border border-[#f5f5fa14]">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white mb-4">
              <HiOutlineCheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-[#f5f5faf4] font-medium text-lg mb-2">
              Fine-Tuning Complete!
            </h4>
            <p className="text-[#f5f5fa7a] text-sm mb-6 max-w-md mx-auto">
              Your model has been successfully trained and deployed to Hugging
              Face.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={onClearTrainingStatus}
                className="px-6 py-2 rounded-lg border border-[#f5f5fa14] text-[#f5f5faf4] hover:bg-[#f5f5fa0a] inline-flex items-center gap-2"
              >
                <HiOutlineRefresh className="w-4 h-4" />
                Train New Model
              </button>
              {result_url && (
                <a
                  href={formatHuggingFaceUrl(result_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white inline-flex items-center gap-2 hover:opacity-90"
                >
                  <HiOutlineExternalLink className="w-4 h-4" />
                  View on Hugging Face
                </a>
              )}
            </div>
          </div>

          {/* Training Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg p-4 bg-[#f5f5fa0a] space-y-3">
              <h4 className="text-[#f5f5faf4] font-medium">Training Summary</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[#f5f5fa7a]">Started</div>
                  <div className="text-[#f5f5faf4]">
                    {formatDate(started_at)}
                  </div>
                </div>
                <div>
                  <div className="text-[#f5f5fa7a]">Completed</div>
                  <div className="text-[#f5f5faf4]">
                    {formatDate(completed_at)}
                  </div>
                </div>
                <div>
                  <div className="text-[#f5f5fa7a]">Duration</div>
                  <div className="text-[#f5f5faf4]">
                    {calculateDuration(started_at, completed_at)}
                  </div>
                </div>
                <div>
                  <div className="text-[#f5f5fa7a]">Final Loss</div>
                  <div className="text-[#f5f5faf4]">
                    {metrics?.loss ? metrics.loss.toFixed(4) : '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-4 bg-[#f5f5fa0a] space-y-3">
              <h4 className="text-[#f5f5faf4] font-medium">
                Model Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <div className="text-[#f5f5fa7a]">Job ID</div>
                  <div className="text-[#f5f5faf4] font-mono text-xs">
                    {training_status_id?.slice(0, 8)}...
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="text-[#f5f5fa7a]">Base Model</div>
                  <div className="text-[#f5f5faf4]">Pythia-70M</div>
                </div>
                <div className="flex justify-between">
                  <div className="text-[#f5f5fa7a]">Training Epochs</div>
                  <div className="text-[#f5f5faf4]">{hyperparams.epochs}</div>
                </div>
                {result_url && (
                  <div className="pt-2 border-t border-[#f5f5fa14]">
                    <div className="text-[#f5f5fa7a] text-xs mb-1">
                      Model URL
                    </div>
                    <a
                      href={formatHuggingFaceUrl(result_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6366f1] hover:text-[#a855f7] text-xs break-all flex items-center gap-1"
                    >
                      <HiOutlineExternalLink className="w-3 h-3 flex-shrink-0" />
                      {result_url.replace('https://', '')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 text-red-500 mb-4">
              <HiOutlineExclamationCircle className="w-8 h-8" />
            </div>
            <h4 className="text-[#f5f5faf4] font-medium mb-2">
              Training Failed
            </h4>
            <p className="text-[#f5f5fa7a] text-sm mb-6 max-w-md mx-auto">
              There was an error during the training process. Please check the
              error details below.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={onClearTrainingStatus}
                className="px-6 py-2 rounded-lg border border-[#f5f5fa14] text-[#f5f5faf4] hover:bg-[#f5f5fa0a] inline-flex items-center gap-2"
              >
                <HiOutlineRefresh className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={onStartTraining}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-medium inline-flex items-center gap-2 hover:opacity-90"
              >
                Try Again
                <HiOutlineRefresh className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error Details */}
          {error && (
            <div className="rounded-lg p-4 bg-red-500/10 border border-red-500/20">
              <h4 className="text-red-500 font-medium mb-2 flex items-center gap-2">
                <HiOutlineExclamationCircle className="w-4 h-4" />
                Error Details
              </h4>
              <div className="text-[#f5f5faf4] text-sm bg-[#0a0a0f] rounded p-3 font-mono">
                {error}
              </div>
            </div>
          )}

          {/* Training Info */}
          {(training_status_id || started_at) && (
            <div className="grid grid-cols-2 gap-4">
              {training_status_id && (
                <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
                  <div className="text-[#f5f5fa7a] text-xs mb-1">Job ID</div>
                  <div className="text-[#f5f5faf4] font-medium text-sm font-mono">
                    {training_status_id.slice(0, 8)}...
                  </div>
                </div>
              )}
              {started_at && (
                <div className="rounded-lg p-3 bg-[#f5f5fa0a]">
                  <div className="text-[#f5f5fa7a] text-xs mb-1">Started</div>
                  <div className="text-[#f5f5faf4] font-medium text-sm">
                    {formatDate(started_at)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrainingStatus;
