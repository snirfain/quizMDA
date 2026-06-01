/**
 * Rolling case mini roadmap / stepper
 * Hebrew: מפת שלבים למקרה מתגלגל
 */

import React from 'react';

export default function RollingCaseStepper({
  caseName,
  currentStep = 0,
  totalSteps = 1,
  branchLabels = [],
}) {
  const steps = Math.max(1, totalSteps);
  const current = Math.min(Math.max(0, currentStep), steps - 1);

  return (
    <div className="rolling-stepper" role="navigation" aria-label="התקדמות במקרה">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
          {caseName || 'מקרה מתגלגל'}
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>
          שלב {current + 1} מתוך {steps}
          {branchLabels[current] ? ` · ${branchLabels[current]}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} aria-hidden="true">
        {Array.from({ length: steps }).map((_, i) => (
          <span
            key={i}
            className={`rolling-stepper-dot ${i < current ? 'done' : ''} ${i === current ? 'current' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
