# HosBac API — Turso / Vercel v3

Cette version corrige la gestion des utilisateurs et des favoris autour des schémas Turso fournis :

## Tables ciblées

### users
`uid`, `nom`, `prenom`, `email`, `classe`, `serie`, `region`, `role`, `totalXp`, `quiz_xp`, `examsUploaded`, `examsDownloaded`, `badges`, `status`, `created_at`

### favorites
`id`, `user_id`, `exam_id`, `created_at`

## Variables Vercel
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `CORS_ORIGIN` (recommandé, par exemple `https://hosbac-app.vercel.app`)
- `CRON_SECRET` pour `/api/refresh-admin-stats`

## Routes importantes
- `GET/POST/PATCH/PUT /api/user-profile`
- `GET/POST/PATCH/PUT /api/users`
- `GET /api/admin-users`
- `GET /api/admin-stats`
- `DELETE/POST /api/admin-delete-user`
- `GET/POST/PUT/DELETE /api/favorites`

L'UID est accepté via `X-User-UID`, `X-UID`, `X-Firebase-UID`, `uid`, `userId` ou `user_id` dans la query/body. Lorsqu'un Bearer Firebase est fourni sur le profil, son UID doit correspondre à l'UID demandé.
