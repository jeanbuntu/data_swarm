import { useFleet } from '../state/store';
import { getPath, type SimConfig } from '../model/config';
import { PRESET_FIELDS, PRESET_LISTS, sourceFor } from '../model/defaults';
import { PANEL_DEFS, type ParamItem } from './panelDefs';
import { Slider, Select, Toggle, Section } from './controls';

function Item({ item, cfg }: { item: ParamItem; cfg: SimConfig }) {
  const st = useFleet.getState;
  if (item.kind === 'slider') {
    const k = item.scale ?? 1;
    const src = sourceFor(cfg, item.path);
    return (
      <Slider
        label={item.label}
        value={(getPath(cfg, item.path) as number) * k}
        min={item.min}
        max={item.max}
        step={item.step}
        unit={item.unit}
        estimate={!!src?.estimate}
        title={src ? `Source: ${src.source}${src.note ? `. ${src.note}` : ''}` : undefined}
        onChange={(v) => st().update(item.path, Number((v / k).toPrecision(12)))}
      />
    );
  }
  if (item.kind === 'preset') {
    const { presetPath } = PRESET_FIELDS[item.preset];
    return (
      <Select
        label={item.label}
        value={getPath(cfg, presetPath) as string}
        options={PRESET_LISTS[item.preset].map((p) => ({ value: p.id, label: p.name }))}
        onChange={(id) => st().preset(item.preset, id)}
      />
    );
  }
  if (item.kind === 'select') {
    return <Select label={item.label} value={getPath(cfg, item.path) as string} options={item.options} onChange={(v) => st().update(item.path, v)} />;
  }
  return <Toggle label={item.label} checked={getPath(cfg, item.path) as boolean} onChange={(v) => st().update(item.path, v)} />;
}

export function ParamPanels() {
  const cfg = useFleet((s) => s.cfg);
  return (
    <div className="panels">
      {PANEL_DEFS.map((p, i) => (
        <Section key={p.title} title={p.title} defaultOpen={i === 0}>
          {p.items.map((item) => (
            <Item key={item.kind === 'preset' ? `preset:${item.preset}` : item.path} item={item} cfg={cfg} />
          ))}
        </Section>
      ))}
    </div>
  );
}
