import { useRef, useState } from 'react';
import { useFleet } from '../state/store';
import { ConfigSchema, parseConfig } from '../model/config';
import { BUILTIN_VARIANTS } from '../presets/variants';

type Theme = 'auto' | 'light' | 'dark';

export function Header() {
  const cfg = useFleet((s) => s.cfg);
  const scenarios = useFleet((s) => s.scenarios);
  const investor = useFleet((s) => s.investor);
  const notice = useFleet((s) => s.notice);
  const running = useFleet((s) => s.running);
  const st = useFleet.getState;
  const fileRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>('auto');

  const cycleTheme = () => {
    const next: Theme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
    setTheme(next);
    if (next === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
  };

  const exportJson = () => {
    const check = ConfigSchema.safeParse(cfg);
    if (!check.success) {
      st().setNotice(`Fix these inputs before exporting: ${check.error.issues.map((i) => i.path.join('.')).join(', ')}`);
      return;
    }
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-${cfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'scenario'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const r = parseConfig(JSON.parse(await file.text()));
      if (r.ok) {
        st().replace(r.config);
        st().setNotice(`Imported "${r.config.name}".`);
      } else {
        st().setNotice(`Import failed. ${r.errors.slice(0, 6).join('; ')}${r.errors.length > 6 ? ` (and ${r.errors.length - 6} more)` : ''}`);
      }
    } catch (e) {
      st().setNotice(`Import failed. ${(e as Error).message}`);
    }
  };

  return (
    <>
      <header className="header">
        <div className="brand">Fleet</div>
        <input className="scenario-name" value={cfg.name} aria-label="Scenario name" onChange={(e) => st().update('name', e.target.value)} />
        <select aria-label="Saved scenarios" value="" onChange={(e) => e.target.value && st().loadScenario(e.target.value)}>
          <option value="">Load scenario</option>
          {Object.keys(scenarios).length > 0 && (
            <optgroup label="Saved">
              {Object.keys(scenarios).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Pricing variants (built in)">
            {BUILTIN_VARIANTS.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
              </option>
            ))}
          </optgroup>
        </select>
        <button onClick={() => st().saveScenario(cfg.name)}>Save</button>
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = '';
          }}
        />
        <button onClick={() => st().reset()}>Reset defaults</button>
        <span className="spacer" />
        {running && <span className="running">Running annual model</span>}
        <button onClick={cycleTheme} aria-label="Change theme">Theme: {theme}</button>
        <label className="investor-toggle">
          <input type="checkbox" checked={investor} onChange={(e) => st().setInvestor(e.target.checked)} /> Investor view
        </label>
      </header>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button onClick={() => st().setNotice(null)} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
