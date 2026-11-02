/** One stop on a rep's day, in route order. */
export interface PlanStop {
  /** 1-based position on today's route. */
  sequence: number;
  customerId: string;
  /** Set for delivery stops: the order being delivered. */
  orderId?: string;
}

/** Sales reps get customer visits; delivery reps get delivery stops. */
export interface TodayPlan {
  userId: string;
  kind: 'visits' | 'deliveries';
  stops: PlanStop[];
}
