import { calculateDashboardStats } from "../analytics";
import type {
  Person,
  Priority,
  SchedulingSuggestion,
  WorkPackage,
  WorkspaceSnapshot
} from "../types";

const priorityWeight: Record<Priority, number> = {
  P0: 6,
  P1: 4,
  P2: 2
};

interface PersonScore {
  person: Person;
  loadRatio: number;
  remainingHours: number;
}

/**
 * Builds prioritized scheduling suggestions for work packages that are not done.
 * The suggestion considers required skills, current workload, and priority.
 */
export function buildSchedulingSuggestions(snapshot: WorkspaceSnapshot): SchedulingSuggestion[] {
  const stats = calculateDashboardStats(snapshot);
  const personScores = new Map<string, PersonScore>(
    stats.workloadByPerson.map((item) => [
      item.person.id,
      {
        person: item.person,
        loadRatio: item.loadRatio,
        remainingHours: Math.max(0, item.person.capacity - item.assignedHours)
      }
    ])
  );

  return snapshot.workPackages
    .filter((wp) => wp.type !== "risk")
    .filter((wp) => wp.status !== "done")
    .map<SchedulingSuggestion | null>((wp) => {
      const ranked = rankPeopleForWorkPackage(wp, personScores);
      const best = ranked[0];
      if (!best) {
        return null;
      }

      return {
        workPackageId: wp.id,
        workPackageSubject: wp.subject,
        currentAssigneeId: wp.assigneeId,
        suggestedPersonId: best.person.id,
        reason: buildReason(wp, best, ranked.slice(1, 3)),
        urgency: priorityWeight[wp.priority] + (wp.status === "blocked" ? 4 : 0),
        score: best.score
      };
    })
    .filter((item): item is SchedulingSuggestion => Boolean(item))
    .sort((left, right) => right.urgency - left.urgency)
    .slice(0, 5);
}

interface RankedPerson {
  person: Person;
  score: number;
  loadRatio: number;
  matchedSkills: string[];
}

function rankPeopleForWorkPackage(
  wp: WorkPackage,
  personScores: Map<string, PersonScore>
): RankedPerson[] {
  const required = (wp.requiredSkills ?? []).map((skill) => skill.toLowerCase());

  return Array.from(personScores.values())
    .map<RankedPerson>(({ person, loadRatio, remainingHours }) => {
      const matchedSkills = (person.skills ?? []).filter((skill) =>
        required.some((requirement) => skill.toLowerCase().includes(requirement))
      );
      const skillScore = matchedSkills.length * 18;
      const loadPenalty = loadRatio * 0.4;
      const capacityBonus = Math.min(remainingHours, 24) * 0.6;
      const priorityBonus = priorityWeight[wp.priority] * 1.5;

      return {
        person,
        loadRatio,
        matchedSkills,
        score: Math.round(40 + skillScore + capacityBonus + priorityBonus - loadPenalty)
      };
    })
    .sort((left, right) => right.score - left.score);
}

function buildReason(wp: WorkPackage, best: RankedPerson, others: RankedPerson[]): string {
  const skillReason = best.matchedSkills.length
    ? `命中技能：${best.matchedSkills.join("、")}`
    : "无强匹配技能，依赖经验互补";
  const loadReason = `当前负载 ${best.loadRatio}%`;
  const blockedReason = wp.status === "blocked" ? "且工作项处于阻塞状态" : "";
  const altReason = others.length
    ? `；备选：${others.map((item) => `${item.person.name}(${item.score})`).join(" / ")}`
    : "";

  return `优先级 ${wp.priority}，${skillReason}，${loadReason}${blockedReason}${altReason}`;
}
