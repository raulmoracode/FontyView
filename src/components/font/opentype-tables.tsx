import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { FontAnalysis } from "@/lib/font/types";
import { formatBytes } from "@/lib/format";

/** Tables the OpenType specification defines, grouped for orientation. */
const GROUPS: { label: string; tags: string[] }[] = [
  {
    label: "Font structure",
    tags: [
      "head",
      "hhea",
      "maxp",
      "OS/2",
      "hmtx",
      "vhea",
      "vmtx",
      "post",
      "name",
    ],
  },
  { label: "Character mapping", tags: ["cmap"] },
  { label: "Outlines", tags: ["glyf", "loca", "CFF ", "CFF2", "VORG"] },
  { label: "Layout", tags: ["GSUB", "GPOS", "GDEF", "BASE", "kern", "MATH"] },
  {
    label: "Variable fonts",
    tags: ["fvar", "avar", "gvar", "HVAR", "MVAR", "cvar", "STAT"],
  },
  { label: "Color", tags: ["COLR", "CPAL", "CBDT", "CBLC", "sbix", "SVG "] },
  {
    label: "Hinting and raster",
    tags: ["fpgm", "prep", "cvt ", "gasp", "hdmx", "VDMX"],
  },
];

function groupFor(tag: string): string {
  for (const group of GROUPS) {
    if (group.tags.includes(tag)) return group.label;
  }
  return "Font-specific";
}

export function OpenTypeTables({ analysis }: { analysis: FontAnalysis }) {
  const total = analysis.tables.reduce((sum, table) => sum + table.length, 0);
  const byGroup = new Map<string, typeof analysis.tables>();
  for (const table of analysis.tables) {
    const key = groupFor(table.tag);
    const list = byGroup.get(key) ?? [];
    list.push(table);
    byGroup.set(key, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          OPENTYPE TABLES
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{analysis.tables.length} tables</Badge>
          <span>{formatBytes(total)}</span>
        </div>
      </header>

      {analysis.tables.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font exposes no readable tables.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {[...GROUPS.map((group) => group.label), "Font-specific"]
        .filter((label, index, all) => all.indexOf(label) === index)
        .map((label) => {
          const tables = byGroup.get(label);
          if (!tables || tables.length === 0) return null;
          return (
            <Card key={label}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {tables.map((table) => (
                      <TableRow key={table.tag}>
                        <TableCell className="w-28 font-mono text-sm">
                          {table.tag}
                        </TableCell>
                        <TableCell className="text-sm">
                          {table.description}
                        </TableCell>
                        <TableCell className="w-28 text-right font-mono text-sm tabular-nums text-muted-foreground">
                          {formatBytes(table.length)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
