import type { ProfileSummary } from "@omniprofile/shared";
import { useCallback, useEffect, useState } from "react";
import { VAULT_URL } from "../lib/config.ts";
import { ExtensionError, send } from "../lib/messages.ts";

type View =
  | { status: "loading" }
  | { status: "disconnected"; error?: string }
  | { status: "connected"; summary: ProfileSummary | null; error?: string };

const messageOf = (error: unknown): string =>
  error instanceof ExtensionError ? error.message : "Something went wrong. Please try again.";

async function loadView(): Promise<View> {
  const { connected } = await send("auth:status");
  if (!connected) return { status: "disconnected" };
  try {
    return { status: "connected", summary: await send("profile:summary") };
  } catch (error) {
    if (error instanceof ExtensionError && error.code === "unauthenticated") return { status: "disconnected" };
    return { status: "connected", summary: null, error: messageOf(error) };
  }
}

function VaultLink({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <a className={primary ? "button primary" : "button"} href={VAULT_URL} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function ProfileOverview({ summary }: { summary: ProfileSummary }) {
  if (!summary.hasProfile) {
    return <p className="muted">Your vault is empty. Upload your CV to start auto-filling applications.</p>;
  }
  const stats = [
    { label: "Roles", value: summary.counts.workHistory },
    { label: "Education", value: summary.counts.education },
    { label: "Skills", value: summary.counts.skills },
  ];
  return (
    <>
      <p className="name">{summary.displayName || "Your profile"}</p>
      {summary.headline && <p className="muted">{summary.headline}</p>}
      <ul className="stats">
        {stats.map(({ label, value }) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <p className="muted">Open a job on Workday, Greenhouse, Lever or Taleo and click “Auto-Fill with OmniProfile”.</p>
    </>
  );
}

export function Popup() {
  const [view, setView] = useState<View>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setView(await loadView());
    } catch (error) {
      setView({ status: "disconnected", error: messageOf(error) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: "auth:connect" | "auth:disconnect") => {
    setBusy(true);
    try {
      await send(action);
      await refresh();
    } catch (error) {
      // Closing the sign-in window is not an error worth reporting.
      const cancelled = error instanceof ExtensionError && error.code === "cancelled";
      setView({ status: "disconnected", error: cancelled ? undefined : messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <h1>OmniProfile</h1>

      {view.status === "loading" && <p className="muted">Loading…</p>}

      {view.status === "disconnected" && (
        <>
          <p className="muted">Connect your vault to auto-fill job applications.</p>
          {view.error && (
            <p className="error" role="alert">
              {view.error}
            </p>
          )}
          <div className="actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void run("auth:connect")}>
              {busy ? "Waiting for sign-in…" : "Connect account"}
            </button>
          </div>
        </>
      )}

      {view.status === "connected" && (
        <>
          {view.summary && <ProfileOverview summary={view.summary} />}
          {view.error && (
            <p className="error" role="alert">
              {view.error}
            </p>
          )}
          <div className="actions">
            <VaultLink label={view.summary?.hasProfile ? "Edit my vault" : "Create my profile"} primary />
            <button type="button" disabled={busy} onClick={() => void run("auth:disconnect")}>
              Disconnect
            </button>
          </div>
        </>
      )}
    </main>
  );
}
