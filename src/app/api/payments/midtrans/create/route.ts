import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

type PaymentMode = "consultation" | "tip";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;

  if (!url || !anon || !service || !serverKey) {
    return NextResponse.json(
      { error: "Pembayaran belum dikonfigurasi. Admin perlu mengisi MIDTRANS_SERVER_KEY dan SUPABASE_SERVICE_ROLE_KEY di environment server." },
      { status: 503 },
    );
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sesi login diperlukan." }, { status: 401 });

  const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Sesi login tidak valid." }, { status: 401 });

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Data transaksi tidak valid." }, { status: 400 });
  }
  const input = payload as { consultationId?: unknown; mode?: unknown; tipAmount?: unknown };
  const requestedMode = input.mode === undefined ? "consultation" : input.mode;
  if (
    typeof input.consultationId !== "string"
    || (requestedMode !== "consultation" && requestedMode !== "tip")
  ) {
    return NextResponse.json({ error: "Data transaksi tidak valid." }, { status: 400 });
  }
  const mode: PaymentMode = requestedMode;
  if (mode === "tip" && (typeof input.tipAmount !== "number" || !Number.isSafeInteger(input.tipAmount))) {
    return NextResponse.json({ error: "Nominal tip tidak valid." }, { status: 400 });
  }

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: sessionError } = await admin
    .from("consultations")
    .select("id,user_id,expert_user_id,status,payment_status,payment_timing,completion_requested,locked_fee")
    .eq("id", input.consultationId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: "Data konsultasi gagal diperiksa." }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Sesi konsultasi tidak ditemukan." }, { status: 404 });
  if (session.user_id !== user.id) return NextResponse.json({ error: "Konsultasi ini bukan milik akun Anda." }, { status: 403 });

  if (mode === "consultation") {
    if (session.status === "completed" || session.payment_status === "paid") {
      return NextResponse.json({ error: "Sesi ini sudah selesai atau lunas." }, { status: 409 });
    }
    if (session.payment_timing === "after" && !session.completion_requested) {
      return NextResponse.json({ error: "Pembayaran baru tersedia setelah ahli menandai sesi siap ditutup." }, { status: 409 });
    }
  } else if (session.payment_status !== "paid" || session.status !== "completed") {
    return NextResponse.json({ error: "Tip dapat dikirim setelah sesi lunas dan selesai." }, { status: 409 });
  }

  const { data: expert, error: expertError } = await admin
    .from("expert_profiles")
    .select("full_name,is_verified")
    .eq("user_id", session.expert_user_id)
    .maybeSingle();
  if (expertError) return NextResponse.json({ error: "Data ahli gagal diperiksa." }, { status: 500 });
  if (!expert) return NextResponse.json({ error: "Data ahli tidak tersedia." }, { status: 422 });
  if (!expert.is_verified) return NextResponse.json({ error: "Ahli belum terverifikasi." }, { status: 422 });

  const amount = mode === "tip" ? input.tipAmount as number : Number(session.locked_fee);
  if (!Number.isSafeInteger(amount) || amount < 1000) {
    return NextResponse.json(
      { error: mode === "tip" ? "Tip minimum Rp1.000." : "Ahli belum menetapkan tarif valid untuk sesi ini." },
      { status: 422 },
    );
  }

  const { data: pending, error: pendingError } = await admin
    .from("payments")
    .select("provider_order_id,invoice_number,checkout_url,amount,payment_kind")
    .eq("consultation_id", input.consultationId)
    .eq("payer_user_id", user.id)
    .eq("payment_kind", mode)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingError) return NextResponse.json({ error: "Transaksi sebelumnya gagal diperiksa." }, { status: 500 });
  if (pending && pending.amount === amount && pending.checkout_url) {
    return NextResponse.json({
      orderId: pending.provider_order_id,
      invoice: pending.invoice_number,
      checkoutUrl: pending.checkout_url,
      amount,
      mode,
    });
  }

  const orderId = `SK-${input.consultationId.replaceAll("-", "").slice(0, 16)}-${Date.now()}`;
  const invoice = `INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const base = process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const auth = Buffer.from(`${serverKey}:`).toString("base64");

  try {
    const title = mode === "tip" ? `Tip untuk ${expert.full_name}` : `Konsultasi ahli · ${expert.full_name}`;
    const finishUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/pembayaran/${input.consultationId}?status=finish`;
    const response = await fetch(`${base}/snap/v1/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: session.expert_user_id, price: amount, quantity: 1, name: title.slice(0, 50) }],
        customer_details: {
          email: user.email || undefined,
          first_name: String(user.user_metadata?.full_name || user.email || "Pengguna").slice(0, 40),
        },
        callbacks: { finish: finishUrl },
        expiry: { unit: "hour", duration: 24 },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error_messages?.join(" ") || "Midtrans tidak dapat membuat transaksi.");
    if (typeof result.redirect_url !== "string" || typeof result.token !== "string") {
      throw new Error("Respons checkout Midtrans tidak lengkap.");
    }

    const { error: insertError } = await admin.from("payments").insert({
      consultation_id: input.consultationId,
      payer_user_id: user.id,
      expert_user_id: session.expert_user_id,
      provider: "midtrans",
      payment_kind: mode,
      provider_order_id: orderId,
      amount,
      tip_amount: mode === "tip" ? amount : 0,
      invoice_number: invoice,
      checkout_url: result.redirect_url,
      snap_token: result.token,
      status: "pending",
    });
    if (insertError) throw new Error(`Transaksi Midtrans dibuat, tetapi gagal disimpan: ${insertError.message}`);

    if (mode === "consultation") {
      const { error: updateError } = await admin
        .from("consultations")
        .update({ payment_status: "pending", updated_at: new Date().toISOString() })
        .eq("id", input.consultationId);
      if (updateError) throw new Error(`Transaksi tersimpan, tetapi status konsultasi gagal diperbarui: ${updateError.message}`);
    }

    return NextResponse.json({ orderId, invoice, checkoutUrl: result.redirect_url, snapToken: result.token, amount, mode });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transaksi gagal dibuat." },
      { status: 502 },
    );
  }
}
