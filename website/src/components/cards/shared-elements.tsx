"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";
import pageContent from "@/content/page.json";
import type { PageContent } from "@/types/page-content";

export type Mode = "desktop" | "mobile";
export type ButtonAction = (id: string, mode: Mode, event: MouseEvent<HTMLElement>) => boolean;
export type ElementProps = {
  id: string;
  className: string;
  children?: ReactNode;
  style?: CSSProperties;
  scaleClassName?: string;
};
export type GeneratedElementSpec = {
  id: string;
  classToken: string;
  scaleClassToken?: string;
};

export const content = pageContent as PageContent;

type QueuedImageLoad = {
  key: string;
  order: number;
  position: number;
  cancelled: boolean;
  timeoutId?: number;
  start: (done: () => void) => void;
};

const IMAGE_QUEUE_TIMEOUT_MS = 4500;
let imageQueueOrder = 0;
let activeImageLoad: QueuedImageLoad | null = null;
const queuedImageLoads: QueuedImageLoad[] = [];

function runNextQueuedImageLoad() {
  if (activeImageLoad) return;

  queuedImageLoads.sort((a, b) => a.position - b.position || a.order - b.order);
  const next = queuedImageLoads.shift();
  if (!next) return;
  if (next.cancelled) {
    runNextQueuedImageLoad();
    return;
  }

  activeImageLoad = next;
  let completed = false;
  const done = () => {
    if (completed) return;
    completed = true;
    if (next.timeoutId) window.clearTimeout(next.timeoutId);
    if (activeImageLoad === next) activeImageLoad = null;
    window.setTimeout(runNextQueuedImageLoad, 80);
  };

  next.timeoutId = window.setTimeout(done, IMAGE_QUEUE_TIMEOUT_MS);
  next.start(done);
}

function enqueueImageLoad(key: string, position: number, start: (done: () => void) => void) {
  const item: QueuedImageLoad = {
    key,
    order: imageQueueOrder++,
    position,
    cancelled: false,
    start,
  };

  queuedImageLoads.push(item);
  runNextQueuedImageLoad();

  return () => {
    item.cancelled = true;
    const queuedIndex = queuedImageLoads.indexOf(item);
    if (queuedIndex >= 0) queuedImageLoads.splice(queuedIndex, 1);

    if (activeImageLoad === item) {
      if (item.timeoutId) window.clearTimeout(item.timeoutId);
      activeImageLoad = null;
      runNextQueuedImageLoad();
    }
  };
}

export function useSequentialImageLoad<T extends HTMLElement>(key: string, eager = false) {
  const ref = useRef<T | null>(null);
  const finishRef = useRef<() => void>(() => {});
  const finishedRef = useRef(false);
  const [requested, setRequested] = useState(eager);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (requested) return;
    const node = ref.current;
    if (!node) {
      const frame = window.requestAnimationFrame(() => setRequested(true));
      return () => window.cancelAnimationFrame(frame);
    }

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setRequested(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequested(true);
          observer.disconnect();
        }
      },
      { rootMargin: "520px 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [requested]);

  useEffect(() => {
    if (!requested || shouldLoad) return;

    const node = ref.current;
    const rect = node?.getBoundingClientRect();
    const position = rect ? rect.top + window.scrollY : Number.MAX_SAFE_INTEGER;

    return enqueueImageLoad(key, position, (done) => {
      finishRef.current = done;
      setShouldLoad(true);
    });
  }, [key, requested, shouldLoad]);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    finishRef.current();
  };

  return { ref, shouldLoad, finish };
}

export const modeClassName = (mode: Mode, classToken: string) =>
  `tf-${mode === "desktop" ? "d" : "m"}-${classToken}`;

export const modeScaleClassName = (mode: Mode, classToken?: string) =>
  mode === "mobile" && classToken ? `tf-scale-m-${classToken}` : undefined;

export function scaledChildren(scaleClassName: string | undefined, children: ReactNode) {
  if (!scaleClassName) return children;
  return <div className={`tf-scale-wrap ${scaleClassName}`}>{children}</div>;
}

export function BoxElement({ id, className, type, children, style, scaleClassName }: ElementProps & { type: "container" | "group" }) {
  return (
    <div className={`tf-el tf-${type} ${className}`} data-id={id} data-type={type} style={style}>
      {scaledChildren(scaleClassName, children)}
    </div>
  );
}

export function TextElement({ id, className, children, style, onClick }: ElementProps & { onClick?: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className={`tf-el tf-text ${className}`} data-id={id} data-type="text" style={style} onClick={onClick}>
      {content.texts[id] ?? ""}
      {children}
    </div>
  );
}

export function TextLinkElement({ id, className, href, children, style }: ElementProps & { href: string }) {
  return (
    <a className={`tf-el tf-text ${className}`} data-id={id} data-type="text" href={href} style={style}>
      {content.texts[id] ?? ""}
      {children}
    </a>
  );
}

export function ImageElement({ id, className, children, style, scaleClassName }: ElementProps) {
  const image = content.images[id];
  const { ref, shouldLoad, finish } = useSequentialImageLoad<HTMLDivElement>(`${id}:${image?.src ?? ""}`);

  return (
    <div ref={ref} className={`tf-el tf-image ${className}`} data-id={id} data-type="image" style={style}>
      {image?.src && shouldLoad ? (
        <Image
          src={image.src}
          alt={image.alt ?? ""}
          fill
          sizes="100vw"
          loading="lazy"
          unoptimized
          onLoad={finish}
          onError={finish}
        />
      ) : null}
      {scaledChildren(scaleClassName, children)}
    </div>
  );
}

export function ButtonElement({ id, mode, className, children, style, onAction }: ElementProps & { mode: Mode; onAction: ButtonAction }) {
  const button = content.buttons[id];
  const label = button?.label ?? "";
  const icon = button?.icon ? (
    <Image
      className={`tf-button-icon${label ? "" : " tf-button-icon-only"}`}
      src={button.icon}
      alt={label ? "" : button.iconAlt ?? ""}
      width={28}
      height={28}
      unoptimized
    />
  ) : null;
  const body = children ?? (button?.image ? (
    <Image className="tf-button-full-image" src={button.image} alt={button.alt ?? label} fill sizes="100vw" unoptimized />
  ) : (
    <>
      {button?.iconPosition === "left" ? icon : null}
      {label ? <span className="tf-button-label">{label}</span> : null}
      {button?.iconPosition !== "left" ? icon : null}
    </>
  ));
  const href = button?.href && button.href !== "#" ? button.href : undefined;
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (onAction(id, mode, event)) event.preventDefault();
  };
  const buttonClassName = `tf-el tf-button ${button?.icon ? "tf-button-with-icon " : ""}${className}`;

  if (href) {
    return (
      <a className={buttonClassName} data-id={id} data-type="button" href={href} target={button?.target || undefined} onClick={handleClick} style={style}>
        {body}
      </a>
    );
  }

  return (
    <button
      className={buttonClassName}
      data-id={id}
      data-type="button"
      type="button"
      onClick={handleClick}
      style={style}
      suppressHydrationWarning
    >
      {body}
    </button>
  );
}
