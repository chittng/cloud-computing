# Cloud Computing

A personal task management web app for a university Cloud Computing course.

## Project layout

- `src/`: Application source code.
- `test/`: End-to-end tests.

## Project workflow

These rules apply to both human contributors and AI agents. AI agents act on behalf of
the contributor they are assisting.

- Work is managed on Plane.so in the project "Điện toán đám mây". Use the Plane plugin
  to read and update work items.
- Source code is managed on GitHub. Use the GitHub plugin for GitHub operations.
- Work is split into work items on Plane and assigned to individual contributors.
  Work only on items assigned to you; AI agents must follow the assignments of the
  contributor they are assisting. If an item is unassigned or its ownership is unclear,
  clarify the assignment before starting it.
- Before starting an assigned work item, read its description and completion criteria.
- Name Git branches using `<type>/<work-item-id>-<short-description>`, for example
  `feat/CLOUD-99-login-page`. Use a type appropriate to the change, the exact Plane
  work item identifier, and a short description in lowercase with words separated by
  hyphens. Every work branch must follow this convention.
- The workflow states are: Backlog, Needs Refinement, Ready, In Progress, In Review,
  Done, and Cancelled. Use these exact state names when updating work items.
- Move an assigned work item to In Progress when you start working on it.
- Each work item's description contains its completion criteria. As you complete and
  verify each criterion, check its checkbox in the Plane description. Keep the checklist
  accurate throughout the work.
- Once all criteria are checked, review your own changes and run the relevant checks.
  If your self-review and checks pass, move the work item to In Review so another
  contributor can review it. Leave the item in In Review pending that review rather
  than marking it Done based solely on your own assessment.

## Working principles

- If requirements are missing or contradictory, clarify them instead of inventing product behavior.
- Read the affected code and configuration before making changes. Follow existing patterns.
- Keep changes focused on the request. Preserve unrelated work in the working tree.
- Use the simplest implementation that meets the requirement. Add shared packages or architectural
  layers only when the task needs them.
- When behavior changes, add or update tests that exercise that behavior. For bug fixes, add a
  regression test when practical. Do not weaken assertions or disable checks to make a failure pass.
- When changing a name, signature, or contract, update affected callers and tests together.
- Keep facts in one place. Refer to configuration files instead of copying their settings into docs.
- Do not assume framework APIs, conventions, file structure, or other framework details
  from training data match the versions used in this project. Check the relevant files,
  read docs for those versions, and heed deprecation notices.

## Tooling and commands

- Only use pnpm. Do not create npm or Yarn lockfiles.
- Read package.json for the required Node.js and pnpm versions.
- Read pnpm-workspace.yaml for workspace and dependency pinning settings.
- Install dependencies with pnpm install --frozen-lockfile when manifests have not changed.
- When adding or changing dependencies, use pnpm in the appropriate workspace package and include
  the updated pnpm-lock.yaml. Do not edit the lockfile by hand.
- Use Oxfmt and Oxlint through the existing scripts. Their configuration files define formatting
  and lint rules; do not introduce a second formatter or linter without a task requirement.

## Backend conventions

- Preserve the ESM and NodeNext setup.
- Keep TypeScript strictness enabled. Resolve type errors instead of adding broad suppressions.
- Follow NestJS module and dependency injection patterns.
- Unit tests use `*.spec.ts`; end-to-end tests use `*.e2e-spec.ts`. The two Vitest configs define
  their separate suites.

## Framework documentation

Before making NestJS-specific changes, consult the official NestJS documentation
and verify that the guidance applies to the app's installed version. Follow existing
app patterns, including modules, dependency injection, and testing.

## Maintaining this file

Update these instructions when paths, commands, etc. change.

## Communication

Respond to the user in Vietnamese. Write code comments, docs, commit messages,
and PR descriptions in English unless requested otherwise.
