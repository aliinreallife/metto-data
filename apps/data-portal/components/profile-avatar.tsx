"use client";
import { useState } from "react";
import { defaultAvatar } from "../lib/avatar";
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
  const uploaded = !!src && failed !== src;
  return (
    <img
      src={uploaded ? src : defaultAvatar(id)}
      width={size}
      height={size}
      alt={alt}
      onError={uploaded ? () => setFailed(src) : undefined}
      decoding="async"
      referrerPolicy="no-referrer"
      data-testid="profile-avatar"
      data-avatar-kind={uploaded ? "photo" : "blobatar"}
      className={`shrink-0 rounded-full bg-muted object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
