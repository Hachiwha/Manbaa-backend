import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * A Canvas is the collaborative visual-editing surface for a workflow diagram.
 *
 * ## Relationship to Workflow (implementation assumption)
 *
 * The current 1:1 mapping (one Workflow → one Canvas) is an implementation
 * assumption, not a requirement defined in the project specification. The
 * `uq_canvas_workflow_id` unique constraint in the migration enforces this
 * cardinality at the database level.
 *
 * The schema is intentionally designed so this can evolve to 1:N later with a
 * **non-breaking migration**: dropping the unique constraint on `workflow_id`
 * is the only schema change needed. All child tables (`canvas_object`,
 * `canvas_operation`, `canvas_snapshot`, `canvas_version`) reference
 * `canvas.id` and are agnostic to how many canvases share the same workflow.
 * No data would be lost and no FK relationships would need restructuring.
 */
@Entity("canvas")
export class Canvas {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  @Index("idx_canvas_workflow")
  workflowId: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
