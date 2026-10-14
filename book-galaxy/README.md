# Book Galaxy

An interactive map of ~10,000 books. Python turns reader-applied shelf tags from
[goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) into 2D positions
(TF-IDF → SVD → UMAP) and clusters; a small D3 + canvas page renders them as a zoomable galaxy.

```
pipeline/   Python: download data, build the map, export web/data.json
web/        Static site: index.html, style.css, app.js (+ generated data.json)
data/       Raw CSVs and preview.png (gitignored)
```

## Run it locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python pipeline/download_data.py   # fetches CSVs into data/
python pipeline/build_galaxy.py    # writes web/data.json and data/preview.png
cd web && python -m http.server 8080
```

Open http://localhost:8080. Look at `data/preview.png` first: if the map looks like
a blob, tune `n_neighbors` / `min_dist` in `build_galaxy.py` before touching the frontend.

## Run it in a container (same thing Cloud Run will run)

Build `web/data.json` first (the image only copies `web/`), then:

```bash
docker build -t book-galaxy .
docker run --rm -p 8080:8080 book-galaxy
```

Open http://localhost:8080. To test the port variable the way Cloud Run uses it:
`docker run --rm -e PORT=9000 -p 9000:9000 book-galaxy`.

Deploy to Cloud Run from the repo root (once `gcloud` is set up and you are logged in):

```bash
gcloud run deploy book-galaxy --source . --region us-central1 --allow-unauthenticated
```

## Before you push

- [ ] `python pipeline/build_galaxy.py` finishes and `data/preview.png` looks like a galaxy
- [ ] The page loads at http://localhost:8080 with no errors in the browser Console
- [ ] The container runs locally with the `docker run` commands above
- [ ] `web/data.json` is committed; `data/` is not; no keys or personal info in any file

## Git workflow (practice it even solo)

```bash
git checkout -b feature/tune-umap     # one branch per idea
git add -p                            # review what you stage
git commit -m "Tune UMAP neighbors for tighter clusters"
git push -u origin feature/tune-umap  # then open a Pull Request on GitHub and merge
```

Commit `web/data.json` (small); never commit `data/`.

## Notes

- Dataset is a ~2017 snapshot, so recent books are missing. Check its license before publishing.
- Planned: deploy the container to Google Cloud Run (or `web/` alone as a static site on Cloud Storage / Firebase Hosting).
