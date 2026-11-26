<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAppError } from '@/ui/useAppError';

const { appError } = useAppError();
</script>

<template>
  <div v-if="appError" class="notice-arrive w-full flex-none px-4 pt-4">
    <Alert variant="destructive" role="alert">
      <CircleAlert />
      <AlertTitle>Something went wrong inside the playground.</AlertTitle>
      <AlertDescription>
        Undo or Reset to continue. Details:
        <span class="font-mono break-all">{{ appError }}</span>
      </AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm" @click="appError = null">Dismiss</Button>
      </AlertAction>
    </Alert>
  </div>
</template>
