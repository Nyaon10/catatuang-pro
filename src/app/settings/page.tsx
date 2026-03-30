'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Text, Group, Button, Stack, Alert, Modal, FileButton, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  
  const [resetOpened, { open: openReset, close: closeReset }] = useDisclosure(false);
  const [restoreOpened, { open: openRestore, close: closeRestore }] = useDisclosure(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleExportData = () => {
    try {
      const accounts = localStorage.getItem('finance_accounts_v3') || '[]';
      const transactions = localStorage.getItem('finance_transactions_v2') || '[]';

      const backupData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        accounts: JSON.parse(accounts),
        transactions: JSON.parse(transactions)
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Backup_Keuangan_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert('Terjadi kesalahan saat mengekspor data.');
    }
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      openRestore(); 
    }
  };

  const executeRestore = () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);

        if (parsedData.accounts && parsedData.transactions) {
          localStorage.setItem('finance_accounts_v3', JSON.stringify(parsedData.accounts));
          localStorage.setItem('finance_transactions_v2', JSON.stringify(parsedData.transactions));
          
          alert('Data berhasil dipulihkan! Halaman akan dimuat ulang.');
          window.location.reload();
        } else {
          alert('File tidak valid! Pastikan Anda mengunggah file Backup (.json) yang benar.');
          closeRestore();
        }
      } catch (error) {
        alert('Gagal membaca file. Pastikan format file adalah JSON.');
        closeRestore();
      }
    };
    reader.readAsText(selectedFile);
  };

  const executeReset = () => {
    localStorage.removeItem('finance_accounts_v3');
    localStorage.removeItem('finance_transactions_v2');
    alert('Seluruh data telah dihapus.');
    window.location.href = '/'; 
  };

  return (
    <DashboardLayout>
      <Title order={2} mb="lg">Pengaturan Sistem</Title>

      <Stack gap="xl" maw={800}>
        
        {/* --- BAGIAN MANAJEMEN DATA --- */}
        <Paper withBorder p="xl" radius="md" shadow="sm">
          <Group mb="md" align="center">
            <Title order={4}>Manajemen Data & Backup</Title>
            <Badge color="blue" variant="light">Penting</Badge>
          </Group>
          <Text c="dimmed" size="sm" mb="xl">
            Karena aplikasi ini berjalan di browser Anda (tanpa server awan), sangat disarankan untuk melakukan backup data secara berkala.
          </Text>

          <Stack gap="md">
            <Group justify="space-between" align="center" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', paddingBottom: '1rem' }}>
              <div>
                <Text fw={600}>Ekspor Data (Backup)</Text>
                <Text size="sm" c="dimmed">Unduh seluruh data akun dan transaksi Anda ke dalam file .json</Text>
              </div>
              <Button color="blue" onClick={handleExportData}>
                Download Backup
              </Button>
            </Group>

            <Group justify="space-between" align="center" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', paddingBottom: '1rem' }}>
              <div>
                <Text fw={600}>Impor Data (Restore)</Text>
                <Text size="sm" c="dimmed">Pulihkan data dari file backup .json yang pernah Anda unduh sebelumnya.</Text>
              </div>
              <FileButton onChange={handleFileSelect} accept="application/json">
                {(props) => <Button {...props} color="teal" variant="light">Upload & Restore</Button>}
              </FileButton>
            </Group>
          </Stack>
        </Paper>

        {/* --- BAGIAN ZONA BERBAHAYA --- */}
        <Paper withBorder p="xl" radius="md" shadow="sm" style={{ borderColor: 'var(--mantine-color-red-3)' }}>
          <Group mb="md">
            <Title order={4} c="red.7">Zona Berbahaya</Title>
          </Group>
          <Text c="dimmed" size="sm" mb="xl">
            Tindakan di bawah ini tidak dapat dibatalkan. Pastikan Anda telah melakukan backup sebelum mengeksekusinya.
          </Text>

          <Group justify="space-between" align="center">
            <div>
              <Text fw={600} c="red.7">Reset Seluruh Aplikasi</Text>
              <Text size="sm" c="dimmed">Hapus semua dompet, akun, pemilik, dan riwayat jurnal umum secara permanen.</Text>
            </div>
            <Button color="red" onClick={openReset}>
              Reset Data
            </Button>
          </Group>
        </Paper>

      </Stack>

      <Modal opened={restoreOpened} onClose={() => { closeRestore(); setSelectedFile(null); }} title={<Text fw={700} c="teal.7">Konfirmasi Pemulihan Data</Text>} centered>
        <Stack>
          <Alert color="orange" title="Peringatan Timpa Data!">
            Tindakan ini akan <b>MENGHAPUS</b> data Anda yang ada saat ini dan menggantinya dengan data dari file backup: 
            <br/><br/>
            <i>{selectedFile?.name}</i>
          </Alert>
          <Text size="sm">Apakah Anda yakin ingin melanjutkan proses pemulihan (restore) ini?</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { closeRestore(); setSelectedFile(null); }}>Batal</Button>
            <Button color="teal" onClick={executeRestore}>Ya, Pulihkan Data</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={resetOpened} onClose={closeReset} title={<Text fw={700} c="red.7">Konfirmasi Reset Pabrik</Text>} centered>
        <Stack>
          <Alert color="red" title="Peringatan Kritis!" variant="filled">
            Seluruh data pembukuan Anda akan lenyap tanpa sisa.
          </Alert>
          <Text size="sm">Apakah Anda benar-benar yakin ingin menghapus <b>semua</b> data dari browser ini?</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeReset}>Batal</Button>
            <Button color="red" onClick={executeReset}>Ya, Hapus Semua</Button>
          </Group>
        </Stack>
      </Modal>

    </DashboardLayout>
  );
}