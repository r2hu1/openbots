"use client";

import { Button } from "@openbots/ui/components/button";
import * as React from "react";
import {
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
} from "reicon-react";
import type { SettingsTab } from "./settings-tab-items";
import { NAV_ITEMS } from "./settings-tab-items";

interface SettingsTabNavProps {
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  isOpen: boolean;
}

export function SettingsTabNav({
  activeTab,
  onSelectTab,
  isOpen,
}: SettingsTabNavProps) {
  const tabListRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateScrollButtons = React.useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollTabs = React.useCallback((direction: -1 | 1) => {
    const el = tabListRef.current;
    if (!el) return;
    el.scrollTo({
      left: el.scrollLeft + direction * 200,
      behavior: "smooth",
    });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const el = tabListRef.current;
    if (!el) return;

    const frame = requestAnimationFrame(updateScrollButtons);
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    const obs = new ResizeObserver(updateScrollButtons);
    obs.observe(el);
    if (el.firstElementChild) obs.observe(el.firstElementChild);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", updateScrollButtons);
      obs.disconnect();
    };
  }, [isOpen, updateScrollButtons]);

  React.useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTab]);

  return (
    <div className="flex min-w-0 items-center gap-1 px-3">
      <Button
        variant="secondary"
        type="button"
        aria-label="Scroll tabs left"
        disabled={!canScrollLeft}
        onClick={() => scrollTabs(-1)}
        size="icon-sm"
      >
        <IconChevronLeft className="size-4" />
      </Button>

      <div
        ref={tabListRef}
        role="tablist"
        className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain"
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <Button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node;
              }}
              type="button"
              size="sm"
              aria-selected={isActive}
              onClick={() => onSelectTab(id)}
              variant={isActive ? "default" : "secondary"}
            >
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </Button>
          );
        })}
      </div>

      <Button
        type="button"
        aria-label="Scroll tabs right"
        disabled={!canScrollRight}
        onClick={() => scrollTabs(1)}
        size="icon-sm"
        variant="secondary"
      >
        <IconChevronRight className="size-4" />
      </Button>
    </div>
  );
}
