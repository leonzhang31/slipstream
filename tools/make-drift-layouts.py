"""Shorten mapped GP straights in balanced groups, preserving corners and loop closure."""
import itertools
import json
import math
from pathlib import Path

root = Path(__file__).resolve().parents[1]
bundle = root / 'dist/data/circuits.js'
header = '// Circuit centerlines: Tomislav Bacinger, MIT. See licenses/f1-circuits-LICENSE.txt.\n'
tracks = json.loads(bundle.read_text().split('window.SLIPSTREAM_CIRCUITS=')[1].rstrip(';\n'))


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


for track in tracks:
    nodes = track['nodes']
    vectors = [(nodes[(i + 1) % len(nodes)][0] - p[0], nodes[(i + 1) % len(nodes)][1] - p[1]) for i, p in enumerate(nodes)]
    lengths = [math.hypot(*v) for v in vectors]
    directions = [(v[0] / length, v[1] / length) for v, length in zip(vectors, lengths)]

    def turn(i, j):
        a, b = directions[i], directions[j]
        return abs(math.atan2(cross(a, b), a[0] * b[0] + a[1] * b[1]))

    # Sparse long edges are straights; shorter edges qualify only with gentle entries/exits.
    straight_ids = [i for i, length in enumerate(lengths) if length > 650 or
                    (length > 300 and turn(i, (i - 1) % len(nodes)) < .3 and turn(i, (i + 1) % len(nodes)) < .3)]
    capacity = {i: (lengths[i] - 180) * .7 for i in straight_ids}
    removed = [0.] * len(nodes)
    while True:
        active = [i for i in straight_ids if capacity[i] > 1e-5]
        best = None
        # Three direction vectors enclosing the origin can be shortened together
        # without changing any segment bearing or leaving a gap at the finish line.
        for group in itertools.combinations(active, 3):
            i, j, k = group
            weights = [cross(directions[j], directions[k]), cross(directions[k], directions[i]), cross(directions[i], directions[j])]
            if max(weights) < -1e-8:
                weights = [-w for w in weights]
            if min(weights) <= 1e-8:
                continue
            amount = min(capacity[n] / weight for n, weight in zip(group, weights))
            score = amount * sum(weights)
            if best is None or score > best[0]:
                best = score, group, [amount * weight for weight in weights]
        for i, j in itertools.combinations(active, 2):
            a, b = directions[i], directions[j]
            if abs(cross(a, b)) < 1e-6 and a[0] * b[0] + a[1] * b[1] < -.99999:
                amount = min(capacity[i], capacity[j])
                if best is None or amount * 2 > best[0]:
                    best = amount * 2, (i, j), [amount, amount]
        if best is None:
            break
        for i, amount in zip(best[1], best[2]):
            removed[i] += amount
            capacity[i] = max(0, capacity[i] - amount)

    def make_nodes(strength):
        result = [nodes[0][:]]
        for i in range(len(nodes) - 1):
            result.append([result[-1][axis] + vectors[i][axis] - directions[i][axis] * removed[i] * strength for axis in (0, 1)])
        return result

    def clear_road(points):
        # Check the widened playable road, not just the centerline polygon.
        road = track['width'] * 1.5 / .7
        separation = road + 25
        samples, total = [], 0.
        for i, a in enumerate(points):
            b = points[(i + 1) % len(points)]
            length = math.dist(a, b)
            count = max(1, math.ceil(length / 20))
            for j in range(count):
                samples.append((a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count, total + length * j / count))
            total += length
        cells = {}
        for x, y, distance in samples:
            gx, gy = math.floor(x / separation), math.floor(y / separation)
            for ix in range(gx - 1, gx + 2):
                for iy in range(gy - 1, gy + 2):
                    for px, py, pd in cells.get((ix, iy), []):
                        along = abs(distance - pd)
                        if min(along, total - along) > road * 2 and math.hypot(x - px, y - py) < separation:
                            return False
            cells.setdefault((gx, gy), []).append((x, y, distance))
        return True

    # Closely packed infields need a lighter edit than open layouts.
    for strength in (1., .85, .7, .55, .4, .25, .1):
        adapted = make_nodes(strength)
        if clear_road(adapted):
            removed = [amount * strength for amount in removed]
            break
    else:
        raise ValueError(track['id'] + ': no safe shortened layout found')
    if track['id'] == 'interlagos':
        # Its closely packed infield cannot move inward safely. Compress the
        # long southern sector smoothly while keeping the infield untouched.
        def shorten_south(y):
            distance = max(0., y - 3800)
            return y - .55 * (distance - 300 * (1 - math.exp(-distance / 300)))
        adapted = [[x, shorten_south(y)] for x, y in nodes]
        if not clear_road(adapted):
            raise ValueError('Interlagos southern compression overlaps the infield')
        removed = [lengths[i] - math.dist(adapted[i], adapted[(i + 1) % len(nodes)]) for i in range(len(nodes))]
        track['driftAdaptation'] = 'southern-sector'
    else:
        track['driftAdaptation'] = 'balanced-straights'
    track['driftNodes'] = [[round(x, 3), round(y, 3)] for x, y in adapted]
    track['driftStats'] = {
        'originalLength': sum(lengths), 'adaptedLength': sum(lengths) - sum(removed),
        'straightSegments': straight_ids,
        'straightBefore': sum(lengths[i] for i in straight_ids),
        'straightAfter': sum(lengths[i] - removed[i] for i in straight_ids),
        'longestBefore': max(lengths), 'longestAfter': max(length - cut for length, cut in zip(lengths, removed)),
    }
    print(track['name'], 'drift lap:', round(track['driftStats']['adaptedLength'] * .7 / 6), 'm')

bundle.write_text(header + 'window.SLIPSTREAM_CIRCUITS=' + json.dumps(tracks, separators=(',', ':')) + ';\n')
