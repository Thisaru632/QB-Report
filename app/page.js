"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Upload");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentType, setPaymentType] = useState("ALL");
  const tabs = ["Upload", "Date Range Report"];
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
  const labelOf = (c) => (paymentType === "CASH" ? cashLabels[c] ?? c : c);
  const cashSources = {
    ...dateRangeSources,
    "Memo": () => "Hire Commission",
    "ItemRate": dateRangeSources["Final Price"],
    "*DueDate": (r) => {
      const d = (r.end_date || "").split(/[T ]/)[0];
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      if (!m) return "";
      const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 7));
      return dt.toISOString().slice(0, 10);
    },
    "vehicle_type": "vehicle_type",
    "item_description": "item_description",
  };
  const activeColumns = paymentType === "CASH" ? cashColumns : dateRangeColumns;
  const activeSources = paymentType === "CASH" ? cashSources : dateRangeSources;
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

  const filteredRows = rows.filter((r) => {
    if (paymentType === "CASH") {
      const settlement = String(r["Settlement Type"] || "").toUpperCase();
      const payment = String(r["Payment Type"] || "").toUpperCase();
      if (!settlement.includes("CASH") && payment !== "CA") return false;
    } else if (paymentType === "CREDIT") {
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

  function downloadCSV() {
    const escape = (val) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const headerRow = activeColumns.map((c) => escape(labelOf(c))).join(",");
    const dataRows = filteredRows.map((r) =>
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
            </div>
            <button
              type="button"
              className="download-btn"
              onClick={downloadCSV}
              disabled={!filteredRows.length}
            >
              Download CSV
            </button>
            <span style={{ marginLeft: "auto", fontSize: "13px", color: "#666" }}>
              {filteredRows.length} {filteredRows.length === 1 ? "record" : "records"}
            </span>
          </div>
          <div className="wrap">
            <table>
              <thead>
                <tr>{activeColumns.map((c) => <th key={c}>{labelOf(c)}</th>)}</tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={i}>
                    {activeColumns.map((c) => (
                      <td key={c}>{String(sourceValue(r, activeSources[c]) ?? "")}</td>
                    ))}
                  </tr>
                ))}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={activeColumns.length} style={{ textAlign: "center", padding: "24px", color: "#666" }}>
                      No records match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab !== "Upload" && tab !== "Date Range Report" && <div className="empty">{tab}</div>}
      {tab === "Upload" && (<>
      <form onSubmit={onUpload} className="upload">
        <input type="file" name="file" accept=".csv" required />
        <button type="submit" disabled={busy}>Upload CSV</button>
        <span>{status}</span>
      </form>

      <div className="wrap">
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => <td key={c}>{String(r[c] ?? "")}</td>)}
              </tr>
            ))}
            {!rows.length && (
              <tr><td>No data yet. Upload a CSV.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>)}
    </main>
  );
}
