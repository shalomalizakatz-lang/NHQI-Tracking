import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { MEASURES, TRACKABLE_MEASURES, TRACKABLE_MAX, getCutpoints, getQuintile, getPoints, getGapToNext, getDisplayed2025Points } from "./scoring.js";
import { getCensus, getLiveCutpoints } from "./cmsAutofill.js";
import { getActionPlan } from "./actionPlan.js";

const LIVE_PDF_COLOR = "#7c3aed";

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
  th: { padding: 3, fontSize: 7, fontWeight: 700, color: "#374151" },
  td: { padding: 3, fontSize: 7.5, color: "#111827" },
  colMeasure: { width: "23%" },
  colValYr: { width: "9%", textAlign: "right" },
  colQYr: { width: "7%", textAlign: "center" },
  colPtsYr: { width: "8%", textAlign: "right" },
  colValCur: { width: "9%", textAlign: "right" },
  colQ: { width: "7%", textAlign: "center" },
  colPts: { width: "8%", textAlign: "right" },
  priorityRow: { flexDirection: "row", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: 3, padding: 5, marginBottom: 3 },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7, color: "#9ca3af" },
});

// react-pdf's default Helvetica is one of the 14 standard PDF fonts, which
// only cover WinAnsiEncoding (~Windows-1252) — symbols outside that (arrows,
// "approximately") don't throw, they just render as garbled/wrong glyphs. "—"
// (em dash) and "·" (middle dot) used elsewhere in this file are both in
// WinAnsi and render fine; "→" and "≈" are not, so swap them before render.
function pdfSafe(text) {
  return text.replace(/→/g, "->").replace(/≈/g, "~");
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? v : v;
}

function FacilityReport({ dataset, facility, displayName, vals, starVals, binaryVals, summary }) {
  const census = getCensus(facility.medicareNumber);
  const priorities = MEASURES
    .filter(m => !m.notTrackable && (m.scoring === "quintile" || m.scoring === "quintile_pah"))
    .map(m => {
      const cutpoints = getCutpoints(dataset, m.id, facility.region);
      const q = getQuintile(m, vals[m.id], cutpoints);
      const gapInfo = q && q > 1 ? getGapToNext(m, vals[m.id], q, cutpoints) : null;
      const table = m.scoring === "quintile_pah" ? [10, 8, 6, 2, 0] : [5, 3, 1, 0, 0];
      const ptGain = q ? table[q - 2] - table[q - 1] : 0;
      const actionPlan = getActionPlan(m, gapInfo, census);

      // Live cut-point target, same as PriorityList.jsx's in-app display —
      // only exists for quintile-scored measures with a live split available.
      const liveCutpoints = m.scoring === "quintile" ? getLiveCutpoints(m.id) : null;
      const qLive = liveCutpoints ? getQuintile(m, vals[m.id], liveCutpoints) : null;
      const gapInfoLive = liveCutpoints && qLive && qLive > 1 ? getGapToNext(m, vals[m.id], qLive, liveCutpoints) : null;
      const actionPlanLive = getActionPlan(m, gapInfoLive, census);
      const ptGainLive = qLive && qLive > 1 ? table[qLive - 2] - table[qLive - 1] : 0;

      return { m, q, gapInfo, ptGain, actionPlan, qLive, gapInfoLive, actionPlanLive, ptGainLive };
    })
    .filter(x => x.q && x.q > 1)
    .sort((a, b) => b.ptGain !== a.ptGain ? b.ptGain - a.ptGain : (a.gapInfo?.gap ?? 999) - (b.gapInfo?.gap ?? 999))
    .slice(0, 5);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar} />
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.subtitle}>
          NY DOH NHQI · {dataset.year} Actual vs. Current Full-Year · {facility.city}, {facility.county} ({facility.region}) · OPCERT {facility.opcert}
        </Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>{dataset.year} Actual Score</Text>
            <Text style={styles.scoreVal}>{summary.score2023}/90</Text>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>Quintile {summary.quintile2023 ?? "—"}</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Current Score (excl. PAH)</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View>
                <Text style={{ fontSize: 6, color: "#9ca3af" }}>DOH</Text>
                <Text style={styles.scoreVal}>{summary.score2025 !== null ? `${summary.score2025}/${TRACKABLE_MAX}` : "—"}</Text>
              </View>
              {summary.score2025Live !== null && (
                <View>
                  <Text style={{ fontSize: 6, color: "#9ca3af" }}>Live</Text>
                  <Text style={[styles.scoreVal, { color: LIVE_PDF_COLOR }]}>{summary.score2025Live}/{summary.liveMax}</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>{summary.entered}/{TRACKABLE_MEASURES.length} trackable measures entered</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Est. Quintile</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View>
                <Text style={{ fontSize: 6, color: "#9ca3af" }}>DOH</Text>
                <Text style={styles.scoreVal}>{summary.quintile2027 !== null ? `Q${summary.quintile2027}` : "—"}</Text>
              </View>
              {summary.quintile2027Live !== null && (
                <View>
                  <Text style={{ fontSize: 6, color: "#9ca3af" }}>Live</Text>
                  <Text style={[styles.scoreVal, { color: LIVE_PDF_COLOR }]}>Q{summary.quintile2027Live}</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>
              {summary.quintile2027 !== null ? (summary.quintile2027 <= 3 ? "Quality Pool: positive" : "Quality Pool: negative") : "Enter current data to project"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>All Measures — {dataset.year} Actual vs. Current Full-Year</Text>
        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.th, styles.colMeasure]}>Measure</Text>
            <Text style={[styles.th, styles.colValYr]}>{dataset.year}</Text>
            <Text style={[styles.th, styles.colQYr]}>Q</Text>
            <Text style={[styles.th, styles.colPtsYr]}>Pts</Text>
            <Text style={[styles.th, styles.colValCur]}>Current</Text>
            <Text style={[styles.th, styles.colQ]}>DOH Q</Text>
            <Text style={[styles.th, styles.colPts]}>DOH Pts</Text>
            <Text style={[styles.th, styles.colQ, { color: LIVE_PDF_COLOR }]}>Live Q</Text>
            <Text style={[styles.th, styles.colPts, { color: LIVE_PDF_COLOR }]}>Live Pts</Text>
          </View>
          {MEASURES.map(m => {
            const a = facility.actuals[m.id] || {};
            const cutpoints = getCutpoints(dataset, m.id, facility.region);
            const q25 = (!m.notTrackable && (m.scoring === "quintile" || m.scoring === "quintile_pah")) ? getQuintile(m, vals[m.id], cutpoints) : null;
            const pts25 = getDisplayed2025Points(dataset, facility, m, vals, starVals, binaryVals);
            const liveCutpoints = (!m.notTrackable && m.scoring === "quintile") ? getLiveCutpoints(m.id) : null;
            const qLive = liveCutpoints ? getQuintile(m, vals[m.id], liveCutpoints) : null;
            // No live benchmark exists for this measure (threshold/star/binary
            // scoring, or a quintile measure with no CMS data) — same rule
            // applies in both worlds, so DOH points carry over unchanged,
            // matching computeFacilitySummary's live-track fallback.
            const ptsLive = liveCutpoints ? getPoints(m, vals[m.id], starVals[m.id], binaryVals[m.id], liveCutpoints) : (m.notTrackable ? null : pts25);
            const val2025Display = m.notTrackable ? "not trackable" : (vals[m.id] || starVals[m.id] || binaryVals[m.id] || "—");
            return (
              <View key={m.id} style={styles.tRow}>
                <Text style={[styles.td, styles.colMeasure]}>{m.short}{m.pointsApproximate ? " *" : ""}</Text>
                <Text style={[styles.td, styles.colValYr]}>{fmt(a.value)}{m.unit && typeof a.value === "number" ? m.unit : ""}</Text>
                <Text style={[styles.td, styles.colQYr]}>{a.quintile ?? "—"}</Text>
                <Text style={[styles.td, styles.colPtsYr]}>{fmt(a.points)}</Text>
                <Text style={[styles.td, styles.colValCur]}>{val2025Display}</Text>
                <Text style={[styles.td, styles.colQ]}>{q25 ?? "—"}</Text>
                <Text style={[styles.td, styles.colPts]}>{fmt(pts25)}</Text>
                <Text style={[styles.td, styles.colQ, { color: LIVE_PDF_COLOR }]}>{qLive ?? "—"}</Text>
                <Text style={[styles.td, styles.colPts, { color: LIVE_PDF_COLOR }]}>{fmt(ptsLive)}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Top Improvement Opportunities</Text>
        {priorities.length === 0 ? (
          <Text style={{ fontSize: 8, color: "#6b7280" }}>Enter current full-year numbers to generate an improvement plan.</Text>
        ) : (
          priorities.map((x, i) => (
            <View key={x.m.id} style={styles.priorityRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8 }}>{pdfSafe(`#${i + 1} ${x.m.short}`)}</Text>
                <Text style={{ fontSize: 7.5, color: "#374151" }}>
                  {pdfSafe(`DOH: Q${x.q} → Q${x.q - 1}${x.gapInfo ? ` (need ${x.gapInfo.gap.toFixed(1)}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`}, target ${x.gapInfo.target})` : ""}${x.actionPlan ? ` — ${x.actionPlan}` : ""}`)}
                </Text>
                {x.qLive !== null && (
                  <Text style={{ fontSize: 7.5, color: LIVE_PDF_COLOR }}>
                    {pdfSafe(x.qLive > 1
                      ? `Live: Q${x.qLive} → Q${x.qLive - 1}${x.gapInfoLive ? ` (need ${x.gapInfoLive.gap.toFixed(1)}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`}, target ${x.gapInfoLive.target})` : ""}${x.actionPlanLive ? ` — ${x.actionPlanLive}` : ""}`
                      : `Live: Q${x.qLive} (already top quintile)`)}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                {x.qLive !== null && x.ptGainLive !== x.ptGain ? (
                  <>
                    <Text style={{ fontSize: 8, fontWeight: 700, color: "#15803d" }}>+{x.ptGain} pts (DOH)</Text>
                    <Text style={{ fontSize: 7.5, fontWeight: 700, color: LIVE_PDF_COLOR }}>+{x.ptGainLive} pts (Live)</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 8, fontWeight: 700, color: "#15803d" }}>+{x.ptGain} pts</Text>
                )}
              </View>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          {pdfSafe(`${dataset.year} actuals from NY DOH NHQI dataset (${dataset.source}). DOH cut points regionally adjusted where applicable (${facility.region}). Live cut points rank the same entered numbers against a live NY-wide benchmark computed from current CMS data instead — a directional second opinion, not a DOH-certified figure; shown only for measures with a live cut-point split available. PAH cannot be self-tracked (requires DOH's MDS→SPARCS match), so it's excluded entirely from the Current Score, which is out of ${TRACKABLE_MAX} points, not 90 — DOH's real cycle will still include PAH once calculated. * = DOH's real points for this measure sometimes differ +/-1 from the standard quintile table; current points shown here are directional. Est. quintile is directional, not guaranteed. Improvement plan headcounts use this facility's average daily census from CMS as an estimate, not the exact long-stay resident count NHQI measures track. Generated ${new Date().toLocaleDateString()}.`)}
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
