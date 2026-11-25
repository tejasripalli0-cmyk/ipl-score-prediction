# Deployment checklist

- [ ] Models in the repo: `first_innings_model.pkl` is ~114 MB (> GitHub's 100 MB limit). Either run
      `python backend/scripts/compress_models.py` and use the ~28 MB copies, or use Git LFS.
- [ ] `ball_by_ball_dataset.csv` copied to `backend/data/` (check size limits of your host/repo)
- [ ] Backend host has >= 1 GB RAM (peak ~520 MB while loading the models, plus the dataset)
- [ ] Backend `CORS_ORIGINS` = your exact frontend URL (https, no trailing slash)
- [ ] `GET https://<api>/health` returns `"status":"ok"` and all three models `true`
- [ ] Frontend env `VITE_API_URL` = `https://<api>` (set BEFORE building; it is baked in at build time)
- [ ] Frontend build command `npm run build`, output directory `dist`, root directory `frontend`
- [ ] Open the site, run a prediction, open Team Analytics (should not say "dataset needed")
- [ ] Optional: add official logos to `frontend/src/assets/logos/` and redeploy
