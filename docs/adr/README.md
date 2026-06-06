# 📐 Architecture Decision Records (ADRs)

This directory contains the **Architecture Decision Records** for the Mediavida Premium Extension project.

## What is an ADR?

An ADR is a document that captures an important architectural decision along with its context and consequences. It serves as a historical record of the "why" behind technical decisions.

## ADR Index

| ID                                                  | Title                                    | Status      | Date     |
| --------------------------------------------------- | ---------------------------------------- | ----------- | -------- |
| [ADR-001](ADR-001-centralized-logging.md)           | Centralized Logging System               | ✅ Accepted | Jan 2026 |
| [ADR-002](ADR-002-global-type-safety.md)            | Type Safety for Global Window Properties | ✅ Accepted | Jan 2026 |
| [ADR-003](ADR-003-vitest-testing-infrastructure.md) | Testing Infrastructure with Vitest       | ✅ Accepted | Jan 2026 |
| [ADR-004](ADR-004-prism-in-background.md)           | PrismJS in Background Script             | ✅ Accepted | Jan 2026 |
| [ADR-005](ADR-005-lite-vs-full-provider.md)         | LiteAppProvider vs AppProvider           | ✅ Accepted | Jan 2026 |
| [ADR-006](ADR-006-shadow-dom-isolation.md)          | CSS Isolation with Shadow DOM            | ✅ Accepted | Jan 2026 |
| [ADR-007](ADR-007-messaging-architecture.md)        | Messaging Architecture                   | ✅ Accepted | Jan 2026 |
| [ADR-008](ADR-008-storage-strategy.md)              | Storage Strategy                         | ✅ Accepted | Jan 2026 |
| [ADR-009](ADR-009-state-management.md)              | State Management Architecture            | ✅ Accepted | Jan 2026 |
| [ADR-010](ADR-010-feature-injection.md)             | Feature Injection Architecture           | ✅ Accepted | Jan 2026 |
| [ADR-011](ADR-011-css-strategy.md)                  | Dual CSS Strategy (Shadow + Global)      | ✅ Accepted | Jan 2026 |
| [ADR-012](ADR-012-api-security.md)                  | API Keys Security                        | ✅ Accepted | Jan 2026 |
| [ADR-013](ADR-013-content-script-data-fetching.md)  | Data Fetching in Content Script          | ✅ Accepted | Jan 2026 |
| [ADR-014](ADR-014-infinite-scroll-sliding-window.md) | Infinite Scroll Sliding Window         | ✅ Accepted | Jan 2026 |
| [ADR-015](ADR-015-mobile-lite-bootstrap.md)         | Mobile Lite Bootstrap Separation         | ✅ Accepted | Jun 2026 |

## ADR Statuses

| Status            | Meaning                        |
| ----------------- | ------------------------------ |
| 📋 **Proposed**   | Under review, pending approval |
| ✅ **Accepted**   | Approved and implemented       |
| ⚠️ **Deprecated** | Replaced by another decision   |
| ❌ **Rejected**   | Will not be implemented        |

## Template for New ADRs

```markdown
# ADR-XXX: [Title]

| Metadata      | Value       |
| ------------- | ----------- |
| **Status**    | 📋 Proposed |
| **Date**      | [Date]      |
| **Authors**   | [Names]     |
| **Reviewers** | [Names]     |

## Context

[Describe the problem or situation that motivates this decision]

## Decision

[Describe the decision made and why]

## Alternatives Considered

[List other options evaluated and why they were rejected]

## Consequences

### Positive

- ...

### Negative

- ...

## References

- [Relevant links]
```

## Conventions

1. **Numbering**: `ADR-XXX` with sequential 3-digit numbers
2. **File names**: `ADR-XXX-kebab-case-title.md`
3. **Language**: English for all content
4. **Immutability**: Accepted ADRs are not modified; new ones are created to replace them
