import type { ListApplicationsResponse } from "@app/contracts";
import type { ApplicationsRepository } from "./applications.repository.ts";

export class ApplicationsService {
  private readonly repository: ApplicationsRepository;

  constructor(repository: ApplicationsRepository) {
    this.repository = repository;
  }

  /** Returns the analyst queue ordered oldest first. */
  list(): Promise<ListApplicationsResponse> {
    return this.repository.list();
  }
}
