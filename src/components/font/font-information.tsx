import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { NameRecord } from "@/lib/font/tables/core";
import { orUnavailable } from "@/lib/format";

/** Labels shown in the Naming section, in the order a type designer expects. */
const NAMING_FIELDS: { id: number; label: string }[] = [
  { id: 0, label: "Copyright" },
  { id: 1, label: "Family Name" },
  { id: 2, label: "Subfamily Name" },
  { id: 3, label: "Unique Identifier" },
  { id: 4, label: "Full Name" },
  { id: 5, label: "Version" },
  { id: 6, label: "PostScript Name" },
  { id: 7, label: "Trademark" },
  { id: 8, label: "Manufacturer" },
  { id: 9, label: "Designer" },
  { id: 10, label: "Description" },
  { id: 11, label: "Manufacturer URL" },
  { id: 12, label: "Designer URL" },
  { id: 13, label: "License" },
  { id: 14, label: "License URL" },
  { id: 16, label: "Typographic Family" },
  { id: 17, label: "Typographic Subfamily" },
  { id: 18, label: "Compatible Full Name" },
  { id: 19, label: "Sample Text" },
];

const URL_FIELDS = new Set([11, 12, 14]);

function isLink(id: number, value: string): boolean {
  return URL_FIELDS.has(id) && /^https?:\/\//i.test(value);
}

function NamingRow({
  id,
  label,
  records,
}: {
  id: number;
  label: string;
  records: Map<number, NameRecord[]>;
}) {
  const entries = records.get(id) ?? [];
  const value = entries[0]?.value ?? null;
  const extra = entries.length - 1;

  return (
    <TableRow>
      <TableCell className="w-56 align-top text-muted-foreground">
        {label}
        <span className="ml-1.5 font-mono text-xs opacity-60">{id}</span>
      </TableCell>
      <TableCell className="align-top break-words">
        {isLink(id, value ?? "") ? (
          <a
            href={value ?? undefined}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-start gap-1 font-mono text-sm underline underline-offset-4 hover:no-underline"
          >
            <span className="break-all">{value}</span>
            <ExternalLink
              aria-hidden="true"
              className="mt-0.5 size-3 shrink-0"
            />
          </a>
        ) : (
          <span className="font-mono text-sm break-words">
            {orUnavailable(value)}
          </span>
        )}
        {extra > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {entries.slice(1).map((entry) => (
              <Badge
                key={`${entry.platform}-${entry.language}-${entry.value}`}
                variant="secondary"
              >
                {entry.language}
              </Badge>
            ))}
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function FontInformation({ records }: { records: NameRecord[] }) {
  const byId = new Map<number, NameRecord[]>();
  for (const record of records) {
    const list = byId.get(record.nameId) ?? [];
    list.push(record);
    byId.set(record.nameId, list);
  }

  // Name IDs without a label above still deserve to be inspectable.
  const extraIds = [...byId.keys()]
    .filter((id) => !NAMING_FIELDS.some((field) => field.id === id))
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          FONT INFORMATION
        </h2>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Naming</CardTitle>
          <Badge variant="secondary">{records.length} records</Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {NAMING_FIELDS.map((field) => (
                <NamingRow
                  key={field.id}
                  id={field.id}
                  label={field.label}
                  records={byId}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {extraIds.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Other name records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {extraIds.map((id) => {
                  const entries = byId.get(id) ?? [];
                  return entries.map((entry) => (
                    <TableRow key={`${id}-${entry.platform}-${entry.language}`}>
                      <TableCell className="w-56 align-top text-muted-foreground">
                        {entry.label}
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="font-mono text-sm break-words">
                          {entry.value}
                        </span>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {entry.platform} · {entry.language}
                        </div>
                      </TableCell>
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
