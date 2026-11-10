"""Lists the Free Use Bible API translations that have recorded narration.

The catalogue doesn't say which have audio, so this asks each translation for one chapter
(John 1, or Genesis 1, Matthew 1 or Psalm 1 when it lacks John) and checks the chapter's
audio links. Update NARRATED_FREE_IDS in src/translations.ts with the result.

    python3 scripts/find-narrated.py
"""
import concurrent.futures
import json
import urllib.request

API = 'https://bible.helloao.org/api'


def get(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)
    except Exception:
        return None


def narrators(translation):
    for chapter in ('JHN/1', 'GEN/1', 'MAT/1', 'PSA/1'):
        d = get(f"{API}/{translation['id']}/{chapter}.json")
        if d:
            return translation['id'], sorted((d.get('thisChapterAudioLinks') or {}).keys())
    return translation['id'], []


translations = get(f'{API}/available_translations.json')['translations']
with concurrent.futures.ThreadPoolExecutor(24) as pool:
    found = {t: n for t, n in pool.map(narrators, translations) if n}
print(json.dumps(found, indent=2))
