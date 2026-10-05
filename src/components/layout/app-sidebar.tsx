import { cn } from "@/lib/utils";

export type SectionId =
  | "overview"
  | "information"
  | "specimen"
  | "glyphs"
  | "character-map"
  | "unicode"
  | "scripts"
  | "metrics"
  | "glyph-metrics"
  | "tables"
  | "features"
  | "kerning"
  | "ligatures"
  | "variable"
  | "compare"
  | "export";

export type NavItem = {
  id: SectionId;
  label: string;
  /** Only shown when the loaded font actually has the data for it. */
  available: (context: SectionAvailability) => boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export type SectionAvailability = {
  isVariable: boolean;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "General",
    items: [
      { id: "overview", label: "Overview", available: () => true },
      { id: "information", label: "Font Information", available: () => true },
      { id: "specimen", label: "Specimen", available: () => true },
    ],
  },
  {
    label: "Characters",
    items: [
      { id: "glyphs", label: "Glyphs", available: () => true },
      { id: "character-map", label: "Character Map", available: () => true },
      { id: "unicode", label: "Unicode Coverage", available: () => true },
      { id: "scripts", label: "Scripts", available: () => true },
    ],
  },
  {
    label: "Metrics",
    items: [
      { id: "metrics", label: "Font Metrics", available: () => true },
      { id: "glyph-metrics", label: "Glyph Metrics", available: () => true },
    ],
  },
  {
    label: "OpenType",
    items: [
      { id: "tables", label: "OpenType Tables", available: () => true },
      { id: "features", label: "Features", available: () => true },
      { id: "kerning", label: "Kerning", available: () => true },
      { id: "ligatures", label: "Ligatures", available: () => true },
    ],
  },
  {
    label: "Variable",
    items: [
      {
        id: "variable",
        label: "Variable",
        available: (context) => context.isVariable,
      },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "compare", label: "Compare", available: () => true },
      { id: "export", label: "Export Report", available: () => true },
    ],
  },
];

export function AppSidebar({
  active,
  onSelect,
  availability,
  className,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  availability: SectionAvailability;
  className?: string;
}) {
  return (
    <nav
      aria-label="Analysis sections"
      className={cn("flex flex-col gap-6", className)}
    >
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) =>
          item.available(availability),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="flex flex-col gap-0.5">
            <h2 className="px-3 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              {group.label}
            </h2>
            {items.map((item) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
