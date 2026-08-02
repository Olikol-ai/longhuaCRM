# ECP API

Base: `/api/exam-content`  
Auth: JWT. Mutating bank/exam ops: admin | teacher | tutor (+ publish permission where noted).

## Taxonomy

- `GET /taxonomy/programs`
- `GET /taxonomy/versions?program=`
- `GET /taxonomy/levels?version=`
- `GET /taxonomy/sections?levelId=`
- `GET /taxonomy/topics?versionId=`
- `POST /taxonomy/*` (admin/staff manage)

## Item types

- `GET /item-types`
- `POST /item-types` (admin)

## Media

- `GET /media`
- `POST /media` (register asset metadata after SecureFiles upload)
- `DELETE /media/:id` (soft-archive if unreferenced)

## Items & groups

- `GET /items` — advanced search filters
- `GET /items/:id`
- `POST /items`
- `PATCH /items/:id`
- `POST /items/:id/submit-review|publish|archive`
- `POST /items/preview` — ephemeral student preview (no persist)
- `GET /items/:id/history`
- `POST /items/:id/rollback`
- `GET /items/:id/stats`
- `GET|POST /groups`, `PATCH /groups/:id`, lifecycle same as items

## Blueprints & editions

- `GET|POST /blueprints`
- `GET|POST /blueprints/:id/editions`
- `GET|PATCH /editions/:id/structure`
- `POST /editions/:id/submit-review|publish|archive|clone`

## Generate

- `POST /generate` `{ blueprint_edition_id, learner_user_id? }` → pool plan for Academy materialization

## Ops

- `POST /import`, `GET /import/:jobId`
- `POST /export`, `GET /export/:jobId`
- `POST /bulk`
