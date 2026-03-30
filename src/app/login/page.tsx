'use client';

import { TextInput, PasswordInput, Button, Paper, Title, Container, Group, Anchor, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Email tidak valid'),
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    console.log('Login attempt:', values);
    
    // Simulasi session 10 menit
    const expiry = Date.now() + 10 * 60 * 1000;
    localStorage.setItem('session_expiry', expiry.toString());
    
    // Redirect ke root (halaman utama)
    router.push('/');
  };

  return (
    <Container size={420} my={80}>
      <Title ta="center" fw={900}>
        Selamat Datang Kembali
      </Title>
      
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput 
              label="Email" 
              placeholder="anda@email.com" 
              required 
              {...form.getInputProps('email')} 
            />
            <PasswordInput 
              label="Password" 
              placeholder="Password Anda" 
              required 
              {...form.getInputProps('password')} 
            />
            <Button type="submit" fullWidth mt="xl">
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