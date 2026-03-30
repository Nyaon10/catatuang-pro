'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Button, TextInput, Select, NumberInput, Stack, Group, Text, Center, Loader, FileInput, Image as MantineImage } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconUpload } from '@tabler/icons-react';

export default function AddTransactionPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = Number(params.id);

  const [account, setAccount] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // STATE BARU UNTUK GAMBAR
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) {
      const parsedAccounts = JSON.parse(savedAccounts);
      const foundAccount = parsedAccounts.find((acc: any) => acc.id === accountId);
      setAccount(foundAccount);
    }
    setIsLoading(false);
  }, [accountId]);

  // Validasi yang ditingkatkan
  const form = useForm({
    initialValues: {
      type: 'EXPENSE',
      amount: 0,
      desc: '',
      date: today, 
    },
    validate: {
      amount: (value, values) => {
        if (value <= 0) {
          return 'Masukkan nominal yang valid (> 0)';
        }
        // PROTEKSI REAL-TIME: Cek apakah tipe = Keluar DAN nominal > saldo
        if (account && values.type === 'EXPENSE' && value > account.balance) {
          return `Sisa saldo tidak cukup. Maksimal: Rp ${account.balance.toLocaleString('id-ID')}`;
        }
        return null;
      },
      date: (value) => (!value ? 'Tanggal wajib diisi' : null),
    },
  });

  // FUNGSI KONVERSI GAMBAR (Base64)
  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageBase64(null);
    }
  };

  const handleSubmit = (values: typeof form.values) => {
    // 1. Kalkulasi saldo baru
    const newBalance = values.type === 'INCOME' 
      ? account.balance + values.amount 
      : account.balance - values.amount;

    // 2. Update Akun
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) {
      const parsedAccounts = JSON.parse(savedAccounts);
      const updatedAccounts = parsedAccounts.map((acc: any) => 
        acc.id === accountId ? { ...acc, balance: newBalance } : acc
      );
      localStorage.setItem('finance_accounts_v3', JSON.stringify(updatedAccounts));
    }

    // 3. Simpan Transaksi (Ditambahkan properti image)
    const newTrx = {
      id: Date.now(),
      accountId: accountId,
      date: values.date,
      desc: values.desc.trim(),
      amount: values.amount,
      type: values.type,
      image: imageBase64, // Menyimpan bukti gambar
    };

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    const existingTransactions = savedTransactions ? JSON.parse(savedTransactions) : [];
    const updatedTransactions = [...existingTransactions, newTrx];
    
    localStorage.setItem('finance_transactions_v2', JSON.stringify(updatedTransactions));

    // 4. Kembali ke halaman detail
    router.push(`/accounts/${accountId}`);
  };

  if (isLoading) {
    return <DashboardLayout><Center h="50vh"><Loader color="blue" /></Center></DashboardLayout>;
  }

  if (!account) {
    return (
      <DashboardLayout>
        <Text c="red" ta="center" mt="xl">Akun tidak ditemukan.</Text>
        <Button mt="md" onClick={() => router.push('/accounts')} mx="auto" display="block">Kembali</Button>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Group mb="lg">
        <Button variant="subtle" color="gray" onClick={() => router.push(`/accounts/${accountId}`)}>
          ← Batal & Kembali
        </Button>
      </Group>

      <Paper withBorder p="xl" radius="md" maw={600} mx="auto" shadow="sm">
        <Title order={3} mb="xs">Catat Transaksi</Title>
        <Text c="dimmed" size="sm" mb="xl">
          Pencatatan untuk: <b>{account.name}</b> (Sisa Saldo: Rp {account.balance.toLocaleString('id-ID')})
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Select
              label="Tipe Transaksi"
              data={[
                { value: 'EXPENSE', label: 'Keluar (Pengeluaran)' },
                { value: 'INCOME', label: 'Masuk (Pemasukan)' },
              ]}
              required
              {...form.getInputProps('type')}
            />
            
            <NumberInput
              label="Nominal (Rp)"
              placeholder="0"
              hideControls
              min={0}
              max={form.values.type === 'EXPENSE' ? account.balance : undefined}
              required
              {...form.getInputProps('amount')}
            />
            
            <TextInput
              label="Keterangan"
              description="Opsional"
              placeholder="Contoh: Beli makan siang, Gaji bulanan"
              {...form.getInputProps('desc')} 
            />
            
            <TextInput
              type="date"
              label="Tanggal Transaksi"
              description="Sesuaikan jika Anda mencatat transaksi hari sebelumnya"
              required
              {...form.getInputProps('date')}
            />

            {/* FITUR UPLOAD GAMBAR */}
            <FileInput
              label="Bukti / Foto (Opsional)"
              description="Upload struk transaksi atau nota pembayaran (Saran: Maks 2MB)"
              placeholder="Pilih file gambar..."
              accept="image/png,image/jpeg,image/jpg"
              leftSection={<IconUpload size={16} />}
              value={imageFile}
              onChange={handleImageChange}
              clearable
            />

            {/* PREVIEW GAMBAR */}
            {imageBase64 && (
              <MantineImage 
                radius="md" 
                src={imageBase64} 
                alt="Preview Bukti" 
                mt="sm" 
                mah={200} 
                fit="contain" 
              />
            )}
            
            <Group justify="flex-end" mt="md">
              <Button type="submit" color="green">Simpan Transaksi</Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </DashboardLayout>
  );
}