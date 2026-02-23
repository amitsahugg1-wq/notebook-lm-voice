
import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { id: AppStep.INPUT, label: 'Feed Facts', icon: 'fa-file-lines' },
    { id: AppStep.SCRIPT, label: 'Review Script', icon: 'fa-pen-to-square' },
    { id: AppStep.AUDIO, label: 'Broadcast', icon: 'fa-broadcast-tower' }
  ];

  return (
    <div className="flex items-center justify-between mb-12 max-w-2xl mx-auto px-4">
      {steps.map((step, idx) => {
        const isActive = currentStep === step.id;
        const isPast = steps.findIndex(s => s.id === currentStep) > idx;
        
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                isActive ? 'bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.5)] scale-110' : 
                isPast ? 'bg-emerald-500' : 'bg-slate-800'
              }`}>
                <i className={`fa-solid ${isPast ? 'fa-check' : step.icon} text-lg`}></i>
              </div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 transition-colors duration-500 ${isPast ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
