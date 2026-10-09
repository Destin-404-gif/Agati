"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/** Shared easing so every reveal on the page feels like one system. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.9, ease: EASE } },
};

type ContainerProps = {
  children: ReactNode;
  className?: string;
  /** Seconds between each RevealItem's entrance. */
  stagger?: number;
  delay?: number;
  /** Fraction of the element that must be visible before triggering. */
  amount?: number;
};

/**
 * Scroll-triggered container. Pair with <RevealItem> children - variants
 * propagate down the tree, so grids stagger without any index bookkeeping.
 */
export function Reveal({
  children,
  className,
  stagger = 0.12,
  delay = 0,
  amount = 0.2,
}: ContainerProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

type ItemProps = {
  children: ReactNode;
  className?: string;
  /** Fade only - used for imagery where vertical travel looks wrong. */
  fade?: boolean;
};

/** A single staggered cell inside a <Reveal>. */
export function RevealItem({ children, className, fade = false }: ItemProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} variants={fade ? fadeIn : fadeUp}>
      {children}
    </motion.div>
  );
}
