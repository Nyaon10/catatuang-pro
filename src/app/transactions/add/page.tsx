'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Button, TextInput, NumberInput, Stack, Group, Text, Autocomplete, Center, Loader, Alert, Select, Divider, Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';

const STANDARD_ACCOUNTS = ['Beban Gaji', 'Beban Sewa', 'Beban Pajak', 'Pendapatan Bunga', 'Pendapatan Usaha', 'Piutang Karyawan', 'Utang Usaha', 'Beban Lain-lain', 'Pendapatan Lain-lain'];

export default function AddDoubleEntryTransaction() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]); 
  const [uniqueOwners, setUniqueOwners] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Menghitung Total Saldo Tabungan (Pokok)
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // 2. Menghitung Total "Uang Bebas / Kas Global" yang Akurat
  let globalAvailableBalance = 0;
  transactions.forEach(trx => {
    if (trx.isDoubleEntry && (trx.debitOwner === 'Global/Eksternal' || trx.creditOwner === 'Global/Eksternal')) {
      const debitName = (trx.debitName || '').toLowerCase();
      const creditName = (trx.creditName || '').toLowerCase();
      
      // Jika Kas Global di-Debit -> Uang Bebas Bertambah
      // ATAU Jika Beban Pajak (Sistem) di-Debit (Pajak dari dompet) -> Kas Global harus berkurang (jadi hitung negatif)
      if (debitName.includes('kas global')) {
        globalAvailableBalance += trx.amount;
      } else if (debitName.includes('beban pajak')) {
        globalAvailableBalance -= trx.amount;
      }
      
      // Jika Kas Global di-Kredit -> Uang Bebas Berkurang
      // ATAU Jika Pendapatan Bunga (Sistem) di-Kredit (Bunga dari dompet) -> Kas Global Bertambah
      if (creditName.includes('kas global')) {
        globalAvailableBalance -= trx.amount;
      } else if (creditName.includes('pendapatan bunga')) {
        globalAvailableBalance += trx.amount;
      }
    }
  });

  useEffect(() => {
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) {
      const parsedAccounts = JSON.parse(savedAccounts);
      setAccounts(parsedAccounts);
      const owners = Array.from(new Set(parsedAccounts.map((acc: any) => (acc.owner || '').trim()))).filter(Boolean) as string[];
      setUniqueOwners(owners.filter(o => o !== 'MANUAL'));
    }

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));

    setIsLoading(false);
  }, []);

  // ==============================================================
  // FORM 1: JURNAL STANDAR (Transaksi Antar Akun / Internal)
  // ==============================================================
  const form = useForm({
    initialValues: {
      date: new Date().toLocaleDateString('en-CA'),
      debitOwner: '',
      debitAccount: '',
      creditOwner: '',
      creditAccount: '',
      amount: 0,
      desc: '',
    },
    validate: {
      date: (value) => (!value ? 'Tanggal wajib diisi' : null),
      debitOwner: (value) => (!value ? 'Pilih kelompok pemilik' : null),
      debitAccount: (value) => (!value ? 'Akun Debit wajib diisi' : null),
      creditOwner: (value) => (!value ? 'Pilih kelompok pemilik' : null),
      creditAccount: (value, values) => {
        if (!value) return 'Akun Kredit wajib diisi';
        if (value === values.debitAccount && values.creditOwner === values.debitOwner) {
          return 'Akun Kredit tidak boleh sama dengan Akun Debit';
        }
        return null;
      },
      amount: (value) => (value <= 0 ? 'Nominal harus lebih dari 0' : null),
    },
  });

  const handleStandardSubmit = (values: typeof form.values) => {
    const debitObj = values.debitOwner !== 'MANUAL' ? accounts.find(a => (a.owner || '').trim() === values.debitOwner && (a.name || '').trim() === values.debitAccount) : null;
    const creditObj = values.creditOwner !== 'MANUAL' ? accounts.find(a => (a.owner || '').trim() === values.creditOwner && (a.name || '').trim() === values.creditAccount) : null;

    if (creditObj && values.amount > creditObj.balance) {
      form.setFieldError('amount', `Saldo tidak mencukupi (Sisa: Rp ${creditObj.balance.toLocaleString('id-ID')})`);
      return;
    }

    let updatedAccounts = [...accounts];
    if (debitObj) updatedAccounts = updatedAccounts.map(a => a.id === debitObj.id ? { ...a, balance: a.balance + values.amount } : a);
    if (creditObj) updatedAccounts = updatedAccounts.map(a => a.id === creditObj.id ? { ...a, balance: a.balance - values.amount } : a);
    localStorage.setItem('finance_accounts_v3', JSON.stringify(updatedAccounts));

    const newTrx = {
      id: Date.now(), date: values.date, desc: values.desc.trim(), amount: values.amount, isDoubleEntry: true,
      debitName: debitObj ? debitObj.name : values.debitAccount, debitOwner: debitObj ? debitObj.owner : null, debitId: debitObj ? debitObj.id : 'MANUAL',
      creditName: creditObj ? creditObj.name : values.creditAccount, creditOwner: creditObj ? creditObj.owner : null, creditId: creditObj ? creditObj.id : 'MANUAL',
    };
    saveTransaction(newTrx);
  };

  // ==============================================================
  // FORM 2: JURNAL GLOBAL & EKSTERNAL (Pemasukan, Gaji, Web)
  // ==============================================================
  const globalForm = useForm({
    initialValues: {
      date: new Date().toLocaleDateString('en-CA'),
      type: 'PENDAPATAN_LAIN', // Default awal diubah
      amount: 0,
      desc: '',
    }
  });

  const handleGlobalSubmit = (values: typeof globalForm.values) => {
    let finalAmount = values.amount;

    if (finalAmount <= 0) {
      alert("Nominal transaksi harus lebih dari 0!");
      return;
    }

    // PROTEKSI DANA POKOK: Pengeluaran TIDAK BOLEH melebihi Kas Global
    const expenseTypes = ['GAJI_KARYAWAN', 'GAJI_OWNER', 'BIAYA_WEB', 'BEBAN_LAIN'];
    if (expenseTypes.includes(values.type) && finalAmount > globalAvailableBalance) {
      globalForm.setFieldError('amount', `Ditolak! Kas Global tidak cukup. (Tersedia: Rp ${globalAvailableBalance.toLocaleString('id-ID')})`);
      return;
    }

    let debitName = '';
    let creditName = '';
    let defaultDesc = values.desc.trim();

    switch (values.type) {
      case 'PENDAPATAN_LAIN':
        debitName = 'Kas Global'; 
        creditName = 'Pendapatan Lain-lain';
        if (!defaultDesc) defaultDesc = 'Pemasukan Eksternal';
        break;
      case 'GAJI_KARYAWAN':
        debitName = 'Beban Gaji Karyawan';
        creditName = 'Kas Global'; 
        if (!defaultDesc) defaultDesc = 'Pembayaran Gaji Karyawan';
        break;
      case 'GAJI_OWNER': 
        debitName = 'Beban Gaji Owner (Prive)';
        creditName = 'Kas Global'; 
        if (!defaultDesc) defaultDesc = 'Pencairan Gaji Owner';
        break;
      case 'BIAYA_WEB': 
        debitName = 'Beban Biaya Server/Web';
        creditName = 'Kas Global'; 
        if (!defaultDesc) defaultDesc = 'Pembayaran Biaya Hosting & Domain';
        break;
      case 'BEBAN_LAIN':
        debitName = 'Beban Lain-lain';
        creditName = 'Kas Global'; 
        if (!defaultDesc) defaultDesc = 'Pengeluaran Eksternal';
        break;
    }

    const newTrx = {
      id: Date.now(), date: values.date, desc: defaultDesc, amount: finalAmount, isDoubleEntry: true,
      debitName: debitName, debitOwner: 'Global/Eksternal', debitId: 'MANUAL',
      creditName: creditName, creditOwner: 'Global/Eksternal', creditId: 'MANUAL',
    };

    saveTransaction(newTrx);
  };

  const saveTransaction = (newTrx: any) => {
    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    const existingTransactions = savedTransactions ? JSON.parse(savedTransactions) : [];
    localStorage.setItem('finance_transactions_v2', JSON.stringify([...existingTransactions, newTrx]));
    router.push('/transactions');
  };

  const ownerOptions = [
    { value: 'MANUAL', label: '--- Akun Eksternal / Manual ---' },
    ...uniqueOwners.map(owner => ({ value: owner, label: `Pemilik: ${owner}` }))
  ];

  const getAccountOptions = (ownerValue: string) => {
    if (!ownerValue || ownerValue === 'MANUAL') return [];
    const ownerAccounts = accounts.filter(acc => (acc.owner || '').trim() === ownerValue);
    const uniqueAccountNames = Array.from(new Set(ownerAccounts.map(acc => (acc.name || '').trim())));
    return uniqueAccountNames.map(name => ({ value: name, label: name }));
  };

  if (isLoading) return <DashboardLayout><Center h="50vh"><Loader color="blue" /></Center></DashboardLayout>;

  return (
    <DashboardLayout>
      <Group mb="lg">
        <Button variant="subtle" color="gray" onClick={() => router.push('/transactions')}>
          ← Kembali ke Jurnal
        </Button>
      </Group>

      <Paper withBorder radius="md" maw={700} mx="auto" shadow="sm">
        <Tabs defaultValue="standard" color="blue" radius="md">
          <Tabs.List grow>
            <Tabs.Tab value="standard" p="md"><Text fw={600}>Jurnal Standar (Dompet)</Text></Tabs.Tab>
            <Tabs.Tab value="global" p="md"><Text fw={600} c="grape">Transaksi Global & Eksternal</Text></Tabs.Tab>
          </Tabs.List>

          {/* ===================== TAB 1: JURNAL STANDAR ===================== */}
          <Tabs.Panel value="standard" p="xl">
            <Text c="dimmed" size="sm" mb="xl">Catat transaksi dari/ke akun simpanan yang sudah Anda daftarkan.</Text>
            <form onSubmit={form.onSubmit(handleStandardSubmit)}>
              <Stack>
                <TextInput type="date" label="Tanggal Transaksi" required maw={300} {...form.getInputProps('date')} />

                <Divider my="sm" label={<Text fw={700} c="blue">Sisi Debit (Uang Masuk / Aset Bertambah)</Text>} labelPosition="left" />
                <Group grow align="flex-start">
                  <Select label="1. Pemilik" placeholder="Pilih pemilik" data={ownerOptions} required {...form.getInputProps('debitOwner')} onChange={(val) => { form.setFieldValue('debitOwner', val || ''); form.setFieldValue('debitAccount', ''); }} />
                  {form.values.debitOwner === 'MANUAL' ? (
                    <Autocomplete label="2. Nama Akun Manual" placeholder="Ketik: Beban Gaji" data={STANDARD_ACCOUNTS} required {...form.getInputProps('debitAccount')} />
                  ) : (
                    <Select label="2. Akun Simpanan" placeholder="Pilih akun..." data={getAccountOptions(form.values.debitOwner)} disabled={!form.values.debitOwner} required searchable {...form.getInputProps('debitAccount')} />
                  )}
                </Group>

                <Divider my="sm" label={<Text fw={700} c="red">Sisi Kredit (Sumber Dana / Uang Keluar)</Text>} labelPosition="left" />
                <Group grow align="flex-start">
                  <Select label="1. Pemilik" placeholder="Pilih pemilik" data={ownerOptions} required {...form.getInputProps('creditOwner')} onChange={(val) => { form.setFieldValue('creditOwner', val || ''); form.setFieldValue('creditAccount', ''); }} />
                  {form.values.creditOwner === 'MANUAL' ? (
                    <Autocomplete label="2. Nama Akun Manual" placeholder="Ketik: Pendapatan Bunga" data={STANDARD_ACCOUNTS} required {...form.getInputProps('creditAccount')} />
                  ) : (
                    <Select label="2. Akun Simpanan" placeholder="Pilih akun..." data={getAccountOptions(form.values.creditOwner)} disabled={!form.values.creditOwner} required searchable {...form.getInputProps('creditAccount')} />
                  )}
                </Group>

                <Divider my="xs" />
                <NumberInput label="Nominal (Rp)" placeholder="0" hideControls min={0} size="lg" required {...form.getInputProps('amount')} />
                <TextInput label="Keterangan" placeholder="Contoh: Bayar listrik" required {...form.getInputProps('desc')} />
                
                <Group justify="flex-end" mt="md">
                  <Button type="submit" color="blue" size="md">Simpan Jurnal Standar</Button>
                </Group>
              </Stack>
            </form>
          </Tabs.Panel>

          {/* ===================== TAB 2: JURNAL GLOBAL / EKSTERNAL ===================== */}
          <Tabs.Panel value="global" p="xl">
            <Alert variant="light" color="grape" mb="lg">
              Operasional Global <b>HANYA</b> bisa dibayar menggunakan saldo "Kas Global" (Pendapatan Bunga/Eksternal). Tabungan Pokok Anda tidak akan tersentuh.
            </Alert>

            <Group grow mb="xl">
              <Paper withBorder p="md" bg="gray.0" style={{ borderColor: '#e9ecef' }}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">Saldo Pokok (Tidak bisa disentuh)</Text>
                <Text fw={800} size="lg" c="gray.7">Rp {totalBalance.toLocaleString('id-ID')}</Text>
              </Paper>
              <Paper withBorder p="md" bg="grape.0" style={{ borderColor: 'var(--mantine-color-grape-2)' }}>
                <Text size="xs" tt="uppercase" fw={700} c="grape.9">Saldo Kas Global (Bisa Dipakai)</Text>
                <Text fw={800} size="lg" c={globalAvailableBalance >= 0 ? 'grape.9' : 'red.6'}>
                  Rp {globalAvailableBalance.toLocaleString('id-ID')}
                </Text>
              </Paper>
            </Group>

            <form onSubmit={globalForm.onSubmit(handleGlobalSubmit)}>
              <Stack>
                <TextInput type="date" label="Tanggal Transaksi" required maw={300} {...globalForm.getInputProps('date')} />

                <Select
                  label="Jenis Transaksi Khusus"
                  description="Pilih skenario akuntansi eksternal"
                  data={[
                    // Group Pemasukan
                    { group: 'Arus Masuk (Menambah Kas Global)', items: [
                      { value: 'PENDAPATAN_LAIN', label: 'Terima Pemasukan Lainnya' },
                    ]},
                    // Group Pengeluaran
                    { group: 'Arus Keluar (Memotong Kas Global)', items: [
                      { value: 'GAJI_KARYAWAN', label: 'Bayar Gaji Karyawan' },
                      { value: 'GAJI_OWNER', label: 'Bayar Gaji Owner (Prive)' }, 
                      { value: 'BIAYA_WEB', label: 'Bayar Biaya Server/Web' },  
                      { value: 'BEBAN_LAIN', label: 'Bayar Pengeluaran Lainnya' },
                    ]}
                  ]}
                  required
                  size="md"
                  {...globalForm.getInputProps('type')}
                />

                <NumberInput
                  label="Nominal (Rp)"
                  placeholder="0"
                  hideControls
                  min={0}
                  required
                  {...globalForm.getInputProps('amount')}
                />

                <TextInput
                  label="Keterangan Transaksi"
                  description="Boleh dikosongkan (Sistem akan membuat keterangan otomatis)"
                  placeholder="Ketik keterangan opsional..."
                  {...globalForm.getInputProps('desc')}
                />

                <Group justify="flex-end" mt="md">
                  <Button type="submit" color="grape" size="md">Catat ke Jurnal Eksternal</Button>
                </Group>
              </Stack>
            </form>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </DashboardLayout>
  );
}