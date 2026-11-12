"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";

const COPY: Record<Mode, { title: string; description: string; submit: string; toggle: string }> = {
  signin: {
    title: "Welcome back",
    description: "Sign in to your OmniProfile vault.",
    submit: "Sign in",
    toggle: "New here? Create an account",
  },
  signup: {
    title: "Create your vault",
    description: "One profile for every job application.",
    submit: "Create account",
    toggle: "Already have an account? Sign in",
  },
};

interface LoginFormProps {
  next: string;
  initialMode: Mode;
  initialError?: string;
}

export function LoginForm({ next, initialMode, initialError }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [signInState, signInAction, signingIn] = useActionState<AuthFormState, FormData>(signIn, {
    error: initialError,
  });
  const [signUpState, signUpAction, signingUp] = useActionState<AuthFormState, FormData>(signUp, {});

  const copy = COPY[mode];
  const state = mode === "signin" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={mode === "signin" ? signInAction : signUpAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {state.notice}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : copy.submit}
          </Button>
        </form>

        <Button
          type="button"
          variant="link"
          className="mt-2 w-full"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {copy.toggle}
        </Button>
      </CardContent>
    </Card>
  );
}
