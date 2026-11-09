import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Plus, ShieldCheck, Users } from 'lucide-react-native';

import { AppHeader, AppText, Avatar, EmptyState, IconButton, ListItem, Screen, StatusBadge } from '@/components/ui';
import { useEmployees } from '@/features/admin/hooks';
import { roleLabel } from '@/features/admin/roleLabel';
import { useHasPermission } from '@/hooks/useHasPermission';
import { useLocale } from '@/hooks/useLocale';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export default function EmployeesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLocale();
  const serverMode = useAuthStore((s) => s.mode) === 'server';
  const canRead = useHasPermission('users:read');
  const canWrite = useHasPermission('users:write');
  const employees = useEmployees(serverMode && canRead);

  const openEmployee = (id?: string) =>
    router.push(id ? { pathname: '/admin/employee', params: { id } } : '/admin/employee');

  let body;
  if (!serverMode) {
    body = <EmptyState icon={<Users size={26} color={colors.brand} />} title={t('admin.demoUnavailable')} body={t('admin.demoUnavailableBody')} />;
  } else if (!canRead) {
    body = <EmptyState icon={<Lock size={26} color={colors.brand} />} title={t('admin.noAccess')} />;
  } else if (employees.isPending) {
    body = (
      <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginTop: spacing.xl }}>
        {t('common.loading')}
      </AppText>
    );
  } else if (employees.isError) {
    body = <EmptyState title={t('admin.loadFailed')} action={{ label: t('common.retry'), onPress: () => void employees.refetch() }} />;
  } else {
    body = (
      <View style={{ gap: spacing.sm }}>
        <ListItem
          tone="card"
          title={t('admin.roles')}
          subtitle={t('admin.rolesBody')}
          leading={
            <View
              style={{ width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }}
            >
              <ShieldCheck size={20} color={colors.brand} strokeWidth={2.2} />
            </View>
          }
          showChevron
          onPress={() => router.push('/admin/roles')}
          style={{ marginBottom: spacing.md }}
        />
        <AppText variant="caption" color="textTertiary">
          {t('admin.employeesCount', { count: employees.data.length })}
        </AppText>
        {employees.data.map((employee) => (
          <ListItem
            key={employee.id}
            tone="card"
            title={employee.fullName}
            subtitle={`${roleLabel(t, employee.role)} · ${employee.email}`}
            leading={<Avatar name={employee.fullName} size={40} />}
            trailing={employee.isActive ? undefined : <StatusBadge label={t('admin.inactive')} tone="neutral" size="sm" />}
            showChevron={canWrite}
            onPress={canWrite ? () => openEmployee(employee.id) : undefined}
            style={employee.isActive ? undefined : { opacity: 0.7 }}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen
      scrollProps={{
        refreshControl: <RefreshControl refreshing={employees.isRefetching} onRefresh={() => void employees.refetch()} />,
      }}
    >
      <AppHeader
        title={t('admin.employees')}
        trailing={
          serverMode && canWrite ? (
            <IconButton
              icon={<Plus size={20} color={colors.brand} strokeWidth={2.4} />}
              tone="ghost"
              size={40}
              style={{ backgroundColor: colors.brandSoft }}
              onPress={() => openEmployee()}
              accessibilityLabel={t('admin.addEmployee')}
            />
          ) : undefined
        }
      />
      {body}
    </Screen>
  );
}