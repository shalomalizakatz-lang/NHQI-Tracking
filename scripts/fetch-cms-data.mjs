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
// star rating is the national one, not NY DOH's regionally-adjusted version NHQI
// actually uses, so pulling it would silently show the wrong figure. Contract
// staff %, staff flu vaccination, and flu data submission timeliness have no
// CMS source at all and stay manual.
//
// CMS reshuffles its Provider Data Catalog dataset identifiers periodically, so
// rather than hardcode a UUID we look datasets up by title at run time. Column
// names are matched by keyword against the MDS Quality Measures "Measure
// Description" text (not by numeric measure code, which is more likely to have
// drifted from memory) and against Provider Info column headers. Every match is
// logged so a failed/partial run is diagnosable from the Actions log.

import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const PROVIDER_INFO_COLUMN_MATCHERS = {
  hprd: ["case-mix", "total nurse staffing hours"],
  turnover: ["total nursing staff turnover"],
};
const HPRD_FALLBACK_MATCH = ["reported total nurse staffing hours per resident per day"];

const CCN_COLUMN_CANDIDATES = ["cms certification number (ccn)", "cms certification number", "ccn", "federal provider number"];
const STATE_COLUMN_CANDIDATES = ["state", "provider state"];

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

async function main() {
  const facilitiesDataset = JSON.parse(await readFile(FACILITIES_PATH, "utf8"));
  const ccnsWeCareAbout = new Set(facilitiesDataset.facilities.map(f => normalizeCcn(f.medicareNumber)).filter(Boolean));
  log(`Loaded ${facilitiesDataset.facilities.length} facilities from bundled dataset (${ccnsWeCareAbout.size} unique CCNs).`);

  const measures = {};
  for (const id of [...Object.keys(MDS_MEASURE_MATCHERS), ...Object.keys(PROVIDER_INFO_COLUMN_MATCHERS)]) {
    measures[id] = {};
  }
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
      log(`  Columns available (sample):`, headers.slice(0, 15));
      for (const [measureId, terms] of Object.entries(PROVIDER_INFO_COLUMN_MATCHERS)) {
        let col = findColumn(headers, terms);
        if (!col && measureId === "hprd") col = findColumn(headers, HPRD_FALLBACK_MATCH);
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
    }
  } else {
    log("WARNING: could not locate Provider Info dataset at all.");
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "CMS Provider Data Catalog (data.cms.gov) — MDS Quality Measures & Provider Info datasets, matched by CMS Certification Number (CCN)",
    measures,
  };
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  log(`Wrote ${OUT_PATH}`);
  log("Summary:", JSON.stringify(stats.matchedRows, null, 2));
}

main().catch(err => {
  console.error("fetch-cms-data.mjs failed:", err);
  process.exit(1);
});
