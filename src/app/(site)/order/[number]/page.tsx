import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, MessageCircle, Phone } from "lucide-react";
import { money } from "@/lib/format";
import { getOrderByNumber } from "@/lib/queries";
import { CONTACT, SITE, whatsappLink, whatsappOrderMessage } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Confirmation",
  robots: { index: false },
};

/** What the customer is told while waiting: workshop starts on pending. */
const STATUS_COPY: Record<string, string> = {
  pending: "Received - we are confirming your delivery date.",
  confirmed: "Confirmed - your pieces are being made.",
  shipped: "On the way to you.",
  delivered: "Delivered. Thank you.",
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const order = await getOrderByNumber(decodeURIComponent(number).toUpperCase());
  if (!order) notFound();

  const delivery = [
    order.delivery_sector,
    order.delivery_district,
    order.delivery_landmark,
  ]
    .filter(Boolean)
    .join(", ");

  const waMessage = whatsappOrderMessage({
    order_number: order.order_number,
    full_name: order.customer_name ?? "Customer",
    phone: order.customer_phone ?? CONTACT.phone,
    location: delivery || "Musanze, Rwanda",
    items: order.items.map((item) => ({
      name: item.name ?? "Item",
      variant_name: item.variant_name,
      quantity: item.quantity,
      line_total: item.line_total,
    })),
    total: order.total,
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-24 pt-32 sm:px-8">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-terracotta" aria-hidden="true" />
        <p className="mt-6 text-eyebrow text-terracotta">Order received</p>
        <h1 className="mt-4 font-display text-4xl font-black tracking-[-0.03em] text-espresso sm:text-5xl">
          Thank you, {(order.customer_name ?? "friend").split(" ")[0]}
        </h1>
        <p className="mt-4 text-sm text-espresso/55">
          Your order number is{" "}
          <span className="font-semibold text-espresso">{order.order_number}</span>. Keep it
          for any questions about this order.
        </p>
        <p className="mt-3 text-sm font-medium text-espresso/70">
          {STATUS_COPY[order.status] ?? "Received - we will be in touch."}
        </p>
      </div>

      {/* ------------------------------------------------------ WhatsApp */}
      <div className="mt-10 rounded-[2rem] bg-espresso p-7 text-cream sm:p-9">
        <h2 className="text-display text-xl">Send it to us on WhatsApp</h2>
        <p className="mt-2 text-sm leading-relaxed text-cream/55">
          Tap the button and the message is filled in with your order, so we can confirm
          the delivery date straight away.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={whatsappLink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-cream hover:text-espresso"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Send on WhatsApp
          </a>
          <a
            href={CONTACT.phoneHref}
            className="inline-flex items-center gap-2 rounded-full border border-cream/25 px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:border-terracotta hover:text-terracotta"
          >
            <Phone className="size-4" aria-hidden="true" />
            Call {CONTACT.phone}
          </a>
        </div>
      </div>

      {/* -------------------------------------------------------- receipt */}
      <div className="mt-10 rounded-[2rem] bg-white p-7 shadow-soft sm:p-9">
        <h2 className="text-display text-xl text-espresso">Your order</h2>

        <ul className="mt-7 flex flex-col divide-y divide-espresso/10">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-cream">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name ?? "Item"}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="size-full bg-sage/15" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-espresso">
                  {item.name ?? "Item"}
                </p>
                {item.variant_name && (
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-espresso/40">
                    {item.variant_name}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-espresso/45">
                  {item.quantity} × {money(item.unit_price)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-espresso">
                {money(item.line_total)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-espresso/10 pt-5">
          <span className="text-sm font-semibold text-espresso">Total</span>
          <span className="font-display text-2xl font-black tabular-nums text-espresso">
            {money(order.total)}
          </span>
        </div>

        {order.payment_method === "pay_on_delivery" && (
          <p className="mt-4 text-xs leading-relaxed text-espresso/50">
            Pay in cash when the pieces arrive. Nothing has been charged to a card.
          </p>
        )}

        <dl className="mt-7 grid gap-4 border-t border-espresso/10 pt-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/40">
              Deliver to
            </dt>
            <dd className="mt-1.5 flex items-start gap-2 text-espresso/70">
              <MapPin className="mt-0.5 size-4 shrink-0 text-terracotta" aria-hidden="true" />
              <span>
                {order.customer_name}
                <br />
                {order.customer_phone}
                <br />
                {delivery}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/40">
              Placed
            </dt>
            <dd className="mt-1.5 text-espresso/70">
              {new Date(order.created_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          {order.delivery_note && (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/40">
                Your note
              </dt>
              <dd className="mt-1.5 text-espresso/70">{order.delivery_note}</dd>
            </div>
          )}
        </dl>
      </div>

      <p className="mt-10 text-center text-xs leading-relaxed text-espresso/45">
        Something wrong with the order? Call{" "}
        <a href={CONTACT.phoneHref} className="text-espresso underline underline-offset-4">
          {CONTACT.phone}
        </a>{" "}
        or email{" "}
        <a href={CONTACT.emailHref} className="text-espresso underline underline-offset-4">
          {CONTACT.email}
        </a>{" "}
        quoting {order.order_number}.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/furniture"
          className="inline-flex items-center rounded-full bg-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta"
        >
          Keep browsing
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:border-terracotta hover:text-terracotta"
        >
          Back to {SITE.shortName}
        </Link>
      </div>
    </div>
  );
}