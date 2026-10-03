"use client";

import type * as React from "react";
import "blobatar/motion.css";
/**
 * Aliased, because the component this file exports is also called `Blobatar` —
 * `BlobatarAvatar` says blob-avatar-avatar, and the name a shadcn project wants
 * at its call sites is the short one.
 *
 * The two are not interchangeable and the alias is what keeps that visible
 * here: this one takes a `name` and renders a picture, the export below takes a
 * `name` *and* a `src` and renders an Avatar that falls back to the picture. A
 * project that imports both wants the aliasing to be deliberate.
 */
import { Blobatar as Generated } from "@blobatar/react";
import {
  type Avatar,
  AvatarFallback,
  AvatarImage,
} from "@openbots/ui/components/avatar";

/**
 * Distributive, and that is not pedantry. The generated blobatar's props are a
 * union — the animated arm carries props the static one does not — and a plain
 * `Omit` over a union collapses it to the keys the arms share, silently
 * dropping `animate` and everything gated behind it.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type GeneratedOptions = DistributiveOmit<
  React.ComponentProps<typeof Generated>,
  "name"
>;

export type BlobatarProps = React.ComponentProps<typeof Avatar> & {
  /**
   * Who the avatar is for. A username, a display name, an email, an id — any
   * string, and the same string always renders the same blobatar.
   */
  name: string;
  /** A real profile image, when there is one. The blobatar is the fallback. */
  src?: string;
  /** Defaults to `name`. Ignored when there is no `src`. */
  alt?: string;
  /**
   * Anything else the blobatar takes: `palette`, `animate`, `expression`, …
   *
   * Including `title`, which is how you label it. Without one the blobatar is
   * decorative — `alt=""`, skipped by screen readers — which is the right
   * default when the name is already written next to the avatar, and the wrong
   * one when the avatar stands alone. Pass `{ title: name }` in that case.
   */
  blobatar?: GeneratedOptions;
};

export function Blobatar({
  name,
  src,
  alt,
  blobatar,
  className,
  ...props
}: BlobatarProps) {
  return (
    <Generated
      {...blobatar}
      name={name}
      className={`m-0! size-7 rounded-full px-0! ${className}`}
    />
  );
}
