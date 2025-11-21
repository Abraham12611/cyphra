import React from 'react';
import { HiOutlineCheckCircle } from 'react-icons/hi';

interface Step {
  step: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  activeStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, activeStep }) => {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-white mb-4">Model Fine-Tuning</h2>
      <div className="flex items-center">
        {steps.map((item) => (
          <div key={item.step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                activeStep >= item.step
                  ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white'
                  : 'bg-[#f5f5fa14] text-[#f5f5fa7a]'
              }`}
            >
              {activeStep > item.step ? (
                <HiOutlineCheckCircle className="w-5 h-5" />
              ) : (
                <span>{item.step}</span>
              )}
            </div>
            <div
              className={`text-sm mx-2 ${
                activeStep >= item.step ? 'text-white' : 'text-[#f5f5fa7a]'
              }`}
            >
              {item.label}
            </div>
            {item.step < steps.length && (
              <div
                className={`w-16 h-0.5 ${
                  activeStep > item.step
                    ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7]'
                    : 'bg-[#f5f5fa14]'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;
