"""Live news for American Pulse.

Stories come from publisher RSS feeds and the Bing News index.
Nothing in this module invents headlines, dates, publishers, or links.
Optional Guardian and New York Times API keys are read from the environment
and never returned to the browser.
"""

from __future__ import annotations

import difflib
import hashlib
import html
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_PATH = ROOT / ".cache" / "news.json"
CACHE_VERSION = 3
WINDOW = timedelta(days=7)
SUCCESS_TTL = 12 * 60
FAILURE_TTL = 45
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

FEEDS = [
    {"id": "nyt-us", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"},
    {"id": "nyt-politics", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml"},
    {"id": "nyt-business", "publisher": "The New York Times", "bucket": "us", "section": "economy", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"},
    {"id": "nyt-economy", "publisher": "The New York Times", "bucket": "us", "section": "economy", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml"},
    {"id": "nyt-climate", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml"},
    {"id": "nyt-environment", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/EnergyEnvironment.xml"},
    {"id": "nyt-education", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Education.xml"},
    {"id": "nyt-tech", "publisher": "The New York Times", "bucket": "us", "section": "technology", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"},
    {"id": "nyt-science", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml"},
    {"id": "nyt-health", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml"},
    {"id": "nyt-ny", "publisher": "The New York Times", "bucket": "us", "url": "https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml"},
    {"id": "npr-news", "publisher": "NPR", "bucket": "world", "url": "https://feeds.npr.org/1001/rss.xml"},
    {"id": "npr-national", "publisher": "NPR", "bucket": "us", "url": "https://feeds.npr.org/1003/rss.xml"},
    {"id": "npr-business", "publisher": "NPR", "bucket": "us", "section": "economy", "url": "https://feeds.npr.org/1006/rss.xml"},
    {"id": "npr-science", "publisher": "NPR", "bucket": "us", "url": "https://feeds.npr.org/1007/rss.xml"},
    {"id": "npr-politics", "publisher": "NPR", "bucket": "us", "url": "https://feeds.npr.org/1014/rss.xml"},
    {"id": "bbc-us", "publisher": "BBC", "bucket": "us", "url": "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"},
    {"id": "pbs-head", "publisher": "PBS NewsHour", "bucket": "us", "url": "https://www.pbs.org/newshour/feeds/rss/headlines"},
    {"id": "pbs-politics", "publisher": "PBS NewsHour", "bucket": "us", "url": "https://www.pbs.org/newshour/feeds/rss/politics"},
    {"id": "pbs-nation", "publisher": "PBS NewsHour", "bucket": "us", "url": "https://www.pbs.org/newshour/feeds/rss/nation"},
    {"id": "pbs-economy", "publisher": "PBS NewsHour", "bucket": "us", "url": "https://www.pbs.org/newshour/feeds/rss/economy"},
    {"id": "wapo-national", "publisher": "The Washington Post", "bucket": "us", "url": "https://feeds.washingtonpost.com/rss/national"},
    {"id": "wapo-politics", "publisher": "The Washington Post", "bucket": "us", "url": "https://feeds.washingtonpost.com/rss/politics"},
    {"id": "wapo-business", "publisher": "The Washington Post", "bucket": "us", "section": "economy", "url": "https://feeds.washingtonpost.com/rss/business"},
    {"id": "reuters-us", "publisher": "Reuters", "bucket": "us", "url": "https://www.reuters.com/world/us/rss"},
    {"id": "ap-top", "publisher": "Associated Press", "bucket": "us", "url": "https://apnews.com/hub/ap-top-news?outputType=rss"},
]

PRIORITY_DOMAINS = {
    "nytimes.com", "npr.org", "bbc.co.uk", "bbc.com", "pbs.org",
    "washingtonpost.com", "reuters.com", "apnews.com", "wsj.com",
    "latimes.com", "sfchronicle.com", "chicagotribune.com", "bostonglobe.com",
    "texastribune.org", "calmatters.org", "politico.com", "thehill.com",
    "bloomberg.com", "propublica.org", "usatoday.com", "axios.com",
}
BLOCKED_DOMAINS = {
    "facebook.com", "instagram.com", "tiktok.com", "pinterest.com",
    "reddit.com", "youtube.com", "amazon.com", "ebay.com", "wikipedia.org",
    "x.com", "twitter.com",
}
CATEGORIES = [
    ("elections", "Elections", ("election", "ballot", "midterm", "caucus", "primary voters", "polling place")),
    ("immigration", "Immigration", ("immigration", "migrant", "asylum", "deport", "border patrol", "undocumented")),
    ("education", "Education", ("school", "student", "teacher", "university", "college", "campus", "education")),
    ("environment", "Environment", ("climate", "wildfire", "hurricane", "flood", "drought", "emission", "pollution", "epa", "tornado", "earthquake", "oil spill")),
    ("economy", "Economy and Business", ("economy", "economic", "inflation", "federal reserve", "interest rate", "unemployment", "wall street", "stock", "stocks", "shares", "tariff", "jobs", "wages", "layoff", "earnings", "recession", "retail sales", "pricey", "prices", "gross domestic")),
    ("technology", "Technology", ("artificial intelligence", "technology", "software", "cyber", "semiconductor", "startup")),
    ("crime", "Crime and Public Safety", ("police", "shooting", "homicide", "murder", "arrest", "charged with", "prison", "crime", "fbi")),
    ("politics", "Politics and Government", ("governor", "senate", "congress", "legislature", "white house", "president", "democrat", "republican", "lawmaker", "supreme court", "mayor", "administration", "house speaker", "state house")),
    ("culture", "Culture and Society", ("museum", "festival", "nfl", "nba", "mlb", "football", "basketball", "baseball", "music", "concert")),
]
US_SIGNAL = re.compile(
    r"\b(united states|u\.s\.|u\.s\.a\.|america|american|congress|senate|white house|federal|president|supreme court|washington)\b",
    re.I,
)
NOISE = re.compile(
    r"\b(betting odds|point spread|fantasy football|waiver wire|power rankings|football rankings|best bets|expert picks|moneyline|over/under|college basketball picks)\b|\bvs\.?\b.+\b(prediction|picks|odds)\b",
    re.I,
)
STOP = {"the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with", "as", "at", "by", "from", "after", "over", "its", "is", "are"}

UNAVAILABLE = "News is unavailable. The live feeds did not respond, so no stories are shown."
EMPTY_STATE = "No articles from the past 7 days matched this state."
EMPTY_SEARCH = "No articles from the past 7 days matched that search."
EMPTY_NATIONAL = "No national articles from the past 7 days are available."

_lock = threading.Lock()
_inflight = {}
_bing_lock = threading.Lock()
_bing_next = 0.0
_cache = None
_indexer_started = False


def load_env():
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()
STATES = json.loads((ROOT / "data" / "states.json").read_text())
BY_ABBR = {state["abbr"]: state for state in STATES}


def now_utc():
    return datetime.now(timezone.utc)


def fresh_cache():
    return {"version": CACHE_VERSION, "wires": None, "bing": {}, "states": {}, "national": None, "searches": {}}


def cache():
    global _cache
    if _cache is not None:
        return _cache
    _cache = fresh_cache()
    if os.environ.get("PULSE_CACHE", "1") == "0" or not CACHE_PATH.exists():
        return _cache
    try:
        loaded = json.loads(CACHE_PATH.read_text())
        if loaded.get("version") == CACHE_VERSION:
            _cache = loaded
    except (OSError, json.JSONDecodeError):
        _cache = fresh_cache()
    return _cache


def save_cache():
    if os.environ.get("PULSE_CACHE", "1") == "0":
        return
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = CACHE_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(cache()))
    temporary.replace(CACHE_PATH)


def fresh(entry, ttl):
    return bool(entry) and (time.time() - entry.get("at", 0)) < ttl


def once(key, builder):
    with _lock:
        current = _inflight.get(key)
        if current is None:
            event = threading.Event()
            box = {}
            _inflight[key] = (event, box)

            def run():
                try:
                    box["value"] = builder()
                except Exception as error:  # noqa: BLE001 - returned to the caller
                    box["error"] = error
                finally:
                    event.set()
                    with _lock:
                        _inflight.pop(key, None)

            threading.Thread(target=run, daemon=True).start()
        else:
            event, box = current
    if not event.wait(40):
        raise TimeoutError("The news lookup timed out.")
    if "error" in box:
        raise box["error"]
    return box["value"]


def http_get(url, timeout=12, limit=1_600_000):
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, application/json, text/xml, */*;q=0.5"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read(limit)
        charset = response.headers.get_content_charset() or "utf-8"
        return payload.decode(charset, "replace")


def clean_text(value):
    if not value:
        return ""
    value = re.sub(r"<!\[CDATA\[([\s\S]*?)\]\]>", r"\1", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = value.replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def tag(block, name):
    match = re.search(rf"<{name}\b[^>]*>([\s\S]*?)</{name}>", block, re.I)
    return clean_text(match.group(1)) if match else ""


def parse_date(value):
    if not value:
        return None
    value = clean_text(value)
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError):
        parsed = None
    if parsed is None:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def in_window(moment):
    if moment is None:
        return False
    current = now_utc()
    return current - WINDOW <= moment <= current + timedelta(hours=6)


def domain_of(url):
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def good_url(url):
    if not url or any(char.isspace() for char in url):
        return False
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or not host:
        return False
    if host in {"localhost", "127.0.0.1", "0.0.0.0"} or host.endswith(".local"):
        return False
    if any(host == blocked or host.endswith("." + blocked) for blocked in BLOCKED_DOMAINS):
        return False
    return True


def is_priority(domain):
    return any(domain == item or domain.endswith("." + item) for item in PRIORITY_DOMAINS)


def classify(text, section=None):
    lowered = text.lower()
    scores = []
    for identifier, label, words in CATEGORIES:
        score = sum(1 for word in words if word in lowered)
        if score:
            scores.append((score, identifier, label))
    if scores:
        scores.sort(key=lambda item: item[0], reverse=True)
        return scores[0][1], scores[0][2]
    labels = {identifier: label for identifier, label, _words in CATEGORIES}
    if section in labels:
        return section, labels[section]
    return "uncategorized", "Uncategorized"


def title_key(title):
    words = [word for word in re.findall(r"[a-z0-9]+", title.lower()) if word not in STOP]
    return " ".join(words[:16])


def same_story(left, right):
    if left["titleKey"] and left["titleKey"] == right["titleKey"]:
        return True
    left_words = set(left["titleKey"].split())
    right_words = set(right["titleKey"].split())
    if len(left_words) < 4 or len(right_words) < 4:
        return False
    overlap = len(left_words & right_words)
    return overlap / len(left_words | right_words) >= 0.72


def quality(article):
    domain = article.get("domain") or ""
    aggregated = domain.endswith("msn.com") or "yahoo.com" in domain
    return (
        1 if article.get("summary") else 0,
        1 if article.get("priority") else 0,
        1 if article.get("image") else 0,
        0 if aggregated else 1,
    )


def dedupe(articles):
    kept = []
    for article in articles:
        match = next((item for item in kept if same_story(item, article)), None)
        if match is None:
            kept.append(article)
        elif quality(article) > quality(match):
            kept[kept.index(match)] = article
    kept.sort(key=lambda article: article["publishedAt"], reverse=True)
    return kept


def usable_summary(summary, title):
    if not summary or len(summary) < 28:
        return None
    if difflib.SequenceMatcher(None, summary.lower(), title.lower()).ratio() > 0.9:
        return None
    if len(summary) > 360:
        clipped = summary[:360]
        space = clipped.rfind(" ")
        summary = (clipped[:space] if space > 240 else clipped).rstrip(".,; ") + "…"
    return summary


def make_article(*, title, url, publisher, published, summary, image, geos, bucket, section=None):
    title = clean_text(title)
    publisher = clean_text(publisher)
    if publisher and title.lower().endswith(publisher.lower()):
        title = re.sub(rf"\s+[-|–—]\s+{re.escape(publisher)}\s*$", "", title, flags=re.I).strip()
    url = html.unescape(url or "").strip()
    if re.search(r"\b(pickdawgz|rotowire|action network|dimers)\b", publisher, re.I):
        return None
    if not good_url(url) or len(title) < 12 or not publisher or NOISE.search(title):
        return None
    moment = published if isinstance(published, datetime) else parse_date(published)
    if not in_window(moment):
        return None
    domain = domain_of(url)
    if "bing.com" in domain or "news.google.com" in domain:
        return None
    summary = usable_summary(clean_text(summary), title)
    category, label = classify(f"{title} {summary or ''}", section)
    image = html.unescape(image).strip() if image else ""
    if image.startswith("http://") and "bing.com" in image:
        image = "https://" + image[len("http://"):]
    if image and not good_url(image):
        image = ""
    return {
        "id": hashlib.sha1(title_key(title).encode()).hexdigest()[:12],
        "title": title,
        "publisher": publisher,
        "url": url,
        "publishedAt": moment.isoformat(),
        "summary": summary,
        "category": category,
        "categoryLabel": label,
        "image": image or None,
        "priority": is_priority(domain),
        "domain": domain,
        "titleKey": title_key(title),
        "geos": geos or [],
        "bucket": bucket or "us",
    }


def image_from(block):
    patterns = (
        r'<media:content\b[^>]*\burl="([^"]+)"',
        r'<media:thumbnail\b[^>]*\burl="([^"]+)"',
        r"<News:Image>([\s\S]*?)</News:Image>",
        r"<img[^>]+src=['\"]([^'\"]+)['\"]",
    )
    for pattern in patterns:
        match = re.search(pattern, block, re.I)
        if match:
            candidate = html.unescape(match.group(1))
            if "npr-rss-pixel" in candidate or candidate.endswith(".gif"):
                continue
            return candidate
    return ""


def link_from(block):
    news = re.search(r"<News:Source>", block, re.I)
    direct = tag(block, "link")
    if direct:
        parsed = urllib.parse.urlparse(html.unescape(direct))
        target = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
        if target:
            return target
        return direct
    alternate = re.search(r'<link\b[^>]*rel="alternate"[^>]*href="([^"]+)"', block, re.I)
    if alternate:
        return alternate.group(1)
    href = re.search(r'<link\b[^>]*href="([^"]+)"', block, re.I)
    if href:
        return href.group(1)
    if news:
        return ""
    return ""


def parse_feed(xml, publisher=None, bucket="us", section=None):
    blocks = re.findall(r"<item\b[^>]*>([\s\S]*?)</item>", xml, re.I)
    atom = False
    if not blocks:
        blocks = re.findall(r"<entry\b[^>]*>([\s\S]*?)</entry>", xml, re.I)
        atom = True
    articles = []
    for block in blocks:
        geos = [clean_text(item) for item in re.findall(r'<category\b[^>]*nyt_geo[^>]*>([\s\S]*?)</category>', block, re.I)]
        source = tag(block, "News:Source") or publisher or tag(block, "dc:creator") or ""
        if source.lower().startswith("associated press") and publisher == "NPR":
            source = "NPR"
        published = tag(block, "published") if atom else tag(block, "pubDate") or tag(block, "dc:date") or tag(block, "published")
        article = make_article(
            title=tag(block, "title"),
            url=link_from(block),
            publisher=source,
            published=published,
            summary=tag(block, "description") or tag(block, "summary"),
            image=image_from(block),
            geos=geos,
            bucket=bucket,
            section=section,
        )
        if article:
            articles.append(article)
    return articles


def phrase(text, words):
    return re.search(rf"\b{re.escape(words)}\b", text, re.I) is not None


def mentioned(text, state):
    lowered = text.lower()
    mode = state.get("mode", "default")
    if state["abbr"] == "RI":
        lowered = re.sub(r"\brhode island (avenue|ave\.?|street|st\.?|road|rd\.?|place|pl\.?)\b", " ", lowered)
    if state["abbr"] == "AK":
        lowered = re.sub(r"\balaska airlines\b", " ", lowered)
    if mode == "georgia" and re.search(r"tbilisi|caucasus|republic of georgia|country of georgia|south ossetia", lowered):
        return False
    if mode == "virginia":
        lowered = re.sub(r"\bwest virginia\b", " ", lowered)
    if mode == "washington":
        return any(phrase(lowered, item) for item in state["patterns"])
    return any(phrase(lowered, item) for item in state["patterns"])


def geo_hit(article, state):
    for geo in article.get("geos") or []:
        value = geo.lower()
        if value == state["name"].lower():
            return True
        if state["abbr"] == "NY" and value in {"new york city", "new york state"}:
            return True
        if state["abbr"] == "DC" and "district of columbia" in value:
            return True
    return False


def matches_state(article, state):
    if state["abbr"] == "VA":
        geos = [geo.lower() for geo in article.get("geos") or []]
        if "west virginia" in geos and "virginia" not in geos and not mentioned(article["title"], {**state, "mode": "virginia"}):
            return False
    if geo_hit(article, state):
        return True
    return mentioned(f"{article['title']} {article.get('summary') or ''}", state)


def us_relevant(article):
    if article.get("bucket") == "us":
        return True
    text = f"{article['title']} {article.get('summary') or ''}"
    if US_SIGNAL.search(text):
        return True
    return any(matches_state(article, state) for state in STATES)


def public_article(article):
    return {
        "id": article["id"],
        "title": article["title"],
        "publisher": article["publisher"],
        "url": article["url"],
        "publishedAt": article["publishedAt"],
        "summary": article.get("summary"),
        "category": article["category"],
        "categoryLabel": article["categoryLabel"],
        "image": article.get("image"),
        "priority": article["priority"],
        "domain": article["domain"],
    }


def load_wires():
    stored = cache().get("wires")
    if fresh(stored, SUCCESS_TTL):
        return stored

    def build():
        from concurrent.futures import ThreadPoolExecutor

        def pull(feed):
            try:
                xml = http_get(feed["url"], timeout=10)
                if "<item" not in xml.lower() and "<entry" not in xml.lower():
                    print(f"feed {feed['id']} had no items")
                    return feed["id"], [], "empty"
                return feed["id"], parse_feed(xml, feed["publisher"], feed["bucket"], feed.get("section")), "ok"
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
                return feed["id"], [], str(error.__class__.__name__)

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(pull, FEEDS))
        articles = dedupe([article for _, group, _ in results for article in group])
        ok = sum(1 for _, group, status in results if status == "ok" and group)
        entry = {
            "at": time.time(),
            "articles": articles,
            "feedOk": ok,
            "feeds": {feed_id: status for feed_id, _, status in results},
        }
        with _lock:
            cache()["wires"] = entry
            save_cache()
        alive = ", ".join(feed_id for feed_id, _, status in results if status == "ok")
        print(f"American Pulse wires ready ({ok} feeds): {alive}", flush=True)
        return entry

    return once("wires", build)


def bing_search(query):
    key = re.sub(r"\s+", " ", query).strip().lower()[:120]
    stored = cache().get("bing", {}).get(key)
    ttl = SUCCESS_TTL if stored and stored.get("ok") and stored.get("articles") else FAILURE_TTL
    if fresh(stored, ttl):
        return stored

    def build():
        global _bing_next
        params = urllib.parse.urlencode({
            "q": query,
            "format": "RSS",
            "setlang": "en-US",
            "setmkt": "en-US",
            "qft": 'interval="7"',
        })
        url = f"https://www.bing.com/news/search?{params}"
        try:
            with _bing_lock:
                delay = _bing_next - time.time()
                if delay > 0:
                    time.sleep(delay)
                _bing_next = time.time() + 0.3
                xml = http_get(url, timeout=12)
            if "<rss" not in xml[:800].lower():
                raise RuntimeError("The news index returned an unexpected response.")
            articles = parse_feed(xml, publisher=None, bucket="us")
            entry = {"at": time.time(), "ok": True, "articles": articles, "error": ""}
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError) as error:
            entry = {"at": time.time(), "ok": False, "articles": [], "error": str(error)}
        with _lock:
            cache().setdefault("bing", {})[key] = entry
            save_cache()
        return entry

    return once(f"bing:{key}", build)


def optional_apis(query):
    found = []
    guardian = os.environ.get("GUARDIAN_API_KEY", "").strip()
    if guardian:
        found.extend(fetch_guardian(query, guardian))
    nyt = os.environ.get("NYT_API_KEY", "").strip()
    if nyt:
        found.extend(fetch_nyt(query, nyt))
    return found


def fetch_guardian(query, key):
    start = (now_utc() - WINDOW).date().isoformat()
    params = urllib.parse.urlencode({
        "q": query,
        "from-date": start,
        "order-by": "newest",
        "page-size": "15",
        "show-fields": "trailText,thumbnail",
        "api-key": key,
    })
    try:
        payload = json.loads(http_get(f"https://content.guardianapis.com/search?{params}", timeout=10))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
        return []
    articles = []
    for item in payload.get("response", {}).get("results", []):
        fields = item.get("fields") or {}
        article = make_article(
            title=item.get("webTitle", ""),
            url=item.get("webUrl", ""),
            publisher="The Guardian",
            published=item.get("webPublicationDate", ""),
            summary=fields.get("trailText", ""),
            image=fields.get("thumbnail", ""),
            geos=[],
            bucket="world",
        )
        if article:
            articles.append(article)
    return articles


def fetch_nyt(query, key):
    begin = (now_utc() - WINDOW).strftime("%Y%m%d")
    params = urllib.parse.urlencode({
        "q": query,
        "begin_date": begin,
        "sort": "newest",
        "api-key": key,
    })
    try:
        payload = json.loads(http_get(f"https://api.nytimes.com/svc/search/v2/articlesearch.json?{params}", timeout=10))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
        return []
    articles = []
    for doc in payload.get("response", {}).get("docs", []):
        headline = (doc.get("headline") or {}).get("main", "")
        image = ""
        multimedia = doc.get("multimedia") or {}
        if isinstance(multimedia, dict):
            image = (multimedia.get("default") or {}).get("url") or ""
        elif isinstance(multimedia, list) and multimedia:
            image = multimedia[0].get("url") or ""
        if image and image.startswith("images/"):
            image = "https://www.nytimes.com/" + image
        article = make_article(
            title=headline,
            url=doc.get("web_url", ""),
            publisher="The New York Times",
            published=doc.get("pub_date", ""),
            summary=doc.get("abstract", ""),
            image=image,
            geos=[],
            bucket="us",
        )
        if article:
            articles.append(article)
    return articles


def envelope(scope, articles, *, ok=True, message="", notice="", state=None, feed_ok=1):
    if not ok or feed_ok <= 0 and not articles:
        return {
            "ok": False,
            "scope": scope,
            "state": state,
            "retrievedAt": now_utc().isoformat(),
            "windowDays": 7,
            "articles": [],
            "error": UNAVAILABLE,
            "message": UNAVAILABLE,
            "notice": "",
        }
    return {
        "ok": True,
        "scope": scope,
        "state": state,
        "retrievedAt": now_utc().isoformat(),
        "windowDays": 7,
        "articles": [public_article(article) for article in articles],
        "error": "",
        "message": message if not articles else "",
        "notice": notice,
    }


def get_national():
    stored = cache().get("national")
    if fresh(stored, SUCCESS_TTL) and stored.get("payload", {}).get("ok"):
        return stored["payload"]

    def build():
        try:
            wires = load_wires()
        except Exception:  # noqa: BLE001
            wires = {"articles": [], "feedOk": 0}
        indexed = bing_search('(Congress OR "Supreme Court" OR "White House" OR "Federal Reserve" OR "U.S. economy")')
        extras = optional_apis("United States Congress OR economy OR Supreme Court")
        pool = [article for article in wires["articles"] if us_relevant(article)]
        pool.extend(indexed["articles"])
        pool.extend(article for article in extras if us_relevant(article))
        articles = dedupe(pool)[:48]
        notice = ""
        if not indexed["ok"] and wires["feedOk"]:
            notice = "The search index did not respond. Showing publisher-wire stories only."
        message = "" if articles else (UNAVAILABLE if wires["feedOk"] <= 0 and not indexed["ok"] else EMPTY_NATIONAL)
        ok = bool(articles) or wires["feedOk"] > 0 or indexed["ok"]
        payload = envelope("national", articles, ok=ok, message=message, notice=notice, feed_ok=max(wires["feedOk"], 1 if indexed["ok"] else 0))
        if not articles and wires["feedOk"] <= 0 and not indexed["ok"]:
            payload = envelope("national", [], ok=False, feed_ok=0)
        with _lock:
            cache()["national"] = {"at": time.time(), "payload": payload}
            save_cache()
        return payload

    return once("national", build)


def state_public(state):
    return {"abbr": state["abbr"], "name": state["name"], "region": state["region"], "capital": state["capital"]}


def get_state(abbr):
    abbr = abbr.upper()
    state = BY_ABBR.get(abbr)
    if state is None:
        return {"ok": False, "scope": "state", "articles": [], "error": "Unknown state.", "message": "Unknown state."}
    stored = cache().get("states", {}).get(abbr)
    if fresh(stored, SUCCESS_TTL) and stored.get("payload", {}).get("ok", True):
        return stored["payload"]

    def build():
        try:
            wires = load_wires()
        except Exception:  # noqa: BLE001
            wires = {"articles": [], "feedOk": 0}
        indexed = bing_search(state["query"])
        extras = optional_apis(state["name"])
        pool = [article for article in wires["articles"] if matches_state(article, state)]
        pool.extend(article for article in indexed["articles"] if matches_state(article, state))
        pool.extend(article for article in extras if matches_state(article, state))
        articles = dedupe(pool)[:36]
        notice = ""
        if not indexed["ok"] and wires["feedOk"]:
            notice = "The local search index did not respond. Showing matching wire stories only."
        feeds_alive = wires["feedOk"] > 0 or indexed["ok"] or bool(extras)
        if not feeds_alive:
            payload = envelope("state", [], ok=False, state=state_public(state), feed_ok=0)
        else:
            payload = envelope(
                "state",
                articles,
                state=state_public(state),
                message=EMPTY_STATE,
                notice=notice,
                feed_ok=1,
            )
        with _lock:
            cache().setdefault("states", {})[abbr] = {"at": time.time(), "payload": payload}
            save_cache()
        return payload

    return once(f"state:{abbr}", build)


def get_search(query):
    cleaned = re.sub(r"[^\w\s.,'\"&-]", " ", query or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()[:80]
    if len(cleaned) < 2:
        return {"ok": False, "scope": "search", "articles": [], "query": cleaned, "error": "Enter at least two characters.", "message": "Enter at least two characters."}
    key = cleaned.lower()
    stored = cache().get("searches", {}).get(key)
    if fresh(stored, SUCCESS_TTL):
        return stored["payload"]

    def build():
        try:
            wires = load_wires()
        except Exception:  # noqa: BLE001
            wires = {"articles": [], "feedOk": 0}
        words = [word.lower() for word in re.findall(r"[a-z0-9']+", cleaned.lower()) if len(word) > 2]

        def hits(article):
            text = f"{article['title']} {article.get('summary') or ''}".lower()
            if words:
                return all(word in text for word in words)
            return cleaned.lower() in text

        indexed = bing_search(cleaned)
        pool = [article for article in wires["articles"] if hits(article)]
        pool.extend(article for article in indexed["articles"] if hits(article) or not words)
        pool.extend(article for article in optional_apis(cleaned) if hits(article))
        articles = dedupe(pool)[:36]
        if wires["feedOk"] <= 0 and not indexed["ok"]:
            payload = envelope("search", [], ok=False, feed_ok=0)
        else:
            payload = envelope("search", articles, message=EMPTY_SEARCH, feed_ok=1)
        payload["query"] = cleaned
        with _lock:
            cache().setdefault("searches", {})[key] = {"at": time.time(), "payload": payload}
            save_cache()
        return payload

    return once(f"search:{key}", build)


def get_counts():
    try:
        wires = load_wires()
        wire_articles = wires["articles"]
        wire_ok = wires["feedOk"] > 0
    except Exception:  # noqa: BLE001
        wire_articles = []
        wire_ok = False
    counts = {}
    depth = {}
    pending = 0
    with _lock:
        state_cache = dict(cache().get("states", {}))
    for state in STATES:
        stored = state_cache.get(state["abbr"])
        if fresh(stored, SUCCESS_TTL) and stored.get("payload", {}).get("ok"):
            counts[state["abbr"]] = len(stored["payload"].get("articles") or [])
            depth[state["abbr"]] = "full"
        else:
            counts[state["abbr"]] = len([article for article in wire_articles if matches_state(article, state)])
            depth[state["abbr"]] = "wire" if wire_ok else "pending"
            pending += 1
    return {"ok": wire_ok or pending < len(STATES), "counts": counts, "depth": depth, "pending": pending, "error": "" if wire_ok else UNAVAILABLE}


def start_indexer():
    global _indexer_started
    with _lock:
        if _indexer_started:
            return
        _indexer_started = True

    def run():
        for state in STATES:
            try:
                get_state(state["abbr"])
            except Exception as error:  # noqa: BLE001
                print(f"index {state['abbr']} skipped: {error}")
            time.sleep(0.15)
        print("American Pulse state index complete")

    threading.Thread(target=run, daemon=True).start()


def main():
    argument = sys_arg()
    if argument == "--all":
        for state in STATES:
            payload = get_state(state["abbr"])
            articles = payload.get("articles") or []
            sample = articles[0]["title"][:88] if articles else payload.get("message") or payload.get("error")
            print(f"{state['abbr']:3} {len(articles):2}  {sample}")
        return
    if argument == "counts":
        print(json.dumps(get_counts(), indent=2))
        return
    payload = get_national() if argument in {"", "national"} else get_state(argument.upper())
    print(json.dumps(payload, indent=2)[:12000])


def sys_arg():
    import sys
    return sys.argv[1] if len(sys.argv) > 1 else "national"


if __name__ == "__main__":
    main()
