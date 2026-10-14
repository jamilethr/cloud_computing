"""Download the goodbooks-10k files we need into data/."""
from pathlib import Path
from urllib.request import urlretrieve

BASE = "https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/"
FILES = ["books.csv", "book_tags.csv", "tags.csv"]
DATA = Path(__file__).resolve().parent.parent / "data"

DATA.mkdir(exist_ok=True)
for name in FILES:
    dest = DATA / name
    if dest.exists():
        print(f"skip   {name} (already downloaded)")
        continue
    print(f"fetch  {name}")
    try:
        urlretrieve(BASE + name, dest)
    except Exception as err:
        raise SystemExit(f"Could not download {name}: {err}\n"
                         "Check the file's location in the zygmuntz/goodbooks-10k repo.")
print("done")
