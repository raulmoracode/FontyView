import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { FontAnalysis } from "@/lib/font/types";
import {
  formatBytes,
  formatMetric,
  formatNumber,
  orUnavailable,
} from "@/lib/format";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl tabular-nums">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="w-56 align-top text-muted-foreground">
        {label}
      </TableCell>
      <TableCell className="font-mono text-sm break-words">{value}</TableCell>
    </TableRow>
  );
}

export function Overview({ analysis }: { analysis: FontAnalysis }) {
  const { metadata, statistics, file } = analysis;
  const scripts = analysis.scripts.filter((entry) => entry.characterCount > 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          FONT OVERVIEW
        </h2>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Glyphs" value={formatNumber(statistics.glyphCount)} />
        <StatCard
          label="Unicode"
          value={formatNumber(statistics.unicodePoints)}
          hint="Mapped code points"
        />
        <StatCard label="Tables" value={String(analysis.tables.length)} />
        <StatCard
          label="Format"
          value={file.label}
          hint={`${analysis.outlineFormat.toUpperCase()} outlines`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <Row
                label="Family Name"
                value={orUnavailable(metadata.familyName)}
              />
              <Row
                label="Subfamily Name"
                value={orUnavailable(metadata.subfamilyName)}
              />
              <Row
                label="Typographic Family"
                value={orUnavailable(metadata.typographicFamily)}
              />
              <Row
                label="Typographic Subfamily"
                value={orUnavailable(metadata.typographicSubfamily)}
              />
              <Row label="Full Name" value={orUnavailable(metadata.fullName)} />
              <Row
                label="PostScript Name"
                value={orUnavailable(metadata.postScriptName)}
              />
              <Row label="Version" value={orUnavailable(metadata.version)} />
              <Row label="File" value={file.fileName} />
              <Row label="File size" value={formatBytes(file.fileSize)} />
              {file.fontCount ? (
                <Row
                  label="Fonts in collection"
                  value={formatNumber(file.fontCount)}
                />
              ) : null}
              <Row
                label="Units per em"
                value={formatMetric(analysis.unitsPerEm)}
              />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Supported scripts</CardTitle>
          <Badge variant="secondary">{scripts.length}</Badge>
        </CardHeader>
        <CardContent>
          {scripts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recognised script coverage found in this font.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {scripts.map((entry) => (
                <li key={entry.script}>
                  <Badge variant="outline">
                    {entry.label}
                    <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                      {formatNumber(entry.characterCount)}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
