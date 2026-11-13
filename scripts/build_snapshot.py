"""Save the latest news so the public site can be read without the local server."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import newsfeed

def main():
    national = newsfeed.get_national()
    states = {}
    counts = {}
    depth = {}
    for state in newsfeed.STATES:
        payload = newsfeed.get_state(state["abbr"])
        states[state["abbr"]] = payload
        counts[state["abbr"]] = len(payload.get("articles") or [])
        depth[state["abbr"]] = "full" if payload.get("ok") else "pending"
        print(state["abbr"], counts[state["abbr"]])
    snapshot = {
        "generatedAt": newsfeed.now_utc().isoformat(),
        "national": national,
        "states": states,
        "counts": {
            "ok": True,
            "counts": counts,
            "depth": depth,
            "pending": 0,
            "error": "",
        },
    }
    path = ROOT / "data" / "snapshot.json"
    path.write_text(json.dumps(snapshot))
    print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
