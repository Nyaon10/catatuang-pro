'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader } from '@mantine/core';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const expiry = localStorage.getItem('session_expiry');
    const now = Date.now();

    if (expiry && now < parseInt(expiry)) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <Center style={{ height: '100vh' }}>
      <Loader size="xl" color="blue" variant="dots" />
    </Center>
  );
}