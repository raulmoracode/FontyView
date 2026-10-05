import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LayoutTable } from "@/lib/font/tables/layout";
import { featureDescription } from "@/lib/font/tables/layout";

export type FeatureToggles = Record<string, boolean>;

/**
 * Builds the `font-feature-settings` value from the enabled features.
 *
 * A quoted four-character tag is the only way to express a feature reliably in
 * CSS, and unlisted features fall back to whatever the font defaults to.
 */
export function toFeatureSettings(enabled: FeatureToggles): string {
  const tags = Object.entries(enabled)
    .filter(([, on]) => on)
    .map(([tag]) => tag)
    .sort();
  if (tags.length === 0) return "normal";
  // A quoted four-character tag is the only reliable way to express a feature
  // in CSS, and the order is irrelevant to the shaper.
  return tags.map((tag) => `"${tag}"`).join(", ");
}

export function detectedFeatureTags(layout: LayoutTable[]): string[] {
  const tags = new Set<string>();
  for (const table of layout) {
    for (const feature of table.features) tags.add(feature.tag);
  }
  return [...tags].sort();
}

export function FeatureControls({
  layout,
  enabled,
  onChange,
}: {
  layout: LayoutTable[];
  enabled: FeatureToggles;
  onChange: (next: FeatureToggles) => void;
}) {
  const tags = useMemo(() => detectedFeatureTags(layout), [layout]);

  if (tags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OpenType features</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This font has no GSUB or GPOS table, so there are no features to
            switch on or off.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenType features</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">
          {tags.length} feature{tags.length === 1 ? "" : "s"} detected. Switches
          start off so each one can be seen working.
        </p>
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {tags.map((tag) => {
            const id = `feature-${tag}`;
            return (
              <li key={tag} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                  <Label htmlFor={id} className="font-mono text-sm">
                    {tag}
                  </Label>
                  <span className="truncate text-xs text-muted-foreground">
                    {featureDescription(tag)}
                  </span>
                </div>
                <Switch
                  id={id}
                  checked={enabled[tag] ?? false}
                  onCheckedChange={(on) => onChange({ ...enabled, [tag]: on })}
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
