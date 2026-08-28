import { useEffect, useRef, useState } from "react";
import Info from "lucide-react/dist/esm/icons/info";
import ListOrdered from "lucide-react/dist/esm/icons/list-ordered";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  fetchCompetitionStandings,
  getCurrentSeasonStartYear,
  type FootballCompetitionCode,
  type FootballStandingRow,
  type FootballStandings,
  type FootballStandingsFetchResult,
} from "@/services";
import { CompetitionTabs, getCompetitionLabel } from "./competition-tabs";
import { getStandingsZone, type StandingsZone } from "../logic/standings-zones";
import { SettingsLink } from "./settings-link";
import { SURFACE } from "./surfaces";

type StandingsErrorReason = Extract<
  FootballStandingsFetchResult,
  { ok: false }
>["reason"];

interface StandingsPanelProps {
  open: boolean;
  /** The header button that opens the panel, so its own click is not treated as an outside click. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  competition: FootballCompetitionCode;
  favoriteTeamIds: number[];
  onOpenChange: (open: boolean) => void;
  onCompetitionChange: (competition: FootballCompetitionCode) => void;
}

const ERROR_MESSAGES: Record<
  StandingsErrorReason,
  { title: string; description: string }
> = {
  "no-key": {
    title: "Falta la API key",
    description:
      "Configura tu clave de football-data.org en los ajustes de la extensión.",
  },
  "not-in-plan": {
    title: "Tu plan no incluye la clasificación",
    description:
      "La cuenta gratuita de football-data.org no da acceso a esta tabla.",
  },
  "invalid-key": {
    title: "La API key no es válida",
    description: "Comprueba la clave en los ajustes.",
  },
  "quota-exceeded": {
    title: "Límite de peticiones alcanzado",
    description: "Prueba de nuevo dentro de un minuto.",
  },
  network: {
    title: "No se pudo conectar con football-data.org",
    description: "Revisa tu conexión y vuelve a intentarlo.",
  },
};

/**
 * Zones are marked with a colour bar.
 *
 * The official UEFA emblems were tried and dropped: the API serves a lockup
 * (symbol over a wordmark), and once cropped to the symbol and set on the white
 * chip it needs to be readable on a dark panel, it reads as a sticker rather
 * than a table marker. A bar is legible in any theme at any row height.
 */
const ZONES: Record<StandingsZone, { label: string; bar: string }> = {
  champions: { label: "Champions", bar: "bg-mv-blue" },
  europa: { label: "Europa League", bar: "bg-mv-orange" },
  "round-of-16": { label: "Octavos directos", bar: "bg-mv-blue" },
  playoff: {
    label: "Playoff",
    bar: "bg-[color:color-mix(in_srgb,var(--mv-blue)45%,var(--card))]",
  },
  relegation: { label: "Descenso", bar: "bg-mv-danger" },
};

function ZoneMarker({ zone }: { zone: StandingsZone }) {
  return (
    <span
      className={cn("block h-4 w-[3px] shrink-0 rounded-full", ZONES[zone].bar)}
      title={ZONES[zone].label}
      aria-hidden="true"
    />
  );
}
/**
 * Column widths and padding live here so the head and the body can never drift
 * apart. The outer columns carry extra padding: on a tinted favourite row the
 * numbers would otherwise sit flush against the edge of the fill.
 */
const EDGE_START = "pl-2 pr-0.5 text-right";
const EDGE_END = "pl-0.5 pr-2 text-right";
const INNER = "px-0.5 text-right";
const TEAM_CELL = "pl-1.5 text-left";

const COLUMNS = [
  {
    key: "zone",
    label: "",
    title: "Zona de clasificación",
    width: "w-4",
    cell: EDGE_START,
  },
  { key: "position", label: "#", title: "Posición", width: "w-7", cell: INNER },
  { key: "crest", label: "", title: "Escudo", width: "w-7", cell: "" },
  { key: "team", label: "Equipo", title: "Equipo", width: "", cell: TEAM_CELL },
  {
    key: "played",
    label: "PJ",
    title: "Partidos jugados",
    width: "w-7",
    cell: INNER,
  },
  { key: "won", label: "G", title: "Ganados", width: "w-5", cell: INNER },
  { key: "draw", label: "E", title: "Empatados", width: "w-5", cell: INNER },
  { key: "lost", label: "P", title: "Perdidos", width: "w-5", cell: INNER },
  {
    key: "for",
    label: "GF",
    title: "Goles a favor",
    width: "w-7",
    cell: INNER,
  },
  {
    key: "against",
    label: "GC",
    title: "Goles en contra",
    width: "w-7",
    cell: INNER,
  },
  {
    key: "difference",
    label: "DG",
    title: "Diferencia de goles",
    width: "w-8",
    cell: INNER,
  },
  {
    key: "points",
    label: "Pts",
    title: "Puntos",
    width: "w-10",
    cell: EDGE_END,
  },
] as const;

function StandingsHead() {
  return (
    <thead>
      <tr className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {COLUMNS.map((column) => (
          <th
            key={column.key}
            scope="col"
            className={cn("pb-1.5 font-black", column.cell)}
          >
            {column.label === "" ? (
              <span className="sr-only">{column.title}</span>
            ) : column.label === column.title ? (
              column.label
            ) : (
              <abbr title={column.title} className="no-underline">
                {column.label}
              </abbr>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function StandingsRow({
  row,
  rank,
  isFavorite,
  zone,
}: {
  row: FootballStandingRow;
  /**
   * Place in the table. The API hands out tied positions (two 19s and no 20),
   * which no football table shows and which made the relegation rule compare
   * against a number that is not an index.
   */
  rank: number;
  isFavorite: boolean;
  zone: StandingsZone | null;
}) {
  const [crestFailed, setCrestFailed] = useState(false);
  const goalDifference =
    row.goalDifference > 0
      ? `+${row.goalDifference}`
      : String(row.goalDifference);
  const numberCell = cn(INNER, "py-1.5 tabular-nums text-muted-foreground");

  return (
    <tr
      className={cn(
        "text-[11px] leading-none",
        isFavorite ? SURFACE.favorite : "hover:bg-muted",
      )}
    >
      <td className={cn(EDGE_START, "py-1.5")}>
        {zone !== null && <ZoneMarker zone={zone} />}
      </td>
      <td
        className={cn(
          INNER,
          "py-1.5 font-black tabular-nums text-muted-foreground",
        )}
      >
        {rank}
      </td>
      <td className="py-1.5">
        <span className="flex h-5 w-5 items-center justify-center">
          {crestFailed ? (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[7px] font-black text-muted-foreground"
              aria-hidden="true"
            >
              {row.team.tla}
            </span>
          ) : (
            <img
              src={row.team.crest}
              alt=""
              className="h-5 w-5 object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setCrestFailed(true)}
            />
          )}
        </span>
      </td>
      {/* The club names the row, so a screen reader reads "Real Madrid CF, PJ, 2". */}
      <th
        scope="row"
        className={cn(TEAM_CELL, "truncate py-1.5 font-bold text-foreground")}
        title={row.team.name}
      >
        {row.team.name}
        {zone !== null && (
          <span className="sr-only"> ({ZONES[zone].label})</span>
        )}
      </th>
      <td className={numberCell}>{row.playedGames}</td>
      <td className={numberCell}>{row.won}</td>
      <td className={numberCell}>{row.draw}</td>
      <td className={numberCell}>{row.lost}</td>
      <td className={numberCell}>{row.goalsFor}</td>
      <td className={numberCell}>{row.goalsAgainst}</td>
      <td className={numberCell}>{goalDifference}</td>
      <td
        className={cn(
          EDGE_END,
          "py-1.5 text-[12.5px] font-black tabular-nums text-foreground",
        )}
      >
        {row.points}
      </td>
    </tr>
  );
}

/** Only lists the zones the current table actually has, so it never invents one. */
function ZoneLegend({ zones }: { zones: StandingsZone[] }) {
  if (zones.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-2 pt-3 text-[10px] text-muted-foreground">
      {zones.map((zone) => (
        <span key={zone} className="flex items-center gap-1.5">
          <ZoneMarker zone={zone} />
          {ZONES[zone].label}
        </span>
      ))}
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <div className="grid gap-1" aria-label="Cargando clasificación">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="flex items-center gap-1.5 px-2 py-1.5">
          <Skeleton className="h-3 w-5 shrink-0 rounded-sm" />
          <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          <Skeleton className="h-3 flex-1 rounded-sm" />
          <Skeleton className="h-3 w-24 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-7 shrink-0 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function formatSeasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function StandingsPanel({
  open,
  triggerRef,
  competition,
  favoriteTeamIds,
  onOpenChange,
  onCompetitionChange,
}: StandingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [standings, setStandings] = useState<FootballStandings | null>(null);
  const [error, setError] = useState<StandingsErrorReason | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Switching competition must not leave the previous table on screen while the
  // new one loads: 20 rows would be replaced by 36 under a scroll position that
  // no longer means anything. Clearing first shows the skeleton instead.
  useEffect(() => {
    setStandings(null);
    setError(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [competition]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchCompetitionStandings(competition)
      .then((result) => {
        if (cancelled) return;

        if (result.ok) {
          setStandings(result.standings);
          setError(null);
        } else {
          setStandings(null);
          setError(result.reason);
        }
      })
      .catch((requestError) => {
        if (cancelled) return;
        logger.error("Standings panel: failed to load standings", requestError);
        setStandings(null);
        setError("network");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, competition]);

  const errorContent = error === null ? null : ERROR_MESSAGES[error];
  const visibleZones =
    standings === null
      ? []
      : Array.from(
          new Set(
            standings.rows
              .map((_row, index) =>
                getStandingsZone(competition, index + 1, standings.rows.length),
              )
              .filter((zone): zone is StandingsZone => zone !== null),
          ),
        );
  const currentSeasonStartYear = getCurrentSeasonStartYear();
  const seasonStartYear = standings?.seasonStartYear ?? null;
  const isPreviousSeason =
    seasonStartYear !== null && seasonStartYear < currentSeasonStartYear;

  return (
    // modal={false} keeps the forum behind the panel scrollable and clickable.
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        hideOverlay
        aria-describedby={undefined}
        // Clicking the page closes the panel, except on the button that opened it:
        // otherwise the outside-click close and the button's toggle cancel out and
        // the button can never close what it opened.
        onPointerDownOutside={(event) => {
          const target = event.detail.originalEvent.target;
          if (target instanceof Node && triggerRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
        // The Shadow DOM host is pointer-events:none so it never blocks the page.
        // Radix only re-enables pointers on modal content, so a non-modal panel
        // has to opt back in or nothing inside it can be clicked.
        className="pointer-events-auto w-full gap-0 border-l border-border bg-card p-0 sm:max-w-[520px]"
      >
        {/* Same two-band masthead as the calendar card: title on its own row, controls below. */}
        {/* One row. pr-10 keeps the tabs clear of the sheet's absolutely
				    positioned close button, which sits 16px in from the right edge. */}
        <SheetHeader className="gap-0 border-b border-border p-0">
          <div className="flex min-w-0 items-center gap-2 py-2.5 pl-3 pr-10">
            <ListOrdered
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <SheetTitle className="shrink-0 text-[13px] font-black uppercase leading-none tracking-[0.14em] text-foreground">
              Clasificación
            </SheetTitle>
            <button
              type="button"
              onClick={() => setInfoOpen((open) => !open)}
              aria-expanded={infoOpen}
              aria-label="Sobre estos datos"
              title="Sobre estos datos"
              className={cn(
                "flex h-4 w-4 items-center justify-center self-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                infoOpen && "text-primary hover:text-primary",
              )}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {seasonStartYear !== null && (
              <span
                className={cn(
                  "text-[11px] font-bold tracking-normal tabular-nums",
                  isPreviousSeason ? "text-primary" : "text-muted-foreground",
                )}
              >
                {formatSeasonLabel(seasonStartYear)}
              </span>
            )}
            {loading && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-primary"
                aria-hidden="true"
              />
            )}
            <CompetitionTabs
              className="ml-auto"
              competition={competition}
              onChange={onCompetitionChange}
            />
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
          {infoOpen && (
            <div
              className={cn(
                "mb-3 grid gap-1.5 rounded-lg px-3 py-2.5 text-[11px] leading-snug",
                SURFACE.panel,
              )}
            >
              <p className="text-muted-foreground">
                Los datos vienen de{" "}
                <a
                  href="https://www.football-data.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                >
                  football-data.org
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>{" "}
                y se refrescan como mucho una vez por hora.
              </p>
              <p className="text-muted-foreground">
                La tabla es la de la temporada que la API da por vigente. Si una
                competición todavía no ha arrancado, verás la última que sí
                tiene partidos jugados.
              </p>
            </div>
          )}
          {loading && standings === null ? (
            <StandingsSkeleton />
          ) : errorContent ? (
            <div className={cn("rounded-lg px-4 py-3", SURFACE.panel)}>
              <p className="text-sm font-semibold text-foreground">
                {errorContent.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {errorContent.description}
              </p>
              {(error === "no-key" || error === "invalid-key") && (
                <SettingsLink className="mt-2 text-xs" />
              )}
            </div>
          ) : standings === null || standings.rows.length === 0 ? (
            <div
              className={cn("rounded-lg px-4 py-3 text-center", SURFACE.panel)}
            >
              <p className="text-sm font-semibold text-foreground">
                Todavía no hay clasificación
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Aparecerá cuando la competición tenga partidos jugados.
              </p>
            </div>
          ) : (
            <>
              <table className="w-full table-fixed border-separate border-spacing-0">
                <caption className="sr-only">
                  Clasificación de {getCompetitionLabel(competition)}
                  {seasonStartYear === null
                    ? ""
                    : `, temporada ${formatSeasonLabel(seasonStartYear)}`}
                </caption>
                <colgroup>
                  {COLUMNS.map((column) => (
                    <col key={column.key} className={column.width} />
                  ))}
                </colgroup>
                <StandingsHead />
                <tbody>
                  {standings.rows.map((row, index) => (
                    <StandingsRow
                      key={row.team.id}
                      row={row}
                      rank={index + 1}
                      isFavorite={favoriteTeamIds.includes(row.team.id)}
                      zone={getStandingsZone(
                        competition,
                        index + 1,
                        standings.rows.length,
                      )}
                    />
                  ))}
                </tbody>
              </table>
              <ZoneLegend zones={visibleZones} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
