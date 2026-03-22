<script lang="ts">
  import AuthModal from "./AuthModal.svelte";

  interface AuthState {
    loggedIn: boolean;
    email?: string;
    username?: string;
  }

  let auth = $state<AuthState>({ loggedIn: false });
  let showDropdown = $state(false);
  let showAuthModal = $state(false);

  $effect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => (auth = data))
      .catch(() => {});
  });

  function initial(username?: string): string {
    return (username || "?")[0].toUpperCase();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && showDropdown) {
      showDropdown = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex items-center gap-3">
  {#if auth.loggedIn}
    <!-- Logged in: avatar + dropdown -->
    <div class="relative">
      <button
        onclick={() => (showDropdown = !showDropdown)}
        class="w-10 h-10 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center hover:bg-purple-700 transition-colors"
        aria-label="Account menu"
      >
        {initial(auth.username)}
      </button>

      {#if showDropdown}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="fixed inset-0 z-40"
          onclick={() => (showDropdown = false)}
        ></div>
        <div
          class="absolute right-0 top-10 z-50 w-48 bg-surface-800 border border-white/10 rounded-xl shadow-xl py-2"
        >
          <div class="px-4 py-2 border-b border-white/10">
            <p class="text-sm font-semibold text-white truncate">
              {auth.username}
            </p>
            <p class="text-xs text-gray-400 truncate">{auth.email}</p>
          </div>
          <a
            href="/my-designs"
            class="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            My Designs
          </a>
          <button
            onclick={logout}
            class="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Logged out: Sign In link + user icon -->
    <button
      onclick={() => (showAuthModal = true)}
      class="text-sm text-gray-400 hover:text-white transition-colors font-medium"
    >
      Sign In
    </button>
    <button
      onclick={() => (showAuthModal = true)}
      class="w-10 h-10 rounded-full bg-white/10 text-gray-400 text-sm flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
      aria-label="Sign in"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </button>
  {/if}
</div>

{#if showAuthModal}
  <AuthModal onclose={() => (showAuthModal = false)} />
{/if}
