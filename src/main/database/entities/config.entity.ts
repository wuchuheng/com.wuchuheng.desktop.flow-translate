import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Config {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column('simple-json')
  value: unknown;
}
