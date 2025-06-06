export function getTestUser() {
  return {
    id: 'test-user-id',
    email: 'test@lica.org',
    aud: 'authenticated',
    role: 'authenticated',
    // Ajoutez d'autres champs si besoin
  };
}

export function getTestProfile() {
  return {
    avatar_url: null,
    nickname: 'Testeur',
  };
}