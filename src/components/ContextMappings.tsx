import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ContextMapping, ContextType, BeatType } from "../types";
import { CONTEXT_LABELS, BEAT_PROFILES } from "../types";
import { Button } from "./ui/button";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface Props {
  onBack: () => void;
}

export function ContextMappings({ onBack }: Props) {
  const [mappings, setMappings] = useState<ContextMapping[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const [newPattern, setNewPattern] = useState("");
  const [newType, setNewType] = useState<"app" | "window">("app");
  const [newContext, setNewContext] = useState<ContextType>("Ambient");
  const [newBeat, setNewBeat] = useState<BeatType>("Alpha");
  const [newFreq, setNewFreq] = useState(10);

  const fetchMappings = async () => {
    try {
      const m = await invoke<ContextMapping[]>("get_mappings");
      setMappings(m);
    } catch (e) {
      console.error("Failed to fetch mappings:", e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMappings();
  }, []);

  const handleAdd = async () => {
    if (!newPattern.trim()) return;
    try {
      await invoke("save_mapping", {
        mapping: {
          pattern: newPattern.trim(),
          pattern_type: newType,
          context_type: newContext,
          beat_type: newBeat,
          beat_frequency: newFreq,
          enabled: true,
        },
      });
      setNewPattern("");
      setShowAdd(false);
      fetchMappings();
    } catch (e) {
      console.error("Failed to add mapping:", e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke("delete_mapping", { id });
      fetchMappings();
    } catch (e) {
      console.error("Failed to delete mapping:", e);
    }
  };

  const handleToggle = async (mapping: ContextMapping) => {
    try {
      await invoke("save_mapping", {
        mapping: { ...mapping, enabled: !mapping.enabled },
      });
      fetchMappings();
    } catch (e) {
      console.error("Failed to toggle mapping:", e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-surface/95 backdrop-blur-sm px-5 py-4 border-b border-surface-lighter flex items-center gap-3 z-10">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-surface-lighter text-text-secondary hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-text-primary">Context Mappings</h2>
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-text-secondary">
          Map apps and URLs to beat profiles. Context determines which binaural beat plays automatically.
        </p>

        {/* Add New Mapping Form */}
        {showAdd && (
          <div className="rounded-xl bg-surface-light border border-surface-lighter p-4 space-y-3">
            <h3 className="text-sm font-medium text-text-primary">New Mapping</h3>
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as "app" | "window")}
                className="flex-1 h-9 px-3 rounded-lg bg-surface border border-surface-lighter text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-trance-500"
              >
                <option value="app">App Name</option>
                <option value="window">Window Title</option>
              </select>
              <input
                type="text"
                placeholder={newType === "app" ? "e.g., VS Code" : "e.g., youtube.com"}
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                className="flex-[2] h-9 px-3 rounded-lg bg-surface border border-surface-lighter text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-trance-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={newContext}
                onChange={(e) => setNewContext(e.target.value as ContextType)}
                className="flex-1 h-9 px-3 rounded-lg bg-surface border border-surface-lighter text-sm text-text-primary"
              >
                {Object.entries(CONTEXT_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>{val.emoji} {val.label}</option>
                ))}
              </select>
              <select
                value={newBeat}
                onChange={(e) => {
                  const b = e.target.value as BeatType;
                  setNewBeat(b);
                  setNewFreq(BEAT_PROFILES[b].range.split("–")[0].trim().endsWith("Hz") 
                    ? parseFloat(BEAT_PROFILES[b].range.split("–")[0]) 
                    : parseFloat(BEAT_PROFILES[b].range.split("–")[0]));
                }}
                className="flex-1 h-9 px-3 rounded-lg bg-surface border border-surface-lighter text-sm text-text-primary"
              >
                {Object.entries(BEAT_PROFILES).map(([key, val]) => (
                  <option key={key} value={key}>{val.emoji} {val.name} ({val.range})</option>
                ))}
              </select>
              <input
                type="number"
                value={newFreq}
                onChange={(e) => setNewFreq(parseFloat(e.target.value))}
                min={1}
                max={40}
                step={0.5}
                className="w-20 h-9 px-2 rounded-lg bg-surface border border-surface-lighter text-sm text-text-primary text-center font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={handleAdd}>Save Mapping</Button>
            </div>
          </div>
        )}

        {/* Mappings List */}
        <div className="space-y-1">
          {mappings.length === 0 && (
            <p className="text-sm text-text-secondary text-center py-8">
              No custom mappings yet. Add one to override default behavior.
            </p>
          )}
          {mappings.map((m) => {
            const ctx = CONTEXT_LABELS[m.context_type as ContextType] ?? CONTEXT_LABELS.Ambient;
            const beat = BEAT_PROFILES[m.beat_type as BeatType] ?? BEAT_PROFILES.Alpha;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  m.enabled ? "bg-surface-light/50 hover:bg-surface-light" : "opacity-40"
                }`}
              >
                <button
                  onClick={() => handleToggle(m)}
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    m.enabled ? "bg-trance-500" : "bg-surface-lighter"
                  }`}
                  title={m.enabled ? "Enabled" : "Disabled"}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-primary truncate">{m.pattern}</span>
                    <span className="text-[10px] text-text-secondary uppercase">{m.pattern_type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-text-secondary">
                      {ctx.emoji} {ctx.label} → {beat.emoji} {beat.name} {m.beat_frequency} Hz
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => m.id && handleDelete(m.id)}
                  className="p-1 rounded text-text-secondary hover:text-red-400 hover:bg-red-600/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
