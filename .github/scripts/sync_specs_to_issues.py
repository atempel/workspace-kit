#!/usr/bin/env python3
"""Sync docs/specs/*.md to GitHub issues: one parent issue per spec, one
sub-issue per Must-Have (P0) requirement.

History
-------
The first version of this sync turned every ``- [ ]`` bullet in TASKS.md into
its own issue. A single push on 2026-07-26 created ~41 raw-titled issues
(#36-76) that way, which is not this repo's issue convention. It was rewritten
to read ``docs/specs/*.md`` instead.

That rewrite matched issues by **exact title**, which had two failure modes,
both observed for real on 2026-07-29 (see #166 and #168):

1. Rewording a requirement created a *duplicate* issue instead of updating the
   existing one. The "project type" -> "kit" rename reworded a P0 bullet in
   docs/specs/docker-environment-generation.md, and #126 was duplicated as
   #166.
2. A bullet that had been struck through and retired was still turned into an
   issue, titled with the literal ``~~...~~`` markup (#168).

This version fixes both by giving every synced issue a **stable sync key**
stored in its body, and by skipping retired bullets.

Sync keys
---------
``<!-- sync-key: docs/specs/foo.md#spec -->``   for a spec's parent issue
``<!-- sync-key: docs/specs/foo.md#p0-3 -->``   for its 3rd P0 requirement

Lookup order is: sync key, then the parent's existing sub-issue at the same
ordinal, then exact title. The last two exist so issues predating this change
get *adopted* and stamped with a key on the first run rather than duplicated.
Once an issue carries a key, its bullet can be reworded freely.

The middle step matters because this repo has two overlapping sets of
sub-issues: hand-curated ones (#82-#111, written 2026-07-26 and properly linked
under #77-#81) and auto-titled twins a later run created for the same
requirements without linking them. Preferring the linked set keeps the curated
issues canonical. It only applies when the counts line up 1:1; otherwise the
correspondence is not safe to assume and matching falls back to titles.

Titles are never rewritten unless ``--retitle`` is passed. Hand-written titles
generally read better than anything derived from a bullet, and suppressing
duplicates is the sync key's job -- it does not depend on the title.

Ordinals are assigned over **all** P0 bullets, including retired ones, so
retiring a bullet does not renumber the ones after it.

Known limitation: keys are positional, so *reordering* P0 bullets within a spec
(as opposed to editing, appending or retiring them) will mismatch issues. Adding
and retiring are safe; reordering needs a manual fix.

Policy: this script only creates and updates. It never closes or reopens
anything -- specs have no checkbox state to read, so issue state stays manual.
A bullet that gets retired therefore leaves its existing issue open on purpose;
closing it is a human call.
"""

import argparse
import glob
import json
import re
import subprocess
import sys

SYNC_KEY_RE = re.compile(r"<!--\s*sync-key:\s*(\S+?)\s*-->")
SPEC_TITLE_RE = re.compile(r"^# Spec — (.+)$", re.MULTILINE)
PROBLEM_RE = re.compile(r"## Problem Statement\s*\n+(.+?)(?:\n\n|\Z)", re.DOTALL)
P0_BLOCK_RE = re.compile(r"\*\*Must-Have \(P0\)\*\*\s*\n(.*?)(?=\n\*\*|\n## |\Z)", re.DOTALL)
TOP_LEVEL_BULLET_RE = re.compile(r"^- (.+)$", re.MULTILINE)
MAX_TITLE = 80


def sync_key_comment(key):
    return f"<!-- sync-key: {key} -->"


def is_retired(bullet):
    """A bullet whose leading text is struck through is retired/superseded.

    Requirements get retired in place rather than deleted, so the spec keeps a
    record of what changed and why (see docs/specs/local-web-app.md). Those are
    not work items and must not become issues.
    """
    return bullet.lstrip().startswith("~~")


def remember(index, key, issue):
    """Index an issue, letting an open one win over a closed one.

    Closed issues are indexed at all so a deliberately-closed item is not
    recreated on the next run. But when an open and a closed issue collide on
    the same key or title, the open one is the live work item -- otherwise a
    closed duplicate can shadow the original it was closed in favour of, which
    is exactly what #166 (closed) would have done to #126 (open).
    """
    seen = index.get(key)
    if seen is None or (seen.get("state") == "closed" and issue.get("state") == "open"):
        index[key] = issue


def derive_title(bullet):
    """A requirement bullet is '<statement> — <elaboration>'; the statement is the title."""
    title = bullet.split(" — ")[0].strip()
    if len(title) > MAX_TITLE:
        title = title[: MAX_TITLE - 3] + "..."
    return title


class Client:
    def __init__(self, repo, dry_run=False, retitle=False):
        self.repo = repo
        self.dry_run = dry_run
        self.retitle = retitle
        self.by_key = {}
        self.by_title = {}
        self.created = 0
        self.retitled = 0
        self.stamped = 0
        self.linked = 0
        self.skipped_retired = 0

    def api(self, path, method="GET", fields=None, paginate=False):
        cmd = ["gh", "api"]
        if paginate:
            cmd.append("--paginate")
        if method != "GET":
            cmd += ["-X", method]
        for k, v in (fields or {}).items():
            cmd += ["-f", f"{k}={v}"]
        cmd.append(path)
        if paginate:
            cmd += ["--jq", ".[]"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"gh api failed: {path}\n{result.stderr}", file=sys.stderr)
            return None
        return result.stdout

    def load_issues(self):
        raw = self.api(f"repos/{self.repo}/issues?state=all&per_page=100", paginate=True) or ""
        for line in raw.splitlines():
            if not line.strip():
                continue
            obj = json.loads(line)
            if "pull_request" in obj:
                continue  # the issues endpoint returns PRs too
            remember(self.by_title, obj["title"].strip(), obj)
            found = SYNC_KEY_RE.search(obj.get("body") or "")
            if found:
                remember(self.by_key, found.group(1), obj)
        print(f"Indexed {len(self.by_title)} issues ({len(self.by_key)} already keyed)")

    def find(self, key, title, prefer=None):
        """Sync key, then a caller-supplied preferred issue, then exact title.

        `prefer` exists because this repo has two overlapping sets of sub-issues:
        hand-curated ones written on 2026-07-26 and properly linked under their
        parent, and auto-titled ones a later workflow run created for the same
        requirements without linking them. The curated set is canonical, so the
        caller passes the parent's existing sub-issue at this ordinal and it wins
        over a title match against the auto-generated twin.
        """
        hit = self.by_key.get(key)
        if hit:
            return hit, "key"
        if prefer is not None and not SYNC_KEY_RE.search(prefer.get("body") or ""):
            return prefer, "linked"
        hit = self.by_title.get(title)
        if hit:
            return hit, "title"
        return None, None

    def sync(self, key, title, body_when_new, prefer=None):
        """Return the issue for `key`, creating/adopting/retitling as needed."""
        issue, how = self.find(key, title, prefer=prefer)

        if issue is None:
            body = f"{body_when_new}\n\n{sync_key_comment(key)}"
            self.created += 1
            if self.dry_run:
                print(f"  CREATE  [{key}] {title}")
                stub = {"number": f"new:{key}", "id": f"new:{key}", "title": title}
                self.by_key[key] = stub
                return stub
            raw = self.api(
                f"repos/{self.repo}/issues", method="POST",
                fields={"title": title, "body": body},
            )
            if not raw:
                return None
            issue = json.loads(raw)
            print(f"  CREATE  #{issue['number']} [{key}] {title}")
            self.by_key[key] = issue
            self.by_title[title] = issue
            return issue

        num = issue["number"]

        if how in ("title", "linked"):
            # Pre-key issue: stamp the key so future rewording updates instead
            # of duplicating. Append -- never rewrite a hand-curated body.
            self.stamped += 1
            print(f"  ADOPT   #{num} [{key}] {title}")
            if not self.dry_run:
                body = (issue.get("body") or "").rstrip()
                self.api(
                    f"repos/{self.repo}/issues/{num}", method="PATCH",
                    fields={"body": f"{body}\n\n{sync_key_comment(key)}"},
                )
            self.by_key[key] = issue

        # Titles are only rewritten on request. Many issues here were titled by
        # hand and read better than anything derived from a bullet, so the
        # default is to leave them alone -- suppressing duplicates is what the
        # sync key is for, and that works regardless of the title.
        if self.retitle and issue["title"].strip() != title:
            self.retitled += 1
            print(f"  RETITLE #{num} [{key}]")
            print(f"          was: {issue['title'].strip()}")
            print(f"          now: {title}")
            if not self.dry_run:
                self.api(
                    f"repos/{self.repo}/issues/{num}", method="PATCH",
                    fields={"title": title},
                )
            issue["title"] = title

        return issue

    def sub_issues(self, parent_number):
        """The parent's current sub-issues, in the order GitHub returns them."""
        if isinstance(parent_number, str):  # dry-run stub parent
            return []
        raw = self.api(f"repos/{self.repo}/issues/{parent_number}/sub_issues", paginate=True) or ""
        return [json.loads(line) for line in raw.splitlines() if line.strip()]

    def link(self, parent, child):
        self.linked += 1
        print(f"  LINK    #{child['number']} under #{parent['number']}")
        if not self.dry_run:
            self.api(
                f"repos/{self.repo}/issues/{parent['number']}/sub_issues", method="POST",
                fields={"sub_issue_id": str(child["id"])},
            )


def sync_spec(client, path):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()

    title_match = SPEC_TITLE_RE.search(text)
    if not title_match:
        return
    print(f"\n{path}")

    problem = PROBLEM_RE.search(text)
    parent_body = (
        f"Full spec: [`{path}`](https://github.com/{client.repo}/blob/main/{path})\n\n"
        f"{problem.group(1).strip() if problem else ''}"
    )
    parent = client.sync(
        key=f"{path}#spec",
        title=f"[Spec] {title_match.group(1).strip()}",
        body_when_new=parent_body,
    )
    if not parent:
        return

    p0 = P0_BLOCK_RE.search(text)
    if not p0:
        return

    existing_subs = client.sub_issues(parent["number"])
    linked_ids = {sub["id"] for sub in existing_subs}

    # Ordinals span every bullet, retired included, so retiring one does not
    # renumber the rest and invalidate their keys.
    bullets = [b.strip() for b in TOP_LEVEL_BULLET_RE.findall(p0.group(1))]
    active = [(i, b) for i, b in enumerate(bullets, start=1) if not is_retired(b)]

    # When the parent's existing sub-issues line up 1:1 with its active P0
    # bullets, they are the hand-curated set and take precedence over any
    # auto-titled twin that matches on title alone. An unequal count means the
    # correspondence is not safe to assume, so fall back to title matching.
    aligned = len(existing_subs) == len(active)
    if existing_subs and not aligned:
        print(
            f"  NOTE    {len(existing_subs)} existing sub-issues vs {len(active)} "
            f"active P0 bullets — matching by title, not position"
        )

    for index, bullet in bullets_with_skips(client, bullets, path):
        position = [i for i, _ in active].index(index)
        child = client.sync(
            key=f"{path}#p0-{index}",
            title=derive_title(bullet),
            body_when_new=f"{bullet}\n\nParent spec: #{parent['number']}",
            prefer=existing_subs[position] if aligned else None,
        )
        if child and child["id"] not in linked_ids:
            client.link(parent, child)


def bullets_with_skips(client, bullets, path):
    """Yield (ordinal, bullet) for live bullets, logging the retired ones."""
    for index, bullet in enumerate(bullets, start=1):
        if is_retired(bullet):
            client.skipped_retired += 1
            print(f"  SKIP    [{path}#p0-{index}] retired: {derive_title(bullet)[:55]}")
            continue
        yield index, bullet


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="report what would change without writing anything",
    )
    parser.add_argument(
        "--retitle", action="store_true",
        help="also rewrite issue titles to match their current bullet text "
             "(off by default: hand-written titles are usually better than "
             "derived ones, and the sync key already prevents duplicates)",
    )
    args = parser.parse_args()

    repo = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()

    client = Client(repo, dry_run=args.dry_run, retitle=args.retitle)
    if args.dry_run:
        print("DRY RUN — no issues will be created or modified\n")
    client.load_issues()

    for path in sorted(glob.glob("docs/specs/*.md")):
        sync_spec(client, path)

    print(
        f"\ncreated={client.created} retitled={client.retitled} "
        f"adopted={client.stamped} linked={client.linked} "
        f"skipped_retired={client.skipped_retired}"
    )


if __name__ == "__main__":
    main()
