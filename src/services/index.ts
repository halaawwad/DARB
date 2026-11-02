import type { Services } from './types';
import { mockUserService } from './mock/userService';
import { mockCustomerService } from './mock/customerService';
import { mockOrderService, mockProductService } from './mock/orderService';
import { mockRoadService } from './mock/roadService';

/** The one place that decides mock vs HTTP. Screens import `services`, never a mock. */
export const services: Services = {
  users: mockUserService,
  customers: mockCustomerService,
  orders: mockOrderService,
  products: mockProductService,
  roads: mockRoadService,
};

export * from './types';
