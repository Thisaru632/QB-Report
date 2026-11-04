"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";

export default function Home() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Upload");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentType, setPaymentType] = useState("ALL");
  const [uploadSearch, setUploadSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [compareLeft, setCompareLeft] = useState({ name: "", rows: [] });
  const [compareRight, setCompareRight] = useState({ name: "", rows: [] });
  function onCompareFile(e, setter) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => (h ? h.trim() : ""),
      complete: (res) => setter({ name: file.name, rows: res.data || [] }),
    });
  }
  const [compareResult, setCompareResult] = useState(null);
  function runCompare() {
    const normK = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    const keyOf = (rows) => {
      for (const r of rows) {
        const k = Object.keys(r).find((x) => ["bookingid", "bookingref"].includes(normK(x)));
        if (k) return k;
      }
      return null;
    };
    const k1 = keyOf(compareLeft.rows);
    const k2 = keyOf(compareRight.rows);
    if (!k1 || !k2) {
      setCompareResult({ error: "Booking ID column not found in one or both files." });
      return;
    }
    const toMap = (rows, k) => {
      const m = new Map();
      rows.forEach((r) => {
        const id = String(r[k] ?? "").trim();
        if (id) m.set(id, r);
      });
      return m;
    };
    const m1 = toMap(compareLeft.rows, k1);
    const m2 = toMap(compareRight.rows, k2);
    const onlyLeft = [...m1.keys()].filter((id) => !m2.has(id));
    const onlyRight = [...m2.keys()].filter((id) => !m1.has(id));
    const differences = [];
    let matched = 0;
    m1.forEach((r1, id) => {
      const r2 = m2.get(id);
      if (!r2) return;
      const fields = Object.keys(r1).filter(
        (f) => f !== k1 && f in r2 && String(r1[f] ?? "").trim() !== String(r2[f] ?? "").trim()
      );
      if (fields.length) {
        fields.forEach((f) => differences.push({ id, field: f, a: r1[f], b: r2[f] }));
      } else {
        matched++;
      }
    });
    setCompareResult({ onlyLeft, onlyRight, differences, matched });
  }
  const tabs = ["Upload", "Date Range Report", "Compare Reports"];
  const dateRangeColumns = [
    "Trip Status", "Misc Price Final", "Driver Comm", "SC Comm", "Final Price",
    "disp", "Vehicle Number", "Driver Name", "Driver Code", "Driver Mobile Number",
    "Booking Ref", "end date", "No of pax", "Pax Name", "Company", "Contact #1",
    "Pick up Street", "Drop off Str", "Hire type", "Journey Type", "Package price",
    "Advance Paid", "Form ID", "Dispatcher ID", "Distance",
  ];
  // report heading -> source column in the uploaded CSV
  const dateRangeSources = {
    "Trip Status": "status",
    "Misc Price Final": "driver misc sum",
    "Driver Comm": "driver_commission",
    "SC Comm": "senu_cab_commission",
    "Final Price": "total amount",
    "Vehicle Number": "plate_number",
    "Driver Name": "DriverID",
    "Driver Code": "DriverID",
    "Booking Ref": "Booking ID",
    "end date": (r) => (r.end_date || "").split(/[T ]/)[0] || "",
    "Pax Name": "customer name",
    "Company": "company_name",
    "Contact #1": "customer whatsapp mobile",
    "Pick up Street": (r) => (r.item_description || "").split("->")[0]?.trim() || "",
    "Drop off Str": (r) => (r.item_description || "").split("->")[1]?.trim() || "",
    "Hire type": "Settlement Type",
    "Journey Type": "Hire Nature",
    "Package price": "amount",
    "Advance Paid": "advance_payment",
    "Form ID": "booking_created_agent_id",
    "Dispatcher ID": "Dispatch By",
    "Distance": "Final distance",
  };
  // columns shown when the Cash filter is selected (in this order)
  const cashColumns = [
    "Booking Ref", "Driver Code", "end date", "*DueDate", "vehicle_type",
    "Location", "MemoNew", "Memo", "item_description",
    "ItemQuantity", "ItemRate", "*ItemAmount",
  ];
  // display headings for the cash report (keys above stay the same)
  const cashLabels = {
    "Booking Ref": "*InvoiceNo",
    "Driver Code": "*Customer",
    "end date": "*InvoiceDate",
    "*DueDate": "*DueDate",
    "vehicle_type": "Terms",
    "Location": "Location",
    "MemoNew": "Memo",
    "Memo": "Item(Product/Service)",
    "item_description": "ItemDescription",
  };
  const isFormattedReport = paymentType === "CASH" || paymentType === "CREDIT" || paymentType === "CREDIT_NOTE";
  const labelOf = (c) => {
    if (paymentType === "CREDIT" && c === "ItemRate") return "*ItemAmount";
    if (paymentType === "CREDIT" && c === "Memo") return "HireIncome";
    if (paymentType === "CREDIT_NOTE" && c === "end date") return "*CreditMemoDate";
    return isFormattedReport ? cashLabels[c] ?? c : c;
  };
  const cashSources = {
    ...dateRangeSources,
    "Driver Code": (r) => {
      const code = sourceValue(r, dateRangeSources["Driver Code"]);
      if (!code) return "";
      return String(code).startsWith("Driver:") ? String(code) : `Driver:${code}`;
    },
    "Memo": () => "Hire Commission",
    "ItemRate": dateRangeSources["Final Price"],
    "*ItemAmount": (r) => {
      const rate = parseFloat(String(sourceValue(r, dateRangeSources["Final Price"])).replace(/,/g, ""));
      if (!Number.isFinite(rate)) return "";
      const qty = parseFloat(cashSources["ItemQuantity"](r));
      const pct = Number.isFinite(qty) ? 0.1 + qty : 0.1;
      return (rate * pct).toFixed(2);
    },
    "*DueDate": (r) => {
      const d = (r.end_date || "").split(/[T ]/)[0];
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      if (!m) return "";
      const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 7));
      return dt.toISOString().slice(0, 10);
    },
    "vehicle_type": "vehicle_type",
    "item_description": (r) => {
      const base = sourceValue(r, "item_description");
      const nature = String(sourceValue(r, dateRangeSources["Journey Type"]) || "").toLowerCase();
      const suffix = nature.includes("return") ? "Return" : nature.includes("drop") ? "Drop" : "";
      return suffix ? `${base}/${suffix}` : base;
    },
    "ItemQuantity": (r) => {
      const raw = String(sourceValue(r, "increment") ?? "").replace(/,/g, "").trim();
      if (!raw) return "";
      const n = parseFloat(raw);
      return Number.isFinite(n) ? (n / 100).toFixed(2) : raw;
    },
  };
  const creditSources = {
    ...cashSources,
    "Driver Code": "company_name",
  };
  const creditNoteSources = {
    ...cashSources,
    "Driver Code": "DriverID",
    "Booking Ref": (r) => {
      const ref = sourceValue(r, dateRangeSources["Booking Ref"]);
      if (!ref) return "";
      return String(ref).toUpperCase().startsWith("C") ? String(ref) : `C${ref}`;
    },
    "Memo": () => "Hire Commission 90%",
    "*ItemAmount": (r) => {
      const total = parseFloat(String(sourceValue(r, "total amount") ?? "").replace(/,/g, ""));
      if (!Number.isFinite(total)) return "";
      const misc = parseFloat(String(sourceValue(r, "driver misc sum") ?? "").replace(/,/g, ""));
      const miscVal = Number.isFinite(misc) ? misc : 0;
      return ((total - miscVal) * 0.9).toFixed(2);
    },
  };
  const creditColumns = cashColumns.filter((c) => c !== "*ItemAmount");
  const creditNoteColumns = cashColumns.filter(
    (c) => !["*DueDate", "vehicle_type", "ItemRate"].includes(c)
  );
  const activeColumns =
    paymentType === "CREDIT"
      ? creditColumns
      : paymentType === "CREDIT_NOTE"
      ? creditNoteColumns
      : isFormattedReport
      ? cashColumns
      : dateRangeColumns;
  const activeSources =
    paymentType === "CREDIT_NOTE"
      ? creditNoteSources
      : paymentType === "CREDIT"
      ? creditSources
      : isFormattedReport
      ? cashSources
      : dateRangeSources;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  function sourceValue(row, source) {
    if (!source) return "";
    if (typeof source === "function") return source(row) ?? "";
    const key = Object.keys(row).find((k) => norm(k) === norm(source));
    return key === undefined ? "" : row[key];
  }

  async function load() {
    const res = await fetch("/api/records", { cache: "no-store" });
    const json = await res.json();
    if (json.error) setStatus(json.error);
    else setRows(json.rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function onUpload(e) {
    e.preventDefault();
    const file = e.target.file.files[0];
    if (!file) return;
    setBusy(true);
    setStatus("Uploading...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    setStatus(json.error ? `Error: ${json.error}` : `Saved ${json.inserted} rows`);
    setBusy(false);
    e.target.reset();
    load();
  }

  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];

  const isAdvanceRow = (r) => {
    const val =
      sourceValue(r, dateRangeSources["Advance Paid"]) ||
      r.advance_payment ||
      r["Advance Paid"] ||
      r["advance_payment"] ||
      r.advance;
    if (val === undefined || val === null) return false;
    const s = String(val).trim();
    if (!s || s === "0" || s === "0.0" || s === "0.00") return false;
    const num = parseFloat(s.replace(/,/g, ""));
    if (!isNaN(num) && num <= 0) return false;
    if (s.toLowerCase() === "false" || s.toLowerCase() === "no") return false;
    return true;
  };

  const filteredRows = rows.filter((r) => {
    if (paymentType === "ADVANCE") {
      if (!isAdvanceRow(r)) return false;
    } else if (isAdvanceRow(r)) {
      return false;
    } else if (paymentType === "CASH") {
      const settlement = String(r["Settlement Type"] || "").toUpperCase();
      const payment = String(r["Payment Type"] || "").toUpperCase();
      if (!settlement.includes("CASH") && payment !== "CA") return false;
    } else if (paymentType === "CREDIT" || paymentType === "CREDIT_NOTE") {
      const settlement = String(r["Settlement Type"] || "").toUpperCase();
      const payment = String(r["Payment Type"] || "").toUpperCase();
      if (!settlement.includes("CREDIT") && payment !== "CP") return false;
    }

    const rowDate = (r.end_date || r.pickdatetime || "").split(/[T ]/)[0];
    if (startDate && rowDate && rowDate < startDate) return false;
    if (endDate && rowDate && rowDate > endDate) return false;
    if ((startDate || endDate) && !rowDate) return false;

    return true;
  });

  const displayedReportRows = filteredRows.filter((r) => {
    if (!reportSearch.trim()) return true;
    const q = reportSearch.toLowerCase();
    return activeColumns.some((c) => {
      const val = sourceValue(r, activeSources[c]);
      return String(val ?? "").toLowerCase().includes(q);
    });
  });

  const displayedUploadRows = rows.filter((r) => {
    if (!uploadSearch.trim()) return true;
    const q = uploadSearch.toLowerCase();
    return Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q));
  });

  function downloadCSV() {
    const escape = (val) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const headerRow = activeColumns.map((c) => escape(labelOf(c))).join(",");
    const dataRows = displayedReportRows.map((r) =>
      activeColumns.map((c) => escape(sourceValue(r, activeSources[c]))).join(",")
    );
    const csvContent = [headerRow, ...dataRows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const typeSuffix = paymentType === "ALL" ? "" : `_${paymentType.toLowerCase()}`;
    const dateSuffix = startDate && endDate ? `_${startDate}_to_${endDate}` : startDate ? `_from_${startDate}` : endDate ? `_to_${endDate}` : "";
    a.download = `date_range_report${typeSuffix}${dateSuffix || "_" + new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1>QB Report</h1>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={t === tab ? "tab active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Date Range Report" && (
        <>
          <div className="filters">
            <label>
              From:
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              To:
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            {(startDate || endDate) && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear Dates
              </button>
            )}
            <div className="filter-btn-group">
              <button
                type="button"
                className={paymentType === "ALL" ? "filter-btn active" : "filter-btn"}
                onClick={() => setPaymentType("ALL")}
              >
                All
              </button>
              <button
                type="button"
                className={paymentType === "CASH" ? "filter-btn active" : "filter-btn"}
                onClick={() => setPaymentType("CASH")}
              >
                Cash
              </button>
              <button
                type="button"
                className={paymentType === "CREDIT" ? "filter-btn active" : "filter-btn"}
                onClick={() => setPaymentType("CREDIT")}
              >
                Credit
              </button>
              <button
                type="button"
                className={paymentType === "CREDIT_NOTE" ? "filter-btn active" : "filter-btn"}
                onClick={() => setPaymentType("CREDIT_NOTE")}
              >
                Credit Note
              </button>
              <button
                type="button"
                className={paymentType === "ADVANCE" ? "filter-btn active" : "filter-btn"}
                onClick={() => setPaymentType("ADVANCE")}
              >
                Advance
              </button>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder="Search in report..."
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              style={{ minWidth: "170px" }}
            />
            {reportSearch && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => setReportSearch("")}
              >
                Clear Search
              </button>
            )}
            <button
              type="button"
              className="download-btn"
              onClick={downloadCSV}
              disabled={!displayedReportRows.length}
            >
              Download CSV
            </button>
            <span style={{ marginLeft: "auto", fontSize: "13px", color: "#666" }}>
              {displayedReportRows.length} {displayedReportRows.length === 1 ? "record" : "records"}
            </span>
          </div>
          <div className="wrap">
            <table>
              <thead>
                <tr>{activeColumns.map((c) => <th key={c}>{labelOf(c)}</th>)}</tr>
              </thead>
              <tbody>
                {displayedReportRows.map((r, i) => (
                  <tr key={i}>
                    {activeColumns.map((c) => (
                      <td key={c}>{String(sourceValue(r, activeSources[c]) ?? "")}</td>
                    ))}
                  </tr>
                ))}
                {!displayedReportRows.length && (
                  <tr>
                    <td colSpan={activeColumns.length} style={{ textAlign: "center", padding: "24px", color: "#666" }}>
                      {filteredRows.length ? "No records match your search." : "No records match the selected filter."}
                    </td>
                  </tr>
                )}
              </tbody>
              {paymentType === "ALL" && (
                <tfoot>
                  <tr style={{ fontWeight: 800, fontSize: "15px", background: "#fef3c7", color: "#78350f", borderTop: "3px solid #f59e0b" }}>
                    {activeColumns.map((c, idx) => {
                      if (["Final Price", "SC Comm", "Driver Comm"].includes(c)) {
                        const total = displayedReportRows.reduce((sum, r) => {
                          const n = parseFloat(String(sourceValue(r, activeSources[c]) ?? "").replace(/,/g, ""));
                          return sum + (Number.isFinite(n) ? n : 0);
                        }, 0);
                        return <td key={c}>{total.toFixed(2)}</td>;
                      }
                      return <td key={c}>{idx === 0 ? "Total" : ""}</td>;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
      {tab === "Compare Reports" && (
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          {[
            { label: "Report 1", data: compareLeft, setter: setCompareLeft },
            { label: "Report 2", data: compareRight, setter: setCompareRight },
          ].map(({ label, data, setter }) => {
            const cols = [...new Set(data.rows.flatMap((r) => Object.keys(r)))];
            return (
              <div key={label} style={{ flex: 1, minWidth: 0, border: "1px solid #ddd", borderRadius: "8px", padding: "12px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                  <strong>{label}</strong>
                  <input type="file" accept=".csv" onChange={(e) => onCompareFile(e, setter)} />
                  <span style={{ marginLeft: "auto", fontSize: "13px", color: "#666" }}>
                    {data.rows.length} {data.rows.length === 1 ? "record" : "records"}
                  </span>
                </div>
                <div className="wrap">
                  <table>
                    <thead>
                      <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, i) => (
                        <tr key={i}>{cols.map((c) => <td key={c}>{String(r[c] ?? "")}</td>)}</tr>
                      ))}
                      {!data.rows.length && (
                        <tr>
                          <td colSpan={cols.length || 1} style={{ textAlign: "center", padding: "24px", color: "#666" }}>
                            No file selected.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === "Compare Reports" && (
        <div style={{ margin: "12px 0" }}>
          <button
            type="button"
            className="download-btn"
            onClick={runCompare}
            disabled={!compareLeft.rows.length || !compareRight.rows.length}
          >
            Compare Reports
          </button>
          {compareResult?.error && <span style={{ marginLeft: "12px", color: "#b91c1c" }}>{compareResult.error}</span>}
          {compareResult && !compareResult.error && (
            <div style={{ marginTop: "12px" }}>
              <p>
                <strong>Matching:</strong> {compareResult.matched} &nbsp;|&nbsp;
                <strong>Only in Report 1:</strong> {compareResult.onlyLeft.length} &nbsp;|&nbsp;
                <strong>Only in Report 2:</strong> {compareResult.onlyRight.length} &nbsp;|&nbsp;
                <strong>Differing values:</strong> {compareResult.differences.length}
              </p>
              <div className="wrap">
                <table>
                  <thead>
                    <tr><th>Booking ID</th><th>Field</th><th>Report 1</th><th>Report 2</th></tr>
                  </thead>
                  <tbody>
                    {compareResult.onlyLeft.map((id) => (
                      <tr key={"l" + id}><td>{id}</td><td colSpan={3}>Only in Report 1</td></tr>
                    ))}
                    {compareResult.onlyRight.map((id) => (
                      <tr key={"r" + id}><td>{id}</td><td colSpan={3}>Only in Report 2</td></tr>
                    ))}
                    {compareResult.differences.map((d, i) => (
                      <tr key={"d" + i}><td>{d.id}</td><td>{d.field}</td><td>{String(d.a ?? "")}</td><td>{String(d.b ?? "")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {tab !== "Upload" && tab !== "Date Range Report" && tab !== "Compare Reports" && <div className="empty">{tab}</div>}
      {tab === "Upload" && (<>
      <form onSubmit={onUpload} className="upload">
        <input type="file" name="file" accept=".csv" required />
        <button type="submit" disabled={busy}>Upload CSV</button>
        <span>{status}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search uploaded records..."
            value={uploadSearch}
            onChange={(e) => setUploadSearch(e.target.value)}
            style={{ minWidth: "200px" }}
          />
          {uploadSearch && (
            <button type="button" className="clear-btn" onClick={() => setUploadSearch("")}>
              Clear Search
            </button>
          )}
          <span style={{ fontSize: "13px", color: "#666", whiteSpace: "nowrap" }}>
            {displayedUploadRows.length} {displayedUploadRows.length === 1 ? "record" : "records"}
          </span>
        </div>
      </form>

      <div className="wrap">
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {displayedUploadRows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => <td key={c}>{String(r[c] ?? "")}</td>)}
              </tr>
            ))}
            {!displayedUploadRows.length && (
              <tr>
                <td colSpan={columns.length || 1} style={{ textAlign: "center", padding: "24px", color: "#666" }}>
                  {rows.length ? "No records match your search." : "No data yet. Upload a CSV."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>)}
    </main>
  );
}
