// Refreshes src/data/cms_autofill.json from CMS's public Provider Data Catalog
// (data.cms.gov) — the same numbers shown on Medicare Care Compare. Run by
// .github/workflows/refresh-cms-data.yml on GitHub's runners, which have normal
// internet access (unlike the sandboxed dev environment this was authored in).
//
// Only pulls the measures that have a real 1:1 CMS source and aren't NY-specific
// adjustments: pressure ulcers (high-risk), weight loss, falls w/ major injury,
// depressive symptoms, ADL increase, UTI, incontinence (low-risk), pneumococcal
// vaccine, resident flu vaccine, staffing hours/resident/day, and nursing staff
// turnover. Health Inspection Stars is deliberately excluded — Care Compare's
// star rating is the national one, not NY DOH's regionally-adjusted version
// NHQI actually uses, so pulling it would silently show the wrong figure.
// Contract staff %, staff flu vaccination, and flu data submission timeliness
// have no accessible CMS source and stay manual.
//
// Staff flu vaccination ("Percentage of health care personnel who got a flu
// shot") IS real CMS data, visible on Care Compare's own site, but after three
// verified live runs it isn't reachable through the Provider Data Catalog API:
// not in the MDS Quality Measures file (not among its 17 unique measure
// descriptions), not a standalone dataset (a full-catalog keyword search for
// "flu"/"personnel"/"vaccin"/"covid"/"immuniz" found nothing relevant), and
// not a column in Provider Information (checked all 99 of its columns). Care
// Compare's website most likely renders it from an internal system (possibly
// a direct CDC NHSN integration) that isn't published as open data. Left
// manual rather than built on an undocumented/fragile scrape of the site.
//
// CMS reshuffles its Provider Data Catalog dataset identifiers periodically, so
// rather than hardcode a UUID we look datasets up by title at run time. Column
// names are matched by keyword against the MDS Quality Measures "Measure
// Description" text (not by numeric measure code, which is more likely to have
// drifted from memory) and against Provider Info column headers. Every match is
// logged so a failed/partial run is diagnosable from the Actions log.
//
// Also computes a live NY-wide quintile benchmark for the quintile-scored
// measures above (see computeLiveCutpoints below) — a statewide split of the
// same facility population NHQI itself scores against, stored separately from
// the frozen DOH cut points already bundled in src/data/nhqi_2023.json. This
// is directional, not a DOH-certified figure: CMS and DOH use slightly
// different denominators/risk-adjustment, and DOH's own cut points are
// regionally adjusted for some measures (e.g. turnover) where this live
// benchmark is a single statewide split.

import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MEASURES } from "../src/lib/scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "src", "data", "cms_autofill.json");
const FACILITIES_PATH = path.join(__dirname, "..", "src", "data", "nhqi_2023.json");

const METASTORE_URL = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items?show-reference-ids=false";

// measureId -> matcher against the MDS Quality Measures "Measure Description" column.
// Each matcher is a list of substrings that must ALL appear (case-insensitive).
// Confirmed against the real "Measure Description" values logged by the second
// live run (see PR #9) — CMS's public description text for both of these omits
// the high-risk/low-risk cohort qualifier entirely even though the underlying
// measure spec risk-adjusts to that cohort, so requiring "high"/"low" in the
// text (as the first two attempts did) matched nothing.
const MDS_MEASURE_MATCHERS = {
  pressure_ulcer: ["pressure ulcer"],
  weight_loss: ["lose too much weight"],
  falls: ["falls", "major injury"],
  depression: ["depressive symptoms"],
  adl: ["help with daily activities", "increased"],
  uti: ["urinary tract infection"],
  incontinence: ["bowel", "bladder"],
  pneumo_vax: ["pneumococcal vaccine"],
  flu_vax_resident: ["influenza vaccine"],
};

// Long-stay vs. short-stay is usually a separate "Resident type" column, not
// embedded in the description text — first run showed flu_vax_resident matching
// 0 rows (its old matcher required "long-stay" literally in the description) and
// pneumo_vax matching ~2x the facility count (blending both resident types with
// no filter at all). Filtered separately in main() once that column is resolved.
const RESIDENT_TYPE_COLUMN_CANDIDATES = ["resident type"];

// measureId -> matcher against Provider Info column headers.
// hprd deliberately targets the "Reported" (self-reported PBJ) figure, not
// CMS's "Case-Mix" column — Care Compare's own consumer-facing page displays
// the reported figure, and a user comparing our auto-fill against that page
// saw a mismatch (4.2 vs. the 3.2 Care Compare showed) because the case-mix
// column was being matched first. CMS's national case-mix adjustment isn't
// guaranteed to equal NY DOH's own case-mix methodology anyway, so "reported"
// is no less approximate and has the advantage of being directly verifiable
// against what Care Compare itself shows.
const PROVIDER_INFO_COLUMN_MATCHERS = {
  hprd: ["reported total nurse staffing hours per resident per day"],
  turnover: ["total nursing staff turnover"],
};
const HPRD_CASE_MIX_FALLBACK_MATCH = ["case-mix", "total nurse staffing hours"];

const CCN_COLUMN_CANDIDATES = ["cms certification number (ccn)", "cms certification number", "ccn", "federal provider number"];
const STATE_COLUMN_CANDIDATES = ["state", "provider state"];

// Average daily census, also from Provider Info — used to convert a measure's
// percentage/rate gap into an actual headcount plan (see src/lib/actionPlan.js).
// Not a scored measure, so it's stored under its own top-level "census" key
// in the output rather than inside "measures".
const CENSUS_COLUMN_MATCH = ["average number of residents per day"];

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "nhqi-tracking-autofill/1.0" } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "nhqi-tracking-autofill/1.0" } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

// Minimal RFC4180 CSV parser — handles quoted fields with embedded commas/quotes,
// which is all CMS's exports need (no embedded newlines observed in practice).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}

function findColumn(headers, mustIncludeAll) {
  return headers.find(h => {
    const lower = h.toLowerCase();
    return mustIncludeAll.every(term => lower.includes(term));
  }) || null;
}

async function findDataset(titleMustInclude) {
  log("Searching Provider Data Catalog metastore for:", titleMustInclude.join(" + "));
  const items = await fetchJson(METASTORE_URL);
  const matches = items.filter(it => {
    const title = (it.title || "").toLowerCase();
    return titleMustInclude.every(t => title.includes(t.toLowerCase()));
  });
  if (matches.length === 0) {
    log("  No dataset matched. Titles sampled:", items.slice(0, 5).map(i => i.title));
    return null;
  }
  matches.sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));
  const chosen = matches[0];
  log(`  Matched dataset: "${chosen.title}" (identifier ${chosen.identifier})`);
  const dist = (chosen.distribution || []).find(d => d?.data?.downloadURL || d?.downloadURL);
  const url = dist?.data?.downloadURL || dist?.downloadURL;
  if (!url) { log("  Dataset matched but no downloadURL found on its distribution."); return null; }
  return { title: chosen.title, url };
}

async function loadRows(datasetInfo) {
  const raw = await fetchText(datasetInfo.url);
  if (datasetInfo.url.endsWith(".json")) return JSON.parse(raw);
  return parseCsv(raw);
}

function normalizeCcn(v) {
  if (!v) return null;
  return String(v).trim().toUpperCase();
}

// CMS sometimes reports more precision than is meaningful for a manual-entry
// default (e.g. 3.567) — cap to one decimal place to match how facilities
// actually enter their own numbers.
function round1(v) {
  return Math.round(v * 10) / 10;
}

// Only measures actually scored via a 5-way quintile split in this app's own
// model get a live benchmark — threshold-scored measures (falls, UTI,
// contract staff) compare against a single fixed cutoff, not a distribution,
// so a quintile boundary would never be consulted by getPoints() anyway.
const QUINTILE_MEASURE_IDS = new Set(MEASURES.filter(m => m.scoring === "quintile").map(m => m.id));

function percentile(sortedAsc, p) {
  const idx = (sortedAsc.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedAsc[lower];
  return sortedAsc[lower] + (sortedAsc[upper] - sortedAsc[lower]) * (idx - lower);
}

// Same boundary convention as the bundled DOH dataset's cutpoints arrays (see
// getQuintile in src/lib/scoring.js): cutpoints[0] is the Q1/best threshold,
// cutpoints[3] is the Q4→Q5 threshold. For higherIsBetter that's descending
// (P80, P60, P40, P20); for lowerIsBetter it's ascending (P20, P40, P60, P80).
//
// `roundToInt`: for measures where DOH's own cut points are whole numbers
// (e.g. pneumococcal/flu vaccine %, ADL, incontinence — all "% of residents"
// measures DOH apparently rounds to the nearest percent), round the live
// boundaries the same way instead of the default 1-decimal precision, so the
// live benchmark reads consistently with how DOH presents that same measure.
function computeLiveCutpoints(values, higherIsBetter, roundToInt) {
  const round = roundToInt ? Math.round : round1;
  const sorted = [...values].sort((a, b) => a - b);
  const ps = [0.2, 0.4, 0.6, 0.8].map(p => round(percentile(sorted, p)));
  return higherIsBetter ? ps.slice().reverse() : ps;
}

// Whether DOH's own frozen cut points for this measure are all whole numbers
// — if so, the live boundaries should match that precision instead of always
// showing a decimal.
function dohUsesWholeNumberCutpoints(facilitiesDataset, measureId) {
  const cutpointsByRegion = facilitiesDataset.measures?.[measureId]?.cutpoints;
  const cutpoints = cutpointsByRegion?.default || Object.values(cutpointsByRegion || {})[0];
  return Array.isArray(cutpoints) && cutpoints.length > 0 && cutpoints.every(v => Number.isInteger(v));
}

async function main() {
  const facilitiesDataset = JSON.parse(await readFile(FACILITIES_PATH, "utf8"));
  const ccnsWeCareAbout = new Set(facilitiesDataset.facilities.map(f => normalizeCcn(f.medicareNumber)).filter(Boolean));
  log(`Loaded ${facilitiesDataset.facilities.length} facilities from bundled dataset (${ccnsWeCareAbout.size} unique CCNs).`);

  const measures = {};
  for (const id of [...Object.keys(MDS_MEASURE_MATCHERS), ...Object.keys(PROVIDER_INFO_COLUMN_MATCHERS)]) {
    measures[id] = {};
  }
  const census = {};
  const stats = { matchedRows: {}, unmatchedCcnSamples: {} };

  // --- MDS Quality Measures (long-stay, quarterly) ---
  const mdsDataset = await findDataset(["nursing home", "quality measures"]) || await findDataset(["quality measures", "mds"]);
  if (mdsDataset) {
    const rows = await loadRows(mdsDataset);
    log(`  Downloaded ${rows.length} rows from "${mdsDataset.title}".`);
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      log(`  All columns:`, headers);
      const ccnCol = findColumn(headers, ["cms certification number"]) || findColumn(headers, ["ccn"]);
      const descCol = findColumn(headers, ["measure description"]) || findColumn(headers, ["measure"]);
      const residentTypeCol = findColumn(headers, RESIDENT_TYPE_COLUMN_CANDIDATES);
      // Prefer a genuine composite score over a single stale quarter — the first
      // run resolved to "Q1 Measure Score" because it's the first header whose
      // name merely *contains* "measure score", which isn't the figure we want.
      const scoreCol = headers.find(h => h.trim().toLowerCase() === "measure score")
        || findColumn(headers, ["four quarter average score"])
        || findColumn(headers, ["adjusted score"])
        || findColumn(headers, ["q4 measure score"])
        || findColumn(headers, ["measure score"]);
      log(`  Columns resolved: ccn="${ccnCol}" description="${descCol}" residentType="${residentTypeCol}" score="${scoreCol}"`);
      if (descCol) {
        const uniqueDescs = [...new Set(rows.map(r => r[descCol]).filter(Boolean))];
        log(`  ${uniqueDescs.length} unique measure descriptions:`, uniqueDescs);
      }
      if (residentTypeCol) {
        const uniqueTypes = [...new Set(rows.map(r => r[residentTypeCol]).filter(Boolean))];
        log(`  Resident type values:`, uniqueTypes);
      }
      if (ccnCol && descCol && scoreCol) {
        for (const [measureId, terms] of Object.entries(MDS_MEASURE_MATCHERS)) {
          let matched = 0;
          for (const row of rows) {
            const desc = (row[descCol] || "").toLowerCase();
            if (!terms.every(t => desc.includes(t))) continue;
            if (residentTypeCol) {
              const rt = (row[residentTypeCol] || "").toLowerCase();
              if (!rt.includes("long")) continue;
            }
            const ccn = normalizeCcn(row[ccnCol]);
            if (!ccn || !ccnsWeCareAbout.has(ccn)) continue;
            const val = parseFloat(row[scoreCol]);
            if (isNaN(val)) continue;
            measures[measureId][ccn] = round1(val);
            matched++;
          }
          stats.matchedRows[measureId] = matched;
          log(`  ${measureId}: matched ${matched} facility rows`);
        }
      } else {
        log("  WARNING: could not resolve required columns in MDS Quality Measures dataset — skipping this dataset.");
      }
    }
  } else {
    log("WARNING: could not locate MDS Quality Measures dataset at all.");
  }

  // --- Provider Info (staffing hours, turnover) ---
  const providerInfoDataset = await findDataset(["nursing home", "provider info"]) || await findDataset(["provider info"]);
  if (providerInfoDataset) {
    const rows = await loadRows(providerInfoDataset);
    log(`  Downloaded ${rows.length} rows from "${providerInfoDataset.title}".`);
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const ccnCol = findColumn(headers, CCN_COLUMN_CANDIDATES.map(c => c)) || findColumn(headers, ["ccn"]);
      log(`  All columns (${headers.length}):`, headers);
      for (const [measureId, terms] of Object.entries(PROVIDER_INFO_COLUMN_MATCHERS)) {
        let col = findColumn(headers, terms);
        if (!col && measureId === "hprd") col = findColumn(headers, HPRD_CASE_MIX_FALLBACK_MATCH);
        if (!ccnCol || !col) {
          log(`  WARNING: could not resolve column for ${measureId} (ccnCol=${ccnCol}, col=${col}) — skipping.`);
          continue;
        }
        let matched = 0;
        for (const row of rows) {
          const ccn = normalizeCcn(row[ccnCol]);
          if (!ccn || !ccnsWeCareAbout.has(ccn)) continue;
          const val = parseFloat(row[col]);
          if (isNaN(val)) continue;
          measures[measureId][ccn] = round1(val);
          matched++;
        }
        stats.matchedRows[measureId] = matched;
        log(`  ${measureId} (column "${col}"): matched ${matched} facility rows`);
      }

      const censusCol = findColumn(headers, CENSUS_COLUMN_MATCH);
      if (ccnCol && censusCol) {
        let matched = 0;
        for (const row of rows) {
          const ccn = normalizeCcn(row[ccnCol]);
          if (!ccn || !ccnsWeCareAbout.has(ccn)) continue;
          const val = parseFloat(row[censusCol]);
          if (isNaN(val)) continue;
          census[ccn] = round1(val);
          matched++;
        }
        stats.matchedRows.census = matched;
        log(`  census (column "${censusCol}"): matched ${matched} facility rows`);
      } else {
        log(`  WARNING: could not resolve census column (ccnCol=${ccnCol}, col=${censusCol}) — skipping.`);
      }
    }
  } else {
    log("WARNING: could not locate Provider Info dataset at all.");
  }

  // --- Live NY quintile boundaries (statewide benchmark, computed from the
  // facility values already collected above — our bundled facility list IS
  // all NY nursing homes, so this is the same population NHQI itself scores
  // against, just not regionally split the way DOH's own cutpoints are).
  const liveCutpoints = {};
  for (const measureId of Object.keys(measures)) {
    if (!QUINTILE_MEASURE_IDS.has(measureId)) continue;
    const values = Object.values(measures[measureId]);
    if (values.length < 10) {
      log(`  liveCutpoints ${measureId}: skipped, only ${values.length} facility values (too few for a meaningful split)`);
      continue;
    }
    const m = MEASURES.find(mm => mm.id === measureId);
    const roundToInt = dohUsesWholeNumberCutpoints(facilitiesDataset, measureId);
    const boundaries = computeLiveCutpoints(values, m.higherIsBetter, roundToInt);
    liveCutpoints[measureId] = { boundaries, facilityCount: values.length };
    log(`  liveCutpoints ${measureId}: boundaries=${JSON.stringify(boundaries)} (n=${values.length}${roundToInt ? ", rounded to whole numbers to match DOH" : ""})`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "CMS Provider Data Catalog (data.cms.gov) — MDS Quality Measures & Provider Info datasets, matched by CMS Certification Number (CCN)",
    measures,
    census,
    liveCutpoints,
  };
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  log(`Wrote ${OUT_PATH}`);
  log("Summary:", JSON.stringify(stats.matchedRows, null, 2));
}

main().catch(err => {
  console.error("fetch-cms-data.mjs failed:", err);
  process.exit(1);
});
