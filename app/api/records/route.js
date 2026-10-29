import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await clientPromise;
    const rows = await client
      .db("fleet")
      .collection("qb_reports")
      .find({}, { projection: { _id: 0, _uploadedAt: 0, _fileName: 0 } })
      .sort({ _uploadedAt: -1, _id: -1 })
      .limit(50000)
      .toArray();
    const isCancelled = (r) =>
      Object.entries(r).some(
        ([k, v]) =>
          k.toLowerCase().replace(/[^a-z]/g, "") === "tripstatus" &&
          /cancel/i.test(String(v ?? ""))
      );
    return NextResponse.json({ rows: rows.filter((r) => !isCancelled(r)) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
