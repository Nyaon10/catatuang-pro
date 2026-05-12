'use client';

import { useState } from 'react';
import { TextInput, PasswordInput, Button, Paper, Title, Container, Group, Anchor, Stack, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconInfoCircle } from '@tabler/icons-react';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const form = useForm({
    initialValues: { email: '', password: '', confirmPassword: '' },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Email tidak valid'),
      password: (value) => (value.length < 6 ? 'Password minimal 6 karakter' : null),
      confirmPassword: (value, values) => 
        value !== values.password ? 'Password tidak sama' : null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message); // Notifikasi sukses
        router.push('/login'); // Lempar ke halaman login
      } else {
        setErrorMessage(data.message || 'Gagal mendaftar');
      }
    } catch (error) {
      setErrorMessage('Koneksi ke server gagal. Coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size={420} my={80}>
      <Title ta="center" fw={900}>Buat Akun Baru</Title>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        
        {errorMessage && (
          <Alert icon={<IconInfoCircle />} color="red" mb="md" variant="light">
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput label="Email" placeholder="anda@email.com" required {...form.getInputProps('email')} />
            <PasswordInput label="Password" placeholder="Minimal 6 karakter" required {...form.getInputProps('password')} />
            <PasswordInput label="Konfirmasi Password" placeholder="Ulangi password" required {...form.getInputProps('confirmPassword')} />
            <Button type="submit" fullWidth mt="xl" color="green" loading={isLoading}>
              Daftar
            </Button>
          </Stack>
        </form>

        <Group justify="center" mt="md">
          <Anchor component={Link} href="/login" size="sm">
            Sudah punya akun? Login
          </Anchor>
        </Group>
      </Paper>
    </Container>
  );
}