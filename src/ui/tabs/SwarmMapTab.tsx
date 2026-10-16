import { useEffect, useRef, useState } from 'react';
import { useFleet } from '../../state/store';
import { useAnimationLoop } from '../../state/useAnimationLoop';
import { createLiveSim, stepLive, kickModule, type LiveSim } from '../../model/live';
import { moduleRole } from '../../model/derive';
import { dateLabel, localSolarHour } from '../../model/time';
import { MapCanvas } from '../map/MapCanvas';
import { FormationCanvas } from '../map/FormationCanvas';
import { Stat } from '../controls';
import { BINDING_LABEL, fmtHour, fmtNum, fmtPct } from '../format';

function masterVsFollower(s: LiveSim): string {
  const roles = s.moduleTflop.map((_, i) => moduleRole(s.cfg, i));
  const mean = (r: string) => {
    const v = s.moduleTflop.filter((_, i) => roles[i] === r);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const f = mean('follower');
  return f > 0 ? `${fmtNum((mean('master') / f) * 100)}%` : 'n/a';
}

export function SwarmMapTab() {
  const cfg = useFleet((s) => s.cfg);
  const [doy, setDoy] = useState(172);
  const [speedLog, setSpeedLog] = useState(Math.log10(1200));
  const [playing, setPlaying] = useState(true);
  const simRef = useRef<LiveSim | null>(null);
  const accRef = useRef(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    simRef.current = createLiveSim(cfg, doy);
    accRef.current = 0;
    setFrame((f) => f + 1);
  }, [cfg, doy]);

  useAnimationLoop(playing, (dt) => {
    const s = simRef.current;
    if (!s) return;
    accRef.current += dt * 10 ** speedLog;
    let stepped = false;
    let guard = 0;
    while (accRef.current >= s.dtS && guard++ < 50) {
      if (s.done) {
        simRef.current = createLiveSim(cfg, doy);
        accRef.current = 0;
        stepped = true;
        break;
      }
      stepLive(s);
      accRef.current -= s.dtS;
      stepped = true;
    }
    if (stepped) setFrame((f) => f + 1);
  });

  const s = simRef.current;
  if (!s) return null;
  const last = s.history[s.history.length - 1];
  const strays = s.swarm.modules.filter((m) => m.stray).length;
  const online = s.flows.filter((f) => f.online).length;
  const speed = 10 ** speedLog;

  return (
    <div className="tab-body">
      <div className="map-grid">
        <figure className="card">
          <figcaption>Southern California Bight</figcaption>
          <MapCanvas sim={s} frame={frame} />
        </figure>
        <figure className="card">
          <figcaption>Formation (zoomed)</figcaption>
          <FormationCanvas sim={s} frame={frame} />
        </figure>
      </div>
      <div className="card playback">
        <button className="primary" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
        <button
          disabled={playing}
          onClick={() => {
            if (simRef.current) {
              stepLive(simRef.current);
              setFrame((f) => f + 1);
            }
          }}
        >
          Step 5 min
        </button>
        <label className="field">
          <span>Speed {fmtNum(speed)}x</span>
          <input type="range" min={Math.log10(60)} max={Math.log10(20000)} step={0.01} value={speedLog} onChange={(e) => setSpeedLog(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Day {dateLabel(doy)}</span>
          <input type="range" min={1} max={365} value={doy} onChange={(e) => setDoy(Number(e.target.value))} />
        </label>
        <button
          onClick={() => {
            const sim = simRef.current;
            if (sim) {
              kickModule(sim, Math.floor(Math.random() * sim.cfg.swarm.count));
              setFrame((f) => f + 1);
            }
          }}
        >
          Scatter a module
        </button>
      </div>
      <div className="stats-row">
        <Stat label="Local solar time" value={fmtHour(localSolarHour(s.t, cfg.env.originLon))} />
        <Stat label="Sun elevation" value={`${fmtNum(s.sunElevationDeg)}°`} />
        <Stat label="Petals" value={s.stowed ? 'Stowed for wind' : 'Open'} />
        <Stat label="Modules online" value={`${online || cfg.swarm.count} of ${cfg.swarm.count}`} />
        <Stat label="Strays" value={String(strays)} tone={strays ? 'bad' : undefined} />
        <Stat label="Average battery" value={last ? fmtPct(last.socFrac) : 'n/a'} />
        <Stat label="Swarm compute" value={last ? `${fmtNum(last.tflops)} TFLOPS` : 'n/a'} />
        <Stat label="Jobs done, queued" value={`${fmtNum(s.jobs.completed)}, ${fmtNum(s.jobs.queue.length)}`} />
        <Stat label="Mean job turnaround" value={s.jobs.completed ? `${fmtNum(s.jobs.turnaroundSumS / s.jobs.completed / 60, 1)} min` : 'n/a'} />
        {cfg.comms.hubMode && (
          <Stat label="Master vs follower compute today" value={masterVsFollower(s)} sub="Masters carry Starlink and the cluster computer" />
        )}
        <Stat label="Binding now" value={BINDING_LABEL[s.binding]} />
        <Stat label="Distance offshore" value={`${fmtNum(s.env.offshoreKm(s.swarm.centroid.x, s.swarm.centroid.y))} km`} />
      </div>
      {cfg.swarm.strategy === 'seek' && <p className="note">Cloud-seeking plans with a perfect forecast over its horizon, so the gain shown is an upper bound.</p>}
    </div>
  );
}
