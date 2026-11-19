<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAppError } from '@/ui/useAppError';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const { appError } = useAppError();
</script>

<template>
  <div v-if="appError" class="mx-auto w-full max-w-(--page-width) px-4 pt-4 lg:px-6">
    <Alert variant="destructive" role="alert">
      <CircleAlert />
      <AlertTitle>{{ t.appError.title }}</AlertTitle>
      <AlertDescription>
        {{ t.appError.body }}
        <span class="font-mono break-all">{{ appError }}</span>
      </AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm" @click="appError = null">{{ t.appError.dismiss }}</Button>
      </AlertAction>
    </Alert>
  </div>
</template>
