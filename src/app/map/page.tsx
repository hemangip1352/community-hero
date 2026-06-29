'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MapPin, Filter, X, RefreshCw, AlertCircle, CheckCircle,
  Clock, Zap, List, Info
} from 'lucide-react';
import Link from 'next/link';
import { GoogleMap, useJsApiLoader, MarkerF, MarkerClustererF } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapMarker {
  id: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  lat: number;
  lng: number;
  severity: number;
  confidence: number;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Pothole', 'Garbage', 'Water Leakage', 'Streetlight Failure', 'Drainage Problem', 'Road Damage', 'Other'];
const STATUSES   = ['All', 'reported', 'verified', 'assigned', 'in_progress', 'resolved'];

const CATEGORY_EMOJI: Record<string, string> = {
  Pothole: '🕳️', Garbage: '🗑️', 'Water Leakage': '💧',
  'Streetlight Failure': '💡', 'Drainage Problem': '🚿',
  'Road Damage': '🛣️', Other: '⚠️',
};

const STATUS_COLOR: Record<string, string> = {
  reported: '#94a3b8', verified: '#60a5fa', assigned: '#c084fc',
  in_progress: '#fbbf24', resolved: '#34d399', rejected: '#f87171', duplicate: '#fb923c',
};

const URGENCY_RING: Record<string, string> = {
  low: 'border-green-400', medium: 'border-amber-400',
  high: 'border-orange-500', critical: 'border-red-500 animate-pulse',
};

// ─── Map Canvas Component ─────────────────────────────────────────────────────
// Uses a pure-SVG/CSS approach so it works without a Maps API key.
// When NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is present, the Google Map is used instead.

function MapPin2({ marker, onClick, selected }: {
  marker: MapMarker;
  onClick: () => void;
  selected: boolean;
}) {
  const size = 28 + marker.severity * 16; // 28–44px based on severity
  const color = STATUS_COLOR[marker.status] ?? '#94a3b8';
  return (
    <button
      onClick={onClick}
      title={marker.title}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        zIndex: selected ? 20 : 10,
      }}
      className="group"
    >
      <div
        style={{ background: color, width: size, height: size }}
        className={`rounded-full border-2 ${URGENCY_RING[marker.urgency] ?? 'border-white'} flex items-center justify-center text-sm shadow-lg transition-transform group-hover:scale-125 ${selected ? 'scale-125 ring-2 ring-white' : ''}`}
      >
        {CATEGORY_EMOJI[marker.category] ?? '📍'}
      </div>
    </button>
  );
}

// Simple fake-map canvas using a dark grid — replaces Google Maps when no key is set
function FallbackMap({ markers, onMarkerClick, selectedId }: {
  markers: MapMarker[];
  onMarkerClick: (m: MapMarker) => void;
  selectedId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalise lat/lng → pixel coords within the container
  function toPixel(marker: MapMarker, w: number, h: number) {
    if (markers.length === 0) return { x: w / 2, y: h / 2 };
    const lats = markers.map(m => m.lat);
    const lngs = markers.map(m => m.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padX = w * 0.1, padY = h * 0.1;
    const latRange = maxLat - minLat || 0.01;
    const lngRange = maxLng - minLng || 0.01;
    const x = padX + ((marker.lng - minLng) / lngRange) * (w - 2 * padX);
    const y = h - padY - ((marker.lat - minLat) / latRange) * (h - 2 * padY);
    return { x, y };
  }

  const [dims, setDims] = useState({ w: 900, h: 600 });
  useEffect(() => {
    const obs = new ResizeObserver(e => {
      const rect = e[0].contentRect;
      setDims({ w: rect.width, h: rect.height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-900">
      {/* Grid background */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#475569" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* City block shapes */}
      <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: 8 }).map((_, i) =>
          Array.from({ length: 6 }).map((_, j) => (
            <rect key={`${i}-${j}`} x={i * 120 + 10} y={j * 100 + 10} width={100} height={80} rx={4}
              fill="#3b82f6" />
          ))
        )}
      </svg>
      {/* Markers */}
      {markers.map(m => {
        const { x, y } = toPixel(m, dims.w, dims.h);
        return (
          <div key={m.id} style={{ left: x, top: y }} className="absolute">
            <MapPin2 marker={m} onClick={() => onMarkerClick(m)} selected={selectedId === m.id} />
          </div>
        );
      })}
      {markers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          No issues match your filters
        </div>
      )}
    </div>
  );
}

// ─── Marker Popup ─────────────────────────────────────────────────────────────

function MarkerPopup({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const statusColor = STATUS_COLOR[marker.status] ?? '#94a3b8';
  const daysAgo = Math.floor((Date.now() - new Date(marker.created_at).getTime()) / 86400000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-30"
    >
      <Card className="bg-slate-800 border-slate-600 shadow-2xl">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{CATEGORY_EMOJI[marker.category] ?? '📍'}</span>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{marker.title}</p>
                <p className="text-slate-400 text-xs">{marker.category}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Status</span>
              <span className="font-medium px-2 py-0.5 rounded-full text-xs" style={{ background: `${statusColor}22`, color: statusColor }}>
                {marker.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Urgency</span>
              <span className={`font-medium capitalize ${URGENCY_RING[marker.urgency]?.replace('border-', 'text-').replace(' animate-pulse', '') ?? 'text-slate-300'}`}>
                {marker.urgency}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">AI Severity</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 bg-slate-700 rounded-full h-1">
                  <div className="h-1 rounded-full bg-orange-500" style={{ width: `${marker.severity * 100}%` }} />
                </div>
                <span className="text-slate-300">{(marker.severity * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Reported</span>
              <span className="text-slate-300">{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
            </div>
          </div>

          <Link href={`/issue/${marker.id}`} className="block">
            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-8">
              View Full Details
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function MapLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute top-4 right-4 z-20">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="border-slate-600 bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 text-white gap-2"
      >
        <Info className="w-3.5 h-3.5" /> Legend
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute top-10 right-0 w-52 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl"
          >
            <p className="text-white text-xs font-semibold mb-3">Status Colors</p>
            {Object.entries(STATUS_COLOR).map(([s, c]) => (
              <div key={s} className="flex items-center gap-2 mb-1.5">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c }} />
                <span className="text-slate-300 text-xs capitalize">{s.replace('_', ' ')}</span>
              </div>
            ))}
            <p className="text-white text-xs font-semibold mt-3 mb-2">Marker Size</p>
            <p className="text-slate-400 text-xs">Larger = higher AI severity score</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [filtered, setFiltered] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showList, setShowList] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus]     = useState('All');

  const fetchMarkers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'All') params.set('category', filterCategory);
      if (filterStatus   !== 'All') params.set('status',   filterStatus);
      const res = await fetch(`/api/map/markers?${params}`);
      const { data } = await res.json();
      setMarkers(data || []);
      setFiltered(data || []);
    } catch (err) {
      console.error('[Map] Failed to fetch markers:', err);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => { fetchMarkers(); }, [fetchMarkers]);

  // Stats
  const total      = markers.length;
  const resolved   = markers.filter(m => m.status === 'resolved').length;
  const critical   = markers.filter(m => m.urgency === 'critical').length;
  const escalated  = markers.filter(m => m.urgency === 'critical' || m.urgency === 'high').length;

  const activeFilters = (filterCategory !== 'All' ? 1 : 0) + (filterStatus !== 'All' ? 1 : 0);

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h1 className="text-white font-bold text-lg">Issue Map</h1>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 ml-4">
            {[
              { icon: <AlertCircle className="w-3.5 h-3.5" />, val: total,    label: 'Total',    color: 'text-slate-300' },
              { icon: <CheckCircle className="w-3.5 h-3.5" />, val: resolved, label: 'Resolved', color: 'text-green-400' },
              { icon: <Zap className="w-3.5 h-3.5" />,         val: critical, label: 'Critical', color: 'text-red-400'   },
            ].map(s => (
              <div key={s.label} className={`flex items-center gap-1 text-sm ${s.color}`}>
                {s.icon}
                <span className="font-bold">{s.val}</span>
                <span className="text-slate-500 hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={() => setShowList(!showList)}
              size="sm"
              variant="outline"
              className="border-slate-600 hover:bg-slate-700 gap-1.5 text-white"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              size="sm"
              variant="outline"
              className={`border-slate-600 hover:bg-slate-700 gap-1.5 ${activeFilters > 0 ? 'border-blue-500 text-blue-400' : 'text-white'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilters > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{activeFilters}</span>
              )}
            </Button>
            <Button onClick={fetchMarkers} size="sm" variant="outline" className="border-slate-600 hover:bg-slate-700 text-white">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/dashboard">
              <Button size="sm" variant="outline" className="border-slate-600 hover:bg-slate-700 text-white">
                ← Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-w-7xl mx-auto pt-3 flex flex-wrap gap-4">
                <div>
                  <p className="text-slate-500 text-xs mb-1.5">Category</p>
                  <div className="flex flex-wrap gap-1">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          filterCategory === cat
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {cat !== 'All' && CATEGORY_EMOJI[cat]} {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1.5">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map(st => (
                      <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          filterStatus === st
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {st !== 'All' && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: STATUS_COLOR[st] }} />}
                        {st === 'All' ? 'All' : st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilters > 0 && (
                  <button
                    onClick={() => { setFilterCategory('All'); setFilterStatus('All'); }}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 self-end mb-1"
                  >
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Issue List Sidebar */}
        <AnimatePresence>
          {showList && (
            <motion.div
              initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              className="bg-slate-800 border-r border-slate-700 overflow-y-auto flex-shrink-0"
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white text-sm font-semibold">{filtered.length} issues</p>
                  <button onClick={() => setShowList(false)} className="text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {filtered.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelected(m); setShowList(false); }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selected?.id === m.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{CATEGORY_EMOJI[m.category] ?? '📍'}</span>
                        <span className="text-white text-xs font-medium truncate">{m.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_COLOR[m.status]}22`, color: STATUS_COLOR[m.status] }}>
                          {m.status.replace('_', ' ')}
                        </span>
                        <span className="text-slate-500 text-xs">{m.category}</span>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-8">No issues match filters</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map Canvas */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">Loading {filterCategory !== 'All' ? filterCategory : 'all'} issues…</p>
              </div>
            </div>
          ) : GOOGLE_MAPS_API_KEY && isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: filtered.length > 0 ? filtered[0].lat : 28.6139, lng: filtered.length > 0 ? filtered[0].lng : 77.2090 }}
              zoom={11}
              options={{ disableDefaultUI: true, styles: [ { elementType: 'geometry', stylers: [{ color: '#1e293b' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] } ] }}
            >
              <MarkerClustererF>
                {(clusterer) => (
                  <>
                    {filtered.map(m => {
                      const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="16" fill="${STATUS_COLOR[m.status] || '#94a3b8'}" stroke="white" stroke-width="2"/><text x="20" y="24" font-size="14" text-anchor="middle" fill="white">${CATEGORY_EMOJI[m.category] || '📍'}</text></svg>`;
                      return (
                        <MarkerF
                          key={m.id}
                          position={{ lat: m.lat, lng: m.lng }}
                          clusterer={clusterer}
                          onClick={() => setSelected(prev => prev?.id === m.id ? null : m)}
                          icon={{ url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new window.google.maps.Size(40, 40) }}
                        />
                      );
                    })}
                  </>
                )}
              </MarkerClustererF>
            </GoogleMap>
          ) : (
            <FallbackMap
              markers={filtered}
              onMarkerClick={m => setSelected(prev => prev?.id === m.id ? null : m)}
              selectedId={selected?.id ?? null}
            />
          )}

          {/* Legend */}
          <MapLegend />

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">No issues match your current filters</p>
                <p className="text-slate-600 text-sm">Try changing category or status</p>
              </div>
            </div>
          )}

          {/* Marker popup */}
          <AnimatePresence>
            {selected && (
              <MarkerPopup key={selected.id} marker={selected} onClose={() => setSelected(null)} />
            )}
          </AnimatePresence>

          {/* Floating issue count */}
          {!loading && filtered.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-full px-4 py-1.5 text-slate-300 text-xs font-medium">
                {filtered.length} issue{filtered.length !== 1 ? 's' : ''} on map
                {activeFilters > 0 && ` (${activeFilters} filter${activeFilters !== 1 ? 's' : ''} active)`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
