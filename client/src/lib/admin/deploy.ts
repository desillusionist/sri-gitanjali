/**
 * After publishing: watches the site until it has been rebuilt from the published commit (or a
 * later one). The site names the commit it was built from in version.txt.
 */
import { useEffect, useState } from "react";
import { includesCommit } from "./github";
import { useDrafts } from "./drafts";

export type DeployState = "building" | "live" | "slow";

const POLL_MS = 15_000;
/** The site usually rebuilds in two minutes; after this long something went wrong. */
const SLOW_AFTER_MS = 10 * 60 * 1000;
/** Stop watching a publish this old. */
const FORGET_AFTER_MS = 30 * 60 * 1000;

const liveCommits = new Set<string>();

async function deployedCommit(): Promise<string | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.txt`, { cache: "no-store" });
    const text = response.ok ? (await response.text()).trim() : "";
    return /^[0-9a-f]{40}$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

export function useDeployState(): DeployState | null {
  const { publishedSha: sha, publishedAt } = useDrafts();
  const [state, setState] = useState<DeployState | null>(null);

  useEffect(() => {
    if (!sha || !publishedAt || Date.now() - publishedAt > FORGET_AFTER_MS) {
      setState(null);
      return;
    }
    if (liveCommits.has(sha)) {
      setState("live");
      return;
    }
    let stopped = false;
    let timer = 0;
    const check = async () => {
      const deployed = await deployedCommit();
      if (stopped) return;
      if (deployed && (await includesCommit(deployed, sha).catch(() => false))) {
        liveCommits.add(sha);
        if (!stopped) setState("live");
        return;
      }
      if (stopped) return;
      setState(Date.now() - publishedAt > SLOW_AFTER_MS ? "slow" : "building");
      if (Date.now() - publishedAt < FORGET_AFTER_MS) timer = window.setTimeout(check, POLL_MS);
    };
    setState("building");
    timer = window.setTimeout(check, 5_000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [sha, publishedAt]);

  return state;
}
