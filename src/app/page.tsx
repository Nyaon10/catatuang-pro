'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader } from '@mantine/core';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Karena Middleware sudah memastikan hanya user dengan JWT yang bisa ke sini,
    // kita tidak perlu cek localStorage lagi. Langsung masuk ke Dashboard!
    router.push('/dashboard');
  }, [router]);

  return (
    <Center style={{ height: '100vh' }}>
      <Loader size="xl" color="blue" variant="dots" />
    </Center>
  );
}