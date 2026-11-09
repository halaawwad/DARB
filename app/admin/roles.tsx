import { useMemo, useState } from 'react';
import { RefreshControl, Switch, View } from 'react-native';
import { Lock, Users } from 'lucide-react-native';

import { AppButton, AppHeader, AppText, Card, EmptyState, ListItem, Screen, StatusBadge } from '@/components/ui';
import { useRoleList, useUpdateRolePermissions } from '@/features/admin/hooks';
import { permissionGroupLabel, permissionLabel, roleLabel } from '@/features/admin/roleLabel';
import { useHasPermission } from '@/hooks/useHasPermission';
import { useLocale } from '@/hooks/useLocale';
import { ApiError } from '@/services/http/apiClient';
import type { RoleInfo } from '@/services/http/adminService';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/spacing';
import { showMessage } from '@/utils/dialog';
import { haptics } from '@/utils/haptics';

export default function RolesScreen() {
  const { colors } = useTheme();
  const { t, row } = useLocale();
  const serverMode = useAuthStore((s) => s.mode) === 'server';
  const me = useAuthStore((s) => s.user);
  const canRead = useHasPermission('users:read');
  const canEdit = useHasPermission('roles:write');
  const roleList = useRoleList(serverMode && canRead);
  const update = useUpdateRolePermissions();

  const [openId, setOpenId] = useState<string>();
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const myPermissions = me?.permissions ?? [];

  // "customers:read" and "customers:write" share the group "customers".
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of roleList.data?.permissions ?? []) {
      const group = key.split(':')[0];
      map.set(group, [...(map.get(group) ?? []), key]);
    }
    return [...map.entries()];
  }, [roleList.data?.permissions]);

  const toggleOpen = (role: RoleInfo) => {
    if (openId === role.id) {
      setOpenId(undefined);
      return;
    }
    setOpenId(role.id);
    setDraft(new Set(role.permissions));
  };

  const toggleKey = (key: string, on: boolean) =>
    setDraft((previous) => {
      const next = new Set(previous);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const save = async (role: RoleInfo) => {
    try {
      await update.mutateAsync({ id: role.id, permissions: [...draft] });
      haptics.success();
    } catch (error) {
      showMessage(t('admin.saveFailed'), error instanceof ApiError ? error.message : t('common.somethingWrong'));
    }
  };

  let body;
  if (!serverMode) {
    body = <EmptyState icon={<Users size={26} color={colors.brand} />} title={t('admin.demoUnavailable')} body={t('admin.demoUnavailableBody')} />;
  } else if (!canRead) {
    body = <EmptyState icon={<Lock size={26} color={colors.brand} />} title={t('admin.noAccess')} />;
  } else if (roleList.isPending) {
    body = (
      <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginTop: spacing.xl }}>
        {t('common.loading')}
      </AppText>
    );
  } else if (roleList.isError) {
    body = <EmptyState title={t('admin.loadFailed')} action={{ label: t('common.retry'), onPress: () => void roleList.refetch() }} />;
  } else {
    body = (
      <View style={{ gap: spacing.md }}>
        {!canEdit ? (
          <AppText variant="caption" color="textTertiary">{t('admin.readOnlyNote')}</AppText>
        ) : null}

        {roleList.data.roles.map((role) => {
          const isOpen = openId === role.id;
          const dirty =
            isOpen && !(draft.size === role.permissions.length && role.permissions.every((key) => draft.has(key)));

          return (
            <Card key={role.id} padding="none">
              <ListItem
                title={roleLabel(t, role.name)}
                subtitle={t('admin.roleMeta', { users: role.userCount, permissions: role.permissions.length })}
                trailing={role.locked ? <StatusBadge label={t('admin.locked')} tone="neutral" size="sm" /> : undefined}
                showChevron
                onPress={() => toggleOpen(role)}
                style={{ paddingHorizontal: spacing.lg }}
              />

              {isOpen ? (
                <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
                  {role.locked ? (
                    <AppText variant="caption" color="textTertiary">{t('admin.lockedNote')}</AppText>
                  ) : null}

                  {groups.map(([group, keys]) => (
                    <View key={group} style={{ gap: spacing.xs }}>
                      <AppText variant="label" color="textSecondary">{permissionGroupLabel(t, group)}</AppText>
                      {keys.map((key) => {
                        const on = draft.has(key);
                        // Same rules as the server: no edits to locked roles, and you can only turn on what you hold.
                        const disabled = !canEdit || role.locked || update.isPending || (!on && !myPermissions.includes(key));
                        return (
                          <View
                            key={key}
                            style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 40 }}
                          >
                            <AppText variant="body" style={{ flex: 1 }}>{permissionLabel(t, key)}</AppText>
                            <Switch
                              value={on}
                              onValueChange={(value) => toggleKey(key, value)}
                              disabled={disabled}
                              trackColor={{ true: colors.brand, false: colors.track }}
                              accessibilityLabel={permissionLabel(t, key)}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ))}

                  {dirty ? (
                    <View style={{ gap: spacing.sm }}>
                      <AppButton label={t('admin.save')} loading={update.isPending} onPress={() => void save(role)} />
                      <AppButton
                        label={t('admin.discard')}
                        variant="ghost"
                        disabled={update.isPending}
                        onPress={() => setDraft(new Set(role.permissions))}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    );
  }

  return (
    <Screen
      scrollProps={{
        refreshControl: <RefreshControl refreshing={roleList.isRefetching} onRefresh={() => void roleList.refetch()} />,
      }}
    >
      <AppHeader title={t('admin.roles')} />
      {body}
    </Screen>
  );
}