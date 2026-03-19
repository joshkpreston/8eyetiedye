<script lang="ts">
  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  type State = "email" | "sending" | "sent" | "error";
  let state = $state<State>("email");
  let email = $state("");
  let error = $state("");

  async function sendLink() {
    if (!email.includes("@")) {
      error = "Please enter a valid email address.";
      return;
    }

    state = "sending";
    error = "";

    try {
      const res = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || "Failed to send link";
        state = "email";
        return;
      }

      state = "sent";
    } catch {
      error = "Something went wrong. Please try again.";
      state = "email";
    }
  }

  function googleLogin() {
    window.location.href = "/api/auth/google";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  onclick={(e) => {
    if (e.target === e.currentTarget) onclose();
  }}
>
  <div
    class="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6"
  >
    <!-- Close button -->
    <div class="flex justify-between items-center mb-6">
      <h2 class="font-display font-bold text-lg">Sign In</h2>
      <button
        onclick={onclose}
        class="text-gray-500 hover:text-white transition-colors"
        aria-label="Close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    {#if state === "sent"}
      <!-- Success state -->
      <div class="text-center py-4">
        <div class="text-4xl mb-4">📧</div>
        <h3 class="font-display font-semibold text-lg mb-2">Check your inbox</h3>
        <p class="text-gray-400 text-sm mb-1">
          We sent a magic link to
        </p>
        <p class="text-white font-medium text-sm mb-4">{email}</p>
        <p class="text-gray-500 text-xs">
          Click the link in the email to sign in. It expires in 15 minutes.
        </p>
      </div>
    {:else}
      <!-- Email input -->
      <div class="space-y-4">
        <div>
          <label for="auth-email" class="block text-sm text-gray-400 mb-2">
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            bind:value={email}
            onkeydown={(e) => {
              if (e.key === "Enter") sendLink();
            }}
            class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {#if error}
          <p class="text-red-400 text-sm">{error}</p>
        {/if}

        <button
          onclick={sendLink}
          disabled={state === "sending"}
          class="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-display font-semibold rounded-xl transition-all"
        >
          {state === "sending" ? "Sending..." : "Send Magic Link"}
        </button>

        <!-- Divider -->
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-white/10"></div>
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="px-3 bg-surface-800 text-gray-500">or</span>
          </div>
        </div>

        <!-- Google OAuth -->
        <button
          onclick={googleLogin}
          class="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-3"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <p class="text-xs text-gray-600 text-center">
          Sign in to save your purchased designs and sync rolls across devices.
        </p>
      </div>
    {/if}
  </div>
</div>
