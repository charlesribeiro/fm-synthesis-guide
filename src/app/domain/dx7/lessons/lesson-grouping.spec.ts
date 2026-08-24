import { ALGORITHMS } from '../models/algorithms';
import { TEACHING_TAGS, type AlgorithmDefinition, type TeachingTag } from '../models/algorithm-definition';
import { DEFAULT_PATCH } from '../models/patch';
import type { LessonDefinition, LessonId } from './lesson-definition';
import { LESSONS } from './lessons';
import {
  CURRICULUM_GROUP_DESCRIPTIONS,
  CURRICULUM_GROUP_LABELS,
  CURRICULUM_GROUP_ORDER,
  groupLessonsByTeachingTag,
} from './lesson-grouping';

/**
 * Small, pedagogically-named fixtures for the structural cases below — never
 * the live datasets, which are reserved for the cases that must hold at any
 * row count (T-11-05 mirrors `lessons.spec.ts`'s fixture-vs-live-dataset
 * split).
 */
function buildFixtureAlgorithm(
  id: number,
  teachingTags: readonly TeachingTag[],
): AlgorithmDefinition {
  return Object.freeze({
    id,
    name: `Fixture algorithm ${id}`,
    edges: Object.freeze([]),
    teachingTags: Object.freeze([...teachingTags]),
  });
}

function buildFixtureLesson(id: string, algorithmId: number): LessonDefinition {
  return Object.freeze({
    id: id as LessonId,
    algorithmId,
    title: `Fixture lesson ${id}`,
    objective: 'Fixture objective.',
    explanation: Object.freeze(['Fixture paragraph.']),
    startingPatch: Object.freeze({ ...DEFAULT_PATCH, algorithmId }),
    tryThis: Object.freeze({
      targetOperator: 1,
      targetParam: 'outputLevel',
      direction: 'increase',
      instruction: 'Fixture instruction.',
      expectedEffect: 'Fixture expected effect.',
    }),
  });
}

describe('groupLessonsByTeachingTag', () => {
  it('returns exactly four groups, in curriculum order, for the live dataset', () => {
    const groups = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);
    expect(groups.map((group) => group.tag)).toEqual([
      'parallel',
      'additive-stacks',
      'tree-branch',
      'rooting',
    ]);
  });

  it('returns the same four groups, all empty, for an empty lesson list', () => {
    const groups = groupLessonsByTeachingTag([], ALGORITHMS);
    expect(groups.map((group) => group.tag)).toEqual([
      'parallel',
      'additive-stacks',
      'tree-branch',
      'rooting',
    ]);
    for (const group of groups) {
      expect(group.lessons).toEqual([]);
    }
  });

  it('carries a non-empty label and description for every group', () => {
    const groups = groupLessonsByTeachingTag([], ALGORITHMS);
    for (const group of groups) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.description.length).toBeGreaterThan(0);
    }
  });

  it('concatenates to a permutation of the input lessons, preserving relative order within each group', () => {
    const algorithms = [
      buildFixtureAlgorithm(101, ['tree-branch']),
      buildFixtureAlgorithm(102, ['parallel']),
      buildFixtureAlgorithm(103, ['additive-stacks']),
      buildFixtureAlgorithm(104, ['rooting']),
      buildFixtureAlgorithm(105, ['tree-branch']),
    ];
    const lessons = [
      buildFixtureLesson('fixture-a', 101),
      buildFixtureLesson('fixture-b', 102),
      buildFixtureLesson('fixture-c', 103),
      buildFixtureLesson('fixture-d', 104),
      buildFixtureLesson('fixture-e', 105),
    ];

    const groups = groupLessonsByTeachingTag(lessons, algorithms);
    const concatenated = groups.flatMap((group) => group.lessons);

    expect(concatenated).toHaveLength(lessons.length);
    expect(concatenated.map((lesson) => lesson.id).sort()).toEqual(
      lessons.map((lesson) => lesson.id).sort(),
    );

    const treeBranchGroup = groups.find((group) => group.tag === 'tree-branch')!;
    expect(treeBranchGroup.lessons.map((lesson) => lesson.id)).toEqual(['fixture-a', 'fixture-e']);
  });

  it("reports every live lesson under the group its own algorithm row's teaching tag names", () => {
    const groups = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);
    for (const group of groups) {
      for (const lesson of group.lessons) {
        const algorithm = ALGORITHMS.find((candidate) => candidate.id === lesson.algorithmId)!;
        expect(algorithm.teachingTags[0]).toBe(group.tag);
      }
    }
  });

  it('raises a RangeError naming the id of a lesson whose algorithmId is absent from the passed algorithms', () => {
    const algorithms = [buildFixtureAlgorithm(201, ['parallel'])];
    const lessons = [buildFixtureLesson('fixture-orphan', 999)];

    expect(() => groupLessonsByTeachingTag(lessons, algorithms)).toThrow(/999/);
  });

  it('raises a RangeError naming the id of an algorithm carrying an empty teachingTags array', () => {
    const algorithms = [buildFixtureAlgorithm(202, [])];
    const lessons = [buildFixtureLesson('fixture-untagged', 202)];

    expect(() => groupLessonsByTeachingTag(lessons, algorithms)).toThrow(/202/);
  });

  it('freezes the returned array, every group object, and every group lessons array', () => {
    const groups = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);
    expect(Object.isFrozen(groups)).toBe(true);
    for (const group of groups) {
      expect(Object.isFrozen(group)).toBe(true);
      expect(Object.isFrozen(group.lessons)).toBe(true);
    }
  });

  it('reads only the passed arguments: repeated calls return deeply equal results and mutate neither input', () => {
    const lessonsSnapshot = [...LESSONS];
    const algorithmsSnapshot = [...ALGORITHMS];

    const first = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);
    const second = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);

    expect(first).toEqual(second);
    expect([...LESSONS]).toEqual(lessonsSnapshot);
    expect([...ALGORITHMS]).toEqual(algorithmsSnapshot);
  });
});

/**
 * Pins D-01's "reuse the dataset's existing four groups verbatim, no new
 * taxonomy invented" as checked facts (T-11-06), mirroring
 * `lesson-definition.spec.ts`'s `TRY_THIS_PARAM_LABELS` suite and
 * `algorithms.spec.ts`'s hand-populated cross-check table convention.
 */
describe('curriculum taxonomy fidelity', () => {
  it('CURRICULUM_GROUP_ORDER is a permutation of TEACHING_TAGS', () => {
    expect([...CURRICULUM_GROUP_ORDER].sort()).toEqual([...TEACHING_TAGS].sort());
  });

  it('places parallel before additive-stacks, and additive-stacks before both tree-branch and rooting (D-02)', () => {
    const parallelIndex = CURRICULUM_GROUP_ORDER.indexOf('parallel');
    const additiveStacksIndex = CURRICULUM_GROUP_ORDER.indexOf('additive-stacks');
    const treeBranchIndex = CURRICULUM_GROUP_ORDER.indexOf('tree-branch');
    const rootingIndex = CURRICULUM_GROUP_ORDER.indexOf('rooting');

    expect(parallelIndex).toBeLessThan(additiveStacksIndex);
    expect(additiveStacksIndex).toBeLessThan(treeBranchIndex);
    expect(additiveStacksIndex).toBeLessThan(rootingIndex);
  });

  it('freezes CURRICULUM_GROUP_ORDER, CURRICULUM_GROUP_LABELS, and CURRICULUM_GROUP_DESCRIPTIONS', () => {
    expect(Object.isFrozen(CURRICULUM_GROUP_ORDER)).toBe(true);
    expect(Object.isFrozen(CURRICULUM_GROUP_LABELS)).toBe(true);
    expect(Object.isFrozen(CURRICULUM_GROUP_DESCRIPTIONS)).toBe(true);
  });

  it('both label and description records are total over TEACHING_TAGS with no extra keys, every entry non-empty', () => {
    const expectedKeys = [...TEACHING_TAGS].sort();
    expect(Object.keys(CURRICULUM_GROUP_LABELS).sort()).toEqual(expectedKeys);
    expect(Object.keys(CURRICULUM_GROUP_DESCRIPTIONS).sort()).toEqual(expectedKeys);
    for (const tag of TEACHING_TAGS) {
      expect(CURRICULUM_GROUP_LABELS[tag].length).toBeGreaterThan(0);
      expect(CURRICULUM_GROUP_DESCRIPTIONS[tag].length).toBeGreaterThan(0);
    }
  });

  it('every ALGORITHMS row carries exactly one teaching tag drawn from TEACHING_TAGS', () => {
    for (const algorithm of ALGORITHMS) {
      expect(algorithm.teachingTags).toHaveLength(1);
      expect(TEACHING_TAGS).toContain(algorithm.teachingTags[0]);
    }
  });

  it('matches an independently hand-populated id range per tag against the ids the dataset actually assigns', () => {
    /**
     * Independent second witness (mirrors `lessons.spec.ts`'s
     * `EXPECTED_ALGORITHM_1_CARRIERS` / `algorithms.spec.ts`'s cross-check
     * tables): populated by hand from the taxonomy the dataset documents,
     * never computed by grouping `ALGORITHMS` itself, so a tag
     * transcription slip fails a named test instead of silently reshuffling
     * the curriculum.
     */
    const EXPECTED_TAG_RANGES: Readonly<Record<TeachingTag, readonly number[]>> = Object.freeze({
      'additive-stacks': integerRange(1, 6),
      'tree-branch': integerRange(7, 18),
      rooting: integerRange(19, 25),
      parallel: integerRange(26, 32),
    });

    for (const tag of TEACHING_TAGS) {
      const actualIds = ALGORITHMS.filter((algorithm) => algorithm.teachingTags[0] === tag)
        .map((algorithm) => algorithm.id)
        .sort((a, b) => a - b);
      expect(actualIds).toEqual(EXPECTED_TAG_RANGES[tag]);
    }
  });
});

function integerRange(start: number, end: number): readonly number[] {
  return Object.freeze(Array.from({ length: end - start + 1 }, (_, index) => start + index));
}
