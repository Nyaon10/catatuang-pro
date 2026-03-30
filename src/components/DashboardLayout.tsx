'use client';

// PERBAIKAN: Menambahkan useState dan useEffect
import { useState, useEffect } from 'react';
import { AppShell, Burger, Group, NavLink, Text, ThemeIcon, ScrollArea, ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useRouter, usePathname } from 'next/navigation';
import { IconWallet, IconListDetails, IconSettings, IconLayoutDashboard, IconFileReport, IconLogout, IconSun, IconMoon, IconDatabase } from '@tabler/icons-react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const router = useRouter();
  const pathname = usePathname();

  // State untuk menghindari Hydration Error
  const [mounted, setMounted] = useState(false);

  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  // Beritahu React bahwa komponen sudah aman dimuat di browser
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    router.push('/');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
      styles={{
        main: {
          backgroundColor: 'var(--mantine-color-body)',
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={800} size="lg" c="blue.6">CatatUang Pro</Text>
          </Group>

          <ActionIcon
            onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
            variant="default"
            size="lg"
            aria-label="Ganti tema"
            radius="md"
          >
            {/* PERBAIKAN: Gunakan status "mounted" agar server dan client sinkron */}
            {mounted && computedColorScheme === 'dark' ? (
              <IconSun size="1.2rem" stroke={1.5} color="var(--mantine-color-yellow-4)" />
            ) : (
              <IconMoon size="1.2rem" stroke={1.5} color="var(--mantine-color-blue-6)" />
            )}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <NavLink
            label="Dashboard"
            leftSection={<ThemeIcon variant="light" color="blue"><IconLayoutDashboard size="1rem" /></ThemeIcon>}
            active={pathname === '/dashboard'}
            onClick={() => router.push('/dashboard')}
            mb="sm"
          />
          <NavLink
            label="Dompet & Akun"
            leftSection={<ThemeIcon variant="light" color="teal"><IconWallet size="1rem" /></ThemeIcon>}
            active={pathname.includes('/accounts')}
            onClick={() => router.push('/accounts')}
            mb="sm"
          />
          <NavLink
            label="Jurnal Umum"
            leftSection={<ThemeIcon variant="light" color="grape"><IconListDetails size="1rem" /></ThemeIcon>}
            active={pathname.includes('/transactions')}
            onClick={() => router.push('/transactions')}
            mb="sm"
          />
          <NavLink
            label="Data Master"
            leftSection={<ThemeIcon variant="light" color="cyan"><IconDatabase size="1rem" /></ThemeIcon>}
            active={pathname.includes('/masters')}
            onClick={() => router.push('/masters')}
            mb="sm"
          />
          <NavLink
            label="Laporan Keuangan"
            leftSection={<ThemeIcon variant="light" color="orange"><IconFileReport size="1rem" /></ThemeIcon>}
            active={pathname.includes('/reports')}
            onClick={() => router.push('/reports')}
            mb="sm"
          />
          <NavLink
            label="Pengaturan"
            leftSection={<ThemeIcon variant="light" color="gray"><IconSettings size="1rem" /></ThemeIcon>}
            active={pathname.includes('/settings')}
            onClick={() => router.push('/settings')}
          />
        </AppShell.Section>

        <AppShell.Section>
          <NavLink
            label="Keluar (Log Out)"
            leftSection={<ThemeIcon variant="light" color="red"><IconLogout size="1rem" /></ThemeIcon>}
            onClick={handleLogout}
            c="red.7"
            fw={600}
            style={{ borderRadius: 8 }}
          />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}