export const PERSONAL_PROJECT_ID = "personProject";
export const PERSONAL_PROJECT_IDENTIFIER = "person-project";

/**
 * Identifies the shared database project used to anchor personal work items.
 */
export function isPersonalProjectId(projectId: string | null | undefined): boolean {
  return !projectId || projectId === PERSONAL_PROJECT_ID;
}
