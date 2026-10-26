"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { avatarSeed } from "../lib/avatar";
function AnimatedAvatar({
  id,
  size,
  alt,
  className,
}: {
  id: string;
  size: number;
  alt: string;
  className: string;
}) {
  const element = useRef<SVGSVGElement | null>(null);
  const [visible, setVisible] = useState(true);
  const { ref } = useGaze({ travel: 3.5, lookAt: visible ? "pointer" : null });
  const attach = useCallback(
    (node: SVGSVGElement | null) => {
      element.current = node;
      ref(node);
    },
    [ref],
  );
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    let inView = true;
    const sync = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <Blobatar
      ref={attach}
      name={avatarSeed(id)}
      size={size}
      background="circle"
      animate="always"
      title={alt || undefined}
      focusable="false"
      data-testid="profile-avatar"
      data-avatar-kind="blobatar"
      data-avatar-paused={!visible}
      className={`profile-blobatar shrink-0 rounded-full bg-muted ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
export function ProfileAvatar({
  id,
  src,
  size = 96,
  alt = "",
  className = "",
}: {
  id: string;
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState("");
  if (!src || failed === src)
    return (
      <AnimatedAvatar id={id} size={size} alt={alt} className={className} />
    );
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      onError={() => setFailed(src)}
      decoding="async"
      referrerPolicy="no-referrer"
      data-testid="profile-avatar"
      data-avatar-kind="photo"
      className={`shrink-0 rounded-full bg-muted object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
