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
      .limit(5000)
      .toArray();
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
