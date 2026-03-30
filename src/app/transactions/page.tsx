'use client';

import { useState, useEffect, Fragment, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Table, Text, Group, TextInput, Pagination, Center, Loader, Badge, Button, Tabs, Select, SimpleGrid, useComputedColorScheme, Alert } from '@mantine/core';
import { IconDownload, IconCoin } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

const ITEMS_PER_PAGE = 10;

export default function TransactionsPage() {
  const router = useRouter();
  
  const theme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDark = theme === 'dark';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);

  const [autoSyncData, setAutoSyncData] = useState<{ count: number, total: number } | null>(null);

  const [activeTab, setActiveTab] = useState<string | null>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [flowType, setFlowType] = useState<string | null>('ALL');
  const [searchQuery, setSearchQuery] = useState(''); 
  
  const [internalOwner, setInternalOwner] = useState<string | null>('ALL');
  const [internalAccount, setInternalAccount] = useState<string | null>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // ========================================================
  // MESIN OTOMATISASI BUNGA PROGRESIF (AUTO-SYNC)
  // ========================================================
  const runAutoInterestPayout = () => {
    const today = new Date();
    
    // Hanya berjalan jika hari ini adalah tanggal 28 atau lebih
    if (today.getDate() < 28) return;

    const rawAccounts = localStorage.getItem('finance_accounts_v3');
    const rawBanks = localStorage.getItem('finance_master_banks');
    const rawTrx = localStorage.getItem('finance_transactions_v2');
    
    if (!rawAccounts || !rawBanks) return;

    const currentAccounts = JSON.parse(rawAccounts);
    const masterBanks = JSON.parse(rawBanks);
    const currentTrx = rawTrx ? JSON.parse(rawTrx) : [];
    
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentMonthKey = `${currentYear}-${currentMonth + 1}`; 
    const currentMonthPadded = String(currentMonth + 1).padStart(2, '0');
    const forcedTransactionDate = `${currentYear}-${currentMonthPadded}-28`;

    const payoutCutoffThisMonth = new Date(currentYear, currentMonth, 28, 23, 59, 59).getTime();

    let isUpdated = false;
    let addedCount = 0;
    let totalInterestAdded = 0;
    let newTransactions = [...currentTrx];
    let newAccounts = [...currentAccounts];

    newAccounts.forEach((acc, index) => {
      if (acc.lastInterestMonth === currentMonthKey) return; 

      if (acc.id > 10000 && acc.id > payoutCutoffThisMonth) {
        newAccounts[index].lastInterestMonth = currentMonthKey; 
        isUpdated = true; 
        return;
      }

      const bank = masterBanks.find((b: any) => b.name === acc.bankName);
      if (!bank || acc.balance <= 0) return;

      let calculatedInterest = 0;
      if (bank.tiers && bank.tiers.length > 0) {
        const sortedTiers = [...bank.tiers].sort((a, b) => Number(a.minBalance) - Number(b.minBalance));
        
        for (let i = 0; i < sortedTiers.length; i++) {
          const tier = sortedTiers[i];
          const min = Number(tier.minBalance);
          
          let max;
          if (i + 1 < sortedTiers.length) {
            max = Number(sortedTiers[i + 1].minBalance);
          } else {
            max = tier.maxBalance === '' ? Infinity : Number(tier.maxBalance);
          }

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

      calculatedInterest = Math.floor(calculatedInterest);

      if (calculatedInterest > 0) {
        newAccounts[index].balance += calculatedInterest;
        newAccounts[index].lastInterestMonth = currentMonthKey; 

        const trxId = Date.now() + Math.random(); 
        newTransactions.push({
          id: trxId,
          date: forcedTransactionDate,
          desc: `Pendapatan Bunga Otomatis - ${bank.name}`,
          amount: calculatedInterest,
          isDoubleEntry: true,
          debitId: acc.id,
          debitName: acc.name,
          debitOwner: acc.owner,
          creditId: 'MANUAL',
          creditName: 'Pendapatan Bunga (Sistem)',
          creditOwner: 'Global/Eksternal'
        });

        isUpdated = true;
        addedCount++;
        totalInterestAdded += calculatedInterest;
      }
    });

    if (isUpdated) {
      localStorage.setItem('finance_accounts_v3', JSON.stringify(newAccounts));
      localStorage.setItem('finance_transactions_v2', JSON.stringify(newTransactions));
      setAccounts(newAccounts);
      setTransactions(newTransactions);
      
      if (addedCount > 0) {
        setAutoSyncData({ count: addedCount, total: totalInterestAdded });
      }
    } 
  };

  useEffect(() => {
    runAutoInterestPayout();

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));

    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
    
    const savedBanks = localStorage.getItem('finance_master_banks');
    if (savedBanks) setBanks(JSON.parse(savedBanks));

    setIsLoading(false);
  }, []);

  // ========================================================

  useEffect(() => {
    setCurrentPage(1);
    if (activeTab !== 'INTERNAL') {
      setInternalOwner('ALL');
      setInternalAccount('ALL');
    }
  }, [activeTab, startDate, endDate, flowType, searchQuery, internalOwner, internalAccount]);

  useEffect(() => { setInternalAccount('ALL'); }, [internalOwner]);

  const getAccountDetails = (id: number | string | null) => {
    if (!id || id === 'MANUAL') return { name: 'Akun Manual', owner: '-' };
    const account = accounts.find(acc => acc.id === Number(id));
    return { name: account ? account.name : 'Akun Dihapus', owner: account ? account.owner : '-' };
  };

  const uniqueOwners = useMemo(() => {
    return Array.from(new Set(accounts.map(acc => (acc.owner || '').trim()))).filter(Boolean);
  }, [accounts]);

  const ownerOptions = [{ value: 'ALL', label: 'Semua Pemilik' }, ...uniqueOwners.map(owner => ({ value: owner, label: owner }))];

  const accountOptions = useMemo(() => {
    if (!internalOwner || internalOwner === 'ALL') return [{ value: 'ALL', label: 'Semua Akun' }];
    const ownerAccounts = accounts.filter(acc => (acc.owner || '').trim() === internalOwner);
    const uniqueAccNames = Array.from(new Set(ownerAccounts.map(acc => (acc.name || '').trim())));
    return [{ value: 'ALL', label: 'Semua Akun' }, ...uniqueAccNames.map(name => ({ value: name, label: name }))];
  }, [accounts, internalOwner]);

  const allJournalEntries = [...transactions].reverse().map(trx => {
    if (trx.isDoubleEntry) {
      return {
        id: trx.id, date: trx.date, desc: trx.desc,
        debitAcc: trx.debitName, debitOwner: trx.debitOwner,
        creditAcc: trx.creditName, creditOwner: trx.creditOwner, amount: trx.amount
      };
    }
    const accountDetail = getAccountDetails(trx.accountId);
    if (trx.type === 'INCOME') {
      return {
        id: trx.id, date: trx.date, desc: trx.desc || 'Tanpa Keterangan',
        debitAcc: accountDetail.name, debitOwner: accountDetail.owner,
        creditAcc: 'Pendapatan / Modal (Otomatis)', creditOwner: 'MANUAL', amount: trx.amount
      };
    } else {
      return {
        id: trx.id, date: trx.date, desc: trx.desc || 'Tanpa Keterangan',
        debitAcc: 'Beban / Pengeluaran (Otomatis)', debitOwner: 'MANUAL',
        creditAcc: accountDetail.name, creditOwner: accountDetail.owner, amount: trx.amount
      };
    }
  });

  const filteredJournals = allJournalEntries.filter((j) => {
    const isGlobal = j.debitOwner === 'Global/Eksternal' || j.creditOwner === 'Global/Eksternal';
    
    if (activeTab === 'INTERNAL' && isGlobal) return false;
    if (activeTab === 'GLOBAL' && !isGlobal) return false;

    if (startDate && j.date < startDate) return false;
    if (endDate && j.date > endDate) return false;

    if (activeTab === 'INTERNAL') {
      if (internalOwner && internalOwner !== 'ALL') {
        const isDebitOwner = j.debitOwner === internalOwner;
        const isCreditOwner = j.creditOwner === internalOwner;
        if (!isDebitOwner && !isCreditOwner) return false;

        if (internalAccount && internalAccount !== 'ALL') {
          const isDebitAcc = isDebitOwner && j.debitAcc === internalAccount;
          const isCreditAcc = isCreditOwner && j.creditAcc === internalAccount;
          if (!isDebitAcc && !isCreditAcc) return false;

          if (flowType === 'INCOME' && !isDebitAcc) return false;
          if (flowType === 'EXPENSE' && !isCreditAcc) return false;
        } else {
          if (flowType === 'INCOME' && !isDebitOwner) return false;
          if (flowType === 'EXPENSE' && !isCreditOwner) return false;
        }
      } else {
        const isDebitInternal = j.debitOwner && j.debitOwner !== 'MANUAL' && j.debitOwner !== 'Global/Eksternal';
        const isCreditInternal = j.creditOwner && j.creditOwner !== 'MANUAL' && j.creditOwner !== 'Global/Eksternal';
        if (flowType === 'INCOME' && !isDebitInternal) return false;
        if (flowType === 'EXPENSE' && !isCreditInternal) return false;
      }
    }

    if (activeTab === 'ALL' || activeTab === 'GLOBAL') {
      if (flowType !== 'ALL') {
        const isIncomeFlow = j.creditOwner === 'MANUAL' || j.creditOwner === 'Global/Eksternal' || j.creditAcc.toLowerCase().includes('pendapatan');
        const isExpenseFlow = j.debitOwner === 'MANUAL' || j.debitOwner === 'Global/Eksternal' || j.debitAcc.toLowerCase().includes('beban');
        
        if (flowType === 'INCOME' && !isIncomeFlow) return false;
        if (flowType === 'EXPENSE' && !isExpenseFlow) return false;
      }

      if (activeTab === 'ALL' && searchQuery) {
        const str = `${j.desc} ${j.debitAcc} ${j.creditAcc} ${j.debitOwner} ${j.creditOwner}`.toLowerCase();
        if (!str.includes(searchQuery.toLowerCase())) return false;
      }
    }

    return true;
  });

  const downloadExcel = () => {
    let csvContent = "Tanggal,Keterangan / Nama Akun,Debit (Rp),Kredit (Rp),Keterangan Tambahan\n";
    
    filteredJournals.forEach(j => {
      const debitOwnerStr = j.debitOwner && j.debitOwner !== 'Global/Eksternal' && j.debitOwner !== 'MANUAL' ? ` (${j.debitOwner})` : '';
      const creditOwnerStr = j.creditOwner && j.creditOwner !== 'Global/Eksternal' && j.creditOwner !== 'MANUAL' ? ` (${j.creditOwner})` : '';
      
      csvContent += `"${j.date}","${j.debitAcc}${debitOwnerStr}","${j.amount}","0","${j.desc}"\n`;
      csvContent += `"${j.date}","   ${j.creditAcc}${creditOwnerStr}","0","${j.amount}",""\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Jurnal_Umum_${activeTab}_${new Date().toLocaleDateString('id-ID')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(filteredJournals.length / ITEMS_PER_PAGE);
  const paginatedJournals = filteredJournals.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (isLoading) return <DashboardLayout><Center h="50vh"><Loader color="blue" /></Center></DashboardLayout>;

  return (
    <DashboardLayout>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Jurnal Umum</Title>
        <Button color="green" onClick={() => router.push('/transactions/add')}>
          + Tambah Jurnal Baru
        </Button>
      </Group>

      {autoSyncData && (
        <Alert icon={<IconCoin size={20} />} color="teal" variant="light" mb="md" style={{ border: '1px solid var(--mantine-color-teal-4)' }}>
          <Text fw={700}>Otomatisasi Berhasil!</Text>
          <Text size="sm">
            Sistem mendeteksi jadwal pembagian bunga. Total <b>Rp {autoSyncData.total.toLocaleString('id-ID')}</b> telah ditambahkan secara otomatis ke <b>{autoSyncData.count} dompet</b> Anda dan dicatat di tabel Jurnal Umum di bawah ini.
          </Text>
        </Alert>
      )}

      <Paper withBorder p="md" radius="md" mb="xl" shadow="xs">
        <Tabs value={activeTab} onChange={setActiveTab} color="blue" radius="md" mb="md">
          <Tabs.List>
            <Tabs.Tab value="ALL"><Text fw={500}>Semua Transaksi</Text></Tabs.Tab>
            <Tabs.Tab value="INTERNAL"><Text fw={500}>Internal (Dompet/Pemilik)</Text></Tabs.Tab>
            <Tabs.Tab value="GLOBAL" color="grape"><Text fw={500} c="grape">Global (Eksternal/Biaya)</Text></Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: activeTab === 'INTERNAL' ? 5 : activeTab === 'ALL' ? 4 : 3 }} spacing="md" mb="md">
          <TextInput type="date" label="Tanggal Dari" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} />
          <TextInput type="date" label="Tanggal Ke" value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />

          {activeTab === 'INTERNAL' && (
            <>
              <Select label="Filter Pemilik" data={ownerOptions} value={internalOwner} onChange={setInternalOwner} searchable />
              <Select label="Filter Akun" data={accountOptions} value={internalAccount} onChange={setInternalAccount} disabled={!internalOwner || internalOwner === 'ALL'} searchable />
            </>
          )}

          <Select 
            label="Tipe Arus" 
            data={[
              { value: 'ALL', label: 'Semua Tipe' },
              { value: 'INCOME', label: 'Pemasukan Saja' },
              { value: 'EXPENSE', label: 'Pengeluaran/Beban Saja' }
            ]} 
            value={flowType} 
            onChange={setFlowType} 
          />

          {activeTab === 'ALL' && (
            <TextInput label="Cari Kata Kunci" placeholder="Cari nama akun..." value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} />
          )}
        </SimpleGrid>

        <Group justify="flex-end">
          <Button color="teal" variant="light" leftSection={<IconDownload size={18} />} onClick={downloadExcel}>
              Download Excel (.csv)
            </Button>
        </Group>
      </Paper>

      <Paper withBorder radius="md" p="md" shadow="xs">
        {filteredJournals.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <Table verticalSpacing="xs" striped highlightOnHover miw={800} withTableBorder>
                <Table.Thead>
                  <Table.Tr bg={isDark ? 'dark.6' : 'gray.1'}>
                    <Table.Th w={120}>Tanggal</Table.Th>
                    <Table.Th>Keterangan / Nama Akun</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }} w={180}>Debit (Rp)</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }} w={180}>Kredit (Rp)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedJournals.map((journal) => (
                    <Fragment key={journal.id}>
                      <Table.Tr>
                        <Table.Td rowSpan={2} style={{ verticalAlign: 'top', fontWeight: 500 }}>{journal.date}</Table.Td>
                        <Table.Td fw={700}>
                          {journal.debitAcc}
                          {journal.debitOwner && journal.debitOwner !== 'MANUAL' && (
                            <Badge color={journal.debitOwner === 'Global/Eksternal' ? 'grape' : 'gray'} variant="outline" size="xs" ml="sm" style={{ verticalAlign: 'middle' }}>
                              {journal.debitOwner}
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>{journal.amount.toLocaleString('id-ID')}</Table.Td>
                        <Table.Td></Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td pl={40} fs="italic">
                          {journal.creditAcc}
                          {journal.creditOwner && journal.creditOwner !== 'MANUAL' && (
                            <Badge color={journal.creditOwner === 'Global/Eksternal' ? 'grape' : 'gray'} variant="outline" size="xs" ml="sm" style={{ verticalAlign: 'middle' }}>
                              {journal.creditOwner}
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td></Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>{journal.amount.toLocaleString('id-ID')}</Table.Td>
                      </Table.Tr>
                      <Table.Tr bg="transparent">
                        <Table.Td colSpan={4} pb="sm">
                          <Text size="xs" c={journal.desc.includes('Otomatis') ? 'teal.6' : 'dimmed'} fw={journal.desc.includes('Otomatis') ? 600 : 400}>
                            ({journal.desc})
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    </Fragment>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {totalPages > 1 && (
              <Group justify="center" mt="xl">
                <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} color="blue" radius="md" withEdges />
              </Group>
            )}
          </>
        ) : (
          <Text c="dimmed" fs="italic" ta="center" py="xl">Jurnal Umum kosong atau tidak ada yang sesuai filter.</Text>
        )}
      </Paper>
    </DashboardLayout>
  );
}