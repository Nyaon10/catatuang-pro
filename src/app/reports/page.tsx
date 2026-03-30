'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Title, Paper, Text, Group, Button, SimpleGrid, Table, Center, Loader, Badge, TextInput, Alert, Stack, useComputedColorScheme } from '@mantine/core';
import { IconPrinter, IconInfoCircle, IconDownload } from '@tabler/icons-react';

export default function ReportsPage() {
  const theme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDark = theme === 'dark';

  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter Tanggal untuk Laporan Laba Rugi (Periode)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const savedAccounts = localStorage.getItem('finance_accounts_v3');
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));

    const savedTransactions = localStorage.getItem('finance_transactions_v2');
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));

    setIsLoading(false);
  }, []);

  // ========================================================
  // MESIN AKUNTANSI: MENGKATEGORIKAN TRANSAKSI
  // ========================================================
  const revenues: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  const otherAssets: Record<string, number> = {};
  const liabilities: Record<string, number> = {};
  const equity: Record<string, number> = {};

  const totalKas = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const processLedger = (accName: string, amount: number, isDebit: boolean, trxDate: string) => {
    const name = accName.trim();
    const nameLower = name.toLowerCase();
    const isWithinDate = (!startDate || trxDate >= startDate) && (!endDate || trxDate <= endDate);

    if (nameLower.includes('pendapatan') || nameLower.includes('bunga')) {
      if (isWithinDate) {
        if (!revenues[name]) revenues[name] = 0;
        revenues[name] += isDebit ? -amount : amount; 
      }
    }
    else if (nameLower.includes('beban') || nameLower.includes('biaya') || nameLower.includes('pajak') || nameLower.includes('gaji')) {
      if (isWithinDate) {
        if (!expenses[name]) expenses[name] = 0;
        expenses[name] += isDebit ? amount : -amount;
      }
    }
    else if (nameLower.includes('utang') || nameLower.includes('kewajiban')) {
      if (!endDate || trxDate <= endDate) {
        if (!liabilities[name]) liabilities[name] = 0;
        liabilities[name] += isDebit ? -amount : amount;
      }
    }
    else if (nameLower.includes('modal') || nameLower.includes('prive') || nameLower.includes('investasi')) {
      if (!endDate || trxDate <= endDate) {
        if (!equity[name]) equity[name] = 0;
        equity[name] += isDebit ? -amount : amount;
      }
    }
    else if (nameLower.includes('piutang') || nameLower.includes('peralatan') || nameLower.includes('persediaan')) {
      if (!endDate || trxDate <= endDate) {
        if (!otherAssets[name]) otherAssets[name] = 0;
        otherAssets[name] += isDebit ? amount : -amount;
      }
    }
  };

  transactions.forEach(trx => {
    if (trx.isDoubleEntry) {
      if (trx.debitName && trx.debitId === 'MANUAL') processLedger(trx.debitName, trx.amount, true, trx.date);
      if (trx.creditName && trx.creditId === 'MANUAL') processLedger(trx.creditName, trx.amount, false, trx.date);
    } else {
      if (trx.type === 'INCOME') {
        processLedger('Pendapatan Lain-lain (Auto)', trx.amount, false, trx.date);
      } else {
        processLedger('Beban Lain-lain (Auto)', trx.amount, true, trx.date);
      }
    }
  });

  // ========================================================
  // KALKULASI TOTAL
  // ========================================================
  const totalRevenue = Object.values(revenues).reduce((a, b) => a + b, 0);
  const totalExpense = Object.values(expenses).reduce((a, b) => a + b, 0);
  const labaBersih = totalRevenue - totalExpense;

  const totalOtherAssets = Object.values(otherAssets).reduce((a, b) => a + b, 0);
  const totalAktiva = totalKas + totalOtherAssets;

  const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
  const totalBaseEquity = Object.values(equity).reduce((a, b) => a + b, 0);
  
  const modalAwalSistem = totalAktiva - totalLiabilities - totalBaseEquity - labaBersih;
  const totalPasiva = totalLiabilities + totalBaseEquity + labaBersih + modalAwalSistem;

  // ========================================================
  // FUNGSI EXPORT EXCEL (CSV)
  // ========================================================
  const downloadExcel = () => {
    let csv = "LAPORAN KEUANGAN\n";
    csv += `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}\n\n`;

    csv += "LAPORAN LABA RUGI\n";
    csv += "Kategori,Nama Akun,Jumlah (Rp)\n";
    
    csv += "PENDAPATAN,,\n";
    Object.entries(revenues).forEach(([k, v]) => csv += `,"${k}","${v}"\n`);
    csv += `TOTAL PENDAPATAN,,"${totalRevenue}"\n\n`;

    csv += "PENGELUARAN / BEBAN,,\n";
    Object.entries(expenses).forEach(([k, v]) => csv += `,"${k}","${v}"\n`);
    csv += `TOTAL BEBAN,,"${totalExpense}"\n\n`;
    
    csv += `LABA / RUGI BERSIH,,"${labaBersih}"\n\n\n`;

    csv += "NERACA (BALANCE SHEET)\n";
    csv += "Kategori,Nama Akun,Jumlah (Rp)\n";
    
    csv += "AKTIVA (ASET),,\n";
    csv += `,"Kas & Simpanan Dompet","${totalKas}"\n`;
    Object.entries(otherAssets).forEach(([k, v]) => csv += `,"${k}","${v}"\n`);
    csv += `TOTAL AKTIVA,,"${totalAktiva}"\n\n`;

    csv += "KEWAJIBAN & EKUITAS,,\n";
    csv += "Kewajiban (Utang),,\n";
    Object.entries(liabilities).forEach(([k, v]) => csv += `,"${k}","${v}"\n`);
    
    csv += "Ekuitas (Modal),,\n";
    csv += `,"Modal Awal (Saldo Dompet)","${modalAwalSistem}"\n`;
    Object.entries(equity).forEach(([k, v]) => csv += `,"${k}","${v}"\n`);
    csv += `,"Laba Bersih Berjalan","${labaBersih}"\n`;
    
    csv += `TOTAL KEWAJIBAN & EKUITAS,,"${totalPasiva}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Keuangan_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <DashboardLayout><Center h="50vh"><Loader color="blue" /></Center></DashboardLayout>;

  return (
    <DashboardLayout>
      <Group justify="space-between" mb="lg" className="no-print">
        <div>
          <Title order={2}>Laporan Keuangan</Title>
          <Text c="dimmed">Dihasilkan otomatis berdasarkan Jurnal Umum Anda.</Text>
        </div>
      </Group>

      {/* Area Filter & Tombol Aksi */}
      <Paper withBorder p="md" radius="md" mb="xl" className="no-print" shadow="xs">
        <Group align="flex-end" justify="space-between">
          <Group>
            <TextInput 
              type="date" 
              label="Periode Mulai" 
              value={startDate} 
              onChange={(e) => setStartDate(e.currentTarget.value)} 
            />
            <TextInput 
              type="date" 
              label="Periode Sampai" 
              value={endDate} 
              onChange={(e) => setEndDate(e.currentTarget.value)} 
            />
          </Group>
          
          <Group>
            {/* PERBAIKAN: Tombol Cetak PDF disamakan formatnya (variant="light") dan berwarna oranye */}
            <Button color="orange" variant="light" leftSection={<IconPrinter size={18} />} onClick={() => window.print()}>
              Cetak Laporan / PDF
            </Button>
            <Button color="teal" variant="light" leftSection={<IconDownload size={18} />} onClick={downloadExcel}>
              Download Excel (.csv)
            </Button>
          </Group>
        </Group>
      </Paper>

      <Alert icon={<IconInfoCircle />} color="blue" variant="light" mb="xl" className="no-print">
        Laporan Laba Rugi menampilkan data berdasarkan <b>Periode Tanggal</b> yang dipilih. Neraca menampilkan akumulasi data <b>hingga Periode Sampai</b> (As of Date). Pastikan nama akun Anda mengandung kata kunci standar (Beban, Pendapatan, Piutang, Utang, Modal) agar masuk ke laporan dengan benar.
      </Alert>

      {/* AREA CETAK LAPORAN */}
      <div className="print-area">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          
          {/* ======================================================= */}
          {/* LAPORAN LABA RUGI (INCOME STATEMENT) */}
          {/* ======================================================= */}
          <Paper withBorder p="xl" radius="md" shadow="sm" style={{ height: '100%' }}>
            <Center mb="lg">
              <Stack gap={0} align="center">
                <Title order={3}>LAPORAN LABA RUGI</Title>
                <Text fw={500} c="dimmed">
                  Periode: {startDate ? startDate : 'Awal'} s/d {endDate ? endDate : 'Sekarang'}
                </Text>
              </Stack>
            </Center>

            <Table verticalSpacing="sm" withRowBorders={false}>
              <Table.Tbody>
                <Table.Tr><Table.Td colSpan={2} fw={800} fz="md" bg={isDark ? 'dark.6' : 'gray.1'}>Pendapatan:</Table.Td></Table.Tr>
                {Object.entries(revenues).map(([name, amount]) => (
                  <Table.Tr key={name}>
                    <Table.Td pl={30}>{name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{amount.toLocaleString('id-ID')}</Table.Td>
                  </Table.Tr>
                ))}
                {Object.keys(revenues).length === 0 && (
                  <Table.Tr><Table.Td pl={30} c="dimmed" fs="italic">Tidak ada pendapatan tercatat.</Table.Td><Table.Td></Table.Td></Table.Tr>
                )}
                <Table.Tr style={{ borderTop: `2px solid ${isDark ? '#373A40' : '#dee2e6'}` }}>
                  <Table.Td pl={30} fw={700}>Total Pendapatan</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} fw={700} c="green.7">{totalRevenue.toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>

                <Table.Tr><Table.Td colSpan={2} py="sm"></Table.Td></Table.Tr>

                <Table.Tr><Table.Td colSpan={2} fw={800} fz="md" bg={isDark ? 'dark.6' : 'gray.1'}>Pengeluaran / Beban:</Table.Td></Table.Tr>
                {Object.entries(expenses).map(([name, amount]) => (
                  <Table.Tr key={name}>
                    <Table.Td pl={30}>{name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{amount.toLocaleString('id-ID')}</Table.Td>
                  </Table.Tr>
                ))}
                {Object.keys(expenses).length === 0 && (
                  <Table.Tr><Table.Td pl={30} c="dimmed" fs="italic">Tidak ada beban tercatat.</Table.Td><Table.Td></Table.Td></Table.Tr>
                )}
                <Table.Tr style={{ borderTop: `2px solid ${isDark ? '#373A40' : '#dee2e6'}` }}>
                  <Table.Td pl={30} fw={700}>Total Beban</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} fw={700} c="red.7">({totalExpense.toLocaleString('id-ID')})</Table.Td>
                </Table.Tr>

                <Table.Tr><Table.Td colSpan={2} py="md"></Table.Td></Table.Tr>

                <Table.Tr style={{ borderTop: `3px double ${isDark ? '#5C5F66' : '#333'}` }}>
                  <Table.Td fw={800} fz="lg">Laba / Rugi Bersih</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} fw={800} fz="lg" c={labaBersih >= 0 ? 'blue.7' : 'red.7'}>
                    Rp {labaBersih.toLocaleString('id-ID')}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>

          {/* ======================================================= */}
          {/* NERACA (BALANCE SHEET) */}
          {/* ======================================================= */}
          <Paper withBorder p="xl" radius="md" shadow="sm" style={{ height: '100%' }}>
            <Center mb="lg">
              <Stack gap={0} align="center">
                <Title order={3}>NERACA (BALANCE SHEET)</Title>
                <Text fw={500} c="dimmed">Per Tanggal: {endDate ? endDate : new Date().toLocaleDateString('en-CA')}</Text>
              </Stack>
            </Center>

            <Table verticalSpacing="sm" withRowBorders={false}>
              <Table.Tbody>
                <Table.Tr><Table.Td colSpan={2} fw={800} fz="md" bg={isDark ? 'dark.6' : 'gray.1'} c={isDark ? 'blue.4' : 'blue.8'}>AKTIVA (ASET)</Table.Td></Table.Tr>
                <Table.Tr>
                  <Table.Td pl={30}>Kas & Simpanan Dompet</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{totalKas.toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>
                {Object.entries(otherAssets).map(([name, amount]) => (
                  <Table.Tr key={name}>
                    <Table.Td pl={30}>{name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{amount.toLocaleString('id-ID')}</Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr style={{ borderTop: `2px solid ${isDark ? '#373A40' : '#dee2e6'}` }}>
                  <Table.Td fw={700}>Total Aktiva</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} fw={800} c={isDark ? 'blue.4' : 'blue.7'}>Rp {totalAktiva.toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>

                <Table.Tr><Table.Td colSpan={2} py="sm"></Table.Td></Table.Tr>

                <Table.Tr><Table.Td colSpan={2} fw={800} fz="md" bg={isDark ? 'dark.6' : 'gray.1'} c={isDark ? 'orange.4' : 'orange.8'}>KEWAJIBAN & EKUITAS</Table.Td></Table.Tr>
                
                <Table.Tr><Table.Td colSpan={2} fw={700} pl={15} c="dimmed">Kewajiban (Utang)</Table.Td></Table.Tr>
                {Object.entries(liabilities).map(([name, amount]) => (
                  <Table.Tr key={name}>
                    <Table.Td pl={30}>{name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{amount.toLocaleString('id-ID')}</Table.Td>
                  </Table.Tr>
                ))}
                {Object.keys(liabilities).length === 0 && (
                  <Table.Tr><Table.Td pl={30} c="dimmed" fs="italic">Tidak ada utang tercatat.</Table.Td><Table.Td></Table.Td></Table.Tr>
                )}

                <Table.Tr><Table.Td colSpan={2} fw={700} pl={15} c="dimmed" pt="md">Ekuitas (Modal)</Table.Td></Table.Tr>
                <Table.Tr>
                  <Table.Td pl={30}>Modal Awal (Saldo Dompet)</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{modalAwalSistem.toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>
                {Object.entries(equity).map(([name, amount]) => (
                  <Table.Tr key={name}>
                    <Table.Td pl={30}>{name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{amount.toLocaleString('id-ID')}</Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td pl={30}>Laba Bersih Berjalan</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{labaBersih.toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>

                <Table.Tr style={{ borderTop: `2px solid ${isDark ? '#373A40' : '#dee2e6'}` }}>
                  <Table.Td fw={700}>Total Kewajiban & Ekuitas</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} fw={800} c={isDark ? 'orange.5' : 'orange.7'}>Rp {totalPasiva.toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>

                <Table.Tr><Table.Td colSpan={2} py="md"></Table.Td></Table.Tr>
                <Table.Tr style={{ borderTop: `3px double ${isDark ? '#5C5F66' : '#333'}` }}>
                  <Table.Td fw={800} fz="sm">Status Keseimbangan:</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {totalAktiva === totalPasiva ? (
                      <Badge color="green" size="lg">SEIMBANG (BALANCE)</Badge>
                    ) : (
                      <Badge color="red" size="lg">TIDAK SEIMBANG</Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>

        </SimpleGrid>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { background: white !important; }
          .no-print, nav, header { display: none !important; }
          .mantine-AppShell-main { padding: 0 !important; margin: 0 !important; }
          .print-area { width: 100%; display: block; }
          .mantine-Paper-root { border: none !important; box-shadow: none !important; page-break-inside: avoid; margin-bottom: 2rem; }
        }
      `}} />
    </DashboardLayout>
  );
}