import type { UserService } from '../types';
import { COMPANY, TODAY_PLANS, USERS, userForRole } from '@/data/mock/users';
import { respond } from './delay';

export const mockUserService: UserService = {
  currentUser: (role) => respond(userForRole(role)),
  company: () => respond(COMPANY),
  list: () => respond(USERS),
  todayPlan: (userId) => respond(TODAY_PLANS.find((plan) => plan.userId === userId)),
};
