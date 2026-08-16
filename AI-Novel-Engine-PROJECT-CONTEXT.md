# AI Novel Engine — Project Direction & AI Development Protocol

## 1. Project Goal

Build an AI Novel Generation System where the user only needs to provide a story title, for example:

> Ta Là Kiếm Đế

The system must be capable of automatically:

```text
Title
  ↓
Concept Generation
  ↓
Unique Concept Selection
  ↓
Story DNA
  ↓
Story Bible
  ↓
Long-Term Story Architecture
  ↓
Major Arcs
  ↓
Chapter Outlines
  ↓
AI Chapter Writing
  ↓
Memory Extraction
  ↓
Continuity Checking
  ↓
Auto Repair
  ↓
Completed Long-Form Novel
```

Target:

- Initial support: 300–1,000 chapters per novel.
- Architecture must be extendable to 2,000+ chapters.
- The user should not need to manually provide characters, world, plot, power system, or chapter outlines.
- The system must generate these from the title.
- Multiple novels generated from the same title must be meaningfully different, not merely renamed copies.

---

# 2. Critical Development Model

This project uses TWO AI roles.

## Role A — Codex: Architect / Planner / Reviewer

Codex is responsible for:

- Understanding the complete project.
- Designing architecture.
- Developing implementation plans.
- Designing data models.
- Designing AI-agent workflows.
- Designing prompts.
- Reviewing implementation.
- Reviewing tests.
- Detecting architectural problems.
- Proposing improvements.
- Auditing completed work.
- Preparing precise implementation instructions for Antigravity.

Codex SHOULD think and plan like the lead software architect.

Codex SHOULD NOT be the primary implementation agent.

## Role B — Antigravity: Implementation Agent

Antigravity is responsible for:

- Creating files.
- Editing source code.
- Implementing features.
- Creating migrations.
- Creating tests.
- Running tests.
- Running Docker services.
- Fixing implementation errors.
- Refactoring code according to Codex's approved plan.

Antigravity is the primary coding/implementation environment.

## Important Rule

Do NOT duplicate implementation work between Codex and Antigravity.

The intended workflow is:

```text
User
  ↓
Codex
  ↓
Architecture / Plan / Prompts / Review
  ↓
Antigravity
  ↓
Implementation
  ↓
Tests / Results
  ↓
Codex Review
  ↓
Next Phase
```

Codex may inspect and reason about the repository, but implementation should normally be performed by Antigravity.

---

# 3. Product Philosophy

This is NOT intended to be a simple chatbot that writes one chapter after another.

It is a long-form narrative generation engine.

The main challenge is not text generation.

The main challenges are:

1. Long-term story planning.
2. Narrative consistency.
3. Character state management.
4. World-state management.
5. Timeline management.
6. Plot-thread management.
7. Foreshadowing management.
8. Story uniqueness.
9. Preventing repetitive arcs.
10. Context selection.
11. Automatic continuity checking.
12. Recovery from generation failures.

Architecture must prioritize these concerns.

---

# 4. Core Pipeline

## Stage 1 — Title Input

User provides:

```text
Title: Ta La Kiem De
```

Optional settings may exist later:

```text
chapter_count
target_chapter_length
language
style
generation_mode
```

But the MVP should allow the title alone to generate a novel.

---

# 5. Concept Engine

The system must NOT immediately write chapters.

First generate multiple possible story concepts.

Example:

```text
Concept 001:
Reincarnated Sword Emperor

Concept 002:
Sword Emperor as a Sword Spirit

Concept 003:
Modern AI engineer enters a world where swords are sentient machines

Concept 004:
Sword Emperor is actually the final villain

Concept 005:
A failed disciple inherits the legacy of a dead Sword Emperor
```

The number of candidates must be configurable.

Concepts should differ in:

- premise
- genre
- setting
- protagonist archetype
- theme
- conflict
- progression model
- power system
- narrative structure
- ending direction

---

# 6. Story DNA

Every concept must be converted into structured Story DNA.

DNA should contain multiple layers.

```text
Concept DNA
World DNA
Character DNA
Power-System DNA
Faction DNA
Plot DNA
Arc DNA
Event DNA
Ending DNA
```

Example:

```json
{
  "genre": "xianxia",
  "premise": "fallen_genius",
  "theme": "revenge",
  "setting": "cultivation_world",
  "mc_archetype": "young_genius",
  "progression": "weak_to_god",
  "power_system": "sword_cultivation",
  "main_conflict": "family_and_sect",
  "narrative_structure": "progression",
  "ending_type": "ascension"
}
```

DNA is not merely a hash.

It is a semantic representation of the story's structural identity.

---

# 7. Story Uniqueness Engine

Before accepting a new concept:

```text
New Concept
  ↓
DNA Extraction
  ↓
Vector Similarity Search
  ↓
Retrieve Similar Existing Stories
  ↓
LLM Similarity Judge
  ↓
Score
  ↓
Accept / Modify / Reject
```

Similarity must be checked at multiple levels:

- concept
- premise
- world
- protagonist
- power system
- factions
- plot
- arcs
- major events
- ending
- text

The objective is not to guarantee mathematical uniqueness.

The objective is to prevent meaningful structural duplication.

Example:

```text
Similarity < 30%
→ ACCEPT

30–60%
→ MODIFY / REVIEW

> 60%
→ REJECT
```

Thresholds must remain configurable.

---

# 8. Story Architect

After a concept is accepted, generate a complete Story Bible.

It should include:

## World

- world structure
- continents
- countries
- cities
- regions
- history
- mythology
- cultures
- important locations

## Characters

- protagonist
- allies
- family
- rivals
- antagonists
- supporting characters
- important NPCs

Each important character should have:

- identity
- age
- personality
- background
- goals
- fears
- secrets
- abilities
- relationships
- current location
- current status
- character development state

## Factions

- sects
- kingdoms
- organizations
- clans
- religions
- guilds
- enemy factions

## Power System

Define explicit rules.

Example:

```text
Realm 1
  ↓
Realm 2
  ↓
Realm 3
  ↓
...
```

Power rules must be persistent and checked by the Continuity Engine.

## Items

Track important:

- weapons
- artifacts
- treasures
- resources
- keys
- books
- unique objects

## Timeline

Track important historical and current events.

---

# 9. Long-Term Plot Architecture

Do not generate 500 chapters as unrelated chapter ideas.

Use hierarchical planning:

```text
Novel
  ↓
Major Arcs
  ↓
Sub-Arcs
  ↓
Chapter Outlines
  ↓
Scenes
```

Each Major Arc should define:

- purpose
- goal
- conflict
- antagonist
- character development
- revelations
- foreshadowing
- climax
- consequences
- transition to next arc

Avoid repetitive progression such as:

```text
meet enemy
fight enemy
win
meet stronger enemy
fight
win
repeat
```

Long novels need variation in:

- conflict type
- stakes
- pacing
- character focus
- setting
- mystery
- politics
- exploration
- combat
- relationships
- revelations
- consequences

---

# 10. Chapter Planner

Every chapter should have a structured outline before writing.

Example:

```text
Chapter: 127

Purpose:
...

Characters:
...

Location:
...

Current State:
...

Events:
1. ...
2. ...
3. ...

Conflict:
...

Character Development:
...

Foreshadowing:
...

Plot Threads Advanced:
...

Ending Hook:
...
```

The outline is stored in the database.

---

# 11. Context Builder

The Writer must NOT receive the entire novel every time.

The system should dynamically construct relevant context.

Typical context:

```text
Current Chapter Outline
+
Previous Chapter Summary
+
Relevant Previous Events
+
Relevant Character States
+
Relevant Location State
+
Relevant Faction State
+
Relevant World Rules
+
Power-System Rules
+
Active Plot Threads
+
Relevant Foreshadowing
+
Recent Relationship Changes
+
Writing Style
```

This is essential for scaling to hundreds or thousands of chapters.

---

# 12. Chapter Writer

The Writer receives the structured context and produces the chapter.

The Writer must:

- follow the chapter outline
- respect Story Bible rules
- preserve character personality
- respect power levels
- respect timeline
- respect locations
- avoid contradicting established facts
- advance active plot threads
- maintain appropriate pacing
- avoid repetitive scenes
- preserve the intended style

The Writer should not silently invent major permanent world facts when those facts belong in the Story Bible.

---

# 13. Memory Engine

After each chapter:

```text
Chapter
  ↓
Memory Extractor
  ↓
State Updates
```

Extract:

- character changes
- relationship changes
- location changes
- power changes
- item changes
- new events
- secrets
- revelations
- plot-thread changes
- resolved plot threads
- new plot threads
- foreshadowing
- timeline events

Example:

```text
Character:
MC

Power:
Nascent Soul Level 3

Location:
Northern Empire

Inventory:
Broken Sword

Relationship:
Lin Yue +35

Active Plot:
Find Ancient Sword Temple
```

All state changes must be persisted.

---

# 14. Continuity Engine

Every generated chapter must be checked.

Check:

- character identity
- character status
- character location
- timeline
- age
- relationships
- power level
- abilities
- inventory
- world rules
- faction membership
- previous events
- item state
- unresolved plot threads
- foreshadowing
- contradictions
- plot holes

Example:

```text
Chapter 214:
Sword A is used.

Database:
Sword A was destroyed in Chapter 172.

Severity:
CRITICAL
```

Pipeline:

```text
Generate
  ↓
Continuity Check
  ↓
PASS → Save
  ↓
FAIL
  ↓
Repair
  ↓
Re-check
```

Set a configurable maximum repair attempt count.

---

# 15. Autonomous Generation

Eventually the system should support:

```text
Create Novel
  ↓
Generate Concepts
  ↓
Select Concept
  ↓
Build Story Bible
  ↓
Plan Arcs
  ↓
Plan Chapters
  ↓
Generate Chapter 1
  ↓
Check
  ↓
Save
  ↓
Generate Chapter 2
  ↓
...
  ↓
Chapter N
```

It must support:

- pause
- resume
- retry
- failure recovery
- job status
- progress tracking
- configurable concurrency
- cost tracking
- model selection

A server restart must not destroy generation progress.

---

# 16. Recommended Technology

Initial target:

```text
Frontend:
Next.js + TypeScript

Backend:
Python + FastAPI

Database:
PostgreSQL + pgvector

Queue:
Redis

LLM Gateway:
Provider-independent abstraction

Supported providers:
- OpenAI
- Anthropic / Claude
- Google Gemini
- Ollama / Local Models

Deployment:
Docker Compose
```

Do not hard-code provider-specific logic inside agents.

Use:

```text
Agent
  ↓
LLM Gateway
  ↓
Provider Adapter
  ↓
Model
```

---

# 17. Initial Database Entities

Expected entities include:

```text
novels
story_dna
worlds
characters
character_states
factions
locations
items
abilities
power_levels
timelines
plot_threads
foreshadowing
arcs
sub_arcs
chapter_outlines
chapters
chapter_summaries
memories
story_events
similarity_records
generation_jobs
llm_requests
```

The final schema should be designed by Codex before implementation.

Do not blindly implement this list if architectural analysis indicates better normalization or additional entities.

---

# 18. Suggested Project Phases

## Phase 0 — Foundation

- repository structure
- Docker Compose
- PostgreSQL
- pgvector
- Redis
- FastAPI
- Next.js
- configuration
- health checks
- logging
- testing infrastructure

## Phase 1 — Core Domain

- Novel
- Story Bible
- World
- Character
- Faction
- Location
- Item
- Ability
- Timeline
- Plot Thread
- Arc
- Chapter

## Phase 2 — LLM Gateway

- provider abstraction
- OpenAI adapter
- Gemini adapter
- Claude adapter
- Ollama adapter
- model configuration
- token/cost tracking

## Phase 3 — Concept + DNA

- Concept Generator
- DNA Generator
- Similarity Search
- Similarity Judge
- Accept/Modify/Reject pipeline

## Phase 4 — Story Architect

- Story Bible generation
- World generation
- Character generation
- Faction generation
- Power System
- Timeline
- relationships
- secrets

## Phase 5 — Long-Term Planner

- Arc Planner
- Sub-Arc Planner
- Chapter Planner
- Plot-thread management
- Foreshadowing management

## Phase 6 — Writer

- Context Builder
- Chapter Writer
- Chapter Summary
- Style management

## Phase 7 — Memory + Continuity

- Memory Extractor
- Character State
- World State
- Timeline State
- Continuity Checker
- Repair Agent

## Phase 8 — Autonomous Generation

- job queue
- pause/resume
- retries
- recovery
- progress tracking
- batch generation
- cost tracking

## Phase 9 — Dashboard

- novel management
- generation dashboard
- story bible viewer
- character viewer
- world viewer
- arc viewer
- chapter viewer
- error viewer
- cost dashboard

## Phase 10 — Production

- security
- observability
- backups
- performance
- deployment
- documentation
- production testing

---

# 19. Development Rules

## Rule 1

Do not implement the entire system in one pass.

## Rule 2

Before each phase:

1. Inspect current repository.
2. Review existing architecture.
3. Produce implementation plan.
4. Identify risks.
5. Define acceptance criteria.

## Rule 3

Implementation should normally be performed by Antigravity.

Codex should provide:

- implementation plan
- technical decisions
- prompts
- specifications
- review
- debugging guidance

## Rule 4

Every phase must have tests.

## Rule 5

Do not declare a phase complete until tests pass.

## Rule 6

Do not silently change architecture.

If an architectural change is necessary:

1. Explain why.
2. Propose the change.
3. Identify affected modules.
4. Wait for approval when the change is significant.

## Rule 7

Maintain backward compatibility where practical.

## Rule 8

Use migrations for database changes.

## Rule 9

Keep provider-specific LLM logic isolated.

## Rule 10

Do not create unnecessary infrastructure prematurely.

Start with:

```text
PostgreSQL + pgvector
```

before introducing a separate vector database.

---

# 20. Codex Operating Procedure

For every task, Codex should use this workflow:

```text
UNDERSTAND
    ↓
INSPECT
    ↓
ANALYZE
    ↓
PLAN
    ↓
SPECIFY
    ↓
HAND OFF TO ANTIGRAVITY
    ↓
REVIEW IMPLEMENTATION
    ↓
TEST RESULTS
    ↓
AUDIT
    ↓
APPROVE / REQUEST FIXES
```

When asked to work on a phase, Codex should first determine:

- what already exists
- what is missing
- dependencies
- database impact
- API impact
- AI-agent impact
- testing requirements
- migration requirements

Do not assume files or modules exist.

---

# 21. Antigravity Handoff Format

When Codex prepares work for Antigravity, provide:

```text
Task
Goal
Current State
Files/Modules Affected
Architecture Requirements
Implementation Requirements
Database Changes
API Changes
AI Prompt Requirements
Tests Required
Acceptance Criteria
Potential Risks
```

The handoff must be precise enough for Antigravity to implement without redesigning the system.

---

# 22. Quality Requirements

The final system must prioritize:

### Narrative Quality

- coherent long-term story
- believable character development
- varied arcs
- meaningful consequences
- proper foreshadowing
- satisfying progression

### Technical Quality

- deterministic state updates where possible
- idempotent jobs
- retryable generation
- persistent state
- database integrity
- test coverage
- observability
- provider abstraction

### Scalability

The architecture should work for:

```text
1 novel
10 novels
100 novels
1,000 novels
```

and each novel should support:

```text
300 chapters
500 chapters
1,000 chapters
2,000+ chapters
```

without requiring a fundamentally different architecture.

---

# 23. MVP Definition

The first usable MVP does NOT need every production feature.

Minimum successful flow:

```text
User enters title
      ↓
Generate concepts
      ↓
Select unique concept
      ↓
Generate Story Bible
      ↓
Generate several Arcs
      ↓
Generate Chapter Outlines
      ↓
Write chapters
      ↓
Extract memory
      ↓
Run continuity check
      ↓
Store completed chapters
```

The MVP should prove that the system can maintain coherent continuity across at least 50–100 generated chapters before scaling to hundreds.

---

# 24. Current Task

Do NOT immediately write the whole application.

First:

1. Inspect the repository.
2. Determine whether it is empty or contains an existing project.
3. Propose the final repository structure.
4. Design Phase 0 in detail.
5. Identify the first implementation task for Antigravity.
6. Do not implement later phases prematurely.

The long-term objective is the complete AI Novel Engine described in this document.

Codex is the architecture/planning/review brain.

Antigravity is the implementation/coding agent.

The user makes major product decisions.
