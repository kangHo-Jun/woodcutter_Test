# Partition search freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete the reported 205-square ×12 + 105-square ×12 calculation without freezing, and bound optional partition search.

**Architecture:** Preserve the existing chosen layout unless a complete, valid candidate improves board count. Skip GPP when all parts already fit one board. Limit GPP enumeration and retained attempts; abandon an exhausted search to its existing baseline.

**Tech Stack:** Browser JavaScript, Node test runner, isolated VM timeout, existing Playwright harness.

**Spec:** Root HANDOFF.md entries dated 2026-10-13 and the user's “추가진행” authorization.

## Global Constraints

- Test first, then v10; v4 is read-only. Keep existing untracked files and HANDOFF edits.
- Preserve axes, kerf, trim, rotation, grain, costs, approved CASE5 and all eleven saved results.
- Production edits: js/packer.js and its index.html cache version only, in Test then v10.
- Add regression tools under harness/partition-budget; evidence under output/partition-budget.
- No network publishing in this implementation run. Local rollback tags freeze-before-20261013 protect both starting revisions.
- This is one tightly coupled diagnosis/fix/verification task, executed in the existing authorized Test sandbox checkout; request an independent read-only review with requesting-code-review before v10 rollout.

## Task 1: Bound the real calculation path and verify rollout

**Files:** Test js/packer.js, index.html, harness/partition-budget/*; v10 js/packer.js and index.html after validation; root/v10 HANDOFF and Test docs/context.md.

**Interfaces:** Public pack(items, 'auto') and guillotinePartitionPlanner(parts, width, height, grain) retain their signatures and result schema.

- [x] Write failing tests using a VM with a 3000ms timeout. Exercise the actual public pack call for the user's 24 pieces; assert 1 board, all quantities, valid geometry/kerf/cuts. Exercise direct GPP on that same input so an outer early exit cannot hide an unbounded inner loop.
- [x] Add 20–30 and 31/32/33/64 quantity boundaries, plus grain/trim/rotation variants. Direct GPP budget abort must return the existing baseline result, not partially searched output. Fake Date only at the VM boundary to verify the internal deadline deterministically.
- [x] Run `node --test harness/partition-budget/*.test.js` before modifying production, recording timeout failures.
- [x] Guard the GPP call: `selectedUnplaced.length === 0 && selectedBins.length === 1 ? null : this.guillotinePartitionPlanner(...)`.
- [x] Set a shared 50000 subset budget for each GPP invocation, retain only the best four attempts with stable tie order, check the existing 1000ms deadline inside enumeration, and unwind all recursive search on exhaustion. Keep depth fallback behavior. Explicitly decline bitmask search over 30 pieces before any shifts; return the already computed baseline. This is bounded heuristic search, not a claim of global optimality.
- [x] Run new tests; compare all eleven immutable baselines and geometry/cost checks. Run existing regression.js and relevant repeated-layout/residual-label/PDF/bulk suites including 690 pieces. Do not update golden outputs to hide regressions.
- [x] Run an independent read-only code review; fix correctness or meaningful test gaps.
- [x] Verify Test browser calculation and PDF, then copy only packer.js to v10 and update packer cache version in each index to `20261013-partition-budget-1`.
- [x] Verify v10 browser eleven-case preservation, actual desktop/mobile form entry for the user's case, responsive completion and PDF download. Capture results and inspect the rendered drawing. Check non-target source hashes remain unchanged.
- [x] Record exact tests, timings, caveats and pending deployment in HANDOFF and context. Leave reviewed local changes available; no automatic push.

## Plan review

- Tests and implementation share the public pack/GPP boundary; direct GPP test prevents the one-board fast path hiding the loop bug.
- Stable bounded top-four storage must match full stable sorting for completed enumeration. On partial enumeration abort, use the baseline, so candidate order truncation cannot change selection unpredictably.
- Browser rollout consumes the exact validated Test packer, with v10's own trim/rotation/UI modules retained.
