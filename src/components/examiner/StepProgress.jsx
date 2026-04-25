import { Check } from "lucide-react";

export default function StepProgress({ steps, currentStep }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-start justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep > step.number
                    ? "bg-green-500 text-white"
                    : currentStep === step.number
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > step.number ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`text-xs mt-2 text-center ${currentStep === step.number ? "font-semibold" : ""}`}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-1 flex-1 ${currentStep > step.number ? "bg-green-500" : "bg-gray-200"}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
