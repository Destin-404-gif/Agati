import type { Metadata } from "next";
import CartView from "@/components/cart/CartView";
import { SITE } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Your Cart",
  description: `Review the pieces in your cart before ordering from ${SITE.name}. Prices are confirmed from our workshop stock at this point.`,
  robots: { index: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-32 sm:px-8">
      <header className="mb-12">
        <p className="text-eyebrow text-terracotta">Your order</p>
        <h1 className="mt-4 font-display text-4xl font-black tracking-[-0.03em] text-espresso sm:text-5xl">
          Your Cart
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-espresso/55">
          We price everything from the workshop database when this page loads, so what
          you see is what we can actually deliver.
        </p>
      </header>

      <CartView />
    </div>
  );
}