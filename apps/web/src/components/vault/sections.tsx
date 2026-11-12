"use client";

import {
  emptyEducation,
  emptyWorkExperience,
  SCREENING_FIELDS,
  type CandidateProfile,
  type ContactInfo,
  type Education,
  type ScreeningAnswers,
  type WorkExperience,
} from "@omniprofile/shared";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "./form-field";
import { linesToList, listToLines, removeAt, updateAt } from "./list-utils";

/** Every section edits one slice of the profile through the same contract. */
interface SectionProps<T> {
  value: T;
  onChange: (value: T) => void;
}

interface RepeatableProps {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}

function RepeatableItem({ title, onRemove, children }: RepeatableProps) {
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate font-medium">{title}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${title}`}>
          <Trash2Icon />
        </Button>
      </div>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      <PlusIcon /> {label}
    </Button>
  );
}

const CONTACT_FIELDS: ReadonlyArray<{
  key: keyof ContactInfo;
  label: string;
  type?: "email" | "tel" | "url";
  autoComplete?: string;
  wide?: boolean;
}> = [
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  { key: "address", label: "Street address", autoComplete: "street-address", wide: true },
  { key: "city", label: "City", autoComplete: "address-level2" },
  { key: "state", label: "State / region", autoComplete: "address-level1" },
  { key: "postalCode", label: "Postal code", autoComplete: "postal-code" },
  { key: "country", label: "Country", autoComplete: "country-name" },
  { key: "linkedin", label: "LinkedIn URL", type: "url" },
  { key: "github", label: "GitHub URL", type: "url" },
  { key: "portfolio", label: "Portfolio / website", type: "url", wide: true },
];

export function PersonalSection({ value, onChange }: SectionProps<CandidateProfile>) {
  const set = (patch: Partial<CandidateProfile>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="First name" value={value.firstName} autoComplete="given-name" onChange={(firstName) => set({ firstName })} />
      <FormField label="Last name" value={value.lastName} autoComplete="family-name" onChange={(lastName) => set({ lastName })} />
      <FormField
        label="Headline"
        value={value.headline}
        placeholder="e.g. Senior Product Designer"
        className="sm:col-span-2"
        onChange={(headline) => set({ headline })}
      />
      {CONTACT_FIELDS.map(({ key, label, type, autoComplete, wide }) => (
        <FormField
          key={key}
          label={label}
          type={type}
          autoComplete={autoComplete}
          value={value.contactInfo[key]}
          className={wide ? "sm:col-span-2" : undefined}
          onChange={(next) => set({ contactInfo: { ...value.contactInfo, [key]: next } })}
        />
      ))}
      <FormField
        label="Professional summary"
        value={value.summary}
        multiline
        className="sm:col-span-2"
        onChange={(summary) => set({ summary })}
      />
    </div>
  );
}

export function WorkHistorySection({ value, onChange }: SectionProps<WorkExperience[]>) {
  const patch = (index: number, change: Partial<WorkExperience>) => onChange(updateAt(value, index, change));
  return (
    <div className="space-y-4">
      {value.length === 0 && <p className="text-sm text-muted-foreground">No roles yet.</p>}
      {value.map((job, index) => (
        <RepeatableItem
          key={index}
          title={[job.title, job.company].filter(Boolean).join(" at ") || `Role ${index + 1}`}
          onRemove={() => onChange(removeAt(value, index))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Job title" value={job.title} onChange={(title) => patch(index, { title })} />
            <FormField label="Company" value={job.company} onChange={(company) => patch(index, { company })} />
            <FormField label="Location" value={job.location} onChange={(location) => patch(index, { location })} />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start" value={job.start} placeholder="YYYY-MM" onChange={(start) => patch(index, { start })} />
              <FormField
                label="End"
                value={job.current ? "" : job.end}
                placeholder={job.current ? "Present" : "YYYY-MM"}
                onChange={(end) => patch(index, { end, current: false })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={job.current}
                onChange={(event) => patch(index, { current: event.target.checked, end: event.target.checked ? "" : job.end })}
              />
              I currently work here
            </label>
            <FormField
              label="Achievements (one per line)"
              value={listToLines(job.bullets)}
              multiline
              rows={5}
              className="sm:col-span-2"
              onChange={(text) => patch(index, { bullets: linesToList(text) })}
            />
          </div>
        </RepeatableItem>
      ))}
      <AddButton label="Add role" onClick={() => onChange([...value, emptyWorkExperience()])} />
    </div>
  );
}

export function EducationSection({ value, onChange }: SectionProps<Education[]>) {
  const patch = (index: number, change: Partial<Education>) => onChange(updateAt(value, index, change));
  return (
    <div className="space-y-4">
      {value.length === 0 && <p className="text-sm text-muted-foreground">No education yet.</p>}
      {value.map((entry, index) => (
        <RepeatableItem
          key={index}
          title={entry.institution || `Education ${index + 1}`}
          onRemove={() => onChange(removeAt(value, index))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Institution" value={entry.institution} className="sm:col-span-2" onChange={(institution) => patch(index, { institution })} />
            <FormField label="Degree" value={entry.degree} placeholder="e.g. BSc" onChange={(degree) => patch(index, { degree })} />
            <FormField label="Field of study" value={entry.fieldOfStudy} onChange={(fieldOfStudy) => patch(index, { fieldOfStudy })} />
            <FormField label="Graduation year" value={entry.year} placeholder="YYYY" onChange={(year) => patch(index, { year })} />
            <FormField label="Grade / GPA" value={entry.grade} onChange={(grade) => patch(index, { grade })} />
          </div>
        </RepeatableItem>
      ))}
      <AddButton label="Add education" onClick={() => onChange([...value, emptyEducation()])} />
    </div>
  );
}

export function SkillsSection({ value, onChange }: SectionProps<string[]>) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const additions = draft
      .split(",")
      .map((skill) => skill.trim())
      .filter((skill) => skill && !value.some((existing) => existing.toLowerCase() === skill.toLowerCase()));
    if (additions.length > 0) onChange([...value, ...additions]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={draft}
          aria-label="Add skills"
          placeholder="Type a skill and press Enter (commas add several)"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="button" variant="outline" onClick={commit} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((skill, index) => (
            <li key={skill}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  type="button"
                  aria-label={`Remove ${skill}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  onClick={() => onChange(removeAt(value, index))}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScreeningSection({ value, onChange }: SectionProps<ScreeningAnswers>) {
  const patchCustom = (index: number, change: Partial<ScreeningAnswers["custom"][number]>) =>
    onChange({ ...value, custom: updateAt(value.custom, index, change) });

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Answers to questions most applications ask. Anything left blank is never guessed: the extension
          highlights that question for you to answer yourself.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCREENING_FIELDS.map(({ key, label, hint }) => (
            <FormField
              key={key}
              label={label}
              value={value[key]}
              placeholder={hint}
              onChange={(next) => onChange({ ...value, [key]: next })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="font-medium">Custom questions</h3>
          <p className="text-sm text-muted-foreground">
            Save answers to questions you see often, such as &ldquo;How did you hear about us?&rdquo;
          </p>
        </div>
        {value.custom.map((qa, index) => (
          <RepeatableItem
            key={index}
            title={qa.question || `Question ${index + 1}`}
            onRemove={() => onChange({ ...value, custom: removeAt(value.custom, index) })}
          >
            <FormField label="Question" value={qa.question} onChange={(question) => patchCustom(index, { question })} />
            <FormField label="Answer" value={qa.answer} multiline rows={3} onChange={(answer) => patchCustom(index, { answer })} />
          </RepeatableItem>
        ))}
        <AddButton
          label="Add question"
          onClick={() => onChange({ ...value, custom: [...value.custom, { question: "", answer: "" }] })}
        />
      </div>
    </div>
  );
}
