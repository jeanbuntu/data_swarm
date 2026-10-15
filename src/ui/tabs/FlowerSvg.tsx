import type { SimConfig } from '../../model/config';

export function FlowerSvg({ cfg, sunElevationDeg, sunAzimuthDeg, stowed }: { cfg: SimConfig; sunElevationDeg: number; sunAzimuthDeg: number; stowed: boolean }) {
  const h = cfg.hull;
  const span = h.sideM + 2 * h.petalLengthM;
  const half = span / 2 + 0.6;
  const up = sunElevationDeg > 0;
  const tiltDeg = stowed || !up ? 0 : h.tracking === 'dual' ? Math.min(90 - sunElevationDeg, h.maxTiltDeg) : h.tracking === 'yaw' ? h.fixedTiltDeg : 0;
  // Screen angle of the sun direction (0 = +x, clockwise), from azimuth clockwise from north.
  const sunScreenDeg = sunAzimuthDeg - 90;
  const r0 = h.sideM / 2;
  const len = stowed ? h.petalLengthM * 0.15 : h.petalLengthM;
  const petals = Array.from({ length: h.petalCount }, (_, k) => {
    const a = (360 * k) / Math.max(1, h.petalCount);
    const rel = ((a - sunScreenDeg) * Math.PI) / 180;
    // In plan view a tilted petal looks shorter; petals facing toward or away from the sun tilt most.
    const proj = h.tracking === 'flat' ? len : len * Math.cos(((tiltDeg * Math.PI) / 180) * Math.abs(Math.cos(rel)));
    return { a, proj };
  });
  const sx = Math.cos((sunScreenDeg * Math.PI) / 180) * half * 0.9;
  const sy = Math.sin((sunScreenDeg * Math.PI) / 180) * half * 0.9;
  return (
    <svg viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`} className="flower" role="img" aria-label={`Top view of one module with ${h.petalCount} petals, ${stowed ? 'stowed' : 'open'}`}>
      <circle cx={0} cy={0} r={half * 0.98} fill="var(--ocean)" />
      {petals.map((p) => (
        <g key={p.a} transform={`rotate(${p.a})`}>
          <rect x={r0} y={-h.petalWidthM / 2} width={Math.max(0.02, p.proj)} height={h.petalWidthM} fill="var(--c2)" fillOpacity={0.85} stroke="var(--panel)" strokeWidth={0.02} />
        </g>
      ))}
      <rect x={-r0} y={-r0} width={2 * r0} height={2 * r0} fill="var(--c2)" stroke="var(--text)" strokeWidth={0.03} />
      {up && (
        <>
          <line x1={0} y1={0} x2={sx} y2={sy} stroke="var(--c3)" strokeWidth={0.04} strokeDasharray="0.12 0.08" />
          <circle cx={sx} cy={sy} r={0.14} fill="var(--c3)" />
        </>
      )}
    </svg>
  );
}
