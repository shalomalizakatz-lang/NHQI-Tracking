import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { MEASURES_2025, CYCLE } from "./nhqi/measures/2025.js";
import { scoreFacility } from "./nhqi/scorer.js";
import { official2023Benchmark, liveCmsBenchmark } from "./nhqi/benchmarks.js";
import { getLiveCutpoints, cmsAutofillMeta } from "./cmsAutofill.js";
import { getAllOpportunities, getMissingEvidence } from "./opportunities.js";
import { colors } from "./designTokens.js";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: colors.ink },
  headerBar: { height: 4, backgroundColor: colors.accent, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: colors.inkSecondary, marginBottom: 12 },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  scoreCard: { flex: 1, border: `1px solid ${colors.border}`, borderRadius: 4, padding: 8 },
  scoreLabel: { fontSize: 7, color: colors.inkSecondary, marginBottom: 3, textTransform: "uppercase" },
  scoreVal: { fontSize: 16, fontWeight: 700 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginTop: 10, marginBottom: 4, color: colors.accentText },
  table: { border: `1px solid ${colors.border}`, borderRadius: 3 },
  tHeadRow: { flexDirection: "row", backgroundColor: colors.neutralBg, borderBottom: `1px solid ${colors.border}` },
  tRow: { flexDirection: "row", borderBottom: `1px solid ${colors.borderSubtle}` },
  th: { padding: 2.5, fontSize: 6.5, fontWeight: 700, color: colors.inkSecondary },
  td: { padding: 2.5, fontSize: 7, color: colors.ink },
  colMeasure: { width: "25%" },
  colPeriod: { width: "18%", fontSize: 6.2 },
  colValYr: { width: "9%", textAlign: "right" },
  colQYr: { width: "7%", textAlign: "center" },
  colPtsYr: { width: "8%", textAlign: "right" },
  colValCur: { width: "9%", textAlign: "right" },
  colQ: { width: "7%", textAlign: "center" },
  colPts: { width: "8%", textAlign: "right" },
  priorityRow: { flexDirection: "row", justifyContent: "space-between", border: `1px solid ${colors.border}`, borderRadius: 3, padding: 4, marginBottom: 2.5 },
  evidenceRow: { border: `1px solid ${colors.amberBorder}`, backgroundColor: colors.amberBg, borderRadius: 3, padding: 4, marginBottom: 2.5 },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7, color: colors.inkMuted },
});

// react-pdf's default Helvetica is one of the 14 standard PDF fonts, which
// only cover WinAnsiEncoding (~Windows-1252) — symbols outside that (arrows,
// "approximately") don't throw, they just render as garbled/wrong glyphs. "—"
// (em dash) and "·" (middle dot) used elsewhere in this file are both in
// WinAnsi and render fine; "→" and "≈" are not, so swap them before render.
function pdfSafe(text) {
  return text.replace(/→/g, "->").replace(/≈/g, "~").replace(/≤/g, "<=").replace(/≥/g, ">=");
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? v : v;
}

const STATE_LABEL = {
  missing_input: "Not entered",
  unavailable_source: "No source",
  invalid_input: "Invalid",
  stale_noncomparable: "Legacy, unverified",
  suppressed_official: "Suppressed",
};

function FacilityReport({ dataset, facility, displayName, vals, starVals, binaryVals, verifications, pahScenario, benchmarkChoice, priorYearQuintiles }) {
  const benchmark = benchmarkChoice === "live"
    ? liveCmsBenchmark(getLiveCutpoints, cmsAutofillMeta.generatedAt)
    : official2023Benchmark(dataset, facility);
  const scored = scoreFacility({ facility, inputs: { vals, starVals, binaryVals, verifications, pahScenario }, benchmark, priorYearQuintiles });

  const priorities = getAllOpportunities(scored).slice(0, 5);
  const missingEvidence = getMissingEvidence(scored).slice(0, 5);
  const missingCount = scored.perMeasure.filter(r => r.observation.state === "missing_input").length;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* `fixed` repeats this block on every page if content ever overflows one page --
            the closest honest equivalent react-pdf offers to a repeating table header,
            since it has no native per-page header-row repeat for a <View>-based table. */}
        <View fixed>
          <View style={styles.headerBar} />
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.subtitle}>
            {pdfSafe(`NY NHQI cycle ${CYCLE} · ${facility.city}, ${facility.county} (${facility.region}) · OPCERT ${facility.opcert} · ${missingCount > 0 ? `Incomplete — ${missingCount} input${missingCount === 1 ? "" : "s"} missing` : "All inputs resolved"}`)}
          </Text>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Official {dataset.year} result</Text>
            <Text style={styles.scoreVal}>{facility.totalScore ?? "—"}/100</Text>
            <Text style={{ fontSize: 7, color: colors.inkSecondary }}>Published quintile {facility.overallQuintile ?? "—"}</Text>
            {facility.jklDeficiency && (
              <Text style={{ fontSize: 6.5, color: colors.amberText, fontWeight: 700 }}>{pdfSafe("JKL deficiency - excluded from DOH ranking")}</Text>
            )}
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>{pdfSafe(`Known points, cycle ${CYCLE}`)}</Text>
            <Text style={[styles.scoreVal, { color: colors.accentText }]}>{scored.knownEarnedPoints}/{scored.fullEligibleMax}</Text>
            <Text style={{ fontSize: 7, color: colors.inkSecondary }}>{pdfSafe(`${scored.unresolvedMaxPoints} pt unresolved - ${scored.coverage.measuresKnown}/${scored.coverage.measuresTotal} measures`)}</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Overall quintile</Text>
            <Text style={[styles.scoreVal, { fontSize: 11 }]}>Not modeled</Text>
            <Text style={{ fontSize: 6.5, color: colors.inkSecondary }}>{pdfSafe("Peer cohort/tie-break not sourced this pass")}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 7.5, color: colors.inkSecondary, marginBottom: 8 }}>
          {pdfSafe(`Benchmark: ${scored.benchmark?.label}${scored.benchmark?.asOf ? ` (${scored.benchmark.asOf})` : ""}.`)}
        </Text>

        <Text style={styles.sectionTitle}>{pdfSafe(`All Measures — Official ${dataset.year} vs. Current (cycle ${CYCLE})`)}</Text>
        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.th, styles.colMeasure]}>Measure</Text>
            <Text style={[styles.th, styles.colPeriod]}>Current period</Text>
            <Text style={[styles.th, styles.colValYr]}>{dataset.year}</Text>
            <Text style={[styles.th, styles.colQYr]}>Q</Text>
            <Text style={[styles.th, styles.colPtsYr]}>Pts</Text>
            <Text style={[styles.th, styles.colValCur]}>Current</Text>
            <Text style={[styles.th, styles.colQ]}>Q</Text>
            <Text style={[styles.th, styles.colPts]}>Pts</Text>
          </View>
          {MEASURES_2025.map(m => {
            const a = facility.actuals[m.id] || {};
            const row = scored.perMeasure.find(r => r.measure.id === m.id);
            const stateLabel = row && row.observation.state !== "valid" ? STATE_LABEL[row.observation.state] : null;
            const curVal = stateLabel ?? (row?.observation.rawValue ?? "—");
            return (
              <View key={m.id} style={styles.tRow} wrap={false}>
                <Text style={[styles.td, styles.colMeasure]}>{m.displayName}</Text>
                <Text style={[styles.td, styles.colPeriod]}>{m.measurementPeriod?.label ?? "—"}</Text>
                <Text style={[styles.td, styles.colValYr]}>{fmt(a.value)}{m.unit && typeof a.value === "number" ? m.unit : ""}</Text>
                <Text style={[styles.td, styles.colQYr]}>{a.quintile ?? "—"}</Text>
                <Text style={[styles.td, styles.colPtsYr]}>{fmt(a.points)}</Text>
                <Text style={[styles.td, styles.colValCur]}>{String(curVal)}</Text>
                <Text style={[styles.td, styles.colQ]}>{row?.currentQuintile ?? "—"}</Text>
                <Text style={[styles.td, styles.colPts]}>{fmt(row?.points ?? null)}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Real Point Opportunities</Text>
        {priorities.length === 0 ? (
          <Text style={{ fontSize: 8, color: colors.inkSecondary }}>No real positive point gains identified from current entries.</Text>
        ) : (
          priorities.map((x, i) => {
            const { row, gain } = x;
            const m = row.measure;
            return (
              <View key={m.id} style={styles.priorityRow} wrap={false}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8 }}>{pdfSafe(`#${i + 1} ${m.displayName}`)}</Text>
                  <Text style={{ fontSize: 7.5, color: colors.inkSecondary }}>
                    {pdfSafe(`Q${row.currentQuintile} -> Q${row.currentQuintile - 1}${row.gapInfo ? ` (need ${row.gapInfo.gap.toFixed(1)}${m.unit === "%" ? "%" : ` ${m.unit}`}, target ${row.gapInfo.displayTarget})` : ""}`)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: colors.green }}>+{gain} pts</Text>
                </View>
              </View>
            );
          })
        )}

        {missingEvidence.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Missing Evidence</Text>
            {missingEvidence.map(r => (
              <View key={r.measure.id} style={styles.evidenceRow} wrap={false}>
                <Text style={{ fontSize: 8, color: colors.amberText }}>
                  {pdfSafe(`${r.measure.displayName} — up to ${r.measure.maxPoints} pts at stake, period: ${r.measure.measurementPeriod?.label ?? "unspecified"}`)}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer} fixed>
          {pdfSafe(`Official ${dataset.year} result is NY DOH's published NHQI figure for ${facility.name}, from ${dataset.source}. Known/unresolved points are modeled against cycle ${CYCLE} rules (2025 attainment + improvement matrix where applicable), benchmark: ${scored.benchmark?.label ?? "none selected"} — not an official DOH-certified figure. An overall quintile is not modeled this pass: NY's statewide peer cohort and tie-break method aren't sourced in this environment (health.ny.gov and cms.gov are unreachable from this build environment). Facilities with a J/K/L deficiency are excluded from DOH's official ranking; any score/quintile shown for them is directional only. PAH requires DOH's quarterly MDS->SPARCS match and can't be self-tracked; the value above reflects the selected PAH scenario, not an observed current value. Independent planning tool. Not affiliated with NY DOH. Generated ${new Date().toLocaleDateString()}.`)}
        </Text>
      </Page>
    </Document>
  );
}

export async function downloadFacilityPdf(props) {
  const blob = await pdf(<FacilityReport {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NHQI_${(props.displayName || props.facility.name).replace(/[^a-z0-9]+/gi, "_")}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
