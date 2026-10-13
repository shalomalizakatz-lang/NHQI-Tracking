import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { MEASURES_2025, CYCLE } from "./nhqi/measures/2025.js";
import { scoreFacility, getNextTierGain } from "./nhqi/scorer.js";
import { official2023Benchmark, liveCmsBenchmark } from "./nhqi/benchmarks.js";
import { getLiveCutpoints, cmsAutofillMeta } from "./cmsAutofill.js";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerBar: { height: 4, backgroundColor: "#1d4ed8", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#6b7280", marginBottom: 12 },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  scoreCard: { flex: 1, border: "1px solid #e5e7eb", borderRadius: 4, padding: 8 },
  scoreLabel: { fontSize: 7, color: "#6b7280", marginBottom: 3, textTransform: "uppercase" },
  scoreVal: { fontSize: 16, fontWeight: 700 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginTop: 10, marginBottom: 4, color: "#1d4ed8" },
  table: { border: "1px solid #e5e7eb", borderRadius: 3 },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" },
  tRow: { flexDirection: "row", borderBottom: "1px solid #f3f4f6" },
  th: { padding: 2.5, fontSize: 6.5, fontWeight: 700, color: "#374151" },
  td: { padding: 2.5, fontSize: 7, color: "#111827" },
  colMeasure: { width: "25%" },
  colPeriod: { width: "18%", fontSize: 6.2 },
  colValYr: { width: "9%", textAlign: "right" },
  colQYr: { width: "7%", textAlign: "center" },
  colPtsYr: { width: "8%", textAlign: "right" },
  colValCur: { width: "9%", textAlign: "right" },
  colQ: { width: "7%", textAlign: "center" },
  colPts: { width: "8%", textAlign: "right" },
  priorityRow: { flexDirection: "row", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: 3, padding: 4, marginBottom: 2.5 },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7, color: "#9ca3af" },
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

  const priorities = scored.perMeasure
    .filter(r => (r.measure.scoringRule === "quintile" || r.measure.scoringRule === "quintile_pah") && r.currentQuintile && r.currentQuintile > 1)
    .map(r => ({ row: r, gain: getNextTierGain(r) }))
    .filter(x => x.gain !== null && x.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 5);

  const missingCount = scored.perMeasure.filter(r => r.observation.state === "missing_input").length;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar} />
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.subtitle}>
          {pdfSafe(`NY NHQI cycle ${CYCLE} · ${facility.city}, ${facility.county} (${facility.region}) · OPCERT ${facility.opcert} · ${missingCount > 0 ? `Incomplete — ${missingCount} input${missingCount === 1 ? "" : "s"} missing` : "All inputs resolved"}`)}
        </Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Official {dataset.year} result</Text>
            <Text style={styles.scoreVal}>{facility.totalScore ?? "—"}/100</Text>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>Published quintile {facility.overallQuintile ?? "—"}</Text>
            {facility.jklDeficiency && (
              <Text style={{ fontSize: 6.5, color: "#b45309", fontWeight: 700 }}>{pdfSafe("JKL deficiency - excluded from DOH ranking")}</Text>
            )}
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>{pdfSafe(`Known points, cycle ${CYCLE}`)}</Text>
            <Text style={styles.scoreVal}>{scored.knownEarnedPoints}/{scored.fullEligibleMax}</Text>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>{pdfSafe(`${scored.unresolvedMaxPoints} pt unresolved - ${scored.coverage.measuresKnown}/${scored.coverage.measuresTotal} measures`)}</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Overall quintile</Text>
            <Text style={[styles.scoreVal, { fontSize: 11 }]}>Not modeled</Text>
            <Text style={{ fontSize: 6.5, color: "#6b7280" }}>{pdfSafe("Peer cohort/tie-break not sourced this pass")}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 7.5, color: "#374151", marginBottom: 8 }}>
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
              <View key={m.id} style={styles.tRow}>
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
          <Text style={{ fontSize: 8, color: "#6b7280" }}>No real positive point gains identified from current entries.</Text>
        ) : (
          priorities.map((x, i) => {
            const { row, gain } = x;
            const m = row.measure;
            return (
              <View key={m.id} style={styles.priorityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8 }}>{pdfSafe(`#${i + 1} ${m.displayName}`)}</Text>
                  <Text style={{ fontSize: 7.5, color: "#374151" }}>
                    {pdfSafe(`Q${row.currentQuintile} -> Q${row.currentQuintile - 1}${row.gapInfo ? ` (need ${row.gapInfo.gap.toFixed(1)}${m.unit === "%" ? "%" : ` ${m.unit}`}, target ${row.gapInfo.displayTarget})` : ""}`)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: "#15803d" }}>+{gain} pts</Text>
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.footer}>
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
