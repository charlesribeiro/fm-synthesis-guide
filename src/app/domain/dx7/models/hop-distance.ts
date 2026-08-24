import { OPERATOR_IDS, type OperatorId } from './operator';
import type { AlgorithmDefinition } from './algorithm-definition';
import { getOperatorRole } from './derive-role';

/**
 * Structural graph fact about an algorithm (not a lesson concern), so this
 * sits beside `derive-role.ts` rather than under `lessons/`. Pure, no
 * Angular import (DOMAIN-04).
 *
 * A carrier is hop `0` from output by definition (D-06). A modulator's hop
 * distance is one more than the hop distance of every operator its outgoing
 * edges (excluding its own feedback self-loop, `edge.to !== operatorId` —
 * the same guard `getOperatorRole` uses and for the same reason: a feedback
 * self-loop must never be read as "modulates another operator") reach.
 *
 * Every outgoing target's hop distance is computed and required to agree
 * (`11-RESEARCH.md` Pitfall 5) — a fan-out operator whose targets sit at
 * differing depths raises a `RangeError` naming the operator and the
 * disagreeing depths, rather than silently reading the first edge. Today's
 * only two fan-out cases (Algorithm 19's operator 5, Algorithm 22's operator
 * 6) happen to send to targets that are all carriers (all hop `0`), so "read
 * the first edge" and "require agreement" give the same answer today only by
 * coincidence, not by a general guarantee — this function implements the
 * latter, general rule.
 *
 * A `visited` operator set is carried through the recursion (threat
 * T-11-03): re-entering an operator already on the current recursion path
 * raises a `RangeError` naming that operator, so a cyclic edge list fails
 * loudly instead of exhausting the stack. The shipped dataset's edges always
 * run from a higher operator id to a lower one, which is why this guard
 * never fires against real data — it exists only for a malformed or
 * synthetic edge list.
 */
export function hopDistanceFromOutput(algorithm: AlgorithmDefinition, operatorId: OperatorId): number {
  return hopDistanceFromOutputVisited(algorithm, operatorId, new Set<OperatorId>());
}

function hopDistanceFromOutputVisited(
  algorithm: AlgorithmDefinition,
  operatorId: OperatorId,
  visited: ReadonlySet<OperatorId>,
): number {
  if (getOperatorRole(algorithm, operatorId) === 'carrier') {
    return 0;
  }

  if (visited.has(operatorId)) {
    throw new RangeError(
      `hopDistanceFromOutput: operator ${operatorId} sits on a modulation cycle — cannot compute a finite hop distance`,
    );
  }
  const nextVisited = new Set(visited);
  nextVisited.add(operatorId);

  const targets = algorithm.edges
    .filter((edge) => edge.from === operatorId && edge.to !== operatorId)
    .map((edge) => edge.to);

  const depths = targets.map((target) => hopDistanceFromOutputVisited(algorithm, target, nextVisited));
  const [firstDepth, ...restDepths] = depths;
  if (firstDepth === undefined) {
    // Unreachable against the canonical dataset: `getOperatorRole` classifies
    // an operator as a modulator only when it has at least one outgoing edge
    // to another operator, so `targets` is never empty here. Kept so this
    // function is total rather than assuming the caller never violates that
    // invariant.
    throw new RangeError(`hopDistanceFromOutput: operator ${operatorId} is a modulator with no outgoing edges`);
  }
  if (restDepths.some((depth) => depth !== firstDepth)) {
    throw new RangeError(
      `hopDistanceFromOutput: operator ${operatorId} has outgoing edges reaching targets at differing depths (${depths.join(', ')})`,
    );
  }
  return firstDepth + 1;
}

/**
 * The largest hop distance among the algorithm's modulators, or `0` when it
 * has none (e.g. Algorithm 32). Feeds D-07's additive-like predicate and
 * D-11's try-this selection rule.
 */
export function maxModulatorHopDistance(algorithm: AlgorithmDefinition): number {
  const modulatorHops = OPERATOR_IDS.filter((id) => getOperatorRole(algorithm, id) === 'modulator').map((id) =>
    hopDistanceFromOutput(algorithm, id),
  );
  if (modulatorHops.length === 0) {
    return 0;
  }
  return Math.max(...modulatorHops);
}

/**
 * The modulators sitting at `maxModulatorHopDistance`, in ascending operator
 * id order — filters the fixed `OPERATOR_IDS` array rather than the `edges`
 * array, mirroring `deriveCarriers`'s declaration-order-independence
 * convention, so the result can never depend on the order edges happen to be
 * declared in.
 */
export function deepestModulators(algorithm: AlgorithmDefinition): readonly OperatorId[] {
  const modulators = OPERATOR_IDS.filter((id) => getOperatorRole(algorithm, id) === 'modulator');
  if (modulators.length === 0) {
    return [];
  }
  const maxDepth = maxModulatorHopDistance(algorithm);
  return modulators.filter((id) => hopDistanceFromOutput(algorithm, id) === maxDepth);
}
