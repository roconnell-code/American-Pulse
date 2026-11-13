"""Build an Albers USA SVG path set from the U.S. Atlas TopoJSON."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "vendor" / "states-albers-10m.json"
OUTPUT = ROOT / "data" / "geography.json"

FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY",
}


def decode_arcs(topo):
    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(points)
    return arcs


def take_arc(arcs, index):
    if index >= 0:
        return arcs[index]
    return list(reversed(arcs[~index]))


def stitch(arcs, indexes):
    points = []
    for position, index in enumerate(indexes):
        part = take_arc(arcs, index)
        if position:
            part = part[1:]
        points.extend(part)
    return points


def geometry_polygons(arcs, geometry):
    kind = geometry["type"]
    if kind == "GeometryCollection":
        polygons = []
        for child in geometry.get("geometries", []):
            polygons.extend(geometry_polygons(arcs, child))
        return polygons
    if kind == "Polygon":
        rings = [stitch(arcs, ring) for ring in geometry["arcs"]]
        return [rings] if rings else []
    if kind == "MultiPolygon":
        polygons = []
        for polygon in geometry["arcs"]:
            rings = [stitch(arcs, ring) for ring in polygon]
            if rings:
                polygons.append(rings)
        return polygons
    return []


def ring_area(ring):
    area = 0
    for index in range(len(ring) - 1):
        x1, y1 = ring[index]
        x2, y2 = ring[index + 1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def bounds_of(points):
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def path_for(polygons):
    commands = []
    for rings in polygons:
        for ring in rings:
            if len(ring) < 3:
                continue
            commands.append(f"M{ring[0][0]:.1f} {ring[0][1]:.1f}")
            for x, y in ring[1:]:
                commands.append(f"L{x:.1f} {y:.1f}")
            commands.append("Z")
    return "".join(commands)


def flip_y(polygons, height):
    flipped = []
    for rings in polygons:
        flipped.append([[(x, height - y) for x, y in ring] for ring in rings])
    return flipped


def feature_record(arcs, geometry):
    polygons = geometry_polygons(arcs, geometry)
    if not polygons:
        return None
    exteriors = [rings[0] for rings in polygons if rings and len(rings[0]) >= 3]
    if not exteriors:
        return None
    largest = max(exteriors, key=ring_area)
    label_x1, label_y1, label_x2, label_y2 = bounds_of(largest)
    all_points = [point for rings in polygons for ring in rings for point in ring]
    min_x, min_y, max_x, max_y = bounds_of(all_points)
    return {
        "polygons": polygons,
        "cx": (label_x1 + label_x2) / 2,
        "cy": (label_y1 + label_y2) / 2,
        "bbox": [min_x, min_y, max_x - min_x, max_y - min_y],
    }


def union_bbox(records, pad):
    min_x = min(record["bbox"][0] for record in records) - pad
    min_y = min(record["bbox"][1] for record in records) - pad
    max_x = max(record["bbox"][0] + record["bbox"][2] for record in records) + pad
    max_y = max(record["bbox"][1] + record["bbox"][3] for record in records) + pad
    return [round(min_x, 1), round(min_y, 1), round(max_x - min_x, 1), round(max_y - min_y, 1)]


def main():
    topo = json.loads(SOURCE.read_text())
    arcs = decode_arcs(topo)
    raw = []
    for geometry in topo["objects"]["states"]["geometries"]:
        record = feature_record(arcs, geometry)
        if not record:
            continue
        fips = str(geometry["id"]).zfill(2)
        record["fips"] = fips
        record["abbr"] = FIPS[fips]
        record["name"] = geometry["properties"]["name"]
        raw.append(record)

    florida = next(item for item in raw if item["abbr"] == "FL")
    minnesota = next(item for item in raw if item["abbr"] == "MN")
    if florida["cy"] < minnesota["cy"]:
        max_y = max(item["bbox"][1] + item["bbox"][3] for item in raw)
        min_y = min(item["bbox"][1] for item in raw)
        span = max_y + min_y
        for item in raw:
            item["polygons"] = flip_y(item["polygons"], span)
            item["cy"] = span - item["cy"]
            x, y, width, height = item["bbox"]
            item["bbox"] = [x, span - (y + height), width, height]

    states = []
    for item in raw:
        x, y, width, height = item["bbox"]
        states.append({
            "fips": item["fips"],
            "abbr": item["abbr"],
            "name": item["name"],
            "d": path_for(item["polygons"]),
            "cx": round(item["cx"], 1),
            "cy": round(item["cy"], 1),
            "bbox": [round(x, 1), round(y, 1), round(width, 1), round(height, 1)],
        })

    by_abbr = {item["abbr"]: item for item in states}
    full = union_bbox(states, 16)
    northeast = union_bbox([by_abbr[abbr] for abbr in ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "MD", "DE", "DC"]], 28)
    south = union_bbox([by_abbr[abbr] for abbr in ["TX", "OK", "AR", "LA", "MS", "AL", "TN", "KY", "FL", "GA", "SC", "NC", "VA", "WV"]], 24)
    west = union_bbox([by_abbr[abbr] for abbr in ["WA", "OR", "CA", "NV", "ID", "MT", "WY", "UT", "CO", "NM", "AZ"]], 24)

    assert by_abbr["NY"]["cx"] > by_abbr["CA"]["cx"]
    assert by_abbr["ME"]["cx"] > by_abbr["NY"]["cx"]
    assert by_abbr["FL"]["cy"] > by_abbr["MN"]["cy"]
    assert by_abbr["TX"]["cx"] > by_abbr["CA"]["cx"]
    assert by_abbr["AK"]["cy"] > by_abbr["CO"]["cy"]
    assert by_abbr["HI"]["cy"] > by_abbr["CO"]["cy"]
    assert by_abbr["AK"]["bbox"][1] > by_abbr["TX"]["bbox"][1]
    assert len(states) == 51
    assert all(item["d"].startswith("M") and len(item["d"]) > 40 for item in states)

    payload = {
        "viewBox": full,
        "focus": {
            "full": full,
            "northeast": northeast,
            "south": south,
            "west": west,
        },
        "insets": {
            "AK": by_abbr["AK"]["bbox"],
            "HI": by_abbr["HI"]["bbox"],
        },
        "states": states,
    }
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
    print("FL", by_abbr["FL"]["bbox"], "AK", by_abbr["AK"]["bbox"], "HI", by_abbr["HI"]["bbox"], "RI", by_abbr["RI"]["bbox"])


if __name__ == "__main__":
    main()
