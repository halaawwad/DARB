import type { GeoPoint, IsoDate } from './common';

export type CheckpointStatus = 'open' | 'closed' | 'crowded';

export interface Checkpoint {
  id: string;
  name: string;
  location: GeoPoint;
  status: CheckpointStatus;
  updatedAt: IsoDate;
}

export type RoadReportType = 'accident' | 'closed_road' | 'traffic' | 'construction';

export interface RoadReport {
  id: string;
  type: RoadReportType;
  location: GeoPoint;
  note: string;
  createdAt: IsoDate;
}
