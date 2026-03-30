'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Group, Button, Paper, Text, Table, Badge, Center, Loader, Modal, Stack, Alert, NumberInput, Image as MantineImage, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuildingBank, IconCoin, IconInfoCircle, IconPhoto } from '@tabler/icons-react';

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
  const [taxModalOpened, { open: openTaxModal, close: closeTaxModal }] = useDisclosure(false);
  
  // STATE BARU UNTUK PREVIEW GAMBAR
  const [imageModalOpened, { open: openImageModal, close: closeImageModal }] = useDisclosure(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // State Input Pajak Manual
  const [taxAmount, setTaxAmount] = useState<number | ''>('');

  useEffect(() => {
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    let currentAcc = null;
    if (savedAccounts) {
      const parsedAccounts = JSON.parse(savedAccounts);
      currentAcc = parsedAccounts.find((acc: any) => acc.id === accountId);
      setAccount(currentAcc);
    }

    if (currentAcc && currentAcc.bankName) {
      const savedBanks = localStorage.getItem('finance_master_banks');
      if (savedBanks) {
        const parsedBanks = JSON.parse(savedBanks);
        const matchedBank = parsedBanks.find((b: any) => b.name === currentAcc.bankName);
        if (matchedBank) setBankDetails(matchedBank);
      }
    }

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    if (savedTransactions) {
      const parsedTransactions = JSON.parse(savedTransactions);
      const filtered = parsedTransactions.filter((trx: any) => {
        if (trx.isDoubleEntry) return trx.debitId === accountId || trx.creditId === accountId;
        return trx.accountId === accountId;
      });
      setAccountTransactions(filtered);
    }

    setIsLoading(false);
  }, [accountId]);

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

  const handleSaveTax = () => {
    if (!taxAmount || Number(taxAmount) <= 0) return;
    const amountToDeduct = Number(taxAmount);

    if (amountToDeduct > account.balance) {
      alert("Potongan pajak tidak boleh melebihi sisa saldo!");
      return;
    }

    const newTransactionId = Date.now();
    const today = new Date().toISOString().split('T')[0];

    const newTransaction = {
      id: newTransactionId,
      date: today,
      desc: `Potongan Pajak Bunga / Admin`,
      amount: amountToDeduct,
      isDoubleEntry: true,
      creditId: account.id,
      creditName: account.name,
      creditOwner: account.owner,
      debitId: 'MANUAL',
      debitName: 'Beban Pajak Bunga (Sistem)',
      debitOwner: 'Global/Eksternal',
    };

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    const existingTransactions = savedTransactions ? JSON.parse(savedTransactions) : [];
    localStorage.setItem('finance_transactions_v2', JSON.stringify([...existingTransactions, newTransaction]));

    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) {
      const parsedAccounts = JSON.parse(savedAccounts);
      const updatedAccounts = parsedAccounts.map((acc: any) => {
        if (acc.id === account.id) return { ...acc, balance: acc.balance - amountToDeduct };
        return acc;
      });
      localStorage.setItem('finance_accounts_v3', JSON.stringify(updatedAccounts));
    }

    closeTaxModal();
    setTaxAmount('');
    window.location.reload(); 
  };

  const calculateInterest = () => {
    if (!account || !bankDetails) return 0;
    
    const balance = account.balance;
    let totalInterest = 0;

    if (bankDetails.tiers && bankDetails.tiers.length > 0) {
      const sortedTiers = [...bankDetails.tiers].sort((a, b) => Number(a.minBalance) - Number(b.minBalance));

      for (let i = 0; i < sortedTiers.length; i++) {
        const tier = sortedTiers[i];
        const min = Number(tier.minBalance);
        
        let max;
        if (i + 1 < sortedTiers.length) {
          max = Number(sortedTiers[i + 1].minBalance);
        } else {
          max = tier.maxBalance === '' ? Infinity : Number(tier.maxBalance); 
        }

        const ratePercentage = Number(tier.rate) / 100;
        const effectiveRate = bankDetails.interestPeriod === 'YEAR' ? ratePercentage / 12 : ratePercentage;

        if (balance > min) {
          const chunkEnd = Math.min(balance, max);
          const chunkSize = chunkEnd - min;
          totalInterest += chunkSize * effectiveRate;
        }
      }
    } else {
      const ratePercentage = (bankDetails.interestRate || 0) / 100;
      const effectiveRate = bankDetails.interestPeriod === 'YEAR' ? ratePercentage / 12 : ratePercentage;
      totalInterest = balance * effectiveRate;
    }

    return Math.floor(totalInterest); 
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
        image: trx.image // Pastikan gambar diambil jika ada
      };
    } else {
      return { 
        id: trx.id, date: trx.date, desc: trx.desc, type: trx.type, amount: trx.amount,
        image: trx.image // Pastikan gambar diambil jika ada
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
            <Group justify="space-between" align="center">
              <div>
                <Text fw={700} size="sm">Proyeksi Pendapatan Bunga Bulan Ini</Text>
                <Text size="xs" mt={4}>
                  Berdasarkan saldo <b>Rp {account.balance.toLocaleString('id-ID')}</b> dan struktur bunga <b>{bankDetails.name}</b>. 
                  Sistem akan otomatis menyetorkan bunga bruto pada tgl 28.
                </Text>
                <Text size="lg" fw={800} c="teal.7" mt="xs">
                  + Rp {calculateInterest().toLocaleString('id-ID')} <Text component="span" size="xs" c="dimmed" fw={500}>(Kotor / Sebelum Pajak)</Text>
                </Text>
              </div>
            </Group>
          </Alert>
        )}
      </Paper>

      <Group justify="space-between" mb="md">
        <Title order={4}>Riwayat Transaksi</Title>
        <Group>
          <Button color="red" variant="outline" size="sm" onClick={handleDeleteClick}>Hapus Akun</Button>
          
          <Button color="orange" size="sm" onClick={openTaxModal}>
            - Catat Pajak/Admin
          </Button>

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
                <Table.Th style={{ textAlign: 'center' }}>Bukti</Table.Th> {/* KOLOM BARU */}
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

      <Modal opened={taxModalOpened} onClose={closeTaxModal} title={<Text fw={700} size="lg">Catat Potongan Pajak Bunga</Text>} centered>
        <Stack>
          <Alert icon={<IconInfoCircle size={16}/>} color="blue" variant="light" style={{ border: 'none' }}>
            <Text size="xs">Masukkan nominal pajak (PPh) atau biaya admin bulanan sesuai mutasi bank Anda agar saldo di aplikasi ini sama persis (<em>balance</em>) dengan saldo asli Anda.</Text>
          </Alert>
          <NumberInput label="Nominal Pajak / Potongan" placeholder="Contoh: 1550" min={0} hideControls prefix="Rp " thousandSeparator="." decimalSeparator="," value={taxAmount} onChange={(val) => setTaxAmount(val === '' ? '' : Number(val))} data-autofocus required />
          <Button color="orange" onClick={handleSaveTax} fullWidth mt="md">Simpan Potongan</Button>
        </Stack>
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