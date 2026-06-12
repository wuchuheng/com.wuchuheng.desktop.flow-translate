import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Generic key-value config store.
 * Values are serialized as JSON via the 'simple-json' column type.
 */
@Entity()
export class Config {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column('simple-json')
  value: Record<string, unknown>;
}
