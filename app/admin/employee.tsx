import { useEffect, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Lock, Users } from 'lucide-react-native';

import { AppButton, AppHeader, AppText, EmptyState, ListItem, Screen } from '@/components/ui';
import { FormField } from '@/components/ui/FormField';
import { useCreateEmployee, useEmployees, useRoleList, useUpdateEmployee } from '@/features/admin/hooks';
import { roleLabel } from '@/features/admin/roleLabel';
import { useHasPermission } from '@/hooks/useHasPermission';
import { useLocale } from '@/hooks/useLocale';
import { ApiError } from '@/services/http/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/spacing';
import { confirmAction, showMessage } from '@/utils/dialog';
import { haptics } from '@/utils/haptics';

export default function EmployeeFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const serverMode = useAuthStore((s) => s.mode) === 'server';
  const me = useAuthStore((s) => s.user);
  const canWrite = useHasPermission('users:write');
  const enabled = serverMode && canWrite;

  const employees = useEmployees(enabled);
  const roles = useRoleList(enabled);
  const create = useCreateEmployee();
  const update = useUpdateEmployee();

  const existing = id ? employees.data?.find((employee) => employee.id === id) : undefined;
  const isSelf = Boolean(existing && existing.id === me?.id);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const filled = useRef(false);

  // The form opens from the cached list, so fill it once the employee is known.
  useEffect(() => {
    if (!existing || filled.current) return;
    filled.current = true;
    setFirstName(existing.firstName);
    setLastName(existing.lastName);
    setEmail(existing.email);
    setPhone(existing.phone ?? '');
    setRole(existing.role ?? '');
  }, [existing]);

  // Same rule as the server: you can only hand out roles whose permissions you hold.
  const myPermissions = me?.permissions ?? [];
  const grantable = (roles.data?.roles ?? []).filter((r) => r.permissions.every((p) => myPermissions.includes(p)));

  if (!serverMode) {
    return (
      <Screen>
        <AppHeader title={t('admin.employees')} />
        <EmptyState icon={<Users size={26} color={colors.brand} />} title={t('admin.demoUnavailable')} body={t('admin.demoUnavailableBody')} />
      </Screen>
    );
  }
  if (!canWrite) {
    return (
      <Screen>
        <AppHeader title={t('admin.employees')} />
        <EmptyState icon={<Lock size={26} color={colors.brand} />} title={t('admin.noAccess')} />
      </Screen>
    );
  }
  if (id && employees.isPending) {
    return (
      <Screen>
        <AppHeader title={t('admin.editEmployee')} />
        <AppText variant="bodySm" color="textSecondary" align="center">{t('common.loading')}</AppText>
      </Screen>
    );
  }
  if (id && !existing) {
    return (
      <Screen>
        <AppHeader title={t('admin.editEmployee')} />
        <EmptyState title={t('admin.notFound')} />
      </Screen>
    );
  }

  const validate = (): string | undefined => {
    if (!firstName.trim() || !lastName.trim()) return t('admin.required');
    if (!existing && (!email.trim() || !password || !role)) return t('admin.required');
    if (password && password.length < 8) return t('signup.passwordShort');
    return undefined;
  };

  const submit = async () => {
    if (busy.current) return;
    const problem = validate();
    if (problem) {
      showMessage(t('admin.saveFailed'), problem);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          input: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim() || null,
            ...(password ? { password } : {}),
            ...(!isSelf && role && role !== existing.role ? { role } : {}),
          },
        });
      } else {
        await create.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        });
      }
      haptics.medium();
      router.back();
    } catch (error) {
      showMessage(t('admin.saveFailed'), error instanceof ApiError ? error.message : t('common.somethingWrong'));
    } finally {
      setPassword('');
      busy.current = false;
      setSubmitting(false);
    }
  };

  const toggleActive = async () => {
    if (!existing || busy.current) return;
    if (existing.isActive) {
      const ok = await confirmAction({
        title: t('admin.deactivate'),
        message: t('admin.deactivateConfirm'),
        confirmLabel: t('admin.deactivate'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    busy.current = true;
    setSubmitting(true);
    try {
      await update.mutateAsync({ id: existing.id, input: { isActive: !existing.isActive } });
      haptics.medium();
      router.back();
    } catch (error) {
      showMessage(t('admin.saveFailed'), error instanceof ApiError ? error.message : t('common.somethingWrong'));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboardAvoiding>
      <AppHeader title={existing ? t('admin.editEmployee') : t('admin.addEmployee')} />

      <View style={{ gap: spacing.md }}>
        <FormField label={t('signup.firstName')} value={firstName} onChangeText={setFirstName} editable={!submitting} />
        <FormField label={t('signup.lastName')} value={lastName} onChangeText={setLastName} editable={!submitting} />
        <FormField label={t('login.email')} value={email} onChangeText={setEmail} editable={!existing && !submitting} ltr keyboardType="email-address" />
        <FormField label={t('profile.phone')} value={phone} onChangeText={setPhone} editable={!submitting} ltr keyboardType="phone-pad" />
        <FormField
          label={existing ? t('admin.newPassword') : t('login.password')}
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          ltr
          secure
        />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('profile.role')}</AppText>
          {isSelf ? (
            <AppText variant="caption" color="textTertiary">{t('admin.selfNote')}</AppText>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            {grantable.map((item) => (
              <ListItem
                key={item.id}
                tone="card"
                title={roleLabel(t, item.name)}
                trailing={role === item.name ? <Check size={20} color={colors.brand} strokeWidth={2.6} /> : undefined}
                disabled={isSelf || submitting}
                onPress={() => setRole(item.name)}
              />
            ))}
          </View>
        </View>

        <AppButton label={t('admin.save')} loading={submitting} disabled={submitting} onPress={() => void submit()} />

        {existing && !isSelf ? (
          <AppButton
            label={existing.isActive ? t('admin.deactivate') : t('admin.activate')}
            variant={existing.isActive ? 'danger' : 'tonal'}
            disabled={submitting}
            onPress={() => void toggleActive()}
          />
        ) : null}
      </View>
    </Screen>
  );
}