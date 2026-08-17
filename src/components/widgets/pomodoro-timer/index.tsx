'use client';

import { Pause, Play, Repeat } from 'lucide-react';
import Tabs from '../../common/Tabs';
import { formatPomodoroTime, usePomodoroTimer, type PomodoroPhase } from './usePomodoroTimer';

const PHASE_OPTIONS: { value: PomodoroPhase; label: string }[] = [
  { value: 'study', label: 'Study' },
  { value: 'break', label: 'Break' },
];

export default function PomodoroTimerWidget() {
  const { phase, remainingSeconds, isRunning, autoStart, togglePlay, setPhase, toggleAutoStart } =
    usePomodoroTimer();

  return (
    <aside className="widget-content-shell">
      <div className="widget-content pomodoro-widget">
        <div className="widget-content-header">
          <h2>Pomodoro Timer</h2>
        </div>

        <Tabs options={PHASE_OPTIONS} value={phase} onChange={setPhase} ariaLabel="Pomodoro phase" />

        <div className="pomodoro-display">
          <span className="pomodoro-time">{formatPomodoroTime(remainingSeconds)}</span>
        </div>

        <div className="pomodoro-controls">
          <button
            type="button"
            className="pomodoro-play-button"
            onClick={togglePlay}
            title={isRunning ? 'Pause' : 'Play'}
            aria-label={isRunning ? 'Pause' : 'Play'}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            type="button"
            className={`pomodoro-auto-toggle ${autoStart ? 'is-active' : ''}`}
            onClick={toggleAutoStart}
            title={autoStart ? 'Disable auto start' : 'Enable auto start'}
            aria-label={autoStart ? 'Disable auto start' : 'Enable auto start'}
            aria-pressed={autoStart}
          >
            <Repeat size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
