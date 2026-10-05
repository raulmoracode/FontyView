import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type {
  NamedInstance,
  VariationAxis,
  VariationData,
} from "@/lib/font/tables/variations";
import {
  formatAxisValue,
  toVariationSettings,
} from "@/lib/font/tables/variations";
import { formatNumber } from "@/lib/format";

function axisLabel(axis: VariationAxis): string {
  // Give the well-known axes a readable unit without hardcoding a list of
  // possible tags: anything else is shown with its raw tag.
  switch (axis.tag) {
    case "wght":
      return "Weight";
    case "wdth":
      return "Width";
    case "slnt":
      return "Slant";
    case "ital":
      return "Italic";
    case "opsz":
      return "Optical size";
    case "GRAD":
      return "Grade";
    case "CASL":
      return "Casual";
    case "MONO":
      return "Monospace";
    case "CRSV":
      return "Cursive";
    case "SOFT":
      return "Softness";
    case "WONK":
      return "Wonky";
    case "YOPQ":
      return "Thick stroke";
    case "XTRA":
      return "Counter width";
    default:
      return axis.name || axis.tag;
  }
}

function axisUnit(axis: VariationAxis): string {
  if (axis.tag === "wght" || axis.tag === "opsz") return "pt";
  if (axis.tag === "slnt" || axis.tag === "ital") return "°";
  return "";
}

export function VariableFontControls({
  variation,
  family,
  values,
  onChange,
}: {
  variation: VariationData;
  family: string;
  values: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const settings = useMemo(
    () => toVariationSettings(variation.axes, values),
    [variation.axes, values],
  );

  if (!variation.isVariable) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            VARIABLE
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font is not variable. It has no{" "}
              <span className="font-mono">fvar</span> table, so it offers a
              single fixed set of outlines.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const setAxis = (tag: string, value: number) =>
    onChange({ ...values, [tag]: value });

  const applyInstance = (instance: NamedInstance) =>
    onChange({ ...values, ...instance.coordinates });

  const reset = () =>
    onChange(
      Object.fromEntries(
        variation.axes.map((axis) => [axis.tag, axis.default]),
      ),
    );

  const isDefault = variation.axes.every(
    (axis) => (values[axis.tag] ?? axis.default) === axis.default,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          VARIABLE
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {formatNumber(variation.axes.length)}{" "}
            {variation.axes.length === 1 ? "axis" : "axes"}
          </Badge>
          {variation.hasAvar ? <Badge variant="outline">avar</Badge> : null}
          {variation.hasGvar ? <Badge variant="outline">gvar</Badge> : null}
          {variation.hasHvar ? <Badge variant="outline">HVAR</Badge> : null}
          {variation.hasStat ? <Badge variant="outline">STAT</Badge> : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p
            className="text-3xl leading-tight"
            style={{
              fontFamily: `"${family}", ui-sans-serif, system-ui, sans-serif`,
              fontVariationSettings: settings,
            }}
          >
            Handgloves 0123
          </p>
          <p
            className="text-sm text-muted-foreground"
            style={{
              fontFamily: `"${family}", ui-sans-serif, system-ui, sans-serif`,
              fontVariationSettings: settings,
            }}
          >
            The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            font-variation-settings: {settings}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Axes</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={isDefault}
            onClick={reset}
          >
            <RotateCcw aria-hidden="true" />
            Reset to defaults
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {variation.axes.map((axis) => {
            const value = values[axis.tag] ?? axis.default;
            const unit = axisUnit(axis);
            return (
              <div key={axis.tag} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label htmlFor={`axis-${axis.tag}`}>
                    {axisLabel(axis)}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {axis.tag}
                    </span>
                  </Label>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatAxisValue(axis, value)}
                    {unit ? ` ${unit}` : ""}
                  </span>
                </div>
                <Slider
                  id={`axis-${axis.tag}`}
                  min={axis.minimum}
                  max={axis.maximum}
                  step={1 / 2 ** Math.max(1, axis.precision)}
                  value={[value]}
                  onValueChange={([next]) =>
                    setAxis(axis.tag, next ?? axis.default)
                  }
                />
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>
                    {formatAxisValue(axis, axis.minimum)}
                    {unit ? ` ${unit}` : ""}
                  </span>
                  <span>
                    default {formatAxisValue(axis, axis.default)}
                    {unit ? ` ${unit}` : ""}
                  </span>
                  <span>
                    {formatAxisValue(axis, axis.maximum)}
                    {unit ? ` ${unit}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {variation.instances.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Named instances</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {variation.instances.map((instance, index) => (
                <li key={`${instance.name}-${index}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyInstance(instance)}
                    style={{
                      fontFamily: `"${family}", ui-sans-serif, system-ui, sans-serif`,
                      fontVariationSettings: toVariationSettings(
                        variation.axes,
                        instance.coordinates,
                      ),
                    }}
                  >
                    {instance.name || `Instance ${index + 1}`}
                  </Button>
                </li>
              ))}
            </ul>

            <Table className="mt-6">
              <TableBody>
                {variation.instances.map((instance, index) => (
                  <TableRow key={`${instance.name}-row-${index}`}>
                    <TableCell className="w-48">
                      {instance.name || "—"}
                    </TableCell>
                    {variation.axes.map((axis) => (
                      <TableCell
                        key={axis.tag}
                        className="font-mono text-sm tabular-nums"
                      >
                        {formatAxisValue(
                          axis,
                          instance.coordinates[axis.tag] ?? axis.default,
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font declares no named instances, so the axes can only be set
              by value.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
