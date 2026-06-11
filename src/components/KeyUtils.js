// Relative key pairs (all sharps)
const RELATIVE = {
  'C Major': 'A Minor', 'C# Major': 'A# Minor', 'D Major': 'B Minor',
  'D# Major': 'C Minor', 'E Major': 'C# Minor', 'F Major': 'D Minor',
  'F# Major': 'D# Minor', 'G Major': 'E Minor', 'G# Major': 'F Minor',
  'A Major': 'F# Minor', 'A# Major': 'G Minor', 'B Major': 'G# Minor',
  'A Minor': 'C Major', 'A# Minor': 'C# Major', 'B Minor': 'D Major',
  'C Minor': 'D# Major', 'C# Minor': 'E Major', 'D Minor': 'F Major',
  'D# Minor': 'F# Major', 'E Minor': 'G Major', 'F Minor': 'G# Major',
  'F# Minor': 'A Major', 'G Minor': 'A# Major', 'G# Minor': 'B Major',
};

// Circle of fifths neighbors
const RELATED = {
  'C Major':  ['G Major', 'F Major', 'A Minor', 'E Minor', 'D Minor'],
  'G Major':  ['D Major', 'C Major', 'E Minor', 'B Minor', 'A Minor'],
  'D Major':  ['A Major', 'G Major', 'B Minor', 'F# Minor', 'E Minor'],
  'A Major':  ['E Major', 'D Major', 'F# Minor', 'C# Minor', 'B Minor'],
  'E Major':  ['B Major', 'A Major', 'C# Minor', 'G# Minor', 'F# Minor'],
  'B Major':  ['F# Major', 'E Major', 'G# Minor', 'D# Minor', 'C# Minor'],
  'F# Major': ['C# Major', 'B Major', 'D# Minor', 'A# Minor', 'G# Minor'],
  'C# Major': ['G# Major', 'F# Major', 'A# Minor', 'F Minor', 'D# Minor'],
  'G# Major': ['D# Major', 'C# Major', 'F Minor', 'C Minor', 'A# Minor'],
  'D# Major': ['A# Major', 'G# Major', 'C Minor', 'G Minor', 'F Minor'],
  'A# Major': ['F Major', 'D# Major', 'G Minor', 'D Minor', 'C Minor'],
  'F Major':  ['C Major', 'A# Major', 'D Minor', 'A Minor', 'G Minor'],
  'A Minor':  ['E Minor', 'D Minor', 'C Major', 'G Major', 'F Major'],
  'E Minor':  ['B Minor', 'A Minor', 'G Major', 'D Major', 'C Major'],
  'B Minor':  ['F# Minor', 'E Minor', 'D Major', 'A Major', 'G Major'],
  'F# Minor': ['C# Minor', 'B Minor', 'A Major', 'E Major', 'D Major'],
  'C# Minor': ['G# Minor', 'F# Minor', 'E Major', 'B Major', 'A Major'],
  'G# Minor': ['D# Minor', 'C# Minor', 'B Major', 'F# Major', 'E Major'],
  'D# Minor': ['A# Minor', 'G# Minor', 'F# Major', 'C# Major', 'B Major'],
  'A# Minor': ['F Minor', 'D# Minor', 'C# Major', 'G# Major', 'F# Major'],
  'F Minor':  ['C Minor', 'A# Minor', 'G# Major', 'D# Major', 'C# Major'],
  'C Minor':  ['G Minor', 'F Minor', 'D# Major', 'A# Major', 'G# Major'],
  'G Minor':  ['D Minor', 'C Minor', 'A# Major', 'F Major', 'D# Major'],
  'D Minor':  ['A Minor', 'G Minor', 'F Major', 'C Major', 'A# Major'],
};

export function keyMatches(clipKey, filterKey, mode) {
  if (!filterKey) return true;
  if (!clipKey) return false;
  if (mode === 'exact') return clipKey === filterKey;
  if (mode === 'relative') {
    return clipKey === filterKey || clipKey === RELATIVE[filterKey];
  }
  if (mode === 'related') {
    return clipKey === filterKey ||
      clipKey === RELATIVE[filterKey] ||
      (RELATED[filterKey] || []).includes(clipKey);
  }
  return true;
}
