# Kit — Data / ML pipeline (`dataml`)

## Summary
For projects building a repeatable data or machine-learning pipeline: data ingestion, feature engineering, model training, evaluation — something that runs, not just a one-off analysis.

## When to choose this type
The deliverable is a pipeline or model artifact meant to run again (retraining, re-scoring), and the biggest operational risk is repository bloat from committing large datasets.

## Standard folders
- `data` / `dados` — input data (expected to be gitignored or versioned outside git).
- `notebooks` — exploration and experimentation.
- `models` / `modelos` — trained model artifacts, evaluation outputs.

All three default to checked.

## Anchor file
None currently. A "model card" (objective, training data summary, metrics, known limitations) is the natural anchor-file candidate for this type and doesn't exist yet — flagged as a gap.

## Stack / limits placeholders (current)
- Stack example: "Python + PyTorch · data versioned outside git"
- Limits example: "never push the full dataset to the repository"

## Notes for the generator
- Shares a `data` folder concept with `pesquisa`, but this type's data folder is inputs to a pipeline, not raw research material to preserve untouched — the limit language reflects that difference (repo hygiene vs. data integrity).
- This is one of the kits most likely to actually need a `.gitignore` — directly relevant to the open TASKS.md item about generating a `.gitignore` per kit.
