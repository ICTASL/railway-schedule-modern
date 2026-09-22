'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/** Root font sizes as a percentage of the browser default; every size in the CSS is in rem. */
const STEPS = [87.5, 100, 112.5, 125] as const;
const DEFAULT_STEP = 1;

export function FontSizeControls() {
  const t = useTranslations('common.textSize');
  const [step, setStep] = useState(DEFAULT_STEP);

  useEffect(() => {
    document.documentElement.style.fontSize = `${STEPS[step]}%`;
  }, [step]);

  return (
    <div className="text-size" role="group" aria-label={t('increase') + ' / ' + t('decrease')}>
      <button
        type="button"
        onClick={() => setStep((s) => Math.max(0, s - 1))}
        disabled={step === 0}
        aria-label={t('decrease')}
      >
        A<span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        onClick={() => setStep(DEFAULT_STEP)}
        disabled={step === DEFAULT_STEP}
        aria-label={t('reset')}
      >
        A
      </button>
      <button
        type="button"
        onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
        disabled={step === STEPS.length - 1}
        aria-label={t('increase')}
      >
        A<span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
