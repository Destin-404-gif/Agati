import type { Metadata } from "next";
import CheckoutForm from "@/components/cart/CheckoutForm";
import { CONTACT, SITE } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Checkout",
  description: `Confirm your ${SITE.name} order. Pay on delivery in ${SITE.tagline.replace(/.*made in /, "")}`,
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-32 sm:px-8">
      <header className="mb-12">
        <p className="text-eyebrow text-terracotta">Almost there</p>
        <h1 className="mt-4 font-display text-4xl font-black tracking-[-0.03em] text-espresso sm:text-5xl">
          Checkout
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-espresso/55">
          No online payment - we confirm the order with you on{" "}
          <a href={CONTACT.phoneHref} className="text-espresso underline underline-offset-4">
            {CONTACT.phone}
          </a>{" "}
          or WhatsApp, then you pay on delivery.
        </p>
      </header>

      <CheckoutForm />
    </div>
  );
}