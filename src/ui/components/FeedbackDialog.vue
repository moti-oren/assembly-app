<script setup lang="ts">
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FEEDBACK_KINDS, MESSAGE_LIMIT } from '@/ui/feedback';
import { useFeedback } from '@/ui/useFeedback';

const { open, draft, status, emailError, submit } = useFeedback();

/** The dialog opens ready to type in, not on the first of its buttons. */
function focusMessage(event: Event): void {
  const message = document.getElementById('feedback-message');
  if (!message) return;
  event.preventDefault();
  message.focus();
}

/** The form that held the focus is gone once it is sent: the confirmation takes it. */
function focusWhenShown(element: unknown): void {
  if (element instanceof HTMLElement) element.focus();
}

/**
 * What opened the dialog may be gone by the time it closes (the palette, a phone's sheet), so
 * the focus goes back to the header's own way in.
 */
function returnFocus(event: Event): void {
  const opener = document.querySelector<HTMLElement>('[data-feedback-opener]');
  if (!opener) return;
  event.preventDefault();
  opener.focus();
}
</script>

<!-- A short form to the developer, from any topic. What was typed stays until it is sent. -->
<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-md"
      @open-auto-focus="focusMessage"
      @close-auto-focus="returnFocus"
    >
      <DialogHeader>
        <DialogTitle>Send feedback</DialogTitle>
        <DialogDescription>
          What is missing, unclear or broken? It goes straight to the developer.
        </DialogDescription>
      </DialogHeader>

      <template v-if="status === 'sent'">
        <p :ref="focusWhenShown" role="status" tabindex="-1" class="text-sm outline-none">
          Thank you. Your feedback was sent.
        </p>
        <DialogFooter>
          <DialogClose as-child>
            <Button class="pointer-coarse:h-11">Close</Button>
          </DialogClose>
        </DialogFooter>
      </template>

      <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
        <div
          class="segmented self-start"
          :style="{
            '--segments': FEEDBACK_KINDS.length,
            '--active': FEEDBACK_KINDS.findIndex((each) => each.id === draft.kind)
          }"
          role="group"
          aria-label="Kind of feedback"
        >
          <Button
            v-for="kind in FEEDBACK_KINDS"
            :key="kind.id"
            type="button"
            variant="ghost"
            size="sm"
            class="h-7 px-3 text-xs pointer-coarse:h-11"
            :aria-pressed="draft.kind === kind.id"
            @click="draft.kind = kind.id"
          >
            {{ kind.label }}
          </Button>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="feedback-message" class="text-sm font-medium">Message</label>
          <Textarea
            id="feedback-message"
            v-model="draft.message"
            class="min-h-28"
            required
            :maxlength="MESSAGE_LIMIT"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="feedback-email" class="text-sm font-medium">
            Email <span class="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="feedback-email"
            v-model="draft.email"
            type="email"
            autocomplete="email"
            :aria-invalid="emailError !== null"
            aria-describedby="feedback-email-note"
          />
          <p
            id="feedback-email-note"
            aria-live="polite"
            class="text-xs"
            :class="emailError ? 'text-destructive' : 'text-muted-foreground'"
          >
            {{ emailError ?? 'Only used to answer you.' }}
          </p>
        </div>

        <!-- No person sees this field; see `trap` in feedback.ts. -->
        <input
          v-model="draft.trap"
          type="text"
          name="website"
          class="hidden"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
        />

        <p class="text-xs text-muted-foreground">
          Sent with it: the topic and CPU on show, the screen size, the theme and the app's version.
          Your program is not sent.
        </p>

        <p v-if="status === 'failed'" role="alert" class="text-sm text-destructive">
          It could not be sent. Check your connection and try again.
        </p>
        <p v-else-if="status === 'incomplete'" role="alert" class="text-sm text-destructive">
          Write a message first, and check the email address if you gave one.
        </p>

        <DialogFooter>
          <Button type="submit" class="pointer-coarse:h-11" :disabled="status === 'sending'">
            {{ status === 'sending' ? 'Sending…' : 'Send' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
