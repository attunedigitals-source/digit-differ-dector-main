import { DERIV_SYMBOLS } from "@/lib/deriv-symbols";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Filter } from "lucide-react";

interface FiltersProps {
  symbolFilter: string;
  onSymbolFilter: (v: string) => void;
  confidenceFilter: number;
  onConfidenceFilter: (v: number) => void;
}

export function Filters({ symbolFilter, onSymbolFilter, confidenceFilter, onConfidenceFilter }: FiltersProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="w-4 h-4 text-primary" />
        Filters
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Symbol</label>
          <Select value={symbolFilter} onValueChange={onSymbolFilter}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue placeholder="All Symbols" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Symbols</SelectItem>
              {DERIV_SYMBOLS.map((s) => (
                <SelectItem key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Min Confidence: <span className="font-mono text-foreground">{confidenceFilter}%</span>
          </label>
          <Slider
            value={[confidenceFilter]}
            onValueChange={([v]) => onConfidenceFilter(v)}
            min={75}
            max={100}
            step={1}
            className="py-2"
          />
        </div>
      </div>
    </div>
  );
}
