'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { StationCombobox } from './StationCombobox';
import { EMBED_PARAM } from '@/lib/site';
import { END_TIME_SLOTS, formatSlot, START_TIME_SLOTS } from '@/lib/times';
import { validateSearch, type ValidationErrors } from '@/lib/validation';

interface Props {
  locale: string;
  stations: { id: string; name: string }[];
  /** Today in Sri Lanka, yyyy-MM-dd: the earliest selectable date. */
  today: string;
  embedded: boolean;
  defaults: { from: string; to: string; date: string; start: string; end: string };
}

type Field = keyof ValidationErrors;
const FIELD_ORDER: Field[] = ['from', 'to', 'start', 'end', 'date'];

export function SearchForm({ locale, stations, today, embedded, defaults }: Props) {
  const t = useTranslations('search');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const uid = useId();
  const id = (field: Field) => `${uid}-${field}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = validateSearch(
      Object.fromEntries(['from', 'to', 'date', 'start', 'end'].map((k) => [k, data.get(k) as string | null])),
      today,
    );
    if (result.ok) {
      setErrors({});
      return; // valid: let the browser submit the GET form to the results page
    }
    event.preventDefault();
    setErrors(result.errors);
    const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);
    if (firstInvalid) form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
  }

  function field(name: Field, label: string, required: boolean, control: React.ReactNode) {
    const error = errors[name];
    return (
      <div className={`field${error ? ' field--error' : ''}`}>
        <label htmlFor={id(name)}>
          {label}
          {required && (
            <span className="required" aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
        {control}
        {error && (
          <p className="field__error" id={`${id(name)}-error`}>
            {t(`errors.${error}`)}
          </p>
        )}
      </div>
    );
  }

  const describe = (name: Field) => ({
    id: id(name),
    name,
    'aria-required': name === 'from' || name === 'to' ? true : undefined,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id(name)}-error` : undefined,
  });

  const timeOptions = (slots: readonly string[]) => (
    <>
      <option value="">{t('select')}</option>
      {slots.map((slot) => (
        <option key={slot} value={slot}>
          {formatSlot(slot)}
        </option>
      ))}
    </>
  );

  return (
    // GET: results are bookmarkable and the form changes nothing on the server, so no CSRF surface.
    <form method="get" action={`/${locale}/results`} onSubmit={handleSubmit} onReset={() => setErrors({})} noValidate>
      {embedded && <input type="hidden" name={EMBED_PARAM} value="countryportal" />}
      <div className="form-grid">
        {field('from', t('startStation'), true, (
          <StationCombobox
            {...describe('from')}
            stations={stations}
            defaultValue={defaults.from}
            placeholder={t('select')}
            noMatchesText={t('noMatches')}
          />
        ))}
        {field('to', t('endStation'), true, (
          <StationCombobox
            {...describe('to')}
            stations={stations}
            defaultValue={defaults.to}
            placeholder={t('select')}
            noMatchesText={t('noMatches')}
          />
        ))}
        {field('start', t('startTime'), false, (
          <select {...describe('start')} defaultValue={defaults.start}>
            {timeOptions(START_TIME_SLOTS)}
          </select>
        ))}
        {field('end', t('endTime'), false, (
          <select {...describe('end')} defaultValue={defaults.end}>
            {timeOptions(END_TIME_SLOTS)}
          </select>
        ))}
        {field('date', t('date'), false, (
          <input type="date" {...describe('date')} min={today} defaultValue={defaults.date || today} />
        ))}
      </div>
      <p className="hint">
        {t.rich('mandatory', { flag: (chunks) => <span className="flag">{chunks}</span> })}
      </p>
      <div className="actions">
        <button type="submit" className="button button--primary">
          {t('submit')}
        </button>
        <button type="reset" className="button">
          {t('reset')}
        </button>
      </div>
    </form>
  );
}
