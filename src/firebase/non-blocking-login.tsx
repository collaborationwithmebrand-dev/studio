
'use client';
import {
  Auth,
  signInAnonymously,
} from 'firebase/auth';
import { errorEmitter } from './error-emitter';
import { FirebaseError } from 'firebase/app';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance).catch((error: FirebaseError) => {
    errorEmitter.emit('auth-error', error);
  });
}
