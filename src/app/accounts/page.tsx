'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Group, Button, SimpleGrid, Card, Text, Badge, Progress, Tabs, TextInput, Pagination, Stack, ThemeIcon } from '@mantine/core';
import { IconBuildingBank } from '@tabler/icons-react';

// Fungsi penentu warna badge
const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'darurat': return 'red';
    case 'bisnis': return 'dark';
    case 'keperluan': return 'orange';
    case 'belanjaan': return 'yellow';
    case 'tujuan': return 'teal';
    case 'hobi': return 'grape';
    case 'pribadi': return 'blue';
    default: return 'gray';
  }
};

// ==========================================
// DATA DEFAULT DIPERBARUI: Ditambahkan `bankName` 
// yang sesuai dengan format Master Produk Bank
// ==========================================
const defaultAccounts = [
  { id: 1, name: 'Dana Darurat', owner: 'Rama Wang', bankName: 'Bank BCA - Tahapan Xpresi', category: 'Darurat', balance: 5000000, target: 0 },
  { id: 2, name: 'Kas Operasional', owner: 'AON10POWERONLIN', bankName: 'Bank Mandiri - Giro Bisnis', category: 'Bisnis', balance: 12500000, target: 0 },
  { id: 3, name: 'Tabungan Pribadi', owner: 'Naoya', bankName: 'Jenius - Flexi Saver', category: 'Pribadi', balance: 3500000, target: 0 },
  { id: 4, name: 'Dana Belanja Bulanan', owner: 'Rama Wang', bankName: 'GoPay - Saldo Utama', category: 'Belanjaan', balance: 1500000, target: 0 },
  { id: 5, name: 'Pembayaran Server/Domain', owner: 'AON10POWERONLIN', bankName: 'Bank Jago - Kantong Terkunci', category: 'Keperluan', balance: 800000, target: 0 },
  { id: 6, name: 'Koleksi Buku Dostoevsky & Kafka', owner: 'Naoya', bankName: 'Seabank - Kantong Hobi', category: 'Hobi', balance: 450000, target: 1000000 },
  { id: 7, name: 'Tabungan Liburan ke Jepang', owner: 'Naoya', bankName: 'Bank Jago - Kantong Utama', category: 'Tujuan', balance: 5000000, target: 25000000 },
];

const ITEMS_PER_PAGE = 6; 

export default function AccountsPage() {
  const router = useRouter();
  
  const [accounts, setAccounts] = useState<any[]>(defaultAccounts);
  const [activeTab, setActiveTab] = useState<string | null>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem('finance_accounts_v3');
    if (saved) {
      setAccounts(JSON.parse(saved));
    } else {
      localStorage.setItem('finance_accounts_v3', JSON.stringify(defaultAccounts));
      setAccounts(defaultAccounts);
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const uniqueCategories = Array.from(new Set(accounts.map((acc) => acc.category)));
  const tabList = ['Semua', ...uniqueCategories];

  const filteredAccounts = accounts.filter((acc) => {
    const matchesCategory = activeTab === 'Semua' || acc.category === activeTab;
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      acc.owner.toLowerCase().includes(query) || 
      acc.name.toLowerCase().includes(query) ||
      (acc.bankName && acc.bankName.toLowerCase().includes(query)); // Pencarian kini juga mencari berdasarkan nama bank
    return matchesCategory && matchesSearch;
  });

  const totalPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE);
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <DashboardLayout>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Daftar Simpanan</Title>
        <Button color="blue" onClick={() => router.push('/accounts/add')}>
          + Tambah Simpanan
        </Button>
      </Group>

      <TextInput
        placeholder="Cari nama simpanan, pemilik, atau bank..."
        mb="md"
        size="md"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
      />

      <Tabs value={activeTab} onChange={setActiveTab} mb="xl">
        <Tabs.List>
          {tabList.map((tabName) => (
            <Tabs.Tab key={tabName} value={tabName}>
              {tabName}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {paginatedAccounts.map((account) => {
          const progressPercent = account.target > 0 
            ? Math.min((account.balance / account.target) * 100, 100) 
            : 0;

          return (
            <Card 
              key={account.id} 
              shadow="sm" 
              padding="lg" 
              radius="md" 
              withBorder
              onClick={() => router.push(`/accounts/${account.id}`)}
              style={{ cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Group justify="space-between" mb="xs" align="flex-start">
                <div style={{ flex: 1, paddingRight: '1rem' }}>
                  <Text fw={700} size="lg" lh={1.2}>
                    {account.name}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4} fw={500}>
                    Pemilik: {account.owner}
                  </Text>
                </div>
                <Badge color={getCategoryColor(account.category)} variant="light">
                  {account.category}
                </Badge>
              </Group>

              {/* TAMPILAN BANK BARU: Tampil rapi di bawah nama pemilik */}
              <Group gap="xs" mb="lg">
                <ThemeIcon size="sm" variant="light" color="gray" radius="xl">
                  <IconBuildingBank size={12} />
                </ThemeIcon>
                <Text size="xs" fw={600} c="dimmed">
                  {account.bankName || 'Bank Belum Diatur'}
                </Text>
              </Group>

              <div style={{ marginTop: 'auto' }}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Simpanan
                </Text>
                <Text size="xl" fw={800} c="blue">
                  Rp {account.balance.toLocaleString('id-ID')}
                </Text>

                {account.target > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <Group justify="space-between" mb={5}>
                      <Text size="xs" c="dimmed">Progress</Text>
                      <Text size="xs" fw={500}>{progressPercent.toFixed(0)}%</Text>
                    </Group>
                    <Progress 
                      value={progressPercent} 
                      color={getCategoryColor(account.category)} 
                      radius="xl" 
                      size="sm" 
                    />
                    <Text size="xs" c="dimmed" mt={5} ta="right">
                      Target: Rp {account.target.toLocaleString('id-ID')}
                    </Text>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </SimpleGrid>

      {totalPages > 1 && (
        <Group justify="center" mt="xl">
          <Pagination 
            total={totalPages} 
            value={currentPage} 
            onChange={setCurrentPage} 
            color="blue" 
            radius="md"
            withEdges
          />
        </Group>
      )}

      {filteredAccounts.length === 0 && (
        <Text c="dimmed" fs="italic" mt="md" ta="center">
          Tidak ada simpanan yang cocok dengan pencarian atau kategori ini.
        </Text>
      )}
    </DashboardLayout>
  );
}