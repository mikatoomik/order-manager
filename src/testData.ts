import type { User } from '@supabase/supabase-js'

export interface UserProfile {
  avatar_url: string | null;
  nickname: string | null;
}
export interface UserCircle {
  nom: string;
}

export function getTestUser(): User {
  return {
    id: 'test-user-id',
    aud: 'authenticated',
    email: 'testuser@lica-europe.org',
    phone: '',
    app_metadata: {},
    user_metadata: {
      full_name: 'Test Utilisateur',
      first_name: 'Test',
      last_name: 'Utilisateur',
    },
    created_at: new Date().toISOString(),
    identities: [],
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  };
}

export function getTestProfile(): UserProfile {
  return {
    avatar_url: 'https://ui-avatars.com/api/?name=Test+Utilisateur',
    nickname: 'SuperTest',
  };
}
export function getTestCircles(): UserCircle[] {
  return [
    { nom: 'Cercle Alpha' },
    { nom: 'Cercle Beta' },
  ];
}
