import type { BadgeTone } from '@/components/ui/StatusBadge';
import type { ColorScheme } from '@/theme/colors';
import type { CheckpointStatus, CustomerStatus, OrderStatus, RoadReportType } from '@/types';

/** Status → badge tone / pin colour, shared by lists, sheets and map markers. */

export const customerStatusTone: Record<CustomerStatus, BadgeTone> = {
  active: 'success',
  owes: 'danger',
  stale: 'warning',
};

export function customerPinColor(status: CustomerStatus, colors: ColorScheme): string {
  if (status === 'owes') return colors.danger;
  if (status === 'stale') return colors.warning;
  return colors.pinCustomer;
}

export const orderStatusTone: Record<OrderStatus, BadgeTone> = {
  pending: 'info',
  out_for_delivery: 'warning',
  delivered: 'success',
  cancelled: 'neutral',
};

export const checkpointStatusTone: Record<CheckpointStatus, BadgeTone> = {
  open: 'success',
  crowded: 'warning',
  closed: 'danger',
};

export function checkpointColor(status: CheckpointStatus, colors: ColorScheme): string {
  if (status === 'closed') return colors.danger;
  if (status === 'crowded') return colors.warning;
  return colors.success;
}

export function roadReportColor(type: RoadReportType, colors: ColorScheme): string {
  switch (type) {
    case 'accident':
      return colors.danger;
    case 'closed_road':
      return colors.dangerDeep;
    case 'traffic':
      return colors.warning;
    case 'construction':
      return colors.warningText;
  }
}
