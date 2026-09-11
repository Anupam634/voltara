'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { countryOptions } from '../lib/countries';
import { Icon } from './ui';

export function CountrySelect({
  value,
  onChange,
  locale,
  label,
  placeholder,
  required,
  id,
}: {
  value: string;
  onChange: (code: string) => void;
  locale: string;
  label: string;
  placeholder: string;
  required?: boolean;
  id?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => countryOptions(locale), [locale]);

  const selectedCountry = useMemo(
    () => options.find((c) => c.code.toLowerCase() === value.toLowerCase()),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative block" ref={containerRef}>
      <span className="v-label">
        {label}
        {required && <span className="ml-1 text-charge">*</span>}
      </span>

      {/* Hidden input for form requirement validation */}
      <input
        type="text"
        id={id}
        name="countryCode"
        value={value}
        required={required}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={`v-input flex items-center justify-between py-2.5 text-left text-sm ${
          isOpen ? 'border-brand-hi shadow-[0_0_0_4px_rgb(var(--c-brand)/0.22)]' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          {selectedCountry ? (
            <>
              {/* Emoji flag rather than a CDN image: countryOptions already
                  computes it, and an <img> would make signup depend on a
                  third-party host that fails silently when blocked. */}
              <span aria-hidden className="flex-shrink-0 text-base leading-none">
                {selectedCountry.flag}
              </span>
              <span className="truncate font-medium text-ink">{selectedCountry.name}</span>
              <span className="v-num text-xs font-bold text-brand-hi">({selectedCountry.code})</span>
            </>
          ) : (
            <span className="text-ink-3">{placeholder}</span>
          )}
        </div>
        <Icon
          name="chevron-down"
          size={16}
          className={`shrink-0 text-ink-3 transition-transform duration-200 ${isOpen ? 'rotate-180 text-charge' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="v-panel v-glass absolute left-0 right-0 z-50 mt-2 max-h-72 animate-pop overflow-hidden">
          <div className="border-b border-line/20 p-2.5">
            <div className="relative">
              <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="v-input py-1.5 pl-8 pr-3 text-xs"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto p-1 text-xs">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-ink-3">No country found</div>
            ) : (
              filteredOptions.map((c) => {
                const isSelected = c.code.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c.code)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-brand/15 font-bold text-ink' : 'text-ink-2 hover:bg-surface-3/70 hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span aria-hidden className="flex-shrink-0 text-sm leading-none">
                        {c.flag}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <span className="v-num ml-2 text-[10px] font-bold text-ink-3">{c.code}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
