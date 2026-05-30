"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import SkillAcquisitionPanel from "./SkillAcquisitionPanel";
import BehaviorReductionPanel from "./BehaviorReductionPanel";

const DATA_SECTIONS = [
  { id: "skill-acquisition", label: "Skill Acquisition" },
  { id: "behavior-reduction", label: "Behaviors" },
];

export default function DataCollectionPanel({
  loading,
  client,
  sessionDate = null,
  clientDomains,
  clientPrograms,
  clientTargets,
  sessionNotes,
  setSessionNotes,
  onPersistSessionNotes,
  scrollContainerRef,
}) {
  const [activeSection, setActiveSection] = useState(DATA_SECTIONS[0].id);

  useEffect(() => {
    const root = scrollContainerRef?.current;
    if (!root) return undefined;

    const sectionEls = DATA_SECTIONS.map((section) =>
      root.querySelector(`#dc-section-${section.id}`)
    ).filter(Boolean);

    if (!sectionEls.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const topMost = entries
          .filter((entry) => entry.boundingClientRect.top <= root.getBoundingClientRect().top + 72)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const picked = topMost || visible[0];
        const sectionId = picked?.target?.getAttribute("data-section");
        if (sectionId) setActiveSection(sectionId);
      },
      {
        root,
        rootMargin: "-72px 0px -55% 0px",
        threshold: [0, 0.15, 0.4, 0.75, 1],
      }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollContainerRef, loading]);

  const scrollToSection = useCallback(
    (sectionId) => {
      const root = scrollContainerRef?.current;
      const el = root?.querySelector(`#dc-section-${sectionId}`);
      if (!root || !el) return;

      const navHeight = 52;
      const top =
        root.scrollTop +
        el.getBoundingClientRect().top -
        root.getBoundingClientRect().top -
        navHeight;
      root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      setActiveSection(sectionId);
    },
    [scrollContainerRef]
  );

  return (
    <div className="w-full">
      <nav
        aria-label="Data collection sections"
        className="sticky top-0 z-20 -mx-6 mb-6 border-b border-slate-200 bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="flex flex-wrap gap-2">
          {DATA_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeSection === section.id
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="space-y-6">
        <div
          id="dc-section-skill-acquisition"
          data-section="skill-acquisition"
          className="scroll-mt-14"
        >
          <SkillAcquisitionPanel
            clientId={client?.id || client?.client_id || null}
            sessionDate={
              sessionDate ||
              sessionNotes?.soapDate ||
              new Date().toISOString().split("T")[0]
            }
            clientPrograms={clientPrograms}
            clientTargets={clientTargets}
            sessionNotes={sessionNotes}
            setSessionNotes={setSessionNotes}
            onPersistSessionNotes={onPersistSessionNotes}
          />
        </div>

        <div
          id="dc-section-behavior-reduction"
          data-section="behavior-reduction"
          className="scroll-mt-14"
        >
          <BehaviorReductionPanel
            sessionNotes={sessionNotes}
            setSessionNotes={setSessionNotes}
            onPersistSessionNotes={onPersistSessionNotes}
          />
        </div>
      </div>
    </div>
  );
}
