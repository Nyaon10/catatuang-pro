'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Text, Group, SimpleGrid, Card, Center, Loader, Badge, Stack, Box, Tooltip } from '@mantine/core';

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ========================================================
    // MESIN OTOMATISASI BUNGA PROGRESIF & PAJAK (AUTO-SYNC)
    // Berjalan sebelum data di-set ke state agar grafik langsung update
    // ========================================================
    const runAutoSyncAndLoadData = () => {
      const today = new Date();
      
      const rawAccounts = localStorage.getItem('finance_accounts_v3');
      const rawBanks = localStorage.getItem('finance_master_banks');
      const rawTrx = localStorage.getItem('finance_transactions_v2');

      let currentAccounts = rawAccounts ? JSON.parse(rawAccounts) : [];
      const masterBanks = rawBanks ? JSON.parse(rawBanks) : [];
      let currentTrx = rawTrx ? JSON.parse(rawTrx) : [];

      // Hanya jalankan logika bunga jika hari ini >= tanggal 28 dan ada data
      if (today.getDate() >= 28 && currentAccounts.length > 0 && masterBanks.length > 0) {
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const currentMonthKey = `${currentYear}-${currentMonth + 1}`; 
        const currentMonthPadded = String(currentMonth + 1).padStart(2, '0');
        const forcedTransactionDate = `${currentYear}-${currentMonthPadded}-28`;
        const monthYearStr = `${currentMonthPadded}/${currentYear}`; 
        const payoutCutoffThisMonth = new Date(currentYear, currentMonth, 28, 23, 59, 59).getTime();

        let isUpdated = false;

        currentAccounts.forEach((acc: any, index: number) => {
          if (acc.lastInterestMonth === currentMonthKey) return; 

          if (acc.id > 10000 && acc.id > payoutCutoffThisMonth) {
            currentAccounts[index].lastInterestMonth = currentMonthKey; 
            isUpdated = true; 
            return;
          }

          const bank = masterBanks.find((b: any) => b.name === acc.bankName);
          if (!bank || acc.balance <= 0) return;

          let calculatedInterest = 0;
          if (bank.tiers && bank.tiers.length > 0) {
            const sortedTiers = [...bank.tiers].sort((a: any, b: any) => Number(a.minBalance) - Number(b.minBalance));
            for (let i = 0; i < sortedTiers.length; i++) {
              const tier = sortedTiers[i];
              const min = Number(tier.minBalance);
              const max = tier.maxBalance === '' ? Infinity : Number(tier.maxBalance);
              const rate = Number(tier.rate) / 100;
              const effectiveRate = bank.interestPeriod === 'YEAR' ? rate / 12 : rate;

              if (acc.balance > min) {
                const chunk = Math.min(acc.balance, max) - min;
                calculatedInterest += chunk * effectiveRate;
              }
            }
          } else {
            const rate = (bank.interestRate || 0) / 100;
            const effectiveRate = bank.interestPeriod === 'YEAR' ? rate / 12 : rate;
            calculatedInterest = acc.balance * effectiveRate;
          }

          const gross = Math.floor(calculatedInterest);
          if (gross > 0) {
            const taxRate = bank.taxRate ?? 20; 
            const taxAmount = Math.floor(gross * (taxRate / 100));
            const net = gross - taxAmount;

            currentAccounts[index].balance += net; 
            currentAccounts[index].lastInterestMonth = currentMonthKey; 

            const trxBaseId = Date.now() + Math.random(); 

            // 1. Pemasukan Bunga Kotor
            currentTrx.push({
              id: trxBaseId,
              date: forcedTransactionDate,
              desc: `Bunga Bulanan ${monthYearStr} - ${bank.name} (Otomatis)`,
              amount: gross,
              isDoubleEntry: true,
              debitId: acc.id, 
              debitName: acc.name,
              debitOwner: acc.owner,
              creditId: 'MANUAL',
              creditName: 'Pendapatan Bunga (Sistem)',
              creditOwner: 'Global/Eksternal'
            });

            // 2. Pengeluaran Pajak Bunga
            currentTrx.push({
              id: trxBaseId + 1,
              date: forcedTransactionDate,
              desc: `Pajak Bunga ${monthYearStr} - ${bank.name} (Otomatis)`,
              amount: taxAmount,
              isDoubleEntry: true,
              debitId: 'MANUAL',
              debitName: 'Beban Pajak Bunga (Sistem)',
              debitOwner: 'Global/Eksternal',
              creditId: acc.id, 
              creditName: acc.name,
              creditOwner: acc.owner
            });

            isUpdated = true;
          }
        });

        // Simpan hanya jika ada data baru yang diproses
        if (isUpdated) {
          localStorage.setItem('finance_accounts_v3', JSON.stringify(currentAccounts));
          localStorage.setItem('finance_transactions_v2', JSON.stringify(currentTrx));
        }
      }

      // Load data ke UI State
      setAccounts(currentAccounts);
      setTransactions(currentTrx);
      setIsLoading(false);
    };

    runAutoSyncAndLoadData();
  }, []);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

  // ==========================================
  // KALKULASI DATA GLOBAL & PENDAPATAN BULANAN
  // ==========================================
  const globalData = { totalIncome: 0, totalExpense: 0 };
  const monthlyIncomeRaw: Record<string, { label: string; amount: number; sortKey: string }> = {};

  transactions.forEach(trx => {
    if (trx.isDoubleEntry) {
      const debitName = (trx.debitName || '').toLowerCase();
      const creditName = (trx.creditName || '').toLowerCase();
      
      // Deteksi transaksi Global ATAU Bunga Otomatis / Pajak Manual dari Akun Dompet
      const isGlobalTrx = trx.debitOwner === 'Global/Eksternal' || trx.creditOwner === 'Global/Eksternal';
      
      if (isGlobalTrx) {
        // Total Pengeluaran Global (Termasuk potongan pajak dari akun dompet)
        if (debitName.includes('beban') || debitName.includes('pajak') || debitName.includes('gaji') || debitName.includes('biaya')) {
          globalData.totalExpense += trx.amount;
        } 
        // Total Pendapatan Global (Termasuk bunga otomatis dari akun dompet) & Grafik Bulanan
        else if (creditName.includes('pendapatan') || creditName.includes('bunga')) {
          globalData.totalIncome += trx.amount;

          const dateObj = new Date(trx.date);
          const month = monthNames[dateObj.getMonth()];
          const year = dateObj.getFullYear();
          const sortKey = `${year}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`; 

          if (!monthlyIncomeRaw[sortKey]) {
            monthlyIncomeRaw[sortKey] = { label: `${month} ${year}`, amount: 0, sortKey };
          }
          monthlyIncomeRaw[sortKey].amount += trx.amount;
        }
      }
    } 
  });

  // ==========================================
  // KALKULASI PERTUMBUHAN PENGGUNA BULANAN
  // ==========================================
  const monthlyUsersRaw: Record<string, { label: string; amount: number; sortKey: string }> = {};
  const seenOwners = new Set<string>();

  const sortedTransactions = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  sortedTransactions.forEach(trx => {
    const dateObj = new Date(trx.date);
    const month = monthNames[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const sortKey = `${year}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    
    const checkOwner = (owner: string | null) => {
      if (owner && owner !== 'Global/Eksternal' && owner !== 'MANUAL') {
        seenOwners.add(owner);
      }
    };

    if (trx.isDoubleEntry) {
      checkOwner(trx.debitOwner);
      checkOwner(trx.creditOwner);
    } else {
      const acc = accounts.find(a => a.id === trx.accountId);
      if (acc) checkOwner(acc.owner);
    }

    monthlyUsersRaw[sortKey] = { label: `${month} ${year}`, amount: seenOwners.size, sortKey };
  });

  const incomeChartData = Object.values(monthlyIncomeRaw).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-12);
  const maxIncome = Math.max(...incomeChartData.map(d => d.amount), 1); 

  const userChartData = Object.values(monthlyUsersRaw).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-12);
  const maxUsers = Math.max(...userChartData.map(d => d.amount), 1); 

  const totalAllBalances = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const formatCompactNumber = (number: number) => {
    if (number >= 1000000) return (number / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' Jt';
    if (number >= 1000) return (number / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' Rb';
    return number.toLocaleString('id-ID');
  };

  if (isLoading) return <DashboardLayout><Center h="50vh"><Loader color="blue" /></Center></DashboardLayout>;

  return (
    <DashboardLayout>
      <Title order={2} mb="lg">Dashboard Eksekutif</Title>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mb="xl">
        <Card withBorder radius="md" padding="xl" shadow="sm">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Total Saldo Pokok (Semua Akun)</Text>
          <Text size="xl" fw={800} mt="sm">Rp {totalAllBalances.toLocaleString('id-ID')}</Text>
        </Card>
        <Card withBorder radius="md" padding="xl" shadow="sm" bg="green.0">
          <Text size="xs" tt="uppercase" fw={700} c="green.9">Total Pendapatan Global</Text>
          <Text size="xl" fw={800} c="green.9" mt="sm">Rp {globalData.totalIncome.toLocaleString('id-ID')}</Text>
        </Card>
        <Card withBorder radius="md" padding="xl" shadow="sm" bg="red.0">
          <Text size="xs" tt="uppercase" fw={700} c="red.9">Total Biaya Operasional Global</Text>
          <Text size="xl" fw={800} c="red.9" mt="sm">Rp {globalData.totalExpense.toLocaleString('id-ID')}</Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        
        {/* --- GRAFIK PENDAPATAN GLOBAL BULANAN --- */}
        <Paper withBorder radius="md" p="md" shadow="sm" style={{ display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" mb="md">
            <Title order={4}>Tren Pendapatan Global</Title>
            <Badge color="blue" variant="light">Grafik Kinerja</Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="xl">
            Akumulasi Pendapatan Bunga & Eksternal (12 Bulan Terakhir).
          </Text>

          {incomeChartData.length > 0 ? (
            <Group align="flex-end" grow gap="xs" h={250} mt="auto" style={{ borderBottom: '2px solid var(--mantine-color-gray-3)', paddingBottom: '10px' }}>
              {incomeChartData.map((data) => {
                const heightPercentage = (data.amount / maxIncome) * 100;
                return (
                  <Stack key={data.sortKey} align="center" justify="flex-end" gap={0} h="100%">
                    <div style={{ flexGrow: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Tooltip label={`Rp ${data.amount.toLocaleString('id-ID')}`} withArrow position="top">
                        <Box w="100%" maw={40} bg="blue.5" h={`${heightPercentage}%`} style={{ borderRadius: '4px 4px 0 0', cursor: 'pointer', transition: 'height 0.3s ease' }} />
                      </Tooltip>
                    </div>
                    <Text size="11px" fw={800} ta="center" mt={8} c="blue.7" style={{ whiteSpace: 'nowrap' }}>
                      {formatCompactNumber(data.amount)}
                    </Text>
                    <Text size="10px" c="dimmed" fw={600} ta="center" style={{ whiteSpace: 'nowrap' }}>{data.label}</Text>
                  </Stack>
                );
              })}
            </Group>
          ) : (
            <Center h={250}><Text c="dimmed" fs="italic">Belum ada data pendapatan bulanan.</Text></Center>
          )}
        </Paper>

        {/* --- GRAFIK PERTUMBUHAN PENGGUNA --- */}
        <Paper withBorder radius="md" p="md" shadow="sm" style={{ display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" mb="md">
            <Title order={4}>Pertumbuhan Pengguna</Title>
            <Badge color="grape" variant="light">Grafik Kinerja</Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="xl">
            Akumulasi jumlah Pemilik / Pengguna terdaftar (12 Bulan Terakhir).
          </Text>

          {userChartData.length > 0 ? (
            <Group align="flex-end" grow gap="xs" h={250} mt="auto" style={{ borderBottom: '2px solid var(--mantine-color-gray-3)', paddingBottom: '10px' }}>
              {userChartData.map((data) => {
                const heightPercentage = (data.amount / maxUsers) * 100;
                return (
                  <Stack key={data.sortKey} align="center" justify="flex-end" gap={0} h="100%">
                    <div style={{ flexGrow: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Tooltip label={`${data.amount} Pengguna`} withArrow position="top">
                        <Box w="100%" maw={40} bg="grape.5" h={`${heightPercentage}%`} style={{ borderRadius: '4px 4px 0 0', cursor: 'pointer', transition: 'height 0.3s ease' }} />
                      </Tooltip>
                    </div>
                    <Text size="11px" fw={800} ta="center" mt={8} c="grape.7" style={{ whiteSpace: 'nowrap' }}>
                      {data.amount}
                    </Text>
                    <Text size="10px" c="dimmed" fw={600} ta="center" style={{ whiteSpace: 'nowrap' }}>{data.label}</Text>
                  </Stack>
                );
              })}
            </Group>
          ) : (
            <Center h={250}><Text c="dimmed" fs="italic">Belum ada data pengguna bulanan.</Text></Center>
          )}
        </Paper>

      </SimpleGrid>
    </DashboardLayout>
  );
}