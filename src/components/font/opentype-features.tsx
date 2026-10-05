import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { LayoutTable } from "@/lib/font/tables/layout";
import {
  featureDescription,
  isRegisteredFeature,
  lookupTypeName,
} from "@/lib/font/tables/layout";

type FeatureRow = {
  tag: string;
  description: string;
  registered: boolean;
  table: "GSUB" | "GPOS";
  lookups: { index: number; name: string }[];
};

function collectFeatures(layout: LayoutTable[]): FeatureRow[] {
  const rows: FeatureRow[] = [];

  for (const table of layout) {
    for (const feature of table.features) {
      rows.push({
        tag: feature.tag,
        description: featureDescription(feature.tag),
        registered: isRegisteredFeature(feature.tag),
        table: table.kind,
        lookups: feature.lookupIndices.map((index) => ({
          index,
          name: lookupTypeName(table.lookups[index]?.lookupType ?? -1),
        })),
      });
    }
  }

  return rows.sort(
    (a, b) => a.tag.localeCompare(b.tag) || a.table.localeCompare(b.table),
  );
}

export function OpenTypeFeatures({ layout }: { layout: LayoutTable[] }) {
  if (layout.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            FEATURES
          </h2>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This font has no GSUB or GPOS table, so it implements no OpenType
              layout features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = collectFeatures(layout);
  const tags = new Set(rows.map((row) => row.tag));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          FEATURES
        </h2>
        <div className="flex items-center gap-2">
          {layout.map((table) => (
            <Badge key={table.kind} variant="secondary">
              {table.kind} · {table.features.length} features ·{" "}
              {table.lookups.length} lookups
            </Badge>
          ))}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Implemented features</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.table}-${row.tag}`}>
                  <TableCell className="w-24 font-mono text-sm">
                    <span className="flex items-center gap-1.5">
                      {row.tag}
                      {row.registered ? null : (
                        <Badge variant="outline" className="text-[10px]">
                          custom
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{row.description}</TableCell>
                  <TableCell className="w-20">
                    <Badge variant="outline">{row.table}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.lookups.length === 0
                      ? "No lookups"
                      : row.lookups
                          .map((lookup) => `#${lookup.index} ${lookup.name}`)
                          .join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {layout.map((table) => (
        <Card key={table.kind}>
          <CardHeader>
            <CardTitle>
              {table.kind} · v{table.majorVersion}.{table.minorVersion}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                Script systems
              </h3>
              {table.scripts.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="flex flex-col gap-1 font-mono text-xs">
                  {table.scripts.map((script) => (
                    <li key={script.tag} className="flex justify-between gap-4">
                      <span>{script.tag}</span>
                      <span className="text-muted-foreground">
                        {script.languageCount} language
                        {script.languageCount === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                Lookup types
              </h3>
              {table.lookups.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="flex flex-col gap-1 font-mono text-xs">
                  {table.lookups.map((lookup, index) => (
                    <li
                      key={`${index}-${lookup.lookupType}`}
                      className="flex justify-between gap-4"
                    >
                      <span>#{index}</span>
                      <span className="text-muted-foreground">
                        {lookupTypeName(lookup.lookupType)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        {tags.size} distinct feature tag{tags.size === 1 ? "" : "s"} found
        across {layout.length} layout table{layout.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
