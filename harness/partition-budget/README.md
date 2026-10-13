# GPP freeze regression

The reported input is a 1220×2440×18 board, 4.2mm kerf, no grain/trim,
205×205 ×12 and 105×105 ×12, with rotation enabled. The old engine hangs in
subset enumeration even after another engine has placed all 24 parts on one board.

From `woodcutter_Test`:

```sh
node --test harness/partition-budget/partition-budget.test.js
PACKER_ROOT=../woodcutter_v10 node --test harness/partition-budget/partition-budget.test.js
PACKER_ROOT=../woodcutter_v4 node --test harness/partition-budget/partition-budget.test.js
node --test harness/residual-labels/*.test.js harness/repeated-layout/*.test.js harness/pdf-size/*.test.js harness/bulk-performance/*.test.js
node harness/regression.js
```

The first suite uses actual production code in isolated VMs with a 3-second
kill deadline, so synchronous loops cannot hang the test runner. It covers
the public calculation, direct GPP execution with a frozen clock (operation
budget), a clock expiring during enumeration (deadline), complete two-board
fallback, unexpected error propagation, 20–33/64 quantity boundaries and
grain/trim/rotation/kerf variants. The saved baseline suites also retain
successful small-input GPP cases, so simply disabling GPP cannot pass them.

Browser verification uses the project's existing Playwright runtime. Serve
the parent folder at `http://127.0.0.1:8893`, set `NODE_PATH` to the installed
Playwright packages, then run:

```sh
node harness/partition-budget/browser-check.cjs Test
node harness/partition-budget/browser-check.cjs v10
node harness/partition-budget/browser-check.cjs v4
```

For post-deploy validation, set `PUBLIC_URL` to the target's GitHub Pages URL.
Those artifacts go under `output/partition-budget/public/<version>`.
The v4 path explicitly preserves its fixed 14mm trim and default 4.2mm kerf
(v4 has no editable kerf field).

Each version checks eleven immutable pre-change browser results/costs and
actual form entry of the reported case at desktop and mobile viewport sizes.
It downloads thirteen PDFs, checks their size and that exports preserve state,
and saves two screenshots plus results under `output/partition-budget/<version>`.
Mobile viewport testing does not measure a physical phone's CPU.

Production bounds are per GPP invocation: 50,000 tested subsets, existing
1,000ms deadline checked inside enumeration (every 64 subsets), existing
500 search-node budget, and at most four retained attempts per rectangle.
On exhaustion the entire optional search is discarded in favor of its full
baseline. More than 30 expanded pieces bypass the 32-bit mask search safely.
This bounds this optional heuristic; it does not promise that every other
engine or arbitrary-size order always completes within one second.

Evidence from 2026-10-13: `output/partition-budget/red.txt` records the three
original timeout failures; `green.txt`, `existing-tests.txt`, `regression.txt`,
`v10-tests.txt`, and browser result folders record the passing checks.
Rollback tags: `freeze-before-20261013` in Test, v10, and v4. The user's later
explicit all-version rollout request authorized v4 after the initial v10 fix.
