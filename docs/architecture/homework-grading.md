# Homework grading

Single source of truth: PostgreSQL (`homework_results`, `homework_attempt_answers`) → API → UI.
Do not store grading mode or percent only in localStorage.

## Overall percent

`homework_results.grading_mode`:

| Mode | Percent |
| --- | --- |
| `auto` (default, including legacy rows with a missing mode) | `sum(earned_points) / sum(question.points) * 100` |
| `manual` | `manual_percentage` (0–100). Item score edits must not recompute it. |

`percent` is the value shown to teachers and students. `score` / `max_score` always reflect item point totals.

## Points vs difficulty

- **Points** (`homework_items.points`, snapshot `points`) are the grading weight of a task.
- **Difficulty** (`homework_items.difficulty`, assessment `difficulty`) is metadata only: typically **1–5**, copied from the question bank.

Difficulty is not a multiplier for homework percent. Assessment and HSK Academy still filter the bank by 1–5, so this product does not migrate difficulty to 1–10.

## Student-facing vs reviewer-only

| Field | Audience |
| --- | --- |
| `owner_comment` / `student_feedback` | Student after review (overall teacher comment) |
| `review_comment` on an attempt answer | Student after review (per-item comment) |
| `earned_points` / own `is_correct` | Student after review |
| `explanation` (expected / reviewer answer) | Teacher always; student only if `show_correct_answers` is true |
| Option `is_correct` | Same as `explanation` |

There is no separate private teacher notepad. `explanation` stays the reviewer expected answer unless the teacher enables “show the correct answer to the student after review”.
