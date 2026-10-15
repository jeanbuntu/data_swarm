import { useEffect, useState, type ReactNode } from 'react';

const decimals = (step: number) => Math.min(6, Math.max(0, -Math.floor(Math.log10(step))));
const show = (v: number, step: number) => String(Number(v.toFixed(decimals(step))));

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  estimate?: boolean;
  title?: string;
  onChange(v: number): void;
}

export function Slider({ label, value, min, max, step, unit, estimate, title, onChange }: SliderProps) {
  const [text, setText] = useState(show(value, step));
  useEffect(() => setText(show(value, step)), [value, step]);
  const commit = (raw: string) => {
    const x = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(x)) {
      setText(show(value, step));
      return;
    }
    const clamped = Math.min(max, Math.max(min, x));
    const snapped = Number((Math.round((clamped - min) / step) * step + min).toFixed(decimals(step)));
    onChange(Math.min(max, snapped));
  };
  return (
    <div className="slider" title={title}>
      <div className="slider-head">
        <span className="slider-label">
          {label}
          {estimate && <span className="badge est" title="Estimate: no direct source">EST</span>}
        </span>
        <span className="slider-value">
          <input
            type="number"
            value={text}
            step={step}
            aria-label={`${label} value`}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            }}
          />
          {unit && <span className="unit">{unit}</span>}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange(v: string): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="field toggle-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
