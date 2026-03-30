'use client';

import { TextInput, PasswordInput, Button, Paper, Title, Container, Group, Anchor, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import Link from 'next/link';

export default function RegisterPage() {
  const form = useForm({
    initialValues: { email: '', password: '', confirmPassword: '' },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Email tidak valid'),
      password: (value) => (value.length < 6 ? 'Password minimal 6 karakter' : null),
      confirmPassword: (value, values) => 
        value !== values.password ? 'Password tidak sama' : null,
    },
  });

  return (
    <Container size={420} my={80}>
      <Title ta="center" fw={900}>Buat Akun Baru</Title>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit((values) => console.log('Daftar:', values))}>
          <Stack>
            <TextInput label="Email" placeholder="anda@email.com" required {...form.getInputProps('email')} />
            <PasswordInput label="Password" placeholder="Minimal 6 karakter" required {...form.getInputProps('password')} />
            <PasswordInput label="Konfirmasi Password" placeholder="Ulangi password" required {...form.getInputProps('confirmPassword')} />
            <Button type="submit" fullWidth mt="xl" color="green">Daftar</Button>
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