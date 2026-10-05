import { useMemo, useState } from "react";
import {
  FeatureControls,
  type FeatureToggles,
  toFeatureSettings,
} from "@/components/font/feature-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LayoutTable } from "@/lib/font/tables/layout";
import { cn } from "@/lib/utils";

const SIZE_STEPS = [12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120, 160];

const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
type Alignment = (typeof ALIGNMENTS)[number];

const DEFAULT_TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";

const CHARSETS: { id: string; label: string; lines: string[] }[] = [
  {
    id: "upper",
    label: "Uppercase",
    lines: ["ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  },
  {
    id: "lower",
    label: "Lowercase",
    lines: ["abcdefghijklmnopqrstuvwxyz"],
  },
  { id: "figures", label: "Figures", lines: ["0123456789"] },
  {
    id: "accents",
    label: "Accents",
    lines: [
      "ÁÀÂÄ ÃÅ Æ Ç ÈÉÊË ÌÍÎÏ Ñ ÒÓÔÖ ÕØ Œ ÙÚÛÜ Ý",
      "áàâä ãå æ ç èéêë ìíîï ñ òóôö õø œ ùúûü ý ß",
    ],
  },
  {
    id: "punctuation",
    label: "Punctuation",
    lines: [".,:;…!¡?¿·•()[]{}-–—/\\|@#$%&*+="],
  },
];

type SpecimenStyle = {
  fontSize: number;
  fontFeatureSettings: string;
  fontVariationSettings: string;
  tracking: number;
  lineHeight: number;
  alignment: Alignment;
  /** `null` keeps the theme foreground, so the specimen follows dark mode. */
  color: string | null;
};

function useSpecimenStyle() {
  const [style, setStyle] = useState<SpecimenStyle>({
    fontSize: 48,
    fontFeatureSettings: "normal",
    fontVariationSettings: "normal",
    tracking: 0,
    lineHeight: 1.2,
    alignment: "left",
    color: null,
  });

  const update = <K extends keyof SpecimenStyle>(
    key: K,
    value: SpecimenStyle[K],
  ) => setStyle((current) => ({ ...current, [key]: value }));

  return { style, update };
}

function SpecimenText({
  family,
  lines,
  style,
  className,
}: {
  family: string;
  lines: string[];
  style: SpecimenStyle;
  className?: string;
}) {
  return (
    <div
      className={cn("whitespace-pre-wrap break-words", className)}
      style={{
        fontFamily: `"${family}", ui-sans-serif, system-ui, sans-serif`,
        fontSize: `${style.fontSize}px`,
        letterSpacing: `${style.tracking}em`,
        lineHeight: style.lineHeight,
        textAlign: style.alignment,
        color: style.color ?? "hsl(var(--foreground))",
        fontKerning: "normal",
        fontFeatureSettings: style.fontFeatureSettings,
        fontVariationSettings: style.fontVariationSettings,
      }}
    >
      {lines.join("\n")}
    </div>
  );
}

export function Specimen({
  family,
  layout,
  variationSettings,
}: {
  family: string;
  layout: LayoutTable[];
  /** Set by the variable font controls, so axis changes reach the specimen. */
  variationSettings?: string;
}) {
  const { style, update } = useSpecimenStyle();
  const [text, setText] = useState(DEFAULT_TEXT);
  const [customSize, setCustomSize] = useState("48");
  const [enabledFeatures, setEnabledFeatures] = useState<FeatureToggles>({});

  const featureSettings = toFeatureSettings(enabledFeatures);
  const effectiveStyle: SpecimenStyle = {
    ...style,
    fontFeatureSettings: featureSettings,
    fontVariationSettings: variationSettings ?? "normal",
  };

  const scale = useMemo(
    () =>
      [...new Set([...SIZE_STEPS, Number(customSize) || 48])].sort(
        (a, b) => a - b,
      ),
    [customSize],
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          SPECIMEN
        </h2>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Type scale</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {scale.map((size) => (
            <div
              key={size}
              className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-b-0"
            >
              <span className="font-mono text-[10px] text-muted-foreground">
                {size}px
              </span>
              <SpecimenText
                family={family}
                lines={["Handgloves 0123"]}
                style={{ ...effectiveStyle, fontSize: size }}
              />
            </div>
          ))}

          <div className="flex items-end gap-3 pt-2">
            <Label htmlFor="specimen-size" className="w-32 shrink-0">
              Custom size
            </Label>
            <Input
              id="specimen-size"
              type="number"
              min={1}
              max={1000}
              value={customSize}
              onChange={(event) => setCustomSize(event.target.value)}
              className="w-24 font-mono"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Character sets</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={CHARSETS[0]?.id}>
            <TabsList className="flex-wrap">
              {CHARSETS.map((charset) => (
                <TabsTrigger key={charset.id} value={charset.id}>
                  {charset.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CHARSETS.map((charset) => (
              <TabsContent key={charset.id} value={charset.id} className="pt-4">
                <SpecimenText
                  family={family}
                  lines={charset.lines}
                  style={effectiveStyle}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom text</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="specimen-text">Write your own text</Label>
            <Input
              id="specimen-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write your own text..."
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setText(DEFAULT_TEXT)}
              >
                Reset
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setText("")}>
                Clear
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-4">
            <SpecimenText
              family={family}
              lines={[text || " "]}
              style={effectiveStyle}
            />
          </div>
        </CardContent>
      </Card>

      <FeatureControls
        layout={layout}
        enabled={enabledFeatures}
        onChange={setEnabledFeatures}
      />

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="control-size">Font size</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {style.fontSize}px
              </span>
            </div>
            <Slider
              id="control-size"
              min={8}
              max={200}
              step={1}
              value={[style.fontSize]}
              onValueChange={([value]) => update("fontSize", value ?? 48)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="control-tracking">Tracking</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {style.tracking.toFixed(3)}em
              </span>
            </div>
            <Slider
              id="control-tracking"
              min={-0.1}
              max={0.5}
              step={0.005}
              value={[style.tracking]}
              onValueChange={([value]) => update("tracking", value ?? 0)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="control-line-height">Line height</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {style.lineHeight.toFixed(2)}
              </span>
            </div>
            <Slider
              id="control-line-height"
              min={0.8}
              max={2.5}
              step={0.05}
              value={[style.lineHeight]}
              onValueChange={([value]) => update("lineHeight", value ?? 1.2)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="control-alignment">Alignment</Label>
            <Select
              value={style.alignment}
              onValueChange={(value) => update("alignment", value as Alignment)}
            >
              <SelectTrigger id="control-alignment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALIGNMENTS.map((alignment) => (
                  <SelectItem
                    key={alignment}
                    value={alignment}
                    className="capitalize"
                  >
                    {alignment}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="control-color">Colour</Label>
            <div className="flex items-center gap-3">
              <Input
                id="control-color"
                type="color"
                value={style.color ?? "#000000"}
                onChange={(event) => update("color", event.target.value)}
                className="h-9 w-16 p-1"
              />
              <span className="font-mono text-xs text-muted-foreground">
                {style.color ?? "Theme foreground"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => update("color", null)}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
