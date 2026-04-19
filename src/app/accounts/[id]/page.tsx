'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Group, Button, Paper, Text, Table, Badge, Center, Loader, Modal, Stack, Alert, Image as MantineImage, Tooltip, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuildingBank, IconCoin, IconPhoto, IconCheck } from '@tabler/icons-react';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = Number(params.id);

  const [account, setAccount] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<any>(null); 
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Modals
  const [warningOpened, { open: openWarning, close: closeWarning }] = useDisclosure(false);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  
  // STATE UNTUK PREVIEW GAMBAR
  const [imageModalOpened, { open: openImageModal, close: closeImageModal }] = useDisclosure(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // FUNGSI PERHITUNGAN BUNGA (Dipisah agar bisa dipakai di dalam useEffect)
  const computeInterestData = (balance: number, bankData: any) => {
    if (!bankData || balance <= 0) return { gross: 0, tax: 0, net: 0, taxRate: 0 };
    
    let activeRate = 0;

    // LOGIKA BARU: Tiering Absolut (Seluruh saldo pakai 1 rate tertinggi)
    if (bankData.tiers && bankData.tiers.length > 0) {
      // Urutkan tier dari batas saldo TERTINGGI ke TERENDAH
      const sortedTiers = [...bankData.tiers].sort((a: any, b: any) => Number(b.minBalance) - Number(a.minBalance));
      
      // Cari tier pertama yang memenuhi syarat (karena berurut dari besar, ini pasti tier terbaiknya)
      const matchedTier = sortedTiers.find((t: any) => balance >= Number(t.minBalance));
      
      if (matchedTier) {
        activeRate = Number(matchedTier.rate);
      }
    } else {
      activeRate = bankData.interestRate || 0;
    }

    // Hitung Bunga
    const ratePercentage = activeRate / 100;
    const effectiveRate = bankData.interestPeriod === 'YEAR' ? ratePercentage / 12 : ratePercentage;
    const totalInterest = balance * effectiveRate;

    // Hitung Pajak & Bersih
    const gross = Math.floor(totalInterest);
    const taxRate = bankData.taxRate ?? 20; 
    const taxAmount = Math.floor(gross * (taxRate / 100));
    const net = gross - taxAmount;

    return { gross, tax: taxAmount, net, taxRate };
  };

  useEffect(() => {
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    let currentAcc = null;
    if (savedAccounts) {
      const parsedAccounts = JSON.parse(savedAccounts);
      currentAcc = parsedAccounts.find((acc: any) => acc.id === accountId);
      setAccount(currentAcc);
    }

    let matchedBank = null;
    if (currentAcc && currentAcc.bankName) {
      const savedBanks = localStorage.getItem('finance_master_banks');
      if (savedBanks) {
        const parsedBanks = JSON.parse(savedBanks);
        matchedBank = parsedBanks.find((b: any) => b.name === currentAcc.bankName);
        if (matchedBank) setBankDetails(matchedBank);
      }
    }

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    let filteredTrx: any[] = [];
    if (savedTransactions) {
      const parsedTransactions = JSON.parse(savedTransactions);
      filteredTrx = parsedTransactions.filter((trx: any) => {
        if (trx.isDoubleEntry) return trx.debitId === accountId || trx.creditId === accountId;
        return trx.accountId === accountId;
      });
      setAccountTransactions(filteredTrx);
    }

    setIsLoading(false);
  }, [accountId]);

  // =========================================================================
  // AUTO-RECORD SYSTEM: Menjalankan pencatatan otomatis di tanggal 28 ke atas
  // =========================================================================
  useEffect(() => {
    if (isLoading || !account || !bankDetails) return;

    const today = new Date();
    // Cek apakah hari ini tanggal 28 atau lebih (untuk cover kalau user baru buka tgl 29/30)
    if (today.getDate() >= 28) {
      const monthYear = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      const incomeDesc = `Bunga Bulanan ${monthYear} (Otomatis)`;
      const taxDesc = `Pajak Bunga ${monthYear} (Otomatis)`;

      // Cek apakah transaksi bulan ini sudah pernah dicatat
      const isAlreadyRecorded = accountTransactions.some(trx => trx.desc === incomeDesc);

      if (!isAlreadyRecorded) {
        const { gross, tax, net } = computeInterestData(account.balance, bankDetails);

        if (gross > 0) {
          const timestamp = Date.now();
          const todayString = today.toISOString().split('T')[0];

          // 1. Buat Transaksi Pemasukan (Bunga Kotor)
          const newIncomeTrx = {
            id: timestamp,
            accountId: account.id,
            date: todayString,
            desc: incomeDesc,
            amount: gross,
            type: 'INCOME',
            isDoubleEntry: false,
          };

          // 2. Buat Transaksi Pengeluaran (Pajak)
          const newTaxTrx = {
            id: timestamp + 1,
            accountId: account.id,
            date: todayString,
            desc: taxDesc,
            amount: tax,
            type: 'EXPENSE',
            isDoubleEntry: false,
          };

          // Simpan Transaksi ke LocalStorage
          const savedTrx = localStorage.getItem('finance_transactions_v2');
          const parsedTrx = savedTrx ? JSON.parse(savedTrx) : [];
          const updatedTrxList = [...parsedTrx, newIncomeTrx, newTaxTrx];
          localStorage.setItem('finance_transactions_v2', JSON.stringify(updatedTrxList));

          // Simpan Update Saldo ke LocalStorage Akun
          const savedAcc = localStorage.getItem('finance_accounts_v3');
          let newBalance = account.balance;
          if (savedAcc) {
            const parsedAcc = JSON.parse(savedAcc);
            const accIndex = parsedAcc.findIndex((a: any) => a.id === account.id);
            if (accIndex > -1) {
              parsedAcc[accIndex].balance += net; // Tambahkan saldo bersih (kotor - pajak)
              newBalance = parsedAcc[accIndex].balance;
            }
            localStorage.setItem('finance_accounts_v3', JSON.stringify(parsedAcc));
          }

          // Update State secara reaktif (Menambahkan : any[] dan : any)
          setAccountTransactions((prev: any[]) => [...prev, newIncomeTrx, newTaxTrx]);
          setAccount((prev: any) => ({ ...prev, balance: newBalance }));
        }
      }
    }
  }, [isLoading, account?.id]); // Bergantung pada account.id agar tidak infinity loop

  // =========================================================================
  // FUNGSI HAPUS AKUN (Dikembalikan)
  // =========================================================================
  const handleDeleteClick = () => {
    if (account && account.balance > 0) openWarning();
    else openConfirm();
  };

  const executeDelete = () => {
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) {
      const parsedAccounts = JSON.parse(savedAccounts);
      localStorage.setItem('finance_accounts_v3', JSON.stringify(parsedAccounts.filter((acc: any) => acc.id !== accountId)));
    }

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    if (savedTransactions) {
      const parsedTransactions = JSON.parse(savedTransactions);
      const updatedTrx = parsedTransactions.filter((trx: any) => {
        if (trx.isDoubleEntry) return trx.debitId !== accountId && trx.creditId !== accountId;
        return trx.accountId !== accountId;
      });
      localStorage.setItem('finance_transactions_v2', JSON.stringify(updatedTrx));
    }

    closeConfirm();
    router.push('/accounts');
  };

  const calculateInterest = () => {
    if (!account || !bankDetails) return { gross: 0, tax: 0, net: 0, taxRate: 0 };
    return computeInterestData(account.balance, bankDetails);
  };

  const displayTransactions = [...accountTransactions].reverse().map((trx) => {
    if (trx.isDoubleEntry) {
      const isIncoming = trx.debitId === accountId;
      const counterpartName = isIncoming ? trx.creditName : trx.debitName;
      const counterpartOwner = isIncoming ? trx.creditOwner : trx.debitOwner;
      const prefix = isIncoming ? 'Dari: ' : 'Ke: ';
      const ownerText = counterpartOwner && counterpartOwner !== 'Global/Eksternal' ? ` (${counterpartOwner})` : '';
      const mainDesc = trx.desc ? `${trx.desc}` : 'Transfer Dana';
      const detailDesc = `${prefix}${counterpartName}${ownerText}`;

      return {
        id: trx.id, date: trx.date, desc: `${mainDesc} — [${detailDesc}]`,
        type: isIncoming ? 'INCOME' : 'EXPENSE', amount: trx.amount,
        image: trx.image
      };
    } else {
      return { 
        id: trx.id, date: trx.date, desc: trx.desc, type: trx.type, amount: trx.amount,
        image: trx.image
      };
    }
  });

  if (isLoading) return <DashboardLayout><Center h="50vh"><Loader color="blue" /></Center></DashboardLayout>;
  if (!account) return <DashboardLayout><Text c="red" ta="center" mt="xl" fw={600}>Akun tidak ditemukan.</Text><Button mt="md" onClick={() => router.push('/accounts')} mx="auto" display="block">Kembali ke Daftar Simpanan</Button></DashboardLayout>;

  return (
    <DashboardLayout>
      <Group mb="lg">
        <Button variant="subtle" color="gray" onClick={() => router.push('/accounts')}>← Kembali</Button>
      </Group>

      <Paper withBorder p="md" radius="md" mb="xl" shadow="xs">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={3}>{account.name}</Title>
            <Text c="dimmed" size="sm" mt={4}>Milik: {account.owner}</Text>
            
            <Group gap="xs" mt="md">
              <Badge color="gray" variant="light" leftSection={<IconBuildingBank size={12}/>}>
                {account.bankName || 'Tidak Ada Bank'}
              </Badge>
              {bankDetails && (
                <Badge color="teal" variant="dot">
                  {bankDetails.tiers && bankDetails.tiers.length > 1 ? 'Bunga Progresif' : 'Bunga Tetap'}
                </Badge>
              )}
            </Group>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Sisa Saldo</Text>
            <Text size="xl" fw={800} c="blue">Rp {account.balance.toLocaleString('id-ID')}</Text>
          </div>
        </Group>

        {bankDetails && (
          <Alert icon={<IconCoin />} color="teal" variant="light" mt="xl" style={{ border: '1px solid var(--mantine-color-teal-3)' }}>
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Text fw={700} size="sm">Pendapatan Bunga Bulan Ini</Text>
                {new Date().getDate() >= 28 ? (
                  <Group gap="xs" mt="xs">
                    <IconCheck size={18} color="teal" />
                    <Text size="sm" c="teal.7" fw={600}>Bunga bulan ini sudah otomatis disetorkan ke saldo Anda!</Text>
                  </Group>
                ) : (
                  <>
                    <Text size="xs" mt={4}>
                      Berdasarkan saldo <b>Rp {account.balance.toLocaleString('id-ID')}</b> saat ini. 
                      Sistem akan otomatis menyetorkan 2 pencatatan (bunga & pajak) pada tanggal 28.
                    </Text>
                    
                    {(() => {
                      const { gross, tax, net, taxRate } = calculateInterest();
                      return (
                        <Stack gap={4} mt="md">
                          <Group justify="space-between" style={{ maxWidth: '350px' }}>
                            <Text size="sm" c="dimmed">Proyeksi Bunga Kotor</Text>
                            <Text size="sm" fw={600}>Rp {gross.toLocaleString('id-ID')}</Text>
                          </Group>
                          <Group justify="space-between" style={{ maxWidth: '350px' }}>
                            <Text size="sm" c="red">Proyeksi Potongan Pajak ({taxRate}%)</Text>
                            <Text size="sm" c="red" fw={600}>- Rp {tax.toLocaleString('id-ID')}</Text>
                          </Group>
                          <Divider my={4} style={{ maxWidth: '350px' }} variant="dashed" />
                          <Group justify="space-between" style={{ maxWidth: '350px' }}>
                            <Text size="md" fw={700} c="teal.7">Proyeksi Bunga Bersih</Text>
                            <Text size="lg" fw={800} c="teal.7">+ Rp {net.toLocaleString('id-ID')}</Text>
                          </Group>
                        </Stack>
                      );
                    })()}
                  </>
                )}
              </div>
            </Group>
          </Alert>
        )}
      </Paper>

      <Group justify="space-between" mb="md">
        <Title order={4}>Riwayat Transaksi</Title>
        <Group>
          <Button color="red" variant="outline" size="sm" onClick={handleDeleteClick}>Hapus Akun</Button>

          <Button color="green" size="sm" onClick={() => router.push(`/accounts/${accountId}/add-transaction`)}>
            + Catat Transaksi
          </Button>
        </Group>
      </Group>

      <Paper withBorder radius="md" p="md">
        {displayTransactions.length > 0 ? (
          <Table verticalSpacing="sm" striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tanggal</Table.Th>
                <Table.Th>Keterangan</Table.Th>
                <Table.Th>Tipe</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Jumlah</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Bukti</Table.Th> 
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {displayTransactions.map((trx) => (
                <Table.Tr key={trx.id}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{trx.date}</Table.Td>
                  <Table.Td>
                    {trx.desc ? (
                      <Text size="sm" c={trx.desc.includes('Otomatis') ? 'teal.6' : undefined} fw={trx.desc.includes('Otomatis') ? 600 : undefined}>
                        {trx.desc}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed" fs="italic">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={trx.type === 'INCOME' ? 'green' : 'red'} variant="light">
                      {trx.type === 'INCOME' ? 'Masuk' : 'Keluar'}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                    <Text c={trx.type === 'INCOME' ? 'green' : 'red'} size="sm" fw={600}>
                      {trx.type === 'INCOME' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    {/* TOMBOL LIHAT GAMBAR */}
                    {trx.image ? (
                      <Tooltip label="Lihat Bukti Foto">
                        <Button 
                          variant="light" 
                          size="xs" 
                          color="blue"
                          leftSection={<IconPhoto size={14} />}
                          onClick={() => {
                            setSelectedImage(trx.image);
                            openImageModal();
                          }}
                        >
                          Lihat
                        </Button>
                      </Tooltip>
                    ) : (
                      <Text size="xs" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" fs="italic" ta="center" py="lg">Belum ada transaksi untuk akun ini.</Text>
        )}
      </Paper>

      {/* MODAL UNTUK MELIHAT GAMBAR BUKTI */}
      <Modal opened={imageModalOpened} onClose={closeImageModal} title={<Text fw={700}>Bukti Transaksi</Text>} centered size="lg">
        {selectedImage ? (
          <MantineImage src={selectedImage} alt="Bukti Transaksi" fit="contain" radius="md" />
        ) : (
          <Text c="dimmed" ta="center">Gambar tidak tersedia</Text>
        )}
      </Modal>

      <Modal opened={warningOpened} onClose={closeWarning} title={<Text fw={700} c="red">Tidak Dapat Menghapus Akun</Text>} centered>
        <Stack>
          <Text size="sm">Anda tidak dapat menghapus <b>{account.name}</b> karena masih memiliki sisa dana sebesar <b>Rp {account.balance.toLocaleString('id-ID')}</b>.</Text>
          <Text size="sm">Harap kosongkan saldo terlebih dahulu sebelum menghapus akun ini.</Text>
          <Button onClick={closeWarning} fullWidth mt="sm">Saya Mengerti</Button>
        </Stack>
      </Modal>

      <Modal opened={confirmOpened} onClose={closeConfirm} title={<Text fw={700} c="red">Konfirmasi Hapus Akun</Text>} centered>
        <Stack>
          <Text size="sm">Apakah Anda yakin ingin menghapus <b>{account.name}</b> secara permanen?</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeConfirm}>Batal</Button>
            <Button color="red" onClick={executeDelete}>Ya, Hapus Akun</Button>
          </Group>
        </Stack>
      </Modal>
    </DashboardLayout>
  );
}