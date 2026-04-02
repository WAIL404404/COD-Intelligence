"use client";

import { startTransition, useActionState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignInState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialState: SignInState = {
  status: "idle",
  message: "",
};

async function requestMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return {
      status: "error",
      message: "Please enter your merchant admin email.",
    };
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "success",
    message: "Magic link sent. Check your inbox to continue.",
  };
}

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initialState);

  return (
    <form
      action={(formData) => startTransition(() => formAction(formData))}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">
          Merchant admin email
        </span>
        <input
          name="email"
          type="email"
          required
          placeholder="ops@merchant.ma"
          className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none transition focus:border-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send magic link"}
      </button>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-sm text-danger"
              : "text-sm text-success"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
