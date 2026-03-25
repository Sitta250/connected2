# Courses Feature — Full Reference

_Last updated: 2026-03-25_

---

## Overview

The Courses feature lets Constructor University students browse the full CampusNet course catalogue, read and write peer reviews, vote on reviews and questions, ask/answer Q&A threads, and share/download study resources — all scoped to a single verified university.

---

## 1. Course List Page (`/courses`)

**File:** `app/(main)/courses/page.tsx`

### Data source
Pulls from `campusnet_courses`, which is populated by the CampusNet BFS importer (`scripts/import-campusnet/importer.ts`). Each row represents a unique academic module (deduplicated by `module_number` or `name`).

### Search
A client component (`components/features/courses-search.tsx`) syncs a `?q=` URL param on every keystroke. The server page reads `searchParams.q` and runs two parallel queries:

1. **Course name search** — `.ilike("name", "%q%")` on `campusnet_courses`, optionally filtered by `school`
2. **Professor name search** — `.ilike("name", "%q%")` on `instructors`, then walks the join chain:
   - `instructors` → `course_offering_instructors` → `course_offerings` → campusnet course IDs
   - Fetches those courses without school filter so a professor's courses from all schools appear
   - Results are merged and deduplicated with the main query

The count line shows `"taught by or matching 'X'"` when an instructor match was found.

### School filter
A sticky filter bar lets users narrow by school. Selecting a school re-runs the server query with `.eq("school", school)`.

---

## 2. Course Detail Page (`/courses/[id]`)

**File:** `app/(main)/courses/[id]/page.tsx`

### What is fetched (server-side, in parallel where possible)

| Data | Table | Notes |
|---|---|---|
| Course metadata | `campusnet_courses` | name, module number, school, curriculum type |
| Offerings | `course_offerings` | grouped by semester for Overview tab |
| Instructors | `course_offering_instructors` → `instructors` | distinct names, displayed as badges |
| Reviews | `campusnet_course_reviews` | all fields including grade, semester |
| Review votes | `campusnet_review_votes` | computes `net_votes` + `my_vote` per review |
| Resources | `campusnet_course_resources` | includes `user_id` for ownership checks |
| Questions | `campusnet_course_questions` | includes `user_id` |
| Answer counts | `campusnet_question_answers` | counted per question, fetched in parallel |
| Question votes | `campusnet_question_votes` | computes `net_votes` + `my_vote` per question |

### Decision Summary card
Blue (`#23389c`) card shown above the tabs:
- Average difficulty (x / 5)
- Average rating (x / 5)
- "Would Take Again" percentage
- Total review count
- Instructor name badges

### Tabs
`Overview` · `Resources` · `Reviews` · `Q&A`

Tab bar shows a count badge on Reviews and Q&A when content exists.

---

## 3. Overview Tab

Displays two sections:

1. **Course metadata** — school and curriculum type in a grey card
2. **"Offered In" list** — offerings grouped by semester; each semester card lists offering numbers (e.g. `CH-101-A`) and course type (Lecture, Tutorial, etc.)

If no offerings exist, shows an empty state.

---

## 4. Reviews Tab

**Component:** `ReviewCard`, `ReviewSummary` in `course-detail-tabs.tsx`

### Summary card
Shows aggregate stats (avg rating, avg difficulty, "Would Recommend %") with progress bars. Always has a "Write a Review" / "Edit Your Review" CTA button at the bottom.

### One review per student
Enforced by a unique constraint on `campusnet_course_reviews(course_id, user_id)` — the `submitReview` action uses `.upsert(..., { onConflict: "course_id,user_id" })`. The form is pre-filled with existing data when editing.

### Review sort order
Computed server-side:
1. Own review always first
2. Then sorted by `net_votes` descending

### ReviewCard
Each card shows:
- Deterministic avatar (color + 2-letter initials from user UUID, no profile fetch needed)
- "You" label + Edit / Remove buttons on own review
- Difficulty, workload, exam type badges
- Review body
- Pros (green card) / Cons (red card) / Tips (blue card) sections when present
- Upvote / Downvote buttons (hidden on own review)

### Upvote / Downvote (reviews)
- Uses `campusnet_review_votes(review_id, user_id, vote smallint)`, PK `(review_id, user_id)`
- Handled via `voteReview` server action in `app/actions/review.ts`
- **Toggle logic:** same vote → delete (toggle off); different vote → upsert
- **Optimistic UI:** `useState` + `useTransition` — UI updates instantly
- Net score is used only for sort order; not displayed to users

### Edit review
"Edit" button on own card opens `WriteReviewSheet` pre-seeded with `initialData`. Sheet title and submit button label change to "Edit Your Review" / "Save Changes".

### Delete review
"Remove" button → inline confirmation ("Remove your review? This can't be undone.") → `deleteReview(courseId)` server action → `revalidatePath`.

---

## 5. Resources Tab

**Component:** `ResourceCard`, `UploadResourceSheet` in `course-detail-tabs.tsx`

### Upload
"Upload Resource" button always at top. Opens `UploadResourceSheet` (bottom sheet):
- **Multi-file select** — `File[]` state, `<input multiple>`
- File list with per-file remove buttons before submitting
- Shared type selector (notes / slides / exam / code / pdf / other) and optional description across all files
- **Sequential upload loop** with progress indicator ("Uploading 2 of 3: notes.pdf")
- Auto-title: filename with extension stripped
- Upload goes to Supabase Storage bucket `course-resources` at path `{courseId}/{timestamp}-{index}.{ext}`
- DB insert (`campusnet_course_resources`) done **client-side** via browser Supabase client for reliable RLS auth
- On success: `router.refresh()` (no `revalidatePath` needed)

### ResourceCard
Each resource card shows:
- File type badge (color-coded: PDF → red, Slides → orange, Code → green, Video → purple, other → blue)
- Title and optional description (truncated to 2 lines)
- Download button (opens `file_url` in new tab)
- Trash button on own resources with inline confirmation ("Delete this resource?")
- Delete done **client-side** via browser Supabase client; calls `onDeleted()` → `router.refresh()`

### Why client-side for upload + delete
Server actions were not reliably forwarding auth cookies for Supabase Storage / insert operations, causing RLS `auth.uid()` to return null. The browser Supabase client reads the session cookie directly, making auth reliable.

---

## 6. Q&A Tab

**Component:** `QuestionCard`, `AskQuestionSheet` in `course-detail-tabs.tsx`

### Sort filter
Toggle between **New** (by `created_at` descending) and **Top** (by `net_votes` descending). Client-side sort — no extra fetch.

### Posting a question
"Ask a Question" button opens `AskQuestionSheet` (bottom sheet):
- Title field (required) + Details textarea (optional)
- Submits via `submitQuestion(courseId, title, body)` server action → inserts into `campusnet_course_questions` → `revalidatePath`

### QuestionCard
Each card shows:
- "Resolved" badge if `is_resolved = true`
- Time ago label
- Title + body preview (2 lines)
- Vote buttons + answer toggle in the footer

**Own question:** shows a "Delete" button in the top-right → inline confirmation → `deleteQuestion(questionId, courseId)` server action (deletes by `id + user_id` for RLS safety) → `revalidatePath`.

### Question votes
- Table: `campusnet_question_votes(question_id, user_id, vote smallint)`, PK `(question_id, user_id)`
- Vote buttons use `ArrowBigUp` / `ArrowBigDown` (Lucide) — filled solid when active
- **Optimistic UI:** state updates immediately before the DB call
- Done **client-side** via browser Supabase client (same reason as resources)
- Toggle logic: same vote → delete; different → upsert
- Net vote score is displayed between the arrows (blue if positive, red if negative, grey if zero)
- Own questions: vote buttons are disabled (`isOwn` guard)

### Answers (inline thread)
Clicking the "X answers" button in the card footer expands it to show a threaded answers section.

- **Lazy-loaded** on first expand via browser Supabase client (no data passed from server)
- Answer list: avatar + "You" label on own answers, body text, timestamp
- Own answers have a trash button (client-side delete, optimistic removal from local state)
- **Reply input** at the bottom of the expanded section: inline text field + "Post" button
- Submit calls `submitAnswer(questionId, body)` server action → inserts into `campusnet_question_answers`
- **Optimistic insert:** new answer appended to local state immediately using `crypto.randomUUID()` as a temp ID

---

## 7. Database Tables

| Table | Purpose |
|---|---|
| `campusnet_courses` | Deduplicated academic modules |
| `course_offerings` | Semester-specific offering per module |
| `course_offering_instructors` | Junction: offerings ↔ instructors |
| `instructors` | Unique instructor names |
| `campusnet_course_reviews` | Student reviews; unique on `(course_id, user_id)` |
| `campusnet_review_votes` | Upvote/downvote on reviews; PK `(review_id, user_id)` |
| `campusnet_course_resources` | Uploaded files; `file_url` points to Supabase Storage |
| `campusnet_course_questions` | Q&A questions per course |
| `campusnet_question_votes` | Upvote/downvote on questions; PK `(question_id, user_id)` |
| `campusnet_question_answers` | Threaded answers per question |

All tables have RLS enabled. Common policy pattern:
- `authenticated read` — all logged-in users can read
- `own insert` — `user_id = auth.uid()`
- `own update/delete` — `using (user_id = auth.uid())`

---

## 8. Server Actions

| File | Action | What it does |
|---|---|---|
| `app/actions/review.ts` | `submitReview` | Upserts review by `(course_id, user_id)` |
| | `voteReview` | Toggle-upsert on `campusnet_review_votes` |
| | `deleteReview` | Deletes by `(course_id, user_id)` |
| `app/actions/question.ts` | `submitQuestion` | Inserts question, revalidates page |
| | `deleteQuestion` | Deletes by `(id, user_id)`, revalidates page |
| | `submitAnswer` | Inserts answer into `campusnet_question_answers` |
| `app/actions/resource.ts` | `submitResource` | _Unused_ — insert done client-side instead |

---

## 9. Key Files

| File | Role |
|---|---|
| `app/(main)/courses/page.tsx` | Course list with search + school filter |
| `app/(main)/courses/[id]/page.tsx` | Course detail — all data fetching |
| `components/features/course-detail-tabs.tsx` | All tabs, cards, and sheets (single large client component) |
| `components/features/write-review-sheet.tsx` | Review form sheet (write + edit modes) |
| `components/features/courses-search.tsx` | Search input with URL param sync |
| `supabase/campusnet_tables.sql` | Core tables + instructors |
| `supabase/campusnet_resources_questions.sql` | Resources, questions, answers tables |
| `supabase/campusnet_review_votes.sql` | Review votes table |
| `supabase/campusnet_question_votes.sql` | Question votes table |

---

## 10. Remaining / Not Yet Built

- [ ] Mark question as resolved (toggle `is_resolved`)
- [ ] Q&A: upvote individual answers
- [ ] Resources: edit title/description after upload
- [ ] Course detail: link out to official CampusNet page
- [ ] Instructor profile page (all courses by instructor)
