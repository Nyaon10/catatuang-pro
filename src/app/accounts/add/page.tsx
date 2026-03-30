'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Button, TextInput, Select, NumberInput, Stack, Group, Text, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconInfoCircle } from '@tabler/icons-react';

export default function AddAccountPage() {
  const router = useRouter();
  
  // State Data Master
  const [ownerOptions, setOwnerOptions] = useState<{value: string, label: string}[]>([]);
  const [bankData, setBankData] = useState<any[]>([]); // Menyimpan seluruh data bank
  
  const [rawOwners, setRawOwners] = useState<string[]>([]);
  const [rawBanks, setRawBanks] = useState<string[]>([]); // Untuk validasi gabungan nama bank
  
  const [isMasterLoaded, setIsMasterLoaded] = useState(false);

  useEffect(() => {
    // 1. Load Master Pemilik
    const savedOwners = localStorage.getItem('finance_master_owners');
    if (savedOwners) {
      const parsedOwners = JSON.parse(savedOwners);
      setOwnerOptions(parsedOwners.map((owner: any) => ({ value: owner.name, label: owner.name })));
      setRawOwners(parsedOwners.map((owner: any) => owner.name));
    }

    // 2. Load Master Bank / Produk
    const savedBanks = localStorage.getItem('finance_master_banks');
    if (savedBanks) {
      const parsedBanks = JSON.parse(savedBanks);
      setBankData(parsedBanks);
      setRawBanks(parsedBanks.map((bank: any) => bank.name));
    }

    setIsMasterLoaded(true);
  }, []);

  const form = useForm({
    initialValues: {
      name: '',
      owner: '',
      baseBankName: '', // BARU: Menyimpan Bank Induk sementara
      productName: '',  // BARU: Menyimpan Tipe Kantong sementara
      category: '',
      balance: 0,
      target: 0,
      desc: '', 
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Nama simpanan terlalu pendek' : null),
      owner: (value) => {
        if (!value) return 'Pilih pemilik dari daftar';
        if (!rawOwners.includes(value)) return 'Nama pemilik tidak valid!';
        return null;
      },
      baseBankName: (value) => (!value ? 'Pilih institusi bank' : null),
      productName: (value) => (!value ? 'Pilih tipe rekening / kantong' : null),
      category: (value) => (!value ? 'Pilih kategori' : null),
      balance: (value) => 
        (value === undefined || value === null || value < 0) 
          ? 'Saldo awal tidak boleh kosong atau minus' 
          : null,
      target: (value, values) => 
        (['Hobi', 'Tujuan'].includes(values.category) && (value === undefined || value === null || value <= 0))
          ? 'Target saldo harus lebih dari 0'
          : null,
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    // Gabungkan nama bank seperti format di Master Data
    const combinedBankName = `${values.baseBankName} - ${values.productName}`;

    // PENGAMANAN GANDA
    if (!rawOwners.includes(values.owner)) {
      return alert("FATAL ERROR: Pemilik yang dipilih tidak terdaftar di Data Master!");
    }
    if (!rawBanks.includes(combinedBankName)) {
      return alert(`FATAL ERROR: Produk Bank "${combinedBankName}" tidak ditemukan di Data Master!`);
    }

    const newAccountId = Date.now(); 

    // --- 1. PROSES SIMPAN AKUN ---
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    const existingAccounts = savedAccounts ? JSON.parse(savedAccounts) : [];

    const isTargetNeeded = ['Hobi', 'Tujuan'].includes(values.category);
    const finalTarget = isTargetNeeded ? values.target : 0;

    const newAccount = {
      id: newAccountId,
      name: values.name.trim(),
      owner: values.owner,
      bankName: combinedBankName, // Simpan sebagai gabungan agar kompatibel dengan tabel
      category: values.category,
      balance: values.balance,
      target: finalTarget,
    };

    const updatedAccounts = [...existingAccounts, newAccount];
    localStorage.setItem('finance_accounts_v3', JSON.stringify(updatedAccounts));

    // --- 2. PROSES SIMPAN TRANSAKSI OTOMATIS ---
    if (values.balance > 0) {
      const savedTransactions = localStorage.getItem('finance_transactions_v2');
      const existingTransactions = savedTransactions ? JSON.parse(savedTransactions) : [];
      
      const today = new Date().toISOString().split('T')[0];
      const finalDesc = values.desc.trim() !== '' ? values.desc.trim() : 'Saldo Awal';

      const initialTransaction = {
        id: Date.now() + 1, 
        accountId: newAccountId, 
        date: today,
        desc: finalDesc,
        amount: values.balance,
        type: 'INCOME'
      };

      const updatedTransactions = [...existingTransactions, initialTransaction];
      localStorage.setItem('finance_transactions_v2', JSON.stringify(updatedTransactions));
    }

    router.push('/accounts');
  };

  // ==========================================
  // LOGIKA DROPDOWN DINAMIS UNTUK BANK
  // ==========================================
  // 1. Ambil daftar Bank Induk unik (tanpa duplikat)
  const baseBankOptions = Array.from(
    new Set(bankData.map(b => b.baseBankName || b.name.split(' - ')[0]))
  ).map(name => ({ value: name, label: name }));

  // 2. Ambil daftar Produk hanya dari Bank Induk yang dipilih pengguna
  const productOptions = form.values.baseBankName
    ? bankData
        .filter(b => (b.baseBankName || b.name.split(' - ')[0]) === form.values.baseBankName)
        .map(b => {
          const prodName = b.productName || b.name.split(' - ')[1] || 'Standar';
          return { value: prodName, label: prodName };
        })
    : [];

  const showTargetInput = ['Hobi', 'Tujuan'].includes(form.values.category);
  
  // Cek apakah ada master data yang belum diisi
  const isOwnerEmpty = isMasterLoaded && ownerOptions.length === 0;
  const isBankEmpty = isMasterLoaded && bankData.length === 0;
  const isMasterIncomplete = isOwnerEmpty || isBankEmpty;

  return (
    <DashboardLayout>
      <Group mb="lg">
        <Button variant="subtle" color="gray" onClick={() => router.push('/accounts')}>
          ← Kembali
        </Button>
      </Group>

      <Paper withBorder p="xl" radius="md" maw={600} mx="auto" shadow="sm">
        <Title order={3} mb="md">Buat Simpanan Baru</Title>
        <Text c="dimmed" size="sm" mb="xl">
          Isi detail di bawah ini untuk menambahkan kantong simpanan atau rekening baru.
        </Text>

        {isMasterIncomplete && (
          <Alert icon={<IconInfoCircle />} color="orange" title="Data Master Belum Lengkap!" mb="lg" variant="light">
            Sistem mendeteksi Anda belum memiliki Data Pemilik atau Data Bank. Harap pergi ke menu <b>Data Master</b> terlebih dahulu untuk mendaftarkan data tersebut sebelum membuat dompet.
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput 
              label="Nama Alias Simpanan" 
              placeholder="Contoh: Dana Darurat BCA, Kas Operasional" 
              required 
              {...form.getInputProps('name')} 
            />
            
            <Select
              label="Nama Pemilik Dompet"
              placeholder={isOwnerEmpty ? "Harap isi Data Master dulu" : "Pilih pemilik dari daftar"}
              data={ownerOptions}
              searchable
              required
              disabled={isOwnerEmpty}
              nothingFoundMessage="Nama pemilik tidak ditemukan"
              {...form.getInputProps('owner')}
            />

            {/* DROPDOWN DINAMIS BANK & KANTONG */}
            <Group grow align="flex-start">
              <Select
                label="Institusi Bank Induk"
                placeholder={isBankEmpty ? "Master Bank Kosong" : "Pilih Bank"}
                data={baseBankOptions}
                searchable
                required
                disabled={isBankEmpty}
                nothingFoundMessage="Bank tidak ditemukan"
                {...form.getInputProps('baseBankName')}
                onChange={(val) => {
                  // Jika Bank Induk diubah, reset pilihan Tipe Kantong
                  form.setFieldValue('baseBankName', val || '');
                  form.setFieldValue('productName', '');
                }}
              />
              
              <Select
                label="Tipe Rekening / Kantong"
                placeholder={!form.values.baseBankName ? "Pilih Bank dulu" : "Pilih Tipe Kantong"}
                data={productOptions}
                searchable
                required
                disabled={!form.values.baseBankName || productOptions.length === 0}
                nothingFoundMessage="Tipe tidak ditemukan"
                {...form.getInputProps('productName')}
              />
            </Group>
            
            <Select 
              label="Kategori" 
              placeholder="Pilih kategori" 
              data={['Darurat', 'Bisnis', 'Pribadi', 'Belanjaan', 'Keperluan', 'Hobi', 'Tujuan']} 
              required 
              {...form.getInputProps('category')} 
            />
            
            <NumberInput 
              label="Saldo Awal Saat Ini" 
              placeholder="0" 
              hideControls 
              min={0} 
              prefix="Rp "
              thousandSeparator="."
              decimalSeparator=","
              required 
              {...form.getInputProps('balance')} 
            />

            <TextInput 
              label="Keterangan Saldo Awal" 
              description="Opsional. Jika dikosongkan, akan otomatis menjadi 'Saldo Awal'."
              placeholder="Contoh: Sisa THR tahun lalu" 
              {...form.getInputProps('desc')} 
            />
            
            {showTargetInput && (
              <NumberInput 
                label="Target Saldo (Rp)" 
                description="Tentukan target nominal tabungan Anda" 
                placeholder="0" 
                hideControls 
                min={0}
                prefix="Rp "
                thousandSeparator="."
                decimalSeparator=","
                required 
                {...form.getInputProps('target')} 
              />
            )}
            
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => router.push('/accounts')}>Batal</Button>
              {/* Tombol Simpan akan terkunci jika belum ada Data Master */}
              <Button type="submit" color="blue" disabled={isMasterIncomplete}>Simpan Akun</Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </DashboardLayout>
  );
}