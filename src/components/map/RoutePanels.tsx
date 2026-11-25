import React from 'react';
import { Clock, Footprints, Layers, LocateFixed, Mic, Moon, Pencil, ShieldCheck, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RouteSummary, routeStats } from '@/lib/routeSummary';
import type { MapStyle } from '@/lib/mapStyle';

/* ---------- Route found ---------- */

export const RouteHeader = ({ summary }: { summary: RouteSummary }) => {
  const stats = routeStats(summary);
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold leading-none tracking-tight">{stats.duration}</span>
          <span className="text-[15px] text-muted-foreground">{stats.distance}</span>
        </p>
        <p className="mt-1.5 truncate text-[13px] text-muted-foreground">
          {stats.saferBy > 0 ? `${stats.saferBy}% less reported crime` : 'Already the safest way'} · {stats.night ? 'Night' : 'Day'} route
        </p>
      </div>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted" title={stats.night ? 'Night route' : 'Day route'}>
        {stats.night ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
      </span>
    </div>
  );
};

interface RouteBodyProps {
  summary: RouteSummary;
  onEdit: () => void;
  onClear: () => void;
}

export const RouteBody = ({ summary, onEdit, onClear }: RouteBodyProps) => {
  const stats = routeStats(summary);
  const exposure = Math.max(0.04, 1 - stats.saferBy / 100);
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl bg-muted p-4">
        <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Reported crime along the way</p>
        <Meter label="This route" value={exposure} caption={stats.duration} strong />
        <Meter label="Shortest path" value={1} caption={stats.shortestDuration} />
      </div>

      <ul className="space-y-1">
        <Detail icon={<ShieldCheck />} title={stats.saferBy > 0 ? `Avoids ${stats.saferBy}% of nearby incidents` : 'No safer detour nearby'}
          text="Recent incidents and community reports near each street count against it." />
        <Detail icon={<Clock />} title={stats.extraMinutes > 0 ? `${stats.extraMinutes} min longer than the shortest path` : 'As quick as the shortest path'}
          text="Detours are capped at one and a half times the shortest distance." />
        <Detail icon={stats.night ? <Moon /> : <Sun />} title={stats.night ? 'Scored for walking at night' : 'Scored for walking in daylight'}
          text={stats.night ? 'Unlit streets and night-time incidents weigh more.' : 'Daytime incidents count the most.'} />
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={onEdit}><Pencil /> Edit</Button>
        <Button variant="secondary" size="lg" onClick={onClear}><X /> Clear</Button>
      </div>
    </div>
  );
};

const Meter = ({ label, value, caption, strong }: { label: string; value: number; caption: string; strong?: boolean }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-[13px]">
      <span className={cn(strong ? 'font-semibold' : 'text-muted-foreground')}>{label}</span>
      <span className="tabular-nums text-muted-foreground">{caption}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-background">
      <div
        className={cn('meter-fill h-full w-full origin-left rounded-full', strong ? 'bg-foreground' : 'bg-muted-foreground/40')}
        style={{ transform: `scaleX(${value.toFixed(3)})` }}
      />
    </div>
  </div>
);

const Detail = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <li className="flex gap-4 rounded-xl py-2.5">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>
    <span className="min-w-0">
      <span className="block text-[14px] font-medium">{title}</span>
      <span className="block text-[13px] leading-snug text-muted-foreground">{text}</span>
    </span>
  </li>
);

/* ---------- Finding a route ---------- */

export const RoutingHeader = () => (
  <div className="space-y-2">
    <p className="shimmer-text text-[17px] font-semibold">Finding a safer route</p>
    <p className="text-[13px] text-muted-foreground">Scoring nearby streets by recent incidents and lighting</p>
  </div>
);

export const RoutingBody = () => (
  <div className="space-y-3" aria-hidden>
    {[0.9, 0.7, 0.8].map((w, i) => (
      <div key={i} className="flex items-center gap-4">
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
        <div className="h-3 animate-pulse rounded-full bg-muted" style={{ width: `${w * 70}%`, animationDelay: `${i * 120}ms` }} />
      </div>
    ))}
  </div>
);

/* ---------- Nothing selected ---------- */

function greeting(hour: number): string {
  if (hour < 5 || hour >= 21) return 'Walking late?';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const ExploreHeader = ({ name, hour }: { name: string; hour: number }) => (
  <div>
    <p className="text-[19px] font-semibold tracking-tight">
      {greeting(hour)}{name ? `, ${name}` : ''}
    </p>
    <p className="mt-0.5 text-[13px] text-muted-foreground">Search a destination for the safest way to walk there.</p>
  </div>
);

interface ExploreBodyProps {
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  onReport: () => void;
  onLocate: () => void;
  isLocating: boolean;
  mapStyle: MapStyle;
  onMapStyle: (style: MapStyle) => void;
}

export const ExploreBody = ({ showHeatmap, onToggleHeatmap, onReport, onLocate, isLocating, mapStyle, onMapStyle }: ExploreBodyProps) => (
  <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2">
      <Tile icon={<Layers />} label="Heatmap" active={showHeatmap} onClick={onToggleHeatmap} />
      <Tile icon={<Mic />} label="Report" onClick={onReport} />
      <Tile icon={<LocateFixed className={cn(isLocating && 'animate-pulse')} />} label="Locate me" onClick={onLocate} />
    </div>
    {showHeatmap && <HeatLegend />}
    <MapStylePicker value={mapStyle} onChange={onMapStyle} />
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 p-4">
      <Footprints className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Routes cover Oakland. They weigh recent crime data, community reports and street lighting, and never more than
        one and a half times the shortest walk.
      </p>
    </div>
  </div>
);

const Tile = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'press flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-[13px] font-medium transition-colors [&_svg]:h-5 [&_svg]:w-5',
      active ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-transparent hover:bg-accent',
    )}
  >
    {icon}
    {label}
  </button>
);

export const HeatLegend = () => (
  <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-[12px] text-muted-foreground animate-fade-up">
    <span>Fewer incidents</span>
    <span className="h-2 flex-1 rounded-full bg-gradient-to-r from-foreground/10 to-foreground/70" />
    <span>More</span>
  </div>
);

const MAP_STYLES: { value: MapStyle; label: string; hint: string }[] = [
  { value: 'detailed', label: 'Detailed', hint: 'Shops, businesses and building names' },
  { value: 'minimal', label: 'Minimal', hint: 'Streets and neighbourhood names only' },
];

const MapStylePicker = ({ value, onChange }: { value: MapStyle; onChange: (style: MapStyle) => void }) => (
  <div className="space-y-2">
    <p className="px-1 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Map style</p>
    <div className="relative grid grid-cols-2 rounded-full bg-muted p-1" role="radiogroup" aria-label="Map style">
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-card shadow-sm transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',
          value === 'minimal' && 'translate-x-full',
        )}
      />
      {MAP_STYLES.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          title={s.hint}
          onClick={() => onChange(s.value)}
          className={cn('relative z-10 h-9 rounded-full text-[13px] font-medium transition-colors', value === s.value ? 'text-foreground' : 'text-muted-foreground')}
        >
          {s.label}
        </button>
      ))}
    </div>
    <p className="px-1 text-[12px] text-muted-foreground">{MAP_STYLES.find((s) => s.value === value)?.hint}</p>
  </div>
);
