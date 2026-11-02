import type {
  Checkpoint,
  Company,
  CreateOrderInput,
  Customer,
  CustomerInsight,
  LedgerEntry,
  Order,
  Product,
  Role,
  RoadReport,
  TodayPlan,
  User,
} from '@/types';

/**
 * Every screen talks to these interfaces, never to a mock array. Swapping the
 * mock implementation for HTTP is a change in `services/index.ts` only.
 */

export interface UserService {
  /** Demo stand-in for login: the user that plays the chosen role. */
  currentUser(role: Role): Promise<User>;
  company(): Promise<Company>;
  list(): Promise<User[]>;
  todayPlan(userId: string): Promise<TodayPlan | undefined>;
}

export interface CustomerService {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer | undefined>;
  ledger(customerId: string): Promise<LedgerEntry[]>;
  insight(customerId: string): Promise<CustomerInsight | undefined>;
}

export interface OrderService {
  list(filter?: { customerId?: string; repId?: string }): Promise<Order[]>;
  get(id: string): Promise<Order | undefined>;
  create(input: CreateOrderInput): Promise<Order>;
}

export interface ProductService {
  list(): Promise<Product[]>;
}

export interface RoadService {
  checkpoints(): Promise<Checkpoint[]>;
  roadReports(): Promise<RoadReport[]>;
}

export interface Services {
  users: UserService;
  customers: CustomerService;
  orders: OrderService;
  products: ProductService;
  roads: RoadService;
}
