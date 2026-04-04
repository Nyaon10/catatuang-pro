'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Text, Group, Button, Table, ActionIcon, Modal, TextInput, Tabs, Center, Loader, useComputedColorScheme, Stack, Badge, Alert as MantineAlert, NumberInput, Select, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconBuildingBank, IconUsers, IconPlus, IconMail, IconPhone, IconAlertTriangle, IconEdit, IconInfoCircle } from '@tabler/icons-react';

interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface InterestTier {
  id: string;
  minBalance: number | '';
  maxBalance: number | ''; // Kosong = Tidak terhingga
  rate: number | '';
}

interface Bank {
  id: string;
  name: string;
  baseBankName?: string; 
  productName?: string;
  interestPeriod?: 'YEAR' | 'MONTH';
  interestRate?: number; 
  tiers?: InterestTier[];
  taxRate?: number; // <--- PERBAIKAN: Tambahan kolom pajak
}

export default function MastersPage() {
  const theme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDark = theme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  
  const [owners, setOwners] = useState<Owner[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<any[]>([]);

  // ==========================================
  // STATE MODALS & FORM - PEMILIK
  // ==========================================
  const [openedOwner, { open: openOwner, close: closeOwner }] = useDisclosure(false);
  const [deleteOwnerWarningOpened, { open: openDeleteOwnerWarning, close: closeDeleteOwnerWarning }] = useDisclosure(false);
  const [deleteOwnerConfirmOpened, { open: openDeleteOwnerConfirm, close: closeDeleteOwnerConfirm }] = useDisclosure(false);
  
  const [ownerToDelete, setOwnerToDelete] = useState<{ id: string, name: string, count: number } | null>(null);
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);
  const [editingOldOwnerName, setEditingOldOwnerName] = useState<string>('');

  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [ownerErrors, setOwnerErrors] = useState({ name: '', email: '', phone: '' });

  // ==========================================
  // STATE MODALS & FORM - BANK
  // ==========================================
  const [openedBank, { open: openBank, close: closeBank }] = useDisclosure(false);
  const [deleteBankWarningOpened, { open: openDeleteBankWarning, close: closeDeleteBankWarning }] = useDisclosure(false);
  const [deleteBankConfirmOpened, { open: openDeleteBankConfirm, close: closeDeleteBankConfirm }] = useDisclosure(false);

  const [bankToDelete, setBankToDelete] = useState<{ id: string, name: string, count: number } | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingOldBankName, setEditingOldBankName] = useState<string>('');

  const [newBaseBankName, setNewBaseBankName] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newBankInterestPeriod, setNewBankInterestPeriod] = useState<string | null>('YEAR');
  
  // STATE BARU: Pajak Bunga (Default 20%)
  const [newBankTaxRate, setNewBankTaxRate] = useState<number | ''>(20);
  
  const [bankTiers, setBankTiers] = useState<InterestTier[]>([
    { id: Date.now().toString(), minBalance: 0, maxBalance: '', rate: 0 }
  ]);

  const [bankErrors, setBankErrors] = useState({ baseName: '', productName: '', interestPeriod: '', taxRate: '', tiers: '' });

  useEffect(() => {
    const savedOwners = localStorage.getItem('finance_master_owners');
    if (savedOwners) setOwners(JSON.parse(savedOwners));

    const savedBanks = localStorage.getItem('finance_master_banks');
    if (savedBanks) setBanks(JSON.parse(savedBanks));

    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) setActiveAccounts(JSON.parse(savedAccounts));

    setIsLoading(false);
  }, []);

  useEffect(() => { setOwnerErrors({ name: '', email: '', phone: '' }); }, [newOwnerName, newOwnerEmail, newOwnerPhone]);
  useEffect(() => { setBankErrors({ baseName: '', productName: '', interestPeriod: '', taxRate: '', tiers: '' }); }, [newBaseBankName, newProductName, newBankInterestPeriod, newBankTaxRate, bankTiers]);

  // ==========================================
  // FUNGSI CRUD MASTER PEMILIK
  // ==========================================
  const openAddOwnerModal = () => {
    setEditingOwnerId(null);
    setEditingOldOwnerName('');
    setNewOwnerName('');
    setNewOwnerEmail('');
    setNewOwnerPhone('');
    setOwnerErrors({ name: '', email: '', phone: '' });
    openOwner();
  };

  const openEditOwnerModal = (owner: Owner) => {
    setEditingOwnerId(owner.id);
    setEditingOldOwnerName(owner.name); 
    setNewOwnerName(owner.name);
    setNewOwnerEmail(owner.email);
    setNewOwnerPhone(owner.phone);
    setOwnerErrors({ name: '', email: '', phone: '' });
    openOwner();
  };

  const handleSaveOwner = () => {
    const trimmedName = newOwnerName.trim();
    const trimmedEmail = newOwnerEmail.trim();
    const trimmedPhone = newOwnerPhone.trim();
    const errors = { name: '', email: '', phone: '' };
    let hasError = false;

    if (!trimmedName) {
      errors.name = 'Nama lengkap wajib diisi!';
      hasError = true;
    } else if (owners.some(o => o.name.toLowerCase() === trimmedName.toLowerCase() && o.id !== editingOwnerId)) {
      errors.name = `Nama "${trimmedName}" sudah terdaftar.`;
      hasError = true;
    }

    if (!trimmedEmail) {
      errors.email = 'Alamat email wajib diisi!';
      hasError = true;
    } else if (owners.some(o => o.email.toLowerCase() === trimmedEmail.toLowerCase() && o.id !== editingOwnerId)) {
      errors.email = `Email "${trimmedEmail}" sudah dipakai.`;
      hasError = true;
    }

    if (!trimmedPhone) {
      errors.phone = 'Nomor telepon wajib diisi!';
      hasError = true;
    } else if (owners.some(o => o.phone === trimmedPhone && o.id !== editingOwnerId)) {
      errors.phone = `Nomor telepon "${trimmedPhone}" sudah terdaftar.`;
      hasError = true;
    }

    if (hasError) {
      setOwnerErrors(errors);
      return;
    }
    
    let updatedOwners;

    if (editingOwnerId) {
      updatedOwners = owners.map(owner => owner.id === editingOwnerId ? { ...owner, name: trimmedName, email: trimmedEmail, phone: trimmedPhone } : owner);
      if (editingOldOwnerName !== trimmedName) {
        const savedAccounts = localStorage.getItem('finance_accounts_v3');
        if (savedAccounts) {
          const parsedAccounts = JSON.parse(savedAccounts);
          const updatedAccounts = parsedAccounts.map((acc: any) => acc.owner === editingOldOwnerName ? { ...acc, owner: trimmedName } : acc);
          localStorage.setItem('finance_accounts_v3', JSON.stringify(updatedAccounts));
          setActiveAccounts(updatedAccounts);
        }
      }
    } else {
      updatedOwners = [...owners, { id: Date.now().toString(), name: trimmedName, email: trimmedEmail, phone: trimmedPhone }];
    }
    
    setOwners(updatedOwners);
    localStorage.setItem('finance_master_owners', JSON.stringify(updatedOwners));
    closeOwner();
  };

  const handleDeleteOwnerClick = (ownerId: string, ownerName: string) => {
    const linkedAccountsCount = activeAccounts.filter(acc => acc.owner === ownerName).length;
    setOwnerToDelete({ id: ownerId, name: ownerName, count: linkedAccountsCount });
    if (linkedAccountsCount > 0) openDeleteOwnerWarning(); else openDeleteOwnerConfirm();
  };

  const executeDeleteOwner = () => {
    if (!ownerToDelete) return;
    const updatedOwners = owners.filter(o => o.id !== ownerToDelete.id);
    setOwners(updatedOwners);
    localStorage.setItem('finance_master_owners', JSON.stringify(updatedOwners));
    setOwnerToDelete(null);
    closeDeleteOwnerConfirm();
  };

  // ==========================================
  // FUNGSI CRUD MASTER BANK
  // ==========================================
  const openAddBankModal = () => {
    setEditingBankId(null);
    setEditingOldBankName('');
    setNewBaseBankName('');
    setNewProductName('');
    setNewBankInterestPeriod('YEAR');
    setNewBankTaxRate(20); // Reset ke 20%
    setBankTiers([{ id: Date.now().toString(), minBalance: 0, maxBalance: '', rate: 0 }]); 
    setBankErrors({ baseName: '', productName: '', interestPeriod: '', taxRate: '', tiers: '' });
    openBank();
  };

  const openEditBankModal = (bank: Bank) => {
    setEditingBankId(bank.id);
    setEditingOldBankName(bank.name); 
    setNewBaseBankName(bank.baseBankName || bank.name.split(' - ')[0]);
    setNewProductName(bank.productName || bank.name.split(' - ')[1] || 'Standar');
    setNewBankInterestPeriod(bank.interestPeriod || 'YEAR');
    setNewBankTaxRate(bank.taxRate ?? 20); // Load pajak sebelumnya, jika tidak ada default 20%
    
    if (bank.tiers && bank.tiers.length > 0) {
      setBankTiers(bank.tiers);
    } else {
      setBankTiers([{ id: Date.now().toString(), minBalance: 0, maxBalance: '', rate: bank.interestRate || 0 }]);
    }
    
    setBankErrors({ baseName: '', productName: '', interestPeriod: '', taxRate: '', tiers: '' });
    openBank();
  };

  const addTier = () => {
    setBankTiers([...bankTiers, { id: Date.now().toString(), minBalance: '', maxBalance: '', rate: '' }]);
  };

  const removeTier = (id: string) => {
    if (bankTiers.length === 1) return; 
    setBankTiers(bankTiers.filter(t => t.id !== id));
  };

  const updateTier = (id: string, field: keyof InterestTier, value: number | '') => {
    setBankTiers(bankTiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSaveBank = () => {
    const trimmedBaseName = newBaseBankName.trim();
    const trimmedProductName = newProductName.trim();
    const combinedName = `${trimmedBaseName} - ${trimmedProductName}`;
    const errors = { baseName: '', productName: '', interestPeriod: '', taxRate: '', tiers: '' };
    let hasError = false;

    if (!trimmedBaseName) { errors.baseName = 'Nama Bank Induk wajib diisi!'; hasError = true; }
    if (!trimmedProductName) { errors.productName = 'Tipe Rekening wajib diisi!'; hasError = true; }

    const isDuplicate = banks.some(b => b.name.toLowerCase() === combinedName.toLowerCase() && b.id !== editingBankId);
    if (isDuplicate) { errors.productName = `Produk "${combinedName}" sudah terdaftar!`; hasError = true; }
    if (!newBankInterestPeriod) { errors.interestPeriod = 'Pilih periode bunga!'; hasError = true; }
    if (newBankTaxRate === '') { errors.taxRate = 'Pajak wajib diisi (isi 0 jika bebas pajak)'; hasError = true; }

    const hasInvalidTier = bankTiers.some(t => t.rate === '' || t.minBalance === '');
    if (hasInvalidTier) {
      errors.tiers = 'Harap lengkapi semua kolom Bunga (%) dan Saldo Minimal pada tabel tier.';
      hasError = true;
    }

    if (hasError) {
      setBankErrors(errors);
      return;
    }

    let updatedBanks;

    if (editingBankId) {
      updatedBanks = banks.map(bank => 
        bank.id === editingBankId 
          ? { 
              ...bank, 
              name: combinedName, baseBankName: trimmedBaseName, productName: trimmedProductName,
              interestPeriod: newBankInterestPeriod as 'YEAR' | 'MONTH',
              taxRate: newBankTaxRate as number,
              tiers: bankTiers,
              interestRate: bankTiers[0].rate as number 
            }
          : bank
      );

      if (editingOldBankName !== combinedName) {
        const savedAccounts = localStorage.getItem('finance_accounts_v3');
        if (savedAccounts) {
          const parsedAccounts = JSON.parse(savedAccounts);
          const updatedAccounts = parsedAccounts.map((acc: any) => acc.bankName === editingOldBankName ? { ...acc, bankName: combinedName } : acc);
          localStorage.setItem('finance_accounts_v3', JSON.stringify(updatedAccounts));
          setActiveAccounts(updatedAccounts);
        }
      }
    } else {
      const newBank: Bank = { 
        id: Date.now().toString(), name: combinedName, baseBankName: trimmedBaseName, productName: trimmedProductName,
        interestPeriod: newBankInterestPeriod as 'YEAR' | 'MONTH',
        taxRate: newBankTaxRate as number,
        tiers: bankTiers, interestRate: bankTiers[0].rate as number
      };
      updatedBanks = [...banks, newBank];
    }
    
    setBanks(updatedBanks);
    localStorage.setItem('finance_master_banks', JSON.stringify(updatedBanks));
    closeBank();
  };

  const handleDeleteBankClick = (bankId: string, bankName: string) => {
    const linkedAccountsCount = activeAccounts.filter(acc => acc.bankName === bankName).length;
    setBankToDelete({ id: bankId, name: bankName, count: linkedAccountsCount });
    if (linkedAccountsCount > 0) openDeleteBankWarning(); else openDeleteBankConfirm();
  };

  const executeDeleteBank = () => {
    if (!bankToDelete) return;
    const updatedBanks = banks.filter(b => b.id !== bankToDelete.id);
    setBanks(updatedBanks);
    localStorage.setItem('finance_master_banks', JSON.stringify(updatedBanks));
    setBankToDelete(null);
    closeDeleteBankConfirm();
  };

  if (isLoading) return <DashboardLayout><Center h="50vh"><Loader color="cyan" /></Center></DashboardLayout>;

  return (
    <DashboardLayout>
      <Title order={2} mb="xs">Data Master</Title>
      <Text c="dimmed" mb="lg">Kelola daftar Pemilik dan Institusi Bank untuk mencegah salah ketik pada sistem.</Text>

      <Paper withBorder p="md" radius="md" shadow="sm">
        <Tabs defaultValue="owners" color="cyan">
          <Tabs.List mb="md">
            <Tabs.Tab value="owners" leftSection={<IconUsers size="1rem" />}>Master Pemilik</Tabs.Tab>
            <Tabs.Tab value="banks" leftSection={<IconBuildingBank size="1rem" />}>Master Produk Bank</Tabs.Tab>
          </Tabs.List>

          {/* TAB MASTER PEMILIK */}
          <Tabs.Panel value="owners">
            <Group justify="space-between" mb="md">
              <Text fw={600}>Daftar Nama Pemilik & Kontak</Text>
              <Button leftSection={<IconPlus size={16} />} color="cyan" onClick={openAddOwnerModal} size="sm">Tambah Pemilik</Button>
            </Group>
            <MantineAlert icon={<IconAlertTriangle size="1rem" />} color="orange" variant="light" mb="md" style={{ border: 'none' }}>
              Nama Pemilik yang sudah dihubungkan ke sebuah Rekening / Dompet tidak akan bisa dihapus.
            </MantineAlert>
            <div style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead bg={isDark ? 'dark.6' : 'gray.1'}>
                  <Table.Tr>
                    <Table.Th>Nama Pemilik</Table.Th>
                    <Table.Th>Email Aktif</Table.Th>
                    <Table.Th>Nomor Telepon</Table.Th>
                    <Table.Th w={120} style={{ textAlign: 'center' }}>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {owners.length > 0 ? owners.map((owner) => {
                    const accountCount = activeAccounts.filter(acc => acc.owner === owner.name).length;
                    return (
                      <Table.Tr key={owner.id}>
                        <Table.Td fw={600}>
                          {owner.name}
                          {accountCount > 0 && <Badge color="blue" size="xs" variant="light" ml="sm" style={{ verticalAlign: 'middle' }}>{accountCount} Akun</Badge>}
                        </Table.Td>
                        <Table.Td><Group gap="xs"><IconMail size={14} style={{ color: 'var(--mantine-color-dimmed)' }}/><Text size="sm">{owner.email}</Text></Group></Table.Td>
                        <Table.Td><Group gap="xs"><IconPhone size={14} style={{ color: 'var(--mantine-color-dimmed)' }}/><Text size="sm">{owner.phone}</Text></Group></Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Group gap="xs" justify="center" wrap="nowrap">
                            <ActionIcon color="blue" variant="subtle" onClick={() => openEditOwnerModal(owner)} title="Edit Kontak"><IconEdit size={18} /></ActionIcon>
                            <ActionIcon color={accountCount > 0 ? "gray" : "red"} variant="subtle" onClick={() => handleDeleteOwnerClick(owner.id, owner.name)} title={accountCount > 0 ? "Hapus Ditolak" : "Hapus Pemilik"}>
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  }) : (
                    <Table.Tr><Table.Td colSpan={4} ta="center" fs="italic" c="dimmed" py="xl">Belum ada data pemilik terdaftar.</Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>
          </Tabs.Panel>

          {/* TAB MASTER BANK */}
          <Tabs.Panel value="banks">
            <Group justify="space-between" mb="md">
              <Text fw={600}>Daftar Produk Bank & Suku Bunga</Text>
              <Button leftSection={<IconPlus size={16} />} color="teal" onClick={openAddBankModal} size="sm">
                Tambah Produk
              </Button>
            </Group>

            <MantineAlert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light" mb="md" style={{ border: 'none' }}>
              <Text size="sm">Sekarang Anda bisa menambahkan <b>Bunga Progresif (Sistem Tier)</b> beserta <b>Pajak Bunga</b> untuk akurasi perhitungan.</Text>
            </MantineAlert>
            
            <div style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead bg={isDark ? 'dark.6' : 'gray.1'}>
                  <Table.Tr>
                    <Table.Th>Institusi Bank Induk</Table.Th>
                    <Table.Th>Tipe Rekening / Kantong</Table.Th>
                    <Table.Th>Struktur Bunga Berjenjang & Pajak</Table.Th>
                    <Table.Th w={120} style={{ textAlign: 'center' }}>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {banks.length > 0 ? banks.map((bank) => {
                    const accountCount = activeAccounts.filter(acc => acc.bankName === bank.name).length;
                    const displayBaseName = bank.baseBankName || (bank.name.includes(' - ') ? bank.name.split(' - ')[0] : bank.name);
                    const displayProductName = bank.productName || (bank.name.includes(' - ') ? bank.name.split(' - ')[1] : 'Standar');
                    const isMultiTier = bank.tiers && bank.tiers.length > 1;

                    return (
                      <Table.Tr key={bank.id}>
                        <Table.Td fw={700}>{displayBaseName}</Table.Td>
                        <Table.Td>
                          <Badge color="gray" variant="light" size="md" radius="sm" mr="xs">{displayProductName}</Badge>
                          {accountCount > 0 && <Badge color="teal" size="xs" variant="filled" style={{ verticalAlign: 'middle' }}>{accountCount} Dipakai</Badge>}
                        </Table.Td>
                        <Table.Td>
                          {isMultiTier && bank.tiers ? (
                            <Stack gap={4}>
                              <Group gap="xs">
                                <Text size="xs" fw={700} c="blue">{bank.tiers.length} Tingkat Bunga ({bank.interestPeriod === 'MONTH' ? 'Per Bulan' : 'Per Tahun'}):</Text>
                                <Badge color="red" variant="light" size="xs">Pajak: {bank.taxRate ?? 20}%</Badge>
                              </Group>
                              {bank.tiers.map((t, i) => (
                                <Text key={i} size="xs" c="dimmed">
                                  • &ge; Rp{Number(t.minBalance).toLocaleString('id-ID')} {t.maxBalance !== '' ? ` s/d Rp${Number(t.maxBalance).toLocaleString('id-ID')}` : ' (Seterusnya)'} <Text component="span" c={isDark ? 'white' : 'black'} fw={600}>→ {t.rate}%</Text>
                                </Text>
                              ))}
                            </Stack>
                          ) : (
                            <Group gap="xs">
                              <Text size="sm" fw={600}>
                                {bank.tiers ? bank.tiers[0]?.rate : bank.interestRate}% <Text component="span" size="xs" c="dimmed" fw={500}>({bank.interestPeriod === 'MONTH' ? 'Per Bulan' : 'Per Tahun'})</Text>
                              </Text>
                              <Badge color="red" variant="light" size="xs">Pajak: {bank.taxRate ?? 20}%</Badge>
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Group gap="xs" justify="center" wrap="nowrap">
                            <ActionIcon color="blue" variant="subtle" onClick={() => openEditBankModal(bank)} title="Edit Produk"><IconEdit size={18} /></ActionIcon>
                            <ActionIcon color={accountCount > 0 ? "gray" : "red"} variant="subtle" onClick={() => handleDeleteBankClick(bank.id, bank.name)} title={accountCount > 0 ? "Hapus Ditolak" : "Hapus Bank"}>
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  }) : (
                    <Table.Tr><Table.Td colSpan={4} ta="center" fs="italic" c="dimmed" py="xl">Belum ada produk bank terdaftar.</Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      {/* ============================================================ */}
      {/* MODALS AREA: PEMILIK */}
      {/* ============================================================ */}
      <Modal opened={openedOwner} onClose={closeOwner} title={<Text fw={700} size="lg">{editingOwnerId ? "Ubah Data Kontak" : "Tambah Pemilik Baru"}</Text>} centered>
        <Stack gap="md">
          {editingOwnerId && <MantineAlert color="blue" variant="light" p="xs" style={{ border: 'none' }}><Text size="xs">Peringatan: Mengubah nama akan otomatis ter-update di seluruh dompet terkait.</Text></MantineAlert>}
          <TextInput label="Nama Lengkap" placeholder="Contoh: Naoya, Rama..." value={newOwnerName} onChange={(e) => setNewOwnerName(e.currentTarget.value)} withAsterisk data-autofocus error={ownerErrors.name} />
          <TextInput label="Alamat Email Aktif" placeholder="Contoh: naoya@email.com" type="email" value={newOwnerEmail} onChange={(e) => setNewOwnerEmail(e.currentTarget.value)} leftSection={<IconMail size={16} />} withAsterisk error={ownerErrors.email} />
          <TextInput label="Nomor Telepon" placeholder="Contoh: 08123456789" type="tel" value={newOwnerPhone} onChange={(e) => setNewOwnerPhone(e.currentTarget.value)} leftSection={<IconPhone size={16} />} withAsterisk error={ownerErrors.phone} />
          <Button color="cyan" onClick={handleSaveOwner} fullWidth mt="md">{editingOwnerId ? "Simpan Perubahan" : "Simpan Pemilik"}</Button>
        </Stack>
      </Modal>

      <Modal opened={deleteOwnerWarningOpened} onClose={closeDeleteOwnerWarning} title={<Text fw={700} c="red">Penghapusan Ditolak</Text>} centered>
        <Stack>
          <MantineAlert color="red" variant="filled"><b>{ownerToDelete?.name}</b> masih memiliki <b>{ownerToDelete?.count}</b> akun dompet aktif!</MantineAlert>
          <Text size="sm">Silakan hapus atau pindah-tangankan dompet milik {ownerToDelete?.name} di menu <b>Dompet & Akun</b> terlebih dahulu.</Text>
          <Button onClick={closeDeleteOwnerWarning} fullWidth variant="default">Saya Mengerti</Button>
        </Stack>
      </Modal>

      <Modal opened={deleteOwnerConfirmOpened} onClose={closeDeleteOwnerConfirm} title={<Text fw={700} c="red">Konfirmasi Penghapusan</Text>} centered>
        <Stack>
          <Text size="sm">Apakah Anda yakin ingin menghapus data pemilik <b>{ownerToDelete?.name}</b>?</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeDeleteOwnerConfirm}>Batal</Button>
            <Button color="red" onClick={executeDeleteOwner}>Ya, Hapus Data</Button>
          </Group>
        </Stack>
      </Modal>

      {/* ============================================================ */}
      {/* MODALS AREA: BANK / PRODUK DENGAN TABEL TIER */}
      {/* ============================================================ */}
      <Modal opened={openedBank} onClose={closeBank} title={<Text fw={700} size="lg">{editingBankId ? "Ubah Data Produk Bank" : "Tambah Produk Bank Baru"}</Text>} size="xl" centered>
        <Stack>
          <Group grow align="flex-start">
            <TextInput label="Institusi Bank Induk" placeholder="Contoh: Jenius" value={newBaseBankName} onChange={(e) => setNewBaseBankName(e.currentTarget.value)} withAsterisk data-autofocus error={bankErrors.baseName} />
            <TextInput label="Tipe Rekening / Produk" placeholder="Contoh: Flexi Saver" value={newProductName} onChange={(e) => setNewProductName(e.currentTarget.value)} withAsterisk error={bankErrors.productName} />
          </Group>
          
          <Group grow align="flex-start">
            <Select label="Hitungan Bunga Berlaku" data={[{ value: 'YEAR', label: 'Per Tahun (p.a.)' }, { value: 'MONTH', label: 'Per Bulan (p.m.)' }]} value={newBankInterestPeriod} onChange={setNewBankInterestPeriod} withAsterisk error={bankErrors.interestPeriod} />
            <NumberInput 
              label="Pajak Penghasilan (Bunga)" 
              placeholder="20" min={0} max={100} hideControls 
              value={newBankTaxRate} 
              onChange={(val) => setNewBankTaxRate(val === '' ? '' : Number(val))} 
              rightSection={<Text size="xs" c="dimmed">%</Text>} 
              withAsterisk 
              error={bankErrors.taxRate} 
            />
          </Group>

          <Divider my="sm" variant="dashed" />
          
          <div>
            <Group justify="space-between" mb="xs">
              <Text fw={700} size="sm">Tabel Suku Bunga Progresif (Tier)</Text>
              <Button size="compact-xs" variant="light" color="teal" onClick={addTier} leftSection={<IconPlus size={14}/>}>Tambah Tier</Button>
            </Group>
            
            {bankErrors.tiers && <MantineAlert color="red" p="xs" mb="sm" style={{ border: 'none' }}><Text size="xs">{bankErrors.tiers}</Text></MantineAlert>}

            <Stack gap="xs">
              {bankTiers.map((tier, index) => (
                <Group key={tier.id} grow align="flex-end" style={{ gap: '0.5rem' }}>
                  <NumberInput
                    label={index === 0 ? "Saldo Minimal" : ""}
                    placeholder="0" min={0} hideControls prefix="Rp "
                    value={tier.minBalance}
                    onChange={(val) => updateTier(tier.id, 'minBalance', val === '' ? '' : Number(val))}
                    thousandSeparator="." decimalSeparator=","
                  />
                  <NumberInput
                    label={index === 0 ? "Saldo Maksimal" : ""}
                    placeholder="Seterusnya..." min={0} hideControls prefix="Rp "
                    value={tier.maxBalance}
                    onChange={(val) => updateTier(tier.id, 'maxBalance', val === '' ? '' : Number(val))}
                    thousandSeparator="." decimalSeparator=","
                  />
                  <NumberInput
                    label={index === 0 ? "Bunga" : ""}
                    placeholder="0" min={0} max={100} hideControls
                    value={tier.rate}
                    onChange={(val) => updateTier(tier.id, 'rate', val === '' ? '' : Number(val))}
                    rightSection={<Text size="xs" c="dimmed">%</Text>}
                    styles={{ root: { maxWidth: 100 } }}
                  />
                  <ActionIcon color="red" variant="subtle" mb={4} onClick={() => removeTier(tier.id)} disabled={bankTiers.length === 1}>
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
            <Text size="xs" c="dimmed" mt="xs">Kosongkan kotak "Saldo Maksimal" pada tingkatan tertinggi yang berarti jumlah tersebut berlaku untuk nominal seterusnya.</Text>
          </div>

          <Button color="teal" onClick={handleSaveBank} fullWidth mt="md">
            {editingBankId ? "Simpan Perubahan" : "Simpan Produk Bank"}
          </Button>
        </Stack>
      </Modal>

      <Modal opened={deleteBankWarningOpened} onClose={closeDeleteBankWarning} title={<Text fw={700} c="red">Penghapusan Ditolak</Text>} centered>
        <Stack>
          <MantineAlert color="red" variant="filled">Produk <b>{bankToDelete?.name}</b> sedang dipakai di <b>{bankToDelete?.count}</b> dompet aktif!</MantineAlert>
          <Text size="sm">Silakan ubah Bank pada dompet-dompet tersebut di menu <b>Dompet & Akun</b> terlebih dahulu.</Text>
          <Button onClick={closeDeleteBankWarning} fullWidth variant="default">Saya Mengerti</Button>
        </Stack>
      </Modal>

      <Modal opened={deleteBankConfirmOpened} onClose={closeDeleteBankConfirm} title={<Text fw={700} c="red">Konfirmasi Penghapusan</Text>} centered>
        <Stack>
          <Text size="sm">Apakah Anda yakin ingin menghapus produk <b>{bankToDelete?.name}</b> dari sistem?</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeDeleteBankConfirm}>Batal</Button>
            <Button color="red" onClick={executeDeleteBank}>Ya, Hapus Data</Button>
          </Group>
        </Stack>
      </Modal>

    </DashboardLayout>
  );
}