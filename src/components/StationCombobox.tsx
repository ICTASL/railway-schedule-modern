'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Station {
  id: string;
  name: string;
}

interface Props {
  id: string;
  name: string;
  stations: Station[];
  defaultValue: string;
  placeholder: string;
  noMatchesText: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** Type-to-filter station picker. Submits the station id via a hidden input, like the `<select>` it replaces. */
export function StationCombobox({
  id,
  name,
  stations,
  defaultValue,
  placeholder,
  noMatchesText,
  'aria-required': ariaRequired,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const initial = stations.find((s) => s.id === defaultValue) ?? null;
  const [query, setQuery] = useState(initial?.name ?? '');
  const [selectedId, setSelectedId] = useState(initial?.id ?? '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const filtered = query.trim()
    ? stations.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : stations;
  const activeIndex = filtered.length ? Math.min(highlighted, filtered.length - 1) : 0;

  function commit(station: Station | null) {
    setSelectedId(station?.id ?? '');
    setQuery(station?.name ?? '');
    setOpen(false);
  }

  /** On blur or an outside click: accept an exact typed match, otherwise fall back to the last valid pick. */
  function reconcile() {
    setOpen(false);
    const typed = query.trim().toLowerCase();
    const exact = stations.find((s) => s.name.toLowerCase() === typed);
    if (exact) {
      setSelectedId(exact.id);
      setQuery(exact.name);
      return;
    }
    const current = stations.find((s) => s.id === selectedId);
    setQuery(current?.name ?? '');
    if (!current) setSelectedId('');
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) reconcile();
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
    // Re-attach on every change so the outside-click handler always sees the latest typed text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, selectedId, stations]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      if (open) {
        event.preventDefault();
        if (filtered[activeIndex]) commit(filtered[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        reconcile();
      }
    }
  }

  return (
    <div className="combobox" ref={rootRef}>
      <input
        type="text"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-${filtered[activeIndex]!.id}` : undefined}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId('');
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={reconcile}
      />
      <input type="hidden" name={name} value={selectedId} />
      {open && (
        <ul className="combobox__list" role="listbox" id={listboxId}>
          {filtered.length === 0 && <li className="combobox__empty">{noMatchesText}</li>}
          {filtered.map((station, index) => (
            <li
              key={station.id}
              id={`${listboxId}-${station.id}`}
              role="option"
              aria-selected={station.id === selectedId}
              className={`combobox__option${index === activeIndex ? ' combobox__option--active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => commit(station)}
            >
              {station.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
