import type { RoadService } from '../types';
import { CHECKPOINTS, ROAD_REPORTS } from '@/data/mock/roads';
import { respond } from './delay';

export const mockRoadService: RoadService = {
  checkpoints: () => respond(CHECKPOINTS),
  roadReports: () => respond(ROAD_REPORTS),
};
