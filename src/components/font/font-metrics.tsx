import { MetricsDiagram } from "@/components/font/metrics-diagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { FontStructure } from "@/lib/font/font-source";
import {
  type FontMetrics,
  formatMetricValue,
  metricGroups,
  readFontMetrics,
} from "@/lib/font/metrics";

export function FontMetricsView({ structure }: { structure: FontStructure }) {
  const metrics: FontMetrics = readFontMetrics(
    structure.head,
    structure.hhea,
    structure.os2,
    structure.post,
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          FONT METRICS
        </h2>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsDiagram metrics={metrics} />
        </CardContent>
      </Card>

      {metricGroups(metrics).map((group) => (
        <Card key={group.label}>
          <CardHeader>
            <CardTitle>{group.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {group.rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="w-64 align-top text-muted-foreground">
                      {row.label}
                      {row.note ? (
                        <span className="mt-0.5 block text-xs opacity-70">
                          {row.note}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="w-32 font-mono text-sm tabular-nums">
                      {formatMetricValue(row.value)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.source}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {metrics.bbox ? (
        <Card>
          <CardHeader>
            <CardTitle>Font bounding box</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {(
                  [
                    ["xMin", metrics.bbox.xMin],
                    ["yMin", metrics.bbox.yMin],
                    ["xMax", metrics.bbox.xMax],
                    ["yMax", metrics.bbox.yMax],
                  ] as const
                ).map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell className="w-64 text-muted-foreground">
                      {label}
                    </TableCell>
                    <TableCell className="w-32 font-mono text-sm tabular-nums">
                      {formatMetricValue(value)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      head
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
