'use client';

import { useState } from 'react';
import { TextInput, PasswordInput, Button, Paper, Title, Container, Group, Anchor, Stack, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconInfoCircle } from '@tabler/icons-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Email tidak valid'),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        // Jika sukses, Cookie JWT otomatis tersimpan, langsung pindah ke Dashboard
        router.push('/');
      } else {
        setErrorMessage(data.message || 'Gagal login');
      }
    } catch (error) {
      setErrorMessage('Koneksi ke server gagal. Coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size={420} my={80}>
      <Title ta="center" fw={900}>Selamat Datang Kembali</Title>
      
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        
        {errorMessage && (
          <Alert icon={<IconInfoCircle />} color="red" mb="md" variant="light">
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput label="Email" placeholder="anda@email.com" required {...form.getInputProps('email')} />
            <PasswordInput label="Password" placeholder="Password Anda" required {...form.getInputProps('password')} />
            <Button type="submit" fullWidth mt="xl" loading={isLoading}>
              Masuk
            </Button>
          </Stack>
        </form>

        <Group justify="center" mt="md">
          <Anchor component={Link} href="/register" size="sm">
            Belum punya akun? Daftar
          </Anchor>
        </Group>
      </Paper>
    </Container>
  );
}