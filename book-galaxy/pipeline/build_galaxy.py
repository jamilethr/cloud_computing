"""Turn goodbooks-10k into web/data.json: a 2D map of books.

Steps: tags -> TF-IDF -> SVD (50 dims) -> UMAP (2 dims) -> clusters -> JSON.
Also saves data/preview.png so you can check the map before building any frontend.
"""
import colorsys
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import umap
from scipy.sparse import csr_matrix
from sklearn.cluster import HDBSCAN
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parent.parent
DATA, OUT = ROOT / "data", ROOT / "web" / "data.json"
SEED = 42
MIN_BOOKS_PER_TAG = 20

# Shelf names that describe a reader's habits, not the book.
JUNK = (r"to-?read|favou?rites?|currently|^owned|^own$|books-i-own|wish|^\d|kindle|"
        r"audio|ebook|library|default|book-?club|dnf|tbr|^read$|^reading$|^finished|"
        r"^unread|my-books|abandoned|maybe")

books = pd.read_csv(DATA / "books.csv")
book_tags = pd.read_csv(DATA / "book_tags.csv")
tags = pd.read_csv(DATA / "tags.csv")

tags = tags[~tags.tag_name.str.contains(JUNK, regex=True, na=True)]
bt = book_tags.merge(tags, on="tag_id")
freq = bt.groupby("tag_id").goodreads_book_id.nunique()
bt = bt[bt.tag_id.isin(freq[freq >= MIN_BOOKS_PER_TAG].index)]

book_idx = {g: i for i, g in enumerate(books.goodreads_book_id)}
tag_ids = sorted(bt.tag_id.unique())
tag_idx = {t: i for i, t in enumerate(tag_ids)}
tag_names = tags.set_index("tag_id").tag_name.loc[tag_ids].tolist()

rows = bt.goodreads_book_id.map(book_idx)
bt = bt[rows.notna()]
rows = rows[rows.notna()].astype(int)
cols = bt.tag_id.map(tag_idx)
weights = np.log1p(bt["count"].to_numpy())
X = csr_matrix((weights, (rows, cols)), shape=(len(books), len(tag_ids)))
X = TfidfTransformer().fit_transform(X)
print(f"{X.shape[0]} books x {X.shape[1]} tags")

Z = normalize(TruncatedSVD(50, random_state=SEED).fit_transform(X))
xy = umap.UMAP(n_neighbors=15, min_dist=0.1, metric="cosine",
               random_state=SEED).fit_transform(Z)
xy = (xy - xy.min(0)) / (xy.max(0) - xy.min(0))

# Cluster the 2D map itself, so clusters match the regions people will see.
labels = HDBSCAN(min_cluster_size=40).fit_predict(xy)

global_mean = np.asarray(X.mean(axis=0)).ravel()
clusters = []
for k, c in enumerate(sorted(set(labels) - {-1})):
    mask = labels == c
    lift = np.asarray(X[mask].mean(axis=0)).ravel() - global_mean
    top = [tag_names[i] for i in lift.argsort()[::-1][:3]]
    r, g, b = colorsys.hls_to_rgb((k * 0.381966) % 1, 0.62, 0.7)
    clusters.append({"id": int(c), "label": ", ".join(top), "n": int(mask.sum()),
                     "color": "#%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255)),
                     "x": round(float(xy[mask, 0].mean()), 4),
                     "y": round(float(xy[mask, 1].mean()), 4)})
    print(f"cluster {c:>2} ({mask.sum():>4} books): {clusters[-1]['label']}")

nn = NearestNeighbors(n_neighbors=7, metric="cosine").fit(Z).kneighbors(Z)[1][:, 1:]

def year(v):
    return None if pd.isna(v) else int(v)

out = {"clusters": clusters, "books": [
    {"t": r.title, "a": r.authors, "yr": year(r.original_publication_year),
     "r": round(float(r.average_rating), 2), "n": int(r.ratings_count),
     "c": int(labels[i]), "x": round(float(xy[i, 0]), 4), "y": round(float(xy[i, 1]), 4),
     "nn": nn[i].tolist()}
    for i, r in enumerate(books.itertuples())]}

OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")

plt.figure(figsize=(10, 10), facecolor="#0b0d1c")
plt.axes().set_facecolor("#0b0d1c")
cmap = {c["id"]: c["color"] for c in clusters}
plt.scatter(xy[:, 0], xy[:, 1], s=2, c=[cmap.get(int(l), "#8a8fa8") for l in labels])
plt.axis("off")
plt.savefig(DATA / "preview.png", dpi=120, bbox_inches="tight", facecolor="#0b0d1c")
print("preview saved to data/preview.png")
