import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

type MidtransNotification = {
  order_id: string;
  status_code: string | number;
  gross_amount: string | number;
  signature_key: string;
  transaction_status?: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
};

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!url || !service || !key) return NextResponse.json({ error: "Webhook belum dikonfigurasi." }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  if (
    !body
    || typeof body !== "object"
    || !("order_id" in body)
    || typeof body.order_id !== "string"
    || !("signature_key" in body)
    || typeof body.signature_key !== "string"
    || !("status_code" in body)
    || !["string", "number"].includes(typeof body.status_code)
    || !("gross_amount" in body)
    || !["string", "number"].includes(typeof body.gross_amount)
    || ("transaction_status" in body && typeof body.transaction_status !== "string")
    || ("fraud_status" in body && typeof body.fraud_status !== "string")
    || ("transaction_id" in body && typeof body.transaction_id !== "string")
    || ("payment_type" in body && typeof body.payment_type !== "string")
  ) {
    return NextResponse.json({ error: "Notifikasi tidak valid." }, { status: 400 });
  }

  const notification = body as MidtransNotification;
  const source = `${notification.order_id}${notification.status_code}${notification.gross_amount}${key}`;
  const expected = createHash("sha512").update(source).digest("hex");
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(notification.signature_key);
  if (expectedBytes.length !== signatureBytes.length || !timingSafeEqual(expectedBytes, signatureBytes)) {
    return NextResponse.json({ error: "Signature tidak cocok." }, { status: 401 });
  }

  let status: "pending" | "paid" | "expired" | "failed" | "refunded" = "pending";
  if (notification.transaction_status === "settlement"
    || (notification.transaction_status === "capture"
      && (!notification.fraud_status || notification.fraud_status === "accept"))) {
    status = "paid";
  } else if (notification.transaction_status === "expire") {
    status = "expired";
  } else if (["deny", "cancel"].includes(notification.transaction_status || "")) {
    status = "failed";
  } else if (["refund", "partial_refund"].includes(notification.transaction_status || "")) {
    status = "refunded";
  }
  if (status === "pending") return NextResponse.json({ received: true });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: payment, error } = await admin
    .from("payments")
    .select("id,amount,status,paid_at")
    .eq("provider_order_id", notification.order_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Transaksi gagal diperiksa." }, { status: 500 });
  if (!payment) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  if (Number(notification.gross_amount) !== payment.amount) {
    return NextResponse.json({ error: "Nominal notifikasi tidak cocok." }, { status: 400 });
  }

  if (payment.status === "refunded" || (payment.status === "paid" && status !== "refunded")) {
    return NextResponse.json({ received: true });
  }

  const { error: updateError } = await admin
    .from("payments")
    .update({
      status,
      provider_transaction_id: notification.transaction_id || null,
      payment_method: notification.payment_type || null,
      paid_at: status === "paid" ? payment.paid_at || new Date().toISOString() : payment.paid_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ received: true });
}
