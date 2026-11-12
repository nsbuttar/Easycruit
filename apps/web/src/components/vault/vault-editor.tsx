"use client";

import type { CandidateProfile } from "@omniprofile/shared";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProfileAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CvDropzone } from "./cv-dropzone";
import {
  EducationSection,
  PersonalSection,
  ScreeningSection,
  SkillsSection,
  WorkHistorySection,
} from "./sections";

interface VaultEditorProps {
  initialProfile: CandidateProfile;
  /** True until the user has saved a profile for the first time. */
  isNew: boolean;
}

/**
 * Owns the draft profile. Parsing a CV only replaces the draft; nothing is
 * persisted until the user has reviewed it and pressed Save.
 */
export function VaultEditor({ initialProfile, isNew }: VaultEditorProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(!isNew);
  const [saving, startSaving] = useTransition();

  const edit = useCallback((next: CandidateProfile) => {
    setProfile(next);
    setDirty(true);
  }, []);

  const onParsed = useCallback(
    (parsed: CandidateProfile) => {
      // Keep screening answers the user already typed in; a CV rarely contains them.
      setProfile((current) => ({
        ...parsed,
        screeningAnswers: {
          ...parsed.screeningAnswers,
          ...Object.fromEntries(
            Object.entries(current.screeningAnswers).filter(([, value]) =>
              Array.isArray(value) ? value.length > 0 : value !== "",
            ),
          ),
        },
      }));
      setDirty(true);
      toast.success("CV parsed. Review the details below, then save.");
    },
    [],
  );

  // Warn before losing unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startSaving(async () => {
      const result = await saveProfileAction(profile);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setProfile(result.profile);
      setDirty(false);
      setSaved(true);
      toast.success("Profile saved.");
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{saved ? "Update from a CV" : "Start with your CV"}</CardTitle>
          <CardDescription>
            {saved
              ? "Uploading a new CV replaces the details below with a fresh draft. Nothing changes until you save."
              : "Upload a PDF and we will draft your profile for you. You can also fill it in by hand."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CvDropzone onParsed={onParsed} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Master profile</CardTitle>
          <CardDescription>Check everything the AI extracted. You are the source of truth.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personal">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="work">Experience ({profile.workHistory.length})</TabsTrigger>
              <TabsTrigger value="education">Education ({profile.education.length})</TabsTrigger>
              <TabsTrigger value="skills">Skills ({profile.skills.length})</TabsTrigger>
              <TabsTrigger value="screening">Screening Q&amp;A</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="pt-4">
              <PersonalSection value={profile} onChange={edit} />
            </TabsContent>
            <TabsContent value="work" className="pt-4">
              <WorkHistorySection value={profile.workHistory} onChange={(workHistory) => edit({ ...profile, workHistory })} />
            </TabsContent>
            <TabsContent value="education" className="pt-4">
              <EducationSection value={profile.education} onChange={(education) => edit({ ...profile, education })} />
            </TabsContent>
            <TabsContent value="skills" className="pt-4">
              <SkillsSection value={profile.skills} onChange={(skills) => edit({ ...profile, skills })} />
            </TabsContent>
            <TabsContent value="screening" className="pt-4">
              <ScreeningSection
                value={profile.screeningAnswers}
                onChange={(screeningAnswers) => edit({ ...profile, screeningAnswers })}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm text-muted-foreground" role="status">
          {dirty ? "You have unsaved changes." : saved ? "All changes saved." : "Not saved yet."}
        </p>
        <Button type="button" onClick={save} disabled={saving || (!dirty && saved)}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
